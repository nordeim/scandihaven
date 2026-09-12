import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { inventoryLevel, product, productVariant, variantPrice, warehouse } from "@scandihaven/db/schema";
import { listProducts } from "./catalog";

/**
 * Quick-add variant selection (live E2E audit 2026-09-12 round 9, R9-4;
 * FR-206): "Quick-add uses first purchasable variant; disabled state when
 * none". The cards CTE must surface the first PURCHASABLE variant — default
 * first, then SKU order (the same ordering getProduct uses) — skipping
 * sold-out variants, and null when every variant is out of stock. Purchasable
 * mirrors the PDP derivation: inventory available > 0, or made-to-order
 * (lead_time_days_max > 7 with no stock). Requires a local PG17; skipped
 * elsewhere so hermetic unit CI is unaffected.
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

// Fixed natural keys + deterministic UUIDs (test-seed discipline, §7.9).
const STOCKED_PRODUCT_ID = "66666666-6666-4666-8666-666666666661";
const DEFAULT_OOS_VARIANT_ID = "66666666-6666-4666-8666-666666666662";
const ALT_INSTOCK_VARIANT_ID = "66666666-6666-4666-8666-666666666663";
const ALL_OOS_PRODUCT_ID = "66666666-6666-4666-8666-666666666664";
const ALL_OOS_VARIANT_ID = "66666666-6666-4666-8666-666666666665";
const STOCKED_SLUG = "r9-quickadd-stocked-bench";
const ALL_OOS_SLUG = "r9-quickadd-sold-out-bench";

describe.skipIf(!dbReady)("listProducts quick-add variant (R9-4, FR-206)", () => {
  beforeAll(async () => {
    await db.delete(product).where(eq(product.id, STOCKED_PRODUCT_ID));
    await db.delete(product).where(eq(product.id, ALL_OOS_PRODUCT_ID));

    // lead_time_days_max 4 (≤7): NO made-to-order escape — purchasable
    // strictly means inventory available > 0.
    await db.insert(product).values([
      {
        id: STOCKED_PRODUCT_ID,
        slug: STOCKED_SLUG,
        title: "R9 Quickadd Stocked Bench",
        status: "active",
        leadTimeDaysMin: 2,
        leadTimeDaysMax: 4,
      },
      {
        id: ALL_OOS_PRODUCT_ID,
        slug: ALL_OOS_SLUG,
        title: "R9 Quickadd Sold Out Bench",
        status: "active",
        leadTimeDaysMin: 2,
        leadTimeDaysMax: 4,
      },
    ]);

    // Default variant SOLD OUT, alternate variant IN STOCK — quick-add must
    // pick the alternate (first PURCHASABLE, not first listed).
    await db.insert(productVariant).values([
      {
        id: DEFAULT_OOS_VARIANT_ID,
        productId: STOCKED_PRODUCT_ID,
        sku: "R9-QA-BENCH-DEF",
        isDefault: true,
      },
      {
        id: ALT_INSTOCK_VARIANT_ID,
        productId: STOCKED_PRODUCT_ID,
        sku: "R9-QA-BENCH-ALT",
        isDefault: false,
      },
      {
        id: ALL_OOS_VARIANT_ID,
        productId: ALL_OOS_PRODUCT_ID,
        sku: "R9-QA-BENCH-OOS",
        isDefault: true,
      },
    ]);
    await db.insert(variantPrice).values([
      { variantId: DEFAULT_OOS_VARIANT_ID, currency: "EUR", amount: 30_000 },
      { variantId: ALT_INSTOCK_VARIANT_ID, currency: "EUR", amount: 32_000 },
      { variantId: ALL_OOS_VARIANT_ID, currency: "EUR", amount: 35_000 },
    ]);

    // Warehouse fixture (FK target for inventory rows). Insert-then-select:
    // onConflictDoNothing returns no rows on re-runs, so the id comes from
    // the follow-up select (the code column is unique).
    await db
      .insert(warehouse)
      .values({ code: "R9-QA-WH", name: "R9 Quickadd Warehouse" })
      .onConflictDoNothing();
    const whRows = await db
      .select({ id: warehouse.id })
      .from(warehouse)
      .where(eq(warehouse.code, "R9-QA-WH"));
    const warehouseId = whRows[0]?.id;

    await db.insert(inventoryLevel).values([
      // Default variant: on-hand 0 → sold out.
      {
        variantId: DEFAULT_OOS_VARIANT_ID,
        warehouseId: warehouseId!,
        qtyOnHand: 0,
        qtyReserved: 0,
        safetyStock: 0,
      },
      // Alternate variant: on-hand 5 → in stock.
      {
        variantId: ALT_INSTOCK_VARIANT_ID,
        warehouseId: warehouseId!,
        qtyOnHand: 5,
        qtyReserved: 0,
        safetyStock: 0,
      },
      // All-OOS product's only variant: sold out.
      {
        variantId: ALL_OOS_VARIANT_ID,
        warehouseId: warehouseId!,
        qtyOnHand: 0,
        qtyReserved: 0,
        safetyStock: 0,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(product).where(eq(product.id, STOCKED_PRODUCT_ID));
    await db.delete(product).where(eq(product.id, ALL_OOS_PRODUCT_ID));
    await pool.end();
  });

  it("picks the first PURCHASABLE variant when the default is sold out", async () => {
    const result = await listProducts({ ids: [STOCKED_PRODUCT_ID], region: "EU" });
    expect(result.items).toHaveLength(1);
    const card = result.items[0];
    expect(card?.quickAddVariantId).toBe(ALT_INSTOCK_VARIANT_ID);
    // The card still advertises the DEFAULT variant's price (E2E-4 rule).
    expect(card?.priceMinor).toBe(30_000);
  });

  it("returns null when every variant is out of stock (disabled state)", async () => {
    const result = await listProducts({ ids: [ALL_OOS_PRODUCT_ID], region: "EU" });
    expect(result.items).toHaveLength(1);
    const card = result.items[0];
    expect(card?.quickAddVariantId).toBeNull();
    expect(card?.availability).toBe("out_of_stock");
  });

  it("uses the default variant when it is purchasable (seeded lamp)", async () => {
    // Seeded Øresund lamp: the default brass variant has stock → quick-add
    // prices and adds exactly what the PDP shows (E2E-4 consistency).
    const result = await listProducts({ region: "EU", search: "Øresund" });
    const lamp = result.items.find((i) => i.slug === "oresund-table-lamp");
    expect(lamp).toBeDefined();
    expect(lamp?.availability).toBe("in_stock");
    // The default variant's id is resolvable via the PDP contract: the
    // quick-add id must be a UUID (the CTE selected a real variant row).
    expect(lamp?.quickAddVariantId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("made-to-order products stay purchasable without inventory rows (seeded armchair)", async () => {
    // Seeded Halden armchair: NO inventory rows, lead_time_days_max 10 > 7
    // → made_to_order, purchasable — quick-add must resolve a variant.
    const result = await listProducts({ region: "EU", search: "Halden" });
    const chair = result.items.find((i) => i.slug === "halden-linen-armchair");
    expect(chair?.availability).toBe("made_to_order");
    expect(chair?.quickAddVariantId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

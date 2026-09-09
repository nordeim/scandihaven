import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { product, productVariant, variantPrice } from "@scandihaven/db/schema";
import { listProducts } from "./catalog";

/**
 * Card-price rollup (live E2E audit 2026-09-10, E2E-4): a product card must
 * show the DEFAULT variant's price — the one PDP, JSON-LD and quick-add all
 * use — with the cheapest variant only as fallback when no default exists.
 * The old `MIN(vp.amount)` rollup advertised €229 for a lamp whose default
 * variant (and every downstream price) says €249. Requires a local PG17;
 * skipped elsewhere so hermetic unit CI is unaffected (E2E-4 seam).
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

const PRODUCT_ID = "33333333-3333-4333-8333-333333333331";
const DEFAULT_VARIANT_ID = "33333333-3333-4333-8333-333333333332";
const CHEAP_VARIANT_ID = "33333333-3333-4333-8333-333333333333";
const NO_DEFAULT_PRODUCT_ID = "33333333-3333-4333-8333-333333333334";
const NO_DEFAULT_VARIANT_ID = "33333333-3333-4333-8333-333333333335";
const MISMATCH_PRODUCT_ID = "33333333-3333-4333-8333-333333333336";
const MISMATCH_CHEAP_VARIANT_ID = "33333333-3333-4333-8333-333333333337";
const MISMATCH_EXPENSIVE_VARIANT_ID = "33333333-3333-4333-8333-333333333338";
const SLUG = "e2e4-price-rollup-chair";
const NO_DEFAULT_SLUG = "e2e4-price-rollup-no-default";
const MISMATCH_SLUG = "e2e4-price-rollup-mismatch";

describe.skipIf(!dbReady)("listProducts card price rollup (E2E-4)", () => {
  beforeAll(async () => {
    for (const id of [PRODUCT_ID, NO_DEFAULT_PRODUCT_ID, MISMATCH_PRODUCT_ID]) {
      await db.delete(product).where(eq(product.id, id));
    }
    await db.insert(product).values([
      {
        id: PRODUCT_ID,
        slug: SLUG,
        title: "E2E-4 Price Rollup Chair",
        status: "active",
        leadTimeDaysMin: 2,
        leadTimeDaysMax: 10, // >7 → made_to_order without inventory rows
      },
      {
        id: NO_DEFAULT_PRODUCT_ID,
        slug: NO_DEFAULT_SLUG,
        title: "E2E-4 No Default Table",
        status: "active",
        leadTimeDaysMin: 2,
        leadTimeDaysMax: 10,
      },
      {
        id: MISMATCH_PRODUCT_ID,
        slug: MISMATCH_SLUG,
        title: "E2E-4 Mismatch Table",
        status: "active",
        leadTimeDaysMin: 2,
        leadTimeDaysMax: 10,
      },
    ]);
    await db.insert(productVariant).values([
      {
        id: DEFAULT_VARIANT_ID,
        productId: PRODUCT_ID,
        sku: "E2E4-CHAIR-DEF",
        isDefault: true,
      },
      {
        id: CHEAP_VARIANT_ID,
        productId: PRODUCT_ID,
        sku: "E2E4-CHAIR-CHEAP",
        isDefault: false,
      },
      {
        id: NO_DEFAULT_VARIANT_ID,
        productId: NO_DEFAULT_PRODUCT_ID,
        sku: "E2E4-TABLE-NODEF",
        isDefault: false,
      },
      {
        id: MISMATCH_CHEAP_VARIANT_ID,
        productId: MISMATCH_PRODUCT_ID,
        sku: "E2E4-MISMATCH-CHEAP",
        isDefault: false,
      },
      {
        id: MISMATCH_EXPENSIVE_VARIANT_ID,
        productId: MISMATCH_PRODUCT_ID,
        sku: "E2E4-MISMATCH-EXP",
        isDefault: false,
      },
    ]);
    await db.insert(variantPrice).values([
      {
        variantId: DEFAULT_VARIANT_ID,
        currency: "EUR",
        amount: 24_900,
        compareAt: null,
      },
      {
        variantId: CHEAP_VARIANT_ID,
        currency: "EUR",
        amount: 22_900,
        compareAt: 25_900, // sale badge must not leak onto the default variant
      },
      { variantId: NO_DEFAULT_VARIANT_ID, currency: "EUR", amount: 12_900 },
      { variantId: MISMATCH_CHEAP_VARIANT_ID, currency: "EUR", amount: 10_000, compareAt: null },
      { variantId: MISMATCH_EXPENSIVE_VARIANT_ID, currency: "EUR", amount: 20_000, compareAt: 30_000 },
    ]);
  });

  afterAll(async () => {
    await db.delete(product).where(eq(product.id, PRODUCT_ID));
    await db.delete(product).where(eq(product.id, NO_DEFAULT_PRODUCT_ID));
    await db.delete(product).where(eq(product.id, MISMATCH_PRODUCT_ID));
    await pool.end();
  });

  it("prices the card from the default variant, matching PDP and quick-add", async () => {
    const result = await listProducts({ ids: [PRODUCT_ID] });
    expect(result.items).toHaveLength(1);
    const card = result.items[0];
    expect(card?.priceMinor).toBe(24_900);
    // The default variant is not on sale — the cheaper variant's compareAt
    // must not fabricate a "Sale" badge on the card.
    expect(card?.compareAtMinor).toBeNull();
    expect(card?.badge).toBeNull();
  });

  it("falls back to the cheapest variant when no default exists", async () => {
    const result = await listProducts({ ids: [NO_DEFAULT_PRODUCT_ID] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.priceMinor).toBe(12_900);
  });

  it("pairs compare_at with the cheapest variant in the no-default fallback (R2)", async () => {
    // Before the LATERAL fix, amount came from MIN(amount)=10_000 but
    // compare_at came from MAX(compare_at)=30_000 (the *other* variant) —
    // fabricating a Sale badge for a variant that is not on sale. The
    // LATERAL now pairs both columns from the same cheapest variant.
    const result = await listProducts({ ids: [MISMATCH_PRODUCT_ID] });
    expect(result.items).toHaveLength(1);
    const card = result.items[0]!;
    expect(card.priceMinor).toBe(10_000);
    expect(card.compareAtMinor).toBeNull();
    expect(card.badge).toBeNull();
  });
});

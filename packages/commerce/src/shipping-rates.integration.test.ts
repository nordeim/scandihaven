import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { cart, cartLine, product, productVariant, variantPrice } from "@scandihaven/db/schema";
import {
  createRatesTableShippingProvider,
  estimateShippingForCart,
} from "./shipping-rates";

/**
 * Rates-table shipping adapter (live E2E audit 2026-09-12 round 9, R9-3;
 * FR-402): the cart's postcode estimate resolves the destination zone by
 * country, picks the weight-banded rows, and enforces the white-glove rule
 * above 30 kg (the ShippingRateProvider port contract, FR-409/507). Runs
 * against the SEEDED zones/rates (EU/US/UK × standard/express/white-glove/
 * pickup) exactly like the sitemap-parity suite uses seeded rows. Requires a
 * local PG17; skipped elsewhere so hermetic unit CI is unaffected.
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

const CART_ID = "55555555-5555-4555-8555-555555555552";
const PRODUCT_ID = "55555555-5555-4555-8555-555555555553";
const VARIANT_ID = "55555555-5555-4555-8555-555555555554";
const LINE_ID = "55555555-5555-4555-8555-555555555555";

// Seeded EU standard/express bands (ensure-seeded.ts): ≤5 000 g → €49.00
// standard / €129.00 express; 5 001–30 000 g → €149.00 standard; white-glove
// >30 000 g → €399.00 (forced). US/UK zones mirror at 1.3/1.2 factors in
// zone-native currency. Pickup is free everywhere.
const EU = { region: "EU" as const, currency: "EUR", postalCode: "1050", subtotalMinor: 24_900 };

describe.skipIf(!dbReady)("rates-table shipping adapter (R9-3, FR-402)", () => {
  const provider = createRatesTableShippingProvider();

  beforeAll(async () => {
    // Cart fixture: one line of a 1 800 g variant at €200.00 (qty 2 → 3 600 g,
    // €400.00) — inside the ≤5 000 g band with a subtotal above nothing.
    await db.delete(cartLine).where(eq(cartLine.id, LINE_ID));
    await db.delete(cart).where(eq(cart.id, CART_ID));
    await db.delete(product).where(eq(product.id, PRODUCT_ID));

    await db.insert(product).values({
      id: PRODUCT_ID,
      slug: "r9-shipping-estimate-lamp",
      title: "R9 Shipping Lamp",
      status: "active",
      leadTimeDaysMin: 2,
      leadTimeDaysMax: 4,
    });
    await db.insert(productVariant).values({
      id: VARIANT_ID,
      productId: PRODUCT_ID,
      sku: "R9-SHIP-LMP",
      isDefault: true,
      weightG: 1_800,
    });
    await db.insert(variantPrice).values({
      variantId: VARIANT_ID,
      currency: "EUR",
      amount: 20_000,
    });
    await db.insert(cart).values({
      id: CART_ID,
      token: "r9-shipping-token",
      region: "EU",
      currency: "EUR",
    });
    await db.insert(cartLine).values({
      id: LINE_ID,
      cartId: CART_ID,
      variantId: VARIANT_ID,
      qty: 2,
      unitPriceSnapshot: 20_000,
    });
  });

  afterAll(async () => {
    await db.delete(cartLine).where(eq(cartLine.id, LINE_ID));
    await db.delete(cart).where(eq(cart.id, CART_ID));
    await db.delete(product).where(eq(product.id, PRODUCT_ID));
    await pool.end();
  });

  it("resolves the EU zone by country and returns the ≤5 kg band", async () => {
    const quotes = await provider.quote({ country: "DK", ...EU, weightG: 1_000 });
    const methods = quotes.map((q) => q.method).sort();
    expect(methods).toEqual(["express", "pickup", "standard"]);
    const standard = quotes.find((q) => q.method === "standard");
    expect(standard?.amountMinor).toBe(4_900); // €49.00 seeded EU standard ≤5 kg
    expect(standard?.etaDaysMin).toBe(2);
    expect(standard?.etaDaysMax).toBe(5);
    const pickup = quotes.find((q) => q.method === "pickup");
    expect(pickup?.amountMinor).toBe(0);
  });

  it("picks the 5–30 kg standard band once weight crosses 5 000 g", async () => {
    const quotes = await provider.quote({
      country: "DE",
      ...EU,
      weightG: 6_000,
    });
    const standard = quotes.find((q) => q.method === "standard");
    expect(standard?.amountMinor).toBe(14_900); // €149.00 band 2
    // Express has no >5 kg row — it must NOT be offered.
    expect(quotes.find((q) => q.method === "express")).toBeUndefined();
  });

  it("forces white-glove above 30 kg and marks it forced", async () => {
    const quotes = await provider.quote({
      country: "SE",
      ...EU,
      weightG: 30_001,
    });
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.method).toBe("white_glove");
    expect(quotes[0]?.forced).toBe(true);
    expect(quotes[0]?.amountMinor).toBe(39_900); // €399.00 seeded EU white-glove
  });

  it("returns no quotes for a country outside every zone", async () => {
    const quotes = await provider.quote({ country: "ZZ", ...EU, weightG: 1_000 });
    expect(quotes).toEqual([]);
  });

  it("resolves the US zone with its zone-native currency", async () => {
    const quotes = await provider.quote({
      country: "US",
      region: "EU",
      currency: "EUR",
      postalCode: "10001",
      subtotalMinor: 24_900,
      weightG: 1_000,
    });
    const standard = quotes.find((q) => q.method === "standard");
    // €49.00 × 1.3 seeded factor, rounded at seed time.
    expect(standard?.amountMinor).toBe(6_370); // $63.70
  });

  it("estimateShippingForCart rolls up the cart weight and returns the zone currency", async () => {
    const estimate = await estimateShippingForCart(CART_ID, {
      country: "DK",
      postalCode: "1050",
    });
    // 2 × 1 800 g = 3 600 g → the ≤5 kg band applies.
    expect(estimate.weightG).toBe(3_600);
    expect(estimate.currency).toBe("EUR");
    expect(estimate.quotes.map((q) => q.method)).toContain("standard");
    expect(estimate.quotes.find((q) => q.method === "standard")?.amountMinor).toBe(4_900);
  });

  it("estimateShippingForCart throws NOT_FOUND for an unknown cart", async () => {
    await expect(
      estimateShippingForCart("55555555-5555-4555-8555-555555555559", {
        country: "DK",
        postalCode: "1050",
      }),
    ).rejects.toThrow(/cart not found/i);
  });
});

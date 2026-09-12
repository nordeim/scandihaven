import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { cart, cartLine, cartPromotion, product, productVariant, promotion, variantPrice } from "@scandihaven/db/schema";
import { getCartDto } from "./cart-service";

/**
 * Promotion re-validation drop notice (live E2E audit 2026-09-12 round 9,
 * R9-1; FR-404): when an attached promotion stops being eligible (the cart
 * dropped below its min-spend), the cart must display current truth WITH AN
 * INLINE NOTICE — not silently lose the discount. getCartDto already drops
 * the code from pricing (E2E-3); this seam pins the notice that explains the
 * drop. Requires a local PG17; skipped elsewhere so hermetic unit CI is
 * unaffected (same seam contract as checkout-promotions.integration.test.ts).
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

// Fixed natural keys + deterministic UUIDs so cleanup is fixture-scoped and
// re-runs never accumulate rows (PRD §7.9 seed discipline applied to tests).
const PROMO_ID = "44444444-4444-4444-8444-444444444441";
const CART_ID = "44444444-4444-4444-8444-444444444442";
const PRODUCT_ID = "44444444-4444-4444-8444-444444444443";
const VARIANT_ID = "44444444-4444-4444-8444-444444444444";
const LINE_ID = "44444444-4444-4444-8444-444444444445";
const PROMO_CODE = "r9-min-spend";
const SLUG = "r9-notice-side-table";

/** Unit price chosen so qty 3 ≥ €500 threshold and qty 1 < it. */
const UNIT_PRICE_MINOR = 20_000; // €200.00

describe.skipIf(!dbReady)("getCartDto promotion drop notice (R9-1, FR-404)", () => {
  beforeAll(async () => {
    await db.delete(cartLine).where(eq(cartLine.id, LINE_ID));
    await db.delete(cartPromotion).where(eq(cartPromotion.cartId, CART_ID));
    await db.delete(cart).where(eq(cart.id, CART_ID));
    await db.delete(promotion).where(eq(promotion.id, PROMO_ID));
    await db.delete(product).where(eq(product.id, PRODUCT_ID));

    await db.insert(product).values({
      id: PRODUCT_ID,
      slug: SLUG,
      title: "R9 Notice Side Table",
      status: "active",
      leadTimeDaysMin: 2,
      leadTimeDaysMax: 4,
    });
    await db.insert(productVariant).values({
      id: VARIANT_ID,
      productId: PRODUCT_ID,
      sku: "R9-NOTICE-TBL",
      isDefault: true,
    });
    await db.insert(variantPrice).values({
      variantId: VARIANT_ID,
      currency: "EUR",
      amount: UNIT_PRICE_MINOR,
    });
    await db.insert(promotion).values({
      id: PROMO_ID,
      code: PROMO_CODE,
      kind: "fixed",
      value: 5_000,
      isActive: true,
      conditionsJson: { minSpendMinor: 50_000 },
    });
    await db.insert(cart).values({
      id: CART_ID,
      token: "r9-notice-token",
      region: "EU",
      currency: "EUR",
    });
    // qty 3 → subtotal €600 ≥ €500: the promo stays eligible.
    await db.insert(cartLine).values({
      id: LINE_ID,
      cartId: CART_ID,
      variantId: VARIANT_ID,
      qty: 3,
      unitPriceSnapshot: UNIT_PRICE_MINOR,
    });
    await db.insert(cartPromotion).values({ cartId: CART_ID, promotionId: PROMO_ID });
  });

  afterAll(async () => {
    await db.delete(cartLine).where(eq(cartLine.id, LINE_ID));
    await db.delete(cartPromotion).where(eq(cartPromotion.cartId, CART_ID));
    await db.delete(cart).where(eq(cart.id, CART_ID));
    await db.delete(promotion).where(eq(promotion.id, PROMO_ID));
    await db.delete(product).where(eq(product.id, PRODUCT_ID));
    await pool.end();
  });

  it("no notice while the attached promotion is eligible", async () => {
    const dto = await getCartDto(CART_ID);
    expect(dto.appliedPromotionCode).toBe(PROMO_CODE);
    expect(dto.discountMinor).toBe(5_000);
    expect(dto.promotionNotice).toBeNull();
  });

  it("names the dropped code with customer-safe copy after the cart falls below the threshold", async () => {
    await db.update(cartLine).set({ qty: 1 }).where(eq(cartLine.id, LINE_ID));
    const dto = await getCartDto(CART_ID);
    // E2E-3 stays intact: the code stops pricing in.
    expect(dto.appliedPromotionCode).toBeNull();
    expect(dto.discountMinor).toBe(0);
    // FR-404: the drop is explained inline, not silent.
    expect(dto.promotionNotice).toContain(PROMO_CODE);
    // Customer-safe reason copy (M1-PROMO discipline), never a raw reason code.
    expect(dto.promotionNotice).not.toMatch(/\bmin_spend\b/);
    expect(dto.promotionNotice).toMatch(/higher order subtotal/i);
    // The notice must tell the shopper the code can come back (the
    // cart_promotion row intentionally stays for re-application).
    expect(dto.promotionNotice).toMatch(/re-appl/i);
  });

  it("clears the notice once the cart qualifies again (re-application)", async () => {
    await db.update(cartLine).set({ qty: 3 }).where(eq(cartLine.id, LINE_ID));
    const dto = await getCartDto(CART_ID);
    expect(dto.appliedPromotionCode).toBe(PROMO_CODE);
    expect(dto.promotionNotice).toBeNull();
  });

  it("no notice when no promotion is attached at all", async () => {
    await db.delete(cartPromotion).where(eq(cartPromotion.cartId, CART_ID));
    const dto = await getCartDto(CART_ID);
    expect(dto.appliedPromotionCode).toBeNull();
    expect(dto.promotionNotice).toBeNull();
  });
});

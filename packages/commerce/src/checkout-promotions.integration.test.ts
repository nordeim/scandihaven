import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { cart, cartPromotion, promotion } from "@scandihaven/db/schema";
import { computeCartTotals, type PriceLine } from "./pricing";
import { loadCartPromotionApplications } from "./checkout-service";

/**
 * Integration tests for the §7.11 promotion-loading seam: the payable totals
 * used for the PaymentIntent and the webhook re-verification must be computed
 * from the same promotion rows the cart displays. Requires a local PG17
 * (docker compose or embedded cluster); skipped elsewhere so unit CI stays
 * hermetic (same seam contract as jobs.test.ts).
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

// Fixed natural keys + deterministic UUIDs so cleanup is fixture-scoped and
// re-runs never accumulate rows (PRD §7.9 seed discipline applied to tests).
const PROMO_ID = "11111111-1111-4111-8111-111111111111";
const MIN_SPEND_PROMO_ID = "11111111-1111-4111-8111-111111111112";
const CART_ID = "22222222-2222-4222-8222-222222222222";
const PROMO_CODE = "test-welcome";
const MIN_SPEND_PROMO_CODE = "test-min-spend";
const CART_TOKEN = "test-checkout-token";

/** Re-validation context builder (E2E-3 + R1) — subtotal drives min_spend checks. */
function contextFor(subtotalMinor: number) {
  return {
    subtotalMinor,
    region: "EU" as const,
    now: new Date("2026-10-01T12:00:00Z"),
    productIds: [] as string[],
    categoryIds: [] as string[],
    isGuest: true,
  };
}

describe.skipIf(!dbReady)("loadCartPromotionApplications (§7.11 seam)", () => {
  beforeAll(async () => {
    await db.delete(cartPromotion).where(eq(cartPromotion.cartId, CART_ID));
    await db.delete(promotion).where(eq(promotion.id, PROMO_ID));
    await db.delete(promotion).where(eq(promotion.id, MIN_SPEND_PROMO_ID));
    await db.delete(cart).where(eq(cart.id, CART_ID));

    await db.insert(promotion).values({
      id: PROMO_ID,
      code: PROMO_CODE,
      kind: "fixed",
      value: 10_000,
      isActive: true,
      conditionsJson: {},
    });
    await db.insert(promotion).values({
      id: MIN_SPEND_PROMO_ID,
      code: MIN_SPEND_PROMO_CODE,
      kind: "fixed",
      value: 5_000,
      isActive: true,
      conditionsJson: { minSpendMinor: 100_000 },
    });
    await db.insert(cart).values({
      id: CART_ID,
      token: CART_TOKEN,
      region: "EU",
      currency: "EUR",
    });
    await db.insert(cartPromotion).values({ cartId: CART_ID, promotionId: PROMO_ID });
  });

  afterAll(async () => {
    await db.delete(cartPromotion).where(eq(cartPromotion.cartId, CART_ID));
    await db.delete(promotion).where(eq(promotion.id, PROMO_ID));
    await db.delete(promotion).where(eq(promotion.id, MIN_SPEND_PROMO_ID));
    await db.delete(cart).where(eq(cart.id, CART_ID));
    await pool.end();
  });

  it("loads the cart's attached promotion for payable-total computation", async () => {
    const promotions = await loadCartPromotionApplications(db, CART_ID, contextFor(129_900));
    expect(promotions).toEqual([{ promotionId: PROMO_ID, kind: "fixed", value: 10_000 }]);

    // The invariant that matters for §7.11: a discounted cart produces a
    // discounted payable total on BOTH sides of the intent/webhook seam.
    const lines: PriceLine[] = [{ id: "a", qty: 1, unitPriceMinor: 129_900, discountable: true }];
    const totals = computeCartTotals({ lines, promotions, shippingMinor: 0 });
    expect(totals.discount).toBe(10_000);
    expect(totals.total).toBe(119_900);
  });

  it("returns no promotions for a cart with none (undiscounted payable)", async () => {
    const empty = await loadCartPromotionApplications(
      db,
      "00000000-0000-4000-8000-000000000000",
      contextFor(129_900),
    );
    expect(empty).toEqual([]);
  });

  it("drops an attached promo whose min-spend the current subtotal misses (E2E-3)", async () => {
    await db
      .insert(cartPromotion)
      .values({ cartId: CART_ID, promotionId: MIN_SPEND_PROMO_ID })
      .onConflictDoNothing();

    // Subtotal 50_000 clears nothing conditional — the unconditional promo
    // stays, the min-spend (100_000) promo must NOT price in.
    const below = await loadCartPromotionApplications(db, CART_ID, contextFor(50_000));
    expect(below).toEqual([{ promotionId: PROMO_ID, kind: "fixed", value: 10_000 }]);

    // Crossing the threshold admits it again (row was kept, not deleted).
    const above = await loadCartPromotionApplications(db, CART_ID, contextFor(129_900));
    expect(above.map((p) => p.promotionId).sort()).toEqual([MIN_SPEND_PROMO_ID, PROMO_ID].sort());

    // An INACTIVE attached promo never prices in, regardless of subtotal.
    await db
      .update(promotion)
      .set({ isActive: false })
      .where(eq(promotion.id, MIN_SPEND_PROMO_ID));
    const inactive = await loadCartPromotionApplications(db, CART_ID, contextFor(129_900));
    expect(inactive).toEqual([{ promotionId: PROMO_ID, kind: "fixed", value: 10_000 }]);
    await db
      .update(promotion)
      .set({ isActive: true })
      .where(eq(promotion.id, MIN_SPEND_PROMO_ID));
  });
});

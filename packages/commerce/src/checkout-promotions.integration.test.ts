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
const CART_ID = "22222222-2222-4222-8222-222222222222";
const PROMO_CODE = "test-welcome";
const CART_TOKEN = "test-checkout-token";

describe.skipIf(!dbReady)("loadCartPromotionApplications (§7.11 seam)", () => {
  beforeAll(async () => {
    await db.delete(cartPromotion).where(eq(cartPromotion.cartId, CART_ID));
    await db.delete(promotion).where(eq(promotion.id, PROMO_ID));
    await db.delete(cart).where(eq(cart.id, CART_ID));

    await db.insert(promotion).values({
      id: PROMO_ID,
      code: PROMO_CODE,
      kind: "fixed",
      value: 10_000,
      isActive: true,
      conditionsJson: {},
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
    await db.delete(cart).where(eq(cart.id, CART_ID));
    await pool.end();
  });

  it("loads the cart's attached promotion for payable-total computation", async () => {
    const promotions = await loadCartPromotionApplications(db, CART_ID);
    expect(promotions).toEqual([{ promotionId: PROMO_ID, kind: "fixed", value: 10_000 }]);

    // The invariant that matters for §7.11: a discounted cart produces a
    // discounted payable total on BOTH sides of the intent/webhook seam.
    const lines: PriceLine[] = [{ id: "a", qty: 1, unitPriceMinor: 129_900, discountable: true }];
    const totals = computeCartTotals({ lines, promotions, shippingMinor: 0 });
    expect(totals.discount).toBe(10_000);
    expect(totals.total).toBe(119_900);
  });

  it("returns no promotions for a cart with none (undiscounted payable)", async () => {
    const empty = await loadCartPromotionApplications(db, "00000000-0000-4000-8000-000000000000");
    expect(empty).toEqual([]);
  });
});

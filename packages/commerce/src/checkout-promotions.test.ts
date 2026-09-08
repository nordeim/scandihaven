import { describe, expect, it } from "vitest";
import { toPromotionApplications } from "./checkout-service";

/**
 * Pure mapping of cart_promotion × promotion rows into the pricing engine's
 * PromotionApplication shape (PRD §7.10/§8.3). The payable totals used for
 * the PaymentIntent and the §7.11 webhook re-verification MUST be computed
 * from the same promotions the cart displays — this mapper is the seam that
 * keeps both call sites identical.
 */
describe("toPromotionApplications (checkout §7.11 seam)", () => {
  const row = (over: Partial<{ id: string; kind: string; value: number | null; isActive: boolean }>) => ({
    id: "p1",
    kind: "fixed",
    value: 10_000,
    isActive: true,
    ...over,
  });

  it("maps fixed promotions with their minor-unit value", () => {
    expect(toPromotionApplications([row({})])).toEqual([
      { promotionId: "p1", kind: "fixed", value: 10_000 },
    ]);
  });

  it("maps percent promotions with basis-point values", () => {
    expect(toPromotionApplications([row({ kind: "percent", value: 1_500 })])).toEqual([
      { promotionId: "p1", kind: "percent", value: 1_500 },
    ]);
  });

  it("coerces a null value to 0 so the engine can never see NaN", () => {
    expect(toPromotionApplications([row({ value: null })])).toEqual([
      { promotionId: "p1", kind: "fixed", value: 0 },
    ]);
  });

  it("maps an empty cart-promotion join to no promotions (undiscounted payable)", () => {
    expect(toPromotionApplications([])).toEqual([]);
  });

  it("preserves free_shipping kind (engine neutralizes it while shipping is unselected)", () => {
    expect(toPromotionApplications([row({ kind: "free_shipping", value: null })])).toEqual([
      { promotionId: "p1", kind: "free_shipping", value: 0 },
    ]);
  });
});

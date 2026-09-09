import { describe, it, expect } from "vitest";
import { humanizePromotionRejection, type PromotionRejection } from "./promotions";

/**
 * Live E2E audit 2026-09-09 round 2 (M1-PROMO): rejection reasons surfaced to
 * shoppers were raw internal codes ("Promotion not applicable (min_spend)").
 * Every code must map to customer-readable copy that tells the shopper what
 * to do next, never the internal token.
 */

const REASONS: PromotionRejection[] = [
  "not_active",
  "outside_schedule",
  "min_spend",
  "product_excluded",
  "product_not_included",
  "region_not_eligible",
  "usage_limit",
  "customer_limit",
];

describe("humanizePromotionRejection", () => {
  it.each(REASONS)("maps %s to customer-readable copy without the raw code", (reason) => {
    const message = humanizePromotionRejection(reason);
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain(reason);
    expect(message).not.toMatch(/_/);
  });

  it("tells the shopper the code is inactive for not_active", () => {
    expect(humanizePromotionRejection("not_active")).toMatch(/isn't active|not available/i);
  });

  it("explains the spend threshold for min_spend", () => {
    expect(humanizePromotionRejection("min_spend")).toMatch(/order|spend/i);
  });

  it("explains eligibility for region_not_eligible", () => {
    expect(humanizePromotionRejection("region_not_eligible")).toMatch(/region|deliver|ship/i);
  });

  it("explains item exclusions for product_excluded", () => {
    expect(humanizePromotionRejection("product_excluded")).toMatch(/item/i);
  });

  it("explains missing qualifying items for product_not_included", () => {
    expect(humanizePromotionRejection("product_not_included")).toMatch(/item/i);
  });

  it("explains the schedule window for outside_schedule", () => {
    expect(humanizePromotionRejection("outside_schedule")).toMatch(/valid|date/i);
  });

  it("explains redemption caps for usage_limit", () => {
    expect(humanizePromotionRejection("usage_limit")).toMatch(/redeem|no longer/i);
  });

  it("explains per-customer caps for customer_limit", () => {
    expect(humanizePromotionRejection("customer_limit")).toMatch(/already used|once|limit/i);
  });
});

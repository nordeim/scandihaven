import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluatePromotion, promotionInputSchema, resolveTier, type PromotionContext } from "./promotions";

const basePromotion = {
  id: "promo-1",
  code: "WELCOME100",
  kind: "fixed" as const,
  value: 10_000,
  tiers: null,
  conditions: { minSpendMinor: 50_000 },
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  perCustomerLimit: null,
  usageCount: 0,
  perCustomerUsed: 0,
};

const baseContext: PromotionContext = {
  subtotalMinor: 138_900,
  region: "EU",
  now: new Date("2026-10-01T12:00:00Z"),
  productIds: ["30000000-0000-4000-8000-000000000001"],
  categoryIds: ["30000000-0000-4000-8000-000000000002"],
  isGuest: false,
};

describe("promotion engine (PRD FR-810)", () => {
  it("applies a fixed promotion above min spend", () => {
    const result = evaluatePromotion(basePromotion, baseContext);
    expect(result.eligible).toBe(true);
  });

  it("rejects below min spend", () => {
    const result = evaluatePromotion(basePromotion, { ...baseContext, subtotalMinor: 49_999 });
    expect(result).toEqual({ eligible: false, reason: "min_spend" });
  });

  it("rejects outside schedule", () => {
    const result = evaluatePromotion(
      { ...basePromotion, endsAt: new Date("2026-09-30T00:00:00Z") },
      baseContext,
    );
    expect(result).toEqual({ eligible: false, reason: "outside_schedule" });
  });

  it("enforces usage and per-customer limits", () => {
    const exhausted = evaluatePromotion(
      { ...basePromotion, usageLimit: 100, usageCount: 100 },
      baseContext,
    );
    expect(exhausted).toEqual({ eligible: false, reason: "usage_limit" });

    const capped = evaluatePromotion(
      { ...basePromotion, perCustomerLimit: 1, perCustomerUsed: 1 },
      baseContext,
    );
    expect(capped).toEqual({ eligible: false, reason: "customer_limit" });
  });

  it("rejects excluded products and missing categories", () => {
    const excluded = evaluatePromotion(
      {
        ...basePromotion,
        conditions: { excludeProductIds: ["30000000-0000-4000-8000-000000000001"] },
      },
      baseContext,
    );
    expect(excluded).toEqual({ eligible: false, reason: "product_excluded" });

    const wrongCategory = evaluatePromotion(
      { ...basePromotion, conditions: { categoryIds: ["40000000-0000-4000-8000-000000000009"] } },
      baseContext,
    );
    expect(wrongCategory).toEqual({ eligible: false, reason: "product_not_included" });
  });

  it("resolves the best matching tier", () => {
    const tiered = {
      ...basePromotion,
      kind: "tiered" as const,
      value: null,
      tiers: [
        { minSpendMinor: 100_000, discountMinor: 5_000 },
        { minSpendMinor: 200_000, discountMinor: 15_000 },
      ],
    };
    expect(resolveTier(tiered, 138_900)).toBe(5_000);
    expect(resolveTier(tiered, 250_000)).toBe(15_000);
    expect(resolveTier(tiered, 99_999)).toBeNull();
  });

  it("schema validates arbitrary well-formed inputs", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000_000 }), (spend) => {
        const parsed = promotionInputSchema.safeParse({
          ...basePromotion,
          conditions: { minSpendMinor: spend },
        });
        return parsed.success;
      }),
    );
  });
});

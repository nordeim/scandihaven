import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeCartTotals, computeSubtotal, distributeDiscount, type PriceLine } from "./pricing";

function lineArb(): fc.Arbitrary<PriceLine> {
  return fc.record({
    id: fc.string({ minLength: 1, maxLength: 8 }),
    qty: fc.integer({ min: 1, max: 99 }),
    unitPriceMinor: fc.integer({ min: 1, max: 500_000 }),
    discountable: fc.boolean(),
  });
}

describe("pricing invariants (PRD §7.2)", () => {
  it("subtotal equals sum of line subtotals", () => {
    fc.assert(
      fc.property(fc.array(lineArb(), { maxLength: 20 }), (lines) => {
        const subtotal = computeSubtotal(lines);
        const manual = lines.reduce((acc, l) => acc + l.qty * l.unitPriceMinor, 0);
        return subtotal === manual;
      }),
    );
  });

  it("discount distribution conserves the discount exactly", () => {
    fc.assert(
      fc.property(
        fc.array(lineArb(), { minLength: 1, maxLength: 12 }),
        fc.integer({ min: 0, max: 200_000 }),
        (lines, discount) => {
          const { lineDiscounts } = distributeDiscount(lines, discount);
          const sum = Object.values(lineDiscounts).reduce((a, b) => a + b, 0);
          const discountableValue = lines
            .filter((l) => l.discountable)
            .reduce((acc, l) => acc + l.qty * l.unitPriceMinor, 0);
          // Distribution is capped by discountable value.
          return sum === Math.min(discount, discountableValue);
        },
      ),
    );
  });

  it("no line total goes negative", () => {
    fc.assert(
      fc.property(
        fc.array(lineArb(), { minLength: 1, maxLength: 12 }),
        fc.integer({ min: 0, max: 200_000 }),
        (lines, discount) => {
          const { lineTotals } = distributeDiscount(lines, discount);
          return Object.values(lineTotals).every((t) => t >= 0);
        },
      ),
    );
  });

  it("cart total = discounted goods + shipping + tax", () => {
    fc.assert(
      fc.property(
        fc.array(lineArb(), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 0, max: 50_000 }),
        fc.integer({ min: 0, max: 20_000 }),
        (lines, shipping, tax) => {
          const totals = computeCartTotals({
            lines,
            promotions: [],
            shippingMinor: shipping,
            taxMinor: tax,
          });
          const goods = Object.values(totals.lineTotals).reduce((a, b) => a + b, 0);
          return totals.total === goods + shipping + tax;
        },
      ),
    );
  });

  it("fixed promotion discounts capped at subtotal", () => {
    fc.assert(
      fc.property(
        fc.array(lineArb(), { minLength: 1, maxLength: 8 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (lines, value) => {
          const totals = computeCartTotals({
            lines,
            promotions: [{ promotionId: "p1", kind: "fixed", value }],
            shippingMinor: 0,
          });
          return totals.discount <= totals.subtotal && totals.total >= 0;
        },
      ),
    );
  });

  it("percent promotion matches basis-point math", () => {
    const lines: PriceLine[] = [{ id: "a", qty: 1, unitPriceMinor: 129_900, discountable: true }];
    const totals = computeCartTotals({
      lines,
      promotions: [{ promotionId: "p1", kind: "percent", value: 1000 }], // 10%
      shippingMinor: 0,
    });
    expect(totals.discount).toBe(12_990);
  });
});

describe("worked example (PRD §7.10)", () => {
  it("matches the PRD's Halden + Woo + WELCOME100 walkthrough", () => {
    const lines: PriceLine[] = [
      { id: "armchair", qty: 1, unitPriceMinor: 129_900, discountable: true },
      { id: "runner", qty: 2, unitPriceMinor: 4_500, discountable: true },
    ];
    const totals = computeCartTotals({
      lines,
      promotions: [{ promotionId: "promo-1", kind: "fixed", value: 10_000 }],
      shippingMinor: 4_900,
    });
    expect(totals.subtotal).toBe(138_900);
    expect(totals.discount).toBe(10_000);
    expect(totals.lineDiscounts["armchair"]).toBe(9_352);
    expect(totals.lineDiscounts["runner"]).toBe(648);
    expect(totals.lineTotals["armchair"]).toBe(120_548);
    expect(totals.lineTotals["runner"]).toBe(8_352);
    expect(totals.total).toBe(133_800);
  });
});

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

// Line ids are per-line allocation keys — `computeCartTotals` rejects
// duplicates by design (see the duplicate-id guard test below) and
// `distributeDiscount` maps allocations by id, so generators feeding either
// function must produce unique ids.
const uniqueLinesArb = (maxLength: number) =>
  fc
    .array(lineArb(), { minLength: 1, maxLength })
    .map((lines) => lines.map((line, i) => ({ ...line, id: `line-${i}` })));

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
        uniqueLinesArb(12),
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
        uniqueLinesArb(12),
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
        uniqueLinesArb(10),
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
        uniqueLinesArb(8),
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

describe("promotion discount cap invariants (PRD v4 FR-810)", () => {
  const kindArb = fc.constantFrom("fixed", "percent", "tiered") as fc.Arbitrary<
    "fixed" | "percent" | "tiered"
  >;

  const promotionArb = fc
    .record({
      kind: kindArb,
      value: fc.integer({ min: 0, max: 25_000 }),
      tierDiscount: fc.integer({ min: 0, max: 500_000 }),
      tierMin: fc.integer({ min: 0, max: 1_000 }),
    })
    .map((r) => {
      if (r.kind === "fixed") {
        return { promotionId: "p", kind: "fixed" as const, value: r.value };
      }
      if (r.kind === "percent") {
        // value bp may exceed 10 000 (100 %) — the cap must hold anyway.
        return { promotionId: "p", kind: "percent" as const, value: r.value };
      }
      return {
        promotionId: "p",
        kind: "tiered" as const,
        value: 0,
        tiers: [{ minSpendMinor: r.tierMin, discountMinor: r.tierDiscount }],
      };
    });

  it("throws on duplicate line ids (allocation keys must be unique)", () => {
    const lines: PriceLine[] = [
      { id: "a", qty: 1, unitPriceMinor: 100, discountable: true },
      { id: "a", qty: 2, unitPriceMinor: 100, discountable: true },
    ];
    expect(() =>
      computeCartTotals({ lines, promotions: [], shippingMinor: 0 }),
    ).toThrow(/duplicate line id/);
  });

  it("discount never exceeds subtotal and total never goes negative, for every kind", () => {
    fc.assert(
      fc.property(
        uniqueLinesArb(10),
        promotionArb,
        fc.integer({ min: 0, max: 30_000 }),
        (lines, promotion, shipping) => {
          const totals = computeCartTotals({ lines, promotions: [promotion], shippingMinor: shipping });
          return totals.discount <= totals.subtotal && totals.total >= 0;
        },
      ),
    );
  });

  it("conservation: subtotal − discount + shipping + tax = total", () => {
    fc.assert(
      fc.property(
        uniqueLinesArb(10),
        promotionArb,
        fc.integer({ min: 0, max: 30_000 }),
        fc.integer({ min: 0, max: 20_000 }),
        (lines, promotion, shipping, tax) => {
          const totals = computeCartTotals({
            lines,
            promotions: [promotion],
            shippingMinor: shipping,
            taxMinor: tax,
          });
          return totals.subtotal - totals.discount + shipping + tax === totals.total;
        },
      ),
    );
  });

  it("tiered promotion resolves its matching tier discount", () => {
    const lines: PriceLine[] = [
      { id: "a", qty: 1, unitPriceMinor: 600_00, discountable: true },
    ];
    const totals = computeCartTotals({
      lines,
      promotions: [
        {
          promotionId: "p",
          kind: "tiered",
          value: 0,
          tiers: [{ minSpendMinor: 500_00, discountMinor: 50_00 }],
        },
      ],
      shippingMinor: 0,
    });
    expect(totals.discount).toBe(50_00);
  });

  it("tiered promotion with no qualifying tier discounts nothing", () => {
    const lines: PriceLine[] = [{ id: "a", qty: 1, unitPriceMinor: 100_00, discountable: true }];
    const totals = computeCartTotals({
      lines,
      promotions: [
        {
          promotionId: "p",
          kind: "tiered",
          value: 0,
          tiers: [{ minSpendMinor: 500_00, discountMinor: 50_00 }],
        },
      ],
      shippingMinor: 0,
    });
    expect(totals.discount).toBe(0);
  });
});

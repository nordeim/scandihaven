import { describe, expect, it } from "vitest";
import { resolvePlacementOutcome } from "./checkout-service";

/**
 * Contract (PRD §8.7 normative + audit 2026-09-09 H4d): a paid intent whose
 * cart no longer matches (AMOUNT_MISMATCH) or whose stock ran out
 * (OUT_OF_STOCK) must NOT throw the placement away — the payment was already
 * captured. The order is placed in `review` for CS instead. Only a clean
 * match confirms.
 */

describe("resolvePlacementOutcome (§8.7 seam)", () => {
  it("confirms when totals match and stock is available", () => {
    expect(resolvePlacementOutcome({ totalsTotal: 133_800, intentAmount: 133_800, stockShortages: [] })).toEqual({
      path: "confirm",
    });
  });

  it("routes a total mismatch to review (payment consumed, no order thrown away)", () => {
    const outcome = resolvePlacementOutcome({ totalsTotal: 120_000, intentAmount: 133_800, stockShortages: [] });
    expect(outcome).toEqual({
      path: "review",
      reason: "AMOUNT_MISMATCH",
      detail: "cart 120000 vs Stripe 133800",
    });
  });

  it("routes a stock shortage to review", () => {
    const outcome = resolvePlacementOutcome({
      totalsTotal: 100_00,
      intentAmount: 100_00,
      stockShortages: ["SKU SH-ORE-LMP-BRS"],
    });
    expect(outcome).toEqual({
      path: "review",
      reason: "OUT_OF_STOCK",
      detail: "SKU SH-ORE-LMP-BRS",
    });
  });

  it("mismatch wins over stock when both are wrong (CS sees the money problem first)", () => {
    const outcome = resolvePlacementOutcome({
      totalsTotal: 1,
      intentAmount: 2,
      stockShortages: ["A", "B"],
    });
    expect(outcome).toMatchObject({ path: "review", reason: "AMOUNT_MISMATCH" });
  });
});

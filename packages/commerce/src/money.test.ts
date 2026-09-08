import { describe, expect, it } from "vitest";
import {
  MoneyError,
  assertMinor,
  convertFromEur,
  formatMinor,
  roundHalfUp,
  sumMinor,
} from "./money";

describe("money (ADR-7: integers only)", () => {
  it("accepts safe integers and rejects everything else", () => {
    expect(assertMinor(129_900)).toBe(129_900);
    expect(() => assertMinor(129.9)).toThrow(MoneyError);
    expect(() => assertMinor(Number.NaN)).toThrow(MoneyError);
    expect(() => assertMinor(Number.MAX_SAFE_INTEGER + 1)).toThrow(MoneyError);
  });

  it("rounds half-up deterministically (PRD FX example: 133800 × 1.0864 = 145360)", () => {
    expect(convertFromEur(133_800, "1.0864")).toBe(145_360);
    expect(convertFromEur(10_001, 1.0001)).toBe(10_002);
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
  });

  it("rejects non-positive FX rates", () => {
    expect(() => convertFromEur(100, "0")).toThrow(MoneyError);
    expect(() => convertFromEur(100, "abc")).toThrow(MoneyError);
  });

  it("formats minor units for logs/tests", () => {
    expect(formatMinor(133_800, "EUR")).toBe("1338.00 EUR");
    expect(formatMinor(0, "USD")).toBe("0.00 USD");
  });

  it("sums with integer guards", () => {
    expect(sumMinor([4_500, 4_500, 129_900])).toBe(138_900);
    expect(() => sumMinor([1.5])).toThrow(MoneyError);
  });
});

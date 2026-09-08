import { describe, expect, it } from "vitest";
import { formatMinor } from "./format";

/**
 * Money formatting at the display edge (PRD §7.2/ADR-7): the domain keeps
 * integer minor units; Intl formats at the edge. Pinned here so a locale or
 * currency-table change is a deliberate act, not drift.
 */
describe("formatMinor (display-edge formatting)", () => {
  it("formats EUR minor units with the en-IE locale", () => {
    expect(formatMinor(129_900, "EUR")).toBe("€1,299.00");
  });

  it("maps each launch currency to its locale", () => {
    expect(formatMinor(4_500, "USD")).toContain("$45.00");
    expect(formatMinor(4_500, "GBP")).toContain("£45.00");
    expect(formatMinor(45_000, "DKK")).toContain("450");
  });

  it("falls back to the EUR-style locale for unknown currencies", () => {
    expect(formatMinor(12_300, "NOK")).toContain("123");
  });
});

import { describe, expect, it } from "vitest";
import { createRequestDedupe } from "./request-dedupe";

describe("request dedupe (PRD §8.3: cart.addLine requestId, 5-min window)", () => {
  it("allows a fresh requestId and remembers it", () => {
    const dedupe = createRequestDedupe(5 * 60_000);
    expect(dedupe.checkAndReserve("cart-1:req-a")).toBe(true);
    expect(dedupe.checkAndReserve("cart-1:req-a")).toBe(false);
  });

  it("scopes keys per cart (same requestId on another cart is fresh)", () => {
    const dedupe = createRequestDedupe(5 * 60_000);
    expect(dedupe.checkAndReserve("cart-1:req-a")).toBe(true);
    expect(dedupe.checkAndReserve("cart-2:req-a")).toBe(true);
  });

  it("releases the key after the window elapses", () => {
    const dedupe = createRequestDedupe(5_000);
    expect(dedupe.checkAndReserve("cart-1:req-a")).toBe(true);
    expect(dedupe.checkAndReserve("cart-1:req-a")).toBe(false);
    const later = Date.now() + 6_000;
    expect(dedupe.checkAndReserve("cart-1:req-a", later)).toBe(true);
  });

  it("treats a missing requestId as always-processable (legacy callers)", () => {
    const dedupe = createRequestDedupe(5_000);
    expect(dedupe.checkAndReserve("cart-1:")).toBe(true);
    expect(dedupe.checkAndReserve("cart-1:")).toBe(true);
  });

  it("evicts expired entries so the map cannot grow unbounded", () => {
    const dedupe = createRequestDedupe(1_000);
    for (let i = 0; i < 1_000; i++) {
      dedupe.checkAndReserve(`cart-${i}:req`, Date.now() - 10_000);
    }
    // A real-time call sweeps the stale entries before its own insert.
    expect(dedupe.checkAndReserve("probe")).toBe(true);
    expect(dedupe.size()).toBe(1);
  });
});

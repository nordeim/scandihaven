import { describe, expect, it, vi } from "vitest";

/**
 * Back-in-stock action mapping (PRD FR-310; live audit round 8, R8-6):
 * validation errors, the per-IP rate limit, and the dedupe outcome must map
 * to the ActionResult union with customer-safe messages. The service owns
 * dedupe; the action owns validation + rate limiting + mapping.
 */

const requestBackInStock = vi.fn();

vi.mock("@scandihaven/commerce/back-in-stock", () => ({
  requestBackInStock: (...args: unknown[]) => requestBackInStock(...args),
}));

const consumeRateLimit = vi.fn();

vi.mock("@scandihaven/commerce/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimit(...args),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "198.51.100.7" })),
}));

import { notifyBackInStockAction } from "./back-in-stock";

describe("notifyBackInStockAction (R8-6, FR-310)", () => {
  // Zod 4's uuid() enforces RFC 9562 version/nibble bits — the fixture must
  // have a valid 3rd/4th group shape (8s) to pass the action's schema.
  const variantId = "77777777-7777-8888-8888-777777777782";

  it("rejects invalid emails with VALIDATION", async () => {
    const result = await notifyBackInStockAction({ variantId, email: "not-an-email" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(requestBackInStock).not.toHaveBeenCalled();
  });

  it("returns the service outcome on success", async () => {
    consumeRateLimit.mockResolvedValue({ allowed: true });
    requestBackInStock.mockResolvedValue({ status: "registered" });
    const result = await notifyBackInStockAction({ variantId, email: "me@example.com" });
    expect(result).toEqual({ ok: true, data: { status: "registered" } });
  });

  it("maps the rate-limit rejection to RATE_LIMITED", async () => {
    consumeRateLimit.mockResolvedValue({ allowed: false });
    const result = await notifyBackInStockAction({ variantId, email: "me@example.com" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMITED");
    expect(requestBackInStock).not.toHaveBeenCalled();
  });

  it("maps unknown variants to VALIDATION with a customer-safe message", async () => {
    consumeRateLimit.mockResolvedValue({ allowed: true });
    requestBackInStock.mockRejectedValue(new Error("Variant not found"));
    const result = await notifyBackInStockAction({ variantId, email: "me@example.com" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.message).toMatch(/no longer available/i);
    }
  });
});

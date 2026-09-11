import { describe, expect, it, vi } from "vitest";

/**
 * Checkout action error hygiene (PRD FR-508/FR-509; live E2E audit round 8,
 * R8-1): the STRIPE_NOT_CONFIGURED detail ("set STRIPE_SECRET_KEY in .env…")
 * is an operator instruction. It must land in the server log — never in the
 * ActionResult the browser renders. The customer sees an honest, actionable,
 * retry-safe message instead.
 */

const cartId = "0f0e7d9a-6c1c-4a5e-9e5a-1f2b3c4d5e6f";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/cart-session", () => ({
  getCartId: vi.fn(async () => cartId),
}));

const createPaymentIntent = vi.fn();

vi.mock("@scandihaven/commerce/checkout-service", () => {
  class CheckoutError extends Error {
    constructor(
      message: string,
      public readonly code: "STRIPE_NOT_CONFIGURED" | "CART_EMPTY" | "AMOUNT_MISMATCH",
    ) {
      super(message);
    }
  }
  return { CheckoutError, createPaymentIntent: (...args: unknown[]) => createPaymentIntent(...args) };
});

import { createPaymentIntentAction } from "./checkout";

describe("createPaymentIntentAction error mapping (R8-1)", () => {
  const address = {
    name: "Test Customer",
    line1: "Vestre Havnegade 4",
    city: "Aalborg",
    postalCode: "9000",
    country: "DK",
    email: "test@example.com",
  };

  it("returns a customer-safe message for STRIPE_NOT_CONFIGURED and never leaks env instructions", async () => {
    createPaymentIntent.mockRejectedValue(
      new (await import("@scandihaven/commerce/checkout-service")).CheckoutError(
        "Stripe is not configured: set STRIPE_SECRET_KEY in .env (test mode keys).",
        "STRIPE_NOT_CONFIGURED",
      ),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createPaymentIntentAction({ address });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).not.toMatch(/STRIPE_SECRET_KEY|\.env|set me|set-me/i);
      expect(result.error.message).toMatch(/unavailable|contact/i);
      expect(result.error.code).toBe("INTERNAL");
    }
    // The operator detail goes to the server log, not to the browser.
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("preserves customer-meaningful messages for non-config errors (CART_EMPTY)", async () => {
    createPaymentIntent.mockRejectedValue(
      new (await import("@scandihaven/commerce/checkout-service")).CheckoutError(
        "Cart not found",
        "CART_EMPTY",
      ),
    );
    const result = await createPaymentIntentAction({ address });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PAYMENT_REQUIRED");
      expect(result.error.message).toBe("Cart not found");
    }
  });
});

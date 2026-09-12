import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Shipping-estimate Server Action wiring (R9-3, FR-402): validation, cart
 * scoping, and the ActionResult contract — mirroring the cart.test.ts mock
 * idiom. The estimate itself is display-only; the action must never mint a
 * cart (H1-CART discipline: a missing cart is ok(null), not ensureCart()).
 */

const cookieStore = { get: vi.fn(), set: vi.fn() };

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/cart-session", () => ({
  getCartId: vi.fn(),
}));

vi.mock("@scandihaven/commerce/shipping-rates", () => ({
  estimateShippingForCart: vi.fn(),
}));

import { getCartId } from "@/lib/cart-session";
import { estimateShippingForCart } from "@scandihaven/commerce/shipping-rates";
import { estimateShippingAction } from "./shipping";

const mockedGetCartId = vi.mocked(getCartId);
const mockedEstimate = vi.mocked(estimateShippingForCart);

const ESTIMATE = {
  quotes: [
    { method: "standard" as const, amountMinor: 4_900, etaDaysMin: 2, etaDaysMax: 5 },
    { method: "pickup" as const, amountMinor: 0, etaDaysMin: 0, etaDaysMax: 1 },
  ],
  currency: "EUR",
  weightG: 3_600,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("estimateShippingAction (R9-3, FR-402)", () => {
  it("rejects a non-2-letter country code with a validation error", async () => {
    const result = await estimateShippingAction({ country: "DNK", postalCode: "1050" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(mockedEstimate).not.toHaveBeenCalled();
  });

  it("rejects a too-short postcode (3-char minimum guards mid-typing fires)", async () => {
    const result = await estimateShippingAction({ country: "DK", postalCode: "10" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(mockedEstimate).not.toHaveBeenCalled();
  });

  it("returns ok(null) when no cart exists — never mints one", async () => {
    mockedGetCartId.mockResolvedValue(null);
    const result = await estimateShippingAction({ country: "DK", postalCode: "1050" });
    expect(result).toEqual({ ok: true, data: null });
    expect(mockedEstimate).not.toHaveBeenCalled();
  });

  it("passes the resolved cart UUID through untouched (H1-CART discipline)", async () => {
    const CART_UUID = "0f0e7d9a-6c1c-4a5e-9e5a-1f2b3c4d5e6f";
    mockedGetCartId.mockResolvedValue(CART_UUID);
    mockedEstimate.mockResolvedValue(ESTIMATE);
    const result = await estimateShippingAction({ country: "DK", postalCode: "1050" });
    expect(mockedEstimate).toHaveBeenCalledWith(CART_UUID, { country: "DK", postalCode: "1050" });
    expect(result).toEqual({ ok: true, data: ESTIMATE });
  });

  it("normalizes the country to uppercase before quoting", async () => {
    const CART_UUID = "0f0e7d9a-6c1c-4a5e-9e5a-1f2b3c4d5e6f";
    mockedGetCartId.mockResolvedValue(CART_UUID);
    mockedEstimate.mockResolvedValue(ESTIMATE);
    await estimateShippingAction({ country: "dk", postalCode: "1050" });
    expect(mockedEstimate).toHaveBeenCalledWith(CART_UUID, { country: "DK", postalCode: "1050" });
  });

  it("maps service NOT_FOUND to the customer-safe result contract", async () => {
    const CART_UUID = "0f0e7d9a-6c1c-4a5e-9e5a-1f2b3c4d5e6f";
    mockedGetCartId.mockResolvedValue(CART_UUID);
    mockedEstimate.mockRejectedValue(new Error("Cart not found"));
    const result = await estimateShippingAction({ country: "DK", postalCode: "1050" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });
});

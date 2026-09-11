import { describe, expect, it } from "vitest";
import { isStripePublishableKeyConfigured } from "./stripe-config";

/**
 * Checkout configuration honesty (PRD FR-508; live E2E audit round 8, R8-1).
 *
 * The client and the server must agree on what "configured" means. The server
 * (`getStripe()`) rejects `set-me` placeholders; the client previously treated
 * any non-empty `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` as configured — so a
 * deployment carrying the `.env.example` placeholder (`pk_test_set-me`)
 * rendered the full address form and then failed with a leaked internal
 * config message. This helper pins the client to the same rule.
 */
describe("isStripePublishableKeyConfigured (R8-1)", () => {
  it("rejects undefined and empty keys", () => {
    expect(isStripePublishableKeyConfigured(undefined)).toBe(false);
    expect(isStripePublishableKeyConfigured("")).toBe(false);
  });

  it("rejects the set-me placeholder shapes shipped in .env.example", () => {
    expect(isStripePublishableKeyConfigured("pk_test_set-me")).toBe(false);
    expect(isStripePublishableKeyConfigured("set-me")).toBe(false);
    expect(isStripePublishableKeyConfigured("pk_live_set-me-later")).toBe(false);
  });

  it("accepts real-looking publishable keys", () => {
    expect(isStripePublishableKeyConfigured("pk_test_51HxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBe(true);
    expect(isStripePublishableKeyConfigured("pk_live_51HxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBe(true);
  });

  it("mirrors the server rule for the placeholder sentinel", () => {
    // Server: packages/commerce/src/checkout-service.ts getStripe()
    //   `if (!key || key.includes("set-me")) return null;`
    for (const key of [undefined, "", "pk_test_set-me", "set-me-with-openssl"]) {
      const clientConfigured = isStripePublishableKeyConfigured(key);
      const serverConfigured = Boolean(key) && !key?.includes("set-me");
      expect(clientConfigured).toBe(serverConfigured);
    }
  });
});

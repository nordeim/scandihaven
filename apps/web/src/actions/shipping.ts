"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@scandihaven/commerce/result";
import { estimateShippingForCart, type ShippingEstimate } from "@scandihaven/commerce/shipping-rates";
import { getCartId } from "@/lib/cart-session";

/**
 * Shipping-estimate Server Action (PRD FR-402; R9-3): display-only quotes
 * for the cart page's postcode estimator. Validation → cart scoping →
 * ActionResult contract, exactly like the cart actions. A missing cart is
 * ok(null) — the action must NEVER mint one (H1-CART discipline: estimates
 * are reads, not cart-creating mutations).
 */

const estimateInput = z.object({
  // ISO 3166-1 alpha-2, case-insensitive at the client; normalized here.
  country: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  // 3-char minimum guards the debounce against mid-typing fires ("1", "10");
  // 12 covers the longest formats in the seeded zones (e.g. NL-1234 AB).
  postalCode: z
    .string()
    .trim()
    .min(3)
    .max(12),
});

export async function estimateShippingAction(input: {
  country: string;
  postalCode: string;
}): Promise<ActionResult<ShippingEstimate | null>> {
  const parsed = estimateInput.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", "Enter a 2-letter country and a full postcode.");
  }
  try {
    const cartId = await getCartId();
    if (!cartId) return ok(null);
    const estimate = await estimateShippingForCart(cartId, parsed.data);
    return ok(estimate);
  } catch (error) {
    if (error instanceof Error && /cart not found/i.test(error.message)) {
      return fail("NOT_FOUND", "Your cart is no longer available — reload the page.");
    }
    // Operator detail stays server-side; the shopper gets a retryable message.
    console.error("[shipping] estimate failed", error);
    return fail("INTERNAL", "We couldn't estimate shipping just now — try again in a moment.");
  }
}

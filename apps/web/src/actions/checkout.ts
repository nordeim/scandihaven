"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@scandihaven/commerce/result";
import { CheckoutError, createPaymentIntent } from "@scandihaven/commerce/checkout-service";
import { getCartId } from "@/lib/cart-session";

const addressSchema = z.object({
  name: z.string().min(2).max(120),
  line1: z.string().min(2).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(80),
  postalCode: z.string().min(2).max(20),
  country: z.string().length(2),
  email: z.string().email(),
});

export type CheckoutAddress = z.infer<typeof addressSchema>;

/**
 * Create the PaymentIntent (PRD FR-508). Amount is re-derived server-side from
 * the cart; the client never supplies money values (§9.4 STRIDE: tampering).
 */
export async function createPaymentIntentAction(input: {
  address: CheckoutAddress;
}): Promise<ActionResult<{ clientSecret: string }>> {
  const parsed = addressSchema.safeParse(input.address);
  if (!parsed.success) {
    return fail("VALIDATION", "Check the highlighted fields", {
      name: ["Enter your full name"],
    });
  }
  const cartId = await getCartId();
  if (!cartId) return fail("VALIDATION", "Your cart is empty");

  try {
    const clientSecret = await createPaymentIntent(cartId);
    return ok({ clientSecret });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return fail(
        error.code === "STRIPE_NOT_CONFIGURED" ? "INTERNAL" : "PAYMENT_REQUIRED",
        error.message,
      );
    }
    console.error("[checkout] intent creation failed", error);
    return fail("INTERNAL", "Could not start payment. Please try again.");
  }
}

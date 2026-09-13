import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@scandihaven/db/client";
import { cart } from "@scandihaven/db/schema";
import { CART_COOKIE_NAME, verifyCartToken } from "@scandihaven/commerce/cart-service";

/**
 * Server-side cart identity (PRD FR-403): a signed, HttpOnly cookie carrying
 * the cart token. `getCartId()` verifies the HMAC and resolves the TOKEN to
 * the cart row's UUID — commerce service functions key on the UUID.
 *
 * R10-7 (round 11): only ACTIVE carts resolve. A cookie whose cart has been
 * converted (an order placed) behaves exactly like no cookie — the next
 * `requireCart()` mints a fresh cart + cookie instead of reusing the
 * converted one. Without this filter, the stale cookie let the customer add
 * items to the converted cart, mint a new PaymentIntent, and pay the full
 * old+new line set a second time (double charge).
 */
export async function getCartId(): Promise<string | null> {
  const store = await cookies();
  const token = verifyCartToken(store.get(CART_COOKIE_NAME)?.value);
  if (!token) return null;
  const rows = await db
    .select({ id: cart.id })
    .from(cart)
    .where(and(eq(cart.token, token), eq(cart.status, "active")))
    .limit(1);
  return rows[0]?.id ?? null;
}

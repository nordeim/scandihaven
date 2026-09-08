import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@scandihaven/db/client";
import { cart } from "@scandihaven/db/schema";
import { CART_COOKIE_NAME, verifyCartToken } from "@scandihaven/commerce/cart-service";

/**
 * Server-side cart identity (PRD FR-403): a signed, HttpOnly cookie carrying
 * the cart token. `getCartId()` verifies the HMAC and resolves the TOKEN to
 * the cart row's UUID — commerce service functions key on the UUID.
 */
export async function getCartId(): Promise<string | null> {
  const store = await cookies();
  const token = verifyCartToken(store.get(CART_COOKIE_NAME)?.value);
  if (!token) return null;
  const rows = await db
    .select({ id: cart.id })
    .from(cart)
    .where(eq(cart.token, token))
    .limit(1);
  return rows[0]?.id ?? null;
}

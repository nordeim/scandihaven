import type { Metadata } from "next";
import { getCartDto } from "@scandihaven/commerce/cart-service";
import { getCartId } from "@/lib/cart-session";
import { CartView } from "@/components/cart-view";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Full cart page (PRD FR-402). Server-rendered truth handed to the client view. */
export default async function CartPage() {
  const cartId = await getCartId();
  const cart = cartId
    ? await getCartDto(cartId).catch((error: unknown) => {
        console.error("[cart page] getCartDto failed:", error instanceof Error ? error.message : error);
        return null;
      })
    : null;
  return <CartView initialCart={cart} />;
}

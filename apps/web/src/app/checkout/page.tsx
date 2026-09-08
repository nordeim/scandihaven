import Link from "next/link";
import type { Metadata } from "next";
import { getCartDto } from "@scandihaven/commerce/cart-service";
import { getCartId } from "@/lib/cart-session";
import { CheckoutFlow } from "@/components/checkout-flow";
import { formatMinor } from "@/lib/format";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Checkout (PRD FR-501..512): summary + address + Stripe Payment Element. */
export default async function CheckoutPage() {
  const cartId = await getCartId();
  const cart = cartId ? await getCartDto(cartId).catch(() => null) : null;

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center md:px-8">
        <h1 className="font-display text-3xl">Nothing to check out</h1>
        <Link href="/shop" className="mt-6 inline-block text-accent-2 hover:underline">
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-12 px-5 py-12 md:px-8 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <h1 className="font-display text-3xl">Checkout</h1>
        <p className="mt-2 text-sm text-muted">
          Step 1 of 2 — contact & address. Payment opens below.
        </p>
        <div className="mt-8">
          <CheckoutFlow totalMinor={cart.totalMinor} currency={cart.currency} />
        </div>
      </div>

      <aside className="h-fit rounded-card border border-line bg-bg-2 p-6 lg:col-span-2" aria-label="Order summary">
        <h2 className="font-display text-xl">Order summary</h2>
        <ul className="mt-4 space-y-3 text-md">
          {cart.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3">
              <span>
                {line.productTitle}
                <span className="text-muted"> × {line.qty}</span>
              </span>
              <span className="tabular-nums">{formatMinor(line.totalMinor, cart.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-md">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatMinor(cart.subtotalMinor, cart.currency)}</dd>
          </div>
          {cart.discountMinor > 0 ? (
            <div className="flex justify-between text-sage">
              <dt>Discount</dt>
              <dd className="tabular-nums">−{formatMinor(cart.discountMinor, cart.currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMinor(cart.totalMinor, cart.currency)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

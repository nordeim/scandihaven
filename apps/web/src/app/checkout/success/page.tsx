import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order received",
  robots: { index: false },
};

/**
 * Post-payment landing (PRD FR-510). The order itself is created by the
 * payment_intent.succeeded webhook; this page instructs the customer and
 * avoids client-side claims about payment state we have not verified.
 */
export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-24 text-center md:px-8">
      <h1 className="font-display text-4xl">Thank you</h1>
      <p className="mt-4 text-md leading-relaxed text-ink-2">
        Your payment is being confirmed and your order is on its way through the workshop.
        You will receive a confirmation email within a few minutes with your order number.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/account" className="text-accent-2 hover:underline">
          View your account
        </Link>
        <span aria-hidden>·</span>
        <Link href="/shop" className="text-accent-2 hover:underline">
          Continue browsing
        </Link>
      </div>
    </div>
  );
}

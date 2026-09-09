"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { PaymentElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@scandihaven/ui/button";
import { Input } from "@scandihaven/ui/input";
import { Label } from "@scandihaven/ui/label";
import { createPaymentIntentAction, type CheckoutAddress } from "@/actions/checkout";
import { formatMinor } from "@/lib/format";

/** Checkout client flow (PRD FR-501/FR-508): address form → PaymentIntent → Payment Element. */

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export function CheckoutFlow({
  totalMinor,
  currency,
}: {
  totalMinor: number;
  currency: string;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    const address: CheckoutAddress = {
      name: String(data.get("name") ?? ""),
      line1: String(data.get("line1") ?? ""),
      line2: String(data.get("line2") ?? "") || undefined,
      city: String(data.get("city") ?? ""),
      postalCode: String(data.get("postalCode") ?? ""),
      country: String(data.get("country") ?? "DK"),
      email: String(data.get("email") ?? ""),
    };
    startTransition(async () => {
      const result = await createPaymentIntentAction({ address });
      if (result.ok) {
        setClientSecret(result.data.clientSecret);
      } else {
        setError(result.error.message);
      }
    });
  };

  if (!stripePromise) {
    return (
      <div className="rounded-card border border-line bg-bg-2 p-6">
        <p className="font-medium">Payments are not configured in this environment.</p>
        <p className="mt-2 text-md leading-relaxed text-muted">
          Set <code className="rounded bg-bg-3 px-1">STRIPE_SECRET_KEY</code> and{" "}
          <code className="rounded bg-bg-3 px-1">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> in{" "}
          <code className="rounded bg-bg-3 px-1">.env</code> with test-mode keys
          (<code className="rounded bg-bg-3 px-1">sk_test_…</code> /{" "}
          <code className="rounded bg-bg-3 px-1">pk_test_…</code> from the Stripe dashboard),
          then restart the dev server. Card 4242 4242 4242 4242 completes a test purchase.
        </p>
      </div>
    );
  }

  if (clientSecret) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "flat" } }}>
        <PaymentForm totalMinor={totalMinor} currency={currency} />
      </Elements>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required autoComplete="name" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="line1">Address</Label>
        <Input id="line1" name="line1" required autoComplete="address-line1" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" required autoComplete="address-level2" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input id="postalCode" name="postalCode" required autoComplete="postal-code" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" required defaultValue="DK" maxLength={2} autoComplete="country" />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Starting secure payment…" : "Continue to payment"}
      </Button>
      <p className="text-xs text-muted">
        Secure checkout powered by Stripe. Card details never touch our servers.
      </p>
    </form>
  );
}

function PaymentForm({ totalMinor, currency }: { totalMinor: number; currency: string }) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onPay = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Both Stripe handles must exist before confirming (audit 2026-09-09 H-3):
    // with `stripe?.confirmPayment(...) ?? { error: undefined }` a null
    // useStripe() short-circuited to a fabricated success shape and routed
    // the customer to /checkout/success with no confirmed PaymentIntent.
    if (!stripe || !elements) {
      setError("Payment is still loading — please try again in a moment.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message ?? "Payment could not be submitted.");
        return;
      }
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (confirmError) {
        setError(confirmError.message ?? "Payment failed. Your card was not charged twice — try again.");
        return;
      }
      // The order itself is created by the payment_intent.succeeded webhook
      // (PRD §4.3 — the webhook, not the client, is authoritative).
      router.push("/checkout/success");
    });
  };

  return (
    <form onSubmit={onPay} className="flex flex-col gap-6">
      <PaymentElement />
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Processing…" : `Pay ${formatMinor(totalMinor, currency)}`}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { placeOrderFromWebhook } from "@scandihaven/commerce/checkout-service";
import { getStripe } from "@scandihaven/commerce/checkout-service";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook (PRD §8.4): verify signature → idempotent event insert →
 * typed handler. Always 2xx after commit; duplicate events are a 200 no-op.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret || secret.includes("set-me")) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const payload = await request.text();
  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object;
      try {
        const placed = await placeOrderFromWebhook({
          stripeEventId: event.id,
          type: event.type,
          payloadJson: event.data.object,
          paymentIntentId: intent.id,
        });
        if (!placed) {
          // Duplicate event or unresolvable cart — both are success for Stripe.
          return NextResponse.json({ received: true, duplicate: true });
        }
        console.info(`[stripe] order ${placed.orderNumber} placed from webhook`);
        return NextResponse.json({ received: true, orderNumber: placed.orderNumber });
      } catch (error) {
        console.error("[stripe] order placement failed", error);
        // 500 → Stripe retries; webhook_event row already guards idempotency.
        return NextResponse.json({ error: "Order placement failed" }, { status: 500 });
      }
    }
    case "payment_intent.payment_failed":
    case "charge.refunded":
    case "charge.dispute.created":
      // Phase 1 handlers (FR-509 recovery, refunds reconciliation, fraud queue).
      return NextResponse.json({ received: true, handled: false });
    default:
      return NextResponse.json({ received: true, handled: false });
  }
}

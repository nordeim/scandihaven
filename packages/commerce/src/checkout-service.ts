/** Checkout & order placement (PRD §4.3, §7.6, §8.5, FR-501..512). */
import { and, eq, sql } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@scandihaven/db/client";
import {
  analyticsEvent,
  cart,
  cartLine,
  cartPromotion,
  inventoryLevel,
  inventoryMovement,
  job,
  order,
  orderAddress,
  orderEvent,
  orderLine,
  payment,
  product,
  productVariant,
  promotion,
  variantPrice,
  webhookEvent,
} from "@scandihaven/db/schema";
import { transition } from "./order-state";
import { computeCartTotals, type PriceLine, type PromotionApplication } from "./pricing";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes("set-me")) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key, { timeout: 15_000, maxNetworkRetries: 2 });
  }
  return stripeClient;
}

export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "STRIPE_NOT_CONFIGURED"
      | "CART_EMPTY"
      | "AMOUNT_MISMATCH"
      | "OUT_OF_STOCK"
      | "STRIPE_ERROR",
  ) {
    super(message);
  }
}

export type CheckoutContact = {
  email: string;
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string | null;
    city: string;
    postalCode: string;
    country: string;
    phone?: string | null;
  };
};

/**
 * Map cart_promotion × promotion join rows into the pricing engine's
 * PromotionApplication shape (PRD §7.10). Pure seam shared by intent creation
 * and the §7.11 webhook re-verification so both sides price the cart
 * identically to what the cart page displays.
 */
export function toPromotionApplications(
  rows: readonly { id: string; kind: string; value: number | null }[],
): PromotionApplication[] {
  return rows.map((row) => ({
    promotionId: row.id,
    kind: row.kind as PromotionApplication["kind"],
    value: row.value ?? 0,
  }));
}

/**
 * Load the promotions attached to a cart (same rows the cart DTO displays).
 * Accepts the pool client or a transaction client so the webhook path can
 * read promotions inside its placement transaction.
 */
export async function loadCartPromotionApplications(
  executor: Pick<typeof db, "select">,
  cartId: string,
): Promise<PromotionApplication[]> {
  const rows = await executor
    .select({ id: promotion.id, kind: promotion.kind, value: promotion.value })
    .from(cartPromotion)
    .innerJoin(promotion, eq(promotion.id, cartPromotion.promotionId))
    .where(eq(cartPromotion.cartId, cartId));
  return toPromotionApplications(rows);
}

/** Create (or reuse) a PaymentIntent for the cart; amount re-derived server-side (FR-508). */
export async function createPaymentIntent(
  cartId: string,
  contact?: CheckoutContact,
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) {
    throw new CheckoutError(
      "Stripe is not configured: set STRIPE_SECRET_KEY in .env (test mode keys).",
      "STRIPE_NOT_CONFIGURED",
    );
  }

  const cartRows = await db.select().from(cart).where(eq(cart.id, cartId)).limit(1);
  const cartRow = cartRows[0];
  if (!cartRow) throw new CheckoutError("Cart not found", "CART_EMPTY");

  const lineRows = await db
    .select({ line: cartLine, amount: variantPrice.amount })
    .from(cartLine)
    .innerJoin(
      variantPrice,
      and(eq(variantPrice.variantId, cartLine.variantId), eq(variantPrice.currency, cartRow.currency)),
    )
    .where(eq(cartLine.cartId, cartId));

  if (lineRows.length === 0) throw new CheckoutError("Cart is empty", "CART_EMPTY");

  const priceLines: PriceLine[] = lineRows.map((row) => ({
    id: row.line.id,
    qty: row.line.qty,
    unitPriceMinor: row.amount ?? row.line.unitPriceSnapshot,
    discountable: !row.line.isGiftWrap,
  }));
  // Payable totals include the cart's promotions (§7.11): the intent amount
  // must equal what the cart page displays, or the §7.11 re-verification
  // would reject every discounted order.
  const promotions = await loadCartPromotionApplications(db, cartId);
  const totals = computeCartTotals({ lines: priceLines, promotions, shippingMinor: 0 });

  // Idempotency key derived from cart identity + totals so retries reuse the intent.
  const idempotencyKey = `cart:${cartRow.id}:${totals.total}`;
  const intent = await stripe.paymentIntents.create(
    {
      amount: totals.total,
      currency: cartRow.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        cartId: cartRow.id,
        email: contact?.email ?? "",
        shipping_name: contact?.shippingAddress.name ?? "",
        shipping_line1: contact?.shippingAddress.line1 ?? "",
        shipping_line2: contact?.shippingAddress.line2 ?? "",
        shipping_city: contact?.shippingAddress.city ?? "",
        shipping_postal_code: contact?.shippingAddress.postalCode ?? "",
        shipping_country: contact?.shippingAddress.country ?? "",
        shipping_phone: contact?.shippingAddress.phone ?? "",
      },
    },
    { idempotencyKey },
  );
  return intent.client_secret ?? "";
}

export type PlaceOrderInput = {
  cartId: string;
  email: string;
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string | null;
    city: string;
    postalCode: string;
    country: string;
    phone?: string | null;
  };
  userId?: string | null;
};

/**
 * Place the order inside one transaction (PRD §4.3):
 * verify totals vs Stripe amount → lock inventory rows → create order + lines
 * + payment → decrement stock → convert cart → emit outbox jobs.
 * Idempotent by Stripe event id (webhook_event unique index, PRD §8.4).
 */
export async function placeOrderFromWebhook(input: {
  stripeEventId: string;
  type: string;
  payloadJson: unknown;
  paymentIntentId: string;
}): Promise<{ orderId: string; orderNumber: string } | null> {
  const insertedEvent = await db
    .insert(webhookEvent)
    .values({
      stripeEventId: input.stripeEventId,
      type: input.type,
      payload: input.payloadJson,
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvent.id });
  if (!insertedEvent[0]) return null; // duplicate event → 200 OK, no-op

  const cartId = await resolveCartIdFromIntent(input.paymentIntentId);
  if (!cartId) return null;

  const stripe = getStripe();
  if (!stripe) throw new CheckoutError("Stripe not configured", "STRIPE_NOT_CONFIGURED");
  const intent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
  const email =
    typeof intent.receipt_email === "string" && intent.receipt_email.length > 0
      ? intent.receipt_email
      : (intent.metadata["email"] ?? "unknown@scandihaven.example");

  return db.transaction(async (tx) => {
    const cartRows = await tx.select().from(cart).where(eq(cart.id, cartId)).limit(1).for("update");
    const cartRow = cartRows[0];
    if (!cartRow) return null;

    const lineRows = await tx
      .select({
        line: cartLine,
        variant: productVariant,
        productTitle: product.title,
        productLeadTimeMax: product.leadTimeDaysMax,
        amount: variantPrice.amount,
      })
      .from(cartLine)
      .innerJoin(productVariant, eq(productVariant.id, cartLine.variantId))
      .innerJoin(product, eq(product.id, productVariant.productId))
      .innerJoin(
        variantPrice,
        and(
          eq(variantPrice.variantId, cartLine.variantId),
          eq(variantPrice.currency, cartRow.currency),
        ),
      )
      .where(eq(cartLine.cartId, cartId));

    if (lineRows.length === 0) return null;

    const priceLines: PriceLine[] = lineRows.map((row) => ({
      id: row.line.id,
      qty: row.line.qty,
      unitPriceMinor: row.amount ?? row.line.unitPriceSnapshot,
      discountable: !row.line.isGiftWrap,
    }));
    // Re-verification (§7.11) prices the cart with its promotions inside the
    // same transaction — identical inputs to intent creation (§7.10).
    const promotions = await loadCartPromotionApplications(tx, cartId);
    const totals = computeCartTotals({ lines: priceLines, promotions, shippingMinor: 0 });

    if (totals.total !== intent.amount) {
      throw new CheckoutError(
        `Amount mismatch: cart ${totals.total} vs Stripe ${intent.amount}`,
        "AMOUNT_MISMATCH",
      );
    }

    // Lock and verify inventory for stocked variants (PRD §7.6); made-to-order rows
    // have no inventory_level row and skip reservation.
    for (const row of lineRows) {
      const locked = await tx
        .select()
        .from(inventoryLevel)
        .where(eq(inventoryLevel.variantId, row.line.variantId))
        .for("update");
      const level = locked[0];
      if (level && row.line.qty > level.qtyOnHand - level.qtyReserved - level.safetyStock) {
        throw new CheckoutError(`Insufficient stock for SKU ${row.variant.sku}`, "OUT_OF_STOCK");
      }
    }

    const year = new Date().getUTCFullYear();
    // Serialize per-year number generation (§7.9 concurrency): a unique-
    // violation on order_number would abort AFTER webhook_event was recorded,
    // and Stripe's retry would then no-op — silently losing a paid order.
    // The advisory lock makes MAX+1 deterministic under concurrency.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`order_number:${year}`}))`);
    const seqRows = await tx.execute<{ seq: string }>(
      sql`SELECT COALESCE(MAX(substring(number from 10)::int), 0) + 1 AS seq FROM "order" WHERE number LIKE ${`SH-${year}-%`}`,
    );
    const seq = Number(seqRows.rows[0]?.seq ?? 1);
    const placedAt = new Date();
    const orderNumber = `SH-${year}-${String(seq).padStart(6, "0")}`;

    const createdOrders = await tx
      .insert(order)
      .values({
        number: orderNumber,
        cartId: cartRow.id,
        userId: cartRow.userId,
        email,
        region: cartRow.region,
        currency: cartRow.currency,
        // FR-504 (multi-currency FX snapshot) is a Phase 1 slice: launch is
        // EUR-only, so rate 1 and totalEur=total are correct today. Revisit
        // with the fx_rate table the moment a second currency sells.
        fxRate: "1",
        status: "pending_payment",
        subtotal: totals.subtotal,
        discount: totals.discount,
        shipping: totals.shipping,
        tax: totals.tax,
        total: totals.total,
        totalEur: totals.total,
        source: "web",
        placedAt,
      })
      .returning({ id: order.id });
    const orderId = createdOrders[0]!.id;

    for (const row of lineRows) {
      await tx.insert(orderLine).values({
        orderId,
        variantId: row.line.variantId,
        titleSnapshot: row.productTitle,
        skuSnapshot: row.variant.sku,
        qty: row.line.qty,
        unitPrice: row.amount ?? row.line.unitPriceSnapshot,
        total: (row.amount ?? row.line.unitPriceSnapshot) * row.line.qty,
      });
    }

    await tx.insert(payment).values({
      orderId,
      stripePaymentIntentId: input.paymentIntentId,
      amount: intent.amount,
      currency: intent.currency.toUpperCase(),
      status: "succeeded",
    });

    await tx.insert(orderAddress).values({
      orderId,
      kind: "shipping",
      fields: {
        name: intent.metadata["shipping_name"] ?? "",
        line1: intent.metadata["shipping_line1"] ?? "",
        city: intent.metadata["shipping_city"] ?? "",
        postalCode: intent.metadata["shipping_postal_code"] ?? "",
        country: intent.metadata["shipping_country"] ?? "",
      },
    });

    const confirmed = transition("pending_payment", "payment_succeeded");
    await tx
      .update(order)
      .set({ status: confirmed, updatedAt: placedAt })
      .where(eq(order.id, orderId));
    await tx.insert(orderEvent).values({
      orderId,
      type: "payment_succeeded",
      actor: "system",
      payload: { stripeEventId: input.stripeEventId },
    });

    // Inventory movements + stock decrement.
    for (const row of lineRows) {
      const locked = await tx
        .select()
        .from(inventoryLevel)
        .where(eq(inventoryLevel.variantId, row.line.variantId))
        .for("update");
      const level = locked[0];
      if (level) {
        await tx
          .update(inventoryLevel)
          .set({ qtyOnHand: level.qtyOnHand - row.line.qty, updatedAt: placedAt })
          .where(
            and(
              eq(inventoryLevel.variantId, level.variantId),
              eq(inventoryLevel.warehouseId, level.warehouseId),
            ),
          );
        await tx.insert(inventoryMovement).values({
          variantId: level.variantId,
          warehouseId: level.warehouseId,
          delta: -row.line.qty,
          reason: "sale",
          referenceType: "order",
          referenceId: orderId,
        });
      }
    }

    // Server-authoritative analytics (PRD §11.2).
    await tx.insert(analyticsEvent).values({
      name: "order_completed",
      payload: {
        orderId,
        orderNumber,
        revenueMinor: totals.total,
        currency: cartRow.currency,
        itemCount: lineRows.reduce((acc, r) => acc + r.line.qty, 0),
      },
    });

    // Outbox: confirmation email (FR-910). Payload is a self-sufficient
    // snapshot so the drainer never re-reads mutable rows (§8.6).
    const leadTimeDaysMax = Math.max(
      0,
      ...lineRows.map(
        (r) => r.variant?.leadTimeDaysMaxOverride ?? r.productLeadTimeMax ?? 0,
      ),
    );
    await tx
      .insert(job)
      .values({
        kind: "email.order_confirmation",
        payload: {
          orderId,
          orderNumber,
          to: email,
          customerName: intent.metadata["shipping_name"] ?? "",
          totalMinor: totals.total,
          currency: cartRow.currency,
          leadTimeDaysMax,
        },
        idempotencyKey: `order_confirmation:${orderId}`,
      })
      .onConflictDoNothing();

    // Convert cart (FR-403 lifecycle).
    await tx
      .update(cart)
      .set({ status: "converted", updatedAt: placedAt })
      .where(eq(cart.id, cartRow.id));

    return { orderId, orderNumber };
  });
}

async function resolveCartIdFromIntent(paymentIntentId: string): Promise<string | null> {
  const rows = await db
    .select({ cartId: cart.id })
    .from(payment)
    .innerJoin(order, eq(order.id, payment.orderId))
    .innerJoin(cart, eq(cart.id, order.cartId))
    .where(eq(payment.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  if (rows[0]?.cartId) return rows[0].cartId;

  // Payment row may not exist yet (webhook raced the client) — fall back to PI metadata.
  const stripe = getStripe();
  if (!stripe) return null;
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return typeof intent.metadata["cartId"] === "string" ? intent.metadata["cartId"] : null;
}

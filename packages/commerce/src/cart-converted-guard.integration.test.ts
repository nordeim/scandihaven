import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { createPaymentIntent, placeOrderFromWebhook, CheckoutError } from "./checkout-service";

/**
 * Converted-cart guard (round 11, R10-7; PRD FR-508/509 money path):
 * `placeOrderFromWebhook` sets `cart.status = 'converted'` when an order
 * places, and its own comment documents the intent — "re-checkout with this
 * cart would double-charge a customer" — but NOTHING enforced it: addLine,
 * the cookie resolution, `createPaymentIntent`, and the placement itself
 * all ignored the status, and /checkout/success never clears the sh_cart
 * cookie. A customer whose cookie still pointed at the converted cart
 * could add items, mint a NEW PaymentIntent (evading the payment unique
 * index — different intent id), and pay the full old+new line set: a
 * second order, a double charge for the original items.
 *
 * This suite pins the guard at the two commerce seams that are reachable
 * without Stripe keys (the status checks run BEFORE getStripe — fail fast
 * on bad cart state): intent creation refuses non-active carts with a
 * typed CART_CONVERTED error, and placement refuses to place a second
 * order from a converted cart. Requires a local PG; skipped elsewhere.
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

describe.skipIf(!dbReady)("converted-cart guard (R10-7, FR-508/509)", () => {
  const cartToken = `e2e-r11-converted-${Date.now()}`;
  const intentId = `pi_r11_guard_${Date.now()}`;

  beforeAll(async () => {
    // A converted cart: a real cart row with a token, converted status.
    const cartId = (
      await db.execute<{ id: string }>(sql`
        INSERT INTO cart (token, status, region, currency)
        VALUES ('${sql.raw(cartToken)}', 'converted', 'EU', 'EUR')
        RETURNING id
      `)
    ).rows[0]!.id;

    // An order + payment chain so resolveCartIdFromIntent resolves via the
    // payment row (the DB path — no Stripe needed). Order number built
    // OUTSIDE the sql template: a ${} inside quotes binds a parameter into
    // a literal string (08P01) — the session-13 inline-constant lesson.
    const orderNumber = `SH-2026-R11${String(Date.now()).slice(-6)}`;
    const orderRow = await db.execute<{ id: string }>(sql`
      INSERT INTO "order" (number, cart_id, email, region, currency, status,
                            subtotal, discount, shipping, tax, total, total_eur,
                            payment_terms, source)
      VALUES ('${sql.raw(orderNumber)}', '${sql.raw(cartId)}',
              'r11@example.com', 'EU', 'EUR', 'confirmed',
              14900, 0, 0, 0, 14900, 14900, 'card', 'web')
      RETURNING id
    `);
    await db.execute(sql`
      INSERT INTO payment (order_id, stripe_payment_intent_id, amount, currency, status)
      VALUES ('${sql.raw(orderRow.rows[0]!.id)}', '${sql.raw(intentId)}', 14900, 'EUR', 'succeeded')
    `);
  });

  afterAll(async () => {
    await db.execute(sql`
      DELETE FROM payment WHERE stripe_payment_intent_id = '${sql.raw(intentId)}'
    `);
    await db.execute(sql`DELETE FROM "order" WHERE email = 'r11@example.com'`);
    await db.execute(sql`DELETE FROM cart WHERE token = '${sql.raw(cartToken)}'`);
    await pool.end().catch(() => undefined);
  });

  it("createPaymentIntent refuses a converted cart with a typed CART_CONVERTED error", async () => {
    const cartId = (
      await db.execute<{ id: string }>(sql`
        SELECT id FROM cart WHERE token = '${sql.raw(cartToken)}'
      `)
    ).rows[0]!.id;
    let caught: unknown;
    await createPaymentIntent(cartId).catch((e: unknown) => {
      caught = e;
    });
    expect(caught).toBeInstanceOf(CheckoutError);
    expect((caught as CheckoutError).code).toBe("CART_CONVERTED");
  });

  it("placeOrderFromWebhook never places a second order from a converted cart", async () => {
    const ordersBefore = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM "order" WHERE email = 'r11@example.com'`,
    );
    const result = await placeOrderFromWebhook({
      stripeEventId: `evt_r11_guard_${Date.now()}`,
      type: "payment_intent.succeeded",
      payloadJson: {},
      paymentIntentId: intentId,
    });
    // Guard fires BEFORE the Stripe call: null return, and no new order row.
    expect(result).toBeNull();
    const ordersAfter = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM "order" WHERE email = 'r11@example.com'`,
    );
    expect(ordersAfter.rows[0]!.count).toBe(ordersBefore.rows[0]!.count);
  });
});

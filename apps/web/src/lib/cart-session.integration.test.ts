import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { createCartToken } from "@scandihaven/commerce/cart-service";

/**
 * Cart session status filter (round 11, R10-7): `getCartId()` resolves only
 * ACTIVE carts — a cookie whose cart has been converted (an order placed)
 * behaves exactly like no cookie, so the next mutation mints a fresh cart.
 * DB-backed (local PG; skipped elsewhere) because the filter IS a query
 * predicate — the mock-based action tests cannot see it.
 */

const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

// next/headers is app-only; the seam under test is the query itself.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

const cookieStore = { get: vi.fn(), set: vi.fn() };

describe.skipIf(!dbReady)("getCartId resolves only active carts (R10-7)", () => {
  const token = createCartToken();
  let activeId = "";

  beforeAll(async () => {
    const inserted = await db.execute<{ id: string }>(sql`
      INSERT INTO cart (token, status, region, currency)
      VALUES ('${sql.raw(token)}', 'active', 'EU', 'EUR')
      RETURNING id
    `);
    activeId = inserted.rows[0]!.id;
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM cart WHERE token = '${sql.raw(token)}'`);
    await pool.end().catch(() => undefined);
  });

  it("resolves the UUID for an active cart's token", async () => {
    cookieStore.get.mockReturnValue({ value: token });
    const { getCartId } = await import("./cart-session");
    const id = await getCartId();
    expect(id).toBe(activeId);
  });

  it("resolves null once the cart converts — the stale cookie is inert (R10-7)", async () => {
    await db.execute(sql`UPDATE cart SET status = 'converted' WHERE token = '${sql.raw(token)}'`);
    cookieStore.get.mockReturnValue({ value: token });
    const { getCartId } = await import("./cart-session");
    const id = await getCartId();
    expect(id).toBeNull();
  });
});

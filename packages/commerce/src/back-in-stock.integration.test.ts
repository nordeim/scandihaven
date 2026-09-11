import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { requestBackInStock } from "./back-in-stock";

/**
 * Back-in-stock requests (live E2E audit round 8, R8-6; FR-310 M): the
 * `back_in_stock_request` table existed with the dedupe unique index
 * (variant_id, email) but nothing wrote to it — no service, no action, no UI.
 * Pins the write seam: first request registers, a repeat request for the same
 * (variant, email) is an honest no-op "already_registered" (the FR-310
 * "dedupe per email+variant" acceptance criterion), and unknown variants are
 * rejected. Requires local PG.
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

describe.skipIf(!dbReady)("requestBackInStock (R8-6, FR-310)", () => {
  const fixtureProductId = "77777777-7777-7777-7777-777777777781";
  const fixtureVariantId = "77777777-7777-7777-7777-777777777782";
  const email = "e2e-r8-notify@example.com";

  beforeAll(async () => {
    await db.execute(sql`
      INSERT INTO product (id, slug, title, status, category_id, materials, description_html, sort_order)
      VALUES ('${sql.raw(fixtureProductId)}', 'e2e-r8-notify-lamp', 'E2E Notify Lamp', 'active',
              (SELECT id FROM category WHERE slug = 'lighting'),
              ARRAY['brass'], '<p>A lamp for the notify test.</p>', 997)
      ON CONFLICT (id) DO NOTHING
    `);
    await db.execute(sql`
      INSERT INTO product_variant (id, product_id, sku, is_default, is_active)
      VALUES ('${sql.raw(fixtureVariantId)}', '${sql.raw(fixtureProductId)}', 'E2E-R8-NOTIFY-01', true, true)
      ON CONFLICT (id) DO NOTHING
    `);
  });

  afterAll(async () => {
    // Product cascade clears the variant; requests reference the variant.
    await db.execute(sql`DELETE FROM product WHERE id = '${sql.raw(fixtureProductId)}'`);
    await pool.end().catch(() => undefined);
  });

  it("registers a first request and dedupes a repeat (variant, email) pair", async () => {
    const first = await requestBackInStock(fixtureVariantId, email);
    expect(first).toEqual({ status: "registered" });

    const again = await requestBackInStock(fixtureVariantId, email);
    expect(again).toEqual({ status: "already_registered" });

    const rows = await db.execute(
      sql`SELECT email FROM back_in_stock_request WHERE variant_id = '${sql.raw(fixtureVariantId)}'`,
    );
    expect(rows.rows).toHaveLength(1);
  });

  it("rejects unknown variants", async () => {
    await expect(
      requestBackInStock("00000000-0000-0000-0000-000000000001", email),
    ).rejects.toThrow();
  });
});

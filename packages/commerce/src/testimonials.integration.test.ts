import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { listApprovedTestimonials } from "./catalog";

/**
 * Homepage testimonials (live E2E audit round 8, R8-5; FR-701 §9): the
 * section renders "3-up from approved reviews", but no commerce query for
 * approved reviews existed and the seed never created a review row — so the
 * surface could never render. Pins the read seam: approved-only, newest
 * first, bounded, joined to the product for deep links. Requires local PG.
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

describe.skipIf(!dbReady)("listApprovedTestimonials (R8-5, FR-701 §9)", () => {
  const fixtureProductId = "77777777-7777-7777-7777-777777777771";
  const base = Date.UTC(2026, 0, 1);

  beforeAll(async () => {
    await db.execute(sql`
      INSERT INTO product (id, slug, title, status, category_id, materials, description_html, sort_order)
      VALUES ('${sql.raw(fixtureProductId)}', 'e2e-r8-testimonial-chair', 'E2E Testimonial Chair', 'active',
              (SELECT id FROM category WHERE slug = 'seating'),
              ARRAY['oak'], '<p>A chair for the testimonial test.</p>', 998)
      ON CONFLICT (id) DO NOTHING
    `);
    // approved + pending + rejected rows: only approved may surface.
    for (const [i, status] of [["1", "approved"], ["2", "pending"], ["3", "rejected"], ["4", "approved"]] as const) {
      await db.execute(sql`
        INSERT INTO review (id, product_id, author_name, rating, title, body, status, is_verified_purchase, helpful_count, created_at)
        VALUES (
          md5('r8-review-${sql.raw(i)}')::uuid,
          '${sql.raw(fixtureProductId)}',
          'Reviewer ${sql.raw(i)}',
          ${i === "1" ? 5 : 4},
          'Title ${sql.raw(i)}',
          'Body ${sql.raw(i)}',
          '${sql.raw(status)}',
          false,
          ${Number(i) * 10},
          now() - interval '${sql.raw(String(Number(i) * 10))} days'
        )
        ON CONFLICT DO NOTHING
      `);
    }
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM product WHERE id = '${sql.raw(fixtureProductId)}'`);
    await pool.end().catch(() => undefined);
  });

  it("returns only approved reviews joined to product identity", async () => {
    const rows = await listApprovedTestimonials(10);
    const mine = rows.filter((r) => r.productSlug === "e2e-r8-testimonial-chair");
    expect(mine).toHaveLength(2);
    for (const row of mine) {
      expect(row.authorName).toMatch(/^Reviewer [14]$/);
      expect(row.productTitle).toBe("E2E Testimonial Chair");
      expect([4, 5]).toContain(row.rating);
    }
  });

  it("orders by recency (newest first) and bounds by limit", async () => {
    const rows = await listApprovedTestimonials(10);
    const mine = rows.filter((r) => r.productSlug === "e2e-r8-testimonial-chair");
    expect(mine[0]?.authorName).toBe("Reviewer 1");
    expect(mine[1]?.authorName).toBe("Reviewer 4");
    const bounded = await listApprovedTestimonials(1);
    expect(bounded).toHaveLength(1);
  });
});

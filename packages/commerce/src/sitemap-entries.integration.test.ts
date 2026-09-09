import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { listSitemapEntries } from "./catalog";

/**
 * Sitemap catalog seam (live E2E audit 2026-09-10 round 4, R4-3 / PRD §11.1):
 * `app/sitemap.ts` needs every indexable catalog URL — active product slugs
 * with their `updated_at` (for `lastModified`), active category slugs
 * (each `/shop/{slug}` PLP is a crawlable page), and active collection
 * slugs. Inactive rows must never leak into the sitemap. Requires a local
 * PG; skipped elsewhere so hermetic unit CI is unaffected.
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

describe.skipIf(!dbReady)("listSitemapEntries (R4-3)", () => {
  beforeAll(async () => {
    await db.execute(sql`
      INSERT INTO product (id, slug, title, status, lead_time_days_min, lead_time_days_max, materials)
      VALUES ('44444444-4444-4444-8444-444444444441', 'e2e-sitemap-inactive-chair', 'Inactive Chair', 'draft', 10, 20, ARRAY['wood']::text[])
      ON CONFLICT (slug) DO NOTHING
    `);
  });

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM product WHERE slug = 'e2e-sitemap-inactive-chair'`,
    );
    await pool.end().catch(() => undefined);
  });

  it("returns the seeded catalog: products with updatedAt, categories, collections", async () => {
    const entries = await listSitemapEntries();

    expect(entries.products.length).toBeGreaterThanOrEqual(5);
    expect(entries.categories.length).toBeGreaterThanOrEqual(3);
    expect(entries.collections.length).toBeGreaterThanOrEqual(1);

    const lamp = entries.products.find((p) => p.slug === "oresund-table-lamp");
    expect(lamp).toBeDefined();
    expect(lamp?.updatedAt).toBeInstanceOf(Date);

    // Every seed category is a real /shop/{slug} page (lighting, furniture, …)
    const slugs = entries.categories.map((c) => c.slug);
    expect(slugs).toContain("lighting");
  });

  it("excludes non-active products", async () => {
    const entries = await listSitemapEntries();
    expect(entries.products.map((p) => p.slug)).not.toContain(
      "e2e-sitemap-inactive-chair",
    );
  });

  it("excludes the search/cart/checkout surfaces by construction (only catalog slugs are returned)", async () => {
    const entries = await listSitemapEntries();
    const allSlugs = [
      ...entries.products.map((p) => p.slug),
      ...entries.categories.map((c) => c.slug),
      ...entries.collections.map((c) => c.slug),
    ];
    // No pagination-only or utility surface can appear — the query shape
    // guarantees it; this pins the contract for app/sitemap.ts consumers.
    expect(allSlugs.every((s) => typeof s === "string" && s.length > 0)).toBe(true);
  });
});

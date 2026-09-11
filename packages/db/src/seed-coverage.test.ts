import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, pool } from "./client";

/**
 * Seed coverage for FR-704 (live E2E audit round 7, R7-3): the PRD mandates
 * twelve admin-managed static pages; only six were seeded, so six slugs 404'd
 * on the live site. This pins the demo catalog to the full FR-704 list so a
 * dropped seed row fails CI instead of surfacing as a live 404. Requires a
 * local PG (migrated + seeded); skipped elsewhere.
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

const FR_704_SLUGS = [
  "our-story",
  "sustainability",
  "materials",
  "showrooms",
  "trade-program",
  "faq",
  "shipping",
  "returns",
  "privacy",
  "terms",
  "cookies",
  "accessibility",
] as const;

describe.skipIf(!dbReady)("seed: FR-704 static page coverage (R7-3)", () => {
  it("seeds all twelve FR-704 static pages, published", async () => {
    const rows = await db.execute<{ slug: string; is_published: boolean }>(
      sql`SELECT slug, is_published FROM static_page`,
    );
    const bySlug = new Map(rows.rows.map((row) => [row.slug, row.is_published]));
    const missing = FR_704_SLUGS.filter((slug) => !bySlug.get(slug));
    const unpublished = FR_704_SLUGS.filter((slug) => bySlug.get(slug) === false);
    expect(missing, "missing FR-704 seed rows").toEqual([]);
    expect(unpublished, "FR-704 seed rows must be published").toEqual([]);
  });

  it("seeds the journal posts the FR-703 reader route serves (R7-2 companion)", async () => {
    const rows = await db.execute<{ slug: string }>(
      sql`SELECT slug FROM journal_post WHERE is_published`,
    );
    const slugs = rows.rows.map((row) => row.slug);
    expect(slugs).toContain("the-slow-chair");
    expect(slugs).toContain("wool-that-remembers-water");
  });

  it("seeds the search synonyms FR-105 expands (R7-4 companion)", async () => {
    const rows = await db.execute<{ term: string; synonym: string }>(
      sql`SELECT term, synonym FROM search_synonym`,
    );
    const pairs = rows.rows.map((row) => `${row.term}->${row.synonym}`);
    expect(pairs).toContain("couch->sofa");
    expect(pairs).toContain("lamp->lighting");
    expect(pairs).toContain("rug->throw");
  });

  it("seeds approved reviews so the FR-701 §9 testimonials and FR-308 read-path render (R8-5)", async () => {
    const rows = await db.execute<{ n: string; products: string }>(
      sql`SELECT COUNT(*)::text AS n, COUNT(DISTINCT product_id)::text AS products FROM review WHERE status = 'approved'`,
    );
    const count = Number(rows.rows[0]?.n ?? "0");
    const products = Number(rows.rows[0]?.products ?? "0");
    expect(count, "approved review seed rows").toBeGreaterThanOrEqual(6);
    expect(products, "distinct products carrying approved reviews").toBeGreaterThanOrEqual(4);
  });

  it("ends the pool cleanly", async () => {
    await pool.end().catch(() => undefined);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { listProducts, searchTypeahead } from "./catalog";

/**
 * Search depth (round 7, R7-4; FR-105; PAD R-DB-1 P0 + R-SHOP-1 P1):
 * (a) the seeded `search_synonym` rows (couch→sofa) must actually expand the
 * FTS query — before this slice they were dead data (live q=couch → 0
 * results); (b) pg_trgm similarity ≥ 0.5 unions typo-tolerant matches;
 * (c) search runs over the maintained `product.search_vector`, not an ad-hoc
 * per-row to_tsvector. Requires a local PG; skipped elsewhere.
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

describe.skipIf(!dbReady)("search depth (R7-4, FR-105)", () => {
  const fixtureProductId = "88888888-8888-8888-8888-888888888888";
  const fixtureVariantId = "88888888-8888-8888-8888-888888888881";
  const fixturePriceId = "88888888-8888-8888-8888-888888888882";

  beforeAll(async () => {
    // A sofa the couch→sofa synonym can reach. Full card shape: product +
    // active variant + EUR price (the listProducts CTE joins both).
    await db.execute(sql`
      INSERT INTO product (id, slug, title, status, category_id, materials, description_html, sort_order)
      VALUES ('${sql.raw(fixtureProductId)}', 'e2e-r7-fjord-sofa', 'E2E Fjord Test Sofa', 'active',
              (SELECT id FROM category WHERE slug = 'seating'),
              ARRAY['wool'], '<p>A sofa for the synonym expansion test.</p>', 999)
      ON CONFLICT (id) DO NOTHING
    `);
    await db.execute(sql`
      INSERT INTO product_variant (id, product_id, sku, is_default, is_active)
      VALUES ('${sql.raw(fixtureVariantId)}', '${sql.raw(fixtureProductId)}', 'E2E-R7-SOFA-01', true, true)
      ON CONFLICT (id) DO NOTHING
    `);
    await db.execute(sql`
      INSERT INTO variant_price (id, variant_id, currency, amount)
      VALUES ('${sql.raw(fixturePriceId)}', '${sql.raw(fixtureVariantId)}', 'EUR', 89000)
      ON CONFLICT (id) DO NOTHING
    `);
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM product WHERE id = '${sql.raw(fixtureProductId)}'`);
    await pool.end().catch(() => undefined);
  });

  it("a synonym term expands the FTS query: q=couch finds the sofa (FR-105)", async () => {
    const result = await listProducts({ search: "couch", region: "EU" });
    expect(result.items.map((item) => item.slug)).toContain("e2e-r7-fjord-sofa");
  });

  it("the synonym expansion also serves the typeahead (FR-104 parity)", async () => {
    const rows = await searchTypeahead("couch", 10);
    expect(rows.map((row) => row.slug)).toContain("e2e-r7-fjord-sofa");
  });

  it("trigram union tolerates typos: 'halden linnen armchair' still finds the Halden (FR-105)", async () => {
    const result = await listProducts({ search: "halden linnen armchair", region: "EU" });
    expect(result.items.map((item) => item.slug)).toContain("halden-linen-armchair");
  });

  it("exact FTS over the maintained vector still matches (R-DB-1)", async () => {
    const result = await listProducts({ search: "linen", region: "EU" });
    expect(result.items.map((item) => item.slug)).toContain("halden-linen-armchair");
    const sofa = await listProducts({ search: "sofa", region: "EU" });
    expect(sofa.items.map((item) => item.slug)).toContain("e2e-r7-fjord-sofa");
  });

  it("the maintained search_vector column exists with its GIN index (R-DB-1)", async () => {
    const column = await db.execute<{ column_name: string; is_generated: string }>(
      sql`SELECT column_name, is_generated FROM information_schema.columns
          WHERE table_name = 'product' AND column_name = 'search_vector'`,
    );
    expect(column.rows.length).toBe(1);
    expect(column.rows[0]?.is_generated).toBe("ALWAYS");
    const index = await db.execute<{ indexname: string }>(
      sql`SELECT indexname FROM pg_indexes
          WHERE tablename = 'product' AND indexname = 'product_search_vector_idx'`,
    );
    expect(index.rows.length).toBe(1);
  });
});

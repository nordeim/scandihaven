import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { hasActiveCategory } from "./catalog";

/**
 * Empty-category seam (live E2E audit 2026-09-10 round 5, R5-3 / FR-201):
 * the sitemap lists every ACTIVE category, but `/shop/[category]` 404'd any
 * category whose product count is 0 — advertising URLs that 404. The page
 * now distinguishes "known active category" (200, honest empty state) from
 * "unknown or inactive slug" (404, FR-201). Requires a local PG; skipped
 * elsewhere so hermetic unit CI is unaffected.
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

describe.skipIf(!dbReady)("hasActiveCategory (R5-3)", () => {
  beforeAll(async () => {
    await db.execute(sql`
      INSERT INTO category (id, slug, name, is_active)
      VALUES ('55555555-5555-5555-8555-555555555555', 'e2e-inactive-category', 'Inactive Category', false)
      ON CONFLICT (id) DO NOTHING
    `);
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM category WHERE id = '55555555-5555-5555-8555-555555555555'`);
    await pool.end().catch(() => undefined);
  });

  it("returns true for a seeded active category with zero products (beds)", async () => {
    await expect(hasActiveCategory("beds")).resolves.toBe(true);
  });

  it("returns true for a seeded active category with products (lighting)", async () => {
    await expect(hasActiveCategory("lighting")).resolves.toBe(true);
  });

  it("returns false for an unknown slug", async () => {
    await expect(hasActiveCategory("no-such-category-xyz")).resolves.toBe(false);
  });

  it("returns false for an INACTIVE category", async () => {
    await expect(hasActiveCategory("e2e-inactive-category")).resolves.toBe(false);
  });
});

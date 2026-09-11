import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { getJournalPost, listSitemapEntries, searchTypeaheadJournal } from "./catalog";

/**
 * Journal reader seam (live E2E audit 2026-09-11 round 7, R7-2 / FR-703):
 * `/journal/{category}/{slug}` article routes need a published-post fetch
 * (unknown slug → null → 404), a typeahead journal group (FR-104's third
 * group — empty since R6-2 because the reader route did not exist), and
 * sitemap entries for published articles. Requires a local PG; skipped
 * elsewhere so hermetic unit CI is unaffected.
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

describe.skipIf(!dbReady)("journal reader seam (R7-2, FR-703)", () => {
  // UUID inlined in the SQL (repo idiom — the sql template binds ${} as a
  // parameter, which must not sit inside SQL string literals).
  beforeAll(async () => {
    await db.execute(sql`
      INSERT INTO journal_post (id, slug, title, body_html, category, author, is_published, published_at)
      VALUES ('77777777-7777-7777-8777-777777777777', 'e2e-r7-unpublished-draft', 'Draft Post', '<p>hidden</p>', 'craft', 'Studio Journal', false, NULL)
      ON CONFLICT (slug) DO NOTHING
    `);
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM journal_post WHERE id = '77777777-7777-7777-8777-777777777777'`);
    await pool.end().catch(() => undefined);
  });

  it("getJournalPost returns a published post with its category and body", async () => {
    const post = await getJournalPost("the-slow-chair");
    expect(post).not.toBeNull();
    expect(post?.category).toBe("craft");
    expect(post?.title).toBe("The Slow Chair");
    expect(post?.bodyHtml).toContain("Eight weeks");
    expect(post?.author).toBe("Studio Journal");
  });

  it("getJournalPost returns null for an unknown slug", async () => {
    await expect(getJournalPost("no-such-post-xyz")).resolves.toBeNull();
  });

  it("getJournalPost never returns an unpublished post", async () => {
    await expect(getJournalPost("e2e-r7-unpublished-draft")).resolves.toBeNull();
  });

  it("searchTypeaheadJournal finds published posts by title fragment", async () => {
    const rows = await searchTypeaheadJournal("slow", 3);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.slug).toBe("the-slow-chair");
    expect(rows[0]?.title).toBe("The Slow Chair");
    expect(rows[0]?.category).toBe("craft");
  });

  it("searchTypeaheadJournal never surfaces unpublished posts", async () => {
    const rows = await searchTypeaheadJournal("draft", 3);
    expect(rows.every((row) => row.slug !== "e2e-r7-unpublished-draft")).toBe(true);
  });

  it("listSitemapEntries includes published journal articles with their categories", async () => {
    const entries = await listSitemapEntries();
    expect(entries.journal.length).toBeGreaterThanOrEqual(2);
    const slow = entries.journal.find((entry) => entry.slug === "the-slow-chair");
    expect(slow?.category).toBe("craft");
    expect(slow?.updatedAt).toBeInstanceOf(Date);
    const wool = entries.journal.find((entry) => entry.slug === "wool-that-remembers-water");
    expect(wool?.category).toBe("people");
  });

  it("listSitemapEntries journal list excludes unpublished posts", async () => {
    const entries = await listSitemapEntries();
    expect(entries.journal.every((entry) => entry.slug !== "e2e-r7-unpublished-draft")).toBe(true);
  });
});

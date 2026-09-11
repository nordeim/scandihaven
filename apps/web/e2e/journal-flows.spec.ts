import { expect, test } from "@playwright/test";

/**
 * Journal reader flows (live E2E audit 2026-09-11 round 7, R7-2; PRD
 * FR-703): `/journal/{category}/{slug}` article routes render the sanitized
 * body with Article JSON-LD, the `/journal` index links its posts, and
 * URL/category mismatches 404 honestly (FR-201-style self-consistency — an
 * article only resolves under its own category segment).
 */

test.describe("journal reader (R7-2, FR-703)", () => {
  test("article route renders title, sanitized body, and metadata", async ({ page }) => {
    const resp = await page.goto("/journal/craft/the-slow-chair");
    expect(resp?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /the slow chair/i })).toBeVisible();
    // Sanitized rich body renders (§9.4 render-time sanitization)
    await expect(page.getByText(/eight weeks sounds like a long time/i)).toBeVisible();
    // Canonical + og:url are absolute and request-scoped (R5-2 convention)
    const canonical = await page.locator("link[rel=canonical]").getAttribute("href");
    expect(canonical).toMatch(/\/journal\/craft\/the-slow-chair$/);
  });

  test("article emits Article JSON-LD with absolute url (FR-703, §11.1)", async ({ page }) => {
    await page.goto("/journal/craft/the-slow-chair");
    const blocks = await page.locator("script[type='application/ld+json']").allTextContents();
    const article = blocks.map((b) => JSON.parse(b)).find((j) => j["@type"] === "Article");
    expect(article).toBeDefined();
    expect(article.headline).toBe("The Slow Chair");
    expect(String(article.mainEntityOfPage)).toMatch(/\/journal\/craft\/the-slow-chair$/);
  });

  test("journal index links each post to its category-scoped route", async ({ page }) => {
    await page.goto("/journal");
    const slowChair = page.getByRole("link", { name: /the slow chair/i }).first();
    await expect(slowChair).toBeVisible();
    await expect(slowChair).toHaveAttribute("href", "/journal/craft/the-slow-chair");
    const wool = page.getByRole("link", { name: /wool that remembers water/i }).first();
    await expect(wool).toBeVisible();
    await expect(wool).toHaveAttribute("href", "/journal/people/wool-that-remembers-water");
  });

  test("category mismatch 404s honestly (article only resolves under its own category)", async ({ page }) => {
    const resp = await page.goto("/journal/people/the-slow-chair");
    expect(resp?.status()).toBe(404);
  });

  test("unknown article slug 404s", async ({ page }) => {
    const resp = await page.goto("/journal/craft/no-such-article");
    expect(resp?.status()).toBe(404);
  });
});

test.describe("homepage journal preview (R8-2, FR-701 §10)", () => {
  test("journal preview cards link to the category-scoped reader routes", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "From the journal" })).toBeVisible();
    const slowChair = page.getByRole("link", { name: /the slow chair/i }).first();
    await expect(slowChair).toBeVisible();
    await expect(slowChair).toHaveAttribute("href", "/journal/craft/the-slow-chair");
    const wool = page.getByRole("link", { name: /wool that remembers water/i }).first();
    await expect(wool).toBeVisible();
    await expect(wool).toHaveAttribute("href", "/journal/people/wool-that-remembers-water");
  });

  test("a journal preview card click-through resolves the reader route", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /the slow chair/i }).first().click();
    await expect(page).toHaveURL(/\/journal\/craft\/the-slow-chair$/);
    await expect(page.getByRole("heading", { level: 1, name: /the slow chair/i })).toBeVisible();
  });
});

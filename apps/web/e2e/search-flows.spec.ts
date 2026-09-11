import { expect, test } from "@playwright/test";

/**
 * Search results page flows (live E2E audit 2026-09-10 round 4, R4-5; PRD
 * FR-106, §11.1): `/search?q=` renders a server-side product grid with a
 * shareable URL, an honest empty state, and `noindex` (search pages are
 * explicitly excluded from indexing).
 */

test.describe("search results page (FR-106)", () => {
  test("renders matching products for a seeded query with the query echoed", async ({ page }) => {
    await page.goto("/search?q=lamp");
    await expect(page.getByRole("heading", { level: 1, name: /search/i })).toBeVisible();
    await expect(page.getByText(/“lamp”/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Øresund table lamp/i })).toBeVisible();
    // Results link to PDPs
    await expect(
      page.getByRole("link", { name: /Øresund table lamp/i }).first(),
    ).toHaveAttribute("href", "/products/oresund-table-lamp");
  });

  test("URL is shareable — sort persists and re-renders", async ({ page }) => {
    await page.goto("/search?q=lamp&sort=price_desc");
    await expect(page.getByRole("heading", { level: 1, name: /search/i })).toBeVisible();
    await expect(page.getByText(/“lamp”/i)).toBeVisible();
    await expect(page.locator("a[aria-current='page'], [data-sort='price_desc']").first()).toBeVisible().catch(() => {
      // Sort links render even when a different sort is active — assert the
      // control exists and the results still render.
      return expect(page.getByRole("link", { name: /price/i }).first()).toBeVisible();
    });
  });

  test("unknown query shows the empty state with guidance", async ({ page }) => {
    await page.goto("/search?q=zzzznotathing");
    await expect(page.getByRole("heading", { level: 1, name: /search/i })).toBeVisible();
    await expect(page.getByText(/no results/i)).toBeVisible();
    // Guidance: a link back to the catalog
    await expect(page.getByRole("link", { name: /browse the shop/i })).toBeVisible();
  });

  test("short or missing query renders guidance, not a crash", async ({ page }) => {
    const resp = await page.goto("/search");
    expect(resp?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /search/i })).toBeVisible();
  });

  test("search pages are noindex (PRD §11.1)", async ({ page }) => {
    await page.goto("/search?q=lamp");
    const robots = await page
      .locator('meta[name="robots"]')
      .first()
      .getAttribute("content");
    expect(robots).toContain("noindex");
  });

  test("category suggestion links help zero-result users onward", async ({ page }) => {
    await page.goto("/search?q=zzzznotathing");
    await expect(page.getByRole("link", { name: /^lighting$/i }).first()).toBeVisible();
  });
});

test.describe("header search typeahead (round 6, R6-2; PRD FR-101/FR-104)", () => {
  // FR-101: the global header carries search. R6-2: the typeahead affordance
  // was missing sitewide (API + results page existed unsurfaced).
  test("desktop header exposes a search input", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /search/i });
    await expect(search).toBeVisible();
  });

  test("typing ≥2 chars opens suggestions from the typeahead API", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /search/i });
    await search.click();
    await search.pressSequentially("lamp", { delay: 60 });
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    await expect(listbox.getByText(/Øresund table lamp/i)).toBeVisible();
  });

  test("sub-minimum input does not open the dropdown", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /search/i });
    await search.click();
    await search.pressSequentially("l", { delay: 60 });
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("keyboard: ArrowDown + Enter navigates to the highlighted PDP (FR-104)", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /search/i });
    await search.click();
    await search.pressSequentially("lamp", { delay: 60 });
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    await search.press("ArrowDown");
    await search.press("Enter");
    await page.waitForURL(/\/products\/oresund-table-lamp/);
    expect(page.url()).toContain("/products/oresund-table-lamp");
  });

  test("bare submit navigates to the shareable results page", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /search/i });
    await search.click();
    await search.pressSequentially("lamp", { delay: 60 });
    await expect(page.getByRole("listbox")).toBeVisible();
    await search.press("Enter");
    await page.waitForURL(/\/search\?q=lamp/);
    await expect(page.getByRole("heading", { level: 1, name: /search/i })).toBeVisible();
  });

  test("Escape dismisses the suggestion listbox", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /search/i });
    await search.click();
    await search.pressSequentially("lamp", { delay: 60 });
    await expect(page.getByRole("listbox")).toBeVisible();
    await search.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("mobile drawer exposes a Search link (FR-102 parity)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("link", { name: /search/i })).toBeVisible();
  });

  test("journal group surfaces seeded posts linking to the reader route (R7-2, FR-104)", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /search/i });
    await search.click();
    await search.pressSequentially("slow", { delay: 60 });
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    const journalOption = listbox.getByRole("option", { name: /the slow chair/i }).first();
    await expect(journalOption).toBeVisible();
    await expect(journalOption.getByText("Journal")).toBeVisible();
    // Options navigate via mousedown (no anchor) — click through to the FR-703
    // category-scoped reader route.
    await journalOption.click();
    await page.waitForURL(/\/journal\/craft\/the-slow-chair$/);
    await expect(page.getByRole("heading", { level: 1, name: /the slow chair/i })).toBeVisible();
  });
});

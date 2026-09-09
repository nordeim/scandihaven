import { expect, test } from "@playwright/test";

/**
 * SEO surface flows (live E2E audit 2026-09-10 round 4, R4-3/R4-4/R4-6/
 * R4-7/R4-8; PRD §11.1, FR-312/FR-313): sitemap.xml, robots.txt, absolute
 * canonical/OG URLs, and structured data. These surfaces were missing or
 * localhost-bound on the live deployment; the specs pin the served output.
 *
 * Canonical/OG assertions assert against the SERVED origin (the request-
 * derived fallback in `resolveSiteUrl`) so they hold both locally (no
 * NEXT_PUBLIC_SITE_URL set) and on a correctly configured deployment.
 */

const SERVED_ORIGIN = new URL(process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").origin;

test.describe("sitemap.xml (R4-3, PRD §11.1)", () => {
  test("serves an XML sitemap with catalog URLs and absolute locs", async ({ request }) => {
    const resp = await request.get("/sitemap.xml");
    expect(resp.status()).toBe(200);
    const body = await resp.text();
    expect(body).toContain("<urlset");

    // Seeded catalog entries (product, category, collection, static)
    expect(body).toContain("/products/halden-linen-armchair</loc>");
    expect(body).toContain("/products/oresund-table-lamp</loc>");
    expect(body).toContain("/shop/lighting</loc>");
    expect(body).toContain("/journal</loc>");

    // Private surfaces never appear
    expect(body).not.toContain("/cart</loc>");
    expect(body).not.toContain("/checkout</loc>");
    expect(body).not.toContain("/account</loc>");
    expect(body).not.toContain("/search</loc>");

    // Every loc is absolute (sitemaps.org §2.1 requires full URLs)
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? "");
    expect(locs.length).toBeGreaterThan(5);
    expect(locs.every((loc) => /^https?:\/\//.test(loc))).toBe(true);
    expect(locs.some((loc) => loc.startsWith(SERVED_ORIGIN))).toBe(true);
  });

  test("references product lastModified dates", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();
    expect(body).toContain("<lastmod>");
  });
});

test.describe("robots.txt (R4-4, PRD §11.1)", () => {
  test("disallows private surfaces and references the sitemap", async ({ request }) => {
    const resp = await request.get("/robots.txt");
    expect(resp.status()).toBe(200);
    const body = await resp.text();

    expect(body).toMatch(/user-agent:\s*\*/i);
    expect(body).toMatch(/disallow:\s*\/account/i);
    expect(body).toMatch(/disallow:\s*\/cart/i);
    expect(body).toMatch(/disallow:\s*\/checkout/i);
    expect(body).toMatch(/disallow:\s*\/search/i);
    expect(body).toMatch(/disallow:\s*\/api/i);
    expect(body).toMatch(new RegExp(`sitemap:\\s*${SERVED_ORIGIN}/sitemap\\.xml`, "i"));

    // Never a blanket disallow
    expect(body).not.toMatch(/disallow:\s*\/\s*$/im);
  });
});

test.describe("canonical + OG metadata (R4-6/R4-7, FR-313)", () => {
  test("PDP canonical and og:url are absolute and match the served origin", async ({ page }) => {
    await page.goto("/products/oresund-table-lamp");

    const canonical = await page
      .locator('link[rel="canonical"]')
      .first()
      .getAttribute("href");
    expect(canonical).toBeTruthy();
    expect(canonical).toBe(`${SERVED_ORIGIN}/products/oresund-table-lamp`);

    const ogUrl = await page
      .locator('meta[property="og:url"]')
      .first()
      .getAttribute("content");
    expect(ogUrl).toBe(`${SERVED_ORIGIN}/products/oresund-table-lamp`);

    const ogImage = await page
      .locator('meta[property="og:image"]')
      .first()
      .getAttribute("content");
    expect(ogImage).toBeTruthy();
    expect(ogImage).toMatch(/^https?:\/\//);
    expect(ogImage).not.toContain("localhost:3000/products");
  });

  test("home page carries og:title and a twitter card", async ({ page }) => {
    await page.goto("/");
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .first()
      .getAttribute("content");
    expect(ogTitle).toBeTruthy();
    const twitterCard = await page
      .locator('meta[name="twitter:card"]')
      .first()
      .getAttribute("content");
    expect(twitterCard).toBeTruthy();
  });
});

test.describe("structured data (R4-8, FR-312, PRD §11.1)", () => {
  test("PDP emits Product, Offer, and BreadcrumbList JSON-LD", async ({ page }) => {
    await page.goto("/products/oresund-table-lamp");
    const jsonLdBlocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const combined = jsonLdBlocks.join("\n");

    expect(combined).toContain('"Product"');
    expect(combined).toContain('"Offer"');
    expect(combined).toContain('"BreadcrumbList"');
    // Breadcrumb trail ends at this PDP
    expect(combined).toContain("/products/oresund-table-lamp");
  });

  test("sitewide Organization and WebSite JSON-LD with SearchAction are present", async ({ page }) => {
    await page.goto("/");
    const jsonLdBlocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const combined = jsonLdBlocks.join("\n");

    expect(combined).toContain('"Organization"');
    expect(combined).toContain('"WebSite"');
    expect(combined).toContain('"SearchAction"');
    expect(combined).toContain("/search?q={search_term_string}");
  });
});

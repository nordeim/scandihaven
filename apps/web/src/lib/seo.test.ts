import { describe, expect, it } from "vitest";

/**
 * SEO builders (live E2E audit 2026-09-10 round 4, R4-3/R4-4/R4-7/R4-8;
 * PRD §11.1, FR-312/FR-313): pure functions feeding `app/sitemap.ts`,
 * `app/robots.ts`, and the PDP/root-layout structured data. Kept pure so the
 * entry rules (exclusions, priorities, JSON-LD shapes) are pinned without a
 * server or database.
 */
import {
  breadcrumbJsonLd,
  buildRobotsRules,
  buildSitemapEntries,
  organizationJsonLd,
  publicPageMetadata,
  webSiteJsonLd,
} from "./seo";

const SITE_URL = "https://scandihaven.example";

describe("buildSitemapEntries (R4-3, PRD §11.1)", () => {
  const entries = buildSitemapEntries({
    siteUrl: SITE_URL,
    products: [
      { slug: "halden-linen-armchair", updatedAt: new Date("2026-09-01T10:00:00Z") },
      { slug: "oresund-table-lamp", updatedAt: new Date("2026-09-02T10:00:00Z") },
    ],
    categories: [{ slug: "lighting" }, { slug: "furniture" }],
    collections: [{ slug: "slow-living" }],
    journal: [
      { slug: "the-slow-chair", category: "craft", updatedAt: new Date("2026-09-03T10:00:00Z") },
    ],
  });

  it("emits static + catalog entries with absolute URLs", () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/`);
    expect(urls).toContain(`${SITE_URL}/shop`);
    expect(urls).toContain(`${SITE_URL}/collections`);
    expect(urls).toContain(`${SITE_URL}/journal`);
    expect(urls).toContain(`${SITE_URL}/shop/lighting`);
    expect(urls).toContain(`${SITE_URL}/products/oresund-table-lamp`);
    expect(urls).toContain(`${SITE_URL}/collections/slow-living`);
  });

  it("excludes cart, checkout, account, search, admin, and API surfaces", () => {
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => /\/(cart|checkout|account|search|admin|api|sign-in)/.test(u))).toBe(
      false,
    );
  });

  it("carries lastModified from product updated_at and daily changeFrequency", () => {
    const product = entries.find((e) => e.url.endsWith("/products/halden-linen-armchair"));
    expect(product?.lastModified).toEqual(new Date("2026-09-01T10:00:00Z"));
    expect(product?.changeFrequency).toBe("daily");
    expect(product?.priority).toBe(1);
    // static and category pages rank below products but still daily per §11.1
    const category = entries.find((e) => e.url.endsWith("/shop/lighting"));
    expect(category?.changeFrequency).toBe("daily");
    expect((category?.priority ?? 0)).toBeLessThan(product?.priority ?? 1);
  });

  it("emits journal article URLs with their category segment (R7-2, FR-703)", () => {
    const journalEntry = entries.find((e) => e.url === `${SITE_URL}/journal/craft/the-slow-chair`);
    expect(journalEntry).toBeDefined();
    expect(journalEntry?.lastModified).toEqual(new Date("2026-09-03T10:00:00Z"));
    expect(journalEntry?.changeFrequency).toBe("daily");
    // Articles sit below category PLPs (0.4) — editorial content, not catalog
    expect(journalEntry?.priority).toBe(0.4);
  });
});

describe("buildRobotsRules (R4-4, PRD §11.1)", () => {
  const rules = buildRobotsRules(SITE_URL);
  const rulesArr = Array.isArray(rules.rules) ? rules.rules : [rules.rules];

  it("disallows the private surfaces for all agents", () => {
    const all = rulesArr.find((r) => (r.userAgent ?? []).includes("*"));
    expect(all?.disallow).toEqual(
      expect.arrayContaining(["/admin", "/account", "/cart", "/checkout", "/search", "/api"]),
    );
  });

  it("references the sitemap with an absolute URL", () => {
    expect(rules.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("never disallows everything for *", () => {
    const all = rulesArr.find((r) => (r.userAgent ?? []).includes("*"));
    expect(all?.disallow).not.toContain("/");
  });
});

describe("organizationJsonLd / webSiteJsonLd (R4-8, PRD §11.1)", () => {
  it("emits an Organization with the absolute site URL", () => {
    const org = organizationJsonLd(SITE_URL);
    expect(org["@type"]).toBe("Organization");
    expect(org.url).toBe(SITE_URL);
    expect(org.name).toBe("Scandi Haven");
  });

  it("emits a WebSite with a SearchAction pointing at /search (FR-106)", () => {
    const site = webSiteJsonLd(SITE_URL);
    expect(site["@type"]).toBe("WebSite");
    expect(site.url).toBe(SITE_URL);
    const action = site.potentialAction as {
      "@type": string;
      target: { "@type": string; urlTemplate: string };
      "query-input": string;
    };
    expect(action["@type"]).toBe("SearchAction");
    expect(action.target.urlTemplate).toBe(`${SITE_URL}/search?q={search_term_string}`);
    expect(action["query-input"]).toContain("search_term_string");
  });
});

describe("breadcrumbJsonLd (R4-8, FR-312/FR-313)", () => {
  it("emits an ordered BreadcrumbList with absolute URLs", () => {
    const crumbs = breadcrumbJsonLd(SITE_URL, [
      { name: "Home", path: "/" },
      { name: "Shop", path: "/shop" },
      { name: "Lighting", path: "/shop/lighting" },
      { name: "Øresund Table Lamp", path: "/products/oresund-table-lamp" },
    ]);
    expect(crumbs["@type"]).toBe("BreadcrumbList");
    const items = crumbs.itemListElement as Array<{
      "@type": string;
      position: number;
      name: string;
      item: string;
    }>;
    expect(items).toHaveLength(4);
    expect(items[0]?.position).toBe(1);
    expect(items[0]?.item).toBe(`${SITE_URL}/`);
    expect(items[3]?.name).toBe("Øresund Table Lamp");
    expect(items[3]?.item).toBe(`${SITE_URL}/products/oresund-table-lamp`);
  });
});

describe("publicPageMetadata (round 5, R5-2, FR-313)", () => {
  it("declares the canonical path and a COMPLETE per-page openGraph object", () => {
    // Next replaces a segment's openGraph object wholesale — a page that
    // only sets og:url would drop the layout's og:title/description/siteName.
    // The builder therefore emits the full object, centralized here.
    const meta = publicPageMetadata({ path: "/shop", title: "Shop all" });
    expect(meta.alternates).toEqual({ canonical: "/shop" });
    const og = meta.openGraph as Record<string, unknown>;
    expect(og.url).toBe("/shop");
    expect(og.title).toBe("Shop all");
    expect(og.siteName).toBe("Scandi Haven");
    expect(og.type).toBe("website");
    expect(og.description).toBeTruthy();
  });

  it("falls back to the sitewide default title/description when not provided", () => {
    const meta = publicPageMetadata({ path: "/" });
    const og = meta.openGraph as Record<string, unknown>;
    expect(og.url).toBe("/");
    expect(og.title).toBe("Scandi Haven — Slow Living, Beautifully Made");
    expect(meta.title).toBe("Scandi Haven — Slow Living, Beautifully Made");
    expect(meta.description).toBeTruthy();
    expect(og.description).toBeTruthy();
  });

  it("carries per-page titles through both title fields and the og block", () => {
    const meta = publicPageMetadata({ path: "/journal", title: "Journal", description: "Stories from the workshop." });
    expect(meta.title).toBe("Journal");
    expect(meta.description).toBe("Stories from the workshop.");
    const og = meta.openGraph as Record<string, unknown>;
    expect(og.title).toBe("Journal");
    expect(og.description).toBe("Stories from the workshop.");
  });
});

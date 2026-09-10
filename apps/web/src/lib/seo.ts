import type { MetadataRoute } from "next";
import type { Metadata } from "next";

/**
 * SEO builders (live E2E audit 2026-09-10 round 4, R4-3/R4-4/R4-7/R4-8;
 * PRD §11.1, FR-312/FR-313). Pure functions feeding `app/sitemap.ts`,
 * `app/robots.ts`, and the sitewide structured-data blocks — kept pure so
 * the entry rules (exclusions, priorities, JSON-LD shapes) are pinned by
 * unit tests without a server or database.
 */

/** Sitewide default og/twitter copy (round 4, R4-7; shared with the layout). */
export const SITE_NAME = "Scandi Haven";
export const DEFAULT_TITLE = "Scandi Haven — Slow Living, Beautifully Made";
export const DEFAULT_DESCRIPTION =
  "Scandi Haven crafts understated furniture, lighting and textiles for the slow-living home. Sustainably made in Northern Europe.";

export interface PublicPageMetadataInput {
  /** Canonical path of THIS page, e.g. "/shop" or "/shop/lighting". */
  path: string;
  title?: string;
  description?: string;
}

/**
 * Per-page canonical + openGraph for public surfaces (round 5, R5-2, FR-313).
 *
 * Next's metadata merge REPLACES a segment's `openGraph` object wholesale, so
 * a page that set only `openGraph: { url }` would silently drop the layout's
 * og:title/description/siteName. This builder emits the complete object and
 * keeps the canonical/og:url pair in lockstep; relative paths resolve against
 * the root layout's request-scoped `metadataBase` (`currentSiteUrl()`).
 */
export function publicPageMetadata({ path, title, description }: PublicPageMetadataInput): Metadata {
  const resolvedTitle = title ?? DEFAULT_TITLE;
  const resolvedDescription = description ?? DEFAULT_DESCRIPTION;
  return {
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: { canonical: path },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      type: "website",
      url: path,
      siteName: SITE_NAME,
    },
  };
}

export interface SitemapCatalogInput {
  siteUrl: string;
  products: { slug: string; updatedAt: Date }[];
  categories: { slug: string }[];
  collections: { slug: string }[];
}

/**
 * Sitemap entries (PRD §11.1): static pages, category PLPs, collection
 * pages, and product PDPs — products weighted highest, everything daily.
 * Cart/checkout/account/search/admin/API surfaces are excluded by
 * construction (never listed here).
 */
export function buildSitemapEntries(input: SitemapCatalogInput): MetadataRoute.Sitemap {
  const { siteUrl, products, categories, collections } = input;
  const base = siteUrl.replace(/\/$/, "");

  return [
    ...[
      { url: `${base}/`, priority: 0.8 },
      { url: `${base}/shop`, priority: 0.7 },
      { url: `${base}/collections`, priority: 0.6 },
      { url: `${base}/journal`, priority: 0.5 },
    ].map((entry) => ({
      ...entry,
      changeFrequency: "daily" as const,
    })),
    ...categories.map((category) => ({
      url: `${base}/shop/${category.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...collections.map((collection) => ({
      url: `${base}/collections/${collection.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
    ...products.map((product) => ({
      url: `${base}/products/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "daily" as const,
      priority: 1,
    })),
  ];
}

/**
 * robots.txt rules (PRD §11.1): private surfaces disallowed for all agents,
 * sitemap referenced with an absolute URL.
 */
export function buildRobotsRules(siteUrl: string): MetadataRoute.Robots {
  const base = siteUrl.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        disallow: ["/admin", "/account", "/cart", "/checkout", "/search", "/api"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

/** Sitewide `Organization` JSON-LD (PRD §11.1). */
export function organizationJsonLd(siteUrl: string) {
  const base = siteUrl.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Scandi Haven",
    url: base,
    description:
      "Scandi Haven crafts understated furniture, lighting and textiles for the slow-living home. Sustainably made in Northern Europe.",
  };
}

/** Sitewide `WebSite` JSON-LD with a SearchAction against `/search` (FR-106). */
export function webSiteJsonLd(siteUrl: string) {
  const base = siteUrl.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Scandi Haven",
    url: base,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${base}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

/** `BreadcrumbList` JSON-LD for PLP/PDP trails (PRD §11.1, FR-312). */
export function breadcrumbJsonLd(siteUrl: string, trail: BreadcrumbItem[]) {
  const base = siteUrl.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${base}${crumb.path === "/" ? "/" : crumb.path}`,
    })),
  };
}

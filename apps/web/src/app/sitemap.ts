import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { listSitemapEntries } from "@scandihaven/commerce/catalog";
import { resolveSiteUrl } from "@scandihaven/config/site-url";
import { buildSitemapEntries } from "@/lib/seo";

/**
 * Sitemap (PRD §11.1; live E2E audit 2026-09-10 round 4, R4-3): products,
 * category PLPs, collections, journal, and static pages — daily, products
 * weighted highest. Cart/checkout/account/search/admin/API are excluded by
 * construction (see `buildSitemapEntries`).
 *
 * The site origin is resolved per request: `NEXT_PUBLIC_SITE_URL` when it is
 * set and non-localhost, otherwise the origin this request was served on
 * (proxy-controlled headers — same trust model as the auth seam). This keeps
 * `sitemap.xml` absolute URLs correct on deployments where the env var is
 * still unset (the E2E-8 boot warning keeps nagging for the env fix).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [entries, headerList] = await Promise.all([
    listSitemapEntries().catch((error: unknown) => {
      console.error("[sitemap] catalog load failed", error);
      return { products: [], categories: [], collections: [] };
    }),
    headers(),
  ]);
  const siteUrl = resolveSiteUrl({
    siteUrlEnv: process.env.NEXT_PUBLIC_SITE_URL,
    headers: headerList,
  });
  return buildSitemapEntries({ siteUrl, ...entries });
}

import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { resolveSiteUrl } from "@scandihaven/config/site-url";
import { buildRobotsRules } from "@/lib/seo";

/**
 * robots.txt (PRD §11.1; live E2E audit 2026-09-10 round 4, R4-4): private
 * surfaces (`/admin`, `/account`, `/cart`, `/checkout`, `/search`, `/api`)
 * are disallowed for all agents and the sitemap is referenced absolutely.
 *
 * The absolute sitemap URL is resolved per request (env var when configured,
 * otherwise the served origin) — same resolution as `sitemap.ts` so the
 * reference can never point at a different origin than the sitemap itself.
 *
 * NOTE (ops): Cloudflare "Managed Robots" (content signals) rewrites the
 * served robots.txt when the zone feature is enabled, hiding these rules
 * behind the CF-managed body. Merge the `Sitemap:` line into the CF ruleset
 * (or disable the override) so crawlers keep finding the sitemap.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerList = await headers();
  const siteUrl = resolveSiteUrl({
    siteUrlEnv: process.env.NEXT_PUBLIC_SITE_URL,
    headers: headerList,
  });
  return buildRobotsRules(siteUrl);
}

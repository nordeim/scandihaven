import { headers } from "next/headers";
import { resolveSiteUrl } from "@scandihaven/config/site-url";

/**
 * Request-scoped absolute site origin for canonical/OG URLs and structured
 * data (live E2E audit 2026-09-10 round 4, R4-6; FR-313).
 *
 * `NEXT_PUBLIC_SITE_URL` (when set to a real, non-localhost origin) wins;
 * otherwise the origin this request was served on is derived from
 * proxy-controlled headers — see `resolveSiteUrl` in `@scandihaven/config`
 * for the trust model. Storefront routes are request-dynamic (the root
 * layout reads the cart cookie), so `headers()` adds no new dynamic surface.
 */
export async function currentSiteUrl(): Promise<string> {
  const headerList = await headers();
  return resolveSiteUrl({
    siteUrlEnv: process.env.NEXT_PUBLIC_SITE_URL,
    headers: headerList,
  });
}

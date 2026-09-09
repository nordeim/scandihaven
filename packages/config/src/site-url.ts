/**
 * Production site-URL boot guard (live E2E audit 2026-09-10, E2E-8).
 *
 * `metadataBase` in each app's root layout falls back to
 * `http://localhost:3000` when NEXT_PUBLIC_SITE_URL is unset, which made the
 * deployed site emit canonical/OG URLs pointing at localhost — actively
 * harmful to SEO (FR-313) and social previews. The deployment contract
 * predates the guard, so this WARNS with an actionable message instead of
 * failing the boot; the fix is one env var on the deployment.
 */
const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\]|::1)(:|$)/i;

/**
 * Returns the warning text when a production boot would silently serve
 * localhost-derived absolute URLs, or null when the configuration is fine
 * (or the boot is not production).
 */
export function productionSiteUrlWarning(
  siteUrl: string | undefined,
  nodeEnv: string | undefined,
): string | null {
  if (nodeEnv !== "production") return null;

  if (!siteUrl) {
    return (
      "[boot] NEXT_PUBLIC_SITE_URL is not set in production — canonical/OG URLs " +
      "will resolve against http://localhost:3000 and harm SEO. Set it to the " +
      "public origin (e.g. https://scandihaven.example.com) and redeploy."
    );
  }
  try {
    const host = new URL(siteUrl).hostname;
    if (LOCAL_HOSTS.test(host)) {
      return (
        `[boot] NEXT_PUBLIC_SITE_URL is a localhost origin (${siteUrl}) in production — ` +
        "canonical/OG URLs will resolve against it and harm SEO. Set it to the " +
        "public origin and redeploy."
      );
    }
  } catch {
    return (
      `[boot] NEXT_PUBLIC_SITE_URL is not a valid URL (${siteUrl}) — canonical/OG ` +
      "URLs will fall back to http://localhost:3000. Set it to the public origin."
    );
  }
  return null;
}

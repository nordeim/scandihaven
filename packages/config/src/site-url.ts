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

/**
 * Request-scoped site-URL resolution (live E2E audit 2026-09-10 round 4,
 * R4-6 / E2E-8 residual).
 *
 * The deployed site served canonical + OG URLs pointing at
 * `http://localhost:3000` because `NEXT_PUBLIC_SITE_URL` was unset and the
 * `metadataBase` fallback is a static localhost string. The env var remains
 * the correct production fix (the boot warning above nags until it is set);
 * this resolver is defense-in-depth for the canonical/OG contract: when the
 * env var is unset/localhost/garbage, the origin the request was actually
 * served on (derived from the same proxy-controlled headers Better-Auth
 * trusts — never `Origin`/`Referer`) is used instead, so absolute canonical
 * URLs are correct even on a misconfigured deployment.
 *
 * Canonicalized by `packages/auth/src/trusted-origins.ts` re-exporting
 * `requestOriginFromHeaders` from here — one derivation, two consumers,
 * no drift.
 */

/** Structural subset of `Headers` so tests can pass plain Maps. */
export interface SiteUrlHeaders {
  get(name: string): string | null | undefined;
}

const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|::1|\[::1\])(:\d+)?$/i;

/** First token of a comma-separated proxy chain (e.g. "https,http"), trimmed. */
function firstToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const token = value.split(",")[0]?.trim();
  return token ? token : null;
}

/**
 * Derive `scheme://host[:port]` for the origin this request was served on,
 * or null when the request carries no host information. Only
 * proxy-controlled headers are read (`x-forwarded-host`, `host`,
 * `x-forwarded-proto`) — `Origin`/`Referer` are attacker-controlled and
 * deliberately ignored (same trust model as the auth trusted-origins seam).
 */
export function requestOriginFromHeaders(
  headers: SiteUrlHeaders | null | undefined,
): string | null {
  if (!headers) return null;
  const host = firstToken(headers.get("x-forwarded-host")) ?? firstToken(headers.get("host"));
  if (!host) return null;
  const forwardedProto = firstToken(headers.get("x-forwarded-proto"));
  const proto = forwardedProto ?? (LOOPBACK_HOST.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/** Inputs for `resolveSiteUrl` — env value plus a structural `Headers`. */
export interface ResolveSiteUrlInput {
  siteUrlEnv: string | undefined;
  headers: SiteUrlHeaders | null | undefined;
}

const LOCALHOST_FALLBACK = "http://localhost:3000";

/**
 * Absolute site origin for canonical/OG URLs: a valid non-localhost
 * `NEXT_PUBLIC_SITE_URL` wins; otherwise the request-served origin; finally
 * the localhost fallback. Trailing slashes are normalized away.
 */
export function resolveSiteUrl({ siteUrlEnv, headers }: ResolveSiteUrlInput): string {
  if (siteUrlEnv) {
    try {
      const url = new URL(siteUrlEnv);
      if (!LOOPBACK_HOST.test(url.host)) {
        return url.origin;
      }
    } catch {
      // fall through to the request-derived origin
    }
  }
  return requestOriginFromHeaders(headers) ?? LOCALHOST_FALLBACK;
}

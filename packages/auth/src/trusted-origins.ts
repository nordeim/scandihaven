/**
 * Served-origin derivation for Better-Auth `trustedOrigins` (audit
 * 2026-09-09 H-AUTH).
 *
 * Why this exists: the auth instance used to pin its trusted origin to
 * `BETTER_AUTH_URL` (localhost fallback), so sign-in POSTs from the deployed
 * origin failed `INVALID_ORIGIN` as soon as any cookie rode along (the cart
 * cookie is set long before sign-in). Better-Auth accepts a per-request
 * `trustedOrigins` function; this module supplies the origin the request was
 * actually served on.
 *
 * Security: only proxy-controlled headers (`x-forwarded-host`, `host`,
 * `x-forwarded-proto`) are read. `Origin`/`Referer` are attacker-controlled
 * and are deliberately ignored — a cross-site browser request keeps its own
 * Origin while carrying our Host, so the CSRF check stays intact. Browsers
 * never send `x-forwarded-host`, and non-browser clients hold no victim
 * credentials, so trusting the serving host does not open a CSRF path.
 */

/** Structural subset of `Headers` so tests can pass plain objects. */
export interface OriginHeaders {
  get(name: string): string | null | undefined;
}

const LOOPBACK_HOST_PATTERN = /^(localhost|127\.0\.0\.1|::1|\[::1\])(:\d+)?$/i;

/** First token of a comma-separated proxy chain (e.g. "https,http"), trimmed. */
function firstToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const token = value.split(",")[0]?.trim();
  return token ? token : null;
}

/**
 * Derive `scheme://host[:port]` for the origin this request was served on,
 * or null when the request carries no host information (e.g. direct
 * `auth.api` calls, which better-auth handles via its own fallbacks).
 */
export function requestOriginFromHeaders(
  headers: OriginHeaders | null | undefined,
): string | null {
  if (!headers) return null;
  const host = firstToken(headers.get("x-forwarded-host")) ?? firstToken(headers.get("host"));
  if (!host) return null;
  const forwardedProto = firstToken(headers.get("x-forwarded-proto"));
  const proto = forwardedProto ?? (LOOPBACK_HOST_PATTERN.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

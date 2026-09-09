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
 *
 * Since 2026-09-10 (round 4, R4-6) the derivation lives canonically in
 * `@scandihaven/config/site-url` (same proxy-controlled header set) so the
 * auth trusted-origins and the storefront canonical/OG URL resolution can
 * never drift apart; this module re-exports it unchanged.
 */

export { requestOriginFromHeaders } from "@scandihaven/config/site-url";

/** Kept for API stability: the structural `Headers` subset the derivation reads. */
export type { SiteUrlHeaders as OriginHeaders } from "@scandihaven/config/site-url";

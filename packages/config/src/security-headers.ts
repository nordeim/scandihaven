/** Central security header manifest (PRD §9.3) — single source, testable. */

export type HeaderMap = Record<string, string>;

/**
 * The one manifest both apps' proxies apply (§9.3: "centrally in proxy.ts with
 * a unit-tested manifest"). CSP note: Next.js injects inline bootstrap
 * scripts, so `unsafe-inline` stands until strict nonce CSP lands in Phase 1
 * hardening — the remainder of the policy is already restrictive.
 */
export function securityHeaders(): HeaderMap {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Content-Security-Policy": [
      "default-src 'self'",
      // Next.js injects inline bootstrap scripts; strict nonce CSP lands in Phase 1 hardening.
      // https://static.cloudflareinsights.com: both live origins sit behind Cloudflare,
      // which injects its RUM beacon — blocking it logged a violation on every
      // production pageview (live E2E audit 2026-09-10, E2E-7).
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://static.cloudflareinsights.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "connect-src 'self' https://api.stripe.com https://cloudflareinsights.com",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  };
}

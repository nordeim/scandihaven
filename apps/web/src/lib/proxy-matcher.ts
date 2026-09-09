/**
 * Web proxy matcher (PRD §4.4, §9.3): security headers + request ID on every
 * response. Extracted as a pure predicate so the exclusion semantics are
 * unit-testable (audit 2026-09-09 H-1: the bare `products` exclusion token
 * silently stripped headers from the /products/[slug] PDP route — only the
 * static SVG assets under public/products/ were meant to be exempt).
 */

/** The Next.js matcher string consumed by `proxy.ts` `config`. */
export const WEB_PROXY_MATCHER = "/((?!_next/static|_next/image|favicon.ico|products/[^/]*\\.svg).*)";

/**
 * Mirror of WEB_PROXY_MATCHER for tests: true when the proxy should run
 * (i.e. security headers are applied) for this request path.
 */
export function shouldProxy(pathname: string): boolean {
  return new RegExp(`^${WEB_PROXY_MATCHER}$`).test(pathname);
}

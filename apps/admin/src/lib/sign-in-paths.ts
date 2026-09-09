/**
 * Sign-in path predicate for the admin gate (live E2E audit 2026-09-09
 * round 2, H2-ADMIN). The deployment serves the admin app behind host-based
 * routing where the canonical URL carries an `/admin` path prefix; the app
 * itself has no `/admin` routes. The gate must let both sign-in spellings
 * through so anonymous visitors always reach the credential page, while every
 * other surface stays gated. next.config's beforeFiles rewrites strip the
 * `/admin` prefix for the authenticated surfaces.
 */
export function isSignInPath(pathname: string): boolean {
  return pathname === "/sign-in" || pathname === "/admin/sign-in";
}

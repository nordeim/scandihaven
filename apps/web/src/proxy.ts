import { NextResponse, type NextRequest } from "next/server";
import { securityHeaders } from "@scandihaven/config/security-headers";

/**
 * proxy.ts replaces middleware.ts in Next.js 16 (PRD §4.4).
 * Phase 0 scope: security headers on every response. Locale negotiation and
 * the admin-managed 301 redirect table land in Phase 1 (PRD §13.6) — they are
 * DB-backed and this stub keeps the runtime Node with zero hot-path queries.
 *
 * The matcher MUST stay an inline literal: Next.js statically parses the
 * exported `config` and rejects imported constants. Its semantics are pinned
 * by `src/lib/proxy-matcher.ts` + `proxy-matcher.test.ts` (audit 2026-09-09
 * H-1: a bare `products` token here used to strip security headers from
 * every PDP; only the static `products/*.svg` assets are exempt).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const responseHeaders = new Headers(request.headers);
  const requestId = crypto.randomUUID();
  responseHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({ request: { headers: responseHeaders } });
  for (const [key, value] of Object.entries(securityHeaders())) {
    response.headers.set(key, value);
  }
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|products/[^/]*\\.svg).*)"],
};

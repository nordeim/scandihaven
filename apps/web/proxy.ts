import { NextResponse, type NextRequest } from "next/server";
import { securityHeaders } from "@/lib/security-headers";

/**
 * proxy.ts replaces middleware.ts in Next.js 16 (PRD §4.4).
 * Phase 0 scope: security headers on every response. Locale negotiation and
 * the admin-managed 301 redirect table land in Phase 1 (PRD §13.6) — they are
 * DB-backed and this stub keeps the runtime Node with zero hot-path queries.
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|products).*)"],
};

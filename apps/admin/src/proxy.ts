import { NextResponse, type NextRequest } from "next/server";
import { securityHeaders } from "@scandihaven/config/security-headers";

/**
 * Admin proxy (PRD §9.2): unauthenticated visitors bounce to /sign-in.
 * Fine-grained permission checks live in Server Actions via the RBAC matrix —
 * this gate is UX only (the control is server-side re-authorization).
 * Security headers come from the shared §9.3 manifest and apply to EVERY
 * admin route including /sign-in (a credential page must not go bare;
 * audit 2026-09-09 follow-up to H5d/LD-2).
 *
 * NOTE: this file lives at `src/proxy.ts` — Next 16.3 discovers the proxy
 * convention at the parent of the app directory (`src/` for src-dir apps).
 * The previous repo-root placement compiled but was never registered, so
 * neither the gate nor the §9.3 headers ran at all (audit 2026-09-09 H8d).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const applyHeaders = (response: NextResponse): NextResponse => {
    for (const [key, value] of Object.entries(securityHeaders())) {
      response.headers.set(key, value);
    }
    return response;
  };

  const sessionCookie =
    request.cookies.get("better-auth.session_token")?.value ??
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  if (!sessionCookie && request.nextUrl.pathname !== "/sign-in") {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("redirect", request.nextUrl.pathname);
    return applyHeaders(NextResponse.redirect(signIn));
  }

  return applyHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

import { NextResponse, type NextRequest } from "next/server";
import { securityHeaders } from "@scandihaven/config/security-headers";

/**
 * Admin proxy (PRD §9.2): unauthenticated visitors bounce to /sign-in.
 * Fine-grained permission checks live in Server Actions via the RBAC matrix —
 * this gate is UX only (the control is server-side re-authorization).
 * Security headers come from the shared §9.3 manifest, same as the storefront.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const sessionCookie =
    request.cookies.get("better-auth.session_token")?.value ??
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  if (!sessionCookie) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("redirect", request.nextUrl.pathname);
    const redirectResponse = NextResponse.redirect(signIn);
    for (const [key, value] of Object.entries(securityHeaders())) {
      redirectResponse.headers.set(key, value);
    }
    return redirectResponse;
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(securityHeaders())) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ["/((?!sign-in|api|_next/static|_next/image|favicon.ico).*)"],
};

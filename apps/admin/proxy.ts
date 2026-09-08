import { NextResponse, type NextRequest } from "next/server";

/**
 * Admin proxy (PRD §9.2): unauthenticated visitors bounce to /sign-in.
 * Fine-grained permission checks live in Server Actions via the RBAC matrix —
 * this gate is UX only (the control is server-side re-authorization).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const sessionCookie =
    request.cookies.get("better-auth.session_token")?.value ??
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  if (!sessionCookie) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!sign-in|api|_next/static|_next/image|favicon.ico).*)"],
};

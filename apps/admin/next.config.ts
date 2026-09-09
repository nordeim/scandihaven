import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@scandihaven/ui",
    "@scandihaven/commerce",
    "@scandihaven/db",
    "@scandihaven/auth",
    "@scandihaven/config",
  ],
  /**
   * `/admin` prefix strip (live E2E audit 2026-09-09 round 2, H2-ADMIN):
   * the deployment serves this app behind host-based routing where the
   * canonical URL carries an `/admin` path prefix (and the app receives
   * paths verbatim — no proxy-level stripping), while every app route lives
   * at the root. Without these rewrites the gate's own redirect target
   * (`/sign-in?redirect=%2Fadmin`) sent staff to a 404 after signing in.
   * beforeFiles runs after the proxy gate but before filesystem/dynamic
   * route matching, so `/admin` → dashboard, `/admin/<surface>` → surface,
   * and `/admin/api/health` → the health route — while `/sign-in` and
   * `/admin/sign-in` (allowed through the gate via isSignInPath) serve the
   * credential page directly.
   */
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/admin", destination: "/" },
        { source: "/admin/:path*", destination: "/:path*" },
      ],
    };
  },
};

export default nextConfig;

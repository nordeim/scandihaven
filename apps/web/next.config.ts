import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal TS packages are compiled from source (Turborepo internal-package pattern).
  transpilePackages: [
    "@scandihaven/ui",
    "@scandihaven/commerce",
    "@scandihaven/db",
    "@scandihaven/auth",
    "@scandihaven/email",
    "@scandihaven/config",
  ],
  images: {
    // Seeded placeholder art is our own static SVG (trusted origin).
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // The sharp-based optimizer can deadlock in constrained sandboxes under
    // concurrent raster loads. DISABLE_IMAGE_OPTIMIZER=1 (local dev / E2E)
    // serves sources directly; production defaults to the optimizing pipeline
    // (PRD §10.5 image budgets remain a Phase 2 CDN concern).
    unoptimized: process.env.DISABLE_IMAGE_OPTIMIZER === "1",
  },
};

export default nextConfig;

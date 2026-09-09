import { describe, it, expect } from "vitest";
import nextConfig from "../next.config";

/**
 * Live E2E audit 2026-09-09 round 2 (H2-ADMIN): the deployment's canonical
 * admin URL carries an `/admin` path prefix, but the app's routes live at the
 * root. The rewrite contract strips that prefix so post-sign-in navigation to
 * `/admin` lands on the dashboard instead of a 404, and `/admin/<surface>`
 * serves the matching back-office page. Mirrors the web app's
 * proxy-matcher test style of pinning routing contracts in tests.
 */
describe("admin next.config rewrites", () => {
  type Rewrite = { source: string; destination: string };

  const rewrites = async () =>
    (nextConfig.rewrites as () => Promise<{ beforeFiles: Rewrite[] }>)();

  it("exposes beforeFiles rewrites for the /admin prefix", async () => {
    const { beforeFiles } = await rewrites();
    expect(Array.isArray(beforeFiles)).toBe(true);
    expect(beforeFiles).toHaveLength(2);
  });

  it("maps the bare /admin prefix onto the dashboard", async () => {
    const { beforeFiles } = await rewrites();
    expect(beforeFiles).toContainEqual({ source: "/admin", destination: "/" });
  });

  it("strips the /admin prefix for nested paths", async () => {
    const { beforeFiles } = await rewrites();
    expect(beforeFiles).toContainEqual({
      source: "/admin/:path*",
      destination: "/:path*",
    });
  });
});

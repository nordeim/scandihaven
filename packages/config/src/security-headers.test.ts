import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

describe("security headers manifest (PRD §9.3)", () => {
  it("sets the required baseline headers", () => {
    const headers = securityHeaders();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
  });

  it("CSP allows Stripe but no objects", () => {
    const csp = securityHeaders()["Content-Security-Policy"];
    expect(csp).toContain("https://js.stripe.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("CSP allow-lists the edge-injected Cloudflare Insights beacon (E2E-7)", () => {
    const csp = securityHeaders()["Content-Security-Policy"];
    // Both live origins sit behind Cloudflare, which injects its RUM beacon
    // script and posts metrics back — a policy without these entries logs a
    // violation on every production pageview (verified live 2026-09-10).
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://js.stripe.com https://static.cloudflareinsights.com");
    expect(csp).toContain("connect-src 'self' https://api.stripe.com https://cloudflareinsights.com");
  });

  it("permissions policy locks down sensitive capabilities", () => {
    expect(securityHeaders()["Permissions-Policy"]).toContain("camera=()");
    expect(securityHeaders()["Permissions-Policy"]).toContain("microphone=()");
  });
});

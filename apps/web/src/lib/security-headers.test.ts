import { describe, expect, it } from "vitest";
import { securityHeaders } from "@/lib/security-headers";

describe("security headers manifest (PRD §9.3)", () => {
  it("sets the required baseline headers", () => {
    const headers = securityHeaders();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Strict-Transport-Security"]).toContain("max-age=63072000");
  });

  it("CSP allows Stripe but no objects", () => {
    const csp = securityHeaders()["Content-Security-Policy"];
    expect(csp).toContain("https://js.stripe.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });
});

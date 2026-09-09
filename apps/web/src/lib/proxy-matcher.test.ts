import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WEB_PROXY_MATCHER, shouldProxy } from "./proxy-matcher";

/**
 * Contract (audit 2026-09-09 H-1): the proxy applies the §9.3 security-header
 * manifest to every storefront route EXCEPT build assets — and the asset
 * exemption must NOT swallow the /products/[slug] PDP route (the bare
 * `products` exclusion token did exactly that, leaving PDPs without
 * CSP/HSTS/nosniff/XFO/Referrer-Policy).
 *
 * Next.js statically parses `proxy.ts`'s exported `config`, so the matcher
 * literal must live inline there; this suite pins the helper semantics AND
 * asserts the inline literal has not drifted from the tested pattern.
 */

const PROXY_SOURCE = readFileSync(join(__dirname, "../proxy.ts"), "utf8");

describe("web proxy matcher (audit H-1)", () => {
  it("keeps proxy.ts matcher in sync with the tested pattern", () => {
    // The source literal escapes backslashes; the runtime string does not.
    const asSourceLiteral = WEB_PROXY_MATCHER.replace(/\\/g, "\\\\");
    expect(PROXY_SOURCE).toContain(`matcher: ["${asSourceLiteral}"]`);
  });

  it("proxies the PDP route (security headers apply)", () => {
    expect(shouldProxy("/products/oresund-table-lamp")).toBe(true);
  });

  it("proxies pages, server routes, and the shop PLP", () => {
    expect(shouldProxy("/")).toBe(true);
    expect(shouldProxy("/shop")).toBe(true);
    expect(shouldProxy("/shop/furniture")).toBe(true);
    expect(shouldProxy("/cart")).toBe(true);
    expect(shouldProxy("/checkout")).toBe(true);
    expect(shouldProxy("/api/health")).toBe(true);
    expect(shouldProxy("/collections/autumn-collection")).toBe(true);
  });

  it("excludes Next build assets and favicon only", () => {
    expect(shouldProxy("/_next/static/chunks/main.js")).toBe(false);
    expect(shouldProxy("/_next/image?url=x&w=64")).toBe(false);
    expect(shouldProxy("/favicon.ico")).toBe(false);
  });

  it("excludes the static product SVG assets but keeps PDP paths", () => {
    expect(shouldProxy("/products/halden-armchair.svg")).toBe(false);
    expect(shouldProxy("/products/oresund-table-lamp.svg")).toBe(false);
    // Note: a `.svg` segment excludes any deeper suffix too (negative
    // lookaheads prefix-match) — acceptable, `products/<x>.svg/**` is not a
    // route; the load-bearing case is that real PDP slugs stay proxied.
    expect(shouldProxy("/products/halden-armchair.svg/extra")).toBe(false);
  });

  it("exports the same semantics as the Next.js matcher string", () => {
    // The matcher string consumed by proxy.ts config must equal the tested
    // pattern so tests cannot drift from what Next actually runs.
    expect(WEB_PROXY_MATCHER).toContain("products/[^/]*\\.svg");
    expect(shouldProxy("/products/x.svg")).toBe(false);
    expect(shouldProxy("/products/x")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { validateRedirectPath } from "./redirect-path";

/**
 * Same-origin redirect validation (live E2E audit 2026-09-10, E2E-5).
 * The storefront sign-in previously ignored `?redirect=` entirely (customers
 * lost their return path) and the admin pushed the raw value into
 * `router.push()` — an open redirect. Both apps now share this validator.
 */
describe("validateRedirectPath (E2E-5)", () => {
  it("accepts in-app absolute paths", () => {
    expect(validateRedirectPath("/account")).toEqual({ ok: true, path: "/account" });
    expect(validateRedirectPath("/shop?sort=price_asc")).toEqual({
      ok: true,
      path: "/shop?sort=price_asc",
    });
    expect(validateRedirectPath("/admin/orders/123")).toEqual({
      ok: true,
      path: "/admin/orders/123",
    });
  });

  it("returns the safe default for empty/absent input", () => {
    expect(validateRedirectPath(null)).toEqual({ ok: true, path: "/account" });
    expect(validateRedirectPath(undefined)).toEqual({ ok: true, path: "/account" });
    expect(validateRedirectPath("")).toEqual({ ok: true, path: "/account" });
  });

  it("honours a caller-supplied fallback", () => {
    expect(validateRedirectPath(null, "/")).toEqual({ ok: true, path: "/" });
  });

  it("rejects absolute and scheme-relative URLs (open redirect)", () => {
    for (const evil of [
      "https://evil.example",
      "http://evil.example/path",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "data:text/html,<script>",
      "/redirect?url=https://evil.example&next=//evil.example",
    ]) {
      expect(validateRedirectPath(evil)).toEqual({ ok: false });
    }
  });

  it("rejects control characters and encoded separators", () => {
    expect(validateRedirectPath("/account\r\nLocation: //evil.example")).toEqual({ ok: false });
    expect(validateRedirectPath("/acc\tount")).toEqual({ ok: false });
  });
});

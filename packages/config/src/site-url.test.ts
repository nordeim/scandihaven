import { describe, expect, it } from "vitest";
import { productionSiteUrlWarning, requestOriginFromHeaders, resolveSiteUrl } from "./site-url";

/**
 * Boot guard (live E2E audit 2026-09-10, E2E-8): the live deployment was
 * serving canonical/OG URLs resolved against http://localhost:3000 because
 * NEXT_PUBLIC_SITE_URL was unset — actively harmful to SEO (FR-313). The
 * guard warns (not throws, to keep the existing deployment contract) whenever
 * a production boot would silently fall back to localhost.
 */
describe("productionSiteUrlWarning (E2E-8)", () => {
  it("warns when the URL is missing in production", () => {
    expect(productionSiteUrlWarning(undefined, "production")).toMatch(
      /NEXT_PUBLIC_SITE_URL/,
    );
    expect(productionSiteUrlWarning("", "production")).toMatch(/NEXT_PUBLIC_SITE_URL/);
  });

  it("warns when the URL is localhost in production", () => {
    expect(productionSiteUrlWarning("http://localhost:3000", "production")).toMatch(
      /http:\/\/localhost:3000/,
    );
    expect(productionSiteUrlWarning("http://127.0.0.1:3000", "production")).toMatch(
      /NEXT_PUBLIC_SITE_URL/,
    );
  });

  it("does not warn for a real origin", () => {
    expect(
      productionSiteUrlWarning("https://scandihaven.jesspete.shop", "production"),
    ).toBeNull();
  });

  it("does not warn outside production", () => {
    expect(productionSiteUrlWarning(undefined, "development")).toBeNull();
    expect(productionSiteUrlWarning("http://localhost:3000", "development")).toBeNull();
    expect(productionSiteUrlWarning(undefined, "test")).toBeNull();
  });
});

/**
 * Request-scoped site-URL resolution (live E2E audit 2026-09-10 round 4,
 * R4-6): canonical/OG URLs must resolve against the origin the request was
 * actually served on when NEXT_PUBLIC_SITE_URL is unset or localhost — the
 * live PDP emitted `http://localhost:3000/products/...` canonicals for half
 * a year of audits because the fallback never considered proxy headers.
 * Mirrors the auth trusted-origins derivation (same proxy-controlled header
 * set, same loopback proto heuristic), so the two can never drift apart.
 */
describe("requestOriginFromHeaders (R4-6)", () => {
  it("derives the origin from x-forwarded-host + x-forwarded-proto", () => {
    expect(
      requestOriginFromHeaders(
        headerMap({
          "x-forwarded-host": "scandihaven.jesspete.shop",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://scandihaven.jesspete.shop");
  });

  it("falls back to the host header when no proxy host is present", () => {
    expect(requestOriginFromHeaders(headerMap({ host: "127.0.0.1:3000" }))).toBe(
      "http://127.0.0.1:3000",
    );
  });

  it("uses http for loopback hosts without a forwarded proto", () => {
    expect(requestOriginFromHeaders(headerMap({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
  });

  it("uses the first token of comma-separated proxy chains", () => {
    expect(
      requestOriginFromHeaders(
        headerMap({ "x-forwarded-host": "a.example, b.example", "x-forwarded-proto": "https, http" }),
      ),
    ).toBe("https://a.example");
  });

  it("returns null when no host information exists", () => {
    expect(requestOriginFromHeaders(null)).toBeNull();
    expect(requestOriginFromHeaders(headerMap({}))).toBeNull();
  });
});

describe("resolveSiteUrl (R4-6)", () => {
  it("prefers a valid, non-localhost NEXT_PUBLIC_SITE_URL over headers", () => {
    expect(
      resolveSiteUrl({
        siteUrlEnv: "https://scandihaven.jesspete.shop",
        headers: headerMap({ host: "127.0.0.1:3000" }),
      }),
    ).toBe("https://scandihaven.jesspete.shop");
  });

  it("falls back to the request origin when the env URL is localhost", () => {
    expect(
      resolveSiteUrl({
        siteUrlEnv: "http://localhost:3000",
        headers: headerMap({
          "x-forwarded-host": "scandihaven.jesspete.shop",
          "x-forwarded-proto": "https",
        }),
      }),
    ).toBe("https://scandihaven.jesspete.shop");
  });

  it("falls back to the request origin when the env URL is unset", () => {
    expect(
      resolveSiteUrl({
        siteUrlEnv: undefined,
        headers: headerMap({ host: "127.0.0.1:3000" }),
      }),
    ).toBe("http://127.0.0.1:3000");
  });

  it("falls back to the request origin when the env URL is garbage", () => {
    expect(
      resolveSiteUrl({
        siteUrlEnv: "not a url",
        headers: headerMap({ "x-forwarded-host": "shop.example", "x-forwarded-proto": "https" }),
      }),
    ).toBe("https://shop.example");
  });

  it("falls back to the localhost default when nothing is derivable", () => {
    expect(resolveSiteUrl({ siteUrlEnv: undefined, headers: null })).toBe(
      "http://localhost:3000",
    );
  });

  it("normalizes a trailing slash off the env URL", () => {
    expect(
      resolveSiteUrl({ siteUrlEnv: "https://shop.example/", headers: null }),
    ).toBe("https://shop.example");
  });
});

function headerMap(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

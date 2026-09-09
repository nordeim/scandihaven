import { describe, expect, it } from "vitest";
import { productionSiteUrlWarning } from "./site-url";

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

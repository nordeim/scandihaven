import { describe, expect, it } from "vitest";

import { requestOriginFromHeaders } from "./trusted-origins";

/**
 * Pure seam for the auth instance's `trustedOrigins` request hook
 * (audit 2026-09-09 H-AUTH: live sign-in failed "Invalid origin" because the
 * trusted set was pinned to BETTER_AUTH_URL=localhost while browsers POSTed
 * from the deployed origin). The served origin is derived from
 * proxy-controlled headers ONLY — `Origin`/`Referer` are attacker-controlled
 * and must never widen the trusted set (CSRF).
 */
describe("requestOriginFromHeaders", () => {
  it("derives an https origin from the host header (direct TLS termination)", () => {
    expect(
      requestOriginFromHeaders(new Headers({ host: "scandihaven.jesspete.shop" })),
    ).toBe("https://scandihaven.jesspete.shop");
  });

  it("prefers x-forwarded-host over host when a proxy chain is present", () => {
    expect(
      requestOriginFromHeaders(
        new Headers({
          host: "internal-upstream.local",
          "x-forwarded-host": "scandihaven.jesspete.shop",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://scandihaven.jesspete.shop");
  });

  it("takes the first hop of comma-separated proxy headers", () => {
    expect(
      requestOriginFromHeaders(
        new Headers({
          "x-forwarded-host": "scandihaven.jesspete.shop, edge-2.internal",
          "x-forwarded-proto": "https,http",
        }),
      ),
    ).toBe("https://scandihaven.jesspete.shop");
  });

  it("keeps http for loopback hosts without proxy headers (local dev)", () => {
    expect(requestOriginFromHeaders(new Headers({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
    expect(requestOriginFromHeaders(new Headers({ host: "127.0.0.1:3000" }))).toBe(
      "http://127.0.0.1:3000",
    );
    expect(requestOriginFromHeaders(new Headers({ host: "[::1]:3000" }))).toBe(
      "http://[::1]:3000",
    );
  });

  it("returns null when no host header exists (direct auth.api calls)", () => {
    expect(requestOriginFromHeaders(new Headers())).toBeNull();
    expect(requestOriginFromHeaders(null)).toBeNull();
    expect(requestOriginFromHeaders(undefined)).toBeNull();
  });

  it("never derives an origin from attacker-controlled Origin/Referer headers", () => {
    expect(
      requestOriginFromHeaders(
        new Headers({
          host: "scandihaven.jesspete.shop",
          origin: "https://evil.example",
          referer: "https://evil.example/attack",
        }),
      ),
    ).toBe("https://scandihaven.jesspete.shop");
    expect(
      requestOriginFromHeaders(new Headers({ origin: "https://evil.example" })),
    ).toBeNull();
  });

  it("treats empty/whitespace proxy values as absent", () => {
    expect(
      requestOriginFromHeaders(new Headers({ "x-forwarded-host": "  ", host: "localhost:3000" })),
    ).toBe("http://localhost:3000");
    expect(requestOriginFromHeaders(new Headers({ "x-forwarded-proto": "" }))).toBeNull();
  });
});

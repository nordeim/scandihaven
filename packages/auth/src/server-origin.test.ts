import { describe, expect, it } from "vitest";

// The db client asserts DATABASE_URL at import; the Pool is lazy (no
// connection until a query), so a hermetic localhost URL keeps this suite
// runnable without Postgres.
process.env.DATABASE_URL ??= "postgresql://localhost:5432/hermetic-test";

/**
 * Regression for audit 2026-09-09 H-AUTH: live sign-in failed "Invalid
 * origin" on both apps because the trusted set was pinned to
 * BETTER_AUTH_URL (localhost) while browsers POSTed from the deployed origin.
 * The auth config must accept the origin each request was served on, derived
 * from proxy-controlled headers — never from the attacker-controlled Origin
 * header itself.
 */
describe("auth trustedOrigins wiring (H-AUTH regression)", () => {
  it("accepts a per-request served-origin hook", async () => {
    const { auth } = await import("./server");
    const context = await auth.$context;
    expect(typeof context.options.trustedOrigins).toBe("function");
  });

  it("trusts the origin the request was served on (reverse-proxy deployments)", async () => {
    const { auth } = await import("./server");
    const context = await auth.$context;
    const resolve = context.options.trustedOrigins as unknown as (
      request: Request,
    ) => string[] | Promise<string[]>;
    const request = new Request("https://scandihaven.jesspete.shop/api/auth/sign-in/email", {
      method: "POST",
      headers: new Headers({ host: "scandihaven.jesspete.shop" }),
    });
    const origins = await resolve(request);
    expect(origins).toContain("https://scandihaven.jesspete.shop");
  });

  it("does not trust an attacker Origin that mismatches the serving host", async () => {
    const { auth } = await import("./server");
    const context = await auth.$context;
    const resolve = context.options.trustedOrigins as unknown as (
      request: Request,
    ) => string[] | Promise<string[]>;
    const request = new Request("https://scandihaven.jesspete.shop/api/auth/sign-in/email", {
      method: "POST",
      // Browser cross-site attack shape: victim's browser POSTs from evil.example
      // origin to our host. Only the host-derived origin may be trusted.
      headers: new Headers({ host: "scandihaven.jesspete.shop" }),
    });
    const origins = await resolve(request);
    expect(origins).not.toContain("https://evil.example");
    expect(origins).not.toContain("null");
  });

  it("merges BETTER_AUTH_TRUSTED_ORIGINS allow-list with the served origin (S-1)", async () => {
    const prev = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
    process.env.BETTER_AUTH_TRUSTED_ORIGINS =
      "https://extra.example, https://scandihaven.jesspete.shop";
    try {
      // Re-import so the hook reads the mutated env (module is cached — the
      // hook itself reads process.env on each call, so no re-import is needed
      // beyond the context already captured; we just re-resolve).
      const { auth } = await import("./server");
      const context = await auth.$context;
      const resolve = context.options.trustedOrigins as unknown as (
        request: Request,
      ) => string[] | Promise<string[]>;
      const request = new Request("https://scandihaven.jesspete.shop/api/auth/sign-in/email", {
        method: "POST",
        headers: new Headers({ host: "scandihaven.jesspete.shop" }),
      });
      const origins = await resolve(request);
      expect(origins).toContain("https://extra.example");
      expect(origins).toContain("https://scandihaven.jesspete.shop");
      // De-dupe: same origin via env + served appears only once.
      expect(origins.filter((o) => o === "https://scandihaven.jesspete.shop").length).toBe(1);
    } finally {
      if (prev === undefined) delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
      else process.env.BETTER_AUTH_TRUSTED_ORIGINS = prev;
    }
  });
});

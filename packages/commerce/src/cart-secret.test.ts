import { afterAll, describe, expect, it, vi } from "vitest";

// The db client asserts DATABASE_URL at import; the Pool is lazy (no
// connection until a query), so a hermetic localhost URL keeps this suite
// runnable without Postgres.
process.env.DATABASE_URL ??= "postgresql://localhost:5432/hermetic-test";

const ORIGINAL_SECRET = process.env.BETTER_AUTH_SECRET;

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.BETTER_AUTH_SECRET;
  } else {
    process.env.BETTER_AUTH_SECRET = ORIGINAL_SECRET;
  }
  vi.unstubAllEnvs();
});

/**
 * Cart-cookie signing secret contract (PRD FR-403, CLAUDE.md env table):
 * BETTER_AUTH_SECRET is the cart HMAC key and MUST be ≥ 32 chars. There is no
 * insecure fallback — a missing/short secret fails fast at first use with an
 * actionable message instead of silently minting forgeable cart identities.
 * Each case resets the module registry because the secret is read per-call
 * (deliberately NOT snapshotted at import time).
 */
describe("cart token signing secret (FR-403)", () => {
  it("throws with an actionable message when BETTER_AUTH_SECRET is missing", async () => {
    delete process.env.BETTER_AUTH_SECRET;
    vi.resetModules();
    const { createCartToken } = await import("./cart-service");
    expect(() => createCartToken()).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => createCartToken()).toThrow(/openssl rand -base64 32/);
  });

  it("throws when the secret is shorter than 32 chars", async () => {
    process.env.BETTER_AUTH_SECRET = "short-secret";
    vi.resetModules();
    const { createCartToken } = await import("./cart-service");
    expect(() => createCartToken()).toThrow(/shorter than 32/);
  });

  it("signs and verifies tokens when a 32+ char secret is present", async () => {
    process.env.BETTER_AUTH_SECRET = "ci-only-secret-value-0123456789abcdef0123456789abcdef";
    vi.resetModules();
    const { createCartToken, verifyCartToken } = await import("./cart-service");
    const token = createCartToken();
    expect(token).toMatch(/^[0-9a-f]{48}\.[0-9a-f]{32}$/);
    expect(verifyCartToken(token)).toBe(token);
    const [, sig] = token.split(".");
    expect(verifyCartToken(`${"f".repeat(48)}.${sig}`)).toBeNull();
  });
});

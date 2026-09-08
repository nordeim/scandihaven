import { describe, expect, it } from "vitest";

// The db client asserts DATABASE_URL at import; the Pool is lazy (no
// connection until a query), so a hermetic localhost URL keeps this suite
// runnable without Postgres.
process.env.DATABASE_URL ??= "postgresql://localhost:5432/hermetic-test";

/**
 * Route-handler adapter contract (PRD §8.4 route whitelist entry
 * `/api/auth/[...all]`). Both apps mount Better-Auth through
 * `authRouteHandlers` from ./next-handler; this pins the shape that contract
 * needs — GET (session/OAuth callbacks) and POST (sign-in/sign-up) must both
 * resolve to functions derived from the auth instance.
 */
describe("Better-Auth route handler adapter (PRD §8.4)", () => {
  it("exposes GET and POST handlers wired to auth.handler", async () => {
    const { authRouteHandlers } = await import("./next-handler");
    expect(typeof authRouteHandlers.GET).toBe("function");
    expect(typeof authRouteHandlers.POST).toBe("function");
  });
});


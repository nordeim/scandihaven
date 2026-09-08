import { describe, expect, it } from "vitest";

// The db client asserts DATABASE_URL at import; the Pool is lazy (no
// connection until a query), so a hermetic localhost URL keeps this suite
// runnable without Postgres.
process.env.DATABASE_URL ??= "postgresql://localhost:5432/hermetic-test";

/**
 * Guard error → ActionResult envelope contract (PRD §8.2/§15.1): action
 * catch-blocks map expected failures onto the closed ErrorCode union and
 * never leak unexpected internals — authorization failures become FORBIDDEN,
 * stale optimistic writes become CONFLICT, machine transitions become
 * INVALID_TRANSITION, everything else returns null (caller logs + INTERNAL).
 */
describe("toActionError (admin guard envelope contract)", () => {
  it("maps ForbiddenError to FORBIDDEN (never a thrown cross-boundary error)", async () => {
    const { ForbiddenError, toActionError } = await import("./lib/admin-guard");
    const mapped = toActionError(new ForbiddenError("Role owner lacks orders:refund_small"));
    expect(mapped).toEqual({
      code: "FORBIDDEN",
      message: "Role owner lacks orders:refund_small",
    });
  });

  it("maps OrderActionError onto its own error code (NOT_FOUND / CONFLICT)", async () => {
    const { OrderActionError, toActionError } = await import("./lib/admin-guard");
    expect(toActionError(new OrderActionError("NOT_FOUND", "Order not found"))).toEqual({
      code: "NOT_FOUND",
      message: "Order not found",
    });
    expect(toActionError(new OrderActionError("CONFLICT", "stale form"))).toEqual({
      code: "CONFLICT",
      message: "stale form",
    });
  });

  it("maps InvalidOrderTransition to INVALID_TRANSITION", async () => {
    const { InvalidOrderTransition } = await import("@scandihaven/commerce/order-state");
    const { toActionError } = await import("./lib/admin-guard");
    const error = new InvalidOrderTransition("cancelled", "mark_shipped");
    const mapped = toActionError(error);
    expect(mapped?.code).toBe("INVALID_TRANSITION");
    expect(mapped?.message).toContain("cancelled");
  });

  it("returns null for unexpected errors so callers log and return INTERNAL", async () => {
    const { toActionError } = await import("./lib/admin-guard");
    expect(toActionError(new Error("database connection lost"))).toBeNull();
    expect(toActionError("string thrown")).toBeNull();
  });
});

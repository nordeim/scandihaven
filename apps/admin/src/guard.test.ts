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

describe("writeAudit executor seam (A-2, round 11)", () => {
  it("maps ProductActionError onto its own error code (NOT_FOUND / CONFLICT)", async () => {
    const { ProductActionError, toActionError } = await import("./lib/admin-guard");
    expect(toActionError(new ProductActionError("NOT_FOUND", "Product not found"))).toEqual({
      code: "NOT_FOUND",
      message: "Product not found",
    });
    expect(toActionError(new ProductActionError("CONFLICT", "stale form"))).toEqual({
      code: "CONFLICT",
      message: "stale form",
    });
  });

  it("accepts a transaction executor — the audit row commits WITH the audited change, and rolls back with it", async () => {
    // Pins the A-2 mechanism: writeAudit(input, tx) routes the insert
    // through the caller's open transaction. A rolled-back tx leaves NO
    // audit row (no phantom audit for state that never landed); a committed
    // tx leaves exactly one. Requires a local PG; skipped elsewhere.
    const dbUrl = process.env.DATABASE_URL ?? "";
    const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl) && !dbUrl.includes("hermetic");
    if (!dbReady) return;

    const { writeAudit } = await import("./lib/admin-guard");
    const { db, pool } = await import("@scandihaven/db/client");
    const { sql } = await import("drizzle-orm");

    const marker = `r11-audit-${Date.now()}`;
    // Rolled-back tx: NO audit row survives.
    await db.transaction(async (tx) => {
      await writeAudit(
        {
          actorId: "r11-test",
          actorRole: "owner",
          action: `rollback.${marker}`,
          entityType: "test",
          entityId: "00000000-0000-0000-0000-000000000000",
        },
        tx,
      );
      throw new Error("deliberate rollback");
    }).catch(() => undefined);
    const rolled = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM audit_log WHERE action = ${`rollback.${marker}`}`,
    );
    expect(rolled.rows[0]!.count).toBe("0");

    // Committed tx: exactly one audit row.
    await db.transaction(async (tx) => {
      await writeAudit(
        {
          actorId: "r11-test",
          actorRole: "owner",
          action: `commit.${marker}`,
          entityType: "test",
          entityId: "00000000-0000-0000-0000-000000000000",
        },
        tx,
      );
    });
    const committed = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM audit_log WHERE action = ${`commit.${marker}`}`,
    );
    expect(committed.rows[0]!.count).toBe("1");
    await db.execute(sql`DELETE FROM audit_log WHERE action LIKE ${`%.${marker}`}`);
    await pool.end().catch(() => undefined);
  });
});

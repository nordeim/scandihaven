import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, like } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { job } from "@scandihaven/db/schema";
import { PgJobRunner, type JobHandler } from "./jobs";

/**
 * Integration tests for the outbox drainer (PRD §8.4 /api/jobs/run, ADR-8).
 * Require a local PG17 (embedded sandbox cluster or docker compose); skipped
 * elsewhere so unit CI stays hermetic.
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

describe.skipIf(!dbReady)("PgJobRunner (outbox drain, FOR UPDATE SKIP LOCKED)", () => {
  beforeAll(async () => {
    await db.delete(job).where(like(job.kind, "test.%"));
  });

  afterEach(async () => {
    await db.delete(job).where(like(job.kind, "test.%"));
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("enqueue persists a job and dedupes on the idempotency key", async () => {
    const runner = new PgJobRunner({ db, handlers: {} });
    await runner.enqueue({
      kind: "test.dedupe",
      payload: { n: 1 },
      dedupeKey: "test.dedupe:one",
    });
    await runner.enqueue({
      kind: "test.dedupe",
      payload: { n: 1 },
      dedupeKey: "test.dedupe:one",
    });
    const rows = await db.select().from(job).where(eq(job.kind, "test.dedupe"));
    expect(rows).toHaveLength(1);
  });

  it("drain executes due jobs and marks them done", async () => {
    const handler: JobHandler = vi.fn(async () => {});
    const runner = new PgJobRunner({ db, handlers: { "test.done": handler } });
    await runner.enqueue({
      kind: "test.done",
      payload: { orderId: "o1" },
      dedupeKey: "test.done:o1",
    });

    const result = await runner.drain({ now: new Date() });
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(handler).toHaveBeenCalledWith({ orderId: "o1" }, expect.anything());

    const rows = await db.select().from(job).where(eq(job.kind, "test.done"));
    expect(rows[0]?.status).toBe("done");
  });

  it("skips jobs whose runAfter is in the future", async () => {
    const handler: JobHandler = vi.fn(async () => {});
    const runner = new PgJobRunner({ db, handlers: { "test.future": handler } });
    await runner.enqueue({
      kind: "test.future",
      payload: {},
      dedupeKey: "test.future:later",
      runAfter: new Date(Date.now() + 60 * 60_000),
    });

    const result = await runner.drain({ now: new Date() });
    expect(result.processed).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not reprocess done jobs", async () => {
    const handler: JobHandler = vi.fn(async () => {});
    const runner = new PgJobRunner({ db, handlers: { "test.once": handler } });
    await runner.enqueue({
      kind: "test.once",
      payload: {},
      dedupeKey: "test.once:1",
    });
    await runner.drain({ now: new Date() });
    const second = await runner.drain({ now: new Date() });
    expect(second.processed).toBe(0);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("records failures, retries until maxAttempts, then dead-letters", async () => {
    const handler: JobHandler = vi.fn(async () => {
      throw new Error("boom");
    });
    const runner = new PgJobRunner({ db, handlers: { "test.fail": handler }, maxAttempts: 2 });
    await runner.enqueue({
      kind: "test.fail",
      payload: {},
      dedupeKey: "test.fail:1",
    });

    const first = await runner.drain({ now: new Date() });
    expect(first.processed).toBe(0);
    expect(first.failed).toBe(1);

    const second = await runner.drain({ now: new Date(Date.now() + 1000) });
    expect(second.dead).toBe(1);

    const rows = await db.select().from(job).where(eq(job.kind, "test.fail"));
    expect(rows[0]?.status).toBe("dead");
    expect(rows[0]?.attempts).toBe(2);
    expect(rows[0]?.lastError).toContain("boom");
  });

  it("handles unknown kinds by dead-lettering (nothing silently dropped)", async () => {
    const runner = new PgJobRunner({ db, handlers: {}, maxAttempts: 1 });
    await runner.enqueue({
      kind: "test.unknown",
      payload: {},
      dedupeKey: "test.unknown:1",
    });
    const result = await runner.drain({ now: new Date() });
    expect(result.dead).toBe(1);
    const rows = await db.select().from(job).where(eq(job.kind, "test.unknown"));
    expect(rows[0]?.lastError).toContain("no handler");
  });

  it("concurrent drains never double-process the same job", async () => {
    const runner = new PgJobRunner({
      db,
      handlers: { "test.parallel": async () => {} },
    });
    const N = 12;
    for (let i = 0; i < N; i++) {
      await runner.enqueue({
        kind: "test.parallel",
        payload: { i },
        dedupeKey: `test.parallel:${i}`,
      });
    }
    const [a, b, c] = await Promise.all([
      runner.drain({ now: new Date() }),
      runner.drain({ now: new Date() }),
      runner.drain({ now: new Date() }),
    ]);
    const totalProcessed = a.processed + b.processed + c.processed;
    expect(totalProcessed).toBe(N);

    const rows = await db.select().from(job).where(eq(job.kind, "test.parallel"));
    const doneCount = rows.filter((r) => r.status === "done").length;
    expect(doneCount).toBe(N);
  });
});

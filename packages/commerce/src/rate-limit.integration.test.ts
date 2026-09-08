import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@scandihaven/db/client";
import { rateLimitHit } from "@scandihaven/db/schema";
import { consumeRateLimit, windowBucketId } from "./rate-limit";

/**
 * Integration tests for the Postgres fixed-window limiter (PRD §9.4).
 * Require a local PG17 (docker compose or embedded cluster); skipped
 * elsewhere so unit CI stays hermetic (same seam contract as jobs.test.ts).
 */
const dbUrl = process.env.DATABASE_URL ?? "";
const dbReady = /\/\/([^/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

describe.skipIf(!dbReady)("consumeRateLimit (§9.4 sliding window)", () => {
  const BUCKET = windowBucketId("test.limit", "203.0.113.9");

  beforeAll(async () => {
    await db.delete(rateLimitHit).where(eq(rateLimitHit.bucket, BUCKET));
  });

  afterAll(async () => {
    await db.delete(rateLimitHit).where(eq(rateLimitHit.bucket, BUCKET));
    await pool.end();
  });

  it("allows hits under the limit and blocks at limit+1 with Retry-After", async () => {
    const rule = { scope: "test.limit", identifier: "203.0.113.9", limit: 3, windowMs: 60_000 };
    const now = new Date();

    for (let i = 0; i < 3; i++) {
      const decision = await consumeRateLimit(db, rule, now);
      expect(decision.allowed).toBe(true);
      expect(decision.count).toBe(i + 1);
    }

    const blocked = await consumeRateLimit(db, rule, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.count).toBe(4);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("resets the count in the next window", async () => {
    const rule = { scope: "test.limit.next", identifier: "198.51.100.2", limit: 1, windowMs: 60_000 };
    const t0 = new Date("2026-09-08T10:00:30.000Z");
    expect((await consumeRateLimit(db, rule, t0)).allowed).toBe(true);
    expect((await consumeRateLimit(db, rule, t0)).allowed).toBe(false);
    // Next window: fresh count.
    const t1 = new Date("2026-09-08T10:01:00.000Z");
    const next = await consumeRateLimit(db, rule, t1);
    expect(next.allowed).toBe(true);
    expect(next.count).toBe(1);
    await db
      .delete(rateLimitHit)
      .where(and(eq(rateLimitHit.bucket, windowBucketId("test.limit.next", "198.51.100.2"))));
  });
});

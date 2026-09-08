/**
 * Postgres fixed-window rate limiter (PRD §9.4). Counts hits in the
 * `rate_limit_hit` table — PK (bucket, window_start) — so limits survive
 * process restarts and are shared across instances (Redis is deliberately
 * out of scope until the §3.2 swap trigger).
 *
 * Route-class limits per §9.4:
 *   auth 5/min/IP+email · checkout 30/min/cart · typeahead 60/min/IP ·
 *   newsletter 3/hour/IP · trade application 5/day/IP
 */
import { and, eq, lt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@scandihaven/db/schema";
import { rateLimitHit } from "@scandihaven/db/schema";

export type RateLimitRule = {
  /** Bucket namespace, e.g. "typeahead" or "newsletter". */
  scope: string;
  /** Caller identity within the scope (IP, cart id, email hash…). */
  identifier: string;
  /** Max hits allowed per window. */
  limit: number;
  /** Window length in milliseconds (60_000, 3_600_000, 86_400_000…). */
  windowMs: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  /** Hits consumed including this request (present even when blocked). */
  count: number;
  /** Seconds until the current window ends (Retry-After, §9.4). */
  retryAfterSeconds: number;
};

export function windowStartFor(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export function windowBucketId(scope: string, identifier: string): string {
  return `${scope}:${identifier}`;
}

export function retryAfterSeconds(now: Date, windowStart: Date, windowMs: number): number {
  const elapsed = now.getTime() - windowStart.getTime();
  return Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
}

type Executor = Pick<NodePgDatabase<typeof schema>, "select" | "insert" | "delete">;

/**
 * Consume one hit for (scope, identifier). Returns the decision for this
 * request; the row upsert is atomic so concurrent requests cannot race past
 * the limit (the count is incremented DB-side).
 */
export async function consumeRateLimit(
  executor: Executor,
  rule: RateLimitRule,
  now: Date = new Date(),
): Promise<RateLimitDecision> {
  const bucket = windowBucketId(rule.scope, rule.identifier);
  const windowStart = windowStartFor(now, rule.windowMs);

  const upserted = await executor
    .insert(rateLimitHit)
    .values({ bucket, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitHit.bucket, rateLimitHit.windowStart],
      set: { count: sql`${rateLimitHit.count} + 1` },
    })
    .returning({ count: rateLimitHit.count });
  const count = upserted[0]?.count ?? 1;

  // Opportunistic retention: drop this bucket's fully-expired windows so the
  // table cannot grow unboundedly (indexed by the PK prefix).
  await executor
    .delete(rateLimitHit)
    .where(and(eq(rateLimitHit.bucket, bucket), lt(rateLimitHit.windowStart, new Date(now.getTime() - rule.windowMs))));

  const allowed = count <= rule.limit;
  return {
    allowed,
    count,
    retryAfterSeconds: retryAfterSeconds(now, windowStart, rule.windowMs),
  };
}

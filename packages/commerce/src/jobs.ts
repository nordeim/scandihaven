/**
 * Postgres outbox runner (PRD §4.3/§8.4, ADR-8). The only drainer of the
 * `job` table: two-phase claim (FOR UPDATE SKIP LOCKED inside a short
 * transaction, handlers executed outside the lock) so concurrent cron ticks
 * never double-process, and a slow email send never blocks placement.
 *
 * Semantics (PRD §6.2 idempotency):
 * - enqueue is idempotent per (kind, dedupeKey) — unique index on idempotency_key.
 * - a handler failure records lastError and increments attempts; after
 *   maxAttempts the job dead-letters (SLO: outbox dead-letter = 0, §12.2).
 * - unknown kinds dead-letter immediately — nothing is silently dropped.
 */
import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@scandihaven/db/schema";
import { job } from "@scandihaven/db/schema";

export type JobPayload = unknown;

export type JobHandlerContext = {
  /** Monotonic drain tick id — useful for logs/correlation. */
  tickId: string;
};

export type JobHandler = (payload: JobPayload, ctx: JobHandlerContext) => Promise<void>;

export type DrainResult = { processed: number; failed: number; dead: number };

export const JOB_BATCH_LIMIT = 50;

export class PgJobRunner {
  private readonly handlers: Map<string, JobHandler>;
  private readonly maxAttempts: number;
  private readonly db: NodePgDatabase<typeof schema>;

  constructor(deps: {
    db: NodePgDatabase<typeof schema>;
    handlers: Record<string, JobHandler>;
    maxAttempts?: number;
  }) {
    this.db = deps.db;
    this.handlers = new Map(Object.entries(deps.handlers));
    this.maxAttempts = Math.max(1, deps.maxAttempts ?? 5);
  }

  /** Idempotent enqueue: a repeated dedupeKey is a no-op (onConflictDoNothing). */
  async enqueue(spec: {
    kind: string;
    payload: unknown;
    runAfter?: Date;
    dedupeKey?: string;
  }): Promise<void> {
    const key = spec.dedupeKey ?? `${spec.kind}:${crypto.randomUUID()}`;
    await this.db
      .insert(job)
      .values({
        kind: spec.kind,
        payload: spec.payload as never,
        runAfter: spec.runAfter ?? new Date(),
        idempotencyKey: key,
      })
      .onConflictDoNothing();
  }

  /**
   * Claim a batch with FOR UPDATE SKIP LOCKED, mark running, execute handlers
   * outside the claim transaction, then settle each job (done/failed/dead).
   */
  async drain(options?: { limit?: number; now?: Date }): Promise<DrainResult> {
    const now = options?.now ?? new Date();
    const limit = Math.min(Math.max(options?.limit ?? JOB_BATCH_LIMIT, 1), JOB_BATCH_LIMIT);
    const tickId = crypto.randomUUID();
    const result: DrainResult = { processed: 0, failed: 0, dead: 0 };

    // Phase 1: short claim transaction — lock, verify due-ness, mark running.
    // ALL due rows are claimed: known kinds go to their handlers; unknown
    // kinds dead-letter in phase 2 (§4.8 — nothing stays pending forever).
    const claimed = await this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: job.id, kind: job.kind, payload: job.payload, attempts: job.attempts })
        .from(job)
        .where(and(eq(job.status, "pending"), lte(job.runAfter, now)))
        .orderBy(asc(job.runAfter), asc(job.id))
        .limit(limit)
        .for("update", { skipLocked: true });

      for (const row of rows) {
        await tx
          .update(job)
          .set({
            status: "running",
            attempts: row.attempts + 1,
            updatedAt: now,
          })
          .where(eq(job.id, row.id));
      }
      return rows;
    });

    // Phase 2: handlers run lock-free; each job settles independently.
    for (const row of claimed) {
      const attempts = row.attempts + 1;
      const handler = this.handlers.get(row.kind);
      if (!handler) {
        await this.settle(row.id, "dead", now, `no handler registered for kind ${row.kind}`);
        result.dead += 1;
        continue;
      }
      try {
        await handler(row.payload, { tickId });
        await this.settle(row.id, "done", now);
        result.processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isDead = attempts >= this.maxAttempts;
        if (isDead) {
          await this.settle(row.id, "dead", now, message);
          result.dead += 1;
        } else {
          // Retryable: back to pending with exponential backoff (0.5 s, 1 s,
          // 2 s …) so a transient vendor outage self-heals (§4.5).
          const backoffMs = 500 * 2 ** (attempts - 1);
          await this.db
            .update(job)
            .set({
              status: "pending",
              runAfter: new Date(now.getTime() + backoffMs),
              lastError: message,
              updatedAt: now,
            })
            .where(eq(job.id, row.id));
          result.failed += 1;
        }
      }
    }

    return result;
  }

  private async settle(
    id: string,
    status: "done" | "dead",
    now: Date,
    error?: string,
  ): Promise<void> {
    await this.db
      .update(job)
      .set({
        status,
        lastError: error ?? null,
        updatedAt: now,
      })
      .where(eq(job.id, id));
  }

  /** Current queue depth by status — surfaced on the admin dashboard (FR-801). */
  async queueDepth(): Promise<{ pending: number; failed: number; dead: number }> {
    const rows = await this.db
      .select({ status: job.status, count: sql<number>`count(*)::int` })
      .from(job)
      .groupBy(job.status);
    const by = (s: string) => rows.find((r) => r.status === s)?.count ?? 0;
    return { pending: by("pending"), failed: by("failed"), dead: by("dead") };
  }
}

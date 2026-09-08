import { describe, expect, it } from "vitest";
import { retryAfterSeconds, windowBucketId, windowStartFor } from "./rate-limit";

/**
 * Pure window math for the Postgres sliding-window limiter (PRD §9.4).
 * The DB-consuming path (consumeRateLimit) is covered by an integration
 * suite that runs against a migrated local PG (skipIf — see jobs.test.ts).
 */
describe("rate-limit window math (PRD §9.4)", () => {
  it("floors timestamps to fixed window starts", () => {
    const windowMs = 60_000;
    expect(windowStartFor(new Date("2026-09-08T10:00:00.000Z"), windowMs)).toEqual(
      new Date("2026-09-08T10:00:00.000Z"),
    );
    expect(windowStartFor(new Date("2026-09-08T10:00:59.999Z"), windowMs)).toEqual(
      new Date("2026-09-08T10:00:00.000Z"),
    );
    expect(windowStartFor(new Date("2026-09-08T10:01:00.001Z"), windowMs)).toEqual(
      new Date("2026-09-08T10:01:00.000Z"),
    );
  });

  it("floors hour-sized windows for the newsletter limit", () => {
    const hour = 3_600_000;
    expect(windowStartFor(new Date("2026-09-08T10:59:59.000Z"), hour)).toEqual(
      new Date("2026-09-08T10:00:00.000Z"),
    );
  });

  it("namespaces buckets by scope and identifier", () => {
    expect(windowBucketId("typeahead", "203.0.113.7")).toBe("typeahead:203.0.113.7");
    expect(windowBucketId("newsletter", "a@b.example")).toBe("newsletter:a@b.example");
  });

  it("computes a strictly positive Retry-After from window position", () => {
    const now = new Date("2026-09-08T10:00:30.000Z");
    const windowStart = new Date("2026-09-08T10:00:00.000Z");
    const windowMs = 60_000;
    expect(retryAfterSeconds(now, windowStart, windowMs)).toBe(30);
    // Degenerate boundary (a fresh window has begun): the clamp still yields
    // a positive Retry-After rather than 0, per §9.4's must-be-positive header.
    expect(retryAfterSeconds(new Date("2026-09-08T10:01:00.000Z"), windowStart, windowMs)).toBe(1);
  });
});

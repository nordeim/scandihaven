import { describe, expect, it, afterEach } from "vitest";
import { db, pool, __dbCache } from "./client";

/**
 * Contract (audit 2026-09-09 C1): the Pool/Drizzle instances must be cached
 * UNCONDITIONALLY — including NODE_ENV=production. The Proxy get trap runs
 * per property access; without caching, `next start` would build a fresh
 * Pool (max 10 connections) for every query and exhaust PostgreSQL
 * max_connections. Dev-only caching is the defect this test pins.
 *
 * Identity is asserted through the module cache slots (`__dbCache`): the
 * proxies deliberately bind functions per access, so bound-function identity
 * is not the contract — instance reuse is.
 */

describe("db client caching (audit C1)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("reuses the same underlying instances across accesses in production mode", () => {
    process.env.NODE_ENV = "production";

    void db.select; // first access triggers lazy creation + caching
    const dbSlot = __dbCache.__scandihavenDb;
    const poolSlot = __dbCache.__scandihavenPool;

    void db.transaction; // further accesses must reuse, not recreate
    void db.query;
    void pool.totalCount;

    expect(__dbCache.__scandihavenDb).toBe(dbSlot);
    expect(__dbCache.__scandihavenPool).toBe(poolSlot);
    expect(dbSlot).toBeTypeOf("object");
    expect(poolSlot).toBeTypeOf("object");
  });

  it("populates the cache slots in production mode", () => {
    process.env.NODE_ENV = "production";
    void pool.totalCount; // trigger lazy creation through the proxy
    expect(__dbCache.__scandihavenPool).toBeTypeOf("object");
    expect(__dbCache.__scandihavenDb).toBeTypeOf("object");
  });

  it("does not recreate instances for repeated db access in production mode", () => {
    process.env.NODE_ENV = "production";
    void db.select;
    const cached = __dbCache.__scandihavenDb;
    void db.transaction;
    void db.query;
    expect(__dbCache.__scandihavenDb).toBe(cached);
  });
});

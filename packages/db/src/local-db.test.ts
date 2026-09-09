import { describe, expect, it, afterEach } from "vitest";
import { assertLocalDatabase, isLocalDatabaseUrl } from "./local-db";

/**
 * Contract (AGENTS.md "local hosts only" + audit 2026-09-09 M6d): seed,
 * reset, AND migrate refuse non-local DATABASE_URL hosts — destructive or
 * dev-only DB operations must never hit a shared/staging/production cluster.
 */

describe("isLocalDatabaseUrl", () => {
  it("accepts localhost, 127.0.0.1, and ::1 hosts", () => {
    expect(
      isLocalDatabaseUrl("postgresql://scandihaven_user:scandihaven_secret@localhost:5432/scandihaven_dev"),
    ).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u:p@127.0.0.1:5432/db")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u:p@[::1]:5432/db")).toBe(true);
  });

  it("rejects remote-looking hosts", () => {
    expect(isLocalDatabaseUrl("postgresql://u:p@db.example.com:5432/db")).toBe(false);
    expect(isLocalDatabaseUrl("postgresql://u:p@10.1.2.3:5432/db")).toBe(false);
    expect(isLocalDatabaseUrl("postgresql://u:p@scandihaven-prod.internal:5432/db")).toBe(false);
  });

  it("rejects invalid or missing connection strings", () => {
    expect(isLocalDatabaseUrl("")).toBe(false);
    expect(isLocalDatabaseUrl("not-a-url")).toBe(false);
  });
});

describe("assertLocalDatabase", () => {
  const original = process.env.DATABASE_URL;

  it("passes silently for local hosts", () => {
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
    expect(() => assertLocalDatabase()).not.toThrow();
  });

  it("throws with the host named for remote hosts", () => {
    process.env.DATABASE_URL = "postgresql://u:p@db.example.com:5432/db";
    expect(() => assertLocalDatabase()).toThrow(/db\.example\.com/);
  });

  it("throws for an unset or malformed DATABASE_URL", () => {
    process.env.DATABASE_URL = "";
    expect(() => assertLocalDatabase()).toThrow(/not a valid connection string/);
  });

  afterEach(() => {
    process.env.DATABASE_URL = original;
  });
});

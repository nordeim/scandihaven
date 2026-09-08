import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Pooled Drizzle client (PRD §4.7). In dev the pool is cached on globalThis so
 * Next.js HMR and CLI tools share one pool instead of leaking connections.
 *
 * Lazily created so `next build` can collect page data (which imports the
 * auth route → this module) without a live DATABASE_URL. The first real
 * query still fails fast with an actionable message; instrumentation.ts
 * validates env at runtime per PRD §9.4.
 */
export type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __scandihavenPool?: Pool;
  __scandihavenDb?: Database;
};

function tryLoadRootEnv(): void {
  if (process.env.DATABASE_URL) return;
  try {
    // `dotenv` is a dependency of @scandihaven/db and of the Next.js apps.
    // Next.js's own @next/env loader walks only the app dir, so a build
    // in apps/web or apps/admin would miss the repo-root .env — this fallback
    // loads it explicitly.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require("dotenv") as { config: (opts: { path: string; override: boolean }) => void };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as { resolve: (...parts: string[]) => string };
    const candidates = [
      // When required from the compiled Next.js bundle, __dirname is inside
      // .next; process.cwd() is the reliable app or repo root.
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), "../../.env"),
      path.resolve(process.cwd(), "../../.env.local"),
    ];
    for (const candidate of candidates) {
      dotenv.config({ path: candidate, override: false, quiet: true } as never);
      if (process.env.DATABASE_URL) break;
    }
  } catch {
    // dotenv is optional at build time — fall through to the actionable error below.
  }
}

// Eagerly populate process.env from the repo-root .env so `skipIf(!dbReady)`
// in integration tests sees the local DATABASE_URL without an explicit shell
// export — the Pool itself remains lazy so `next build` page-data collection
// still succeeds without a DB.
tryLoadRootEnv();

function createPool(): Pool {
  tryLoadRootEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and start docker compose (or the bundled PG17).",
    );
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Server-generated strings (pg encoding) are not application input; parameters stay escaped.
    statement_timeout: 15_000,
  });
}

function getPool(): Pool {
  if (globalForDb.__scandihavenPool) return globalForDb.__scandihavenPool;
  const pool = createPool();
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__scandihavenPool = pool;
  }
  return pool;
}

function getDb(): Database {
  if (globalForDb.__scandihavenDb) return globalForDb.__scandihavenDb;
  const db = drizzle(getPool(), { schema });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__scandihavenDb = db;
  }
  return db;
}

/**
 * Lazily-proxied Pool so `import { pool }` at build time does not throw.
 * First property access (query, connect, end, …) triggers pool creation.
 */
export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const real = getPool() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
  has(_target, prop) {
    return prop in getPool();
  },
});

/** Lazily-proxied Drizzle client — same rationale as `pool`. */
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
  has(_target, prop) {
    return prop in getDb();
  },
});
export { schema };

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Pooled Drizzle client (PRD §4.7). In dev the pool is cached on globalThis so
 * Next.js HMR and CLI tools share one pool instead of leaking connections.
 */
const globalForDb = globalThis as unknown as { __scandihavenPool?: Pool };

function createPool(): Pool {
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

export const pool = globalForDb.__scandihavenPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__scandihavenPool = pool;
}

export const db = drizzle(pool, { schema });

export type Database = typeof db;
export { schema };

import "dotenv/config";
import { pool } from "../client";
import { assertLocalDatabase } from "../local-db";

/**
 * Drop and recreate the schema, then re-run migrations + seed.
 * Guarded to local hosts only (PRD §13.7) via the shared guard.
 */
try {
  assertLocalDatabase();
} catch (error) {
  console.error("[db]", error instanceof Error ? error.message : error);
  process.exit(1);
}

const client = await pool.connect();
try {
  await client.query("DROP SCHEMA public CASCADE");
  await client.query("CREATE SCHEMA public");
  console.info("[db] schema dropped and recreated");
} finally {
  client.release();
  await pool.end();
}

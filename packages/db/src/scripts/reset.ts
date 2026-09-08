import "dotenv/config";
import { pool } from "../client";

/**
 * Drop and recreate the schema, then re-run migrations + seed.
 * Guarded to local hosts only (PRD §13.7).
 */
const url = process.env.DATABASE_URL ?? "";
let host = "";
try {
  host = new URL(url).hostname;
} catch {
  console.error("[db] DATABASE_URL is not set or invalid");
  process.exit(1);
}
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`[db] refusing to reset non-local database host "${host}"`);
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

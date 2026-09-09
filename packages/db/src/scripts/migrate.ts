import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../index";
import { assertLocalDatabase } from "../local-db";

// Lifecycle scripts are dev-only (AGENTS.md: "local hosts only") — refuse
// shared/staging/production hosts before touching the schema (audit
// 2026-09-09 M6d: db:migrate previously ran unguarded).
assertLocalDatabase();

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.info("[db] migrations applied");
} catch (error) {
  console.error("[db] migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

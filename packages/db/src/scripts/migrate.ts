import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../index";

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.info("[db] migrations applied");
} catch (error) {
  console.error("[db] migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

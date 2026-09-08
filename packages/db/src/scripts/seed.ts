import "dotenv/config";
import { pool } from "../index";
import { ensureSeeded } from "../seed/ensure-seeded";

try {
  const result = await ensureSeeded();
  console.info(`[db] seed complete (idempotent run=${result.seeded ? "ok" : "noop"})`);
} catch (error) {
  console.error("[db] seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

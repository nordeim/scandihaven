import { parseFlags } from "@scandihaven/config/flags";

/**
 * Fail-fast boot checks (PRD §9.4: "env is a boundary; validate at boot").
 * Next.js calls register() once when the server starts: an invalid or missing
 * required variable, or an unknown FEATURE_* env var, stops the process here
 * with an actionable message instead of failing deep inside a request.
 *
 * Edge Runtime has no filesystem — `packages/config/src/env.ts` walks
 * `process.cwd()` to find the repo-root `.env` for `pnpm prod`. That walk
 * must not run in Edge (see start_server_log.txt:32 / B-1). Guard before
 * importing the Node-only env module so the Edge bundle does not include
 * `process.cwd()` / `require("dotenv")` at all.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { parseServerEnv } = await import("@scandihaven/config/env");
  parseServerEnv();
  parseFlags();
}

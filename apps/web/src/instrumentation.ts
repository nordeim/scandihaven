import { parseFlags } from "@scandihaven/config/flags";
import { parseServerEnv } from "@scandihaven/config/env";

/**
 * Fail-fast boot checks (PRD §9.4: "env is a boundary; validate at boot").
 * Next.js calls register() once when the server starts: an invalid or missing
 * required variable, or an unknown FEATURE_* env var, stops the process here
 * with an actionable message instead of failing deep inside a request.
 */
export async function register(): Promise<void> {
  parseServerEnv();
  parseFlags();
}

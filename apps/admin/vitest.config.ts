import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // The admin suites dynamically import the workspace TS-source graph
    // (admin-guard → @scandihaven/auth → @scandihaven/commerce/db), and the
    // first import pays the full compile. Under 7-way parallel turbo runs on
    // 2-CPU sandboxes that cold import crossed vitest's 5000ms default
    // ("Test timed out in 5000ms" at guard.test.ts:16 — the round-3 ledger's
    // monitored flake, root-caused 2026-09-10 round 5). 30s bounds the cold
    // path without loosening any assertion.
    testTimeout: 30_000,
  },
});

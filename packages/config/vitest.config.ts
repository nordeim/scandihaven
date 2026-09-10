import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Suites cold-import the workspace TS graph. Under 7-way parallel turbo
    // runs on 2-CPU sandboxes the cold import can cross vitest's 5000ms
    // default (same root cause as the admin/auth captures in round 5).
    // 30s bounds the cold path without loosening any assertion.
    testTimeout: 30_000,
  },
});

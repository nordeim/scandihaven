import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Suites cold-import the workspace TS graph (server.ts constructs the
    // Better-Auth instance). Under 7-way parallel turbo runs on 2-CPU
    // sandboxes that import crossed the 5000ms default ("Test timed out in
    // 5000ms" at server-origin.test.ts:17 — round-5 root-cause capture).
    // 30s bounds the cold path without loosening any assertion.
    testTimeout: 30_000,
  },
});

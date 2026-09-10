import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Suites cold-import the workspace TS graph (db client, drizzle schema).
    // Under 7-way parallel turbo runs on 2-CPU sandboxes the cold import can
    // cross vitest's 5000ms default (same root cause as the admin/auth
    // captures in round 5). 30s bounds the cold path without loosening any
    // assertion.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      // PRD §12.1 gates PURE domain logic at 90%. DB-backed services
      // (catalog, cart-service, checkout-service) are covered by the
      // integration layer (Phase 1, live PG per §12.1 row 3), not here.
      include: ["src/money.ts", "src/pricing.ts", "src/promotions.ts", "src/order-state.ts", "src/result.ts"],
      thresholds: {
        lines: 90,
        functions: 85,
      },
    },
  },
});

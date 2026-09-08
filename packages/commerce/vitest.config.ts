import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
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

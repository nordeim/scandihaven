import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config (PRD §12.1). The storefront server must be reachable at baseURL
 * with a migrated+seeded database. Checkout purchase steps are gated on
 * STRIPE_SECRET_KEY being present — they are skipped (with an explicit
 * notice) when payments are not configured, never silently passed.
 *
 * The webServer target is the PRODUCTION build (`next start`, requires a
 * prior `pnpm build` — CI's Build step precedes E2E; AGENTS.md: `pnpm prod`
 * requires prior build). E2E must validate the artifact that ships: the
 * 2026-09-10 live-E2E audit (E2E-1) found a production-only failure mode
 * (stale build chunks) invisible to the dev server, and the dev runtime's
 * HMR/hydration behaviour diverges from production in constrained
 * environments (E2E-11b: dev hydration never completed where the HMR
 * websocket could not establish — production hydrates and passes 21/21).
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm --filter @scandihaven/web exec next start --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 90_000,
      },
});

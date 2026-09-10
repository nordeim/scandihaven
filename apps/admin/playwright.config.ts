import { defineConfig, devices } from "@playwright/test";

/**
 * Admin E2E config (round 6, R6-3; PRD §12.1): credential-free coverage of
 * the admin gate and sign-in surface. Mirrors apps/web's config — the
 * webServer target is the PRODUCTION build (`next start`, requires a prior
 * `pnpm build`) on :3001, and `E2E_BASE_URL` retargets a running server
 * (live-origin audits) exactly like the storefront suite does.
 */
const PORT = Number(process.env.E2E_PORT ?? 3001);
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm --filter @scandihaven/admin exec next start --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 90_000,
      },
});

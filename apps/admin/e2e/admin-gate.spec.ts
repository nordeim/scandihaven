import { expect, test } from "@playwright/test";

/**
 * Admin gate E2E — credential-free (round 6, R6-3; PRD §12.1/§9.2).
 *
 * The admin app previously had NO browser coverage at all: its only
 * live-validation was manual curl probes during audits. These specs pin the
 * gate contract that the RBAC-gated Server Actions ultimately rely on for UX:
 *
 * - unauthenticated navigation to any admin route 307s to
 *   `/sign-in?redirect=<requested path>` (H2-ADMIN shape, E2E-5 param contract)
 * - /sign-in renders the credential form (no auth required there — H7d loop guard)
 * - the §9.3 security headers apply to /sign-in too (H5d)
 * - wrong credentials produce a visible error, never a session (auth rate
 *   limit is 5/min/IP+email — a single attempt per run stays under it)
 *
 * No valid credentials exist in any environment by design (SEED_ADMIN_PASSWORD
 * is ops-only), so authenticated flows stay covered by unit + RBAC suites.
 */

/** The gate 307s with a relative Location — parse against a base so the
    assertion sees the redirect TARGET, not the fetch origin. */
function redirectOf(location: string): URL {
  return new URL(location, "http://127.0.0.1");
}

test.describe("admin gate (round 6, R6-3; PRD §9.2)", () => {
  test("unauthenticated / redirects to sign-in with the requested path preserved", async ({ request }) => {
    const res = await request.get("/", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const location = res.headers().location ?? "";
    const url = redirectOf(location);
    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get("redirect")).toBe("/");
  });

  for (const path of ["/orders", "/products", "/customers", "/definitely-not-a-route"]) {
    test(`unauthenticated ${path} redirects to sign-in preserving the path`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      const location = res.headers().location ?? "";
      const url = redirectOf(location);
      expect(url.pathname).toBe("/sign-in");
      expect(url.searchParams.get("redirect")).toBe(path);
    });
  }

  test("sign-in renders the credential form and stays reachable unauthenticated", async ({ page }) => {
    const res = await page.goto("/sign-in");
    expect(res?.status()).toBe(200);
    await expect(page.locator("input[type=email]")).toBeVisible();
    await expect(page.locator("input[type=password]")).toBeVisible();
    await expect(page.locator("button[type=submit]")).toBeVisible();
  });

  test("sign-in carries the §9.3 security headers (H5d)", async ({ request }) => {
    const res = await request.get("/sign-in");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["strict-transport-security"]).toContain("max-age=");
  });

  test("wrong credentials surface a typed error and never a session", async ({ page }) => {
    await page.goto("/sign-in");
    await page.locator("input[type=email]").fill("e2e-gate-probe@example.com");
    await page.locator("input[type=password]").fill("not-a-real-password");
    await page.locator("button[type=submit]").click();
    // Better-Auth returns INVALID_EMAIL_OR_PASSWORD; the form must render an
    // error, stay on /sign-in, and the gate must keep protecting admin routes.
    await expect(page.locator("body")).toContainText(/invalid|incorrect|wrong|failed/i);
    expect(page.url()).toContain("/sign-in");
    const gated = await page.request.get("/orders", { maxRedirects: 0 });
    expect(gated.status()).toBe(307);
  });
});

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Phase 0 E2E smoke (PRD §13.2 exit criteria): browse → PLP → PDP → add to
 * cart → cart totals. The checkout purchase step requires Stripe test keys;
 * it verifies the visible configuration state instead of faking payment.
 */

test.describe("storefront smoke", () => {
  test("home renders hero and product sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /slow living/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /new arrivals/i })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("PLP lists seeded catalog with prices", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("heading", { level: 1, name: "Shop all" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("pieces");
    await expect(page.getByRole("heading", { name: /halden linen armchair/i })).toBeVisible();
  });

  test("category PLP filters by subtree", async ({ page }) => {
    await page.goto("/shop/furniture");
    await expect(page.getByRole("heading", { level: 1, name: /furniture/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /halden linen armchair/i })).toBeVisible();
  });

  test("PDP shows variant swatches, lead time, and add-to-cart opens drawer", async ({ page }) => {
    await page.goto("/products/oresund-table-lamp");
    await expect(page.getByRole("heading", { level: 1, name: /Øresund table lamp/i })).toBeVisible();
    await expect(page.getByText(/in stock — ships in/i)).toBeVisible();

    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Your cart", { exact: true })).toBeVisible();
    await expect(page.getByText("Subtotal")).toBeVisible();
  });

  test("cart page shows totals and persists across reload", async ({ page }) => {
    await page.goto("/products/oresund-table-lamp");
    await page.getByRole("button", { name: "Add to cart" }).click();
    // Wait for the server action to complete (drawer opens) before navigating.
    await expect(page.getByText("Your cart", { exact: true })).toBeVisible();
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();
    await expect(page.getByText("Subtotal")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();
  });

  test("checkout surfaces configuration state honestly when Stripe is unset", async ({ page }) => {
    await page.goto("/products/oresund-table-lamp");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.waitForTimeout(500);
    await page.goto("/checkout");
    await expect(
      page
        .getByText(/payments are not configured/i)
        .or(page.getByRole("button", { name: /continue to payment/i })),
    ).toBeVisible();
  });

  test("health endpoint reports db status", async ({ request }) => {
    const response = await request.get("/api/health");
    expect([200, 503]).toContain(response.status());
    const body = (await response.json()) as { status: string; db: boolean };
    expect(body).toHaveProperty("db");
  });

  test("404 page renders with recovery paths", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /wandered off/i })).toBeVisible();
  });
});

test.describe("accessibility (PRD §12.2)", () => {
  for (const path of ["/", "/shop", "/products/oresund-table-lamp"]) {
    test(`axe: no serious violations on ${path}`, async ({ page }) => {
      // WCAG contrast evaluates the steady state, not transient reveal
      // animation frames — mid-fade opacity fails contrast spuriously
      // (Verified flake: hero reveal runs 800ms; scan races it). Freeze
      // animations after load so the scan measures the rendered end state.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      await page.addStyleTag({
        content:
          "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }",
      });
      await page.waitForTimeout(250);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(serious.map((v) => `${v.id}: ${v.impact}`)).toEqual([]);
    });
  }
});

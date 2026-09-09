import { expect, test } from "@playwright/test";

/**
 * Cart mutation flows (PRD FR-401..405) — regression spec for the live E2E
 * audit 2026-09-09 round 2 (H1-CART). The original smoke suite only exercised
 * the FIRST add-to-cart of a fresh context, so a wiring bug that stranded
 * every mutation AFTER the cart cookie existed (quantity update → "Cart line
 * not found", remove that resurrected on reload, repeat-add silently lost)
 * shipped and survived two audits. Every test here mutates an existing cart
 * and asserts SERVER truth across a reload, not just optimistic UI state.
 */

const LAMP_PDP = "/products/oresund-table-lamp";
const LAMP_TITLE = /Øresund table lamp/i;
const LAMP_INCREASE = /increase quantity for øresund table lamp/i;
const LAMP_DECREASE = /decrease quantity for øresund table lamp/i;
const LAMP_QTY_GROUP = /quantity for øresund table lamp/i;

async function addFromPdp(page: import("@playwright/test").Page, path: string): Promise<void> {
  await page.goto(path);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("Your cart", { exact: true })).toBeVisible();
}

test.describe("cart mutation flows (H1-CART regression)", () => {
  test("quantity update on the cart page survives a reload", async ({ page }) => {
    await addFromPdp(page, LAMP_PDP);
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();

    await page.getByRole("button", { name: LAMP_INCREASE }).click();
    await expect(page.getByRole("group", { name: LAMP_QTY_GROUP })).toContainText("2");
    await expect(page.getByText("€498.00")).toBeVisible();
    // No action error may surface (pre-fix: "Cart line not found").
    await expect(page.getByRole("alert")).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("group", { name: LAMP_QTY_GROUP })).toContainText("2");
    await expect(page.getByText("€498.00")).toBeVisible();
  });

  test("decrease returns to the minimum and disables itself", async ({ page }) => {
    await addFromPdp(page, LAMP_PDP);
    await page.goto("/cart");
    await page.getByRole("button", { name: LAMP_INCREASE }).click();
    await expect(page.getByRole("group", { name: LAMP_QTY_GROUP })).toContainText("2");

    await page.getByRole("button", { name: LAMP_DECREASE }).click();
    await expect(page.getByRole("group", { name: LAMP_QTY_GROUP })).toContainText("1");
    await expect(page.getByRole("button", { name: LAMP_DECREASE })).toBeDisabled();
  });

  test("removing a line keeps the cart empty after a reload", async ({ page }) => {
    await addFromPdp(page, LAMP_PDP);
    await page.goto("/cart");
    await page.getByRole("button", { name: "Remove" }).click();

    await expect(page.getByRole("heading", { name: /your cart is empty/i })).toBeVisible();
    // Pre-fix: the remove ran against a junk cart, the UI showed empty, and
    // the line resurrected here.
    await page.reload();
    await expect(page.getByRole("heading", { name: /your cart is empty/i })).toBeVisible();
  });

  test("adding the same product twice merges into one line of qty 2", async ({ page }) => {
    await addFromPdp(page, LAMP_PDP);
    await addFromPdp(page, LAMP_PDP);
    await page.goto("/cart");

    await expect(page.getByRole("group", { name: LAMP_QTY_GROUP })).toContainText("2");
    await expect(page.getByText("€498.00")).toBeVisible();
  });

  test("cart holds two different products with the summed subtotal", async ({ page }) => {
    await addFromPdp(page, LAMP_PDP);
    await addFromPdp(page, "/products/birch-side-table");
    await page.goto("/cart");

    await expect(page.getByRole("link", { name: LAMP_TITLE })).toBeVisible();
    await expect(page.getByRole("link", { name: /birch side table/i })).toBeVisible();
    await expect(page.getByText("€698.00")).toBeVisible();
  });

  test("promo rejection copy is customer-readable and the code applies once eligible (M1-PROMO)", async ({
    page,
  }) => {
    await addFromPdp(page, LAMP_PDP);
    await page.goto("/cart");

    // €249 < €500 minimum → rejection must be human copy, not "(min_spend)".
    await page.getByLabel("Promotion code").fill("WELCOME100");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("status")).toContainText(/higher order subtotal/i);

    // Raise the subtotal to €747 → the code applies and shows −€100.00.
    await page.getByRole("button", { name: LAMP_INCREASE }).click();
    await page.getByRole("button", { name: LAMP_INCREASE }).click();
    await expect(page.getByText("€747.00")).toBeVisible();
    await page.getByLabel("Promotion code").fill("WELCOME100");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("status")).toContainText(/applied/i);
    await expect(page.getByText(/€100\.00/)).toBeVisible();

    // Server truth: the promotion survives a reload.
    await page.reload();
    await expect(page.getByText(/€100\.00/)).toBeVisible();
  });
});

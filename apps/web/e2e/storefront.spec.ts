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

  test("PDP title carries the site suffix exactly once (M-TITLE)", async ({ page }) => {
    await page.goto("/products/oresund-table-lamp");
    const title = await page.title();
    expect(title.match(/\| Scandi Haven/g)?.length ?? 0).toBe(1);
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
    // Wait for the server action to complete (drawer opens) before navigating
    // — mirrors the cart test; a fixed waitForTimeout raced the action and
    // flaked against remote deployments.
    await expect(page.getByText("Your cart", { exact: true })).toBeVisible();
    await page.goto("/checkout");
    await expect(
      page
        .getByText(/payments are not configured/i)
        .or(page.getByRole("button", { name: /continue to payment/i })),
    ).toBeVisible();
  });

  test("checkout treats placeholder publishable keys as unconfigured (R8-1)", async ({ page }) => {
    // The local/E2E build carries the .env.example placeholder
    // (`pk_test_set-me`). R8-1: the client must mirror the server's
    // `set-me` guard so the honest notice renders INSTEAD of the address
    // form — never the form followed by a leaked internal config error.
    await page.goto("/products/oresund-table-lamp");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Your cart", { exact: true })).toBeVisible();
    await page.goto("/checkout");
    await expect(page.getByText(/payments are not configured/i)).toBeVisible();
    await expect(page.locator("input[name=name]")).toHaveCount(0);
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
    // M-404 regression: the branded 404 must ship in the SSR payload, not
    // only after hydration — crawlers and non-JS clients see this body.
    const ssrBody = (await response?.text()) ?? "";
    expect(ssrBody).toContain("This page has wandered off");
    expect(ssrBody).toContain("Browse the shop");
  });

  test("lookbooks deferred surface returns honest SSR 404 naming FR-705", async ({ page }) => {
    const response = await page.goto("/lookbooks");
    expect(response?.status()).toBe(404);
    // FR-705 / §15.3: the deferred surface names its FR ID in the SSR body.
    const ssrBody = (await response?.text()) ?? "";
    expect(ssrBody).toContain("FR-705");
  });

  test("sign-in carries the ?redirect= path back to the destination (FR-602, E2E-5)", async ({
    page,
  }) => {
    const response = await page.goto("/account");
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).searchParams.get("redirect")).toBe("/account");
  });
});

/**
 * Mobile navigation (PRD FR-102; live E2E audit 2026-09-10, E2E-6): the
 * primary nav is hidden below md and NO menu existed — mobile users could
 * not reach Shop/Collections/Journal at all. The drawer trigger must be
 * present, open the nav, and navigate.
 */
test.describe("mobile navigation (FR-102)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("menu drawer exposes the primary nav on a phone viewport", async ({ page }) => {
    await page.goto("/");
    const menuButton = page.getByRole("button", { name: "Open menu" });
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    for (const label of ["Shop", "Collections", "Our Story", "Journal"]) {
      await expect(drawer.getByRole("link", { name: label })).toBeVisible();
    }

    await drawer.getByRole("link", { name: "Shop" }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.getByRole("heading", { level: 1, name: /shop all/i })).toBeVisible();
  });
});

test.describe("accessibility (PRD §12.2)", () => {
  for (const path of ["/", "/shop", "/products/oresund-table-lamp", "/search?q=lamp"]) {
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

test.describe("static pages — FR-704 full dozen (round 7, R7-3)", () => {
  const FR_704_SLUGS = [
    "our-story",
    "sustainability",
    "materials",
    "showrooms",
    "trade-program",
    "faq",
    "shipping",
    "returns",
    "privacy",
    "terms",
    "cookies",
    "accessibility",
  ];

  test("every FR-704 static page resolves (200) and renders its body", async ({ page }) => {
    for (const slug of FR_704_SLUGS) {
      const response = await page.goto(`/${slug}`);
      expect(response?.status(), `/${slug} should resolve`).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("the accessibility statement renders its WCAG 2.2 AA commitment", async ({ page }) => {
    await page.goto("/accessibility");
    await expect(page.getByText(/WCAG 2\.2 Level AA/i)).toBeVisible();
  });
});

test.describe("category pages — empty vs unknown (round 5, R5-3, FR-201)", () => {
  test("a known active category with zero products renders an honest empty state (200)", async ({ page }) => {
    // "beds" is seeded active with no products and is advertised in the
    // sitemap — it must NOT 404 (the sitemap would list a broken URL).
    const response = await page.goto("/shop/beds");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /beds/i })).toBeVisible();
    await expect(page.getByText(/no pieces here yet/i)).toBeVisible();
    await expect(page.locator('a[href^="/products/"]')).toHaveCount(0);
  });

  test("an unknown category slug still 404s (FR-201)", async ({ page }) => {
    const response = await page.goto("/shop/no-such-category-xyz");
    expect(response?.status()).toBe(404);
  });
});

test.describe("homepage FR-701 sections (R8-5)", () => {
  test("brand story teaser, materials cards, and testimonials render", async ({ page }) => {
    await page.goto("/");
    // §6 brand story teaser (links the /our-story static page)
    const story = page.getByRole("link", { name: /our story/i }).first();
    await expect(story).toBeVisible();
    // §7 materials section links the /materials static page
    await expect(page.getByRole("heading", { name: "Materials we trust" })).toBeVisible();
    const oakCard = page.getByRole("link", { name: /FSC oak/i }).first();
    await expect(oakCard).toBeVisible();
    await expect(oakCard).toHaveAttribute("href", "/materials");
    // §9 testimonials render from approved reviews (seeded, R8-5)
    await expect(page.getByRole("heading", { name: /what customers say|testimonials/i })).toBeVisible();
    const reviewQuote = page.locator("blockquote, figure, [class*=testimonial]").first();
    await expect(reviewQuote.or(page.getByText(/★★★★/).first())).toBeVisible();
  });
});

test.describe("PDP aggregateRating JSON-LD (R8-5, FR-312)", () => {
  test("Product JSON-LD carries aggregateRating when approved reviews exist", async ({ page }) => {
    await page.goto("/products/halden-linen-armchair");
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const product = blocks.map((b) => JSON.parse(b)).find((j) => j["@type"] === "Product");
    expect(product).toBeDefined();
    expect(product.aggregateRating).toBeDefined();
    expect(Number(product.aggregateRating.reviewCount ?? product.aggregateRating.ratingCount)).toBeGreaterThan(0);
    expect(Number(product.aggregateRating.ratingValue)).toBeGreaterThan(0);
    // The rendered reviews section must appear too (FR-308 read-path)
    await expect(page.getByRole("heading", { name: /reviews/i })).toBeVisible();
  });
});

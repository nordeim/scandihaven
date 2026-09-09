# Live-Site E2E Audit — Findings (Round 3)

| Field | Value |
|---|---|
| Audit ID | 2026-09-10-live-e2e-audit |
| Targets | `https://scandihaven.jesspete.shop/` (storefront :3000) · `https://scandihaven-admin.jesspete.shop/admin` (admin :3001) |
| Method | agent-browser Chromium interactive flows + route/chunk sweep via curl + repo Playwright suite executed against the live origin (`E2E_BASE_URL`) + GitHub Actions API check + code read |
| Scope | Browser E2E of customer-visible surfaces; excludes `skills/` and `infrastructure/` |
| Prior audits | 2026-09-09 rounds 1–2 (42/34-check sweeps) — several of their fixes verified live in this sweep (H1-CART cart mutations, M-404 SSR 404, M-TITLE, FR-705 notice, admin gate chain, promo rejection copy) |
| Baseline local gates at audit time | lint 8/8 · typecheck 8/8 · test 7/7 (one flaky admin guard test — see E2E-10) |

Claim labels per PRD §12.4: **Verified** (executed & observed), **Reasoned** (code-inspected trace), **Assumed** (stated assumption).

## Summary

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 3 |
| Medium | 3 |
| Low | 1 |
| Docs / hygiene | 2 |

Verified working on live (no action): home sections, PLP sort `?sort=` (5 sorts present), category subtree PLP, PDP variant swatches + `?variant=SKU` deep link (FR-302), JSON-LD Product/Offer, cart add / qty change / remove / reload persistence / repeat-add merge / multi-line (H1-CART fix confirmed live), WELCOME100 apply + humanized rejection copy (M1-PROMO), newsletter action (FR-107), SSR 404 + FR-705 lookbooks notice, typeahead API shape, admin `/admin` → `/sign-in?redirect=%2Fadmin` chain → 200, admin typed `INVALID_EMAIL_OR_PASSWORD` 401, security headers + CSP present, mobile 390px no horizontal overflow.

---

## E2E-1 — CRITICAL · Live `/checkout` hard-crashes after hydration (ChunkLoadError) and no branded root fallback exists

- **Location (live):** `https://scandihaven.jesspete.shop/checkout` — any cart, any session. **Location (repo):** missing `apps/web/src/app/global-error.tsx` (and admin equivalent).
- **Description:** SSR returns 200 with a valid checkout form, then the page is replaced by Next.js's default "This page couldn't load" UI. Root cause observed via Playwright `pageerror` capture: `ChunkLoadError: Failed to load chunk /_next/static/chunks/2oaqhtqj1yrqa.js from module 44909`. That chunk URL returns **404** while every other referenced chunk returns 200 — the deployment rebuilt (`pnpm build` over `.next/`) without restarting the running server processes, so the old process renders HTML referencing build-N chunk hashes that no longer exist on disk (build N+1). Only routes whose client chunks changed between builds break; `/checkout` (Stripe integration bundle) is the one affected route found by a full-route chunk sweep.
- **Evidence:** Playwright diagnostic run (pageerror + network trace); `curl -o /dev/null -w "%{http_code}" …/_next/static/chunks/2oaqhtqj1yrqa.js` → 404; all-route chunk sweep → only `/checkout` broken; PRD FR-508 requires an honest, working checkout surface.
- **Impact:** The primary conversion path is broken for real customers; the fallback shown is unbranded Next boilerplate, not the FR-109 honest error surface.
- **Severity:** Critical (production-path crash).
- **Recommended fix:** (a) Ops: redeploy via `./start_server.sh` (it kills prior :3000/:3001 then starts the fresh build — never leave a server running across a rebuild). (b) Code: add `global-error.tsx` to both apps with the FR-109 branded copy so boundary-escaping failures (ChunkLoadError, root-layout errors) render honest recovery UI; make `error.tsx` recover from chunk-load failures with one hard reload. (c) Docs: README troubleshooting row for "rebuilt without restart".
- **Confidence:** Verified.

## E2E-2 — HIGH · CI is red: E2E (Chromium) step fails on every recent run; 4 cart-flow specs have strict-mode violations and never ran green

- **Location:** `apps/web/e2e/cart-flows.spec.ts:81,98` (and same pattern at :47, :72); `.github/workflows/ci.yml` E2E step.
- **Description:** GitHub Actions — the last 7 runs of `main` are all `failure`, failed step = "E2E (Chromium)". Replayed locally against the live origin: 15 passed / 4 failed. All four failures are Playwright **strict-mode violations**: `getByText("€498.00")` / `€698.00` / `€747.00` legitimately match up to 3 elements (line-total `<span>` + Subtotal `<dd>` + Total `<dd>` render the same amount when there is no discount). The specs were committed in dc15724 (M2-E2E) and documented as "pinning" H1-CART, but no CI run ever executed them green — the pin is hollow.
- **Evidence:** GitHub API runs list (34342190518 et al., conclusion failure); Playwright output with `strict mode violation: getByText('€747.00') resolved to 3 elements`.
- **Impact:** Red CI masks real regressions; the H1-CART regression coverage documented in AGENTS.md/CLAUDE.md/traceability does not actually run.
- **Severity:** High.
- **Recommended fix:** Scope each price assertion to the element it means (order-summary subtotal/total `<dd>`, or the line-item group), e.g. `expect(page.getByLabel("Order summary").getByText("€498.00")).toBeVisible()` or assert on the qty-group's line total with a scoped locator; re-run the full suite against a seeded server; verify CI green after push.
- **Confidence:** Verified.

## E2E-3 — HIGH · Attached promotion is not re-validated after cart mutations — min-spend bypass visible live

- **Location:** `packages/commerce/src/promotions.ts:100` (min_spend check exists only in `evaluatePromotion`), `packages/commerce/src/cart-service.ts:254-295` (`applyPromotionByCode` validates at attach time only), `getCartDto` totals path (lines ~230-251) prices attached promos unconditionally, `packages/commerce/src/checkout-service.ts:135,283` repeats this at PaymentIntent creation and inside the placement transaction.
- **Description:** WELCOME100 has `conditionsJson = {"minSpendMinor": 50000}`. Live-verified: cart reaches €3,897 → apply WELCOME100 (−€100, correct) → remove items down to €249 subtotal → the cart still shows **Discount −€100.00, Total €149.00**. Nothing re-evaluates the promotion's conditions after the mutation, so the customer is shown — and would be charged — a discount on an order that no longer qualifies. This contradicts FR-404 (re-validate price/promotion state every read) and the FR-810 invariants spirit (conditions hold at application time).
- **Evidence:** Live cart interaction (agent-browser, same session, step-by-step); code read of the three call sites above.
- **Impact:** Money-correctness: orders can be placed with an ineligible discount applied.
- **Severity:** High.
- **Recommended fix (TDD):** In `getCartDto`, re-evaluate each attached promotion against the current subtotal and drop ineligible ones from the pricing input (and return the authoritative state to the UI); add the same guard in `loadCartPromotionApplications` used by placement. Regression tests: (1) attach → shrink below min-spend → discount gone, (2) re-attach after crossing threshold again works, (3) placement prices with the re-validated set.
- **Confidence:** Verified (live behavior + code trace).

## E2E-4 — MEDIUM · PLP/home card price uses MIN(variant price) and mismatches PDP default variant, JSON-LD, and quick-add

- **Location:** `packages/commerce/src/catalog.ts:168` (`MIN(vp.amount) AS amount`).
- **Description:** Øresund Table Lamp card (home + PLP) shows **€229.00** — the Matte-black variant price — while the PDP default variant (Brushed brass), the PDP JSON-LD offer, and the cart line after add all say **€249.00**. The card's quick-add/PDP default is the €249 variant, so the card price advertises a price the customer will not pay by default.
- **Evidence:** Live HTML (`priceMinor: 22900` serialized card DTO; PDP JSON-LD `"price":"249.00"`); seed `ensure-seeded.ts:126-127` (BRS isDefault €24,900; BLK €22,900).
- **Impact:** Misleading price display (UX/trust; potential compliance exposure in some markets for shown-vs-charged price).
- **Severity:** Medium.
- **Recommended fix (TDD):** Price cards from the **default variant** with MIN as fallback: `COALESCE(MAX(vp.amount) FILTER (WHERE pv.is_default), MIN(vp.amount))` (compare-at likewise). Update/extend `catalog-query.test.ts` (real-PG suite runs in CI).
- **Confidence:** Verified.

## E2E-5 — MEDIUM · `/account` gate drops the `redirect` param and storefront sign-in ignores `redirect` (FR-602 deviation)

- **Location:** `apps/web/src/app/account/page.tsx:24` (`redirect("/sign-in")`); `apps/web/src/app/sign-in/page.tsx` (always `router.push("/account")`).
- **Description:** Live: unauthenticated `/account` 307s to `/sign-in` **without** `?redirect=`. After sign-in the customer always lands on `/account` regardless of where they started. PRD FR-602 requires the redirect param flow; the admin app already implements the pattern (including its `sign-in-paths` tests).
- **Evidence:** `curl -I /account` → `location: /sign-in`; code read.
- **Impact:** Post-sign-in return path lost (UX); inconsistent with admin app; FR-602 partial.
- **Severity:** Medium.
- **Recommended fix (TDD):** `redirect(\`/sign-in?redirect=${encodeURIComponent("/account")}\`)`; sign-in page reads `useSearchParams().get("redirect")`, validates it is a same-origin path (starts with `/`, not `//`, no scheme — open-redirect guard, mirroring admin's `sign-in-paths.ts`), then routes there. Unit test for the validator; E2E assertion for the return path.
- **Confidence:** Verified.

## E2E-6 — MEDIUM · No mobile navigation exists at all — primary nav unreachable under 768px (FR-102 not actually implemented)

- **Location:** `apps/web/src/components/site-header.tsx:45` (`className="hidden … md:flex"`); no hamburger/drawer component anywhere in `apps/web/src`.
- **Description:** Live at 390px viewport the header renders only logo / Account / cart. There is no menu button in the DOM; Shop/Collections/Journal/Our Story are unreachable on mobile except via footer. `docs/traceability.md:12` claims FR-102 "Aligned (core)" via `site-header.tsx` — the component contains no such feature (documentation overclaim, same pattern the 2026-09-09 audit corrected for FR-104/FR-703).
- **Evidence:** Live browser inspection at 390px (aria inventory of header); repo-wide grep for mobile-nav components (none); traceability row 12.
- **Impact:** Mobile customers (majority of fashion/lifestyle traffic) cannot navigate the catalog; FR-102 (Must-ship v1) missing; docs overstate alignment.
- **Severity:** Medium (High for mobile-first business, Medium engineering severity — additive feature).
- **Recommended fix (TDD):** Implement a mobile menu drawer in `site-header.tsx` using the existing `packages/ui` Radix primitives (Dialog/Sheet pattern), `aria-expanded` trigger, focus-trapped, `prefers-reduced-motion` respected; a "Menu" button visible below `md`. Update traceability FR-102 row to the new state with locus + verification.
- **Confidence:** Verified.

## E2E-7 — LOW · CSP blocks the Cloudflare Insights beacon on every page (production console errors)

- **Location:** `packages/config/src/security-headers.ts` (script-src / connect-src lists).
- **Description:** The site is served behind Cloudflare which injects its RUM beacon (`https://static.cloudflareinsights.com/beacon.min.js/…`). The manifest's `script-src 'self' 'unsafe-inline' https://js.stripe.com` blocks it — console error on every page of the live site (verified on home, PDP, checkout).
- **Evidence:** Playwright console capture against live origin; `report-to: cf-nel` headers confirm Cloudflare fronting.
- **Impact:** No functional break; continuous console noise, telemetry lost, CSP-policy-drift from the real deployment environment.
- **Severity:** Low.
- **Recommended fix (TDD):** Add `https://static.cloudflareinsights.com` to `script-src` and `https://cloudflareinsights.com` to `connect-src` in the manifest + update its unit test; document why (edge-injected beacon).
- **Confidence:** Verified.

## E2E-8 — HIGH (SEO) · Canonical URLs resolve to `http://localhost:3000` on the live origin

- **Location:** `apps/web/src/app/layout.tsx:23` (`metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")`); `packages/config/src/env.ts:64` (same default); deployment env lacks `NEXT_PUBLIC_SITE_URL`.
- **Description:** Live PDP `<link rel="canonical" href="http://localhost:3000/products/halden-linen-armchair"/>`. Every canonical/OG URL on the live site points at localhost — actively harmful to SEO (FR-313 canonical intent) and social previews.
- **Evidence:** `curl` of live PDP; code read.
- **Impact:** Search engines may index the wrong origin; duplicate-host signals.
- **Severity:** High for the deployed site (one env var) — code change is a boot-time guard.
- **Recommended fix (TDD):** Add a production boot check in `apps/web/src/instrumentation.ts` (and admin): when `NODE_ENV=production` and `NEXT_PUBLIC_SITE_URL` is unset/localhost, log a loud actionable warning naming the env var and the SEO impact (fail-fast would break the existing deployment contract — a warning is the honest, non-breaking guard). Docs: README troubleshooting row. Ops: set `NEXT_PUBLIC_SITE_URL=https://scandihaven.jesspete.shop` on the storefront deployment (and the admin origin for the admin app).
- **Confidence:** Verified.

## E2E-9 — DOCS · Traceability label errors and stale "Aligned" claims

- **Location:** `docs/traceability.md` rows FR-105/FR-108 (announcement bar mislabeled as FR-105; FR-105 is search typo tolerance), FR-504/FR-505 (FX lock mislabeled as 504), FR-102 (claimed Aligned — actually missing, E2E-6), checkout honest-state row (currently false on live until E2E-1 redeploy).
- **Impact:** Same class of overclaim the 2026-09-09 audit corrected; misleads future agents.
- **Recommended fix:** Correct the FR IDs and statuses in this remediation's docs pass.
- **Confidence:** Verified (PRD cross-read).

## E2E-10 — HYGIENE · Flaky admin guard test under parallel turbo; diagnostic spec to be removed

- **Location:** `apps/admin/src/guard.test.ts` ("maps ForbiddenError…") flaked once in a full `pnpm test` run and passed on isolation + re-run (Better-Auth baseURL warning suggests env timing sensitivity); `apps/web/e2e/debug-checkout.spec.ts` is a diagnostic spec from this audit and must not remain in the suite.
- **Recommended fix:** Remove the diagnostic spec before commit; re-run admin suite repeatedly to confirm whether the flake reproduces — if it does, stabilize (this pass: no reproduction, monitoring only).
- **Confidence:** Verified (single flake observed once).

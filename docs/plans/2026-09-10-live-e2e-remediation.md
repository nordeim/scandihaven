# Live-Site E2E Remediation Plan (Round 3)

| Field | Value |
|---|---|
| Plan ID | 2026-09-10-live-e2e-remediation |
| Parent audit | `docs/audits/2026-09-10-live-e2e-audit/findings.md` (E2E-1..E2E-10) |
| Method | TDD (red → green) at public seams per repo convention; one atomic commit per slice; Conventional Commits on `main` |
| Exclusions | `skills/`, `infrastructure/` (per operator instruction — no checks/tests/compilation) |
| Ops actions (outside repo, called out) | Full redeploy via `./start_server.sh` (fixes E2E-1 live crash); set `NEXT_PUBLIC_SITE_URL` on both deployments; rotate leaked secrets (carried from 2026-09-09 C2r); align Stripe env (publishable set / secret missing); one-time cleanup of junk UUID-shaped cart rows |

## Seam validation (done 2026-09-10, before execution)

- Slice 1: cart `<aside>` lacks an accessible name; checkout's aside already has `aria-label="Order summary"` — reuse that name. QuantityStepper exposes `role="group"` + per-product label (verified `packages/ui/src/components/composites/quantity-stepper.tsx:29-46`).
- Slice 2: `loadCartPromotionApplications` currently selects only `{id, kind, value}` — extend with `conditionsJson`, `startsAt/endsAt`, `isActive`; `evaluatePromotion`/`PromotionContext` are public in `promotions.ts`; `cart.userId` is nullable → `isGuest = userId === null`. Integration seam pattern exists (`checkout-promotions.integration.test.ts`, fixture-scoped UUIDs + `skipIf(!dbReady)`).
- Slice 3: `is_default` column confirmed (`packages/db/src/schema/catalog.ts:109`).
- Slice 4: admin's `sign-in-form.tsx` uses the raw `searchParams.get("redirect") ?? "/"` — **unvalidated** (open-redirect hole). The validator is shared and applied to BOTH apps; admin hardening folds into this slice.
- Slice 5: `Drawer`/`DrawerTrigger`/`DrawerContent` primitives exist in `packages/ui` with the FR-102 mobile-nav use case named in their docstring.
- Slice 6: `instrumentation.ts` `register()` exists in both apps; `security-headers.test.ts` is the red-first seam for CSP.

## Slices (ordered by severity; each maps to finding IDs)

### Slice 1 — E2E-2: Repair the 4 broken cart-flow E2E specs (un-red CI)

- **Seam:** Playwright user-visible UI (order-summary `<dl>` region, line-item qty group).
- **Change:** Scope each `getByText("€X")` price assertion to the element it means (subtotal/total in the Order summary region via `getByRole("region")`/`aria-label`, line total via the line group) instead of page-wide text matching; keep strict mode on.
- **Tests:** The 4 specs must pass unchanged in *intent* (same user-visible contract) — verified by running the suite against a live-origin target.
- **Gate:** `E2E_BASE_URL=<live> pnpm exec playwright test --project=chromium` → 19/19 (15 passing + 4 repaired). CI green after push.

### Slice 2 — E2E-3: Re-validate attached promotions on every cart read (money correctness)

- **Seam:** `getCartDto(cartId)` public return (CartDto totals/discount) + `loadCartPromotionApplications` used by placement pricing.
- **Red tests first:**
  1. `cart-service` integration-style unit (DB-backed suite, CI-executed): attach WELCOME100-shaped promo (minSpend 500) → shrink cart to €249 → `getCartDto` reports `discountMinor: 0` and the promo row is no longer priced in.
  2. Re-cross the threshold → promo prices in again (no lost legitimate discount, no dangling state).
  3. `checkout-service` placement test: placement totals computed from the re-validated set (ineligible promo dropped inside the placement transaction).
- **Implementation:** In `getCartDto`, after loading attached promotions, run `evaluatePromotion` per promo against the current subtotal and drop ineligible ones before `computeCartTotals` (same for `loadCartPromotionApplications`); keep the `cart_promotion` row so re-crossing the threshold re-applies (documented in code comment).
- **Property/invariant:** discount ≤ subtotal−eligible cap already covered by pricing tests; add explicit min-spend regression case to `promotions.test.ts`.
- **Gate:** `pnpm --filter @scandihaven/commerce test`; full `pnpm lint typecheck test`.

### Slice 3 — E2E-4: Card price = default-variant price (consistency with PDP/JSON-LD/quick-add)

- **Seam:** `listProducts` → `ProductCardDto.priceMinor` (+ `compareAtMinor`).
- **Red test:** `catalog-query.test.ts` (real-PG, CI): seed-shaped product with default variant €249 + cheaper non-default €229 → card `priceMinor === 24_900`; a product without a default variant falls back to MIN.
- **Implementation:** `catalog.ts` cards CTE: `COALESCE(MAX(vp.amount) FILTER (WHERE pv.is_default), MIN(vp.amount)) AS amount` and same shape for compare_at.
- **Gate:** commerce suite + full gates.

### Slice 4 — E2E-5: `/account` redirect param + sign-in return path (FR-602)

- **Seam:** server `redirect()` call in `account/page.tsx`; `useSearchParams` read in `sign-in/page.tsx`; pure path validator.
- **Red tests first:**
  1. Pure validator unit (`apps/web/src/lib/redirect-path.test.ts`): accepts `/account`, `/shop?sort=price_asc`; rejects `https://evil.example`, `//evil.example`, `javascript:alert(1)`; defaults to `/account` when null.
  2. E2E: unauthenticated `/account` → sign-in shows `?redirect=%2Faccount`; (authenticated-path assertion kept light — no seeded credentials in repo).
- **Implementation:** mirror admin's `sign-in-paths.ts` pattern into `apps/web/src/lib/redirect-path.ts` (single source, tested); sign-in routes to the validated path after success.
- **Gate:** web unit suite + e2e storefront spec.

### Slice 5 — E2E-6: Mobile navigation drawer (FR-102, real implementation)

- **Seam:** header DOM — a `Menu` button visible below `md`, Radix-based dialog/drawer exposing the 4 primary links; a11y contract (label, focus trap, Escape close, reduced-motion).
- **Red test:** E2E at 390×844 viewport: menu button visible, opens dialog listing Shop/Collections/Our Story/Journal, link navigates, Escape closes. (Axe scan runs on key routes already.)
- **Implementation:** new `apps/web/src/components/mobile-nav.tsx` (client) using `@scandihaven/ui` dialog primitive; wired into `site-header.tsx` server component (server reads nothing new; drawer content mirrors the static links; announcement-bar-free).
- **Docs:** traceability FR-102 row → Aligned (core) with true locus + verification note.
- **Gate:** e2e storefront + axe clean; full gates.

### Slice 6 — E2E-1 (code half) + E2E-7 + E2E-8: Honest root error UI, CSP beacon allow-list, production site-URL boot guard

1. **global-error.tsx (both apps):** branded FR-109 copy ("An unexpected error occurred" + retry) so boundary-escaping failures (ChunkLoadError from stale-deploy, root errors) stop rendering Next boilerplate; `error.tsx` gains one-time `window.location.reload()` when the error message matches a chunk-load failure (stale chunk self-heal).
   - Test: unit-render the components (vitest) asserting honest copy + retry affordance; e2e asserts `/checkout`-style recovery is not boilerplate (smoke: error boundary copy exists in both apps' bundles is NOT directly assertable in e2e — keep to unit level).
2. **security-headers.ts:** `script-src += https://static.cloudflareinsights.com`, `connect-src += https://cloudflareinsights.com` (edge-injected RUM beacon). Red test first in the existing manifest test (assert the new origins; assert the rest unchanged).
3. **instrumentation.ts (both apps):** production-only warning when `NEXT_PUBLIC_SITE_URL` is missing/localhost — actionable log naming the env var + SEO consequence. Red test in `env`/boot test space (parseFlags/env unit seam), non-breaking (warn, not throw).

### Slice 7 — E2E-9/10 + docs alignment

- `docs/traceability.md`: fix FR-105→FR-108 announcement bar, FR-504→FR-505 FX, FR-102 status → real state, add round-3 audit row, update loci touched by slices 2-5.
- README: troubleshooting rows — "rebuilt without restart" stale-chunk crash (E2E-1), canonical localhost (E2E-8); ops checklist reiteration (redeploy, NEXT_PUBLIC_SITE_URL, secret rotation, Stripe env alignment, junk-cart cleanup).
- AGENTS.md/CLAUDE.md: one-line each where conventions changed (global-error contract, promo re-validation rule, card-price rule) — keep terse per their charters.
- Remove `apps/web/e2e/debug-checkout.spec.ts`; ensure no `test-results/` artifacts committed.

## Validation plan (Definition of Done)

1. `pnpm lint typecheck test build` all green locally (8/8, 8/8, 7/7, 2/2).
2. `E2E_BASE_URL=<live> pnpm exec playwright test --project=chromium` → all specs green (except none skipped silently).
3. New regression tests demonstrated red→green (each slice lists its seam).
4. `git ls-files` clean of artifacts; secret scan replay clean.
5. CI green on the pushed commit (verified via GitHub API after push).
6. Live verification after operator redeploys: `/checkout` renders form (no error boundary), canonical shows public origin, mobile menu present.

## Explicit non-goals (recorded, not "fixed" silently)

- Reservation two-phase protocol (B1), promotion usage-limit enforcement (B3), free_shipping/tiered promo kinds (M1d), shipping-cost decision (deviation #6), 2FA/magic-link (deviation #4) — remain tracked per ledger; out of scope for this live-E2E remediation.
- No dependency additions (Radix dialog already present via ui package), no lockfile churn.

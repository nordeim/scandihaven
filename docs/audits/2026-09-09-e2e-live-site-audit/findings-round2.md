# E2E Live-Site Audit — Round 2 (2026-09-09, scandihaven.jesspete.shop + scandihaven-admin.jesspete.shop)

Mode C (audit) output per the operating contract: findings ordered by severity, each with
location, description, evidence, impact, severity, recommended fix, and confidence
(Verified = executed and observed / Reasoned = logical inference from code / Assumed).

Targets: storefront `https://scandihaven.jesspete.shop/` (≈ localhost:3000), admin
`https://scandihaven-admin.jesspete.shop/admin` (≈ localhost:3001). Deployment routing was
re-verified this pass: host-based passthrough — the apps receive public paths **verbatim**
(no `/admin` prefix stripping); the storefront and admin apps each own their whole hostname.

Method: 34-check HTTP route sweep (curl, both apps, no-follow redirect inspection), interactive
Chromium flows via agent-browser (home → PLP → PDP → add-to-cart → drawer → cart → promo codes →
qty stepper → remove → repeat-add → multi-line → checkout → newsletter → storefront sign-in probe →
admin gate + admin sign-in probe), network/console inspection, targeted source review of every
failing path, local gates after clone (`pnpm lint` 8/8, `pnpm typecheck` 8/8, `pnpm test` 7/7,
`pnpm build` 2/2 — all executed green pre-fix). No Docker/PG in the audit sandbox, so real-PG
integration suites and Playwright E2E auto-skip locally (CI executes them).

Summary: **0 Critical · 2 High · 2 Medium · 2 Low · 3 Informational.** All nine round-1 fixes
held up live (H-AUTH origin trust, M-SH slug, M-404 SSR, M-FAQ, M-TITLE, M-COL, M-HLTH, C2r
untrack, C-CI scan). The dominant new failure is cart mutations behind an existing cart cookie.

---

## High

### H1-CART — `requireCart()` feeds the resolved cart UUID into token-keyed `ensureCart()`; every cart mutation after the first add is broken
- **Location**: `apps/web/src/actions/cart.ts:26-27` (`requireCart`), with
  `packages/commerce/src/cart-service.ts:77-92` (`ensureCart` lookup on `cart.token`) and
  `apps/web/src/lib/cart-session.ts` (`getCartId()` returns the cart row **UUID**).
- **Description**: `getCartId()` resolves the signed cookie token to the cart's UUID. When a
  cart already exists, `requireCart()` returned `ensureCart(existing)` — passing the UUID where
  `ensureCart` expects the **token**. The token lookup misses (`cart.token` holds the random
  token, not a UUID), so `ensureCart` falls through to its insert branch and **mints a new junk
  cart row whose token is the UUID string**, returning that junk cart's id. Every subsequent
  mutation (qty update, remove, add, promo apply) then operates on the junk cart while the
  customer's cookie still points at their real cart. The bug shipped in the initial storefront
  commit (`a811db2`) and survived two audits because the smoke E2E only exercises the first
  add of a fresh context (the only path that works).
- **Evidence (all live, agent-browser, 2026-09-09)**:
  1. Cart page qty stepper: click **Increase** → alert "Cart line not found", qty stays 1,
     subtotal stays €249.00 (reproduced twice, incl. a clean single-click repro).
  2. Remove: click **Remove** → UI shows "Your cart is empty" → reload → the line is back
     (header count "1 item", line visible). Server truth never changed.
  3. Repeat add (same variant, cookie present): drawer/DTO shows qty 1, €249.00; `/cart`
     server truth: 1 line, €249.00 — the second unit is silently discarded.
  4. Multi-line add (Øresund €249 then Halden €1,299, cookie present): drawer shows only the
     original line; `/cart` server truth: 1 line, €249.00 — the added product is silently lost
     after `router.refresh()`.
  5. Consistent low-level confirmation: `POST /api/auth/sign-in/email` returned 401
     `INVALID_EMAIL_OR_PASSWORD` while Server Actions executed (promo errors surfaced), proving
     cookies/actions work — the failure is the identity seam, not the cookie.
  Local unit repro (post-audit): `apps/web/src/actions/cart.test.ts` — 5 wiring tests red
  against the unfixed code (service receives a different cart id than `getCartId()` returned;
  `ensureCart` called with the UUID).
- **Impact**: Guests cannot change quantity anywhere (cart page or drawer), removals lie and
  resurrect on reload, and every add after the first is silently dropped — revenue loss on a
  core commerce path. Also pollutes the DB with junk `cart` rows (`token` = a UUID string)
  on each mutation attempt (ops cleanup required; see plan).
- **Severity**: High (common-path correctness on the money-adjacent surface; no data exposure).
  **Confidence**: Verified (live repro + unit repro + code trace).
- **Recommended fix**: in `requireCart`, return the resolved UUID untouched:
  `if (existing) return existing;`. Keep `ensureCart(token)` for the fresh-cart branch only.
  Pin the invariant with unit wiring tests and a cart-mutation E2E spec (added:
  `apps/web/e2e/cart-flows.spec.ts`). Note `checkout` was **not** affected
  (`apps/web/src/actions/checkout.ts` already passes `getCartId()` straight through).

### H2-ADMIN — Canonical `/admin`-prefixed URL has no matching app route; post-sign-in landing 404s
- **Location**: `apps/admin` route inventory (routes live at the root: `/`, `/products`,
  `/orders`, `/customers`, `/sign-in` — there is no `/admin` route, no `basePath`, no rewrites);
  `apps/admin/src/proxy.ts` (gate sets `?redirect=<prefixed path>`); interaction with the
  deployment's host-based passthrough.
- **Description**: The public admin URL is `https://scandihaven-admin.jesspete.shop/admin`.
  The reverse proxy forwards paths verbatim, so the admin app receives `/admin`, a path it
  does not route. Anonymous flow accidentally works: the proxy gate bounces to
  `/sign-in?redirect=%2Fadmin`. After a successful sign-in, `AdminSignInForm` does
  `router.push("/admin")` — which renders the app's 404, not the dashboard.
- **Evidence**: live raw requests (no redirect follow): `/admin` → 307 →
  `/sign-in?redirect=%2Fadmin`; `/admin/api/health` → 307 (gated, then 404 for staff);
  `/admin/sign-in` → 307; unprefixed `/sign-in` and `/api/health` → 200. Gate redirect
  parameter proves the app saw the prefixed path (a stripping proxy would have produced
  `?redirect=%2F`). Route inventory verified in source. Post-sign-in 404 rendering is
  Reasoned (no `/admin` route exists; needs staff credentials to execute end-to-end).
- **Impact**: Staff signing in from the canonical URL land on a 404; every `/admin/*`
  deep link breaks for authenticated sessions. The dashboard is reachable only at the bare
  host root.
- **Severity**: High (breaks the primary back-office entry point on the deployed
  environment). **Confidence**: Verified (routing + gate behavior live); the final
  post-sign-in render is Reasoned.
- **Recommended fix**: strip the prefix in-app — `beforeFiles` rewrites in
  `apps/admin/next.config.ts` (`/admin` → `/`, `/admin/:path*` → `/:path*`) plus a gate
  allowance for `/admin/sign-in` (`isSignInPath`, `apps/admin/src/lib/sign-in-paths.ts`),
  both pinned by unit tests. Requires redeploy to take effect on the live site.

---

## Medium

### M1-PROMO — Promotion rejection leaks internal reason codes to shoppers
- **Location**: `packages/commerce/src/cart-service.ts` (`applyPromotionByCode` —
  `` throw new CartError(`Promotion not applicable (${evaluation.reason})` …) ``).
- **Evidence**: live cart with €249 subtotal, applying `WELCOME100` renders
  "Promotion not applicable (min_spend)" — a raw internal token, in the UI.
- **Impact**: Unpolished, confusing error copy on a customer-facing surface (FR-404 adjacent).
- **Severity**: Medium (copy quality on a common path). **Confidence**: Verified (live).
- **Recommended fix**: humanize all eight `PromotionRejection` codes via a pure map
  (`humanizePromotionRejection` in `packages/commerce/src/promotions.ts`) and throw with the
  customer copy; pin with unit tests (`promotion-rejection-copy.test.ts`).

### M2-E2E — E2E suite has zero coverage of cart mutation paths
- **Location**: `apps/web/e2e/storefront.spec.ts` (no qty stepper / remove / repeat-add /
  multi-line / promo-success coverage anywhere in the suite).
- **Evidence**: spec inventory — the only cart interaction is a single first add-to-cart from
  a fresh context; quantity and remove are never clicked.
- **Impact**: The exact class of bug as H1-CART (post-cookie mutation wiring) cannot regress
  the suite; H1-CART shipped in the initial commit and survived the round-1 live audit's
  interactive pass because only first-add was probed there too.
- **Severity**: Medium (coverage gap on the highest-traffic mutation surface).
  **Confidence**: Verified (spec inventory).
- **Recommended fix**: add `apps/web/e2e/cart-flows.spec.ts` — six scenarios, each mutating an
  existing cart and asserting server truth across a reload (qty ±, remove persistence,
  repeat-add merge, multi-line subtotal, promo rejection copy + apply + persistence). Executed
  in CI (needs migrated+seeded PG); locally auto-skipped in this sandbox (no Docker/PG).

---

## Low

### L1-NEWS — Newsletter form lives on the home page only; footer carries no newsletter (FR-107 wording)
- **Location**: `apps/web/src/app/page.tsx` renders `NewsletterForm`; `site-footer.tsx` has
  only link groups.
- **Evidence**: live footer snapshot (both apps' storefront pages) shows Help/About link
  groups, no form; home page form works ("Thank you — please check your inbox to confirm.").
- **Impact**: Traceability wording drift (FR-107 "Footer newsletter"); the requirement's
  substance (newsletter capture + double opt-in message) is met on the home page.
- **Recommended fix**: documentation correction (done in `docs/traceability.md`); moving the
  form into the footer is a Phase-1 product decision, not a defect. **Confidence**: Verified.

### L2-MSG — Cart mutation failure copy is technically accurate but bare ("Cart line not found")
- **Location**: `packages/commerce/src/cart-service.ts` `updateLineQty` NOT_FOUND message
  surfaced verbatim by `cart-view.tsx`.
- **Impact**: With H1-CART fixed this should never appear in practice; if it does (stale tab
  after a server-side cart change), the message doesn't tell the shopper what to do next.
- **Recommended fix**: Phase-1 copy pass ("This item is no longer in your cart — refresh to
  see the latest"). Deferred to keep this slice surgical. **Confidence**: Verified (message
  surfaced live pre-fix; the fix removes the common trigger).

---

## Informational

### I-AUTH — Auth origin trust verified live on both apps (round-1 H-AUTH fix holds)
- Storefront and admin sign-in probes return 401 `INVALID_EMAIL_OR_PASSWORD` (never
  `INVALID_ORIGIN`) and both apps render proper error feedback ("Invalid email or password").
- **Confidence**: Verified.

### I-CHK — Checkout honest state verified live (FR-508)
- Guest address step submits; payment step surfaces "Stripe is not configured: set
  STRIPE_SECRET_KEY in .env (test mode keys)." — matches the deployment's intentionally
  keyless state (start_server_log warning). Ops still to align
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (round-1 L-STR: js.stripe.com loads client-side).
- **Confidence**: Verified.

### I-OPS — Junk cart rows from H1-CART need one-time cleanup after redeploy
- Every pre-fix mutation attempt inserted a `cart` row with `token` = a UUID string and zero
  or stray lines. Distinguishing shape: `token ~ '^[0-9a-f-]{36}$'` (real tokens are
  `<24 hex>.<32 hex>`). Ops: after redeploying the fix, delete those rows (guest carts, no
  orders reference them). Not executable from this sandbox.
- **Confidence**: Reasoned (code path verified; DB not accessible from the audit sandbox).

---

## What passed (evidence-backed, not inflated)

- 33/34 HTTP route checks: home, PLP (+sort/page/category), both seeded PDPs, cart, checkout,
  checkout/success, collections (+ both seeded slugs), journal, sign-in, account gate (307),
  all six static pages incl. FAQ, branded 404, lookbooks honest 404, typeahead (happy + short
  query), health, jobs/run 401, webhook no-sig 405. (The one "failure" was this audit's own
  sweep using an unseeded collection slug — corrected to the seeded slugs, both 200.)
- Security headers on every checked route of both apps: CSP, HSTS (preload), nosniff, DENY,
  strict-origin-when-cross-origin, request IDs on storefront.
- Interactive flows verified healthy: newsletter submit (status message), announcement bar,
  drawer open/close, breadcrumb nav, PDP variant swatches, checkout address validation UI.
- Round-1 fixes re-verified live: single PDP title suffix (M-TITLE), FAQ page (M-FAQ), branded
  SSR 404 (M-404), FR-705 lookbooks notice, admin gate 307 (M-SH/admin gate), CSP on admin
  sign-in.
- Local gates post-clone (pre-fix): lint 8/8, typecheck 8/8, test 7/7 (81 commerce/web/auth/
  db/admin/config tests + 12 skipped real-PG), build 2/2.

# E2E Live-Site Audit — 2026-09-09 (scandihaven.jesspete.shop + scandihaven-admin.jesspete.shop)

Mode C (audit) output per the operating contract: findings ordered by severity, each with
location, description, evidence, impact, recommended fix, and confidence
(Verified = executed and observed / Reasoned = logical inference from code / Assumed).

Targets: storefront `https://scandihaven.jesspete.shop/` (≈ localhost:3000), admin
`https://scandihaven-admin.jesspete.shop/admin` (≈ localhost:3001, reverse-proxied under an
`/admin` prefix rewrite that preserves the app's own routing).

Method: 42-check HTTP route sweep (both apps), interactive Chromium flows via agent-browser
(home → PLP → PDP → add-to-cart → drawer → cart → promo code → checkout → sign-in → admin
gate/sign-in), console/network inspection, targeted source review of every failing path.
Unit/lint/typecheck gates re-run locally after clone (all green: 8/8, 8/8, 7/7).

Summary: **2 Critical · 1 High · 6 Medium · 4 Low · 3 Informational**. 40/42 route checks and
all interactive browse/add-to-cart/cart/checkout-config flows passed; auth and secret
hygiene are the dominant failures.

---

## Critical

### C2r — Secrets re-exposed: `.env`, `.env.local`, `docs/bak.env` are git-tracked again
- **Location**: repo root `.env`, `.env.local`; `docs/bak.env`; commit `262d3cc` ("env", 2026-09-09).
- **Description**: Commit `dd352c6` ("chore(security): untrack .env and .env.local — audit C2")
  removed the files from the index; the later commit `262d3cc` re-added all three
  (`git show --stat 262d3cc`: `.env`, `.env.local`, `docs/bak.env` each +45 lines). A fresh
  clone today contains `BETTER_AUTH_SECRET` (44-char base64, non-placeholder), `CRON_SECRET`
  (32-hex, non-placeholder), `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…`,
  and `DATABASE_URL` with password, in all three files. `.gitignore` lists `.env`/`.env.local`
  but gitignore does not untrack files, and `docs/bak.env` is not covered by any ignore rule.
- **Evidence**: `git ls-files | grep -E '^\.env'` → `.env`, `.env.example`, `.env.local`;
  `git log --oneline -- .env` shows add→untrack→re-add sequence; value shapes characterized
  programmatically (lengths/alphabets) without printing them.
- **Impact**: Public exposure of every secret in the deployment. Cart-cookie and auth HMAC
  forgeable, cron endpoint callable, test-mode Stripe key leaked, DB credentials disclosed.
  (Stripe keys are test-mode; the auth/cron secrets are live deployment secrets.)
- **Severity**: Critical. **Confidence**: Verified.
- **Recommended fix**: `git rm --cached .env .env.local docs/bak.env`; add
  `docs/bak.env` / `**/bak.env` to `.gitignore`; rotate every exposed value (ops — cannot be
  executed from this sandbox; must be flagged). See also C-CI for the gate gap that let this
  land silently.

### C-CI — CI secret scan cannot see gitignored-but-tracked files (`rg` respects .gitignore)
- **Location**: `.github/workflows/ci.yml` secret-scan step (line ~88).
- **Description**: The scan invokes `rg --hidden` with `-g` excludes but **without
  `--no-ignore`**. ripgrep honors `.gitignore`, so `.env` and `.env.local` — precisely the
  files C2 was about — are invisible to the scan whenever they are (re)committed while
  ignored. Verified locally: the exact CI command matches `docs/bak.env` (not ignored) but
  not `.env`/`.env.local` (ignored+tracked); adding `--no-ignore` surfaces both.
- **Evidence**: local run of the CI `rg` invocation, exit 0, only `docs/bak.env` hits;
  identical command + `--no-ignore` → `.env`/`.env.local` hits.
- **Impact**: The guardrail that blocks secret commits is structurally blind to the highest-
  risk files; C2r regressed with no CI signal.
- **Severity**: Critical (broken guardrail on the most sensitive asset). **Confidence**: Verified.
- **Recommended fix**: add `--no-ignore` to the scan invocation (existing `-g` excludes already
  cover `.git/`, `node_modules/`, `.next/`, lockfile, `.env.example`; extend with `!.turbo/`,
  `!coverage/`, `!playwright-report/`, `!test-results/` so scratch dirs don't noise the gate).

---

## High

### H-AUTH — Sign-in returns "Invalid origin" on both live apps (production auth broken)
- **Location**: `packages/auth/src/server.ts:24` (`url: process.env.BETTER_AUTH_URL ??
  "http://localhost:3000"`); manifests at both `/api/auth/[...all]` handlers.
- **Description**: Every sign-in POST on the live deployments fails with Better-Auth
  `INVALID_ORIGIN`. Better-Auth 1.7.3 validates the browser `Origin` header against
  `trustedOrigins` (derived from the configured base URL) on any POST that carries cookies —
  and the cart cookie (`sh_cart`) is set long before sign-in for most shoppers. The deployed
  env keeps `BETTER_AUTH_URL` at a localhost value (repo `.env`: `http://localhost:…`), so the
  live origin `https://scandihaven(-admin).jesspete.shop` is not trusted. A fresh browser with
  zero cookies silently skips the check on the first POST, then fails on every subsequent
  auth call once a session/cart cookie exists.
- **Evidence**: agent-browser live runs — storefront sign-in form → alert "Invalid origin";
  admin sign-in form → alert "Invalid origin". Root cause confirmed against
  `better-auth@1.7.3` `dist/api/middlewares/origin-check.mjs` (`validateOrigin` →
  `isTrustedOrigin(originHeader)`; trusted set = baseURL + `options.trustedOrigins`).
- **Impact**: Complete auth outage in production: no customer sign-in, no admin back-office
  access. Checkout guest flow still works; account flows do not.
- **Severity**: High (common-path breakage; not a data-loss/security hole). **Confidence**: Verified (live repro + library source).
- **Recommended fix**: keep CSRF protection intact (do **not** blanket-trust the request
  `Origin` — that is attacker-controlled). Add a `trustedOrigins` configuration that (a)
  includes env-declared origins (`BETTER_AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, optional
  `AUTH_TRUSTED_ORIGINS` list) and (b) via Better-Auth's function form, derives the
  same-origin entry from the **request's own Host/`x-forwarded-host` + proto** — headers only
  the serving infrastructure controls, which is the standard Origin-vs-Host CSRF check and is
  safe behind the reverse proxy. Unit-test the pure helper; document that
  `BETTER_AUTH_URL` must be the public origin in production.

---

## Medium

### M-SH — `start_server.sh` health check uses a non-existent product slug
- **Location**: `start_server.sh:447` — `check "storefront product PDP" ".../products/halden-armchair" "Halden"`.
- **Description**: The seeded slug is `halden-linen-armchair`
  (`packages/db/src/seed/ensure-seeded.ts:83`); the check 404s and fails every fresh-clone
  boot despite a healthy stack.
- **Evidence**: `start_server_log.txt:144-150` — `storefront product PDP … HTTP 404 (want
  200/307)` → `[fail] Health check failed`; live `curl …/products/halden-armchair` → 404
  while `…/halden-linen-armchair` → 200.
- **Impact**: False-negative boot gate; start_server.sh always reports failure on a healthy system.
- **Severity**: Medium. **Confidence**: Verified.
- **Recommended fix**: point the check at `/products/halden-linen-armchair`.

### M-404 — Custom 404 ships an empty SSR payload (client-only render)
- **Location**: `apps/web/src/app/not-found.tsx` (`"use client"` + `usePathname`).
- **Description**: The root not-found is a client component, so the server-rendered HTML for
  unmatched routes is an empty Suspense shell — `<div hidden><!--$--><!--/$--></div>` — and
  the branded content ("This page has wandered off", recovery links) appears only after
  hydration. Browsers show it fine; crawlers, curl, and JS-disabled clients see a blank page.
  FR-109's recovery paths are effectively invisible to non-hydrated clients.
- **Evidence**: live `GET /this-page-does-not-exist` → 404 with 12KB HTML containing zero
  visible text (title only); agent-browser snapshot after hydration shows the full branded page.
- **Impact**: SEO/robustness degradation of a required surface (FR-109); flash of empty content.
- **Severity**: Medium. **Confidence**: Verified.
- **Recommended fix**: make the root not-found a server component (static content); keep the
  FR-705 lookbooks honesty by adding a `lookbooks/[[...slug]]` segment whose page calls
  `notFound()` and a segment-level server `not-found.tsx` naming FR-705 — both variants then
  fully SSR. Add an E2E assertion on the SSR response body so the regression is caught
  without JS.

### M-FAQ — Footer "FAQ" link 404s (no FAQ page seeded)
- **Location**: `apps/web/src/components/site-footer.tsx:6` (`{ href: "/faq", label: "FAQ" }`);
  seed inserts only our-story/privacy/terms/shipping/returns static pages.
- **Evidence**: live `GET /faq` → 404; seed file has no `faq` slug; footer renders the link on every page.
- **Impact**: Broken navigation on every storefront page; credibility harm; FR-704/FR-107 inconsistency.
- **Severity**: Medium. **Confidence**: Verified.
- **Recommended fix**: seed an idempotent FAQ static page consistent with the existing
  shipping/returns copy (onConflictDoNothing, same pattern).

### M-COL — Collection page caps at 48 products and filters in JS (+ dead imports)
- **Location**: `apps/web/src/app/collections/[slug]/page.tsx:39-48`.
- **Description**: Loads `listProducts({ pageSize: 48 })` then filters by product-ID in
  JavaScript — silently drops collection members beyond 48 or beyond the sort window; the
  file also carries a dynamic `await import("@scandihaven/db/schema")` despite a static
  import path being available, and a `void inArray;` suppression for the unused static import.
- **Evidence**: source read; `listProducts` has no ID-list filter today.
- **Impact**: Correctness cliff as the catalog grows; wasted query load; dead-code smell.
- **Severity**: Medium. **Confidence**: Verified (code); behavior cliff Reasoned.
- **Recommended fix**: extend `productQuerySchema`/`listProducts` with an optional validated
  `ids` filter (DB-level `inArray`), have the page pass collection product IDs; remove the
  dynamic import and the `void inArray;`.

### M-TITLE — PDP `<title>` duplicates the site suffix
- **Location**: `apps/web/src/app/products/[slug]/page.tsx` `generateMetadata` (returns
  `title: seoTitle` where `seoTitle` already ends in "| Scandi Haven", combined with the
  layout template `%s | Scandi Haven`).
- **Evidence**: live PDP title: `Øresund Table Lamp — Brass & Linen | Scandi Haven | Scandi Haven`.
- **Impact**: SERP clutter/duplication; unpolished SEO surface (FR-312-adjacent).
- **Severity**: Medium. **Confidence**: Verified.
- **Recommended fix**: emit `title: { absolute: … }` for PDP metadata (and audit sibling pages
  for the same pattern).

### M-HLTH — Admin health endpoint swallows DB errors silently
- **Location**: `apps/admin/src/app/api/health/route.ts:11` (`catch {}`).
- **Description**: The storefront health route logs `console.error("[health] db check failed", error)`;
  the admin twin returns 503 with no log, violating the "caught errors are logged with
  context" convention (CLAUDE.md) and blinding ops to *why* admin reports degraded.
- **Evidence**: source read; contrast with `apps/web/src/app/api/health/route.ts`.
- **Impact**: Observability gap on the admin deployment path.
- **Severity**: Medium (convention violation, small). **Confidence**: Verified.
- **Recommended fix**: pair the catch with `console.error("[health] db check failed", error)`.

---

## Low

### L-PROD — Admin products list de-duplicates join rows in render
- **Location**: `apps/admin/src/app/(staff)/products/page.tsx` (render-time `Set`).
- **Impact**: Wasteful but correct at current scale. **Confidence**: Verified (code).
- **Recommended fix**: SQL-side distinct/group-by — queued (backlog), not executed this pass.

### L-STR — Deployment env inconsistency: Stripe.js loads while server reports "not configured"
- **Evidence**: live checkout — `js.stripe.com` scripts requested; submit → honest alert
  "Stripe is not configured: set STRIPE_SECRET_KEY…". Implies `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  is set on the deployment but `STRIPE_SECRET_KEY` is not (repo `.env` contains both).
- **Impact**: Mildly wasteful client payload; honest-state UX preserved (alert appears after
  submit; FR-508 satisfied). **Confidence**: Verified (behavior); env inference Reasoned.
- **Recommended fix**: ops — align both keys (set or unset together). Documented, not code.

### L-NAV — Header lacks search UI (FR-104) and Contact item (FR-101)
- **Evidence**: header snapshot: Shop/Collections/Our Story/Journal + account/cart; no search
  affordance although the typeahead API exists and works (`?q=lamp` returns products).
- **Impact**: PRD gap at Phase-1 scope; traceability overstates FR-104 as "Aligned (core)".
- **Recommended fix**: feature slices deferred to Phase 1 (documented in traceability
  correction, D-TRACE) — not half-shipped here.

### L-COPY — Checkout shows "Secure checkout powered by Stripe" before configuration is known
- **Evidence**: live checkout renders the Stripe assurance line pre-submit even when the
  server later reports "not configured".
- **Impact**: Cosmetic; honest state still surfaces on submit.
- **Recommended fix**: optional Phase-1 copy tweak after a config probe; deferred.

---

## Informational

### I-WH — Stripe webhook returns 503 (not 4xx) when Stripe is unconfigured
- `POST /api/webhooks/stripe` without signature → 503 on the live deployment because the
  Stripe client is unavailable. A 4xx would be more semantic; behavior is honest and safe.
- **Confidence**: Verified.

### I-JRN — Journal detail route absent; list cards are non-links
- `/journal/the-slow-chair` → 404; `/journal` renders `<article>` without links (PRD FR-703
  is a Phase-1 surface). Home journal preview behaves the same. Documented in traceability
  (D-TRACE) rather than silently treated as aligned.

### D-TRACE — Traceability matrix overstates two FRs
- `docs/traceability.md` marks FR-701..704 "Aligned (core)" (journal detail missing) and
  FR-104 "Aligned (core)" (no search UI). Correction included in the docs slice.

---

## What passed (evidence-backed, not inflated)

- 40/42 route-sweep checks: home, PLP (+sort/page/category), PDP (both seeded slugs), cart,
  checkout, checkout/success, collections (+detail), journal, 5 static pages, sign-in page,
  account→sign-in redirect, 404 status, typeahead (happy + short-query), health endpoints.
- Interactive flows: add-to-cart → drawer → quantity stepper → cart totals; promo-code error
  path ("Promotion code not found" + actionable hint); checkout address step; guest cart
  persistence across navigations/reload (cookie identity working).
- Security posture: CSP/HSTS/nosniff/XFO/Referrer-Policy present on every checked route of
  both apps; `/api/jobs/run` 401s without secret; unknown slugs/categories/collections 404
  correctly; admin gate 307s anonymous users to `/sign-in?redirect=…`.
- Local gates after clone: `pnpm typecheck` 8/8, `pnpm lint` 8/8, `pnpm test` 7/7 with
  coverage gates green (90.68% lines / 89.28% functions on commerce domain modules).

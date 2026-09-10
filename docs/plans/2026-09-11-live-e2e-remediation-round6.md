# Live E2E Remediation — Round 6 (2026-09-11)

> Parent audit: round-6 live validation (2026-09-11). Baseline: repo gates green
> (lint 8/8, typecheck 8/8, tests 7/7 — commerce coverage 90.9%/92.81% above
> gate), **repo Playwright suite vs live origin 46/46 PASS** (round-5 fixes
> R5-2/R5-3 confirmed deployed), 31-route storefront sweep + 8-route admin
> sweep + headers/robots/sitemap/canonical/JSON-LD/typeahead/TTFB all healthy
> (TTFB ~140 ms vs the 800 ms SLO). Scope exclusions honored: `skills/` and
> `infrastructure/` untouched by checks, tests, and compilation.

## Findings (evidence-labelled)

| ID | Severity | Finding | Evidence | Label |
|---|---|---|---|---|
| **R6-1** | **P0 — security/hygiene regression** | `.env` is **git-tracked again** (commit `316befa` "new start server log", 51 lines) with real `BETTER_AUTH_SECRET` + `CRON_SECRET` values — the exact C2/R4-1 shape that 4afec43 untracked. `git ls-files` shows `.env`; the CI secret-scan pattern (run locally, verbatim) flags `.env:7` and `.env:31` — **the next CI run on main will be red** until it is untracked. Rotation of both secrets remains a documented ops action (the values rode a public repo push). | `git ls-files \| grep '^\.env$'` → `.env`; local `rg` scan (CI shape) → 2 hits | Verified |
| **R6-2** | **HIGH — FR-101/FR-104 (M)** | **Header search affordance missing sitewide.** Desktop header (`apps/web/src/components/site-header.tsx`) and mobile drawer (`mobile-nav.tsx`) have no search entry point; live home/PDP HTML contains zero search inputs. The typeahead API (`/api/search/typeahead`, rate-limited 60/min/IP, Zod-validated) and the `/search` results page (FR-106, R4-5) exist but are **unsurfaced dead ends**. Traceability marks FR-104 "Deferred (Phase 1) — header has no search affordance", and the route comment names a "search slice in the remediation backlog"; no plan document scopes it. FR-104 is M-priority ("must ship v1") and the largest user-visible gap on the live site. | `site-header.tsx` (no search); `mobile-nav.tsx` (no search); live HTML sweep: 0 search inputs on `/`; typeahead route comment "reserved for the FR-104 expansion" | Verified |
| **R6-3** | **MEDIUM — PRD §12.1 / §14.2 traceability** | **Admin app has zero E2E coverage**: no `apps/admin/e2e/`, no Playwright config, no `e2e` script; CI's E2E step scopes `@scandihaven/web` only. PRD §12.1 lists admin flows among E2E critical paths; the admin gate is only ever exercised by manual curl probes. Credential-free coverage is achievable (gate 307s, sign-in render, wrong-credentials error copy, security headers). | `ls apps/admin` (no e2e); `ci.yml` line 73 `pnpm --filter @scandihaven/web exec playwright test` | Verified |
| **R6-4** | **MEDIUM — §12.4 evidence discipline** | **PAD §11 known-issues drift**: `sitemap.ts`+`robots.ts` row and `/search?q=` row are marked "**Open — P0**" (`R-SEO-1`/`R-SEO-2`) but both shipped in round 4 (`180cc54`) and are live-verified in this round's sweep (sitemap 20 absolute URLs all 200; robots app rules + Sitemap line; `/search?q=lamp` 200 + noindex). PAD v1.0 (last_updated 2026-09-10) predates neither commit — the rows were simply left stale. | PAD §11 table lines 1680-1682 vs live sweep results | Verified |

Validated-healthy (no action): storefront route matrix (31 routes incl. empty-category 200s per R5-3), admin gate matrix (307 → `/sign-in?redirect=…` preserving path), security headers on both apps (CSP/HSTS/XCTO/Referrer/Permissions/XFO), robots group rules + CF-managed blocks, sitemap↔reality parity, absolute canonical/og:url on all page types (R5-2 live), Product/Offer/BreadcrumbList + Organization/WebSite JSON-LD, typeahead contract shapes, honest checkout "not configured" state, variant `?variant=` deep-link + `replaceState`, mini-cart drawer, promo flows, cart persistence, newsletter form, 404/lookbooks honest states, axe-clean key routes, no page errors.

Disproven during validation (not findings): CI `branches: ain]` is a terminal
rendering artifact of `[main]` — YAML parses `['main']` (same artifact family
as session_10's `ain 7eec00f]` git output note). PDP "Dimensions" accordion
absence is data-driven (FR-701 hide-when-missing), not a code gap. Static
pages not in FR-704's list (sustainability/showrooms/trade/cookies/accessibility)
are admin-managed content (FR-704/FR-809) — footer links stay consistent with
existing pages; no silent 404s are linked.

## Remediation plan (TDD — one atomic commit per slice)

### Slice 1 — R6-1: untrack `.env` (P0)
- RED (already captured): `git ls-files` shows `.env`; CI-scan shape flags it.
- GREEN: `git rm --cached .env` (keep the working-tree file so local servers
  keep running); confirm `git ls-files` clean + CI-scan shape exits 0.
- `.gitignore` already lists `.env` (line 13) — no ignore change needed.
- Ops note recorded in the plan + ledger: **rotate `BETTER_AUTH_SECRET` and
  `CRON_SECRET`** on the deployed environment (both rode commit `316befa`).
- Commit: `fix(security): untrack re-committed .env with real secrets (R6-1)`.

### Slice 2 — R6-2: header search typeahead (FR-104), TDD
Seams (pre-agreed): pure helper `apps/web/src/lib/search-suggest.ts`
(unit-tested, repo convention for pure SEO/UI logic per `lib/seo.ts`
precedent); client island `apps/web/src/components/search-trigger.tsx`;
mount points `site-header.tsx` + `mobile-nav.tsx`. E2E seam:
`apps/web/e2e/search-flows.spec.ts`.
- RED:
  1. Unit `search-suggest.test.ts`: `buildSuggestions()` shapes the typeahead
     contract `{products, categories, journal}` into labelled groups; queries
     <2 chars yield empty; result cap honoured (API max 10).
  2. E2E (new block in `search-flows.spec.ts`): desktop header exposes a
     search input (FR-101: header carries search); typing "lamp" (≥2 chars,
     debounce ≤250 ms) opens a suggestion listbox containing the seeded
     Øresund lamp; keyboard Enter navigates (to the PDP for a product pick /
     `/search?q=` for a bare submit — keyboard navigable per FR-104); Esc
     dismisses; mobile drawer exposes a Search link (FR-102 drawer parity).
  - Run RED vs local server (expect new-spec failures).
- GREEN:
  1. `lib/search-suggest.ts` — pure: normalize query, gate <2 chars, cap
     results, group shapes; no fetch inside (island fetches).
  2. `search-trigger.tsx` — `"use client"`; debounced (250 ms) fetch of
     `/api/search/typeahead`; ARIA combobox pattern (`role=combobox`,
     `aria-expanded`, `role=listbox`/`option`, `aria-activedescendant`);
     ArrowUp/ArrowDown/Enter/Escape; navigates via `next/link`-equivalent
     `router.push`; closes on route change and blur; ≥44 px touch target
     (CLAUDE.md UI floor); `prefers-reduced-motion` respected (no animation
     beyond tokens).
  3. Mount in `site-header.tsx` between nav and actions (desktop input;
     FR-101 order: logo, nav, search, account, cart) and add a Search link to
     `mobile-nav.tsx` `NAV_LINKS` (drawer parity — smallest correct path).
  4. axe must stay clean on `/` (existing spec guards).
- Full local E2E re-run must stay green (46 + new).
- Commit: `feat(web): header search typeahead — FR-101/FR-104 affordance (R6-2)`.

### Slice 3 — R6-3: admin E2E coverage (credential-free), characterization first
Seams: `apps/admin/e2e/admin-gate.spec.ts` (HTTP/browser-observable gate
behavior); `apps/admin/playwright.config.ts` mirrors web's (port 3001,
`E2E_BASE_URL` support, webServer auto-boot of the production build).
- Specs (green-vs-live by construction — regression protection for existing
  correct behavior, per "a red test is a regression or a wrong test"):
  1. Unauth `/` → 307 `/sign-in?redirect=%2F` (gate, H2-ADMIN shape).
  2. Unauth `/orders`, `/products`, `/customers`, unknown path → 307 with the
     requested path preserved in `redirect` (E2E-5 param contract).
  3. `/sign-in` renders email+password+submit (form contract) with security
     headers present (H5d — headers on every response incl. `/sign-in`).
  4. Wrong credentials → typed error copy, no session, still on `/sign-in`
     (rate limit respected: single attempt per run).
- Wiring: `pnpm add -D @playwright/test` in `apps/admin` (lockfile changes
  only via pnpm add — CLAUDE.md rule); `"e2e": "playwright test"` script;
  CI gains an `E2E admin (Chromium)` step after the web step (build exists;
  webServer boots admin against the migrated+seeded PG service).
- Commit: `test(admin): credential-free admin gate E2E suite + CI step (R6-3)`.

### Slice 4 — R6-4 + docs alignment
- PAD §11: flip `R-SEO-1`/`R-SEO-2` rows to **Resolved — round 4 (180cc54),
  live-verified round 6** with evidence pointers; leave the facet-indexing row
  open (blocked by R-SHOP-2, no filter UI emits facet URLs yet).
- `docs/traceability.md`: FR-104 Deferred → **Aligned (round 6, R6-2)** with
  loci; FR-101 note updated (header now carries search).
- `docs/verification-ledger.md`: append round-6 entry (gates + live E2E
  evidence + coverage).
- AGENTS.md / CLAUDE.md: add round-6 plan to Reference; note admin E2E in the
  commands table (`pnpm e2e` now covers both apps); record the `.env`
  re-exposure lesson (untrack + rotate; scan gate proven working).
- This plan document + worklog.
- Commit: `docs: round-6 live E2E audit, remediation, and doc alignment (R6-4)`.

### Slice 5 — final gates + push
- `pnpm lint typecheck test build` (skills/ + infrastructure/ are not
  workspaces — untouched); local E2E both apps; byte-level commit verification
  (round-4 lesson); push to `main` via
  `skills/how-to-git-push-using-ssh-wrapper/scripts/ssh_git_wrapper_v3.py`
  with the uploaded key; parity check `git status`/`origin/main`.

## Ops actions (documented, outside repo)
1. Rotate `BETTER_AUTH_SECRET` + `CRON_SECRET` in the deployed environment
   (exposed via `316befa` on a public repo). The cart-cookie HMAC rides
   `BETTER_AUTH_SECRET` — rotation invalidates guest carts (30-day persistence
   window restarts); acceptable post-exposure cost.
2. Redeploy both apps after the push to publish R6-2 (+ keep
   `NEXT_PUBLIC_SITE_URL` set — already correct in deployment env).

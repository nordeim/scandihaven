# Session 7 — Live E2E round 4: secrets re-exposure, SEO surface gaps, remediation & docs alignment

Residual remediation complete — R4-1 … R4-9 executed TDD, gates green, 4 atomic commits on `main`.

## What was audited

Docs (`AGENTS.md`, `CLAUDE.md`, `README.md`, `PRD.md` structure, `PAD.md` state, `start_server_log.txt`, `docs/session_6.md`, round-3 audit + remediation plan, 2026-09-11-recent-changes-validation REPORT) in full, then a two-layer live E2E pass:

1. **Repo suite vs live origin** — `E2E_BASE_URL=https://scandihaven.jesspete.shop playwright test --project=chromium` → **21/21 passed** (all round-1..3 remediations confirmed live: H1-CART, E2E-3 promo re-validation, E2E-4 card price, E2E-5 redirect, E2E-6 mobile nav, admin gate chain, headers, health, typeahead, axe 0).
2. **40-check diagnostic sweep** (Playwright script, `scripts/live-e2e-sweep.js` outside the repo): route statuses, per-route chunk integrity + `pageerror`/console capture, security headers, canonical/OG/JSON-LD, cart + WELCOME100 min-spend flow, 390px overflow, admin gate chain, health/typeahead. Result: 35/40 pass; the 5 misses decomposed into 3 real findings (canonical/og localhost, og:url + home og missing, sitemap/search 404) and 2 test-logic artifacts (lookbooks honest 404 by design; typeahead object shape) plus one display artifact (see R4-2 retraction).

Baseline gates at audit time: `pnpm lint` 8/8 · `typecheck` 8/8 · `test` 7/7 (integration auto-skipped — no local PG at that point).

## Findings (labels per PRD §12.4)

| ID | Severity | Finding | Label |
|---|---|---|---|
| R4-1 | Critical | `.env` git-tracked (b50c46b) with real `BETTER_AUTH_SECRET`/`CRON_SECRET`; CI scan misses **quoted** values (`"` ∉ `[A-Za-z0-9+/=]`) | Verified |
| R4-2 | — (retracted) | `branches: ain]` suspected in `ci.yml`; `od -c` proves `[main]` was always correct — tooling display artifact (same class as the round-3 retraction) | Verified (byte dump) |
| R4-3 | High | `sitemap.xml` 404 live; no `app/sitemap.ts` (R-SEO-1 P0, PRD §11.1) | Verified |
| R4-4 | High | No app `robots.ts`; live robots.txt is CF-managed with no `Sitemap:` line (R-SEO-1) | Verified |
| R4-5 | High | `/search?q=` 404 (FR-106 / R-SEO-2 P0); `listProducts({search})` seam existed unused | Verified |
| R4-6 | High | PDP canonical + og:image → `http://localhost:3000` live (E2E-8 residual — env var still unset, code only warned) | Verified |
| R4-7 | Medium | No og:url on PDP; zero og:* on home; no twitter:* anywhere (§11.1) | Verified |
| R4-8 | Medium | No Organization/WebSite(SearchAction) JSON-LD; no BreadcrumbList on PDP (FR-312) | Verified |
| R4-9 | Low | 17 skills/ cache artifacts committed in 8aacd13 (3.1 MB mypy cache.db, pytest/ruff caches, .venv symlink) | Verified |

Plan: `docs/plans/2026-09-10-live-e2e-remediation-round4.md` — every seam validated against the codebase before execution (headers()-in-metadata routes legal because the root layout is request-dynamic; `safeJsonLd` already exported; `ratingAverage/ratingCount` already computed so AggregateRating emits conditionally; `Button` has an `outline` variant).

## TDD execution (red → green, each slice)

| Slice | Red evidence | Green evidence |
|---|---|---|
| R4-1 scan gap | Old CI pattern vs committed `.env` → **no match** (the hole); new quoted-tolerant pattern → match | Exact CI `rg` replay matches the b50c46b shape, passes `.env.example`; `git ls-files` clean of `.env` |
| R4-6 resolver | 11 new `site-url.test.ts` tests fail (exports missing) | config 50/50; auth 19/19 unchanged after the canonical re-export refactor |
| R4-3 sitemap seam | `listSitemapEntries is not a function` (3 integration tests red) | 3/3 against real PG (embedded cluster, migrate+seed) |
| R4-3/4/8 builders | `Cannot find module './seo'` | `seo.test.ts` 9/9 |
| R4-5 search + R4-3..8 E2E | 12 of 13 new E2E specs red against the pre-change build (`/search` 404, sitemap 404, canonical localhost, no og/twitter, no JSON-LD) | **13/13 green** post-implementation; full suite **35/35** (21 prior + 14 new incl. `/search` axe route) |
| R4-9 hygiene | 17 tracked cache paths | `git ls-files skills/` cache grep → 0 |

**Verification environment**: an embedded PostgreSQL cluster (zonky binaries via npm `embedded-postgres`, no root) ran on :5432 — `pnpm db:migrate` + `db:seed` applied, so the real-PG integration suites executed locally for the first time this session (commerce 123/123 incl. the new sitemap suite). Production build + `next start` served E2E (per E2E-11b: the suite always targets the prod artifact).

## Gates (re-executed after all changes)

| Gate | Result | Label |
|---|---|---|
| `pnpm lint` | 8/8 pass | Verified |
| `pnpm typecheck` | 8/8 pass | Verified |
| `pnpm test` (with real-PG integration suites) | 7/7 tasks — commerce 123 (+3) · auth 19 · config 50 (+11) · web 25 (+9) · admin 11 · db 17; coverage gates hold (90.9% stmts / 90.32% funcs) | Verified |
| `pnpm build` | 2/2 — web registers `ƒ /robots.txt`, `ƒ /search`, `ƒ /sitemap.xml` | Verified |
| Playwright (chromium, prod build + PG) | **35/35** | Verified |
| `git ls-files` hygiene | `.env` untracked; skills caches untracked | Verified |

## Commits (this session, on `main`)

1. `fix(ci): untrack re-committed .env and catch quoted secrets in the scan (R4-1)`
2. `feat(config,auth): request-scoped site-URL resolution for absolute URLs (R4-6)`
3. `feat(web,commerce): close the SEO surface gaps — sitemap, robots, /search, absolute canonicals, sitewide JSON-LD (R4-3..R4-8)`
4. `chore(hygiene): untrack skills/ python caches and ignore them (R4-9)`
5. docs alignment (this document, plan, traceability, ledger, README, AGENTS/CLAUDE one-liners)

## Explicit non-goals (carried, honest)

- **R-DB-1 / R-DB-2 remain the P0 backlog** (`search_vector` GIN+trigger; CHECK constraints + `two_factor` + `updated_at` + promotion partial uniques): not executed this round — they need red→green against real migrations before commit; next round with this same embedded-PG harness.
- Header typeahead UI (FR-104), facet indexing rules (FR-203 ≥2 facets → noindex — no facet UI exists yet), hreflang/i18n (R-SEO-3), home-page og:image (no raster asset in repo; SVG og images render inconsistently in link previews), Article JSON-LD (no journal article routes).
- No dependency additions, no lockfile churn, no migrations, no new env vars/flags, no `skills/`/`infrastructure/` content changes (R4-9 untracked caches only).

## Ops actions required (cannot be executed from this sandbox)

1. **Rotate `BETTER_AUTH_SECRET` + `CRON_SECRET`** on every deployed environment (b50c46b values live in git history) and redeploy.
2. Set `NEXT_PUBLIC_SITE_URL` (storefront + admin) — still the declared source of truth; the new resolver only protects the URL contract.
3. Redeploy both apps via `./start_server.sh`; then verify `/sitemap.xml`, `/robots.txt`, `/search?q=lamp`, and the PDP canonical live.
4. Cloudflare Managed Robots: merge the `Sitemap:` line into the CF ruleset or disable the override so the app robots.txt is served.

## Verification-methodology note (recorded for future sessions)

Bracket-like text in shell output (e.g. a literal `[main]`) can render through the agent tooling with the `[m…` prefix partially eaten, mimicking corruption. Round 3 and round 4 each burned time on this. Rule: confirm any suspicious bracket-sequence finding at byte level (`od -c`) or via an independent parser before acting on it — that check converted this round's R4-2 from a "CI never triggers" High into a clean retraction with zero code churn.

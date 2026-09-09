# Live-Site E2E Remediation Plan (Round 4)

| Field | Value |
|---|---|
| Plan ID | 2026-09-10-live-e2e-remediation-round4 |
| Parent audit | Round-4 live sweep (2026-09-10/11): full repo E2E suite 21/21 green vs live origin + 40-check diagnostic sweep + codebase/git validation |
| Method | TDD (red → green) at public seams per repo convention; one atomic commit per slice; Conventional Commits on `main` |
| Exclusions | `skills/`, `infrastructure/` (per operator instruction — no checks/tests/compilation); `PAD.md`/`PAD-sections-2-3.md` remain in-progress artifacts, untouched |
| Verification env | Embedded PostgreSQL (zonky binaries via `embedded-postgres`, port 5433) + `pnpm db:migrate`/`db:seed` + `pnpm build` + `pnpm prod` + local Playwright (chromium) — full integration + E2E red→green locally; live-origin re-check where reachable |

## Findings (round 4 — evidence labels per PRD §12.4)

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| R4-1 | **Critical** | `.env` is git-tracked again (commit b50c46b) with real `BETTER_AUTH_SECRET` + `CRON_SECRET` values — repeat of audit C2 (262d3cc shape). The CI secret scan does NOT catch it because the regexes require the value to start immediately after `=`; the committed file quotes values (`BETTER_AUTH_SECRET="Ked6…"`), and `"` is not in `[A-Za-z0-9+/=]`. | `git ls-files \| grep '^\.env'` → `.env` tracked; `rg -P 'BETTER_AUTH_SECRET=(?!set-me…)[A-Za-z0-9+/=]{32,}' .env` → no match (exit 1) while the real secret sits on line 7 — **Verified** |
| R4-2 | ~~High~~ **RETRACTED (round-4, session_7)** | Initial read suggested `branches: ain]` in `.github/workflows/ci.yml`. Byte-level verification (`sed -n 5p … | od -c` on the working tree, HEAD, and the original commit) shows the line has always been `branches: [main]` — the `ain]` rendering was a display artifact of the agent tool's output pipeline (literal `[m…` sequences get partially eaten as if ANSI escapes). No change required; CI push triggering on `main` is correct. Recorded as a verification-methodology note, not a code finding. | **Verified (od -c byte dump, three sources)** |
| R4-3 | **High (P0 R-SEO-1)** | `sitemap.xml` → 404 on the live storefront. No `app/sitemap.ts` exists; PRD §11.1 requires products/PLPs/collections/journal/static entries, daily, image entries, cart/checkout/account/search/admin excluded. Traceability row 76 "Deferred (backlog B8)". | `curl /sitemap.xml` → 404; `ls apps/web/src/app` (no sitemap.ts) — **Verified** |
| R4-4 | **High (P0 R-SEO-1)** | No app-level `robots.txt`. Live robots.txt is Cloudflare-managed (content-signals block): no `Sitemap:` reference, no `/account` `/cart` `/checkout` `/search` `/api` disallow per PRD §11.1. | `curl /robots.txt` (CF-managed body); no `robots.ts` in app dir — **Verified** |
| R4-5 | **High (P0 R-SEO-2)** | `/search?q=` → 404. FR-106 search results page missing entirely (traceability: "Deferred"). `listProducts` already supports a `search` FTS+ILIKE filter and `productQuerySchema` accepts `search` — the seam exists, only the page is absent. | `curl '/search?q=lamp'` → 404; `catalog.ts:129-133` — **Verified** |
| R4-6 | **High (E2E-8 residual)** | Live PDP `<link rel=canonical>` and `og:image` still resolve to `http://localhost:3000` — `NEXT_PUBLIC_SITE_URL` remains unset on the deployment. The boot guard added in 2bf3a8f only WARNS; the symptom persists on every PDP. | `curl /products/oresund-table-lamp` → canonical + og:image localhost — **Verified** |
| R4-7 | **Medium** | PDP has og:title/description/image but no `og:url`; the home page emits NO `og:*` tags at all; no `twitter:*` anywhere. PRD §11.1: per-page `og:*`, `twitter:*`. | Live HTML greps — **Verified** |
| R4-8 | **Medium (FR-312/§11.1)** | Structured data incomplete: no sitewide `Organization`/`WebSite`(SearchAction) JSON-LD, no `BreadcrumbList` on PDP. Only `Product`/`Offer` on PDP exists. | Live HTML + `rg` in apps/web — **Verified** |
| R4-9 | **Low (hygiene)** | `skills/` caches committed in 8aacd13: `skills/trustskill/.venv` (symlink), `.pytest_cache`, `.mypy_cache` (3.1 MB cache.db), `.ruff_cache`. No .gitignore rules cover them. | `git ls-files skills/ \| grep cache` — **Verified** |

Confirmed working on live (no action — round-4 regression check): all 21 repo E2E specs green vs live origin; route sweep 200s; chunk integrity + zero console/page errors on 7 key routes; CSP/HSTS/XFO/nosniff present; card price = default variant (E2E-4 fix live, €249); promo min-spend re-validation (E2E-3 fix live); mobile nav (E2E-6 live); admin gate 307 → `/sign-in?redirect=%2Fadmin` → 200 with typed INVALID_EMAIL_OR_PASSWORD; health `{status:ok,db:true}`; typeahead product hit; JSON-LD Product price correct; noindex on cart/checkout/account; `/lookbooks` honest SSR 404 (FR-705).

## Slices (ordered by severity; TDD red→green; one atomic commit each)

### Slice 1 — R4-1: Untrack `.env` + close the quoted-secret CI scan gap

- **Seam:** `git ls-files` (tracking) + the CI secret-scan regex set in `.github/workflows/ci.yml`.
- **Red:** the current scan pattern run against the committed `.env` finds nothing (gap demonstrated); the NEW pattern (optional leading quote `["\x27]?` + lookahead tolerant of a trailing quote) matches the real secret.
- **Change:** (a) `git rm --cached .env` (file stays locally for dev; `.gitignore` already covers it once untracked); (b) fix both `BETTER_AUTH_SECRET` and `CRON_SECRET` patterns to tolerate optional single/double quotes around the value while still excluding the `.env.example` placeholders; (c) README ops note: rotate the exposed values on any deployed environment (history still contains b50c46b).
- **Gate:** replay the exact CI `rg` command locally → matches the tracked-again `.env` content in the b50c46b diff (proof of detection), and does NOT match `.env.example`; `git ls-files` clean of `.env`.

### ~~Slice 2 — R4-2: Repair the CI push trigger~~ (RETRACTED)

- **Retraction:** byte-level verification (`od -c`) shows `branches: [main]` has always been correct; the observed `ain]` was an output-display artifact (see findings table). No change made; no commit.
- **Lesson (recorded in session_7):** text findings that contain bracket-like sequences must be confirmed at byte level (od -c / md5) or via an independent parser before acting on them.

### Slice 3 — R4-3/R4-4 (R-SEO-1): `app/sitemap.ts` + `app/robots.ts`

- **Seam:** new commerce query `listSitemapEntries()` (slugs + `updated_at` for products; category + collection slugs; journal deferred to listing page only — no article routes exist) and the two metadata routes.
- **Red tests first:** `apps/web/src/lib/sitemap-routes.test.ts` (unit, `vi.mock` of the commerce seam — existing `cart.test.ts` pattern): entries include `/`, `/shop`, `/collections`, `/journal`, `/shop/{category}`, `/products/{slug}`; EXCLUDE `/cart`, `/checkout`, `/account`, `/search`, lookbooks 404 surface; products carry `lastModified` from `updated_at`; `changeFrequency: daily`, priority ordering products > categories > static. `robots.test.ts`: disallow `/admin` `/account` `/cart` `/checkout` `/search` `/api`; sitemap URL referenced; `Disallow: /` blocked for `*`.
- **Implementation:** `commerce/catalog.listSitemapEntries()` (parameterized, `status='active'` products + active categories/collections); `apps/web/src/app/sitemap.ts` (async, `export const revalidate = 86400`); `apps/web/src/app/robots.ts` (MetadataRoute.Robots, absolute sitemap URL via the site-URL resolution from Slice 5).
- **Integration:** sitemap entries verified against the seeded local PG (embedded) in a `sitemap.integration.test.ts` (skipIf not localhost) — product slugs match seed, no non-active rows.
- **Docs:** README ops note — Cloudflare Managed Robots overrides the app's robots.txt when the zone feature is on; merge the `Sitemap:` line into the CF ruleset or disable the override.

### Slice 4 — R4-5 (R-SEO-2/FR-106): `/search?q=` results page

- **Seam:** `apps/web/src/app/search/page.tsx` (RSC) reusing `listProducts({ search, sort, page, region: 'EU' })` + the shop page's card grid/sort/pagination idioms; `productQuerySchema` sanitizes `q` (max 120) and page.
- **Red tests first:** E2E `apps/web/e2e/search-flows.spec.ts` (runs locally vs prod server + in CI): (1) `/search?q=lamp` renders ≥1 product card (seeded Øresund lamp) with the query echoed; (2) URL is shareable — `?q=lamp&sort=price_asc` re-renders sorted; (3) empty/short-query state renders guidance, no server error; (4) `noindex` meta present (§11.1); (5) unknown `?q=zzzz` shows the empty state with suggestions. Unit: `search-params.test.ts` for the page's param picking/clamping (2-char minimum mirrors typeahead contract; max 120).
- **Implementation:** RSC page + metadata (`robots: { index: false }`, noindex title); empty state links to `/shop` + top categories (reuses `listFeaturedCategories`); header search affordance itself stays Deferred (FR-104 header UI — out of scope, traceability unchanged); breadcrumb nav `Home / Search`.
- **Gate:** local E2E green (embedded PG + prod build); axe scan route added; full `pnpm lint typecheck test build`.

### Slice 5 — R4-6: request-scoped canonical/OG origin fallback (E2E-8 code half)

- **Seam:** pure resolver in `@scandihaven/config/site-url.ts` (already the E2E-8 module — extend it): `resolveAbsoluteSiteUrl({ siteUrlEnv, forwardedHost, host, forwardedProto })` → env URL when set-and-valid, else `x-forwarded-host`/`host` + `x-forwarded-proto` derived origin, else localhost fallback. PDP `generateMetadata` consumes it via `headers()` to emit an ABSOLUTE canonical + absolute og:image/og:url (absolute canonical strings bypass `metadataBase` in the Next Metadata API).
- **Rendering note (validated):** all storefront routes are already dynamic (root layout reads the cart cookie → `ƒ` on every route in the build output), so `headers()` in `generateMetadata` removes no existing caching. `revalidate: 300` on PDP remains (dynamic + revalidate is honored per-request).
- **Red tests first:** `site-url-resolve.test.ts` (pure): env set + public → env; env unset + forwarded host/proto → derived origin; env localhost + forwarded host → derived; all headers absent → localhost fallback; garbage env → derived. E2E: PDP canonical on the local prod server (served via plain host) is absolute and matches the served origin, NOT `http://localhost:3000` (the E2E server runs on 127.0.0.1:3000 — assertion: canonical starts with the served origin).
- **Boot guard unchanged:** the production warning stays (env var is still the correct ops fix; the request-derived fallback is defense-in-depth for the canonical/OG contract specifically).

### Slice 6 — R4-7/R4-8: complete OG/Twitter metadata + sitewide JSON-LD + PDP BreadcrumbList

- **Seam:** root layout `metadata` (home OG + twitter card + title/description already present), PDP `generateMetadata` (og:url, og:type), PDP JSON-LD (BreadcrumbList from the existing breadcrumb trail), root layout static `Organization` + `WebSite`(SearchAction → `/search?q={search_term_string}`) JSON-LD script.
- **Red tests first:** unit tests for the JSON-LD builders (pure functions in `apps/web/src/lib/seo.ts` — `organizationJsonLd(siteUrl)`, `webSiteJsonLd(siteUrl)`, `breadcrumbJsonLd([{name,url}…])`): schema.org shapes, SearchAction target points at `/search?q={search_term_string}`, BreadcrumbList positions 1..n. E2E (search spec or storefront spec): home page head contains `og:title` + `twitter:card`; PDP contains `og:url` (absolute) + BreadcrumbList JSON-LD with the category trail.
- **Implementation:** builders + wiring; home OG image deferred (no raster og asset exists in the repo — SVG og images render inconsistently in link previews; noted in traceability as Partial with reason).
- **Gate:** unit + E2E green; full gates.

### Slice 7 — R4-9: untrack `skills/` caches + .gitignore rules

- **Change:** `git rm --cached -r` the `.venv`/`.pytest_cache`/`.mypy_cache`/`.ruff_cache` entries under `skills/`; add `.gitignore` patterns (`**/.venv/`, `**/.pytest_cache/`, `**/.mypy_cache/`, `**/.ruff_cache/`). No skill file content is modified (exclusion honored — this is git hygiene only).
- **Gate:** `git ls-files skills/ | grep -E '\.venv|cache'` → empty.

### Slice 8 — Docs alignment (per §15/§12.4)

- `docs/traceability.md`: FR-106 Deferred → Aligned (locus `apps/web/src/app/search/page.tsx`, E2E named); row 76 sitemap/robots Deferred → Aligned (loci + tests); FR-312 → Partial→improved (Product/Offer + BreadcrumbList Aligned; AggregateRating explicitly deferred with reviews — reason recorded); FR-313 canonical row updated with request-origin fallback locus; FR-104 note unchanged (header UI still deferred).
- `docs/verification-ledger.md`: round-4 entries (each slice: command + result + label).
- `README.md`: features row for search; troubleshooting rows (CF managed robots vs app robots.ts; secret re-exposure + rotation reminder reference).
- `AGENTS.md` / `CLAUDE.md`: one-line additions where conventions changed (search page + sitemap/robots seams, canonical request-origin rule, quoted-secret scan).
- `docs/session_7.md`: session worklog (this round).
- `docs/plans/2026-09-10-live-e2e-remediation-round4.md`: this document.

## Explicit non-goals (recorded, not silently dropped)

- **R-DB-1 / R-DB-2 (P0 per 2026-09-10 PRD-alignment audit)** — `search_vector` GIN+trigger and CHECK/two_factor/updated_at migrations: NOT executed this round. Rationale: local verification requires a live PG (satisfied only by the embedded PG18 binaries this round); these slices must demonstrate red→green against real migrations + re-seeded data before commit, and were deferred by the prior round as well. They remain the next P0 slices; the plan above clears every live-E2E-visible gap.
- Header search UI (FR-104), facet indexing rules (FR-203 noindex,follow ≥2 facets — no facet UI exists yet), hreflang/i18n (R-SEO-3 L), AggregateRating (reviews deferred), og:image on home (no raster asset).
- No dependency additions, no lockfile churn, no migration, no new env vars/flags, no `skills/`/`infrastructure/` content changes (beyond git untracking of caches).

## Definition of Done (validation plan)

1. `pnpm lint typecheck test build` all green locally (8/8, 8/8, 7/7 with integration suites LIVE against the embedded PG, 2/2).
2. Local E2E (chromium) against `pnpm prod` + embedded PG: existing 21 specs + new search-flows/OG/sitemap specs all green.
3. Each slice's red test demonstrated failing before its implementation (recorded in session_7).
4. `git ls-files` clean of `.env` and skills caches; secret-scan replay (new pattern) clean on the final tree AND matches the b50c46b `.env` shape (detection proof).
5. CI green on the pushed commit (GitHub API check after push).
6. Live-origin re-verification of unchanged surfaces (storefront suite re-run) + documented ops actions: set `NEXT_PUBLIC_SITE_URL`, rotate `BETTER_AUTH_SECRET`/`CRON_SECRET`, redeploy via `./start_server.sh`, align CF managed robots.

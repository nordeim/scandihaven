# Live-Site E2E Remediation Plan (Round 5)

| Field | Value |
|---|---|
| Plan ID | 2026-09-10-live-e2e-remediation-round5 |
| Parent audit | Round-5 live sweep (2026-09-10): repo Playwright suite 34/35 vs live origin + 62-check diagnostic sweep (routes, sitemap parity, canonical/OG per page type, JSON-LD price parity, search, cart, checkout, 404, mobile, headers, admin, typeahead, chunks) + root-cause capture of the round-3 CI flake |
| Method | TDD (red → green) at public seams per repo convention; one atomic commit per slice; Conventional Commits on `main` |
| Exclusions | `skills/`, `infrastructure/` (per operator instruction — no checks/tests/compilation) |
| Verification env | Embedded PostgreSQL 17.5 (zonky binaries, port 5432, migrate+seed) + `pnpm build` + `next start` + local Playwright (chromium); live-origin re-checks against `https://scandihaven.jesspete.shop` / `https://scandihaven-admin.jesspete.shop` |

## Context — what round 4 deployed

The live origin now serves the round-4 surfaces: `/sitemap.xml` (20 URLs, absolute locs), `/robots.txt` (CF-managed block **merged with** the app's disallow set + `Sitemap:` line), `/search?q=lamp` (200, noindex, results), absolute PDP canonical/og:url. All round-1..4 fixes re-verified live this round: H1-CART mutations, promo re-validation, card price €249, redirect validation, mobile nav, admin gate chain, security headers, health, typeahead, chunk integrity, JSON-LD. **The ops actions from rounds 3/4 were executed** (redeploy done), except `NEXT_PUBLIC_SITE_URL` — which round 5 shows is still unset, and which the remaining localhost-bound surfaces (R5-2) make material.

## Findings (round 5 — evidence labels per PRD §12.4)

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| R5-1 | **High (test debt — repo suite red vs live)** | `seo-flows.spec.ts:63` asserts "never a blanket disallow" with the unscoped regex `/disallow:\s*\/\s*$/im`. The live robots.txt legitimately contains the **Cloudflare-managed per-bot blocks** (`User-agent: Amazonbot → Disallow: /`, 9 bots). The assertion's intent is that no `User-agent: *` group may contain a bare `Disallow: /`; its implementation flags ANY bare disallow-all line, so a correct robots.txt fails the repo's own E2E suite (1/35 red). Passed locally in round 4 because a local server has no CF block. | Playwright vs live: fail at `seo-flows.spec.ts:63`; live body grep: 9 per-bot `Disallow: /` lines under named UAs, app `*` group has only path disallows — **Verified** |
| R5-2 | **High (SEO — R4-6 code half stopped at the PDP)** | Every non-PDP page emits `og:url` resolved against the build-time `metadataBase` (`layout.tsx:26`: `process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"`), and only PDP + category emit a canonical at all. On the live deployment (env var unset): home/PLP/collections-index/journal/static/404 render `og:url = http://localhost:3000` and **no canonical**; `/shop/[category]` renders a **localhost-bound canonical**. og:url is the canonical identity link previews use — it actively poisons sharing on every page except PDPs. PRD §11.1 requires per-page canonical + og. | live sweep C-checks: home `canonical=null og:url=http://localhost:3000`; `/shop/lighting` `canonical=http://localhost:3000/shop/lighting`; PDP correct (request-scoped). `layout.tsx:26` static export; PDP `generateMetadata` uses `currentSiteUrl()` — **Verified** |
| R5-3 | **Medium (SEO/UX — sitemap advertises 404s)** | Sitemap lists `/shop/beds` + `/shop/storage` (both active categories), but `/shop/[category]/page.tsx:44` 404s any category whose product total is 0 on page 1 — so 2/20 sitemap URLs return 404 (search-engine coverage errors). The page's own "No pieces here yet — new work lands each season" branch (line 69-70) is **unreachable dead code** — the original intent was a 200 empty state. FR-201 requires 404 only for *unknown* slugs; beds/storage are known, active categories. | live sweep B-parity: 2/20 locs → 404; seed (`ensure-seeded.ts`): beds/storage active, zero products; `shop/[category]/page.tsx:44-46,69-70` — **Verified** |
| R5-4 | **Medium (CI stability — round-3 flake root-caused)** | `apps/admin/src/guard.test.ts` first test ("maps ForbiddenError…") pays the cold dynamic import of `admin-guard` → `@scandihaven/auth` → Better-Auth instance construction → `@scandihaven/commerce`/`db` TS-source graph. Under 7-way parallel turbo runs on a 2-CPU sandbox that import exceeds vitest's default **5000ms** timeout; isolated it takes ~1s. Monitored-but-unrooted since round 3 ("2 failures in ~10 runs"); this round captured the deterministic failure signature twice: `Error: Test timed out in 5000ms` at `guard.test.ts:16`, durations 5096ms/6704ms. | Failing-run output captured verbatim (twice); 976ms isolated; 2.7s under synthetic CPU load; pass 6/6 without contention — **Verified** |
| R5-5 | Informational | The live 404 (and error) pages ship the branded content + recovery links in the **RSC flight payload only** — raw SSR HTML is the `<html id="__next_error__">` shell with an empty body, and non-JS crawlers see no content. Real browsers render fully (verified with waits: recovery links present). This is Next 16's error-shell behavior, not app-fixable without reimplementing the error page; the round-3 M-404 "ships in the SSR payload" claim holds for the flight data, not raw HTML. Recorded as a documentation clarification. | curl of live 404: `__next_error__`, zero `<a>` elements; Playwright with networkidle+3s: full content — **Verified** |
| R5-6 | Informational (ops) | PDP `og:image` is an SVG (`/products/oresund-lamp.svg`) — most link-preview renderers ignore SVG. Known round-4 deferral (no raster asset in repo); carried as backlog, not a regression. | live PDP head — **Verified** |

**Non-findings (investigated, no defect):** typeahead `?q=a` returns 200 `{products:[],…}` — the route maps invalid queries to an empty shape by design (`route.ts:47-49`, graceful client contract); my sweep's 400 expectation was wrong. Live checkout honestly renders "Nothing to check out" for empty sessions. Admin wrong-credentials produce the typed error without redirect (probed with fake creds only — no state written).

## Slices (ordered by severity; TDD red→green; one atomic commit each)

### Slice 1 — R5-4: admin vitest `testTimeout` (CI flake, root cause fixed)

- **Seam:** `apps/admin/vitest.config.ts` — test infrastructure only; assertions unchanged.
- **Red (captured):** `Test timed out in 5000ms` at `guard.test.ts:16` under parallel runs (verbatim output above).
- **Change:** `test.testTimeout: 30_000` with a comment recording the root cause (cold workspace-TS import under 7-way parallel contention; round-3 ledger note resolved).
- **Green:** 10 consecutive full `pnpm test` runs (parallel, 7 tasks) all green, including with the embedded-PG integration suites live.
- **Why config, not per-test:** every admin test dynamically imports workspace TS; the first test of any file pays the cold-compile cost. Guard assertions untouched — no gate weakened (the 5s default was never an intentional constraint).

### Slice 2 — R5-1: scope the robots E2E assertion to the app-managed group

- **Seam:** `apps/web/e2e/seo-flows.spec.ts` robots test — test-only change.
- **Red (captured):** fails vs live at line 63 (CF per-bot blocks).
- **Change:** replace the unscoped regex with a group-aware check: parse `User-agent:` groups from the robots body; assert that **no group whose user-agent is `*`** contains a bare `Disallow: /`; keep asserting the app disallow set (`/admin /account /cart /checkout /search /api`) and the sitemap reference. Per-bot `Disallow: /` under named UAs (Cloudflare-managed) is legitimate and no longer trips the spec.
- **Green:** the spec passes vs live origin AND vs the local prod server.

### Slice 3 — R5-2: request-scoped `metadataBase` + per-page canonicals (R4-6 completion)

- **Seam:** `apps/web/src/app/layout.tsx` (static `metadata` → `generateMetadata` consuming the existing request-scoped `currentSiteUrl()` from `site-origin.ts`); `alternates.canonical` added to the pages that lack one.
- **Red tests first:** extend `apps/web/e2e/seo-flows.spec.ts`: home → canonical `${SERVED_ORIGIN}/` + og:url `${SERVED_ORIGIN}/`; `/shop` → canonical; `/shop/lighting` → canonical absolute (no localhost); `/collections` + `/collections/autumn-collection` → canonical; `/journal` → canonical; static page (`/our-story`) → canonical. All assert against `SERVED_ORIGIN` so they hold locally and live. (These are RED vs live today; locally RED for canonical-missing + localhost og:url since local metadataBase is `localhost:3000` ≠ `127.0.0.1` served origin.)
- **Implementation:**
  - `layout.tsx`: `export async function generateMetadata(): Promise<Metadata>` → `metadataBase: new URL(await currentSiteUrl())`; keep title/description/og/twitter fields (og.url stays relative `/` — now resolved per request). No caching regression: every storefront route is already request-dynamic (cart cookie in this layout); PDP's absolute canonical is unaffected.
  - Per-page `alternates: { canonical: "/…" }`: `app/page.tsx` (home `/`), `shop/page.tsx` (`/shop`), `collections/page.tsx` (`/collections`), `collections/[slug]/page.tsx` (`/collections/${slug}` in its `generateMetadata`), `journal/page.tsx` (`/journal`), `[slug]/page.tsx` (`/${slug}`). Category page's existing relative canonical becomes correct via the per-request metadataBase (no change needed there). `/search`, `/cart`, `/checkout`, `/account` stay noindex — canonical not applicable.
  - Static-page relative canonicals resolve against the request-scoped metadataBase — same pattern the PDP uses for absolute URLs.
- **Green:** new E2E specs pass locally (prod build + embedded PG) AND vs the live origin; all 35 existing specs unchanged-green.
- **Note:** with `NEXT_PUBLIC_SITE_URL` correctly set the resolver already returns it — this change makes the served origin correct in BOTH configurations (defense-in-depth, mirroring the R4-6 PDP decision).

### Slice 4 — R5-3: empty active categories render 200 (sitemap↔reality alignment)

- **Seam:** new pure query `hasActiveCategory(slug)` in `@scandihaven/commerce/catalog` + `/shop/[category]` page logic.
- **Red tests first:**
  - Integration (real PG): `hasActiveCategory` — seeded-active slug (`beds`) → true; unknown slug → false; inactive slug → false (needs a transient inactive row; rolled back).
  - E2E: `/shop/beds` → 200, renders "No pieces here yet" empty state, zero product cards, canonical `/shop/beds`; `/shop/nonexistent-xyz` → still 404 (FR-201 unknown-slug contract pinned); sitemap category URLs all 200 (extends the R5-1-fixed robots/sitemap spec with a parity assertion over `<loc>`s — route-level, not per-URL fetch, to keep the suite fast).
- **Implementation:** `catalog.hasActiveCategory` (parameterized `SELECT 1 FROM category WHERE slug = $1 AND is_active`, `LIMIT 1`); page: unknown/inactive slug → `notFound()` (unchanged); known-active slug → always render (empty-state branch becomes reachable; drop the `result.total === 0 → notFound()` guard). Unknown-slug 404 semantics preserved (FR-201).
- **Green:** new unit/integration/E2E green; existing plp/category specs unaffected.

### Slice 5 — Docs alignment (per §15/§12.4)

- `docs/traceability.md`: FR-313 canonical row → canonicals now sitewide (loci: layout generateMetadata + per-page alternates); sitemap row → empty-category alignment note; FR-201 row → known-empty category = 200 empty state (locus + test).
- `docs/verification-ledger.md`: round-5 entry (each slice: command + result + label; the R5-4 root-cause closes the round-3 monitoring note).
- `AGENTS.md` / `CLAUDE.md`: update the canonical rule line (metadataBase is request-scoped sitewide; per-page canonical list) + admin testTimeout convention line.
- `README.md`: troubleshooting row for Cloudflare managed robots + per-bot disallow groups (why the E2E assertion is group-aware); empty-category behavior note.
- `docs/session_9.md`: this round's worklog narrative.
- `docs/plans/2026-09-10-live-e2e-remediation-round5.md`: this document.

## Explicit non-goals (recorded, not silently dropped)

- **R-DB-1 / R-DB-2 (P0 from the 2026-09-10 PRD-alignment audit)** — `search_vector` GIN+trigger and CHECK/two_factor/updated_at/partial-unique migrations: NOT part of this round's E2E-identified scope; they require migration red→green and remain the next P0 slices (round-4 deferral stands; embedded-PG harness is now in place for them).
- R5-5 (error-shell flight-only content) and R5-6 (SVG og:image): recorded as informational; no code change (Next 16 behavior / missing raster asset respectively).
- Header search UI (FR-104), facet index rules (FR-203), hreflang/i18n, AggregateRating — unchanged, Deferred per traceability.
- No dependency additions, no lockfile churn, no schema migration, no new env vars/flags, no `skills/`/`infrastructure/` changes.

## Definition of Done (validation plan)

1. `pnpm lint typecheck test build` all green (integration suites LIVE against embedded PG; admin suite 10× stable under parallel load).
2. Local E2E (chromium, prod build + embedded PG): existing 35 specs + new specs (robots group-aware re-run, canonical/og sweep, empty category, sitemap parity) all green.
3. Live-origin re-run: repo suite green vs `https://scandihaven.jesspete.shop` (R5-1 fixed assertion; canonical/og assertions still assert against SERVED_ORIGIN and now match the live output too where round-4 already fixed it).
4. Each slice's red state demonstrated before its implementation and recorded in `docs/session_9.md`.
5. Atomic Conventional Commits pushed to `main` via the SSH wrapper; push verified via `git fetch`.

# Live E2E Remediation — Round 7 (2026-09-11)

> Parent audit: round-7 live validation (2026-09-11). Baseline: repo gates green
> (lint 8/8, typecheck 8/8, tests 7/7 — commerce coverage 90.9%/92.81% above
> gate; integration suites live on embedded PG 17.5), **repo Playwright suite
> vs live origin 53/53 (storefront) + 8/8 (admin) PASS** — the round-6 redeploy
> (checked-in `start_server_log.txt`, HEAD `a5ffbf7`) confirmed R6-2 header
> search is live. Beyond the repo suite, a 36-probe diagnostic sweep
> (routes, facets, sort, pagination, search depth, journal, static pages,
> typeahead edges, newsletter, account gate, TTFB, headers, JSON-LD, mobile)
> surfaced 9 findings. Scope exclusions honored: `skills/` and
> `infrastructure/` untouched by checks, tests, and compilation.

## Findings (evidence-labelled)

| ID | Severity | Finding | Evidence | Label |
|---|---|---|---|---|
| **R7-1** | **P0 — security/hygiene regression (4th occurrence)** | `.env` is **git-tracked again** (commit `a5ffbf7` "update start server log", 51 lines) with real `BETTER_AUTH_SECRET` + `CRON_SECRET` values — the exact re-exposure shape that round 6 untracked (C2 `262d3cc` → untrack `4afec43` → re-add `316befa` → untrack R6-1 → **re-add `a5ffbf7`**). Every "log/doc artifact" commit that runs `git add` from a dirty tree re-stages the ignored file. `git ls-files \| grep '^\.env$'` → `.env`; values are real (not `set-me`). Rotation remains a pending ops action (both values rode public pushes). | `git ls-files` shows `.env`; `git show HEAD:.env` lines 7/31 real values | Verified |
| **R7-2** | **HIGH — FR-703 (M)** | **Journal reader route missing.** `/journal/{category}/{slug}` 404s (no route exists — build output has no `/journal/[...]` segment); the `/journal` index renders the two seeded posts **without links** (`<article>` elements, no `<a>`); the sitemap has zero journal article URLs; the typeahead `journal` group is hard-coded `[]` (R6-2 left it empty pending this route — a live link would 404 per FR-109). FR-703 is M-priority and its absence also keeps the FR-104 typeahead contract permanently one-third empty. | Sweep E1: `/journal/craft/the-slow-chair` → 404; E2: posts render unlinked; D8: 0 journal `<loc>` in sitemap; `typeahead/route.ts` line "journal: []" | Verified |
| **R7-3** | **MEDIUM — FR-704 (M)** | **6 of 12 mandated static pages unseeded**: `sustainability`, `materials`, `showrooms`, `trade-program`, `cookies`, `accessibility` 404 live. FR-704 lists all 12 as M-priority. Round 6 classified these as admin-managed content; seeding them (idempotent, natural-key upsert) closes the FR-704 contract while admin management (FR-809) stays the mechanism. No new footer/nav links are added — the pages simply resolve. | Sweep E3: 6/12 404; local DB `static_page` rows: faq, our-story, privacy, returns, shipping, terms | Verified |
| **R7-4** | **HIGH — R-DB-1 (P0) + R-SHOP-1 (P1) + FR-105 (S)** | **Search depth is a quarter-implemented seam.** (a) `product.search_vector` tsvector + GIN absent (PAD R-DB-1 P0): `listProducts`/`searchTypeahead` build an ad-hoc `to_tsvector('english', p.title)` per row — no maintained vector, no A/B field weighting per PRD §8.8. (b) `pg_trgm` similarity union absent (R-SHOP-1). (c) `search_synonym` is seeded (couch→sofa, lamp→lighting, rug→throw) but **never queried anywhere** — dead data: live `q=couch` returns 0 products while `q=sofa` returns the seeded armchair. | `catalog.ts` lines 132-133/438: ad-hoc tsvector + ILIKE only; grep: `search_synonym` referenced only in schema+seed; sweep E14/E14b: couch → 0 links, no sofa mention | Verified |
| **R7-5** | **HIGH — FR-202 (M) / R-SHOP-2 (L)** | **Facet/filter UI absent on `/shop`**: no material/colour/price/availability/lead-time/collection filters (0 facet links); PLP is category-subtree + sort + pagination only. Already queued as R-SHOP-2 (L-size: FilterPanel + relaxed-facet CTEs + `product_metrics` view for the missing `bestselling` sort). **Deferred this round** — it is the single largest remaining slice and deserves its own session; stays Open in PAD §11. | Sweep D1/E10: 0 facet links; `/shop` page has only SORTS + pageHref | Verified |
| **R7-6** | **MEDIUM — FR-308 (M) / FR-312 / R-SHOP-3 (M)** | **PDP reviews surface absent** (FEATURE_REVIEWS=on): no review summary/distribution UI, no AggregateRating in PDP JSON-LD (renders only when `ratingCount > 0`, and no seeded reviews exist). Queued with R-SHOP-3 (verified-buyer gate + moderation + review-request job). **Deferred this round**; stays Open in PAD §11. | Sweep E5-fix: no review mentions on PDP; E16: no AggregateRating; PDP JSON-LD conditional block | Verified |
| **R7-7** | **LOW — FR-307 (S)** | **Cross-sell "Pairs well with" absent on PDP** (curated + bestseller fallback). S-priority; the PDP comment itself says "cross-sell stub". **Deferred**. | Sweep E7-fix: false; `products/[slug]/page.tsx` comment "cross-sell stub" | Verified |
| **R7-8** | **LOW — PRD §4.8 ConsentProvider (Phase 2)** | No consent banner UI anywhere (ConsentProvider port exists; v1 local internal provider + banner is the soft-launch Phase 2 slice). **Deferred by design**. | Sweep E8-fix: no consent text on home | Verified |
| **R7-9** | **INFO — PAD hygiene** | PAD structural drift: TOC §11 title ("Environments…") ≠ body §11 ("Known Issues & Outstanding Tasks"); §4.2 cites "ADR-7" for money-as-integers (that rationale belongs to ADR-001); ADR-8 (outbox) has no body entry; NFR-STACK-9 used with two meanings; round-6 status edits (2026-09-11) post-date `last_updated` with no revision entry. Fixed surgically in the docs slice (§11 rows + revision entry; TOC/citation fixes where one-line). | PAD digest vs body headings | Verified |

Validated-healthy (no action): route matrix (31 storefront + 8 admin routes incl. empty-category 200s, unknown-slug 404s, lookbooks honest 404), admin gate 307s with `?redirect=` preservation, security headers on both origins (CSP/HSTS), robots group-aware rules, sitemap↔reality parity (20 URLs), absolute canonical/og:url sitewide (R5-2 live), Product/Offer/Breadcrumb + Organization/WebSite JSON-LD, typeahead contract (1-char empty, garbage tolerated, rate limit), `?variant=` deep-link + `replaceState` (FR-302 implemented — sweep D10 was DOM-marker-blind, not a gap), mini-cart drawer, cart persistence + promo flows (repo suite), honest checkout states, newsletter acknowledgment, axe-clean key routes, TTFB ~117-170 ms vs the 800 ms SLO, mobile drawer Search link (R6-2 live).

Disproven during validation (not findings): D2 "sort control present" — sort **works** via URL (`?sort=newest|price_asc|price_desc`, honored in SQL); PAD's "sort falls to default" text is stale for the sort part (facets remain absent). D3 "no `?page=` links" — pagination is wired but the seeded catalog (6 products) never crosses the 24/page threshold.

## Remediation plan (TDD — one atomic commit per slice)

### Slice 1 — R7-1: untrack `.env` (P0)
- RED (already captured): `git ls-files` shows `.env`; CI-scan shape flags lines 7/31.
- GREEN: `git rm --cached .env` (working-tree copy preserved for local servers);
  `git ls-files \| grep '^\.env$'` → empty; CI secret-scan replay exits clean.
- `.gitignore` line 13 already ignores `.env`.
- Ops note: **rotate `BETTER_AUTH_SECRET` + `CRON_SECRET`** on the deployed
  environment (4th public exposure; automation note added to AGENTS.md).
- Commit: `fix(security): untrack re-committed .env with real secrets (R7-1)`.

### Slice 2 — R7-2: FR-703 journal reader route (HIGH)
Seams (validated): `packages/commerce/src/catalog.ts` (add `getJournalPost`,
`searchTypeaheadJournal`; extend `listSitemapEntries` with journal entries);
`packages/db/src/schema/content.ts` (`journal_post` schema already complete:
slug/title/excerpt/bodyHtml/category enum/author/publishedAt/relatedProductIds);
`apps/web/src/app/journal/[category]/[slug]/page.tsx` (new route);
`apps/web/src/app/journal/page.tsx` (index links); `apps/web/src/lib/seo.ts`
(`buildSitemapEntries` gains journal articles); `apps/web/src/app/api/search/typeahead/route.ts`
(journal group served).
- RED:
  1. Integration `packages/commerce/src/catalog-journal.integration.test.ts`:
     `getJournalPost("the-slow-chair")` → published post with category+author;
     unknown slug → null; **category mismatch → null** (route 404s, FR-201
     honesty); `searchTypeaheadJournal("slow")` → the seeded post; unpublished
     posts never returned.
  2. Unit `apps/web/src/lib/seo.test.ts` (or existing home): `buildSitemapEntries`
     with journal input emits `/journal/{category}/{slug}` URLs (priority 0.4).
  3. E2E (new block in `apps/web/e2e/search-flows.spec.ts` + `seo-flows.spec.ts`):
     article route 200 + renders sanitized body + Article JSON-LD; index posts
     link to `/journal/{category}/{slug}`; sitemap parity fetch includes journal
     `<loc>`s; typeahead `journal` group returns the seeded post for "slow";
     category-mismatch URL 404s.
  - Run RED vs local prod server (expect failures).
- GREEN:
  1. `getJournalPost(slug)` — published-only fetch (returns category for the
     route to validate against the URL segment).
  2. Route page: `await params`, `notFound()` on null or category mismatch;
     sanitized `bodyHtml` via `sanitizeRichText` (same rule as `[slug]` page);
     related products via `listProducts({ ids: relatedProductIds })` with live
     default-variant prices (FR-703 embeds; hide-section when none, FR-701
     convention); Article JSON-LD via `safeJsonLd` + `breadcrumbJsonLd`;
     `publicPageMetadata({ path: /journal/{cat}/{slug} })` canonical+og:url;
     `revalidate = 300` (content ISR parity with journal index).
  3. Journal index: each `<article>` gains a `<Link href="/journal/{cat}/{slug}">`.
  4. Sitemap: `listSitemapEntries` returns published journal posts
     (`slug`, `category`, `updatedAt`); `buildSitemapEntries` emits them at
     priority 0.4 with `lastModified: updatedAt`.
  5. Typeahead route: `searchTypeaheadJournal(q, 3)` fills the journal group
     (links now resolve — FR-109 honesty restored); response schema unchanged.
- Commits: `feat(web,commerce): FR-703 journal reader route + index links + Article JSON-LD (R7-2)`
  then `feat(web,commerce): journal articles in sitemap + typeahead journal group (R7-2)`.

### Slice 3 — R7-3: FR-704 static pages (MEDIUM)
- RED: integration test asserting all 12 FR-704 slugs are published
  (`sustainability`, `materials`, `showrooms`, `trade-program`, `cookies`,
  `accessibility` missing → fails).
- GREEN: seed the 6 missing rows (idempotent `onConflictDoNothing`, same block
  as the existing 6; honest one-paragraph copy each; `trade-program` notes the
  Phase-5 full program per FR-901, `cookies` names the Phase-2 consent vendor
  posture per PRD §9.5 — no feature is claimed that the build does not have).
- E2E: extend the static-pages E2E probe to assert all 12 resolve 200.
- Commit: `feat(seed): seed all twelve FR-704 static pages (R7-3)`.

### Slice 4 — R7-4: search depth — R-DB-1 + R-SHOP-1 (HIGH)
Seams (validated): `packages/db/src/schema/catalog.ts` (`product` table — add
tsvector column), new drizzle migration (additive), `packages/commerce/src/catalog.ts`
(`listProducts` + `searchTypeahead` search conditions).
- RED:
  1. Integration `packages/commerce/src/search-depth.integration.test.ts`:
     `q=couch` returns the sofa/armchair products (synonym expansion — the
     seeded `couch→sofa` row finally queried); typo-tolerant query (e.g.
     `halden linnen armchair`) still matches (trigram union); exact FTS query
     unchanged; typeahead honors the same expansion.
  2. Schema test (`packages/db/src/schema.test.ts` idiom): `product` exposes
     `searchVector`; GIN index declared.
- GREEN (two commits):
  1. **R-DB-1**: `product.searchVector` tsvector column `GENERATED ALWAYS AS
     (setweight(to_tsvector('english', title),'A') || setweight(to_tsvector('english',
     materials+description),'B')) STORED` (PRD §8.8 A/B weighting; the engine
     maintains it — the PAD's "trigger" intent satisfied without a trigger's
     drift risk) + GIN index. Migration is **additive only** (new column +
     index; no drop/rewrite); `pnpm db:generate`, review SQL, migrate.
     `listProducts`/`searchTypeahead` switch `to_tsvector('english', p.title)`
     → `p.search_vector`.
  2. **R-SHOP-1/FR-105**: synonym expansion (expand `websearch_to_tsquery`
     with `search_synonym` rows matching the query's tokens — `q=couch` also
     matches `sofa`) + `pg_trgm` union (`similarity(p.title, q) >= 0.5` OR'd
     into the condition; pg_trgm extension already live via init SQL).
     Expansion helper kept pure + unit-tested (`expandSearchTerms`).
- Commits: `feat(db,search): maintained product.search_vector + GIN — R-DB-1 (additive)`
  then `feat(search): synonym expansion + trigram fallback in catalog search — FR-105/R-SHOP-1`.

### Slice 5 — R7-9 + docs alignment
- PAD §11: R-DB-1 → Resolved (this round, commit ref + evidence); R-SHOP-1 →
  Resolved (synonym+trgm slice; "swap trigger >5k SKUs" stays); FR-703/FR-704
  rows updated; revision-history entry appended (fixes the round-6 missing-entry
  drift, R7-9); TOC §11 heading + ADR-7/ADR-8 citation anomalies fixed where
  one-line surgical.
- `docs/traceability.md`: FR-703, FR-704, FR-105, FR-104 (journal group now
  served) rows.
- `docs/verification-ledger.md`: round-7 entry (baseline, findings, evidence,
  gates).
- AGENTS.md/CLAUDE.md: new conventions — search SQL must use `p.search_vector`
  (never ad-hoc `to_tsvector`), synonym expansion seam, journal-route
  conventions, `.env` pre-commit check reminder (4th occurrence).
- `docs/session_12.md` narrative + this plan's outcome table.
- Commit: `docs: round-7 live E2E audit, remediation, and doc alignment (R7-*)`.

### Deliberately deferred (stays Open in PAD §11, with reasons)
- **R-DB-2 (P0, M-size)**: DDL CHECK constraints + `category.parent` FK +
  promotion partial uniques. Touches money/order-state DDL — PRD §15 requires
  scope confirmation for money/order-state changes and each constraint needs
  pre-flight data validation; deserves a dedicated session, not a tail-end
  batch. Kept Open with this note.
- **R-SHOP-2/R7-5 (facets, L)**, **R-SHOP-3/R7-6 (reviews, M)**, **R7-7
  (cross-sell, S)**, **R7-8 (consent banner, Phase 2)**, **R-SEC-1 (2FA, P1)**,
  R-SEC-2, R-INV-1, R-CART-1, R-CHECK-1, R-SEO-3, R-AUTH-1, R-ADMIN-1/2,
  R-OBS-1 — unchanged queue from PAD §11.

## Verification matrix (Definition of Done)

1. `pnpm lint typecheck test build` — all green (tests with integration suites
   live on embedded PG 17.5; commerce coverage above 90/85 gates).
2. New integration + unit tests red→green (captured in the ledger).
3. `pnpm e2e` (web + admin) green locally vs the fresh prod build.
4. Post-push live re-check: repo suite vs live origin — remaining failures
   (if any) must be exactly the awaiting-redeploy set, documented as ops
   action (`./start_server.sh` redeploy publishes this round).
5. `git ls-files \| grep '^\.env$'` empty; CI secret-scan replay clean.
6. `skills/` and `infrastructure/` untouched by every commit (verified via
   `git diff --stat` per commit).

---

## Outcome (2026-09-11, executed)

| Slice | Result | Commit |
|---|---|---|
| 1 — R7-1/R7-1b `.env` untrack + prose de-marker | GREEN — scan replay clean on an index-tree checkout simulation | `72fc9b3` |
| 2 — R7-2 FR-703 journal reader | GREEN — 7 integration + 3 unit + 7 E2E specs red→green | `eacc65f` |
| 3 — R7-3 FR-704 dozen static pages | GREEN — seed-coverage integration + 2 E2E specs red→green | `b886c03` |
| 4 — R7-4 search depth (R-DB-1 + R-SHOP-1) | GREEN — schema + 7 unit + 5 integration + 3 E2E specs red→green; migration 0001 additive, applied + backfilled | `3cfa4f8` |
| 5 — R7-9 + docs alignment | PAD v1.1 (revision entries, TOC, ADR-001 citation, §11 rows), traceability, ledger, AGENTS/CLAUDE conventions, session_12 | this commit |

Gates at close: lint 8/8 · typecheck 8/8 · tests 7/7 (config 50 · auth 19 · admin 11 · web 35 · db 22 · commerce 146; integration live on embedded PG 17.5) · build 2/2 · Playwright web 64/64 · admin 8/8 local. Deferred as documented: R-DB-2 (dedicated session; money/order-state DDL), R-SHOP-2/R7-5, R-SHOP-3/R7-6, R7-7, R7-8, R-SEC-1, R-SEC-2, R-INV-1, R-CART-1, R-CHECK-1, R-SEO-3, R-AUTH-1, R-ADMIN-1/2, R-OBS-1.

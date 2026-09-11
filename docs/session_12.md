# Session 12 — Live E2E Round 7 (2026-09-11)

Continuation of session 11: round 6 was pushed (origin/main at `ba79e5e`) and `a5ffbf7` ("update start server log") recorded the redeploy — its health checks confirmed the round-6 fixes went live. This session: validate that parity, run a deeper diagnostic sweep beyond the repo suite, and remediate what it finds.

## Step 1 — Baseline & parity

Fresh clone at `a5ffbf7`; embedded PostgreSQL 17.5 provisioned (zonky binaries via `@embedded-postgres/linux-x64@17.5.0-beta.15`, port 5488 — the sandbox has no docker; the harness mirrors sessions 10/11). Baseline gates green: lint 8/8, typecheck 8/8, tests 7/7 (integration suites live), build 2/2. Repo Playwright suites vs the live origins: **storefront 53/53, admin 8/8 — the redeploy published R6-2 header search** (after installing the matching Chromium; the cache had 1200/1234 but Playwright 1.63 needs 1243 — environmental, not a site finding).

## Step 2 — Diagnostic sweep (beyond the repo suite)

A 36-probe sweep of surfaces the repo suite does not cover: PLP facets/sort/pagination, search depth (typo/synonym), journal article routes, the FR-704 dozen static pages, typeahead edge cases, newsletter, account gate, TTFB sampling, headers, journal/collection JSON-LD, mobile drawer. Result: **9 findings, every one validated against the code before classification**:

1. **R7-1 (CRITICAL)**: `.env` git-tracked AGAIN at `a5ffbf7` — 4th occurrence of the log/doc-commit re-exposure (C2 → R4-1 → R6-1 → R7-1). Real `BETTER_AUTH_SECRET` + `CRON_SECRET`. Sub-finding **R7-1b**: `docs/session_8.md:81` quotes the literal OpenSSH key header in prose — the CI secret scan flags it even on a clean checkout, so the scan would stay red after the untrack.
2. **R7-2 (HIGH, FR-703 M)**: no journal reader route — `/journal/{category}/{slug}` 404s; the index renders its posts unlinked; the sitemap has zero article URLs; the typeahead journal group is hard-empty.
3. **R7-3 (MEDIUM, FR-704 M)**: 6 of the 12 mandated static pages unseeded (404 live).
4. **R7-4 (HIGH, R-DB-1 P0 + R-SHOP-1 P1 + FR-105)**: search depth quarter-implemented — ad-hoc `to_tsvector(p.title)` per row (no maintained vector/GIN), no trigram union, and `search_synonym` is dead data (live `q=couch` → 0 results while `q=sofa` returns the armchair).
5. **R7-5 (HIGH, R-SHOP-2 L)**: no facet/filter UI on `/shop` — confirmed, stays queued (L-size).
6. **R7-6 (MEDIUM, FR-308/R-SHOP-3)**: PDP reviews surface absent (flag on, no seeded reviews) — queued.
7. **R7-7 (LOW, FR-307 S)**: cross-sell stub — queued.
8. **R7-8 (LOW, Phase 2)**: consent banner absent — by design until soft-launch hardening.
9. **R7-9 (INFO)**: PAD drift — TOC §11 title ≠ body heading, ADR-7 money citation wrong, round-6 edits without a revision entry.

Validated-healthy (no action): sort via URL works (PAD's "sort falls to default" is stale — corrected); pagination wired (catalog too small to paginate); `?variant=` deep-link implemented (D10 probe was DOM-marker-blind); typeahead garbage tolerance; TTFB 117–170 ms vs the 800 ms SLO.

Plan: `docs/plans/2026-09-11-live-e2e-remediation-round7.md` — validated seam-by-seam against the codebase before execution.

## Step 3 — TDD execution

### Slice 1 — R7-1: untrack `.env` + de-marker the prose
RED: exact CI scan replay flags `.env:7`, `.env:31`, `session_8.md:81`. GREEN: `git rm --cached .env` + rephrase the session-8 line to name the header without reproducing it; a `git archive`-of-staged-index checkout simulation scans **clean** (working-tree `.env` intentionally still trips `--no-ignore` scans — CI never sees it). Commit `72fc9b3`.

### Slice 2 — R7-2: FR-703 journal reader route
RED first: 7 commerce integration specs (functions absent) + 3 unit specs + 7 E2E specs (route 404s). GREEN: `getJournalPost` (published-only; route validates `post.category === params.category` — mismatch 404s, FR-201-style self-consistency), the RSC route (sanitized body, Article + BreadcrumbList JSON-LD via `safeJsonLd`, canonical/og:url per the R5-2 convention, related-product embeds via the same `listProducts` CTE), index links, sitemap journal entries (priority 0.4, lastModified), typeahead journal group (category-scoped hrefs; the dropdown gains the Journal kind label).

Two mid-slice lessons: the combobox options navigate via mousedown (no anchor — the spec asserts click-through, not `href`); E2E needs a fresh build after client-island changes (`reuseExistingServer` serves the stale build — cost a RED cycle). Commit `eacc65f`.

### Slice 3 — R7-3: FR-704 full dozen
RED: `packages/db/src/seed-coverage.test.ts` (12 published slugs + journal/synonym seed companions) — 6 missing. GREEN: the six seed rows, honest copy (trade-program names the manual concierge path while FR-901 self-service is in preparation; cookies states the Phase-2 consent posture rather than claiming a banner). E2E asserts all twelve resolve 200 + the accessibility WCAG 2.2 AA copy. Idempotent re-seed verified. Commit `b886c03`.

### Slice 4 — R7-4: search depth (R-DB-1 + R-SHOP-1)
RED first: schema-shape spec, 7 `expandSearchTerms` unit specs, 5 integration specs. GREEN, in two root-caused steps:
- Migration 0001 (additive): `product.search_vector` GENERATED ALWAYS STORED — title A / materials+desc B weights per PRD §8.8 — + GIN index, backfilling all rows. **Two PG immutability lessons captured en route**: `to_tsvector('english', …)` is not immutable without the `::regconfig` cast, and `array_to_string` is STABLE — the migration prepends an `immutable_text_array_to_string` wrapper (honest for text[], where output is deterministic). A botched first generate left the journal inconsistent (0001 deleted, 0002 created) — reset to a single clean 0001 before applying.
- Query wiring: `listProducts` and `searchTypeahead` now probe the maintained vector with `expandSearchTerms`-expanded synonyms + `similarity(p.title, q) >= 0.5` trigram + ILIKE, kept symmetric so typeahead and the results page can never disagree. Measured honestly: full-title typo 0.870 (matches); partial two-word typo 0.478 (stays below the PAD's threshold — documented, not lowered).

Commit `3cfa4f8`.

### Slice 5 — R7-9 + docs alignment
PAD v1.1: revision-history entries for rounds 6–7 (fixes the missing-entry drift), TOC §11 corrected to the body heading, §4.2 money citation ADR-7 → ADR-001, §11 rows updated (R-DB-1 and R-SHOP-1 Resolved with commit refs and evidence; R-SHOP-2's stale sort text corrected; R-DB-2 explicitly deferred with rationale — it touches money/order-state DDL, which PRD §15 flags for scope confirmation, and deserves pre-flight data validation). Traceability: FR-104 (journal group live), FR-105 (Deferred → Aligned), FR-701..704 (reader route shipped), FR-704 (full dozen). Ledger round-7 entry. AGENTS.md/CLAUDE.md conventions (search_vector contract, journal route shape, .env 4th occurrence + prose-marker rule, generated-column gotchas). This session narrative.

## Final verification

Gates green: lint 8/8 · typecheck 8/8 · tests 7/7 tasks (config 50, auth 19, admin 11, web 35, db 22, commerce 146 — integration live on embedded PG 17.5) · build 2/2 · Playwright web **64/64** local · admin **8/8** local. `git ls-files | grep '^\.env$'` empty. CI checkout-simulation scan clean. `skills/` and `infrastructure/` untouched by every commit.

## Step 4 — Push to GitHub via SSH wrapper

Pushed to `origin/main` via the SSH wrapper (paramiko) with the uploaded key. Post-push live re-check: the round-7 fixes await redeploy (documented ops action: `./start_server.sh` + `pnpm db:migrate` so the deployment's DB gains `search_vector` before the new build serves search traffic).

## Summary

| ID | Finding | Fix | Evidence |
|---|---|---|---|
| R7-1/R7-1b | `.env` re-tracked 4th time at `a5ffbf7`; session-8 prose trips the CI scan | Untracked; prose rephrased | Scan replay red→green on an index-tree checkout simulation |
| R7-2 | FR-703 journal reader route missing (404, unlinked index, empty typeahead group, no sitemap URLs) | Route + index links + Article JSON-LD + sitemap entries + typeahead journal group | 7 integration + 3 unit + 7 E2E specs red→green |
| R7-3 | 6 of 12 FR-704 static pages 404 | Seeded (idempotent, honest copy) | Seed-coverage integration + 2 E2E specs red→green |
| R7-4 | R-DB-1 P0 (no maintained search_vector) + R-SHOP-1 P1 (synonyms dead, no trigram) | Migration 0001 (generated column + GIN, additive) + expandSearchTerms + symmetric query wiring | 13 specs red→green; similarity measured (0.870 vs 0.478) |
| R7-9 | PAD drift (TOC, ADR citation, missing revision entries) | PAD v1.1 with round-6/7 revision entries + §11 row updates | Doc diff |
| R7-5/R7-6/R7-7/R7-8 | Facets (L), reviews (M), cross-sell (S), consent banner (Phase 2) | Documented as queued with rationale | PAD §11 |

**Suggested next steps:**
1. Redeploy via `./start_server.sh` (runs migrate) to publish round 7 — then live-verify the journal routes, the dozen static pages, and search depth (couch→sofa, typo tolerance).
2. **Rotate `BETTER_AUTH_SECRET`/`CRON_SECRET`** — 4th public exposure.
3. R-DB-2 (DDL CHECK constraints) as its own dedicated session with pre-flight data validation.
4. R-SHOP-2 (facet UI) unblocks the last blocked R-SEO-1 row.

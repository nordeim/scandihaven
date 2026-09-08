# Remediation Plan — 2026-09-08 (PRD alignment audit follow-up)

Governing contract: PRD §15 workflow (ANALYZE → PLAN → VALIDATE → IMPLEMENT → VERIFY → DELIVER); smallest correct path per slice; test-first at pre-agreed seams; no guardrail weakening. Findings referenced by `F-xx` are defined in `docs/audits/2026-09-08-prd-alignment/findings.json`.

## 1. Constraints recorded up front

- Sandbox has **no Docker/Postgres**: real-PG integration tests cannot execute locally. They are written at the established `skipIf(!dbReady)` seam (pattern: `packages/commerce/src/jobs.test.ts`) and **execute in CI**, which provides a PG 17 service — valid once the CI trigger bug (F-02) is fixed. Claims are labeled accordingly in the ledger.
- No new branches; all commits to `main` (Conventional Commits, atomic per slice).
- No dependency changes required; no lockfile edits.

## 2. Executed slices (this pass)

| # | Slice | Finding | Seams / tests | Verify |
|---|---|---|---|---|
| R01 | Fix CI: run migrate+seed **before** Unit tests (DATABASE_URL is job-level, so integration tests currently execute against an un-migrated DB); drop `|| true` from audit (verified passing: 1 moderate); add dependency-free secret-scan step | F-02, F-09 | workflow YAML | `pnpm audit` re-run; YAML review |
| R02 | `pricing.test.ts`: dedupe-line-id generator (module-scope `uniqueLinesArb`) for all property tests feeding `computeCartTotals`/`distributeDiscount`; keeps the deliberate duplicate-id guard green | F-audit-gate | red test already observed → green after fix | `pnpm --filter @scandihaven/commerce test` |
| R03 | Mount Better-Auth route handler `/api/auth/[...all]` in **both** apps via `toNextJsHandler(auth.handler)` (verified export of `better-auth/next-js`) | F-01 | new test in `packages/auth` asserting handler shape (GET/POST functions derived from `auth.handler`) | typecheck + auth test |
| R04 | Checkout money integrity (§7.11/§7.10/§8.3): shared cart price-input loader (lines + promotions) used by BOTH intent creation and webhook re-verification; checkout action passes validated email+address → PaymentIntent metadata → real `order_address` rows; `order.discount` reflects promotion | F-03 | pure mapper unit tests (commerce); `skipIf` integration tests for placement totals incl. promotion | commerce tests + typecheck + build |
| R05 | `transitionOrderAction` server-authoritative: read order `FOR UPDATE` inside TX; unknown order → `NOT_FOUND`; stale client `from` → `CONFLICT`; compute `transition(actualStatus, event)`; guarded update | F-04 | `skipIf` integration test (wrong/stale/valid transitions) | as above |
| R06 | `PgJobRunner`: unknown kinds dead-letter on first sight (regression test with default `maxAttempts=5`); existing `maxAttempts:1` test stays green | F-06 | integration test (skipIf) | as above |
| R07 | `requirePermission` raises typed `ForbiddenError`; both admin actions catch → `fail("FORBIDDEN", …)`; add minimal vitest infra to `apps/admin` and unit-test the guard contract | F-07 | admin vitest unit test | admin test + typecheck |
| R08 | Rate limiting (§9.4 minimal viable): `packages/commerce/src/rate-limit.ts` — pure window math (unit-tested, no DB) + `consumeRateLimit` upsert on `rate_limit_hit` (integration test, skipIf); wire typeahead (60/min/IP → 429 + `Retry-After`) and newsletter action (3/hour/IP → `RATE_LIMITED`); fix the false comment; Zod-validate typeahead response | F-05, part F-17 | pure unit tests + integration test | commerce tests |
| R09 | Security headers (§9.3): move manifest to `packages/config` (`./security-headers`), add HSTS `preload`, unit tests in config; web proxy + admin proxy both apply the manifest; delete drifting web copy | F-15 | config unit tests (test-first) | config tests |
| R10 | Fail-fast hygiene: cart-secret getter (no insecure fallback; throws with actionable message when `BETTER_AUTH_SECRET` missing/short — unit-tested); `instrumentation.ts` in both apps calls `parseServerEnv()` + `parseFlags()` at boot (dormant machinery now wired, §9.4) | F-08 | commerce unit tests (env stubbed) | commerce tests |
| R11 | Order-number sequence hardening: per-year advisory lock inside the placement TX (eliminates the MAX+1 race that, combined with the pre-inserted `webhook_event` row, could silently lose a paid order) | F-13 (part) | integration test (skipIf: concurrent placements produce unique sequential numbers) | typecheck + CI |
| R12 | Small FR-conformance: PDP lead time derived from product/variant data (FR-304); variant selection syncs `?variant=SKU` via `history.replaceState` (FR-302); `not-found`/`error` name FR-109 and `/lookbooks` honest-404 names FR-705; `.env.example` gains `FEATURE_*` + `DISABLE_IMAGE_OPTIMIZER` rows (§13.4); admin eslint anonymous-export warning fixed; `fxRate: "1"` comment names FR-504; `mergeGuestCartIntoUserCart` comment documents deferred wiring (FR-403) | F-18, F-27, F-28, F-23, F-16 | typecheck + existing gates | gates |
| R13 | Docs artifacts: `docs/verification-ledger.md` (§12.4), `docs/traceability.md` (§14.2), audit report + findings (already under `docs/audits/…`), this plan | F-10 | — | review |
| R14 | README/AGENTS wording aligned with reality (overclaim F-11 corrected; CI order note) | F-11 | — | review |

## 3. Queued backlog (documented, intentionally not executed here — one slice each, with rationale)

| # | Slice | Finding | Why deferred |
|---|---|---|---|
| B1 | §7.6 two-phase reservation: reserve at placement (`qty_reserved += qty`), release on cancel, decrement at ship + movement ledger | F-12 | Significant DB-behavior change; requires live-PG iteration to verify reservation windows and release paths; current code never oversells (re-check under lock) |
| B2 | §8.7 webhook-after-abort: place order in `review` + `payment_orphan` alert on AMOUNT_MISMATCH; move `webhook_event` insert inside the placement TX or adopt reconciliation job | F-13 | Normative behavior change to the money path; needs Stripe test-mode + PG to verify end-to-end |
| B3 | Promotion usage limits: count `promotion_redemption`, enforce `usageLimit`/`perCustomerLimit` at apply-time | F-22 | Needs PG integration tests + UX for limit-reached errors |
| B4 | §8.8 search upgrade: `product.search_vector` column + GIN + trigger, `pg_trgm` similarity union, `search_synonym` expansion, facets + `product_metrics` view, typeahead categories/journal | F-17 | Schema migration + query rewrite; must be tuned/verified against seeded data (EXPLAIN) |
| B5 | Cart merge-on-login wiring via Better-Auth `databaseHooks` (FR-403) + drawer `useOptimistic` rollback (FR-401) | F-16 | Auth-hook behavior needs runtime verification (cookie scope inside hook); UI rollback needs E2E |
| B6 | Schema hygiene: DB CHECK constraints (qty≥0, rating 1..5, alt<>'', qty 1..99), `parent_id` self-FKs, `$onUpdate` for `updated_at`, optimistic-concurrency 409 on admin product edits | F-20, F-21 | Migration + broad schema diff; drizzle-kit generate is offline but applying/verifying needs PG |
| B7 | Multi-currency snapshot (FR-504): real fx_rate lookup, `total_eur` booking | F-23 | Only EUR exists in prices today; feature slice with seed data |
| B8 | SEO/i18n/analytics: sitemap.ts, robots.ts, Organization/WebSite/BreadcrumbList/Article JSON-LD, canonical on remaining indexables, typed `track()` module, next-intl wiring (FEATURE_I18N currently meaningless) | F-19 | Phase 1/2 scope per §13.6; self-contained feature slices |
| B9 | Auth hardening: magic-link plugin, zxcvbn-lite scoring, 2FA for Owner/Admin (proxy-enforced), `/account` proxy gate mechanism | §9.1/§9.2 | PRD-tracked deferrals; plugin schema changes want careful verification |
| B10 | E2E expansion to §12's 8 critical journeys + axe on /checkout + FR-ID annotations; Lighthouse CI | F-26 | Browser-stack dependent |
| B11 | Seed strategy: natural keys/hash-based content upserts for `announcement`/`nav_entry` (schema change) | F-14 | Interim app-level guard applied this pass; schema-level fix belongs with B6 migration |
| B12 | FR-901..906 Trade program (Phase 5 per §13.6), FR-911..914 status-email jobs/templates, gift cards, returns portal | F-11 | Phase 5 features; traceability matrix now names them |

## 4. Validation of this plan against the codebase (pre-execution check)

- Every executed slice was re-verified against the cited file:line before implementation (R03's `toNextJsHandler` export confirmed from `better-auth/next-js`; R08's `rate_limit_hit` PK `(bucket, window_start)` confirmed in `ops.ts`; R05's action shape confirmed in `orders.ts`; R01's audit status confirmed by execution).
- No slice requires a dependency addition; no slice weakens lint/type/test gates; no schema migration is required by any executed slice (that is exactly why B6/B11 are queued).
- Gate expectation after execution: `pnpm lint` (0 errors), `pnpm typecheck` (8/8), `pnpm test` (commerce green incl. new unit tests; DB-integration tests run in CI), `pnpm build` (2/2).

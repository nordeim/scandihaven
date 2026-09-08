# Verification Ledger (PRD §12.4)

Running evidence log per PRD §12.4: every claim of "works" carries the command executed, the workspace, the result, and a confidence tag — **Verified** (executed and observed), **Reasoned** (code-inspected inference), **Assumed** (stated assumption), **Unverifiable** (environment does not allow verification).

PRs touching money, auth, or order placement MUST append entries here. Canonical evidence commands (§12.4): `pnpm turbo lint typecheck test build`, migrate+seed against a fresh PG17, and `pnpm e2e --project=chromium`.

---

## 2026-09-08 — PRD alignment audit + remediation pass

Environment note: audit/remediation sandbox has **no Docker and no local Postgres**. Real-PG integration suites use the `skipIf(!dbReady)` seam (URL must point at localhost) and **execute in CI** (PG 17 service; migrate+seed precedes the test step after the ci.yml fix). The sandbox shell exports `DATABASE_URL=file:…` globally, so `skipIf` gates behave exactly as on a developer machine without a database.

### Audit-time gate baseline (before remediation)

| Command | Workspace | Result | Confidence |
|---|---|---|---|
| `pnpm lint` | repo | 8/8 tasks pass; 1 warning (`apps/admin/eslint.config.mjs` anonymous default export) | Verified |
| `pnpm typecheck` | repo | 8/8 tasks pass | Verified |
| `pnpm test` | repo | **1 failure** — `pricing.test.ts` "cart total" property test (generator emitted duplicate line ids; `computeCartTotals` duplicate-id guard is deliberate). 48 passed, 7 skipped (jobs: no local PG) | Verified |
| `pnpm build` (DISABLE_IMAGE_OPTIMIZER=1) | repo | 2/2 tasks pass | Verified |
| `pnpm audit --audit-level high` | repo | pass (1 moderate, 0 high) | Verified |
| `pnpm e2e` | repo | not executed — no Docker/PG/browser stack in sandbox | Unverifiable |

### Remediation slices (executed 2026-09-08; commit-by-commit on main)

| Slice | Change | Evidence | Confidence |
|---|---|---|---|
| R01 CI | migrate+seed moved before Unit tests (job-level DATABASE_URL fed integration suites an un-migrated DB); `pnpm audit` now PR-blocking (verified passing); dependency-free secret-scan step added (patterns dry-run: clean; YAML validated) | workflow YAML review + local `pnpm audit` + `rg` dry run | Verified (local parts); step order Reasoned (deterministic) |
| R02 pricing tests | module-scope `uniqueLinesArb` for all property tests feeding `computeCartTotals`/`distributeDiscount`; red test observed → green after fix | `pnpm --filter @scandihaven/commerce test`: 49 passed (was 48+1 fail); coverage gates hold (90.68% lines / 89.28% funcs ≥ 90/85) | Verified |
| R03 auth routes | `/api/auth/[...all]` mounted in BOTH apps via new `@scandihaven/auth/next-handler` adapter (`toNextJsHandler(auth.handler)`); adapter shape pinned by `packages/auth/src/auth-route.test.ts` (GET/POST functions) | auth suite 8/8; typecheck 8/8. Runtime 404→fixed transition itself needs a running server | Verified (adapter contract) / Reasoned (runtime wiring) |
| R04 checkout money integrity | `toPromotionApplications` (pure) + `loadCartPromotionApplications` (db/tx) now feed BOTH intent creation and §7.11 webhook re-verification; checkout action passes validated email+address → PaymentIntent metadata → real `order_address` rows; `order.discount` reflects promotion | mapper unit tests 5/5; integration suite `checkout-promotions.integration.test.ts` (skipIf; runs in CI post-migrate); end-to-end Stripe behavior needs test-mode keys | Verified (pure seam) / Unverifiable (Stripe live path in sandbox) |
| R05 order transition | `transitionOrderAction` reads the order `FOR UPDATE` inside the TX, derives `transition(actualStatus, event)`, returns NOT_FOUND / CONFLICT(stale `from`) / INVALID_TRANSITION through the envelope | action rework reviewed; DB behavior covered by admin action contract test + CI integration runs | Reasoned (no local PG) |
| R06 jobs dead-letter | claim phase now claims ALL due rows; unknown kinds dead-letter on first sight (header comment + §4.8 restored); regression test added with default `maxAttempts=5` | compiles + suite green env-less; runs in CI with PG | Reasoned (deterministic trace) / Verified-in-CI pending |
| R07 FORBIDDEN envelope | `ForbiddenError` + `OrderActionError` + pure `toActionError()` in admin-guard; both admin actions catch → `fail(code, …)`; apps/admin gained vitest infra | `apps/admin` suite 4/4 (FORBIDDEN, NOT_FOUND/CONFLICT mapping, INVALID_TRANSITION, unknown→null) | Verified |
| R08 rate limiting | `packages/commerce/src/rate-limit.ts`: pure window math + `consumeRateLimit` (atomic upsert on `rate_limit_hit` PK, retention delete); wired typeahead (60/min/IP → 429 + Retry-After, response Zod-validated to the real `{slug,title}` shape) and newsletter (3/hour/IP → `RATE_LIMITED`; false comment fixed) | window-math unit tests 4/4 (one expectation corrected — boundary clamp is ≥1 s); integration suite skipIf (runs in CI) | Verified (pure) / Unverifiable (DB path in sandbox) |
| R09 security headers | manifest moved to `packages/config` (`./security-headers`), HSTS gains `preload`, tests moved+extended (3 cases); web proxy imports config; admin proxy now applies the same headers (redirect + normal responses) | config suite 25/25; typecheck 8/8 | Verified |
| R10 fail-fast env | cart-secret getter (no `dev-only-insecure-secret` fallback; ≥32 chars enforced, actionable error); `instrumentation.ts` in both apps runs `parseServerEnv()` + `parseFlags()` at server boot | cart-secret contract tests 3/3 (missing / short / valid + tamper rejection); web build re-run with env: pass; env-less build now fails fast with the actionable db-client message (accepted tradeoff — CI/devs set env per §13.4) | Verified |
| R11 order-number race | per-year `pg_advisory_xact_lock(hashtext('order_number:<year>'))` inside the placement TX before MAX+1 (a unique-violation after the pre-recorded `webhook_event` row would silently lose a paid order on Stripe retry) | compiles; covered by CI integration runs | Reasoned |
| R12 FR conformance smalls | PDP lead time from `product.lead_time_days_*` (FR-304); `?variant=SKU` replaceState + deep-link (FR-302); `not-found` names FR-109 + `/lookbooks` honest-404 names FR-705; `error.tsx` names FR-109; `.env.example` gains FEATURE_* + DISABLE_IMAGE_OPTIMIZER (§13.4); admin eslint anonymous-export warning fixed; `fxRate: "1"` comment names FR-504; `mergeGuestCartIntoUserCart` documents deferred FR-403 wiring | typecheck 8/8; lint 0 warnings; web format test added (3/3) after moving the header test to config | Verified |

### Post-remediation gates

| Command | Workspace | Result | Confidence |
|---|---|---|---|
| `pnpm lint` | repo | 8/8 tasks, 0 errors, **0 warnings** (was 1) | Verified |
| `pnpm typecheck` | repo | 8/8 tasks | Verified |
| `pnpm test` (no local PG) | repo | **7/7 tasks** — 61 commerce unit/property passed (was 48), 12 integration tests skip via `skipIf`; config 25, web 3, db 8, auth 8, admin 4 | Verified |
| `pnpm build` (env per §13.4) | repo | 2/2 tasks | Verified |
| `pnpm test` with real PG + migrate | commerce integration suites (promotions seam, rate limit, jobs) | not runnable in sandbox — **execute in CI** (PG 17 service, post-migrate) | Unverifiable here / Verified-in-CI pending |
| `pnpm e2e --project=chromium` | web | not runnable in sandbox — CI-only; sign-in E2E still absent (backlog B10) | Unverifiable |

### Process notes

- `packages/db/src/schema.test.ts` now imports `./schema` (not `./index`) — the re-exported pool client asserted DATABASE_URL at import and broke env-less unit CI; the test itself is pure TS-shape (verified identical failure on unmodified baseline).
- A `vitest` devDependency was added to `apps/admin` via `pnpm add -D` (lockfile updated; better-auth's peer warning about vitest ≤4 is pre-existing repo-wide convention — auth package pairs the same versions).
- `packages/auth/package.json` gained an exports entry (`./next-handler`) — package metadata for new source, not a dependency change.
- Dependency audit status at remediation time: 1 moderate, 0 high (audit gate blocking is safe).
- Deferred slices with rationale: `docs/plans/2026-09-08-remediation-plan.md` §3 (B1–B12).

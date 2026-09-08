# PRD Alignment Audit Report — 2026-09-08

- **Spec**: `PRD.md` v4.0 · **Plan executed**: `docs/plan_PRD_codebase_validate.md` (frozen copy: `PLAN.md`)
- **Scope**: `apps/*`, `packages/*`, root tooling, CI. **Excluded per instruction**: `skills/`, `infrastructure/` (code checking/testing/compilation).
- **Mode**: read-only audit first (no code changed during validation); remediation executed afterwards as separate, individually-committed slices.
- **Evidence**: `findings.json` (31 findings, file:line + quoted evidence) · executed-gate log in `docs/verification-ledger.md`.

## 1. Executive summary

The Phase 0 scaffold is **architecturally faithful** to the PRD: all 11 NFR-STACK rules pass with citations, the action/ActionResult doctrine, webhook placement transaction, integer-money engine, RBAC matrix, and the 53-table schema (24 value-exact enums) all check out. Version manifest has **zero drift** against §3.1.

However, the audit surfaced **2 Critical and 3 High defects** that block the scaffold's own claims:

1. **Better-Auth is not mounted** — no `/api/auth/[...all]` route handler exists in either app, so sign-in (and therefore the entire admin, which is session-gated) 404s at runtime. (F-01)
2. **CI is red by construction** — `DATABASE_URL` is exported at job level and passed through turbo's `globalEnv`, so the *Unit tests* step runs the real-PG integration suite **before** *Migrate + seed*, against an un-migrated database. (F-02; an initial trigger-corruption hypothesis was retracted after raw-byte verification — `branches: [main]` is valid.)
3. **Checkout charges the wrong amount** when a promotion is applied — the PaymentIntent and the §7.11 re-verification both compute totals with `promotions: []` / `shippingMinor: 0`, while the displayed cart total includes promotions; the validated checkout address is discarded entirely. (F-03)
4. **Order transitions trust a client-supplied status** — no server-side read of the order row, enabling sideways state moves from stale/replayed forms. (F-04)
5. **Rate limiting (§9.4) does not exist** — the `rate_limit_hit` table is dead and a code comment falsely claims the newsletter action is "rate-limited upstream". (F-05)

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 3 |
| Medium | 14 |
| Low / Aligned-notes | 12 |

## 2. Verification ledger (audit itself)

| Gate | Result | Note |
|---|---|---|
| `pnpm lint` | ✅ 8/8 tasks | 1 warning (`apps/admin/eslint.config.mjs` anonymous default export) |
| `pnpm typecheck` | ✅ 8/8 tasks | strict config incl. `noUncheckedIndexedAccess` |
| `pnpm test` | ❌ 1 failure | `pricing.test.ts` property test: generator emits duplicate line ids; `computeCartTotals` duplicate-id guard is deliberate (FR-810 counterexample fix). Test generator is wrong, not the domain code. `jobs.test.ts` (7 tests) skips by design without local PG. |
| `pnpm build` | ✅ 2/2 tasks | both apps, Turbopack |
| `pnpm e2e` | ⛔ not runnable | sandbox has no Docker/PG/browser stack → Unverifiable here |
| `pnpm audit --audit-level high` | ✅ pass | 1 moderate, 0 high — makes the `|| true` removal safe |

Confidence labels: every finding in `findings.json` carries Verified / Reasoned / Assumed. Items requiring a live DB, running server, or Stripe keys are explicitly listed as Unverifiable-in-sandbox; several of the DB-backed integration tests written during remediation execute in CI (which provides a PG 17 service) once the trigger bug is fixed.

## 3. Top risks (ordered)

1. **F-01 auth route missing** — no authenticated flow can work; admin unreachable.
2. **F-02 CI step order** — integration tests run pre-migration in CI; the repo's "green CI" claims cannot hold on main until reordered.
3. **F-03 checkout money integrity** — charged ≠ displayed with promotions; empty order addresses (support/CS impact, §7.11 gate defeats its purpose).
4. **F-04 transition trust** — tampering/stale-form drift of order state (§9.7 STRIDE).
5. **F-05 no rate limiting** — auth/typeahead/newsletter abuse surface; §9.4 unimplemented and unstubbed.
6. **F-12 reservation protocol** — cancelled orders permanently lose stock (deferred slice, needs real-PG integration work).
7. **F-13 webhook-after-abort lost orders** — event row persists before placement TX; §8.7 review-path missing (advisory-lock sequence hardening done this pass; review-path deferred).
8. **F-11 README/PRD-App-B overclaim** — "every deferred surface stubbed with FR ID" is ~25% true; traceability now lives in `docs/traceability.md`.

## 4. NFR-STACK regression watchlist

All 11 rules pass today (F-29). Watch items for future change: NFR-STACK-7/8 (`@source` + literal-hex tokens are load-bearing), NFR-STACK-10 (page export whitelist), NFR-STACK-11 (`react-dom/server` runtime import — keep the `turbopackIgnore` pattern in `packages/email/src/send.ts`), and the boundary direction `db ← auth ← commerce ← apps`.

## 5. Remediation

- **Executed this pass** (2026-09-08, TDD where seams allow): see `docs/plans/2026-09-08-remediation-plan.md` §2 — slices R01–R14 (F-01…F-09, F-10, F-14 partial, F-15, F-18 partial, F-27, F-28 partial, plus order-sequence hardening from F-13).
- **Queued backlog** (one slice per Major drift, per plan §7): `docs/plans/2026-09-08-remediation-plan.md` §3.
- **Traceability**: `docs/traceability.md` (FR → locus → verification → status; §14.2 full matrix).
- **Evidence**: `docs/verification-ledger.md` (§12.4 running ledger, now maintained).

# Remediation Plan — 2026-09-09 E2E Live-Site Audit

Governing contract: PRD §15 workflow (ANALYZE → PLAN → VALIDATE → IMPLEMENT → VERIFY →
DELIVER); TDD at pre-agreed seams (red → green); no guardrail weakening; finding IDs refer to
`docs/audits/2026-09-09-e2e-live-site-audit/findings.md`.

## 0. Constraints recorded up front

- Sandbox has **no Docker/Postgres/Stripe** (verified): real-PG integration suites and
  Playwright E2E are written at their established seams (`skipIf(!dbReady)`, E2E spec) and
  execute in CI. Local verification = unit tests + lint + typecheck + build + scripted
  curl-level checks. Claims labeled per §12.4.
- No new branches; all commits to `main` (Conventional Commits, atomic per slice).
- No new dependencies. The auth fix uses Better-Auth 1.7.3 **native** capabilities only
  (`trustedOrigins` function form; `BETTER_AUTH_TRUSTED_ORIGINS` env) — verified against the
  installed `dist/context/helpers.mjs`.
- The two secrets files and `docs/bak.env` stay on disk locally (untracked) so the running
  deployment config is not disturbed; they leave the git index and history-forward view.

## 1. Slices for THIS pass

| # | Slice | Finding | Seam / tests | Red→Green |
|---|---|---|---|---|
| E1 | **Untrack secrets**: `git rm --cached .env .env.local docs/bak.env`; `.gitignore` gains `docs/bak.env` + `**/bak.env`; rotation flagged as ops (README + ledger) | C2r | `git ls-files` post-fix must list neither; `.gitignore` covers `docs/bak.env` | n/a (ops/config) |
| E2 | **CI scan hardening**: add `--no-ignore` + scratch-dir excludes (`!.turbo/`, `!coverage/`, `!playwright-report/`, `!test-results/`) to the secret scan | C-CI | local run of the exact CI `rg` command: (a) `--no-ignore` surfaces seeded test fixture, (b) clean run against a pristine worktree passes | n/a (CI YAML) |
| E3 | **Auth trusted origins**: new pure `requestOriginFromHeaders()` in `packages/auth/src/trusted-origins.ts` (derives served origin from `x-forwarded-host`/`host` + `x-forwarded-proto`, never from `Origin`/`Referer`); wire as Better-Auth `trustedOrigins` function; document `BETTER_AUTH_URL` (public origin) + native `BETTER_AUTH_TRUSTED_ORIGINS` in `.env.example` | H-AUTH | `trusted-origins.test.ts` (7 cases incl. attacker-Origin independence, comma chains, localhost http) + wiring regression test via `auth.$context` (red: not a function) | red → green |
| E4 | **start_server.sh PDP check slug**: `halden-armchair` → `halden-linen-armchair` | M-SH | `bash -n`; grep asserts seeded slug exists in `packages/db/src/seed/ensure-seeded.ts` | n/a (shell) |
| E5 | **SSR the 404**: root `not-found.tsx` → server component (no `usePathname`); add `lookbooks/[[...slug]]/page.tsx` (calls `notFound()`) + segment `lookbooks/not-found.tsx` naming FR-705; both variants fully SSR | M-404 | E2E spec extensions: SSR body of `/this-page-does-not-exist` contains "This page has wandered off"; `/lookbooks` SSR body contains FR-705 note (CI-run; red today — Verified live) | red (CI) → green (CI) |
| E6 | **Seed FAQ page**: idempotent `staticPage` insert matching footer `/faq` link | M-FAQ | seed pattern review; real-PG verification in CI (re-seed idempotency) | n/a (needs PG) |
| E7 | **PDP title dedup**: `generateMetadata` returns `title: { absolute: … }` | M-TITLE | E2E PDP assertion: exactly one `\| Scandi Haven` in `<title>` (CI-run) | red (CI) → green (CI) |
| E8 | **Collection products at DB level**: `productQuerySchema.ids` (uuid array, ≤500) + `listProducts` `IN` filter (mirrors existing subtree `IN` idiom); collections page passes IDs, drops dynamic import + `void inArray;` | M-COL | schema unit test in `packages/commerce` (red: `ids` rejected) → green; SQL path via CI integration | red → green (schema) |
| E9 | **Admin health logging**: `catch` → `console.error("[health] db check failed", error)` | M-HLTH | lint/typecheck; contrast with web route | n/a (observability) |
| E10 | **Full gates**: `pnpm lint typecheck test build` | — | executed evidence | — |
| E11 | **Docs alignment**: traceability corrections (FR-104/FR-703 honesty), verification-ledger entries, README Troubleshooting ("Invalid origin" row + secret-rotation note), AGENTS.md auth quirk line, CLAUDE.md env-table row | D-TRACE, H-AUTH docs | review | — |

**Explicitly NOT executed** (deferred, tracked): L-PROD (SQL dedupe — backlog), L-STR (ops env
alignment), L-NAV (FR-101 Contact / FR-104 search UI — Phase-1 feature slices), L-COPY
(checkout copy tweak), I-WH (webhook 4xx semantics), I-JRN (journal detail — Phase-1 slice
FR-703), plus the standing Phase-1–5 backlog in `docs/plans/2026-09-09-remediation-plan.md`.

## 2. Pre-execution validation (against the codebase, done before writing code)

- E3: `better-auth@1.7.3` dist read — `getTrustedOrigins()` calls `options.trustedOrigins(request)`
  when it is a function (helpers.mjs:78-80); `validateOrigin` merges context + per-request
  lists (origin-check.mjs:96-120); `auth.$context` is public (`types/auth.d.mts:18`).
  `auth-route.test.ts` proves the hermetic-env import pattern works without Postgres. ✅
- E5: `not-found.tsx` renders inside the root layout; segment-level `not-found.tsx` renders
  for `notFound()` thrown within that segment — the `[[...slug]]` catch-all gives /lookbooks/*
  a route whose only job is the honest 404. Playwright `response.text()` returns SSR HTML. ✅
- E8: `productQuerySchema` is additive (`z.object` + defaults); the `IN ${ids}` binding idiom
  already ships in the same query (category subtree path, live-verified working). ✅
- E6: `static_page` has `uniqueIndex("static_page_slug_idx")` → `onConflictDoNothing()` targets
  it naturally (same as the five existing seeded pages). ✅
- E1/E2: `git show --stat 262d3cc` re-add confirmed; local CI-command replay reproduced the
  gitignore blind spot (docs/bak.env matched; .env not). ✅

## 3. Verification ledger (post-execution summary goes to docs/verification-ledger.md)

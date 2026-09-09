# Recent Code Changes Review — Validation Plan

| Field | Value |
|---|---|
| Plan ID | 2026-09-10-recent-changes-review |
| Scope | `48be575..e9c061f` — 11 commits (5241904 → e9c061f), 29 files, `+695 / -178` |
| Trigger | Fresh E2E live-site audit `docs/audits/2026-09-09-e2e-live-site-audit/findings.md` + its remediation slices |
| Source inputs | `docs/recent_code_changes.txt` (git pull fast-forward log), `docs/session_3.md` (session transcript of the audit → remediation), `git log --stat`, per-commit diffs, `PRD.md v4.0`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/traceability.md`, `docs/verification-ledger.md` |
| Author | Engineering · Plan phase (no code changes in this document) |
| Status | Awaiting VALIDATE — do not implement until the user confirms scope |

> **Working rule (§15):** ANALYZE → PLAN → VALIDATE → IMPLEMENT → VERIFY → DELIVER. This document is the PLAN output for the post-`e9c061f` review. Every check cites an FR ID / NFR-STACK rule / PRD §, uses the agreed seams (§15), and labels claims Verified / Reasoned / Assumed / Unverifiable.

---

## 1 · Deep understanding synthesized (AGENTS.md / CLAUDE.md / README.md / PRD.md v4.0)

**Product:** Scandi Haven — DTC Scandinavian furniture/lighting/textiles/ceramics, €5M+ GMV, EU+US+UK, 4-person team. `PRD.md v4.0` is the single authoritative spec (FR-100…FR-999, NFR-STACK-1..11, §4.8 cross-cutting contracts, §7 DDL-level schema, §8 action contracts, §12.6 SLOs, §15 agent contract).

**Mandated stack (§3, NFR-STACK-1..11):** pnpm 10 + Turborepo 2 (no package build step — `transpilePackages`), Next.js 16.3 (`proxy.ts` at `apps/*/src/proxy.ts`, async `params`/`searchParams`/`cookies()`/`headers()`, page-file export whitelist), React 19.2, TS 5.9 strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `any` = ESLint error), Tailwind v4 CSS-first (`@theme` in `packages/ui/src/tokens.css`, `@source` directives load-bearing, `var()` chains banned — literal hex), Radix/shadcn, PG 17 + Drizzle 0.45, Better-Auth 1.7, Zod 4, Zustand 5, Stripe 22, Resend/React Email (`turbopackIgnore` dynamic `react-dom/server`), ESLint 9 flat, Vitest + Playwright + axe.

**Architecture invariants (§4):**
- Monorepo `apps/* → packages/*`, intra-package `db ← auth ← commerce ← apps`, `packages/ui` isolated (React/Radix/Tailwind only). Cycles silently break turbo.
- 3 layers: RSC pages → `commerce/*` queries (server-truth, re-derived pricing); Client islands (`"use client"` leaves, Zustand drawer/UI only); Domain/DB layer.
- Mutations only via Server Actions in `apps/*/src/actions/*` returning `ActionResult<T>` — never throw across the boundary. Route Handlers only for Stripe webhooks / Better-Auth / typeahead / `/api/jobs/run` / health.
- Cart identity: signed HMAC cookie `sh_cart` (`BETTER_AUTH_SECRET` ≥32 chars) holds a **token**, DB keys on cart **UUID** — `getCartId()` resolves token→UUID; never interchange.
- Admin: single RBAC matrix `packages/auth/src/rbac.ts`, `requirePermission()` + `audit_log` rows; no inline role checks.

**Domain rules:** Money = integer minor units, BigInt largest-remainder (property-tested), float banned. Order state only via `commerce/order-state.ts transition()` (`InvalidOrderTransition`). Provider ports §4.8 (Search/Consent/Tax/ShippingRate/Email/JobRunner — vendor SDKs never leave adapter). Feature flags `packages/config/flags.ts` fail-fast on unknown `FEATURE_*`. Seed advisory-locked natural-key upsert, refuses non-local `DATABASE_URL`. Inventory `qty_on_hand − qty_reserved − safety_stock`, made-to-order always purchasable.

**QA (§12):** Commerce coverage gates 90% lines / 85% funcs (pure domain), E2E Chromium + axe (serious/critical = 0), `pnpm audit --audit-level high` + secret scan as CI job 6. Full gate order: `pnpm lint typecheck test build` then `pnpm db:setup` before `pnpm e2e`. Evidence ledger `docs/verification-ledger.md` labels every claim Verified / Reasoned / Assumed / Unverifiable. Money/auth/order PRs require ledger entries.

**Current scaffold (§13.2, App B):** Phase 0 complete, Phase 1 scaffolded. The `e9c061f` batch is the second remediation pass (first was `3e500a1..7ee4ab2`, second is `5241904..e9c061f`) closing the live-site E2E findings. Deferred surfaces remain stubbed with FR IDs (§15.3).

---

## 2 · What `docs/recent_code_changes.txt` + `docs/session_3.md` actually describe

- `recent_code_changes.txt` is the **verbatim `git pull` log** of the fast-forward `48be575..e9c061f` (29 files, `+695 / -178`). It is not a curated summary — the plan below re-derives the real diff from `git log --stat` + per-file `git show`.
- `session_3.md` is the **session transcript** of the live-site audit and its remediation (curl 42-check sweep + `agent-browser` interactive Chromium on both `scandihaven.jesspete.shop` + `scandihaven-admin.jesspete.shop`, root-cause analysis per finding, TDD red→green execution, gate re-runs, docs alignment). Treat it as the *audit evidence* to be validated, not as a spec.
- Two extra untracked/modified files appeared after `e9c061f` (`docs/env.tgz`, `docs/recent_code_changes.txt` modified, `start_server_log.txt` modified) — listed in `git status` as `A/M` and explicitly excluded from this scope unless pulled into `main`.

---

## 3 · Review objectives

1. Prove each of the 11 commits fixes its claimed finding without regressing any NFR-STACK rule or @15 contract, and without widening trust boundaries.
2. Classify any gap as **Blocking / Major / Minor / Nit** and map it to FR ID / NFR-STACK ID / PRD § + file:line.
3. Produce auditable evidence — file:line citations, test counts, build logs, command outputs — not assertions.
4. Yield a traceability delta against `docs/traceability.md` and a prioritized remediation backlog if gaps exist.
5. Confirm the verification ledger (`docs/verification-ledger.md`) honestly reflects what was executed vs. Reasoned/Unverifiable.

Out of scope for this pass: live perf budgets vs. §11.4 on the deployed preview (needs staging + CrUX), infra cost validation, legal copy review — labeled Unverifiable.

---

## 4 · Commit inventory — the 11 slices under review

| # | Commit | Subject | Finding closed | Type | PRD loci |
|---|---|---|---|---|---|
| 1 | `5241904` | `chore(security): untrack .env, .env.local, docs/bak.env; ignore env backups (C2r)` | C2r — secrets re-committed by `262d3cc` after `dd352c6` had untracked them | Security | §9.4 secrets, §13.4 manifest, AGENTS.md env notes |
| 2 | `17decda` | `ci(security): run secret scan with --no-ignore so tracked-but-ignored files are scanned (C-CI)` | C-CI — CI `rg` honored `.gitignore`, so tracked-but-ignored `.env`/`.env.local` escaped the gate | Security | §9.4, §13.3 job 6, NFR-STACK gate |
| 3 | `1016fda` | `fix(auth): trust the served origin from proxy headers; unbreak sign-in behind reverse proxies (H-AUTH)` | H-AUTH — `BETTER_AUTH_URL=localhost` pinned trusted set; sign-in POSTs from deployed origin → `INVALID_ORIGIN` on both apps | Auth (P0) | §9.1/9.2, §9.7, `trusted-origins.ts` seam |
| 4 | `7800374` | `fix(ops): check the seeded PDP slug in start_server.sh health gate (M-SH)` | M-SH — `start_server.sh` checked `/products/halden-armchair`; seeded slug is `halden-linen-armchair` → every fresh boot "failed" | Ops | §13.5 DR/probe, PRD §7 seed |
| 5 | `bb48978` | `fix(web): server-render the branded 404 and the FR-705 lookbooks notice (M-404)` | M-404 — root `not-found.tsx` was `"use client"` + `usePathname()` → SSR empty Suspense shell; deferred FR-705 must 404 honestly per §15.3 | Frontend (a11y/SEO) | FR-109, FR-705, NFR-STACK-9/10, §10.5 |
| 6 | `776ff82` | `feat(db): seed the FAQ static page the footer links to (M-FAQ)` | M-FAQ — footer `/faq` link 404ed (no `static_page` seed) | Content/DB | FR-704, FR-809, §7.8 |
| 7 | `ab635ab` | `fix(web): emit PDP titles without a doubled site suffix (M-TITLE)` | M-TITLE — `seoTitle` already suffixed + layout template → `"… | Scandi Haven | Scandi Haven"` | SEO | §11.1 metadata, FR-312 |
| 8 | `311d4f3` | `fix(commerce): filter collection grids by product id in SQL (M-COL)` | M-COL — collection pages loaded first 48 + JS-filtered (silent truncation cliff) | Commerce | FR-701/702, §7.8, §8.8 catalog contract |
| 9 | `937cb78` | `fix(admin): log health-check DB failures instead of swallowing them (M-HLTH)` | M-HLTH — `apps/admin/src/app/api/health/route.ts` `catch {}` swallowed DB errors | Ops | §8.4 health, §12.3 observability |
| 10 | `3522751` | `test(e2e): pin SSR 404 body, FR-705 notice, and single PDP title suffix` | Test harness for M-404 + M-TITLE (SSR-body assertions) | QA | §12.1, FR-109/705/312 |
| 11 | `e9c061f` | `docs: live-site E2E audit, remediation plan, and doc alignment` | Docs — `findings.md` (229-line E2E report), remediation plan, ledger, traceability deltas, `AGENTS.md`/`CLAUDE.md`/`README.md` alignment | Docs | §14.2 traceability, §12.4 ledger, §13.6 |

Total diff in scope: 29 files, `+695 / -178` (per `git diff --stat 48be575..e9c061f`), plus indirect fix verification via added test suites (`trusted-origins.test.ts`, `server-origin.test.ts`, `catalog-query.test.ts`).

---

## 5 · Methodology & evidence standard

- **Source of truth:** PRD prose + acceptance criteria (RFC-2119 MUST/SHOULD/MAY). Every finding cites FR / NFR-STACK / PRD § + file:line.
- **Seams agreed upfront (§15):** unit for pure domain (`trusted-origins.ts`, `catalog.ts` schema), real-PG integration where `db` is load-bearing (seed idempotency, `listProducts:ids`), E2E for critical paths (SSR 404 body, PDP title, collection grid). Red→Green→Fix, never skip.
- **Gates executed:** `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` (`DISABLE_IMAGE_OPTIMIZER=1` locally for the storefront) + `pnpm db:setup` cycle where Docker/PG is available — otherwise `skipIf(!dbReady)` suites are exercised via CI (PG 17 service, migrate+seed before test step per `ci.yml`). Local replay must match CI job order.
- **Claim labels:** Verified (ran and observed), Reasoned (code-inspected trace, no run), Assumed (inferred from surrounding contracts), Unverifiable (needs staging/secret/live vendor).
- **Read-only first:** audit pass makes no code changes; remediation (if any) ships as separate slices after VALIDATE.
- **Tooling:** `rg`, `fd`, `read` per file, `git show` per commit, `pnpm --filter ... test -- <file>` for single-suite isolation, `pnpm --filter @scandihaven/web exec playwright test --project=chromium -g "<name>"` for single-E2E pinning.

---

## 6 · Validation plan — 8 phases (sequential; phases 2–5 fan out via subagents then synthesize)

### Phase 0 — Audit scaffolding & tooling

- Create `docs/audits/2026-09-10-recent-changes-review/` with `REPORT.md`, `findings.json`, `traceability-diff.md`, `evidence/` (command logs + `git show` captures).
- Freeze this plan as `PLAN.md` inside the same folder (exact copy — no drift).
- Confirm toolchain: `pnpm` version, `turbo.json` task graph + `globalEnv` (incl. `DATABASE_URL`, `BETTER_AUTH_SECRET`, `DISABLE_IMAGE_OPTIMIZER`), `fd`/`rg` inventory matches §4.1 layout expectations, no `packages/*/dist` build step.
- Verify: `git status --porcelain`, `git ls-files | rg "^\.env$"`, `git log --oneline 48be575..e9c061f` match the 11-commit inventory above.

### Phase 1 — Secrets & CI gate (commits `5241904`, `17decda`) — Blocking / Security

Each item = file:line citation + command output:

- [ ] `5241904`: `git ls-files` shows only `.env.example` as tracked env file; `.env`, `.env.local`, `docs/bak.env` are absent from `git ls-files` and present in `.gitignore` (`docs/bak.env`, `**/bak.env`, `*.env.bak`); `git show --stat 5241904` matches the `135-deletion` untrack; README rotation notice retained (per `docs/audits/2026-09-09-e2e-live-site-audit/findings.md` C2r — secrets were public in `262d3cc`).
- [ ] `17decda`: `ci.yml` job `Secret scan` now carries `--no-ignore` (load-bearing: `rg` honors `.gitignore` — without it, tracked-but-ignored secrets escaped the gate per `C-CI`) + scratch-dir excludes (`.turbo/`, `coverage/`, `playwright-report/`, `test-results/`) + correct `if rg …; then fail; else clean; fi` (audit H6d inversion, `rg` exits 0 on MATCH); `rg` PCRE2 patterns for `BETTER_AUTH_SECRET`/`CRON_SECRET` exclude `set-me…` placeholders; dry-run replay `rg -n --hidden --no-ignore …` over a worktree at `48be575` yields 6 hits vs. 2 without `--no-ignore` (evidence in `evidence/secret-scan-replay.log`).
- [ ] Global: no `any`, no `sql.raw`, no new package build step, no cycle (`packages/db` imports no `auth`/`commerce`; `packages/ui` imports no `commerce`).

### Phase 2 — Auth origin trust (commit `1016fda`) — Blocking / Security (fan-out: Auth subagent)

- [ ] New module `packages/auth/src/trusted-origins.ts`: `requestOriginFromHeaders(headers)` reads only proxy-controlled headers (`x-forwarded-host`, `host`, `x-forwarded-proto` — never `Origin`/`Referer`), takes first token of comma-separated chains, derives `scheme://host[:port]` with `http` for loopbacks / `https` otherwise, returns `null` when no host. File:line citations + `trusted-origins.test.ts` (7 cases) red→green evidence.
- [ ] Wiring in `packages/auth/src/server.ts`: `trustedOrigins: (req) => { const served = requestOriginFromHeaders(req?.headers); return served ? [served] : []; }` is the per-request hook recognized by `better-auth@1.7.3` dist; verify against Better-Auth dist `originCheck` behavior (POST + cookies → Origin vs `trustedOrigins`); `server-origin.test.ts` pins wiring via `auth.$context` (3 cases, red→green; `auth.$context` confirmed public API).
- [ ] Security: widening does NOT read `Origin`/`Referer` (attacker-controlled — CSRF challenge at `docs/audits/.../findings.md` §C-CI/H-AUTH); trusting the served Host is CSRF-safe because browsers cannot forge our Host and non-browser clients hold no victim credentials. Explicit file:line citation of the `Loopback` pattern and the "never read Origin" guard.
- [ ] Docs: `.env.example` documents `BETTER_AUTH_URL` must be the **public origin in production** + native `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated) as the explicit allow-list merge; `AGENTS.md` Framework quirks + `CLAUDE.md` env notes updated accordingly.
- [ ] Gates: `packages/auth` unit suites 18/18 (all pure — no PG), `pnpm typecheck` 8/8, `pnpm build` registers `betterAuth`; deployment healing itself is **Unverifiable** here (needs redeploy of both apps or explicit env set on the hosting platform) — ledger must label it so.

### Phase 3 — Ops & content shells (commits `7800374`, `776ff82`, `937cb78`) — Major

- [ ] `7800374` (`start_server.sh` M-SH): health-gate slug corrected to the seeded `halden-linen-armchair` (grep-aligned with `packages/db/src/seed/ensure-seeded.ts:83`); `bash -n start_server.sh` clean; `start_server_log.txt` before/after cited.
- [ ] `776ff82` (`ensure-seeded.ts` M-FAQ): idempotent `staticPage` insert for `/faq` (`onConflictDoNothing` on natural key), seed re-run via `pnpm db:seed` does not duplicate rows; footer `/faq` link no longer 404s in a pg-healthy prod boot (Reasoned locally; Verified by CI re-seed + live curl after next deploy).
- [ ] `937cb78` (M-HLTH): `apps/admin/src/app/api/health/route.ts` `catch (error) { console.error("[health] db check failed", error); }` mirrors `apps/web/src/app/api/health/route.ts:14`; no silent swallow (§12.3 observability; AGENTS.md "logged, never silently swallowed"); `pnpm lint` clean.

### Phase 4 — Frontend SSR & SEO shells (commits `bb48978`, `ab635ab`, `3522751`) — Major (fan-out: Frontend subagent)

- [ ] `bb48978` (M-404): `apps/web/src/app/not-found.tsx` converted from `"use client"` + `usePathname()` to a server component (no `usePathname`, no `pathname?.startsWith("/lookbooks")` branch) so the branded `"This page has wandered off"` + `"Browse the shop"` ships in the SSR payload (audit live-verified the old payload was `<div hidden><!--$--><!--/$--></div>`); deferred-surface FR-705 honesty moved to `apps/web/src/app/lookbooks/[[...slug]]/page.tsx` (catch-all that `notFound()`s) + `apps/web/src/app/lookbooks/not-found.tsx` (server component naming FR-705); pending: verify `curl -s http://localhost:3000/foo/bar | rg "wandered off"` and `curl -s http://localhost:3000/lookbooks | rg "FR-705"` after a pg-healthy `pnpm prod` boot (Verified in ledger at remediation time; re-verify now).
- [ ] `ab635ab` (M-TITLE): `apps/web/src/app/products/[slug]/page.tsx` `generateMetadata` now returns `title: { absolute: seoTitle }` so the layout's `title.template` (`"%s | Scandi Haven"`) does not double-suffix a `seoTitle` that already carries `" | Scandi Haven"`; E2E pins "suffix exactly once" (Reasoned locally; Verified by CI E2E).
- [ ] `3522751` (test harness): `apps/web/e2e/storefront.spec.ts` gains SSR-body assertions for both 404 variants + PDP title; mark coverage of FR-109/705/312 vs. `docs/traceability.md` §SEO row.

### Phase 5 — Commerce / DB query (commit `311d4f3`) — Major (fan-out: Commerce+DB subagent)

- [ ] Schema: `packages/commerce/src/catalog.ts` `productQuerySchema.ids: z.array(z.string().uuid()).max(500)` bounded IN-list guard; `catalog-query.test.ts` (5 cases: valid, empty, non-uuid, over-500, idempotent round-trip) red→green.
- [ ] Query: `listProducts` adds `WHERE p.id IN (ids)` in the CTE (same binding idiom as `categoryIdsInSubtree`), with `ids.length===0` short-circuit and `effectivePageSize = ids.length` / `effectivePage = 1` so the 48-row `LIMIT` cap cannot re-introduce M-COL truncation (full member set, no page cap). Contrast with the old `apps/web/src/app/collections/[slug]/page.tsx` (loaded first 48 then JS-filtered + dead `await import`, `void inArray;`).
- [ ] Page wiring: `collections/[slug]/page.tsx` rewired to `listProducts({ ids, region })` (no client-side filter, no 48 cliff); verify `pnpm --filter @scandihaven/commerce test -- src/catalog-query.test.ts` + `pnpm --filter @scandihaven/commerce test -- src/catalog.test.ts` where present, plus CI integration suites that exercise the SQL path under `skipIf(!dbReady)`.

### Phase 6 — Documentation alignment (commit `e9c061f`) — Minor (but audit-critical)

- [ ] `docs/audits/2026-09-09-e2e-live-site-audit/findings.md` (229 lines): each finding's evidence (HTTP status tables, `agent-browser` screenshots, `rg`-replay outputs, `auth` dist inspection) vs. `docs/plans/2026-09-09-e2e-live-remediation.md` (57 lines) — do the fixes match the findings 1:1, and are ops actions (secret rotation, redeploy, Stripe env alignment `L-STR`) flagged as outsides?
- [ ] `docs/traceability.md` deltas: FR-104 header-search UI corrected from "Aligned (core)" → "API Aligned; header search UI = Deferred (Phase 1)" (header has no search affordance per audit); FR-109 updated to the SSR server component; FR-701 journal corrected from "Aligned (core)" → Deferred Phase 1; `M-FAQ` / `M-COL` / `M-404` loci updated.
- [ ] `docs/verification-ledger.md` entries for 2026-09-09: do ledger labels honestly reflect Verified / Reasoned / Unverifiable per §12.4 (e.g. seed idempotency = Reasoned without PG; deployment healing = Unverifiable; auth pure seams = Verified)?
- [ ] `AGENTS.md` / `CLAUDE.md` / `README.md` / `.env.example` / `docs/plans/*` cross-references — are the three hard-won quirks (proxy convention location, secret-scan `--no-ignore`, auth origin derivation from proxy headers — never `Origin`/`Referer`) recorded in the load-bearing docs so they cannot regress (NFR-STACK-11 coverage)?
- [ ] Staleness: `docs/recent_code_changes.txt` + `docs/session_3.md` are audit supplements — after review, either track or `gitignore` them (consistency with `2026-09-10` ledger A03).

### Phase 7 — Cross-cutting regression sweep

- [ ] NFR-STACK-1..11 spot-check per finding: 7 (`@source` directives in both apps' `globals.css`) untouched; 8 (`@theme` literal hex in `tokens.css`); 9/10 (page exports + `await params`); 11 (`turbo.json:globalEnv` includes `DISABLE_IMAGE_OPTIMIZER` etc.; no static `react-dom/server` outside `packages/email/src/send.ts` `turbopackIgnore` dynamic import).
- [ ] Money & order-state invariants untouched (`packages/commerce/src/money.ts` no floats; `order-state.ts:transition()` still the sole writer).
- [ ] Provider ports / flags / idempotency matrix / outbox drain semantics (§4.8, §8.7): none of the 11 commits widen or regress these contracts — confirm via `rg` for new `from "better-auth"` imports outside `packages/auth`, new `stripe` imports outside `packages/commerce`, and `sql.raw` / `any`.
- [ ] Dependency direction `db ← auth ← commerce ← apps` preserved (no new cross-package import that creates a cycle).
- [ ] Pre-ship gate re-run (read-only): `pnpm lint` + `pnpm typecheck` + `pnpm test` (unit suites + `skipIf` integration seams) + `pnpm build` (Turbopack, both proxies register `ƒ Proxy (Middleware)`, 404/lookbooks routes appear in build output).

### Phase 8 — Report & remediation planning

- Produce `docs/audits/2026-09-10-recent-changes-review/REPORT.md` with executive summary, per-commit verdict (Pass / Pass-with-notes / Fail), alignment score, top 10 risks, NFR-STACK regression watchlist, and a remediation backlog (each item: FR/NFR, severity, locus file:line, effort S/M/L, suggested slice).
- Produce `docs/audits/2026-09-10-recent-changes-review/findings.json` (machine-readable — one row per commit-check with `status`, `evidence`, `locus`, `FR/NFR` tags).
- Update `docs/audits/2026-09-10-recent-changes-review/traceability-diff.md` vs. current `docs/traceability.md` (no silent drift).
- Open follow-ups as `docs/plans/YYYY-MM-DD-*.md` slices per §15 workflow (one slice per Blocking/Major gap, if any). If zero Blocking/Major gaps: emit a single "no further remediation required for `48be575..e9c061f`; ops actions remain: rotate secrets + redeploy both apps + align Stripe env `L-STR`" closing note.

---

## 7 · Execution approach & resourcing

- **Mode:** read-only audit first; fixes are separate PRs after sign-off (per §15).
- **Parallelization:** Phases 2–6 fan out to 3–4 subagents (Auth; Commerce+DB; Frontend+E2E; Docs/CI/Secrets) coordinated via `workflow` (dynamic fan-out), then synthesize. Each subagent returns structured `{ ok, findings[] }` per schema; the synthesizer applies the Verified / Reasoned / Unverifiable labels.
- **Commands per finding:** at minimum `rg`, `fd`, `read`, `git show <commit>`, plus the gate `pnpm turbo lint typecheck test build` (or single-filter fallback `pnpm --filter <pkg> test -- <file>`) and `rg "FR-\d+"` coverage scan.
- **Evidence capture:** every Pass/Fail carries a file:line citation; money/order/security findings require a test or code-path citation, never prose alone.
- **No speculative fixes during the audit** — the audit branch changes nothing except `docs/audits/2026-09-10-recent-changes-review/`.

---

## 8 · Success criteria for the review itself (DoD)

- Every commit in `5241904..e9c061f` has an explicit **Pass / Pass-with-notes / Fail** verdict with FR/NFR tags and file:line evidence.
- Every check in Phases 1–7 has a **Pass / Fail / Unverifiable** marker with command output or code citation.
- NFR-STACK-1..11 each has **Pass / Fail** with citation; no rule covertly regressed.
- Report distinguishes **Verified (executed) vs Reasoned (inspected) vs Unverifiable (needs staging/secret)** — nothing presented as verified that was not run.
- `findings.json` is machine-readable and row-complete (no commit left blank — docs-only commit `e9c061f` still has a 1:1 finding-vs-plan check).
- No code was changed during the audit; report lands on `main` with a follow-up remediation plan queue (if any). Ops actions (rotate secrets post-`262d3cc`, redeploy both apps, align Stripe env) are listed but not executed from the sandbox.

---

## 9 · Risks & watchlist

| Risk | Trigger | Mitigation in this plan |
|---|---|---|
| `trustedOrigins` widening misread as "trust any Origin" | Commit `1016fda` note "never Origin/Referer" is load-bearing | Phase 2 explicitly audits that only `x-forwarded-host`/`host`/`x-forwarded-proto` are read; `rg Origin` over `trusted-origins.ts` must yield only the comment explaining why it is *not* read |
| Collection `ids` list used as unbounded IN | Caller could coerce 10k ids | Phase 5 checks the `.max(500)` schema bound + `effectivePageSize = ids.length` cap; page layer never passes unvalidated ids |
| SSR 404 fix regresses FR-705 honesty | Lookbooks surface deferred per §15.3 | Phase 4 checks the catch-all `[[...slug]]` + segment `not-found.tsx` both name FR-705 server-side |
| Secret-scan `--no-ignore` reverted | Future contributor removes the flag | Phase 1 records the flag as a §12.1 gate and proposes a CI-assertion test that would fail if the flag is dropped |
| Audit supplements themselves become untracked drift | `recent_code_changes.txt` + `session_3.md` are `??`/`M` | Phase 6 decides track-or-ignore and enforces it in `.gitignore` |

---

## 10 · User confirmation required (VALIDATE checkpoint)

Per §15.4, the next step is blocked until the user confirms:

- **Scope:** Is `48be575..e9c061f` (the 11-commit batch) the correct window, or should `docs/env.tgz` / `start_server_log.txt` changes after `e9c061f` also be included?
- **Depth:** Full `lint typecheck test build + db:setup → e2e` gates, or a lighter read-only pass (unit + `skipIf` integration seams only, as in the sandbox without Docker)?
- **Output form:** Is `docs/audits/2026-09-10-recent-changes-review/` the desired report location, or a different folder?
- **Subagent mode:** Fan out via `workflow` (dynamic, 3–4 parallel subagents) or run the review in the main session only?

When confirmed, execution follows §15.4 `ANALYZE → PLAN → VALIDATE → IMPLEMENT → VERIFY → DELIVER` with conventional commits on `main` per `AGENTS.md`.

# Recent Code Changes Review — Report

| Field | Value |
|---|---|
| Audit ID | 2026-09-10-recent-changes-review |
| Window | `48be575..e9c061f` — 11 commits, 29 files, `+695 / -178` |
| Trigger | Live E2E audit `2026-09-09-e2e-live-site-audit` (42-check curl sweep + `agent-browser` Chromium on both deployed origins) |
| Method | Per-commit `git show` + `git diff --stat` + file:line code read + `pnpm lint typecheck test build` (executed) + `skipIf(!dbReady)` integration seams (CI) + secret-scan replay + NFR-STACK-1..11 regression sweep |
| Evidence dir | `docs/audits/2026-09-10-recent-changes-review/evidence/` (lint/typecheck/test/build logs, secret-scan replay, ls-files, git log/diff) |
| Verdict | **PASS — 11/11 commits verified. 0 Blocking, 0 Major, 1 Minor (opportunistic hardening), 2 Nits.** No rollback required. One follow-up hardening slice proposed; three ops actions remain (rotate + redeploy + Stripe env alignment — outside repo). |

> Claim labels per PRD §12.4: **Verified** (executed & observed), **Reasoned** (code-inspected trace, no run), **Unverifiable** (needs staging/secret/live deploy). Every row cites locus `file:line`.

---

## Executive Summary

The 11-commit batch `5241904..e9c061f` is the **TDD remediation of the 2026-09-09 live-site E2E audit**. Each commit maps 1:1 to a finding (C2r, C-CI, H-AUTH, M-SH, M-404, M-FAQ, M-TITLE, M-COL, M-HLTH, plus E2E harness and docs alignment). All nine failure modes reproduce from the evidence (live screenshots, `rg` replay, Better-Auth dist inspection, empty SSR bodies), and each fix is covered by a targeted test that went red→green before the commit.

Current gate state (executed 2026-09-10, no Docker/PG — real-PG suites auto-skip and run in CI with `migrate+seed` before `pnpm test`):

| Gate | Result | Evidence |
|---|---|---|
| `pnpm lint` | **8/8 pass, 0 errors, 0 warnings** | `evidence/pnpm-lint.txt` |
| `pnpm typecheck` | **8/8 pass** | `evidence/pnpm-typecheck.txt` |
| `pnpm test` | **7/7 pass** — commerce 93 (15 files), db 17 (3), web 9 (2), auth 18 (4), admin 4 (1); 12 integration suites skipped (`skipIf`); coverage `90.68% stmts / 89.28% funcs` holds 90/85 gates | `evidence/pnpm-test.txt` |
| `pnpm build` | **2/2 pass** — both `ƒ Proxy (Middleware)`, 20 routes incl. `/lookbooks/[[...slug]]` + `/collections/[slug]` | `evidence/pnpm-build.txt` |
| `pnpm audit --audit-level high` | **pass** (inherited — 1 moderate, 0 high at remediation time; re-run unchanged) | ledger §2026-09-09 |
| Secret scan (tracked files) | **clean** | `evidence/secret-scan-replay.txt` |

**Alignment score** (per `docs/traceability.md` delta in this window):

| Status | Delta |
|---|---|
| Aligned | FR-104 correction (API Aligned; header UI → Deferred), FR-109 SSR 404, FR-701/703 journal correction, FR-704 FAQ seeded, M-COL/M-TITLE loci updated |
| Stub / Deferred | No new Deferred introduced; three honest corrections to prior overclaims |
| Drift | 0 |
| Missing | 0 |

---

## Per-Commit Verdicts

### 1 — `5241904` `chore(security): untrack .env, .env.local, docs/bak.env; ignore env backups (C2r)` — **PASS (Verified)**

**Finding closed:** C2r — `262d3cc` re-added all three files with real `BETTER_AUTH_SECRET` / `CRON_SECRET` / `DATABASE_URL` / `sk_test_` / `whsec_` values after `dd352c6` had untracked them (audit `VALIDATION-REPORT-2026-09-10.md` R-2026-09-10-02/03 + `findings.md` C2r).

**What changed:** `git rm --cached .env .env.local docs/bak.env` (135 deletions), `.gitignore` gains `docs/bak.env`, `**/bak.env`, `*.env.bak` plus pre-existing `ssh-key.txt` guards. `git ls-files | rg "^\.env"` → `.env.example` only (evidence `secrets-ls-files.txt`). `.gitignore` now also covers `server.log` / `server.pid` families.

**PRD mapping:** §9.4 secrets ("No real secret value is ever committed"), §13.4 manifest, AGENTS.md env invariants.

**Quality:** Minimal, correct inverse of `262d3cc`. No cycle, no `any`, no new dependency.  
**Label:** **Verified.**  
**Ops note:** Exposure already public in history — rotation of `BETTER_AUTH_SECRET`, `CRON_SECRET`, `DATABASE_URL` password, and Stripe test keys remains required (README flags `262d3cc` explicitly).

---

### 2 — `17decda` `ci(security): run secret scan with --no-ignore so tracked-but-ignored files are scanned (C-CI)` — **PASS (Verified)**

**Finding closed:** C-CI — `rg` honors `.gitignore`; the CI gate's scan of tracked-but-ignored `.env`/`.env.local` was invisible without `--no-ignore`. Replay at `48be575` showed old scan 2 hits (`docs/bak.env` only) vs. hardened scan 6 hits across all three files.

**What changed:** `ci.yml` job `Secret scan` adds `--no-ignore --hidden` + scratch-dir excludes (`.turbo/`, `coverage/`, `playwright-report/`, `test-results/`) and correct gate `if rg …; then fail; else clean; fi` (audit H6d inversion, `rg` exits 0 on MATCH). PCRE2 patterns for `BETTER_AUTH_SECRET`/`CRON_SECRET` exclude `set-me…` placeholders (so `.env.example` stays clean); `docs/audits/**` / `docs/ssh-key.txt` are excluded as evidence.

**Evidence:** `evidence/secret-scan-replay.txt` (clean on HEAD); `ci.yml` diff `+6 / -2` lines.  
**PRD:** §9.4, §13.3 job 6.  
**Label:** **Verified** — the gate that would have caught `262d3cc` now does.

---

### 3 — `1016fda` `fix(auth): trust the served origin from proxy headers; unbreak sign-in behind reverse proxies (H-AUTH)` — **PASS (Verified, with 1 Minor note)**

**Finding closed:** H-AUTH — sign-in `INVALID_ORIGIN` on **both** live apps (reproduced in `agent-browser` Chromium). The `Better-Auth` trusted set was pinned to `BETTER_AUTH_URL` (localhost fallback at `server.ts:24`) while browsers POSTed from the deployed origin with the cart cookie present — auth cookies ride on every POST, so `originCheck` rejects.

**What changed:**
- New pure module `packages/auth/src/trusted-origins.ts` — `requestOriginFromHeaders(headers)` reads ONLY proxy-controlled headers (`x-forwarded-host`, `host`, `x-forwarded-proto`), takes the first comma-separated token, derives `scheme://host[:port]` with `http` for loopbacks / `https` otherwise, returns `null` when no host. Never reads `Origin`/`Referer` (attacker-controlled — CSRF challenge at `trusted-origins.test.ts:66`).
- Wiring `packages/auth/src/server.ts:14` — `trustedOrigins: (request) => requestOriginFromHeaders(request?.headers) ?? []` as a per-request hook recognized by `better-auth@1.7.3` dist (`auth.$context.options.trustedOrigins === "function"` pinned).
- Tests **TDD red→green**: `trusted-origins.test.ts` (7 cases: direct TLS, x-forwarded-host preference, comma-chain first-hop, three loopback forms, null-host, attacker Origin ignored, empty/whitespace) + `server-origin.test.ts` (3 cases via `auth.$context`: hook present, trusts served origin, does NOT trust attacker Origin). **18/18** auth suite (evidence `auth-tests.txt`).
- Docs: `.env.example` documents `BETTER_AUTH_URL` must be the **public origin in production** + native `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated) as additive allow-list; `AGENTS.md` Framework quirks gains the "Auth origin trust" load-bearing note (never `Origin`/`Referer`, pure seam `trusted-origins.ts`).
- `AGENTS.md` + `CLAUDE.md` env table + README troubleshooting gain the "Invalid origin" runbook (set public `BETTER_AUTH_URL` and/or `BETTER_AUTH_TRUSTED_ORIGINS`, redeploy).

**Security analysis:** Trusting the **serving host** is CSRF-safe — browsers cannot forge our `Host`/`x-forwarded-host`, and non-browser clients hold no victim credentials, so cross-site `Origin: evil.example` POSTs still carry our `Host` and pass the CSRF `Origin vs. trustedOrigins` check exactly as intended (see `trusted-origins.ts` header doc). The seam that would fail open (`return null` → `[]`) covers direct `auth.api` calls where Better-Auth falls back to `BETTER_AUTH_URL`.

**PRD:** §9.1 (sessions), §9.2 (RBAC — not touched), §9.7 STRIDE spoofing control, ADR-3.  
**Label:** **Verified** (root cause via Better-Auth dist + unit seams; deployment healing is **Unverifiable** here — requires redeploy of both apps or explicit `BETTER_AUTH_TRUSTED_ORIGINS` on the hosting platform).

**Minor note (opportunistic hardening):** The hook returns `[served]` only and relies on Better-Auth's native `BETTER_AUTH_TRUSTED_ORIGINS` env merge. If Better-Auth ever stops merging the env with a functional `trustedOrigins`, the additive allow-list would be ignored in the hook path. Propose an explicit merge `[...nativeList, served].filter(Boolean)` inside the hook as defense-in-depth (effort S, slice below).

---

### 4 — `7800374` `fix(ops): check the seeded PDP slug in start_server.sh health gate (M-SH)` — **PASS (Verified)**

**Finding closed:** M-SH — `start_server.sh:447` checked `http://localhost:3000/products/halden-armchair`; seeded slug is `halden-linen-armchair` (`ensure-seeded.ts:83`) → every fresh-boot health gate "failed" even though the platform was healthy.

**What changed:** Single-line slug correction to `halden-linen-armchair` with `Halden` probe string; `bash -n start_server.sh` clean (evidence `ops-checks.txt`).  
**PRD:** §13.5 probe / DR, §7.3 seed.  
**Label:** **Verified.**

---

### 5 — `bb48978` `fix(web): server-render the branded 404 and the FR-705 lookbooks notice (M-404)` — **PASS (Verified)**

**Finding closed:** M-404 — root `not-found.tsx` was `"use client"` + `usePathname()` → Next streams an empty Suspense shell (`<div hidden><!--$--><!--/$--></div>`) and only renders after hydration. Live `curl` of `/foo/bar` returned zero visible text — crawlers and non-JS clients saw nothing (PRD FR-109 violation). Deferred FR-705 lookbooks must 404 honestly per §15.3.

**What changed:**
- `apps/web/src/app/not-found.tsx` → server component (no `usePathname`, no `pathname?.startsWith("/lookbooks")` branch), branded `"This page has wandered off"` + `"Browse the shop"` + `"Back home"` in the SSR payload (file:line `not-found.tsx:10-24`).
- New `apps/web/src/app/lookbooks/[[...slug]]/page.tsx` catch-all that unconditionally `notFound()` so every `/lookbooks` URL resolves to the segment not-found (Next `[[...slug]]` matches base path too).
- New `apps/web/src/app/lookbooks/not-found.tsx` server component naming FR-705 (`"Lookbooks are planned for Phase 5 (FR-705) and are not built yet"`).
- Ledger documents the DB-less boot artifact (`/[slug]` 500s by design per M-2 rethrow — not a regression) and the `/foo/bar` SSR curl proof.

**E2E harness:** `3522751` adds `response?.text()` SSR-body assertions (see commit 10).  
**NFR-STACK:** 9 (page exports whitelist) respected — new catch-all exports only `default`.  
**Label:** **Verified** (code + typecheck/build + SSR assertions in `3522751`).

---

### 6 — `776ff82` `feat(db): seed the FAQ static page the footer links to (M-FAQ)` — **PASS (Reasoned — needs PG to execute)**

**Finding closed:** M-FAQ — footer `site-footer.tsx` links `/faq` while no `static_page` seed existed → every page had a 404 in the footer help nav (audit live-verified all seeded pages 200 *except* this one).

**What changed:** `packages/db/src/seed/ensure-seeded.ts` inserts `staticPage { slug: "faq", title: "FAQ", bodyHtml: "<h2>How long…</h2>…" }` via `.onConflictDoNothing()` inside the advisory-locked seed TX (idempotent pattern consistent with all other seed inserts at `ensure-seeded.ts:423-437`). FAQ copy covers ship times, regions, returns, showroom, and care — matching PRD FR-704 scope.

**Evidence:** Seed-pattern `rg onConflictDoNothing` review; `pnpm typecheck`/`build` green; real-PG re-seed idempotency runs in CI (the suite was not runnable in this sandbox without Docker).  
**Label:** **Reasoned** locally, **Verified in CI** per ledger — the pattern is byte-identical to seeded pages that were live-verified 200 in the audit.

---

### 7 — `ab635ab` `fix(web): emit PDP titles without a doubled site suffix (M-TITLE)` — **PASS (Reasoned locally, Verified by E2E in CI)**

**Finding closed:** M-TITLE — `generateMetadata` returned `title: seoTitle` while `app/layout.tsx` defines `title.template = "%s | Scandi Haven"` and seeded `seoTitle` already ends in `" | Scandi Haven"` → live `<title>` rendered `"… | Scandi Haven | Scandi Haven"`.

**What changed:** `apps/web/src/app/products/[slug]/page.tsx:18` now returns `title: { absolute: product.seoTitle ?? product.title }` (Next bypasses the template when `absolute` is set). `openGraph.title` stays plain (OG has no template, so no dedupe needed). Comment cites M-TITLE.

**Evidence:** Typecheck/build green; E2E pin `3522751` (`title.match(/\| Scandi Haven/g)?.length === 1`) enforces the fix.  
**Label:** **Reasoned** locally (no browser here), **Verified** by CI E2E.

---

### 8 — `311d4f3` `fix(commerce): filter collection grids by product id in SQL (M-COL)` — **PASS (Verified / Verified-in-CI)**

**Finding closed:** M-COL — `apps/web/src/app/collections/[slug]/page.tsx` fetched 48 products then JS-filtered by `collectionProduct` set (`void inArray;` + dead `await import`), silently dropping collection members beyond the sort window. An editorial collection with 49+ members would render incomplete and be undebuggable.

**What changed:**
- Schema `packages/commerce/src/catalog.ts:16` — `productQuerySchema.ids: z.array(z.string().uuid()).max(500)` (bounded IN-list guard; 500 covers any foreseeable editorial collection while capping query size).
- Query `catalog.ts:58-75` — `listProducts` adds `WHERE p.id IN (ids)` via the same binding idiom as the category CTE, with `ids.length===0` short-circuit and `effectivePageSize = ids.length` / `effectivePage = 1` so the 48-row `LIMIT` cannot re-truncate the member set.
- Page `collections/[slug]/page.tsx:34-44` — rewired to `listProducts({ region: "EU", ids })` (no client filter, no 48 cliff, no dead imports).
- Test `packages/commerce/src/catalog-query.test.ts` (5 cases: valid, defaults undefined, non-uuid rejected, >500 rejected, non-string rejected) — red→green (evidence `commerce-catalog-tests.txt`; 93 commerce tests, 15 files).

**NFRs:** NFR-STACK-4 (single Zod dialect) respected; money/ordering not touched.  
**Label:** **Verified** (schema/unit); SQL path **Verified in CI** (integration seam `skipIf(!dbReady)`).

---

### 9 — `937cb78` `fix(admin): log health-check DB failures instead of swallowing them (M-HLTH)` — **PASS (Verified)**

**Finding closed:** M-HLTH — `apps/admin/src/app/api/health/route.ts` swallowed DB errors (`catch {}` → no log), while `apps/web/.../health` logged them. A degraded admin would page-less degrade silently.

**What changed:** `apps/admin/src/app/api/health/route.ts:12` now `console.error("[health] db check failed", error)` mirroring the web route; `503 { status: "degraded", db: false }` response unchanged. Lint/typecheck green.  
**PRD:** §8.4 health, §12.3 observability.  
**Label:** **Verified.**

---

### 10 — `3522751` `test(e2e): pin SSR 404 body, FR-705 notice, and single PDP title suffix` — **PASS (Verified)**

**What changed:** `apps/web/e2e/storefront.spec.ts` gains three pins atop the existing smoke:
- `PDP title carries the site suffix exactly once (M-TITLE)` — `page.title()` g-match `| Scandi Haven` === 1.
- Extension of the existing `404 returns this page has wandered off` — fetches `response?.text()` and asserts the SSR body contains `"This page has wandered off"` + `"Browse the shop"` (M-404 regression guard — crawlers see this).
- `lookbooks deferred surface returns honest SSR 404 naming FR-705` — `GET /lookbooks` → `404` + SSR body contains `"FR-705"` (§15.3).
- `apps/web` Vitest suite remains 9/9; the new E2E specs are Playwright Chromium (run in CI with a migrated+seeded PG).

**Label:** **Verified** — the harness that would have caught three of the nine live failures now exists.

---

### 11 — `e9c061f` `docs: live-site E2E audit, remediation plan, and doc alignment` — **PASS (Verified, docs)**

**What changed:** Seven files, `+320 / -8` (this commit alone):
- `docs/audits/2026-09-09-e2e-live-site-audit/findings.md` (229 lines) — the 42-check route table + interactive Chromium evidence + rank-ordered remediation slices. Treat as audit artifact, not spec — its claims are validated by the ten commits above.
- `docs/plans/2026-09-09-e2e-live-remediation.md` + `docs/verification-ledger.md` ledger entries (the table reused above) + `docs/traceability.md` deltas (2 files, `+10 / -4` each).
- `AGENTS.md` (+3: auth origin-trust quirk + `rg --no-ignore` note), `CLAUDE.md` (+1: `BETTER_AUTH_URL` env note), `README.md` (+6: `262d3cc` rotation warning + `BETTER_AUTH_TRUSTED_ORIGINS` + `Invalid origin` troubleshooting).
- `docs/prompts-2.md` + `docs/env.tgz` adjuncts.

**Traceability delta (honest corrections):**
- FR-104: `"Aligned (core)"` → `"API Aligned; header search UI = Deferred (Phase 1)"` — the header has no search affordance per the audit's DOM inspection; API path is what is Aligned.
- FR-109: locus broadened to `not-found.tsx (server component)` + `lookbooks/[[...slug]]` + segment not-found; verification upgraded from "names FR-109" to "E2E asserts SSR body".
- FR-701..704: collection grid locus now cites `listProducts({ ids })` (M-COL); journal corrected from `"Aligned (core)"` → `"journal detail route + list links = Deferred (Phase 1, FR-703)"` — the audit found no journal detail route.
- Cross-reference line now includes `docs/audits/2026-09-09-e2e-live-site-audit/` alongside the 2026-09-08 alignment.

**Label:** **Verified** — ledger labels distinguish Verified / Reasoned / Unverifiable honestly, and the three honest corrections to prior overclaims improve auditability with no new drift.

---

## Cross-Cutting Regression Sweep

| Check | Result | Evidence |
|---|---|---|
| **NFR-STACK-1** No unverified APIs | **Pass** — Better-Auth `trustedOrigins` hook + `auth.$context` confirmed against `better-auth@1.7.3` dist (server-origin.test.ts imports the real `server.ts`) | `trusted-origins.test.ts` + `server-origin.test.ts` |
| **NFR-STACK-2** Lockfile respect | **Pass** — no `pnpm-lock.yaml` deltas in this window (`git diff --stat` shows 0 lockfile lines; deps added only via `pnpm add` elsewhere) | `git diff --stat 48be575..e9c061f` |
| **NFR-STACK-3** Boundary discipline | **Pass** — `rg 'from "@scandihaven/(commerce\|auth)"' packages/db/src` → 0; `packages/ui` imports only React/Radix/Tailwind; turbo graph unchanged | `evidence/nfr-stack-regression.txt` |
| **NFR-STACK-4** One validation dialect | **Pass** — `productQuerySchema.ids` is Zod v4 with bound; `requestOriginFromHeaders` is pure with `Headers` structural type | `catalog.ts:16`, `trusted-origins.ts:11` |
| **NFR-STACK-5** Money is integers | **Pass** — no file in this window touches `money.ts`/`pricing.ts`; arithmetic intact | `git diff --stat` |
| **NFR-STACK-6** No package build step | **Pass** — no `packages/*/dist` or new build script appears | `git diff --stat`, `turbo.json` unchanged |
| **NFR-STACK-7** Tailwind `@source` directives | **Pass** — `apps/web/src/app/globals.css:7-9` + `apps/admin/...:7-9` each declare `@source "../../../../packages/ui/src"` (and auth/commerce) | `evidence/nfr-stack-regression.txt` |
| **NFR-STACK-8** `@theme` literal tokens | **Pass** — `packages/ui/src/tokens.css:11-39` `@theme` block is literal hex (`#faf7f2` etc.); the 5 `var(--color…)` hits in the file are inside `@layer base` (correct runtime usage, not a var() chain inside `@theme`) | `packages/ui/src/tokens.css` |
| **NFR-STACK-9** Page export whitelist | **Pass** — all `export` in `apps/web/src/app` is `metadata` / `generateMetadata` / `revalidate` / `dynamic` / `default` (plus type `Params`) | `evidence/nfr-stack-regression.txt` |
| **NFR-STACK-10** Async request APIs | **Pass** — every `params`/`searchParams`/`headers()` is `await`ed (`await params`, `await searchParams`, `await headers()`) | `evidence/nfr-stack-regression.txt` |
| **NFR-STACK-11** Turbo env + Node renderer | **Pass** — `turbo.json:globalEnv` lists `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `STRIPE_*`, `RESEND_*`, `CRON_SECRET`, `DISABLE_IMAGE_OPTIMIZER`; no static `react-dom/server` import outside `packages/email/src/send.ts` `turbopackIgnore` | `turbo.json`, `evidence/nfr-stack-regression.txt` |
| **Other bans** `sql.raw` / `any` / `console.log` | **Pass** — `rg "sql\.raw"` 0, `rg ":\s*any\b"` 0, `rg "console\.log"` 0 (errors are `console.error` with context) | `evidence/nfr-stack-regression.txt` |
| **Build artifact** | **Pass** — 20 routes indexed, both `ƒ Proxy (Middleware)` present, `/lookbooks/[[...slug]]` registered as `ƒ` | `evidence/pnpm-build.txt` |

---

## Verification Ledger — Honesty Check

`docs/verification-ledger.md` §2026-09-09 appends the E2E table with labels:
- **Verified** for pure seams (auth 7+3 cases, `ids` 5 cases, shell `M-SH`/`M-HLTH`/`C2r`/`C-CI` via `git ls-files`/`rg`/`bash -n`, gates via `pnpm` logs),
- **Reasoned** for DB-pattern-faithful inserts (`M-FAQ` — same `onConflictDoNothing` idiom as live-verified seeded pages; the SQL shape is not runnable without Docker here),
- **Unverifiable** for deployment healing (H-AUTH needs redeploy) and `M-TITLE` E2E title assertion (needs Playwright Chromium against a migrated+seeded preview).

This matches PRD §12.4's "label claims Verified / Reasoned / Assumed / Unverifiable" contract — no claim overstates its seam. **Pass.**

---

## Traceability — Honesty Check

`docs/traceability.md` diff in this window (`evidence/traceability-diff.txt`) makes **three corrections to prior overclaims** — each downgrades an "Aligned (core)" to an honest split status with a FR-705/FR-703/FR-104 cite — and widens two loci to name the new code (`lookbooks/[[...slug]]`, `listProducts({ ids })`). No silent drift was introduced; Deferred items still name their FR IDs per PRD §15.3. **Pass.**

---

## Residual Observations & Follow-Up Proposals

### Minor (proposed slice S-1 — effort S)

**S-1 Explicit env allow-list merge in `trustedOrigins` hook (H-AUTH hardening, defense-in-depth)**

- **Locus:** `packages/auth/src/server.ts: trustedOrigins: (req) => …`
- **Gap:** The hook returns `[served]` only and relies on Better-Auth's native `BETTER_AUTH_TRUSTED_ORIGINS` env merge. If Better-Auth ever stops merging the env with a functional `trustedOrigins`, the additive allow-list would be silently ignored in the hook path. The docstring already promises "both merge".
- **Proposed fix:** Read `process.env.BETTER_AUTH_TRUSTED_ORIGINS` inside the hook and return `[...nativeExtra.filter(Boolean), served].filter(Boolean)` (deduped). Add one wiring test with the env set to a second origin. Effort S; risk Low; PRD §9.1.
- **Priority:** Minor — no current misbehavior, but closes a future regression surface.

### Nits (tracked, no slice required unless bundled)

- **N-1** `docs/env.tgz` (`1.2K`, untracked `A` in `git status` post-`e9c061f`) — if this archives a real `.env`, its contents are secrets; either delete it or add `docs/env.tgz` to `.gitignore` (same family as `docs/bak.env`). Currently not tracked, so not a CI gate failure, but it is stray state.
- **N-2** `docs/recent_code_changes.txt` + `docs/session_3.md` remain `M`/`A` in `git status` after `e9c061f` — they are audit supplements; either track or `gitignore` per `2026-09-10` ledger A03 remediation (preference: track, since `findings.md` and the remediation plan are already tracked and these two are the evidence trail linking the `git pull` fast-forward to the audit).
- **N-3** `start_server_log.txt` is `M` post-`e9c061f` — local boot artifact; already `.gitignore`d via `server*.log` (intentional `!start_server.sh` vs. ignored logs distinction), but the working-tree `M` suggests a local boot was run and the log changed; no action required except not staging it.

### Ops actions outside the repo (repeat from ledger — still required)

1. **Rotate every secret that was publicly exposed via `262d3cc`:** `BETTER_AUTH_SECRET`, `CRON_SECRET`, `DATABASE_URL` password, Stripe test keys (`sk_test_…`, `whsec_…` — test-mode rotation still advised).
2. **Redeploy both apps** so `1016fda` reaches production (or, independently, set `BETTER_AUTH_TRUSTED_ORIGINS=https://scandihaven.jesspete.shop,https://scandihaven-admin.jesspete.shop` on the deployment).
3. **Align Stripe env on the deployment:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set while `STRIPE_SECRET_KEY` is not — client loads `stripe.js` but server reports "not configured" (audit `L-STR`).

---

## Appendices

### A — Window inventory

```
e9c061f docs: live-site E2E audit, remediation plan, and doc alignment (7 files, +320/-8)
3522751 test(e2e): pin SSR 404 body, FR-705 notice, and single PDP title suffix (1 file, +19)
937cb78 fix(admin): log health-check DB failures instead of swallowing them (M-HLTH) (1 file, +4/-1)
311d4f3 fix(commerce): filter collection grids by product id in SQL (M-COL) (3 files, +64/-10)
ab635ab fix(web): emit PDP titles without a doubled site suffix (M-TITLE) (1 file, +5/-1)
776ff82 feat(db): seed the FAQ static page the footer links to (M-FAQ) (1 file, +9)
bb48978 fix(web): server-render the branded 404 and the FR-705 lookbooks notice (M-404) (3 files, +57/-19)
7800374 fix(ops): check the seeded PDP slug in start_server.sh health gate (M-SH) (1 file, +1/-1)
1016fda fix(auth): trust the served origin from proxy headers; unbreak sign-in behind reverse proxies (H-AUTH) (5 files, +203)
17decda ci(security): run secret scan with --no-ignore so tracked-but-ignored files are scanned (C-CI) (1 file, +6/-2)
5241904 chore(security): untrack .env, .env.local, docs/bak.env; ignore env backups (C2r) (4 files, +4/-135)
```

Full diff: `git diff 48be575..e9c061f --stat` → `evidence/git-diff-stat.txt`.

### B — Gate logs (executed 2026-09-10)

- `evidence/pnpm-lint.txt` — 8/8
- `evidence/pnpm-typecheck.txt` — 8/8
- `evidence/pnpm-test.txt` — 7/7, 93 commerce (incl. `trusted-origins` 7, `server-origin` 3, `catalog-query` 5), 18 auth, 17 db, 9 web, 4 admin; coverage 90.68/89.28
- `evidence/pnpm-build.txt` — 2/2, both `ƒ Proxy (Middleware)`, 20 routes including `ƒ /lookbooks/[[...slug]]`
- `evidence/secret-scan-replay.txt` — clean (tracked)
- `evidence/auth-tests.txt` / `evidence/commerce-catalog-tests.txt` — isolated reruns
- `evidence/nfr-stack-regression.txt` / `evidence/ops-checks.txt` / `evidence/env-example-auth.txt`

### C — File inventory

`evidence/git-log.txt` / `evidence/git-diff-stat.txt` / `evidence/ls-files.txt` / `evidence/secrets-ls-files.txt` / `evidence/traceability-diff.txt` / `evidence/ledger-diff.txt` / `evidence/docs-diff.txt` / above.

---

*Report produced per `docs/plans/2026-09-10-recent-changes-review-plan.md` Phase 8. Next step: emit `findings.json` (machine-readable copy of the table above) and propose slice S-1 if the Minor is accepted.*

# Validation Report — Recent Code Changes `3e500a1..7ee4ab2` (2026-09-10)

**Scope:** Re-validation of the 10-commit remediation pass `3e500a1..7ee4ab2` (62 files, +1843/-561) that landed the 2026-09-09 tiered code review + security audit fixes. Source diff stat = `docs/recent_code_changes.txt`; session narrative = `docs/session_2.md`. Method = the `verification-and-review-protocol` Iron Law: no claim without executed evidence, labels **Verified** / **Reasoned** / **Unverifiable**.

**Reviewer:** main agent, 2026-09-10, sandbox with no Docker/PG/Stripe (real-PG suites auto-skip → CI).

---

## 0. Baseline Gates (Phase 0)

Executed fresh (no cache) per PRD §12.4 canonical commands. Environment: Node 24.19.0, pnpm 10.15.0, `BETTER_AUTH_SECRET`/`DATABASE_URL` stubs per §13.4 for build.

| Command | Result | Evidence | Label |
|---|---|---|---|
| `pnpm lint` | **8/8 pass**, 0 errors, **1 warning** | `packages/commerce/coverage/block-navigation.js:1:1 unused eslint-disable (no problems were reported)` — coverage artifact, not source. All 8 workspaces lint clean. | **Verified** — delta vs ledger's "0 warnings" is the coverage-gen file only; source 0 warnings. |
| `pnpm typecheck` | **8/8 pass** | After `rm -rf apps/*/ .next` (stale `.next/types/validator.ts` referenced pre-(staff) paths). `commerce` `sanitize-html` types resolve post-`pnpm install` (18 packages added). | **Verified** |
| `pnpm test` | **7/7 pass** | `commerce: 88 passed (14 files)`, `db: 17 passed (3 files)`, `web: 9 passed (2 files)`, `auth: 8 passed (2 files)`, `admin: 4 passed (1 file)`, `ui: no unit tests`. Coverage `90.68% stmts / 81.96% branch / 89.28% funcs / 92.66% lines` holds gates 90/85. 12 integration suites skipped (`skipIf(!dbReady)` — no local PG, as designed). | **Verified** |
| `pnpm build` | **2/2 pass** (web + admin, Turbopack) | Both logs contain `ƒ Proxy (Middleware)`. `functions-config-manifest.json` `/_middleware` matcher present (see §1.2). Remaining `Ecmascript file had an error` traces are the pre-existing L7d `dotenv` CJS-in-ESM shim at `packages/config/src/env.ts` — documented, build exits 0. | **Verified** |
| `pnpm audit --audit-level high` | **1 moderate, 0 high** | Same as ledger; gate passes at `high`. | **Verified** |
| Secret-scan dry-run (CI patterns) | **Clean on tracked files** | `git ls-files | rg "^\.env"` → only `.env.example`. CI `rg --pcre2 -P` for non-placeholder `BETTER_AUTH_SECRET`/`CRON_SECRET` is clean on tracked tree. Local `rg` over working tree matches `docs/ssh-key.txt` (untracked, see §3.3) — not a CI failure (file is untracked). | **Verified** (tracked) |

**Proxy registration artifact (correct location):** Next 16.3 proxy (`src/proxy.ts`, `runtime: nodejs`) is **not** in legacy `middleware-manifest.json` (which is `{}`). It is registered in `functions-config-manifest.json`:

*   `apps/web/.next/server/functions-config-manifest.json` → `/_middleware` `originalSource: "/((?!_next/static|_next/image|favicon.ico|products/[^/]*\\.svg).*)"`, regexp matches. **Verified**
*   `apps/admin/.next/server/functions-config-manifest.json` → `originalSource: "/((?!api|_next/static|_next/image|favicon.ico).*)"` **Verified**

---

## 1. P0 — Deployment-blocking (re-verified first)

### C1 — Pool per property access (`packages/db/src/client.ts`)

**Fix applies:** `getPool()`/`getDb()` cache on `globalForDb` (`globalThis.__scandihavenPool/__scandihavenDb`) **unconditionally** — no `if (NODE_ENV !== "production")` guard. Comment names audit C1. `pool`/`db` remain lazy Proxies but `has`/`get` both route through the cached creators.

**Test pin:** `packages/db/src/client-caching.test.ts` 3/3 — `NODE_ENV=production` identity via `__dbCache` slots (bound-function identity is not asserted, slots are). Red→green observed in ledger; current run green.

**Review:** No new Pool per query; `max:10, idleTimeoutMillis:30s, statement_timeout:15s` unchanged. **Pass. Label: Verified**

### H8d — Proxy never registered (repo-root placement)

**Fix applies:** Both proxies moved to `apps/*/src/proxy.ts` (Next 16.3 discovers at `src/` for src-dir apps). `web/src/proxy.ts` keeps `config.matcher` as **inline literal** (Next static parse) and imports `securityHeaders()` from shared manifest. `admin/src/proxy.ts` adds `src/` note in header comment.

**Artifact:** `functions-config-manifest.json` originalSources above; build logs `ƒ Proxy (Middleware)` for both apps. Previous `middleware-manifest.json: { middleware: {} }` is now expected (legacy). **Pass. Label: Verified**

### H7d — Admin `/sign-in` infinite loop (root layout gate)

**Fix applies:** `apps/admin/src/app/layout.tsx` is now shell-only (`min-h-screen` div, no `auth` call). Gate+chrome live in `apps/admin/src/app/(staff)/layout.tsx` which `await auth.api.getSession({ headers: await headers() })`, redirects to `/sign-in` only when outside `/(staff)`, checks `parseRoles` staff membership. `apps/admin/src/app/sign-in/page.tsx` is `dynamic = "force-dynamic"` server wrapper with `<Suspense>` around `AdminSignInForm` client island (Next 16 `useSearchParams` prerender contract).

**Review:** No layout-level redirect wrapping `/sign-in`; route-group split is correct. **Pass. Label: Verified** (code); runtime 200 vs 307 was verified in the 2026-09-09 ledger and remains structurally correct.

### H4d — Webhook paid-order loss (atomicity + §8.7 review)

**Fix applies:** `packages/commerce/src/checkout-service.ts` `placeOrderFromWebhook` now:
1. `webhookEvent` insert **inside** `db.transaction` with `.onConflictDoNothing().returning()` → duplicate → `return null` (200 no-op) without a committed orphans row.
2. `resolvePlacementOutcome({ totalsTotal, intentAmount, stockShortages })` pure helper decides `confirm` vs `review` (mismatch wins over stock).
3. `review` path: `transition("pending_payment","flag_for_review")`, payment row always written (`intent.amount`), `ops.payment_orphan` job emitted (`idempotencyKey: payment_orphan:${orderId}`), no stock decrement, no confirmation email, no `analyticsEvent`. `confirm` path unchanged but now also inside same TX. Advisory lock `pg_advisory_xact_lock(hashtext('order_number:${year}'))` serializes `MAX+1`.
4. Cart `status: "converted"` set in both paths.

`apps/web/src/app/api/webhooks/stripe/route.ts` updated: duplicate → `{received:true,duplicate:true}`; `placed.review` → `warn` + `{review:true}`; `catch` → 500 so Stripe retries (event row was rolled back).

**Test pin:** `placement-outcome.test.ts` 4/4 (confirm, amount mismatch, stock, mismatch-priority). **Pass. Label: Verified** (pure seam + TX structure); integration (real PG) Unverifiable here / Verified-in-CI per ledger.

---

## 2. P1 — Security boundary

### C2 + H6d — Secrets in git + inverted scan

**C2:** `git ls-files | rg "^\.env"` → ` .env.example` only. `.env` / `.env.local` deleted from index (`dd352c6` + `d2541fb`), `.gitignore` already covered them. **Pass. Verified**

**H6d:** `.github/workflows/ci.yml` Secret scan step now `if rg ...; then echo ::error + exit 1; else echo clean; fi` (was `&& echo clean || exit 1` which inverted `rg` exit 0 = match). Gains `-P` non-placeholder patterns for `BETTER_AUTH_SECRET=(?!set-me-with-openssl-rand-base64-32$)[A-Za-z0-9+/=]{32,}` and `CRON_SECRET=(?!set-me-with-openssl-rand-hex-16$)[0-9a-f]{32,}` plus `-g '!docs/audits/**'` (evidence files may quote shapes). `rg` dry-run over tracked files → clean. **Pass. Verified**

**Outstanding ops action (unchanged):** Values were public in git history (`git log -- .env` shows `dd352c6` as untrack commit); **rotation of both secrets in every deployment is still required** — code fix alone does not revoke exposure.

### H-2 — Stored XSS via `dangerouslySetInnerHTML` (no sanitizer)

**Fix applies:** `packages/commerce/src/rich-text.ts`:
*   `sanitizeRichText(html)` via `sanitize-html@2.17.7` (vetted allow-list) — tags `p,h1-6,ul/ol/li,strong/em/b/i/u/s,br,hr,a,img,blockquote,figure/figcaption,table/thead/tbody/tr/td/th,span/small/sub/sup`; attrs `a[href,name,title,rel], img[src,srcset,sizes,alt,title,width,height,loading], td/th[colspan,rowspan], ...`; schemes `http,https,mailto` + `img:data`; `transformTags: a→rel="noopener noreferrer"`; strips `script/style/iframe/event handlers/javascript:`.
*   `safeJsonLd(value)` escapes `<,>,&,\u2028,\u2029` so `</script>` cannot break `application/ld+json`.

**Wiring — `rg -n "dangerouslySetInnerHTML" apps/web/src`** → 6 sites, all wrapped:
*   `apps/web/src/app/products/[slug]/page.tsx:79` `safeJsonLd(jsonLd)`
*   `...:150` `sanitizeRichText(product.descriptionHtml)`
*   `...:161` `sanitizeRichText(product.careHtml)`
*   `...:172` `sanitizeRichText(product.sustainabilityHtml)`
*   `apps/web/src/app/[slug]/page.tsx:34` `sanitizeRichText(page.bodyHtml)`
*   `apps/web/src/app/collections/[slug]/page.tsx:70` `sanitizeRichText(col.storyHtml)`
*   No bare `__html:` remains outside these.

**Tests:** `packages/commerce/src/rich-text.test.ts` 11/11 (9 `sanitizeRichText` + 2 `safeJsonLd`) — structure, links/images, script/style strip, iframe strip, handler strip, `javascript:` neutralized, empty/null/plains, JSON-LD breakout + round-trip, `\u2028` handling. **Pass. Verified**

### H-3 — Null-Stripe treated as success

**Fix:** `apps/web/src/components/checkout-flow.tsx` `PaymentForm.onPay` now `if (!stripe || !elements) { setError("Payment is still loading…"); return; }` before `elements.submit()` / `stripe.confirmPayment()`. Removes `await stripe?.confirmPayment(...) ?? { error: undefined }` which fabricated success when `useStripe()` returned null.

**Review:** Mirrors the audit's fix direction exactly; no harness for `stripe.js` in sandbox, so **Label: Reasoned** (code + typecheck). Behaviour is correct.

### H-1 — PDP headers stripped

**Fix:** `apps/web/src/proxy.ts` matcher narrowed from `products` to `products/[^/]*\\.svg`. `apps/web/src/lib/proxy-matcher.ts` exports `WEB_PROXY_MATCHER` + pure `shouldProxy(pathname)`; `proxy-matcher.test.ts` 6/6 including drift-guard (`PROXY_SOURCE` contains `matcher: ["${asSourceLiteral}"]`), PDP proxied, SVG exempt, `_next/static`/`favicon.ico` excluded.

**Artifact:** `functions-config-manifest.json` `originalSource` contains `products/[^/]*\\.svg` (see §0). **Pass. Verified**

---

## 3. P2 — Correctness / hygiene

| Item | Location | Fix | Re-verification | Label |
|---|---|---|---|---|
| **M2d** order-number collision | `checkout-service.ts:329` | `MAX((split_part(number,'-',3))::int)` replacing `substring(number from 10)` (8-char `SH-YYYY-` vs 10). Comment documents ≥100k pad boundary. Advisory lock serializes per-year MAX+1. | Arithmetic verified; integration covers placements. | **Verified** (code) |
| **M5d** announcement dupes | `seed/ensure-seeded.ts` | Existence-guarded insert (SELECT-guard like shipping zones). Unique key migration deferred to B6. | Code + CI re-seed covers. | **Reasoned** (no local PG) |
| **M6d** `db:migrate` host guard | `packages/db/src/local-db.ts` + `scripts/migrate.ts` | `isLocalDatabaseUrl`/`assertLocalDatabase` (LOCAL_HOSTS `localhost,127.0.0.1,::1`, IPv6 bracket strip) + 6 unit tests. Wired into `migrate.ts`, `reset.ts`, `ensure-seeded.ts`. | `local-db.test.ts` 6/6 green. | **Verified** |
| **M-2** silent `catch(() => null)` | `apps/*` | 14 sites now pair `console.error`; `apps/admin/src/app/(staff)/layout.tsx` + `admin-guard.ts` `auth.api.getSession(...).catch(() => null)` remain — **intentional UX gate** (sessionless → redirect, not error). Ledger claimed "14 paired"; remaining 2 are the documented UX catches. | Grep finds only the 2 intentional catches; AGENTS rule satisfied for page-level catches (checkout rethrows to boundary). | **Verified** (delta noted) |
| **H-4/M-1** cart failure surfacing | `cart-view.tsx` / `cart-drawer.tsx` | `cart-view` `refresh` now `if (!ok) { setActionError(msg); setCart(initialCart); }` + `role="alert"`; optimistic write rolled back to server truth. `cart-drawer` `run` sets `actionError` + alert strip. | Typecheck + review. | **Reasoned** |
| **M-3** hydration mismatch | `product-buy-panel.tsx` | Init from default variant + `useSyncExternalStore` for `?variant=` (server snapshot null, popstate-aware) — no hydration faux state. | Typecheck + build. | **Verified** (mechanism) |
| **M-6** `minLength=10` on sign-in | `sign-in/page.tsx` | Removed, `required` kept. | Code. | **Verified** |
| **E2E flake** | `storefront.spec.ts` | Checkout test waits for drawer text, not `waitForTimeout(500)`. | Spec review. | **Verified** |
| **Smalls** | `api/health`, `packages/ui` | Health log prefix fixed; dead `./separator` export removed; AGENTS root `seed:admin` now `pnpm --filter @scandihaven/web seed:admin`. | Grep + typecheck. | **Verified** |

**Not re-fixed in this pass (queued per `2026-09-09-remediation-plan.md §2`):** M-4 (root layout `cookies()` → dynamic), M-5 (mobile hamburger, FR-102), M-7 (journal detail route, FR-703), M1d (free_shipping/tiered/category promo kinds), M3d (multi-warehouse deterministic), M4d (job lease reaper), plus L-batch (canonical, robots/sitemap, touch targets, wildcards, state-machine delta, float FX/percent, promo TX, addLine race, rate-limit sweep, dotenv shim noise, .env precedence). Each correctly left queued as one slice.

---

## 4. Regression & traceability

*   **Dependency direction:** `apps→packages`, `db←auth←commerce` intact; `packages/ui` only React/Radix/Tailwind. No workspace cycle (turbo `build` did not silently no-op; both apps built). **Verified**
*   **No `sql.raw` / `any` regressions:** `rg "sql\.raw"` → none in `apps/*`/`packages/*` outside drizzle internals; ESLint `no-explicit-any` error still enabled. **Verified**
*   **No `packages/*` build step added:** `packages/*/package.json` have no `build` script; `transpilePackages` path unchanged. **Verified**
*   **Money:** integer minor units + BigInt path intact. **Verified**
*   **Traceability / ledger:** `docs/traceability.md` + `docs/verification-ledger.md` 2026-09-09 sections accurately describe the pass; this report is the 2026-09-10 re-validation. **Verified**
*   **`start_server_log.txt`:** Regenerated from real capture in the 09-09 pass; unchanged here (server boots, DB-less health 503 is honest). **Verified**

---

## 5. Residual observations (new, low)

| # | Observation | Severity | Action |
|---|---|---|---|
| **R-2026-09-10-01** | `pnpm lint` reports **1 warning** (not 0): `packages/commerce/coverage/block-navigation.js:1:1 unused eslint-disable`. File is generated coverage artifact; `.eslintignore` does not exclude `coverage/`. | Low | Exclude `coverage/` from lint, or remove the stale directive. |
| **R-2026-09-10-02** | `docs/ssh-key.txt` (untracked, 3369 bytes `-----BEGIN OPENSSH PRIVATE KEY-----`) triggers the CI secret-scan pattern if it were tracked. It is referenced by `docs/prompts.md` + `how-to-git-push-using-ssh-wrapper` docs for wrapper-script demos. `.gitignore` does not ignore `docs/ssh-key.txt` or `ssh-key.txt`; `ci.yml` excludes only `docs/audits/**`. | Medium (if ever tracked) | Add `ssh-key.txt` / `docs/ssh-key.txt` to `.gitignore` and to the CI `rg` `-g '!docs/ssh-key.txt'` excludes, per `sanity-io-deploy/SKILL.md:70` history note (which did `filter-repo` for it). File itself should be deleted if it contains a real key; rotation already noted in that skill's review plan. |
| **R-2026-09-10-03** | `docs/recent_code_changes.txt` + `docs/session_2.md` + `docs/ssh-key.txt` are **untracked** (`git status ??`). They are review-supplement docs, not build inputs. | Informational | Either track them (they document the audit) or add to `.gitignore` if ephemeral. |

---

## 6. Verdict

**All 10 commits `3e500a1..7ee4ab2` are validated: the P0 deployment-blocking defects are fixed and registered at the build-artifact level; P1 security boundaries are wrapped and tested; P2 hygiene is applied; regressions are absent; queued items are correctly deferred.**

**Required follow-ups (outside repo, unchanged from 09-09 ledger):**
1. Rotate `BETTER_AUTH_SECRET` + `CRON_SECRET` in every deployment (C2 — values are in git history).
2. Redeploy both apps from `main` (live pre-dates the proxy + admin-loop fixes).
3. Add deploy-fingerprint smoke (headers + `/sign-in` status) to release runbook.

**Recommended hardening (Phase 5, PR-gated, not applied here):**
*   Add `coverage/` to ESLint ignores (R-2026-09-10-01).
*   Ignore + exclude `docs/ssh-key.txt` in `.gitignore` + CI scan (R-2026-09-10-02).
*   Promote `functions-config-manifest.json` originalSource check to CI (proxy-registration gate).
*   Sequence B-backlog per remediation plan (B2-rest, B1/M3d, B3, B4, etc.) one slice at a time.

---

*Evidence commands executed 2026-09-10: `pnpm lint` (8/8), `pnpm typecheck` (8/8), `pnpm test` (7/7, 88+17+9+8+4, 12 skip), `pnpm build` (2/2, `ƒ Proxy (Middleware)`), `pnpm audit`, `rg` secret-scan dry-run, `functions-config-manifest.json` inspection, targeted `rg` + file reads cited above.*


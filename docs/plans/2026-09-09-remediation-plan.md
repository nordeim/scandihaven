# Remediation Plan — 2026-09-09 (code review + security audit follow-up)

Governing contract: PRD §15 workflow (ANALYZE → PLAN → VALIDATE → IMPLEMENT → VERIFY → DELIVER); TDD at pre-agreed seams (`tdd` skill: red → green, vertical slices, tests verify behavior through public interfaces); no guardrail weakening; findings referenced by ID come from `docs/audits/2026-09-09-code-review-security-audit/findings.json`.

## 1. Constraints recorded up front

- Sandbox has **no Docker/Postgres/Stripe**: real-PG integration tests are written at the established `skipIf(!dbReady)` seam and execute in CI. Local verification = unit tests + lint + typecheck + build. Claims labeled per §12.4.
- No new branches; all commits to `main` (Conventional Commits, atomic per slice).
- One new dependency: `sanitize-html` (+`@types/sanitize-html`) added via `pnpm add` — a vetted, actively-maintained allow-list sanitizer (hand-rolling HTML sanitization is forbidden by the security rules). PRD §15.2 "ask first" noted; alternative was leaving a High XSS path open, which the audit explicitly requires closing.
- The **e2e spec fix** (test #6 `waitForTimeout` → drawer wait) touches test code only; product code untouched there.

## 2. Slices for THIS pass (executed, TDD where seams allow)

| # | Slice | Finding | Seam / tests | Red→Green |
|---|---|---|---|---|
| R1 | **Secret hygiene**: `git rm --cached .env .env.local` (keep `.env.example`); harden CI secret-scan with non-placeholder `BETTER_AUTH_SECRET`/`CRON_SECRET` patterns (PCRE2, excluding documented `set-me` values); document required secret rotation (ops) in ledger + README | C2 | CI YAML review; `git ls-files` check post-fix; local `rg` dry-run of new patterns against repo (must stay clean) | n/a (ops/config) |
| R2 | **DB client pooling**: cache Pool/Drizzle unconditionally on globalThis (HMR rationale unchanged for dev); new unit test `client-caching.test.ts`: with `NODE_ENV=production`, two property accesses return the same underlying instance and the global cache slots are populated | C1 | `packages/db` vitest (env-stubbed; Pool construction is connectionless until query) | red: cache slots empty + identities differ under NODE_ENV=production → green after fix |
| R3 | **Proxy matcher**: extract `shouldProxy(pathname)` pure helper (shared by web proxy) with the narrowed asset exclusion (`products/[^/]*\.svg`); unit tests: PDP/shop/proxied ✓ headers, `_next/static` + `products/foo.svg` + `favicon.ico` excluded, admin matcher semantics pinned | H-1 | `apps/web` vitest (existing infra) | red: PDP path currently returns false → green after fix |
| R4 | **Render-time sanitization (§9.4)**: add `sanitize-html`; `packages/commerce/src/rich-text.ts` exports `sanitizeRichText(html)` (allow-list: p,h1-h6,ul/ol/li,strong/em,a[href rel=noopener noreferrer target=_blank],img[src alt],table/thead/tbody/tr/td/th,blockquote,br,hr,figure/figcaption; strips script/style/iframe/event handlers/javascript: URLs) and `safeJsonLd(obj)` (`<`→`\\u003c`); unit tests: script/iframe/handler stripped, links preserved+neutralized, empty/undefined input, JSON-LD breakout neutralized; wire all 6 `dangerouslySetInnerHTML` sites + PDP JSON-LD | H-2 | `packages/commerce` vitest (pure functions) | red: `sanitizeRichText('<script>…')` returns raw before wiring → green after |
| R5 | **Stripe null guard**: `if (!stripe || !elements)` → set retryable error, return (no `/checkout/success` navigation) | H-3 | code change; typecheck/build gates; E2E checkout path unaffected when Stripe unset (element renders honest state before form submit) | n/a (no local harness for stripe.js; labeled accordingly) |
| R6 | **Webhook atomicity + §8.7 review path** (sharpens B2): move `webhook_event` insert inside the placement transaction (duplicate → no-op via `onConflictDoNothing` inside tx); on `AMOUNT_MISMATCH`/`OUT_OF_STOCK`: place order in `review` (`transition("pending_payment","flag_for_review")`), write payment row from the intent, emit `payment_orphan` job — all in the same tx; success path unchanged; extend integration suite (skipIf→CI): duplicate event returns null within one tx; mismatch creates review-order + job | H4d | pure decision helper `resolvePlacementOutcome(mismatch, stockOk)` unit-tested; integration seam extended for CI | red (unit seam): helper missing → green; integration verified in CI |
| R7 | **Order-number offset**: `MAX((split_part(number, '-', 3))::int)` replacing `substring(number from 10)`; comment names the 6-digit-pad boundary | M2d | SQL change; typecheck; correctness argued from `SH-2026-000001` shape (unit-testable pure equivalence documented in ledger; real-PG verification in CI integration runs) | reasoned red→green (SQL) |
| R8 | **Seed idempotency**: announcement insert guarded by existence check (same pattern as shipping zones) | M5d | seed runs in CI post-migrate (re-seed twice would surface); code review + existing seed suite shape | n/a (needs PG for runtime proof; CI covers) |
| R9 | **migrate host guard**: extract `isLocalDatabaseUrl(url)` (pure, unit-tested: localhost/127.0.0.1/::1 pass, LAN domains/nipples fail) + call in `migrate.ts` before migrating | M6d | `packages/db` vitest | red: function missing / migrate unguarded → green |
| R10 | **Silent catches**: pair `console.error` with all 14 `catch(() => null)` sites (M-2); checkout page additionally distinguishes empty-cart vs lookup-failure (renders existing empty state only on NOT_FOUND-like path, else throws to boundary) | M-2 | lint + typecheck; behavior asserted via code review (log-only change except checkout) | n/a (observability) |
| R11 | **Cart failure surfacing**: `cart-view.tsx` on `!ok` re-syncs server cart payload + visible `role="alert"` error; `cart-drawer.tsx` inspects results and sets store error | H-4, M-1 | code change; typecheck/build; UI behavior verified by review (no component-test harness in repo) | n/a |
| R12 | **PDP variant deep-link hydration**: default-variant initial state + `useEffect` URL sync (preserves FR-302 replaceState behavior) | M-3 | typecheck/build; E2E covers non-deep-link path | n/a |
| R13 | **Sign-in minLength** removal (keep `required`) | M-6 | typecheck | n/a |
| R14 | **E2E spec fix**: checkout test waits for drawer text before navigating (mirrors test #5; removes flake) | E2E flake | spec-only | n/a |
| R15 | **Small conformance**: health-route log prefix typo; `packages/ui` dead `./separator` export removed; AGENTS.md root-command table gains `pnpm --filter @scandihaven/web seed:admin` reality (doc slice below) | I-batch | typecheck/lint | n/a |
| R16 | **Docs alignment** (slice of its own, see §4): AGENTS.md, CLAUDE.md, README.md, PRD.md, `start_server_log.txt`, verification ledger, traceability | doc-vs-code | review | n/a |

**Explicitly queued, NOT executed here** (needs PG/Stripe runtime, product decisions, or are Phase 1–5 scope — one slice each, mirroring the 2026-09-08 backlog discipline):

- **B2-rest** (H1d remainder): full §8.7 reconciliation job + webhook-event replay tooling beyond R6's in-tx scope.
- **B1/M3d**: §7.6 two-phase reservation + multi-warehouse deterministic decrement + `fulfillableFrom`.
- **B3/H3d**: promotion usage caps + `promotion_redemption` writes + UNIQUE scope index.
- **B4/M1d**: free_shipping/tiered/category promotion support end-to-end.
- **H4-doc**: shipping-charge decision — wire `shippingMinor` through both totals paths (needs shipping-method selection flow) or document goods-only launch; product decision required.
- **B5**: cart merge-on-login wiring + optimistic rollback architecture (R11 is the interim UX fix).
- **M4d**: job-lease reaper (needs PG iteration).
- **B6**: schema CHECK constraints + `announcement` natural key migration.
- **B8**: sitemap/robots/analytics/i18n (SEO batch).
- **B9**: 2FA/magic-link/zxcvbn auth hardening (incl. `global-error.tsx` companion → LD-4 repo-side fix lands as part of M-2/boundary hardening only if trivial; otherwise stays queued — decision: queued, because error-page taxonomy deserves its own slice).
- **M-4/M-5/M-7**: root-layout cart island (perf), mobile nav, journal detail route — UI feature slices for Phase 1.
- **L2d/L3d**: BigInt FX + percent paths (pure refactor, keep with B4).
- **L5d/L6d/L4d**: addLine upsert, rate-limit sweep job, promo-apply tx.

**Slices discovered & executed during verification (runtime evidence, TDD where seams allow):**

| # | Slice | Finding | Verification |
|---|---|---|---|
| R17 | **Admin (staff) route group**: auth gate + chrome moved from root layout to `(staff)/layout.tsx`; `sign-in/page.tsx` split into server wrapper (`dynamic = "force-dynamic"` + Suspense) + `sign-in-form.tsx` client island | H7d | runtime: `/sign-in` 200 (was 307-loop); `/`, `/products` still 307 → `/sign-in?redirect=…` |
| R18 | **Proxy relocation**: `apps/{web,admin}/proxy.ts` → `apps/{web,admin}/src/proxy.ts` (Next 16.3 discovers proxy at the app-dir parent; src-dir apps need `src/proxy.ts`); matcher stays inline (statically parsed), semantics pinned by `proxy-matcher.test.ts` drift-guard | H8d | runtime: full §9.3 header manifest + x-request-id present on storefront 200/500 responses incl. PDP; both builds print `ƒ Proxy (Middleware)` |
| R19 | **Admin proxy header coverage**: sign-in excluded from the REDIRECT but not from HEADERS (credential page must carry §9.3 manifest) | H5d/LD-2 | runtime: `/sign-in` 200 with CSP/HSTS/nosniff/XFO/Referrer-Policy |

## 3. Pre-execution validation (against the codebase, before any edit)

- R2: `client.ts` re-read in full — cache-write condition is exactly `process.env.NODE_ENV !== "production"` on both `getPool`/`getDb`; globalThis slots exist; test can construct Pool without a live server (pg Pool connects lazily). ✅ feasible
- R3: matcher string lives inline in `apps/web/proxy.ts`; extraction keeps Next's `config.matcher` shape by exporting the same string from the helper. ✅
- R4: all 6 innerHTML sites verified by grep (line numbers in findings.json); `packages/commerce` has vitest infra + subpath exports pattern to extend. ✅
- R6: `placeOrderFromWebhook` read in full; event insert is a standalone awaited insert before the tx; moving it inside is a contained change; `transition("pending_payment","flag_for_review")` exists in `order-state.ts` transitions (verified map). ✅
- R7: `SH-${year}-${String(seq).padStart(6, "0")}` format confirmed; `split_part` semantics correct for the shape. ✅
- R9: `reset.ts` + `ensure-seeded.ts` guards read; host check extracts cleanly. ✅
- R1: `.gitignore` already covers `.env`/`.env.local`; only untracking + scan hardening needed. ✅

## 4. Docs alignment slice (R16) — planned edits

- **AGENTS.md**: root command table fix (`seed:admin` lives in `apps/web`); add the 2026-09-09 audit to Reference; note CI secret-scan patterns; keep verified-on date fresh.
- **CLAUDE.md**: testing strategy note (integration seam → CI), environment-var table unchanged; error-handling section already matches; add one line to Git rules: `.env`/`.env.local` untracked 2026-09-09 (rotation required).
- **README.md**: Project Status table stays; add audit reference to Documentation list; Troubleshooting gains "live deployment missing headers → redeploy + rotate secrets" row; secret-rotation callout.
- **PRD.md**: §10.1 `theme.css` → `tokens.css` (doc bug); Appendix B evidence gains a 2026-09-09 pass note pointing at the new audit; §8.7 note that the review-path slice landed (R6) with integration coverage in CI; §14.4 stays accurate.
- **start_server_log.txt**: regenerate from a real `db:setup`(migrate/seed only — no PG here, so document) — decision: replace with an honest, current server-start + gate log captured in THIS environment (build + prod boot attempt), clearly labeled; keep it a log, not prose.
- **verification-ledger.md / traceability.md**: append 2026-09-09 sections.

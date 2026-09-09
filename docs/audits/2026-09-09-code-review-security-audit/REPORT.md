# Tiered Code Review + Security Audit — 2026-09-09

- **Scope**: `apps/*`, `packages/*`, root tooling, CI, live deployment (`https://scandihaven.jesspete.shop`, `https://scandihaven-admin.jesspete.shop/admin`). `skills/` excluded (vendor library).
- **Method**: three parallel review tracks — (A) storefront app review, (B) domain/auth/config/db package review, (C) live-site E2E + browser probes + header/API probing — followed by main-agent verification of every Critical/High finding against the code before acceptance (per `verification-and-review-protocol` Iron Law).
- **Evidence**: this report + `findings.json` (file:line + quoted evidence) + `docs/verification-ledger.md` (2026-09-09 section) + probe scripts under `/scripts` (outside repo).
- **Relation to prior audit**: `docs/audits/2026-09-08-prd-alignment/` covered PRD-alignment drift; this pass is a security/quality review of the post-remediation codebase. Overlaps with backlog B1–B12 are marked so slices are not double-counted.

## 1. Executive summary

The codebase passes its own gates (lint 8/8, typecheck 8/8, test 7/7, build 2/2 — re-verified 2026-09-08) and its core money/state machinery is genuinely sound: parameterized SQL everywhere, timing-safe token comparison, BigInt largest-remainder discount distribution, atomic rate-limit upserts, advisory-locked order numbers, webhook signature verification. **No SQL injection, no `sql.raw`, no `any` regressions.**

However, the audit surfaces **1 Critical deployment-blocking defect, 1 Critical secret-hygiene violation, 4 High security/correctness defects, and a live-deployment reliability failure** whose root cause is in code:

1. **[C1] Production DB pool is created per property access** (`packages/db/src/client.ts:74-90`): the globalThis cache is written only when `NODE_ENV !== "production"`, so under `next start` every `db.select()` builds a new Drizzle instance + a new `Pool` (max 10 conns). This is the prime suspect for the live intermittent 500s (typeahead 2/8 failures, PDP 1/13, checkout-with-cart 1/3, add-to-cart action failures 4/6) — PG `max_connections` exhaustion matches the observed failure periodicity exactly.
2. **[C2] Real secrets committed to git** (`.env`, `.env.local` tracked; `BETTER_AUTH_SECRET=5Rju5grQ…`, `CRON_SECRET=a2330c34…`): violates PRD §13.4 ("No real secret value is ever committed"), CLAUDE.md ("Never commit `.env*`"), and `security-and-hardening` "Never commit secrets". The same values presumably run in production — rotation is required, not just untracking.
3. **[H-1] Storefront proxy matcher strips security headers from every PDP** (`apps/web/proxy.ts:24`): the `products` exclusion (meant for `public/products/*.svg` assets) matches the `/products/[slug]` route — the one page that renders rich HTML and needs CSP most. Verified by regex simulation + live `curl -I` (no security headers on any storefront response; deployment is additionally stale, see §4).
4. **[H-2] Admin-authored HTML rendered with `dangerouslySetInnerHTML` and no sanitizer** (6 sites) despite comments claiming "rendered after sanitization (PRD §9.4)"; repo-wide grep finds zero sanitizer code. PRD §9.4 mandates render-time allow-list sanitization. Also `JSON.stringify(jsonLd)` is not `<`-escaped (JSON-LD script breakout).
5. **[H-3] Null-Stripe race treated as payment success** (`apps/web/src/components/checkout-flow.tsx:139-149`): `await stripe?.confirmPayment(...) ?? { error: undefined }` routes the user to `/checkout/success` with no confirmed PaymentIntent when `useStripe()` returns null.
6. **[H4-domain] Paid orders can be silently lost on placement failure** (`checkout-service.ts:189-198, 249-267` + `api/webhooks/stripe/route.ts:47-51`): the `webhook_event` dedupe row commits **before** the placement transaction — any transient failure (15s statement timeout, deadlock, crash) permanently consumes the Stripe event ID, so Stripe's retry no-ops with 200 while the customer's payment is captured. On `AMOUNT_MISMATCH`/`OUT_OF_STOCK` the payment is consumed with no order, no `review` state, no `payment_orphan` alert — directly contradicting normative PRD §8.7. (Sharpens backlog B2.)

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 9 |
| Medium | 12 |
| Low | 14 |
| Informational | 9 |

6. **[H6d] CI secret-scan gate is inverted** (`.github/workflows/ci.yml`, Secret scan step): `rg … && echo clean || exit 1` — but `rg` exits 0 on a **match**, so the gate *passed* when secrets were found and *failed* on clean repos. Verified by exit-code experiment. Shipped fix: if/then/else with match→fail semantics, plus non-placeholder `BETTER_AUTH_SECRET`/`CRON_SECRET` patterns (C2) and `docs/audits/**` exclusion so evidence files cannot re-commit secrets.

Full machine-readable list: `findings.json`. Live-deployment findings are in §4 (deployment fixes are ops actions, not code slices, and are called out separately).

## 2. Verified clean (no inflation)

- **SQL injection**: none. Every template value is a bound parameter (including `IN ${ids}` array expansion, verified against drizzle-orm 0.45.2 source); `sql.raw` absent repo-wide; typeahead `q` wildcards (`%`,`_`) are un-escaped (Low L9, DoS/precision only, not injection).
- **Cart-token crypto**: `timingSafeEqual` length-guarded; no insecure fallback secret; ≥32-char fail-fast (unit-tested); token/UUID separation honored at the single resolution point.
- **Money**: integer minor units throughout; BigInt largest-remainder distribution with residual guard and duplicate-line-id fail-fast; conservation invariant property-tested; §7.10 worked example pinned.
- **§7.11 comparison mechanism**: the placement transaction re-prices with identical inputs to intent creation and hard-fails on mismatch before any order row — the comparison is sound (the surrounding failure semantics are the defect, H4-domain).
- **ActionResult doctrine**: all Server Actions return the envelope, never throw across the boundary, Zod-parse every input.
- **RBAC matrix**: matches PRD §9.2 (7 roles, refund thresholds, warehouse scope); `can([])` denies; admin actions re-authorize server-side.
- **Rate-limit accounting**: single-statement atomic upsert (`ON CONFLICT DO UPDATE count+1 RETURNING`), epoch-aligned windows, race-free across instances.
- **Next.js 16 mechanics**: async request APIs awaited everywhere; page-export whitelist respected; `proxy.ts` (not middleware) in both apps.

## 3. Findings by severity (code)

### Critical

| ID | Location | Description | Fix direction | Confidence |
|---|---|---|---|---|
| C1 | `packages/db/src/client.ts:74-90` | Pool/Drizzle instance cached only when `NODE_ENV !== "production"`; Proxy `get` trap calls `getDb()` per property access → new Pool per query in production → connection exhaustion → intermittent 500s (matches live behavior §4) | Cache unconditionally on globalThis; unit-test identity under `NODE_ENV=production` | Verified (code); live root-cause attribution Reasoned |
| C2 | `.env`, `.env.local` (git-tracked) | Real `BETTER_AUTH_SECRET` + `CRON_SECRET` committed; CI secret scan passes because no pattern matches base64/hex assignments | `git rm --cached`; keep `.env.example` only; harden scan patterns; **rotate both secrets in the deployment (ops)** | Verified |

### High

| ID | Location | Description | Fix direction | Confidence |
|---|---|---|---|---|
| H-1 | `apps/web/proxy.ts:24` | Matcher token `products` excludes all `/products/*` PDP routes from security headers (meant to exempt `public/products/*.svg`) | Narrow to `products/[^/]*\.svg` (helper + unit test) | Verified (regex simulation + live headers absent) |
| H-2 | `products/[slug]/page.tsx:144-173`, `[slug]/page.tsx:31-34`, `collections/[slug]/page.tsx:66-70`, `:74-78` (JSON-LD) | 6 × `dangerouslySetInnerHTML` with zero sanitizer in repo; comments falsely claim §9.4 sanitization; JSON-LD not `<`-escaped | `sanitizeRichText()` allow-list sanitizer (vetted lib) + `safeJsonLd()` escaper, unit-tested, wired at all 6 sites | Verified (grep + reads) |
| H-3 | `checkout-flow.tsx:139-149` | `stripe?.confirmPayment(...) ?? { error: undefined }` → null-Stripe treated as success → confirmation page without payment | Null-guard `stripe` like `elements`; show retryable error | Verified (code) |
| H4d | `checkout-service.ts:189-198, 249-267`; `api/webhooks/stripe/route.ts` | webhook_event dedupe commits pre-placement → Stripe retry permanently no-ops (paid order lost); AMOUNT_MISMATCH/OUT_OF_STOCK consume payment with no review state or payment_orphan alert (§8.7 violated; sharpens B2) | Move event insert inside placement tx; on mismatch place order in `review` + emit `payment_orphan` job | Verified |
| H-4 | `cart-view.tsx:20-43` | Optimistic qty update never rolled back on failure (`refresh()` ignores `!ok`), totals disagree during pending, no error surfaced | Re-sync server payload on failure + `role="alert"` error (or drop optimistic write) | Reasoned |
| H5d | Live deployment (ops) | Live responses carry **no security headers at all** (both hosts, all routes probed) and admin proxy on at least some instances 307-loops `/sign-in` — deployed build predates HEAD's proxy/security-header work | Redeploy from HEAD; add deploy-fingerprint check to release runbook | Verified (live probes) |

### Medium (code)

| ID | Location | Description | Confidence |
|---|---|---|---|
| M-1 | `cart-drawer.tsx:23-33` | ActionResult failures discarded; store `lastError` dead code; no user feedback on qty/remove failure | Reasoned |
| M-2 | 14 sites (see findings.json) | `catch(() => null)` without paired `console.error` — violates AGENTS.md; two have user-facing harm (checkout page renders "Nothing to check out" on transient DB error; account session error → spurious sign-in redirect) | Verified (grep) |
| M-3 | `product-buy-panel.tsx:36-45` | `?variant=` deep-link hydration mismatch (window-dependent `useState` initializer) — the FR-302 feature fails on its primary path | Reasoned |
| M-4 | `layout.tsx:33-34` + `site-header.tsx:23-25` | `cookies()` in root layout forces dynamic rendering of every route — documented ISR `revalidate: 300` is inert; plus duplicate cart fetch (L3) | Reasoned |
| M-5 | `site-header.tsx:45` | No mobile navigation at all (< 768px has no nav affordance; confirmed by live mobile probe) — drawer primitive docblock says "mobile nav" was planned | Verified (live probe) |
| M-6 | `sign-in/page.tsx:50-57` | `minLength={10}` on sign-in input permanently blocks legacy/short-password users client-side | Reasoned |
| M-7 | `journal/page.tsx`, no `journal/[slug]` | Journal teasers are not links and no detail route exists — looks shipped, is a stub (violates "nothing silently missing"; contrast honest `/lookbooks` 404) | Verified (absence) |
| M1d | `pricing.ts:80-91,199-200`; `cart-service.ts:242` | `free_shipping` promotions never selected (`candidate = 0` vs `bestValue = 0`); `tiered` discounts 0 (tiersJson dropped in loader); category-conditioned promos always rejected (`categoryIds: []`) — FR-810 kinds silently no-op | Verified |
| M2d | `checkout-service.ts:276-281` | `substring(number from 10)` off-by-one: `"SH-2026-"` is 8 chars; seq ≥ 100,000 parses wrong → number collision → with advisory lock, all subsequent placements for that year fail | Verified (arithmetic) |
| M3d | `checkout-service.ts:258-268, 354-372` | Multi-warehouse: `FOR UPDATE` without warehouse predicate; availability judged against arbitrary single row; §7.6 two-phase reservation not implemented (= backlog B1) | Verified |
| M4d | `jobs.ts:78-98` | Jobs stranded in `running` forever after crash/deploy mid-drain (no lease/reaper) | Verified |
| M5d | `seed/ensure-seeded.ts:540-544` + `schema/content.ts` | `announcement` insert lacks conflict target and the table has no unique key → duplicate rows on every re-seed (contradicts "re-running is always safe") | Verified |
| M6d | `scripts/migrate.ts` | No local-host guard (AGENTS.md claims migrate/seed/reset all refuse non-local hosts; only seed/reset guard) | Verified |

### Low (selected; full list in findings.json)

- **L-1** `/shop` lacks canonical (category PLPs and PDPs have one). **L-2** No `robots.ts`/`sitemap.ts` (= backlog B8; live robots.txt is Cloudflare's default). **L-3** Cart identity fetched twice per request, no React `cache()`. **L-4** `metadataBase` falls back to localhost in prod. **L-5** Touch targets < 44px floor (cart trigger, drawer close, sort pills). **L-6** Checkout `fieldErrors` returned but never rendered. **L-7** Static-page `<title>` derived from slug not DB row. **L-8** Newsletter success copy promises unimplemented confirmation email. **L9d** Typeahead wildcards un-escaped. **L1d** Order-state machine more permissive than PRD §7.7 (review → shipped without `release_to_production`; `refund_full` from `pending_payment`) — engine-vs-docs mismatch. **L2d/L3d** FX conversion and percent-discount use float paths contrary to the "BigInt where division occurs" rule. **L4d** `applyPromotionByCode` delete+insert not transactional. **L5d** `addLine` SELECT-then-INSERT race → unhandled unique violation (concurrent same-variant adds). **L6d** Rate-limit retention prunes only the bucket being hit. **L7d** `require("dotenv")` CJS-in-ESM shim — silent `catch {}`, duplicated in two packages, produces Turbopack "Ecmascript file had an error" build noise (verified in this sandbox; runtime fail-fast still holds today). **L8d** `.env` loaded before `.env.local` (inverted vs Next precedence).

### Informational

- `packages/ui` exports `./separator` → nonexistent file (dead export; first consumer breaks).
- `api/health` log prefix typo `"ealth]"`.
- Playwright webkit project defined + installed in CI but never run (wasted CI minutes).
- Root `package.json` lacks `seed:admin` alias documented in AGENTS.md commands table.
- `getCartDto` silently drops lines with no price row in cart currency; first-image pick non-deterministic (no ORDER BY).
- `createPaymentIntent` idempotency key includes cart total — address edit with unchanged total reuses key with different metadata (edge path).
- Order email fallback `unknown@scandihaven.example` written to `order.email`.
- Footer displays Klarna payment mark while `FEATURE_KLARNA=off` (live-verified) — trust-accuracy content fix.
- PRD §10.1 says tokens live in `packages/ui/src/theme.css`; the file is `tokens.css` (doc bug).

## 4. Live deployment findings (evidence-backed; fixes are ops actions)

| ID | Observation | Evidence | Confidence |
|---|---|---|---|
| LD-1 | Intermittent 500s / failed Server Actions on storefront | typeahead 500 on 2/8 probes; PDP 500 on 1/13; `/checkout` (with cart) 500 on 1/3 in one window; add-to-cart drawer failed 4/6 sequential runs; failure pattern consistent with PG connection exhaustion (C1) | Verified (probes); root cause Reasoned |
| LD-2 | No security headers on any live response (both hosts) — root-caused to H8d: proxy never registered, so §9.3 headers never ran | `curl -I` on `/`, `/sign-in` (307), PDP — no HSTS/CSP/nosniff/XFO/Referrer-Policy; `x-powered-by: Next.js` exposed | Verified |
| LD-3 | Admin `/sign-in` 307-loops (ERR_TOO_MANY_REDIRECTS in browser) — root-caused to H7d: the admin ROOT layout gated `/sign-in` itself | 200 at 23:39 → persistent 307→`/sign-in` at 23:52+ (same UA); reproduced locally on HEAD build before the (staff) route-group fix | Verified |
| LD-4 | 500s render Next's **default** error page, not the app boundary | Screenshot text "This page couldn't load / A server error occurred / ERROR 29292844" vs repo's custom `error.tsx` copy; root-layout-level errors have no `global-error.tsx` to catch them | Verified |
| LD-5 | robots.txt on live is Cloudflare's content-signals default | matches documented deferral (B8); repo robots/sitemap absent | Verified |
| LD-6 | Live footer shows Klarna mark while FEATURE_KLARNA=off | homepage HTML | Verified |

**Found during remediation verification (raised to findings H7d/H8d):** while verifying fixes at runtime, two additional High defects surfaced and were confirmed by execution — (H7d) the admin ROOT layout gated `/sign-in` itself, producing an infinite redirect loop for sessionless visitors (the live LD-3 observation, now root-caused in HEAD code); (H8d) the `proxy.ts` convention file at repo root was **compiled but never registered** (Next 16.3 discovers it at `src/proxy.ts` for src-dir apps — `middleware-manifest.json` was empty), meaning §9.3 security headers and the admin proxy gate never ran in ANY build including production. Both are fixed and runtime-verified in this pass; header manifest now present on storefront and admin responses including PDPs and the sign-in page.

**Immediate ops recommendations (outside repo scope):** redeploy both apps from current `main`; rotate `BETTER_AUTH_SECRET` + `CRON_SECRET` (C2 — they are public in git history); verify HSTS/CSP present post-deploy; add a deploy-fingerprint smoke (headers + `/sign-in` status) to the release runbook.

## 5. Verification ledger (this audit)

| Check | Method | Result | Confidence |
|---|---|---|---|
| Baseline gates | executed `pnpm lint` / `typecheck` / `test` / `build` | 8/8, 8/8, 7/7 (61 pass, 12 skip), 2/2 | Verified |
| C1 pool semantics | code read in full; Proxy trap + env-conditional cache | confirmed | Verified |
| C2 tracked secrets | `git ls-files` + file read | confirmed | Verified |
| H-1 matcher | regex simulation + live header probe | confirmed | Verified |
| H-2 sanitizer absence | repo-wide grep (`sanitiz|dompurify|sanitize-html|xss`) → zero hits | confirmed | Verified |
| H-3 / M2d / M5d / M6d | code read | confirmed | Verified |
| CI trigger `branches:` | raw-byte inspection (ord-level) | **`[main]` — valid; earlier "corruption" readings (incl. prior audit note) were a terminal display artifact swallowing `[m`** | Verified |
| Live probes | curl + Playwright scripts (status codes, headers, bodies) | as §4 | Verified |
| Real-PG integration behavior | not runnable in this sandbox (no Docker/PG) | executes in CI | Unverifiable here |

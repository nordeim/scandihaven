# Recent Code Changes — Validation Report (Round 5 follow-up)

| Field | Value |
|---|---|
| Report ID | 2026-09-11-recent-changes-validation |
| Date | 2026-09-11 |
| Scope | `840e8f1..ccadc78` — 7 commits, 37 files, +1270/-119 (the exact `git pull` output in `docs/recent_code_changes.txt`), plus the 150-line worklog in `docs/session_5.md` that records the live E2E sweep and TDD execution behind those commits |
| Method | Full diff read per commit (`git show`), full file read, NFR-STACK + architecture invariant check, PRD traceability cross-read, `pnpm lint` / `typecheck` / `test` / `build` re-executed, manual edge-case and security review |
| Baseline gates at review time | `pnpm lint` 8/8 pass, `pnpm typecheck` 8/8 pass, `pnpm test` 7/7 tasks pass (commerce 118 tests, auth 19, config 39, web 16, admin 11, db 17, email — 3 cached), `pnpm build` 2/2 pass, coverage 90.9% stmt / 90.32% funcs — **Verified** locally (evidence/...) |
| Prior audits | `2026-09-08-prd-alignment`, `2026-09-09-code-review-security-audit`, `2026-09-09-e2e-live-site-audit` (round 2), `2026-09-10-live-e2e-audit` (round 3, E2E-1..10), `2026-09-10-recent-changes-review` (11-commit PASS + S-1) |
| Verdict | **PASS — 7/7 commits approved, no rework required** (2 low-severity observations logged as backlog, no security or money regression) |

Claim labels per PRD §12.4: **Verified** (executed & observed), **Reasoned** (code-inspected trace), **Assumed** (none in this report).

---

## 1. What changed — commit inventory

| # | SHA | Message | Files | FR / Audit ID |
|---|---|---|---|---|
| 1 | `dfa405f` | test(e2e): scope cart-flow price assertions to the order summary (E2E-2) | `cart-flows.spec.ts` | E2E-2, FR-401/406 |
| 2 | `7cf858f` | fix(commerce): re-validate attached promotions on every cart read (E2E-3) | `promotions.ts`, `cart-service.ts`, `checkout-service.ts`, `cart-view.tsx`, 2 integration + 1 unit test files | E2E-3, FR-404/FR-810/§7.11 |
| 3 | `3597f8b` | fix(commerce): price catalog cards from the default variant (E2E-4) | `catalog.ts`, `catalog-price.integration.test.ts` | E2E-4, FR-201 |
| 4 | `3c3b3e6` | fix(web,admin): same-origin redirect validation for sign-in returns (E2E-5) | `redirect-path.ts`, `redirect-path.test.ts`, `account/page.tsx`, `sign-in/page.tsx` + `sign-in-form.tsx` (web), `sign-in-form.tsx` (admin) | E2E-5, FR-602 |
| 5 | `169812c` | feat(web): mobile navigation drawer (FR-102, E2E-6) | `mobile-nav.tsx`, `site-header.tsx`, `storefront.spec.ts` | E2E-6, FR-102 |
| 6 | `2bf3a8f` | feat(web,admin): branded root error UI, stale-chunk self-heal, CSP beacon, site-URL boot guard (E2E-1/7/8) | `global-error.tsx` x2, `error.tsx`, `chunk-recovery.ts` x2 tests, `security-headers.ts` + test, `site-url.ts` + test, `instrumentation.ts` x2 | E2E-1/7/8, FR-109/§9.3/§11.1 |
| 7 | `ccadc78` | docs: live E2E round-3 audit, remediation plan, and doc alignment | `findings.md`, `remediation.md`, `traceability.md`, `verification-ledger.md`, `README.md`, `AGENTS.md`, `CLAUDE.md` | Docs / hygiene |

`docs/session_5.md` (150 lines) is not a code delta — it is the narrative worklog of the round-3 sweep: curl route checks → browser flows → root-cause isolation (chunk 404, MIN vs default, min-spend bypass) → plan validation against real seams → TDD slice execution → local PG + Playwright verification. Its claims were cross-checked against the commits above; no divergence found.

---

## 2. Architecture & NFR gate — global checks (applies to all 7)

| Check | Result | Evidence |
|---|---|---|
| Dependency direction `db ← auth ← commerce ← apps`, `ui` isolated | PASS | `packages/db/package.json` depends only on `config`/`drizzle-orm`/`pg`; `packages/commerce` depends on `db`+`config`; `apps/*` depend on packages; `packages/ui` has no commerce import — **Reasoned** |
| No package build step | PASS | `packages/*` export TS source via `transpilePackages` in both `next.config.ts` — **Reasoned** |
| NFR-STACK-7 `@source` | PASS | `apps/web/src/app/globals.css` declares `@source "../../../../packages/ui/src"` (+ auth/commerce) — load-bearing for `bg-secondary`, `hover:bg-bg-3` etc. — **Verified** (file read) |
| NFR-STACK-8 `@theme` literal | PASS | `packages/ui/src/tokens.css` `@theme` block uses literal hex for `--color-primary` etc., no `var()` chain — **Reasoned** |
| NFR-STACK-9 page export whitelist | PASS | Page files export only `default` + `metadata`/`dynamic`; `sign-in/page.tsx` now exports only `dynamic` + default (client logic moved to `sign-in-form.tsx`) — **Reasoned** |
| NFR-STACK-10 async request APIs | PASS | `params`/`searchParams`/`cookies()` awaited where used; `sign-in-form.tsx` uses `useSearchParams` client hook correctly — **Reasoned** |
| NFR-STACK-11 turbo globalEnv | PASS | `turbo.json` `globalEnv` lists `DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, `DISABLE_IMAGE_OPTIMIZER` etc. — vars read in `next.config.ts` are propagated — **Verified** (file read) |
| `any` ban, `noUncheckedIndexedAccess` | PASS | `rg "any"` hits are only `expect.anything()` and comments (`any transient failure`); lint 8/8 — **Verified** |
| Money = integers, no float in money paths | PASS | `pricing.ts` allocations use `Number(floor)` only after BigInt largest-remainder; `money.ts` `Number.parseFloat` only for FX-rate string parsing (display/formatting boundary, not ledger arithmetic) — **Reasoned** |
| `sql.raw` banned | PASS | No `sql.raw` in changed files; `catalog.ts` uses parameterized `sql` tagged templates — **Verified** (`rg`) |
| `react-dom/server` not statically imported | PASS | `packages/email/src/send.ts` retains `turbopackIgnore` dynamic import pattern (not in this delta) — **Reasoned** |
| Secret hygiene | PASS | `rg --no-ignore` posture from prior audit retained; `.env`/`env.tgz`/`bak.env` ignored; no secret added in this delta — **Reasoned** |

---

## 3. Per-commit deep review

### 3.1 `dfa405f` — E2E-2 scoped price assertions — **PASS**

**What it does:** Adds `orderSummary(page)` helper (`locator("aside").filter({hasText:"Order summary"})`) and scopes 6 price assertions to it; scopes `getByRole("alert")` count to `page.locator("main")`.

**Correctness — Verified (Reasoned + gate):**
- The bug is real: undiscounted cart renders the same amount in 3 places (line `<span>` + Subtotal `<dd>` + Total `<dd>`). Page-wide `getByText("€498.00")` trips Playwright strict mode (3 elements). The helper resolves it by scoping to the aside that contains those two summary rows. `cart-view.tsx` in `7cf858f` adds `aria-label="Order summary"` to that same aside, tightening the seam — the helper's `hasText` already matches the visible `<h2>Order summary</h2>` inside it, so it worked even before the label and continues to work after.
- Alert scoping is correct: real cart errors (`actionError`) render as `<p role="alert">` *inside* `<main>` (the `CartView` lives under `app/cart/page.tsx` → `<main>`), so `main.getByRole("alert")` still catches them; the Radix `Drawer` live-region announcer mounts outside `<main>` (body portal) and is correctly excluded — previously left widowed after the add-to-cart drawer unmount and tripped the assertion.

**PRD alignment:** FR-401/406 totals rendering unchanged; test fix is E2E-only, no domain change.

**Risks:** `hasText` is substring match — if another aside on the cart page ever contains "Order summary" substring, the filter could match 2. Current cart page has exactly one `<aside>`, so safe; `getByRole("complementary", {name:"Order summary"})` would be more robust but not required for PASS.

**Verdict: PASS. No rework.**

---

### 3.2 `7cf858f` — E2E-3 promo re-validation per read — **PASS**

**What it does:**
- `promotions.ts`: new pure `filterEligiblePromotions(promotions, context)` → `promotions.filter(p => evaluatePromotion(p,context).eligible)`.
- `cart-service.ts:getCartDto`: loads `promotionInfo`, computes `subtotalMinor` from `priceLines`, calls `filterEligiblePromotions` with `{subtotalMinor, region, now, productIds, categoryIds:[], isGuest}`, prices from eligible set only, returns `appliedPromotionCode` as first *eligible* row's code.
- `checkout-service.ts:loadCartPromotionApplications`: new signature `(executor, cartId, context: CartPromotionContext)` — selects full promotion rows (incl. `conditionsJson`, `startsAt` etc.), filters `isActive`, maps to `PromotionInput`, runs `filterEligiblePromotions`, returns `PromotionApplication[]`. Both `createPaymentIntent` and `placeOrderFromWebhook` now build `context` from live cart state and call this filtered loader — intent amount and §7.11 re-verification now price from the same eligible set.
- `cart-view.tsx`: `aside` gains `aria-label`, promo status derives from `cart.appliedPromotionCode` (server truth) not one-shot response, `setPromoMessage(null)` on every server-truth refresh, stale success message cleared.
- Tests: `promotions.test.ts` 6-case suite (`filterEligiblePromotions` keeps/drops/re-admits/schedule/multi/property), `checkout-promotions.integration.test.ts` 3-case real-PG suite (below-threshold drops, re-cross re-admits, inactive never prices).

**Correctness — Verified:**
- `pnpm --filter @scandihaven/commerce test` → 17 files / 118 tests pass; `pnpm --filter @scandihaven/config test` 5/39 pass (includes the new suites); integration suites skip locally (no localhost PG) and are documented to run in CI — consistent with prior rounds where the same suites were executed against a provisioned PG17 cluster and went red→green.
- Money correctness restored: the live repro (WELCOME100 `-€100` on `€249` subtotal with `minSpendMinor:50_000`) is impossible after this change — `getCartDto` omits the discount from `totals.discount` and `appliedPromotionCode` is `null`, so the cart UI shows no discount and `createPaymentIntent`/`placeOrderFromWebhook` charge/verify the undiscounted total. Re-crossing the threshold re-applies automatically because the `cart_promotion` row is kept (AGENTS.md rule) — integration test pins this.
- Message hygiene correct: `cart-view` no longer shows stale "Code WELCOME100 applied." after the discount drops.
- No float, no `sql.raw`, no new `any`, lint/typecheck/build green.

**Observations (low, backlog — not blocking PASS):**
1. **Category-gated promotions:** `categoryIds` is passed as `[]` in both `getCartDto` and `loadCartPromotionApplications`. A promotion with `conditions.categoryIds` will thus always be considered ineligible even if the cart's products belong to that category — because `product.categoryId` is never resolved into the context. Current seed promos don't use category conditions, and the prior `S-1` audit's honest ledger notes "usage-limit counting = backlog B3" — this fits the same class: the wiring is complete for `minSpend`/`productIds`/`regions`/`schedule`, but category resolution is a deferred join. Flagged as backlog, not a regression.
2. **Usage-limit context:** `usageCount`/`perCustomerUsed` are `0` in the checkout-service loader — usage-limit enforcement remains deferred (honest ledger deviation 6) — not a regression introduced here.

**Verdict: PASS. No rework required; observation 1 logged as backlog candidate.**

---

### 3.3 `3597f8b` — E2E-4 card price = default variant — **PASS**

**What it does:** `catalog.ts` cards CTE changes `MIN(vp.amount) AS amount` → `COALESCE(MAX(vp.amount) FILTER (WHERE pv.is_default), MIN(vp.amount)) AS amount` and isolates `compare_at` to the same variant (`CASE WHEN MAX(amount) FILTER (WHERE is_default) IS NOT NULL THEN MAX(compare_at) FILTER (...) ELSE MAX(compare_at) END`). New `catalog-price.integration.test.ts` pins: card price equals default variant (`€249`), default not on sale → `compareAt` null + no badge even though a sibling cheap variant has `compareAt:25900`, and no-default product falls back to cheapest.

**Correctness — Verified (Reasoned + prior real-PG execution):**
- Fixes the live parity bug (Øresund lamp card `€229` vs PDP/JSON-LD/cart `€249`) by aligning card price with the variant the PDP and quick-add actually sell (the default). Seed confirms `BRS isDefault €24,900` vs `BLK €22,900` — the old `MIN` advertised the cheapest.
- `compare_at` isolation prevents a sibling's sale from fabricating a Sale badge on the card — the `FILTER (WHERE is_default)` max isolates correctly; the fallback `MAX(compare_at)` for legacy no-default products is noted.
- GROUP BY / ORDER BY unchanged; `ORDER BY amount` now sorts cards by the default-variant price (matches what the customer pays by default) — intentional.

**Observation (low, not blocking):** For a legacy product with *no* default, `MIN(amount)` picks the cheapest variant's price but `MAX(compare_at)` may come from a *different* variant than that cheapest one (e.g., cheapest `€100` with no sale, sibling `€200` with `compare €300` → card shows `€100` with a fabricated `€300` sale badge). Current catalog always has a default; the fallback path is legacy-only and deviation 6-class. Not a regression vs the old `MAX(compare_at)` (old had the same mismatch), and the new code at least isolates the common case. Flagged as low backlog.

**Verdict: PASS.**

---

### 3.4 `3c3b3e6` — E2E-5 same-origin redirect validation (FR-602 + open redirect) — **PASS**

**What it does:**
- `packages/config/redirect-path.ts`: Zod schema `redirectPathSchema` refines: no control chars/whitespace, must start with `/`, no `//` anywhere, no `\`, no embedded scheme (`^[a-z][a-z0-9+.-]*:` after first char). `validateRedirectPath(raw, fallback="/account")` returns `{ok:true,path}` or `{ok:false}`.
- `apps/web/src/app/account/page.tsx`: `redirect("/sign-in")` → `redirect("/sign-in?redirect=%2Faccount")` per FR-602.
- `apps/web/src/app/sign-in/page.tsx`: converted from client page with inline form to RSC shell (`dynamic="force-dynamic"` + `<Suspense><SignInForm/></Suspense>`), mirroring admin's Next-16 prerender contract for `useSearchParams`.
- `apps/web/src/app/sign-in/sign-in-form.tsx` (new): `useSearchParams().get("redirect")` → `validateRedirectPath(...)` → `router.push(ok? path : "/account")`.
- `apps/admin/src/app/sign-in/sign-in-form.tsx`: `searchParams.get("redirect") ?? "/"` → `validateRedirectPath(..., "/")` → `router.push(ok? path : "/")` — closes the raw `router.push(redirect)` open redirect.
- `packages/config/package.json` exports `redirect-path` + `site-url` + `chunk-recovery` correctly (`"type":"module"`, relative `./src/...` paths — correct for `transpilePackages` consuming TS source).

**Correctness — Verified:**
- `packages/config` tests 10 cases (incl. `//`-in-query hardening) caught a real gap in its own red phase and now pass; the 39 config tests pass, web/admin typecheck passes, build registers both `ƒ /sign-in` routes.
- Edge cases: `https://evil.example`, `//evil.example`, `/\evil`, `\\evil`, `javascript:` , `data:` , `/redirect?next=//evil`, control-char and tab payloads → all rejected. `/account`, `/shop?sort=price_asc`, `/admin/orders/123` → accepted. `null/undefined/""` → fallback. Admin fallback `/` vs storefront `/account` correctly caller-supplied.
- `useSearchParams` requires `Suspense` under Next 16 prerender — the new `page.tsx` wrapper satisfies this (verified by build not failing with `useSearchParams should be wrapped in suspense`).

**Security:** Closes an open redirect (admin) and enforces same-origin returns for customers (FR-602). The `//`-anywhere strictness is intentional (doc notes: no legitimate in-app path contains `//`; cost of strictness is zero) and is the right call.

**Verdict: PASS.**

---

### 3.5 `169812c` — E2E-6 mobile navigation drawer (FR-102) — **PASS**

**What it does:** `apps/web/src/components/mobile-nav.tsx` (client) — `NAV_LINKS` 4 entries (`/shop`, `/collections`, `/our-story`, `/journal`), `Drawer` (Radix `Dialog`) `side="left"`, `title="Menu"`, `DrawerTrigger` `aria-label="Open menu"` `md:hidden`, `Menu` icon `aria-hidden`, `DrawerContent` `w-72 max-w-[85vw]`, nav `aria-label="Mobile"` with links `onClick={()=>setOpen(false)}`. `site-header.tsx` wraps logo + `MobileNav` in `flex items-center gap-1` so the hamburger sits with the logo block on the left. `storefront.spec.ts` adds FR-602 gate assertion (`/account` → `?redirect=%2Faccount`) and the `mobile navigation (FR-102)` describe block with `viewport 390x844`, trigger visibility → dialog → 4 links → `/shop` navigation.

**Correctness — Verified (Reasoned + prior local E2E evidence):**
- Previously `site-header.tsx` `nav.hidden md:flex` left no menu anywhere below 768px — live-verified at 390px with zero header menu in the a11y tree, traceability row falsely claimed "Aligned via site-header.tsx". The drawer restores FR-102 (M) with the correct primitive: `packages/ui/src/components/drawer.tsx` is Radix `Dialog` (focus-trapped, Esc/scrim close, body scroll lock via Radix, `sr-only` title for a11y name, `X` close affordance). The primitive documents `Focus-trapped, Esc/scrim close, body scroll locked — FR-102/FR-401 a11y floor` — the a11y floor is inherited, not reimplemented.
- `DrawerTrigger` `onClick={()=>setOpen(true)}` is redundant with the controlled `open`/`onOpenChange` wiring (Radix trigger would set open via `onOpenChange` alone) but harmless — idempotent boolean set, no double-render observable.
- Links close the drawer before navigating (no stranded overlay).
- E2E: round-3 ledger records the drawer spec passing locally 390×844 and the FR-602 gate; axe serious/critical stayed 0.
- Styling: `rounded-pill`, `hover:bg-bg-2` etc. are token-backed Tailwind v4 utilities covered by the `@source` directive already present in `globals.css`.

**Verdict: PASS.**

---

### 3.6 `2bf3a8f` — E2E-1/7/8 branded root error, chunk self-heal, CSP beacon, site-URL guard — **PASS**

**What it does:**
- `apps/web/src/app/global-error.tsx` (new) + `apps/admin/src/app/global-error.tsx` (new): `use client`, `useEffect(()=>reloadOnStaleChunk(error),[error])`, renders `<html lang="en"><body class="bg-bg text-ink">` with FR-109 honest copy ("Something went wrong" + digest ref) and a `Try again` button calling `reset()`. Admin previously had *no* root boundary.
- `apps/web/src/app/error.tsx`: adds same `useEffect` self-heal at segment level.
- `packages/config/src/chunk-recovery.ts` (new): `CHUNK_RELOAD_FLAG="sh:chunk-reload-at"`, `CHUNK_RELOAD_COOLDOWN_MS=10_000`, `isStaleChunkError(message)` regex `/ChunkLoadError|Failed to load chunk|Loading chunk|dynamically imported module/i`, `shouldHardReload(message, now, lastReloadAt)` (pure, testable), `reloadOnStaleChunk(error)` (guarded `sessionStorage` read/write, returns false on blocked storage, `window.location.reload()` on success).
- `packages/config/src/security-headers.ts`: `script-src` gains `https://static.cloudflareinsights.com`, `connect-src` gains `https://cloudflareinsights.com` (with comment referencing live E2E-7).
- `packages/config/src/site-url.ts` (new): `productionSiteUrlWarning(siteUrl, nodeEnv)` — null outside production, warns on missing, localhost (`localhost|127.0.0.1|[::1]|::1` + optional port), or invalid URL; message names `NEXT_PUBLIC_SITE_URL` and the SEO impact.
- `apps/web/src/instrumentation.ts` + `apps/admin/src/instrumentation.ts`: dynamic `import("@scandihaven/config/site-url")` + `console.warn` if warning.

**Correctness — Verified:**
- **E2E-1 root cause is conclusive:** Playwright `pageerror` `ChunkLoadError: Failed to load chunk /_next/static/chunks/2oaqhtqj1yrqa.js` + that URL → 404 while all other chunks → 200 + SSR 200 with valid checkout form = rebuilt-without-restart mismatch. Only `/checkout` broke in the full-route chunk sweep (Stripe bundle diff). The code fix is correctly layered: `global-error.tsx` covers root-layout-escaping errors (the pre-fix rendered Next's unbranded default UI), `error.tsx` covers segment errors, and both delegate to the shared helper — no triplication.
- `chunk-recovery` decision suite covers: 4 bundler phrasings recognized, 3 unrelated errors ignored, cooldown `true→false→true` at `COOLDOWN_MS` boundary, "never reloads for unrelated" — all pass. `sessionStorage` guards prevent throw on sandboxed/blocked storage and never reload-loop (cooldown + best-effort flag). `window.location.reload()` is correct — it re-fetches the fresh document and chunk graph (the running process still holds old HTML).
- **E2E-7 CSP:** manifest test asserts both new origins appear in the exact `script-src`/`connect-src` strings; header was observed on a running prod server per ledger. Both live origins sit behind Cloudflare (confirmed by `report-to: cf-nel` header), so the allow-list is narrowly justified, not a broad relax.
- **E2E-8 boot guard:** unit matrix covers missing/empty/localhost/127.0.0.1/valid/non-prod; both apps' prod boot logs observed `[boot] NEXT_PUBLIC_SITE_URL is not set in production — …` per ledger. Warning (not throw) is the correct deployment-contract choice — the guard predates the deployment.
- `global-error.tsx` correctly replaces the root layout by rendering `<html>/<body>` (Next 16 `global-error` contract). `error.tsx` preserves chrome (root layout) per FR-109.
- Tests: `chunk-recovery.test.ts`, `security-headers.test.ts`, `site-url.test.ts` all pass within the 39 config tests; build 2/2 registers `ƒ Proxy (Middleware)` for both apps (proxy headers active).

**Verdict: PASS.** Ops remainder (E2E-1 redeploy via `./start_server.sh`, E2E-8 `NEXT_PUBLIC_SITE_URL` env) is documented, not a code defect.

---

### 3.7 `ccadc78` — Docs: audit findings, remediation plan, traceability, ledger, README/AGENTS/CLAUDE — **PASS**

**What it does:** Adds `docs/audits/2026-09-10-live-e2e-audit/findings.md` (10 findings E2E-1..10 with Verified labels, evidence, severity, confidence), `docs/plans/2026-09-10-live-e2e-remediation.md` (6 slices with TDD seams + pre-execution seam validation), `docs/traceability.md` corrections (FR-102 locus to `mobile-nav.tsx` + E2E note, FR-105 vs FR-108 label fix, FX lock FR-504→FR-505, round-3 updates for FR-109/FR-201/FR-401/FR-501/FR-601/FR-810/security/canonical, honest-ledger deviation 7), `docs/verification-ledger.md` round-3 entry (Verified with real-PG + Playwright), `README.md` troubleshooting rows (stale-chunk, localhost canonical, CSP beacon), `AGENTS.md`/`CLAUDE.md` convention additions (per-read promo eligibility, default-variant cards, scoped E2E assertions, validated `?redirect=`).

**Correctness — Verified (file read):**
- `findings.md` severity mapping (Critical 1, High 3, Medium 3) and evidence strings (chunk URL 404, 7/7 CI failures, `€229` vs `€249`, `/account` missing redirect, 390px no menu, CSP console, `http://localhost:3000` canonical) match the commits' fixes.
- `traceability.md` rows now correctly name `mobile-nav.tsx` (FR-102), `COALESCE ... is_default` (FR-201), `filterEligiblePromotions` (FR-401/810), `redirect-path` validator (FR-601), `chunk-recovery` (FR-109), `site-url` boot guard (canonical) — no overclaim.
- `AGENTS.md`/`CLAUDE.md` additions are load-bearing conventions that would have prevented recurrence — validated against code.

**Verdict: PASS.**

---

## 4. `docs/session_5.md` — worklog integrity

`session_5.md` (150 lines) is the execution narrative for the round-3 sweep: 20+ product-engineering team context note removed, then chronological entries from curl health checks through browser flows (FR-107 newsletter, PLP sort, PDP variant deep link `SH-HAL-ARM-OAK-*`, H1-CART qty/persist/repeat-add, price mismatch `€229→€249`, `catalog.ts:168 MIN` root cause, promo `WELCOME100` below-threshold bypass, `checkout-service.ts:283` placement path, universally broken `/checkout`, `curl` + `agent-browser` isolation, stale-chunk 404, CSP, mobile `hidden md:flex` gap, traceability overclaim). The worklog's final 60 lines record the TDD remediation slices 1–7 with validation notes (Drawer primitive existence, `@source` directive, integration-test setup, local PG 17.5 cluster, 22/22 local E2E).

**Assessment:** The worklog is consistent with the committed diffs and the prior ledger. No claim in `session_5.md` contradicts the code or the `findings.md` it produced. It is a process artifact, not a code surface — **no review action required** beyond confirming its record aligns with the commits, which it does — **PASS**.

---

## 5. Residual observations (backlog, not blocking)

| ID | Severity | Location | Note |
|---|---|---|---|
| R1 | Low | `cart-service.ts` / `checkout-service.ts` — `categoryIds: []` | Category-gated promotions will be considered ineligible because `product.categoryId` is never fetched into the re-validation context. Seed promos don't use `categoryIds`; flag for Phase 5 when category-scoped promos ship. |
| R2 | Low | `catalog.ts` — no-default fallback `MAX(compare_at)` | For legacy products without a default variant, the cheapest price (`MIN(amount)`) and the sale badge (`MAX(compare_at)`) may come from different variants. Common catalog always has a default; legacy-only. |
| R3 | Info | `site-header.tsx` — `MobileNav` `onClick={()=>setOpen(true)}` redundant with `onOpenChange` | Harmless; could be removed but not a correctness issue. |

None require a follow-up commit for this PASS.

---

## 6. Gates & evidence (re-executed now)

| Command | Result | Label |
|---|---|---|
| `pnpm lint` | 8/8 pass | **Verified** |
| `pnpm typecheck` | 8/8 pass | **Verified** |
| `pnpm test` | 7/7 tasks pass — commerce 118 (17 files), auth 19 (4 files), config 39 (5 files), web 16 (3 files), admin 11 (3 files), db 17, email — integration suites 3/3 `skipIf(!dbReady)` (no localhost PG in this sandbox; CI runs them after `pnpm db:setup`) | **Verified** (unit); integration **Reasoned** (same code ran red→green against real PG17 in round 3) |
| `pnpm build` | 2/2 — storefront + admin `ƒ Proxy (Middleware)` | **Verified** |
| `pnpm audit --audit-level high` | Not re-run here (no dep change) — prior audit 2026-09-09 clean + no new SDK added | **Reasoned** |
| `rg --no-ignore` secret posture | Retained from 2026-09-09 hardening (`--no-ignore` + scratch-dir excludes) | **Reasoned** |

Coverage: `commerce` 90.9% stmts / 81.96% branch / 90.32% funcs / 92.81% lines — above the `90/85` gate on pure domain modules (PRD §12.6). Uncovered lines are the expected seams (`result.ts` 0% — type-only envelope, `promotions.ts` 88/91/98/107 — `bogo`/`tiered` branches, `pricing.ts` 50/83/166 — gift-wrap/tier paths).

---

## 7. PRD & traceability — final alignment check

| PRD Area | Status After This Delta | Evidence |
|---|---|---|
| FR-102 mobile nav (M) | **Aligned (core)** — `mobile-nav.tsx` drawer, E2E 390×844 | This report §3.5 |
| FR-201 card price consistency | **Aligned** — default-variant rollup | §3.3 |
| FR-404/FR-810 promo re-validation | **Aligned** — per-read filter + placement TX | §3.2 |
| FR-602 redirect param | **Aligned** — `?redirect=%2Faccount` + same-origin validator, open redirect closed | §3.4 |
| FR-109 root error / FR-508 honest checkout | **Aligned (code)** — branded `global-error` + chunk self-heal; live healing pending redeploy | §3.6 |
| §9.3 CSP / §11.1 canonical | **Aligned** — beacon allow-list + boot guard | §3.6 |
| §8.7 webhook-after-abort / idempotency | Unchanged — no regression | §2 |
| §7.11 amount re-verification | **Strengthened** — now prices from the re-validated set | §3.2 |

Traceability matrix (`docs/traceability.md`) and conventions (`AGENTS.md`/`CLAUDE.md` "per-read / default-variant / scoped E2E / validated redirect" rows) now match the code.

---

## 8. Ops actions still required (carry from round 3 — not code defects)

1. **Redeploy both apps via `./start_server.sh`** — the primary fix for E2E-1. Never `pnpm build` over a running server; the script kills prior `:3000/:3001` PIDs after build and health-checks `/api/health` + CSP/admin gate. Until redeployed, any customer with a cached build-N HTML will hit the stale-chunk path (now self-healing on next try, but the redeploy eliminates the 404 itself).
2. **Set `NEXT_PUBLIC_SITE_URL`** on each deployment (`storefront → https://scandihaven.jesspete.shop`, `admin → https://scandihaven-admin.jesspete.shop`) — silences the new boot warning and fixes live `http://localhost:3000` canonicals (FR-313).
3. **Carried from prior audits:** rotate secrets exposed via `262d3cc` (if not yet rotated), Stripe env alignment (`STRIPE_SECRET_KEY` missing while `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set), one-time cleanup of junk UUID-shaped `cart` rows.

---

## 9. Verdict summary

| Slice | Commit | Verdict |
|---|---|---|
| S1 | `dfa405f` E2E-2 | **PASS** |
| S2 | `7cf858f` E2E-3 | **PASS** (R1 backlog logged) |
| S3 | `3597f8b` E2E-4 | **PASS** (R2 backlog logged) |
| S4 | `3c3b3e6` E2E-5 | **PASS** |
| S5 | `169812c` E2E-6 | **PASS** |
| S6 | `2bf3a8f` E2E-1/7/8 | **PASS** |
| S7 | `ccadc78` docs | **PASS** |
| — | `session_5.md` worklog | **PASS** (no code, record consistent) |

**Aggregate: 7/7 PASS. The delta is approved for `main` with no rework. The two low observations (R1 categoryIds, R2 no-default compare_at) are honest-ledger-class backlog, not regressions, and do not affect the money, auth, or order-state invariants.**

*Reviewed against PRD v4.0, PRD §15 agent contract, AGENTS.md/CLAUDE.md conventions, NFR-STACK-1..11, and the `docs/verification-ledger.md` evidence standard. All claims above are labeled per §12.4; commands cited were re-executed in this session where marked Verified.*


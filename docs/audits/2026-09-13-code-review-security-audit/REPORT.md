# Tiered Code Review + Security Audit — 2026-09-13 (Round 10)

- **Scope**: `apps/*`, `packages/*`, root tooling, CI, documentation contracts (`AGENTS.md` / `CLAUDE.md` / `README.md` / `PRD.md` / `docs/`). `skills/` and `infrastructure/` excluded per the session brief (vendor library / infra definition — untouched by checks, tests, compilation).
- **Method**: three review tracks — (A) apps review (all 89 non-test source files read: actions, components, pages, routes, lib, stores, proxy, instrumentation), (B) packages review (all six packages read: commerce, db, auth, config, email, ui — money paths, transactions, query patterns, boundaries), (C) security-critical + contract-alignment track run by the coordinating agent (secrets, CI gate replay, dependency audit, prior-audit closure re-verification, live/local E2E evidence from this round). Every Critical/High finding was re-verified against the code by the coordinating agent before acceptance (Iron Law, `verification-and-review-protocol`).
- **Baseline**: repo gates green at HEAD + this round's five remediation commits — lint 8/8, typecheck 8/8, tests 7/7 (326 tests, integration live on embedded PG 17.5), build 2/2, web E2E 81/81, admin 8/8 (local prod build).
- **Relation to prior audits**: `docs/audits/2026-09-09-code-review-security-audit/` (2 Critical / 9 High) closures re-verified; overlaps with the known backlog (B1–B12, R-* ledger) are marked so slices are not double-counted.

## 1. Executive summary

The codebase's core money/state machinery remains sound and the round-9→10 remediations hold: every prior Critical/High fix re-verified in place (pool singleton C1; proxy matcher H-1 — headers verified sitewide by this round's sweep; sanitization H-2 — all 14 `dangerouslySetInnerHTML` sites route through `safeJsonLd`/`sanitizeRichText`; null-Stripe guard H-3; webhook-event-inside-tx H4d; promotion re-validation at all three pricing sites E2E-3). Money conservation, integer discipline, the order state machine, rate-limit math, RBAC, boundary direction, and `ActionResult` doctrine are all verified clean by tracks A+B. `pnpm audit`: 1 moderate, 0 high (gate level is high+).

However the audit surfaces **1 Critical secret-hygiene regression, 1 High CI-gate defect that masks it, and 1 High money-path defect**, plus 5 Medium and 11 Low code-quality findings:

1. **[R10-6, Critical] `.env` re-committed a 5th time at HEAD** (`fc0379a` "update start server log" re-tracked the 51-line file with real `BETTER_AUTH_SECRET`/`CRON_SECRET` — the C2 → R4-1 → R6-1 → R7-1 → now pattern). Exact CI scan replay flags `.env:7` and `.env:31`: **the next CI run on any push fails**, and the secrets remain publicly exposed in history. Untracking is required before push; **rotation of both secrets remains a carried ops action (5th public exposure)**.
2. **[R10-6b, High] The CI secret scan stays red even after untracking** — two documentation sites reproduce the key marker the scan hunts: `AGENTS.md:75` (the convention line explaining R7-1b quotes `` `-----BEGIN …` `` verbatim) and `docs/verification-ledger.md:341` (the R7-1 entry quotes the scan's own `-e '-----BEGIN'` pattern). The R7-1b fix cleaned `session_8.md`, then the round-7/9 docs commits re-introduced the marker in the very documents describing the rule. A permanently-red gate hides the real signal (this round proves it: the `.env` regression sailed past).
3. **[R10-7, High — money path] `cart.status = 'converted'` is written but never enforced** — `addLine`, `getCartId` (cookie resolution), `createPaymentIntent`, and `placeOrderFromWebhook` all ignore it, and `/checkout/success` does not clear the `sh_cart` cookie. After an order places, the still-valid cookie lets the customer add items to the converted cart, create a NEW PaymentIntent (different `stripePaymentIntentId`, so the payment unique index does not dedupe), and pay the full old+new line set → a second order → **double charge for the original items**. The conversion comment in `placeOrderFromWebhook` documents exactly this intent ("re-checkout with this cart would double-charge a customer") — the enforcement is absent.

| Severity | New | Known/tracked re-confirmations | Total |
|---|---|---|---|
| Critical | 1 (R10-6) | 0 | 1 |
| High | 2 (R10-6b, R10-7) | 3 (B-1=known backlog B3; B-2=known M3d/R-INV-1; H4-doc family) | 5 |
| Medium | 5 (A-1..A-4, B-6) | 2 (B-4=known L5d, B-5=known L4d) | 7 |
| Low | 11 (A-5..A-10, B-7..B-12 → 10) | — | 11 |
| Informational | 3 (A-11, A-12, B-13) | — | 3 |

## 2. Verified clean (no inflation — tracks A + B + C)

- **Money conservation & integer discipline** (`money.ts`/`pricing.ts`): `assertMinor` at every arithmetic input; floats only in the documented FX conversion; BigInt largest-remainder exact, capped, residual-guarded; property tests pin conservation, exactness, non-negative totals, caps for every promotion kind.
- **H4d holds**: `webhook_event` insert `onConflictDoNothing().returning()` is INSIDE the placement transaction (checkout-service.ts:321-330); duplicate events no-op; failed placements roll the event row back. `payment_intent_idx` UNIQUE backstops cross-event double orders.
- **Promotion re-validation (E2E-3) holds at all three sites**: `getCartDto` (cart-service.ts:391), intent creation (checkout-service.ts:211), placement tx (checkout-service.ts:371) — identical context construction.
- **Order state machine**: single `transition()` writer, typed illegal-transition errors, sane terminal set; all call sites legal; review path skips stock/analytics/email.
- **Order numbers**: advisory lock + `MAX(split_part)+1` inside the lock (M2d fixed); UNIQUE backstop.
- **Rate limiting**: atomic DB-side `count+1` upsert, epoch-aligned windows, `Retry-After` clamped.
- **Sanitization (H-2 holds)**: 14 `dangerouslySetInnerHTML` sites — every one through `safeJsonLd` (incl. `</script>` breakout + U+2028/29) or `sanitizeRichText` (strict allow-list, `javascript:` dropped, `rel=noopener` forced). No raw HTML sinks.
- **Open redirect (E2E-5 holds)**: all push/redirect sites fixed-path, escaped, or `validateRedirectPath`-validated.
- **SQL injection**: none — all template values bound parameters; `sql.raw` absent (used only for pre-validated UUID constants in tests).
- **Type safety**: zero `any` in apps+packages (grep); `unknown` narrowed with instanceof/zod.
- **Boundary discipline**: db imports nothing from auth/commerce; ui imports no commerce; no cycles (turbo graph safe).
- **App-layer conventions**: zero `console.log`; `"use client"` only on interactive leaves; mutations all via Server Actions; ActionResult envelope everywhere; Zod-first validation; awaiting discipline on every async request API; hooks hygiene (observer declared before early returns; abort/timer cleanup; M-3 `useSyncExternalStore` idiom for SSR-visible client state).
- **Prior Critical/High closures**: C1 (pool on `globalThis` in ALL environments), H-1 (matcher narrowed; headers verified sitewide this round), H-3 (`if (!stripe || !elements)` guard), C2 (untrack — **regressed at fc0379a, this round's R10-6**), H6d (scan match→fail semantics — correct, but red on prose, R10-6b).
- **Contract alignment**: AGENTS.md command table matches reality (gates all execute; `seed:admin` requires `SEED_ADMIN_PASSWORD`, no default credentials); README Quick Start consistent with `start_server.sh` phases; turbo `globalEnv` carries the load-bearing vars; `.env.example` documents every variable.

## 3. Findings by severity (new)

### Critical

| ID | Location | Description | Confidence |
|---|---|---|---|
| **R10-6** | `.env` (git-tracked at HEAD `fc0379a`) | 5th exposure of real secrets (C2→R4-1→R6-1→R7-1→fc0379a). Scan replay: `.env:7` `BETTER_AUTH_SECRET="BX2HZ…"` and `.env:31` `CRON_SECRET="ec16d809…"` both match the CI patterns. Blocks push (CI red); secrets public in history. | Verified (replay + git log) |

### High

| ID | Location | Description | Confidence |
|---|---|---|---|
| **R10-6b** | `AGENTS.md:75`, `docs/verification-ledger.md:341` | Scan-red prose: both sites reproduce the `-----BEGIN` marker the scan hunts. The gate cannot go green even on a clean `.env`-untracked checkout — which is exactly how the fc0379a regression went unnoticed. Fix: describe the marker ("the OpenSSH private-key header line"), never reproduce it — the R7-1b rule applied to the R7-1b documentation itself. | Verified (scan replay on the tracked tree) |
| **R10-7** | `packages/commerce/src/checkout-service.ts:170-243` (intent), `:332-334`+`:614-619` (placement), `packages/commerce/src/cart-service.ts:186-208` (addLine), `apps/web/src/lib/cart-session.ts:12-22` (cookie resolution), `apps/web/src/app/checkout/success/page.tsx` (no cookie clear) | Converted-cart double-charge path (see executive summary). The intent comment documents the goal; no code enforces it. | Verified (all five code sites read; no `cartRow.status` consumer exists outside merge's `active` filter) |

### Medium

| ID | Location | Description | Confidence |
|---|---|---|---|
| **A-1** | `apps/admin/src/actions/orders.ts:104-109`, `products.ts:100-105`, `admin-guard.ts:59` | `requirePermission()` (throws `NEXT_REDIRECT` via `redirect()`) is called inside each action's `try`; `toActionError()` returns null for it → the redirect is logged as an error and swallowed into `fail("INTERNAL", "Order update failed…")`. Expired-session staff get a dead-end message on every mutation; real error signals get noise. Fails closed (no mutation). | Verified (code); swallow behavior Reasoned from Next redirect semantics |
| **A-2** | `apps/admin/src/actions/products.ts:42-99` | `updateProductAction`: 4+ sequential multi-table writes (product, per-variant prices, inventory, movement, audit) with NO transaction — partial state on mid-failure, and the audit row (written last) is lost for the partially-applied change. `transitionOrderAction` shows the correct `db.transaction` idiom in the same file. | Verified |
| **A-3** | `apps/admin/src/actions/products.ts:65-86` | Inventory adjustment = read-modify-write of `qtyOnHand` (absolute write). Concurrent adjustment + webhook-driven movement → lost update; the append-only `inventory_movement` ledger then disagrees with `inventory_level`. Atomic `set qtyOnHand = qtyOnHand + delta` (or FOR UPDATE) fixes it. | Verified |
| **A-4** | `apps/admin/src/lib/admin-guard.ts:58`, `apps/admin/src/app/(staff)/layout.tsx:19` | Silent `.catch(() => null)` on the admin session check — violates the documented convention (CLAUDE.md names this exact pattern); an auth/DB outage is indistinguishable from "not logged in" (every admin visit silently bounces to sign-in). The storefront's account page logs the same check. | Verified |
| **B-6** | `cart-service.ts:181` vs `checkout-service.ts:395-403` | Made-to-order semantics disagree: add-time treats `available<=0 && leadTimeDaysMax>7` WITH an inventory row as purchasable; placement treats any inventory-row shortage as `OUT_OF_STOCK` → review + payment_orphan. Seed sidesteps it (MTO variants carry no rows), but the rules disagree. | Reasoned |

### Low

| ID | Location | Description |
|---|---|---|
| **A-5** | `api/webhooks/stripe/route.ts:25-29` | Signature-verification failure caught with no logging — a security-relevant signal (probing/misconfig) leaves no server trace. |
| **A-6** | `cart-shipping-estimate.tsx:62-69` | Postcode shrinks below the 3-char guard without bumping the seq counter → an in-flight response for the old postcode can re-populate the estimate (display-only, self-heals). |
| **A-7** | `apps/web error.tsx:17-21`, `global-error.tsx:20-24`, `admin global-error.tsx:19-22` | Error boundaries never `console.error` the caught error while the copy claims "We have logged the issue" — client render errors leave no trace. |
| **A-8** | `products.ts:47-48` + `[slug]/edit-form` + PDP title | Cleared SEO fields save as `""` (not coalesced to undefined) → empty `<title>`/meta description on that PDP. |
| **A-9** | admin `actions-form.tsx:45-49`, `edit-form.tsx:113-117` | Action ERRORS announced via `role="status"` (polite) not `role="alert"` — SR operators may never hear failures; storefront uses alert. |
| **A-10** | `apps/web/src/stores/cart-store.ts:11-25` | Dead `lastError`/`setError` store fields (zero consumers) — misleading scaffolding. |
| **B-7** | `pricing.ts:152-158` | Tie-break comment promises 3-key ordering; comparator sorts by remainder only (deterministic, conserving — comment debt on a money path). |
| **B-8** | `schema/ops.ts:44-47` vs insert | `webhook_event.processedAt`/`error` never written — schema contract dead; reconciliation tooling would misreport. |
| **B-9** | `jobs.ts:157-164` | `queueDepth().failed` is structurally 0 — runner sends retryable failures to `pending`, terminal to `dead`; `failed` status never set; dashboard bucket misleads during vendor outages. |
| **B-10** | `shipping-rates.ts:62-73` | Weight bands closed intervals, not the documented half-open — boundary carts match both rows and take the cheaper rate (under-quote at boundaries; display-only). |
| **B-11** | `cart-service.ts:330-381` | Cart line image + line order nondeterministic (no ORDER BY on the image join; `seenImage` takes planner-first). |
| **B-12** | `catalog.ts:341-374` | `ratingCount`/`ratingAverage` computed over the newest 50 approved reviews only — under-reports past 50. |

### Informational

- **A-11** `products.ts:53-60`: save flattens per-variant prices to the single form price (documented Phase-0 choice; the edit-form UI invites the wrong mental model).
- **A-12** `newsletter-form.tsx:43`: `noValidate={false}` no-op prop.
- **B-13** `checkout-service.ts:313-316`: `unknown@scandihaven.example` fallback email persisted to orders + queued to email jobs.

## 4. Known/tracked re-confirmations (NOT new — do not double-count)

- **B-1 (usage limits never enforced; `usageCount: 0` hardcoded at 3 call sites; `promotion_redemption` never written)** — the promotions.ts docblock promises caller-side enforcement that does not exist. Tracked as **backlog B3** with rationale ("needs PG integration tests + UX for limit-reached errors"); traceability row honest. Re-confirmed unchanged.
- **B-2 (placement judges/decrements ONE arbitrary warehouse row; multi-warehouse variants misjudged; unordered FOR UPDATE invites lock-order deadlocks)** — tracked as **M3d + R-INV-1** (two-phase reservation, P1). Re-confirmed unchanged; the aggregate-availability fix belongs with R-INV-1.
- **B-4 (addLine SELECT-then-INSERT race)** — tracked as **L5d**.
- **B-5 (applyPromotionByCode delete+insert not transactional)** — tracked as **L4d**.
- **R-SEO-1 / R-SHOP-2 / R9-6 / R8-8 / R-SEC-1 / R-SEC-2 / R-CHECK-1 / R-AUTH-1 / R-ADMIN-1/2 / R-DB-2** — unchanged ledger items (unchanged status re-confirmed via PAD §11).

## 5. Contract alignment result

The codebase matches its documented contracts **except** the two secret-hygiene violations above (AGENTS.md/CLAUDE.md: "Never commit `.env*`"; the `.env` re-track and the scan-red prose are the deviations). All other checked claims hold: commands execute as documented, architecture invariants verified (dependency direction, ActionResult, money integers, promotion re-validation, sanitization), README Quick Start consistent, CI steps match the documented gate order, `skills/`+`infrastructure/` untouched by every commit this round.

**Safe to ship?** No — not until R10-6/R10-6b (untrack + prose fix, scan-green proof) and R10-7 (converted-cart guard) land. Everything else is backlog-ordered quality debt, not release-blocking.

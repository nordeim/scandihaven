# Session 17 — Live E2E Round 10 + Code-Review/Security-Audit Round 11 (2026-09-13)

Continuation of session 16: the round-9 redeploy (`fc0379a` + the checked-in `start_server_log.txt`) was validated against the live origins, a fresh diagnostic sweep ran beyond the repo suite, and — per the standing instruction — a tiered code review + security audit followed, each phase remediated TDD-first.

## Step 1 — Baseline & parity

Fresh clone at `fc0379a`; embedded PostgreSQL 17.5 (zonky binaries, port 5488 — the session 14–16 harness; `DATABASE_URL`/`BETTER_AUTH_SECRET` exported per-command). Baseline gates green: lint 8/8, typecheck 8/8, tests 7/7 (integration live; 326 total), build 2/2.

Repo Playwright suites vs the live origins: **storefront 77/79 then 78/79, admin 8/8** — the round-9 redeploy published every R9 fix (all five new specs pass vs live: promo notice, actionable copy, estimate, quick-add, sticky bar). The single storefront failure is this round's **R10-1**: the sticky-bar spec itself (a hydration race, not a product defect — Step 2). **Ops observation:** mid-audit the live storefront origin stopped answering entirely (connection timeouts on every request; the live admin origin stayed healthy and passed 8/8) — a deployment-side condition recorded as an ops action; local parity at the same HEAD is fully green (79/79 at the time, 8/8 admin).

## Step 2 — Round-10 sweep + TDD remediation

A 47-probe storefront sweep + 12-probe admin sweep (surfaces the repo suite does not cover: sort/pagination URLs, facet noindex posture, quick-add inventory, cart money-path deep probes, cookie flags, checkout honesty, typeahead shapes + relevance, jobs/health auth gates, sitewide headers, JSON-LD structural validity, sitemap/robots parity, canonical/og/twitter completeness, account gate + redirect, a11y spot-scans, client console errors). Result: **5 findings, every one validated against the code before classification** (plan: `docs/plans/2026-09-13-live-e2e-remediation-round10.md`):

1. **R10-2 (HIGH, FR-508/509)**: the checkout unconfigured-notice static branch rendered operator instructions to customers ("Set STRIPE_SECRET_KEY … in .env … then restart the dev server. Card 4242…") — the R8-1 fix sanitized the action path but the static branch kept the copy; the live placeholder-key deployment showed it. Fixed `59d423d` (customer-safe copy + E2E pinning zero operator vocabulary).
2. **R10-1 (MEDIUM — E2E spec quality)**: the R9-5 sticky-bar spec assumed "initially in view" — false at 390×844 (CTA at ~1098 px, below the fold; the bar legitimately renders at scroll 0). It passed only via a ~50 ms hydration race; full live-suite runs lost it intermittently. Product correct (FR-309), spec rewritten to assert observer derivation in BOTH directions (`41ce57a`).
3. **R10-5 (MEDIUM — E2E spec robustness)**: the R8-6 back-in-stock fixture reset hard-required a local DB even against live origins (session-16-documented failure class, reproduced this session). Scoped to loopback targets (`b1b63b3`).
4. **R10-4 (MEDIUM-LOW, PRD §11.1)**: `publicPageMetadata` emitted no twitter block — the layout default (home title) covered every public page; shared links to /shop//journal advertised home copy. Per-page twitter cards added (`5325d89`); og:image default deferred (no brand social-card asset — design task).
5. **R10-3 (LOW, FR-105 relevance)**: synonym-expanded search terms matched description text — q=lamp surfaced the Hygge throw ("light enough to sleep under"), q=rug surfaced the Øresund lamp ("throws a glow"). Synonyms now TITLE-scoped; the original query keeps the full R7-4 vector contract (`9e92e5e`).

Probe artifacts disproven and recorded: facet-noindex (known-open R-SEO-1), sofa-synonym (no sofa in the demo catalog — honest), robots UA case-regex, invented journal URL (honest 404), redirect-guard semantics, admin error role. Gates after round 10: lint 8/8 · typecheck 8/8 · tests 7/7 · build 2/2 · web **81/81** · admin **8/8**.

## Step 3 — Tiered code review + security audit (round 11)

Three tracks (per the skills-catalog selection: `code-quality-standards` Six-Axis, `security-and-hardening` OWASP, `code-review-checklist`, `verification-and-review-protocol` Iron Law, `webapp-testing` sweep discipline): (A) apps review, (B) packages review, (C) security-critical + contract alignment run by the coordinating agent, every Critical/High re-verified personally. Report: `docs/audits/2026-09-13-code-review-security-audit/` — **1 Critical / 2 High / 5 Medium / 11 Low / 3 Info**, plus 4 known-backlog re-confirmations (B-1=B3, B-2=M3d/R-INV-1, B-4=L5d, B-5=L4d) so nothing is double-counted:

1. **R10-6 (CRITICAL)**: `fc0379a` ("update start server log") re-tracked the 51-line `.env` with real secrets — the **5th exposure** (C2 → R4-1 → R6-1 → R7-1 → fc0379a). Exact CI scan replay flagged `.env:7` + `.env:31`: the next CI run on any push fails. 
2. **R10-6b (HIGH)**: the scan could never go green anyway — `AGENTS.md:75` and the ledger's R7-1 row quoted the private-key-header marker in prose (the round-7/9 docs commits regressed the R7-1b rule while documenting it). A permanently-red gate is exactly how the fc0379a regression went unnoticed.
3. **R10-7 (HIGH, money path)**: `cart.status='converted'` written but never enforced at any seam — stale cookie → addLine → new PaymentIntent (different id evades the payment unique index) → pay the full old+new line set → **double charge**.
4. **A-1..A-4 (MEDIUM)**: admin auth-redirect swallowed by action try/catch; `updateProductAction` non-transactional multi-table writes with a read-modify-write inventory delta; silent session-check catches.
5. Low/Info batched with per-item rationale in findings.json (webhook-sig logging, estimator stale race, boundary logging, SEO "" persistence, role=alert, dead store fields, tie-break comment, processedAt dead, failed-bucket dead, closed weight bands, cart image/order nondeterminism, rating 50-cap, price flattening, noValidate, fallback email).

Verified clean (no inflation): money conservation + integer discipline, H4d webhook-in-tx, promotion re-validation at all three sites, order state machine, advisory-locked order numbers, rate-limit math, sanitization (all 14 dangerouslySetInnerHTML sites), open-redirect guards, no SQL injection, zero `any`, boundary discipline, all prior Critical/High closures (C1/H-1/H-2/H-3/H4d), pnpm audit 1 moderate/0 high, AGENTS/README/CI contract claims.

## Step 4 — Round-11 TDD remediation (plan: `docs/plans/2026-09-13-code-review-remediation-round11.md`)

Five slices, one atomic commit each, seams pre-validated:

- **Slice 1 (`b572e20`)** — R10-6/R10-6b: `.env` untracked; both prose sites de-markered; AGENTS.md records the 4th re-add. GREEN proof: `git checkout-index` staged-tree simulation scanned with the EXACT CI patterns exits clean (2693 files). Ops: rotate both secrets (5th public exposure).
- **Slice 2 (`8bd02bd`)** — R10-7: four guards (getCartId resolves only ACTIVE carts; createPaymentIntent refuses non-active with typed `CART_CONVERTED` before the Stripe call; placement no-ops on converted pre-tx AND under the FOR UPDATE lock with an ops-refund log — active/merged still place per H4d; customer-safe action copy). RED: `cart-converted-guard.integration.test.ts` failed against HEAD (STRIPE_NOT_CONFIGURED fired instead of the guard); GREEN: integration + `cart-session.integration.test.ts` + action-mapping specs.
- **Slice 3 (`7d23d21`)** — A-1: `requirePermission` outside both action try blocks (NEXT_REDIRECT is control flow, not an error).
- **Slice 4 (`f82b78e`)** — A-4: both admin session-check catches paired with `console.error`.
- **Slice 5 (`431f504`)** — A-2/A-3: product update is ONE transaction with `FOR UPDATE` inventory deltas and the audit row written INSIDE it (`writeAudit(input, tx)` executor seam — rollback leaves no phantom audit; pinned by guard.test.ts specs); `ProductActionError` joins the typed mapping.

## Final verification

Gates green: lint 8/8 · typecheck 8/8 · tests 7/7 (commerce 173, web 59, admin 13 — integration live on embedded PG 17.5) · build 2/2 · Playwright web **81/81** · admin **8/8** · scan-green checkout simulation clean · `git ls-files | grep '^\.env$'` empty. `skills/` and `infrastructure/` untouched by every commit. Docs aligned: PAD v1.4 (revision entry + §11 rows — R10-6/6b/7, R10-2, R10-1/5, R10-4, R10-3, A-1..A-4 closed; Low-batch row open), traceability (FR-501..512 checkout honesty + converted-cart guard; FR-105 title-scoped synonyms; FR-301..313 spec-rewrite note; §11.1 metadata row twitter cards), verification-ledger rounds 10–11, AGENTS.md/CLAUDE.md conventions, this session record.

## Ops actions required (cannot be executed from this sandbox)

1. **Redeploy both apps via `./start_server.sh`** to publish rounds 10–11. The live storefront origin was unreachable for the entire back half of this session (admin origin healthy) — inspect `server.log` on the deployment host first; if the process hung or exited, the redeploy fixes both.
2. **Rotate `BETTER_AUTH_SECRET` and `CRON_SECRET`** — 5th public exposure; history keeps the bytes.
3. Carried: R-DB-2 DDL hardening as its own session; R-SHOP-2 facets; R-SHOP-3 remainder; R9-6 wishlist with B9; the round-11 Low/Info batch.

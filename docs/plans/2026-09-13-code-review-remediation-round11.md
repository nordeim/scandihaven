# Code-Review + Security-Audit Remediation — Round 11 (2026-09-13)

> Parent audit: `docs/audits/2026-09-13-code-review-security-audit/` (1 Critical /
> 2 High / 5 Medium / 11 Low / 3 Informational; 4 known-backlog re-confirmations).
> Baseline at plan time: repo gates green (lint 8/8, typecheck 8/8, tests 7/7 —
> 326 tests; build 2/2, web E2E 81/81, admin 8/8) at round-10 HEAD
> (`9e92e5e` + audit docs). Scope exclusions honored: `skills/` and
> `infrastructure/` untouched by checks, tests, and compilation.

## Remediation plan (TDD — one atomic commit per slice, severity-ordered)

Seams pre-validated file-by-file before this plan was committed to disk (see
"Validation notes" per slice). Every slice is red-first at the closest
behavioral seam: pure/DB seams integration-tested, surfaces E2E-tested.

### Slice 1 — R10-6 + R10-6b: untrack the 5th `.env` re-exposure; de-marker the scan-red prose (P0, Critical+High)
- Seam: git index (`.env` tracked at HEAD `fc0379a`) + `AGENTS.md:75` +
  `docs/verification-ledger.md:341`.
- Fix: `git rm --cached .env` (working file stays for local runs); rephrase
  both prose sites to describe the OpenSSH private-key header without
  reproducing the marker (the R7-1b rule applied to its own documentation);
  update `AGENTS.md:75` to record `fc0379a` as the 4th re-add (5th exposure
  total: C2 → R4-1 → R6-1 → R7-1 → fc0379a).
- RED (already captured): exact CI scan replay flags `.env:7`, `.env:31`,
  `AGENTS.md:75`, `verification-ledger.md:341`.
- GREEN proof: re-run the exact CI scan patterns against a `git archive` of
  the STAGED index (clean-checkout simulation — the R7-1 verification
  idiom): must exit clean. Working-tree `.env` still trips `--no-ignore`
  scans by design; the proof is against the index tree.
- Ops actions carried (not code): rotate `BETTER_AUTH_SECRET` +
  `CRON_SECRET` (5th public exposure — history keeps the bytes).
- Commit: `fix(security): untrack 5th-time .env re-exposure + de-marker scan-red prose (R10-6/R10-6b)`.

### Slice 2 — R10-7: enforce the converted-cart guard at every seam (HIGH, money path)
- Seams (all four verified unguarded today):
  1. `apps/web/src/lib/cart-session.ts:getCartId()` — add `eq(cart.status,
     "active")` to the token lookup: a cookie pointing at a converted cart
     behaves exactly like no cookie (the next `requireCart()` mints a fresh
     cart + cookie). Root layout mini-cart, /cart, /checkout, and every
     action route through this seam.
  2. `packages/commerce/src/checkout-service.ts:createPaymentIntent()` —
     after loading `cartRow`, reject non-`active` carts with a typed
     `CART_CONVERTED` CheckoutError. Action layer maps it to customer-safe
     copy ("Your cart was already checked out — your order is on its way.
     Start a new cart to keep shopping."); operator detail stays in the
     server log.
  3. `packages/commerce/src/checkout-service.ts:placeOrderFromWebhook()` —
     after the FOR UPDATE lock: `status === "converted"` → `console.error`
     (intent id + cart id, for the ops refund trail) + return `null` (200;
     Stripe stops retrying; NO second order). `active`/`merged` carts still
     place (merged carts can carry legitimately pre-merge intents — never
     lose a captured payment, H4d discipline).
  4. `addLine` needs no change — guarded transitively by (1): the cookie no
     longer resolves the converted cart, so the action mints a new one.
- RED: integration specs — (a) convert a cart (direct status update after a
  real placement is heavy; use a seeded converted cart) → `createPaymentIntent`
  throws `CART_CONVERTED`; (b) `placeOrderFromWebhook` on a converted cart
  returns `null` and no second order row appears; (c) app-layer
  `cart.test.ts` wiring spec — `getCartId` returns null for a converted
  cart's token. All fail against HEAD.
- GREEN: implement the three guards; specs green; full gates green.
- Commit: `fix(checkout): enforce converted-cart guard — close the re-checkout double-charge path (R10-7)`.

### Slice 3 — A-1: stop swallowing the auth redirect in admin actions (MEDIUM)
- Seam: `apps/admin/src/actions/orders.ts:104-109`, `products.ts:100-105` —
  `requirePermission()` moves OUT of the `try` blocks (it throws
  `NEXT_REDIRECT` by design; Next handles it as the re-auth flow).
  `requirePermission` failures (ForbiddenError) keep their typed mapping.
- RED-first: the defect is verified by code read (a thrown redirect logged
  as `[admin order] transition failed`); spec-level red: a wiring unit test
  in `apps/admin` asserting `transitionOrderAction` calls `requirePermission`
  outside the try (or simplest honest coverage: keep the existing suites
  green + the A-4 logging spec below gains a case asserting a session-less
  invocation surfaces the redirect, not INTERNAL). Pragmatic red: assert the
  action's catch never sees NEXT_REDIRECT — via a unit spec calling the
  action with no session and expecting a redirect throw, not an INTERNAL
  ActionResult.
- Commit: `fix(admin): requirePermission runs outside the action try — the auth redirect is not an error (A-1)`.

### Slice 4 — A-4: log the silent admin session-check catches (MEDIUM)
- Seam: `apps/admin/src/lib/admin-guard.ts:58`, `apps/admin/src/app/(staff)/layout.tsx:19`
  — pair each `.catch(() => null)` with `console.error("[admin] session check failed", …)`
  (the storefront `account/page.tsx:21` idiom). Auth/DB outages become
  visible in logs instead of indistinguishable from logged-out.
- RED: grep-based convention check already documents the violation; fix is
  additive logging. Verified by read + existing suites stay green.
- Commit: `fix(admin): log failed session checks — an auth outage must not look like logged-out (A-4)`.

### Slice 5 — A-2 + A-3: transactional product update with atomic inventory delta (MEDIUM)
- Seam: `apps/admin/src/actions/products.ts:42-99` — wrap the whole
  mutation in `db.transaction` (the `transitionOrderAction` idiom); the
  inventory adjustment becomes atomic SQL
  (`set { qtyOnHand: sql`${inventoryLevel.qtyOnHand} + ${delta}` }`) with the
  movement row computed from the RETURNING value; audit row writes inside
  the same tx (partial failure leaves NO state and NO audit — honest).
- RED: integration-style spec (apps/admin test with local PG): simulate a
  failure mid-action (e.g. price update violates a guard) → no partial
  writes. Pragmatic red given harness scope: unit spec pinning the SQL
  shape (atomic delta, not absolute write) + read-level verification; full
  behavior verified via the existing admin suites + manual scenario.
- Commit: `fix(admin): product update is one transaction; inventory deltas are atomic (A-2/A-3)`.

### Deferred with rationale (tracked in the audit's findings.json; not this round)
- **B-6 (MTO semantics, Medium-Reasoned)** — couples to the R-INV-1
  two-phase-reservation redesign (same inventory seam); fixing the rule
  twice would be churn.
- **A-5..A-10, B-7..B-12 (Low)** — small, honest, non-blocking; batched
  into the next scheduled round (each is < 1 slice; bundling them into this
  round would mix severities in one commit chain).
- **A-11..A-13, B-13 (Informational)** — documented design choices/notes.
- **B-1/B-2/B-4/B-5** — already tracked (B3, M3d/R-INV-1, L5d, L4d); unchanged.

## Execution order

Slice 1 → 2 → 3 → 4 → 5. After each slice: scoped gates green, atomic
commit. Final verification: full `pnpm lint typecheck test build`, full
Playwright web + admin local, scan-green checkout simulation (Slice 1's
proof, re-run at the end), `git ls-files | grep '^\.env$'` empty. Docs
alignment after execution: PAD revision + §11 rows, traceability
(FR-508/509 cart-status guard; audit row), verification-ledger round-11
entry, AGENTS.md/CLAUDE.md conventions (converted-cart invariant), session
record. Live re-check when the storefront origin recovers (ops action from
round 10 stands).

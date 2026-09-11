# Live E2E Remediation — Round 8 (2026-09-11)

> Parent audit: round-8 live validation (2026-09-11). Baseline: repo gates green
> (lint 8/8, typecheck 8/8, tests 7/7 — integration suites live on embedded
> PG 17.5, commerce coverage 92.81% lines / 90.32% funcs above the 90/85 gate;
> build 2/2). **Repo Playwright suites vs the live origins: storefront 64/64 +
> admin gate 8/8 PASS** — the round-7 redeploy (checked-in
> `start_server_log.txt`, HEAD `d94c020`) published every round-7 fix (the
> 10 live-vs-repo deltas recorded in session_12 are closed). Beyond the repo
> suite, a 36-probe diagnostic sweep (homepage sections, PDP surface, cart,
> footer, journal, search depth, JSON-LD, headers, TTFB, checkout money path)
> surfaced 8 findings, every one validated against the code before
> classification. Scope exclusions honored: `skills/` and `infrastructure/`
> untouched by checks, tests, and compilation.

## Findings (evidence-labelled)

| ID | Severity | Finding | Evidence | Label |
|---|---|---|---|---|
| **R8-1** | **HIGH — FR-508/FR-509 (M, money path)** | **Checkout placeholder-key blind spot: client and server disagree on "configured".** The client builds `stripePromise` from any non-empty `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`checkout-flow.tsx` line 24: `process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? loadStripe(...) : null`), while the server `getStripe()` additionally rejects `set-me` placeholders (`checkout-service.ts`: `if (!key \|\| key.includes("set-me")) return null`). The deployed `.env` carries `pk_test_set-me` (non-empty placeholder), so the live checkout renders the full address form; after the customer completes it, `createPaymentIntentAction` maps `STRIPE_NOT_CONFIGURED` to `fail("INTERNAL", error.message)` and the customer sees **"Stripe is not configured: set STRIPE_SECRET_KEY in .env (test mode keys)."** — internal config instructions leaking to the customer (violates the "internals never reach the client" contract, CLAUDE.md Error Handling) with a retry that can never succeed (FR-509 dead-end). The honest "not configured" notice the start-server warning promises never renders. | Live probe: `/checkout` renders `input[name=name]`; submit → error text `Stripe is not configured: set STRIPE_SECRET_KEY…` rendered to customer. Code: `checkout-flow.tsx:24-25` vs `checkout-service.ts:31-33`, `actions/checkout.ts` CheckoutError branch | Verified |
| **R8-2** | **MEDIUM — FR-701 §10 (M)** | **Homepage journal preview cards are unlinked.** `JournalPreview` (page.tsx) renders `<article>` with category/title/excerpt but no `<a>` — the reader routes `/journal/{category}/{slug}` shipped in round 7 (R7-2) and the journal index + typeahead link to them, but the homepage section never got wired. The cards are dead-ends on the highest-traffic page. | Live probe: homepage contains "From the journal" but zero `href="/journal/{category}/{slug}"` links. Code: `apps/web/src/app/page.tsx` JournalPreview (articles without Link) vs `apps/web/src/app/journal/page.tsx` (linked) | Verified |
| **R8-3** | **MEDIUM — FR-201 (M)** | **PLP/category breadcrumbs render without BreadcrumbList JSON-LD.** FR-201 acceptance: "breadcrumbs rendered with JSON-LD". The PDP emits it (round 4, R4-8) and the repo suite pins the PDP only; `/shop` and `/shop/{category}` render the visible `<nav aria-label="Breadcrumb">` trail but no structured data. | Live probe: `/shop` + `/shop/seating` contain `Breadcrumb` nav, no `"BreadcrumbList"` script. Code: neither PLP imports `breadcrumbJsonLd`; PDP does | Verified |
| **R8-4** | **MEDIUM — FR-107 (M)** | **Footer missing newsletter form and social icons.** FR-107: "Footer: shop/about/help links, showroom addresses, newsletter form, social icons, payment method marks, legal links, locale switcher". The footer has link groups, showroom address, payment marks, legal — but no newsletter form and no social links. The `subscribeAction` even defaults `source: "footer"` (planned, never wired). Locale switcher stays covered by the documented R-SEO-3 deferral (i18n wiring, P1). | Live probe: footer contains showroom + "Visa · Mastercard…" + link groups; no `input[type=email]` inside footer, no social anchors. Code: `site-footer.tsx` (no form, no social), `actions/newsletter.ts` (`source` default "footer") | Verified |
| **R8-5** | **MEDIUM — FR-701 §6/§7/§9 (M) + FR-308 (M) + FR-312 (M)** | **Homepage §6 brand-story teaser, §7 materials (3 cards), §9 testimonials are unimplemented, and the reviews read-path is starved of data.** page.tsx implements §2/3/4/5/8/10/11 only. §9 testimonials ("3-up from approved reviews") and the PDP reviews section (FR-308) both degrade-to-hide correctly but **no approved review exists anywhere** (seed seeds zero review rows), so both M-priority surfaces are permanently absent. FR-312's PDP JSON-LD omits `aggregateRating` (renders only when `ratingCount > 0`, which can never happen today). | Code: page.tsx section comments (§2,3,4,5,8,10,11 only); `grep -c review seed/ensure-seeded.ts` → 0 rows; PDP JSON-LD block has no aggregateRating; live probes P06 (no reviews surface) + P03 (testimonials=0) | Verified |
| **R8-6** | **MEDIUM — FR-310 (M)** | **Out-of-stock "Notify me" flow absent.** The `back_in_stock_request` table exists with the dedupe unique index `(variant_id, email)` (FR-310 acceptance: "submissions stored with dedupe per email+variant") — but no Server Action and no UI form exist; the buy-panel disables OOS swatches with a tooltip only. The seeded catalog contains no OOS variant, so the surface cannot even be exercised. | Code: schema `back_in_stock_request` (unique index present); `apps/web/src/actions/` has no notify action; `product-buy-panel.tsx` renders disabled swatch, no form. Live probe P10: notify=0 | Verified |
| **R8-7** | **LOW — FR-108 (S)** | **Announcement bar not dismissible.** FR-108: "rotating, dismissible, content-managed… Dismissal persisted (Zustand persist)". `site-header.tsx` renders the message (optionally as a link) with no dismiss control and no persisted dismissal. | Live probe P02b: no dismiss control found. Code: `site-header.tsx` announcement block (message/link only) | Verified |
| **R8-8** | **LOW — FR-307 (S), R7-7 carried** | **Cross-sell "Pairs well with" still a stub** (PDP comment says so). S-priority; needs either the merchandiser-curated model (admin UI, FR-809-adjacent) or the conversion-proxy fallback (requires populated analytics events). **Deferred** with the same rationale as round 7; stays queued. | Sweep P07; `products/[slug]/page.tsx` header comment "cross-sell stub" | Verified |

Validated-healthy (no action): TTFB 109–142 ms across 7 key routes (SLO 800 ms), security headers sitewide (CSP/HSTS/XCTO/XFO/Referrer-Policy/Permissions-Policy), robots group-aware + sitemap line, sitemap journal URLs live-fetchable (R7-2 live), journal reader routes render (R7-2 live), typeahead keyboard nav with `aria-activedescendant` (FR-104), search empty state + noindex (FR-106), search typo/synonym depth (R7-4 live), collections index/detail (FR-702), mini-cart drawer + qty stepper + subtotal (FR-401), cart persistence across reload (FR-403), /cart promo field + totals breakdown (FR-402/406 — probe P13's "missing promo field" was a case-sensitivity artifact: `placeholder="Promotion code"`), newsletter homepage form validation (FR-107 §11), `/account` gate with `?redirect=` preservation (FR-602), PLP sort pills + URL sort (FR-204), availability param honored (FR-202 subset), PDP `?variant=` deep-link (FR-302), 404 recovery paths (FR-109), lookbooks honest 404 (FR-705), admin gate 8/8 (R6-3 live).

Disproven during validation (not findings): "newsletter-form.tsx has a syntax error (`const essage`)" — the Read/sed display ate the `[m` sequence (ANSI-SGR-like); hex dump proves the bytes are `const [message, setMessage]`, `tsc --noEmit` exits 0. Same artifact class the repo documents; byte-level verification is authoritative.

## Remediation plan (TDD — one atomic commit per slice)

Seams pre-validated against the codebase (file-by-file) before this plan was
committed to disk. Every slice is red-first at the closest behavioral seam:
pure helpers unit-tested, DB-backed seams integration-tested, surfaces E2E-tested
against a production build with `NEXT_PUBLIC_SITE_URL` set (repo convention).

### Slice 1 — R8-1: checkout placeholder-key honesty (HIGH, money path)
- Seam: `apps/web/src/lib/stripe-config.ts` (NEW pure helper:
  `isStripePublishableKeyConfigured(key: string | undefined)` — false when
  unset/empty/contains `set-me`, mirroring `getStripe()`'s server rule);
  `checkout-flow.tsx` (use the helper); `actions/checkout.ts`
  (`STRIPE_NOT_CONFIGURED` → log the detailed message server-side via
  `console.error`, return a customer-safe `fail("INTERNAL",
  "Online payments are temporarily unavailable. Please contact us to complete
  your order.")` — the env instructions never leave the server).
- RED: unit `apps/web/src/lib/stripe-config.test.ts` (unset/empty/`pk_test_set-me`/
  real `pk_test_…` key) — helper absent, tests fail. E2E: the local build's
  `.env` carries `pk_test_set-me`, so after RED the existing storefront spec's
  primary branch ("payments are not configured") is the contract; add an
  explicit spec asserting the notice renders AND no address form renders
  (placeholder build) + a spec that the action never leaks `STRIPE_SECRET_KEY`
  text (unit on the action error mapping).
- GREEN: helper + wiring + action mapping.
- Commit: `fix(checkout): treat placeholder Stripe keys as unconfigured and sanitize the customer-facing error (R8-1)`.

### Slice 2 — R8-2: homepage journal preview links (MEDIUM)
- Seam: `apps/web/src/app/page.tsx` JournalPreview — wrap each card in
  `next/link` to `/journal/${post.category}/${post.slug}` (category-scoped
  shape per the R7-2 contract; `listLatestJournal` already returns category).
- RED: E2E `apps/web/e2e/journal-flows.spec.ts` — homepage journal cards are
  anchor links to `/journal/{category}/{slug}` and click-through resolves 200.
- GREEN: the Link wrap. A11y: the whole card becomes the link name (title +
  excerpt inside), consistent with journal index linking.
- Commit: `fix(home): link journal preview cards to the FR-703 reader routes (R8-2)`.

### Slice 3 — R8-3: PLP BreadcrumbList JSON-LD (MEDIUM)
- Seam: `apps/web/src/app/shop/page.tsx` + `apps/web/src/app/shop/[category]/page.tsx`
  — emit `breadcrumbJsonLd(siteUrl, trail)` via `safeJsonLd` (exact PDP idiom,
  `seo.ts` helper already pure + tested); trails: Home/Shop (all-products) and
  Home/Shop/{Category} (category page needs `currentSiteUrl()` — already the
  page's convention via layout metadata; PDP passes siteUrl explicitly).
- RED: E2E `apps/web/e2e/seo-flows.spec.ts` — `/shop` and `/shop/seating`
  contain a `BreadcrumbList` script with the expected `itemListElement` names
  and absolute URLs.
- GREEN: two page edits reusing the tested helper.
- Commit: `fix(seo): emit BreadcrumbList JSON-LD on the PLP and category routes (R8-3)`.

### Slice 4 — R8-5: homepage §6/§7/§9 + approved review seeds + PDP AggregateRating (MEDIUM)
- Seams: `packages/commerce/src/catalog.ts` (NEW `listApprovedTestimonials(limit=3)`:
  approved reviews joined to product slug/title, newest-first, bounded);
  `packages/db/src/seed/ensure-seeded.ts` (idempotent approved-review rows for
  the six demo products — natural keys are absent for `review`, so guard by
  existence like the announcement block; honest `isVerifiedPurchase` only where
  an order exists — the demo rows set it false, verified-buyer badges stay
  honest); `apps/web/src/app/page.tsx` (§6 brand-story teaser → `/our-story`,
  §7 materials 3-cards → `/materials`, §9 testimonials 3-up from
  `listApprovedTestimonials` — each degrades to hidden when empty per the
  header contract); `products/[slug]/page.tsx` JSON-LD (add `aggregateRating`
  when `ratingCount > 0`).
- RED: integration `listApprovedTestimonials` specs (empty DB → []; approved
  only — pending rows excluded; bounded); seed-coverage spec (approved reviews
  exist for the demo catalog); E2E: homepage renders the three new sections
  (testimonials show seeded reviews; brand story links /our-story; materials
  links /materials) + PDP JSON-LD carries `aggregateRating` with the rendered
  average.
- GREEN: query + seeds + sections + JSON-LD field.
- Commit: `feat(home,pdp): FR-701 missing sections + approved review seeds + aggregateRating (R8-5)`.

### Slice 5 — R8-4: footer newsletter + social (MEDIUM)
- Seams: `apps/web/src/components/newsletter-form.tsx` (add optional `source`
  prop + `idPrefix` so footer and homepage instances don't collide on DOM ids);
  `site-footer.tsx` (compact newsletter block wired to the action; three social
  anchors with `aria-label` + `rel="noopener noreferrer"`, `target="_blank"`).
- RED: E2E `apps/web/e2e/storefront.spec.ts` footer block — footer contains a
  labeled email input + submit; a valid submit surfaces the success status;
  social anchors expose accessible names. Unit: none needed beyond the
  existing action coverage (rate limit + duplicate states already pinned).
- GREEN: prop threading + footer block.
- Commit: `feat(footer): FR-107 newsletter form + social links (R8-4)`.

### Slice 6 — R8-6: back-in-stock "Notify me" (MEDIUM)
- Seams: `apps/web/src/actions/back-in-stock.ts` (NEW action:
  Zod email + variantId, `consumeRateLimit` scope `back_in_stock` 3/hour/IP
  (newsletter idiom), `onConflictDoNothing` dedupe on the existing unique index,
  `ActionResult` union, honest VALIDATION/INTERNAL codes); buy-panel renders
  the email form when the SELECTED variant is `out_of_stock` (disabled swatch
  note stays); seed gains an OOS variant (new natural key `SH-HYG-THR-RST` on
  the Hygge throw with `qtyOnHand: 0` vs safety 2 → availability `out_of_stock`
  on fresh AND existing DBs — additive row, no existing-row mutation).
- RED: integration action specs (valid insert; duplicate email+variant is a
  no-op success — dedupe honesty; invalid email VALIDATION; rate limit 4th
  call RATE_LIMITED); E2E: PDP of the OOS variant shows the Notify me form;
  submit → success status; re-submit → already-registered status.
- GREEN: action + form + seed row.
- Commit: `feat(pdp): FR-310 back-in-stock notify form with dedupe + rate limit (R8-6)`.

### Slice 7 — R8-7: dismissible announcement bar (LOW)
- Seams: `apps/web/src/stores/announcement-store.ts` (NEW zustand store with
  `persist` middleware — FR-108 prescribes Zustand persist; keyed on the
  announcement id so future rotations re-show); `site-header.tsx` (dismiss
  button with `aria-label`, hidden when persisted dismissal matches).
- RED: unit store spec (dismiss persists, id mismatch re-shows); E2E: dismiss
  hides the bar; reload keeps it hidden (storage persists within the context).
- GREEN: store + button.
- Commit: `feat(header): FR-108 dismissible announcement bar with persisted dismissal (R8-7)`.

### Slice 8 — docs alignment
- PAD v1.2: revision-history entry (round 8), §11 rows for R8-1..R8-8
  (Resolved-with-evidence for the fixed set; R8-8 stays queued with rationale),
  `last_updated`.
- `docs/traceability.md`: FR-107 (footer form live), FR-108 (dismissible),
  FR-201 (breadcrumb JSON-LD), FR-310 (notify flow), FR-312 (aggregateRating),
  FR-508/509 (placeholder honesty + customer-safe error), FR-701 (§6/§7/§9/§10),
  FR-308 read-path (approved seeds live).
- `docs/verification-ledger.md`: round-8 entry (gates, live parity numbers,
  sweep → fix evidence).
- AGENTS.md / CLAUDE.md conventions: (a) client-side "configured" checks must
  mirror the server rule for placeholder env values (`set-me`) — the
  checkout seam is the pinned example; (b) PLP/category breadcrumbs carry
  BreadcrumbList JSON-LD like the PDP; (c) demo review/testimonial seeds are
  existence-guarded and honest about `isVerifiedPurchase`.
- `docs/session_14.md`: this session's narrative.
- Commit: `docs: round-8 audit record, PAD v1.2, traceability and ledger alignment`.

## Verification matrix (Definition of Done)

| Gate | Expectation |
|---|---|
| `pnpm lint` / `pnpm typecheck` | 8/8 green, no new suppressions |
| `pnpm test` | 7/7 green incl. new unit + integration specs; coverage stays above the 90/85 gate |
| `pnpm build` | 2/2 green (both apps) |
| `pnpm e2e` (local build, placeholder-key env) | All prior storefront specs stay green (the checkout spec's primary branch now asserts the honest notice) + new R8 specs red→green |
| Repo suites vs live origins | Pre-remediation parity is already recorded (64/64 + 8/8); post-push live re-check documents the awaiting-redeploy delta only |
| Hygiene | `git ls-files \| grep '^\.env$'` empty; `skills/` + `infrastructure/` untouched; no skipped/weakened tests |

Deferred (stays open, documented): R8-8 cross-sell (S), R-SHOP-2 facets (P1 L),
R-CART-1 shipping estimate (P1), R-CHECK-1 tax (P1), R-SEO-3 i18n (P1),
R-SEC-1 2FA (P1), R-INV-1 (P1), R-DB-2 (dedicated session), secret rotation
(ops action from R7-1, still pending on the deployment).

## Outcome (2026-09-11, executed)

All seven code slices executed red-first and committed atomically; docs slice included in the same push.

| Slice | Commit | Result |
|---|---|---|
| R8-1 checkout placeholder honesty | `2402ac1` | 6 unit + 1 E2E specs green; live-defect reproduced pre-fix, honest notice renders post-fix |
| R8-2 homepage journal links | `c663028` | 2 E2E specs green |
| R8-3 PLP breadcrumb JSON-LD | `fdbd58b` | 2 E2E specs green |
| R8-5 FR-701 sections + review seeds + aggregateRating | `c59ce62` | 2 integration + 1 seed-coverage + 2 E2E specs green |
| R8-4 footer newsletter + social | `33155a6` | 1 E2E spec green |
| R8-6 back-in-stock notify | `49a7683` + `528e49c` | 2 integration + 4 action + 1 E2E specs green |
| R8-7 dismissible announcement | `0c4c57d` | 3 unit + 1 E2E specs green |
| R8-8 cross-sell | — | Deferred (rationale in §11) |
| Docs alignment | docs commit | PAD v1.2, traceability rows, ledger round-8 entry, AGENTS/CLAUDE conventions, `docs/session_14.md` |

**Final gates:** lint 8/8 · typecheck 8/8 · test 7/7 (301 tests, +44 vs round 7; coverage 92.81% lines / 90.32% funcs ≥ gate) · build 2/2 · Playwright web **74/74** + admin **8/8** local. Hygiene: `.env` untracked; `skills/` + `infrastructure/` untouched.

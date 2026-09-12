# Live E2E Remediation — Round 9 (2026-09-12)

> Parent audit: round-9 live validation (2026-09-12). Baseline: repo gates green
> (lint 8/8, typecheck 8/8, tests 7/7 — integration suites live on embedded
> PG 17.5; build 2/2). **Repo Playwright suites vs the live origins: storefront
> 74/74 + admin gate 8/8 PASS** — the round-8 redeploy (checked-in
> `start_server_log.txt`, HEAD `25ed42d`) published every round-8 fix (the
> 10 awaiting-redeploy deltas session_14 recorded are closed; the single
> mid-run R8-6 failure was environmental — the spec's rate-limit fixture reset
> needs `DATABASE_URL` exported in the invoking shell). Beyond the repo suite,
> a 23-probe diagnostic sweep (cart promo/shipping surfaces, PLP card
> conversion surfaces, PDP mobile bar, JSON-LD/meta completeness, checkout
> honesty, sitemap parity, headers, TTFB) surfaced 6 findings, every one
> validated against the code before classification. Scope exclusions honored:
> `skills/` and `infrastructure/` untouched by checks, tests, and compilation.

## Findings (evidence-labelled)

| ID | Severity | Finding | Evidence | Label |
|---|---|---|---|---|
| **R9-1** | **MEDIUM — FR-404 (M), closes the R-CART-1 notice half** | **Promo re-validation drop is silent.** `getCartDto` re-validates attached promotions on every read (E2E-3) and correctly stops pricing an ineligible code — but the drop is invisible: `CartDto` exposes only `appliedPromotionCode: null`, and `cart-view.tsx` clears `promoMessage` on every server-truth refresh. Live: WELCOME100 applied at €747 → qty reduced below the €500 minimum → the `−€100` Discount row disappears with zero explanation (`role="status"` texts: `[""]`). FR-404 acceptance: "cart displays current truth **with an inline notice**". | Live probe P02 (discount silently disappeared, statuses `[""]`); code: `cart-service.ts:getCartDto` (filterEligiblePromotions → eligibleIds; attached-but-dropped set is computable but discarded) + `cart-view.tsx:31` (`setPromoMessage(null)` on refresh) | Verified |
| **R9-2** | **MEDIUM — FR-402 acceptance ("actionable errors"), R-CART-1 half** | **min_spend rejection copy is not actionable.** `PROMOTION_REJECTION_COPY.min_spend` = "This code requires a higher order subtotal to apply." — no amount, no next step. The rejection site (`applyPromotionByCode`) has both `minSpendMinor` (conditions) and `dto.subtotalMinor` in scope when it calls `humanizePromotionRejection`, so the shortfall is computable but discarded. | Live probe P03 (copy rendered verbatim, `actionable=false`); code: `promotions.ts:68-77` (static map, no context parameter) | Verified |
| **R9-3** | **MEDIUM — FR-402 (M), closes the R-CART-1 estimate half** | **Cart shipping estimate by postcode absent.** FR-402: "shipping estimate by postcode … Estimates call the shipping-rate provider; recalculate within 500 ms of postcode entry". The `ShippingRateProvider` port exists (`providers.ts:155`), `shipping_zone`/`shipping_rate` tables are seeded (3 zones, 5 methods each, weight-banded, white-glove >30 kg), `product_variant.weight_g` is populated — but no adapter implements the port and the cart renders a static "Calculated at checkout" row. | Live probe P01 (no estimate UI, static shipping row); code: `cart-view.tsx:158-161` (static `<dd>`), no `ShippingRateProvider` implementation anywhere (only `providers.test.ts` mocks) | Verified |
| **R9-4** | **MEDIUM — FR-206 (M), UNTRACKED** | **PLP quick-add unwired.** FR-206: "quick-add uses first purchasable variant; disabled state when none; card is one accessible link with nested quick-add button excluded from the link semantics". `ProductCard` has shipped a `quickAdd?: React.ReactNode` slot since the UI package was built (the E2E-4 comment even references "quick-add" pricing), but no page ever passes it — `/shop`, `/shop/{category}`, and the journal related-products grid all render link-only cards. The traceability row for FR-201..208 does not name quick-add (same "planned, never wired" class as round 8's footer newsletter R8-4). | Live probe P04 (zero add buttons on `/shop` cards); code: `product-card.tsx:27,106` (slot exists) with no call site passing `quickAdd` (`grep -rn quickAdd apps/web/src` → only the composite) | Verified |
| **R9-5** | **LOW — FR-309 (S), untracked** | **Sticky mobile add-to-cart bar absent.** FR-309: "Sticky mobile add-to-cart bar appearing after primary CTA scrolls out … contains price + CTA only; does not overlap footer on short pages". At 390×844 no fixed bar appears after scrolling the buy-panel CTA out of view. | Live probe P06 (no fixed bar after scroll); code: no sticky implementation in `product-buy-panel.tsx`/PDP | Verified |
| **R9-6** | **MEDIUM — FR-305 (M), tracked B9 deferred** | **PDP "Save to wishlist" secondary CTA absent.** The buy-panel comment says "wishlist (store only in scaffold)". FR-305 wants a guest wishlist (localStorage) with merge-on-login — the merge half couples to the account backlog (R-AUTH-1/B9: magic link, addresses, reorder). **Deferred with rationale**: shipping a localStorage-only heart button without the saved-items surface and merge contract would create UI debt the B9 slice would immediately rewrite. | Live probe P05 (no wishlist button); code: `product-buy-panel.tsx:25` scaffold comment; traceability FR-601..609 row ("wishlist/addresses/reorder = backlog B9/Deferred") | Verified |

Validated-healthy (no action): journal reader Article + BreadcrumbList JSON-LD with absolute canonical (P09); PDP Product JSON-LD complete — offers.price/priceCurrency/availability + `aggregateRating` 4.5/2 (P10); collections canonical + og:url absolute (P11); search noindex (P12 — canonical absence is correct for a noindex page); sitemap 22 `<loc>` all 200 (P14); security headers sitewide (P15); 404 branded + correct status (P16); typeahead serves products (P17); admin gate 307 + sign-in 200 + CSP (P18); TTFB 117–126 ms across 5 key routes (P20); cart drawer opens (P13); WELCOME100 applies above threshold with discount row (P02a); checkout honest notice with zero address-form inputs on the placeholder build (P08).

Disproven during validation (probe artifacts, not findings): "checkout renders an address form" — the single `input[name=email]` on `/checkout` is the FOOTER newsletter form (R8-4); the address form is absent (verified by enumerating all forms + checking `input[name=line1]`); "journal/collections canonical missing" — the probe read `content` instead of `href` on `<link rel=canonical>`; fixed mid-sweep, both PASS; "search canonical missing" — correct behavior for a noindex page per §11.1.

Known-open re-confirmations (not new findings, unchanged): `bestselling` sort falls through to featured (`sort=bestselling` is not in the SORTS pills — R-SHOP-2/product_metrics); gift options absent (FR-405 S, documented deferral); wishlist (this round's R9-6).

## Remediation plan (TDD — one atomic commit per slice)

Seams pre-validated against the codebase (file-by-file) before this plan was
committed to disk. Every slice is red-first at the closest behavioral seam:
pure helpers unit-tested, DB-backed seams integration-tested, surfaces E2E-tested
against a production build with `NEXT_PUBLIC_SITE_URL` set (repo convention).

### Slice 1 — R9-1: promo re-validation drop inline notice (MEDIUM, FR-404)
- Seam: `packages/commerce/src/dto.ts` (`cartDtoSchema` gains
  `promotionNotice: z.string().nullable()` — null when the attached code is
  eligible or none is attached); `packages/commerce/src/cart-service.ts`
  (`getCartDto`: the attached-but-dropped promotion is already computable as
  `promotionInfo.rows` minus `eligibleIds` — evaluate it for the reason,
  compose the server-side customer-safe notice via the M1-PROMO discipline);
  `apps/web/src/components/cart-view.tsx` (render `role="status"` notice when
  `cart.promotionNotice` is set — placed right under the applied-code status).
- RED: integration spec in `packages/commerce/src/checkout-promotions.integration.test.ts`
  idiom — apply WELCOME100 above threshold, drop qty below, `getCartDto`
  returns a non-null `promotionNotice` naming the code; unit-level: DTO schema
  round-trip. E2E: cart page shows the notice after the qty drop (scoped
  selectors, strict-mode-safe).
- Notice copy (server-composed, customer-safe): "Code WELCOME100 no longer
  meets its conditions (This code requires a higher order subtotal to apply.).
  It will re-apply automatically if your cart qualifies again." — reason text
  via `humanizePromotionRejection`, never raw reason codes.
- Commit: `feat(cart): inline notice when promotion re-validation drops a code (R9-1, FR-404)`.

### Slice 2 — R9-2: actionable min-spend rejection copy (MEDIUM, FR-402)
- Seam: `packages/commerce/src/promotions.ts` — `humanizePromotionRejection(reason)`
  gains an optional context parameter `{ minSpendMinor?, subtotalMinor?, currency? }`;
  when the reason is `min_spend` and both amounts are known, the copy becomes
  "You're €251.00 away from the €500.00 minimum for this code." (amounts via
  integer-minor formatting — no floats). All other reasons keep their existing
  copy unchanged (existing specs stay green — copy is additive, never weakened).
- Call sites updated: `applyPromotionByCode` (has `dto.subtotalMinor` +
  `promo.conditions.minSpendMinor` in scope) and the Slice-1 notice composer.
- RED: extend `promotion-rejection-copy.test.ts` — min_spend WITH context
  names both amounts and the remaining shortfall; WITHOUT context falls back
  to the existing sentence. E2E: below-threshold apply shows the €-bearing copy.
- Commit: `feat(promotions): actionable min-spend rejection copy with amounts (R9-2, FR-402)`.

### Slice 3 — R9-3: cart shipping estimate by postcode (MEDIUM, FR-402)
- Seam: `packages/commerce/src/shipping-rates.ts` (NEW — the rates-table
  `ShippingRateProvider` adapter: resolve zone by country → weight-banded rate
  rows → `ShippingQuote[]` with white-glove forcing >30 000 g per the port
  contract; `product_variant.weight_g` rollup happens at the service boundary);
  `apps/web/src/actions/shipping.ts` (NEW — `estimateShippingAction({ country,
  postalCode })`: Zod input, `requireCart()`-scoped weight rollup, provider
  call, display-only quotes); `apps/web/src/components/cart-shipping-estimate.tsx`
  (NEW client island: country select + postcode input, 400 ms debounce — inside
  the FR-402 500 ms budget, aborts in-flight requests, renders
  method/eta/amount rows or the honest no-rates message).
- The estimate is DISPLAY-ONLY — it never mutates cart totals (`shippingMinor`
  stays null; placement keeps `shippingMinor: 0`, the documented goods-only
  decision). Rates render in the rate's own currency (zone-native EUR/USD/GBP;
  no FX in Phase 1).
- RED: integration spec (`shipping-rates.integration.test.ts`) — DK/US/GB
  zone resolution, weight bands (5 000 g boundary), white-glove forcing
  (>30 000 g returns exactly the forced quote), unknown country → empty
  quotes; action-level spec mirrors `cart.test.ts` mock idiom (validation
  failure, empty-cart, happy path); E2E: postcode entry renders an estimate
  row within the debounce budget.
- Commit: `feat(cart): postcode shipping estimate over the rates-table provider (R9-3, FR-402)`.

### Slice 4 — R9-4: PLP quick-add (MEDIUM, FR-206)
- Seam: `packages/commerce/src/catalog.ts` cards CTE gains a LEFT JOIN LATERAL
  picking the first purchasable variant (`is_default DESC, sku ASC` — the same
  variant ordering `getProduct` uses; purchasable = inventory available > 0 OR
  the made-to-order derivation `lead_time_days_max > 7` already used by the
  availability rollup) → `quickAddVariantId: string | null` on
  `ProductCardDto`; `apps/web/src/components/quick-add-button.tsx` (NEW client
  island: `addToCartAction({ variantId, qty: 1, requestId })` → opens the
  mini-cart drawer — the FR-305 add-to-cart contract; disabled + "Sold out"
  when `quickAddVariantId` is null; OUTSIDE the card link semantics per
  FR-206 a11y note); wired on `/shop` + `/shop/{category}` (journal
  related-products stay link-only — editorial context).
- RED: integration spec pins `quickAddVariantId` (default-variant-first when
  purchasable, null when every variant is out of stock — the seeded Hygge
  throw's sold-out Rust variant exercises the null path at product level via
  a fixture variant); E2E: quick-add on a shop card adds a line and opens the
  drawer; sold-out state renders a disabled control.
- Commit: `feat(shop): quick-add on PLP cards via first purchasable variant (R9-4, FR-206)`.

### Slice 5 — R9-5: sticky mobile add-to-cart bar (LOW, FR-309)
- Seam: `apps/web/src/components/product-buy-panel.tsx` — IntersectionObserver
  on the primary CTA row; when it scrolls below the viewport a fixed bottom
  bar renders with the selected variant's formatted price + an Add-to-cart
  button invoking the SAME `onAdd` handler (qty + selected variant shared
  state). Contains price + CTA only (FR-309); never overlaps the footer on
  short pages (the observer only fires when the CTA actually leaves view);
  `prefers-reduced-motion` respected (no slide-in animation); z-index above
  content, safe-area padding for notched devices.
- RED: E2E at 390×844 — bar absent initially, appears after scrolling the CTA
  out, shows the price, click adds to cart and opens the drawer; desktop
  viewport never shows the bar.
- Commit: `feat(pdp): sticky mobile add-to-cart bar after CTA scroll-out (R9-5, FR-309)`.

### Queued with rationale (not this round)
- **R9-6 (FR-305 wishlist)**: couples to the B9 account slice (saved-items
  surface + merge-on-login contract). A localStorage-only heart button would
  create UI debt the B9 slice immediately rewrites. Stays tracked in PAD §11
  under R-AUTH-1/B9 with this round's evidence attached.
- **R-SHOP-2 / R-DB-2 / R-SEC-1 / R-INV-1 / R-SHOP-3** unchanged (own sessions
  per PAD §11 priorities).

## Post-remediation verification (Definition of Done)

1. Full gates with env sourced inline: `pnpm lint typecheck test build` —
   8/8, 8/8, 7/7 (all suites live on embedded PG 17.5), 2/2.
2. Full local E2E both apps on a fresh build with
   `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000` (repo R6-2 convention):
   web (74 + new R9 specs) / admin 8/8.
3. Live re-check vs both origins; the awaiting-redeploy delta documented
   exactly as session_14 did.
4. `git ls-files | grep '^\.env$'` empty; `skills/` + `infrastructure/`
   untouched by every commit (`git diff --stat` per commit).
5. Docs aligned: PAD revision entry + §11 rows, traceability FR-201..208/
   FR-309/FR-401..406 rows, verification-ledger round-9 entry,
   AGENTS.md/CLAUDE.md conventions, session_16 narrative.

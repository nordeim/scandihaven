# Session 16 — Live E2E Round 9 (2026-09-12)

Continuation of session 14/15: round 8 was pushed (`5a5f73d`) and the deployment redeployed (the checked-in `start_server_log.txt` at HEAD `25ed42d` records the post-round-8 `./start_server.sh` runs). This session validates the round-8 deployment against the live origins, runs a fresh diagnostic sweep beyond the repo suite, and remediates what it finds — closing **R-CART-1 entirely**.

## Step 1 — Baseline & parity

Fresh clone at `25ed42d`; embedded PostgreSQL 17.5 provisioned (zonky binaries via `embedded-postgres@17.5.0-beta.15`, port 5488; initdb/pg_ctl driven directly — the library's `initialise()` fails in this sandbox; extensions pgcrypto+pg_trgm ensured through the repo's own `pg` client). Baseline gates green: lint 8/8, typecheck 8/8, tests 7/7 (integration live; 301 total), build 2/2. One environment lesson (re-recorded from session 14): `pnpm db:setup` needs `DATABASE_URL` exported in the invoking shell — dotenv resolves `.env` from CWD, and pnpm runs the db scripts from `packages/db`.

Repo Playwright suites vs the live origins: **storefront 74/74, admin 8/8 — the round-8 redeploy published everything** (session_14's 10 awaiting-redeploy deltas are closed; the single mid-session R8-6 failure was the spec's fixture reset missing `DATABASE_URL`, plus the live-side `back_in_stock` rate-limit bucket eventually exhausting across repeated live runs — environmental, see Step 5).

## Step 2 — Diagnostic sweep (beyond the repo suite)

A 23-probe sweep of surfaces the repo suite does not cover (cart promo/shipping surfaces, PLP card conversion surfaces, PDP mobile bar, JSON-LD/meta completeness, checkout honesty, sitemap parity, headers, TTFB). Result: **6 findings, every one validated against the code before classification**:

1. **R9-1 (MEDIUM, FR-404 — the R-CART-1 notice half)**: promo re-validation drop is silent — WELCOME100 applied at €747, qty reduced below €500, the −€100 row disappears with zero explanation (`role="status"` texts: `[""]`).
2. **R9-2 (MEDIUM, FR-402 acceptance)**: min_spend rejection copy not actionable — "This code requires a higher order subtotal to apply." with both amounts computable at the rejection site.
3. **R9-3 (MEDIUM, FR-402 — the R-CART-1 estimate half)**: cart shipping estimate by postcode absent — the `ShippingRateProvider` port, seeded zones/rates, and variant `weight_g` all exist; nothing implements the port; the cart shows a static "Calculated at checkout" row.
4. **R9-4 (MEDIUM, FR-206, UNTRACKED)**: PLP quick-add unwired — `ProductCard.quickAdd` slot shipped with the UI package, no page ever passes it (the same planned-never-wired class as round 8's footer newsletter).
5. **R9-5 (LOW, FR-309, untracked)**: sticky mobile add-to-cart bar absent at 390×844.
6. **R9-6 (MEDIUM, FR-305, tracked B9)**: wishlist secondary CTA absent — deferred with rationale (couples to the B9 merge-on-login contract).

Validated-healthy (no action): journal Article + BreadcrumbList JSON-LD with absolute canonical; PDP Product JSON-LD complete (offers + aggregateRating 4.5/2); collections canonical/og:url; search noindex (canonical absence is correct for §11.1); sitemap 22 `<loc>` all 200; security headers sitewide; 404 branded; typeahead; admin gate + CSP; TTFB 117–126 ms; cart drawer; WELCOME100 applies above threshold; checkout honest notice with zero address-form inputs.

Disproven during validation (probe artifacts, recorded): the "checkout address form" was the FOOTER newsletter form (R8-4); the canonical probes read `content` instead of `href` on `<link>` (fixed mid-sweep, both PASS); the empty status element was the footer newsletter's message container.

## Step 3 — TDD execution

Five slices, one atomic commit each, red-first at the closest behavioral seam (plan: `docs/plans/2026-09-12-live-e2e-remediation-round9.md`; full evidence per slice in `docs/verification-ledger.md` round-9 entry):

- **Slice 1 — R9-1** (`14fdea9`): `CartDto.promotionNotice` (server-composed, customer-safe) + cart-page labelled live region; 4 integration + 1 E2E specs red→green.
- **Slice 2 — R9-2** (`f699f50`): `humanizePromotionRejection(reason, context?)` — amount-bearing min_spend copy; byte-stability of other reasons equality-pinned; 4 unit specs + strengthened integration/E2E assertions red→green.
- **Slice 3 — R9-3** (`9ae07f5`): `commerce/shipping-rates.ts` (first `ShippingRateProvider` implementation: zone-by-country, weight bands, white-glove forcing) + `estimateShippingAction` (H1-CART discipline) + `CartShippingEstimate` client island (400 ms debounce, stale-drop, labelled live region); 7 integration + 6 action + 1 E2E specs red→green. Promo status regions gained distinct accessible names to keep strict-mode queries unique.
- **Slice 4 — R9-4** (`612dff2`): cards CTE LEFT JOIN LATERAL → `quickAddVariantId` (first purchasable variant, PDP derivation) + `QuickAddButton` wired on both PLP routes; 4 integration + 1 E2E specs red→green.
- **Slice 5 — R9-5** (`abb1a92`): buy-panel IntersectionObserver → sticky bottom bar (price + CTA only, `md:hidden`, safe-area, reduced-motion); 2 E2E specs red→green.

Three mid-slice lessons: (a) the always-rendered estimate live region broke the promo specs' bare `getByRole("status")` strict-mode queries — labelled regions are the fix, recorded in AGENTS.md/CLAUDE.md; (b) the quick-add spec's card-button count had to be taken BEFORE opening the drawer (the modal marks the page `aria-hidden` — buttons leave the accessibility tree); (c) hooks must be declared before the buy-panel's `!selected` early return (rules-of-hooks) — lint caught it, fixed before commit.

## Final verification

Gates green: lint 8/8 · typecheck 8/8 · tests 7/7 tasks (config 50, auth 19, admin 11, web 54, db 23, commerce 169 — **326 total, +25 vs round 8**; integration live on embedded PG 17.5) · build 2/2 · Playwright web **79/79** local (74 + 5 round-9 specs) · admin **8/8** local. `git ls-files | grep '^\.env$'` empty. `skills/` and `infrastructure/` untouched by every commit. Docs aligned: PAD v1.3 (revision entry + §11 rows — R-CART-1 closed, R9-4/R9-5 closed, R9-6 deferred to B9), traceability (FR-201..208 quick-add, FR-301..313 sticky bar, FR-401..406 R-CART-1 closure), verification-ledger round-9 entry, AGENTS.md/CLAUDE.md conventions.

## Summary

| ID | Finding | Fix | Evidence |
|---|---|---|---|
| R9-1 | Promo re-validation drop silent (discount disappears with no notice) | `CartDto.promotionNotice` + labelled cart live region | 4 integration + 1 E2E specs red→green; live probe reproduced the silent drop |
| R9-2 | min_spend rejection copy not actionable (no amounts) | `humanizePromotionRejection` amounts context — "You're €251.00 away from the €500.00 minimum…" | 4 unit + strengthened integration/E2E specs red→green |
| R9-3 | Cart shipping estimate by postcode absent | First `ShippingRateProvider` implementation + action + estimate island (display-only) | 7 integration + 6 action + 1 E2E specs red→green |
| R9-4 | PLP quick-add unwired (FR-206 M, untracked) | Cards CTE first-purchasable-variant LATERAL + `QuickAddButton` on both PLP routes | 4 integration + 1 E2E specs red→green |
| R9-5 | Sticky mobile add-to-cart bar absent (FR-309 S, untracked) | Buy-panel IntersectionObserver sticky bar (price + CTA, mobile-only) | 2 E2E specs red→green (390×844 + desktop negative) |
| R9-6 | Wishlist CTA absent (FR-305 M, tracked B9) | Deferred with rationale (couples to B9 merge-on-login) | Documented (PAD §11, plan §R9-6) |

## Step 5 — Post-push live re-check

Pushed to `origin/main` via the SSH wrapper (paramiko, `ssh_git_wrapper_v3.py`); parity verified (`git rev-parse HEAD origin/main` identical).

Live re-check: **web 74/79 vs live** — the 5 remaining failures are exactly the new round-9 specs awaiting redeploy (M1-PROMO amount-bearing copy, R9-1 notice, R9-3 estimate, R9-4 quick-add, R9-5 sticky bar); the R8-6 notify spec additionally fails vs live on the exhausted live-side 3/hour/IP `back_in_stock` bucket (this session's sweep + two full live suite runs consumed it; it passed vs live earlier in the session and 79/79 locally — environmental, not a regression). Admin **8/8 vs live** (behavior unchanged). Ops action: `./start_server.sh` (round 9 adds no migrations or seed rows — the redeploy only needs the fresh build).

**Suggested next steps:**
1. Redeploy via `./start_server.sh` to publish round 9.
2. **Carried ops action: rotate `BETTER_AUTH_SECRET`/`CRON_SECRET`** — 4th public exposure, history keeps the bytes.
3. Queue R-DB-2 (DDL constraints) as its own dedicated session; R-SHOP-2 (facet UI) next; R-SHOP-3 remainder after that; R9-6 wishlist with B9.

# Live E2E Remediation — Round 10 (2026-09-13)

> Parent audit: round-10 live validation (2026-09-13). Baseline: repo gates green
> (lint 8/8, typecheck 8/8, tests 7/7 — integration suites live on embedded
> PG 17.5, 326 tests; build 2/2). **Repo Playwright suites vs the live origins:
> storefront 77/79 then 78/79 (the single failure being this round's R10-1,
> intermittently), admin gate 8/8 PASS** — the round-9 redeploy (checked-in
> `start_server_log.txt`, HEAD `fc0379a`) published every round-9 fix (all five
> R9 specs pass vs live: promo notice, actionable copy, estimate, quick-add,
> sticky bar). Mid-audit the live storefront origin stopped answering (curl
> timeout, `net::ERR_ABORTED` on every navigation) while the live admin origin
> kept responding 307 — recorded as an ops observation below, not a code
> finding; local parity at the same HEAD is fully green (storefront 79/79,
> admin 8/8). Beyond the repo suite, a 47-probe storefront sweep + 12-probe
> admin sweep surfaced 5 findings, every one validated against the code before
> classification. Scope exclusions honored: `skills/` and `infrastructure/`
> untouched by checks, tests, and compilation.

## Findings (evidence-labelled)

| ID | Severity | Finding | Evidence | Label |
|---|---|---|---|---|
| **R10-1** | **MEDIUM — E2E spec quality (R9-5 spec, FR-309)** | **The sticky mobile add-to-cart spec is geometry-fragile and passes only by winning a hydration race.** The spec asserts "Initially the primary CTA is in view: no sticky bar" (`storefront.spec.ts:196-197`) — but at 390×844 the CTA row starts at ~1098 px (below the 844 px fold) on both local and live builds, so the bar legitimately renders at scroll 0 (correct FR-309 behavior: the CTA *is* out of view). The spec's `expect(barCta).toHaveCount(0)` passes only when its first poll lands before React hydrates and mounts the IntersectionObserver (probe: bar count 0 at t+0 ms, 1 at t+50 ms) — a ~50 ms window. Full-suite runs vs live lose the race intermittently (observed: 1 failed in run 2 of this audit; both isolated runs passed). | Geometry probe (×3 local, ×3 live: `cta.top=1098, inView=false, barVisible=true` consistently); hydration-race probe (count 0→1 across 50 ms); full-suite live failure with `Expected: 0, Received: 1` at `storefront.spec.ts:196` | Verified |
| **R10-2** | **HIGH — FR-508/509 (R8-1 contract gap), money path** | **The checkout "not configured" notice renders operator instructions to customers.** When the publishable key is unset or a `set-me` placeholder, `checkout-flow.tsx:60-74` renders: "Set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env` with test-mode keys (`sk_test_…` / `pk_test_…` from the Stripe dashboard), then restart the dev server. Card 4242 4242 4242 4242 completes a test purchase." — env-var names, the `.env` file, restart instructions, and a test card number in the customer-facing DOM. The R8-1 fix sanitized the *action* path (`actions/checkout.ts:53-64` logs operator detail server-side, returns customer-safe copy) but the client *static* branch kept the operator copy; AGENTS.md's R8-1 convention says `STRIPE_NOT_CONFIGURED` surfacing to the browser must be customer-safe. The live deployment runs placeholder keys, so live customers see this copy. The R8-1 E2E spec only pins that the notice renders and the address form does not — it never pins the copy's customer-safety, which is why the leak survived two rounds. | DOM probe with a cart item (local prod build, same HEAD as live): rendered text captured verbatim above; code: `apps/web/src/components/checkout-flow.tsx:60-74`; asymmetry vs `apps/web/src/actions/checkout.ts:53-64` | Verified |
| **R10-3** | **LOW — search relevance (FR-105 implemented as specified; quality gap)** | **Synonym-expanded terms match B-weight description text, surfacing false positives.** `q=lamp` returns the Hygge Wool Throw (via seeded `lamp→lighting` synonym → stem `light` matching "light enough to sleep under" in the throw's description) alongside the Øresund lamp; `q=rug` returns the Øresund lamp (via `rug→throw` → "throws a soft, low glow" — the verb). Both `listProducts` and `searchTypeahead` map *every* expanded term through the full `search_vector @@ websearch_to_tsquery(...)` condition (title A / materials+desc B weights). A customer searching "lamp" should not be offered a throw. | API probes: `?q=lamp` → `[oresund-table-lamp, hygge-wool-throw]`, `?q=rug` → `[oresund-table-lamp, hygge-wool-throw]`; code: `catalog.ts:158-167` + `catalog.ts:575-591` (all terms share the vector condition); seed: `ensure-seeded.ts:598-603` (synonym rows), throw description "light enough to sleep under", lamp description "throws a soft, low glow" | Verified |
| **R10-4** | **MEDIUM-LOW — PRD §11.1 acceptance ("per-page `og:*`, `twitter:*`")** | **Public pages that use `publicPageMetadata` carry no per-page twitter card — the root layout default wins, so shared links to `/shop`, `/collections`, `/journal`, category PLPs, and static pages all show the home title/description.** Probe: `/shop` renders `twitter:title = "Scandi Haven — Slow Living, Beautifully Made"` (the layout default) while the page's own og:title correctly reads "Shop all". `seo.ts:publicPageMetadata` emits the full `openGraph` object but no `twitter` — the segment's openGraph replaces wholesale (correct), but twitter is never overridden, so the layout's `twitter: { card: "summary", title: DEFAULT_TITLE, … }` covers every public page with home copy. | DOM probes: `/shop` + `/collections` twitter:title both the default; code: `apps/web/src/lib/seo.ts:34-47` (no twitter field), `apps/web/src/app/layout.tsx:48-58` (default twitter with DEFAULT_TITLE) | Verified |
| **R10-5** | **MEDIUM — E2E spec robustness (R8-6 spec, FR-310)** | **The back-in-stock spec hard-depends on a local DB even when the suite targets a live origin.** The spec's fixture reset (`storefront.spec.ts:351-354`) unconditionally deletes `rate_limit_hit` rows through the repo's db client: with `DATABASE_URL` unset or non-local it throws (`AggregateError` connection failure) and fails the spec against a target the reset cannot affect anyway (a live origin's limiter lives in its own DB — session 16 documented the same failure class: "the spec's fixture reset missing `DATABASE_URL`" plus eventual live-side bucket exhaustion). Vs-live runs should not require a local PG. | First live run of this audit: spec failed with `Failed query: delete from "rate_limit_hit"… [cause]: AggregateError`; passed only after exporting a local `DATABASE_URL` (which reset a *local* bucket, irrelevant to the live limiter) | Verified |

Validated-healthy (no action): PLP sort URLs (`newest`/`price_asc`/`price_desc` honored, `bestselling` + bogus values fall back honestly, `?page=2` 200); quick-add wired on both PLP routes (6 buttons on `/shop`, 1 on `/shop/lighting`); R9-2 actionable min-spend copy ("You're €351.00 away from the €500.00 minimum…"); R9-3 postcode estimate renders banded options (Standard/Express/Pickup); R9-1 promotion notice region; `sh_cart` cookie httpOnly+SameSite=Lax+Secure; promo status regions labelled; typeahead structured groups (products/categories/journal) with empty-q guard; `/api/jobs/run` 401 without secret; `/api/health` db:true; CSP+HSTS+XCTO on every probed route; PDP Product JSON-LD (offers + aggregateRating 4.5) + BreadcrumbList; PLP BreadcrumbList (R8-3); sitemap 22 `<loc>` all 200; robots.txt UA:* group + Sitemap line; journal article canonical + og:url absolute; search noindex (correct per §11.1); `/account` gate with `?redirect=`; admin gate 307 on all five protected routes + forged-session bounce + sign-in 200 + CSP + typed wrong-credentials error; zero client console/page errors across eight key routes; a11y spot-probes (img alt, button names, single h1) clean.

Disproven during validation (probe artifacts, recorded): "P2 facet noindex missing" — known-open R-SEO-1, blocked by R-SHOP-2 (no facet UI emits facet URLs; the params are inert); "P7 typeahead sofa synonym dead" — no sofa product exists in the demo catalog, empty is honest (the R7-4 integration spec pins the synonym with its own fixture sofa); "P11 robots missing UA:*" — case-sensitive probe regex vs the spec-correct `User-Agent: *` (R5-1 group-aware rule holds); "P12 journal article canonical missing" — the probe URL `/journal/design-notes/the-halden-story` was invented; real slugs (`/journal/craft/the-slow-chair`) render canonical + og:url; honest 404 is FR-201 behavior; "P13 redirect guard" — the sign-in page holds `?redirect=` in the URL until submit-time validation (E2E-5 pins the validated path); "A7 wrong-creds no typed error" — the error renders as body text, not `role=alert`; the repo spec's `toContainText(/invalid|…/)` passes.

Known-open re-confirmations (not new findings, unchanged): R-SEO-1 facet indexing (blocked by R-SHOP-2); R9-6 wishlist (deferred → B9); R8-8 cross-sell (queued); og:image default for non-PDP pages — deferred: no brand social-card asset exists in `public/` (only per-product SVGs; og:image wants a real raster brand card, a design task, not a code slice).

Ops observation (not a code finding): the live storefront origin (`https://scandihaven.jesspete.shop`) stopped answering during the audit (every request timing out at the edge, `net::ERR_ABORTED` in Chromium) while the live admin origin kept responding (gate 307, sign-in 200, suite 8/8). Local parity at the same HEAD is fully green, so this is a deployment-side condition — **ops action: inspect the storefront process on the deployment host (`tail server.log`) and re-run `./start_server.sh` if it has exited or hung.** Carried ops action from session 16: rotate `BETTER_AUTH_SECRET`/`CRON_SECRET` (history keeps the exposed bytes).

## Remediation plan (TDD — one atomic commit per slice)

Seams pre-validated against the codebase (file-by-file) before this plan was
committed to disk. Every slice is red-first at the closest behavioral seam:
pure helpers unit-tested, DB-backed seams integration-tested, surfaces E2E-tested
against a production build (repo convention).

### Slice 1 — R10-2: customer-safe checkout unconfigured notice (HIGH, FR-508/509)
- Seam: `apps/web/src/components/checkout-flow.tsx:60-74` (the `!stripePromise`
  static branch). The copy becomes customer-safe and honest: "Online payments
  are temporarily unavailable. Please contact us to complete your order —
  your cart is saved." — mirroring the sanitized action-path message
  (`actions/checkout.ts:62`). No env-var names, no `.env`, no restart/dev-server
  language, no test card number anywhere in the client bundle.
- RED: extend the R8-1 spec block in `apps/web/e2e/storefront.spec.ts` —
  assert the new notice text AND `expect(page.getByText(/STRIPE_SECRET_KEY|\.env|dev server|4242/)).toHaveCount(0)`
  scoped to the checkout main. Fails against HEAD (the leak is present).
- GREEN: swap the static branch copy. The existing honest-notice spec
  (`checkout surfaces configuration state honestly…`) updates its expected
  text in the same slice — it pins customer-facing copy, which is exactly
  what this slice fixes.
- Commit: `fix(checkout): customer-safe unconfigured notice — operator detail out of the DOM (R10-2, FR-508/509)`.

### Slice 2 — R10-1: sticky-bar spec asserts observer derivation, not a hydration race (MEDIUM)
- Seam: `apps/web/e2e/storefront.spec.ts:183-217` (R9-5 describe block). The
  mobile spec becomes geometry-independent: scroll the buy-panel CTA row INTO
  view (`scrollIntoViewIfNeeded`) → the bar must hide (CTA visible ⇒ no bar);
  scroll it out → the bar must appear; click the bar CTA → drawer opens with
  the selected variant (unchanged). Remove the false "initially in view"
  assumption; the desktop negative spec stays.
- RED-first evidence: current spec fails a full live-suite run (captured
  above); the rewritten spec asserts both derivation directions and cannot
  pass pre-hydration (the bar CTA's presence is only asserted *after* a
  deliberate scroll-away, which requires hydration to have happened).
- Product code is CORRECT (FR-309: bar appears when the CTA is out of view —
  including at load on short viewports) — spec-only change, no product diff.
- Commit: `test(pdp): sticky-bar spec asserts observer derivation both ways — kills the hydration race (R10-1)`.

### Slice 3 — R10-5: back-in-stock spec fixture reset scoped to loopback targets (MEDIUM)
- Seam: `apps/web/e2e/storefront.spec.ts:344-355` (fixture reset). The reset
  only runs when the suite targets a loopback origin (`E2E_BASE_URL` unset or
  localhost/127.0.0.1 — the rate-limit bucket it clears lives in the local
  DB behind the local server); against live origins it is skipped with a
  logged note. Connection failure during a local reset stays a failure
  (honest), but a vs-live run no longer requires any local PG.
- RED-first evidence: this session's first live run (spec failed on the
  connection error); after the change, vs-live runs pass without
  `DATABASE_URL` (verified in this round's execution step).
- Commit: `test(e2e): back-in-stock fixture reset scoped to loopback targets (R10-5)`.

### Slice 4 — R10-4: per-page twitter metadata in `publicPageMetadata` (MEDIUM-LOW, PRD §11.1)
- Seam: `apps/web/src/lib/seo.ts:34-47` (pure builder) — `publicPageMetadata`
  gains `twitter: { card: "summary", title: resolvedTitle, description:
  resolvedDescription }` so every public page's card carries ITS OWN title
  instead of the layout default. og:image default deferred (no brand
  social-card asset exists — design task, recorded above).
- RED: unit spec in `apps/web/src/lib/seo.test.ts` (the file is the pure-seam
  unit-test convention) — `publicPageMetadata({ path: "/shop", title: "Shop all" })`
  returns `twitter.title === "Shop all"`; fails against HEAD (no twitter
  field). E2E: `seo-flows.spec.ts` gains an assertion that `/shop`'s
  `twitter:title` equals the page title (not the default).
- Commit: `feat(seo): per-page twitter cards via publicPageMetadata (R10-4, PRD §11.1)`.

### Slice 5 — R10-3: title-scoped synonym matching (LOW, FR-105 relevance)
- Seam: `packages/commerce/src/search-terms.ts` (`expandSearchTerms` returns
  `{ original, synonyms }` — the pure seam's unit tests evolve with it) +
  `packages/commerce/src/catalog.ts` `listProducts`/`searchTypeahead`
  conditions: the ORIGINAL query keeps the full contract (maintained
  `search_vector` A/B + trigram + ILIKE); SYNONYM-EXPANDED terms match the
  TITLE only (`title ILIKE %term%` OR `similarity(title, term) >= 0.5`) —
  no ad-hoc `to_tsvector` (R-DB-1 preserved), and product-level synonyms
  (`couch→sofa`, `rug→throw`) keep working exactly as the R7-4 spec pins
  (the fixture sofa matches by title).
- RED: integration specs in `search-depth.integration.test.ts` — `q=lamp`
  must NOT surface the Hygge Wool Throw, `q=rug` must surface the throw but
  NOT the Øresund lamp (both fail against HEAD — the false positives are the
  current behavior); the existing couch→sofa specs must stay green
  (regression guard).
- Commit: `fix(search): synonym-expanded terms match titles, not descriptions (R10-3)`.

### Deferred with rationale
- **og:image default for non-PDP pages** (found with R10-4): no brand
  social-card raster asset exists in `public/`; minting one is a design task.
  PDPs already emit their product image; home carries the layout default.
- **R-SEO-1 facet noindex**: unchanged, blocked by R-SHOP-2 (facet UI).
- **R9-6 wishlist / R8-8 cross-sell**: unchanged deferrals (B9 / queued).

## Execution order

Slices run in severity order: R10-2 → R10-1 → R10-5 → R10-4 → R10-3. After
each slice: `pnpm lint typecheck test` (scoped to touched workspaces for
speed where honest), full gates before commit, atomic commit per slice.
Final verification: full `pnpm lint typecheck test build`, full Playwright
web + admin suites locally, and the vs-live suites re-run once the storefront
origin recovers (ops action above). Docs aligned after execution: PAD §11
rows + revision entry, traceability FR-508/509 + FR-309 + FR-105 + §11.1 rows,
verification-ledger round-10 entry, AGENTS.md/CLAUDE.md conventions (R8-1
convention gains "the client static branch is part of the contract"; sticky-bar
spec convention), session_17 record.

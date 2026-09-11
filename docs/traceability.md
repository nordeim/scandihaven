# Requirements Traceability Matrix (PRD §14.2)

Full FR → implementation locus → verification → status matrix, maintained from the 2026-09-08 alignment audit (per PRD §14.2 "from Phase 1"). Statuses: **Aligned** (implemented + verified), **Drift** (code differs from spec), **Stub** (typed placeholder naming its FR ID), **Deferred** (planned Phase 1–5 surface, not yet stub-named — tracked in the remediation backlog), **Unverifiable** (needs staging/secret/live vendor).

Audit evidence: `docs/audits/2026-09-08-prd-alignment/` · `docs/audits/2026-09-09-e2e-live-site-audit/` (live E2E, both apps) · Evidence log: `docs/verification-ledger.md` · Backlog: `docs/plans/2026-09-08-remediation-plan.md`.

## Storefront (PRD §5)

| FR | Requirement | Locus | Verification | Status |
|---|---|---|---|---|
| FR-101 | Sticky global header | `apps/web/src/components/site-header.tsx` | E2E home render + `search-flows.spec.ts` header-search suite (round 6) | Aligned — header now carries search (R6-2) |
| FR-102 | Hamburger / nav dialog | `apps/web/src/components/mobile-nav.tsx` (Radix drawer via `@scandihaven/ui/drawer`), wired in `site-header.tsx` | E2E at 390×844: trigger visible, drawer exposes all four primary links, link navigates (storefront.spec "mobile navigation (FR-102)") | **Aligned (core) — implemented 2026-09-10 (E2E-6): the row previously claimed "Aligned" via `site-header.tsx`, but no menu existed anywhere (live-verified at 390px: header had only logo/Account/cart)** |
| FR-103 | Mega-menu with featured media | `nav_entry` schema + `content.ts` | — | Deferred (schema-ready) |
| FR-104 | Typeahead ≥2 chars, ≤10 results | `apps/web/src/app/api/search/typeahead/route.ts` + `commerce/catalog.searchTypeahead`/`searchTypeaheadCategories`/`searchTypeaheadJournal` + `apps/web/src/components/search-trigger.tsx` (pure shaping in `apps/web/src/lib/search-suggest.ts`) | route Zod contract; rate-limited 60/min/IP; **header combobox Aligned (round 6, R6-2)** — 250 ms debounce, ARIA 1.2 listbox, keyboard-navigable; **journal group live since round 7 (R7-2): rows link to the category-scoped FR-703 reader route** | **Aligned (rounds 6–7)** |
| FR-105 | Search typo tolerance / synonyms | `commerce/src/search-terms.ts` (`expandSearchTerms`, pure) + `catalog.listProducts`/`searchTypeahead` conditions | 7 unit specs (`search-terms.test.ts`) + 5 integration specs (`search-depth.integration.test.ts`: couch→sofa synonym hit, typo tolerance ≥0.5, typeahead parity, exact FTS, DDL assertions) + 3 E2E specs; R7-4 2026-09-11 | **Aligned (round 7, R7-4)** — maintained `search_vector` (R-DB-1) + `pg_trgm` union + `search_synonym` expansion; partial two-word typos honestly stay below 0.5. (Historical correction, 2026-09-10 E2E audit: this row previously described the announcement bar — that is FR-108) |
| FR-106 | Search results page `/search?q=` | `apps/web/src/app/search/page.tsx` over `commerce/catalog.listProducts({search})` | E2E `search-flows.spec.ts` (13 specs: results, shareable sort URL, empty state, short query, noindex, category guidance + header typeahead suite from round 6) | **Aligned (round 4, 2026-09-10 R4-5)** |
| FR-107 | Footer newsletter | `apps/web/src/actions/newsletter.ts`, rendered by `apps/web/src/app/page.tsx` (home page, not the footer component) | ActionResult contract; 3/hour/IP limiter; live-verified 2026-09-09 (submit → "Thank you — please check your inbox to confirm.") | Aligned (double opt-in message = Phase 1); **placement note (2026-09-09 round 2): the form lives on the home page, not the footer partial — footer itself carries link groups only** |
| FR-108 | Announcement bar | `site-header.tsx` + seed | rendered (live-verified 2026-09-09) | Aligned; dismissal (Zustand persist) = Deferred |
| FR-109 | 404/500 honest pages | `apps/web/src/app/not-found.tsx` (server component), `lookbooks/[[...slug]]` + segment not-found, `error.tsx`, **`global-error.tsx` (both apps, E2E-1 2026-09-10) + stale-chunk self-heal (`@scandihaven/config/chunk-recovery`)** | E2E asserts the SSR body contains the branded 404 + recovery paths (M-404 fix); /lookbooks SSR names FR-705; **chunk-recovery decision unit-tested in config** | Aligned (SSR 2026-09-09; root-level branded boundary + chunk self-heal 2026-09-10) |
| FR-201..208 | PLP: routes, sort, pagination | `apps/web/src/app/shop/*` + `commerce/catalog.listProducts` | E2E plp + category; **card price = default variant (E2E-4, 2026-09-10: `MIN(vp.amount)` rollup advertised the cheapest variant — live lamp card said €229 while PDP/JSON-LD/quick-add said €249; `catalog-price.integration.test.ts` pins the default-variant rollup with MIN fallback)** | Aligned (core, incl. card-price consistency); **known-empty categories render a 200 empty state since R5-3 (2026-09-10: `hasActiveCategory` seam — the sitemap lists every active category, so a product-less one must resolve; unknown/inactive slugs still 404; pinned by `catalog-category.integration.test.ts` + `storefront.spec.ts` "empty vs unknown")**; facets UI/URL rules, bestselling via `product_metrics` = backlog B4/Deferred |
| FR-301..313 | PDP: gallery, swatches, price, JSON-LD, lead time | `apps/web/src/app/products/[slug]/page.tsx`, `product-buy-panel.tsx` | E2E pdp; JSON-LD asserted | Aligned (core); lead time now data-driven (FR-304); `?variant=SKU` (FR-302); **canonical/og:url/og:image/twitter absolute via request-scoped origin + BreadcrumbList JSON-LD (round 4, R4-6/R4-8, `seo-flows.spec.ts`)**; gallery >4 thumbs, Notify-me/preorder, legacy 301 = Deferred |
| FR-401..406 | Cart: drawer, promo codes, totals | `apps/web/src/components/cart-*`, `commerce/cart-service`, `pricing` | property tests; E2E cart persistence; **cart-flows E2E spec (2026-09-10 round 3: 4 specs repaired for strict-mode price assertions — the dc15724 versions never ran green, CI E2E step red since)** | **Aligned (core) after H1-CART fix (2026-09-09 round 2): `requireCart()` fed the resolved cart UUID back into token-keyed `ensureCart()`, so every mutation after the first add hit a junk cart — qty changes 404'd, removes resurrected on reload, repeat-adds were silently lost (live-verified); fixed + pinned by `apps/web/src/actions/cart.test.ts` wiring tests and `apps/web/e2e/cart-flows.spec.ts` (now actually green: 22/22 local, CI un-red pending push).** Promo min-spend re-validated on every cart read + at placement (E2E-3, 2026-09-10: live cart showed −€100 below the €500 minimum); applied-code status now derives from server truth. Optimistic rollback (FR-401), merge-on-login wiring (FR-403), gift wrap line (FR-405), re-validation notice (FR-404) = backlog B5/Deferred; promo rejection copy humanized (M1-PROMO, 2026-09-09 round 2) |
| FR-501..512 | Checkout: Payment Element, webhook placement, re-verification | `apps/web/src/actions/checkout.ts`, `commerce/checkout-service`, `api/webhooks/stripe` | §7.11 gate with promotions now symmetric; integration suites (CI); **E2E-3: placement prices from the re-validated promotion set (2026-09-10)** | Aligned (core); express pay (502), guest attach (503 full), autocomplete (504), FX lock (**505** — corrected from "504" here, 2026-09-10), abandoned-cart (511), success proof token (510) = Deferred; §8.7 review-orphan path = backlog B2. **Live note (2026-09-10 E2E audit): /checkout hard-crashed post-hydration on the deployment (stale chunk 404 — rebuilt without restart); code adds branded global-error + one-reload self-heal; the redeploy is the ops fix** |
| FR-601..609 | Accounts | `packages/auth`, `sign-in`, `account` | auth route adapter test; RBAC suite; **E2E: /account gate now carries `?redirect=%2Faccount` and the storefront sign-in honours it through the shared same-origin validator (FR-602; E2E-5, 2026-09-10 — the admin's raw-param `router.push` open-redirect closed at the same time)** | **Aligned core (auth route mounted 2026-09-08)**; magic link, zxcvbn, wishlist/addresses/reorder = backlog B9/Deferred |

## Content (PRD §6.2)

| FR | Requirement | Locus | Verification | Status |
|---|---|---|---|---|
| FR-701..704 | Homepage sections, collections, journal | `apps/web/src/app/(home)`, `collections`, `journal`, `journal/[category]/[slug]` | E2E home; collection grid SQL-filtered via `listProducts({ ids })` (M-COL); **journal reader route + index links + Article JSON-LD + sitemap/typeahead integration since round 7 (R7-2): 5 E2E specs in `journal-flows.spec.ts`** | Aligned (core) — **FR-703 reader route shipped round 7 (was Deferred; index previously rendered unlinked posts and the route 404'd — live-verified)** |
| FR-704 | Static pages (Our Story, Sustainability, Materials, Showrooms, Trade Program, FAQ, Shipping, Returns, Privacy, Terms, Cookies, Accessibility) | `apps/web/src/app/[slug]` + seed | E2E asserts all twelve resolve 200 + accessibility statement copy (`storefront.spec.ts` "static pages — FR-704 full dozen", round 7 R7-3); `packages/db/src/seed-coverage.test.ts` pins the seed rows | **Aligned (round 7, R7-3) — the six missing pages seeded (sustainability, materials, showrooms, trade-program, cookies, accessibility previously 404'd live); admin management (FR-809) stays the mechanism** |
| FR-706 | Redirect manager + loop detection | `redirect` schema table | — | Deferred (proxy wiring Phase 1) |

## Admin (PRD §6.3)

| FR | Requirement | Locus | Verification | Status |
|---|---|---|---|---|
| FR-801 | Dashboard skeleton | `apps/admin/src/app/page.tsx` | — | Aligned (skeleton); **deployment note (H2-ADMIN fix, 2026-09-09 round 2): the canonical `/admin`-prefixed URL now resolves via beforeFiles rewrites in `apps/admin/next.config.ts` (post-sign-in landing previously 404ed because the app has no `/admin` routes) — gate contract pinned by `apps/admin/src/lib/sign-in-paths.test.ts` + `apps/admin/src/next-config.test.ts`; requires redeploy to take effect on the live site** |
| FR-802 | Product edit (slug/SEO/status) | `apps/admin/src/actions/products.ts` | audit-logged; Zod | Aligned |
| FR-803 | Inventory adjustments ledgered | `products.ts` + `inventory_movement` (reason `adjustment`) | movement row written | Aligned (single-variant scope; full UI = Deferred) |
| FR-806/807 | Order lifecycle transitions | `apps/admin/src/actions/orders.ts` + `commerce/order-state` | exhaustive transition tests; server-authoritative + stale-form CONFLICT (2026-09-08) | Aligned |
| FR-805 | Sale windows, CSV import | — | — | Deferred |
| FR-808/809 | Returns workflow, content lifecycle | — | — | Deferred |
| FR-810 | Promotion invariants | `commerce/pricing` + `promotions` | property tests (cap, conservation, tiers, duplicate-id guard); **`filterEligiblePromotions` re-validation unit + integration tests (E2E-3, 2026-09-10)** | Aligned; **conditions now re-evaluated on every cart read and inside placement (E2E-3)**; usage-limit counting = backlog B3 |
| FR-811..815 | Gift cards, reporting, customers stub, settings, fraud | `apps/admin/src/app/customers/page.tsx` (typed FR-814 stub) | — | Deferred (FR-814 stubbed) |

## Trade & Post-purchase (PRD §6.4–6.5)

| FR | Requirement | Locus | Verification | Status |
|---|---|---|---|---|
| FR-901..906 | Trade/B2B program | `user.trade_status`, RBAC `trade:review`, trade tables | schema-level only | Deferred (Phase 5; traceability now names them — README overclaim fixed) |
| FR-910 | Status emails via outbox | `checkout-service` confirmation job + `packages/email` | integration job tests (CI) | Aligned (order confirmation); shipment template present, other statuses = Deferred |
| FR-911..914 | Tracking, returns portal, review email, back-in-stock | — | — | Deferred (Phase 1/5) |

## Cross-cutting contracts (PRD §4.8, §8, §9)

| Contract | Locus | Verification | Status |
|---|---|---|---|
| Provider ports (6) + vendor confinement | `commerce/providers.ts`, `search-provider.ts`, `checkout-service` (Stripe), `email/send.ts` (Resend) | ports tests 13/13 | Aligned |
| Feature flags fail-fast | `packages/config/flags.ts` + `instrumentation.ts` (boot) | 22 flag tests; boot wiring added 2026-09-08 | Aligned |
| Env fail-fast | `packages/config/env.ts` + `instrumentation.ts` | boot wiring added 2026-09-08 | Aligned |
| Idempotency matrix | `webhook_event` unique, cart requestId dedupe (5 min), `job.idempotency_key`, newsletter citext | schema + unit tests | Aligned |
| Outbox drainer | `commerce/jobs.ts` + `/api/jobs/run` (timing-safe CRON_SECRET) | integration suite (FOR UPDATE SKIP LOCKED, backoff, dead-letter, concurrency) — runs in CI | Aligned |
| Rate limits §9.4 | `commerce/rate-limit.ts` + typeahead + newsletter | window-math unit tests + integration (CI) | Aligned (typeahead/newsletter); auth/checkout/trade classes = backlog |
| Security headers §9.3 | `packages/config/security-headers` + both proxies | config tests (HSTS preload, CSP, manifest); **CSP now allow-lists the edge-injected Cloudflare Insights beacon (E2E-7, 2026-09-10 — blocked scripts logged violations on every live pageview)** | Aligned (nonce CSP = Phase 1 hardening) |
| Money §7.2 | `commerce/money.ts`, `pricing.ts` | property tests + schema test | Aligned |
| Order state machine §7.7 | `commerce/order-state.ts` | exhaustive tests; engine authoritative | Aligned |
| Checkout amount re-verification §7.11 | `checkout-service.placeOrderFromWebhook` | symmetric promotions pricing (2026-09-08); integration (CI) | Aligned (core); §8.7 review-orphan path = backlog B2 |

## SEO / Analytics / i18n (PRD §11)

| Area | Status |
|---|---|
| Metadata/canonical (sitewide) | Aligned (path); **E2E-8 boot guard added 2026-09-10 (`productionSiteUrlWarning` in both apps' instrumentation): production boots with unset/localhost `NEXT_PUBLIC_SITE_URL` log an actionable warning — the live site was serving localhost canonicals; setting the env var is the ops fix**; **round 4 (R4-6, 2026-09-10): `resolveSiteUrl` in `@scandihaven/config/site-url` + `apps/web/src/lib/site-origin.ts` — PDP canonical/og:url/og:image are now ABSOLUTE and derived from the served origin when the env var is unset (localhost-only as last resort); pinned by `seo-flows.spec.ts`**; **round 5 (R5-2, 2026-09-10): the request-scoped origin moved into the root layout's `generateMetadata` (`metadataBase = currentSiteUrl()`), completing R4-6 sitewide — home/PLP/category/collections/journal/static pages previously emitted og:url bound to the build-time localhost fallback AND no canonical; now every public page declares a canonical + per-page og:url via the pure `publicPageMetadata()` builder (`apps/web/src/lib/seo.ts`, unit-tested) — a segment-level openGraph REPLACES the layout object in Next, so the builder emits the full og block; pinned by 8 sitewide `seo-flows.spec.ts` cases (assert against the SERVED origin, hold with or without the env var)** |
| robots noindex on cart/checkout/account/admin/search | Aligned (search page noindex added round 4, R4-5) |
| sitemap.ts / robots.ts / Organization+WebSite+BreadcrumbList JSON-LD | **Aligned (round 4, 2026-09-10, R4-3/R4-4/R4-8)**: `app/sitemap.ts` (products/categories/collections/journal/static, daily, products weighted highest, private surfaces excluded; `commerce/catalog.listSitemapEntries` pinned by real-PG integration suite) + `app/robots.ts` (disallow admin/account/cart/checkout/search/api + sitemap ref) + sitewide Organization/WebSite(SearchAction) in root layout + BreadcrumbList on PDP — pinned by `seo-flows.spec.ts` (7 specs). **Ops: Cloudflare Managed Robots overrides the app robots.txt when the zone feature is on — merge the `Sitemap:` line into the CF ruleset or disable the override**; facet index rules (FR-203 noindex≥2) + Article JSON-LD remain Deferred (no facet UI / no article routes yet). **Round 5 (R5-1/R5-3, 2026-09-10): the robots E2E blanket-disallow assertion is now GROUP-aware (a live zone may legitimately prepend CF per-bot `Disallow: /` blocks — the unscoped line regex false-positived there and left the repo suite red vs live); a sitemap-parity spec asserts every advertised `<loc>` returns 200** |
| Analytics `order_completed` server-authoritative | Aligned (TX-embedded); typed `track()` client module | Deferred (B8) |
| i18n (next-intl, hreflang) | Deferred (B8); `FEATURE_I18N` default documented as unimplemented |

## 2026-09-09 audit pass updates (docs/audits/2026-09-09-code-review-security-audit/)

| Contract | Change | Status |
|---|---|---|
| §9.3 security headers | Proxy convention file relocated to `src/proxy.ts` (repo-root placement was never registered — headers were inert in every prior build); PDP matcher exemption narrowed to `products/*.svg`; headers verified at runtime on 200s and 500s | **Aligned (runtime-verified)** |
| §9.4 render sanitization | `@scandihaven/commerce/rich-text` allow-list sanitizer + JSON-LD escaper wired to all six innerHTML sites (comments previously claimed sanitization that did not exist) | **Aligned** |
| §8.7 webhook-after-abort | `webhook_event` insert moved inside the placement TX; mismatch/stock failure places the order in `review` + `payment_orphan` job (slice R6; B2 remainder = reconciliation tooling) | **Aligned (core)** |
| FR-403/§7.4 cart identity | Production DB-pool caching fixed (fresh Pool per query previously exhausted connections — root cause of live intermittent 500s) | **Aligned** |
| §9.2 admin gate | `(staff)` route-group layout; `/sign-in` ungated but header-covered; root-layout redirect loop eliminated | **Aligned** |
| §13.3 CI gates | Secret-scan gate un-inverted (rg exit semantics) + non-placeholder secret patterns; `.env`/`.env.local` untracked with rotation flagged | **Aligned** |
| FR-302 PDP variant deep link | `useSyncExternalStore` URL read (hydration-safe) | **Aligned** |
| FR-509 order numbers | `split_part` sequence extraction (was off-by-one at seq ≥ 100,000) | **Aligned (CI-verified)** |

## Known deviations recorded (honest ledger)

1. Coverage gate `include` is the 5 pure domain modules (documented in `packages/commerce/vitest.config.ts`); DB-backed services are covered by the CI integration layer (jobs, promotions seam, rate limit) rather than whole-package thresholds.
2. CSP carries `unsafe-inline` for Next.js bootstrap scripts until strict nonce CSP lands (Phase 1 hardening, §9.3 note in code).
3. `request-dedupe` is per-instance in-memory (documented in-code; multi-instance upgrade path named).
4. Two-factor auth and magic link are Phase 1 deferrals (in-code comments) — now tracked here instead of a non-existent ledger file.
5. Reservation protocol (§7.6 two-phase) is the top backlog slice (B1): placement currently decrements on-hand under lock (no oversell) but does not hold a reserved window or release on cancel.
6. 2026-09-09 audit additions to the honest ledger: free_shipping/tiered promotions are silent no-ops end-to-end (M1d); shipping is not charged (`shippingMinor: 0` both totals paths — goods-only launch decision needed, H4-doc); jobs lack a running-lease reaper (M4d); promotion usage limits are not enforced at placement (H3d/B3).
7. 2026-09-10 live-E2E audit additions: CI's E2E (Chromium) step was red on every run since dc15724 (4 cart-flow specs used page-wide price text that legitimately matches line total + subtotal + total — never ran green); the live deployment had rebuilt without restarting, 404-ing the /checkout chunk (ops: `./start_server.sh` kills+restarts — never `pnpm build` over a running server); `NEXT_PUBLIC_SITE_URL` unset in the deployment env (canonicals resolved to localhost; env var + boot warning now in place). Evidence: `docs/audits/2026-09-10-live-e2e-audit/`, plan: `docs/plans/2026-09-10-live-e2e-remediation.md`.

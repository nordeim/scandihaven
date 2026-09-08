# Requirements Traceability Matrix (PRD §14.2)

Full FR → implementation locus → verification → status matrix, maintained from the 2026-09-08 alignment audit (per PRD §14.2 "from Phase 1"). Statuses: **Aligned** (implemented + verified), **Drift** (code differs from spec), **Stub** (typed placeholder naming its FR ID), **Deferred** (planned Phase 1–5 surface, not yet stub-named — tracked in the remediation backlog), **Unverifiable** (needs staging/secret/live vendor).

Audit evidence: `docs/audits/2026-09-08-prd-alignment/` · Evidence log: `docs/verification-ledger.md` · Backlog: `docs/plans/2026-09-08-remediation-plan.md`.

## Storefront (PRD §5)

| FR | Requirement | Locus | Verification | Status |
|---|---|---|---|---|
| FR-101 | Sticky global header | `apps/web/src/components/site-header.tsx` | E2E home render | Aligned |
| FR-102 | Hamburger / nav dialog | `site-header.tsx` | E2E | Aligned (core) |
| FR-103 | Mega-menu with featured media | `nav_entry` schema + `content.ts` | — | Deferred (schema-ready) |
| FR-104 | Typeahead ≥2 chars, ≤10 results | `apps/web/src/app/api/search/typeahead/route.ts` + `commerce/catalog.searchTypeahead` | route unit via Zod contract; rate-limited 60/min/IP | Aligned (core); FTS/trigram/synonym upgrade = backlog B4 |
| FR-105 | Announcement bar | `site-header.tsx` + seed | rendered | Aligned; dismissal (Zustand persist) = Deferred |
| FR-106 | Search results page | — | — | Deferred |
| FR-107 | Footer newsletter | `apps/web/src/actions/newsletter.ts` | ActionResult contract; 3/hour/IP limiter | Aligned (double opt-in message = Phase 1) |
| FR-109 | 404/500 honest pages | `apps/web/src/app/not-found.tsx`, `error.tsx` | names FR-109 (+FR-705 on /lookbooks) | Aligned |
| FR-201..208 | PLP: routes, sort, pagination | `apps/web/src/app/shop/*` + `commerce/catalog.listProducts` | E2E plp + category | Aligned (core); facets UI/URL rules, bestselling via `product_metrics` = backlog B4/Deferred |
| FR-301..313 | PDP: gallery, swatches, price, JSON-LD, lead time | `apps/web/src/app/products/[slug]/page.tsx`, `product-buy-panel.tsx` | E2E pdp; JSON-LD asserted | Aligned (core); lead time now data-driven (FR-304); `?variant=SKU` (FR-302); gallery >4 thumbs, Notify-me/preorder, legacy 301 = Deferred |
| FR-401..406 | Cart: drawer, promo codes, totals | `apps/web/src/components/cart-*`, `commerce/cart-service`, `pricing` | property tests; E2E cart persistence | Aligned (core); optimistic rollback (FR-401), merge-on-login wiring (FR-403), gift wrap line (FR-405), re-validation notice (FR-404) = backlog B5/Deferred |
| FR-501..512 | Checkout: Payment Element, webhook placement, re-verification | `apps/web/src/actions/checkout.ts`, `commerce/checkout-service`, `api/webhooks/stripe` | §7.11 gate with promotions now symmetric; integration suites (CI) | Aligned (core); express pay (502), guest attach (503 full), autocomplete (504), FX (504), abandoned-cart (511), success proof token (510) = Deferred; §8.7 review-orphan path = backlog B2 |
| FR-601..609 | Accounts | `packages/auth`, `sign-in`, `account` | auth route adapter test; RBAC suite | **Aligned core (auth route mounted 2026-09-08)**; magic link, zxcvbn, wishlist/addresses/reorder = backlog B9/Deferred |

## Content (PRD §6.2)

| FR | Requirement | Locus | Verification | Status |
|---|---|---|---|---|
| FR-701..704 | Homepage sections, collections, journal | `apps/web/src/app/(home)`, `collections`, `journal` | E2E home | Aligned (core) |
| FR-705 | Lookbooks honest 404 naming FR ID | `not-found.tsx` (usePathname) | copy names FR-705 | Aligned |
| FR-706 | Redirect manager + loop detection | `redirect` schema table | — | Deferred (proxy wiring Phase 1) |

## Admin (PRD §6.3)

| FR | Requirement | Locus | Verification | Status |
|---|---|---|---|---|
| FR-801 | Dashboard skeleton | `apps/admin/src/app/page.tsx` | — | Aligned (skeleton) |
| FR-802 | Product edit (slug/SEO/status) | `apps/admin/src/actions/products.ts` | audit-logged; Zod | Aligned |
| FR-803 | Inventory adjustments ledgered | `products.ts` + `inventory_movement` (reason `adjustment`) | movement row written | Aligned (single-variant scope; full UI = Deferred) |
| FR-806/807 | Order lifecycle transitions | `apps/admin/src/actions/orders.ts` + `commerce/order-state` | exhaustive transition tests; server-authoritative + stale-form CONFLICT (2026-09-08) | Aligned |
| FR-805 | Sale windows, CSV import | — | — | Deferred |
| FR-808/809 | Returns workflow, content lifecycle | — | — | Deferred |
| FR-810 | Promotion invariants | `commerce/pricing` + `promotions` | property tests (cap, conservation, tiers, duplicate-id guard) | Aligned; usage-limit counting = backlog B3 |
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
| Security headers §9.3 | `packages/config/security-headers` + both proxies | config tests (HSTS preload, CSP, manifest) | Aligned (nonce CSP = Phase 1 hardening) |
| Money §7.2 | `commerce/money.ts`, `pricing.ts` | property tests + schema test | Aligned |
| Order state machine §7.7 | `commerce/order-state.ts` | exhaustive tests; engine authoritative | Aligned |
| Checkout amount re-verification §7.11 | `checkout-service.placeOrderFromWebhook` | symmetric promotions pricing (2026-09-08); integration (CI) | Aligned (core); §8.7 review-orphan path = backlog B2 |

## SEO / Analytics / i18n (PRD §11)

| Area | Status |
|---|---|
| Metadata/canonical (PDP, category PLP) | Aligned |
| robots noindex on cart/checkout/account/admin | Aligned |
| sitemap.ts / robots.ts / Organization+BreadcrumbList+Article JSON-LD / facet index rules | Deferred (backlog B8) |
| Analytics `order_completed` server-authoritative | Aligned (TX-embedded); typed `track()` client module | Deferred (B8) |
| i18n (next-intl, hreflang) | Deferred (B8); `FEATURE_I18N` default documented as unimplemented |

## Known deviations recorded (honest ledger)

1. Coverage gate `include` is the 5 pure domain modules (documented in `packages/commerce/vitest.config.ts`); DB-backed services are covered by the CI integration layer (jobs, promotions seam, rate limit) rather than whole-package thresholds.
2. CSP carries `unsafe-inline` for Next.js bootstrap scripts until strict nonce CSP lands (Phase 1 hardening, §9.3 note in code).
3. `request-dedupe` is per-instance in-memory (documented in-code; multi-instance upgrade path named).
4. Two-factor auth and magic link are Phase 1 deferrals (in-code comments) — now tracked here instead of a non-existent ledger file.
5. Reservation protocol (§7.6 two-phase) is the top backlog slice (B1): placement currently decrements on-hand under lock (no oversell) but does not hold a reserved window or release on cancel.

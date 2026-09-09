diff --git a/docs/traceability.md b/docs/traceability.md
index f336de1..47b05b7 100644
--- a/docs/traceability.md
+++ b/docs/traceability.md
@@ -2,7 +2,7 @@
 
 Full FR → implementation locus → verification → status matrix, maintained from the 2026-09-08 alignment audit (per PRD §14.2 "from Phase 1"). Statuses: **Aligned** (implemented + verified), **Drift** (code differs from spec), **Stub** (typed placeholder naming its FR ID), **Deferred** (planned Phase 1–5 surface, not yet stub-named — tracked in the remediation backlog), **Unverifiable** (needs staging/secret/live vendor).
 
-Audit evidence: `docs/audits/2026-09-08-prd-alignment/` · Evidence log: `docs/verification-ledger.md` · Backlog: `docs/plans/2026-09-08-remediation-plan.md`.
+Audit evidence: `docs/audits/2026-09-08-prd-alignment/` · `docs/audits/2026-09-09-e2e-live-site-audit/` (live E2E, both apps) · Evidence log: `docs/verification-ledger.md` · Backlog: `docs/plans/2026-09-08-remediation-plan.md`.
 
 ## Storefront (PRD §5)
 
@@ -11,11 +11,11 @@ Audit evidence: `docs/audits/2026-09-08-prd-alignment/` · Evidence log: `docs/v
 | FR-101 | Sticky global header | `apps/web/src/components/site-header.tsx` | E2E home render | Aligned |
 | FR-102 | Hamburger / nav dialog | `site-header.tsx` | E2E | Aligned (core) |
 | FR-103 | Mega-menu with featured media | `nav_entry` schema + `content.ts` | — | Deferred (schema-ready) |
-| FR-104 | Typeahead ≥2 chars, ≤10 results | `apps/web/src/app/api/search/typeahead/route.ts` + `commerce/catalog.searchTypeahead` | route unit via Zod contract; rate-limited 60/min/IP | Aligned (core); FTS/trigram/synonym upgrade = backlog B4 |
+| FR-104 | Typeahead ≥2 chars, ≤10 results | `apps/web/src/app/api/search/typeahead/route.ts` + `commerce/catalog.searchTypeahead` | route unit via Zod contract; rate-limited 60/min/IP; live-verified 2026-09-09 (`?q=lamp` → product hit) | API Aligned; **header search UI = Deferred (Phase 1)** — corrected from "Aligned (core)" in the 2026-09-09 E2E audit (header has no search affordance) |
 | FR-105 | Announcement bar | `site-header.tsx` + seed | rendered | Aligned; dismissal (Zustand persist) = Deferred |
 | FR-106 | Search results page | — | — | Deferred |
 | FR-107 | Footer newsletter | `apps/web/src/actions/newsletter.ts` | ActionResult contract; 3/hour/IP limiter | Aligned (double opt-in message = Phase 1) |
-| FR-109 | 404/500 honest pages | `apps/web/src/app/not-found.tsx`, `error.tsx` | names FR-109 (+FR-705 on /lookbooks) | Aligned |
+| FR-109 | 404/500 honest pages | `apps/web/src/app/not-found.tsx` (server component), `lookbooks/[[...slug]]` + segment not-found, `error.tsx` | E2E asserts the SSR body contains the branded 404 + recovery paths (M-404 fix); /lookbooks SSR names FR-705 | Aligned (SSR 2026-09-09 — the previous client-component not-found shipped an empty payload) |
 | FR-201..208 | PLP: routes, sort, pagination | `apps/web/src/app/shop/*` + `commerce/catalog.listProducts` | E2E plp + category | Aligned (core); facets UI/URL rules, bestselling via `product_metrics` = backlog B4/Deferred |
 | FR-301..313 | PDP: gallery, swatches, price, JSON-LD, lead time | `apps/web/src/app/products/[slug]/page.tsx`, `product-buy-panel.tsx` | E2E pdp; JSON-LD asserted | Aligned (core); lead time now data-driven (FR-304); `?variant=SKU` (FR-302); gallery >4 thumbs, Notify-me/preorder, legacy 301 = Deferred |
 | FR-401..406 | Cart: drawer, promo codes, totals | `apps/web/src/components/cart-*`, `commerce/cart-service`, `pricing` | property tests; E2E cart persistence | Aligned (core); optimistic rollback (FR-401), merge-on-login wiring (FR-403), gift wrap line (FR-405), re-validation notice (FR-404) = backlog B5/Deferred |
@@ -26,8 +26,8 @@ Audit evidence: `docs/audits/2026-09-08-prd-alignment/` · Evidence log: `docs/v
 
 | FR | Requirement | Locus | Verification | Status |
 |---|---|---|---|---|
-| FR-701..704 | Homepage sections, collections, journal | `apps/web/src/app/(home)`, `collections`, `journal` | E2E home | Aligned (core) |
-| FR-705 | Lookbooks honest 404 naming FR ID | `not-found.tsx` (usePathname) | copy names FR-705 | Aligned |
+| FR-701..704 | Homepage sections, collections, journal | `apps/web/src/app/(home)`, `collections`, `journal` | E2E home; collection grid SQL-filtered via `listProducts({ ids })` (M-COL) | Aligned (core) — **journal detail route + list links = Deferred (Phase 1, FR-703)**, corrected from "Aligned (core)" in the 2026-09-09 E2E audit |
+| FR-704 | Static pages (Our Story, Privacy, Terms, Shipping, Returns, FAQ) | `apps/web/src/app/[slug]` + seed | live-verified 2026-09-09: all seeded pages 200 | Aligned — **FAQ page seeded 2026-09-09 (M-FAQ)**: footer `/faq` link previously 404ed |
 | FR-706 | Redirect manager + loop detection | `redirect` schema table | — | Deferred (proxy wiring Phase 1) |
 
 ## Admin (PRD §6.3)

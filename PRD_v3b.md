# Scandi Haven — Production-Ready E-Commerce Platform

**Final Product Requirements Document**

| Field | Value |
|---|---|
| Version | 3.0 (Final) |
| Status | Approved for build |
| Supersedes | `nordeim/scandihaven` `PRD_draft.md` v1.0 (domain scope) and `PRD.md` v2.0 (stack re-specification) |
| Author | Product Engineering |
| Companion artifacts | `ARCHITECTURE.md`, `DATA_MODEL.md`, `API_CONTRACTS.md`, `SECURITY_COMPLIANCE.md`, `TESTING_STRATEGY.md`, `CICD_DEVOPS.md`, `SKILLS_ALIGNMENT.md`, `ROADMAP_RISKS.md`, `adr/*` |

## Table of Contents

1. [Document Control & Executive Summary](#1-document-control--executive-summary)
2. [Goals, Non-Goals, Personas & Success Metrics](#2-goals-non-goals-personas--success-metrics)
3. [Mandated Technology Stack & Version Manifest](#3-mandated-technology-stack--version-manifest)
4. [System Architecture (Summary)](#4-system-architecture-summary)
5. [Functional Requirements — Storefront](#5-functional-requirements--storefront)
6. [Functional Requirements — Accounts, Trade, Admin, Content & Post-Purchase](#6-functional-requirements--accounts-trade-admin-content--post-purchase)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Data, API, Security & Quality (Summary)](#8-data-api-security--quality-summary)
9. [Design System & Frontend Standards](#9-design-system--frontend-standards)
10. [SEO, i18n, Analytics & Performance Budgets](#10-seo-i18n-analytics--performance-budgets)
11. [Environments, Release Plan & Governance](#11-environments-release-plan--governance)
12. [Requirements Traceability & Glossary](#12-requirements-traceability--glossary)
13. [Sign-off](#13-sign-off)

---

## 1. Document Control & Executive Summary

### 1.1 Purpose

Scandi Haven's static marketing site communicates the brand but is
functionally inert: no real checkout, no accounts, no inventory, no
administration. This PRD specifies the full production e-commerce platform
that replaces it — customer storefront, commerce engine, admin back-office,
trade (B2B) program, and third-party integrations — built to support
**€5M+ annual GMV** across EU, US and UK markets, operated by a
four-person engineering team, on a fully mandated, modern TypeScript stack.

This is a **build-ready** specification: every functional requirement
carries a stable ID, a priority, and testable acceptance criteria; every
data entity is specified to column/type/index level in `DATA_MODEL.md`;
every mutation boundary has a named Zod contract in `API_CONTRACTS.md`.
Nothing material is left for an implementer to infer.

### 1.2 Relationship to prior artifacts

| Document | Status | What this PRD keeps | What this PRD changes |
|---|---|---|---|
| `PRD_draft.md` v1.0 | Superseded | Domain scope, personas, commercial targets, functional requirements by domain, design language (captured landing-page tokens), compliance obligations | Technology recommendations (Medusa.js, Next.js 14, Auth0/Clerk, Algolia, Avalara) — replaced by the mandated stack throughout |
| `PRD.md` v2.0 | Superseded (refined) | The mandated-stack architecture, money-as-integers rule, package boundaries, RBAC-via-Better-Auth, Stripe Tax decision, PostgreSQL FTS-first search | Document structure (split into linkable companion artifacts), NFR depth (SLOs, DR drills, threat model), contract-first API specification, expanded skills alignment |

Three properties remain non-negotiable, carried forward from v2.0 and
strengthened here:

1. **Build-readiness** — no open technical questions; every "REST or
   GraphQL" / "Algolia or Meilisearch" / "Avalara or Stripe Tax" class of
   question from the draft is closed with a versioned decision and a
   documented swap trigger (§3.2 in `ARCHITECTURE.md`).
2. **Honesty about scope** — v1 exclusions are stated as clearly as
   inclusions (§2.2); nothing is silently deferred.
3. **Verifiability** — claims of "done" require evidence: commands run,
   tests observed, results recorded in a verification ledger
   (`TESTING_STRATEGY.md` §5).

### 1.3 Executive summary

Scandi Haven is a direct-to-consumer brand selling handcrafted Scandinavian
furniture, lighting, textiles and ceramics. The platform is a **PNPM +
Turborepo monorepo** of two Next.js 16 applications (storefront `apps/web`
and admin `apps/admin`) and shared packages (`db`, `auth`, `commerce`, `ui`,
`email`, `config`). PostgreSQL 17 is the single source of truth, accessed
exclusively through Drizzle ORM. Better-Auth provides authentication, 2FA
and RBAC. Stripe provides payments, tax calculation, and — post-launch —
trade invoicing. Tailwind CSS v4 (CSS-first `@theme`, PostCSS) styles
shadcn/ui primitives themed to the brand's warm-editorial design language
(Fraunces + Inter). Ephemeral client state (cart drawer visibility,
wishlist, UI chrome) lives in Zustand v5 stores; all durable state is
server-rendered React Server Components reading directly from Postgres.

**North-star metric:** conversion rate (visitor → paid order) ≥ 2.4% on
cold traffic.
**Secondary metrics:** AOV ≥ €420; 12-month repeat-purchase rate ≥ 38%;
NPS ≥ 70; full targets in §2.4.

### 1.4 How to read this document

This master PRD is deliberately scoped to product intent, requirements, and
governance. Deep technical specification lives in the companion documents
listed in the table of contents front-matter — each is independently
reviewable by the discipline it serves (architecture, data, API, security,
QA, DevOps). Acceptance criteria throughout use RFC-2119 verbs
(**MUST/SHOULD/MAY**).

---

## 2. Goals, Non-Goals, Personas & Success Metrics

### 2.1 Goals

1. Replace the static landing page with a complete storefront: PLP, PDP,
   cart, checkout, order confirmation, customer account, order management.
2. Provide an admin back-office for products, orders, customers, content
   and promotions usable by a non-technical operator without engineering
   support.
3. Support multi-region trading (EU + US + UK) with localized pricing,
   tax, shipping and language.
4. Achieve Core Web Vitals "Good" on all key templates, WCAG 2.2 AA
   accessibility, and day-one SEO competitiveness.
5. Remain commercially extensible: discounts, gift cards, trade program
   and subscriptions fit the data model without schema rework.
6. Keep total cost of operation proportionate to a four-person team: every
   runtime component must be reproducible locally in one command, and no
   service may exist that the team cannot debug directly.

### 2.2 Non-goals (v1)

- Marketplace / third-party sellers.
- Physical retail POS integration.
- Augmented-reality room visualization.
- Native mobile apps (responsive web only).
- Custom manufacturing / ERP integration (Phase 2+).
- Multi-warehouse *regional routing* beyond the two defined warehouses
  (Aalborg DC + Copenhagen showroom stock) — the schema supports N
  warehouses (`DATA_MODEL.md` §3), but v1 operates exactly two.
- Real-time collaborative features beyond coarse stock-availability display.

### 2.3 Personas and their build implications

| ID | Persona | Profile | Design & build implications |
|---|---|---|---|
| P1 | The Considered Buyer | 35–55, design-literate professional, €80k+ household income; buys 1–3 major pieces/year; researches for weeks; values provenance, materials, longevity | PDP carries materials, care, dimensions, sustainability and origin with editorial depth (FR-310–FR-316); reviews with photos (FR-320); no dark patterns; wishlist for multi-week decision cycles (FR-620) |
| P2 | The New-Home Nestor | 28–40, furnishing first/second home, €50k+; arrives mid-funnel from Pinterest/Instagram; buys across categories; sensitive to shipping cost and lead-time clarity | Lead-time badges mandatory on PLP cards and PDP (FR-207, FR-304); shipping cost visible in cart before checkout (FR-405); collections/lookbooks for room-level discovery (FR-701–FR-705) |
| P3 | Trade Buyer (B2B) | Interior designers, architects, boutique hospitality; needs trade pricing, lead times, samples, credit; ≈22% of forecasted revenue | Trade application + approval workflow (FR-901–FR-902); trade-tier pricing rendered only to approved accounts (FR-903); Net-30 via Stripe Invoicing post-launch (FR-904); bulk order pad deferred to Phase 5 |
| P4 | The Gift Buyer | Seasonal, AOV €60–€180; ships to third address | Gift wrap (+€8), gift message field, gift receipt without prices (FR-410–FR-412); friction-free guest checkout (FR-501); ceramics/textiles merchandising |

### 2.4 Success metrics (12-month targets)

| Metric | Target | Measurement source |
|---|---|---|
| Conversion rate (cold traffic) | ≥ 2.4% | Server-side order count ÷ GA4 sessions (server order count is the truth source) |
| Average order value | ≥ €420 | Order table, currency-normalized to EUR |
| Repeat-purchase rate (12 mo) | ≥ 38% | Cohort report on `order` table |
| NPS | ≥ 70 | Post-delivery survey (Resend flow) |
| Return rate | ≤ 6% | Return requests ÷ orders |
| Order-to-ship lead (in-stock) | ≤ 3 business days | Fulfillment timestamps |
| CS first response | ≤ 4 business hours | Helpdesk (external) |
| Core Web Vitals "Good" | 100% of key templates | CrUX + Lighthouse CI (`TESTING_STRATEGY.md` §4) |
| Uptime (storefront) | ≥ 99.95% monthly | Synthetic monitoring + host SLA (`CICD_DEVOPS.md` §5) |
| Trade accounts active | ≥ 250 by month 12 | Trade application table |
| Checkout error rate | ≤ 0.5% of checkout starts | Server Action error telemetry |
| P1 security finding open > 7 days | 0 | `pnpm audit` / CodeQL dashboard |

---

## 3. Mandated Technology Stack & Version Manifest

Versions below are the minimums validated at authoring time; the lockfile
(`pnpm-lock.yaml`) is the real pin of record. `pnpm update` runs are
deliberate, reviewed acts — never an incidental side effect of another
change.

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Package manager | PNPM | 10.x | Workspaces via `pnpm-workspace.yaml`; `node-linker=isolated` |
| Monorepo orchestration | Turborepo | 2.x | Task graph in `turbo.json`: build/dev/lint/typecheck/test/e2e |
| Web framework | Next.js | 16.x | App Router, RSC, `proxy.ts` (replaces `middleware.ts`), async `params`/`searchParams`/`cookies()`, Turbopack builds |
| UI runtime | React | 19.x | RSC-first; `use()`; form actions; `useOptimistic` for cart/wishlist |
| Language | TypeScript | 5.9.x | `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`; `any` banned by lint rule, `unknown` mandated at boundaries |
| Styling | Tailwind CSS | 4.x | CSS-first `@theme`; no `tailwind.config.js`; single `@tailwindcss/postcss` entry per app |
| Build CSS pipeline | PostCSS | current | `@tailwindcss/postcss` + `autoprefixer` |
| UI primitives | shadcn/ui (Radix + CVA + tailwind-merge) | current | Vendored into `packages/ui`, themed via CSS variables; never a runtime npm dependency |
| Database | PostgreSQL | 17.x | Single source of truth; local via `docker-compose.yml`; managed PG in production |
| ORM | Drizzle ORM + drizzle-kit | current | Schema in `packages/db/src/schema`; forward-only, generated migrations (never hand-edited) |
| Auth | Better-Auth | 1.x | Email/password + magic link + Google/Apple OAuth; `admin` + `twoFactor` plugins; DB-backed sessions |
| Validation | Zod | 4.x | Single validation dialect; schemas colocated with features; types derive via `z.infer` |
| Client state | Zustand | 5.x | Cart drawer, wishlist, UI chrome only; `persist` middleware with SSR-hydration-safe patterns |
| Payments | Stripe (`stripe-node`) | current | Payment Intents + Payment Element; Stripe Tax; signed webhooks |
| Email | React Email + Resend | current | Templates as React components in `packages/email`; log transport in dev |
| Lint | ESLint (flat config) + typescript-eslint | 9.x | Strict rule set; `import/no-restricted-paths` enforces package boundaries |
| Unit/integration tests | Vitest | current | `packages/commerce` domain logic, colocated `*.test.ts` |
| E2E tests | Playwright | current | Chromium + WebKit projects; `@axe-core/playwright` for a11y assertions |
| Runtime | Node.js | 22 LTS | Pinned via `.nvmrc`; identical in CI and production |

Full swap-trigger table for supporting (non-core-mandated) choices — search,
rate limiting, caching, i18n, background jobs, feature flags, reviews,
consent — lives in `ARCHITECTURE.md` §3.2. Stack governance rules (no
unverified APIs, lockfile respect, one-directional package boundaries, one
validation dialect, money-as-integers) are recorded in `ARCHITECTURE.md`
§3.3 and are PR-blocking via CI and code review.

---

## 4. System Architecture (Summary)

Full detail — monorepo layout, the 3-layer model (App/RSC → client islands
→ domain/DB), request lifecycles for the PDP/cart/checkout/webhook paths,
caching and revalidation strategy, and ADR pointers — is in
`ARCHITECTURE.md`. Summary for this PRD:

```
scandihaven/
├── apps/
│   ├── web/                 # Storefront — Next.js 16 (public, SEO-critical)
│   └── admin/                # Admin back-office — Next.js 16 (auth-gated)
├── packages/
│   ├── db/                   # Drizzle schema, migrations, seed, typed client
│   ├── auth/                  # Better-Auth server/client instances, RBAC types
│   ├── commerce/               # Pricing, cart, checkout, orders, promotions,
│   │                            # tax, inventory, search — pure + Zod contracts
│   ├── ui/                    # shadcn/ui primitives + Scandi Haven composites
│   ├── email/                  # React Email templates + Resend/log transports
│   └── config/                 # Shared eslint flat config, tsconfig, tailwind preset
├── docker-compose.yml          # PostgreSQL 17 (+ optional pgAdmin) for local dev
├── turbo.json
├── pnpm-workspace.yaml
└── .github/workflows/ci.yml
```

Package boundaries are one-directional (`apps/* → packages/*`; within
packages, `db ← auth ← commerce ← apps`), enforced mechanically by ESLint
import restrictions and mirrored in the Turborepo task graph. `packages/ui`
depends on nothing but React, Radix and Tailwind — it must remain
importable by both apps without pulling in commerce or auth code.

Rendering model: **Server Components read directly from Postgres via
`packages/commerce`**; there is no client-side global data-fetching layer.
Interactive leaves (cart drawer, variant selectors, gallery, quantity
steppers, forms) are `"use client"` islands hydrated at the tree's edge,
talking to the server exclusively through Server Actions or
`useOptimistic` over the Zustand cart store — never through ad-hoc API
routes for first-party mutations. Route handlers exist only for
third-party contracts that require them (Stripe webhooks, health checks,
sitemap/robots, OAuth callbacks).

---

## 5. Functional Requirements — Storefront

Requirement IDs are stable; **P0** = v1 launch-blocking, **P1** =
pre-launch-polish, **P2** = post-launch. Acceptance criteria are testable
and map to `TESTING_STRATEGY.md` §3 (E2E critical paths) and
`ROADMAP_RISKS.md` §3 (traceability matrix).

### 5.1 Navigation & discovery (FR-100–FR-199)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-101 | Global header MUST show logo, primary nav (Shop, Collections, Our Story, Journal, Contact), search trigger, account, cart, and be sticky on scroll. | P0 | Header remains visible after 200px scroll on all breakpoints; keyboard-focusable in DOM order. |
| FR-102 | Mobile navigation MUST render as a full-screen drawer, trap focus while open, and close on `Escape` or overlay click. | P0 | Axe scan reports zero focus-trap violations; `Escape` closes drawer in E2E. |
| FR-103 | Search MUST return instant results (image, name, price) as the user types, with typo tolerance and category/journal suggestions. | P0 | p95 search response < 300 ms server-side against PostgreSQL FTS + `pg_trgm` (§3.2 swap trigger in `ARCHITECTURE.md`). |
| FR-104 | Mega-menu MUST group Shop by Furniture → Seating / Tables / Storage / Beds, each with a featured-collection thumbnail. | P1 | Visual regression baseline; keyboard operable via arrow keys. |
| FR-105 | Footer MUST include shop/about/help link groups, showroom addresses, newsletter form, social links, accepted payment icons, legal links, and a locale/region switcher. | P0 | All footer links resolve (zero 404s) in link-check CI job. |

### 5.2 Product Listing Page — PLP (FR-200–FR-299)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-201 | PLP MUST support filters: category, sub-category, material, colour, price range, availability, lead time, collection. | P0 | Filter combination reflected in canonical, indexable query string (`?material=oak&color=sand`). |
| FR-202 | PLP MUST support sort: featured, newest, price asc/desc, best-selling. | P0 | Sort persists across pagination. |
| FR-203 | Product card MUST show hover-swap image, badge (New/Sale/Low-stock), name, material, price (strikethrough if on sale), and a quick-add control. | P0 | Quick-add adds default variant to cart without full navigation; optimistic cart count updates within 100 ms. |
| FR-204 | PLP MUST paginate at 24 items/page (not infinite scroll) for SEO and shareable URLs. | P0 | `rel=next/prev` present; page 2+ indexable and canonical. |
| FR-205 | PLP URLs MUST be SEO-friendly: `/shop/furniture/seating/halden-linen-armchair` pattern for categories. | P0 | URL structure verified in sitemap; no query-string-only category pages indexed. |
| FR-206 | Empty filter results MUST show a helpful empty state with a "clear filters" affordance. | P1 | E2E asserts visible empty-state copy and working clear action. |
| FR-207 | Every PLP card for made-to-order products MUST show a lead-time badge ("Ships in 6–8 weeks"). | P0 | Badge text sourced from `product.lead_time_days`, never hardcoded. |

### 5.3 Product Detail Page — PDP (FR-300–FR-399)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-301 | Gallery MUST show 1 primary + up to 8 thumbnails, support zoom-on-hover (desktop) and swipe (mobile); video optional. | P0 | Keyboard arrow navigation between images; alt text required per image at CMS level. |
| FR-302 | Variant selectors (material/colour/size) MUST show swatch imagery and per-variant stock state. | P0 | Selecting an out-of-stock variant disables Add-to-cart and shows "Notify me." |
| FR-303 | Price block MUST show current price, compare-at price, "save X%" badge, and a tax-inclusive/exclusive label per region. | P0 | EU region renders VAT-inclusive price; US/UK render tax-at-checkout note. |
| FR-304 | Lead-time badge MUST read "Made to order — ships in N–M weeks" or "In stock — ships in N–M days," sourced from inventory + `lead_time_days`. | P0 | Badge text changes correctly when admin edits lead time (FR-812). |
| FR-305 | Quantity selector + primary "Add to cart" + secondary "Save to wishlist" MUST be present above the fold on desktop and in a sticky mobile bar. | P0 | Sticky bar appears after hero image scrolls out of view on mobile viewport. |
| FR-306 | Description, materials & care, dimensions diagram, sustainability notes, and shipping & returns MUST render as accordions. | P0 | Only one accordion section expanded by default (description); rest collapsed. |
| FR-307 | "Pairs well with" cross-sell MUST show 4 products: merchandiser-curated with an algorithmic fallback when no curation exists. | P1 | Falls back to same-category, in-stock, non-out-of-price-band products when `curated_pairs` is empty. |
| FR-308 | Reviews MUST show star summary, rating distribution bars, paginated reviews with photos, sort by recency/helpfulness, and a write-review form restricted to verified buyers. | P0 | Write-review form only renders for a customer with a `delivered` order line for that product (FR-609). |
| FR-309 | PDP MUST emit `Product`, `Offer`, `AggregateRating`, and `BreadcrumbList` JSON-LD. | P0 | Structured-data validator reports zero errors for all seeded PDP fixtures. |

### 5.4 Cart & Checkout (FR-400–FR-599)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-401 | A slide-out mini-cart drawer MUST show line items, quantity stepper, remove, subtotal, and "Proceed to checkout." | P0 | Drawer is a proper `role="dialog"` with focus trap and a live-region item-count announcement. |
| FR-402 | A full cart page MUST show order summary, shipping estimate by postcode, promo-code field, and gift-card field. | P0 | Shipping estimate recalculates within 500 ms of postcode entry. |
| FR-403 | Checkout MUST be single-page with 3 logical steps (Information → Shipping → Payment) plus express options (Apple Pay, Google Pay via Stripe Payment Element). | P0 | Express payment button renders only when the browser/device supports it (Stripe capability check). |
| FR-404 | Address entry MUST support autocomplete. | P1 | Deferred provider selection tracked as an open question (`ROADMAP_RISKS.md` §4). |
| FR-405 | Cart and checkout MUST display shipping cost before payment entry — never introduced as a surprise at the final step. | P0 | E2E asserts shipping line visible on cart page prior to reaching payment step. |
| FR-406 | Guest checkout MUST be fully supported; account creation is offered post-purchase, never mandatory pre-purchase. | P0 | E2E guest-checkout path completes without an account. |
| FR-407 | Prices MUST display in the customer's selected currency with the FX rate locked at order placement. | P0 | `order.fx_rate` and `order.currency` are immutable after `placed`. |
| FR-408 | Tax MUST be calculated by destination via Stripe Tax at checkout. | P0 | Order line `tax_cents` matches Stripe Tax calculation response, stored verbatim for audit. |
| FR-409 | Shipping methods MUST include Standard, Express, White-glove (required for items > 30 kg), and Pickup-at-showroom. | P0 | White-glove is force-selected (not merely offered) for line items exceeding the weight threshold. |
| FR-410 | Gift options MUST include gift wrap (+€8), a gift-message field, and a gift receipt that omits prices. | P1 | Packing-slip PDF generation omits price columns when `is_gift_receipt = true`. |
| FR-411 | Order confirmation MUST appear on-screen and via email; SMS is opt-in only. | P0 | Confirmation email sent within 60 s of `order.placed` webhook (idempotent, §`API_CONTRACTS.md`). |
| FR-412 | Promotion codes MUST validate server-side against type, schedule, usage limits and exclusions before being applied to cart totals. | P0 | Invalid/expired/excluded codes return a typed error, never a silent no-op. |

---

## 6. Functional Requirements — Accounts, Trade, Admin, Content & Post-Purchase

### 6.1 Customer account (FR-600–FR-699)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-601 | Auth MUST support email/password, magic link, and Google/Apple OAuth via Better-Auth. | P0 | All three flows pass E2E; sessions are DB-backed and revocable from the account page. |
| FR-602 | Profile MUST allow editing name, email, phone, default addresses, and communication preferences. | P0 | Email change requires re-verification before taking effect. |
| FR-603 | Order history MUST show status, tracking link, and invoice PDF download. | P0 | Invoice PDF regenerates deterministically from order line snapshot (never live-priced). |
| FR-604 | One-click reorder MUST re-add all in-stock line items from a past order to the cart. | P1 | Out-of-stock lines are skipped with a visible notice, not silently dropped. |
| FR-605 | Return-request initiation MUST be self-service from order history for eligible orders. | P0 | Eligibility = delivered within the configured return window; ineligible orders show the reason. |
| FR-606 | Saved addresses and tokenized payment methods (via Stripe) MUST be manageable from the account page. | P0 | Raw card data never touches the application server (SAQ-A scope, `SECURITY_COMPLIANCE.md` §3). |
| FR-607 | Wishlist MUST support multiple named lists, shareable via a public URL. | P1 | Shared URL is read-only and does not expose account PII. |
| FR-608 | Trade accounts MUST register via a distinct form capturing business details and a resale-certificate upload. | P0 | Upload accepted only as PDF/PNG/JPG ≤ 10 MB, virus-scanned before storage. |
| FR-609 | A customer MAY only write a review for a product on an order line with status `delivered`. | P0 | Server Action rejects review submission when no matching delivered order line exists. |

### 6.2 Content & editorial (FR-700–FR-799)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-701 | Collections MUST support a curated product grid with editorial header image and story copy. | P0 | Collection product order is admin-controlled, not query-derived. |
| FR-702 | Journal MUST support categorized posts (Craft, Home, People, Sustainability) with rich-text body and inline "shop this post" product embeds. | P1 | Embedded product cards resolve live price/availability at render time. |
| FR-703 | Static legal/informational pages (Our Story, Sustainability, Materials, Showrooms, Trade Program, FAQ, Shipping, Returns, Privacy, Terms, Cookies, Accessibility) MUST be editable without a deploy. | P0 | Admin-authored content is stored in `static_page` + `static_page_locale` and rendered via RSC. |
| FR-704 | Lookbooks MUST support shoppable hotspots over editorial imagery. | P2 | Deferred to Phase 5; stub route returns 404 with a tracked FR reference, not a silent 500. |
| FR-705 | A redirect manager MUST allow admins to create 301 redirects for retired URLs. | P0 | Redirect table checked in `proxy.ts` before route resolution; hit-rate logged for weekly review. |

### 6.3 Admin back-office (FR-800–FR-899)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-801 | Dashboard MUST show revenue (today/7d/30d), orders pending fulfilment, low-stock alerts, top products, and a view→add→checkout→purchase funnel. | P0 | All widgets computed server-side from the order/inventory tables — never client-aggregated. |
| FR-802 | Product CRUD MUST capture title, slug, rich-text description, variants, materials, dimensions, weight, HS code, country of origin, lead time, images with mandatory alt text, collections, tags and SEO meta. | P0 | Slug uniqueness enforced at the DB constraint level, not only in the UI. |
| FR-803 | Inventory MUST be tracked per variant per warehouse (Aalborg DC, Copenhagen showroom). | P0 | Inventory adjustments are append-only `inventory_movement` rows; `on_hand` is a derived view, never directly mutated. |
| FR-804 | Pricing MUST support base price per currency, scheduled sale price, and a trade-price tier. | P0 | Sale-price schedule activation/deactivation is a scheduled job, not manual toggling. |
| FR-805 | Bulk product import/export MUST support CSV. | P1 | Import validates every row against the same Zod schema used by the single-product form; partial-failure rows are reported, not silently skipped. |
| FR-806 | Order list MUST filter by status, date, value, and country; order detail MUST show line items, addresses, payments, shipments, notes and a timeline. | P0 | Timeline is derived from an append-only `order_event` table. |
| FR-807 | Admin order actions MUST include capture, partial/full refund, cancel, split-ship, mark-shipped, print packing slip, print return label. | P0 | Refund action is idempotent and reconciled against the Stripe refund object ID. |
| FR-808 | Returns MUST follow request → approve → ship → inspect → refund/exchange, each a tracked state transition. | P0 | Illegal state transitions (e.g., `refund` before `inspect`) are rejected server-side. |
| FR-809 | A fraud-review queue MUST surface orders flagged by Stripe Radar risk score. | P1 | Queue entries link directly to the Stripe Radar risk detail. |
| FR-810 | Customer management MUST provide a searchable directory, LTV, segment tags, notes, and GDPR export/anonymize/delete tools. | P0 | Anonymize action irreversibly scrubs PII while preserving order financial history for tax retention (`SECURITY_COMPLIANCE.md` §4). |
| FR-811 | Promotions MUST support fixed/percent/free-shipping codes, automatic promotions, scheduling, usage limits (global + per-customer), category/product exclusions, BOGO, and tiered thresholds. | P0 | Promotion engine invariant: total discount never exceeds cart subtotal (property-tested, `TESTING_STRATEGY.md` §6). |
| FR-812 | Gift cards MUST support configurable denominations, scheduled delivery, balance lookup, and fraud limits. | P1 | Balance mutations are append-only ledger entries, never a mutable balance column. |
| FR-813 | Reporting MUST cover sales by day/week/month/product/category/channel/country/discount, exportable to CSV, with a cohort + repeat-purchase report. | P1 | Reports reconcile to the order table to the cent for the reporting period. |
| FR-814 | Settings MUST expose enabled regions, currencies, tax rules, shipping zones/rates, payment providers, team members/roles, webhooks and API keys. | P0 | Role changes are audit-logged with actor, timestamp and before/after values. |
| FR-815 | RBAC roles MUST include Owner, Admin, Merchandiser, Customer-service, Warehouse, Read-only, each with an explicit permission matrix. | P0 | Permission matrix enforced server-side on every admin Server Action, not only hidden in the UI. |

### 6.4 Trade / B2B (FR-900–FR-909)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-901 | Trade application MUST capture business details and a resale-certificate upload. | P0 | See FR-608. |
| FR-902 | Trade applications MUST require manual admin approval before trade pricing activates. | P0 | No auto-approval path exists in v1. |
| FR-903 | Approved trade accounts MUST see trade-tier pricing (crossed-out retail + net price) after login. | P0 | Trade pricing never renders to unauthenticated or unapproved sessions (RBAC-enforced, not CSS-hidden). |
| FR-904 | Net-30 payment terms MUST be available to approved trade accounts via Stripe Invoicing. | P2 | Phase 5; decision recorded in ADR-0002 open-question log. |
| FR-905 | A bulk order pad (CSV SKU upload) MUST be available to trade accounts. | P2 | Phase 5. |
| FR-906 | Trade accounts MUST have a dedicated concierge contact path (email/form), distinct from general CS. | P1 | |

### 6.5 Post-purchase (FR-910–FR-919)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-910 | Order-status emails MUST fire for confirmed, in-production, shipped, out-for-delivery, and delivered. | P0 | Each email is idempotent per order+status pair (outbox pattern, `API_CONTRACTS.md` §5). |
| FR-911 | A carrier-agnostic tracking page MUST be available to the customer. | P1 | |
| FR-912 | A self-service returns portal MUST support reason codes, photo upload for damage claims, label generation, and refund-status visibility. | P0 | Photo upload enforces the same size/type/virus-scan policy as FR-608. |
| FR-913 | A review-request email MUST send 21 days post-delivery. | P1 | Scheduled via the outbox/jobs mechanism (`ARCHITECTURE.md` §3.2), not a long-running process. |

---

## 7. Non-Functional Requirements

| Domain | Requirement |
|---|---|
| **Performance** | Core Web Vitals "Good" on homepage, PLP, PDP, checkout (budgets in §10.3); p95 server TTFB < 800 ms on RSC reads. |
| **Availability** | ≥ 99.95% monthly uptime for the storefront; ≥ 99.5% for admin. RTO 4h / RPO 15min (`CICD_DEVOPS.md` §5). |
| **Scalability** | Stateless web tier (DB-backed sessions); catalog scale target ≤ 10,000 SKUs / ≤ 100,000 variants in v1 without architectural change. |
| **Security** | OWASP Top 10 mitigations verified per release; PCI DSS SAQ-A scope via Stripe Elements; annual third-party penetration test (`SECURITY_COMPLIANCE.md`). |
| **Privacy** | GDPR (EU), CCPA (US), Danish Cookie Order compliance; DSR export/erasure fulfilled within 30 days. |
| **Accessibility** | WCAG 2.2 AA baseline on all customer-facing templates; zero serious/critical axe violations gating merge. |
| **Internationalization** | `en` (default), `da`, `de`, `sv` storefront locales via `next-intl`; currency and locale are orthogonal (a Danish shopper may transact in EUR or DKK). |
| **Observability** | Structured JSON logs with correlation IDs; error tracking with release tagging; RUM web-vitals beacons (consent-gated). |
| **Maintainability** | `pnpm install && pnpm build && pnpm typecheck && pnpm lint` green from a clean checkout is the standing Definition of Done gate. |
| **Data retention** | Raw order/tax data retained 7 years; customer profile PII deletable on request with financial records anonymized, not deleted (`SECURITY_COMPLIANCE.md` §4). |
| **Cost discipline** | No third-party service is introduced without a named swap trigger and a documented reason it wasn't handled in the mandated stack (`ARCHITECTURE.md` §3.2). |

---

## 8. Data, API, Security & Quality (Summary)

Full specification lives in the companion documents; this section is the
cross-reference anchor.

- **Data model** (`DATA_MODEL.md`): Drizzle `pgTable` definitions for
  `product`, `product_variant`, `inventory_movement`, `collection`, `order`,
  `order_line`, `customer`, `promotion`, `gift_card`, `journal_post`,
  `review`, `trade_account`, translation tables, and the `jobs` outbox —
  each to column, type, index, and constraint level. Money is always
  integer minor units (`price_cents`); floats never represent currency.
- **API contracts** (`API_CONTRACTS.md`): every Server Action and route
  handler is named, typed with a Zod input/output schema, and returns a
  standard `Result<T, AppError>` envelope. Stripe, and future carrier/tax
  webhooks are documented with signature-verification and idempotency-key
  requirements.
- **Security & compliance** (`SECURITY_COMPLIANCE.md`): Better-Auth RBAC
  matrix, session/2FA policy, a STRIDE threat model for the checkout and
  admin surfaces, secrets management, security headers/CSP, and the
  GDPR/CCPA/DSA compliance mapping.
- **Quality engineering** (`TESTING_STRATEGY.md`): the test pyramid
  (Vitest unit/component/integration, Playwright E2E with axe-core),
  coverage floors, critical-path E2E specs, and the evidence/verification
  ledger discipline required before any "this works" claim is made.

---

## 9. Design System & Frontend Standards

### 9.1 Brand tokens

Carried forward verbatim from the captured landing page in `PRD_draft.md`
(the design language is a preserved, non-negotiable input):

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FAF7F2` | Warm off-white base |
| `--bg-2` | `#F0EAE0` | Cream section background |
| `--bg-3` | `#E8E0D2` | Sand accents |
| `--ink` | `#1F1B17` | Warm near-black text |
| `--ink-2` | `#4A433B` | Warm gray secondary text |
| `--muted` | `#8A8178` | Tertiary/meta text |
| `--accent` | `#C97B5E` | Terracotta — primary accent (large text/UI only; body links use `--accent-2`) |
| `--accent-2` | `#B06548` | Deep terracotta — accessible body-link contrast |
| `--sage` | `#8B9A82` | Secondary accent |
| `--wood` | `#C9A876` | Secondary accent |
| `--line` | `#E5DDD1` | Hairlines |
| Display type | Fraunces (variable, opsz 9–144, weights 300–500, italic) | Headlines |
| UI type | Inter (weights 300–600) | Body/UI |
| Type scale | 12/13/14/16/18/22/28/36/48/64/96 | |
| Radii | 2px (cards), 999px (pills), 0 (images — sharp editorial) | |
| Motion | `cubic-bezier(0.22, 1, 0.36, 1)`; durations 200/300/400/800ms | |
| Elevation | Minimal; hairlines and warm backgrounds preferred over drop shadows | |

### 9.2 Implementation rules

1. Tokens are defined once in Tailwind v4's `@theme` block in
   `packages/config/tailwind` and consumed as CSS variables — no
   `tailwind.config.js`, no duplicated hex values in component files.
2. shadcn/ui primitives are vendored into `packages/ui`, themed to the
   above tokens, and extended with Scandi Haven composites (ProductCard,
   CartDrawer, VariantSelector, LeadTimeBadge, QuantityStepper,
   Accordion-based PDP sections). Apps never install shadcn as a runtime
   dependency; they import from `packages/ui`.
3. Every interactive primitive MUST meet WCAG 2.2 AA: visible focus rings
   (`--ring` token, never `outline: none`), 44px minimum primary CTA
   target size, `aria-describedby` on form errors with `role="alert"`,
   `role="dialog"` + focus trap on drawers/modals, `role="status"` on
   toasts.
4. No dark patterns: no pre-ticked upsells, no countdown timers without a
   real expiry, no disguised subscription opt-ins.

---

## 10. SEO, i18n, Analytics & Performance Budgets

### 10.1 SEO

Server-rendered HTML on every indexable route; per-page editable
`title`/`meta description`/`og:image`/`canonical`; daily-generated
sitemap covering PLPs, PDPs, collections, journal and static pages;
`robots.txt` blocks `/admin`, `/account`, `/cart`, `/checkout`, `/search`;
structured data per §5.3/FR-309; hreflang for `en`/`da`/`de`/`sv`; a
301-redirect manager (FR-705) with weekly 404-report review during and
after the legacy-site cutover.

### 10.2 Analytics event contract

| Event | Key properties | Fired from |
|---|---|---|
| `product_viewed` | productId, variantId, price | PDP mount |
| `product_list_viewed` | listId, resultCount | PLP mount |
| `product_added_to_cart` / `product_removed_from_cart` | productId, variantId, qty | cart actions |
| `cart_viewed` | value, currency | `/cart` |
| `checkout_started` / `checkout_step_completed` | step, value | checkout |
| `payment_info_entered` | method | checkout |
| `order_completed` | orderId, revenue, currency, items[], tax, shipping | **server-side**, from the Stripe webhook handler — not client JS, to guarantee accuracy |
| `wishlist_added` / `wishlist_removed` | productId | wishlist actions |
| `review_submitted` | productId, rating | account |
| `search_performed` | query, resultCount | search |
| `promotion_applied` | code | cart/checkout |

Analytics scripts load only post-interactive and only after consent is
granted (`ConsentProvider` interface, `SECURITY_COMPLIANCE.md` §6).

### 10.3 Performance budgets

| Page | LCP (4G mobile) | INP | CLS | JS transferred |
|---|---|---|---|---|
| Homepage | < 2.0 s | < 200 ms | < 0.05 | < 180 KB |
| PLP | < 2.0 s | < 200 ms | < 0.05 | < 200 KB |
| PDP | < 2.0 s | < 200 ms | < 0.05 | < 220 KB |
| Checkout | < 1.5 s | < 100 ms | < 0.02 | < 250 KB |

Enforcement: Lighthouse CI budgets on every PR for the four templates
(`TESTING_STRATEGY.md` §4); `next/font` self-hosts Fraunces/Inter;
Stripe.js loads only on the checkout route; hero images ≤ 200 KB, product
images ≤ 80 KB, enforced at admin media upload.

---

## 11. Environments, Release Plan & Governance

Full detail in `CICD_DEVOPS.md`. Summary:

| Env | Purpose | Data | Payments |
|---|---|---|---|
| Local | Developer machines | `docker compose up` PG17 + `pnpm db:seed` | Stripe test |
| Preview (per PR) | Review + E2E | Fresh migrate + seed per build | Stripe test |
| Staging | Pre-launch UAT + performance | Production-like, anonymized | Stripe test |
| Production | Live | PITR backups, 30-day retention | Stripe live |

Rollout phases (detail and exit criteria in `ROADMAP_RISKS.md` §1):

0. **Foundations** (4 wks) — monorepo scaffold, design system, CI/CD, Stripe test wiring.
1. **MVP storefront** (6 wks) — home, PLP, PDP, cart, checkout, confirmation, account, search, admin catalog+orders.
2. **Pre-launch polish** (3 wks) — perf/a11y/SEO passes, analytics, email flows, returns portal, reviews.
3. **Soft launch** (2 wks) — invite-only, SLO monitoring.
4. **Public launch** — DNS cutover, legacy 301s, rollback = feature flags + instant revert.
5. **Post-launch** (ongoing) — trade program, gift cards, Net-30 invoicing, bulk order pad, subscriptions, AR visualizer.

Governance: every PR touching money, auth or order placement MUST include
a verification-ledger entry (`TESTING_STRATEGY.md` §5); no guardrail
(lint rule, type strictness, test, migration check) may be weakened to
force a green build — violations are surfaced explicitly, never silently
merged.

---

## 12. Requirements Traceability & Glossary

The full requirements → implementation-locus → verification matrix is
maintained in `ROADMAP_RISKS.md` §3 and grows with each PR that closes an
FR. The risk register (long-lead-time conversion risk, cross-border tax
complexity, oversell on concurrent purchases, carrier damage on large
furniture, image-bloat performance risk, custom-build scope creep, single
oak-supplier concentration, SEO migration risk) is maintained in
`ROADMAP_RISKS.md` §2.

**Glossary:** AOV — average order value; BNPL — buy-now-pay-later; CR —
conversion rate; CSP — content-security-policy; CWV — Core Web Vitals;
DSA — Digital Services Act; DSR — data subject request; FTS — full-text
search; GMV — gross merchandise value; INP — interaction to next paint;
LCP — largest contentful paint; LTV — lifetime value; OSS — one-stop-shop
(EU VAT); PDP/PLP — product detail/listing page; PITR — point-in-time
recovery; RTO/RPO — recovery time/point objective; SCA — strong customer
authentication; SAQ-A — PCI self-assessment questionnaire A; SLO —
service-level objective; STRIDE — Spoofing/Tampering/Repudiation/
Information disclosure/Denial of service/Elevation of privilege.

---

## 13. Sign-off

Product: \_\_\_ · Engineering: \_\_\_ · Design: \_\_\_ · Operations: \_\_\_ ·
Legal: \_\_\_

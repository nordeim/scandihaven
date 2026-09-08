# Scandi Haven — Production-Ready E-Commerce Platform

**Final Product Requirements Document**

| Field | Value |
|---|---|
| Version | **3.0** |
| Status | Ready for engineering execution |
| Classification | Internal — Product & Engineering |
| Supersedes | `PRD.md` v2.0 (2026-09-08); `PRD_draft.md` v1.0 |
| Author | Product Engineering |
| Last updated | 2026-03-22 |
| Companion code | [nordeim/scandihaven](https://github.com/nordeim/scandihaven) Phase 0/1 scaffold |
| Skills source | [nordeim/my-pi-agent](https://github.com/nordeim/my-pi-agent) `skills/skills-catalog.md` (233 skills; 47 load-bearing) |
| Satellite docs | See [README.md](./README.md) |

Acceptance criteria use RFC-2119 verbs (**MUST** / **SHOULD** / **MAY**). Every functional requirement carries a stable identifier (`FR-xxx`), a MoSCoW priority, a phase, and a test ID. Stubs in code **MUST** name their FR ID — nothing is silently missing.

---

## Table of Contents

1. [Document control & executive summary](#1-document-control--executive-summary)
2. [Goals, non-goals, personas & success metrics](#2-goals-non-goals-personas--success-metrics)
3. [Mandated technology stack & version manifest](#3-mandated-technology-stack--version-manifest)
4. [System architecture](#4-system-architecture)
5. [Functional requirements (summary)](#5-functional-requirements-summary)
6. [Cross-cutting contracts](#6-cross-cutting-contracts)
7. [Data, money, inventory & orders](#7-data-money-inventory--orders)
8. [Auth, security & compliance (summary)](#8-auth-security--compliance-summary)
9. [Design system & frontend standards (summary)](#9-design-system--frontend-standards-summary)
10. [SEO, analytics, i18n & performance](#10-seo-analytics-i18n--performance)
11. [Quality engineering (summary)](#11-quality-engineering-summary)
12. [Environments, SLOs, cost & release](#12-environments-slos-cost--release)
13. [Risks, open questions & sign-off](#13-risks-open-questions--sign-off)
14. [Agent operating contract](#14-agent-operating-contract)

Depth lives in satellite documents. This master PRD is the contract every engineer must internalize.

---

## 1. Document control & executive summary

### 1.1 Purpose of v3.0

v1.0 captured the brand and commercial scope but recommended Medusa.js v2, Next.js 14, and Clerk/Auth0. v2.0 locked the **mandated in-house stack** (PNPM + Turborepo + Next.js 16 + React 19 + TypeScript 5.9 + Tailwind v4 + PostgreSQL 17 + Drizzle + Better-Auth + Zod v4 + Zustand v5 + Stripe + ESLint + Playwright) and specified FR IDs plus a Drizzle schema.

v3.0 does three things v2.0 did not:

1. **Enterprise completeness.** Threat model, SLO/SLI, data classification, capacity and cost for €5M GMV, incident severity, Definition of Ready/Done, and operational runbooks are now first-class.
2. **Skills-driven hardening.** The my-pi-agent catalog (233 skills) was reviewed end-to-end. Forty-seven skills are load-bearing; each maps to a workstream and a phase (see `skills-alignment.md`). Patterns verified the hard way in `AGENTS.md` / `CLAUDE.md` (Next.js 16 `proxy.ts`, Tailwind v4 `@source`, cart token≠UUID, money as integers) are promoted to non-functional requirements so they cannot regress.
3. **Closed decisions.** Launch currencies, consent vendor default, Net-30 path, and provider interfaces (`SearchProvider`, `ConsentProvider`, `TaxProvider`, `ShippingRateProvider`, `EmailProvider`, `JobRunner`, `FeatureFlags`) are specified with swap triggers.

Three properties remain non-negotiable: **build-readiness**, **honesty about scope**, **verifiability** (claims of correctness require executed evidence — Verified / Reasoned / Assumed / Unverifiable).

### 1.2 Executive summary

Scandi Haven is a direct-to-consumer brand selling handcrafted Scandinavian furniture, lighting, textiles, and ceramics. Founded as a family workshop in Aalborg in 1998 by Mette Sørensen; today a collective of 14 Nordic makers. The current marketing landing page communicates the brand but is functionally inert: no real checkout, no accounts, no inventory, no administration.

This PRD specifies a full production e-commerce platform — customer-facing storefront, custom commerce engine, admin back-office, trade (B2B) program, and third-party integrations — capable of supporting **€5M+ annual GMV** across **EU, US, and UK** markets, operated by a **four-person team**.

The platform is a **PNPM + Turborepo monorepo** of two Next.js 16 applications (`apps/web` storefront, `apps/admin` back-office) and shared packages (`db`, `auth`, `commerce`, `ui`, `email`, `config`). PostgreSQL 17 is the single source of truth via Drizzle ORM. Better-Auth provides authentication and RBAC. Stripe provides payments, tax, Radar, and (Phase 5) Invoicing. Tailwind CSS v4 with a CSS-first `@theme` token layer and shadcn/ui primitives themed to Fraunces + Inter on a warm editorial palette. Zustand v5 holds only client chrome (drawer, wishlist UI); the server is the source of truth for money, cart, and orders.

**North-star metric:** conversion rate (visitor → paid order) ≥ 2.4% on cold traffic.  
**Secondary:** AOV ≥ €420; repeat-purchase ≥ 38% / 12 months; NPS ≥ 70; uptime ≥ 99.95%.

### 1.3 What changed (v1 → v2 → v3)

| Area | v1.0 draft | v2.0 | v3.0 |
|---|---|---|---|
| Commerce backend | Medusa.js v2 | Custom `packages/commerce` | Unchanged; ADR-1 records Medusa/Shopify as velocity fallback |
| Storefront | Next.js 14 | Next.js 16 (`proxy.ts`, async params) | Anti-patterns promoted to NFRs |
| Auth | Auth0 / Clerk | Better-Auth 1.x | Plugin matrix (admin, 2FA, OAuth) specified |
| Database | PostgreSQL 16 + Redis | PostgreSQL 17; Redis deferred | Swap trigger quantified |
| Search | Algolia / Meilisearch | Postgres FTS + trigram | `SearchProvider` interface mandatory |
| Consent | Cookiebot / OneTrust | Interface only | Cookiebot default; OneTrust swap |
| Currencies | Open | Open | EUR, DKK, SEK, USD, GBP locked |
| Net-30 | Open | Stripe recommended | Stripe Invoicing locked for Phase 5 |
| SLOs / threat model / cost | Absent | Partial | Specified |
| Skills alignment | Absent | 14 skills listed | 47 skills, phase-gated loading |
| Verification | Informal | Ledger mentioned | Template + PR gate for money/auth/orders |

### 1.4 How to read this document

Sections 1–4 are the contract every engineer internalizes. Section 5 is a summary; the full FR catalog is `functional-requirements.md`. Sections 6–7 are the “how” at contract level. Sections 8–12 govern security, design, quality, and operations (summaries; satellites hold depth). Section 13 is risk and sign-off. Section 14 is the agent operating contract — Always / Ask first / Never.

---

## 2. Goals, non-goals, personas & success metrics

### 2.1 Goals

1. Replace the static landing page with a complete storefront: PLP, PDP, cart, checkout, order confirmation, customer account, and order management.
2. Provide an admin back-office for products, orders, customers, content, and promotions that a non-technical operator can use without engineering support.
3. Support multi-region trading (EU + US + UK) with localized pricing, taxes, shipping, and language (EN default; DA, DE, SV prefixed).
4. Achieve Core Web Vitals “Good” on all key pages, WCAG 2.2 AA, and SEO competitiveness from day one.
5. Remain commercially extensible: discounts, gift cards, trade program, and subscriptions **MUST** fit the data model without rework.
6. Keep total cost of operation proportionate to a four-person team: no service the team cannot debug; no runtime the team cannot reproduce locally in one command (`pnpm install && docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev`).

### 2.2 Non-goals (v1 / Phase 0–4)

- Marketplace / third-party sellers.
- Physical retail POS.
- Augmented-reality room visualization (Q+3).
- Native mobile apps (responsive web only).
- Custom manufacturing / ERP integration (Phase 2+).
- Multi-warehouse regional routing beyond Aalborg + Copenhagen in v1 (schema supports N warehouses).
- Real-time collaborative features (live stock counters beyond coarse availability).
- In-house tax engine (Stripe Tax is the provider).
- Client-side global data fetching (no tRPC/REST layer for UI mutations).
- Package build steps for `packages/*` (TypeScript source consumed via `transpilePackages`).

### 2.3 Personas and implications

| ID | Persona | Profile | Build implications |
|---|---|---|---|
| P1 | The Considered Buyer | 35–55, design-literate, €80k+ household; 1–3 major pieces/year; researches for weeks; values provenance, materials, longevity | PDP **MUST** carry materials, care, dimensions, sustainability, origin with editorial depth; photo reviews; no dark patterns; wishlist for multi-week cycles |
| P2 | The New-Home Nestor | 28–40, furnishing first/second home, €50k+; arrives mid-funnel from Pinterest/Instagram; sensitive to shipping cost and lead time | Lead-time badges **MUST** appear on PLP cards and PDP; shipping cost visible in cart before checkout; collections/lookbooks for room-level discovery |
| P3 | Trade Buyer (B2B) | Interior designers, architects, boutique hospitality; trade pricing, samples, credit; ~22% of forecasted revenue | Trade application + approval; trade-tier pricing **MUST** render only to approved accounts; Net-30 via Stripe Invoicing in Phase 5; bulk order pad Phase 5 |
| P4 | The Gift Buyer | Seasonal, AOV €60–€180; ships to third address | Gift wrap (+€8), gift message, gift receipt without prices; friction-free guest checkout; ceramics/textiles merchandising |

### 2.4 Success metrics (12-month targets)

| Metric | Target | Source of truth |
|---|---|---|
| Conversion rate (cold traffic) | ≥ 2.4% | `orders` count ÷ sessions; GA4 reconciles via server `order_completed` |
| Average order value | ≥ €420 | `orders.total_cents` currency-normalized to EUR |
| Repeat-purchase rate (12 mo) | ≥ 38% | Cohort on `orders.customer_id` |
| NPS | ≥ 70 | Post-delivery survey |
| Return rate | ≤ 6% | `return_requests` ÷ orders |
| Order-to-ship (in-stock) | ≤ 3 business days | Fulfillment timestamps |
| CS first response | ≤ 4 business hours | External helpdesk |
| CWV “Good” | 100% of key pages | CrUX + Lighthouse CI |
| Uptime (storefront) | ≥ 99.95% monthly | Synthetic + host SLA |
| Trade accounts active | ≥ 250 by month 12 | `trade_applications` approved and ordering |

### 2.5 Commercial envelope

| Item | Value |
|---|---|
| Target GMV year 1 | €5M+ |
| Mix | ~78% DTC, ~22% trade |
| Regions | EU (VAT-inclusive display), US (tax at checkout), UK (VAT at checkout) |
| Currencies | EUR, DKK, SEK, USD, GBP |
| Warehouses v1 | Aalborg (primary), Copenhagen (secondary) |
| Catalog size v1 | ≤ a few thousand SKUs (Postgres FTS is adequate) |
| Team | 4 people (eng, design, ops/CS, merchandising) |

---

## 3. Mandated technology stack & version manifest

Versions are **minimums**. The lockfile (`pnpm-lock.yaml`) is the pin of record. Dependencies are added **only** with `pnpm add`. `package.json` and the lockfile are never hand-edited.

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Package manager | PNPM | 10.x | `pnpm-workspace.yaml`; `node-linker=isolated` |
| Monorepo | Turborepo | 2.x | `turbo.json`; local cache default |
| Web framework | Next.js | 16.x | App Router, RSC, `proxy.ts`, async `params`/`searchParams`/`cookies()`, Turbopack |
| UI runtime | React | 19.x | RSC-first; `use()`; form actions; `useOptimistic` where suited |
| Language | TypeScript | 5.9.x | `strict`; `noUncheckedIndexedAccess`; `verbatimModuleSyntax`; `any` banned |
| Styling | Tailwind CSS | 4.x | CSS-first `@theme`; **no** `tailwind.config.js`; PostCSS via `@tailwindcss/postcss` |
| UI primitives | shadcn/ui (Radix + CVA + tailwind-merge) | current | Copied into `packages/ui`; never imported from a runtime package |
| Database | PostgreSQL | 17.x | Single source of truth; docker-compose locally; managed PG in production |
| ORM | Drizzle ORM + drizzle-kit | current | Schema in `packages/db/src/schema`; forward-only migrations |
| Auth | Better-Auth | 1.x | Email/password + magic link + Google/Apple; admin + 2FA plugins; DB sessions |
| Validation | Zod | 4.x | Every boundary; `z.infer` shared via `packages/commerce` |
| Client state | Zustand | 5.x | Drawer, wishlist chrome, UI only; `persist` + SSR-hydration-safe |
| Payments | Stripe (stripe-node) | current | Payment Intents + Payment Element + Stripe Tax + webhooks |
| Email | React Email + Resend | current | `packages/email`; log transport in dev |
| Lint | ESLint 9 flat + typescript-eslint | 9.x | `no-explicit-any` error; import boundaries per workspace |
| Unit tests | Vitest + fast-check | current | Commerce domain; colocated `*.test.ts` |
| E2E | Playwright + `@axe-core/playwright` | current | Chromium PR-blocking; WebKit nightly |
| Runtime | Node.js | 22 LTS | Pinned in `.nvmrc` |

### 3.1 Supporting choices and swap paths

| Concern | v1 choice | Swap trigger | Swap target |
|---|---|---|---|
| Search | Postgres FTS (`tsvector`, GIN) + `pg_trgm` | p95 search > 300 ms or merchandising needs (synonyms-as-data) | Algolia or Meilisearch behind `SearchProvider` |
| Rate limit | Postgres sliding window | Lock wait p95 > 20 ms or multi-region | Redis / Upstash |
| Cache | Next.js data cache + `revalidateTag` | Cache-host CPU pressure | Redis / CDN cache |
| i18n | `next-intl` (EN unprefixed; DA/DE/SV prefixed) | None anticipated | — |
| Jobs | Outbox table + in-process worker on Vercel cron | Volume or duration exceeds serverless | Trigger.dev or queue |
| Feature flags | Typed module over env vars | Marketing self-service toggling | PostHog / LaunchDarkly |
| Reviews | First-party module | Syndication / UGC moderation at scale | Junip / Yotpo |
| Consent | Cookiebot behind `ConsentProvider` | Procurement / enterprise SSO | OneTrust |
| Marketing email | Resend in v1 | Flow sophistication | Klaviyo behind `EmailProvider` |
| Images | Object storage + Next.js optimizer; `DISABLE_IMAGE_OPTIMIZER=1` in sandbox | Optimizer deadlock or variant explosion | Cloudflare Images / Cloudinary |

### 3.2 Stack governance (NFR-STACK-*)

- **NFR-STACK-1** No unverified APIs. Confirm existence for the pinned version from the package’s own types or docs before use.
- **NFR-STACK-2** Lockfile respect. `pnpm add` only.
- **NFR-STACK-3** Boundary discipline. Apps → packages; packages never import apps. Inside packages: `db ← auth ← commerce ← apps`. `packages/ui` depends only on React, Radix, Tailwind. Enforced by ESLint `import/no-restricted-paths`. Cycles break the turbo graph silently (symptom: a build that “does nothing”).
- **NFR-STACK-4** One validation dialect. Zod v4 is the single definition of input/output shapes.
- **NFR-STACK-5** Money is integers. Minor units; BigInt for division; floats never touch money.
- **NFR-STACK-6** No package build step. `packages/*` export TypeScript source; apps `transpilePackages`.
- **NFR-STACK-7** Tailwind `@source` directives in each app’s `globals.css` **MUST** include `packages/ui/src`. Auto-scan does not reach workspace packages.
- **NFR-STACK-8** `@theme` `var()` chains are dropped by the current Tailwind v4 build. Semantic tokens **MUST** be literal hex, kept in sync with the palette block.
- **NFR-STACK-9** Next.js 16 page files may export only `default`, `metadata`/`generateMetadata`, `revalidate`, `dynamic`. Extra exports fail the build.
- **NFR-STACK-10** `params`, `searchParams`, `cookies()`, `headers()` are async — always `await`.
- **NFR-STACK-11** Env vars read inside `next.config.ts` **MUST** be listed in `turbo.json` `globalEnv`.

---

## 4. System architecture

### 4.1 Monorepo layout

```
scandihaven/
├── apps/
│   ├── web/                 # Storefront — Next.js 16 (public, SEO-critical)
│   └── admin/               # Admin — Next.js 16 (auth-gated, internal)
├── packages/
│   ├── db/                  # Drizzle schema, migrations, seed, typed client
│   ├── auth/                # Better-Auth server + client, RBAC types
│   ├── commerce/            # Domain: pricing, cart, checkout, orders, promotions, tax, inventory, search; Zod contracts
│   ├── ui/                  # Design system: tokens + shadcn primitives + SH composites
│   ├── email/               # React Email templates + Resend/log transports
│   └── config/              # eslint flat config, tsconfig bases, env Zod parser
├── docker-compose.yml       # PostgreSQL 17
├── turbo.json
├── pnpm-workspace.yaml
├── docs/                    # This documentation set
└── .github/workflows/ci.yml
```

### 4.2 Three-layer model

1. **App/RSC layer** (`apps/web/src/app`, `apps/admin/src/app`). Server Components render HTML from data-access functions. Pages are `async`. Mutations go through **Server Actions** in `src/actions/*`, never ad-hoc API routes. Actions return `ActionResult<T>` and never throw across the client boundary.
2. **Client islands.** Interactive leaves (`"use client"`): cart drawer, variant selectors, gallery, quantity steppers, forms. They receive typed props from RSC and talk to the server via Server Actions or `useOptimistic`. No client-side global data-fetching layer.
3. **Domain/DB layer** (`packages/commerce`, `packages/db`). Pure, testable business logic and Drizzle queries. The only code allowed to touch the database besides `packages/auth`.

### 4.3 Route handlers (machine callers only)

| Route | Purpose |
|---|---|
| `/api/auth/[...all]` | Better-Auth |
| `/api/webhooks/stripe` | Stripe webhooks (signature verified, idempotent) |
| `/api/jobs/run` | Outbox drainer (`CRON_SECRET`) |
| `/api/health` | Liveness + DB round-trip |
| `/api/search` | Typeahead (optional; may be a Server Action instead) |

UI mutations **MUST NOT** add REST endpoints.

### 4.4 Request lifecycles

**PDP (read):** request → `proxy.ts` (locale, security headers, request ID) → RSC awaits `commerce/catalog.getProduct(slug, { region })` → Drizzle (product + variants + images + price) → HTML + JSON-LD. Gallery and variant selector hydrate as islands.

**Add to cart (write):** client island → Server Action `addToCart` → Zod parse → cart identity (HMAC cookie token → UUID) → transaction → recompute totals server-side → `revalidateTag('cart')` → `ActionResult`.

**Checkout (write):** Payment Element confirms PaymentIntent → Stripe webhook `payment_intent.succeeded` → verify signature → insert `webhook_event` (unique event ID) → **re-verify amounts** → `SELECT … FOR UPDATE` inventory → place order in one transaction → outbox jobs (email, analytics) → `/api/jobs/run` drains.

### 4.5 Cart identity (load-bearing invariant)

The signed HMAC cookie `sh_cart` (secret = `BETTER_AUTH_SECRET`) holds a **token**. The database keys on a cart **UUID**. `getCartId()` in `apps/web/src/lib/cart-session.ts` resolves token → UUID. Actions and pages **MUST NOT** interchange them. If `BETTER_AUTH_SECRET` rotates, existing carts become unreadable (documented; acceptable on secret rotation).

### 4.6 Caching

| Surface | Strategy |
|---|---|
| Home, PLP, PDP, journal | ISR `revalidate: 300` + tag invalidation |
| Cart, checkout, account, admin | `force-dynamic` |
| Tags | `product:{id}`, `plp:{category}`, `cart:{id}`, `order:{id}`, `sitemap` |

Admin publish **MUST** `revalidateTag` the affected product and PLP tags.

### 4.7 Architecture Decision Records

See `adrs.md`. Headline decisions:

| ADR | Decision |
|---|---|
| ADR-1 | Custom commerce engine, not Medusa/Shopify |
| ADR-2 | Two Next.js apps, not one app with route groups |
| ADR-3 | Better-Auth, not Auth.js / Clerk / Auth0 |
| ADR-4 | Server Actions + ActionResult, not tRPC/REST for UI |
| ADR-5 | Integer minor-unit money |
| ADR-6 | Postgres FTS in v1 behind SearchProvider |
| ADR-7 | Stripe Tax, not Avalara |
| ADR-8 | Outbox + cron, not a queue in v1 |
| ADR-9 | Cookiebot default consent vendor |
| ADR-10 | Forward-only expand/contract migrations |
| ADR-11 | SAQ-A via Payment Element — PAN never on our servers |
| ADR-12 | Zustand for chrome only; server is truth |

---

## 5. Functional requirements (summary)

The full catalog with acceptance criteria lives in `functional-requirements.md`. This table is the map.

| Range | Surface | Phase | Count (Must) |
|---|---|---|---|
| FR-100…199 | Platform chrome, IA, i18n shell, errors | 0–1 | 12 |
| FR-200…299 | PLP, facets, search, collections | 1 | 12 |
| FR-300…399 | PDP, variants, editorial content, JSON-LD | 1 | 16 |
| FR-400…499 | Cart, drawer, promos, persistence, merge | 1 | 9 |
| FR-500…599 | Checkout, tax, shipping, Stripe, confirmation | 1 | 15 |
| FR-600…699 | Account, auth, addresses, orders, GDPR | 1 | 12 |
| FR-700…799 | Journal, pages, SEO, 301s, sitemap | 1–2 | 8 |
| FR-800…899 | Admin catalog, orders, RBAC, audit, media | 0–1 | 16 |
| FR-900…949 | Trade program | 5 | 6 (schema in v1) |
| FR-950…999 | Post-purchase: email, returns, reviews, gifts | 2 / 5 | 10 |

**v1 exit (end of Phase 2)** requires every **Must** item in FR-100…899 and FR-950…964 (email, returns, reviews). Trade, gift cards, Net-30, bulk pad, subscriptions, AR are Phase 5 / roadmap and **MUST** still have schema hooks and stubbed FR IDs.

Key user flows (illustrative; acceptance in the FR catalog):

**Flow A — First-time buyer:** Instagram → home → Autumn Collection → Halden Armchair PDP → variant → add to cart → checkout → email + shipping → standard shipping + lead time → Apple Pay → confirmation email → review request 21 days post-delivery → win-back at 30 days.

**Flow B — Trade buyer (Phase 5):** `/trade` → apply with CVR + resale cert → admin approval ≤ 48h → trade prices → (later) CSV order pad + Net-30 invoice.

**Flow C — Return:** `/account/orders` → return item → reason + photo → prepaid label → warehouse inspect → refund original payment → confirmation email.

---

## 6. Cross-cutting contracts

### 6.1 ActionResult envelope

Every Server Action returns:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } }
```

`INTERNAL` is the only code that hides internals. Unexpected errors are logged with `requestId` and returned as `INTERNAL`. Domain codes (`OUT_OF_STOCK`, `PROMO_INVALID`, `PAYMENT_MISMATCH`, …) are stable and documented in `api-contracts.md`.

### 6.2 Idempotency

| Operation | Key |
|---|---|
| Stripe webhook | Stripe event ID, unique on `webhook_event` |
| Order placement | PaymentIntent ID |
| Inventory reservation | `(variant_id, warehouse_id, order_id)` |
| Outbox job | `(job_type, aggregate_id, dedupe_key)` |
| Newsletter subscribe | email (citext unique) |

Retries **MUST** be safe. Webhook handler inserts the event row first; unique-violation → return 200 without re-processing.

### 6.3 Provider interfaces (mandatory even when v1 has one implementation)

```
SearchProvider.search({ q, filters, locale, cursor })
ConsentProvider.load() / has(category) / onChange
TaxProvider.quote(cart, address)           // Stripe Tax in v1
ShippingRateProvider.quote(cart, address)  // table + white-glove rule in v1
EmailProvider.send({ template, to, data }) // Resend or log
JobRunner.enqueue / drain
FeatureFlags.get(name): boolean            // env-typed in v1
```

New vendors **MUST** implement the interface; call sites **MUST NOT** import vendor SDKs outside the adapter.

### 6.4 Feature flags (v1)

| Flag | Default | Unlocks |
|---|---|---|
| `FEATURE_TRADE` | off | Trade prices, `/trade`, admin approval |
| `FEATURE_GIFT_CARDS` | off | Gift card ledger |
| `FEATURE_REVIEWS` | on (Phase 2) | Review submit |
| `FEATURE_I18N` | on | DA/DE/SV prefixes |
| `FEATURE_KLARNA` | off | BNPL |

Flags are typed in `packages/config`. Unknown flags fail typecheck.

### 6.5 Observability minimum

JSON logs: `ts, level, msg, requestId, route, actorId?, durationMs`. PII-scrubbed. Correlation ID generated in `proxy.ts`. Sentry (or platform equivalent) with release tagging. `/api/health` checks DB. RUM web-vitals beacons consent-gated.

### 6.6 Error pages

404 (product, page, catch-all), 500 with correlation ID, checkout “not configured” when Stripe keys are absent (E2E asserts this state; tests **MUST NOT** fake payment).

---

## 7. Data, money, inventory & orders

Full DDL-level schema: `data-model.md`.

### 7.1 Money

- Storage: integer minor units (`integer` / `bigint` where needed). Currency `char(3)`.
- Arithmetic: `packages/commerce/src/money.ts`. Division uses BigInt largest-remainder so distributed discounts conserve totals.
- Display: region decides VAT-inclusive vs exclusive. EU storefront shows VAT-inclusive; US/UK show tax at checkout.
- FX: EUR is the catalog base. Per-currency override allowed. Daily rates table. Rounding monotonic (property-tested).
- **Floats never touch money.** Lint + review gate.

### 7.2 Inventory

```
availability = qty_on_hand − qty_reserved − safety_stock
```

Made-to-order variants have **no** inventory rows and are always purchasable; PDP **MUST** show lead-time days. In-stock purchases reserve in the placement transaction with `SELECT … FOR UPDATE`. Oversell is a Sev-2 incident (see `runbooks.md`). Append-only `inventory_movement` ledger.

Warehouses v1: `aalborg`, `copenhagen`. Schema supports N.

### 7.3 Order state machine

Transitions **only** via `commerce/order-state.ts transition()`. Illegal transitions throw `InvalidOrderTransition`.

```
pending_payment → paid → fulfilling → fulfilled → delivered
                ↘ canceled
paid → refunded (full)
paid → partially_refunded → refunded
fulfilling → canceled (restock)
delivered → return_requested → returned
```

Every transition writes `order_event` (actor, from, to, reason, at).

### 7.4 Checkout amount re-verification

On `payment_intent.succeeded` the handler **MUST** recompute cart totals (prices, promo, tax, shipping) and compare to PaymentIntent amount. Mismatch → do not place the order; mark PI for review; compensate (refund) per runbook. This is the load-bearing integrity control against stale carts and promo tampering.

### 7.5 Seed & fixtures

Idempotent `ensureSeeded()` with advisory lock + natural-key upserts. Refuses non-local `DATABASE_URL` hosts. Seed catalog (Halden armchair, Woo runner, Øresund lamp, Hygge wool throw, …) doubles as E2E fixtures. Typed builders `aProduct`, `aCart`, `anOrder` validate against the same Zod schemas as production.

### 7.6 Migrations

Forward-only. A bad migration ships a corrective forward migration. Deploy pairs app + N−1 schema compatibility for one release (expand/contract, ADR-10). After schema edits: `pnpm db:generate`, review SQL, prepend `CREATE EXTENSION IF NOT EXISTS citext/pg_trgm` if needed, then `pnpm db:migrate`.

---

## 8. Auth, security & compliance (summary)

Depth: `security-compliance.md`.

- Better-Auth: email/password, magic link, Google, Apple. DB sessions. Admin plugin. 2FA **required** for all admin users.
- RBAC matrix is the single source of truth in `packages/auth/src/rbac.ts`. Server Actions call `requirePermission()`; no inline role checks. Roles: `customer`, `trade`, `admin_merch`, `admin_ops`, `admin_finance`, `admin_super`.
- PCI: Payment Element + Payment Intents. PAN never on our servers. SAQ-A.
- GDPR: consent banner (Cookiebot), DSR export + delete in admin, retention (orders 7 years anonymized; profiles deletable).
- CCPA: “Do Not Sell” footer link.
- EU DSA: trader identification on PDPs; illegal-content reporting channel.
- Security headers set in `proxy.ts`: CSP (Stripe/consent allowlists), HSTS, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`.
- Rate limits (Postgres sliding window v1): auth 10/min/IP, checkout 30/min/IP, search 60/min/IP, webhooks unbounded but signature-gated.
- Secrets: never committed. `.env.example` uses `set-me`. CI secret scan. App DB role has no DDL in production.
- Audit log for every admin mutation.

---

## 9. Design system & frontend standards (summary)

Depth: `design-system.md`. Tokens **MUST** match the captured landing page.

| Token | Value | Usage |
|---|---|---|
| `--color-bg / bg-2 / bg-3` | `#FAF7F2` / `#F0EAE0` / `#E8E0D2` | Surfaces |
| `--color-ink / ink-2 / muted` | `#1F1B17` / `#4A433B` / `#6F665C` | Text (AA on cream) |
| `--color-accent / accent-2` | `#C97B5E` / `#8F4326` | Terracotta display / AA buttons & links |
| `--color-sage / wood` | `#8B9A82` / `#C9A876` | Badges |
| `--color-line` | `#E5DDD1` | Hairlines |
| Radii | 2px cards / 999px pills / 0 images | Editorial sharpness |
| Motion | `cubic-bezier(.22, 1, .36, 1)` · 200/300/400/800 ms | `prefers-reduced-motion` respected |
| Type | Fraunces (display, `next/font`) · Inter (UI) | Self-hosted, no render-blocking remote fonts |

**Anti-generic rule:** no purple-gradient-on-white, no default Inter-on-slate admin aesthetic on the storefront, no unconsidered card grids. Every pixel serves the quiet, material, Northern-European brand.

WCAG 2.2 AA is the floor: visible focus (`--ring`, never `outline: none`), skip-to-content, landmarks, 4.5:1 body / 3:1 large, 24px targets (2.5.8) with 44px primary CTAs, alt text enforced at upload, axe serious/critical = 0 on key templates.

Terracotta `#C97B5E` on `#FAF7F2` is **large-text/UI accent only**. Body links use `--color-accent-2` (`#8F4326`).

---

## 10. SEO, analytics, i18n & performance

### 10.1 SEO

- Server-rendered HTML on all indexable pages.
- Per-page editable `title`, `meta description`, `og:image`, `canonical`.
- `sitemap.xml` daily: PLP, PDP, collections, journal, static pages.
- `robots.txt` blocks `/admin`, `/account`, `/cart`, `/checkout`, `/search`.
- JSON-LD: `Product`, `Offer`, `AggregateRating`, `BreadcrumbList`, `Article`, `Organization`, `WebSite` + `SearchAction`.
- Pagination via `?page=N` (not infinite scroll) for indexable PLPs.
- `hreflang` for EN/DA/DE/SV. URL prefix wins; `Accept-Language` may suggest, never auto-redirect (SEO-safe).
- 301 manager in admin (FR-706). High-traffic URL map before launch.

### 10.2 Analytics events

`page_viewed`, `product_viewed`, `product_list_viewed`, `product_added_to_cart`, `product_removed_from_cart`, `cart_viewed`, `checkout_started`, `checkout_step_completed`, `payment_info_entered`, `order_completed` (**server**), `wishlist_added/removed`, `review_submitted`, `newsletter_subscribed`, `search_performed`, `promotion_applied`.

Source of truth: order tables. GA4 reconciles via server `order_completed`. All tags consent-gated.

### 10.3 i18n & regions

Locales: `en` (default, unprefixed), `da`, `de`, `sv` (prefix). Currency/region is orthogonal to locale (a Dane may shop in EUR or DKK). Translatable fields live in `*_locale` tables with EN fallback.

Regions: EU (EUR, VAT-inclusive), US (USD, tax at checkout), UK (GBP, VAT at checkout).

### 10.4 Performance budgets (4G mobile)

| Page | LCP | INP | CLS | JS transferred |
|---|---|---|---|---|
| Homepage | < 2.0 s | < 200 ms | < 0.05 | < 180 KB |
| PLP | < 2.0 s | < 200 ms | < 0.05 | < 200 KB |
| PDP | < 2.0 s | < 200 ms | < 0.05 | < 220 KB |
| Checkout | < 1.5 s | < 100 ms | < 0.02 | < 250 KB |

Enforcement: Lighthouse CI on PR. Hero ≤ 200 KB, product image ≤ 80 KB at upload. Stripe.js loaded only on checkout. RSC-first keeps hydration islands small.

---

## 11. Quality engineering (summary)

Depth: `quality-engineering.md`.

| Level | Tool | Gate |
|---|---|---|
| Unit / property | Vitest + fast-check | PR-blocking; 90% lines / 85% functions on `packages/commerce` pure modules |
| Component | Vitest + Testing Library | PR-blocking for touched components |
| Integration | Vitest + real PG | Nightly + PR on commerce changes |
| E2E | Playwright Chromium | PR-blocking |
| E2E matrix | Chromium + WebKit | Nightly |
| a11y | `@axe-core/playwright` | Zero serious/critical on key templates, PR-blocking |
| Security | `pnpm audit --audit-level high`, secret scan | PR-blocking |
| Visual | Playwright screenshots | Advisory until post-v1 |

**E2E critical paths (v1 exit):** guest checkout (or honest “not configured”) → admin order; account purchase → reorder; search → PDP → variant → cart persistence; promo totals; return on delivered order; admin publish → PDP live; admin inventory adjust → badge; axe on home/PLP/PDP/checkout.

A red test is a regression or a wrong test — **never skipped to pass**.

Verification ledger (`docs/verification-ledger.md` in the code repo): command, workspace, result, confidence tag. PRs touching money, auth, or order placement **MUST** include ledger entries.

---

## 12. Environments, SLOs, cost & release

Depth: `operations-and-release.md`.

### 12.1 Environments

| Env | Data | Payments |
|---|---|---|
| Local | docker compose PG17; `pnpm db:seed` | Stripe test |
| Preview (per PR) | Fresh migrate + seed | Stripe test |
| Staging | Production-like, anonymized | Stripe test |
| Production | PITR backups | Stripe live |

### 12.2 SLOs

| SLO | Target | Error-budget alert |
|---|---|---|
| Storefront availability | 99.95% / 30 d | Burn > 2% in 1 h |
| Storefront error rate | < 1% / 5 min | Immediate |
| p95 TTFB (HTML) | < 800 ms | 15 min |
| Checkout success (given PI confirm) | ≥ 99.5% | 15 min |
| Webhook lag | < 5 min | Immediate |
| Outbox dead-letter | 0 | Immediate |

### 12.3 Capacity & cost (Reasoned, four-person team, €5M GMV)

Assumptions: ~12k orders/year at €420 AOV; peak 20× average (holiday); catalog < 5k SKUs; media on object storage + CDN.

| Item | Envelope (annual, order of magnitude) |
|---|---|
| Vercel (two Next apps) | low four figures |
| Managed PostgreSQL 17 multi-AZ | low-to-mid four figures |
| Object storage + CDN | low three-to-four figures |
| Stripe fees | ~1.4–2.9% + fixed — commercial COGS, not infra |
| Resend / Sentry / Cookiebot | low three figures each |
| Total infra excl. payment fees | target **< 2% of GMV** |

No service exists that the team cannot debug. Redis, Algolia, Trigger.dev are explicit later costs gated by swap triggers.

### 12.4 Rollout

| Phase | Duration | Exit |
|---|---|---|
| 0 Foundations | 4 wks | `pnpm lint typecheck test build` green; migrate+seed empty PG17; E2E smoke; README on a clean machine |
| 1 MVP storefront | 6 wks | E2E critical paths; staging perf budgets |
| 2 Pre-launch polish | 3 wks | Lighthouse; axe clean; SEO checklist; consent live; emails |
| 3 Soft launch | 2 wks | Error budget held; CR/AOV sanity |
| 4 Public launch | cutover | 48 h war-room; SLOs green; 301s |
| 5 Post-launch | ongoing | Trade (+4 wks), gift cards (+6 wks), Net-30, bulk pad, subscriptions Q+2, AR Q+3 |

### 12.5 Definition of Ready / Done

**Ready (a ticket may start):** FR ID named; acceptance criteria testable; schema impact noted (or “none”); feature flag named if gated; no more than one material ambiguity.

**Done (a ticket may merge):** lint + typecheck + tests + build green; FR acceptance covered by an automated test or an explicit Unverifiable label; money/auth/order PRs have a ledger entry; no `any`; no skipped tests; stubs still name remaining FR IDs.

---

## 13. Risks, open questions & sign-off

### 13.1 Risk register

| Risk | L | I | Mitigation |
|---|---|---|---|
| Long made-to-order lead times hurt conversion | High | High | Lead-time badges (FR-207/304); in-stock filter; safety stock for hero SKUs |
| Cross-border tax (EU OSS + US nexus) | Med | High | Stripe Tax day 1; quarterly tax review; tax snapshot on order lines |
| Oversell on concurrent purchases | Med | Med | Reservation + `FOR UPDATE`; oversell runbook |
| Carrier damage on large furniture | Med | Med | White-glove > 30 kg; packaging spec; damage SOP |
| Image bloat | High | Med | Upload caps; AVIF/WebP; Lighthouse CI |
| Custom-build scope creep | Med | High | FR discipline; Phase 1 frozen; ADR-1 fallback |
| Postgres-only rate limiting under abuse | Low | Med | Tuned limits; WAF; Redis swap trigger |
| Trade program abuse | Low | Med | Manual approval + resale cert; order limits; Radar |
| SEO migration | Med | High | 301 manager; URL map; weekly 404 review |
| Single oak supplier | Low | High | Second supplier (ops); safety stock |
| Key-person / stack quirks | Med | Med | ADRs; skills library; AGENTS.md verified notes |
| Secret rotation invalidates carts | Low | Low | Documented; customers rebuild cart |

### 13.2 Open questions (reduced from v1/v2)

| # | Question | v3.0 disposition |
|---|---|---|
| 1 | Launch currencies | **Closed:** EUR, DKK, SEK, USD, GBP |
| 2 | Net-30 | **Closed:** Stripe Invoicing in Phase 5 |
| 3 | Southern-Europe 3PL | **Open — business, Q+2.** Schema ready. |
| 4 | Consent vendor | **Closed:** Cookiebot default; OneTrust swap |
| 5 | Editorial CMS Sanity vs in-house | **Closed for v1:** in-house WYSIWYG. Sanity remains a Phase 5 option if editorial headcount grows. |
| 6 | Klarna BNPL at launch | **Closed:** off (`FEATURE_KLARNA`); Phase 5 if DE/SE/DK demand |

### 13.3 Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Product | | | |
| Engineering | | | |
| Design | | | |
| Operations | | | |
| Legal | | | |

---

## 14. Agent operating contract

Derived from `spec-driven-development`, `plan-writing`, `AGENTS.md`, and `CLAUDE.md`. Binding on human and AI implementers.

### Always

- Read the relevant PRD section and existing code **in full** before writing.
- Name the FR IDs that govern the change.
- Use `pnpm`, never `npm`/`yarn`.
- Keep money as integers; order transitions through `transition()`; cart token≠UUID.
- Return `ActionResult`; never throw across the action boundary.
- Log caught errors with context; never swallow.
- Run `pnpm lint typecheck test build` (and migrate+seed before e2e).
- Label claims Verified / Reasoned / Assumed / Unverifiable.

### Ask first

- Schema changes that are not additive.
- New dependencies.
- CI config, CSP, or auth changes.
- Enabling a feature flag in production.
- Introducing Redis, Algolia, a queue, or any swap-path vendor before its trigger.

### Never

- Commit secrets or `.env` files (except `.env.example`).
- Hand-edit `package.json` / lockfiles after bootstrap.
- Skip or weaken tests, lint, or types to pass a gate.
- Add REST endpoints for UI mutations.
- Import vendor SDKs outside their adapter.
- Use `any`, `sql.raw`, or float arithmetic on money.
- Add a build step to `packages/*`.
- Fake Stripe payment in E2E.

### Workflow

```
ANALYZE (PRD + code) → PLAN (smallest correct path) → VALIDATE (money/auth/orders)
    → IMPLEMENT (thin vertical slice) → VERIFY (gates + ledger) → DELIVER
```

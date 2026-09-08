# Scandi Haven — Production-Ready E-Commerce Platform

**Final Product Requirements Document**

| Field | Value |
|---|---|
| Version | 4.0 |
| Status | Approved for build |
| Supersedes | `PRD_draft.md` v1.0 (stack recommendation only; domain scope preserved); `PRD_v3a.md` / `PRD_v3b.md` v3.0 proposals (reviewed and synthesized into this revision) |
| Author | Product Engineering |
| Last updated | 2026-09-08 |
| Companion artifact | Monorepo scaffold implemented in this repository (see §4.9 and Appendix B) |

---

## Table of Contents

1. [Document Control & Executive Summary](#1-document-control--executive-summary)
2. [Goals, Non-Goals, Personas & Success Metrics](#2-goals-non-goals-personas--success-metrics)
3. [Mandated Technology Stack & Version Manifest](#3-mandated-technology-stack--version-manifest)
4. [System Architecture](#4-system-architecture)
5. [Functional Requirements — Storefront (FR-100…FR-599)](#5-functional-requirements--storefront-fr-100fr-599)
6. [Functional Requirements — Accounts, Content, Admin, Trade & Post-Purchase (FR-600…FR-999)](#6-functional-requirements--accounts-content-admin-trade--post-purchase-fr-600fr-999)
7. [Data Model — Drizzle Schema](#7-data-model--drizzle-schema)
8. [API & Data-Access Specification](#8-api--data-access-specification)
9. [Auth, Security & Compliance](#9-auth-security--compliance)
10. [Design System & Frontend Standards](#10-design-system--frontend-standards)
11. [SEO, Analytics, i18n & Performance Budgets](#11-seo-analytics-i18n--performance-budgets)
12. [Quality Engineering: Testing, Accessibility & Observability](#12-quality-engineering-testing-accessibility--observability)
13. [Environments, Infrastructure & Release Plan](#13-environments-infrastructure--release-plan)
14. [Risks, Traceability & Appendices](#14-risks-traceability--appendices)
15. [Agent Operating Contract](#15-agent-operating-contract)

---

## 1. Document Control & Executive Summary

### 1.1 Purpose of this revision

The v1.0 draft defined the commercial and operational scope of the Scandi Haven platform in detail, but its technical recommendation — Medusa.js v2 as the commerce backend, Next.js 14 as the storefront, and Clerk/Auth0 as the identity provider — has been superseded by an engineering mandate to build the commerce engine in-house on a fully specified, modern TypeScript stack. This revision preserves the draft's domain scope, personas, commercial targets, design language, and compliance obligations in full, and re-specifies every technical decision around the mandated stack. Where the draft left implementation detail open ("REST or GraphQL", "Algolia or Meilisearch", "Avalara or Stripe Tax"), this document closes those questions with concrete, versioned decisions and records the reasoning so future maintainers can revisit them safely.

Three properties were non-negotiable in this revision. First, **build-readiness**: every functional requirement carries a stable identifier (FR-x.y), a priority, and testable acceptance criteria; every data entity is specified down to column, type, and index level so that the Drizzle schema can be written without further interpretation. Second, **honesty about scope**: v1 exclusions are stated as clearly as inclusions, and the accompanying scaffold marks precisely which surfaces are implemented and which are stubbed. Third, **verifiability**: the plan is paired with a quality-engineering regime in which claims of correctness require evidence — commands run, tests observed, results recorded — rather than assertion.

**What v4 adds.** The v3 proposal pair (`PRD_v3a.md`, `PRD_v3b.md`) was reviewed end-to-end against both this document and the implemented scaffold. v4 synthesizes the best of those proposals into a single contract: a closed-decisions registry, provider ports that fix vendor seams even where v1 has one implementation, a typed feature-flag module, SLOs with error-budget alerts, Definition of Ready/Done, an agent operating contract (§15), and a stack-governance rule set that promotes hard-won platform lessons (Tailwind v4 `@source`, `@theme` literal tokens, Next.js 16 async request APIs, `turbo.json globalEnv`) to numbered NFRs so they cannot regress. v4 also closes the gap between specification and code: five remediation slices (feature flags, provider ports, cart idempotency, promotion cap invariants, and the outbox drainer `/api/jobs/run`) were implemented test-first and verified — Appendix B records the evidence.

### 1.2 Executive summary

Scandi Haven is a direct-to-consumer brand selling handcrafted Scandinavian furniture, lighting, textiles, and ceramics. The current marketing landing page communicates the brand but is functionally inert: no real checkout, no accounts, no inventory, no administration. This PRD specifies a full production e-commerce platform — customer-facing storefront, commerce engine, admin back-office, trade (B2B) program, and third-party integrations — capable of supporting €5M+ annual GMV across EU, US, and UK markets operated by a four-person team.

The platform is built as a **PNPM + Turborepo monorepo** of two Next.js 16 applications (storefront and admin) and a set of shared packages (database, auth, UI system, commerce domain, configuration). PostgreSQL 17 is the single source of truth, accessed through Drizzle ORM. Better-Auth provides authentication and RBAC. Stripe provides payments, tax calculation, and (post-launch) trade invoicing. The frontend uses Tailwind CSS v4 with a CSS-first design-token layer and shadcn/ui primitives themed to the Scandi Haven design language (Fraunces + Inter, warm editorial palette). State that belongs to the client — cart drawer visibility, wishlist, UI chrome — lives in Zustand v5 stores; everything else is server-rendered React Server Components reading directly from the database.

**North-star metric:** conversion rate (visitor → paid order) ≥ 2.4% on cold traffic.
**Secondary metrics:** AOV ≥ €420; repeat-purchase rate ≥ 38% within 12 months; NPS ≥ 70.

### 1.3 What changed relative to the draft (v1.0 → v2.0 → v4.0)

| Area | Draft v1.0 | v2.0 | v4.0 |
|---|---|---|---|
| Commerce backend | Medusa.js v2 (self-hosted) | Custom engine in `packages/commerce` | Unchanged; remediation closed the idempotency + outbox gaps |
| Storefront framework | Next.js 14 | Next.js 16 (`proxy.ts`, async params) | Platform quirks promoted to NFR-STACK-1..11 |
| Auth | Auth0 / Clerk | Better-Auth 1.x (self-hosted) | Unchanged |
| Database | PostgreSQL 16 | PostgreSQL 17 | Unchanged |
| ORM | (Medusa's) | Drizzle ORM + drizzle-kit | Unchanged |
| Styling | Tailwind CSS (v3-era) | Tailwind CSS v4 (CSS-first `@theme`) | AA-verified token values recorded (§10.1) |
| UI primitives | Custom Storybook-first | shadcn/ui (Radix + CVA) themed | Unchanged |
| Client state | (unspecified) | Zustand v5 | Unchanged |
| Validation | (unspecified) | Zod v4 at every boundary | Unchanged |
| Search | Algolia / Meilisearch | Postgres FTS + trigram | `SearchProvider` port formalized (§4.8) |
| Consent vendor | Cookiebot / OneTrust | Interface only, vendor pre-launch | **Closed:** Cookiebot default behind `ConsentProvider`; local internal impl ships first (§14.6) |
| Currencies | Open | Open | **Closed:** EUR, DKK, SEK, USD, GBP (§14.6) |
| Net-30 | Open | Stripe recommended | **Closed:** Stripe Invoicing, Phase 5 (§14.6) |
| Feature flags | (unspecified) | Typed module over env vars | Implemented in `packages/config/flags`; unknown flags fail fast (§4.8) |
| Provider seams | (unspecified) | Named informally | Six ports mandatory even with one impl (§4.8) |
| Outbox jobs | (unspecified) | `jobs` table + cron drainer | `/api/jobs/run` implemented (SKIP LOCKED, retry/backoff, dead-letter) |
| SLOs / DoR-DoD | Absent | Partial | SLO table with burn-rate alerts (§12.6); DoR/DoD (§1.6) |
| Agent contract | Absent | Informal standards | Binding operating contract (§15) |
| Redis | ElastiCache | Deferred; Postgres-backed limiting | Unchanged; swap trigger quantified (§3.2) |

### 1.4 How to read this document

Sections 2–4 are the contract every engineer must internalize: goals, stack, architecture. Sections 5–6 are the functional requirements — the "what". Sections 7–9 are the data, API, and security specifications — the "how" at contract level. Sections 10–13 govern the frontend, quality, and operations. Section 14 carries traceability and appendices, and §15 binds every implementer (human or agent). Acceptance criteria use RFC-2119 verbs (**MUST/SHOULD/MAY**). The companion scaffold in this repository implements the Phase 0 foundation described in §13.2; Appendix B maps scaffold artifacts to requirements.

### 1.5 Closed decisions registry

Questions that were open in the draft and debated across v2/v3 are closed here. Reopening one requires an ADR (§4.6) and product sign-off — these are not implementation details an engineer may relitigate unilaterally.

| # | Question | Disposition | Revisit trigger |
|---|---|---|---|
| 1 | Launch currencies | EUR, DKK, SEK, USD, GBP; EU=EUR, US=USD, UK=GBP defaults; schema carries any set | New market with an unsupported currency |
| 2 | Net-30 trade terms | Stripe Invoicing, Phase 5; v1 trade pays by card (`payment_terms` column ships now) | Phase 5 kickoff |
| 3 | Consent vendor | Cookiebot behind the `ConsentProvider` port; the local internal provider ships for soft launch; OneTrust is the documented swap | Procurement or enterprise-SSO requirement |
| 4 | Editorial CMS | In-house admin WYSIWYG for v1 (static_page/journal tables); Sanity remains a Phase 5 option | Editorial headcount growth |
| 5 | Klarna BNPL | Off in v1 (`FEATURE_KLARNA`); Phase 5 if DE/SE/DK demand materializes | Payment-mix analytics |
| 6 | Southern-Europe 3PL | Open business question, Q+2; schema is multi-warehouse ready | Q+2 business review |
| 7 | Rate limiting | Postgres sliding window in v1; Redis only on the §3.2 trigger | Sustained lock wait p95 > 20 ms or multi-region |

### 1.6 Definition of Ready / Definition of Done

A ticket **may start** when: the governing FR ID is named; acceptance criteria are testable; schema impact is stated (or "none"); the feature flag is named if the surface is gated; and no more than one material ambiguity remains.

A ticket **may merge** when: `pnpm turbo lint typecheck test build` is green; every FR acceptance criterion is covered by an automated test or carries an explicit Unverifiable label; PRs touching money, auth, or order placement include a verification-ledger entry (§12.4); no `any` and no skipped tests exist; and remaining stubs still name their FR IDs so nothing is silently missing.

---

## 2. Goals, Non-Goals, Personas & Success Metrics

### 2.1 Goals

1. Replace the static landing page with a complete storefront: PLP, PDP, cart, checkout, order confirmation, customer account, and order management.
2. Provide an admin back-office for products, orders, customers, content, and promotions that a non-technical operator can use without engineering support.
3. Support multi-region trading (EU + US + UK) with localized pricing, taxes, shipping, and language.
4. Achieve Core Web Vitals "Good" on all key pages, WCAG 2.2 AA accessibility, and SEO competitiveness from day one.
5. Remain commercially extensible: discounts, gift cards, trade program, and subscriptions must fit the data model without rework.
6. Keep total cost of operation proportionate to a four-person team: no service exists that the team cannot debug, and no runtime component exists that the team cannot reproduce locally in one command.

### 2.2 Non-goals (v1)

- Marketplace / third-party sellers.
- Physical retail POS integration.
- Augmented-reality room visualization.
- Native mobile apps (responsive web only).
- Custom manufacturing / ERP integration (Phase 2).
- Multi-warehouse regional routing logic beyond the two defined warehouses (§7.3) — the schema supports N warehouses, but v1 operates Aalborg + Copenhagen only.
- Real-time collaborative features (live stock counters beyond coarse availability).

### 2.3 Personas and their implications

| ID | Persona | Profile | Design and build implications |
|---|---|---|---|
| P1 | The Considered Buyer | 35–55, design-literate professional, €80k+ household income; buys 1–3 major pieces/year; researches for weeks; values provenance, materials, longevity | PDP must carry materials, care, dimensions, sustainability, and origin with editorial depth; reviews with photos; no dark patterns; wishlist for multi-week decision cycles |
| P2 | The New-Home Nestor | 28–40, furnishing first/second home, €50k+; arrives mid-funnel from Pinterest/Instagram; buys across categories; sensitive to shipping cost and lead-time clarity | Lead-time badges are mandatory on PLP cards and PDP; shipping cost visible in cart before checkout; collections/lookbooks for room-level discovery |
| P3 | Trade Buyer (B2B) | Interior designers, architects, boutique hospitality; needs trade pricing, lead times, samples, credit; ~22% of forecasted revenue | Trade application + approval workflow; trade-tier pricing rendered only to approved accounts; Net-30 via Stripe Invoicing post-launch (§6.9); bulk order pad deferred to Phase 5 |
| P4 | The Gift Buyer | Seasonal, AOV €60–€180; ships to third address | Gift wrap (+€8), gift message field, gift receipt without prices; friction-free guest checkout; ceramics/textiles merchandising |

### 2.4 Success metrics (12-month targets)

| Metric | Target | Measurement source |
|---|---|---|
| Conversion rate (cold traffic) | ≥ 2.4% | GA4 purchase event ÷ sessions, server-side order count as truth |
| Average order value | ≥ €420 | Order table, currency-normalized to EUR |
| Repeat-purchase rate (12 mo) | ≥ 38% | Cohort report on orders |
| NPS | ≥ 70 | Post-delivery survey (Klaviyo/Resend flow) |
| Return rate | ≤ 6% | Return requests ÷ orders |
| Order-to-ship lead (in-stock) | ≤ 3 business days | Fulfillment timestamps |
| CS first response | ≤ 4 business hours | Helpdesk (external) |
| Core Web Vitals "Good" | 100% of key pages | CrUX + Lighthouse CI |
| Uptime (storefront) | ≥ 99.95% monthly | Synthetic monitoring + host SLA |
| Trade accounts active | ≥ 250 by month 12 | Trade application table |
| Checkout error rate | ≤ 0.5% of checkout starts | Server Action error telemetry (§11.2 events) |
| P1 security findings open > 7 days | 0 | `pnpm audit` / CI security dashboard (§12.1) |

---

## 3. Mandated Technology Stack & Version Manifest

### 3.1 Stack table

Versions are minimums validated against the npm registry at PRD authoring time (2026-09). The lockfile (`pnpm-lock.yaml`) is the real pin of record; `pnpm update` runs are deliberate acts, reviewed in PRs.

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Package manager | PNPM | 10.x | Workspaces via `pnpm-workspace.yaml`; hoisting pattern `node-linker=isolated` default |
| Monorepo | Turborepo | 2.x | Task graph in `turbo.json`; remote cache optional, local cache default |
| Web framework | Next.js | 16.x | App Router; RSC; `proxy.ts` (replaces `middleware.ts`); async `params`/`searchParams`/`cookies()`; Turbopack builds |
| UI runtime | React | 19.x | RSC-first; `use()`; form actions; `useOptimistic` where suited |
| Language | TypeScript | 5.9.x | `strict: true`; `noUncheckedIndexedAccess: true`; `verbatimModuleSyntax: true`; `unknown` over `any` — `any` is banned by lint rule |
| Styling | Tailwind CSS | 4.x | CSS-first configuration via `@theme`; no `tailwind.config.js`; PostCSS via `@tailwindcss/postcss` |
| PostCSS | postcss + @tailwindcss/postcss | current | Single PostCSS entry per app |
| UI primitives | shadcn/ui (Radix + CVA + tailwind-merge) | current | Copied into `packages/ui` and themed; never imported from a runtime package |
| Database | PostgreSQL | 17.x | Single source of truth; `docker-compose.yml` locally; managed PG in production |
| ORM | Drizzle ORM + drizzle-kit | current | Schema in `packages/db/src/schema`; migrations generated, never hand-edited; forward-only |
| Auth | Better-Auth | 1.x | Email/password + magic link + Google/Apple OAuth; admin + 2FA plugins; DB sessions |
| Validation | Zod | 4.x | Schemas colocated with features; `@` output types shared via `packages/commerce` |
| Client state | Zustand | 5.x | Cart drawer, wishlist, UI chrome; `persist` middleware; SSR-hydration safe patterns |
| Payments | Stripe (stripe-node) | current | Payment Intents + Payment Element; Stripe Tax; webhooks with signature verification |
| Email | React Email + Resend | current | Templates as React components in `packages/email`; Resend adapter; dev falls back to log transport |
| Lint | ESLint (flat config) + typescript-eslint | 9.x | Strict rules; `no-explicit-any` error; import boundaries enforced per workspace |
| Unit tests | Vitest | current | Commerce domain logic; colocated `*.test.ts` |
| E2E tests | Playwright | current | Chromium + WebKit projects; a11y assertions via `@axe-core/playwright` |
| Runtime | Node.js | 22 LTS / 24 | CI and production pinned to one line (`.nvmrc`) |

### 3.2 Supporting choices (and their swap paths)

These are **not** part of the mandated core but are required by the domain scope. Each names the trigger for replacement so the decision stays revisitable rather than accidental:

- **Search: PostgreSQL full-text search (`tsvector`, GIN) + `pg_trgm` for typo tolerance.** v1 catalog is ≤ a few thousand SKUs; Postgres FTS is adequate and keeps the stack pure. Swap trigger: sustained p95 search latency > 300 ms or merchandising needs (synonyms-as-data, curated ranking) that outgrow SQL. Swap target: managed Algolia or Meilisearch behind the same `SearchProvider` interface in `packages/commerce`.
- **Rate limiting: PostgreSQL-backed sliding window in v1.** Swap trigger: sustained lock contention on the limiter table or multi-region deployment. Swap target: Redis/Upstash.
- **Caching: Next.js data cache + `revalidateTag`, no external cache service in v1.** Swap trigger: measured cache-host CPU pressure.
- **i18n routing: `next-intl`.** EN default; DA, DE, SV via URL prefix. Swap trigger: none anticipated; next-intl is the App Router standard.
- **Background jobs: none in v1.** Order-lifecycle side effects (emails, review-request scheduling) execute in the webhook/action path with idempotency keys and an outbox table (`jobs`) processed by a lightweight in-process worker route on Vercel cron. Swap trigger: job volume or long-running tasks exceed serverless limits → Trigger.dev or a queue service.
- **Feature flags: typed module over environment variables.** Swap trigger: marketing requires self-service toggling → PostHog/LaunchDarkly.
- **Reviews: first-party module** (verified-buyer enforcement via order data). Swap trigger: syndication or UGC moderation needs at scale → Junip/Yotpo.
- **Consent: interface fixed (`ConsentProvider` + gated analytics loader); vendor (Cookiebot or OneTrust) selected before public launch.** Soft-launch can run with an internal consent banner implementing the same interface.

### 3.3 Stack governance rules (NFR-STACK-1 … NFR-STACK-11)

These are PR-blocking. Rules 7–11 are **promoted from verified build failures** in this repository — they are the hard-won lessons the v3 proposals argued for, stated so they cannot regress silently:

1. **NFR-STACK-1 — No unverified APIs.** Before any library API is used, its existence for the pinned version is confirmed from the package's own types or docs. Enforced in code review.
2. **NFR-STACK-2 — Lockfile respect.** Dependencies are added with `pnpm add` only; `package.json` and `pnpm-lock.yaml` are never hand-edited.
3. **NFR-STACK-3 — Boundary discipline.** Apps may import from packages; packages never import from apps. Inside packages: `db ← auth ← commerce ← apps`; `packages/ui` depends only on React, Radix, and Tailwind. Enforced by review plus the Turborepo task graph (mechanical `import/no-restricted-paths` linting is a Phase 1 hardening item — Appendix B).
4. **NFR-STACK-4 — One validation dialect.** Zod v4 schemas are the single definition of input/output shapes; React prop types derive from them (via `z.infer`) rather than drifting by hand.
5. **NFR-STACK-5 — Money is integers.** All monetary values are stored and computed in integer minor units in `integer`/`bigint` columns; floats never touch money (§7.2). Division uses BigInt largest-remainder.
6. **NFR-STACK-6 — No package build step.** `packages/*` export TypeScript source consumed via `transpilePackages`; exceptions require an ADR.
7. **NFR-STACK-7 — Tailwind `@source` directives.** Each app's `globals.css` MUST declare `@source` paths reaching `packages/ui/src`. Auto content detection does not scan workspace packages, so utilities used only in `packages/ui` are silently absent without it (Verified).
8. **NFR-STACK-8 — `@theme` tokens are literal.** `var()` chains inside a Tailwind v4 `@theme` block are dropped by the current build; shadcn semantic tokens MUST be literal hex values kept in sync with the palette (Verified).
9. **NFR-STACK-9 — Next.js 16 page-file exports.** Page files may export only `default`, `metadata`/`generateMetadata`, `revalidate`, and `dynamic`; anything else fails the build.
10. **NFR-STACK-10 — Async request APIs.** `params`, `searchParams`, `cookies()`, and `headers()` are async — always `await` them.
11. **NFR-STACK-11 — Turbo env propagation.** Env vars read inside `next.config.ts` MUST be listed in `turbo.json` `globalEnv` or builds re-run stale cache entries (Verified). Related: `react-dom/server` MUST NOT be statically imported anywhere in the App Router graph — the bundler rejects it; resolve it at runtime (`turbopackIgnore` dynamic import) when a Node-only renderer is unavoidable (Verified; see `packages/email/src/send.ts`).

---

## 4. System Architecture

### 4.1 Monorepo layout

```
scandihaven/
├── apps/
│   ├── web/                    # Storefront — Next.js 16 (public, SEO-critical)
│   └── admin/                  # Admin back-office — Next.js 16 (auth-gated, internal)
├── packages/
│   ├── db/                     # Drizzle schema, migrations, seed, typed client
│   ├── auth/                   # Better-Auth server + client instances, RBAC types
│   ├── commerce/               # Domain logic: pricing, cart, checkout, orders,
│   │                           #   promotions, tax, inventory, search; Zod contracts
│   ├── ui/                     # Design system: shadcn/ui primitives + SH components
│   ├── email/                  # React Email templates + Resend/log transports
│   └── config/                 # Shared eslint flat config, tsconfig bases, tailwind preset
├── docker-compose.yml          # PostgreSQL 17 (+ optional pgAdmin) for local dev
├── turbo.json                  # Task graph: build, dev, lint, typecheck, test, e2e
├── pnpm-workspace.yaml
└── .github/workflows/ci.yml    # Quality gates (§13.3)
```

Package boundaries are one-directional: `apps/* → packages/*`, and within packages `db ← auth ← commerce ← (apps)`. `packages/ui` depends on nothing but React, Radix, and Tailwind. This is enforced mechanically by ESLint import restrictions and by the Turborepo task graph, which expresses the same topology for builds.

### 4.2 Layering model (3 layers)

1. **App/RSC layer** (`apps/web/src/app`, `apps/admin/src/app`): Server Components render HTML directly from data-access functions. Pages are `async`; `params` and `searchParams` are awaited (Next.js 16 contract). Mutations are invoked through **Server Actions** defined in feature modules, never through ad-hoc API routes.
2. **Client islands**: Interactive leaves — cart drawer, variant selectors, gallery, quantity steppers, forms — are `"use client"` components hydrated at the edge of the tree. They receive typed props from RSC and talk to the server via Server Actions or `useOptimistic` over the cart store. No client-side global data fetching layer exists; the server is the source of truth.
3. **Domain/DB layer** (`packages/commerce`, `packages/db`): Pure, testable business logic (pricing, promotions, order state machine, inventory reservation, tax mapping) and Drizzle queries. Functions are exported per feature (e.g. `commerce/pricing`, `commerce/orders`) and are the only code allowed to touch the database besides `packages/auth`'s Better-Auth instance.

### 4.3 Request lifecycles

**Product page (RSC read path):** request → `proxy.ts` (redirect table lookup, locale resolution, security headers) → RSC page awaits `commerce/catalog.getProduct(slug, { region })` → Drizzle query (product + variants + images + price for currency + inventory rollup + approved-review aggregate) → HTML streamed with Suspense for below-the-fold sections (reviews, cross-sell) → client islands hydrate (gallery, variant selector, add-to-cart).

**Add to cart (mutation path):** client island calls `addToCart` Server Action → Zod parse of input → `commerce/cart.addLine` inside a transaction: validate variant is purchasable in region, reserve nothing yet (reservation happens at checkout, §7.6), recompute cart totals → revalidate the cart tag → return typed result → Zustand store updates drawer state. Idempotency: cart-line updates carry a client-generated `requestId` that the action deduplicates within a 5-minute window.

**Checkout (payment path):** checkout page (RSC) renders summary from cart → `createPaymentIntent` Server Action (server-side Stripe call with idempotency key = cart ID + updated-at) → Payment Element confirms client-side → `payment_intent.succeeded` webhook → `commerce/orders.placeFromCart` in a single transaction: verify cart totals against Stripe amount, create order + lines + payment record, decrement inventory with `SELECT … FOR UPDATE` on inventory rows, clear cart, emit `order.placed` outbox rows → confirmation page reads the order by number + session proof.

**Stripe webhook:** route handler verifies signature → inserts into `webhook_events` with unique Stripe event ID (duplicate ⇒ 200 OK, no-op) → dispatches to typed handler → every side effect (email, review scheduling) is written as an outbox `jobs` row inside the same transaction → `/api/jobs/run` (Vercel cron) drains the outbox with retry/backoff.

### 4.4 Next.js 16 specifics the build must respect

- **`proxy.ts` replaces `middleware.ts`.** Locale negotiation, auth-gate redirects for `/admin` and `/account`, the 301 redirect table, and security headers live in `proxy.ts`. It runs on the Node runtime (not Edge) because the redirect table and session checks read from Postgres via typed packages.
- **Async request APIs.** `params`, `searchParams`, `cookies()`, and `headers()` are awaited everywhere; the codebase MUST NOT rely on the synchronous forms removed in Next.js 16.
- **Turbopack** is the default bundler; PostCSS config is minimal (`@tailwindcss/postcss` only). Any Babel-era configuration is forbidden.
- **Caching** uses `revalidateTag`/`revalidatePath` keyed by domain tags (`product:{slug}`, `collection:{slug}`, `cart:{id}`, `admin:orders`). Mutating Server Actions call the narrowest revalidation that keeps RSC output truthful. PLPs use ISR with `revalidate: 300`; PDPs `revalidate: 300` plus tag invalidation on catalog mutation; cart/checkout/account/admin are fully dynamic.

### 4.5 Error handling and resilience

- Every Server Action returns a **typed result union** (`{ ok: true, data } | { ok: false, error }`) rather than throwing across the boundary; unexpected errors are caught, logged with a correlation ID, and converted to a user-safe message.
- Route-level `error.tsx` and `not-found.tsx` exist for every segment group; the storefront's 500 page preserves the header/footer chrome.
- External calls (Stripe, Resend) carry timeouts and bounded retry with exponential backoff; retryable failures are surfaced as outbox rows rather than dropped. No silent swallowing: caught errors are logged with context (operation, identifiers, outcome).
- Database access uses transactions around every multi-row invariant (order placement, inventory decrement, refund application). Optimistic concurrency via `updated_at` version checks guards admin edits (§7.9).

### 4.6 Technology decision records (summary)

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| ADR-1 | Custom commerce engine over Medusa v2 | Medusa v2, Shopify Plus | One runtime/ORM/deploy target; lead times, trade pricing, multi-warehouse are schema-native; mandates fixed the stack |
| ADR-2 | Server Actions + RSC over REST/tRPC | REST API, tRPC v11 | Zero client data-fetching layer to maintain; typed end-to-end with Zod; REST surface retained only where third parties need it (webhooks in, none out in v1) |
| ADR-3 | Better-Auth over Clerk/Auth0/NextAuth | Clerk, Auth0, Auth.js v5 | Mandated; PII stays in our Postgres; plugin RBAC + 2FA; no per-MAU cost (see `authjs-vs-better-auth` analysis in the skills library) |
| ADR-4 | Postgres FTS search in v1 | Algolia, Meilisearch | Stack purity at launch scale; `SearchProvider` interface keeps the swap cheap (§3.2) |
| ADR-5 | Postgres-backed rate limiting in v1 | Redis, edge rate limiting | No new runtime at launch; swap trigger defined (§3.2) |
| ADR-6 | First-party reviews | Yotpo, Junip | Simple requirement set in v1; vendor swap path defined (§3.2) |
| ADR-7 | Money as integer minor units | Decimal strings, floats | Exact arithmetic; i18n formatting at the edge only |
| ADR-8 | Outbox + cron over a job service | Trigger.dev, BullMQ | v1 job volume is small and latency-tolerant; swap trigger defined (§3.2) |
### 4.7 Scaffold module map (authoritative exports)

- `packages/db` exports: `db` (pooled Drizzle client, `globalThis` singleton in dev), `schema` (all tables/enums/relations), `ensureSeeded()`, `migrate` helpers, test fixtures. The pool uses PG17; in dev the client is created lazily on first import to keep CLI tools fast.
- `packages/auth` exports: `auth` (Better-Auth server instance bound to `db`), `authClient` (browser client), `rbac` (role matrix + `can(role, action)`), session helpers (`requireUser`, `requireRole`) used by both apps' Server Actions.
- `packages/commerce` exports per feature module: `catalog` (queries + DTOs), `cart-service` (incl. requestId idempotency), `checkout-service` (incl. amount re-verification), `order-state` (incl. `transition`), `pricing` (pure functions incl. tier resolution), `promotions` (pure engine), `jobs` (`PgJobRunner` outbox runner), `providers` (the six vendor ports), `search-provider` (Postgres FTS binding), `dto` + `result` (typed envelope), `money`.
- `packages/ui` exports: themed shadcn primitives and SH composites (§10.3), `tokens.css`, `cn()` utility. Zero app-specific logic.
- `packages/email` exports: React Email templates keyed by job kind, `send(template, to, data)` with Resend or log transport selected by env. The `react-dom/server` renderer is resolved at runtime (NFR-STACK-11) so the package is safely importable from both Next routes and the job runner.
- `packages/config` exports: shared `tsconfig` bases, eslint flat-config factory, Tailwind preset import, `env.ts` (Zod-validated, per-process env parsing), and `flags.ts` (typed feature-flag registry, §4.8).

Every cross-package import must resolve to these documented exports; deep imports (`packages/db/src/internals/...`) are lint-banned to keep refactoring freedom inside packages.

### 4.8 Cross-cutting contracts (provider ports, flags, idempotency)

**Provider ports (adapted from the v3a/v3b proposals).** Every vendor-class dependency enters the domain through an interface declared in `packages/commerce/src/providers.ts`, even when v1 has exactly one implementation. New vendors MUST implement the port; call sites MUST NOT import vendor SDKs outside their adapter. The six ports:

| Port | v1 binding | Swap target |
|---|---|---|
| `SearchProvider.search({ q, locale, limit, cursor })` | Postgres FTS typeahead (`search-provider.ts`, limit ≤ 10) | Algolia / Meilisearch |
| `ConsentProvider.load/has/grant/revoke/onChange` | Local internal state holder (soft launch) | Cookiebot → OneTrust |
| `TaxProvider.quote(input)` | Stripe Tax adapter (checkout path, FR-506) | Avalara |
| `ShippingRateProvider.quote(input)` | `shipping_rates` table resolver incl. white-glove forcing (FR-402/507) | Carrier rating APIs |
| `EmailProvider.send({ template, to, data })` | React Email + Resend adapter (composed at the app layer; the Resend SDK never leaves `packages/email`) | Klaviyo |
| `JobRunner.enqueue / drain` | `PgJobRunner` over the `jobs` outbox (ADR-8) | Trigger.dev / queue |

**Feature flags.** `packages/config/src/flags.ts` is the single typed registry: `FEATURE_TRADE` (off), `FEATURE_GIFT_CARDS` (off), `FEATURE_REVIEWS` (on), `FEATURE_I18N` (on), `FEATURE_KLARNA` (off). Unknown `FEATURE_*` env variables fail fast at boot, and unknown flag names fail typecheck — a typo can never silently disable a surface. Gated surfaces MUST check `isFlagEnabled` in Server Actions (the server-side check is the control; client gating is UX only).

**Idempotency matrix.** Retries MUST be safe for every operation in the table:

| Operation | Key | Mechanism |
|---|---|---|
| Stripe webhook | Stripe event ID | `webhook_event` unique insert; duplicate ⇒ 200 no-op |
| Order placement | PaymentIntent ID | Placement re-validates cart; event row guards re-entry |
| Cart line add | `(cartId, requestId)` | 5-minute dedupe window (§8.3 `cart.addLine`) |
| Inventory reservation | `(variant_id, warehouse_id, order_id)` | Movements recorded inside the placement transaction |
| Outbox job | `idempotency_key` (unique) | `onConflictDoNothing` on enqueue |
| Newsletter subscribe | email (citext unique) | Subscriber row upsert |

**Outbox drain semantics (implemented).** `/api/jobs/run` (§8.4) claims due jobs with `FOR UPDATE SKIP LOCKED` inside a short transaction, executes handlers outside the lock, settles each independently: success → `done`; failure → retry with exponential backoff (0.5 s · 2ⁿ) until `maxAttempts`, then `dead`; an unknown kind dead-letters immediately so nothing is silently dropped. Concurrent cron ticks never double-process (verified by an integration test that drains 12 jobs across three concurrent ticks).

---

## 5. Functional Requirements — Storefront (FR-100…FR-599)

Conventions: **Priority** — M = must ship v1, S = should ship v1 (may slip to v1.1 with sign-off), C = could (backlog, not v1 commitment). Acceptance criteria are testable statements; the E2E suite maps onto them directly (§14.2 traceability).

### 5.1 Global navigation & search (FR-1xx)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-101 | Global header: logo, primary nav (Shop, Collections, Our Story, Journal, Contact), search, account, cart; sticky on scroll-up | M | Header renders on all pages; cart icon shows live line count; sticky behavior does not overlap focus outlines; matches design tokens |
| FR-102 | Mobile hamburger drawer with nav tree, account link, locale switcher | M | Opens as a dialog (Radix Drawer); focus-trapped; Esc and scrim click close; body scroll locked |
| FR-103 | Mega-menu: Shop → Furniture → Seating/Tables/Storage/Beds with featured collection thumbnail per column | M | Keyboard navigable (arrow keys per Radix NavigationMenu); images lazy-loaded; closes on route change |
| FR-104 | Search typeahead: products (image, name, price), categories, journal entries | M | Results after ≥2 chars; debounced ≤250 ms; Postgres FTS + trigram behind `SearchProvider`; keyboard navigable listbox; recent searches persisted locally |
| FR-105 | Search typo tolerance and synonyms ("couch"→"sofa") | S | `pg_trgm` similarity + synonym map table; results returned for single-character typos on top-500 SKUs |
| FR-106 | Search results page `/search?q=` with faceted product grid, shareable URL | M | Server-rendered; empty state with suggestions; `robots` noindex (§11.1) |
| FR-107 | Footer: shop/about/help links, showroom addresses, newsletter form, social icons, payment method marks, legal links, locale switcher | M | Newsletter form posts via Server Action with Zod validation + rate limit; success and duplicate-email states handled |
| FR-108 | Announcement bar: rotating, dismissible, content-managed | S | Dismissal persisted (Zustand persist); respects consent for storage where required; admin-editable (FR-808) |
| FR-109 | 404 and 500 pages with brand styling and recovery paths (search, top categories) | M | 404 returns HTTP 404; 500 preserves header/footer; both linked from error boundaries |

### 5.2 Product Listing Page (FR-2xx)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-201 | PLP routes: `/shop`, `/shop/{category}`, `/shop/{category}/{sub}` | M | Canonical patterns exactly as stated; unknown slugs → 404; breadcrumbs rendered with JSON-LD |
| FR-202 | Filters: category, sub-category, material, colour, price range, availability, lead time, collection | M | Facets derive from catalog aggregates; multi-select within facet = OR, across facets = AND; zero-result state suggests removing filters |
| FR-203 | Faceted URLs `?material=oak&color=sand` canonicalized and indexable per §11.1 rules | M | Single-facet pages self-canonical and indexable; ≥2 active facets emit `noindex, follow`; canonical tag never points to a filtered URL from an unfiltered one |
| FR-204 | Sort: featured (default), newest, price asc, price desc, best-selling | M | Sort persisted in URL (`?sort=`); featured order is admin-curated `products.sort_order` fallback newest |
| FR-205 | Pagination 24/page with crawlable `?page=N` | M | Page numbers are real links (not client-only); page 1 canonical to base URL; JMP: no infinite scroll in v1 |
| FR-206 | Product card: image with hover-swap to second image, badge (New/Sale/Low-stock), name, material line, price with compare-at strikethrough, quick-add | M | Quick-add uses first purchasable variant; disabled state when none; card is one accessible link with nested quick-add button excluded from the link semantics |
| FR-207 | Lead-time badge on card: "In stock — ships in 2–4 days" vs "Made to order — ships in 6–8 weeks" | M | Derived from inventory rollup + product lead-time settings; P2 persona requirement |
| FR-208 | Grid/list view toggle persisted per session | C | Not a v1 exit criterion |

### 5.3 Product Detail Page (FR-3xx)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-301 | Image gallery: primary + up to 8 thumbnails; zoom-on-hover desktop; swipe mobile; optional video | M | Alt text mandatory (admin-enforced); gallery keyboard navigable; zoom does not trap scroll |
| FR-302 | Variant selection: material/colour/size swatches with per-variant stock state; unavailable combos disabled with tooltip | M | Swatch state derives from variant inventory; selection reflected in URL (`?variant=SKU`) on replaceState for shareability |
| FR-303 | Price display: current price, compare-at, "save X%" badge, tax-inclusive label per locale (EU incl. VAT; US/UK excl., added at checkout) | M | Currency per §11.4; price computed from `variant_prices` for region currency |
| FR-304 | Lead-time badge (as FR-207) rendered adjacent to CTA | M | Same source of truth as FR-207 |
| FR-305 | Quantity selector; **Add to cart** (primary); **Save to wishlist** (secondary) | M | Add-to-cart opens mini-cart drawer; guest wishlist supported (localStorage) with merge-on-login |
| FR-306 | Rich description + accordions: Materials & care, Dimensions (diagram), Sustainability, Shipping & returns | M | Accordions are Radix; content admin-managed (rich text sanitized per §9.4) |
| FR-307 | Cross-sell "Pairs well with": 4 products, merchandiser-curated with bestseller fallback | S | Fallback algorithm: same collection, highest conversion proxy (views→orders over trailing 30d) |
| FR-308 | Reviews: star summary, distribution bars, paginated list with photos, sort by recent/helpfulness, verified-buyer-only submission | M | Submit form gated server-side on a delivered order line for the product; moderation queue in admin before display |
| FR-309 | Sticky mobile add-to-cart bar appearing after primary CTA scrolls out | S | Contains price + CTA only; does not overlap footer on short pages |
| FR-310 | Out-of-stock variant: disabled swatch + "Notify me" (email) form | M | Submissions stored with dedupe per email+variant; ingestion into back-in-stock flow (FR-905) |
| FR-311 | Pre-order support: distinct badge + estimated ship date on PDP and checkout line | S | Pre-order variants carry `is_preorder` + `preorder_ships_on`; checkout displays date; cannot pre-order out-of-region |
| FR-312 | Structured data: `Product`, `Offer`, `AggregateRating`, `BreadcrumbList` JSON-LD | M | Validated in E2E (parse + schema sanity); price/currency/availability match rendered page |
| FR-313 | PDP canonical: `/products/{slug}`; legacy `/shop/.../{slug}` 301s here | M | Redirect table + runtime rule; matches draft §6 note |

### 5.4 Cart (FR-4xx)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-401 | Slide-out mini-cart drawer: line items, qty stepper, remove, subtotal, "Proceed to checkout" | M | Drawer state in Zustand; lines are server-truth re-validated on open; optimistic UI rolls back on failure |
| FR-402 | Full cart page `/cart`: order summary, shipping estimate by postcode, promo code field, gift-card field | M | Estimates call the shipping-rate provider; recalculate within 500 ms of postcode entry; invalid promo/gift-card states show actionable errors |
| FR-403 | Cart persistence: server-side cart keyed by signed cookie; merged on login | M | Guest cart survives 30 days; merge preserves earliest `created_at` lines and never duplicates a variant line (quantities sum) |
| FR-404 | Price/stock re-validation on every cart read | M | If a variant's price or purchasability changed, cart displays current truth with an inline notice |
| FR-405 | Gift options in cart/checkout: gift wrap (+€8 flat), gift message (≤500 chars), gift receipt (no prices in shipment) | S | Gift wrap is a cart line with its own SKU; message stored per order |
| FR-406 | Cart totals breakdown: subtotal, discount, shipping (when method chosen), tax (EU inclusive display; US/UK estimated at checkout) | M | Totals computed in `commerce/pricing` (pure functions, unit-tested); rounding rules per §7.2 |

### 5.5 Checkout & payment (FR-5xx)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-501 | Single-page checkout with accordion steps: Information → Shipping → Payment → Review | M | Steps inline-validate; no full page reloads; state preserved on failure (P2/P4 requirement) |
| FR-502 | Express payments at top: Apple Pay, Google Pay, PayPal (via Stripe Payment Element/express methods); Klarna where region-supported | S | Express path bypasses step accordion after token; Klarna gated by currency/region matrix |
| FR-503 | Guest checkout supported; account creation offered post-purchase | M | Guest order links to email hash; post-purchase "save my details" creates account and attaches order |
| FR-504 | Address autocomplete (Google Places/Loqate) with manual entry fallback | S | Autocomplete is progressive enhancement; forms fully valid without it |
| FR-505 | Multi-currency: display and charge in customer's currency; FX rate locked at order | M | Currency selection by region (§11.4); order stores `fx_rate` + base-currency equivalents (§7.4) |
| FR-506 | Tax by destination via Stripe Tax; EU VAT-inclusive display, US/UK added at checkout | M | Tax breakdown line in review step; tax recorded per line on order (§7.4) |
| FR-507 | Shipping methods: Standard, Express, White-glove (furniture), Pickup-at-showroom | M | Method availability by region + cart contents (weight/size); rates from `shipping_rates` table; white-glove is **force-selected** (not merely offered) when any line exceeds 30 kg (FR-409 alignment) |
| FR-508 | Stripe Payment Element on our domain; no card data touches our servers (SAQ-A) | M | PaymentIntent created server-side; client confirms; amount/currency verified against cart before order placement (§7.11); when Stripe keys are absent the checkout surfaces an honest "not configured" state (E2E asserts it; tests MUST NOT fake payment) |
| FR-509 | Payment failure recovery: clear error, form state preserved, retry allowed | M | Failed intents never create orders; duplicate-submit guarded by idempotency key |
| FR-510 | Order confirmation: on-screen with order number + email; optional SMS opt-in (post-launch) | M | Confirmation page reads order by number + proof token; email transactional via Resend template |
| FR-511 | Abandoned-checkout emails at 30 min and 24 h | S | Triggered from cart `updated_at` heuristics via outbox; requires consent-compliant email capture |
| FR-512 | Checkout robots/SEO: noindex, excluded from sitemap | M | Verified in E2E |

---

## 6. Functional Requirements — Accounts, Content, Admin, Trade & Post-Purchase (FR-600…FR-999)

### 6.1 Customer accounts & auth (FR-6xx)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-601 | Auth methods: email/password, magic link, OAuth (Google, Apple) via Better-Auth | M | All flows produce Better-Auth DB sessions; OAuth callbacks verified against allow-listed redirect URIs |
| FR-602 | Account dashboard `/account` (auth required): profile, orders, addresses, wishlists, reviews, returns, settings | M | Unauthenticated access redirects to sign-in with `redirect` param; proxy.ts gate |
| FR-603 | Profile: name, email, phone, default address, communication preferences | M | Email change requires re-verification; preferences stored as consented flags |
| FR-604 | Order history: status, tracking link, invoice PDF download | M | Invoice PDF regenerates **deterministically from the order-line snapshot** (never live-priced); tracking deep-links to carrier via AfterShip post-launch, carrier page in v1 |
| FR-605 | One-click reorder; return-request initiation from an order | M | Reorder creates a fresh cart (re-validating prices); out-of-stock lines are **skipped with a visible notice**, never silently dropped; returns enter FR-912 workflow |
| FR-606 | Saved addresses (multi); Stripe-tokenized payment methods list (display-only in v1: last4, brand, expiry) | M | Addresses validated with Zod + destination-aware region rules; payment methods never store PAN |
| FR-607 | Wishlist: multiple lists, shareable via URL token | S | Guest wishlist merges on login; share token grants read-only view; no PII exposure |
| FR-608 | Reviews written + pending visible in account | S | Status shown: submitted/pending moderation/published |
| FR-609 | Session management: list active sessions, sign out all | S | Better-Auth session table drives UI; sign-out-all revokes sessions |

### 6.2 Homepage & content/editorial (FR-7xx)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-701 | Homepage sections in order: announcement bar; hero (editorial split, content-managed per season); trust marquee (handcrafted, FSC oak, carbon-neutral, 10-year guarantee); featured categories (4 tiles); new arrivals (8, `is_new`); brand story teaser; materials section (3 cards); editorial collection block ("Hygge Edit", dark); testimonials (3-up from approved reviews); journal preview (3 latest); newsletter signup; footer | M | Every section is RSC-rendered from content tables; missing content degrades to hide-section, never a blank block |
| FR-702 | Collections: curated product groups with editorial header image, story copy, product grid; `/collections`, `/collections/{slug}` | M | Collection pages are indexable; revalidated on catalog change via tags |
| FR-703 | Journal: `/journal`, `/journal/{category}/{slug}`; categories Craft/Home/People/Sustainability; hero image; rich body with inline product embeds ("shop this post") | M | Body rich text sanitized allow-list style (§9.4); product embeds resolve live price/availability at render |
| FR-704 | Static pages: Our Story, Sustainability, Materials, Showrooms, Trade Program, FAQ, Shipping, Returns, Privacy, Terms, Cookies, Accessibility | M | Managed in admin (FR-809); versioned with `updated_at`; privacy/terms carry legal review note |
| FR-705 | Lookbooks: seasonal, image-led, shoppable hotspots linking to PDPs | S | Hotspot coordinates stored as percentages (resolution-independent); until built (Phase 5), `/lookbooks` routes MUST return an honest 404 naming the FR ID — never a silent 500 or empty success |
| FR-706 | Redirect manager: admin CRUD for 301/302 source→target | M | Checked in `proxy.ts` before routing; loop detection on save; 404 log (top N) surfaced in admin to inform redirects |

### 6.3 Admin back-office (FR-8xx)

RBAC roles: **Owner, Admin, Merchandiser, Customer Service, Warehouse, Read-only** (Better-Auth admin plugin + custom roles; §9.2). All admin mutations write to `audit_log` (actor, action, entity, before/after digest).

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-801 | Dashboard: revenue today/7d/30d; orders pending fulfilment; low-stock alerts; top products; conversion funnel | M | Revenue is currency-normalized to EUR at order FX; funnel uses server events (§11.2) |
| FR-802 | Product CRUD: all draft §4.7 fields (title, slug, rich description, variants, materials, dimensions, weight, HS code, country of origin, lead time, images+alt, collections, tags, SEO meta) | M | Slug uniqueness enforced at the **DB constraint level** (citext UNIQUE), not only in the UI; draft/active/archived status; publish requires hero image + alt + ≥1 variant + price per enabled currency |
| FR-803 | Inventory per variant per warehouse (Aalborg + Copenhagen showroom); safety stock; low-stock threshold | M | Negative stock impossible; adjustments are row-recorded movements (audit) not silent updates |
| FR-804 | Pricing: base price per currency, sale price with schedule, trade price tier | M | Sale schedule validation (start < end); active sale rendered automatically; trade tier per §6.9 |
| FR-805 | Catalog bulk import/export (CSV) | S | Import is dry-run first (error report), then commit; exports async with signed download |
| FR-806 | Order management: list with filters (status, date, channel, value, country); detail with lines, customer, addresses, payments, shipments, notes, timeline | M | Detail page is the single workspace for CS/warehouse actions; timeline is append-only |
| FR-807 | Order actions: capture, refund (partial/full), cancel, split-ship, mark shipped, print packing slip, print return label | M | Refund/cancel call Stripe with idempotency keys and reconcile via webhooks; state machine (§7.7) forbids illegal transitions with explicit errors |
| FR-808 | Returns workflow: request → approve → ship → inspect → refund/exchange | M | Workflow states in `return_requests`; each transition actor+timestamp stamped |
| FR-809 | Content management: journal, collections, static pages, lookbooks, redirects, navigation menu editor, announcement bar | M | Draft → published lifecycle; scheduling (publish_at) for journal; menu editor output cached with tags |
| FR-810 | Promotions: codes (fixed/percent/free-shipping), automatic promotions, scheduling, usage limits, per-customer limits, product/category exclusions, BOGO, tiered ("spend €500 get €50 off") | M | Promotion engine is pure + unit-tested; conflicting promotions apply best-single by default (no stacking in v1); **property-tested invariants**: applied discount never exceeds the cart subtotal (for every kind — fixed, percent above 100%, tiered), and `subtotal − discount + shipping + tax = total` holds over randomized carts; tier resolution picks the highest qualifying threshold |
| FR-811 | Gift cards: digital, configurable denominations, scheduled delivery, balance lookup, fraud limits | S | Gift-card code generation uses CSPRNG; redemption is a payment method in checkout with balance ledger |
| FR-812 | Reporting: sales by day/week/month, product, category, channel, country, discount; CSV export; cohort + repeat-purchase report | S | Reports read from order tables (not GA4); scheduled email reports via outbox |
| FR-813 | Settings: regions, currencies, tax display mode, shipping zones & rates, payment providers, team & roles, webhooks, API keys | M | Destructive settings changes require Owner role + typed confirmation |
| FR-814 | Customer management: searchable directory, order history, LTV, segment tags, notes, GDPR tools (export, anonymize, delete) | M | GDPR export produces machine-readable archive; anonymize preserves order financial records (§9.5 retention) |
| FR-815 | Fraud review queue (risk-scored orders) | S | v1 score = Stripe Radar outcome + rules (velocity, mismatch); queue filters orders, does not block automatically |

### 6.4 Trade / B2B (FR-9xx part 1)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-901 | Trade application form: business details + resale certificate upload | M | Files stored privately with signed, expiring access; submission rate-limited |
| FR-902 | Manual approval workflow in admin (48 h SLA) | M | Approval grants `trade` role + tier; rejection records reason; email on both outcomes |
| FR-903 | Trade-only pricing visible after login: crossed-out retail + net price | M | Trade price resolution server-side only; API responses omit trade fields for unauthenticated/non-trade sessions |
| FR-904 | Net-30 payment terms via Stripe Invoicing (approved accounts) — **post-launch Phase 5** | S | v1 trade pays by card; schema carries `payment_terms` so invoicing slots in without migration |
| FR-905 | Bulk order pad (CSV of SKUs) | C | Deferred Phase 5; CSV schema reserved |
| FR-906 | Dedicated trade concierge contact on trade pages and confirmations | M | Static content, trade role–gated |

### 6.5 Post-purchase (FR-9xx part 2)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-910 | Order status emails: confirmed, in-production, shipped, out-for-delivery, delivered | M | All via outbox (idempotent); templates in `packages/email`; suppressed on bounce |
| FR-911 | Carrier-agnostic tracking page | S | v1: carrier deep-link; AfterShip integration pre-launch |
| FR-912 | Returns portal: self-service request with reason codes, damage photo upload, label generation, refund status | M | Guest returns via order number + email proof; label via carrier integration stub in v1 (manual label attach in admin) |
| FR-913 | Review request email 21 days post-delivery | M | Scheduled outbox job at `delivered_at + 21d`; single send; unsubscribe-respecting |
| FR-914 | Back-in-stock notifications (from FR-310 submissions) | M | Fired on inventory movement crossing safety threshold; batched ≤1 per variant per day per subscriber |

---

## 7. Data Model — Drizzle Schema

### 7.1 Conventions

- All tables: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()` unless stated. Timestamps are `timestamptz` (UTC).
- Money: `integer` **minor units** in the row's currency (EUR base everywhere unless the column names another currency). Never floats (ADR-7).
- Enums: Postgres enums via Drizzle `pgEnum`; new values are additive migrations only.
- Foreign keys: `on delete restrict` by default; `cascade` only where the child is meaningless without the parent (e.g. cart lines).
- Naming: snake_case in Postgres; Drizzle camelCase mapping. Table names singular.
- Multi-currency: base currency EUR. Charge currency per region. `fx_rates` refreshed daily (admin-editable override).

### 7.2 Money & rounding rules

Line totals: `unit_price_minor × qty`. Discounts distribute across lines by largest-remainder so `sum(line_totals) = order_total` exactly; a residual cent lands on the highest-value line. Tax display mode per region: EU VAT-inclusive (prices stored tax-inclusive per Stripe Tax `inclusive` behavior), US/UK exclusive. All rules live in `packages/commerce/pricing` and are unit-tested to property-based invariants (`sum(lines) + shipping + tax − discount = total`).

### 7.3 Catalog

| Table | Columns (beyond id/timestamps) | Keys & indexes |
|---|---|---|
| `category` | `parent_id → category`, `slug citext UNIQUE`, `name`, `description`, `hero_image_id → media?`, `sort_order int`, `is_active bool` | idx `(parent_id, sort_order)`; slug unique (case-insensitive) |
| `product` | `slug citext UNIQUE`, `title`, `description_html`, `status enum('draft','active','archived')`, `category_id → category`, `brand`, `country_of_origin char(2)`, `hs_code`, `lead_time_days_min int`, `lead_time_days_max int`, `is_new bool`, `is_preorder bool`, `preorder_ships_on date?`, `materials text[]`, `care_html`, `sustainability_html`, `dimensions_json jsonb`, `weight_g int`, `seo_title`, `seo_description`, `sort_order int`, `search_vector tsvector` | GIN `search_vector`; idx `(status, sort_order)`; idx `category_id` |
| `product_variant` | `product_id → product`, `sku text UNIQUE`, `material`, `color`, `color_hex`, `size`, `dimensions_json jsonb`, `weight_g int`, `lead_time_override?`, `is_default bool`, `is_active bool` | idx `product_id`; SKU unique |
| `media` | `kind enum('image','video')`, `url`, `alt text NOT NULL CHECK (alt <> '')`, `width int`, `height int`, `blur_data_url`, `sort_order` | Polymorphic via join tables below |
| `product_image` | `product_id → product`, `media_id → media`, `sort_order` | PK `(product_id, media_id)` |
| `variant_image` | `variant_id → product_variant`, `media_id → media`, `sort_order` | PK `(variant_id, media_id)` |
| `variant_price` | `variant_id → product_variant`, `currency char(3)`, `amount int` (minor), `compare_at int?`, `trade_amount int?`, `sale_amount int?`, `sale_starts_at timestamptz?`, `sale_ends_at timestamptz?` | PK `(variant_id, currency)`; CHECK `amount >= 0` |
| `warehouse` | `code text UNIQUE`, `name`, `address jsonb`, `is_showroom bool`, `is_active bool` | Seeded: AAL (Aalborg), CPH (Copenhagen floor) |
| `inventory_level` | `variant_id → product_variant`, `warehouse_id → warehouse`, `qty_on_hand int CHECK >= 0`, `qty_reserved int CHECK >= 0 DEFAULT 0`, `safety_stock int DEFAULT 0` | PK `(variant_id, warehouse_id)` |
| `inventory_movement` | `variant_id`, `warehouse_id`, `delta int`, `reason enum('purchase','sale','return','adjustment','transfer','reservation','release')`, `reference_type?`, `reference_id?`, `actor_id?` | idx `(variant_id, created_at)` — append-only ledger |
| `collection` | `slug citext UNIQUE`, `title`, `subtitle`, `hero_image_id → media`, `story_html`, `is_active`, `starts_at?`, `ends_at?`, `seo_title`, `seo_description` | slug unique |
| `collection_product` | `collection_id → collection`, `product_id → product`, `sort_order` | PK `(collection_id, product_id)` |
| `search_synonym` | `term text`, `synonym text` | PK `(term, synonym)` — feeds FTS expansion |
| `review` | `product_id → product`, `customer_id → user?`, `order_id → order?`, `author_name`, `rating int CHECK 1..5`, `title`, `body`, `photos jsonb` (media URLs), `status enum('pending','approved','rejected')`, `is_verified_purchase bool`, `helpful_count int` | idx `(product_id, status, created_at)` |
| `back_in_stock_request` | `variant_id`, `email`, `notified_at?` | UNIQUE `(variant_id, email)` |

### 7.4 Carts & orders

| Table | Columns | Keys & indexes |
|---|---|---|
| `cart` | `token text UNIQUE` (signed cookie ref), `user_id → user?`, `email?`, `region enum('EU','US','UK')`, `currency char(3)`, `status enum('active','converted','abandoned','merged')`, `gift_message?`, `gift_wrap bool`, `gift_receipt bool`, `shipping_method_id?`, `totals_json jsonb` (snapshot) | idx `(status, updated_at)` for abandonment jobs |
| `cart_line` | `cart_id → cart ON DELETE CASCADE`, `variant_id`, `qty int CHECK 1..99`, `unit_price_snapshot int`, `is_gift_wrap bool` | UNIQUE `(cart_id, variant_id, is_gift_wrap)` |
| `cart_promotion` | `cart_id`, `promotion_id` | PK `(cart_id, promotion_id)` |
| `order` | `number text UNIQUE` (SH-2026-000123), `cart_id?`, `user_id?`, `email`, `region`, `currency`, `fx_rate numeric(18,8)` (charge currency per EUR), `status` (§7.7), `subtotal int`, `discount int`, `shipping int`, `tax int`, `total int`, `total_eur int`, `payment_terms enum('card','net30')`, `gift_message?`, `source enum('web','trade','admin')`, `placed_at`, `fulfilled_at?`, `cancelled_at?`, `refunded_at?` | idx `(status, placed_at)`, idx `user_id` |
| `order_line` | `order_id ON DELETE RESTRICT`, `variant_id`, `title_snapshot`, `sku_snapshot`, `qty`, `unit_price int`, `tax_rate numeric(6,4)?`, `tax_amount int`, `total int`, `fulfillable_from warehouse code` | idx `order_id` |
| `order_address` | `order_id`, `kind enum('billing','shipping')`, fields jsonb (`name`, `line1..3`, `city`, `postal_code`, `country`, `phone`) | idx `order_id` |
| `payment` | `order_id`, `stripe_payment_intent_id text UNIQUE`, `amount int`, `currency`, `status enum('requires_action','processing','succeeded','failed','refunded','partially_refunded')`, `amount_refunded int DEFAULT 0`, `method_details jsonb` | idx `(order_id, status)` |
| `shipment` | `order_id`, `warehouse_id`, `carrier?`, `tracking_number?`, `tracking_url?`, `status enum('pending','packed','shipped','delivered','returned')`, `shipped_at?`, `delivered_at?` | idx `(order_id, status)` |
| `shipment_line` | `shipment_id`, `order_line_id`, `qty` | PK `(shipment_id, order_line_id)` |
| `return_request` | `order_id`, `rma_number text UNIQUE`, `status enum('requested','approved','awaiting_shipment','in_transit','inspecting','refunded','exchanged','rejected','closed')`, `reason_code`, `customer_note?`, `photo_media_ids jsonb?`, `refund_amount int?`, `resolved_at?` | idx `(order_id, status)` |
| `return_line` | `return_request_id`, `order_line_id`, `qty`, `condition enum('unopened','opened','damaged')` | PK `(return_request_id, order_line_id)` |

### 7.5 Customers, promotions, gift cards

| Table | Columns | Keys & indexes |
|---|---|---|
| `user` (Better-Auth + extensions) | Better-Auth core columns **plus**: `phone?`, `marketing_opt_in bool DEFAULT false`, `segment_tags text[]`, `stripe_customer_id?`, `trade_status enum('none','pending','approved','rejected')`, `trade_tier enum?`, `trade_company_name?`, `trade_cvr?`, `payment_terms enum('card','net30') DEFAULT 'card'`, `notes?` | Better-Auth manages identity tables (`user`, `session`, `account`, `verification`); extensions ride on `user` |
| `address` | `user_id`, `label?`, fields jsonb (as order_address), `is_default_shipping bool`, `is_default_billing bool` | idx `user_id` |
| `trade_application` | `user_id?`, `company_name`, `cvr`, `contact_email`, `website?`, `certificate_media_id → media`, `status enum('pending','approved','rejected')`, `reviewer_id?`, `decision_note?` | idx `status` |
| `promotion` | `code text UNIQUE?` (null ⇒ automatic), `kind enum('fixed','percent','free_shipping','bogo','tiered')`, `value int?` (minor or bp), `tiers_json jsonb?`, `conditions_json jsonb` (min spend, products, categories, exclusions), `starts_at?`, `ends_at?`, `usage_limit int?`, `per_customer_limit int?`, `is_active` | partial idx `code` WHERE `is_active` |
| `promotion_redemption` | `promotion_id`, `order_id`, `user_id?`, `email_hash?` | UNIQUE per limit-scope; enforces per-customer limits |
| `gift_card` | `code_hash text UNIQUE` (CSPRNG code shown once), `initial_amount int`, `currency`, `balance int`, `purchaser_order_id?`, `recipient_email?`, `deliver_at?`, `expires_at?`, `status enum('active','depleted','expired','disabled')` | idx `status` |
| `gift_card_transaction` | `gift_card_id`, `order_id?`, `delta int`, `balance_after int`, `kind enum('issue','redeem','refund','expire')` | ledger, append-only |

### 7.6 Inventory reservation semantics

Availability shown on the storefront is `qty_on_hand − qty_reserved − safety_stock ≥ requested`. Reservation happens **at checkout payment confirmation** inside the order-placement transaction: `SELECT … FOR UPDATE` on each `inventory_level` row, re-check availability, `qty_reserved += qty` until shipped, then `qty_on_hand −= qty; qty_reserved −= qty` recorded as movements. Made-to-order variants (no stock) are always purchasable and skip reservation. This avoids abandoned-cart stock lockouts (P2 pain point) at the cost of a small oversell window handled by the transaction re-check.

### 7.7 Order state machine

The machine below matches the implemented engine in `packages/commerce/src/order-state.ts` exactly (statuses, events, and allowed sources):

```
pending_payment ──payment_succeeded──▶ confirmed ──start_production──▶ in_production
       │  (flag_for_review)                │  │  mark_partially_shipped        │
       ▼                                   │  ▼                                │
    review ──release_to_production──▶ partially_shipped ──mark_shipped──▶ shipped
       │        │                           │ mark_delivered                 │
       └────────┴────▶ confirmed           ▼                                ▼
                                    delivered ──close──▶ closed ◀── close ◀─ cancelled/refunded

cancel: pending_payment | confirmed | in_production | review  →  cancelled
refund_full / refund_partial: any post-payment state → refunded / partially_refunded
```

Transitions are enforced in `commerce/order-state.transition(status, event)` — the only writer of `order.status`. Illegal transitions throw `InvalidOrderTransition` (surfaced as typed error). Every transition writes an `order_event` timeline row (`type`, `actor` (system/customer/admin id), `payload jsonb`). The `review` state (entered via `flag_for_review`) is the fraud/CS hold: webhooks confirm placement even when the placement re-validation passes with a mutated cart (§8.7), and `release_to_production` is the explicit human clearance. Webhook-driven transitions (`payment_intent.succeeded` → confirmed) are idempotent by Stripe event ID.

### 7.8 Better-Auth tables & audit

| Table | Purpose |
|---|---|
| `user`, `session`, `account`, `verification` | Owned by Better-Auth 1.x conventions (see `packages/auth`); `session` is DB-backed so admin revocation is immediate |
| `two_factor` (plugin) | TOTP secrets for admin roles (required for Owner/Admin, §9.2) |
| `audit_log` | `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `before jsonb?`, `after jsonb?`, `ip_hash?`, `user_agent?` — append-only; no update/delete grants |
| `webhook_event` | `stripe_event_id UNIQUE`, `type`, `payload jsonb`, `processed_at?`, `error?` — idempotency guard |
| `jobs` (outbox) | `kind`, `payload jsonb`, `run_after`, `attempts int`, `last_error?`, `status enum('pending','running','done','failed','dead')`, `idempotency_key UNIQUE` |
| `rate_limit_hit` | `bucket text`, `window_start timestamptz`, `count int` — PK `(bucket, window_start)` sliding-window limiter |
| `redirect` | `source_path text UNIQUE`, `target_path`, `kind enum('301','302')`, `hits int` |
| `newsletter_subscriber` | `email citext UNIQUE`, `status enum('pending','confirmed','unsubscribed')`, `token_hash?`, `source` |
| `fx_rate` | `currency char(3)` PK, `rate numeric(18,8)` per EUR, `updated_at` |
| `shipping_zone` / `shipping_rate` | zones (`region`, countries text[]), rates (`zone_id`, `method enum('standard','express','white_glove','pickup')`, `min_weight_g`, `max_weight_g`, `amount int`, `currency`, `eta_days_min/max`) |
| `announcement` | `message`, `href?`, `sort_order`, `is_active`, `starts_at?`, `ends_at?` |
| `nav_entry` | `menu enum('header','footer_shop','footer_about','footer_help')`, `label`, `href`, `parent_id?`, `sort_order` |
| `static_page` | `slug UNIQUE`, `title`, `body_html`, `seo_title`, `seo_description`, `status`, `published_at?` |
| `journal_post` | `slug UNIQUE`, `title`, `excerpt`, `hero_media_id`, `body_html`, `category enum('craft','home','people','sustainability')`, `author`, `status`, `published_at?`, `related_product_ids jsonb` |
| `lookbook` | `slug UNIQUE`, `title`, `season`, `hero_media_id`, `hotspots jsonb` (`{mediaId,x%,y%,variantSlug}`) |

### 7.9 Migration & concurrency strategy

- drizzle-kit generates SQL migrations into `packages/db/drizzle/`; migrations are **forward-only** and reviewed like code; destructive changes ship as expand → migrate → contract across releases.
- `updated_at` is maintained by triggers or by Drizzle `$onUpdate`; admin edit forms pass the last-read `updated_at` and reject stale writes (HTTP 409 semantics) — optimistic concurrency.
- All order/inventory writes run in `db.transaction()` at isolation READ COMMITTED with row locks (§7.6). Long reports run on a read-only replica connection string when one exists (v1: primary).
- Seed data (`packages/db/src/seed`) is idempotent (`ensureSeeded()` keyed on content hashes): regions, warehouses, FX, categories, demo catalog (Halden armchair et al.), shipping zones/rates, promotions, static pages, admin users. Seeded credentials are test-only and never appear in production env.
### 7.10 Worked pricing example (normative)

Cart: Halden armchair ×1 @ €1,299.00 (129900); Woo table runner ×2 @ €45.00 (4500 each); promo `WELCOME100` fixed €100.00 off orders ≥ €500 (EUR, VAT-inclusive display).

1. Subtotal = 129900 + 9000 = 138900.
2. Discount = 10000 → distributed largest-remainder across lines proportional to line value: armchair exact share = 10000 × 129900/138900 = 9352.04 → floor 9352; runner 647.95 → floor 647; residual cent goes to the largest remainder (runner) → armchair −9352 → 120548; runner −648 → 8352.
3. Shipping (standard DK, ≤ 5 kg): 4900. Gift wrap (off) = 0.
4. Tax: EU display is VAT-inclusive — `order.tax` records the Stripe Tax-computed contained VAT (25% DK) for reporting; displayed breakdown shows "incl. VAT".
5. `total` = 120548 + 8352 + 4900 = 133800. Invariant `subtotal − discount + shipping + tax_exclusive_adjustments = total` holds; unit tests assert this property across randomized carts.
6. USD charge: `fx_rate` snapshot (e.g. 1.0864) → Stripe amount = round(133800 × 1.0864) = 145360 minor units; `order.total_eur` stores 133800.

### 7.11 Checkout amount re-verification (load-bearing integrity control)

On `payment_intent.succeeded`, the placement transaction **MUST** recompute cart totals server-side (prices, promotion cap, tax, shipping) and compare to the PaymentIntent amount **before** creating the order. A mismatch (`AMOUNT_MISMATCH`) means no order: the payment is flagged for CS review and the webhook-after-abort sequence (§8.7) applies. This is the single load-bearing control against stale carts, price tampering, and promotion races — it is implemented in `checkout-service.placeOrderFromWebhook` and asserted by property tests (FR-810 invariants) plus the E2E checkout path.

---

## 8. API & Data-Access Specification

### 8.1 Data-access doctrine

1. **RSC queries are the default read path.** Pages call typed functions in `packages/commerce` (e.g. `catalog.listProducts(query)`) which return plain, serializable DTOs. There is no client-side REST/GraphQL/tRPC layer in v1 (ADR-2).
2. **Server Actions are the only mutation path** from our own UI. Each action: (a) authenticates/authorizes, (b) rate-limits where exposed to guests, (c) parses input with a Zod v4 schema, (d) executes domain logic, (e) revalidates the narrowest tags, (f) returns a typed result union.
3. **Route Handlers exist only where a non-browser client requires them:** Stripe webhooks, Better-Auth endpoints, search typeahead (progressive fetch), and the cron job runner. Each is listed below with its contract.
4. **No public outbound REST API in v1.** Admin "API keys" in settings (FR-813) prepare for a v1.1 read API; nothing consumes it yet, so none is specified here (anti-speculation rule).

### 8.2 Action/endpoint contract

Result envelope (JSON, shared type in `packages/commerce`):

```ts
type ActionResult<T> =
  | { ok: true; data: T; revalidated?: string[] }
  | { ok: false; error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> } };
```

`ErrorCode` is a closed string union (`VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `PAYMENT_REQUIRED`, `INVALID_TRANSITION`, `INTERNAL`). UIs render code-specific copy; `INTERNAL` never leaks internals to the client but logs the correlation ID server-side.

### 8.3 Server Action catalog (v1)

| Action | Input (Zod) | Output | Auth | Notes |
|---|---|---|---|---|
| `cart.addLine` | `{ variantId, qty 1..99, requestId }` | cart DTO | guest+ | dedupe on `requestId` (5 min) |
| `cart.updateQty` | `{ lineId, qty 0..99 }` | cart DTO | guest+ | qty 0 removes |
| `cart.removeLine` | `{ lineId }` | cart DTO | guest+ | |
| `cart.applyPromotion` | `{ code }` | cart DTO | guest+ | validates via promotion engine |
| `cart.removePromotion` | `{ promotionId }` | cart DTO | guest+ | |
| `cart.setGiftOptions` | `{ giftWrap, giftMessage?≤500, giftReceipt }` | cart DTO | guest+ | |
| `checkout.setAddress` | address schema (region-aware) | `{ shippingMethods: [] }` | guest+ | normalizes postal code per region |
| `checkout.setShippingMethod` | `{ method }` | `{ totals }` | guest+ | |
| `checkout.createPaymentIntent` | `{}` | `{ clientSecret }` | guest+ | amount re-derived server-side; idempotency key cartId+updatedAt |
| `checkout.confirmGuestContact` | `{ email, marketingOptIn? }` | `{}` | guest | |
| `account.register` / `signIn` / `signOut` / `requestMagicLink` | Better-Auth schemas | session | guest | wrapped by Better-Auth client |
| `account.updateProfile` | profile schema | profile | user | email change triggers verification |
| `address.upsert` / `address.delete` / `address.setDefault` | address schema | list | user | |
| `wishlist.merge` | `{ guestItemIds[] }` | wishlist | user | on login |
| `review.submit` | `{ productId, rating 1..5, title?, body, photos? }` | review | user + verified purchase | enters moderation |
| `backInStock.request` | `{ variantId, email }` | `{}` | guest | rate-limited, deduped |
| `newsletter.subscribe` | `{ email, source }` | `{}` | guest | double opt-in |
| `return.request` | `{ orderId, lines[{lineId, qty, reason, condition}], note?, photos? }` | rma | user or order proof | FR-912 |
| `admin.product.save` / `publish` / `archive` | product schema | product | role-gated | audit-logged; revalidates catalog tags |
| `admin.inventory.adjust` | `{ variantId, warehouseId, delta, reason, note? }` | level | Warehouse+ | writes movement |
| `admin.order.transition` | `{ orderId, event, payload? }` | order | role-gated | state machine + audit |
| `admin.order.refund` | `{ orderId, amountMinor?, reason }` | payment | Admin+ | Stripe call idempotent |
| `admin.promotion.save` / `admin.giftCard.issue` | respective schemas | entity | Admin+ | |
| `admin.redirect.save` / `admin.content.save*` | respective schemas | entity | Merchandiser+ | loop detection for redirects |
| `admin.tradeApplication.decide` | `{ id, decision, note? }` | application | Admin+ | emails applicant |

### 8.4 Route Handlers

| Route | Method | Contract |
|---|---|---|
| `/api/auth/[...all]` | * | Better-Auth handler (session cookies, OAuth callbacks, magic links) |
| `/api/webhooks/stripe` | POST | Verify `stripe-signature` (tolerance 300 s) → insert `webhook_event` (unique event id; duplicate ⇒ 200) → dispatch typed handler → return 2xx only after commit |
| `/api/search/typeahead` | GET | `?q`, `?locale`, `?limit≤10`; Zod-validated response `{ products[], categories[], journal[] }`; rate-limited per IP |
| `/api/jobs/run` | GET/POST | Protected by `CRON_SECRET` header; drains outbox with backoff; safe to run concurrently (row-level `FOR UPDATE SKIP LOCKED`) |
| `/api/health` | GET | `{ status: "ok", db: true, version }` for uptime probes |

### 8.5 Stripe integration matrix

| Concern | Decision |
|---|---|
| Card fields | Payment Element + Payment Intents on our domain; **no PAN ever** reaches our servers (SAQ-A) |
| Express | Apple Pay / Google Pay via Payment Element express; PayPal & Klarna as Payment Element methods where region+currency supported |
| Capture | Automatic; admin "capture" action exists for `manual` flag orders (fraud queue) |
| Tax | Stripe Tax calculated at PaymentIntent creation; line-level tax persisted on `order_line` |
| Currency | Charge in region currency; FX locked server-side at order; Stripe amount MUST equal cart total (mismatch ⇒ no order) |
| Refunds | Admin-initiated with idempotency key; state reconciles via `charge.refunded` webhook |
| Webhooks | `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created` (fraud queue) |
| Idempotency | All server-side Stripe mutations carry idempotency keys (`cart:{id}:pi`, `order:{id}:refund:{n}`) |
| Test mode | Local/dev uses `STRIPE_SECRET_KEY` test keys; E2E uses `4242 4242 4242 4242` and `4000 0000 0000 3220` (3DS) |

### 8.6 Internal event → side-effect map

`order.placed` → confirmation email, fraud check (Radar), Klaviyo event, Slack notify; `order.shipped` → shipping email, tracking; `order.delivered` → schedule review-request job (+21 d); `inventory.low` → admin alert; `inventory.restocked` → back-in-stock batch; `return.requested` → CS Slack + admin badge; `payment.failed` → recovery email path (FR-511). All dispatch = insert `jobs` row(s) in the same transaction as the state change (outbox pattern, §4.3).
### 8.7 Checkout failure & recovery sequence (normative)

`payment_intent.payment_failed` → payment row → `failed`; cart remains active with items intact (FR-509); user sees code-specific message (`card_declined` ≠ `insufficient_funds`) with retry; a fresh `createPaymentIntent` issues a new intent (old one abandoned; no order row exists). If the webhook confirming success arrives **after** the user aborted: the placement transaction re-validates cart state; if the cart was mutated post-payment (total mismatch), the handler creates the order in `review` state and flags for CS rather than silently consuming the payment — a `payment_orphan` ops alert fires. This is the single worst failure mode in e-commerce and is explicitly covered in E2E (`checkout.spec.ts > webhook-after-abort`).
### 8.8 Catalog query & search contract (normative)

`commerce/catalog.listProducts(query)` accepts a single Zod-validated `ProductQuery`: `{ categorySlug?, facets?: { material?: string[], color?: string[], price?: {minMinor, maxMinor}, availability?: 'in_stock'|'all', leadTime?: 'in_stock'|'quickship'|'all', collectionSlug? }, sort: 'featured'|'newest'|'price_asc'|'price_desc'|'bestselling', page: int ≥ 1, pageSize: 24, region, currency }` and returns `{ items: ProductCardDTO[], total, page, pageCount, facets: { material: {value,count}[], color: …, price: {min,max} } }` — facet counts are computed over the query with that facet relaxed (standard faceted-search semantics), in one round-trip using aggregated CTEs (no N+1).

SQL shape: base CTE filters `product.status='active'` + category subtree (recursive CTE over `category.parent_id`) → join `product_variant` × `variant_price` (region currency) × availability rollup (sum over `inventory_level` minus reservations minus safety stock) → facet-count CTEs → pagination via `LIMIT/OFFSET` (keyset pagination is the documented v1.1 upgrade path if PLP crawl depth becomes a latency issue). Full-text search path (`SearchProvider.search`) adds `websearch_to_tsquery` over `product.search_vector` (title weighted A, materials/description B) + `pg_trgm` similarity ≥ 0.5 fallback union, ranked by `ts_rank` × sales velocity; synonyms expand via `search_synonym` before query building. `search_vector` is maintained by trigger on product/variant writes so no sync job exists to drift.

`bestselling` sort is a materialized sales-velocity metric (`product_metrics` view: units per trailing 30 d, refreshed 15-min by the job runner), not an on-the-fly `SUM` over orders — PLP latency stays flat as order volume grows.
---

## 9. Auth, Security & Compliance

### 9.1 Authentication (Better-Auth)

- **Methods:** email/password (min 10 chars, breached-password check via zxcvbn-lite scoring ≥ 3), magic link (15-min single-use tokens), OAuth Google + Apple. All flows produce DB-backed sessions in Better-Auth's `session` table; cookie flags: `HttpOnly; Secure; SameSite=Lax`.
- **Sessions:** 30-day rolling with rotation on privilege change; `sign out all` (FR-609) revokes every session row. Guest carts survive independent of sessions (signed cookie token).
- **Email verification** required before first review/return actions; magic-link sign-in inherently verifies.
- **Admin 2FA:** TOTP required for Owner and Admin roles (Better-Auth two-factor plugin); enforced at proxy level — a session lacking the second factor cannot reach `/admin` regardless of role.

### 9.2 Authorization model

Roles are the single-source matrix in `packages/auth/src/rbac.ts`: **`user`, `readonly`, `warehouse`, `customer_service`, `merchandiser`, `admin`, `owner`** — plus the trade program riding on `user` via `trade_status`/`trade_tier` extensions (§7.5). Permissions are a typed matrix (`can(role, permission)`) consumed by both apps; **no role checks inline in pages**. Server Actions re-check authorization server-side (client gating is UX only, never the control). Least privilege: customer-service can refund ≤ €500 (`orders:refund_small`) without second approval; above that requires `admin` (`orders:refund_large`). Warehouse can adjust inventory (`inventory:adjust`) and transition fulfillment states but cannot see payment methods beyond status. Admin 2FA is enforced at the proxy level — a session lacking the second factor cannot reach `/admin` regardless of role.

### 9.3 Transport & headers

HSTS (`max-age=63072000; includeSubDomains; preload`), TLS 1.3 only at the edge, CSP with nonces for scripts (`default-src 'self'; script-src 'self' 'nonce-…' https://js.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com; img-src 'self' data: https:` — tuned per integration), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal allow-list, and `X-Frame-Options: DENY` outside Stripe frames. Headers are set centrally in `proxy.ts` with a unit-tested manifest.

### 9.4 Input, output, and content safety

- **Every boundary validates with Zod v4:** Server Action inputs, route-handler query/body, env at boot (`packages/config/env.ts` fails fast), webhook payloads post-signature-verification.
- **SQL injection:** Drizzle parameterization only; no string interpolation into `sql` templates; `sql.raw` is lint-banned.
- **XSS / rich text:** admin-authored HTML (product descriptions, journal, static pages) is sanitized with a strict allow-list (typography, links, lists, tables, images, product-embed custom node) at render time, not just at save; user-generated content (reviews, messages) is stored plain and rendered as text.
- **File uploads** (return photos, trade certificates): type allow-list, size caps, randomized object keys, private storage; downloads via short-lived signed URLs; filenames never used as keys (path-traversal defense).
- **Secrets:** environment variables only (§13.4 manifest); `.env*` git-ignored except `.env.example`; CI secret scanning + `pnpm audit --audit-level high` gate.
- **Rate limiting (Postgres sliding window):** auth endpoints 5/min/IP+email-hash; checkout actions 30/min/cart; typeahead 60/min/IP; newsletter 3/hour/IP; trade application 5/day/IP. Responses use `RATE_LIMITED` error code with `Retry-After`.

### 9.5 Privacy & compliance

- **GDPR (EU+UK):** lawful-basis matrix (contract: orders; consent: marketing; legitimate interest: fraud prevention); consent banner gates analytics + marketing storage; DSR workflow in admin (FR-814): export = machine-readable JSON+CSV archive delivered within 30 days; delete = anonymize user PII, preserve order financials by replacing identifiers (retention: order/tax records 7 years per DK bookkeeping rules); right-to-object honored in marketing prefs.
- **CCPA:** "Do Not Sell My Personal Information" footer link (target page explains no-sale status + preference controls).
- **Danish Cookie Order + EU DSA:** consent banner with granular categories (necessary/functional/analytics/marketing) and equal-prominence reject; DSA trader identity block on PDP (legal name + address) and a reporting channel page.
- **Data minimization:** analytics events carry IDs and categories, never names/emails; logs scrub PII (email → hashed, addresses never logged); review photos EXIF-stripped on ingest.
- **PCI DSS SAQ-A:** no card data on our servers; Stripe Elements hosted fields; quarterly attestation task in the ops calendar.

### 9.6 Security tradeoffs recorded

- **No Redis in v1** means rate limiting shares Postgres write capacity. Mitigation: limiter rows are tiny, windows are short, and buckets are per-route. Trigger to revisit is measured lock contention (§3.2), not speculative scale.
- **First-party reviews** mean we own moderation burden. Mitigation: moderation queue + verified-purchase gating + rate limits. Vendor swap path defined.
- **Postgres FTS** means merchandising controls (boosts, curated ranking) are simpler than Algolia's. Acceptable for ≤ a few thousand SKUs; swap interface reserved.
### 9.7 Threat model summary (STRIDE excerpt)

| Threat | Vector | Control |
|---|---|---|
| Spoofing | Session cookie theft | HttpOnly+Secure+SameSite; rotation on privilege change; 2FA admin |
| Tampering | Price manipulation via client | Prices re-derived server-side on every mutation; Stripe amount MUST match server total |
| Repudiation | Admin disputes action | `audit_log` append-only with before/after digests |
| Information disclosure | Trade pricing leak | Trade fields stripped server-side for unauthorized sessions (FR-903); no price fields in client bundles |
| Denial of service | Checkout/API abuse | Route rate limits; WAF; webhook signature tolerance; idempotency to absorb replays |
| Elevation of privilege | Role confusion | Single RBAC matrix; Server-Action re-authorization; admin 2FA at proxy |

---

## 10. Design System & Frontend Standards

### 10.1 Tokens (Tailwind v4 CSS-first)

Tokens are defined once in `packages/ui/src/theme.css` as a Tailwind v4 `@theme` block plus shadcn CSS variables; apps consume via `@import` and never redeclare. Values below derive from the captured landing page (draft §13) and are the contract:

```css
@theme {
  --color-bg: #FAF7F2;          /* warm off-white */
  --color-bg-2: #F0EAE0;        /* cream */
  --color-bg-3: #E8E0D2;        /* sand */
  --color-ink: #1F1B17;         /* warm near-black */
  --color-ink-2: #4A433B;
  --color-muted: #6F665C;       /* AA-verified (was #8A8178 — failed 4.5:1 at 13px) */
  --color-line: #E5DDD1;
  --color-accent: #C97B5E;      /* terracotta — large text/UI accent only */
  --color-accent-2: #8F4326;    /* deep terracotta — AA-verified body links (was #B06548) */
  --color-sage: #8B9A82;
  --color-wood: #C9A876;

  --font-display: "Fraunces", serif;   /* via next/font, variable, opsz 9–144, 300–500 + italic */
  --font-ui: "Inter", system-ui;       /* via next/font, 300–600 */

  --text-scale: 12 13 14 16 18 22 28 36 48 64 96;   /* px */
  --spacing-scale: 4 8 12 16 20 24 32 40 56 80 120; /* px */
  --radius-card: 2px;  --radius-pill: 999px;  --radius-image: 0px;
  --ease-brand: cubic-bezier(0.22, 1, 0.36, 1);
  --duration-fast: 200ms; --duration-base: 300ms; --duration-slow: 400ms; --duration-reveal: 800ms;
}
```

The `muted` and `accent-2` values above are the **axe-verified AA-passing values implemented in the scaffold** (the v3b proposal still carried the draft's original `#8A8178`/`#B06548`, which failed WCAG AA contrast and were darkened during the a11y gate; §12.2 records the evidence). shadcn variable mapping: `--background`, `--foreground`, `--primary`, `--border`, `--ring` are literal hex values inside the single `@theme` block — `var()` chains are dropped by the current Tailwind v4 build (NFR-STACK-8). Dark mode is out of scope v1 except the "Hygge Edit" dark editorial section, which is a component-level palette, not a theme.

### 10.2 Typography & content rules

- Fraunces for display headings (weight 300–500, optical size auto), Inter for UI/body. Line lengths ≤ 68ch for prose; heading rhythm from the type scale only — no ad-hoc sizes (lint via stylelint optional, review-enforced).
- Numerals in prices use tabular-nums; currency formatting via `Intl.NumberFormat` per locale/currency at the edge (§7.2 integers).
- Editorial imagery is sharp-cornered (`--radius-image: 0`); cards use 2px; pills only for badges/filters.

### 10.3 Component inventory (packages/ui)

shadcn primitives (Radix-based, themed): Button (primary/ghost/icon), Badge, Input, Textarea, Select, Checkbox, RadioGroup, Swatch, Accordion, Tabs, Dialog, Drawer (Sheet), Popover, Tooltip, Toast (Sonner), Pagination, Breadcrumb, Table, Skeleton, Separator, Avatar.

Scandi Haven composites (built on the primitives): ProductCard (PLP + variants), ProductGallery, VariantSelector, QuantityStepper, CartDrawer, CartLineItem, PriceBlock (incl. compare-at + save badge), LeadTimeBadge, ReviewSummary + ReviewList, StarsRating, FilterPanel (facets), SortSelect, AddressForm (region-aware), ShippingMethodSelector, PaymentElement wrapper, OrderTimeline, AdminDataTable (filters + pagination), AdminOrderActions, RichTextRenderer (sanitized), MediaImage (next/image wrapper enforcing alt + AVIF/WebP).

### 10.4 Zustand v5 store architecture

| Store | State | Persistence | Hydration rules |
|---|---|---|---|
| `cart-store` | `drawerOpen`, `pendingLines` (optimistic), `lastAction` | none (server is truth) | drawer state safe to read post-mount; use `useSyncExternalStore`-safe selectors; optimistic lines roll back on action error |
| `wishlist-store` | `lists[{ id, items[] }]` | `persist` → localStorage (consent-gated) | `skipHydration` + mount-time rehydrate to avoid SSR mismatch; merges to server on login (FR-607) |
| `ui-store` | `mobileNavOpen`, `announcementDismissed`, `recentSearches[]` | partial persist | same mount-rehydrate pattern |

Selectors are atomic (single-value) to avoid re-render cascades; `useShallow` for object picks. No store holds server data — RSC props stay the source of truth (§4.2).

### 10.5 Loading, empty, error, and motion standards

- Every async region declares all four states explicitly (skeleton → content, empty guidance, error with retry). Buttons disable during async submissions with visible busy state; no double-submit.
- Motion: reveals and transitions use `--ease-brand` with the four durations only; `prefers-reduced-motion` collapses reveals to opacity changes. No layout-animating marquee on mobile (performance).
- Images: `next/image` with AVIF/WebP auto, explicit `sizes`, blur placeholder from `blur_data_url`; hero ≤ 200 KB, product ≤ 80 KB (§11.4 budgets).

---

## 11. SEO, Analytics, i18n & Performance Budgets

### 11.1 SEO requirements

- **Rendering:** every indexable page is server-rendered HTML (RSC). Client islands never gate primary content.
- **Metadata:** per-page `title`, description, `og:*`, `twitter:*`, and canonical via the Next Metadata API; catalog entities carry admin-editable `seo_title`/`seo_description` with template fallbacks (e.g. `{product} — {category} · Scandi Haven`).
- **Sitemap:** `app/sitemap.ts` emits products, PLPs, collections, journal, static pages daily (products weighted highest); image sitemap entries from product media; cart/checkout/account/search/admin excluded.
- **robots.txt:** disallow `/admin`, `/account`, `/cart`, `/checkout`, `/search`, `/api`; sitemap referenced.
- **Facet indexing (implements FR-203):** zero facets → self-canonical; exactly one active facet that matches a curated allow-list (`material`, `color`) → self-canonical and indexable with a noindex-free rel-canon; ≥2 facets → `noindex, follow`. Pagination: canonical self with `?page=N`; `rel="next"/"prev"` emitted for crawlers that still consume them (documented as legacy-harmless).
- **Structured data (JSON-LD):** `Organization` + `WebSite` (SearchAction) sitewide; `Product`/`Offer`/`AggregateRating` on PDP; `BreadcrumbList` on PLP/PDP/collections; `Article` on journal. E2E asserts parse-validity and key-field consistency with rendered DOM.
- **Hreflang:** EN (default, no prefix) + `/da`, `/de`, `/sv` with `x-default` → EN; emitted on all indexable routes.
- **Redirects:** admin-managed 301 table applied in `proxy.ts` (FR-706); legacy landing-page URLs map per launch plan; weekly 404 report (top 100) in admin.

### 11.2 Analytics & event tracking

Implementation: a typed `analytics.track(event, payload)` module; client events buffer through a consent gate; `order_completed` is **server-authoritative** (emitted from the order-placement transaction into the events table + forwarded to GA4 Measurement Protocol), making GA4 numbers reconcile with orders.

| Event | Payload keys | Where fired |
|---|---|---|
| `page_viewed` | path, locale | router (client) |
| `product_viewed` | productId, variantId, price, currency | PDP (RSC-injected + client flush) |
| `product_list_viewed` | listId (plp/collection/home), itemIds | PLP/collection/home |
| `product_added_to_cart` / `product_removed_from_cart` | productId, variantId, qty | cart actions |
| `cart_viewed` | value, currency | /cart |
| `checkout_started` / `checkout_step_completed` | step, value | checkout |
| `payment_info_entered` | method (element/express) | checkout |
| `order_completed` | orderId, revenue, currency, items[], tax, shipping | **server** |
| `wishlist_added` / `wishlist_removed` | productId | wishlist actions |
| `review_submitted` | productId, rating | account |
| `newsletter_subscribed` | source | footer/forms |
| `search_performed` | query, resultCount | search |
| `promotion_applied` | code | cart/checkout |

Dashboards: revenue (d/w/m), CR by channel, AOV, top products, funnel (view→add→checkout→purchase), cohort retention, abandoned-cart recovery. Source of truth: order tables; GA4 reconciles via `order_completed` server events.

### 11.3 i18n

- Locales: `en` (default, unprefixed), `da`, `de`, `sv` (prefix routes) via `next-intl` in `proxy.ts`.
- Negotiation: URL prefix wins for indexable routes; `Accept-Language` informs first-visit suggestion banner (never auto-redirects — SEO-safe).
- Catalog content: translatable fields (`title`, `description_html`, care, dimensions labels) carried in translation tables (`product_locale`, `static_page_locale`, …) keyed by `(entity_id, locale)` with EN fallback; editorial translations are admin-managed.
- Currency/region is orthogonal to locale (a Dane may shop in EUR or DKK): region picker in footer; prices resolve per §11.4.

### 11.4 Regions, currencies & performance budgets

Regions: EU (EUR; VAT-inclusive display; Ireland/DE/SE/DK storefront locales), US (USD; sales tax at checkout), UK (GBP; VAT at checkout). Currency per region default with explicit picker persisting choice.

| Page | LCP (4G mobile) | INP | CLS | JS transferred |
|---|---|---|---|---|
| Homepage | < 2.0 s | < 200 ms | < 0.05 | < 180 KB |
| PLP | < 2.0 s | < 200 ms | < 0.05 | < 200 KB |
| PDP | < 2.0 s | < 200 ms | < 0.05 | < 220 KB |
| Checkout | < 1.5 s | < 100 ms | < 0.02 | < 250 KB |

Enforcement: Lighthouse CI budgets on PR for the four templates; `next/font` self-hosts Fraunces/Inter (no render-blocking font requests); RSC-first keeps hydration islands small; Stripe.js loaded only on checkout; analytics gated by consent and loaded post-interactive. Image limits: hero ≤ 200 KB, product image ≤ 80 KB, enforced in admin media upload.

---

## 12. Quality Engineering: Testing, Accessibility & Observability

### 12.1 Test strategy & pyramid

| Level | Tooling | Scope | Gate |
|---|---|---|---|
| Unit | Vitest | `packages/commerce` pure logic: pricing & rounding, promotion engine, order state machine, tax mapping, FX conversion, inventory availability math; RBAC matrix | PR-blocking; coverage floor 90% lines on `packages/commerce` |
| Component | Vitest + Testing Library | Variant selector, cart drawer, quantity stepper, filter panel, address form | PR-blocking for touched components |
| Integration | Vitest + real PG (docker/embedded) | commerce queries against seeded DB: cart merge, order placement, reservation semantics | Nightly + PR on commerce changes |
| E2E | Playwright (Chromium + WebKit) | Critical paths below | PR-blocking (Chromium), nightly full matrix |
| Accessibility | `@axe-core/playwright` in E2E | Zero serious/critical violations on key templates | PR-blocking |
| Visual | Playwright screenshots on 2 viewports | Design-system components + 4 key templates | Advisory on PR (screenshot diff report), blocking after v1 launch |
| Security | `pnpm audit` (high+), secret scan, CodeQL (post-launch), OWASP ZAP baseline (pre-launch) | Deps + headers + auth flows | PR-blocking (audit/secrets) |

**E2E critical paths (v1 exit criteria):** guest checkout with Stripe test card → order appears in admin; account purchase → order visible in account + reorder; search → PDP → variant selection → add to cart → cart persistence across reload; promo code applied → totals correct; return request on delivered order; admin: product publish → PDP live (revalidation); admin: inventory adjust → PDP badge updates; a11y scans on home/PLP/PDP/checkout.

Flake control: tests are hermetic (seeded DB, no cross-test state), selectors are role/label-based, and a red test is either a real regression or a fixed test — never skipped to pass (standards §10).

### 12.2 Accessibility (WCAG 2.2 AA)

Keyboard operability everywhere incl. drawer/menu/focus management; visible focus rings (`--ring` token, never `outline: none`); skip-to-content; semantic landmarks; ARIA on dynamic regions (cart drawer `role="dialog"` + live-region count updates, toasts `role="status"`); forms have explicit labels, `aria-describedby` errors with `role="alert"`; contrast ≥ 4.5:1 body / 3:1 large text (terracotta `#C97B5E` on `#FAF7F2` passes for large text/UI accents only — body links use `--color-accent-2`); alt text enforced at media upload; target sizes ≥ 24px (2.5.8) with 44px primary CTAs; axe-core in E2E; quarterly manual NVDA/VoiceOver sweep scheduled.

### 12.3 Observability

- **Structured logs:** JSON with `ts, level, msg, requestId, route, actorId?, durationMs` — PII-scrubbed (§9.5); correlation ID generated in `proxy.ts` and propagated through actions to logs.
- **Errors:** Sentry (or platform equivalent) in both apps with release tagging; Server Action errors surface `INTERNAL` + correlation ID to users while the stack goes to Sentry.
- **Health:** `/api/health` (§8.4) checks DB round-trip; uptime probe 1-min; SLO alerts: storefront error rate > 1% (5 min), p95 TTFB > 800 ms (15 min), webhook lag > 5 min, outbox dead-letter > 0.
- **RUM:** web-vitals beacons (consent-gated) feeding the §11.4 budgets dashboard.

### 12.4 Evidence & verification ledger (per engineering standards)

Every claim that code "works" must carry evidence. The repo keeps a running `docs/verification-ledger.md`; each entry: command executed, workspace, result (pass/fail + key numbers), and confidence tag (Verified / Reasoned / Assumed / Unverifiable). PRs touching money, auth, or order placement MUST include ledger entries. CI pins the canonical evidence commands: `pnpm turbo lint typecheck test build`, `pnpm --filter db migrate && pnpm --filter db seed` against a fresh PG17, and `pnpm e2e --project=chromium`. Anything not executed in an environment is labeled as such — never presented as verified (standards §13).

### 12.5 Test data & fixtures strategy

Fixtures are typed builders in `packages/db/src/testing` (`aProduct({overrides})`, `aCart({items})`, `anOrder({status})`) producing valid entity graphs with deterministic IDs for tests; the seed catalog (Halden armchair, Woo runner, Øresund lamp, Hygge wool throw et al.) doubles as E2E fixture data so specs reference stable slugs/SKUs. Money-heavy tests (pricing/promotions) run property-based invariants via `fast-check`: discount distribution conserves totals, FX rounding is monotonic, state-machine transitions are total functions. Every fixture builder validates against the same Zod schemas the app uses — fixtures cannot drift from production contracts. Integration tests run against a throwaway database created per CI job (`CREATE DATABASE test_$BUILDID`), never shared state; the embedded-PG fallback bootstraps identically so local and CI produce byte-identical schema states (migrations only, no drift).

### 12.6 SLOs & error budgets

| SLO | Target | Alert |
|---|---|---|
| Storefront availability | 99.95% / 30 d | Error-budget burn > 2% in 1 h |
| Storefront error rate | < 1% / 5 min | Immediate page |
| p95 TTFB (HTML) | < 800 ms | 15 min |
| Checkout success (given PI confirm) | ≥ 99.5% | 15 min |
| Webhook lag (event → order) | < 5 min | Immediate page |
| Outbox dead-letter count | 0 | Immediate page |
| Admin availability | ≥ 99.5% monthly | Error budget |

Error-budget policy: two consecutive budget-burn weeks freeze feature deploys in favor of reliability work. The outbox dead-letter SLO ties to §4.8 — the drainer dead-letters loudly, and ops treats any dead row as an incident (§13.7 runbook). The `/api/health` probe (§8.4) and the SLO table above share thresholds so synthetic monitors and dashboards never disagree.

---

## 13. Environments, Infrastructure & Release Plan

### 13.1 Environments

| Env | Purpose | Data | Payments |
|---|---|---|---|
| Local | Dev on laptop | `docker compose up` PG17 (canonical) or bundled PG17 fallback; `pnpm db:seed` | Stripe test keys |
| Preview (per PR) | Review + E2E | Fresh migrate + seed | Stripe test |
| Staging | Pre-launch UAT + perf | Production-like, anonymized | Stripe test |
| Production | Live | PITR backups | Stripe live |

### 13.2 Phase 0 — Foundations (this repository's scaffold)

Delivered as part of this PRD (Appendix B inventories the artifacts): Turborepo workspace (apps/web, apps/admin; packages/db, auth, ui, commerce, email, config); Drizzle schema per §7 + migrations + idempotent seed; Better-Auth wiring with RBAC matrix; Tailwind v4 token layer + shadcn base components; Storefront key surfaces (home, PLP, PDP, cart drawer/page) + Admin skeleton (auth gate, product list/edit, order list) implemented per scaffold scope; Stripe Payment Element checkout behind test keys; docker-compose; CI (§13.3); Playwright suite + E2E smoke of the guest purchase path.

**Entry criteria:** this PRD approved. **Exit criteria:** `pnpm install && pnpm build && pnpm typecheck && pnpm lint` green in CI; migrate+seed from empty PG17 succeeds; E2E guest-checkout smoke passes; README quickstart verified on a clean machine.

### 13.3 CI/CD pipeline (GitHub Actions)

Jobs on every PR: (1) `pnpm install --frozen-lockfile`; (2) `turbo lint typecheck`; (3) `turbo test` (unit + component); (4) `turbo build`; (5) Playwright against preview with migrated+seeded PG17; (6) `pnpm audit --audit-level high` + secret scan. Main merges build preview deployments; production deploys are tagged releases with automatic rollback (previous immutable build) and feature-flag default-off for major surfaces.

### 13.4 Environment variable manifest

| Variable | Used by | Secret | Notes |
|---|---|---|---|
| `DATABASE_URL` | db, auth, commerce | yes | PG17 connection string; app role least-privileged (no DDL) |
| `BETTER_AUTH_SECRET` | auth | yes | ≥ 32 bytes CSPRNG |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_SITE_URL` | auth, web | no | canonical origin; drives OAuth redirect URIs |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, `AUTH_APPLE_ID` / `AUTH_APPLE_SECRET` | auth | yes | OAuth |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | commerce (payments) | yes | test vs live per env |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | web checkout | no | |
| `RESEND_API_KEY`, `EMAIL_FROM` | email | yes | log transport when unset in dev |
| `CRON_SECRET` | jobs runner | yes | protects `/api/jobs/run` |
| `FEATURE_*` (typed flags) | apps | no | e.g. `FEATURE_TRADE`, `FEATURE_GIFT_CARDS` |

`.env.example` ships with every variable present, non-secret values filled, secrets documented as `set-me` placeholders with generation commands (e.g. `openssl rand -base64 32`). **No real secret value is ever committed** (standards §8; CI scans).

### 13.5 Deployment topology & DR

Vercel (both Next apps; Node runtime proxy) → managed PostgreSQL 17 (multi-AZ) → object storage for media (private bucket + CDN). Web tier is stateless (DB sessions). DR: PITR + daily snapshots, 30-day retention, RTO 4 h / RPO 15 min, quarterly restore drill rehearsed from snapshot into scratch instance. Backups alert on failure (not silent).

### 13.6 Rollout plan

| Phase | Scope | Exit criteria |
|---|---|---|
| 0 Foundations (4 wks) | Scaffold (§13.2), design system, CI/CD, Stripe test wiring, catalog import tooling | §13.2 exit criteria |
| 1 MVP storefront (6 wks) | Homepage, PLP, PDP, cart, checkout, confirmation, account, search, admin catalog+orders | E2E critical paths green; perf budgets met on staging |
| 2 Pre-launch polish (3 wks) | Perf/a11y/SEO passes, analytics, email flows, returns portal, reviews, consent vendor live | Lighthouse budgets; axe clean; SEO checklist |
| 3 Soft launch (2 wks) | Invite-only to newsletter; monitor SLOs; fix | 2 wks error budget held; CR/AOV sanity |
| 4 Public launch | DNS cutover, legacy 301s, press kit, paid social; rollback = feature flags + instant revert | 48 h war-room; SLOs green |
| 5 Post-launch (ongoing) | Trade program (+4 wks), gift cards (+6 wks), Net-30 invoicing, bulk order pad, subscriptions (Q+2), AR (Q+3) | per-feature exit criteria |
### 13.7 Operational runbook (essentials)

- **Oversell detected:** locate affected orders (`inventory_movement` where `reason='sale'` ran below zero-floor alert); compensate per runbook (apology email + expedited refund or backorder choice); adjust `safety_stock` for the SKU.
- **Stripe webhook outage:** `/api/jobs/run` drains nothing but orders stay `pending_payment`; reconcile via Stripe dashboard → manual `payment_intent.succeeded` replay (Stripe CLI `stripe events resend`); verify `webhook_event` dedupe catches duplicates.
- **Migration rollback policy:** forward-only — a bad migration ships a corrective forward migration; the deploy pairs app+N−1 schema compatibility for one release (expand/contract, §7.9).
- **Seeded dev data:** `pnpm db:reset` = drop → migrate → seed; never run against staging/production (guard: seed script refuses non-local `DATABASE_URL` hosts).

### 13.8 Capacity & cost envelope (€5M GMV, four-person team)

Assumptions: ~12k orders/year at €420 AOV; peak 20× average (holiday); catalog < 5k SKUs; media on object storage + CDN. These are order-of-magnitude envelopes (Reasoned, not measured) that keep infrastructure under ~2% of GMV excluding payment fees:

| Item | Envelope (annual) |
|---|---|
| Vercel (two Next apps) | low four figures |
| Managed PostgreSQL 17 multi-AZ | low-to-mid four figures |
| Object storage + CDN | low three-to-four figures |
| Stripe fees | ~1.4–2.9% + fixed — commercial COGS, not infra |
| Resend / Sentry / Cookiebot | low three figures each |

No service exists that the four-person team cannot debug. Redis, Algolia, and Trigger.dev remain explicit later costs gated by their §3.2/§1.5 swap triggers — capacity math is the trigger, not hype.

---

## 14. Risks, Traceability & Appendices

### 14.1 Risk register (updated)

| Risk | L | I | Mitigation |
|---|---|---|---|
| Long made-to-order lead times hurt conversion | High | High | Lead-time badges everywhere (FR-207/304); in-stock filter; safety stock for hero SKUs |
| Cross-border tax complexity (EU OSS + US nexus) | Med | High | Stripe Tax from day 1 (FR-506); quarterly tax review; tax snapshot on order lines for audit |
| Oversell on concurrent purchases | Med | Med | Transaction reservation re-check (§7.6); oversell runbook (compensation email + refund) |
| Carrier damage on large furniture | Med | Med | White-glove > 30 kg (FR-507); packaging spec; damage-claim SOP via returns (FR-912) |
| Image bloat hurts performance | High | Med | Upload size caps (§10.5); AVIF/WebP; Lighthouse budgets in CI |
| Custom-build scope creep (the Medusa tradeoff) | Med | High | This PRD's FR discipline; Phase 1 scope frozen at §13.6; Medusa/Shopify still a documented fallback (ADR-1) if velocity collapses |
| Postgres-only rate limiting under abuse | Low | Med | Limits tuned per route (§9.4); WAF in front; Redis swap trigger defined |
| Trade program abuse | Low | Med | Manual approval + resale cert (FR-901/902); order limits; Radar flags |
| SEO migration | Med | High | 301 manager (FR-706); high-traffic URL map pre-launch; weekly 404 review |
| Single oak supplier concentration | Low | High | Second supplier qualification (ops); safety stock |
| Key-person dependency on stack choices | Med | Med | ADRs in §4.6; skills library references (Appendix A); seed data + docs for onboarding |

### 14.2 Requirements → implementation → verification traceability (excerpt)

| FR | Implementation locus | Verification |
|---|---|---|
| FR-201..208 PLP | `apps/web` `/(shop)` + `commerce/catalog` | E2E plp.spec.ts; unit facet-query |
| FR-301..313 PDP | `apps/web` `/products/[slug]` + gallery/variant islands | E2E pdp.spec.ts; JSON-LD assertion |
| FR-401..406 Cart | `commerce/cart` + cart-store + drawer | unit pricing; E2E cart.spec.ts |
| FR-501..512 Checkout | `commerce/checkout` + Stripe integration | E2E checkout.spec.ts (test cards) |
| FR-601..609 Account | `packages/auth` + `apps/web` `/account/*` | E2E account.spec.ts |
| FR-801..815 Admin | `apps/admin` + `commerce/admin` | E2E admin-*.spec.ts; RBAC unit tests |
| FR-901..906 Trade | trade module + RBAC | E2E trade.spec.ts (Phase 5 items deferred) |
| FR-910..914 Post-purchase | outbox jobs + email package | integration tests; job-runner E2E |

(Full matrix maintained in the repo as `docs/traceability.md` from Phase 1.)

### 14.3 Appendix A — Skills alignment matrix (my-pi-agent catalog → workstreams)

The engineering-skills library (`my-pi-agent/skills`, 233 skills) was reviewed to plan this build. The following catalog skills are directly load-bearing, mapped to where they apply:

| Skill (catalog) | Workstream in this PRD |
|---|---|
| `nextjs16-react19-tailwind4-better-auth-monorepo` | Monorepo scaffold topology, Better-Auth + Stripe integration patterns (§3, §4, §8.5) |
| `nextjs16-react19-tailwindv4-trpcv11-drizzle-better-auth` | Next.js 16 breaking changes (proxy.ts, async params), 50+ anti-patterns, Stripe webhook idempotency (§4.4, §8.5) |
| `nextjs16-react19-tailwind4-drizzle-orm-postgres17-rsc` | 3-layer RSC architecture, Tailwind v4 `@theme` tokens, seeding lifecycle, security headers/CSP (§4.2, §10.1, §9.3) |
| `authjs-vs-better-auth` | ADR-3 reasoning, proxy route protection (§9.1) |
| `nextjs-react-expert` | Performance budget execution (§11.4): waterfall elimination, bundle discipline, RSC streaming |
| `api-and-interface-design` / `api-patterns` | Action/result contracts, error envelope (§8.2) |
| `codebase-design` / `domain-modeling` / `clean-code` | Package boundaries, §7 schema, pricing state machine |
| `security-and-hardening` / `vulnerability-scanner` | §9 controls, CI audit gates |
| `e2e-testing-lessons` / `playwright-cli` / `testing-patterns` / `tdd` | §12.1 plan and flake control |
| `performance-optimization` / `seo-content-writer` | §11 SEO + budgets |
| `setup-pre-commit` / `git-workflow-and-versioning` / `ci-cd-and-automation` | §13.3 pipeline, commit hygiene |
| `plan-writing` / `spec-driven-development` / `documentation-and-adrs` | This document's structure; ADR records |
| `shipping-and-launch` / `handoff` / `verification-and-review-protocol` | §13.6 rollout; evidence-based verification ledger |
| `frontend-ui-engineering` / `ui-ux-pro-max` / `web-design-guidelines` / `visual-design-foundations` / `tailwind-patterns` | §10 design system execution |

### 14.4 Appendix B — Scaffold inventory (what exists in this repository now)

Implemented in this repo (Phase 0 scaffold per §13.2): root tooling (pnpm workspace, turbo.json, eslint flat config, tsconfig bases, .env.example, docker-compose, CI workflow); `packages/db` (full Drizzle schema per §7, drizzle-kit config, migrations, idempotent seed); `packages/auth` (Better-Auth server/client, RBAC matrix); `packages/ui` (Tailwind v4 `@theme` tokens, shadcn-themed primitives, core SH composites); `packages/commerce` (money, pricing, promotion engine, order state machine + unit tests, DTO/Zod contracts); `packages/email` (React Email templates + log transport); `apps/web` (home, PLP, PDP, cart drawer/page, checkout with Payment Element, account basics, health route); `apps/admin` (auth gate, dashboard skeleton, product list/edit, order list/actions); Playwright suite (guest checkout smoke + a11y scan) and Vitest unit suite. Deferred surfaces (Phase 1+ per §13.6) are stubbed with typed placeholders — each stub names its FR ID, so nothing is silently missing.

**v4 remediation evidence (all Verified, 2026-09-08).** The five remediation slices closed the last spec-vs-code gaps; every claim below was executed in this workspace:

1. **Feature flags** — `packages/config/src/flags.ts` (+22 unit tests): five v1 flags, defaults per §4.8, garbage values and unknown `FEATURE_*` variables fail fast, unknown names fail typecheck.
2. **Provider ports** — `packages/commerce/src/providers.ts` + `search-provider.ts` (+13 tests): six ports with a bound Postgres FTS `SearchProvider` and a tested local `ConsentProvider`; existing services satisfy the remaining ports structurally.
3. **Cart idempotency** — `request-dedupe.ts` (+5 tests) wired into `cart-service.addLine` and `addToCartAction` (client sends `crypto.randomUUID()`); same `(cartId, requestId)` within 5 min is a no-op.
4. **Promotion cap invariants** — `pricing.ts` tier resolution unified into `resolveTierValue` (highest qualifying threshold), percent capped at subtotal before selection, duplicate-line-id guard; +8 property/unit tests including a fast-check counterexample that exposed the duplicate-id collapse.
5. **Outbox drainer** — `jobs.ts` `PgJobRunner` (+7 real-PG integration tests: dedupe, due-ness, no reprocess, retry→dead-letter, unknown-kind dead-letter, 12 jobs × 3 concurrent ticks without double-processing) + `/api/jobs/run` (CRON_SECRET timing-safe gate; live-verified 401/401/200) with the email handler composed at the app layer; `email.order_confirmation` payload is a self-sufficient snapshot.

Gates after remediation: `pnpm turbo lint typecheck test` 22/22 tasks (config package now participates with its own lint/typecheck/test), both apps' production builds green, Playwright Chromium 11/11 incl. 3 axe scans on the honest-checkout build. Platform lesson recorded as NFR-STACK-11: `react-dom/server` must resolve at runtime (`turbopackIgnore`) — caught by the build gate the moment the drainer route imported the email adapter.

Phase 1 hardening backlog (explicitly NOT done here, no overclaiming): mechanical `import/no-restricted-paths` lint rule (NFR-STACK-3 is review/graph-enforced today), `ShippingRateProvider`/`TaxProvider` concrete adapters behind the new ports, and the consent banner UI consuming `ConsentProvider`.

### 14.5 Appendix C — Glossary

AOV — average order value; BNPL — buy-now-pay-later; CR — conversion rate; CSP — content-security-policy; CWV — Core Web Vitals; DSA — Digital Services Act; DSR — data subject request; FTS — full-text search; GMV — gross merchandise value; INP — interaction to next paint; LCP — largest contentful paint; LTV — lifetime value; OSS — one-stop-shop (EU VAT); PDP/PLP — product detail/listing page; PITR — point-in-time recovery; RTO/RPO — recovery time/point objective; SCA — strong customer authentication; SAQ-A — PCI self-assessment questionnaire A; SLO — service-level objective.

### 14.6 Appendix D — Open questions (dispositions as of v4.0)

The v2-era open questions are **closed** in the §1.5 registry: launch currencies (EUR/DKK/SEK/USD/GBP), Net-30 (Stripe Invoicing, Phase 5), consent vendor (Cookiebot behind `ConsentProvider`), editorial CMS (in-house for v1; Sanity Phase 5 option), and Klarna (off via `FEATURE_KLARNA`). The single remaining open item is the Southern-Europe 3PL — a business decision for Q+2; the schema is multi-warehouse ready today.

### 14.7 Sign-off

Product: ___ · Engineering: ___ · Design: ___ · Operations: ___ · Legal: ___

---

## 15. Agent Operating Contract

Derived from the `spec-driven-development`, `plan-writing`, `tdd`, and `verification-and-review-protocol` skills in the my-pi-agent library, plus this repository's AGENTS.md/CLAUDE.md. Binding on every human and AI implementer; reviewers treat violations as review-blocking.

### 15.1 Always

- Read the governing PRD sections and the existing code **in full** before writing.
- Name the FR IDs and NFR-STACK rules that govern the change.
- Use `pnpm`, never `npm`/`yarn`.
- Keep money as integers; route order changes through `transition()`; never confuse the cart cookie token with the cart UUID.
- Return `ActionResult`; never throw across the action boundary; log caught errors with context — never swallow.
- Work test-first at pre-agreed seams (unit for pure domain logic, real-PG integration for transactional semantics, E2E for critical paths).
- Run `pnpm turbo lint typecheck test build` before claiming anything works, and label claims Verified / Reasoned / Assumed / Unverifiable (§12.4 ledger).

### 15.2 Ask first

- Non-additive schema changes, new dependencies, CI/CSP/auth changes.
- Enabling a feature flag in production or staging.
- Introducing Redis, Algolia, a queue, or any swap-path vendor before its §3.2/§1.5 trigger.

### 15.3 Never

- Commit secrets or `.env` (`.env.example` only) — CI scans.
- Hand-edit `package.json`/lockfile after bootstrap; use `pnpm add`.
- Skip or weaken tests, lint, or types to pass a gate. A red test is a regression or a wrong test — fix one of them, never skip.
- Add REST endpoints for UI mutations; import vendor SDKs outside their adapter; use `any`, `sql.raw`, or float money arithmetic.
- Add a build step to `packages/*`; statically import `react-dom/server` in the App Router graph (NFR-STACK-11).
- Fake Stripe payments in E2E — the honest "not configured" state is the tested path.

### 15.4 Workflow

```
ANALYZE (PRD + code in full) → PLAN (smallest correct path, seams agreed)
  → VALIDATE (money/auth/orders touchpoints) → IMPLEMENT (thin vertical slice, red → green)
  → VERIFY (gates + ledger evidence) → DELIVER (conventional commits, main only)
```

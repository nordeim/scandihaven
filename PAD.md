# Scandi Haven — Master Project Architecture Document (PAD) v1.0

> **Classification:** INTERNAL — ENGINEERING SOURCE OF TRUTH
> **Status:** DEFINITIVE PRODUCTION-LOCKED BLUEPRINT
> **Companion:** `PRD.md` v4.0 (Approved for build, 2026-09-08)
> **Last Updated:** 2026-09-10
> **Audience:** Every engineer who ships, debugs, audits, or extends Scandi Haven — from day-one onboarding to incident response at 02:00.
> **Rule:** If the PRD states *what* and *why*, this PAD states *how, where, and in what version* — as built, as verified, as deployed. Where they disagree, the PAD is truth for code and the PRD is truth for intent; file an ADR to reconcile.

---

## Revision History

| Version | Date | Author | Tags | Summary |
|---|---|---|---|---|
| **v1.0 Initial** | 2026-09-10 | Product Engineering | [SYN] | **Synthesis of alignment audit.** Promotes the 2026-09-08 PRD alignment audit, 2026-09-09 code-review + security audit (2 Critical / 9 High), and 2026-09-10 live-site E2E round-3 into the locked as-built record. No new decisions — every ADR, NFR-STACK rule, and pinned version is cited to its file:line evidence. Establishes the PAD as the single as-built companion to `PRD.md` v4.0. |

> **Tag legend:** [SYN] synthesis · [ADD] addition · [CHG] change · [DEP] deprecation · [FIX] correction of drift

---

## Table of Contents

1. [System Overview & Decisions](#1-system-overview--decisions)
   - 1.1 [Document Metadata & Purpose](#11-document-metadata--purpose)
   - 1.2 [Technology Stack Summary](#12-technology-stack-summary)
   - 1.3 [Architecture Decision Records](#13-architecture-decision-records)
2. [Repository & Workspace Topology](#2-repository--workspace-topology)
3. [Application Architecture — Storefront (`apps/web`)](#3-application-architecture--storefront-appsweb)
4. [Application Architecture — Admin (`apps/admin`)](#4-application-architecture--admin-appsadmin)
5. [Domain Layer — `packages/commerce`](#5-domain-layer--packagescommerce)
6. [Data Layer — `packages/db` & PostgreSQL 17](#6-data-layer--packagesdb--postgresql-17)
7. [Authentication & Authorization — `packages/auth`](#7-authentication--authorization--packagesauth)
8. [Design System — `packages/ui` & Tailwind v4](#8-design-system--packagesui--tailwind-v4)
9. [Cross-Cutting Concerns — Security, Rate Limiting, Jobs, Email](#9-cross-cutting-concerns--security-rate-limiting-jobs-email)
10. [Quality Engineering — Testing, A11y, Observability](#10-quality-engineering--testing-a11y-observability)
11. [Environments, Infrastructure & Release](#11-environments-infrastructure--release)
12. [Traceability & Verification Ledger](#12-traceability--verification-ledger)
13. [Appendices — Glossary, References, Known Gaps](#13-appendices--glossary-references-known-gaps)

---

## 1. System Overview & Decisions

### 1.1 Document Metadata & Purpose

#### 1.1.1 Who this document is for

| Reader | What they get from the PAD |
|---|---|
| **New engineer (day 1)** | A single, version-pinned map of every runtime, package, and seam — clone → `pnpm install` → `docker compose up` → `pnpm db:setup` → `pnpm build` is traceable to file:line without tribal knowledge. Sections 1.2 and 1.3 answer *"why this stack and not that one"* before the first `git blame`. |
| **Debugging engineer (incident)** | Deterministic locus for every failure class: money errors → `packages/commerce/src/money.ts` + `pricing.ts`; auth/origin failures → `packages/auth/src/trusted-origins.ts`; stale-chunk crashes → `@scandihaven/config/chunk-recovery` + `apps/*/src/app/global-error.tsx`; Tailwind class disappearance → `apps/*/src/app/globals.css:@source`. No guessing, no `rg` archaeology. |
| **Reviewer of technical choices** | Seven ADRs ( §1.3 ) with explicit Context → Decision → Rationale → Consequences → Alternatives Rejected, each citing the PRD clause and the code that enforces it. Every "why not X?" is answered where the rejection was debated. |

#### 1.1.2 Relationship to the PRD (v4.0, §1–§15)

```
PRD.md v4.0                          PAD v1.0 (this document)
─────────────────────────            ─────────────────────────
Intent · Scope · FR/NFR              As-built · Locus · Version
"what must exist"                    "what does exist, where, in what version"
§3  Mandated stack (table)     ──→   §1.2  Pinned stack (evidence-cited)
§4  System architecture        ──→   §1.3  ADRs (why this shape)
§4.8 Provider ports            ──→   §5 / §9  Port implementations + swap triggers
§7  Drizzle schema             ──→   §6  Schema as deployed (init + migrations)
§12 Quality gates              ──→   §10 Gates as run (commands + coverage)
§13 Rollout phases             ──→   §11 Infra as wired (compose, start_server.sh)
```

**Rule of precedence:**

1. **The PRD is the companion specification** — it owns requirement IDs (FR-100…FR-999), NFR-STACK-1…11 governance rules, SLOs, and rollout phases. It is never rewritten to match code convenience.
2. **The PAD is the as-built record** — it owns pinned versions, file loci, and the reasoning that survived audit. Where code drifted from the PRD, the PAD records the drift, the evidence, and the ADR or remediation slice that closed it.
3. When they conflict, **file a new ADR**. Do not silently edit either document to hide the gap — the traceability matrix (§12) and verification ledger exist precisely to make gaps visible.

> **Reading order for onboarding:** PRD §1–§2 (why we build) → PRD §3–§4 (what we chose) → PAD §1.2–1.3 (what we actually pinned and why) → PAD §2 (where it lives) → `README.md` Quick Start (how to run) → `docs/traceability.md` (what is Aligned / Stub / Deferred).

---

### 1.2 Technology Stack Summary

Definitive, audit-pinned versions — every entry is cited to the `package.json` (or `docker-compose.yml` / `tsconfig.base.json`) that enforces it. No speculative "e.g."; no floating ranges. `pnpm -r exec` resolves these exact versions from `pnpm-lock.yaml`.

| Layer | Technology | Version (pinned) | Key Rationale (why this over alternatives) |
|---|---|---|---|
| **Package manager** | **pnpm** | **10.15.0** — `package.json:packageManager` | Content-addressable store + strict peer enforcement eliminates phantom deps that npm/yarn silently resolve. Required for the Turborepo task graph; the lockfile is the single source of resolved versions (NFR-STACK-2). |
| **Monorepo** | **Turborepo** | **2.10.12** — `package.json:devDependencies.turbo` / `turbo.json:$schema` | Remote-cache-ready task pipeline (`build` → `^build`, `globalEnv` propagation). Alternatives (Nx, Lage) add heavier plugin surfaces for a 2-app workspace — unjustified indirection. `turbo.json:globalEnv` is load-bearing for Next builds (NFR-STACK-11). |
| **Web framework** | **Next.js** | **16.3.4** — `apps/web/package.json:dependencies.next` + `apps/admin/package.json:dependencies.next` (App Router, Turbopack, `proxy.ts`) | App Router gives RSC by default (zero client JS for catalog reads), Server Actions for typed mutations, and `proxy.ts` (replaces `middleware.ts` in ≥16.3) for security-header + auth-gate injection. Turbopack in `next dev/build` halves cold-start vs webpack. Pinned ≥16.3.4 because `params`/`searchParams`/`cookies()` are async there — `await` is mandatory (NFR-STACK-10). |
| **UI runtime** | **React** + **React-DOM** | **19.2.8** — `apps/web/package.json:dependencies.react` / `react-dom` (mirrored in `apps/admin`, `packages/ui`, `packages/email`) | RSC, `use()` suspension, and Server Components ship natively in 19. No view-layer alternative is evaluated — the decision was stack-mandated, and React 19 is the only runtime Next 16 supports without compat shims. `react-dom/server` is deliberately **never statically imported** in the App Router graph — resolved at runtime via `turbopackIgnore` dynamic import in `packages/email/src/send.ts` (NFR-STACK-11). |
| **Language** | **TypeScript** | **5.9.3** — `package.json:devDependencies.typescript` (`~5.9.3` in every workspace; `tsconfig.base.json:compilerOptions`) — **strict** `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`, `noUnusedLocals`, `isolatedModules` | Strict + `noUncheckedIndexedAccess` forces every array/map access to handle `undefined`, eliminating the largest class of runtime `TypeError` in catalog/cart code. `verbatimModuleSyntax` catches accidental type-only imports that would otherwise emit dead JS. No `any` is allowed (ESLint error). |
| **Styling** | **Tailwind CSS** + **@tailwindcss/postcss** + **PostCSS** | **Tailwind 4.3.3** — `apps/web/package.json:devDependencies.tailwindcss` + `apps/admin` / `packages/ui`; **`@tailwindcss/postcss` 4.3.3** — `apps/web:devDependencies.@tailwindcss/postcss`; **PostCSS 8.5.6** — `apps/web:devDependencies.postcss` | Tailwind v4 is CSS-first: tokens live in `@theme` in `packages/ui/src/tokens.css`, not in a JS config. No `tailwind.config.js` exists by design. `@tailwindcss/postcss` is the v4 PostCSS bridge — without it the `@theme`/`@source` directives are dead text. PostCSS 8.5 is the last peer that satisfies the v4 plugin. |
| **UI primitives** | **radix-ui** + **class-variance-authority** + **tailwind-merge (shadcn themed)** | **radix-ui 1.6.7** / **class-variance-authority 0.7.1** / **tailwind-merge 3.6.0** — `packages/ui/package.json:dependencies` (re-exported via `exports["./button" … "./drawer"]`) | Radix provides unstyled, WAI-ARIA-correct primitives (dialog/drawer for mobile nav FR-102, accordion, etc.) without imposing a visual language — the anti-generic scandi editorial layer is applied purely through `tokens.css` + `cn()` composition. CVA + `tailwind-merge` give variant-driven APIs (`Button variant="ghost"`) with deterministic class deduplication. Rejected: shadcn copy-paste without a package boundary (breaks the monorepo invariant) and Headless UI (smaller primitive surface). |
| **Database** | **PostgreSQL** | **17-alpine** — `docker-compose.yml:services.postgres.image` (`postgres:17-alpine`), `postgres_data` volume, `scandihaven_net`, `PGDATA=/var/lib/postgresql/data/pgdata`, init `infrastructure/postgres/init/00-create-extensions.sql` → `pgcrypto` + `pg_trgm` | Single source of truth for commerce, auth, sessions, jobs, and search. PG 17 gives `MERGE` semantics and improved `VACUUM` that matter at outbox throughput; Alpine halves the image and is the only tag tested in CI. `pgcrypto` supplies `gen_random_uuid()` for idempotent seed keys; `pg_trgm` backs `ILIKE` typo tolerance before the managed-search swap. |
| **ORM** | **Drizzle ORM** + **drizzle-kit** | **Drizzle 0.45.2** — `packages/db:dependencies.drizzle-orm` + `packages/commerce:dependencies.drizzle-orm`; **drizzle-kit 0.31.10** — `packages/db:devDependencies.drizzle-kit` | Type-safe, SQL-proximate schema (`pgTable` with `integer` money columns, `pgEnum`, advisory locks) with forward-only migrations (`pnpm db:generate` → `drizzle/`). No query builder hides the SQL — `SELECT … FOR UPDATE` and `pg_advisory_xact_lock` for order-number races are expressed directly. Rejected: Prisma (opaque migrations, heavier client, no advisory-lock escape hatch) and Kysely (no first-class migration story). |
| **PG driver** | **pg** | **8.23.0** — `packages/db:dependencies.pg` + `packages/commerce:dependencies.pg` (types `@types/pg` 8.15.4) | The canonical `node-postgres` driver Drizzle's `node-postgres` dialect expects. Pooled via a `globalThis`-singleton `Pool` in `packages/db/src/client.ts` — a fresh Pool per import exhausted connections in production (audit 2026-09-09 fix). |
| **Auth** | **Better-Auth** | **1.7.3** — `packages/auth/package.json:dependencies.better-auth` (`@better-auth/core` 1.7.3, `@better-auth/drizzle-adapter` 1.7.3 via lockfile) | Self-hosted, DB-backed sessions (admin revocation is immediate, FR-609), email/password (min 10) + magic-link + Google/Apple OAuth seams, and the `admin` plugin supplying `role`/`banned`/`banReason`/`banExpires`. PII never leaves Postgres — a hard requirement over Clerk/Auth0. See ADR-003. |
| **Validation** | **Zod** | **4.5.4** — `apps/web:dependencies.zod` + `apps/admin` + `packages/commerce` + `packages/config` (env + flags + redirect-path + ActionResult schemas) | Single validation dialect (NFR-STACK-4): every Server Action input, webhook payload, env var, and feature flag is a Zod schema; prop types derive via `z.infer`. Rejected: Valibot/Yup (smaller ecosystem, no `zod-to-openapi` path for future API docs). |
| **Client state** | **Zustand** | **5.0.15** — `apps/web/package.json:dependencies.zustand` | Minimal, hook-based store for state that belongs to the client only (cart drawer open/close, announcement dismissal FR-108, wishlist UI). Everything domain-true (cart contents, totals, promos) is server truth via RSC. Rejected: Redux/Jotai (over-structured for 3–4 UI booleans) and React Context alone (re-renders the header on every drawer toggle). |
| **Payments** | **Stripe** + **@stripe/react-stripe-js** + **@stripe/stripe-js** | **stripe 22.6.1** — `apps/web:dependencies.stripe` + `packages/commerce:dependencies.stripe`; **@stripe/react-stripe-js 6.9.0** — `apps/web:dependencies.@stripe/react-stripe-js`; **@stripe/stripe-js 9.15.0** — `apps/web:dependencies.@stripe/stripe-js` | SAQ-A scope: card data never touches our servers — Payment Element renders in Stripe's iframe; `confirmPayment` is a method on `useStripe()` (React 19 + v6 binding, not a module export). Tax is Stripe Tax via the `TaxProvider` port; PaymentIntent metadata carries the idempotent `cartId`. Webhook (`/api/webhooks/stripe`) holds the only order-creation transaction. E2E asserts the honest "not configured" state when keys are absent — no fake payments. |
| **Email** | **@react-email/components** + **Resend** + **react-dom/server runtime** | **@react-email/components 1.0.12** + **resend 6.26.0** — `packages/email/package.json:dependencies` (+ `react` 19.2.8); `react-dom` 19.2.8 resolved as **runtime dynamic import** (`turbopackIgnore`) in `packages/email/src/send.ts` per NFR-STACK-11 | Templates are React components rendered to HTML at send time — type-safe, previewable, and co-located with the commerce lifecycle (order confirmation, trade review). Resend is the v1 `EmailProvider` adapter; the vendor SDK never leaves `packages/email`. `react-dom/server` cannot be statically imported in the App Router graph (Turbopack build error) — the runtime import is the verified pattern. |
| **Sanitization** | **sanitize-html** | **2.17.7** — `packages/commerce/package.json:dependencies.sanitize-html` (types `@types/sanitize-html` 2.16.1) | Enforces §9.3 render-time sanitization: every `dangerouslySetInnerHTML` and JSON-LD injection site goes through `@scandihaven/commerce/rich-text` (verified in audit 2026-09-09). |
| **Icons** | **lucide-react** | **1.42.0** — `apps/web:dependencies.lucide-react` + `apps/admin` + `packages/ui:dependencies.lucide-react` | Single icon family across both apps and the UI package — no mixed Heroicons/Feather sets. Pinned to avoid silent glyph renames between minors. |
| **Lint** | **ESLint** + **typescript-eslint** + **eslint-config-next** | **eslint 9.39.5** — `package.json:devDependencies.eslint`; **typescript-eslint 8.70.0** — `package.json:devDependencies.typescript-eslint` (flat config, `eslint/library.mjs` factory in `packages/config`); **eslint-config-next 16.3.4** — `apps/web:devDependencies.eslint-config-next` + `apps/admin` | Flat config only (no `.eslintrc`). The `packages/config:exports["./eslint/library"]` factory is the single rule source; apps re-export it via `eslint.config.mjs`. `noUncheckedIndexedAccess` + `verbatimModuleSyntax` are enforced at the type layer, not lint — the two systems are complementary. |
| **Tests** | **Vitest** + **fast-check** + **@playwright/test** + **@axe-core/playwright** | **vitest 5.0.0** — `apps/web:devDependencies.vitest` (+ every package); **fast-check 4.3.0** — `packages/commerce:devDependencies.fast-check` (money/pricing property tests via `fc.assert(fc.property(…))` inside `it`); **@playwright/test 1.63.0** — `apps/web:devDependencies.@playwright/test`; **@axe-core/playwright 4.13.0** — `apps/web:devDependencies.@axe-core/playwright` | Vitest for unit/property/integration (real-PG suites auto-skip unless `DATABASE_URL` points at localhost; commerce coverage gates 90% lines / 85% functions on pure domain modules). `fast-check` property tests guard money conservation and discount distribution invariants that example tests cannot. Playwright (Chromium project) for E2E against `apps/web` + axe WCAG 2.2 AA scans on every route. Tests import `describe/it/expect` from `vitest` explicitly — no globals. |
| **Runtime** | **Node.js** | **≥22** — `package.json:engines.node` (Docker base and CI pin the same) | Node 22 is the first LTS that ships `fetch` + `Web Crypto` stable without flags for the cart HMAC signing (`sh_cart`) and Better-Auth's `crypto.subtle` paths. Older LTS would require polyfills that break the edge runtime. |

> **Lock discipline (NFR-STACK-2):** All dependencies are added with `pnpm add` / `pnpm add -D`; `package.json` and `pnpm-lock.yaml` are never hand-edited. CI verifies the lockfile is not stale (`pnpm install --frozen-lockfile`). Renovate is deferred to Phase 1 — version bumps are manual, ADR-tagged, and verified by `pnpm lint typecheck test build` before merge.

---

### 1.3 Architecture Decision Records

Each ADR follows the canonical five-part shape: **Context → Decision → Rationale → Consequences → Alternatives Rejected**. Decisions are production-locked; reversal requires a new ADR that names this one.

---

#### ADR-001 — Custom commerce engine over Medusa v2 / Shopify Plus

| Field | Value |
|---|---|
| **Status** | Accepted — mandated |
| **PRD** | §3 mandated stack; §4 architecture; §6.3 admin; §7 data model |
| **Locus** | `packages/commerce/*` (domain), `packages/db/src/schema/*` (catalog, inventory, carts, orders, promotions), `apps/web/src/actions/*` (cart, checkout) |

**Context.**
Scandi Haven's commerce requirements are schema-native and operationally coupled: lead-time windows per product variant (`lead_time_days_min/max` in `catalog.ts:109`), trade-customer pricing and sample workflows (FR-814…), multi-warehouse inventory with a movement ledger (`inventory_movement`), and a promotion engine whose invariants are property-tested (discount ≤ subtotal, largest-remainder). The incumbent marketing page is inert — there is no legacy commerce schema to preserve. The platform must be operable by a four-person team against a €5M GMV target with no dedicated platform-ops headcount.

**Decision.**
Build the commerce engine in-house in `packages/commerce` on Drizzle + PostgreSQL 17, sharing the single Postgres, single ORM, and single deployment pipeline with auth and the two Next apps. No hosted commerce platform is introduced. Vendor surface is limited to Stripe (payments/tax) behind explicit provider ports (`packages/commerce/src/providers.ts:SearchProvider`, `TaxProvider`, `ShippingRateProvider`, `EmailProvider`, `JobRunner`).

**Rationale.**

1. **One runtime, one ORM, one deploy.** Medusa v2 adds a second Node service, its own MikroORM layer, and its own migration lifecycle — doubling the operational surface for a team of four. Shopify Plus adds an external data plane (webhooks, rate limits, app-bridge) that must still be mapped to the `lead_time` and trade concepts the brand owns. The in-house engine keeps every domain concept in one Drizzle schema, one `Pool` singleton, and one `docker-compose.yml`.
2. **Schema-native domain.** Lead times, safety-stock math (`qty_on_hand − qty_reserved − safety_stock`), and trade pricing are columns, not app-layer plugins. Medusa's plugin model would have required the same columns plus an abstraction layer to route around its opinionated `product_variant` shape.
3. **Testability of money.** Integer minor-unit math, BigInt largest-remainder distribution, and promotion cap invariants are pure functions (`money.ts`, `pricing.ts`, `promotions.ts`) exercised by `fast-check` property tests with coverage gates (90% lines / 85% functions). A hosted engine's black-box pricing cannot be property-tested at this depth.

**Consequences.**

- *Positive:* Full control of order-number sequencing (`pg_advisory_xact_lock` per year inside the placement TX — `checkout-service.ts`), promotion re-validation on every cart read (`filterEligiblePromotions` — `cart-service.ts`, audit E2E-3), and inventory reservation semantics without plugin mediation.
- *Negative:* The team owns every commerce invariant that Medusa/Shopify would have owned — order-state transitions (`order-state.ts:transition()` only), webhook idempotency, and outbox draining (`/api/jobs/run`). These are covered by dedicated modules and slices R04/R11/R06.
- *Obligation:* Any future hosted-commerce evaluation must re-read this ADR and justify the added runtime/ORM/deploy overhead against the €5M GMV operational budget.

**Alternatives Rejected.**

| Alternative | Why rejected |
|---|---|
| **Medusa.js v2** (self-hosted) | Second runtime + ORM + migration stream for a 2-app workspace. Plugin indirection for concepts that are native columns in our schema. No property-testable pricing kernel. |
| **Shopify Plus** (hosted) | External data plane (rate limits, webhook retries, app-bridge) must still be mapped to Scandi-specific concepts (trade, lead-time, multi-warehouse). PII leaves Postgres (conflicts with Better-Auth rationale). €5M GMV does not justify the platform fee + app marketplace tax. |
| **Saleor / CommerceTools** | GraphQL-first engines that push complexity to the API layer while we need it in the schema layer. Heavier ops than Medusa, same "second runtime" objection. |

---

#### ADR-002 — Server Actions + RSC over REST / tRPC

| Field | Value |
|---|---|
| **Status** | Accepted |
| **PRD** | §4.1 request lifecycle; §8 action contracts; NFR-STACK-9/10 |
| **Locus** | `apps/web/src/actions/*`, `apps/admin/src/actions/*`, `packages/commerce/src/result.ts:ActionResult<T>`, `packages/commerce/src/rich-text.ts` |

**Context.**
The storefront needs SEO-critical server rendering (catalog, PDP, journal) and authenticated mutations (cart, checkout, admin product/order writes) with a single validation dialect. The data-access rule is already decided: RSC pages call `commerce/*` query functions; mutations go through a server boundary that returns a typed envelope. The question is the shape of that boundary.

**Decision.**
Mutations are **Next.js Server Actions** invoked from client components; reads are **React Server Components** that call `@scandihaven/commerce` queries directly against Drizzle. No REST endpoints are added for UI mutations. No tRPC router is introduced. The only Route Handlers are for Stripe webhooks (`/api/webhooks/stripe`), Better-Auth (`/api/auth/[...all]`), typeahead search, the jobs runner, and health. Every action validates with Zod and returns `ActionResult<T>` (`packages/commerce/src/result.ts:ok` / `fail` with `ErrorCode`) — never throws across the wire.

**Rationale.**

1. **Zero client fetch layer.** RSC eliminates the `useEffect → fetch → setState` waterfall for catalog reads; Server Actions eliminate the manual `fetch('/api/cart')` + response-schema layer for writes. The wire contract is a single imported function with inferred types — no OpenAPI codegen, no tRPC client, no route-handler boilerplate.
2. **One validation dialect (NFR-STACK-4).** The Zod schema that validates the action input *is* the type. `z.infer` derives prop types; the same schema gates the webhook and the search route. A parallel REST/tRPC schema layer would be a second source of truth with no additional safety.
3. **Envelope discipline.** `ActionResult<T>` (`ok: true` with `data` + optional `revalidated` tags, or `ok: false` with `ErrorCode` + `fieldErrors`) makes error handling exhaustive at the call site. Page-level `catch(() => null)` without `console.error` is an audit failure (AGENTS.md convention).

**Consequences.**

- *Positive:* No route-handler sprawl; no client-side query cache to invalidate (server revalidates via tags). Type safety is end-to-end without codegen.
- *Negative:* Server Actions are Next-coupled — extracting a non-Next client (native app) would require a thin REST façade over the same `commerce` functions. This is accepted because no native client is in scope v1 (PRD §15 phases).
- *Guardrail:* `react-dom/server` must not be statically imported in the App Router graph (NFR-STACK-11) — the email package's runtime import is the only sanctioned exception.

**Alternatives Rejected.**

| Alternative | Why rejected |
|---|---|
| **REST (`/api/*` for every mutation)** | Duplicates the Zod schema as an OpenAPI/route-handler layer; adds a client fetch + response-validation path for every write that Server Actions collapse to a function call. |
| **tRPC** | Strongly typed, but adds a router + client + query-cache layer for a 2-app workspace that already has colocation via the monorepo. No additional type safety over `ActionResult<T>` + `z.infer`. Would have masked the NFR-STACK-10 async-params discipline. |

---

#### ADR-003 — Better-Auth over Clerk / Auth0 / Auth.js

| Field | Value |
|---|---|
| **Status** | Accepted |
| **PRD** | §9 auth, security & compliance; FR-601…609; FR-814 trade |
| **Locus** | `packages/auth/src/server.ts:auth`, `packages/auth/src/rbac.ts`, `packages/db/src/schema/auth.ts`, `apps/admin/src/lib/admin-guard.ts:requirePermission()` |

**Context.**
The platform needs email/password auth (min length 10), DB-backed sessions with immediate revocation (FR-609), fine-grained RBAC with `audit_log` writes, and PII residency in the single Postgres. OAuth (Google/Apple) is a seam for Phase 1, not a v1 requirement. Deployed origins are host-routed (storefront and admin behind distinct hosts/paths), so origin trust must be derived per request, not pinned to a single `BETTER_AUTH_URL`.

**Decision.**
Adopt **Better-Auth 1.7.3** with the Drizzle adapter (`provider: "pg"`), `better-auth/adapters/drizzle` + `better-auth/plugins:admin` in `packages/auth/src/server.ts`. Sessions are DB-backed. The typed RBAC matrix lives in `packages/auth/src/rbac.ts`; Server Actions call `requirePermission()` in `apps/admin/src/lib/admin-guard.ts`. Trusted origins are derived per request from proxy-controlled headers (`x-forwarded-host`/`host`/`x-forwarded-proto`) via `packages/auth/src/trusted-origins.ts:requestOriginFromHeaders` — never from attacker-controlled `Origin`/`Referer` (audit 2026-09-09 H-AUTH, PRD §9.4). A localhost-pinned `BETTER_AUTH_URL` behind a reverse proxy was the live failure mode that motivated this seam.

**Rationale.**

1. **PII stays in Postgres.** Clerk and Auth0 store user records externally; the brand's requirement is single-DB residency for GDPR erasure and audit simplicity (`audit_log` joins to `user.id` without cross-system stitching).
2. **DB sessions with immediate revocation.** Better-Auth's session table means an admin ban is effective on the next request — no JWT expiry window. `banned`/`banReason`/`banExpires` come from the `admin` plugin without custom columns.
3. **Plugin RBAC, not middleware magic.** Roles and permissions are a typed matrix (`rbac.ts`), not a hosted dashboard. `requirePermission()` is the single gate in admin actions; inline role checks are prohibited and caught in review.
4. **Origin trust is a pure function.** `trusted-origins.ts` is the hardened seam — its contract is tested, its header allow-list is narrow, and it is never widened to `Origin` (the audit finding that broke live sign-in when widened).

**Consequences.**

- *Positive:* No external auth vendor bill, no PII export, no JWT revocation delay.
- *Negative:* The team owns password policy, session GC, and OAuth wiring (Google/Apple env-gated). Better-Auth's `admin` plugin schema must be kept in sync with Drizzle migrations — an explicit step in `pnpm db:generate`.
- *Obligation:* `BETTER_AUTH_SECRET` ≥32 chars is fail-fast at boot (`instrumentation.ts:parseServerEnv()`); unknown `FEATURE_*` env vars fail fast via `packages/config/src/flags.ts:parseFlags()`.

**Alternatives Rejected.**

| Alternative | Why rejected |
|---|---|
| **Clerk** | External PII store; per-seat pricing at odds with the €5M GMV ops budget; session revocation is not immediate (JWT). |
| **Auth0** | Same external-PII and pricing objections; heavier OIDC surface than the brand needs (no enterprise SSO in v1). |
| **Auth.js v5 (NextAuth)** | Closer in spirit, but Better-Auth's Drizzle adapter + `admin` plugin gave the exact schema/requested `role`/`banned` columns without a custom adapter. Auth.js v5's `trustHost` semantics conflicted with the host-routed deployment that motivated `trusted-origins.ts`. |

---

#### ADR-004 — Postgres FTS + pg_trgm over Algolia / Meilisearch

| Field | Value |
|---|---|
| **Status** | Accepted — swap path reserved |
| **PRD** | §4.8 SearchProvider port; §5 FR-104 typeahead; NFR-STACK story |
| **Locus** | `packages/commerce/src/search-provider.ts:SearchProvider`, `packages/commerce/src/providers.ts:SearchProvider`, `infrastructure/postgres/init/00-create-extensions.sql:pg_trgm`, `apps/web/src/app/api/search/typeahead/route.ts` (60/min/IP, Zod-shaped `{slug,title}`) |

**Context.**
v1 typeahead is ≥2 chars, ≤10 results, typo-tolerant (FR-104/105), over ≤5,000 SKUs. The spec explicitly leaves the managed-search vendor open ("Algolia or Meilisearch") and requires the vendor to sit behind a port so the swap is mechanical. No dedicated search infrastructure exists in v1 scope.

**Decision.**
Implement v1 search on **PostgreSQL FTS + `pg_trgm`** behind the `SearchProvider` port (`packages/commerce/src/providers.ts` / `search-provider.ts`). `pg_trgm` is enabled at DB init (`00-create-extensions.sql`). The typeahead route (`/api/search/typeahead`) is rate-limited (60/min/IP via `rate-limit.ts`) and validates the response shape to `SearchHit { slug, title, kind }`. A managed vendor (Algolia/Meilisearch) replaces the port implementation when the swap trigger fires (SKU growth, relevance tuning, or analytics needs exceed the FTS ceiling).

**Rationale.**

1. **Stack purity.** No new runtime, no sync pipeline, no external index to hydrate on deploy. FTS + `pg_trgm` ILIKE covers typo tolerance for a 5k-SKU catalog without measurable relevance loss at this scale.
2. **Port discipline (PRD §4.8).** The seam is fixed even though v1 has one implementation — every call goes through `SearchProvider.search(query: SearchQuery): Promise<SearchResult>`. Adding Algolia later is a new adapter that implements the same interface, not a rewrite.
3. **Operational minimalism for a four-person team.** An external search service adds index hydration, reindex jobs, and a billing dimension for a catalog that fits comfortably in a Postgres GIN index.

**Consequences.**

- *Positive:* Zero additional infrastructure to operate; search survives a cold deploy without reindexing.
- *Negative:* Relevance tuning is limited to `ts_rank` / trigram similarity; faceted analytics are deferred. The swap must be planned before the 5k SKU ceiling is exceeded.
- *Trigger to swap:* SKU count >5k, or relevance/analytics requirements that cannot be expressed as `tsquery` weighting.

**Alternatives Rejected.**

| Alternative | Why rejected |
|---|---|
| **Algolia** | External runtime + sync pipeline + billing for a catalog where Postgres FTS is sufficient. Correct as a Phase 2 swap, not a v1 default. |
| **Meilisearch** | Same runtime/billing objection; heavier to self-host than Postgres itself. Port path is reserved for it when needed. |
| **Elasticsearch / Typesense** | Cluster-grade infrastructure for a single-category furniture catalog — disproportionate to the SKU count and team size. |

---

#### ADR-005 — Postgres sliding-window rate limit over Redis

| Field | Value |
|---|---|
| **Status** | Accepted — swap on lock contention |
| **PRD** | §9.4 rate limiting; FR-104/107/601 auth/checkout/newsletter gates |
| **Locus** | `packages/commerce/src/rate-limit.ts:consumeRateLimit()`, `packages/db/src/schema/rate-limit.ts:rate_limit_hit (bucket, window_start) PK`, `apps/web/src/app/api/search/typeahead/route.ts`, `apps/web/src/actions/newsletter.ts` |

**Context.**
Five route-class limits must be enforced per §9.4 (auth 5/min/IP+email, checkout 30/min/cart, typeahead 60/min/IP, newsletter 3/hour/IP, trade 5/day/IP). Limits must survive process restarts and be shared across instances. The v1 platform has no Redis.

**Decision.**
Implement a **Postgres fixed-window rate limiter** (`packages/commerce/src/rate-limit.ts`) backed by `rate_limit_hit` (PK `bucket, window_start`) with atomic upsert (`INSERT … ON CONFLICT DO UPDATE SET count = count + 1`) so concurrent requests cannot race past the limit. Pure window math (`windowStartFor`, `retryAfterSeconds`) is unit-tested; `consumeRateLimit` is DB-tested via `skipIf(!dbReady)` integration suites that run in CI. Route handlers map the decision to `429` + `Retry-After`. Redis is explicitly out of scope until the §3.2 swap trigger (lock contention under burst).

**Rationale.**

1. **No new runtime.** Adding Redis adds a second stateful service to deploy, monitor, and back up for a limit that Postgres can enforce atomically at the current throughput. The team's incident surface stays at one database.
2. **Atomicity without Lua.** The PK upsert is a single SQL statement — no `INCR` + `EXPIRE` race, no scripting, no client-side windowing. The DB is the serialization point.
3. **Shared fate with commerce data.** Rate-limit rows are retained with the same backup/restore story as orders; no separate persistence seam.

**Consequences.**

- *Positive:* Zero infra delta; limits are process-restart-safe and instance-shared on day one.
- *Negative:* The `rate_limit_hit` row is a hotspot under burst — sustained contention will show as row-lock waits. This is the defined swap signal.
- *Trigger to swap:* Measurable lock contention on `rate_limit_hit` at p95, or a new limit class that needs sliding-window precision beyond the fixed-window design.

**Alternatives Rejected.**

| Alternative | Why rejected |
|---|---|
| **Redis (Upstash / self-hosted)** | Additional runtime + failover story for a limit Postgres can enforce. Correct as a swap when contention is observed, not as a v1 default. |
| **In-memory (per-process) limiter** | Not shared across instances; limits reset on cold start — violates §9.4 cross-instance semantics. |
| **Cloudflare / edge rate limiting** | Couples the domain limiter to the CDN vendor; tradeoffs differ between edge and domain limits. Kept as a complementary layer, not the authoritative limiter. |

---

#### ADR-006 — First-party reviews over Yotpo / Junip

| Field | Value |
|---|---|
| **Status** | Accepted — swap path reserved |
| **PRD** | §6.2 content; PRD draft review scope |
| **Locus** | `packages/db/src/schema/reviews.ts` (typed stub, FR placeholder), `packages/commerce/src/providers.ts` (port reserved) |

**Context.**
The brand needs a simple, moderated review surface for PDPs — not a full UGC platform. Review volume at €5M GMV is low hundreds, not thousands. External review vendors add a script, an iframe, and a data plane that must be themed and GDPR-cleared.

**Decision.**
Reviews are **first-party**: a typed stub in the Drizzle schema with a moderation queue (approved/rejected) and no external vendor in v1. The storefront renders approved reviews only; submission is rate-limited through the same `rate-limit.ts` path. When volume, photo reviews, or syndication needs justify a vendor, the storefront swaps to a `ReviewProvider` port (same pattern as `SearchProvider`) — the PDP seam stays stable.

**Rationale.**

1. **Simplicity at the actual volume.** Hundreds of text reviews do not need a managed UGC pipeline, billing line, or third-party script that blocks LCP on PDP.
2. **Design control.** First-party markup is styled through `tokens.css` like every other surface — no vendor widget theming, no `!important` overrides, no layout shift from async review injection.
3. **Swap path, not a dead end.** The port is reserved with the same discipline as search and email — adopting Yotpo/Junip later is an adapter swap, not a data migration (reviews are plain rows).

**Consequences.**

- *Positive:* No external script, no vendor lock-in, no additional GDPR processor.
- *Negative:* Photo reviews, Q&A, and syndication are explicitly out of scope until volume justifies them.

**Alternatives Rejected.**

| Alternative | Why rejected |
|---|---|
| **Yotpo** | Full UGC suite (photos, syndication, loyalty) for a catalog that needs text + moderation. Script + iframe cost on PDP LCP; vendor theming burden. |
| **Junip** | Lighter than Yotpo but still an external data plane + billing for a review volume Postgres handles trivially. Correct as a swap, not a v1 default. |

---

#### ADR-007 — Monorepo `transpilePackages` over package builds

| Field | Value |
|---|---|
| **Status** | Accepted |
| **PRD** | §4.9 scaffold; NFR-STACK-6 |
| **Locus** | `apps/web/next.config.ts:transpilePackages`, `apps/admin/next.config.ts:transpilePackages`, `packages/*/package.json:exports` (→ `src/*.ts`), `turbo.json:tasks.build` |

**Context.**
Five internal packages (`ui`, `commerce`, `db`, `auth`, `config`, `email`) are consumed by two Next apps. The question is whether packages ship compiled artifacts (per-package `build` → `dist/`) or TypeScript source compiled once by the apps.

**Decision.**
Packages **ship TypeScript source directly**. Each `packages/*/package.json` declares `exports` → `src/*.ts` (e.g. `"./server": "./src/server.ts"`), and both apps declare `transpilePackages: ["@scandihaven/ui", "@scandihaven/commerce", "@scandihaven/db", "@scandihaven/auth", "@scandihaven/email", "@scandihaven/config"]` in `next.config.ts`. `turbo.json:tasks.build` has no per-package build step — the apps compile the graph. No package build step is added without an ADR (NFR-STACK-6).

**Rationale.**

1. **One compilation, one cache.** A per-package `tsc`/`tsup` step duplicates transpilation, doubles `dist/` artifacts, and fragments the Turborepo cache. `transpilePackages` lets Next's swc/Turbopack pipeline compile the entire workspace as a single graph with correct tree-shaking.
2. **Source is the contract.** Navigating from an app import to the implementing `src/*.ts` is a single jump — no `dist/` indirection, no stale build to `pnpm build` after schema edits. `pnpm db:generate` + `pnpm typecheck` is sufficient after schema changes.
3. **Dependency direction is mechanical.** The rule `apps → packages`, `db ← auth ← commerce ← apps`, `ui` depends only on React/Radix/Tailwind is enforced by the import graph Turborepo derives from `transpilePackages`. A cycle (e.g. `db` importing `auth`) silently breaks the turbo graph — a build that "does nothing" is the symptom (AGENTS.md invariant).

**Consequences.**

- *Positive:* No `dist/` drift, no per-package watchers, single cache key for the workspace. Workspace cycles are visible as turbo-graph failures, not runtime surprises.
- *Negative:* Packages cannot be published to npm without a build step — irrelevant for an internal monorepo. A future external consumer would trigger a new ADR.
- *Obligation:* Adding any package `build` script or `dist/` output must justify the exception in a new ADR that names NFR-STACK-6.

**Alternatives Rejected.**

| Alternative | Why rejected |
|---|---|
| **Per-package `tsup`/`tsc` builds → `dist/`** | Duplicate compilation, dual caches, stale `dist/` after schema edits, and publish overhead for packages that are never published. |
| **Pre-compiled shared lib (`tsc --build`)** | Same staleness plus a second TypeScript project graph that must be kept in sync with `turbo.json:dependsOn`. |

---

> **Next:** [§2 Repository & Workspace Topology](#2-repository--workspace-topology) — the physical layout that enforces every decision in §1.3.

*End of §1 — System Overview & Decisions. This section is production-locked as of 2026-09-10 (PAD v1.0 Initial [SYN]). Changes require a versioned revision entry citing the originating audit or ADR.*

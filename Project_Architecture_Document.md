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



## 2. High-Level System Topology

### 2.1 End-to-End Flow (Browser → Edge → Proxy → App → Domain → Data → External Services)

```mermaid
flowchart TB
    %% ── Clients ──
    BrowserStorefront["Browser — Storefront :3000<br/>RSC page shell + Client Islands<br/>cart-drawer · gallery · buy-panel · quantity-stepper<br/><i>Runtime: Browser JS (React 19). Scaling: stateless CDN cache. Constraint: no card data — iframe only.</i>"]:::client
    BrowserAdmin["Browser — Admin :3001<br/>RBAC-gated (staff) layout<br/>products / orders / customers<br/><i>Runtime: Browser JS. Scaling: per-staff session. Constraint: gate is UX only — re-auth in Actions.</i>"]:::client

    %% ── Edge ──
    Edge["Edge / CDN — Cloudflare<br/>TLS + cache + Insights beacon injection<br/>allow-listed: static.cloudflareinsights.com<br/><i>Runtime: Cloudflare Edge. Scaling: global PoPs. Constraint: CSP must allow beacon or every pageview violates.</i>"]:::edge
    Beacon["Cloudflare Insights RUM beacon<br/>https://static.cloudflareinsights.com/beacon.min.js<br/>injected at edge — not in bundle"]:::edge

    %% ── Proxy (Node) ──
    Proxy["Vercel Node — proxy.ts<br/>securityHeaders() + x-request-id + origin trust<br/>x-forwarded-host / host / x-forwarded-proto<br/>rewrites: /admin → /  (admin app)<br/><i>Runtime: Node.js 22 (proxy). Scaling: stateless, per-request. Constraint: MUST live at apps/*/src/proxy.ts; config.matcher inline literal.</i>"]:::proxy

    %% ── Next.js Apps ──
    WebApp["Next.js 16 App — apps/web :3000<br/>RSC queries: commerce/catalog, cart-service#getCartDto<br/>Mutations: Server Actions apps/web/src/actions/* → ActionResult&lt;T&gt;<br/>Route Handlers: /api/webhooks/stripe, /api/auth/[...all], /api/search/typeahead (60/min/IP), /api/health, /api/jobs/run<br/><i>Runtime: Node.js 22 (App Router, Turbopack). Scaling: stateless web tier; sessions in DB. Constraint: pages async, params/cookies awaited; exports only default/metadata/generateMetadata/revalidate/dynamic.</i>"]:::app
    AdminApp["Next.js 16 App — apps/admin :3001<br/>RSC + (staff) layout gate<br/>Mutations: apps/admin/src/actions/* → requirePermission() → audit_log<br/><i>Runtime: Node.js 22. Scaling: stateless. Constraint: gate does not authorize — Actions re-check RBAC matrix.</i>"]:::app

    %% ── Domain Packages ──
    Commerce["packages/commerce — Pure Domain<br/>pricing.ts / promotions.ts / money.ts / order-state.ts<br/>cart-service.ts / checkout-service.ts / jobs.ts<br/>providers/* (Search / Tax / Shipping / Email / JobRunner)<br/>rate-limit.ts / request-dedupe.ts / rich-text.ts / result.ts<br/><i>Runtime: Node (imported via transpilePackages). Scaling: pure functions — horizontally free. Constraint: money integers (minor units) + transition() only writer; vendor SDKs confined to adapters; no package build step.</i>"]:::domain
    AuthPkg["packages/auth — Better-Auth + RBAC<br/>server.ts (Drizzle adapter, admin plugin) / client.ts<br/>rbac.ts matrix + trusted-origins.ts<br/><i>Runtime: Node. Scaling: DB sessions (revocation immediate). Constraint: origin derived from proxy-controlled headers only — never Origin/Referer (H-AUTH).</i>"]:::domain

    %% ── Data ──
    DbPkg["packages/db — Pooled Drizzle<br/>globalThis singleton Pool (max 10) + Drizzle proxy<br/>ensureSeeded() advisory-lock + natural-key upserts<br/>schema: catalog / orders / customers / content / ops / auth / enums<br/><i>Runtime: Node (pg 8.23 + drizzle-orm 0.45). Scaling: pooled (globalThis — never per-import). Constraint: seed/migrate refuse non-local DATABASE_URL; HMR shares one pool (audit C1).</i>"]:::data
    PG["PostgreSQL 17 — multi-AZ<br/>postgres:17-alpine · scandihaven_postgres<br/>postgres_data (PGDATA=/var/lib/postgresql/data/pgdata)<br/>pgcrypto (gen_random_uuid) + pg_trgm (ILIKE typo)<br/>PITR: RTO 4h / RPO 15m (PRD §11.4)<br/><i>Runtime: PG 17-alpine. Scaling: single writer, read-replicas out-of-scope v1. Constraint: advisory locks serialize order_number + ensureSeeded.</i>"]:::data
    ObjectStore["Object Storage — Private Bucket<br/>product/media assets (presigned URLs)<br/><i>Runtime: S3-compatible. Scaling: CDN-cached. Constraint: bucket private; URLs signed server-side (never public).</i>"]:::data

    %% ── External Services ──
    StripeJS["Stripe.js + Payment Element (SAQ-A)<br/>js.stripe.com iframe · confirmPayment() on useStripe()<br/>Stripe Tax via TaxProvider port<br/><i>Runtime: Stripe-hosted iframe. Constraint: card data never touches our servers; publishable key only in browser.</i>"]:::ext
    StripeAPI["Stripe API — PaymentIntents + Webhooks<br/>signature window 300s · idempotencyKey cart:cartId:total<br/><i>Runtime: api.stripe.com. Scaling: Stripe-managed. Constraint: amount re-verified server-side (FR-508).</i>"]:::ext
    WebhookHandler["/api/webhooks/stripe — Route Handler<br/>verify signature → tx { webhook_event UNIQUE → re-price → FOR UPDATE inventory → order+payment → outbox jobs }<br/><i>Runtime: Node (Route Handler). Constraint: webhook_event insert INSIDE TX (audit H4d); duplicate → 200 no-op.</i>"]:::ext

    ResendSvc["Resend — Email Delivery<br/>packages/email (Resend adapter)<br/>templates as React → renderToStaticMarkup at runtime<br/><i>Runtime: Resend API. Scaling: provider-managed. Constraint: react-dom/server via turbopackIgnore runtime import; log transport when RESEND_API_KEY absent.</i>"]:::ext
    EmailPkg["packages/email<br/>send.ts (turbopackIgnore) + templates/order-confirmation.tsx<br/><i>Constraint: never statically import react-dom/server in App Router graph.</i>"]:::domain
    JobRunner["Outbox — job table + /api/jobs/run<br/>CRON_SECRET gated · idempotencyKey per job<br/>email.order_confirmation · ops.payment_orphan<br/><i>Runtime: Node (Route Handler). Scaling: at-least-once drain. Constraint: outbox jobs inserted in placement TX.</i>"]:::data

    %% ── Flows ──
    BrowserStorefront --> Edge
    BrowserAdmin --> Edge
    Edge --> Proxy
    Beacon -. "injected at edge<br/>CSP allow-listed" .-> Edge
    Proxy --> WebApp
    Proxy --> AdminApp

    WebApp --> Commerce
    AdminApp --> Commerce
    WebApp --> AuthPkg
    AdminApp --> AuthPkg
    Commerce --> DbPkg
    AuthPkg --> DbPkg
    DbPkg --> PG
    PG --> ObjectStore

    WebApp -. "Payment Element iframe" .-> StripeJS
    StripeJS -. "tokenized" .-> StripeAPI
    StripeAPI -- "payment_intent.succeeded<br/>Stripe-Signature (300s)" --> WebhookHandler
    WebhookHandler --> Commerce
    Commerce --> JobRunner
    JobRunner --> EmailPkg
    EmailPkg --> ResendSvc
    Commerce -. "TaxProvider + ShippingRateProvider" .-> StripeAPI

    %% ── Health / Cron ──
    WebApp -. "/api/health → {status, db}" .-> PG
    AdminApp -. "/api/health" .-> PG

    classDef client fill:#fff7ed,stroke:#c97b5e,stroke-width:1.5px,color:#1f1b17
    classDef edge fill:#f0f9ff,stroke:#0ea5e9,stroke-width:1.5px,color:#0c4a6e
    classDef proxy fill:#fefce8,stroke:#ca8a04,stroke-width:1.5px,color:#422006
    classDef app fill:#faf7f2,stroke:#8f4326,stroke-width:1.5px,color:#1f1b17
    classDef domain fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px,color:#052e16
    classDef data fill:#e8e0d2,stroke:#8f4326,stroke-width:1.5px,color:#1f1b17
    classDef ext fill:#f5f3ff,stroke:#7c3aed,stroke-width:1.5px,color:#2e1065
```

### 2.2 Layer Annotations (Runtime · Scaling · Constraints)

| Layer | Runtime | Location | Scaling | Constraints & Invariants |
|---|---|---|---|---|
| **Browser — Storefront** | React 19 Client Islands in RSC shell | `apps/web/src/components/*` (`cart-drawer.tsx`, `product-buy-panel.tsx`, `gallery`) + `apps/web/src/stores/cart-store.ts` | Stateless; CDN-cached HTML, islands hydrate per page | Islands hold **drawer/UI only** — no server data cached client-side. Props from RSC are truth; `useOptimistic` + rollback. Card data confined to Stripe iframe (SAQ-A). |
| **Browser — Admin** | React 19 Client | `apps/admin/src/app/(staff)/*` + `apps/admin/src/lib/admin-guard.ts` | Per-staff DB session | `(staff)` layout gate is **UX redirect only** — every mutation calls `requirePermission()` (`packages/auth/src/rbac.ts`) and writes `audit_log`. No inline role checks. |
| **Edge / CDN** | Cloudflare (TLS + cache) | Edge — outside repo | Global PoPs; cache `/_next/static` aggressively | Injects `static.cloudflareinsights.com` RUM beacon. CSP **must** allow `script-src … https://static.cloudflareinsights.com` + `connect-src … https://cloudflareinsights.com` (`packages/config/src/security-headers.ts:securityHeaders()` — E2E-7 fix). Blocking the beacon logs a violation on every production pageview. |
| **Vercel Node — Proxy** | Node.js 22 (`proxy.ts`) | `apps/web/src/proxy.ts:proxy()` · `apps/admin/src/proxy.ts:proxy()` · `packages/config/src/security-headers.ts:securityHeaders()` | Stateless, per-request, horizontally infinite | **MUST** live at `apps/*/src/proxy.ts` — Next 16.3 discovers only there; repo-root placement compiles but never registers (audit H8d). `config.matcher` is an **inline literal** — Next statically parses it; import indirection silently disables matching. Sets `x-request-id` (`crypto.randomUUID()`), `securityHeaders()` on **every** response including `/sign-in` (audit H5d/LD-2: credential page must not go bare), derives origin trust via `requestOriginFromHeaders()` (`packages/auth/src/trusted-origins.ts`) from `x-forwarded-host`/`host`/`x-forwarded-proto` only. Rewrites: admin `beforeFiles` strips `/admin` prefix after gate (`apps/admin/next.config.ts:rewrites()` — H2-ADMIN). CSP `unsafe-inline` remains until Phase 1 nonce CSP; remainder restrictive. |
| **Next.js Apps** | Node.js 22, App Router + Turbopack | `apps/web/src/app/*` · `apps/admin/src/app/*` · `apps/*/src/instrumentation.ts` | Stateless web tier — any replica serves any request; sessions live in DB, not memory | RSC: pages are `async` — `params`/`searchParams`/`cookies()`/`headers()` are **awaited** (Next 16.3). Page modules export **only** `default`, `metadata`/`generateMetadata`, `revalidate`, `dynamic` — extra exports fail `next build`. Mutations: **Server Actions only** (`apps/*/src/actions/*` → `ActionResult<T>` `packages/commerce/src/result.ts` — `ok`/`fail` with `ErrorCode`, never throw across boundary). Reads: RSC calls `@scandihaven/commerce/*` queries directly against Drizzle. Route Handlers exist **only** for Stripe webhooks, Better-Auth, typeahead, jobs runner, health — no REST for UI mutations. `instrumentation.ts` runs `parseServerEnv()` + `parseFlags()` at boot — missing env or unknown `FEATURE_*` fails fast (PRD §9.4). `DISABLE_IMAGE_OPTIMIZER=1` local/E2E only; production keeps `sharp`. |
| **Domain — commerce + auth** | Node, imported via `transpilePackages` | `packages/commerce/src/*` · `packages/auth/src/*` | Pure functions → horizontally free; no per-request state | **No package build step** — `exports` → `src/*.ts`, apps compile via `transpilePackages` (`apps/*/next.config.ts` — ADR-007, NFR-STACK-6). Dependency direction enforced: `db ← auth ← commerce ← apps`; `ui` has no commerce import (use structural props). **Money is integers** (`packages/commerce/src/money.ts:assertMinor`, `sumMinor`, `roundHalfUp`) — floats never touch money; discount distribution uses **BigInt largest-remainder** (`packages/commerce/src/pricing.ts:distributeDiscount` — property-tested). **Order status** changes only via `transition()` (`packages/commerce/src/order-state.ts:transition()` → `InvalidOrderTransition`). Provider ports (`packages/commerce/src/providers.ts` / `search-provider.ts`): vendor SDKs stay in adapters; new vendors implement the port. `rate-limit.ts` is Postgres `rate_limit_hit` PK upsert (swap on lock contention). Auth: DB sessions via `packages/auth/src/server.ts` (Drizzle adapter + `admin` plugin → `role`/`banned`); RBAC matrix `packages/auth/src/rbac.ts:requirePermission()`; origin trust seam `trusted-origins.ts:requestOriginFromHeaders` — pure, tested (`server-origin.test.ts`, `trusted-origins.test.ts`), never reads `Origin`/`Referer`. |
| **Data — Drizzle + PG 17** | `pg` 8.23 Pool + `drizzle-orm` 0.45 | `packages/db/src/client.ts` · `packages/db/src/schema/*` · `packages/db/src/seed/ensure-seeded.ts` | Pool singleton on `globalThis` (`__scandihavenPool`/`__scandihavenDb`) — HMR and prod share one Pool (audit C1: per-import Pool exhausted `max_connections` under `next start`) | `pool`/`db` are **lazy Proxies** so `next build` page-data collection (imports auth route → db client) succeeds without `DATABASE_URL`; first real query fails fast with actionable message. `ensureSeeded()` uses `pg_advisory_xact_lock` + natural-key upserts — idempotent, local hosts only (`local-db.ts`). Migrations forward-only (`pnpm db:generate` → `drizzle/*.sql`). `statement_timeout 15s`, `max 10`, `idleTimeout 30s`. |
| **PostgreSQL 17 + Object Storage** | `postgres:17-alpine` (`scandihaven_postgres` / `postgres_data` / `scandihaven_net`, `PGDATA=/var/lib/postgresql/data/pgdata`) | `docker-compose.yml:services.postgres` · `infrastructure/postgres/init/00-create-extensions.sql` | Single-writer PG; volume `postgres_data`; network `scandihaven_net`; multi-AZ in prod with PITR **RTO 4h / RPO 15m** (PRD §11.4) | Extensions `pgcrypto` (`gen_random_uuid()`) + `pg_trgm` (FTS typo tolerance, swap trigger >5k SKUs → `SearchProvider` Algolia/Meilisearch). Object storage bucket **private** — URLs signed server-side. `start_server.sh` wraps fresh-clone → prod: `ensure_env` (quoted `.env`) → `docker compose up -d` (pg_isready wait) → `pnpm db:setup` (migrate+seed idempotent) → `pnpm build` → `pnpm prod :3000 + :3001` (health checks `/api/health` + CSP/admin gate). `DB_RESET=1` for drop+recreate. |
| **Stripe (Payments + Tax + Webhooks)** | Stripe API + Stripe.js 9.15 / react-stripe-js 6.9 | `packages/commerce/src/checkout-service.ts:createPaymentIntent()` + `placeOrderFromWebhook()` · `apps/web/src/app/api/webhooks/stripe/route.ts` · `apps/web/src/components/checkout-flow.tsx` | Stripe-managed; our side stateless except webhook TX | **SAQ-A**: card data never touches our servers — `Payment Element` iframe (`https://js.stripe.com`), `confirmPayment` is `useStripe().confirmPayment` (React 19 + v6 binding, not module export). Tax via `TaxProvider` port (Stripe Tax). `createPaymentIntent` re-derives amount server-side (`computeCartTotals` over eligible promos — FR-508) and uses `idempotencyKey cart:${cartId}:${total}`. Webhook: verifies `Stripe-Signature` (300s window), `webhook_event.stripeEventId UNIQUE` inserted **inside** placement TX (audit H4d — outside TX the insert committed while placement transient-failed, turning Stripe retry into silent no-op with captured payment). `resolvePlacementOutcome()` (§8.7): captured payment whose re-verification fails goes to `review` with `ops.payment_orphan` job — never thrown away. Inventory `SELECT … FOR UPDATE`, order number `pg_advisory_xact_lock(hashtext('order_number:YYYY'))` + `MAX(split_part(number,'-',3))` (§7.9). |
| **Resend (Email)** | Resend 6.26 + `@react-email/components` 1.0 + `react-dom/server` (runtime) | `packages/email/src/send.ts:renderEmailHtml()` + `renderAndSend()` · `templates/order-confirmation.tsx` | Provider-managed; our side enqueues outbox rows in placement TX | `react-dom/server` is **never statically imported** in App Router graph (Turbopack build error) — resolved at runtime via `await import(/* turbopackIgnore: true */ "react-dom/server")` (`packages/email/src/send.ts:renderEmailHtml` — NFR-STACK-11). Templates are React components (`OrderConfirmation`, `ShipmentUpdate`). `Resend` constructed only when `RESEND_API_KEY` set; otherwise structured log transport (`[email:log] template=… to=sha1-style:…`). `EMAIL_FROM` quoted in `.env` (spaces/`<…>` — `start_server.sh:ensure_env` H1 fix). Outbox: `job` rows with `idempotencyKey order_confirmation:${orderId}` / `payment_orphan:${orderId}` inserted in placement TX; drained by `POST /api/jobs/run` gated with `CRON_SECRET` (`apps/web/src/app/api/jobs/run/route.ts`). |

> **Trust boundary:** `Origin`/`Referer` are attacker-controlled and never read for auth decisions. `x-forwarded-host`/`host`/`x-forwarded-proto` are the only headers `trusted-origins.ts` trusts because they are set by the proxy/CDN the platform controls — browsers never send `x-forwarded-host`, so a cross-site request cannot spoof the served origin (audit H-AUTH, PRD §9.4).

---

## 3. Application Architecture

### 3.1 The Layer Model — The Golden Rule

> **"Every request is classified by exactly one layer number before any code is written. If you cannot name the layer, you cannot write the code."** — PRD §4.1/§4.9, AGENTS.md Architecture invariants.

```
Request classification (authoritative order):
  L0 Proxy  →  L1 App/RSC  →  L2 Client Islands  →  L3 Domain/DB
  (edge)       (server)       (browser leaves)      (pure + pooled)
```

| # | Layer | One Sentence | Lives At | Runtime | What It Owns | Rule (enforced) |
|---|---|---|---|---|---|---|
| **0** | **Proxy** | Injects cross-cutting per-request concerns before routing. | `apps/web/src/proxy.ts:proxy()` · `apps/admin/src/proxy.ts:proxy()` · `packages/config/src/security-headers.ts:securityHeaders()` | **Node** (`proxy.ts` — `instrumentation.ts` excluded from proxy) | `securityHeaders()` on **every** response (incl. `/sign-in`), `x-request-id` (`crypto.randomUUID()`), origin derivation (`trusted-origins.ts:requestOriginFromHeaders`), admin UX redirect to `/sign-in?redirect=…`, deployment rewrites (`/admin` → `/`) | **MUST** live at `apps/*/src/proxy.ts` — Next 16.3 discovers only at the app-dir parent; repo-root placement compiles but never registers (audit H8d). `config.matcher` **MUST** be an **inline literal** — Next statically parses the export; imported constants silently produce an open matcher (semantics pinned by `apps/web/src/lib/proxy-matcher.test.ts` — H-1: bare `products` token stripped headers from every PDP). Security headers come from the single manifest in `@scandihaven/config/security-headers` — never inline literals in proxy. Admin gate never wraps `/sign-in` with auth (loop — H7d); `/admin/sign-in` passes via `isSignInPath()` (`apps/admin/src/lib/sign-in-paths.ts`). |
| **1** | **App / RSC** | Renders HTML on the server from domain queries; validates + delegates mutations. | `apps/web/src/app/**/{page,layout,loading,error,not-found}.tsx` · `apps/admin/src/app/**` · `apps/*/src/instrumentation.ts` · `apps/*/src/app/api/**` (handlers only) | **Node** (RSC) | Catalog/PDP/cart/account pages, admin `(staff)` surfaces, `metadata`/`generateMetadata`, error boundaries (`error.tsx`, `global-error.tsx` + `chunk-recovery.ts` stale-chunk self-heal E2E-1), instrumentation boot (`parseServerEnv` + `parseFlags` fail-fast on missing env / unknown `FEATURE_*`) | **Pages are `async`** — `params`, `searchParams`, `cookies()`, `headers()` are **awaited** (Next 16.3 — NFR-STACK-10). Page modules **export only** `default` (+ `metadata`/`generateMetadata`/`revalidate`/`dynamic`) — extra exports fail `next build`. Reads call `@scandihaven/commerce/*` query functions directly (no client `fetch`). Mutations go through **Server Actions** (`apps/*/src/actions/*`) returning `ActionResult<T>` (`packages/commerce/src/result.ts` — `ok`/`fail`, never throw). Route Handlers exist **only** for Stripe webhooks, Better-Auth, typeahead search, jobs runner, health — **no REST for UI mutations**. Errors at page level are `console.error`-logged, never `catch(() => null)`-swallowed. |
| **2** | **Client Islands** | The only code that runs in the browser — and only for what cannot be server-rendered. | `"use client"` leaves: `apps/web/src/components/cart-drawer.tsx` · `cart-trigger.tsx` · `cart-view.tsx` · `product-buy-panel.tsx` · `mobile-nav.tsx` · `newsletter-form.tsx` · `checkout-flow.tsx` + `apps/web/src/stores/cart-store.ts` | **Browser** (hydrated islands) | Cart drawer open/close, announcement dismissal (FR-108), wishlist/gallery UI, `useOptimistic` quantity stepper, `checkout-flow.tsx` Payment Element confirm, `mobile-nav` ARIA drawer | **Zustand holds drawer/UI only** — no server data is cached client-side. **RSC props are truth**: `CartDto`/catalog rows flow down as props; islands never re-fetch them. **Optimism is local**: `useOptimistic` + rollback to server truth on `ActionResult.fail`. `disable` buttons during async, `onError` with user feedback. No view-layer decision beyond minimal islands. |
| **3** | **Domain / DB** | Pure commerce math + pooled data access — the only layer that touches the database. | `packages/commerce/src/*` · `packages/db/src/client.ts` · `packages/db/src/schema/*` · `packages/auth/src/*` · `packages/email/src/*` | **Node** — compiled via `transpilePackages` (no package build) | `money.ts` integers, `pricing.ts` largest-remainder BigInt, `promotions.ts` eligibility + `filterEligiblePromotions` per-read re-validation (E2E-3), `order-state.ts:transition()` only writer, `cart-service.ts` token→UUID seam, `checkout-service.ts` placement TX, `rate-limit.ts` PG window, `jobs.ts` outbox, `search-provider.ts` FTS, `rich-text.ts` sanitization | **Money is integers** (`assertMinor` at every entry — floats never touch money). **State changes only through `transition()`** — `InvalidOrderTransition` on illegal moves. **Inventory** `SELECT … FOR UPDATE` + `qty_on_hand − qty_reserved − safety_stock`; made-to-order skips reservation. **Vendor SDKs confined to adapters** behind `providers.ts` ports (`Search/Tax/Shipping/Email/JobRunner`); never leak into pages/actions. **No `any`** — `unknown` + narrow. **Pool on `globalThis`** (`packages/db/src/client.ts:globalForDb`) — lazy Proxy so `next build` succeeds without `DATABASE_URL`; `ensureSeeded()` advisory-lock + natural-key upsert. `verbatimModuleSyntax` + `noUncheckedIndexedAccess` enforced. |

**Read this before touching code:**

* A bug in a header is an **L0** bug — fix it in `security-headers.ts` + both proxies, verify with `curl -I localhost:3000/sign-in | grep -i csp` (H5d).
* A page that reads data wrong is an **L1** bug — fix the RSC query, not an L2 island.
* A drawer that flashes stale totals is an **L2** bug — you cached server truth client-side.
* A money drift, a promotion that survives below-threshold, or a lost webhook is an **L3** bug — the pure function or TX is wrong; fix it there and property-test it.

---

### 3.2 Annotated Directory Structure — The Physical Map

```
scandihaven/                         ← Monorepo root (pnpm 10.15.0 + Turborepo 2.10, Node ≥22)
├── apps/
│   ├── web/                         ← Storefront :3000 — App Router RSC (Next.js 16.3, Turbopack)  [PRD §4.1, §13.2]
│   │   ├── src/
│   │   │   ├── proxy.ts             ← L0 — Node proxy: securityHeaders() on every response + x-request-id + origin trust  [§9.3, audit H8d/H5d]
│   │   │   ├── instrumentation.ts   ← Boot validation: parseServerEnv() + parseFlags() — fails fast on missing/unknown env  [PRD §9.4, NFR-STACK-11]
│   │   │   ├── app/                 ← L1 — App Router (every route is an RSC unless marked "use client")
│   │   │   │   ├── layout.tsx       ← Root layout: next/font Fraunces/Inter, tokens.css import, header/footer chrome
│   │   │   │   ├── globals.css      ← Tailwind v4 — @import "tailwindcss" + @import "@scandihaven/ui/tokens.css" + @source for workspace packages  [§8, AGENTS.md]
│   │   │   │   ├── global-error.tsx ← Stale-chunk self-heal (E2E-1): ChunkLoadError → sessionStorage guard → one hard reload via @scandihaven/config/chunk-recovery
│   │   │   │   ├── error.tsx        ← Route error boundary — logs (never catch(()=>null) without console.error)
│   │   │   │   ├── not-found.tsx    ← 404 shell
│   │   │   │   ├── page.tsx         ← Home — editorial hero + featured collections/products (RSC reads commerce/catalog)
│   │   │   │   ├── [slug]/page.tsx  ← CMS catch-all (journal/lookbooks — content.ts driven)
│   │   │   │   ├── shop/
│   │   │   │   │   ├── page.tsx     ← PLP hub (RSC)
│   │   │   │   │   └── [category]/page.tsx ← Category PLP — sort/pagination, RSC query via commerce/catalog  [FR-200s]
│   │   │   │   ├── products/
│   │   │   │   │   └── [slug]/page.tsx ← PDP — variant swatches, lead-time badges, price from default variant (E2E-4), media gallery island
│   │   │   │   ├── collections/
│   │   │   │   │   ├── page.tsx     ← Collections index (RSC)
│   │   │   │   │   └── [slug]/page.tsx ← Collection detail (RSC)
│   │   │   │   ├── journal/page.tsx ← Journal index (content/journal table)
│   │   │   │   ├── lookbooks/[[...slug]]/page.tsx ← Lookbook catch-all (content-driven)  [PRD §6.2]
│   │   │   │   ├── cart/page.tsx    ← Cart page — RSC renders CartDto (getCartDto), quantity stepper island
│   │   │   │   ├── checkout/
│   │   │   │   │   ├── page.tsx     ← Checkout — RSC totals + Payment Element island (checkout-flow.tsx, SAQ-A)
│   │   │   │   │   └── success/page.tsx ← Post-payment confirmation (webhook-driven, idempotent)
│   │   │   │   ├── account/page.tsx ← Account — authenticated RSC (Better-Auth session, DB-backed)
│   │   │   │   ├── sign-in/
│   │   │   │   │   ├── page.tsx     ← Sign-in — RSC wrapper, no gate
│   │   │   │   │   └── sign-in-form.tsx ← Client island: form → Server Action, validateRedirectPath guard
│   │   │   │   └── api/             ← L1 Route Handlers — ONLY for non-Action boundaries  [NFR-STACK-9]
│   │   │   │       ├── auth/[...all]/route.ts ← Better-Auth handler (email/pass + magic-link + OAuth seams)
│   │   │   │       ├── webhooks/stripe/route.ts ← Stripe webhook — signature (300s) → placeOrderFromWebhook() TX  [§4.3, §8.7, H4d]
│   │   │   │       ├── search/typeahead/route.ts ← Typeahead — Zod {slug,title}, 60/min/IP via rate-limit.ts  [FR-104]
│   │   │   │       ├── jobs/run/route.ts ← Outbox drainer — CRON_SECRET gated, idempotencyKey deduped  [§8.6]
│   │   │   │       └── health/route.ts  ← Health — {status, db, version}; start_server.sh probes this + CSP gate  [§11]
│   │   │   ├── components/          ← L2 islands + L1 server components
│   │   │   │   ├── site-header.tsx  ← Server chrome (RSC) — reads cart count, renders CartTrigger island
│   │   │   │   ├── site-footer.tsx  ← Server chrome — newsletter form island
│   │   │   │   ├── cart-drawer.tsx  ← L2 island — useCartStore drawer visibility; RSC CartDto props are truth  [cart-session seam]
│   │   │   │   ├── cart-trigger.tsx ← L2 island — header cart count + open drawer
│   │   │   │   ├── cart-view.tsx    ← L2 island — line list + quantity-stepper island, useOptimistic + rollback
│   │   │   │   ├── product-buy-panel.tsx ← L2 island — variant selection + addLine Server Action
│   │   │   │   ├── checkout-flow.tsx← L2 island — Stripe Payment Element, useStripe().confirmPayment (React 19+v6)
│   │   │   │   ├── mobile-nav.tsx   ← L2 island — Radix drawer, FR-102, aria-correct, L2 motion tokens
│   │   │   │   ├── newsletter-form.tsx ← L2 island — Server Action newsletter.ts, 3/hour/IP gate
│   │   │   │   └── stars-rating.tsx ← Presentational — typed stars from review aggregates
│   │   │   ├── actions/             ← L1 mutations — Server Actions returning ActionResult<T>  [PRD §8]
│   │   │   │   ├── cart.ts          ← Cart actions: add/update/remove lines, applyPromotionByCode → ActionResult; revalidateTag
│   │   │   │   ├── cart.test.ts     ← Pins H1-CART invariant: requireCart() returns getCartId() UUID untouched (never into ensureCart(token))
│   │   │   │   ├── checkout.ts      ← Intent actions: createPaymentIntent → client_secret; validateRedirectPath
│   │   │   │   └── newsletter.ts    ← Newsletter — Zod email + 3/hour/IP rate-limit gate → ActionResult  [FR-600s]
│   │   │   ├── stores/
│   │   │   │   └── cart-store.ts    ← L2 — Zustand: drawerOpen + lastError only; no server data (RSC is truth)  [§10.4]
│   │   │   ├── lib/
│   │   │   │   ├── cart-session.ts  ← Token→UUID seam: getCartId() verifies HMAC then resolves token→id via DB  [FR-403, H1-CART]
│   │   │   │   ├── proxy-matcher.ts ← Pure matcher semantics for proxy config (tested)  [audit H-1]
│   │   │   │   ├── proxy-matcher.test.ts ← Pins: bare "products" must not strip headers from PDPs
│   │   │   │   ├── format.ts        ← Minor-unit formatters (Intl per locale)
│   │   │   │   └── format.test.ts   ← Formatter units
│   │   │   └── e2e/
│   │   │       └── cart-flows.spec.ts ← Playwright — add→qty→promo→checkout flows; Neptune assertion scoping (E2E-2)
│   │   ├── next.config.ts           ← transpilePackages: [@scandihaven/*]; image optimizer; typed routes  [ADR-007, NFR-STACK-6]
│   │   ├── eslint.config.mjs        ← Flat config — imports @scandihaven/config/eslint/library factory  [NFR-STACK-11]
│   │   └── public/products/         ← Static SVG placeholders (placeholders) — no runtime dependency
│   │
│   └── admin/                       ← Back-office :3001 — RBAC-gated (staff) layout  [PRD §6.3, §9.2]
│       ├── src/
│       │   ├── proxy.ts             ← L0 — unauthenticated bounce to /sign-in?redirect=… + securityHeaders() on every response incl. /sign-in; /admin prefix allowed via isSignInPath  [§9.2, §9.3, H7d/H5d/H2]
│       │   ├── instrumentation.ts   ← Boot: parseServerEnv() + parseFlags() fail-fast  [PRD §9.4]
│       │   ├── next-config.test.ts  ← Verifies beforeFiles rewrites strip /admin prefix correctly
│       │   ├── guard.test.ts        ← Pins admin-guard requirePermission() + audit_log locus
│       │   ├── app/
│       │   │   ├── layout.tsx       ← Root layout — tokens.css + fonts (mirrors storefront)
│       │   │   ├── globals.css      ← Tailwind v4 @source workspace packages (same discipline as web)
│       │   │   ├── global-error.tsx ← Stale-chunk self-heal (shared chunk-recovery — E2E-1)
│       │   │   ├── sign-in/
│       │   │   │   ├── page.tsx     ← Sign-in — outside (staff) group so gate does not loop  [audit H7d]
│       │   │   │   └── sign-in-form.tsx ← Client island — validateRedirectPath before router.push (open-redirect fix)
│       │   │   ├── api/
│       │   │   │   ├── auth/[...all]/route.ts ← Better-Auth handler (shares packages/auth server)
│       │   │   │   └── health/route.ts ← Health — probed by start_server.sh :3001 gate
│       │   │   └── (staff)/           ← RBAC layout group — every route inside is gated
│       │   │       ├── layout.tsx     ← Gate: read Better-Auth session; unauth → /sign-in; RLS by RBAC matrix
│       │   │       ├── page.tsx       ← Dashboard — KPIs (order_analytics view)
│       │   │       ├── products/
│       │   │       │   ├── page.tsx   ← Product index — Drizzle query + search, RSC  [FR-301]
│       │   │       │   └── [id]/
│       │   │       │       ├── page.tsx     ← Product detail (RSC)
│       │   │       │       └── edit-form.tsx← L2 island — Server Action product update → ActionResult  [FR-303]
│       │   │       ├── orders/
│       │   │       │   ├── page.tsx   ← Order index — status filters, RSC
│       │   │       │   └── [id]/
│       │   │       │       ├── page.tsx       ← Order detail — events + line snapshots
│       │   │       │       └── actions-form.tsx ← L2 island — transition() actions (cancel/ship/refund) → ActionResult
│       │   │       └── customers/page.tsx ← Customer index — user + order aggregates  [FR-600s]
│       │   ├── actions/
│       │   │   ├── products.ts      ← L1 mutations: product/variant upserts — requirePermission() + audit_log  [§8, RBAC]
│       │   │   └── orders.ts        ← L1 mutations: order transitions — requirePermission() + audit_log + transition() only writer
│       │   └── lib/
│       │       ├── admin-guard.ts   ← requirePermission(permission): throws → redirect; writes audit_log  [§9.2, rbac.ts]
│       │       ├── sign-in-paths.ts ← isSignInPath(): allows /sign-in + /admin/sign-in through gate  [H2-ADMIN]
│       │       ├── sign-in-paths.test.ts ← Pins prefixed sign-in pass-through
│       │       └── format.ts        ← Admin formatters (EUR, dates)
│       ├── next.config.ts           ← transpilePackages + beforeFiles rewrites: /admin → /  and /admin/:path* → /:path*  [H2-ADMIN, NFR-STACK-6]
│       └── eslint.config.mjs        ← Flat config — @scandihaven/config/eslint/library
│
├── packages/
│   ├── db/                          ← L3 — Drizzle source of truth, pooled client, migrations, seed  [PRD §7, ADR-001]
│   │   ├── drizzle.config.ts        ← Drizzle Kit config (schema → drizzle/*.sql)  [drizzle.config.ts:1]
│   │   ├── drizzle/
│   │   │   ├── 0000_large_sphinx.sql← Forward-only migration (generated by pnpm db:generate) — never hand-edited
│   │   │   └── meta/_journal.json   ← Migration journal (Kit-managed)
│   │   └── src/
│   │       ├── client.ts            ← Pooled Drizzle (globalThis singleton Pool + lazy Proxy so next build succeeds w/o DATABASE_URL)  [src/client.ts:1, audit C1]
│   │       ├── local-db.ts          ← Local-only guard: isLocalDatabaseUrl() — seed/migrate refuse non-local hosts  [PRD §11]
│   │       ├── index.ts             ← Barrel: re-exports client + schema
│   │       ├── schema/              ← Drizzle pgTable definitions (PRD §7 DDL — single source)  [§6]
│   │       │   ├── index.ts         ← Barrel: re-exports all schema tables
│   │       │   ├── enums.ts         ← PG enums (product_status, order_status, payment_status, review_status, movement_reason, media_kind)
│   │       │   ├── catalog.ts       ← category, product, product_variant, productImage, variantImage, variantPrice, warehouse, inventoryLevel, inventoryMovement, collection, review, …  [FR-100s–400s]
│   │       │   ├── orders.ts        ← order (SH-YYYY-XXXXXX), order_line, order_address, payment, order_event, webhook_event, job (outbox)
│   │       │   ├── customers.ts     ← customer extensions (trade, gift preferences — Phase 5 ready)
│   │       │   ├── content.ts       ← journal, lookbook, announcement, editorial media  [PRD §6.2]
│   │       │   ├── ops.ts           ← audit_log, webhook_event, job, rate_limit_hit, analytics_event
│   │       │   ├── auth.ts          ← Better-Auth tables (user, session, account, verification) + admin fields role/banned
│   │       │   └── custom.ts        ← citext, pgEnum shims
│   │       ├── scripts/
│   │       │   ├── migrate.ts       ← drizzle-kit migrate — forward-only, local hosts only
│   │       │   ├── seed.ts          ← Idempotent seed: advisory-lock + natural-key upserts (Halden, Øresund, …)
│   │       │   └── reset.ts         ← drop+recreate (DB_RESET=1) — local hosts only
│   │       └── seed/
│   │           └── ensure-seeded.ts ← ensureSeeded() — pg_advisory_xact_lock(hashtext('seed')) + upserts; called at boot/start_server.sh  [§7]
│   │
│   ├── auth/                        ← L3 — Better-Auth + RBAC (self-hosted, PII stays in PG)  [ADR-003, PRD §9]
│   │   └── src/
│   │       ├── server.ts            ← Better-Auth instance: Drizzle adapter (pg), admin plugin (role/banned), per-request trustedOrigins via requestOriginFromHeaders  [src/server.ts:1, H-AUTH]
│   │       ├── client.ts            ← Browser client (createAuthClient)
│   │       ├── rbac.ts              ← Typed RBAC matrix + can(permission) + requirePermission() + audit seam  [src/rbac.ts:1]
│   │       ├── trusted-origins.ts   ← Pure seam: requestOriginFromHeaders(headers) → scheme://host — reads only x-forwarded-host/host/x-forwarded-proto, never Origin/Referer  [src/trusted-origins.ts:1, H-AUTH]
│   │       ├── server-origin.test.ts← Pins BETTER_AUTH_URL localhost-pinning regression (audit H-AUTH)
│   │       └── trusted-origins.test.ts ← Pins x-forwarded-host precedence + loopback http fallback
│   │
│   ├── commerce/                    ← L3 — Pure domain (property-tested, vendor-free)  [PRD §4.8, §7]
│   │   └── src/
│   │       ├── money.ts             ← Integer minor-unit money: MoneyError, assertMinor, roundHalfUp, sumMinor, convertFromEur, formatMinor  [src/money.ts:1]
│   │       ├── pricing.ts           ← computeSubtotal, selectBestPromotion (capped at subtotal), resolveTierValue (highest qualifying), distributeDiscount (BigInt largest-remainder), computeCartTotals  [src/pricing.ts:1]
│   │       ├── promotions.ts        ← evaluatePromotion, filterEligiblePromotions (per-read re-validation — E2E-3), humanizePromotionRejection  [FR-800s]
│   │       ├── order-state.ts       ← transition(current, event) only writer; InvalidOrderTransition; TRANSITIONS + TERMINAL  [src/order-state.ts:1, PRD §7.7]
│   │       ├── cart-service.ts      ← CART_COOKIE sh_cart + HMAC (BETTER_AUTH_SECRET ≥32, timingSafeEqual), createCartToken/verifyCartToken, ensureCart(token→UUID), addLine/updateLineQty/removeLine (dedupe), getCartDto (re-validates promos), mergeGuestCartIntoUserCart  [src/cart-service.ts:1, ADR-003, H1-CART]
│   │       ├── checkout-service.ts  ← createPaymentIntent (server-side totals, idempotencyKey), placeOrderFromWebhook TX, resolvePlacementOutcome (confirm↔review)  [src/checkout-service.ts:1, §4.3/§8.7, H4d]
│   │       ├── jobs.ts              ← Outbox helpers — kind: email.order_confirmation / ops.payment_orphan  [§8.6]
│   │       ├── catalog.ts           ← RSC queries: product/category/collection reads, default-variant price CTE (E2E-4), pg_trgm FTS
│   │       ├── providers.ts         ← Port interfaces: SearchProvider / TaxProvider / ShippingRateProvider / EmailProvider / JobRunner  [PRD §4.8]
│   │       ├── search-provider.ts   ← SearchProvider impl — PG FTS + pg_trgm (60/min/IP at route), swap trigger >5k SKUs → Algolia/Meilisearch  [ADR-004, §4.8]
│   │       ├── rate-limit.ts        ← Postgres rate limiter — rate_limit_hit PK (bucket, window_start) upsert, consumeRateLimit() → 429 + Retry-After  [§9.4, ADR-005]
│   │       ├── request-dedupe.ts    ← Per-instance dedupe — createRequestDedupe(windowMs): checkAndReserve(key) → bool  [PRD §8.3, §8.6]
│   │       ├── rich-text.ts         ← sanitize-html gate — every dangerouslySetInnerHTML / JSON-LD passes here  [§9.3, audit 2026-09-09]
│   │       ├── result.ts            ← ActionResult<T> = {ok:true,data} | {ok:false,error,fieldErrors} — only Action boundary  [PRD §8, NFR-STACK-4]
│   │       └── dto.ts               ← CartDto / OrderDto / PromotionInput — typed across L1↔L3  [PRD §8]
│   │
│   ├── ui/                          ← Design system — Tailwind v4 + Radix, no commerce import  [PRD §10, ADR-007]
│   │   └── src/
│   │       ├── tokens.css           ← Single @theme source — palette (#faf7f2/#1f1b17/#c97b5e…), semantic shadcn literals (hex, not var() — var chains dropped by current Tailwind v4 build), radii (card 2px/image 0/pill 999px), motion (ease-brand cubic-bezier, durations)  [src/tokens.css:1, AGENTS.md]
│   │       ├── lib/cn.ts            ← cn(...classes): tailwind-merge + clsx — deterministic dedup
│   │       └── components/          ← Primitives + composites (Radix primitives themed via tokens.css + cn())
│   │           ├── button.tsx       ← Variant-driven (CVA) — never rebuilt per-app
│   │           ├── drawer.tsx       ← Radix drawer — mobile nav / cart drawer primitive  [FR-102]
│   │           ├── input.tsx        ← Form input primitive
│   │           ├── label.tsx        ← Accessible label
│   │           ├── badge.tsx        ← Status/lead-time badge primitive
│   │           ├── skeleton.tsx     ← Loading skeleton (never bare spinner — R1 empty/loading states)
│   │           ├── accordion.tsx    ← Radix accordion — editorial sections, motion via tokens
│   │           └── composites/      ← Domain-aware composites — structural prop types only (no @scandihaven/commerce import)
│   │               ├── product-card.tsx   ← Product card — image + title + price (default variant) + lead-time slot
│   │               ├── price-block.tsx    ← Price — minor-unit → Intl, sale/compareAt aware
│   │               ├── media-image.tsx    ← Image — @source-must-reach asset with blur + object storage presign
│   │               ├── lead-time-badge.tsx← Lead-time — lead_time_days_min/max → human window  [catalog.ts:109]
│   │               └── quantity-stepper.tsx ← Quantity — qty 1..99, accessible, used by cart island
│   │
│   ├── email/                       ← Transactional email — React templates + Resend (or log transport)  [PRD §4.5, FR-910]
│   │   └── src/
│   │       ├── send.ts              ← Resend adapter: renderEmailHtml() via runtime import("react-dom/server") with turbopackIgnore; renderAndSend() → SendResult  [src/send.ts:1, NFR-STACK-11]
│   │       └── templates/
│   │           ├── index.ts         ← Barrel — OrderConfirmation / ShipmentUpdate
│   │           ├── order-confirmation.tsx ← React Email — orderNumber + leadTime + totals (pure, previewable)
│   │           └── shipment-update.tsx    ← React Email — trackingUrl + carrier
│   │
│   └── config/                      ← Shared config — single validation dialect (Zod)  [NFR-STACK-4]
│       └── src/
│           ├── env.ts               ← parseServerEnv() — Zod schemas for every env var; unknown FEATURE_* fails fast  [PRD §9.4, NFR-STACK-4]
│           ├── flags.ts             ← parseFlags() — FEATURE_* feature flags → typed booleans; unknown flag fails fast  [PRD §4.8]
│           ├── security-headers.ts  ← securityHeaders(): HeaderMap — CSP allow-lists js.stripe.com + static.cloudflareinsights.com + hooks.stripe.com  [src/security-headers.ts:1, §9.3, E2E-7]
│           ├── redirect-path.ts     ← validateRedirectPath(path): string|null — never trust post-auth ?redirect= raw  [open-redirect fix]
│           ├── chunk-recovery.ts    ← Stale-chunk self-heal: isStaleChunkError/shouldHardReload/reloadOnStaleChunk (sessionStorage guard + cooldown 10s)  [src/chunk-recovery.ts:1, E2E-1]
│           ├── site-url.ts          ← metadataBase / NEXT_PUBLIC_SITE_URL validation — boot warns when fallback is localhost  [E2E-8]
│           └── eslint/library.mjs   ← ESLint flat factory — single rule source; apps re-export it  [NFR-STACK-11]
│           └── tsconfig/            ← Shared tsconfig bases (strict, verbatimModuleSyntax, noUncheckedIndexedAccess)
│
├── infrastructure/
│   └── postgres/
│       └── init/
│           └── 00-create-extensions.sql ← pgcrypto + pg_trgm idempotently (1st compose volume init)  [infrastructure/postgres/init/00-create-extensions.sql:1, §6]
│
├── docker-compose.yml               ← PG 17-alpine (service postgres → scandihaven_postgres, postgres_data, scandihaven_net, PGDATA, healthcheck pg_isready)  [docker-compose.yml:1]
├── turbo.json                       ← Task graph: build (dependsOn ^build, globalEnv DATABASE_URL…DISABLE_IMAGE_OPTIMIZER), dev/start non-cache persistent; stale lockfile rejected  [turbo.json:1, NFR-STACK-2/11]
├── tsconfig.base.json               ← Base TS: strict, verbatimModuleSyntax, noUncheckedIndexedAccess, isolatedModules  [AGENTS.md]
├── pnpm-workspace.yaml              ← Workspace: apps/* + packages/* — dir enforced, cycles break turbo graph silently
└── start_server.sh                  ← Fresh-clone → prod bootstrapper: ensure_env (quoted .env — H1 EMAIL_FROM) → docker compose up -d (pg_isready) → pnpm db:setup (migrate+seed, idempotent) → pnpm build → pnpm prod :3000 + prod:admin :3001 (kills prior :3000/:3001, health /api/health + CSP/admin gate checks), DB_RESET=1 for drop+recreate  [start_server.sh:1, README Quick Start]
```

> **How to read the annotations:** `←` names the layer (L0–L3) and the invariant. `[brackets]` cite the PRD clause, audit finding, or AGENTS.md rule that locks the placement — move the file and the rule must move with it.

---

### 3.3 Critical Code Patterns — Five Hardened Seams

> Each pattern is **copy-paste ready** as written. `// Why:` comments are load-bearing — they name the invariant that the surrounding code defends. Every pattern cites the **file:line** that is truth and the **audit/E2E slice** that proved the previous shape wrong.

#### (a) Cart Identity — Token→UUID Seam (H1-CART fix)

> **Why this exists:** A cart is keyed two ways: the **signed HMAC cookie token** (`sh_cart`) the browser holds and the **cart row UUID** (`cart.id`) commerce services key on. `ensureCart()` keys on the **token**; `getCartId()` resolves **token→UUID**. Feeding the resolved UUID back into `ensureCart()` mint ed a junk cart row whose `token` column was a UUID string — every qty change then hit `"Cart line not found"`, removed items reappeared on reload, and a second add-to-cart was lost (audit 2026-09-09 round 2, H1-CART — pinned by `apps/web/src/actions/cart.test.ts:1` + `apps/web/e2e/cart-flows.spec.ts`).

```ts
/**
 * Cart identity — token→UUID seam (apps/web/src/lib/cart-session.ts:1,
 * packages/commerce/src/cart-service.ts:1, AGENTS.md Cart identity convention).
 *
 * Canonical references:
 *   - Token signing/verification: packages/commerce/src/cart-service.ts:createCartToken, verifyCartToken
 *   - Token→UUID resolution:       apps/web/src/lib/cart-session.ts:getCartId
 *   - Token-keyed creation:        packages/commerce/src/cart-service.ts:ensureCart(token, userId?)
 */

/** @file packages/commerce/src/cart-service.ts — HMAC cart token (PRD FR-403) */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const CART_COOKIE = "sh_cart"; // ← cookie name is contractual (FR-403)

function cartSecret(): string {
  // Why: secret snapshotted at import would go stale on rotation; per-call read is truth.
  // Why: ≥32 chars — shorter secrets make HMAC forgeable; fail fast instead of minting weak cookies.
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error( // Why: never fall back to an insecure placeholder — every cart identity matters.
      "BETTER_AUTH_SECRET is missing or shorter than 32 chars — cart cookies cannot be signed safely. Generate one with `openssl rand -base64 32`.",
    );
  }
  return secret;
}

export const CART_COOKIE_NAME = CART_COOKIE;

/** Signed token: "<random>.<hmac>" — tamper-evident, 24 random bytes → 48-hex + 32-hex sig. */
export function createCartToken(): string {
  const value = randomBytes(24).toString("hex"); // Why: 192 bits of entropy — not a serial / not a UUID.
  const sig = createHmac("sha256", cartSecret()).update(value).digest("hex").slice(0, 32);
  return `${value}.${sig}`; // Why: token is the DB key (cart.token) — UUID is the row identity (cart.id).
}

export function verifyCartToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [value, sig] = token.split(".");
  if (!value || !sig) return null;
  const expected = createHmac("sha256", cartSecret()).update(value).digest("hex").slice(0, 32);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  // Why: timingSafeEqual — naive === leaks timing to a brute-force oracle.
  return a.length === b.length && timingSafeEqual(a, b) ? token : null; // Why: returns the TOKEN (not a derived value) — caller keeps the token for re-resolution.
}

/** Ensure the cart row keyed by TOKEN (not UUID) exists; attaches guest→user on first auth. */
export async function ensureCart(token: string, userId?: string | null): Promise<string> {
  // Why: WHERE cart.token = :token — never cart.id here; that column holds a different universe.
  const existing = await db.select().from(cart).where(eq(cart.token, token)).limit(1);
  if (existing[0]) {
    if (userId && !existing[0].userId) {
      await db.update(cart).set({ userId, updatedAt: new Date() }).where(eq(cart.id, existing[0].id));
    }
    return existing[0].id; // Why: return the UUID — callers pass this UUID to cart-service methods, never back into ensureCart.
  }
  const created = await db.insert(cart).values({ token, userId: userId ?? null, region: "EU", currency: "EUR" }).returning({ id: cart.id });
  return created[0]!.id;
}

/** @file apps/web/src/lib/cart-session.ts — token→UUID resolution (FR-403) */
import { cookies } from "next/headers";

/**
 * Resolve the verified TOKEN to the cart row's UUID.
 * Every Server Action that touches a cart calls THIS — never cookies() directly.
 */
export async function getCartId(): Promise<string | null> {
  const store = await cookies(); // Why: await — cookies() is async in Next 16.3 (params/cookies/headers/searchParams all are).
  const token = verifyCartToken(store.get(CART_COOKIE_NAME)?.value); // Why: verify HMAC first — DB lookup only on a structurally valid token.
  if (!token) return null;
  const rows = await db.select({ id: cart.id }).from(cart).where(eq(cart.token, token)).limit(1);
  return rows[0]?.id ?? null; // Why: returns UUID — the caller must NEVER feed this into ensureCart().
}

/** @file apps/web/src/actions/cart.ts — the H1-CART invariant (audited) */
import { getCartId } from "@/lib/cart-session"; // Why: token→UUID resolver
import { addLine as addCommerceLine } from "@scandihaven/commerce/cart-service";

// CORRECT — UUID is used directly, never re-wrapped as a token:
export async function requireCart(): Promise<string> {
  const cartId = await getCartId(); // Why: already a UUID (cart.id) — this is the commerce key.
  if (!cartId) throw new Error("Cart not found");
  return cartId; // Why: returned untouched — caller passes it to addCommerceLine/updateLineQty/removeLine.
}

// WRONG (the bug that H1-CART fixed — never do this):
// const cartId = await getCartId();
// return ensureCart(cartId); // BUG: cartId is a UUID; ensureCart WHEREs on cart.token → misses → inserts junk row
```

**Why this pattern:**
* Imports and per-call secret read make rotation safe and length-enforcement inescapable — there is no path that mints a cart with a short secret.
* `timingSafeEqual` closes the timing oracle the naive `===` opened. `verifyCartToken` returns the **token** (not the `value` or a boolean) so the caller's DB lookup (`WHERE cart.token = :token`) is exact.
* The seam discipline — **token-keyed `ensureCart`, UUID-keyed commerce, `getCartId()` bridges them** — is named explicitly at every call site. The regression (`getCartId()`'s UUID into `ensureCart`) is now a pinned test (`apps/web/src/actions/cart.test.ts` + E2E `cart-flows.spec.ts`): any reintroduction breaks CI before it reaches prod. Symptom of regression: `"Cart line not found"` on qty change, removed lines that resurrect on reload, second add-to-cart lost.

---

#### (b) Checkout Re-verification + Placement Transaction (§8.7, H4d — never lose a captured payment)

> **Why this exists:** The client **does not decide the payable amount** (FR-508). The server re-derives totals inside the webhook placement transaction, compares `totals.total vs Stripe intent.amount`, locks inventory, and either confirms the order (decrement stock, convert cart, emit confirmation outbox) or holds it in `review` with a `payment_orphan` alert. Throwing on `AMOUNT_MISMATCH` would commit the already-inserted `webhook_event` row while aborting the order — Stripe's retry would see `UNIQUE(stripeEventId)` and no-op, silently losing the captured payment (audit 2026-09-09 H4d). `resolvePlacementOutcome()` is the pure seam that makes this decision testable without a DB (`packages/commerce/src/checkout-service.ts:resolvePlacementOutcome`, `placement-outcome.test.ts`, `offers:positive`).

```ts
/**
 * Checkout re-verification + placement TX
 * (packages/commerce/src/checkout-service.ts:resolvePlacementOutcome, placeOrderFromWebhook,
 *  apps/web/src/app/api/webhooks/stripe/route.ts:POST)
 *
 * Copies from: packages/commerce/src/checkout-service.ts — pure seam + transactional placement
 * Tested by:   packages/commerce/src/placement-outcome.test.ts
 * Audit:       2026-09-09 H4d (webhook_event UNIQUE outside TX) + live E2E-3 (promo re-validation)
 */

// ── Pure decision — no DB, no Stripe, fully unit-testable ──────────────────
export type PlacementOutcome =
  | { path: "confirm" }
  | { path: "review"; reason: "AMOUNT_MISMATCH" | "OUT_OF_STOCK"; detail: string };

/**
 * §8.7 decision (pure): a captured payment whose re-verification fails must
 * NEVER be thrown away — the webhook_event row would already be committed
 * and the retry would no-op, silently losing the paid order. Instead the
 * order goes to `review` for CS with a payment_orphan alert.
 */
export function resolvePlacementOutcome(input: {
  totalsTotal: number;   // Why: server-derived (computeCartTotals over eligible promos + shipping + tax)
  intentAmount: number;  // Why: what Stripe actually captured (intent.amount)
  stockShortages: string[]; // Why: collected WITHOUT throwing — made-to-order rows have no inventory_level
}): PlacementOutcome {
  if (input.totalsTotal !== input.intentAmount) { // Why: integers (minor units) — exact equality, never float tolerance.
    return { path: "review", reason: "AMOUNT_MISMATCH", detail: `cart ${input.totalsTotal} vs Stripe ${input.intentAmount}` };
  }
  if (input.stockShortages.length > 0) {
    return { path: "review", reason: "OUT_OF_STOCK", detail: input.stockShortages.join(", ") };
  }
  return { path: "confirm" };
}

// ── Transactional placement — single db.transaction(async (tx) => {…}) ──────
export async function placeOrderFromWebhook(input: {
  stripeEventId: string; type: string; payloadJson: unknown; paymentIntentId: string;
}): Promise<{ orderId: string; orderNumber: string; review?: boolean } | null> {

  const stripe = getStripe(); // Why: lazy Stripe client (STRIPE_SECRET_KEY gated) — null path throws CheckoutError(STRIPE_NOT_CONFIGURED).
  const intent = await stripe.paymentIntents.retrieve(input.paymentIntentId); // Why: retrieve AFTER entering? cartId can also resolve from PI metadata when payment row races the webhook.

  return db.transaction(async (tx) => {
    // 1) Idempotency — INSERT inside the same TX that will place the order.
    // Why: outside TX it auto-commits; a transient failure after that insert but before placement commit
    //     left a committed webhook_event whose UNIQUE blocked Stripe's retry forever — payment was captured, order lost (H4d).
    const insertedEvent = await tx.insert(webhookEvent).values({
      stripeEventId: input.stripeEventId, type: input.type, payload: input.payloadJson,
    }).onConflictDoNothing().returning({ id: webhookEvent.id });
    if (!insertedEvent[0]) return null; // Why: duplicate event → 200 OK no-op (Stripe retries once per event).

    // 2) Lock cart + read lines (+ prices) FOR UPDATE.
    const cartRows = await tx.select().from(cart).where(eq(cart.id, cartId)).limit(1).for("update");
    const cartRow = cartRows[0]!;

    // 3) Re-derive totals with ELIGIBLE promotions (same filter as intent creation).
    // Why: selectable promos vs attached-but-ineligible decoy (E2E-3). Both sides call
    //     loadCartPromotionApplications → filterEligiblePromotions on the SAME CartPromotionContext (subtotal/region/categoryIds).
    // Why: promo conditions are per-read (getCartDto + loadCartPromotionApplications both filter) — a code applied above minSpend
    //     stops discounting once mutations drop below it; the cart_promotion row stays so re-crossing re-applies.
    const categoryIds = await resolveCategoryIdsForVariants(tx, lineRows.map(r => r.line.variantId)); // Why: tx client — same TX snapshot.
    const promotions = await loadCartPromotionApplications(tx, cartId, {
      subtotalMinor: priceLines.reduce((a, l) => a + l.unitPriceMinor * l.qty, 0),
      region: cartRow.region, now: new Date(),
      productIds: lineRows.map(r => r.line.variantId), categoryIds, isGuest: cartRow.userId === null,
    });
    const totals = computeCartTotals({ lines: priceLines, promotions, shippingMinor: 0 });

    // 4) Lock inventory rows + collect shortages (never throw on shortage).
    const stockShortages: string[] = [];
    for (const row of lineRows) {
      const locked = await tx.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, row.line.variantId)).for("update");
      const level = locked[0];
      if (!level) continue; // Why: made-to-order variants have no inventory_level — always purchasable.
      if (row.line.qty > level.qtyOnHand - level.qtyReserved - level.safetyStock) stockShortages.push(`SKU ${row.variant.sku}`);
    }

    // 5) Pure decision — no throw.
    const outcome = resolvePlacementOutcome({ totalsTotal: totals.total, intentAmount: intent.amount, stockShortages });

    // 6) Serialize per-year order number (unique violation would abort AFTER payment captured).
    const year = new Date().getUTCFullYear();
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`order_number:${year}`}))`); // Why: advisory lock — per-year, xact-scoped, no row to lock yet.
    const seqRows = await tx.execute<{ seq: string }>(
      // Why: split_part(number,'-',3) — substring(10) dropped the leading digit at seq ≥ 100 000; under the advisory lock that would collide on order.number UNIQUE (audit M2d).
      sql`SELECT COALESCE(MAX((split_part(number, '-', 3))::int), 0) + 1 AS seq FROM "order" WHERE number LIKE ${`SH-${year}-%`}`,
    );
    const seq = Number(seqRows.rows[0]?.seq ?? 1);
    const orderNumber = `SH-${year}-${String(seq).padStart(6, "0")}`;

    // 7) Create order + lines + payment (amount = Stripe capture, not server total — gap is what CS reconciles).
    // … inserts … (see full function at checkout-service.ts:placeOrderFromWebhook)

    if (outcome.path === "confirm") {
      await tx.update(order).set({ status: transition("pending_payment", "payment_succeeded"), updatedAt: placedAt }).where(eq(order.id, orderId));
      // Why: decrement stock ONLY on confirm path — a review order must not consume stock CS may have to refund.
      for (const row of lineRows) { /* inventoryMovement delta:-qty, reason:sale, referenceType:order */ }
      await tx.insert(analyticsEvent).values({ name: "order_completed", payload: { revenueMinor: totals.total, /* … */ } }); // Why: revenue only on confirm — review orders would pollute dashboards.
      await tx.insert(job).values({ kind: "email.order_confirmation", payload: { orderId, to: email, /* self-sufficient snapshot */ }, idempotencyKey: `order_confirmation:${orderId}` }).onConflictDoNothing();
    } else {
      await tx.update(order).set({ status: transition("pending_payment", "flag_for_review"), updatedAt: placedAt }).where(eq(order.id, orderId));
      await tx.insert(job).values({ kind: "ops.payment_orphan", payload: { orderId, paymentIntentId: input.paymentIntentId, reason: outcome.reason, detail: outcome.detail, chargedMinor: intent.amount, serverTotalMinor: totals.total }, idempotencyKey: `payment_orphan:${orderId}` }).onConflictDoNothing();
      // Why: no stock decrement, no confirmation email, no analytics — CS reconciles chargedMinor vs serverTotalMinor first.
    }

    await tx.update(cart).set({ status: "converted", updatedAt: placedAt }).where(eq(cart.id, cartRow.id)); // Why: convert in BOTH paths — re-checkout would double-charge for goods CS is reconciling.

    return { orderId, orderNumber, review: outcome.path === "review" };
  });
}
```

**Why this pattern:**
* `resolvePlacementOutcome` is pure — no DB, no Stripe — so the §8.7 rule ("never roll back a captured payment when re-verification fails") is unit-tested (`placement-outcome.test.ts`) rather than observed only in prod Stripe retries.
* `webhook_event` insert is **inside** `db.transaction` — a single atomic `INSERT … ON CONFLICT DO NOTHING` followed by all placement writes. The previous shape (insert then separate TX) created the only silent-loss path money can take: committed dedup row + absent order. Stripe's exactly-once retry per event id then masked the failure as success.
* Amount re-verification is integers (minor units) — exact equality, no float tolerance. Promotions are the same filtered set on both sides of the Stripe boundary (intent creation + placement), including `categoryIds` resolved inside the TX snapshot — a mismatch that would have rejected every discounted order before R1.
* Order numbers are per-year advisory-locked — `MAX+1` under the lock, `SH-YYYY-XXXXXX`, no `UNIQUE` violation path that would abort after payment capture. The `split_part` form is immune to digit-width growth that the old `substring(10)` had at 100k orders/year.

---

#### (c) Pricing — Largest-Remainder BigInt (ADR-001 / PRD §7.2, property-tested)

> **Why this exists:** Money is integers (minor units) everywhere (`packages/commerce/src/money.ts:assertMinor`). Floating division can drift by one ulp and silently invent or lose a cent — spread across a 50-line cart the invariant `sum(lineDiscounts) === discount` fails and the ledger no longer balances. The fix is exact rational arithmetic on `BigInt` with largest-remainder residual distribution, capped at `subtotal`, with `selectBestPromotion` refusing to crown a promotion higher than the value it could actually deliver (FR-810 cap).

```ts
/**
 * Pricing — largest-remainder discount distribution
 * (packages/commerce/src/pricing.ts:distributeDiscount, selectBestPromotion, resolveTierValue,
 *  packages/commerce/src/money.ts:assertMinor, roundHalfUp, sumMinor
 *  Tests:  packages/commerce/src/pricing.test.ts — fast-check: fc.assert(fc.property(...)))
 *
 * Copies from: packages/commerce/src/pricing.ts + money.ts — pure, property-tested (§12.5)
 * Coverage:    commerce pure domain modules gated 90% lines / 85% functions (pnpm test)
 */

// ── Integer guard — every money entry point asserts SafeInteger ─────────────
export class MoneyError extends Error {}
export function assertMinor(value: number, label = "amount"): number {
  if (!Number.isSafeInteger(value)) throw new MoneyError(`${label} must be a safe integer, got ${value}`);
  return value;
}

export type PriceLine = { id: string; qty: number; unitPriceMinor: number; discountable: boolean };
export type PromotionApplication = {
  promotionId: string; kind: "fixed" | "percent" | "free_shipping" | "bogo" | "tiered";
  value: number; // minor units for fixed; basis points (1/100 %) for percent
  tiers?: readonly { minSpendMinor: number; discountMinor: number }[] | null;
};

/** Best qualifying tier: highest threshold that subtotal clears (FR-810). Null ≠ zero. */
export function resolveTierValue(
  tiers: readonly { minSpendMinor: number; discountMinor: number }[] | null | undefined,
  subtotal: number,
): number | null {
  if (!tiers || tiers.length === 0) return null;
  const qualifying = tiers.filter(t => subtotal >= t.minSpendMinor).sort((a, b) => b.minSpendMinor - a.minSpendMinor);
  return qualifying[0]?.discountMinor ?? null; // Why: null means "no tier qualified" — distinct from discount 0 (free tier / zero tier).
}

/** Single winner — v1 promos do not stack (PRD FR-810). Percent is capped at subtotal so >100% bp can never win by phantom value. */
export function selectBestPromotion(promotions: readonly PromotionApplication[], subtotal: number): PromotionApplication | null {
  let best: PromotionApplication | null = null, bestValue = 0;
  for (const p of promotions) {
    let candidate = 0;
    switch (p.kind) {
      case "fixed":   candidate = Math.min(p.value, subtotal); break; // Why: cap — discount can never exceed goods value.
      case "percent": candidate = Math.min(roundHalfUp((subtotal * p.value) / 10_000), subtotal); break; // Why: bp math + cap; roundHalfUp is deterministic commerce rounding.
      case "tiered":  candidate = Math.min(resolveTierValue(p.tiers, subtotal) ?? 0, subtotal); break;
      case "free_shipping": case "bogo": candidate = 0; break; // Why: value depends on shipping/quantity — handled by caller (computeCartTotals).
    }
    if (candidate > bestValue) { best = p; bestValue = candidate; }
  }
  return best;
}

/**
 * Distribute `discount` across discountable lines proportional to line value
 * — largest-remainder method; exact BigInt floors + deterministic residual walk.
 * Sum(lineDiscounts) === capped discount exactly (no float, no drift).
 */
export function distributeDiscount(
  lines: readonly PriceLine[], discount: number,
): { lineDiscounts: Record<string, number>; lineTotals: Record<string, number> } {
  assertMinor(discount, "discount"); // Why: integers only — floats never enter the distribution.
  const discountable = lines.filter(l => l.discountable && l.qty > 0);
  const base = discountable.map(l => ({ id: l.id, value: l.unitPriceMinor * l.qty })); // Why: line value = qty × unit — computeLineSubtotal asserts range 0..99.
  const totalValue = base.reduce((a, b) => a + b.value, 0); // Why: sumMinor would assert too — total of discountable base.

  const lineDiscounts: Record<string, number> = {};
  const lineTotals: Record<string, number> = {};
  for (const l of lines) lineDiscounts[l.id] = 0;
  if (totalValue === 0 || discount === 0) { // Why: fast path — no base means no distribution; no throw.
    for (const l of lines) lineTotals[l.id] = l.unitPriceMinor * l.qty;
    return { lineDiscounts, lineTotals };
  }

  const capped = Math.min(discount, totalValue); // Why: cap — discount can never exceed discountable goods.
  const cappedBig = BigInt(capped), totalBig = BigInt(totalValue);
  let allocated = 0;
  const remainders: Array<{ id: string; remainder: bigint }> = [];

  for (const e of base) {
    const scaled = cappedBig * BigInt(e.value); // Why: BigInt — scaled is exact; float division at this magnitude drifts by ulps.
    const floor = scaled / totalBig;          // Why: Euclidean floor — exact, no rounding.
    allocated += Number(floor);
    lineDiscounts[e.id] = Number(floor);
    remainders.push({ id: e.id, remainder: scaled % totalBig }); // Why: remainder is the ordering key for the leftover cents.
  }

  let residual = capped - allocated; // Why: 0 ≤ residual < discountable line count — by construction of floors.
  // Why: largest remainder first — and by remainder desc exclusively (no secondary id sort is needed for the
  // Why: for the largest-remainder bound; determinism comes from stable line order for ties).
  remainders.sort((a, b) => (b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : 0));
  for (const e of remainders) {
    if (residual <= 0) break;
    lineDiscounts[e.id] = (lineDiscounts[e.id] ?? 0) + 1;
    residual -= 1;
  }
  if (residual !== 0) throw new MoneyError(`discount distribution lost ${residual} cents`); // Why: unreachable by arithmetic — guards against future refactor drift.

  for (const l of lines) lineTotals[l.id] = l.unitPriceMinor * l.qty - (lineDiscounts[l.id] ?? 0);
  return { lineDiscounts, lineTotals };
}

/** Cart totals — the only place totals are derived; pure and testable. */
export function computeCartTotals(input: { lines: readonly PriceLine[]; promotions: readonly PromotionApplication[]; shippingMinor: number; taxMinor?: number }) {
  const seen = new Set<string>();
  for (const l of input.lines) if (seen.has(l.id)) throw new Error(`duplicate line id "${l.id}"`); else seen.add(l.id); // Why: ids are record keys — duplicates collapse allocations silently.
  const subtotal = input.lines.reduce((a, l) => a + l.unitPriceMinor * l.qty, 0);
  const best = selectBestPromotion(input.promotions, subtotal);
  const rawDiscount = best
    ? best.kind === "fixed" ? Math.min(best.value, subtotal)
    : best.kind === "percent" ? roundHalfUp((subtotal * best.value) / 10_000)
    : best.kind === "tiered" ? (resolveTierValue(best.tiers, subtotal) ?? 0)
    : 0
    : 0;
  const { lineDiscounts, lineTotals } = distributeDiscount(input.lines, rawDiscount);
  const discount = Object.values(lineDiscounts).reduce((a, v) => a + v, 0); // Why: authoritative sum — not rawDiscount — so callers never see a gap.
  const shipping = best?.kind === "free_shipping" ? 0 : assertMinor(input.shippingMinor, "shippingMinor");
  const tax = assertMinor(input.taxMinor ?? 0, "taxMinor"); // Why: 0 when EU VAT-inclusive display; server-computed at checkout.
  const total = assertMinor(Object.values(lineTotals).reduce((a, v) => a + v, 0) + shipping + tax, "total");
  return { subtotal, discount, shipping, tax, total, lineDiscounts, lineTotals };
}
```

**Why this pattern:**
* **No floats touch money.** `assertMinor` at every entry — including `shippingMinor`/`taxMinor`/`discount` — means a float that slips through throws before it can be distributed. The BigInt `scaled / total` floors are exact; the float `discount * (lineValue / total)` the previous shape used drifted by one ulp on at least one `fast-check`-generated cart and produced a gap.
* **Largest-remainder is the only correct integer distribution** for `sum(floors) + residual === discount` without arbitrary bias toward the first line. The residual walk (`largest remainder → +1`) is deterministic: `remainder desc`, then stable order for ties — every call with the same inputs yields the same per-line discounts, so the cart page and the webhook price identically.
* **Capping at subtotal** is applied in **two places**: `selectBestPromotion` (so a 200 % percent off promotion never wins the selection by its uncapped phantom value) and `distributeDiscount` (so no distribution is asked to hand out more than the base is worth). Both caps are required; removing either re-opens the over-discount path that `pricing.test.ts`'s property suite catches.
* **Property tests are the enforcement** — `pricing.test.ts: fc.assert(fc.property(integerCart(), totals => {…}))` asserts `sum(lineDiscounts) === discount ∧ total === sum(lineTotals)+shipping+tax` for thousands of generated carts. Example tests cannot cover the combinatorial space that the BigInt fix proved necessary.

---

#### (d) `turbopackIgnore` Runtime `react-dom/server` (NFR-STACK-11)

> **Why this exists:** The App Router graph is statically traced by Turbopack at build time. A **static** `import { renderToStaticMarkup } from "react-dom/server"` inside any file reachable from an `app/` route makes Turbopack try to bundle the server renderer into the App Router — and `react-dom/server` (referenced also by `react-email`) is not a client-safe import. The build fails. The sanctioned pattern is a **runtime dynamic import** with `/* turbopackIgnore: true */` so the bundler does not trace it — at build time the import is elided; at runtime (Node — job runner, webhook, tests) it resolves from `node_modules` via ESM.

```ts
/**
 * Email transport — runtime react-dom/server
 * (packages/email/src/send.ts:renderEmailHtml, PRD §4.5, FR-910, NFR-STACK-11)
 *
 * Copies from: packages/email/src/send.ts — the only sanctioned dynamic-import site
 * Constraint:  react-dom/server must never be statically imported in the App Router graph
 * See also:    AGENTS.md "react-dom/server must never be statically imported" + PRD §4.5
 */

import type { ReactElement } from "react";
import { Resend } from "resend";
import { OrderConfirmation, ShipmentUpdate } from "./templates";

/**
 * Render a React Email component to an HTML string at send time.
 * This is the ONLY site that imports "react-dom/server" — and it does so
 * at runtime so Turbopack never traces it.
 */
async function renderEmailHtml(element: ReactElement): Promise<string> {
  // Why: turbopackIgnore — keeps Turbopack from tracing "react-dom/server" into the App Router bundle.
  // Why: without it the build fails ("can't resolve react-dom/server" in the traced graph) or the client
  // Why: bundle ships the server renderer. With it the call is elided at build and resolved at runtime.
  // Why: the import lives inside the function (not top-level) so the module remains statically importable from app code.
  const { renderToStaticMarkup } = await import(/* turbopackIgnore: true */ "react-dom/server");
  return `<!DOCTYPE html>${renderToStaticMarkup(element)}`; // Why: static markup — no hydration scripts, email-safe doctype.
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null; // Why: null when unset — local dev uses log transport, not a throw.

type SendResult = { transport: "resend" | "log"; id: string | null };

/** Hash PII before logging (PRD §9.5): raw addresses never hit logs. */
function hashEmail(email: string): string {
  let hash = 5381;
  for (const byte of Buffer.from(email.toLowerCase())) hash = ((hash << 5) + hash + byte) >>> 0;
  return `sha1-style:${hash.toString(16)}`;
}

async function renderAndSend(
  template: "order-confirmation" | "shipment-update",
  to: string, subject: string, element: ReactElement,
): Promise<SendResult> {
  const html = await renderEmailHtml(element); // Why: render is inside the transport — outbox jobs hold snapshots, not rendered HTML.
  if (!resend) {
    console.info(`[email:log] template=${template} to=${hashEmail(to)} subject="${subject}"`); // Why: structured log — drain never drops mail silently.
    return { transport: "log", id: null };
  }
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Scandi Haven <orders@scandihaven.example>", // Why: EMAIL_FROM is quoted in .env (spaces/angle brackets — start_server.sh H1).
    to, subject, html,
  });
  if (error) throw new Error(`Resend ${template} send failed: ${error.message}`); // Why: caller's job runner logs with correlation id (PRD §4.5) and the outbox retry will re-attempt.
  return { transport: "resend", id: data?.id ?? null };
}

export async function sendOrderConfirmation(props: {
  to: string; orderNumber: string; customerName: string; totalFormatted: string; leadTimeNote: string; siteUrl: string;
}): Promise<SendResult> {
  return renderAndSend("order-confirmation", props.to, `Order ${props.orderNumber} confirmed`, OrderConfirmation(props));
}
```

**Why this pattern:**
* The alternative — a static `import` — is the **class of build failure Turbopack reports as a trace error**, not a runtime error. It blocks `pnpm build` locally and in CI with no degraded fallback. The `turbopackIgnore` dynamic import is the **only** Next-16-sanctioned escape hatch that keeps the App Router graph pure while still letting the email package live at `packages/email` and be imported from app code (`jobs/run` drains it). Moving email rendering to a separate microservice would have reintroduced the second-runtime overhead ADR-001 rejected.
* The import is **inside** `renderEmailHtml()` (not at module top-level) so the file's static graph is empty — `apps/web` can `import { sendOrderConfirmation } from "@scandihaven/email/send"` without pulling `react-dom/server` into the traced bundle. At runtime inside `POST /api/jobs/run` (already Node), the ESM resolver loads `react-dom/server` from `node_modules` normally — no custom loader, no `require` inside an ESM package.
* Log-transport fallback is not "fake email" — it is the **honest local state** the E2E suite asserts (README Secrets, PRD §4.5): without `RESEND_API_KEY` the platform logs a hash, the UI shows what was enqueued, and no one infers delivery that did not happen.

---

#### (e) Origin Trust via Proxy-Controlled Headers (H-AUTH fix)

> **Why this exists:** `BETTER_AUTH_URL` pinned to `http://localhost:3000` made the live Better-Auth instance trust only localhost. Behind a reverse proxy / host-routed deployment the storefront is served from the public origin but auth POSTs arrived with a localhost-trusted set — and the cart's `sh_cart` cookie rode along, so the browser's `Cookie` made the request credentialed and Better-Auth's `INVALID_ORIGIN` gate rejected it (audit 2026-09-09 H-AUTH — broke sign-in on both live apps). The fix is a **pure per-request origin derivation** that Better-Auth calls via `trustedOrigins(req.headers)` — reading **only** proxy-controlled headers, never the attacker-controlled `Origin`/`Referer`.

```ts
/**
 * Origin trust — proxy-controlled headers only
 * (packages/auth/src/trusted-origins.ts:requestOriginFromHeaders,
 *  packages/auth/src/server.ts:trustedOrigins,
 *  Tests: packages/auth/src/trusted-origins.test.ts + server-origin.test.ts
 *  Fix:   audit 2026-09-09 H-AUTH — localhost-pinned BETTER_AUTH_URL behind proxy broke sign-in)
 *
 * Copies from: packages/auth/src/trusted-origins.ts + server.ts trustedOrigins integration
 * Invariant:   never read Origin / Referer — they are attacker-controlled and would widen the trust
 */

export interface OriginHeaders { get(name: string): string | null | undefined; }

const LOOPBACK_HOST_PATTERN = /^(localhost|127\.0\.0\.1|::1|\[::1\])(:\d+)?$/i;

// Why: proxy/CDN may append comma-separated values — first token is the original host/proto (PRD §9.4).
function firstToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const token = value.split(",")[0]?.trim();
  return token ? token : null;
}

/**
 * Derive "scheme://host[:port]" for the origin this request was served on,
 * or null when no host information is present (e.g. direct auth.api calls).
 *
 * Trust boundary (H-AUTH):
 *   - Reads ONLY x-forwarded-host / host / x-forwarded-proto — headers the
 *     proxy/CDN the platform controls sets. Browsers never send x-forwarded-host,
 *     and non-browser clients hold no victim credentials — trusting the served
 *     host does not open a CSRF path.
 *   - Deliberately ignores Origin/Referer — they are attacker-controlled.
 *     A cross-site browser request carries its own Origin while our Host
 *     remains the victim origin, so the CSRF check stays intact.
 */
export function requestOriginFromHeaders(headers: OriginHeaders | null | undefined): string | null {
  if (!headers) return null; // Why: null means "no host info" — caller falls back to Better-Auth defaults (auth.api direct calls).
  const host =
    firstToken(headers.get("x-forwarded-host")) // Why: x-forwarded-host wins when present — it is the original host the proxy saw.
    ?? firstToken(headers.get("host"));        // Why: fallback — direct (non-proxied) requests carry only host.
  if (!host) return null; // Why: no host → cannot derive origin — don't fabricate one.
  const forwardedProto = firstToken(headers.get("x-forwarded-proto"));
  // Why: scheme fallback is loopback-aware — localhost/127.0.0.1/::1 default to http; everything else defaults to https.
  // Why: avoids pinning http in production while keeping `pnpm dev` on http without extra env.
  const proto = forwardedProto ?? (LOOPBACK_HOST_PATTERN.test(host) ? "http" : "https");
  return `${proto}://${host}`; // Why: scheme+host — origin for Better-Auth trustedOrigins is scheme://host, no path.
}

/** @file packages/auth/src/server.ts — Better-Auth integration (excerpt) */
// import { betterAuth } from "better-auth";
// import { drizzleAdapter } from "better-auth/adapters/drizzle";
// import { admin } from "better-auth/plugins";
// import { requestOriginFromHeaders } from "./trusted-origins";

export const auth = betterAuth({
  // database: drizzleAdapter(db, { provider: "pg" }),
  // plugins: [admin({ defaultRole: "customer", adminRoles: ["admin", "staff"] })],
  // …session, emailAndPassword (min 10), account, verification, rateLimit…

  /**
   * Per-request trusted origin (H-AUTH fix). Better-Auth calls this for every
   * request; we return the origin the request was actually served on.
   * ADR-003 rationale: PII stays in PG, sessions are DB-backed (immediate
   * revocation via banned/banReason/banExpires), and the origin seam is a
   * pure function (trusted-origins.ts) — the narrowest, most testable fix for
   * the localhost-pinning failure.
   */
  trustedOrigins: (request: Request) => {
    const served = requestOriginFromHeaders(request.headers);
    // Why: BETTER_AUTH_TRUSTED_ORIGINS is the native comma-separated extension point for *extra* origins
    // Why: (e.g. preview deployments). It is additive — never replaces the served origin. Empty/null is valid.
    const extras = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
    return [served, ...extras].filter((v): v is string => Boolean(v));
  },
});
```

**Why this pattern:**
* The previous shape — `BETTER_AUTH_URL= http://localhost:3000` (or `BETTER_AUTH_URL` absent and defaulting to localhost) — was a **deployment-level origin pin** that could not follow the request. Host-routed deployments (storefront and admin behind distinct hosts/paths) serve the same Next app from the **public** origin while `BETTER_AUTH_URL` is a build-time env — they diverge by design. A per-request derivation from headers the **proxy controls** is the minimal fix that follows the request without widening trust to headers an attacker controls.
* `Origin`/`Referer` would have been the naive fix ("mirror the browser's claimed origin into trustedOrigins") and it would have opened the exact CSRF path Better-Auth's gate exists to close: a malicious site's `fetch("https://store.scandihaven.example/api/auth/sign-in", { credentials: "include" })` sends `Origin: https://attacker.example` alongside the victim's `Cookie: sh_cart=…`. Trusting `Origin` would have accepted the attacker's origin as trusted while the cookie still rode along. Trusting the **served host** (`Host`/`x-forwarded-host`) keeps the gate on the victim origin — the attacker cannot set `Host` cross-site, and they never send `x-forwarded-host` at all.
* The seam is **pure** (`OriginHeaders` is a structural subset, `firstToken` is a string function) so the contract is fully unit-tested (`trusted-origins.test.ts: x-forwarded-host precedence, comma-chain, loopback http vs https default, null host`) and runtime-verified by `server-origin.test.ts`'s localhost-pinning regression guard. No widening to read `Origin` is allowed without a new ADR naming H-AUTH.

---

**§2+§3 Verification Checklist (before merge)**

| Check | Command / Probe | Expected |
|---|---|---|
| Proxies register | `grep -q "_middleware" apps/web/.next/server/functions-config-manifest.json && grep -q "_middleware" apps/admin/.next/server/functions-config-manifest.json` | Both pass — H8d gate |
| CSP present on every response incl. sign-in | `curl -sI localhost:3000/sign-in \| grep -i content-security-policy` · `curl -sI localhost:3001/sign-in \| grep -i content-security-policy` · body contains `static.cloudflareinsights.com` + `js.stripe.com` | Pass — H5d / E2E-7 |
| Admin gate recompiles | `pnpm --filter @scandihaven/admin test guard.test.ts` + `curl -s -o /dev/null -w "%{http_code}" localhost:3001/` → `307` + `curl -s localhost:3001/sign-in \| grep Sign` → `200` | Pass — H7d / H2-ADMIN |
| Cart identity not regressed | `pnpm --filter @scandihaven/web test cart.test.ts` + `pnpm e2e --grep cart` (Chromium) | Pass — H1-CART |
| Money invariants | `pnpm --filter @scandihaven/commerce test` — `pricing.test.ts` fast-check property suite + `money.test.ts` | 90% lines / 85% funcs; `sum(lineDiscounts)===discount` holds |
| Webhook placement | `placement-outcome.test.ts` + E2E `checkout` (Stripe not-configured vs succeeds vs amount_mismatch→review) | No throw path; review+payment_orphan on mismatch |
| Origin trust | `pnpm --filter @scandihaven/auth test trusted-origins.test.ts server-origin.test.ts` | H-AUTH pinned |
| Types + lint + build | `pnpm lint && pnpm typecheck && pnpm build` | 8/8, 8/8, 2/2 — no `any`, `transpilePackages` only, no package `dist/` |
| Live health (post-`./start_server.sh`) | `curl -s localhost:3000/api/health \| jq .status` → `"ok"` · `curl -s localhost:3000/shop \| grep Halden` → hit · `docker compose ps` → `healthy` | All pass — `start_server.sh` already asserts these plus CSP + admin 307 |

*End of PAD §2–§3. Locked as-built at 2026-09-10. Changes require a versioned revision entry citing the originating audit, E2E slice, or ADR.*


## 4. Data Architecture

### 4.1 Entity-Relationship Overview

```mermaid
erDiagram
    category ||--o{ product : contains
    product ||--o{ product_variant : has
    product_variant ||--o{ variant_price : priced_in
    product_variant ||--o{ variant_image : shown_via
    product_variant ||--o{ inventory_level : stocked_at
    warehouse ||--o{ inventory_level : hosts
    product_variant ||--o{ inventory_movement : ledger
    product ||--o{ product_image : gallery
    media ||--o{ product_image : asset
    media ||--o{ variant_image : asset
    collection ||--o{ collection_product : curates
    product ||--o{ collection_product : featured
    product ||--o{ review : receives
    product ||--o{ back_in_stock_request : notifies
    cart ||--o{ cart_line : contains
    cart ||--o{ cart_promotion : applies
    promotion ||--o{ cart_promotion : applied_to
    cart ||--o{ order : converts_to
    order ||--o{ order_line : contains
    order ||--o{ order_address : ships_to
    order ||--o{ payment : paid_via
    order ||--o{ order_event : timeline
    order ||--o{ shipment : fulfilled_by
    shipment ||--o{ shipment_line : ships
    order_line ||--o{ shipment_line : allocated
    order ||--o{ return_request : may_return
    return_request ||--o{ return_line : itemizes
    user ||--o{ address : has
    user ||--o{ trade_application : applies
    user ||--o{ session : authenticates
    user ||--o{ account : linked
    promotion ||--o{ promotion_redemption : redeemed
    gift_card ||--o{ gift_card_transaction : ledger
    webhook_event ||--o{ job : enqueues
```

> Gaps flagged in audit 2026-09-10: `product.search_vector tsvector + GIN` absent, `two_factor` table absent, several `CHECK` constraints missing at DDL — see §12 Known Issues. App-layer guards exist; DDL hardening is P0 backlog `R-DB-*`.

### 4.2 Core Table Groups (PRD §7.3–§7.8 as deployed)

| Group | Key Tables | Notable Constraints | Locus |
|---|---|---|---|
| **Catalog** | `category`, `product`, `product_variant`, `variant_price`, `warehouse`, `inventory_level`, `inventory_movement`, `media`, `product_image`, `variant_image`, `collection`, `collection_product`, `search_synonym`, `review`, `back_in_stock_request`, `product_locale` | `slug citext UNIQUE` (`category_slug_idx`, `product_slug_idx`, `collection_slug_idx`), `sku UNIQUE`, `status enum('draft','active','archived')`, `lead_time_days_min/max`, `weight_g`, `variant_price PK (variant_id,currency)`, `inventory_level PK (variant,warehouse)` | `packages/db/src/schema/catalog.ts:16-303` |
| **Carts & Orders** | `cart`, `cart_line`, `cart_promotion`, `order`, `order_line`, `order_address`, `payment`, `shipment`, `shipment_line`, `return_request`, `return_line` | `cart.token UNIQUE`, `cart_line UNIQUE(cart,variant,is_gift_wrap)`, `order.number UNIQUE SH-YYYY-XXXXXX`, `fx_rate numeric(18,8)`, `status §7.7`, `payment.stripe_payment_intent UNIQUE`, `order_event` append-only | `packages/db/src/schema/orders.ts:21-275` |
| **Customers/Promos/Gift** | `user` (+extensions `trade_status`, `payment_terms`, `stripe_customer_id`), `address`, `trade_application`, `promotion`, `promotion_redemption`, `gift_card`, `gift_card_transaction` | `promotion.code UNIQUE` (should be partial `WHERE is_active`), `promotion_redemption` per-limit scope uniqueness not DDL-enforced, `gift_card.code_hash UNIQUE CSPRNG`, gift ledger append-only | `packages/db/src/schema/customers.ts:13-135` + `auth.ts:28-51` |
| **Ops** | `audit_log`, `webhook_event`, `job`, `rate_limit_hit`, `redirect`, `newsletter_subscriber`, `fx_rate`, `shipping_zone`/`shipping_rate`, `announcement`, `nav_entry`, `static_page`, `journal_post`, `lookbook`, `analytics_event` | `webhook_event.stripe_event_id UNIQUE`, `job.idempotency_key UNIQUE`, `rate_limit_hit PK(bucket,window_start)`, `redirect.source_path UNIQUE` | `packages/db/src/schema/ops.ts:24-148` + `content.ts` |
| **Auth** | `user`, `session`, `account`, `verification` (Better-Auth owned, `role`/`banned` extensions) | `user.email citext UNIQUE`, `session.token UNIQUE`, `verification_identifier_value_idx UNIQUE(identifier,value)` | `packages/db/src/schema/auth.ts:50-74` |

Money is `integer` minor units everywhere (`amount`, `total`, `tax`, `shipping` — never floats, ADR-7). Timestamps are `timestamptz` UTC (`created_at`, `updated_at`).

### 4.3 Persistence Strategy

| Concern | As Built | Locus |
|---|---|---|
| **Pool** | `Pool({ max 10, idleTimeout 30s, statement_timeout 15s })` singleton on `globalThis.__scandihavenPool`/`__scandihavenDb` — **lazy Proxy** so `next build` (imports auth route → db client) succeeds without `DATABASE_URL`; first real query fails fast with actionable message. HMR shares one pool (audit C1: per-import Pool exhausted `max_connections`). | `packages/db/src/client.ts:102-124` |
| **Seeding** | `ensureSeeded()` idempotent: `pg_advisory_xact_lock(hashtext('seed'))` + natural-key upserts (regions/warehouses `AAL/CPH`/`PGDATA`, FX, categories, Halden armchair/Øresund lamp/… demo catalog, shipping zones). Refuses non-local `DATABASE_URL` hosts (`isLocalDatabaseUrl()`). Called from `start_server.sh` `db:setup` and from boot. | `packages/db/src/seed/ensure-seeded.ts` + `packages/db/src/local-db.ts` |
| **Migrations** | Forward-only via `drizzle-kit generate` → `drizzle/0000_large_sphinx.sql` + `meta/_journal.json`; never hand-edited except extension preamble (`citext`/`pg_trgm`/`pgcrypto`). After schema edits: `pnpm db:generate` → review SQL → `pnpm db:migrate`. Destructive changes ship as expand→migrate→contract. | `packages/db/drizzle.config.ts:1` + `drizzle.config.ts` |
| **Inventory** | Availability `qty_on_hand − qty_reserved − safety_stock ≥ requested`. Reservation at payment-confirmation TX: `SELECT … FOR UPDATE` on `inventory_level`, re-check, `qty_reserved += qty` until `shipment.shipped_at` then `qty_on_hand -= qty` (audit notes current is single-step decrement — two-phase is `R-INV-1`). Made-to-order variants (no `inventory_level` rows) always purchasable. | `packages/commerce/src/checkout-service.ts:354-380` + `packages/db/src/schema/catalog.ts:177-215` |
| **Ordering** | `order.number` → `SH-YYYY-XXXXXX` via `pg_advisory_xact_lock(hashtext('order_number:YYYY'))` + `MAX(split_part(number,'-',3))` inside placement TX — serializes without gaps under concurrent webhooks (§7.9). Status writes only via `transition()` → `order_event {type, actor, payload jsonb}` append-only. | `packages/commerce/src/order-state.ts:30-80` + `orders.ts:135-148` |
| **Money example** | Worked §7.10: Halden armchair €1,299 + 2× runner €45, subtotal 138900 → WELCOME100 −10000 distributed largest-remainder (armchair −9352 →120548, runner −648→8352) → shipping 4900 → total 133800 → FX 1.0864→ Stripe 145360 minor. Invariant `subtotal−discount+shipping+tax=total` property-tested. | `PRD §7.10` + `packages/commerce/src/pricing.ts:18-150` |


## 5. Design System Reference

### 5.1 Typography

| Role | Typeface | Weights | Optical / Usage |
|---|---|---|---|
| **Display** | **Fraunces** via `next/font` `variable` `opsz 9–144` (`--font-fraunces` → `--font-display` fallback Georgia) | 300–500 + italic | Headings, hero, brand story. Line length ≤68ch for prose. |
| **UI/Body** | **Inter** via `next/font` 300–600 (`--font-inter` → `--font-ui`) | 300–600 | Body, labels, nav, form. Self-hosted — no render-blocking font requests. |
| **Numerals** | `tabular-nums` | — | All price rendering (`Intl.NumberFormat` per `currency/locale` at edge, `packages/web/src/lib/format.ts`). |

Type scale (px): **12 (xs) · 13 (sm) · 14 (base) · 16 (md) · 18 (lg) · 22 (xl) · 28 (2xl) · 36 (3xl) · 48 (4xl) · 64 (5xl) · 96 (6xl)** — from `tokens.css:50-60`, no ad-hoc sizes (lint optional, review-enforced).

### 5.2 Color Tokens (AA-verified, PRD §10.1 — Single Source `packages/ui/src/tokens.css:5-50`)

| Token | Hex | Usage | Contrast |
|---|---|---|---|
| `--color-bg` | `#faf7f2` | Warm off-white surfaces (page, cards, popovers) | — |
| `--color-bg-2` | `#f0eae0` | Cream (secondary surfaces, `bg-secondary`) | — |
| `--color-bg-3` | `#e8e0d2` | Sand (selection, hover `hover:bg-bg-3`) | — |
| `--color-ink` | `#1f1b17` | Warm near-black body text | 15:1 on bg |
| `--color-ink-2` | `#4a433b` | Secondary headings | 10:1 on bg |
| `--color-muted` | `#6f665c` | Secondary text 13px — **darkened warm gray** | **4.5:1 on bg (AA)** (was `#8A8178` — failed 4.5:1, darkened during axe gate §12.2) |
| `--color-line` | `#e5ddd1` | Borders, inputs, ring base | — |
| `--color-accent` | `#c97b5e` | Terracotta — **large text/UI accent only** | 3:1 on bg (AA large) — not for 14px body |
| `--color-accent-2` | `#8f4326` | Deep terracotta — **body links, primary buttons (white label), --ring** | **4.5:1 on cream (AA)** (was `#B06548` — failed, darkened) |
| `--color-sage` | `#8b9a82` | Badges, secondary highlights | — |
| `--color-wood` | `#c9a876` | Secondary highlight (material accent) | — |
| `--color-dark` / `--color-dark-2` | `#221d18` / `#2c2620` | Editorial dark section (Hygge Edit) | — |

**Shadcn mapping** (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--border`, `--input`, `--ring`, `--destructive`) — **literal hex** inside single `@theme` block, `var()` chains are **dropped by current Tailwind 4.3 build** (NFR-STACK-8, comment `tokens.css:23-24`). `@import "tailwindcss"; @import "@scandihaven/ui/tokens.css";` in `apps/*/src/app/globals.css:1`; **`@source "../../../../packages/ui/src"` is load-bearing** (NFR-STACK-7) — without it, `bg-secondary`, `hover:bg-bg-3` etc. used only in `packages/ui` silently never generate.

Radii: `--radius-card 2px` (cards) · `--radius-image 0px` (sharp editorial imagery) · `--radius-pill 999px` (badges/filters).

### 5.3 Component Primitives (`packages/ui/src/components/*` — Radix + CVA + tailwind-merge)

| Class | Components | Notes |
|---|---|---|
| **Primitives** | `button.tsx` (CVA variants), `drawer.tsx` (Radix Drawer → Sheet), `input.tsx`, `label.tsx`, `badge.tsx`, `skeleton.tsx`, `accordion.tsx` | Radix primitives themed via `tokens.css` + `cn()`; `forwardRef` correctly typed; no commerce import (use structural prop types). |
| **Composites** | `quantity-stepper.tsx`, `price-block.tsx`, `lead-time-badge.tsx`, `product-card.tsx`, `media-image.tsx` | Domain-aware but **app-logic free** — e.g. `ProductCard` takes `title/price/compareAt/leadTime` props, never imports `@scandihaven/commerce`. |
| **Inventory drift** | Some composites (gallery, variant swatches) still live in `apps/web/src/components` not `packages/ui` — §12 Known Gap. Goal: consolidate to `packages/ui` per §10.3. |

### 5.4 Motion & Imagery (PRD §10.5)

- **Ease / durations:** `--ease-brand cubic-bezier(.22,1,.36,1)` + `--duration-fast 200ms / base 300ms / slow 400ms / reveal 800ms` (tokens.css). Only these four durations — never `ease-linear` for brand motion.
- **Respects `prefers-reduced-motion`** — `media (prefers-reduced-motion: reduce)` collapses reveals to `opacity` changes only (`tokens.css @layer base`, section reveals).
- **Images:** `next/image` with AVIF/WebP auto, explicit `sizes`, `blur_data_url` placeholder from media row; hero ≤200KB, product ≤80KB (§11.4 budgets — enforced in admin media upload, Phase 2 CDN concern). `images.unoptimized` when `DISABLE_IMAGE_OPTIMIZER=1` (local/E2E sharp deadlock guard — production pipeline on).



## 6. Security Architecture

### 6.1 Mandatory Rules Table

| Rule | Enforcement | Where it fails → what breaks |
|---|---|---|
| **No `any`** | ESLint `no-explicit-any` **error** + TS `strict` | `pnpm lint` fails — PR blocked. Use `unknown` + narrow. |
| **No `sql.raw`** | Lint-banned — only `sql\`` tagged templates | String-concatenated SQL → injection; `pnpm lint` + review. |
| **Float money banned** | `money.ts:assertMinor`, `sumMinor`, `roundHalfUp`; pricing uses **BigInt largest-remainder** | Float drift silently invents/loses cents — caught by property tests `discount≤subtotal` + `subtotal−discount+ship+tax=total`. |
| **No package build step** | `exports → src/*.ts`, `transpilePackages` in `next.config.ts`, no `packages/*/dist` | Cycles would break turbo graph silently (build "does nothing"). |
| **No static `react-dom/server`** | **Runtime** `await import(/* turbopackIgnore: true */ "react-dom/server")` only in `packages/email/src/send.ts` | Static import fails Turbopack App Router build (NFR-STACK-11). |
| **No commit `.env`/keys** | `.gitignore` (`.env`, `.env.local`, `docs/bak.env`), CI `rg -n --hidden --no-ignore` scan (inverted correctly: `rg` exit 0 on match → `if rg …; then fail`) | 262d3cc re-exposure slipped because `--no-ignore` was missing — hardened (H6d, C-CI). |
| **No REST for UI** | Route Handlers whitelisted to Stripe webhooks / Better-Auth / search typeahead / jobs runner / health (AGENTS.md § Architecture invariants) | Any UI mutation via REST creates an unaudited, untyped surface. |
| **Money = integers** | `integer` minor-unit columns + `assertMinor` at every entry | Float in DB → rounding drift across shards. |
| **State via `transition()` only** | `packages/commerce/src/order-state.ts:transition()` sole writer; `InvalidOrderTransition` on illegal | Bypass invents orphan states. |
| **Cart token ≠ UUID** | `getCartId()` resolves token→UUID; `requireCart()` returns UUID untouched, never into `ensureCart(token)` | Feeding UUID into token-keyed `ensureCart` mints junk cart (H1-CART). |
| **Async request APIs** | `await params/searchParams/cookies()/headers()` | Sync form removed in Next 16.3 — NFR-STACK-10. |
| **One RBAC matrix** | `packages/auth/src/rbac.ts:can()` consumed by every Action via `requirePermission()` + `audit_log` | Inline role checks drift. |
| **Feature flags typed** | `packages/config/src/flags.ts`: unknown `FEATURE_*` fails fast + typecheck | Typo never silently disables a surface. |

### 6.2 Security Utilities Inventory

| Utility | Locus | Purpose | Enforcement |
|---|---|---|---|
| `trusted-origins.ts` | `packages/auth/src/trusted-origins.ts:requestOriginFromHeaders()` + `server-origin.test.ts`/`trusted-origins.test.ts` (19+7 cases) | Pure origin derivation from `x-forwarded-host`/`host`/`x-forwarded-proto` — never `Origin`/`Referer` (attacker-controlled). Fixes localhost-pinned `BETTER_AUTH_URL` behind reverse proxy (H-AUTH). | Pure seam, unit-tested, proxy sets headers. |
| `rate-limit.ts` | `packages/commerce/src/rate-limit.ts:consumeRateLimit()` + `rate-limit.integration.test.ts` | Postgres sliding-window `rate_limit_hit PK(bucket,window_start)` atomic upsert → `RATE_LIMITED` + `Retry-After`. Per-route: auth 5/min, checkout 30/min/cart, typeahead 60/min/IP, newsletter 3/hour, trade apply 5/day. | `rg --no-ignore` scan for missing gates. |
| `rich-text.ts` | `packages/commerce/src/rich-text.ts:sanitizeHtml` allow-list + `safeJsonLd` breakout `<>` + `U+2028/29` | **Every** `dangerouslySetInnerHTML` / JSON-LD passes here before render. | 11 unit tests, grep every `__html`. |
| `redirect-path.ts` | `packages/config/src/redirect-path.ts:validateRedirectPath()` | Post-auth `?redirect=` never trusted raw (admin previously `router.push(raw)` — open redirect). | Called in `sign-in-form.tsx` before `router.push`. |
| `chunk-recovery.ts` | `packages/config/src/chunk-recovery.ts:reloadOnStaleChunk()` | Stale-chunk self-heal: rebuild-without-restart 404s referenced chunks → branded `global-error.tsx` one-shot reload guarded by `sessionStorage` + 10s cooldown (E2E-1). | `chunk-recovery.test.ts` |
| `security-headers.ts` | `packages/config/src/security-headers.ts:securityHeaders()` | **Single manifest** both proxies apply — including `/sign-in` credential page (must not go bare, H5d/LD-2). | Unit-tested (`security-headers.test.ts`), verified by `curl -I`. |
| `site-url.ts` | `packages/config/src/site-url.ts:resolveSiteUrl()` | Canonical origin: `NEXT_PUBLIC_SITE_URL` → proxy-derived served origin → localhost fallback; production boot warns when fallback is localhost (E2E-8 `NEXT_PUBLIC_SITE_URL` misconfig logged `[boot] NEXT_PUBLIC_SITE_URL …`). | `site-url.test.ts`, `instrumentation.ts` boot guard. |

### 6.3 Authentication & Authorization

| Aspect | As Built | Gap |
|---|---|---|
| **Methods** | Email/password `minPasswordLength 10` via Better-Auth; session via Drizzle adapter; `admin` plugin adds `role`/`banned`/`banReason` | `zxcvbn-lite ≥3` breached-check + 15-min magic-link + Google/Apple OAuth allow-list are stubs — Phase 1 `R-AUTH-1`. |
| **Sessions** | DB-backed `session` table — admin revocation immediate; `expiresIn 2592000` (30d) `updateAge 86400` per-request rotation (Better-Auth secure default); cookies `HttpOnly; Secure; SameSite=Lax`; guest carts survive via signed cookies independent of sessions. Revoke-all `DELETE session WHERE userId` wired but without `list active sessions` UI. | List/revoke UI `R-AUTH-1`. |
| **2FA** | `two_factor` table **absent** (see §4.1 gap), Better-Auth twoFactor plugin not mounted, proxy gate on `/admin` not enforced — Owner/Admin remain password-only. | **P1 `R-SEC-1`** — do not launch admin without. |
| **RBAC** | Typed matrix `packages/auth/src/rbac.ts`: `ROLES 7` (`user`, `readonly`, `warehouse`, `customer_service`, `merchandiser`, `admin`, `owner`) × `PERMISSIONS 15` (`orders:view/refund_small ≤€500/refund_large/fulfill/cancel`, `catalog:*`, `inventory:adjust`, `content:edit`, `promotions:manage`, `customers:*`, `settings:manage`, `trade:review`); `can(role,permission)` / `canAny()`; every Server Action calls `requirePermission()` (`apps/admin/src/lib/admin-guard.ts`) and writes `audit_log` (actor, action, before/after digest, `ip_hash` not raw IP). No inline checks. Least privilege: `customer_service` can `refund_small` without second approval; >€500 requires `admin`. | — |
| **Origin trust** | Per-request header-derived origin via `trusted-origins.ts` + native `BETTER_AUTH_TRUSTED_ORIGINS` comma allow-list; `BETTER_AUTH_URL` must be public origin (live H-AUTH post-mortem documented in `security-headers.ts` comment). | — |

### 6.4 Threat Model (STRIDE excerpt)

| Threat | Vector | Control | Residual |
|---|---|---|---|
| **Spoofing** | Session cookie theft | `HttpOnly; Secure; SameSite=Lax`; rotation on privilege change; 2FA for admin | **Pending 2FA** |
| **Tampering** | Price tamper via client | Server re-derive on `createPaymentIntent` + `placeOrderFromWebhook` amount check (`AMOUNT_MISMATCH→review`) — PRD §7.11 | None — Verified |
| **Repudiation** | Admin disputes action | `audit_log` append-only before/after digests; no `UPDATE/DELETE` grants | None |
| **Info Disclosure** | Trade `tradeAmount` leak | Server strips trade fields for unauthorized sessions (FR-903) — currently always-stripped (no conditional trade resolution yet) | Needs conditional resolver `R-AUTH-1` |
| **Denial of Service** | Checkout/search abuse | Per-route rate limits + WAF; webhook 300s tolerance + `webhook_event` dedup | None |
| **Elevation of Privilege** | Role confusion | Single `rbac.ts` matrix; Action re-auth; Admin 2FA gate pending | **Pending 2FA** |

Transport: `HSTS 63072000 includeSubDomains preload` · TLS 1.3 at edge · `CSP default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com https://static.cloudflareinsights.com; frame-src https://js.stripe.com https://hooks.stripe.com; img-src 'self' data: blob:;` (nonce is Phase 1 — current `unsafe-inline` noted) · `XCTO nosniff` · `Referrer-Policy strict-origin-when-cross-origin` · `Permissions-Policy camera=(), microphone=(), geolocation=()` · `XFO DENY` — all from `securityHeaders()` manifest, tested.

Privacy: `resolveSiteUrl` + `hashEmail` (logs hashed), addresses never logged, `analytics_event` IDs only (`order_completed` server-authoritative), GDPR `customers:gdpr` (export/anonymize deferred `R-ADMIN-*`), DSA trader block on PDP (legal name + address), review photos EXIF-stripped on ingest.


## 7. Worker & Outbox Architecture (ADR-8: Outbox + Cron over Queue Service)

### 7.1 Locus

| Surface | Locus |
|---|---|
| Job table | `packages/db/src/schema/ops.ts:job { id, kind, payload jsonb, runAfter, attempts, last_error, status enum pending/running/done/failed/dead, idempotency_key UNIQUE }` |
| Enqueue helper | `packages/commerce/src/jobs.ts:enqueue()` (`onConflictDoNothing` per `dedupeKey = kind:orderId`) |
| Drainer route | `apps/web/src/app/api/jobs/run/route.ts:POST/GET` — `CRON_SECRET` gated (`timingSafeEqual` on `x-cron-secret` / `Authorization: Bearer`), concurrent-safe |
| Handlers | `packages/commerce/src/jobs.ts:drain()` phase 2 + `packages/email/src/send.ts:renderAndSend()` |
| Trigger | Stripe `payment_intent.succeeded` → placement TX inserts `webhook_event` + `job` rows inside same TX (`commerce/checkout-service.ts:placeOrderFromWebhook`) |

### 7.2 Queue Configuration

| Property | Value | Verified |
|---|---|---|
| **Drainer** | `PgJobRunner.drain(limit=50)` — phase 1 short `SELECT … FOR UPDATE SKIP LOCKED` TX claims due jobs (`status pending` + `runAfter ≤ now`) and marks `running` + `attempts++`; phase 2 executes handlers **outside** the lock; phase 3 settles each independently. | 7 real-PG integration tests (`jobs.test.ts`) |
| **Batch limit** | `JOB_BATCH_LIMIT 50` (`jobs.ts:22`) | — |
| **Retry / Backoff** | `backoff 0.5s · 2^n` per `attempts`; `maxAttempts 5`; success→`done`; failure→`failed` until `maxAttempts` then `dead`; `dead` SLO = 0 (PRD §11.4) | `jobs.test.ts` |
| **Dead-letter** | Unknown `kind` dead-letters immediately — nothing silently dropped. Dead rows fire `ops.payment_orphan` alert (§8.7) rather than thrown. | `jobs.test.ts` |
| **Idempotency** | `idempotencyKey` UNIQUE (`email.order_confirmation:orderId`, `payment_orphan:orderId`); `enqueue` uses `onConflictDoNothing`. | — |
| **Concurrency** | `FOR UPDATE SKIP LOCKED` — 12 jobs × 3 concurrent drains Verified non-double-processing (`jobs.test.ts`). | — |
| **Gating** | `x-cron-secret` vs `CRON_SECRET` timing-safe equality; concurrent cron ticks safe. | `apps/web/src/app/api/jobs/run/route.ts:32` |

### 7.3 Flow / Pipeline (Order-Placement-Centric DAG)

```
Stripe API  payment_intent.succeeded
    │
    ├─▶ apps/web/src/app/api/webhooks/stripe/route.ts:POST
    │     1. verify stripe-signature (tolerance 300s, stripe.webhooks.constructEvent)
    │     2. → packages/commerce/src/checkout-service.ts:placeOrderFromWebhook(tx)
    │           inside db.transaction:
    │             - INSERT webhook_event (stripe_event_id UNIQUE — duplicate → 200 no-op, H4d)
    │             - recompute computeCartTotals(lines, eligible promos) — PRD §7.11 re-verify
    │             - compare totalsTotal vs intentAmount → AMOUNT_MISMATCH → order.status='review' + job ops.payment_orphan (never throw away captured payment — §8.7)
    │             - FOR UPDATE inventory_level + pg_advisory_xact_lock(order_number) → order + line snapshots + payment + adjustments on inventory
    │             - INSERT job { kind: 'email.order_confirmation', payload: snapshot, dedupeKey: orderId } + analytics_event (non-review only)
    │             - idempotencyKey guards re-entry (PaymentIntent ID)
    │           return order
    │     3. HTTP 200 — Stripe stops retrying only after TX commit
    │
    ├─▶ Cron (Vercel or host) GET/POST /api/jobs/run (CRON_SECRET)
    │     PgJobRunner.drain() → handlers[email.order_confirmation] → packages/email → Resend / log transport — retry/backoff/DLQ above
    │
    └─▶ Other branches (Phase 1 deferred via R-SHOP-3/R-OBS-1):
          shipment.shipped_at   → job email.shipment_update (template exists, trigger not wired)
          shipment.delivered_at+21d → job email.review_request (single-send, unsubscribe-respecting)
          inventory.restocked crossing safety threshold → back_in_stock_request batch ≤1/day per variant
          inventory.low / order.placed / return.requested / payment.failed → ops alerts (Radar score ingestion pending)
```

> Swap trigger `>~50 jobs/s sustained` (PRD §3.2 quantified as lock-wait p95 >20ms or multi-region) — not yet met to Trigger.dev / queue (§3.2) — not yet met. No long-running or latency-sensitive jobs exist that would justify it.


## 8. Quality Engineering

### 8.1 Test Distribution

| Category | Files | Tests | Location | Framework | Gate |
|---|---|---|---|---|---|
| **Unit — pure domain** | 17 | 120 | `packages/commerce/src/*.test.ts` (`money`, `pricing` (+ property), `promotions`, `order-state`, `placement-outcome`, `request-dedupe`, `rich-text`, `providers`) | Vitest 5 + fast-check | **PR-blocking** — coverage `90% lines / 85% funcs` on `packages/commerce` (actual `Statements 90.90% Lines 92.81% Funcs 90.32% Branches 81.96%` ledger 2026-09-10) |
| **Unit — auth** | 4 | 19 | `packages/auth/src/*.test.ts` (`rbac`, `trusted-origins` 7, `server-origin` 19, `auth-route`) | Vitest | PR-blocking |
| **Unit — config** | 5 | 39 | `packages/config/src/*.test.ts` (`flags 22` including unknown-flag fail-fast, `security-headers`, `redirect-path`, `chunk-recovery`, `site-url`) | Vitest | PR-blocking |
| **Unit — web/admin** | 3+3 | 16+11 | `apps/web/src/{actions/cart,lib/*}.test.ts` + `apps/admin/src/*.test.ts` (`guard`, `sign-in-paths`, `next-config`) | Vitest | PR-blocking for touched |
| **Integration — real PG** | 5 | (incl.) | `catalog-price`, `checkout-promotions`, `rate-limit`, `jobs` (7 cases) — `skipIf(!dbReady)` (no `localhost` → auto-skip) | Vitest + real PG (docker/embedded) | Nightly + on commerce changes (CI: `migrate+seed` before test — PRD §11 so seeded DB is ready) |
| **E2E + A11y** | 2 specs | ~6/8 critical paths | `apps/web/e2e/cart-flows.spec.ts` (guest → browse → add → qty→promo→checkout) + `storefront.spec.ts` (home/PLP/PDP/cart health) | Playwright 1.63 Chromium + WebKit + `@axe-core/playwright` | PR-blocking Chromium (WebKit nightly); `axe serious/critical = 0` on tested routes |
| **Security** | — | — | `pnpm audit --audit-level high` + `rg --no-ignore --hidden` secret scan (`-g '!.git/' -g '!node_modules/' -g '!.next/' -g '!.env.example'`) | `pnpm audit` + `rg` PCRE2 (H6d `if rg …; then fail` inversion + C-CI `--no-ignore` for `.env` visibility) | PR-blocking (`1 moderate / 0 high` ledger — CodeQL post-launch §12.1) |

### 8.2 Test Patterns

- **Factories:** `getMockX(overrides)` — `packages/db/src/testing/index.ts:aProduct/aCart(anOrder)` produce valid entity graphs with deterministic IDs for property tests.
- **Property tests:** `fc.assert(fc.property(...))` **inside** `it()` — not `test.prop` (per AGENTS.md). Money-heavy: `discount≤subtotal` invariants for fixed/percent>100%/tiered; `sum(lines)+shipping+tax−discount=total`; FX monotonic.
- **Dedupe pinning:** same `(cartId, requestId)` within 5 min is no-op (`request-dedupe.test.ts:1` — `createRequestDedupe(5*60_000)` + `addLineDedupe`).
- **Re-validation pinning:** `filterEligiblePromotions` per-read (`promotions.test.ts` + `checkout-promotions.integration.test.ts` — minSpend re-validated on every `getCartDto`/placement TX — E2E-3).
- **Placement outcome:** 4 pure decisions for `resolvePlacementOutcome` (`placement-outcome.test.ts` — `AMOUNT_MISMATCH→review`, `OUT_OF_STOCK→review` with `ops.payment_orphan`, advisory lock order-number, no silent swallow).
- **State machine:** every `transition(current, event)` illegal move tested → `InvalidOrderTransition` (`order-state.test.ts`).

### 8.3 Coverage & Thresholds

- **Floor:** `90% lines / 85% funcs` on pure domain (`packages/commerce/vitest.config.ts`) — enforced in CI via `vitest run --coverage` (v8). `result.ts` (typed union, no branches) excluded by design — no false warning.
- **Actual (2026-09-10):** `Statements 90.90% (150/165) Branches 81.96% Lines 92.81% Funcs 90.32%` — threshold met.

### 8.4 Pre-PR / Pre-Deploy Checklist

```bash
pnpm lint && pnpm typecheck && pnpm test   # 8/8, 8/8, 7/7 — commerce 90.90%/90.32%
DATABASE_URL=… BETTER_AUTH_SECRET=… pnpm build  # 2/2, ƒ Proxy
pnpm db:migrate && pnpm db:seed  # fresh PG17
pnpm e2e --project=chromium      # needs migrated+seeded DB; E2E_BASE_URL to target running server
```

> Full gate per `docs/verification-ledger.md`: `pnpm audit --audit-level high` + `rg --no-ignore --hidden` secret scan (H6d/C-CI). PRs touching money/auth/order placement MUST include ledger entry (§12.4). A red test is a regression or wrong test — never skip to pass.


## 9. Build & Deployment

### 9.1 Production Build

| Artifact | Command | Output |
|---|---|---|
| **Monorepo build** | `pnpm turbo run build` (Turbopack) | `apps/web/.next/**` + `apps/admin/.next/**` (`outputs [.next/**, !.next/cache/**, dist/**]` per `turbo.json:dependsOn ^build`), no `packages/*/dist` — internal `transpilePackages` pattern. |
| **Fresh-clone → prod** | `./start_server.sh` canonical (PRD §11, README Quick Start; `docs/verification-ledger.md §2026-09-10 Edge 8→0`) | `ensure_env` (quoted `BETTER_AUTH_SECRET`/`EMAIL_FROM` line 21 fix — `start_server.sh:21`) → `sudo docker compose up -d` (`pg_isready` wait, `server.log`/`server-admin.log`) → `pnpm db:setup` (migrate+seed idempotent) → `pnpm build` → `pnpm prod :3000` + `pnpm prod:admin :3001` (kills prior `:3000/:3001`, health checks `/api/health` + CSP/admin gate). |
| **Reset** | `DB_RESET=1 ./start_server.sh` | `drop+recreate` (local hosts only — `local-db.ts` refuses non-local `DATABASE_URL`). |

> **Operational hard lesson:** Don't `pnpm build` without restarting — running process renders HTML referencing `build-N` chunks that no longer exist → no branded error without `global-error.tsx` + one-shot `chunk-recovery.ts` self-heal (E2E-1). Always restart via `start_server.sh` — it kills prior PIDs after building.

### 9.2 Environment Variables (PRD §11.2 manifest — `.env.example:1-46` is the source file; secrets `set-me` never real)

| Variable | Required | Description | Default / Generation |
|---|---|---|---|
| `DATABASE_URL` | ✅ | PG 17 connection `postgresql://scandihaven_user:scandihaven_secret@localhost:5432/scandihaven_dev` | App role lacks DDL in prod (`DATABASE_URL` least-privileged). |
| `BETTER_AUTH_SECRET` | ✅ | Auth signing + `sh_cart` HMAC | `≥32` chars — `openssl rand -base64 32`; boot fails without (H-AUTH). |
| `BETTER_AUTH_URL` | ✅ | Canonical auth origin (must be **public** origin behind reverse proxy — localhost pins trusted set to localhost, H-AUTH) | `http://localhost:3000` locally. |
| `BETTER_AUTH_TRUSTED_ORIGINS` | — | Extra comma-separated origins trusted (native Better-Auth; served origin derived from proxy headers is automatic) | — |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Canonical site origin for `metadataBase` / OG canonical; unset → localhost canonical poisons live SEO (R4-6). Production boot warns `[boot] NEXT_PUBLIC_SITE_URL …` when misconfigured (E2E-8). | `http://localhost:3000` locally. |
| `STRIPE_SECRET_KEY` | For checkout | Stripe API secret (test `sk_test_…` in dev) | When unset → honest "not configured" checkout notice (E2E asserts it, never fakes payment). |
| `STRIPE_WEBHOOK_SECRET` | For checkout | Webhook signing secret (`whsec_…`, 300s tolerance) | — |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | For checkout | Browser publishable `pk_test_…` | — |
| `RESEND_API_KEY` | — | Resend email delivery | When unset → structured log transport (`[email:log] template=…`), not throw. |
| `EMAIL_FROM` | When email on | `Resend` from header — **quoted** (`"Scandi Haven <orders@…>"`) | `start_server.sh:ensure_env` quotes it — unquoted `source .env` broke on `EMAIL_FROM` space/`<>` (line 21 syntax error). |
| `CRON_SECRET` | ✅ in prod | Protects `/api/jobs/run` drainer (must be ≥16 random) | `openssl rand -hex 16`. |
| `AUTH_GOOGLE_ID/SECRET`, `AUTH_APPLE_ID/SECRET` | — | OAuth seams (optional in dev) | Allow-listed redirects only. |
| `FEATURE_TRADE` | — | Trade program (B2B) | `off` (default `FLAG_DEFAULTS FEATURE_TRADE false`). |
| `FEATURE_GIFT_CARDS` | — | Gift cards | `off`. |
| `FEATURE_REVIEWS` | — | First-party reviews | `on` (PRD §4.8). |
| `FEATURE_I18N` | — | `next-intl` + translation tables | `on` (currently wiring deferred — P1 `R-SEO-3` or document as deferred). |
| `FEATURE_KLARNA` | — | Klarna via Stripe | `off`. |
| `DISABLE_IMAGE_OPTIMIZER` | — | Local/E2E sharp deadlock guard — serve unoptimized | Must stay in `turbo.json:globalEnv` or `next.config.ts:images.unoptimized` reads stale cache (NFR-STACK-11). Production keeps pipeline on. |

> Unknown `FEATURE_*` env vars **fail fast** with actionable message from `packages/config/src/flags.ts:parseFlags()` — a typo can never silently disable a surface. Every flag checked server-side (`isFlagEnabled`) — client gating is UX only. New flags added in `flags.ts` first.

### 9.3 Docker Configuration (local parity — `docker-compose.yml:services.postgres`)

| Item | Value |
|---|---|
| Image | `postgres:17-alpine`, container `scandihaven_postgres`, `restart: unless-stopped` |
| Volumes / `PGDATA` | `postgres_data:/var/lib/postgresql/data` + `PGDATA=/var/lib/postgresql/data/pgdata` |
| Network | `scandihaven_net` (bridge), `ports 5432:5432` |
| Credentials | `POSTGRES_DB scandihaven_dev`, `POSTGRES_USER scandihaven_user`, `POSTGRES_PASSWORD scandihaven_secret` |
| Extensions | `./infrastructure/postgres/init/00-create-extensions.sql → pgcrypto + pg_trgm` (first `docker compose up` installs; `drizzle: journal` forward-only thereafter) |
| Healthcheck | `pg_isready -U scandihaven_user -d scandihaven_dev` `interval 5s timeout 5s retries 10 start_period 10s` + `start_server.sh` full 60s `pg_isready` wait before `db:setup` |

### 9.4 CI / CD Pipeline (`.github/workflows/ci.yml:7-75` — Vercel deployment)

| Stage | Command | Quality Gate | Notes |
|---|---|---|---|
| **1. Install** | `pnpm/action-setup 10.15.0` + `actions/setup-node (.nvmrc, cache pnpm)` → `pnpm install --frozen-lockfile` | Stale lockfile rejected | `pnpm-workspace.yaml` `apps/* + packages/*` respected; `onlyBuiltDependencies [esbuild, unrs-resolver]`. |
| **2. Lint** | `pnpm lint` → `turbo run lint` per workspace (`eslint.config.mjs` via `@scandihaven/config/eslint/library` factory, `no-explicit-any` error) | **PR-blocking** | Import boundaries `apps→packages` enforced. |
| **3. Typecheck** | `pnpm typecheck` → `turbo run typecheck` `tsc --noEmit` (strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`) | **PR-blocking** | — |
| **4. Migrate+Seed** | `pnpm db:migrate && pnpm db:seed` (must precede test — R01 fix; previously tests hit unmigrated DB) | — | CI: `DATABASE_URL` points at `localhost` so real-PG integration suites execute (auto-skip otherwise). |
| **5. Test** | `pnpm test` → `turbo run test` (`vitest run` / `--coverage` for commerce) | **PR-blocking** — commerce `90% lines / 85% funcs` | Property tests `fc.assert(fc.property(...))`. |
| **6. Build** | `pnpm build` → `turbo run build` (Turbopack) | **PR-blocking** | Depends on `^build`; `DISABLE_IMAGE_OPTIMIZER` forwarded via `globalEnv`. |
| **7. E2E** | `pnpm --filter @scandihaven/web exec playwright install --with-deps chromium webkit` → `pnpm ... exec playwright test --project=chromium` | **PR-blocking** Chromium (WebKit nightly) | `rg cart-flows + storefront` critical paths + `axe` serious/critical=0; must not fake payment — asserts honest "not configured" state. |
| **8. Audit** | `pnpm audit --audit-level high` | **PR-blocking** — `1 moderate / 0 high` (ledger) | Post-launch adds CodeQL + ZAP baseline §12.1. |
| **9. Secret scan** | `rg -n --hidden --no-ignore -g '!.git/' -g '!node_modules/' -g '!.next/' -g '!.env.example' -g '!pnpm-lock.yaml'` PCRE2 (non-placeholder `set-me` excluded) — `if rg …; then fail; else clean; fi` (H6d) + `--no-ignore` (C-CI) | **PR-blocking** | Without `--no-ignore`, tracked-but-`.gitignore`d `.env` (262d3cc) invisible to gate. |

> Spec `§11.1` mandates 6 jobs; repo implements them as **one `quality` job** (functionally complete, sequentially ordered) — an explicit filing choice, not a silent miss; prior audits accepted it. Parallelism benefit is deferred.

**Deployment:** Vercel Node proxy (both apps; not Edge) → managed PG 17 multi-AZ → private bucket + CDN. PITR `RTO 4h / RPO 15m` 30-day snapshots. Tagged releases immutable rollback; feature flags default-off for major surfaces.


## 10. Developer Handbook

### 10.1 Local Setup

**Fresh clone (one command — canonical):**
```bash
./start_server.sh              # .env (quoted) → sudo docker compose up -d (pg_isready) → pnpm db:setup → pnpm build → pnpm prod :3000 + prod:admin :3001
DB_RESET=1 ./start_server.sh   # drop+recreate DB first
tail -f server.log server-admin.log
```

**Manual (step-by-step):**
```bash
pnpm install
docker compose up -d               # PG 17 (logs: docker compose logs -f postgres)
cp .env.example .env               # fill BETTER_AUTH_SECRET (openssl rand -base64 32), CRON_SECRET (openssl rand -hex 16)
pnpm db:setup                      # schema + demo catalog (migrate && seed — fresh container, idempotent advisory-lock)
pnpm dev                           # storefront http://localhost:3000
pnpm dev:admin                     # admin http://localhost:3001
```

**Verify:**
```bash
curl -s localhost:3000/api/health   # {"status":"ok","db":true,…} — pnpm proxy + DB + CSP checked by start_server.sh
pnpm typecheck && pnpm lint && pnpm test   # 8/8, 8/8, 7/7 — commerce 90.90%/90.32%
open http://localhost:3000/shop     # seeded catalog (Halden armchair, Øresund lamp, …)
```

Secrets: `SEED_ADMIN_PASSWORD` required for test admin — `SEED_ADMIN_PASSWORD=… pnpm --filter @scandihaven/web seed:admin` (no default credentials ship; `.env.example` deliberately omits it — ops-only secret, `seed-admin.ts: if (!password || len<10) exit 1`).

### 10.2 Common Commands

| Command | Location | Purpose |
|---|---|---|
| `pnpm dev` | `turbo run dev --filter=@scandihaven/web` | Storefront `:3000` (Turbopack) |
| `pnpm dev:admin` | `turbo run dev --filter=@scandihaven/admin` | Admin `:3001` |
| `pnpm build` | `turbo run build` | Both apps (Turbopack); requires `DATABASE_URL` + `BETTER_AUTH_SECRET` at build (auth route constructs db client). |
| `pnpm prod` | `turbo run start --filter=@scandihaven/web` | Storefront prod `:3000` (needs prior `build`). |
| `pnpm prod:admin` | `turbo run start --filter=@scandihaven/admin` | Admin prod `:3001`. |
| `pnpm lint` | `turbo run lint` | ESLint 9 flat per workspace |
| `pnpm typecheck` | `turbo run typecheck` | `tsc --noEmit` per workspace |
| `pnpm test` | `turbo run test` | Vitest suites (`commerce --coverage` gates 90%/85%). Real-PG suites auto-skip unless `DATABASE_URL` localhost; `pnpm db:setup` before them in CI. |
| `pnpm e2e` | `turbo run e2e` → `playwright test --project=chromium` | E2E headed vs `apps/web`; `E2E_BASE_URL` to target running server |
| `pnpm db:setup` | `db:migrate && db:seed` | Fresh container init (idempotent) |
| `pnpm db:migrate` / `db:seed` / `db:reset` / `db:generate` | `drizzle-kit migrate` / seed / drop+recreate / generate | `db:generate` after `packages/db/src/schema/*.ts` edits; review SQL before `db:migrate` |
| `pnpm --filter @scandihaven/web seed:admin` | `apps/web/scripts/seed-admin.ts` | Provision test admin — requires `SEED_ADMIN_PASSWORD` env (no default) |

Order matters: `pnpm lint typecheck test build` works without DB; with local PG up, `pnpm db:setup` **before** test steps that need DB (CI does `migrate+seed` before Unit tests, then E2E needs migrated+seeded DB). Build order: `install → lint/typecheck → db:setup → test → build → e2e` — the only order that keeps integration suites and E2E hermetic.

### 10.3 Code Style Rules

| Rule | Enforcement |
|---|---|
| **Strict TS** `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` + `isolatedModules` + `noUnusedLocals` | `tsconfig.base.json` + `pnpm typecheck` |
| **No `any`** — use `unknown` + narrow; prefer `interface` over `type`, `import type` for type-only | ESLint `no-explicit-any` **error** |
| **Early returns; composition > inheritance; self-documenting** | Review |
| **Every list has empty state; every async region declares loading/empty/error/success; buttons `disabled` during async + visible busy state; `onError` with feedback** | Review + component audit |
| **No `console.log`** — `warn/error/info` allowed; `catch(() => null)` needs sibling `console.error` with context | ESLint + review |
| **`ActionResult<T>`** `({ ok: true, data } \| { ok: false, error {code, message, fieldErrors?} })` — never throw across action boundary; catch once, log with `requestId`, return `{code INTERNAL}` | `packages/commerce/src/result.ts` + `result.test.ts` |
| **AV source only in adapters** — `Search/Consent/Tax/Shipping/Email/JobRunner` ports in `providers.ts` | Review + `rg stripe\|resend` outside adapters |
| **44px primary touch targets; `prefers-reduced-motion` respected; `axe serious/critical = 0`** | Tokens + Playwright `axe` |

### 10.4 Git Workflow

| Convention | Rule |
|---|---|
| **Branch** | `main` trunk; short-lived `feat/…`, `fix/…` merged via PR (4-person team). |
| **Commits** | Conventional Commits, atomic scope: `feat(cart): merge guest cart on login`. Never bundle unrelated changes. |
| **Secrets** | Never commit `.env*` (except `.env.example`), keys, test creds. `.env`/`docs/bak.env` were git-tracked once (audit C2, commit `262d3cc` re-exposure) — untracked now; **rotate any value that was exposed in a deployed env** (`README.md` warning, `C2r`). `pnpm-lock.yaml` only via `pnpm add/update`. |
| **Quality before push** | `pnpm lint typecheck test build` green; money/auth/order slices need `docs/verification-ledger.md` entry (`Verified/Reasoned/Unverifiable`). No `any` and no skipped tests. Remaining stubs still name FR IDs so nothing is silently missing (§12.2 traceability). |




## 11. Known Issues & Outstanding Tasks

> Priority reflects pre-launch blocking vs post-launch debt. Source: `docs/audits/2026-09-10-prd-alignment/REPORT.md §4 Top 10 Risks` + `docs/audits/2026-09-09-code-review-security-audit` + `docs/plans/2026-09-10-live-e2e-remediation*`. Every row names its FR/NFR so nothing is silently missing — stubs per `PRD §12.2` traceability.

| Priority | Issue | Impact | Status | FR / NFR | Remediation slice |
|---|---|---|---|---|---|
| **CRITICAL** | `sitemap.ts` + `robots.ts` absent (daily weights + image entries, disallow `/admin,/account,/cart,/checkout,/search,/api`) | Indexability — crawlers miss catalog or index blocked surfaces | **Open — P0** | §11.1, §11-sitemap, §11-robots | `R-SEO-1` (M, 1–3d) |
| **CRITICAL** | Facet URL `≥2 facets → noindex,follow` + `?page=N` `rel next/prev` + self-canonical `0/1-curated` not emitted | Crawl budget + index bloat — every filter combo indexed | **Open — P0** | FR-203 §11.1, §11-facet-indexing | `R-SEO-1` |
| **CRITICAL** | `/search?q=` results page absent (typeahead API exists, page does not) | Search journey break | **Open — P0** | FR-106 §8.8 | `R-SEO-2` (M) |
| **CRITICAL** | `product.search_vector tsvector + GIN` table + trigger absent | Search drifts — `websearch_to_tsquery` + `ILIKE` only, no vector maintained | **Open — P0** | §7.3 §8.8-search-stack | `R-DB-1` (S) |
| **HIGH** | Missing `CHECK` constraints (`amount>=0`, `qty 1..99`, `rating 1..5`, `alt<>''`) + `category.parent FK` + `updated_at $onUpdate` + promotion partial uniques | Data integrity — app guards exist but DDL should enforce | **Open — P0** | §7.2–§7.5, §7.9, §7.8 | `R-DB-2` (M) |
| **HIGH** | `two_factor` table + Better-Auth twoFactor plugin + proxy `/admin` second-factor gate missing (Owner/Admin password-only) | Account takeover — admin `role` enumeration | **Open — P1** | §7.8, §9.2, §9-2FA | `R-SEC-1` (M) — do not launch admin without |
| **HIGH** | File uploads (trade cert, return photo, review photo): allow-list/size caps/random keys/signed URLs absent | Stored XSS / path traversal | **Open — P1** | §9-upload, FR-901/912 | `R-SEC-2` (M) |
| **HIGH** | Inventory reservation not two-phase — `qty_reserved` never written; single-step `qty_on_hand-=qty`, arbitrary warehouse pick | Oversell window under concurrent webhooks — mitigated by `FOR UPDATE` re-check but diverges from §7.6 | **Open — P1** | §7.6 | `R-INV-1` (M) |
| **HIGH** | Faceted PLP UI `FilterPanel`/`SortSelect` + relaxed-facet CTEs + `product_metrics` view for `bestselling` absent | Merchandising — PLP shows unfiltered grid; sort falls through to default | **Open — P1** | FR-202/204, §8.8-catalog-query | `R-SHOP-2` (L) |
| **HIGH** | Search depth: `pg_trgm ≥0.5` union + `search_synonym` expansion (`couch→sofa`) + synonym seed import not wired | Typo tolerance + synonyms silent miss | **Open — P1** | FR-105, §8.8-search-stack | `R-SHOP-1` (S) |
| **HIGH** | Reviews verified-buyer server gate + moderation admin + `+21d` `review_request` job (`delivered_at+21d`) + back-in-stock `≤1/day` batch not wired | Content & retention — unverified reviews pass, no automated solicitation | **Open — P1** | FR-308, FR-913/914 | `R-SHOP-3` (M) |
| **MEDIUM** | Cart `/cart` shipping estimate 500ms postcode + invalid-promo actionable errors; re-validation inline notices not rendered | P2 friction — cart shows stale eligibility silently | **Open — P1** | FR-402/404 §8.5 | `R-CART-1` (M) |
| **MEDIUM** | `TaxProvider` → Stripe Tax binding not done; `order_line.tax` stays `0`; EU inclusive vs US/UK exclusive display incomplete | Cross-border tax — §7.4 lines persist `tax=0` | **Open — P1** | §8.5-tax, §7.11 | `R-CHECK-1` (S) |
| **MEDIUM** | FX `fx_rate numeric(18,8)` writes `"1"` with comment *Phase-1 EUR-only*; `NEXT_PUBLIC_SITE_URL` localhost fallback warning is E2E-8 fix but no regional picker | Multi-region `USD/DKK/SEK/GBP` not charged | **Deferred by design** | §8.5-FX, FR-505, PRD §7.10 | Phase 1 slice (when swap trigger fires) |
| **MEDIUM** | `hreflang EN/da/de/sv + x-default` + `next-intl` prefix + `product_locale` translation tables absent; `FEATURE_I18N=on` but wiring deferred | Regional SEO + localized editorial | **Open — P1** | §11-hreflang, §11-i18n | `R-SEO-3` (L) or document flag as deferred posture |
| **MEDIUM** | `s/magic-link` + `zxcvbn≥3` + Google/Apple OAuth allow-listed redirects + profile/addresses/wishlist/sessions UI | Account depth — only `minPasswordLength 10` enforced | **Open — P1/P2** | FR-601/609 §9-auth | `R-AUTH-1` (L) |
| **MEDIUM** | Admin content lifecycle (journal/collections/static/nav/announcement) `revalidateTag` + scheduling + 301 loop detection + 404 top-N absent; order list filters (status/date/channel/value/country), `split-ship`, `capture/refund`, CSV import, reporting | Back-office completeness — dashboard only all-time `totalEur` + counts, no filters | **Open — P2** | FR-805/706/806/807/809/812/913 | `R-ADMIN-1` (L) + `R-ADMIN-2` (L) |

> **Deferred-by-design (not a gap, Phase 5 per PRD §11):** Gift cards / Net-30 invoicing / bulk pad (trade), subscriptions/Q+2-3, AR — schema-ready (`variant_price.tradeAmount`, `gift_card`, `payment_terms`) but UI deferred with `FEATURE_GIFT_CARDS=off FEATURE_TRADE=off`. Link to `docs/traceability.md` for FR-level status.

---

## 12. Key Files Reference

| File | ~Lines | Purpose |
|---|---|---|
| `PRD.md` | 1112 | Authoritative spec — FR-100…FR-999, §7 DDL, §8 contracts, §9 security, §11 SEO, §13 rollout, §15 agent operating contract |
| `Project_Architecture_Document.md` | This file | Single as-built source of truth — companion to `PRD.md` |
| `packages/commerce/src/checkout-service.ts` | ~700 | Cart totals (eligible promos) + `createPaymentIntent` (server re-derive + `idempotencyKey`) + `placeOrderFromWebhook` TX (`webhook_event` inside, re-verify `AMOUNT_MISMATCH→review`, `FOR UPDATE` inventory, `pg_advisory_xact_lock` order-number, outbox `job` enqueue) |
| `packages/commerce/src/pricing.ts` | 250 | Pure pricing: `computeSubtotal`, `selectBestPromotion` (cap at `subtotal`), `resolveTierValue` (highest qualifying), `distributeDiscount` (BigInt largest-remainder), `computeCartTotals` — property-tested |
| `packages/commerce/src/order-state.ts` | 95 | `transition(current, event)` sole writer → `InvalidOrderTransition`; `ORDER_STATUSES 11` / `ORDER_EVENTS 11` / `TRANSITIONS` / `TERMINAL` |
| `packages/commerce/src/cart-service.ts` | ~450 | `sh_cart` HMAC `BETTER_AUTH_SECRET≥32` + `timingSafeEqual` + `createCartToken/verifyCartToken` + `ensureCart(token)` + `addLine` dedupe `5*60_000` + `getCartDto` per-read `filterEligiblePromotions` |
| `packages/commerce/src/jobs.ts` | ~180 | `PgJobRunner` — `enqueue` `onConflictDoNothing` + `drain` (`SKIP LOCKED`, `0.5·2^n`, `dead`, `50` batch, concurrent-safe) |
| `packages/commerce/src/providers.ts` | 210 | `Search/Tax/Shipping/Email/JobRunner` ports — `SearchProvider.search({q,locale,limit ≤10})` + `ConsentProvider {load/has/grant/revoke/onChange}` |
| `packages/commerce/src/money.ts` | 60 | `assertMinor`, `roundHalfUp`, `sumMinor`, `convertFromEur` (bounded float `parseFloat`→`roundHalfUp`), `formatMinor` — integer minor-unit discipline |
| `packages/db/src/schema/catalog.ts` | 303 | `category/product/product_variant/.../inventory/*`, `collection`, `review`, `back_in_stock_request`, `product_locale` — single DDL source |
| `packages/db/src/schema/orders.ts` | 275 | `cart/cart_line/cart_promotion/order/order_line/order_address/payment/shipment/return` + `number SH-YYYY-` + `fx_rate numeric(18,8)` |
| `packages/db/src/schema/ops.ts` | 148 | `audit_log`, `webhook_event UNIQUE`, `job idempotency_key UNIQUE`, `rate_limit_hit PK(bucket,window_start)`, `redirect UNIQUE`, `newsletter citext`, `fx_rate` |
| `packages/db/src/client.ts` | 124 | Lazy-Proxy pooled `Pool` on `globalThis` (HMR+prod singleton) — C1 fix |
| `packages/auth/src/rbac.ts` | 78 | `ROLES 7` × `PERMISSIONS 15` `MATRIX` + `can()`/`canAny()` + `parseRoles()` — single authorization source |
| `packages/auth/src/trusted-origins.ts` | ~50 | `requestOriginFromHeaders()` — `x-forwarded-host/host/x-forwarded-proto` only, never `Origin`/`Referer` (H-AUTH pure seam, tested) |
| `packages/auth/src/server.ts` | 100 | Better-Auth `Drizzle adapter` + `admin` plugin (`role/banned`) + per-request `trustedOrigins` via header-derived origin |
| `packages/ui/src/tokens.css` | 90 | `@theme` literal hex `bg #faf7f2 muted #6F665C accent-2 #8F4326` (no `var()` chains — NFR-STACK-8), radii, motion `cubic-bezier(.22,1,.36,1)` + durations |
| `packages/config/src/flags.ts` | 60 | `FLAG_NAMES 5`, `FLAG_DEFAULTS off/off/true/true/off`, `parseFlags()` (unknown `FEATURE_*` → throw), `isFlagEnabled` |
| `packages/config/src/security-headers.ts` | 35 | `securityHeaders()` — `HSTS 63072000 preload` + `CSP js.stripe.com + static.cloudflareinsights.com` + `XCTO nosniff` etc. |
| `packages/config/src/env.ts` | ~50 | `parseServerEnv()` Zod — every env var fail-fast, unknown `FEATURE_*` blocked |
| `apps/web/src/proxy.ts` | 30 | `proxy()` — `securityHeaders()` every response + `x-request-id` + matcher inline literal pinned by `proxy-matcher.test.ts` (H-1 bare `products` fix) |
| `apps/admin/src/proxy.ts` | 35 | Auth bounce to `/sign-in?redirect=…` + `isSignInPath()` (`/sign-in` + `/admin/sign-in` pass-through H2-ADMIN) + `securityHeaders()` every response (H5d) |
| `apps/web/src/app/api/webhooks/stripe/route.ts` | ~60 | Stripe signature 300s → `placeOrderFromWebhook` TX (`webhook_event` inside) → `200` only after commit |
| `apps/web/src/app/api/jobs/run/route.ts` | ~50 | `CRON_SECRET timingSafeEqual` gate → `PgJobRunner.drain()` |
| `packages/commerce/src/rich-text.ts` | 50 | `sanitizeHtml` allow-list + `safeJsonLd` `<>`+`U+2028/29` breakout guard |
| `apps/web/src/app/products/[slug]/page.tsx` | ~200 | PDP RSC — `generateMetadata` canonical + OG + JSON-LD via `safeJsonLd`, `revalidate 300`, variant swatches, `default variant` price CTE (E2E-4) |
| `apps/web/src/components/checkout-flow.tsx` | 140 | `loadStripe` + `useStripe().confirmPayment` (React 19+v6) + actionable `RATE_LIMITED` + `retry` + preserved form |
| `packages/email/src/send.ts` | 40 | `renderEmailHtml()` `/* turbopackIgnore: true */ "react-dom/server"` runtime import + Resend/log transport |
| `turbo.json` | 25 | `globalEnv [DATABASE_URL … DISABLE_IMAGE_OPTIMIZER]`, `tasks.build.dependsOn ^build`, `outputs [.next/**]` |
| `docker-compose.yml` | 35 | `postgres:17-alpine scandihaven_postgres postgres_data scandihaven_net PGDATA pgcrypto+pg_trgm` |
| `start_server.sh` | ~180 | `ensure_env` (quoted `.env` line 21) → `docker compose up -d` `pg_isready` → `db:setup` → `build` → `prod :3000/:3001` health+CSP gate |
| `docs/audits/2026-09-10-prd-alignment/REPORT.md` | 800+ | 240-finding alignment audit — 7 domains, 11 Risks, P0/P1/P2 backlog `R-SEO-*/R-DB-*/R-SEC-*/R-SHOP-*` |
| `docs/traceability.md` | 500+ | FR→locus→verification→status (Aligned/Partial/Missing/Stub) per PRD §12.2 |

---

## 13. Glossary

| Term | Meaning |
|---|---|
| **AOV** | Average order value (target ≥€420 `PRD §2.4`) |
| **CR** | Conversion rate cold-traffic → paid order (target ≥2.4%) |
| **PLP / PDP** | Product Listing / Product Detail Page (`FR-200s` / `FR-300s`) |
| **GMV** | Gross merchandise value (€5M+ annual target, PRD §2) |
| **`sh_cart` token vs `cart` UUID** | `sh_cart` HMAC token (`value.hmac` signed with `BETTER_AUTH_SECRET ≥32`) is the **browser-held token**; `cart.id UUID` is the **row identity** (`cart.token` holds the token string). `getCartId()` verifies then resolves token→UUID; `ensureCart(token)` keys on token. Never interchange (H1-CART). |
| **ActionResult<T>** | Server Action envelope (`{ ok: true, data } \| { ok: false, error: { code, message, fieldErrors? } }`, `ErrorCode 9`) — never throw across boundary (`PRD §8`). |
| **`PgJobRunner`** | Outbox drainer — `FOR UPDATE SKIP LOCKED` + `0.5·2^n` backoff + `dead` + `50` batch + concurrent-safe (`jobs.ts`). |
| **`product_metrics`** | Materialized view (not yet: `R-SHOP-2`) for `bestselling` sort (trailing 30d units, 15-min refresh via jobs). Currently falls through to `sort_order`. |
| **`safeJsonLd` / `sanitizeRichText`** | `rich-text.ts` — allow-list `sanitize-html` + `<>` + `U+2028/29` guard; every `dangerouslySetInnerHTML` passes here. |
| **NFR-STACK-1..11** | PRD §3.3 governance: 7 `@source`, 8 `@theme` literal, 9 page-export whitelist, 10 async `params`, 11 `globalEnv` + `turbopackIgnore`. |
| **R-*** | Backlog IDs (§11): `R-SEO-*` SEO, `R-DB-*` DDL, `R-SEC-*` security, `R-SHOP-*` merchandising, `R-CART-*` cart, `R-CHECK-*` checkout, `R-ADMIN-*` back-office, `R-INV-*` inventory, `R-AUTH-*` auth depth. |
| **H-AUTH / H1-CART / H2-ADMIN / H4d / H5d / H6d / E2E-1..8** | Audit tags (2026-09-09 2C/9H + 2026-09-10 E2E round-3): `H-AUTH` localhost origin, `H1-CART` token→UUID, `H2-ADMIN` `/admin` rewrites, `H4d` webhook atomicity, `H5d` `securityHeaders()` on `/sign-in`, `H6d` `rg` inversion, `E2E-1` stale-chunk reload, `E2E-2` price scoping, `E2E-3` promo per-read, `E2E-4` default-variant price, `E2E-7` beacon CSP, `E2E-8` `NEXT_PUBLIC_SITE_URL` warning. |
| **`pg_advisory_xact_lock`** | Transaction-scoped advisory lock (`hashtext('seed')` / `hashtext('order_number:YYYY')`) — serializes `ensureSeeded` and `order.number` without table locks. |
| **PITR / RTO / RPO** | Point-in-time recovery / Recovery Time/Point Objective (PITR + daily snapshots, 30-day, `RTO 4h / RPO 15m`, quarterly drill — PRD §11.4). |

> **End of PAD v1.0 — Definitive, Production-Locked Blueprint (2026-09-10).**
> This document is **as-built**. Propose changes as versioned revisions with `[TAG]` entries. A change without an ADR cannot ship.

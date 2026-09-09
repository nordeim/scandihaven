---
IMPORTANT: File is read fresh for every conversation. Be brief and practical.
project_type: nextjs-monorepo
version: 1.0.0
last_updated: 2026-09-09
---

# Scandi Haven — E-Commerce Monorepo

Direct-to-consumer e-commerce platform for a Scandinavian furniture/textiles brand: storefront (Next.js 16), admin back-office (Next.js 16), custom commerce engine on PostgreSQL 17 + Drizzle ORM. Maintained by a four-person product-engineering team. The authoritative specification is `PRD.md` v4.0 (requirement IDs FR-100…FR-999, cross-cutting contracts in §4.8, agent operating contract in §15); code stubs reference the FR IDs they belong to.

**Stack**: PNPM 10 workspaces · Turborepo 2 · Next.js 16.3 (App Router, Turbopack, `proxy.ts`) · React 19.2 · TypeScript 5.9 (strict) · Tailwind CSS v4 (CSS-first `@theme`) · shadcn-style components on Radix · PostgreSQL 17 · Drizzle ORM 0.45 · Better-Auth 1.7 · Zod v4 · Zustand v5 · Stripe · ESLint 9 (flat config) · Vitest + Playwright.

## Foundational Principles

### Workflow for all implementation tasks

1. **ANALYZE** — Read the relevant `PRD.md` section and existing code in full before writing. Identify the FR IDs that govern the change.
2. **PLAN** — State the smallest correct implementation path; name the packages/files touched.
3. **VALIDATE** — Confirm scope for anything touching money, auth, or order state before coding.
4. **IMPLEMENT** — Modular, typed, test-backed increments. Domain logic in `packages/commerce` (pure), UI in `packages/ui`, app wiring in `apps/*`.
5. **VERIFY** — Run the full gate: `pnpm lint typecheck test build`; migrate+seed a fresh DB; `pnpm e2e`. Claims of "works" require executed evidence.
6. **DELIVER** — Note what was verified, what was not, and any deferred work.

### Project-specific principles

- **Correctness & security outrank velocity.** No placeholder values, no unverified library APIs, no weakening of type/lint gates to pass a build.
- **Money is integers.** All amounts are integer minor units; arithmetic in `packages/commerce` uses BigInt where division occurs. Never introduce floats into money paths.
- **Server is the source of truth.** RSC props drive UI; Zustand stores hold only drawer/UI state. Prices and totals are re-derived server-side on every mutation.
- **Evidence-based verification.** Label claims Verified / Reasoned / Assumed. If it wasn't executed, say so.

## Implementation Standards

### TypeScript (strict, enforced)

- `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` are on. `any` is an ESLint **error** — use `unknown`.
- Prefer `interface` for object shapes, `type` for unions; inline `import type` for type-only imports.
- All Server Actions return `ActionResult<T>` from `@scandihaven/commerce/result` — `{ ok: true, data } | { ok: false, error }`. Never throw across the client boundary.

### Next.js 16 specifics

- `proxy.ts` replaces `middleware.ts` (both apps have one; storefront sets security headers, admin gates `/`).
- `params`, `searchParams`, `cookies()`, `headers()` are **async** — always `await`.
- Page files export only `default` + `metadata`/`generateMetadata`/`revalidate`/`dynamic`. Extra exports break the build.
- Server Components by default; `"use client"` only for interactive leaves. Mutations via Server Actions in `src/actions/`, not route handlers.
- Caching: PLP/PDP ISR `revalidate: 300` + tag invalidation; cart/checkout/account/admin `force-dynamic`.

### Tailwind v4 (CSS-first — no tailwind.config.js)

- Design tokens live in `packages/ui/src/tokens.css` `@theme` block (PRD §10.1). shadcn semantic tokens (`--color-primary`, `--color-secondary`, …) are **literal hex** — a var() chain inside `@theme` is dropped by the current build; keep them in sync with the palette block.
- `@source "../../../../packages/ui/src";` in each app's `globals.css` is **load-bearing** — without it, utilities used only in the UI package are never generated.
- Colors must meet WCAG 2.2 AA (4.5:1 body, 3:1 large); the axe E2E scan enforces serious/critical = zero.

### Data layer (Drizzle + PostgreSQL 17)

- Schema: `packages/db/src/schema/*.ts` (PRD §7). After edits: `pnpm db:generate`, review the SQL, prepend `CREATE EXTENSION IF NOT EXISTS citext` / `pg_trgm` / `pgcrypto` if needed (local DB already has `pgcrypto`+`pg_trgm` via `infrastructure/postgres/init/00-create-extensions.sql`, `citext` via migrations), then `pnpm db:migrate`.
- Migrations are forward-only and never hand-edited except for the extension preamble. Seed is idempotent (`ensureSeeded()`), advisory-locked, and refuses non-local hosts.
- Multi-row invariants (order placement, inventory reservation) run in `db.transaction()` with `SELECT … FOR UPDATE`. Order status changes only via `commerce/order-state.ts transition()`.

## Development Workflow

### Environment Setup

**Fresh clone (one command):** `./start_server.sh` — handles `.env` creation (quoted `BETTER_AUTH_SECRET`/`EMAIL_FROM` line 21 fix), `sudo docker compose up -d` with health wait, `pnpm db:setup` (migrate+seed, idempotent), `pnpm build`, and both `pnpm prod` `:3000` + `pnpm prod:admin` `:3001` with health checks. Use `DB_RESET=1 ./start_server.sh` for a clean DB. See `start_server.sh` header for phases. Logs: `server.log` / `server-admin.log`.

**Manual (step-by-step):**
```bash
pnpm install
docker compose up -d                  # PostgreSQL 17 (postgres:17-alpine, service `postgres` → scandihaven_postgres, healthy in ~10s; logs: docker compose logs -f postgres)
cp .env.example .env                  # fill BETTER_AUTH_SECRET (openssl rand -base64 32), CRON_SECRET
pnpm db:setup                         # schema + demo catalog (migrate && seed) — fresh container
pnpm dev                              # storefront :3000  (pnpm dev:admin → :3001)
```

### Build Commands

| Command | Purpose |
|---|---|
| `pnpm dev` / `pnpm dev:admin` | Dev servers (storefront :3000 / admin :3001) |
| `pnpm build` | Production builds (Turbopack) |
| `pnpm lint` | ESLint 9 flat config (apps add `next/core-web-vitals` + `next/typescript`) |
| `pnpm typecheck` | `tsc --noEmit` per workspace |
| `pnpm test` | Vitest (commerce coverage gates: 90% lines / 85% functions on pure domain modules) |
| `pnpm e2e` | Playwright Chromium (needs migrated+seeded DB; `E2E_BASE_URL` to target a running server) |
| `pnpm db:setup` | Fresh DB init (`db:migrate && db:seed`) |
| `pnpm db:migrate` / `db:seed` / `db:reset` / `db:generate` | Database lifecycle |
| `./start_server.sh` / `DB_RESET=1 ./start_server.sh` | Fresh-clone prod boot (both apps) — `ensure_env` → `ensure_postgres` → `db:setup` → `build` → `prod` `:3000` + `prod:admin` `:3001`; logs `server.log`/`server-admin.log`, PIDs `server.pid`/`server-admin.pid` |
| `pnpm seed:admin` | Test admin (`SEED_ADMIN_PASSWORD` required — no default credentials exist) |

Single test: `pnpm --filter @scandihaven/commerce test -- src/pricing.test.ts`. Single E2E: `pnpm e2e -- -g "cart page"`.

## Testing Strategy

| Level | Tool | Location | Notes |
|---|---|---|---|
| Unit/property | Vitest + fast-check | `packages/*/src/*.test.ts` | Pricing invariants, promotion engine, order state machine, RBAC, schema shape |
| E2E + a11y | Playwright + @axe-core/playwright | `apps/web/e2e/` | Guest purchase path, cart persistence, 404, axe serious/critical = zero on key routes |
| Security | pnpm audit, secret scan | CI | `pnpm audit --audit-level high` |

- Import `describe/it/expect` from `vitest` explicitly (no globals); property tests use `fc.assert(fc.property(...))` inside vitest `it`.
- E2E must never fake payment: without Stripe test keys the suite asserts the explicit "not configured" notice.
- A red test is a regression or a wrong test — never skip to pass.
- Admin routes render through the `(staff)` route-group layout (gate + chrome); `/sign-in` stays outside it — a layout-level redirect to `/sign-in` that also wraps `/sign-in` loops forever (audit 2026-09-09 H7d).

## Code Quality Standards

- Boundary lint rules: apps import packages, never the reverse; no deep imports into package internals.
- No `console.log` (ESLint allows warn/error/info); caught errors are logged with context — silent `catch(() => null)` needs a paired `console.error`.
- UI: handle loading/empty/error states explicitly; 44px primary touch targets; `prefers-reduced-motion` respected (tokens expose `--ease-brand`, four durations only).
- Accessibility: axe serious/critical violations block; alt text mandatory on all media rows (enforced by schema).

## Git & Version Control

- Branch `main`; short-lived feature branches (`feat/…`, `fix/…`) merged via PR when the team workflow applies.
- Conventional Commits, atomic scope: `feat(cart): merge guest cart on login`. Never bundle unrelated changes.
- Never commit `.env*` (except `.env.example`), keys, or test credentials. `.env`/`.env.local` were found git-tracked with real secrets on 2026-09-09 (audit C2) — untracked then; **rotate the exposed values in any deployed environment**. `pnpm-lock.yaml` changes only via `pnpm add/update`.

## Error Handling & Debugging

- Unexpected errors in actions are caught once at the boundary, logged with a correlation ID, and returned as `{ ok: false, error: { code: "INTERNAL" } }` — internals never reach the client.
- Stripe webhooks: verify signature → insert `webhook_event` INSIDE the placement transaction (unique Stripe event ID = idempotency; audit 2026-09-09 H4d — a pre-committed event row turned Stripe retries into silent no-ops on placement failure) → handle → outbox `jobs` rows; a mismatch/stock failure places the order in `review` with a `payment_orphan` alert (§8.7) instead of throwing. `/api/jobs/run` (CRON_SECRET) drains with retry.
- Debugging order: reproduce with the exact command → read the server log → isolate with a minimal repro → fix root cause (e.g., the token-vs-UUID cart bug and the Tailwind `@source` gap were both found this way; see git history for the fix shape).

## Project-Specific Standards

### Architecture

```
apps/web      Storefront: home, PLP, PDP, cart, checkout (Stripe Payment Element), account
apps/admin    Back-office: dashboard, products, orders (RBAC-gated, audit-logged)
packages/
  db          Drizzle schema (PRD §7, ~40 tables), pooled client, idempotent seed
  auth        Better-Auth instance + RBAC matrix (single source; requirePermission() gates)
  commerce    Pure domain: money/pricing/promotions/order-state + DB services (catalog/cart/checkout)
  ui          Design system: tokens.css (@theme) + Radix primitives + composites
  email       React Email templates; Resend or log transport
  config      Shared tsconfig, ESLint factory, Zod env parser
  infrastructure/postgres/init  PG extensions (pgcrypto, pg_trgm) seeded on first `docker compose up`
```

Dependency direction `db ← auth ← commerce ← apps` — cycles break the turbo graph (symptom: builds that silently do nothing).

### Environment Variables

| Variable | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 17 connection | App role should lack DDL in production |
| `BETTER_AUTH_SECRET` | Auth + cart-cookie HMAC | ≥ 32 chars; required or boot fails |
| `BETTER_AUTH_URL` | Canonical auth origin | **Must be the public origin in production** — localhost behind a reverse proxy broke live sign-in ("Invalid origin", audit 2026-09-09 H-AUTH); the served origin is additionally derived from proxy headers, and `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated) allow-lists extras |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Payments (test mode in dev) | Unset → honest "not configured" checkout state |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email | Unset → log transport |
| `CRON_SECRET` | Protects `/api/jobs/run` | Outbox drainer |
| `DISABLE_IMAGE_OPTIMIZER` | Local/E2E image pipeline off | Listed in turbo.json `globalEnv` |

### Version-Specific Notes

- **Next.js 16.3**: `proxy.ts` over `middleware.ts`; async request APIs; page-file export whitelist.
- **react-stripe-js v6**: `stripe.confirmPayment()` via `useStripe()` — not a module export.
- **Tailwind v4.3**: `@theme` var() chains dropped; `@source` directives required for workspace-package classes.

## Anti-Patterns to Avoid

- Adding a build step to `packages/*` (they are consumed as TS source by design).
- Hand-editing `package.json`/`pnpm-lock.yaml` after bootstrap — use `pnpm add`/`pnpm update`.
- Client-side global data fetching (no REST/tRPC layer exists; Server Actions only).
- Float arithmetic on money; string concatenation into SQL (`sql.raw` is banned).
- Creating REST endpoints for UI mutations; Route Handlers are for machine callers only.
- Speculative config/flags nothing calls for — every stub names its FR ID from `PRD.md`.

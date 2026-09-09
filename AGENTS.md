# AGENTS.md

Instructions for AI coding agents working in this repository. Every line here answers: "would you get this wrong without being told?" Verified against the toolchain on 2026-09-09.

## Commands

Run from the repo root unless noted. PNPM 10 + Turborepo 2 — always use `pnpm`, never `npm`/`yarn`.

| Command | What it does |
|---|---|
| `pnpm dev` | Storefront dev server on :3000 (Turbopack) |
| `pnpm dev:admin` | Admin dev server on :3001 |
| `pnpm build` | Production build of both apps (Turbopack) |
| `pnpm prod` | Storefront prod server on :3000 — requires prior `pnpm build` |
| `pnpm prod:admin` | Admin prod server on :3001 — requires prior `pnpm build` |
| `pnpm lint` / `pnpm typecheck` | ESLint 9 flat / `tsc --noEmit` per workspace |
| `pnpm test` | Vitest unit suites + real-PG integration suites (auto-skip unless `DATABASE_URL` points at localhost; commerce coverage gates: 90% lines / 85% functions on pure domain modules) |
| `pnpm e2e` | Playwright, Chromium project, against `apps/web` |
| `pnpm db:setup` | `db:migrate && db:seed` — fresh container init (migrate + idempotent seed, local hosts only) |
| `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:reset` | drizzle-kit migrate / idempotent seed / drop+recreate (local hosts only) |
| `pnpm db:generate` | Regenerate drizzle migrations after schema edits |
| `pnpm --filter @scandihaven/web seed:admin` | Provision test admin; **requires** `SEED_ADMIN_PASSWORD` env (no default credentials exist). Lives in `apps/web` — there is no root alias |

Order matters for a clean check: `pnpm lint typecheck test build` works without a database (real-PG integration suites auto-skip unless `DATABASE_URL` points at localhost). With a local PG up, run `pnpm db:setup` (`db:migrate && db:seed`) BEFORE `pnpm db:setup`-dependent steps — CI runs migrate+seed before Unit tests so the integration suites execute, then E2E needs a migrated+seeded DB.

## Architecture invariants

- **Turborepo internal-packages pattern**: `packages/*` ship TypeScript source directly (`exports` → `src/*.ts`); apps compile them via `transpilePackages` in `next.config.ts`. There is no package build step — don't add one.
- **Dependency direction is enforced**: `apps/* → packages/*`; inside packages `db ← auth ← commerce ← apps`. `packages/ui` depends only on React/Radix/Tailwind (no commerce import — use structural prop types). `packages/db` must not import `auth`/`commerce` (workspace cycles break the turbo graph silently — a build that "does nothing" is the symptom).
- **Data access**: RSC pages call `@scandihaven/commerce/*` query functions; mutations go through Server Actions in `apps/*/src/actions/*` that return the `ActionResult<T>` union from `@scandihaven/commerce/result` — never throw across the action boundary.
- **Route Handlers** exist only for Stripe webhooks (`/api/webhooks/stripe`), Better-Auth (`/api/auth/[...all]`), typeahead search, jobs runner, and health. Don't add REST endpoints for UI mutations.

## Framework quirks (verified the hard way)

- **Next.js 16**: `proxy.ts` replaces `middleware.ts`; `params`, `searchParams`, `cookies()` are async — always `await`. Page files may export only `default`, `metadata`/`generateMetadata`, `revalidate`, `dynamic` — extra exports fail the build.
- **Tailwind v4**: CSS-first config — tokens live in `packages/ui/src/tokens.css` under `@theme`; there is no `tailwind.config.js`. Two hard-won rules:
  1. **`@theme` var() chains are dropped** by the current build — shadcn semantic tokens (`--color-primary`, `--color-secondary`, …) are literal hex values; keep them in sync with the palette block above them.
  2. **Auto content-scan does not reach `packages/ui`** — `@source "../../../../packages/ui/src";` in each app's `globals.css` is load-bearing. Without it, classes used only inside the UI package (`bg-secondary`, `bg-primary`, `hover:bg-bg-3`) silently never generate CSS.
- **Turborepo env passing**: env vars read inside `next.config.ts` (e.g. `DISABLE_IMAGE_OPTIMIZER`) must be listed in `turbo.json` `globalEnv` or turbo strips them from build tasks.
- **Boot validation**: each app's `src/instrumentation.ts` runs `parseServerEnv()` + `parseFlags()` when the server starts — missing required env or an unknown `FEATURE_*` var fails fast with an actionable message (PRD §9.4).
- **Proxy convention location**: `proxy.ts` lives at `apps/*/src/proxy.ts` — Next 16.3 discovers it at the parent of the app dir, so a repo-root (`apps/web/proxy.ts`) placement compiles but is silently never registered (headers/gate never ran; audit 2026-09-09 H8d). The `config.matcher` MUST stay an inline literal (Next statically parses it); its semantics are pinned by `apps/web/src/lib/proxy-matcher.test.ts`.
- **CI secret scan**: `rg` exits 0 on a MATCH — the gate must be `if rg …; then fail; else clean; fi`; the old `&& echo clean || fail` chaining inverted it (audit 2026-09-09 H6d).
- **Build-time env**: `next build` imports the auth route (`/api/auth/[...all]`), which constructs the Better-Auth instance and therefore the db client — builds require `DATABASE_URL` + `BETTER_AUTH_SECRET` to be set (same values as CI/§13.4).
- **Image optimizer**: `DISABLE_IMAGE_OPTIMIZER=1` (local/E2E) serves images unoptimized — the sharp pipeline can deadlock in constrained sandboxes. Production keeps optimization on.
- **React 19 + react-stripe-js v6**: `confirmPayment` is a method on `useStripe()`, not a module export.

## Money & domain rules

- All monetary values are **integer minor units**; floats never touch money (`packages/commerce/src/money.ts`). Discount distribution uses BigInt largest-remainder — property tests in `src/pricing.test.ts` will fail on float drift.
- Order status changes go through `commerce/order-state.ts transition()` only; illegal transitions throw `InvalidOrderTransition`.
- Provider ports live in `@scandihaven/commerce/providers` (Search/Consent/Tax/ShippingRate/Email/JobRunner). Vendor SDKs never leave their adapter; new vendors implement the port (PRD §4.8). Feature flags come from `@scandihaven/config/flags` — unknown `FEATURE_*` env vars fail fast, so add new flags there first.
- `react-dom/server` must never be statically imported in the App Router graph (Turbopack build error). `packages/email/src/send.ts` resolves it at runtime via a `turbopackIgnore` dynamic import — keep that pattern.
- Seeding is idempotent (advisory-lock + natural-key upserts) and **refuses non-local `DATABASE_URL` hosts**.
- Inventory availability = `qty_on_hand − qty_reserved − safety_stock`; made-to-order variants have no inventory rows and are always purchasable.

## Conventions that differ from defaults

- Strict TS everywhere: `noUncheckedIndexedAccess`, `verbatimModuleSyntax`; `any` is an ESLint error — use `unknown`.
- Tests import `describe/it/expect` from `vitest` explicitly (no globals) and `fc` from `fast-check` (fast-check's own `test.prop` is not used — use `fc.assert(fc.property(...))` inside vitest `it`).
- Cart identity: signed HMAC cookie (`sh_cart`, secret = `BETTER_AUTH_SECRET`); the cookie holds a **token**, the DB keys on the cart **UUID** — `getCartId()` in `apps/web/src/lib/cart-session.ts` resolves token→UUID. Actions and pages must not interchange them.
- Admin authorization: single RBAC matrix in `packages/auth/src/rbac.ts`; Server Actions call `requirePermission()` from `apps/admin/src/lib/admin-guard.ts` and write to `audit_log`. No inline role checks.
- Errors caught at page level must be logged, never silently swallowed (`catch(() => null)` needs a `console.error` alongside).

## Environment

`.env.example` documents every variable; secrets are `set-me` placeholders — generate with `openssl rand -base64 32` (auth secret) / `openssl rand -hex 16` (cron). Postgres 17 via `docker compose up -d` (canonical) — service `postgres` (`postgres:17-alpine`, `scandihaven_postgres`, `postgres_data`/`scandihaven_net`, `PGDATA=/var/lib/postgresql/data/pgdata`, init `infrastructure/postgres/init/00-create-extensions.sql` → `pgcrypto`+`pg_trgm`) or any local PG17. `DATABASE_URL=postgresql://scandihaven_user:scandihaven_secret@localhost:5432/scandihaven_dev` — seed/migrate refuse non-local hosts. Stripe runs in test mode without keys — checkout then renders an explicit "not configured" notice; E2E asserts that state rather than faking payment.

## Reference

- `PRD.md` — the authoritative spec (v4.0): FR-100…FR-999 requirement IDs, §4.8 cross-cutting contracts (ports/flags/idempotency), §7 schema, §8 action contracts, §12.6 SLOs, §15 agent operating contract, §13 rollout phases. Stubs in code name their FR ID.
- `docs/audits/2026-09-09-code-review-security-audit/` — tiered code review + security audit (2 Critical / 9 High, evidence-backed, incl. runtime-verified proxy and admin-gate fixes).
- `README.md` — human onboarding (setup, verification, design tokens).

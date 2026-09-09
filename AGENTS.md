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
| `./start_server.sh` | Fresh-clone → prod: `ensure_env` (quoted `.env`) → `sudo docker compose up -d` (pg_isready wait) → `pnpm db:setup` (migrate+seed, idempotent) → `pnpm build` → `pnpm prod` `:3000` + `pnpm prod:admin` `:3001` (kills prior `:3000/:3001`, health checks `/api/health` + CSP/admin gate) — `DB_RESET=1 ./start_server.sh` for drop+recreate; logs `server.log`/`server-admin.log` |
| `pnpm --filter @scandihaven/web seed:admin` | Provision test admin; **requires** `SEED_ADMIN_PASSWORD` env (no default credentials exist). Lives in `apps/web` — there is no root alias |

Order matters for a clean check: `pnpm lint typecheck test build` works without a database (real-PG integration suites auto-skip unless `DATABASE_URL` points at localhost). With a local PG up, run `pnpm db:setup` (`db:migrate && db:seed`) BEFORE `pnpm db:setup`-dependent steps — CI runs migrate+seed before Unit tests so the integration suites execute, then E2E needs a migrated+seeded DB. For a freshly cloned repo with a fresh `postgres` volume, `./start_server.sh` is the canonical one-command path (see README Quick Start); it wraps the same steps with `pg_isready` waits and quoted `.env` handling (line 21 `EMAIL_FROM` fix, 2026-09-10).

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
- **Auth origin trust**: `packages/auth/src/server.ts` derives the trusted origin per request from proxy-controlled headers (`x-forwarded-host`/`host`/`x-forwarded-proto` — never `Origin`/`Referer`, which are attacker-controlled). A localhost-pinned `BETTER_AUTH_URL` behind a reverse proxy broke sign-in on both live apps with "Invalid origin" (audit 2026-09-09 H-AUTH) — the pure seam is `trusted-origins.ts`; don't widen it to read `Origin`.
- **Proxy convention location**: `proxy.ts` lives at `apps/*/src/proxy.ts` — Next 16.3 discovers it at the parent of the app dir, so a repo-root (`apps/web/proxy.ts`) placement compiles but is silently never registered (headers/gate never ran; audit 2026-09-09 H8d). The `config.matcher` MUST stay an inline literal (Next statically parses it); its semantics are pinned by `apps/web/src/lib/proxy-matcher.test.ts`.
- **CI secret scan**: `rg` exits 0 on a MATCH — the gate must be `if rg …; then fail; else clean; fi` (audit 2026-09-09 H6d). `rg` also honors `.gitignore`, so the scan runs with `--no-ignore` — without it, tracked-but-ignored files (`.env`/`.env.local`, re-committed by 262d3cc) are invisible to the gate (audit 2026-09-09 C-CI).
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
- Cart identity: signed HMAC cookie (`sh_cart`, secret = `BETTER_AUTH_SECRET`); the cookie holds a **token**, the DB keys on the cart **UUID** — `getCartId()` in `apps/web/src/lib/cart-session.ts` resolves token→UUID. Actions and pages must not interchange them. Concretely (audit 2026-09-09 round 2, H1-CART): `requireCart()` must return `getCartId()`'s UUID **untouched** — never pass it into `ensureCart()`, which keys on the token and would silently mint a junk cart row (symptom: "Cart line not found" on every qty change, removes that resurrect on reload, second add-to-cart lost). Pinned by `apps/web/src/actions/cart.test.ts` + `apps/web/e2e/cart-flows.spec.ts`.
- Admin authorization: single RBAC matrix in `packages/auth/src/rbac.ts`; Server Actions call `requirePermission()` from `apps/admin/src/lib/admin-guard.ts` and write to `audit_log`. No inline role checks.
- Errors caught at page level must be logged, never silently swallowed (`catch(() => null)` needs a `console.error` alongside).
- **Promotion eligibility is per-read** (audit 2026-09-10 E2E-3): conditions (`minSpendMinor` etc.) checked only at `applyPromotionByCode` time let a below-threshold cart keep its discount through placement. `getCartDto` and `loadCartPromotionApplications` re-validate via `filterEligiblePromotions` on every read/tx — new totals paths must do the same. Don't delete the `cart_promotion` row when ineligible (re-crossing the threshold re-applies it).
- **Card prices come from the default variant** (E2E-4): the cards CTE uses `COALESCE(MAX(amount) FILTER (WHERE is_default), MIN(amount))` — never a bare `MIN`, which advertises the cheapest variant while PDP/quick-add price the default.
- **E2E price assertions must be scoped** (E2E-2, CI was red on every run because of this): the same amount legitimately renders in the line-total span AND the Subtotal/Total `<dd>`s — assert within the order-summary aside or the line group, never page-wide `getByText("€X")`.
- **Canonical/OG/sitemap URLs are absolute and request-scoped** (round 4, R4-6): PDP `generateMetadata` + `app/sitemap.ts`/`app/robots.ts` resolve the origin via `@scandihaven/config/site-url` (`resolveSiteUrl`: env var → proxy-header-derived served origin → localhost). Never emit a metadataBase-relative canonical for the PDP — the static localhost fallback poisoned the live site. `app/search/page.tsx` (FR-106) reuses `listProducts({search})`; new SEO builder logic lives in `apps/web/src/lib/seo.ts` (pure, unit-tested).
- **Secret-scan patterns must tolerate quoted values** (R4-1): the b50c46b `.env` re-exposure slipped past CI because `["\x27]?` was missing around the value classes — when extending the scan, test the pattern against both quoted and bare shapes.
- **Post-auth `?redirect=` params are never trusted raw**: validate through `@scandihaven/config/redirect-path` (`validateRedirectPath`) in both apps — the admin previously pushed the raw value into `router.push` (open redirect).

## Environment

`.env.example` documents every variable; secrets are `set-me` placeholders — generate with `openssl rand -base64 32` (auth secret) / `openssl rand -hex 16` (cron). Postgres 17 via `docker compose up -d` (canonical) — service `postgres` (`postgres:17-alpine`, `scandihaven_postgres`, `postgres_data`/`scandihaven_net`, `PGDATA=/var/lib/postgresql/data/pgdata`, init `infrastructure/postgres/init/00-create-extensions.sql` → `pgcrypto`+`pg_trgm`) or any local PG17. `DATABASE_URL=postgresql://scandihaven_user:scandihaven_secret@localhost:5432/scandihaven_dev` — seed/migrate refuse non-local hosts. Stripe runs in test mode without keys — checkout then renders an explicit "not configured" notice; E2E asserts that state rather than faking payment.

## Reference

- `PRD.md` — the authoritative spec (v4.0): FR-100…FR-999 requirement IDs, §4.8 cross-cutting contracts (ports/flags/idempotency), §7 schema, §8 action contracts, §12.6 SLOs, §15 agent operating contract, §13 rollout phases. Stubs in code name their FR ID.
- `docs/audits/2026-09-09-code-review-security-audit/` — tiered code review + security audit (2 Critical / 9 High, evidence-backed, incl. runtime-verified proxy and admin-gate fixes).
- `docs/audits/2026-09-10-live-e2e-audit/` — live E2E round 3 (checkout stale-chunk crash, CI-red cart specs, promo re-validation, card price, mobile nav FR-102, CSP beacon, canonical boot guard) + remediation plan in `docs/plans/2026-09-10-live-e2e-remediation.md`.
- `docs/plans/2026-09-10-live-e2e-remediation-round4.md` — live E2E round 4 (secrets re-exposure + scan gap, sitemap/robots/search surfaces, absolute canonicals, skills cache hygiene) with the evidence-labelled findings table.
- `README.md` — human onboarding (setup, verification, design tokens).
- `start_server.sh` — fresh-clone → prod bootstrapper (see README Quick Start; `docs/verification-ledger.md` §2026-09-10 Edge 8→0).

---

pnpm install 
cp .env.example .env   # + openssl rand -base64 32 for BETTER_AUTH_SECRET 
pnpm lint && pnpm typecheck && pnpm test   # 8/8, 8/8, 7/7 — commerce 90.79%/89.65% 
DATABASE_URL=… BETTER_AUTH_SECRET=… pnpm build  # 2/2, ƒ Proxy

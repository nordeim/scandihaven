# Docs Update Plan: Sync AGENTS.md / CLAUDE.md / README.md to docker-compose.yml port

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the three onboarding docs so every `docker compose`, `DATABASE_URL`, `postgres` service/volume/network, `postgres:17-alpine`, `PGDATA`, and `infrastructure/postgres/init` reference matches the ported `docker-compose.yml` (scandihaven_postgres, postgres_data, scandihaven_net, PGDATA, pgcrypto+pg_trgm) and the synced `.env.example`.

**Architecture:** Docs-only, no code/runtime changes. Three vertical slices (one per file), each: locate stale lines via `rg`, rewrite to new spec, verify with `rg` clean + `docker compose config` still valid + markdown renders. Keep tone/structure of each doc; do not add new sections beyond a minimal Troubleshooting row.

**Tech Stack:** Markdown, AGENTS.md/CLAUDE.md/README.md conventions, `rg` + `docker compose config` for verification

---

## 0. ANALYZE — What the port changed that docs must reflect

**Ported compose (verified):**
```yaml
services.postgres:
  image: postgres:17-alpine
  container_name: scandihaven_postgres
  environment: { POSTGRES_DB: scandihaven_dev, POSTGRES_USER: scandihaven_user, POSTGRES_PASSWORD: scandihaven_secret, PGDATA: /var/lib/postgresql/data/pgdata }
  volumes: [postgres_data:/var/lib/postgresql/data, ./infrastructure/postgres/init:/docker-entrypoint-initdb.d]
  healthcheck: { test: pg_isready -U scandihaven_user -d scandihaven_dev, start_period: 10s }
  networks: [scandihaven_net]
volumes: { postgres_data: {driver: local} }
networks: { scandihaven_net: {driver: bridge} }
```
`.env.example`: `DATABASE_URL=postgresql://scandihaven_user:scandihaven_secret@localhost:5432/scandihaven_dev` (was `scandihaven:scandihaven@.../scandihaven`)

**Doc audit (full reads 2026-09-08):**

| Doc | Lines mentioning compose/DB | Stale? | What to fix |
|---|---|---|---|
| **AGENTS.md** | `Postgres 17 via docker compose up -d (canonical) or any local PG17` (Environment) | **Partial** — doesn't name service/image/volume, doesn't mention init/PGDATA, doesn't show updated DATABASE_URL | Expand Environment paragraph to name `postgres` service, `postgres:17-alpine`, `postgres_data`/`scandihaven_net`, `PGDATA`, `00-create-extensions.sql` (pgcrypto+pg_trgm). Keep one-paragraph brevity per AGENTS.md style (every line earns its place). Optionally add one-line Troubleshooting row for volume rename. |
| **CLAUDE.md** | `docker compose up -d # PostgreSQL 17 on :5432` (Environment Setup); `CREATE EXTENSION IF NOT EXISTS citext/pg_trgm` (Data layer); no file hierarchy for compose | **Partial** — citext is correct (added by migrations) but init provides pgcrypto+pg_trgm, not citext; should list both; compose line should hint at `postgres` service + `logs -f postgres`; add `infrastructure/postgres/init` to Architecture tree | Update 2 lines: compose comment + extension preamble. Add one line to Architecture tree for `infrastructure/postgres/init`. Keep workflow brevity. |
| **README.md** | Badges (PostgreSQL 17), Architecture table (PostgreSQL 17), File Hierarchy (`docker-compose.yml PostgreSQL 17`), Quick Start (`docker compose up -d # PostgreSQL 17` + `cp .env.example .env`), Verify (`curl health`), Env table (DATABASE_URL), Troubleshooting (5 rows) | **Most stale** — File Hierarchy, Quick Start, Env-adjacent text, and Troubleshooting should name `postgres` service, `postgres:17-alpine`, `postgres_data`, `scandihaven_net`, `PGDATA`, init path, and updated DATABASE_URL. Add one Troubleshooting row for `postgres_data` volume rename + PGDATA. Keep README's editorial tone. | 5 targeted edits (see Tasks). |

**What NOT to change:**
- PRD.md (authoritative spec) — out of scope
- turbo.json, package.json, pnpm-workspace.yaml — no doc references
- Do not rename `docker-compose.yml` → `compose.yml`
- Do not add Redis/Meilisearch/pgAdmin docs (still deferred per PRD §3.2)

---

## 1. PLAN — Task Breakdown (implement in order)

### Task 1: AGENTS.md — Environment section

**Files:**
- Modify: `AGENTS.md` — `## Environment` paragraph (~lines 52-57)

**Current:**
```md
## Environment

`.env.example` documents every variable; secrets are `set-me` placeholders — generate with `openssl rand -base64 32` (auth secret) / `openssl rand -hex 16` (cron). Postgres 17 via `docker compose up -d` (canonical) or any local PG17. The seed/migrate scripts refuse non-local hosts. Stripe runs in test mode without keys — checkout then renders an explicit "not configured" notice; E2E asserts that state rather than faking payment.
```

**Replace with:**
```md
## Environment

`.env.example` documents every variable; secrets are `set-me` placeholders — generate with `openssl rand -base64 32` (auth secret) / `openssl rand -hex 16` (cron). Postgres 17 via `docker compose up -d` (canonical) — service `postgres` (`postgres:17-alpine`, `scandihaven_postgres`, `postgres_data`/`scandihaven_net`, `PGDATA=/var/lib/postgresql/data/pgdata`, init `infrastructure/postgres/init/00-create-extensions.sql` → `pgcrypto`+`pg_trgm`) or any local PG17. `DATABASE_URL=postgresql://scandihaven_user:scandihaven_secret@localhost:5432/scandihaven_dev` — seed/migrate refuse non-local hosts. Stripe runs in test mode without keys — checkout then renders an explicit "not configured" notice; E2E asserts that state rather than faking payment.
```

**Rationale:** Keeps AGENTS.md one-paragraph density but makes the compose contract explicit so agents don't invent `pgdata`/`scandihaven-db`/`postgres:17` (the 3-way drift we just fixed).

**Verification:**
```bash
rg -n "scandihaven_postgres|postgres_data|scandihaven_net|PGDATA|00-create-extensions" AGENTS.md  # must hit
rg -n "pgdata|scandihaven-db" AGENTS.md  # must be 0 (except plan history)
```

### Task 2: CLAUDE.md — Environment Setup + Data layer + Architecture

**Files:**
- Modify: `CLAUDE.md` — `## Development Workflow / Environment Setup` code block (lines ~32-38)
- Modify: `CLAUDE.md` — `### Data layer` paragraph (lines ~52-56)
- Modify: `CLAUDE.md` — `### Architecture` tree (lines ~108-120)

**2a. Environment Setup code comment:**

```diff
-docker compose up -d                  # PostgreSQL 17 on :5432
+docker compose up -d                  # PostgreSQL 17 (postgres:17-alpine, service `postgres` → scandihaven_postgres, healthy in ~10s; logs: docker compose logs -f postgres)
```

**2b. Data layer extension preamble:**

Current:
```
After edits: `pnpm db:generate`, review the SQL, prepend `CREATE EXTENSION IF NOT EXISTS citext/pg_trgm` if new extension-dependent columns appear, then `pnpm db:migrate`.
```

Replace with:
```
After edits: `pnpm db:generate`, review the SQL, prepend `CREATE EXTENSION IF NOT EXISTS citext` / `pg_trgm` / `pgcrypto` if needed (local DB already has `pgcrypto`+`pg_trgm` via `infrastructure/postgres/init/00-create-extensions.sql`, `citext` via migrations), then `pnpm db:migrate`.
```

**2c. Architecture tree — add infra line:**

Current tree ends with:
```
  config      Shared tsconfig, ESLint factory, Zod env parser
```

Add after:
```
infrastructure/postgres/init  PG extensions (pgcrypto, pg_trgm) seeded on first `docker compose up`
```

**Verification:**
```bash
rg -n "scandihaven_postgres|postgres:17-alpine|00-create-extensions|infrastructure/postgres" CLAUDE.md  # must hit ≥3
```

### Task 3: README.md — 5 targeted edits

**Files:**
- Modify: `README.md` — 5 locations

**3a. File Hierarchy ( ~line 78-92):**

Current:
```
📄 docker-compose.yml       PostgreSQL 17 for local dev
```

Replace with:
```
📄 docker-compose.yml       PostgreSQL 17 (postgres:17-alpine, service `postgres` → scandihaven_postgres, volume postgres_data, network scandihaven_net)
📄 docker-compose.yml.example  Template — cp to docker-compose.yml
📄 infrastructure/postgres/init/00-create-extensions.sql  pgcrypto + pg_trgm (run on first docker compose up)
```

**3b. Quick Start prerequisites + commands:**

Prerequisites line — keep, but add init note:
```md
Prerequisites: **Node.js ≥ 22**, **PNPM 10** (`corepack enable`), **Docker** (or any local PostgreSQL 17).
```
(no change needed — already correct)

Commands block — annotate compose line:
```diff
-docker compose up -d               # PostgreSQL 17
+docker compose up -d               # PostgreSQL 17 (postgres:17-alpine, service `postgres`; logs: docker compose logs -f postgres)
```

**3c. Verify setup (optional, keep as-is):**
```bash
curl -s localhost:3000/api/health   # {"status":"ok","db":true,...}
```
No change — health already proves DB.

**3d. Troubleshooting — add one row for compose port:**

Current table has 6 rows. Add after `Seed refuses to run`:

| `docker compose` volume `pgdata` not found / `scandihaven-db` unhealthy | Renamed to `postgres_data` / `scandihaven_postgres` with `PGDATA` and `start_period`; run `docker compose down -v` once (one-time, re-seeds via `pnpm db:seed`) then `docker compose up -d` (init installs `pgcrypto`+`pg_trgm`) |

Keep table compact — one row, not three.

**3e. Environment-adjacent text — ensure DATABASE_URL example matches .env.example:**

If README mentions `DATABASE_URL` inline (in Quick Start or Secrets), ensure it shows `scandihaven_user:scandihaven_secret@.../scandihaven_dev`. Currently the Env table shows `DATABASE_URL` generic — no inline value, so no change needed unless we add an example. Do not add a secrets value; just ensure the Env table row's description hints at the new default.

Add to Env table `DATABASE_URL` notes cell: ` (default `scandihaven_dev` / `scandihaven_user` via compose)` — optional, keep if it doesn't bloat table.

**Verification:**
```bash
rg -n "scandihaven_postgres|postgres_data|scandihaven_net|postgres:17-alpine|00-create-extensions|PGDATA" README.md  # must hit ≥4
rg -n "pgdata|scandihaven-db" README.md  # must be 0 (except Troubleshooting's "was pgdata" historical note — allowed once)
```

### Task 4: Cross-doc verification (final checkpoint)

**Files:** none (read-only checks)

**Steps:**
```bash
# 1. No stale compose names remain (outside plan history and intentional Troubleshooting "was X" note)
rg -n "nave_spire|scandihaven-db" --hidden | grep -v "docs/plans" | grep -v ".git"

# 2. DATABASE_URL is consistent across .env.example + docs
grep DATABASE_URL .env.example
rg -n "DATABASE_URL" AGENTS.md CLAUDE.md README.md

# 3. Compose still valid
docker compose config -q && echo "compose OK"
sg docker -c "docker exec scandihaven_postgres psql -U scandihaven_user -d scandihaven_dev -c '\dx' | grep -E 'pgcrypto|pg_trgm'"

# 4. Quality gates (docs-only, but ensure no markdown breakage)
pnpm lint 2>&1 | tail -5
```

**Acceptance:**
- [ ] `rg` for `nave_spire` / `scandihaven-db` is clean (outside plan history)
- [ ] `DATABASE_URL` in `.env.example` matches doc references
- [ ] `docker compose config` valid, `\dx` shows `pgcrypto`+`pg_trgm`
- [ ] `pnpm lint` still 8/8 (markdown not linted, but no accidental JS change)

---

## 2. DECISIONS — Close before implementation

| # | Decision | Recommended | Alternative | Default |
|---|---|---|---|---|
| D1 | **Verbosity in AGENTS.md** — one paragraph vs expanded bullet | One paragraph (keep AGENTS.md density) | Bulleted sub-list for compose details | One paragraph |
| D2 | **README Troubleshooting row** — include `down -v` one-time note? | Yes (single row, warns about volume rename) | No row (assume fresh clones) | Yes |
| D3 | **Track .env.example value in README Env table?** | Hint in notes cell (`scandihaven_dev` default) | Keep generic `PostgreSQL 17 connection string` | Hint |
| D4 | **Also update PRD.md?** | No (PRD is spec, not ops doc) | Update PRD §13.2 compose snippet | No |

---

## 3. OUT-OF-SCOPE (explicitly not in this plan)

- Editing `PRD.md`, `turbo.json`, `pnpm-workspace.yaml`, `packages/db` schema, or `docker-compose.yml` itself (already ported)
- Adding new services (Redis, Meilisearch, pgAdmin) — still deferred per PRD §3.2
- Changing `DATABASE_URL` host/port, `BETTER_AUTH_SECRET` handling, or Stripe env
- Reformatting unrelated README sections (Design System, Project Status, etc.)

---

## 4. RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|---|---|---|
| Over-documenting compose internals bloats AGENTS.md | Low — violates "every line earns its place" | Keep to one clause; link to `docker-compose.yml` for full spec |
| Troubleshooting row confuses fresh clones (who never had `pgdata`) | Low | Phrase as "If you previously ran `pgdata`/`scandihaven-db`, run `down -v` once" |
| `rg -n "pgdata"` false positive on intentional historical note | Low | Allow one historical mention in Troubleshooting, not zero |
| Docs drift again if compose changes | Low | Single source of truth remains `docker-compose.yml`; docs are summaries |

---

## 5. OPEN QUESTIONS (require maintainer input)

1. Should we commit `docs/plans/*.md`? Currently untracked — recommend committing both plans (`docker-compose-port` + this one) as ADRs.
2. Should `infrastructure/postgres/init` be added to `.gitignore`? No — it's required for compose; ensure it's tracked.

---

## 6. ARTIFACTS & REFERENCES

- Source compose: `docker-compose.yml` (ported, postgres:17-alpine, scandihaven_postgres, postgres_data, scandihaven_net, PGDATA, init)
- Env: `.env.example` (`scandihaven_user:scandihaven_secret@.../scandihaven_dev`)
- Prior plan: `docs/plans/2026-09-08-docker-compose-port.md`
- Docs: `AGENTS.md` (Environment), `CLAUDE.md` (Environment Setup + Data layer + Architecture), `README.md` (File Hierarchy + Quick Start + Troubleshooting + Env table)

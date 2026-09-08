# Docker Compose Port Plan: `docker-compose.yml.example` → `docker-compose.yml`

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the drifted `docker-compose.yml` (scandihaven, 3 variants in play) with a production-correct port of `docker-compose.yml.example` (Nave & Spire template) — adapted to Scandi Haven naming where appropriate, preserving all functional improvements (alpine image, PGDATA, init scripts, network/volume hygiene, healthcheck `start_period`).

**Architecture:** Single-file swap with collateral reconciliation. The compose file is the canonical local Postgres definition (PRD §3.1 — Postgres 17 single source of truth, `docker compose up -d`). No new services. The init volume `./infrastructure/postgres/init` is load-bearing for `pgcrypto`+`pg_trgm` extensions (required by Drizzle schema + search). Network/volume naming must not collide with stale `scandihaven-db`/`pgdata` artifacts.

**Tech Stack:** Docker Compose v5.5.0 / Postgres 17-alpine vs 17 / `infrastructure/postgres/init/00-create-extensions.sql` / Drizzle ORM

---

## 0. ANALYZE — Current State (read-only findings)

### 0.1 Three-file drift (verified 2026-09-08)

| Artifact | Service | Image | Container | DB / User / Pass | Healthcheck | Extras |
|---|---|---|---|---|---|---|
| `HEAD:docker-compose.yml` (committed) | `db` | `postgres:17` | `scandihaven-db` | `scandihaven` / `scandihaven` / `scandihaven` | `pg_isready -U scandihaven -d scandihaven` / timeout 3s, no `start_period` | none |
| `working:docker-compose.yml` (uncommitted, `M`) | `db` | `postgres:17` | `scandihaven-db` | `scandihaven_dev` / `scandihaven_user` / `scandihaven_secret` | `pg_isready -U scandihaven -d scandihaven` **BUG** — user/db mismatch | none |
| `docker-compose.yml.example` (untracked) | `postgres` | `postgres:17-alpine` | `nave_spire_postgres` | `nave_spire_dev` / `nave_spire_user` / `nave_spire_secret` | correct user/db, timeout 5s, `start_period: 10s` | `PGDATA`, `./init:/docker-entrypoint-initdb.d`, `postgres_data` volume, `nave_spire_net` network, header usage docs |

### 0.2 Env drift

| File | `DATABASE_URL` |
|---|---|
| `.env.example` (committed, canonical) | `postgresql://scandihaven:scandihaven@localhost:5432/scandihaven` — matches HEAD compose, mismatches `.env.local` |
| `.env.local` (gitignored, active local dev) | `postgresql://scandihaven_user:scandihaven_secret@localhost:5432/scandihaven_dev` — matches working compose + example *pattern*, not committed values |

### 0.3 What the example adds that working file lacks

1. `postgres:17-alpine` (smaller, faster pull; parity with prod `postgres:17-alpine` where applicable)
2. `PGDATA: /var/lib/postgresql/data/pgdata` (required for correct volume nesting; prevents initdb confusion on `down -v` / re-init)
3. Init mount: `./infrastructure/postgres/init:/docker-entrypoint-initdb.d` — installs `pgcrypto` (gen_random_uuid) + `pg_trgm` (search). Without it, `docker compose up` yields a DB that passes `pg_isready` but fails `pnpm db:migrate` on extension-dependent migrations.
4. Explicit `networks: { driver: bridge }` + named volume `{ driver: local }` (COMPOSE spec best practice; isolates bridge from default)
5. `start_period: 10s` (prevents false-unhealthy flaps during initdb)
6. Header usage banner (DX: `up -d` / `down` / `down -v` / `logs -f`)

### 0.4 What must NOT be blindly copied

- **Branding:** `nave_spire_*` names belong to a different project. Scandi Haven canonical is `scandihaven` (or `scandihaven_*`). Direct copy would break every `DATABASE_URL` and `pnpm db:*` script that refuses non-local hosts (AGENTS.md: seed/migrate refuse non-local).
- **Service name mismatch:** Apps do not reference service name, but CI/docs/`.env.example` do via ports. Changing `db` → `postgres` is intentional but must be reflected in log commands and any `depends_on` (none today).
- **Healthcheck credential:** Working file's healthcheck is *already broken* (`-U scandihaven` vs `scandihaven_user`). Example gets this right — port must fix it.
- **Volume name `pgdata` vs `postgres_data`:** Renaming the volume orphans existing local data (`pgdata`). Needs explicit migration step (`down -v` with warning) or backward-compatible alias.

---

## 1. DECISIONS — Close before implementation (the VALIDATE gate)

| # | Decision | Option A (recommended) | Option B | Default if no feedback |
|---|---|---|---|---|
| D1 | **Branding / naming** | Adopt Scandi Haven names throughout: `scandihaven_postgres`, `scandihaven_dev`, `scandihaven_user`, `scandihaven_secret`, volume `postgres_data` or `scandihaven_pgdata`, network `scandihaven_net`, service `postgres` | Keep `nave_spire_*` verbatim (treat as rebrand) | **A** |
| D2 | **Image variant** | `postgres:17-alpine` (example) | Keep `postgres:17` (Debian) | **A** — alpine is strictly better for local dev; note `pg_trgm`/`pgcrypto` are in both |
| D3 | **PGDATA** | Include `PGDATA: /var/lib/postgresql/data/pgdata` | Omit (current) | **A** — required when init scripts + volume nesting coexist |
| D4 | **Volume rename** | Rename to `postgres_data` (example) / `scandihaven_postgres_data` | Keep `pgdata` to preserve local data | **A with migration note** — document `docker compose down -v` once |
| D5 | **Service name** | `postgres` (example, more explicit) | Keep `db` (current) | **A** — but update all doc references to `logs -f postgres` |
| D6 | **.env.example DATABASE_URL** | Update to `...scandihaven_user:scandihaven_secret@.../scandihaven_dev` to match compose | Keep `scandihaven:scandihaven/.../scandihaven` | **A** — single source of truth; otherwise `cp .env.example .env` yields broken URL |
| D7 | **Keep example file?** | Keep `docker-compose.yml.example` as template (update its Scandi Haven values) | Delete after port (compose IS the source) | **A** — example is useful for `cp example → yml` onboarding |

> **Decisions locked 2026-09-08:** D1=A (scandihaven_* naming) confirmed by maintainer. D2–D7 default to **A** unless overridden in review.

---

## 2. PLAN — Task Breakdown

### Task 1: Lock decisions & snapshot current state

**Files:**
- Read: `docker-compose.yml`, `docker-compose.yml.example`, `.env.example`, `.env.local`, `infrastructure/postgres/init/00-create-extensions.sql`, `README.md`, `AGENTS.md`, `turbo.json`

**Step 1:** Run `git diff HEAD -- docker-compose.yml` and `docker compose config` (dry) to capture pre-port baseline.
**Step 2:** Confirm D1–D7. If D1=A, target names are `scandihaven_*`; if D1=B, keep `nave_spire_*` (then also update `.env.example` to `nave_spire_*` + rename README references).
**Step 3:** Record decision in this plan (edit the table) + leave a `git stash` or branch point.

**Verification:** `cat docker-compose.yml` and `cat docker-compose.yml.example` outputs saved; `git status --short` shows only `M docker-compose.yml` pre-change.

---

### Task 2: Port `docker-compose.yml` from example (the core swap)

**Files:**
- Modify: `docker-compose.yml` (full rewrite, no incremental patch)

**Step 1 — Write the ported file** (template, D1=A assumed; adjust names if D1=B):

```yaml
# ══════════════════════════════════════════════════════════════════
# Scandi Haven — Local Development Services
# ══════════════════════════════════════════════════════════════════
# Usage:
#   Start:   docker compose up -d
#   Stop:    docker compose down
#   Reset:   docker compose down -v  (WARNING: deletes all data)
#   Logs:    docker compose logs -f postgres
# ══════════════════════════════════════════════════════════════════

services:
  postgres:
    image: postgres:17-alpine
    container_name: scandihaven_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: scandihaven_dev
      POSTGRES_USER: scandihaven_user
      POSTGRES_PASSWORD: scandihaven_secret
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/postgres/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U scandihaven_user -d scandihaven_dev"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s
    networks:
      - scandihaven_net

volumes:
  postgres_data:
    driver: local

networks:
  scandihaven_net:
    driver: bridge
```

**Key invariants in this write:**
- Service `postgres` (not `db`) — explicit.
- `image: postgres:17-alpine` — keep alpine.
- All three `POSTGRES_*` use `_dev`/`_user`/`_secret` suffix (matches `.env.local` pattern).
- `PGDATA` present and matching volume mount point.
- Healthcheck user+db exactly match `POSTGRES_*` (fixes working-file bug).
- Init mount present (load-bearing for `pgcrypto`/`pg_trgm`).
- Explicit `volumes`/`networks` with `driver`.

**Step 2 — Validate compose spec:**

```bash
docker compose config        # must exit 0, print resolved YAML with scandihaven_* names
docker compose config -q     # quiet validation
```

Expected: no errors; `services.postgres.image` is `postgres:17-alpine`; volume `postgres_data` listed.

**Commit:** `git add docker-compose.yml && git commit -m "chore(compose): port example → yml (alpine, PGDATA, init, network, healthcheck fix)"`

---

### Task 3: Reconcile `.env.example` DATABASE_URL

**Files:**
- Modify: `.env.example:1-3`

**Change:**

```diff
-DATABASE_URL=postgresql://scandihaven:scandihaven@localhost:5432/scandihaven
+DATABASE_URL=postgresql://scandihaven_user:scandihaven_secret@localhost:5432/scandihaven_dev
```

Rationale: `cp .env.example .env` must yield a URL that actually connects to the compose DB. Current `.env.example` matches stale HEAD and breaks onboarding. Keep comment header.

**Verification:**

```bash
grep DATABASE_URL .env.example   # shows scandihaven_user ... scandihaven_dev
grep DATABASE_URL .env.local     # should now match .env.example pattern
```

**Commit:** `git add .env.example && git commit -m "chore(env): sync DATABASE_URL to compose (scandihaven_user/scandihaven_dev)"`

---

### Task 4: Normalize `docker-compose.yml.example` (keep as template)

**Files:**
- Modify: `docker-compose.yml.example` — replace `nave_spire_*` with `scandihaven_*` if D1=A (so example and yml agree), or leave as-is if D1=B.

If D1=A, the example after normalization is byte-identical to `docker-compose.yml` (intended — `example` is the copy-source). Alternatively, keep `nave_spire` header but with scandihaven values and a comment: `# Template — copy to docker-compose.yml`.

**Verification:** `diff -u docker-compose.yml docker-compose.yml.example` — expect empty diff (if normalized) or only header comment diff.

**Commit (if changed):** `git add docker-compose.yml.example && git commit -m "chore(compose): normalize example to scandihaven naming"`

---

### Task 5: Verify infrastructure init & docs coherence

**Files:**
- Read: `infrastructure/postgres/init/00-create-extensions.sql`
- Modify: `README.md` (only the `docker compose` and `DATABASE_URL` references if they mention `pgdata`/`scandihaven-db`/`nave_spire`)
- Modify: `AGENTS.md` if it references compose service name (currently doesn't — verify)

**Steps:**
1. Confirm `infrastructure/postgres/init/00-create-extensions.sql` exists and is not gitignored (it is tracked as untracked — add it).
2. Search repo for stale references: `rg -n "scandihaven-db|pgdata|nave_spire" --hidden` — update any README/CI/docs hits to `scandihaven_postgres` / `postgres_data`.
3. `git add infrastructure/postgres/init/00-create-extensions.sql` (if untracked).

**Verification:** `rg "nave_spire" --hidden` returns 0 hits after normalization (if D1=A); `ls infrastructure/postgres/init/` shows `00-create-extensions.sql`.

---

### Task 6: Live verification — cold boot + extensions + migrations

**Files:** none (runtime check)

**Steps (sequential, destructive — warn about `down -v`):**

```bash
docker compose down -v          # removes old pgdata volume (orphaned data — expected)
docker compose up -d
docker compose ps               # postgres: healthy
docker compose logs -f postgres # tail 20 lines, expect "pgcrypto" + "pg_trgm" notices + "ready to accept connections"
# Extension check
psql "postgresql://scandihaven_user:scandihaven_secret@localhost:5432/scandihaven_dev" -c "\dx"  # expect pgcrypto, pg_trgm
# Drizzle path
pnpm db:migrate
pnpm db:seed
curl -s localhost:3000/api/health  # after pnpm dev, expect {"status":"ok","db":true}
```

**Acceptance:**
- [ ] `docker compose ps` shows `scandihaven_postgres` healthy within 15s (`start_period` respected)
- [ ] `\dx` lists `pgcrypto` and `pg_trgm`
- [ ] `pnpm db:migrate && pnpm db:seed` succeed (seed is idempotent — second run also succeeds)
- [ ] `docker compose config` still valid after `down -v`/`up -d` cycle

**If any step fails:** `docker compose logs postgres` + `cat infrastructure/postgres/init/00-create-extensions.sql` diagnostics; do not proceed to Task 7.

---

### Task 7: Lint / typecheck / test / build gate (AGENTS.md order)

**Files:** none

```bash
pnpm lint
pnpm typecheck
pnpm test           # commerce coverage gates: 90% lines / 85% funcs — must not regress
pnpm build          # Turbopack build of both apps — must be green (no new package build step)
```

**Acceptance:** All four pass. If `test` fails, investigate `packages/commerce` pricing/promotion invariants — compose change should not affect them; failure indicates env leakage.

---

### Task 8: Final checkpoint & handoff

**Checklist:**
- [ ] `docker-compose.yml` byte-matches ported spec (Task 2) — `docker compose config` canonical
- [ ] `.env.example` DATABASE_URL matches compose credentials
- [ ] `infrastructure/postgres/init` tracked and mounted
- [ ] No stale `nave_spire` / `pgdata` / `scandihaven-db` refs remain (`rg` clean)
- [ ] Cold-boot verification (Task 6) green
- [ ] Quality gates (Task 7) green
- [ ] `git log --oneline -5` shows 2-3 atomic commits (compose, env, init/docs) — not one squash

**Deliver:** Push branch, open PR with `closes` note linking to this plan. Include `docker compose down -v` warning in PR description.

---

## 3. RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|---|---|---|
| Volume rename orphans local data (`pgdata` → `postgres_data`) | Low — dev only, recreate via `db:seed` | Document `down -v` as one-time migration; `db:seed` is idempotent |
| `postgres:17-alpine` missing extension (unlikely) | Medium — `pgcrypto`/`pg_trgm` are in both variants | Verify with `\dx` in Task 6; fallback to `postgres:17` if alpine probe fails (ADR) |
| Healthcheck credential drift (re-introducing bug) | High — compose reports unhealthy, E2E flakes | Task 2 explicitly tests `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` equality |
| `PGDATA` nesting mistake (`/data` vs `/data/pgdata`) | High — init scripts re-run or fail | Keep `PGDATA` + volume mount exactly as example; verify with `docker compose config` |
| Service rename `db` → `postgres` breaks external scripts | Low — no `depends_on` today | Task 5 `rg` sweep; update README `logs -f postgres` line |
| `.env.example` change breaks CI that hardcodes old URL | Low — CI uses `DATABASE_URL` from env, not file | Check `.github/workflows/ci.yml` — uses service container, not file URL |
| `docker-compose.yml.example` drift after port | Low — confusion | Task 4 normalizes example; future edits go to example first, then port |

---

## 4. OPEN QUESTIONS (require maintainer input)

1. **D1 branding:** Confirm `scandihaven_*` (recommended) vs `nave_spire_*`. If this repo *is* Nave & Spire going forward, we should rename `.env` + `README` + package scopes accordingly — larger scope.
2. **Volume name final:** `postgres_data` (example) vs `scandihaven_postgres_data` (more explicit, avoids collision if both projects coexist on one host). Recommend `postgres_data` unless multi-project host is a concern.
3. **Keep `docker-compose.yml.example` tracked?** Recommend yes (onboarding `cp`). If no, add to `.gitignore` after port.
4. **Do we want `docker-compose.override.yml` for local tweaks?** Out of scope — note as future if devs need host-specific ports.

---

## 5. ARTIFACTS & REFERENCES

- Source: `docker-compose.yml.example` (Nave & Spire template, 2026-09-08)
- Target: `docker-compose.yml` (Scandi Haven, HEAD + working drift)
- Env: `.env.example` line 3, `.env.local` line 3
- Init: `infrastructure/postgres/init/00-create-extensions.sql` (`pgcrypto`, `pg_trgm`)
- Docs: `README.md` Quick Start (`docker compose up -d`, `pnpm db:migrate && pnpm db:seed`), `AGENTS.md` Environment section, `PRD.md` §3.1 / §7 / §13.2, `turbo.json` `globalEnv`
- Verification: `docker compose config`, `pg_isready`, `psql \dx`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm lint typecheck test build` (AGENTS.md order matters)

---

## 6. OUT-OF-SCOPE (explicitly not in this port)

- Adding Redis / Meilisearch / pgAdmin services (PRD §3.2 swap triggers not met)
- `docker-compose.yml` → `compose.yml` rename
- Production compose / Swarm / K8s manifests
- Changing `DATABASE_URL` host/port (stays `localhost:5432`)
- Modifying Drizzle schema or migrations (forward-only — compose change is infra-only)


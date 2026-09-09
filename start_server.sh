#!/bin/bash
# start_server.sh — Fresh-clone → production servers for Scandi Haven
#
# From a freshly `git clone`d repo and a freshly `docker compose up`'d
# PostgreSQL 17 container, initializes the database and restarts both
# production servers:
#   - storefront  `pnpm prod`       → http://localhost:3000
#   - admin       `pnpm prod:admin` → http://localhost:3001
#
# Adapted from start_server.sh.sample (devlog SQLite domain) to the
# Scandi Haven Turborepo (PostgreSQL 17 + Drizzle + Next.js 16.3 + Turbopack).
# Keeps the sample's helper/phase structure (log/ok/warn/die, idempotent
# re-run, fuser/lsof/pkill kill, LOG_FILE/PID_FILE, health_check) with
# every domain block replaced for the actual stack.
#
# Usage:  ./start_server.sh          # from repo root
#         bash start_server.sh        # same
#         DB_RESET=1 ./start_server.sh  # drop+recreate DB before migrate+seed
# Idempotent: safe to re-run; kills prior :3000/:3001 first.
# Logs:   ./server.log (storefront), ./server-admin.log (admin)
# PIDs:   ./server.pid, ./server-admin.pid

set -euo pipefail

# ── repo layout ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
LOG_FILE="$REPO_ROOT/server.log"
LOG_FILE_ADMIN="$REPO_ROOT/server-admin.log"
PID_FILE="$REPO_ROOT/server.pid"
PID_FILE_ADMIN="$REPO_ROOT/server-admin.pid"

# ── helpers ──────────────────────────────────────────────────────────────
log()  { printf "\033[1;34m[start]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m[ok]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*" >&2; }
die()  { printf "\033[1;31m[fail]\033[0m %s\n" "$*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

gen_secret_b64() {
  if have openssl; then
    openssl rand -base64 32
  else
    # fallback: 32 random bytes via /dev/urandom → base64
    head -c 32 /dev/urandom | base64 | tr -d '\n'
  fi
}

gen_secret_hex() {
  if have openssl; then
    openssl rand -hex 16
  else
    hexdump -vn16 -e ' /1 "%02x"' /dev/urandom | tr -d ' \n'
  fi
}

# ── 0. prerequisites ─────────────────────────────────────────────────────
check_prereqs() {
  log "Checking prerequisites …"
  have node   || die "node not found — install Node ≥22 (see package.json engines)"
  have pnpm   || die "pnpm not found — run: corepack enable && corepack prepare pnpm@10.15.0 --activate"
  have curl   || die "curl not found — required for health checks"
  have openssl || warn "openssl not found — falling back to /dev/urandom for secrets"
  if ! have docker; then
    warn "docker not found — ensure_postgres will be skipped; DB setup needs a running Postgres 17 (docker compose up -d)"
  elif ! docker compose version >/dev/null 2>&1; then
    warn "docker compose not available — install Docker Compose v2"
  fi

  local node_maj
  node_maj="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "$node_maj" -lt 22 ]]; then
    die "Node $node_maj < 22 — upgrade to Node ≥22 (package.json engines)"
  fi

  local pnpm_ver
  pnpm_ver="$(pnpm --version 2>/dev/null || echo 0)"
  # pnpm 10.x is required (see packageManager field)
  if [[ "$pnpm_ver" != 10.* ]]; then
    warn "pnpm $pnpm_ver — expected 10.15.0 (corepack prepare pnpm@10.15.0 --activate)"
  fi

  ok "node $(node --version) / pnpm $pnpm_ver / $(openssl version 2>/dev/null || echo openssl-ok)"
}

# ── 1. env file — ensure .env (production-ready) ─────────────────────────
ensure_env() {
  log "Ensuring .env (production) …"

  local env_file="$REPO_ROOT/.env"
  if [[ -f "$env_file" ]]; then
    log "  .env exists — patching missing/short secrets, preserving existing values"
  elif [[ -f "$REPO_ROOT/.env.example" ]]; then
    log "  .env missing — creating from .env.example (fresh clone)"
    cp "$REPO_ROOT/.env.example" "$env_file"
  else
    die "No env template found (.env.example) — cannot create .env"
  fi

  # Helper: ensure a key exists and, for secrets, meets min length. Never
  # overwrites a present valid value (preserves BETTER_AUTH_SECRET stability
  # per AGENTS.md — cart HMAC would invalidate otherwise).
  ensure_var() {
    local key="$1" val="$2" min_len="${3:-0}"
    local cur=""
    if grep -qE "^${key}=" "$env_file"; then
      cur="$(grep -E "^${key}=" "$env_file" | tail -n1 | cut -d= -f2- | tr -d $'\r')"
      cur="$(echo "$cur" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
    fi

    local need_set=0
    # placeholder values from .env.example must be replaced
    if [[ -z "$cur" || "$cur" == "set-me"* ]]; then
      need_set=1
    elif [[ "$min_len" -gt 0 && "${#cur}" -lt "$min_len" ]]; then
      need_set=1
    fi

    if [[ "$need_set" -eq 1 ]]; then
      if [[ -z "$val" && "$min_len" -gt 0 ]]; then
        if [[ "$key" == "CRON_SECRET" ]]; then
          val="$(gen_secret_hex)"
        else
          val="$(gen_secret_b64)"
        fi
      elif [[ -z "$val" ]]; then
        # no default and no generator — keep as-is (optional vars)
        return
      fi
      if grep -qE "^${key}=" "$env_file"; then
        # escape & for sed replacement
        local esc_val
        esc_val="$(printf '%s' "$val" | sed -e 's/[\/&]/\\&/g')"
        sed -i "s|^${key}=.*|${key}=${esc_val}|" "$env_file"
      else
        echo "${key}=${val}" >> "$env_file"
      fi
      log "  set $key"
    fi
  }

  # DATABASE_URL must point at the compose Postgres for fresh-clone flow
  ensure_var "DATABASE_URL" "postgresql://scandihaven_user:scandihaven_secret@localhost:5432/scandihaven_dev" 0
  ensure_var "BETTER_AUTH_SECRET" "" 32
  ensure_var "BETTER_AUTH_URL" "http://localhost:3000" 0
  ensure_var "NEXT_PUBLIC_SITE_URL" "http://localhost:3000" 0
  ensure_var "CRON_SECRET" "" 32
  # Optional vars: leave as-is if already set (including set-me placeholders for Stripe/Resend — honest "not configured" state per README)
  # STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  # RESEND_API_KEY / EMAIL_FROM / AUTH_GOOGLE_* / AUTH_APPLE_* / FEATURE_* / DISABLE_IMAGE_OPTIMIZER

  # Keep app-level .env files in sync if they exist (Next.js loads apps/*/.env
  # when run via `pnpm --filter`; copy ensures fresh-clone correctness even
  # though packages/config/src/env.ts also walks ../../.env via tryLoadRootEnv).
  for app_env in "$REPO_ROOT/apps/web/.env" "$REPO_ROOT/apps/admin/.env"; do
    if [[ -f "$app_env" ]]; then
      # app .env exists — ensure it has at least DATABASE_URL + BETTER_AUTH_SECRET
      # by copying repo-root values for those keys (do not clobber app-specific overrides)
      for k in DATABASE_URL BETTER_AUTH_SECRET BETTER_AUTH_URL NEXT_PUBLIC_SITE_URL CRON_SECRET; do
        if ! grep -qE "^${k}=" "$app_env"; then
          grep -E "^${k}=" "$env_file" >> "$app_env" 2>/dev/null || true
        fi
      done
    fi
  done

  ok ".env ready (DATABASE_URL + BETTER_AUTH_SECRET ≥32, see .env.example for optional)"

  # Validate secrets still meet length
  local b c
  b="$(grep -E "^BETTER_AUTH_SECRET=" "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  c="$(grep -E "^CRON_SECRET=" "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  if [[ "${#b}" -lt 32 ]]; then die "BETTER_AUTH_SECRET still <32 after ensure (${#b})"; fi
  if [[ "${#c}" -lt 32 && -n "$c" && "$c" != "set-me"* ]]; then die "CRON_SECRET still <32 after ensure"; fi
}

# ── 2. postgres — ensure container is up and healthy ─────────────────────
ensure_postgres() {
  log "Ensuring PostgreSQL 17 container (docker compose up -d) …"

  if ! have docker || ! docker compose version >/dev/null 2>&1; then
    warn "  docker/compose not available — skipping container start; ensure Postgres 17 is reachable at DATABASE_URL"
    return
  fi

  if [[ ! -f "$REPO_ROOT/docker-compose.yml" ]]; then
    warn "  docker-compose.yml not found — skipping"
    return
  fi

  (cd "$REPO_ROOT" && docker compose up -d 2>&1 | tail -n 20)
  ok "  docker compose up -d issued"

  # Wait for healthcheck (compose defines pg_isready + start_period 10s)
  log "  waiting for postgres to be healthy (pg_isready) …"
  local i
  for i in $(seq 1 30); do
    if (cd "$REPO_ROOT" && docker compose ps --format json 2>/dev/null | grep -q '"health":"healthy"' 2>/dev/null) || \
       (cd "$REPO_ROOT" && docker inspect --format='{{.State.Health.Status}}' scandihaven_postgres 2>/dev/null | grep -q healthy) || \
       pg_isready -h localhost -p 5432 -U scandihaven_user -d scandihaven_dev >/dev/null 2>&1; then
      ok "  postgres healthy after ${i}s"
      return
    fi
    # Also try direct pg_isready via docker exec as last resort
    if docker exec scandihaven_postgres pg_isready -U scandihaven_user -d scandihaven_dev >/dev/null 2>&1; then
      ok "  postgres healthy (via docker exec) after ${i}s"
      return
    fi
    sleep 2
  done

  warn "  postgres not healthy after 60s — continuing anyway (migrate will fail fast with actionable message)"
  (cd "$REPO_ROOT" && docker compose logs postgres 2>&1 | tail -n 30 | sed 's/^/  /' || true)
}

# ── 3. dependencies ──────────────────────────────────────────────────────
install_deps() {
  log "Installing dependencies (pnpm install) …"
  if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
    log "  node_modules missing — fresh clone"
  fi
  pnpm install --frozen-lockfile 2>&1 | tail -n 20
  ok "deps installed"
}

# ── 4. database — migrate + seed (fresh container) ───────────────────────
setup_db() {
  log "Database setup (migrate + seed) …"
  # Load .env for this shell so DATABASE_URL is exported (migrate.ts
  # local-host guard needs it; AGENTS.md: seed/migrate refuse non-local hosts)
  set -a; . "$REPO_ROOT/.env"; set +a

  if [[ "${DB_RESET:-}" == "1" ]]; then
    log "  DB_RESET=1 — running pnpm db:reset (drop+recreate, local hosts only)"
    pnpm db:reset 2>&1 | tail -n 20
  fi

  # db:setup is `migrate && seed` — idempotent (advisory-lock + natural-key upserts).
  # For a fresh container it creates schema + demo catalog (Halden, Øresund, …).
  # Re-runs are safe: migrate is forward-only, seed is idempotent.
  pnpm db:setup 2>&1 | tail -n 30
  ok "database ready (migrate + seed)"

  # Best-effort verification via api health once servers are up is done in health_check;
  # here just confirm seed log said idempotent run=ok or migrations applied.
}

# ── 5. build ─────────────────────────────────────────────────────────────
build_app() {
  log "Building (pnpm build — Turbopack, both apps) …"
  # Source .env into the build env so NEXT_PUBLIC_ vars bake correctly and
  # next build's auth route (which imports db client) sees DATABASE_URL +
  # BETTER_AUTH_SECRET. turbo.json globalEnv ensures they reach next.config.ts
  # but the build process itself also needs them exported.
  set -a; . "$REPO_ROOT/.env"; set +a
  pnpm build 2>&1 | tail -n 80
  # Assert both builds produced .next (not standalone — Scandi Haven uses next start)
  if [[ ! -d "$REPO_ROOT/apps/web/.next" ]]; then
    die "Build failed — apps/web/.next not found"
  fi
  if [[ ! -d "$REPO_ROOT/apps/admin/.next" ]]; then
    die "Build failed — apps/admin/.next not found"
  fi
  # Proxy registration check (H8d): functions-config-manifest must contain _middleware
  if ! grep -q "_middleware" "$REPO_ROOT/apps/web/.next/server/functions-config-manifest.json" 2>/dev/null; then
    warn "  web functions-config-manifest missing _middleware — proxy may not be registered (H8d)"
  fi
  if ! grep -q "_middleware" "$REPO_ROOT/apps/admin/.next/server/functions-config-manifest.json" 2>/dev/null; then
    warn "  admin functions-config-manifest missing _middleware"
  fi
  ok "build complete (apps/web + apps/admin, Turbopack)"
}

# ── helpers — kill prior servers ─────────────────────────────────────────
kill_port() {
  local port="$1"
  if have fuser; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  elif have lsof; then
    local pids
    pids="$(lsof -ti:"$port" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      log "  killing prior pids on :$port → $pids"
      # shellcheck disable=SC2086
      kill $pids 2>/dev/null || true
    fi
  fi
}

# ── 6. start servers — pnpm prod (:3000) + pnpm prod:admin (:3001) ───────
start_servers() {
  log "Starting production servers …"

  # Kill any prior servers on both ports (idempotent)
  kill_port 3000
  kill_port 3001
  pkill -f "next-server.*scandihaven" 2>/dev/null || true
  pkill -f "next start" 2>/dev/null || true
  pkill -f "turbo.*prod" 2>/dev/null || true
  sleep 1

  rm -f "$PID_FILE" "$PID_FILE_ADMIN"

  # Storefront — pnpm prod → apps/web on :3000
  log "  starting storefront (pnpm prod → :3000) …"
  # shellcheck disable=SC1091
  bash -c "set -a; . \"$REPO_ROOT/.env\"; set +a; nohup pnpm prod > \"$LOG_FILE\" 2>&1 & echo \$! > \"$PID_FILE\""
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || echo "?")"
  log "  storefront pid $pid → $LOG_FILE"

  # Admin — pnpm prod:admin → apps/admin on :3001
  log "  starting admin (pnpm prod:admin → :3001) …"
  bash -c "set -a; . \"$REPO_ROOT/.env\"; set +a; nohup pnpm prod:admin > \"$LOG_FILE_ADMIN\" 2>&1 & echo \$! > \"$PID_FILE_ADMIN\""
  local pid_admin
  pid_admin="$(cat "$PID_FILE_ADMIN" 2>/dev/null || echo "?")"
  log "  admin pid $pid_admin → $LOG_FILE_ADMIN"

  # Wait for storefront
  log "  waiting for storefront to be ready …"
  local i
  for i in $(seq 1 30); do
    if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  if ! curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    warn "Storefront not ready after 30s — tail $LOG_FILE:"
    tail -n 50 "$LOG_FILE" 2>&1 | sed 's/^/  /' || true
    die "Storefront failed to become ready"
  fi
  ok "  storefront ready"

  # Wait for admin
  log "  waiting for admin to be ready …"
  for i in $(seq 1 30); do
    if curl -sf http://localhost:3001/sign-in >/dev/null 2>&1 || curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ 2>&1 | grep -qE "200|307"; then
      break
    fi
    sleep 1
  done
  if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/sign-in 2>&1 | grep -q "200"; then
    warn "Admin not ready after 30s — tail $LOG_FILE_ADMIN:"
    tail -n 50 "$LOG_FILE_ADMIN" 2>&1 | sed 's/^/  /' || true
    warn "Admin may still be starting — continuing to health check"
  else
    ok "  admin ready"
  fi
}

# ── 7. health check ──────────────────────────────────────────────────────
health_check() {
  log "Health check …"
  local fail=0

  check() {
    local label="$1" url="$2" want="${3:-}"
    local code body
    body="$(mktemp)"
    code="$(curl -s -o "$body" -w "%{http_code}" "$url" 2>&1 || echo 000)"
    if [[ "$code" != "200" && "$code" != "307" && "$code" != "308" ]]; then
      warn "  $label $url → HTTP $code (want 200/307)"
      fail=1
      rm -f "$body"
      return
    fi
    if [[ -n "$want" ]]; then
      if ! grep -q "$want" "$body" 2>&1; then
        warn "  $label $url → HTTP $code but missing '$want'"
        fail=1
        rm -f "$body"
        return
      fi
    fi
    log "  ✓ $label $url → $code"
    rm -f "$body"
  }

  check "storefront health" "http://localhost:3000/api/health" '"status":"ok"'
  check "storefront shop"   "http://localhost:3000/shop" "Halden"
  check "storefront product PDP" "http://localhost:3000/products/halden-armchair" "Halden"
  check "storefront cart"   "http://localhost:3000/cart" "cart"
  # security headers (H8d)
  local headers
  headers="$(curl -sI http://localhost:3000/ 2>&1 || true)"
  if echo "$headers" | grep -qi "content-security-policy"; then
    log "  ✓ storefront security headers (CSP present)"
  else
    warn "  storefront security headers missing (CSP not found — H8d regression?)"
    echo "$headers" | head -n 15 | sed 's/^/    /' || true
    fail=1
  fi
  # admin gate (H7d) — unauthenticated / should redirect to /sign-in
  local adm_code
  adm_code="$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ 2>&1 || echo 000)"
  if [[ "$adm_code" != "307" ]]; then
    warn "  admin / → HTTP $adm_code (want 307 to /sign-in)"
    fail=1
  else
    log "  ✓ admin / → 307 (gate)"
  fi
  check "admin sign-in" "http://localhost:3001/sign-in" "Sign"
  # admin sign-in must carry security headers too (H5d/LD-2)
  local admin_headers
  admin_headers="$(curl -sI http://localhost:3001/sign-in 2>&1 || true)"
  if echo "$admin_headers" | grep -qi "content-security-policy"; then
    log "  ✓ admin sign-in security headers (CSP present)"
  else
    warn "  admin sign-in security headers missing"
    echo "$admin_headers" | head -n 15 | sed 's/^/    /' || true
    fail=1
  fi

  if [[ "$fail" -ne 0 ]]; then
    die "Health check failed — see warnings above and $LOG_FILE / $LOG_FILE_ADMIN"
  fi
  ok "all health checks passed"
}

# ── main ─────────────────────────────────────────────────────────────────
main() {
  log "=== Scandi Haven — fresh-clone production start ==="
  log "repo: $REPO_ROOT"
  log "storefront: http://localhost:3000"
  log "admin:      http://localhost:3001"
  echo ""

  check_prereqs
  ensure_env
  ensure_postgres
  install_deps
  setup_db
  build_app
  start_servers
  health_check

  echo ""
  ok "=== Servers live ==="
  echo "  Storefront: http://localhost:3000  (pid $(cat "$PID_FILE" 2>/dev/null || echo ?), log $LOG_FILE)"
  echo "  Admin:      http://localhost:3001  (pid $(cat "$PID_FILE_ADMIN" 2>/dev/null || echo ?), log $LOG_FILE_ADMIN)"
  echo "  Health:     curl -s http://localhost:3000/api/health | jq ."
  echo "  Shop:       open http://localhost:3000/shop  # Halden armchair, Øresund lamp …"
  echo "  Logs:       tail -f $LOG_FILE $LOG_FILE_ADMIN"
  echo "  Stop:       kill \$(cat $PID_FILE) \$(cat $PID_FILE_ADMIN)  # or: fuser -k 3000/tcp; fuser -k 3001/tcp"
  echo ""
  if grep -q "set-me" "$REPO_ROOT/.env" 2>/dev/null; then
    warn "Some .env placeholders remain (set-me) — checkout will show 'not configured' until Stripe test keys are added (see README.md Secrets)"
  fi
  log "Done."
}

main "$@"

# Session 14 — Live E2E Round 8 (2026-09-11)

Continuation of session 12/13: round 7 was pushed (`b106515`) and the redeploy recorded (`d94c020`). This session validates the round-7 deployment against the live origins, runs a deeper diagnostic sweep beyond the repo suite, and remediates what it finds.

## Step 1 — Baseline & parity

Fresh clone at `d94c020`; embedded PostgreSQL 17.5 provisioned (zonky binaries via `@embedded-postgres/linux-x64@17.5.0-beta.15`, port 5488 — no docker in the sandbox; the harness mirrors sessions 10–12, bootstrap via the repo's own `pg` package since the zonky distribution ships no psql). Baseline gates green: lint 8/8, typecheck 8/8, tests 7/7 (integration suites live), build 2/2.

Repo Playwright suites vs the live origins: **storefront 64/64, admin 8/8 — the round-7 redeploy published everything** (the 10 awaiting-redeploy deltas session_12 recorded are closed: journal reader routes, the FR-704 dozen, and search depth all live).

## Step 2 — Diagnostic sweep (beyond the repo suite)

A 36-probe sweep of surfaces the repo suite does not cover (homepage section inventory, PDP reviews/wishlist/notify, cart breakdown, footer contents, journal links, JSON-LD, checkout money path, TTFB, headers). Result: **8 findings, every one validated against the code before classification**:

1. **R8-1 (HIGH, FR-508/509)**: checkout placeholder-key blind spot — the client treated `pk_test_set-me` as configured while the server rejects `set-me`; live-confirmed that the full address form renders and then leaks `set STRIPE_SECRET_KEY in .env` to the customer (money-path dead-end + internal-instruction leak).
2. **R8-2 (MEDIUM, FR-701 §10)**: homepage journal preview cards unlinked after the round-7 reader routes shipped.
3. **R8-3 (MEDIUM, FR-201)**: PLP/category breadcrumbs render without BreadcrumbList JSON-LD (PDP only).
4. **R8-4 (MEDIUM, FR-107)**: footer missing newsletter form + social icons (the action's `source` even defaulted to `"footer"` — planned, never wired).
5. **R8-5 (MEDIUM, FR-701 §6/§7/§9 + FR-308 + FR-312)**: homepage brand-story/materials/testimonials sections unimplemented; zero approved reviews existed anywhere, so the FR-308 read-path and §9 testimonials could never render; PDP JSON-LD omitted `aggregateRating`.
6. **R8-6 (MEDIUM, FR-310)**: back-in-stock "Notify me" absent — the dedupe table existed but nothing wrote to it; no OOS variant seeded.
7. **R8-7 (LOW, FR-108)**: announcement bar not dismissible.
8. **R8-8 (LOW, FR-307)**: cross-sell stub — queued with rationale (curation model undecided).

Validated-healthy (no action): TTFB 109–142 ms vs the 800 ms SLO, security headers sitewide, sitemap/robots parity, typeahead keyboard nav, search depth, collections, mini-cart, cart persistence, `/account` gate, `?variant=` deep link, 404 recovery paths, admin gate. Probe artifacts disproven and recorded (P13 promo-field case sensitivity; P33 `.or()` masking; P04 sort-group false positive; the "const essage" display artifact — hex-dump proven correct).

## Step 3 — TDD execution

Seven slices, one atomic commit each, red-first at the closest behavioral seam (plan: `docs/plans/2026-09-11-live-e2e-remediation-round8.md`; full evidence per slice in `docs/verification-ledger.md` round-8 entry):

- **Slice 1 — R8-1** (`2402ac1`): `isStripePublishableKeyConfigured()` (unit-tested incl. server-rule parity) + customer-safe action mapping + E2E honest-notice spec.
- **Slice 2 — R8-2** (`c663028`): journal preview cards link `/journal/{category}/{slug}`; E2E href shape + click-through.
- **Slice 3 — R8-3** (`fdbd58b`): PLP/category `BreadcrumbList` via `safeJsonLd`; E2E trail names + absolute URLs.
- **Slice 4 — R8-5** (`c59ce62`): `listApprovedTestimonials` (integration-pinned), 7 existence-guarded review seeds, homepage §6/§7/§9, PDP `aggregateRating`.
- **Slice 5 — R8-4** (`33155a6`): footer newsletter (source/idPrefix/compact) + social links.
- **Slice 6 — R8-6** (`49a7683`, `528e49c`): `requestBackInStock` + notify action + PDP Notify-me row + sold-out Rust variant seed; spec made deterministic across runs (run-unique email; documented fixture reset of the loopback rate-limit bucket).
- **Slice 7 — R8-7** (`0c4c57d`): persisted dismissal store + client island via `useSyncExternalStore` (M-3 idiom).

Two mid-slice lessons: (a) Bash/Read output can eat `[m` sequences (ANSI-SGR-like) — byte-level verification (hex dump, `tsc`) is authoritative before "fixing" anything; (b) local E2E servers launched by Playwright inherit the invoking shell's env — run with `NEXT_PUBLIC_SITE_URL` matching the tested origin and `DATABASE_URL` exported in the same command, or DB-backed sections silently degrade (`.catch` → empty) while static JSX renders.

## Final verification

Gates green: lint 8/8 · typecheck 8/8 · tests 7/7 tasks (config 50, auth 19, admin 11, web 48, db 23, commerce 150 — 301 total, +44 vs round 7; integration live on embedded PG 17.5) · build 2/2 · Playwright web **74/74** local · admin **8/8** local. `git ls-files | grep '^\.env$'` empty. `skills/` and `infrastructure/` untouched by every commit. Docs aligned: PAD v1.2 (revision entry + §11 R8 rows), traceability (FR-107/108/201/301-313/501-512/701-704), verification-ledger round-8 entry, AGENTS.md/CLAUDE.md conventions.

## Summary

| ID | Finding | Fix | Evidence |
|---|---|---|---|
| R8-1 | Checkout placeholder-key blind spot: form rendered on placeholder builds, then leaked env instructions to the customer | Client `set-me` guard mirroring the server rule + customer-safe error mapping (detail logged server-side) | 4 unit + 2 action + 1 E2E specs red→green; live probe reproduced the leak pre-fix |
| R8-2 | Homepage journal preview cards unlinked | Cards link the category-scoped reader routes | 2 E2E specs red→green |
| R8-3 | PLP/category breadcrumbs without JSON-LD | `breadcrumbJsonLd` via `safeJsonLd` on both routes | 2 E2E specs red→green |
| R8-4 | Footer missing newsletter + social | Footer form (origin-recorded) + aria-named social links | 1 E2E spec red→green |
| R8-5 | FR-701 §6/§7/§9 unimplemented; reviews read-path starved; no `aggregateRating` | Approved-review seeds + `listApprovedTestimonials` + three homepage sections + PDP `aggregateRating` | 2 integration + 1 seed-coverage + 2 E2E specs red→green |
| R8-6 | FR-310 Notify-me absent (table existed, nothing wrote to it) | Service + action + PDP form + sold-out seed variant | 2 integration + 4 action + 1 E2E specs red→green |
| R8-7 | Announcement bar not dismissible | Persisted dismissal store + client island (M-3 idiom) | 3 unit + 1 E2E specs red→green |
| R8-8 | Cross-sell stub | Deferred with rationale (curation model undecided) | Documented (PAD §11) |

**Suggested next steps:**
1. Redeploy via `./start_server.sh` (migrate + idempotent seed) to publish round 8 — the deployment DB gains the review seeds and the sold-out Rust variant before the new build serves traffic.
2. **Carried ops action: rotate `BETTER_AUTH_SECRET`/`CRON_SECRET`** — 4th public exposure, history keeps the bytes.
3. Queue R-DB-2 (DDL constraints) as its own dedicated session; R-SHOP-2 (facet UI) next; R-SHOP-3 remainder (verified-buyer gate, moderation admin, +21d review-request job, FR-914 batching) after that.


## Step 5 — Post-push live re-check

Pushed to `origin/main` at `5a5f73d` via the SSH wrapper (paramiko, `ssh_git_wrapper_v3.py`) after rebasing onto `8c15d3f` (a redeploy-log commit that landed mid-session; rebase clean — it touches only `start_server_log.txt`). Parity verified (`git rev-parse HEAD origin/main` identical).

Live re-check: **web 64/74 vs live** — the 10 remaining failures are exactly the new round-8 specs awaiting redeploy (2 journal-preview links, 2 PLP breadcrumb JSON-LD, 1 checkout placeholder honesty, 2 FR-701 sections + aggregateRating, 1 footer newsletter/social, 1 notify flow, 1 announcement dismissal); admin **8/8 vs live** (behavior unchanged). Ops action: `./start_server.sh` (runs migrate + idempotent seed — the deployment DB gains the review seeds and the sold-out Rust variant before the new build serves traffic).

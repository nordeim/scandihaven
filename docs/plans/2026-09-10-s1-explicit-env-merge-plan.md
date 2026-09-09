# S-1 — Explicit `BETTER_AUTH_TRUSTED_ORIGINS` Merge in `trustedOrigins` Hook

| Field | Value |
|---|---|
| Plan ID | 2026-09-10-s1-explicit-env-merge |
| Parent audit | `2026-09-10-recent-changes-review` (`48be575..e9c061f`) — residual S-1 |
| PRD loci | §9.1 Auth (Better-Auth DB sessions, 30-day rolling, cookie flags), §9.7 STRIDE Spoofing, §13.4 env manifest, §1.5/§4.8 provider-agnostic infra, App B scaffold, §9.2 RBAC (untouched) |
| FR IDs | FR-601 (auth methods), FR-602 (account gate via `proxy.ts`), FR-609 (session revocation) |
| NFR-STACK | NFR-STACK-1 (no unverified APIs), NFR-STACK-2 (lockfile respect), NFR-STACK-4 (Zod dialect — not in this slice), NFR-STACK-11 (turbo `globalEnv` for `BETTER_AUTH_URL` & friends) |
| Severity | **Minor** — defense-in-depth hardening; no active production misbehaviour if `1016fda` is deployed |
| Effort | **S** — ~1 h implement + verify (pure function + single-file wiring + one test) |
| Status | **PLAN — awaiting VALIDATE** (no commit until you confirm §14) |
| Working-tree note | The working tree already contains this change in `packages/auth/src/server.ts` + `server-origin.test.ts` + `.gitignore` `docs/env.tgz` from the previous session's opportunistic fix. This plan re-derives that change as the validated slice so the commit can land cleanly on `main` after your sign-off. `git diff` of the planned slice is byte-identical to that working-tree diff |

> **Operating contract (§15):** ANALYZE → PLAN → VALIDATE → IMPLEMENT → VERIFY → DELIVER. This is the PLAN output. IMPLEMENT is blocked until you confirm the four questions in §14.

---

## 1 · Executive Summary

`1016fda` fixed H-AUTH (live sign-in `INVALID_ORIGIN` on both apps) by introducing a per-request `trustedOrigins(request)` hook that derives the served origin from **proxy-controlled** headers (`x-forwarded-host`/`host`/`x-forwarded-proto`) — never `Origin`/`Referer` — via the pure seam `requestOriginFromHeaders()` in `packages/auth/src/trusted-origins.ts` (7 cases) and wiring it in `packages/auth/src/server.ts` (3 cases via `auth.$context`). The hook returns `[served]` and relies on Better-Auth's **native** `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated) env to supply any extra allow-list entries. The docstring in `server.ts:38` already promises "both merge".

**S-1 closes the hedge:** make the merge **explicit in our code** so the additive allow-list cannot be silently ignored if Better-Auth ever changes how a functional `trustedOrigins` interacts with its native env. The hook will read `process.env.BETTER_AUTH_TRUSTED_ORIGINS` on each call, split/trim/filter, and return `[...new Set([...envExtra, served])]` (or `envExtra` alone when `served` is `null` — direct `auth.api` calls). One additional wiring test will pin the behaviour. No schema, no dependency, no infra change.

---

## 2 · Deep Understanding Synthesized (PRD + codebase)

**Stack invariants (§3):** Better-Auth 1.7.3 (`packages/auth`), Next 16.3 `proxy.ts` at `apps/*/src/proxy.ts`, TS 5.9 strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), no package build step (`transpilePackages`), `turbo.json:globalEnv` must list every var read inside `next.config.ts` or build caches stale.

**Auth contract (§9.1/§9.7):** Email/password (≥10 chars) + magic link + Google/Apple OAuth; DB-backed sessions (revocable via `auth.$context`, FR-609); 30-day rolling, rotation on privilege change; cookie `HttpOnly; Secure; SameSite=Lax` (PRD "secure defaults — no override"). Spoofing control: session cookie theft mitigated by flags + rotation + 2FA for Owner/Admin (Phase 1 deferral tracked in ledger); `Origin` header is **attacker-controlled** and must never widen trust.

**Current auth wiring:**

| File | Role |
|---|---|
| `packages/auth/src/trusted-origins.ts:1-48` | Pure `requestOriginFromHeaders(headers)` — first token of `x-forwarded-host` or `host`, first token of `x-forwarded-proto`, `http` for loopback (`localhost/127.0.0.1/::1/[::1]`) else `https`; `null` when no host. Tested 7/7 in `trusted-origins.test.ts` incl. attacker-`Origin` independence |
| `packages/auth/src/server.ts:24-44` | `betterAuth({ url: BETTER_AUTH_URL ?? "http://localhost:3000", trustedOrigins: (request)=> [served] })`; comment documents `BETTER_AUTH_TRUSTED_ORIGINS` but does not yet read it |
| `packages/auth/src/server-origin.test.ts:14-43` | 3 wiring cases via `auth.$context` (hook is function; trusts served origin; does not trust attacker `Origin`). The working-tree fourth case ("merges env") is the S-1 test — not yet on `main` |
| `.env.example:8-14` | Documents `BETTER_AUTH_URL` **must be the public origin in production** and shows `BETTER_AUTH_TRUSTED_ORIGINS` commented example |
| `AGENTS.md:42-44` | Load-bearing note: "Auth origin trust … never `Origin`/`Referer` … pure seam `trusted-origins.ts`" |
| `docs/audits/2026-09-10-recent-changes-review/REPORT.md` §3 | Marks S-1 as the single Minor residual from `1016fda` |

**What `1016fda` proved (Better-Auth 1.7.3 `dist/context/helpers.mjs:78-80` + `origin-check.mjs:96-120`):** when `trustedOrigins` is a function, Better-Auth calls it as `getTrustedOrigins(request)` and merges the result with its internal context list before `validateOrigin` checks `Origin` vs. trusted set. Whether the native `BETTER_AUTH_TRUSTED_ORIGINS` env is included in that merge when the option is a function is **not guaranteed by the public type contract** — the docstring promise "both merge" today rides on current Better-Auth behaviour.

---

## 3 · Current Gap (Why S-1 Exists)

| Aspect | Before S-1 (committed `e9c061f`) | After S-1 (planned) |
|---|---|---|
| Hook return | `[served]` or `[]` | `[...new Set([...envExtra, served])]` or `envExtra` |
| Extra allow-list (e.g. preview domain, second admin origin) via `BETTER_AUTH_TRUSTED_ORIGINS` | Honoured only if Better-Auth merges env + hook return | Honoured unconditionally in our code |
| De-dupe when `served` already appears in env (`https://scandihaven.jesspete.shop` in both) | N/A | Single entry via `Set` |
| Empty env / whitespace / trailing commas | Not parsed | `split(",").map(trim).filter(Boolean)` handles |
| `served === null` (direct `auth.api` calls, no `Host`) | `[]` — falls back to Better-Auth's `BETTER_AUTH_URL` | `envExtra` alone — explicit allow-list still applies |

Threat if left as-is: a future Better-Auth minor that changes the function-vs-env merging semantics would silently drop the extra allow-list from the `trustedOrigins` path, with no test to catch it until a preview deploy fails to sign in.

---

## 4 · Objectives & Non-Objectives

**Objectives:**

1. Make the `BETTER_AUTH_TRUSTED_ORIGINS` merge explicit and tested in `packages/auth/src/server.ts`, removing reliance on undocumented Better-Auth internal merging.
2. Pin the behaviour with one wiring test that exercises `envExtra` + `served` + de-dupe in a single assertion suite.
3. Keep the trust boundary unchanged: proxy-controlled headers only, `Origin`/`Referer` never read.
4. Preserve boot + build + `pnpm test` gates; no new dependency; no env-var rename; no migration.

**Non-objectives (explicitly out of scope for this slice):**

- Enabling 2FA / magic-link hardening (Phase 1 deferrals, ledger-tracked).
- Changing CORS, CSP, or cookie flags (§9.3) — those are `AGENTS.md:42` + `security-headers` contracts, not touched here.
- Adding a new env var or renaming `BETTER_AUTH_TRUSTED_ORIGINS` (native Better-Auth name).
- Rate-limit or RBAC changes (§9.2/§9.4).
- `docs/env.tgz` handling (already gitignored in the working-tree opportunistic fix — see N-1 in the parent audit).

---

## 5 · Design Alternatives & Decision

| Option | Shape | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A (chosen)** | Read `process.env.BETTER_AUTH_TRUSTED_ORIGINS` inside `trustedOrigins` hook, merge with `served`, de-dupe via `Set` | Minimal diff (6 lines), pure, testable, no new module, no API change, matches Better-Auth native comma format | Reads env inside hook (not at import) — env change without restart not reflected until next request (acceptable; auth instance is per-process, env is stable per deploy) | **Adopt** |
| B | Extract `parseTrustedOriginsEnv(env)` pure helper in `trusted-origins.ts` + unit test + hook calls it | Better test isolation | Over-engineering for a 3-line parse; current working-tree choice A already ships, and the S-1 test covers it via the wiring seam | Rejected — keep diff surgical per `plan-writing` |
| C | Rely on Better-Auth native merge, add only a comment | Zero code | Leaves the undocumented-behaviour hedge open — the audit's Minor exists precisely because "both merge" is not type-contractual | Rejected |
| D | Pass `trustedOrigins: [...envExtra, requestOriginFromHeaders]` as static array at import | Simpler | Loses per-request `served` derivation — breaks reverse-proxy correctness (H-AUTH regression) | Rejected |

Chosen is option **A**, byte-identical to the working-tree diff the previous session produced.

---

## 6 · Implementation Plan — 5 Phases (sequential)

### Phase 0 — Confirm baseline & freeze plan

- [ ] `git status --porcelain` shows `M packages/auth/src/server.ts`, `M packages/auth/src/server-origin.test.ts`, `M .gitignore` (env.tgz) as the only working-tree deltas; `git diff --stat` against `e9c061f` matches the slice (`+9 / -1` in this file pair).
- [ ] This plan frozen as `PLAN.md` inside `docs/audits/2026-09-10-recent-changes-review/` (copy, not move).
- [ ] Confirm `better-auth@1.7.3` installed (`rg "better-auth" package.json`) and `turbo.json:globalEnv` already lists `BETTER_AUTH_URL` (no new env promotion needed — `BETTER_AUTH_TRUSTED_ORIGINS` is read at runtime, not inside `next.config.ts`).

### Phase 1 — Hook hardening (`packages/auth/src/server.ts`)

- [ ] Inside `trustedOrigins: (request) => { … }`, add before the `served` derivation:
  ```ts
  const envExtra = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  ```
- [ ] Change `return served ? [served] : []` →:
  ```ts
  const merged = served ? [...envExtra, served] : envExtra;
  return [...new Set(merged)];
  ```
- [ ] Keep the existing docstring; extend its trailing line to note the explicit merge ("…both merge with this hook" already covers intent — add inline comment "De-dupe so the same origin via env + served does not repeat." per working tree).
- [ ] No import change; no new helper file.

### Phase 2 — Wiring test (`packages/auth/src/server-origin.test.ts`)

- [ ] Append one `it("merges BETTER_AUTH_TRUSTED_ORIGINS allow-list with the served origin (S-1)", …)` case:
  - Save `prev = process.env.BETTER_AUTH_TRUSTED_ORIGINS`; set `"https://extra.example, https://scandihaven.jesspete.shop"`.
  - Resolve `auth.$context.options.trustedOrigins` as `(Request)=>string[]`, call with `Headers({ host: "scandihaven.jesspete.shop" })`.
  - Assert `origins` contains both `https://extra.example` and `https://scandihaven.jesspete.shop`.
  - Assert de-dupe: `filter(o => o === "https://scandihaven.jesspete.shop").length === 1`.
  - `finally` restore `prev` (`delete` if originally `undefined`).

### Phase 3 — Hygiene (`.gitignore`)

- [ ] Add `docs/env.tgz` + `**/env.tgz` under the "Secret backups" stanza (already in working tree; include in the same commit so N-1 is closed together with S-1).

### Phase 4 — Gates & verification (evidence per §12.4)

- [ ] `pnpm --filter @scandihaven/auth test -- server-origin` → **19 passed** (was 18 before S-1; evidence `evidence/auth-tests.txt` pattern).
- [ ] `pnpm lint` → **8/8**, `pnpm typecheck` → **8/8**, `pnpm build` → **2/2** (`ƒ Proxy (Middleware)` both apps).
- [ ] `pnpm --filter @scandihaven/auth test` → **19/19** total (covers `trusted-origins.test.ts` 7 + `server-origin.test.ts` 4 + others).
- [ ] `rg 'Origin' packages/auth/src/trusted-origins.ts` → only the header doc explaining why it is **not** read (no functional read).
- [ ] `rg --no-ignore` secret scan still clean (no secret introduced).

### Phase 5 — Docs & delivery

- [ ] Update `docs/verification-ledger.md` with one S-1 row (commit, seam, label **Verified**).
- [ ] Update `docs/audits/2026-09-10-recent-changes-review/ADDENDUM-S1.md` status from "implemented post-audit" to "validated via §14 sign-off; gates green".
- [ ] Commit as `fix(auth): explicitly merge BETTER_AUTH_TRUSTED_ORIGINS into trustedOrigins hook (S-1)` (Conventional Commits, single atomic slice, `main` only) with body citing H-AUTH residual and `findings.json:S-1`.

---

## 7 · Testing Strategy (seams agreed upfront, §15)

| Level | What | Where | Expectation |
|---|---|---|---|
| **Unit (pure)** | `requestOriginFromHeaders` 7 cases (already green) | `packages/auth/src/trusted-origins.test.ts` | Unchanged — no edit |
| **Unit (wiring)** | `trustedOrigins` hook returns `[served]` / `[]` / `[...envExtra, served]` with de-dupe | `packages/auth/src/server-origin.test.ts` | 3 existing + 1 S-1 new = 4; hermetic `DATABASE_URL=file:` via lazy `Pool` |
| **Integration** | Real-PG `skipIf` suites (jobs, promotions seam, rate limit) | CI only | No DB change — not re-run locally, exercised in CI with `migrate+seed` before test |
| **E2E** | No E2E change — auth POSTs still `INVALID_ORIGIN`-free on both live apps after next deploy | Playwright | Unverifiable in sandbox; verified after redeploy |
| **Negative** | Attacker `Origin: evil.example` + `host: scandihaven.jesspete.shop` → `evil.example` never in returned array | wiring test case 3 | Already green |

---

## 8 · Security & Threat Model (STRIDE)

| Threat | Before S-1 | After S-1 | Residual |
|---|---|---|---|
| **Spoofing** (attacker signs in as victim) | Hook trusts only serving `Host`/`x-forwarded-host` — browsers cannot forge it; `Origin` ignored | Identical — env merge only adds explicitly operator-configured extra origins | None |
| **Tampering** (`Origin` header widening trust) | `Origin`/`Referer` never read in `trusted-origins.ts` (7-case test `never derives from attacker-controlled Origin/Referer`) | Identical — env is operator-controlled, not attacker-controlled | None |
| **Elevation** (extra origin abused) | Extra origins only via `BETTER_AUTH_TRUSTED_ORIGINS` env, if Better-Auth merges | Same surface, now guaranteed via code | Operator must not list attacker origins — same as before, but now test-pinned |
| **DoS** (slow parse) | N/A | `split/trim/filter/Set` is O(n) on ≤ ~5 entries — negligible | None |

---

## 9 · Documentation & Env

- **`.env.example`** — already documents `BETTER_AUTH_TRUSTED_ORIGINS` with commented example and note "the origin each request is served on is always derived server-side from proxy-controlled headers" — no change.
- **`AGENTS.md:42-44`** + **`CLAUDE.md` env table** + **`README.md` Troubleshooting** — already cover the H-AUTH runbook ("Invalid origin" → set `BETTER_AUTH_URL` public + `BETTER_AUTH_TRUSTED_ORIGINS`); no change.
- **`docs/verification-ledger.md`** — single S-1 entry (Phase 5).
- **`docs/audits/…/ADDENDUM-S1.md`** — status flip (Phase 5).

---

## 10 · Rollout & Ops

- **No migration, no infra provisioning.** Change is pure runtime (one file + one test).
- **Env:** No new var; uses existing `BETTER_AUTH_TRUSTED_ORIGINS` already consumed by Better-Auth natively and documented in `.env.example:14`.
- **Deploy:** Next `main` deploy promotes S-1 to both apps (they share `packages/auth`). Until then, production behaviour is unchanged (the extra allow-list case was not actively used; `1016fda` already unbreaks the primary `served` path).
- **Rollback:** Single commit revert restores `[served]` behaviour; no data migration to undo.

---

## 11 · Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Env string malformed (`"https://a,, ,https://b"`) | Empty entries could slip into trusted list | `filter(Boolean)` after `trim` — tested via S-1 case's `", "` input |
| Duplicate entries (`env` + `served` same) | Trusted list would contain same origin twice, harmless but noisy | `new Set` de-dupe |
| `process.env` mutated at runtime in tests leaks to other suites | Other auth tests see stale env | S-1 test saves/restores `prev` in `finally` (delete if `undefined`) |
| `trustedOrigins` hook now reads env on every request — env change without restart not reflected until next request | None in practice — auth instance is per-process; env is stable per deploy | Acceptable; matches Better-Auth's own per-request env read pattern |

---

## 12 · Effort & Dependencies

- **Effort:** S — 1 file edited (`server.ts` +6/-1), 1 file extended (`server-origin.test.ts` +29), `.gitignore` +1 line. Gates `lint/typecheck/test/build` reuse existing infrastructure.
- **Dependencies:** None. No new package, no `pnpm add`, no `db` migration, no feature flag.
- **Blocked by:** Nothing.

---

## 13 · Definition of Done (DoD)

A ticket **may merge** when:

- [ ] `packages/auth/src/server.ts` merges `BETTER_AUTH_TRUSTED_ORIGINS` with `served` and de-dupes (file:line cited).
- [ ] `packages/auth/src/server-origin.test.ts` contains the S-1 merge case (save/restore, split/trim, two-assert + de-dupe) — red→green observed once, then green on re-run.
- [ ] `pnpm lint` 8/8, `pnpm typecheck` 8/8, `pnpm test` 7/7 (auth 19/19), `pnpm build` 2/2.
- [ ] `rg "Origin" packages/auth/src/trusted-origins.ts` shows only the doc comment (no functional read).
- [ ] `docs/verification-ledger.md` + `docs/audits/…/ADDENDUM-S1.md` updated; Conventional Commit on `main`.
- [ ] No `any`, no `sql.raw`, no cycle, no new dependency.

---

## 14 · VALIDATE — Explicit Confirmation Needed (blocked until you answer)

Per AGENTS.md §15 "Validate — explicit user approval before implementation":

1. **Scope lock:** Is S-1's explicit merge the whole of this slice, or should `docs/env.tgz`/`docs/session_3.md`/`docs/recent_code_changes.txt` hygiene (N-1/N-2 in the parent audit) ride in the same commit or stay separate?
2. **Test seam:** Is the single wiring-level S-1 test (19th case via `auth.$context`) sufficient, or do you want a complementary pure `parseTrustedOriginsEnv` helper + its own 3-case unit test (option B in §5)?
3. **Doc touch:** Should the ledger + addendum update ride with the code+test commit (my recommendation — single atomic slice), or as a follow-up docs commit?
4. **Authorization:** Confirm the slice may land on `main` after gates are green (Conventional Commit `fix(auth): … (S-1)`), or name a different branch gate.

**When you confirm, I will execute Phases 0→5, run the gates with evidence, and deliver the slice per §15. I will not write code until you do.**


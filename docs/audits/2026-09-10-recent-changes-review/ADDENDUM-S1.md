# Addendum S-1 — Explicit env allow-list merge in `trustedOrigins` (implemented)

| Field | Value |
|---|---|
| Parent audit | `2026-09-10-recent-changes-review` (`48be575..e9c061f`) |
| Finding | Minor S-1 — `trustedOrigins` hook returned `[served]` only, relying on Better-Auth's native `BETTER_AUTH_TRUSTED_ORIGINS` merge |
| Locus | `packages/auth/src/server.ts: trustedOrigins` + `packages/auth/src/server-origin.test.ts` |
| Effort | S |
| Plan | `docs/plans/2026-09-10-s1-explicit-env-merge-plan.md` (validated then committed per §15) |
| Status | **Validated and committed as `fix(auth): explicitly merge BETTER_AUTH_TRUSTED_ORIGINS into trustedOrigins hook (S-1)` — single atomic slice on `main`** |

## Change

`server.ts` hook now reads `process.env.BETTER_AUTH_TRUSTED_ORIGINS` on each call, splits on `,`, trims, filters empty, merges with `served`, and de-dupes via `Set`:

```ts
trustedOrigins: (request) => {
  const envExtra = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",").map(s=>s.trim()).filter(Boolean);
  const served = requestOriginFromHeaders(request?.headers ?? null);
  return [...new Set(served ? [...envExtra, served] : envExtra)];
}
```

## Test

`server-origin.test.ts` gains one case: set `BETTER_AUTH_TRUSTED_ORIGINS="https://extra.example, https://scandihaven.jesspete.shop"`, call hook with `host: scandihaven.jesspete.shop`, assert both origins present and de-duplicated to one `scandihaven.jesspete.shop`. 19/19 auth tests pass (was 18).

## Why

Defense-in-depth: if Better-Auth ever changes how a functional `trustedOrigins` interacts with the native env, the additive allow-list remains honored in our hook path. The docstring already promised "both merge" — now the code guarantees it.

## Gates

- `pnpm --filter @scandihaven/auth test -- server-origin` → 19 passed
- `pnpm lint` 8/8, `pnpm typecheck` 8/8 (no new warnings)

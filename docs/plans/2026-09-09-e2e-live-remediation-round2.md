# Remediation Plan — Live E2E Round 2 (2026-09-09)

Source audit: `docs/audits/2026-09-09-e2e-live-site-audit/findings-round2.md`
Method: TDD (Prove-It pattern) — every code fix went red → green; behavior-level E2E coverage
added for CI; skills used: repo `skills/test-driven-development`, `skills/agent-browser`,
`skills/how-to-git-push-using-ssh-wrapper` (delivery), per `skills/skills-catalog.md`.

## Plan (ordered, with alignment re-check)

| # | Finding | Fix (smallest correct path) | Files touched | Test-first artifact |
|---|---|---|---|---|
| 1 | H1-CART | `requireCart()` returns the resolved cart UUID untouched; junk-cart insert path removed from the existing-cart branch | `apps/web/src/actions/cart.ts` | `apps/web/src/actions/cart.test.ts` — 5 wiring tests (service must receive the exact id `getCartId()` returned; `ensureCart` never called with a UUID; fresh-token path and Zod guards pinned) |
| 2 | M1-PROMO | Pure humanizer map for the 8 `PromotionRejection` codes; cart service throws customer copy | `packages/commerce/src/promotions.ts`, `packages/commerce/src/cart-service.ts` | `packages/commerce/src/promotion-rejection-copy.test.ts` — 16 assertions (every code maps, none leaks the raw token/underscore) |
| 3 | H2-ADMIN | `beforeFiles` rewrites strip the `/admin` prefix; gate allows `/admin/sign-in` via a tested predicate | `apps/admin/next.config.ts`, `apps/admin/src/proxy.ts`, `apps/admin/src/lib/sign-in-paths.ts` | `apps/admin/src/lib/sign-in-paths.test.ts` (4 cases) + `apps/admin/src/next-config.test.ts` (rewrite contract pinned, mirrors the web proxy-matcher test style) |
| 4 | M2-E2E | New cart-mutation E2E spec asserting server truth across reloads | `apps/web/e2e/cart-flows.spec.ts` | The spec itself (6 scenarios; red on the pre-fix code by construction — the failure modes were proven live via agent-browser) |
| 5 | Docs | Traceability corrections (FR-401..406, FR-107, FR-801), verification-ledger entry, README troubleshooting rows, AGENTS/CLAUDE cart-identity invariant | docs + README.md + AGENTS.md + CLAUDE.md | n/a (documentation slice) |
| 6 | Delivery | Atomic conventional commits, all on `main` | git | per-commit gate runs |

Explicitly **out of scope** (kept surgical, per audit "keep findings separate from unrequested
fixes"): L2-MSG cart-failure copy rewrite (Phase 1), footer newsletter relocation (product
decision), journal detail route / header search UI (existing Deferred slices), ops actions
(secret rotation follow-ups from round 1, junk-cart cleanup after redeploy — I-OPS,
Stripe env alignment — round-1 L-STR).

## Alignment re-check against the codebase (plan validation)

- H1-CART: re-read `cart.ts`, `cart-session.ts`, `cart-service.ts`, and all `getCartId()`
  callers — `requireCart` is the only UUID→token misuse; `checkout.ts`, `cart/page.tsx`,
  `layout.tsx`, `site-header.tsx` all consume the UUID correctly. The one-line fix touches only
  the broken seam; no consumer depends on the junk-cart behavior. Dependency direction
  untouched (`web → commerce` only).
- M1-PROMO: `evaluatePromotion` reason vocabulary is a closed union (8 codes); a
  `Record<PromotionRejection, string>` map is exhaustive by construction (type-checked). The
  old message format is asserted nowhere else (searched), so no test/snapshot churn.
- H2-ADMIN: admin matcher (`/((?!api|_next/static|_next/image|favicon.ico).*)`) matches
  `/admin*` paths; gate change only widens the anonymous pass-through to the prefixed sign-in
  page. Rewrites are `beforeFiles` (after proxy, before filesystem routing) so the gate still
  sees the original prefixed path and the redirect-param flow keeps working. No new
  dependencies; `config.matcher` stays an inline literal (AGENTS.md invariant).
- M2-E2E: spec uses only existing seeded slugs/prices from `packages/db/src/seed/ensure-seeded.ts`
  (Øresund €249, Birch €449, Halden €1,299; WELCOME100 = fixed €100 off, min spend €500) and
  the existing Playwright config (chromium project, baseURL, webServer contract unchanged).

## Execution record (TDD evidence)

| Step | Gate/command | Result |
|---|---|---|
| H1-CART red | `pnpm --filter @scandihaven/web test` | 5 wiring tests FAIL against unfixed code (service called with wrong cart id; `ensureCart` called with UUID) |
| H1-CART green | `pnpm --filter @scandihaven/web test` | 16/16 PASS after `if (existing) return existing;` |
| M1-PROMO red | `pnpm --filter @scandihaven/commerce test -- src/promotion-rejection-copy.test.ts` | 16 FAIL (humanizer missing) |
| M1-PROMO green | `pnpm --filter @scandihaven/commerce test` | 109 pass / 12 skipped (real-PG), 0 regressions |
| H2-ADMIN red | `pnpm --filter @scandihaven/admin test` | sign-in-path + rewrite tests FAIL (module/config missing) |
| H2-ADMIN green | `pnpm --filter @scandihaven/admin test` | 11/11 PASS |
| Full gate | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` | lint 8/8 · typecheck 8/8 · test 7/7 tasks (185 tests: commerce 97, auth 19, db 17, config 25, web 16, admin 11) · build 2/2 |
| E2E spec | `apps/web/e2e/cart-flows.spec.ts` | Typechecked + linted; **not executed locally** (sandbox has no Docker/PG — real-PG suites and Playwright auto-skip per repo design); executes in CI where migrate+seed precede the run. The six failure modes it guards were demonstrated live against the unfixed deployment with agent-browser (see audit evidence) |

## Live-deployment follow-ups (outside this repo session)

1. Redeploy both apps — the cart fix (storefront) and rewrites (admin) take effect on
   redeploy; round-1 H-AUTH env guidance (`BETTER_AUTH_URL` = public origin) unchanged.
2. I-OPS: one-time cleanup of junk `cart` rows (`token` shaped like a UUID) after redeploy.
3. Round-1 ops notes still open: rotate exposed secrets (C2r history), Stripe env alignment
   (L-STR).

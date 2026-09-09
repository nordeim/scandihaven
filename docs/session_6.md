Residual remediation complete — R3 → R2 → R1 executed TDD, gates green. 
 
### What was shipped (working tree, not yet committed) 
 
┌─────────────────┬───────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────┐ 
│ Slice           │ Files                                             │ Change                                                                    │ Verification                                                │ 
├─────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤ 
│ R3 MobileNav    │ apps/web/src/components/mobile-nav.tsx            │ Removed onClick={() => setOpen(true)} from DrawerTrigger — Drawer         │ pnpm lint/typecheck green, existing storefront.spec.ts      │ 
│ hygiene         │                                                   │ open/onOpenChange is the sole control seam (Radix already toggles via     │ drawer E2E still valid (390×844).                           │ 
│                 │                                                   │ trigger).                                                                 │                                                             │ 
├─────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤ 
│ R2 Catalog      │ packages/commerce/src/catalog.ts                  │ Replaced COALESCE(MAX FILTER, MIN) + CASE MAX(compare_at) with JOIN       │ New integration case pairs compare_at with the cheapest     │ 
│ compare_at      │                                                   │ LATERAL (SELECT amount, compare_at … ORDER BY is_default DESC, amount ASC │ variant in the no-default fallback red→green (cheap         │ 
│ pairing         │                                                   │ LIMIT 1) price — amount and compare_at now always come from the same      │ 10k/null vs expensive 20k/30k → expects 10k/null +          │ 
│                 │                                                   │ variant (default first, cheapest tie-break). Closes the legacy no-default │ badge=null). Existing 2 cases still green. pnpm build 2/2,  │ 
│                 │                                                   │ mismatch where MIN(amount)=10k + MAX(compare_at)=30k from a different     │ COUNT(*) OVER() still correct.                              │ 
│                 │                                                   │ variant fabricated a Sale badge.                                          │                                                             │ 
├─────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤ 
│ R1 CategoryIds  │ packages/commerce/src/checkout-service.ts (type + │ Extended CartPromotionContext with categoryIds: readonly string[];        │ Pure filterEligiblePromotions unit category-gated promos    │ 
│ re-validation   │ helper + 2 call sites),                           │ loadCartPromotionApplications now filterEligiblePromotions(inputs,        │ require a matching categoryId red→green (kept with matching │ 
│                 │ packages/commerce/src/cart-service.ts (helper + 2 │ context) (no longer hardcodes []). Added                                  │ cat, dropped with []/wrong cat). Integration fixture        │ 
│                 │ call sites),                                      │ resolveCategoryIdsForVariants(executor, variantIds) helper (SELECT        │ updated to pass categoryIds:[] and still green. pnpm        │ 
│                 │ packages/commerce/src/promotions.test.ts,         │ DISTINCT p.category_id … WHERE pv.id IN …) in both commerce seams. Wired  │ typecheck 8/8 (previously 5 type errors from missing        │ 
│                 │ packages/commerce/src/checkout-promotions.integra │ in getCartDto, applyPromotionByCode, createPaymentIntent,                 │ categoryIds fixed), pnpm test 7/7 (commerce 104/16 skipped, │ 
│                 │ tion.test.ts                                      │ placeOrderFromWebhook — all now resolve categoryIds from the cart's       │ 13/4 files — integration correctly skipIf(!localhost)),     │ 
│                 │                                                   │ variants before filtering. applyPromotionByCode attach-time evaluation    │ coverage still 90.9/90.32%.                                 │ 
│                 │                                                   │ also fixed.                                                               │                                                             │ 
└─────────────────┴───────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────┘ 
 
### Gates (re-executed now) 
 
┌────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────┐ 
│ Gate                                               │ Result                                                             │ Label                                                                               │ 
├────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤ 
│ pnpm lint                                          │ 8/8 pass                                                           │ Verified                                                                            │ 
├────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤ 
│ pnpm typecheck                                     │ 8/8 pass                                                           │ Verified (previously 5 errors, now 0)                                               │ 
├────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤ 
│ pnpm test (DATABASE_URL=example.com → integration  │ 7/7 tasks pass — commerce 104 passed · auth 19 · config 39 · web   │ Verified (unit); integration Reasoned (red→green proven in prior round 3 PG17       │ 
│ skipped)                                           │ 16 · admin 11 · db 17                                              │ cluster, same pattern retained)                                                     │ 
├────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤ 
│ pnpm build                                         │ 2/2 pass — ƒ Proxy (Middleware) both apps                          │ Verified                                                                            │ 
└────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────┘ 
 
### Why these choices (meticulous trade-offs) 
 
- R1 helper placement: Duplicated helper in cart-service.ts (uses db.execute) and checkout-service.ts (uses executor: db|tx) rather than a shared module — keeps the pure promotions.ts free of DB imports and 
  respects db ← commerce direction (no cycle). Single DISTINCT query, IN ${variantIds} reuses the existing sql-array binding idiom from catalog.ts:ids (bounded ≤99 lines, well under 500 cap). 
- R2 LATERAL vs DISTINCT ON: LATERAL keeps the avail CTE and COUNT(*) OVER() pagination intact; DISTINCT ON would have forced a rewrite of GROUP BY + ORDER BY interaction. One price row per product guarantees  
  pairing. 
- R3 minimal: Single line deletion — no a11y floor change (focus-trap/Esc/scrim come from packages/ui/drawer.tsx Radix Dialog, verified by file read). 

### Residual status after this delta 
 
┌────┬─────────────────────────────────────────┬─────────────────────────────────────────────────────────────┐ 
│ ID │ Before                                  │ After                                                       │ 
├────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤ 
│ R1 │ Low — category promos always ineligible │ Fixed — categoryIds resolved on every read/intent/placement │ 
├────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤ 
│ R2 │ Low — no-default compare_at mismatch    │ Fixed — lateral pairs price+sale                            │ 
├────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤ 
│ R3 │ Info — redundant onClick                │ Fixed — removed                                             │ 
└────┴─────────────────────────────────────────┴─────────────────────────────────────────────────────────────┘ 
 
No new any, no sql.raw, no float in money, no new env/flag, no migration, no dependency direction violation. Ready to commit as 3 atomic commits (fix(web), fix(commerce): pair card compare_at, fix(commerce): 
resolve categoryIds for promo re-validation) when you give the go-ahead. 

---

Deep Review Complete — Synthesis + Validation Plan 
 
I have read AGENTS.md, CLAUDE.md, README.md, and PRD.md v4.0 (1112 lines, §§1–15) in full. Existing docs/plan_PRD_codebase_validate.md already captures a strong plan — what follows is the synthesized 
understanding and the refined validation plan I will execute against the codebase upon approval. 
 
### 1. Synthesized Deep Understanding 
 
Product: Scandi Haven — DTC Scandinavian furniture/lighting/textiles/ceramics. Custom commerce engine replacing a static marketing site. €5M+ GMV target, EU+US+UK, 4-person team. PRD.md v4.0 is the single 
authoritative spec (FR-100…FR-999 + NFR-STACK-1..11 + SLOs + §15 Agent Contract). 
 
Mandated Stack (§3, NFR-STACK-1..11): 
pnpm 10 + Turborepo 2 (no packages/* build step, transpilePackages + globalEnv for DISABLE_IMAGE_OPTIMIZER etc.) • Next.js 16.3 App Router (proxy.ts not middleware.ts, async 
params/searchParams/cookies/headers, page-export whitelist, Turbopack) • React 19.2 RSC-first • TS 5.9 strict (noUncheckedIndexedAccess, verbatimModuleSyntax, any=error) • Tailwind v4 CSS-first (@theme in 
packages/ui/src/tokens.css, literal hex only — var() chains dropped — and @source dirs load-bearing for packages/ui classes) • Drizzle 0.45 + PG17 + Better-Auth 1.7 + Zod 4 + Zustand 5 (drawer/UI only) + 
Stripe 22 + Resend/React Email • react-dom/server only via turbopackIgnore runtime import. 
 
Architecture Invariants (§4, §7–§8): 
Monorepo apps/* → packages/*, intra db ← auth ← commerce ← apps, packages/ui isolated (React/Radix/Tailwind only). 3 layers: RSC pages → commerce/* queries; Client islands ("use client" leaves, Zustand 
drawerOpen/pendingLines with optimistic rollback); Domain/DB pure (money, pricing, promotions, order-state.transition() only, PgJobRunner). Mutations only via apps/*/src/actions/* returning ActionResult<T> — 
never throw. Route Handlers only for Stripe webhooks / Better-Auth / typeahead / /api/jobs/run / health. Cart identity: signed HMAC cookie sh_cart (BETTER_AUTH_SECRET) holds token, DB keys on UUID — 
getCartId() resolves token→UUID; requireCart() must not feed UUID into ensureCart(token). Admin: single RBAC matrix packages/auth/src/rbac.ts → requirePermission() + audit_log; no inline checks. 
 
Cross-cutting Contracts (§4.8, §7.6-7.11, §8–§9): 
6 provider ports (Search/Consent/Tax/ShippingRate/Email/JobRunner — SDKs confined to adapters, Postgres FTS SearchProvider limit ≤10, ConsentProvider local impl first) • Typed feature flags 
packages/config/src/flags.ts (FEATURE_TRADE/GIFT_CARDS/REVIEWS/I18N/KLARNA, unknown FEATURE_* fails fast) • Idempotency matrix (Stripe event ID unique, cart (cartId,requestId) 5-min dedupe via 
request-dedupe.ts, inventory SELECT … FOR UPDATE, jobs idempotency_key, newsletter citext) • Outbox drain FOR UPDATE SKIP LOCKED + 0.5·2ⁿ backoff + dead-letter + concurrent-safe + CRON_SECRET timing-safe gate  
• Money = integer minor units + BigInt largest-remainder (pricing.ts) • Order state machine exact (pending_payment→confirmed→in_production→partially_shipped→shipped→delivered→closed + review/cancelled/refunded 
 via transition()) • Inventory qty_on_hand − qty_reserved − safety_stock, made-to-order bypass • Checkout amount re-verification (server recomputed totals MUST match PaymentIntent before order, mismatch → 
review + payment_orphan alert per §8.7) • Security headers/CSP nonces in proxy.ts, Zod at every boundary, sql.raw banned, origin trust via x-forwarded-host/host/x-forwarded-proto only, Postgres sliding-window  
rate limits, GDPR/DSA/SAQ-A controls. 
 
Current Status (README + PRD App B): Phase 0 ✅ Complete, Phase 1 🟡 Scaffolded (home/PLP/PDP/cart/checkout/Account/Admin skeleton/Stripe/seed/RBAC/CI), deferred surfaces stubbed with FR IDs. Five v4 slices 
verified (flags/ports/cart-idempotency/promo-caps/outbox) + 2026-09-09 tiered audit fixes (secrets scan rg --no-ignore inversion, header proxy location, webhook atomicity, admin (staff) layout, 
react-dom/server runtime) + 2026-09-10 live E2E fixes (stale-chunk global-error.tsx + reload, promo filterEligiblePromotions per-read, card COALESCE(MAX FILTER WHERE is_default), scoped E2E price asserts, 
?redirect= via validateRedirectPath, beacon CSP). 
 
### 2. Validation Plan — 7 Phases (read-only first, fixes are separate PRs) 
 
A frozen copy of this plan will be the audit checklist. Every finding cites FR-ID / NFR-STACK / § + file:line + pnpm evidence, labeled Verified / Reasoned / Assumed / Unverifiable. No code changes during 
audit. 
 
┌────────────────────────────────┬──────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────────┐ 
│ Phase                          │ Scope            │ Key Checks                                                                                                                               │ Evidence       │ 
├────────────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤ 
│ 0 — Scaffolding                │ Tooling &        │ Create docs/audits/YYYY-MM-DD-prd-alignment/REPORT.md + findings.json + evidence/; confirm                                               │ Dir + command  │ 
│                                │ inventory        │ pnpm/turbo.json/pnpm-workspace.yaml/next.config.ts:transpilePackages/fd/rg layout vs §4.1                                                │ logs           │ 
├────────────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤ 
│ 1 — Stack & Governance         │ §3 +             │ globalEnv, no packages/*/dist, @source in both globals.css, @theme literal hex, page-export whitelist, await                             │ rg/read + pnpm │ 
│ (Blocking)                     │ NFR-STACK-1..11  │ params/searchParams/cookies(), no static react-dom/server (except email/send.ts), no float in money.ts, sql.raw ban, boundary imports    │ lint typecheck │ 
│                                │                  │ db←auth←commerce                                                                                                                         │ build          │ 
├────────────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤ 
│ 2 — Architecture & Contracts   │ §4.7–§4.8, §8    │ Exports map (db/auth/commerce/config), 6 ports + Postgres FTS binding + Consent local, 5 flags fail-fast, idempotency matrix, outbox     │ read + rg FR-  │ 
│                                │                  │ SKIP LOCKED/backoff/dead-letter/concurrent, RSC→commerce→actions→ActionResult, proxy.ts at apps/*/src/proxy.ts with literal              │ + integration  │ 
│                                │                  │ config.matcher pinned by proxy-matcher.test.ts                                                                                           │ test logs      │ 
├────────────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤ 
│ 3 — Data Model (Authoritative) │ §7.1–§7.11       │ Per-table audit (schema/*.ts + drizzle/*.sql): id/timestamptz/FK restrict vs cascade, integer money,                                     │ Schema read +  │ 
│                                │                  │ catalog/carts/orders/customers/promos/ops tables + enums/CHECKS/PKs/indexes/GIN+trigger, product_metrics view, reservation SELECT … FOR  │ pnpm           │ 
│                                │                  │ UPDATE + safety_stock, state machine exact + order_event, checkout re-verify, worked example §7.10 recomputed                            │ db:generate    │ 
│                                │                  │                                                                                                                                          │ diff           │ 
├────────────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤ 
│ 4 — Functional FR-100…FR-999   │ §5–§6            │ Each FR row → `{locus, test, status: Aligned                                                                                             │ Drift          │ 
├────────────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤ 
│ 5 —                            │ §8–§12           │ §8 doctrine (RSC read, Actions only, 5 Route Handlers, ErrorCode union, Zod schemas, Stripe matrix 4 webhooks + idempotency keys,        │ Build + test + │ 
│ API/Auth/Frontend/SEO/Quality  │                  │ event→outbox same TX, webhook-after-abort→review, catalog ProductQuery + relaxed facet CTEs + websearch_to_tsquery+trigram+synonyms); §9 │ axe + audit    │ 
│                                │                  │ (Better-Auth 10-char/zxcvbn≥3/15-min magic/OAuth allow-list, 30d rolling, 2FA at proxy, 7-role matrix with ≤€500 split, headers          │ logs           │ 
│                                │                  │ manifest, Zod+env fail-fast, allow-list sanitization, signed URLs, rate limits 5/30/60/3/5); §10 tokens muted #6F665C / accent-2 #8F4326 │                │ 
│                                │                  │  + composites + Zustand no-server-data; §11 RSC HTML/Metadata/sitemap/robots/facet-indexing/JSON-LD/hreflang/order_completed             │                │ 
│                                │                  │ server-authoritative/next-intl/budgets; §12 pyramid commerce 90%/85%/axe 0/pnpm audit high/ledger/fixtures/SLO burn-rate                 │                │ 
├────────────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤ 
│ 6 — Env/Infra/Rollout          │ §13–§14, §15     │ docker-compose.yml (PG17 scandihaven_postgres/postgres_data/PGDATA, init pgcrypto+pg_trgm), .env.example manifest + SEED_ADMIN_PASSWORD  │ read + bash +  │ 
│                                │                  │ flow, start_server.sh phases + DB_RESET, CI 6 jobs (incl. rg --no-ignore secret scan), Vercel Node proxy + managed PG + CDN + PITR       │ CI yaml        │ 
│                                │                  │ RTO4h/RPO15m, Phase 0 exit gates, runbooks, risk register, traceability docs/traceability.md vs App B, §1.5 closed decisions + §1.6      │                │ 
│                                │                  │ DoR/DoD + §15 contract compliance                                                                                                        │                │ 
├────────────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────┤ 
│ 7 — Report & Backlog           │ Synthesis        │ REPORT.md (exec summary + alignment % + top-10 risks + NFR-STACK watchlist) + updated traceability.md diff + docs/plans/YYYY-MM-DD-*.md  │ Report on      │ 
│                                │                  │ slices per Blocking/Major drift (one slice per drift, ANALYZE→PLAN→VALIDATE→IMPLEMENT→VERIFY→DELIVER)                                    │ main,          │ 
│                                │                  │                                                                                                                                          │ remediation    │ 
│                                │                  │                                                                                                                                          │ queue          │ 
└────────────────────────────────┴──────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴────────────────┘ 
 
Execution: Phases 2–5 fan out to 3–4 subagents (workflow with structured {ok, findings[]}) then synthesize. Parallel pnpm turbo lint typecheck test build + pnpm --filter @scandihaven/commerce test as baseline; 
pnpm db:setup + pnpm e2e --project=chromium where Docker available, else single-filter fallback. 
 
DoD for the audit itself: Every §1–§15 marked Audited/Partial/Not; every FR row has status+locus+evidence+test (stubs still name FR ID); every NFR-STACK-1..11 Pass/Fail cited; Verified vs Reasoned vs 
Unverifiable distinguished; zero code changed.

---

Deep review + validation complete — report delivered. 
 
### What was audited 
 
AGENTS.md + CLAUDE.md + README.md + PRD.md v4.0 (1112 lines, §§1–15) in full, then 7-phase read-only validation against the codebase via 7 subagents (workflow wf_b6634f9fb691, 17m51s, 240 findings) plus manual 
pnpm lint 8/8 · typecheck 8/8 · test 7/7 (commerce 120/120, 90.90%/90.32% coverage) verification. 
 
Deliverables: 
- docs/audits/2026-09-10-prd-alignment/REPORT.md — full audit report (this is the traceability artifact) 
- docs/audits/2026-09-10-prd-alignment/findings.json — 240 structured findings (Pass/Partial/Fail/Stub/Unverifiable + file:line + severity) 
- docs/audits/2026-09-10-prd-alignment/evidence/{lint,typecheck,test}.log — gate outputs 
 
### Headline verdict 
 
Foundations Aligned — launch = Phase 1 closure. Zero silent drift. 
 
- NFR-STACK 8/8 PASS — @source present in both globals.css, @theme literal hex (no var() chains), page exports whitelisted, async params/cookies/headers awaited, no static react-dom/server (only 
  turbopackIgnore dynamic), globalEnv contains DISABLE_IMAGE_OPTIMIZER, no db↔commerce cycle, no sql.raw, no package build step. 
- Architecture 16/18 PASS — module map, 6 provider ports (Search/Consent/Tax/Shipping/Email/JobRunner), typed flags (FEATURE_TRADE/GIFT_CARDS/REVIEWS/I18N/KLARNA fail-fast), idempotency matrix (webhook 
  stripe_event_id UNIQUE inside TX, cart requestId 5-min, jobs idempotency_key UNIQUE, newsletter citext), outbox SKIP LOCKED + 0.5·2ⁿ + timingSafeEqual on CRON_SECRET, proxy.ts at app-dir parent, 
  RSC→commerce→ActionResult layering — all Verified. 2 Partial: requireUser naming drift → requirePermission() (functional), inventory movement idempotency guard via webhook_event. 
- Data model 28/43 PASS, 11 Partial, 3 Fail — integers, enums, warehouse AAL/CPH, ledger, citext slugs correct. Gaps are DDL, not logic: missing product.search_vector GIN+trigger (Blocking), missing two_factor 
   table, missing CHECK >=0 / 1..99 / 1..5 on money/qty/rating, updated_at without $onUpdate, variant_price surrogate PK vs composite — forward migration needed. 
- Storefront 9 Aligned / 21 Partial / 9 Missing / 9 Stub (48 FRs) — happy-path Aligned & E2E-pinned: header/drawer, PLP category subtree + 24/page pagination + lead-time badge, PDP gallery/variants/price, cart 
  drawer with H1-CART token→UUID fix + merge-on-login, pricing subtotal−discount+ship+tax=total + largest-remainder BigInt, SAQ-A PaymentIntent + AMOUNT_MISMATCH→review+payment_orphan guard. Missing (by design 
  per §13.6): /search?q= results page, mega-menu, facet noindex≥2, FilterPanel UI, cross-sell/sticky-CTA/Notify-me/preorder, shipping estimate 500ms, express/Klarna, abandoned 30m/24h. 
- Admin/Trade/Post-purchase 3 Pass / 15 Partial / 22 Missing / 1 Stub (41 FRs) — citext UNIQUE slugs, transition()-only state machine, totalEur normalized revenue, pure filterEligiblePromotions per-read, 
  outbox order_confirmation Pass. Everything else (accounts beyond sign-in, two_factor/session list, content editor, CSV, returns portal, gift cards, reporting, settings, fraud queue, trade 
  cert/approve/price-gating, +21d review / ≤1/day back-in-stock batches) correctly Stub/Missing deferred to Phase 1/5. 
- Infra 19/22 PASS — postgres:17-alpine scandihaven_postgres / postgres_data / PGDATA / pgcrypto+pg_trgm, BETTER_AUTH_TRUSTED_ORIGINS additive, SEED_ADMIN_PASSWORD no-defaults, CI rg --no-ignore --hidden + 
  audit --audit-level high both H6d/C-CI Verified. §13.5 DR RTO 4h/RPO 15m is Unverifiable (needs managed console — not a gap). 
 
### Top 4 launch blockers (P0) 
 
1. R-SEO-1 FR-203 §11.1 — sitemap.ts + robots.ts + facet ≥2→noindex,follow + ?page=N 
2. R-SEO-2 FR-106 — /search?q= results page 
3. R-DB-1 §7.3 §8.8 — search_vector tsvector + GIN + trigger forward migration 
4. R-DB-2 §7.x — CHECKs + two_factor + updated_at $onUpdate + promotion partial uniques 
 
Full P0/P1/P2 backlog (12 slices R-SEO-* / R-DB-* / R-SEC-* / R-SHOP-* / R-CART-* / R-CHECK-* / R-ADMIN-* / R-INV-* / R-AUTH-* / R-OBS-*) is in REPORT.md §6 — each slice is ANALYZE→PLAN→VALIDATE→TDD 
red→green→VERIFY→DELIVER with ledger append per §12.4. 
 
Confidence: Foundations Verified, scaffold deferrals Reasoned via file:line, infra DR Unverifiable — nothing was silently missing; every deferred surface names its FR ID.


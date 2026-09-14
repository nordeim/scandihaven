PRD Alignment Validation — Deep Project Understanding & Execution Plan 
 
1 · Understanding Synthesized from AGENTS.md / CLAUDE.md / README.md 
 
Product: Scandi Haven — DTC Scandinavian furniture/lighting/textiles/ceramics. Custom commerce engine replacing a static marketing site. Target €5M+ GMV, EU+US+UK, 4-person team, PRD.md v4.0 is the single 
authoritative spec (FR-100…FR-999). 
 
Stack (mandated, §3 + NFR-STACK-1..11): pnpm 10 + Turborepo 2 — no package build step — Next.js 16.3 App Router (proxy.ts, async params/searchParams/cookies, Turbopack) + React 19.2 + TS 5.9 strict 
(noUncheckedIndexedAccess, verbatimModuleSyntax, any = error) + Tailwind v4 CSS-first (@theme tokens in packages/ui/src/tokens.css, @source directives load-bearing, var() chains banned) + shadcn/Radix + 
Drizzle 0.45 + PG 17 + Better-Auth 1.7 + Zod 4 + Zustand 5 + Stripe 22 + Resend/React Email. Lockfile is pin of record. turbo.json globalEnv, DISABLE_IMAGE_OPTIMIZER, react-dom/server turbopackIgnore are all   
load-bearing quirks. 
 
Architecture invariants (§4): 
- Monorepo apps/* → packages/*, intra-package db ← auth ← commerce ← apps, packages/ui isolated (React/Radix/Tailwind only). Cycles silently break turbo — symptom is a build that "does nothing". 
- 3-layer model: RSC pages → commerce/* queries; Client islands ("use client" leaves, Zustand drawer/UI only); Domain/DB layer. RSC re-derives price/total; Zustand never holds server truth. 
- Mutations only via Server Actions in apps/*/src/actions/* returning ActionResult<T> ({ok:true,data}|{ok:false,error}) — never throw across boundary. Route Handlers only for Stripe webhooks / Better-Auth / 
  typeahead / /api/jobs/run / health. 
- Cart identity: signed HMAC cookie sh_cart (secret = BETTER_AUTH_SECRET) holds a token, DB keys on cart UUID — getCartId() resolves token→UUID; never interchange. 
- Admin: single RBAC matrix in packages/auth/src/rbac.ts, gated via requirePermission() + audit_log rows; no inline role checks. 
 
Domain rules: Money = integer minor units, BigInt largest-remainder distribution, float banned (money.ts + pricing.test.ts property tests). Order state via commerce/order-state.ts transition() only 
(InvalidOrderTransition on illegal). Provider ports in commerce/providers (Search/Consent/Tax/ShippingRate/Email/JobRunner) — vendor SDKs never leave adapter. Feature flags in config/flags fail-fast on unknown 
FEATURE_*. Seed is advisory-locked natural-key upsert, refuses non-local DATABASE_URL. Inventory availability = qty_on_hand − qty_reserved − safety_stock, made-to-order always purchasable. react-dom/server 
only via runtime dynamic import (email/send.ts pattern). 
 
Design/QA: Tokens in @theme literal hex, WCAG 2.2 AA enforced via axe (serious/critical=0), Fraunces/Inter via next/font, 44px CTAs, 4 motion durations + prefers-reduced-motion. Tests: vitest + fast-check 
(fc.assert(fc.property(...)) inside it, explicit imports), commerce coverage gates 90% lines / 85% funcs, Playwright Chromium + axe on core journeys, guest checkout asserts honest "not configured" when Stripe  
keys absent. Verification ledger (docs/verification-ledger.md) requires Verified/Reasoned/Assumed/Unverifiable labeling; money/auth/order PRs require ledger entries. Full gate order: pnpm lint typecheck test   
build then pnpm db:setup before pnpm e2e. 
 
Current scaffold (README §Status, PRD App B): Phase 0 complete, Phase 1 scaffolded. Implemented: home/PLP/PDP/cart drawer+page/checkout Payment Element/account basics/admin skeleton/product+order CRUD 
seed+RBAC Stripe wiring CI. Deferred (stubbed with FR IDs): facets UI, reviews submission, i18n routing, returns portal, gift cards, trade Net-30 etc. Five v4 remediation slices already verified: flags, 
provider ports, cart idempotency, promotion cap invariants, outbox drainer. 
 
---
 
2 · Validation Objectives 
 
1. Prove alignment or surface drift between every PRD section and the codebase — no silent gaps. 
2. Classify gaps by materiality (Blocking / Major / Minor / Deferred-by-design) and map to FR IDs / NFR-STACK rules. 
3. Produce auditable evidence — file:line citations, command outputs, coverage snapshots — not assertions. 
4. Yield a traceability matrix (FR → locus → verification → status) and a prioritized remediation backlog compatible with §15 workflow. 
 
│ Out-of-scope for this pass: performance perf-budget profiling against live staging, infra cost validation, legal copy review. Those are labeled Unverifiable pending env. 
 
---
 
3 · Methodology & Evidence Standard 
 
- Source of truth: PRD.md v4.0 prose + acceptance criteria (RFC-2119 MUST/SHOULD/MAY). Every finding cites an FR ID / NFR-STACK ID / PRD §.
- Seams agreed upfront (§15): unit for pure domain, real-PG integration for transactional semantics, E2E for critical paths. Red → Green → Fix, never skip. 
- Gates executed locally: pnpm lint && pnpm typecheck && pnpm test && pnpm build + pnpm db:setup cycle + pnpm e2e --project=chromium (or at minimum pnpm --filter @scandihaven/commerce test + relevant 
  integration suites where docker not available). 
- Claim labels: Verified (ran), Reasoned (code-inspected, no run), Assumed (inferred), Unverifiable (needs staging/secret). 
- No speculative fixes during audit — read-only pass first; remediation planned after. 
 
---
 
4 · Validation Plan — 7 Phases (sequential, phases 2–5 fan out via subagents) 
 
### Phase 0 — Audit scaffolding & tooling 
 
- Create docs/audits/2026-09-08-prd-alignment/ with REPORT.md, traceability.md, findings.json, evidence/ (command logs). 
- Add a frozen checklist copy of this plan as PLAN.md. 
- Confirm pnpm version, turbo.json task graph, and that fd/rg inventory matches §4.1 expected layout. 
- Verify: directory exists, inventory captured. 
 
### Phase 1 — Stack & governance (§3 + NFR-STACK-1..11) — Blocking 
 
Checklist (each = file:line citation + pnpm output where applicable): 
- [ ] pnpm-workspace.yaml, turbo.json (globalEnv contains DISABLE_IMAGE_OPTIMIZER etc.), transpilePackages in both apps/*/next.config.ts, no packages/*/dist build step. 
- [ ] package.json versions vs §3.1 table; lockfile is only mutated via pnpm add (git log spot-check). 
- [ ] NFR-STACK-7: apps/web/src/app/globals.css + apps/admin/src/app/globals.css contain @source …/packages/ui/src. 
- [ ] NFR-STACK-8: packages/ui/src/tokens.css @theme block uses literal hex for --color-primary etc.; palette sync spot-check. 
- [ ] NFR-STACK-9/10/11: grep for export const in apps/*/src/app/**/page.tsx (only whitelisted exports), await params/await searchParams/await cookies() pattern, react-dom/server not statically imported 
      (except runtime wrapper in packages/email/src/send.ts), packages/commerce/src/money.ts has no float arithmetic. 
- [ ] Boundary lint: packages/db imports none of auth/commerce; packages/ui imports no commerce; sql.raw banned. 
 
### Phase 2 — Architecture & cross-cutting contracts (§4 + §8) 
 
- [ ] §4.7 module map: verify exports db, schema, ensureSeeded, auth, authClient, rbac, catalog, cart-service (incl. requestId), checkout-service (amount re-verify), order-state.transition, pricing, 
      promotions, jobs.PgJobRunner, providers (6 ports), search-provider, dto/result, money; flag deep imports. 
- [ ] §4.8 Provider ports: packages/commerce/src/providers.ts declares 6 ports, search-provider.ts bound to Postgres FTS, ConsentProvider local impl — verify vendor SDKs confined to adapters. 
- [ ] Feature flags packages/config/src/flags.ts: 5 flags, unknown FEATURE_* fail-fast, type-check gate. 
- [ ] Idempotency matrix: webhook_event unique stripe_event_id, cart requestId 5-min window (request-dedupe.ts), inventory ledger key, jobs idempotency_key, newsletter citext. 
- [ ] Outbox drain /api/jobs/run: FOR UPDATE SKIP LOCKED, backoff 0.5·2ⁿ, dead letter, concurrent-safe; CRON_SECRET gate. 
- [ ] Layering: RSC pages call commerce queries, mutations via apps/*/src/actions/* only, ActionResult envelope, proxy.ts in both apps. 
 
### Phase 3 — Data model deep read (§7, authoritative) 
 
Per-table audit against packages/db/src/schema/*.ts + drizzle/*.sql: 
- [ ] §7.1 conventions: id/created_at/updated_at timestamptz, FK restrict vs cascade, snake↔camel mapping. 
- [ ] §7.2 money/rounding: integer amount columns, pricing.ts largest-remainder + worked example (§7.10) re-computed. 
- [ ] §7.3 catalog: 
      category/product/product_variant/media/product_image/variant_image/variant_price/warehouse/inventory_level/inventory_movement/collection/collection_product/search_synonym/review/back_in_stock_request —   
      enums, CHECKs, PKs, indexes, search_vector GIN + trigger. 
- [ ] §7.4 carts/orders/shipments/returns: cart/cart_line/cart_promotion/order/order_line/order_address/payment/shipment/shipment_line/return_request/return_line — number format, fx_rate numeric(18,8), status  
      enums.
- [ ] §7.5 customers/promos/gift cards: user extensions (trade_status, payment_terms), address/trade_application/promotion/promotion_redemption/gift_card/gift_card_transaction — CSPRNG, ledger. 
- [ ] §7.6 reservation semantics: SELECT … FOR UPDATE path in checkout-service, safety_stock math, made-to-order bypass. 
- [ ] §7.7 state machine: statuses/events in order-state.ts match diagram exactly; InvalidOrderTransition + order_event timeline; review/release_to_production path. 
- [ ] §7.8 ops tables: 
      user/session/account/verification/two_factor/audit_log/webhook_event/jobs/rate_limit_hit/redirect/newsletter_subscriber/fx_rate/shipping_zone/shipping_rate/announcement/nav_entry/static_page/journal_post 
      /lookbook. 
- [ ] §7.9 migrations: forward-only, updated_at trigger/$onUpdate, concurrency; §7.11 checkout re-verification (amount MUST match PaymentIntent before order). 
 
### Phase 4 — Functional requirements FR-100…FR-999 (§5–§6) 
 
For each FR group: map acceptance criteria → code locus → test locus → status. Must cover: 
- [ ] FR-101..109 global nav/search (header stickiness, hamburger dialog, mega-menu, typeahead ≥2 chars ≤250ms FTS+trigram, facets SSR, footer newsletter ActionResult, announcement dismiss persist, 404/500).   
- [ ] FR-201..208 PLP (routes, facets AND/OR, facet URL canonicalization/noindex≥2, sort ?sort=, pagination 24, card hover-swap/badge/price, lead-time badge from inventory rollup, grid/list C). 
- [ ] FR-301..313 PDP (gallery ≤8 + zoom, swatch disable + ?variant=SKU, price/compare-at/tax label, qty/wishlist, accordions, cross-sell fallback, reviews verified-buyer, sticky CTA, Notify me/preorder 
      distinct, JSON-LD, canonical /products/{slug} 301). 
- [ ] FR-401..406 Cart (drawer useOptimistic rollback, /cart shipping estimate 500ms, signed-cookie persistence + merge-on-login dedupe, re-validation notice, gift wrap line, totals breakdown). 
- [ ] FR-501..512 Checkout (accordion steps, express gated, guest + post-purchase attach, autocomplete progressive, multi-currency fx_rate, Stripe Tax, shipping method forcing >30kg white-glove, SAQ-A Payment  
      Element + mismatch gate, failure recovery requestId, confirmation proof token, abandoned-cart jobs, noindex). 
- [ ] FR-601..609 Accounts (Better-Auth email/pass+magic+Google/Apple, /account proxy gate, profile re-verify, order history invoice deterministic from snapshot, reorder skip notice, addresses, wishlist merge, 
      review status, session list+revoke all). 
- [ ] FR-701..706 Homepage & content (section order + degrade-to-hide, collections, journal sanitized rich text + product embeds, static pages FR-809, lookbooks 404 honest, redirect manager proxy.ts loop 
      detection). 
- [ ] FR-801..815 Admin (dashboard revenue normalized, product CRUD slug citext UNIQUE + publish gate hero+alt+variant+price, inventory ledger negative impossible, pricing sale windows, CSV import dry-run, 
      order list/detail timeline append-only, refund/cancel Stripe idempotent + state machine, returns workflow, content lifecycle SCHEDULED, promotions property invariants discount≤subtotal + 
      subtotal−discount+shipping+tax=total, gift-card CSPRNG, reporting from order tables, settings destructive guard Owner+typed confirm, GDPR export/anonymize, fraud queue). 
- [ ] FR-901..906 & FR-910..914 Trade/Post-purchase (trade cert signed expiring, manual approve role+email, trade price server-stripped, Net-30 Phase 5 payment_terms, bulk pad reserved, status emails via 
      outbox idempotent, tracking deep-link, returns portal guest proof + carrier stub, review email +21d, back-in-stock ≤1/day batch). 
 
Each FR ends as: Aligned | Drift (code differs) | Stub (typed placeholder per App B) | Missing | Unverifiable (needs env). 
 
### Phase 5 — API, Auth, Frontend, SEO/Perf, Quality (§8–§12) 
 
- [ ] §8 doctrine: RSC default read, Server Actions only mutation, Route Handler whitelist 5 entries, no public outbound REST; ActionResult + ErrorCode union; full action catalog input Zod vs src/actions/* 
      signatures; route handler contracts (/api/auth/[...all], /api/webhooks/stripe 300s + unique insert, /api/search/typeahead limit≤10 + rate-limit, /api/jobs/run CRON_SECRET, /api/health). 
- [ ] Stripe matrix §8.5: Payment Element SAQ-A, express methods, auto capture, Tax line persistence, currency FX lock, refunds idempotent order:{id}:refund:{n}, webhooks 4 types, test cards. 
- [ ] Event→side-effect map §8.6/8.7: outbox rows in same TX as state change; payment_failed cart stays active; webhook-after-abort → review + payment_orphan alert; §8.8 catalog query contract (single Zod 
      ProductQuery, facets w/ relaxed CTE, FTS websearch_to_tsquery + trigram union + synonym expansion, trigger-maintained search_vector, bestselling via product_metrics view not live SUM). 
- [ ] §9 Auth/security: Better-Auth methods (10-char + zxcvbn-lite≥3, 15-min magic, OAuth allow-list), 30-day rolling rotation, 2FA for Owner/Admin enforced at proxy; RBAC 7 roles typed matrix 
      (customer_service ≤€500 split, warehouse fulfillment-only); headers HSTS/CSP nonce/X-Content-Type-Options/Referrer-Policy/Permissions-Policy/X-Frame-Options via proxy.ts manifest; input Zod at every 
      boundary + env fail-fast, sql.raw ban, rich text allow-list, upload caps+random keys+signed URLs, .env git-ignored, rate limits 5/30/60/3/5 + RATE_LIMITED+Retry-After; privacy mapping §9.5-9.7 (GDPR 
      retention 7y DK, DSA trader block, PII scrub, EXIF strip, SAQ-A). 
- [ ] §10 Design: tokens.css values match §10.1 table (incl. axe-verified muted #6F665C + accent-2 #8F4326), shadcn mapping no var() chain, component inventory §10.3 present, Zustand stores per §10.4 (no 
      server data), loading/empty/error/motion + image budgets. 
- [ ] §11 SEO/Analytics/i18n/perf: indexable pages RSC HTML, Metadata API titles/canonical per entity, sitemap.ts weights + image entries + exclusions, robots.txt disallow list, facet indexing rule 0→self /1   
      curated→self /≥2→noindex,follow + pagination ?page=N, JSON-LD sitewide+PDP+PLP+Journal parse-valid, hreflang EN/da/de/sv + x-default, analytics track() typed + order_completed server-authoritative, event 
      table §11.2 payloads, i18n next-intl URL prefix + translation tables + region⊥locale (§11.4), budgets LCP<2s/1.5s checkout, INP<200/100, CLS<0.05/0.02, JS<180–250KB + Lighthouse CI enforcement. 
- [ ] §12 Quality: pyramid gates (commerce 90% lines pure domain, component, real-PG integration, E2E critical paths 8 journeys listed, axe serious/critical=0, pnpm audit --audit-level high + secret scan);
      WCAG AAA keyboard/focus/skip/ARIA/contrast/labels/targets; observability JSON logs + correlation ID in proxy.ts + Sentry + health SLO thresholds; verification ledger docs/verification-ledger.md; fixtures 
      packages/db/src/testing Zod-validated + embedded-PG per job; SLO table §12.6 burn-rate policy. 
 
### Phase 6 — Environments, infra & rollout (§13–§14) 
 
- [ ] §13.1-13.5: docker-compose.yml (postgres:17-alpine, scandihaven_postgres, postgres_data, scandihaven_net, PGDATA, init pgcrypto+pg_trgm), .env.example manifest completeness (§13.4, incl. FEATURE_*), 
      SEED_ADMIN_PASSWORD required flow, CI workflow (§13.3 6 jobs), deployment topology (Vercel Node proxy / managed PG multi-AZ / CDN) + DR RTO 4h/RPO 15m + 30-day snapshots. 
- [ ] §13.6-14.2: Phase 0 exit criteria green, Phase 1/2 gating; runbook oversell/webhook outage/migration forward-only/dev data guard non-local; risk register reach; traceability docs/traceability.md vs App B 
      scaffold inventory accuracy. 
- [ ] Closed decisions registry §1.5 + DoR/DoD §1.6 + Agent contract §15 compliance spot-check (FR IDs named, smallest correct path, validate-before-code for money/auth/order, test-first, ledger-tagged 
      claims). 
 
### Phase 7 — Report & remediation planning 
 
- Produce REPORT.md with executive summary, alignment score (% Aligned / Stub / Drift / Missing), top 10 risks, NFR-STACK regression watchlist, and a remediation backlog (each item: FR/NFR, severity, locus, 
  effort S/M/L, suggested slice). 
- Update docs/traceability.md (or create docs/audits/.../traceability.md diff). 
- Open follow-ups as docs/plans/YYYY-MM-DD-*.md slices per §15 workflow (ANALYZE→PLAN→VALIDATE→IMPLEMENT→VERIFY→DELIVER), one slice per Blocking/Major drift. 
 
---
 
5 · Execution Approach & Resourcing 
 
- Mode: read-only audit first; fixes are separate PRs after sign-off. 
- Parallelization: Phases 2–5 fan out to 3–4 subagents (catalog/orders vs. admin/content vs. auth/security/seo) coordinated via workflow (dynamic fan-out), then synthesize. Each subagent returns structured 
  {ok, findings[]} per §schema. 
- Commands per finding: at minimum rg, fd, read, plus the gate pnpm turbo lint typecheck test build (or single-filter fallback) and rg "FR-\d+" coverage scan. 
- Deliverable gates: nothing is marked Aligned without a file:line citation; money/order/security findings require a test or code path citation. 
 
6 · Success Criteria for the Audit Itself (DoD) 
 
- Every PRD §1–§15 has an explicit Audited / Partially / Not marker. 
- Every FR-1xx…FR-9xx row has a status + locus + evidence + test tuple (no row left blank — deferred stubs still name their FR ID). 
- NFR-STACK-1..11 each has Pass/Fail with citation. 
- Report distinguishes Verified (executed) vs Reasoned (inspected) vs Unverifiable (needs staging/secret). 
- No code was changed during the audit; report is on main with a follow-up remediation plan queue.


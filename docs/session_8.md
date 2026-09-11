我将首先读取上传的文件以理解完整的指令，然后继续进行克隆和审查工作流程。
让我阅读完整的操作指令文档：
I've fully internalized the operating instructions — enterprise-grade standards, TDD, evidence-based verification, root-cause fixes, security discipline, and clean handoff. Now let me set up the task plan and begin.
Repo cloned successfully. Now let me review the key documentation files:
现在让我来回顾一下 PRD 结构、服务器日志以及 session_6 文档：
Now let me examine the recent commit history and the latest audit/plan docs to understand the current state:
**Critical discovery**: `.env` is git-tracked again (commit b50c46b) with real secrets — this is a repeat of audit finding C2. Let me check the skills catalog and latest docs:
I now have a solid understanding of the project. Let me record the initial worklog and validate the environment:
Live sites are reachable (storefront 200, admin 307 gate redirect). No local Postgres — let me check how integration tests detect DB readiness:
Vitest doesn't auto-load `.env` — integration tests will skip without a shell-set local DATABASE_URL. Now let me run baseline gates to validate the codebase state:
基线门禁全绿 (lint 8/8, typecheck 8/8, test 7/7)。现在让我检查 E2E 设置并针对线上站点运行浏览器测试：
Playwright 需要浏览器安装。让我来安装它：
All 21 existing E2E specs pass against the live storefront. Now let me run a **deeper diagnostic sweep** to find NEW gaps — route/chunk integrity, console errors, canonical URLs, headers, cart/promo flows, and the admin gate:
35/40 passed. Analyzing the 5 failures: `/lookbooks` 404 is by-design (honest SSR 404 per FR-705), `typeahead` and `admin gate` are my test-logic errors (response shape is object; browser followed the 307). But **canonical → localhost** and **missing og:url** look like real issues. Let me verify with a targeted SEO sweep:
Key confirmed findings: **sitemap.xml 404** (missing — P0 blocker R-SEO-1), **canonical → localhost** (env/ops + code gap), **/search?q= 404** (P0 blocker R-SEO-2, FR-106). Let me check OG tags, JSON-LD price parity, and PLP details:
更多发现：og:image → localhost，PDP 上没有 og:url，**首页完全没有 og: 标签**，JSON-LD price 正确 (€249)。robots.txt 是 Cloudflare 管理的，没有 Sitemap 行。让我检查一下仓库中存在哪些 SEO surfaces：
PRD §11.1 requires sitemap.ts + robots.ts + search page — all confirmed missing on live. Let me read the full PRD §11 and the prior audit's P0 backlog:
已确认现有的 P0 backlog backlog 与我的在线发现一致。让我检查 CI workflow、search provider 实现以及 PRD FR-106，以规划搜索页面：
**Two discoveries**: the CI secret-scan regex misses **quoted** secret values (why `.env` passed CI), and the CI workflow header looks corrupted (`branches: ain]`). Let me verify both:
Confirmed: `branches: ain]` typo is longstanding (should be `[main]`) — push-to-main CI likely never triggers. Now let me examine the search implementation for the /search page plan:
`listProducts` already supports `search` — the /search page just needs building. Let me check the existing PLP page and site-url module to complete my understanding:
Let me check if I can install a local PostgreSQL for full verification (needed for E2E red→green on new pages):
没有 sudo。让我尝试使用嵌入式 Postgres（免 root，npm 分发）来实现本地 DB 验证：
Embedded PostgreSQL 运行成功 — 已启用完整的本地 DB 验证。让我咨询一下用于规划的 skills 目录（根据用户指示）：
现在让我来验证计划所需的几个关键实现细节（env 流、PDP 缓存、可用的查询函数）：
All details confirmed. Now let me update the worklog and write the comprehensive remediation plan:
Now let me **validate the plan against the codebase** — checking each seam before execution:
计划已针对所有接缝完全验证。额外的发现：`ProductDetail` 已经计算了 `ratingAverage`/`ratingCount` → AggregateRating JSON-LD 可以按条件触发。现在让我配置本地验证环境并开始 TDD 执行：
PG is up. Now migrate + seed the database:
All integration suites now live against embedded PG — **120/120 commerce tests** (previously 16 skipped). Beginning TDD execution.

## Slice 1 — R4-1: `.env` untrack + quoted-secret CI scan gap
Red→Green proven: new pattern detects the quoted secrets (old pattern missed them) and still passes `.env.example`. Now applying the fix:
Now untrack `.env` and verify the full CI scan replay:
Slice 1 verified: detection works, `.env` untracked (still present locally for dev). Committing:
## Slice 2 — R4-2: CI push trigger fix
Something unexpected — the `branches: [main]` change appeared in the file without my edit being recorded. Let me investigate:
The file still has the typo (the earlier Read showed a phantom state). Let me apply the fix directly and verify byte-level:
Conflicting outputs — let me run clean diagnostics:
MultiEdit changes persisted; the branches line remains unfixed. Let me apply it with python and verify atomically:
输出结果自相矛盾。让我检查一下第 5 行的原始字节：
第 5 行的原始字节实际上是 `branches: [main]` —— 此前的“ain]”输出只是显示异常。让我验证一下 git 提交状态并确认真实情况：
**Critical correction**: byte-level inspection proves the file ALWAYS had `branches: [main]` — the "ain]" was a display artifact in my tool output pipeline (bracket sequences get mangled). R4-2 is a **false finding** and must be retracted. This is why evidence-based verification matters. Updating the plan honestly:
Now **Slice 3 — sitemap.ts + robots.ts** (TDD). First let me study the existing `trusted-origins.ts` pattern for origin derivation:
Now writing the **RED tests** for Slice 3/5/6. First, the config site-url tests:
**RED confirmed** (11 failing). Now implementing GREEN — extending `config/site-url.ts`:
Config GREEN (50/50). Now the auth refactor to canonicalize the derivation seam:
Auth refactor verified (19/19). Now the commerce `listSitemapEntries` — RED test first:
The test setup INSERT needs schema-accurate values. Let me check the product schema:
**RED 已确认**。正在 `catalog.ts` 中实现 `listSitemapEntries`：
Sitemap seam GREEN. Now the `seo.ts` builders — RED tests first:
**RED confirmed**. Implementing `seo.ts` (GREEN):
Test-side bug (property is `query-input`, schema.org kebab-case). Fixing the test:
`seo.ts` GREEN (9/9). Now the route files + E2E specs. Let me check E2E conventions first:
Now writing the E2E specs (RED phase for routes):
Now build + start the server to confirm E2E RED state:
The `MetadataRoute.Robots["rules"]` type is a union (single rule | array). Fixing the test's type handling:
Build green. Now run the new E2E specs to confirm RED:
**RED confirmed** (12 failed / 1 coincidental pass). Now implementing the routes (GREEN):
Now the `/search` page — let me see the full shop page structure to mirror:
Button `outline` exists. Now updating PDP metadata + JSON-LD. Reading the full PDP page first:
The PDP already conditionally emits AggregateRating. Now creating the request-scoped site origin helper + updating PDP:
Now update the root layout — home OG/twitter metadata + sitewide Organization/WebSite JSON-LD:
构建在没有 env vars 的情况下运行（新的 shell）。正在使用 env 重新构建：
All 13 new E2E specs GREEN. Now the full suite (21 existing + 13 new) for regressions:
**34/34 E2E GREEN** — zero regressions. Adding `/search` to the axe a11y scan routes:
Axe clean on `/search`. Running full gates before committing:
All gates green (lint 8/8, typecheck 8/8, tests 245 total incl. +23 new). Committing in atomic slices:
## Slice 7 — R4-9: untrack skills caches
4 slices committed. Now **Slice 8 — documentation alignment**. Checking traceability rows to update:
现在进行验证台账——检查格式：
The ledger already has a round-3 retraction note about the same display artifact — my R4-2 retraction is consistent. Appending the round-4 entry:
现在更新 README —— 功能行 + 故障排除：
正在合并两个重叠的规范排错行：
Now the AGENTS.md / CLAUDE.md one-liners:
Now writing `docs/session_7.md` — the session narrative:
All 5 commits in. Final verification pass before push — full gates + hygiene checks:
Clean tree — no tracked secrets. Now preparing the SSH key and push setup:
The key body has a base64 length issue (3273 chars ≡ 1 mod 4 — one extra byte somewhere, likely gateway redaction damage). Let me analyze the container structure to locate the defect:
输出结果再次出现乱码。让我将原始字节导出到文件以进行准确检查：
**文件本身就是一个完整、有效的密钥** —— 之前的 `[REDACTED:...]` 观察结果也属于显示乱码（第 1 行的十六进制 = `OpenSSH private-key header`）。直接使用它：
Key validates (RSA 4096). Let me check the wrapper's key discovery, then configure the push:
Wrapper uses paramiko key discovery (`~/.ssh/id_rsa` default) + `-i` flag. Configuring the push:
**推送成功** —— 所有 5 个提交已在 `main` 分支。让我通过 GitHub API 验证推送和 CI 状态：
GitHub API is rate-limited from this sandbox IP (same condition the round-3 ledger recorded) — the push itself is verified via `git fetch` (origin/main at `61a1f91`). CI parity is established by locally executing the identical pipeline steps. Finalizing:
全部完成。以下是我交付的内容：

## 总结

**实时 E2E（第 4 轮）**：针对 `https://scandihaven.jesspete.shop/` 的仓库测试套件 21/21 全部通过（已确认所有先前的修复均在线生效）+ 40 项诊断扫描发现：**`.env` 与真实密钥被重新提交**（CI 扫描漏掉了引号内的值），**sitemap.xml 404**，**/search 404**，**canonical/OG URL 绑定到 localhost**，缺失 og/twitter/JSON-LD。

**补救措施（TDD，红→绿）** — 5 个已推送到 `main` 分支的原子提交（`8aacd13..61a1f91`）：
- 取消追踪 `.env` + 修复带引号值的密钥扫描；请求范围的 `resolveSiteUrl`（从环境变量 → 服务来源 → localhost，与身份验证规范化共享）；`sitemap.ts` + `robots.ts` + `/search?q=` 页面（FR-106）；绝对 canonical/og/twitter + Organization/WebSite/BreadcrumbList JSON-LD；技能缓存清理；完整文档对齐（追溯性/账目/会话 7）。
- **门禁**：lint 8/8 · 类型检查 8/8 · 测试 245（集成在本地 PG 上运行）· E2E **35/35** · 已追踪文件密钥扫描通过。一个诚实的撤回：所谓的 CI `branches:` 拼写错误是显示问题（已通过 `od -c` 验证）。

## 建议的后续步骤
1. **轮换** `BETTER_AUTH_SECRET`/`CRON_SECRET`（b50c46b 保留在 git 历史中），然后通过 `./start_server.sh` 重新部署 — 这也可以使 /sitemap.xml、/robots.txt、/search 和 canonicals 上线。
2. 设置 `NEXT_PUBLIC_SITE_URL` 并协调 Cloudflare Managed Robots（合并 `Sitemap:` 行）。
3. 通过 GitHub Actions 检查 CI（此沙箱的 IP 受到速率限制）；R-DB-1/R-DB-2 仍作为下一个 P0 任务排队。

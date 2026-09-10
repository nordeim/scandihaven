我将首先读取上传的文件以理解完整的指令，然后继续进行克隆和审查工作流程。
我已完全内化操作指令——企业级标准、TDD、基于证据的验证、根因修复、安全纪律和干净的交接。现在让我来设置任务计划并开始。
仓库克隆成功（HEAD `d98a415`，main）。现在让我审查关键文档：
我已经构建了全面的理解：Scandi Haven 是一个 Next.js 16 电子商务 monorepo，已经经历了五轮审计/修复；第 4 轮推送了 SEO 表面（sitemap/robots/search/PDP 规范化链接），其中列出的操作后续步骤（重新部署验证、`NEXT_PUBLIC_SITE_URL`、R-DB-1/R-DB-2）。
现在让我根据代码库进行验证并运行基准门禁：
基准门禁：lint 8/8，typecheck 8/8，build 2/2。测试捕获了账本中已知的间歇性 `apps/admin guard.test.ts` 失败——本轮我将对其追溯根因。Playwright chromium 已安装。实时站点可访问，确认第 4 轮的表面已部署（sitemap.xml/robots.txt//search 全部返回 200，PDP 规范化链接为绝对路径）。
让我针对实时存储库 origin 运行仓库的 E2E 测试套件：
**34/35 通过，1 个失败** — 失败的是 `seo-flows.spec.ts:63` 中 robots.txt 的“never a blanket disallow”（绝不全站禁止）断言：一个未作用域限制的正则表达式 `/disallow:\s*\/\s*$/im` 会匹配 Cloudflare 托管的针对每个机器人的 `Disallow: /` 块（`User-agent: Amazonbot → Disallow: /`，共 9 个机器人），这些块被合法地添加在实时 robots.txt 的应用规则之前。测试的*意图*（没有 `User-agent: *` 组全站禁止所有）是正确的；但它的*实现*（任何单独一行的 `Disallow: /`）是错误的。在实际站点上通过本地测试 —— 这正是“CI 绿色，实时红色”类别的 bug。
现在针对实时环境运行更深层次的诊断扫描（62 项检查）：
53/62 通过。已针对代码库验证的发现：
1. **R5-2（高）**：og:url 在除 PDP 之外的每个页面都解析到 `http://localhost:3000` —— 根布局的 `metadataBase` 是构建时静态的（`process.env.NEXT_PUBLIC_SITE_URL ?? localhost`，`layout.tsx:26`），且第 4 轮的请求作用域修复仅覆盖了 PDP。更糟糕的是：home/PLP/collections/journal/static 页面根本没有输出任何 `rel=canonical`，且分类页面的规范化链接被 localhost 绑定。
2. **R5-3（中）**：sitemap 宣布了 `/shop/beds` + `/shop/storage`，但它们返回了 404 —— `/shop/[category]` 会对任何商品总数为 0 的分类返回 404，而 sitemap 则列出了每个活跃的分类。该页面自身的“No pieces here yet”（此处暂无商品）空状态分支是**无法到达的死代码** —— 这证明了最初的意图是返回 200 空状态。
3. **R5-4（中）**：管理守卫的不稳定测试（flake）已通过确凿的证据追溯根因：`Error: Test timed out in 5000ms` —— 第一个测试对工作区 TS 图（`admin-guard` → `auth` → `commerce`/`db`）的冷动态导入，在 7 向并行 turbo 争用下超出了 vitest 的默认超时时间（失败运行耗时 5096/6704ms；隔离运行耗时 976ms）。确认并非逻辑 bug。
调查结果为非发现项：typeahead `?q=a` 按设计返回 200 空对象（优雅的客户端契约 —— 我的扫描预期有误）；实时 404 *确实*在真实浏览器中渲染了恢复链接（内容在 RSC flight 负载中传输；原始 HTML 是 Next 16 的 `__next_error__` 外壳 —— 记录为提示信息）。使用假凭据的管理门控链、请求头、移动端导航、购物车流程、搜索、JSON-LD 价格一致性、分块完整性：全部实时确认。
根据用户指示，已参考技能目录；应用了 `tdd-workflow`（红→绿）、`e2e-testing-lessons`（混合 API+UI 扫描、控制台/网络观察）和 `how-to-git-push-using-ssh-wrapper`。计划已写入 `docs/plans/2026-09-10-live-e2e-remediation-round5.md` 并针对每个衔接点（vitest 配置、spec 行、布局元数据、目录查询、种子数据）进行了验证。非目标已如实记录：R-DB-1/R-DB-2 仍作为下一个 P0 切片（这是 PRD 对齐发现的问题，而非 E2E 发现的问题；迁移红→绿是它们的前提）。

环境：嵌入式 PostgreSQL 17.5（zonky 二进制文件，无 root 权限，信任认证，:5432）— 已迁移并植入数据，因此本次会话在本地执行了 real-PG 集成套件和完整的 Playwright 测试。

## 切片 1 — R5-4：工作区测试超时余量

已捕获两次 RED（原文：5000ms 超时）。由于相同的根本原因类也复现了 `packages/auth` 中的失败（在完全未缓存的负载下 `server-origin.test.ts:17`），因此该修复应用于模式级别：在所有六个导入了工作区 TS 源码的 vitest 配置中，将 `testTimeout` 设置为 30_000，并附带根本原因注释。GREEN（测试通过）：**6/6 次 `turbo run test --force` 全并行运行**（此前 auth 在相同负载下为 0/5；管理守卫自第 3 轮以来一直不稳定）。已提交 `7eec00f`。

## 切片 2 — R5-1：组感知 robots 断言

针对实时环境 RED（34/35）。现在解析 `User-agent:` 组，并仅在全匹配组内部禁止单独的 `Disallow: /`；应用自身的 disallow 设置 + sitemap 引用断言保持不变。GREEN（测试通过）针对实时环境和本地环境。已与切片 3 一起提交。

## 切片 3 — R5-2：请求作用域的 metadataBase + 每页的 canonical/og:url

首先是 RED E2E：8 个新的 `seo-flows.spec.ts` 用例针对 `${SERVED_ORIGIN}` 断言每个公共页面的规范化链接（canonical）+ og:url —— **针对实时环境有 7 个失败**（规范化链接为 null / og 为 localhost），并且由于相同的原因（本地 metadataBase `localhost:3000` ≠ 服务 origin `127.0.0.1:3000`），RED 在本地也成立。

GREEN（测试通过）实现过程揭示了两个值得记录的 Next 语义：
- 分段级别的 `openGraph` **整体替换**了布局对象 —— 页面级的 `{url: "/shop"}` 覆盖在本地删掉了 og:title/site_name。解决方案：一个纯构建器 `publicPageMetadata()`（位于 `lib/seo.ts` 中，根据仓库约定进行单元测试），它为每个页面发出完整的 og 块 + 规范化链接对。
- Next 将 `/` 规范化链接解析为**不含尾部斜杠的裸 origin** —— 测试期望已归一化。

变更：布局 `generateMetadata` 携带 `metadataBase = new URL(await currentSiteUrl())`（每个路由已经是请求动态的 —— 无缓存变更）；构建器连接到 home、/shop、/shop/[category]、/collections、/collections/[slug]、/journal、/[slug]。本地构建：**43/43 E2E**。已提交 `f677699`。

## 切片 4 — R5-3：空分类渲染 200

TDD：`catalog-category.integration.test.ts` RED 4/4（函数缺失）→ 在 `commerce/catalog` 中实现 `hasActiveCategory(slug)`（参数化，仅活跃）→ 4/4 对真实 PG 执行 GREEN（beds 为 true，lighting 为 true，未知为 false，瞬态非活跃为 false 并进行清理）。页面逻辑：存在性检查替换 `total === 0 → notFound()`；空状态分支变得可达；未知/非活跃 slug 仍然返回 404（FR-201）。E2E：`/shop/beds` 返回 200 + 空状态 + 零商品卡片；未知 slug 返回 404；新的 **sitemap-parity spec** 获取每个被通告的 `<loc>` 并在任何非 200 状态上失败。完整本地套件 **46/46**。所有门禁绿色：lint 8/8，typecheck 8/8，commerce 127（+4），web 28（+3），build 2/2。已提交 `8da1c09`。

## 切片 5 — 文档对齐

追踪矩阵（元数据/规范化行现为“站点范围”，包含 R5-2 衔接点；sitemap 行增加了 R5-1/R5-3；FR-201 行增加了空分类契约），验证账本第 5 轮条目（切片表 + 非发现项 + 操作列表），AGENTS.md/CLAUDE.md 规范行（站点范围请求作用域元数据、组感知 robots 断言、超时余量），README 故障排除行（robots 误报、空分类、不稳定超时 —— CSP 行已保留），第 5 轮计划文档，以及本叙述。

## 最终验证

- `pnpm lint` 8/8 · `pnpm typecheck` 8/8 · `pnpm build` 2/2
- `pnpm test` 7/7 个任务，real-PG 集成套件已执行；admin/auth 在 6 次强制全并行运行中稳定
- Playwright：**46/46 本地**（生产构建 + 嵌入式 PG）；修复后的 specs 针对实时环境为绿色
- `git ls-files` 密钥态势干净（无 `.env`，无 skills 缓存）

## 建议的后续步骤

1. **通过 `./start_server.sh` 重新部署存储库（storefront）** —— 发布站点范围的规范化/og:url 以及空分类页面（管理应用程序未更改）。然后重新验证：`/shop/beds` 200，home/PLP 规范化链接为绝对路径，sitemap 对齐。
2. **设置 `NEXT_PUBLIC_SITE_URL=https://scandihaven.jesspete.shop`**（存储库 + 管理员 origin）—— 请求作用域的回退现在覆盖了每个页面，但根据 §11.2，环境变量仍然是声明的真实来源（并消除启动警告）。
3. 从第 3/4 轮延续下来的任务：轮换 `BETTER_AUTH_SECRET`/`CRON_SECRET`（b50c46b 历史记录），Stripe 环境变量对齐，一次性清理垃圾 UUID 形状的购物车行。
4. R-DB-1/R-DB-2（来自 PRD 对齐审计的 `search_vector` GIN+触发器；CHECK/two_factor/updated_at/partial-unique 迁移）仍然是接下来的 P0 切片 —— 此会话中使用的嵌入式 PG 测试工具就是为它们准备好的一切。

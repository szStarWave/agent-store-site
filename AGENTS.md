# AGENTS.md

Flowy Agent Store 官网：**Docusaurus 3.10**（SSG）、React 19、TypeScript 的**纯静态**站点。
它同时承担三件事：产品落地页、双语文档站、以及三个市场源（专家 / 技能 / 连接器）的目录页。

> 本站原先基于 React Router v8（framework 模式 + SSG）与 Vite 8，已整站迁移到 Docusaurus。
> 迁移的关键约束与取舍见 [迁移纪要](docs/docusaurus-migration.md)。

## 命令

| 命令 | 说明 |
| --- | --- |
| `bun run dev` | 开发服务器 → `http://127.0.0.1:5173`（`docusaurus start --host 127.0.0.1`）。启动报 safe-delete / trash 失败时，先 `$env:NODE_OPTIONS=""`。 |
| `bun run build` | SSG → `build/`，并把市场树头像拷成 `build/source/`。直接跑 `docusaurus build` 会漏掉拷贝步骤，线上头像全部退化成字母徽标。 |
| `bun run preview` | 本地托管 `build/`。它**刻意不做 SPA 兜底**，用来暴露上一条的漏拷贝。 |
| `bun run check:docs-sync` | 双语文档结构门禁，改过 `content/docs/` 后必跑；`bun run test:docs-sync` 是它自身的测试。 |
| `bun run sync` | 市场树同步（`sync:tree` + `sync:market`）。这是唯一允许写 `market-source/` 与 `content/market.json` 的入口，流程见 [市场维护](docs/market-maintenance.md)。 |
| `bun run import:experts` | 从上游专家市场 bundle 批量获取专家到**站外副本**（`--slugs` / `--from-file` / `--dry-run` / `--archive` / `--allow-b`）。只写副本与存档，不碰生成物；用法见 [专家导入计划](docs/market-expert-import-plan.md) §9。 |
| `bun run check:market` | 市场门禁：查清单内重复登记，并核对 `market-source/` 与 `content/market.json` 是否一致（条目数、条目集合、头像文件是否存在、`_files.txt` 与树）。改过任一产物后必跑；`bun run test:market` 是它自身的测试。 |
| `bun run check:release` | 发布门禁（站点半边）：`check:docs-sync` + `test:docs-sync` + `check:market` + `test:market` + `test:market-zips` + `typecheck`。发版时与源仓库的 `bun run release:check` 一起跑，流程见 [发布流程](docs/release-process.md)。 |

提交信息用 Conventional Commits + 中文主题，沿用现有 scope：`feat(landing): …`、
`chore(market): …`、`fix(dev): …`、`docs(market): …`。用户文档一律中文
（`content/docs/en-US/` 除外）。

## 硬约束

**生成物只由脚本写。** `market-source/` 是上游市场工作目录的 1:1 镜像，
`content/market.json` 是目录页快照，两者都是生成物，手工编辑会被下次同步覆盖或剪除。
它们是一次同步的两个产物，**必须成对提交**——只提交一个会让页面与树互相指向不存在的东西。
市场条目的新增、修改、下架一律去上游做，不要在本仓库里改。`bun run check:market` 是这条
约束的判据：同步门禁只看树内部，重复登记与两产物不一致都不在它的视野里。

**双语文档保持结构一致。** `content/docs/zh-CN/` 与 `en-US/` 各自要有同名页面。
译文可以自由重写措辞，但标题层级、代码块数量与语言、表格列数、相对链接目标必须对齐，
`bun run check:docs-sync` 就是这条约束的判据。新增一篇文档要同时建两份，并**在
`src/lib/docOrder.ts` 登记**——`docusaurus.config.ts` 会在构建期核对两者是否一致，漏登记直接构建失败。

**两套语言前缀是硬需求，不要启用 Docusaurus 的 i18n。** 文档正文里的站内链写死为
`/zh-CN/docs/x` 与 `/en-US/docs/x`（每种语言 70 处），而 Docusaurus 的 i18n 会**省掉默认语言
前缀**。因此站点用「单 locale + 两个 docs 插件实例」保留带前缀的 URL：`docusaurus.config.ts`
的 `docsPlugin()` 各指一个 `content/docs/<lang>`。改动这块前先读
[迁移纪要](docs/docusaurus-migration.md) §3。

**不要给 `package.json` 加 `"type": "module"`。** Docusaurus 生成的 `.docusaurus/*.js` 是
CommonJS 形态；一旦整仓声明 ESM，webpack 会把它们按模块解析，`require.resolveWeak` 会**原样
留在 server bundle 里**，SSG 阶段抛 `TypeError: require.resolveWeak is not a function` 并中断构建。
这是迁移期踩过的坑，排查见 [迁移纪要](docs/docusaurus-migration.md) §6。

**文档锚点 id 由 `src/remark/legacy-heading-ids.ts` 决定，不要删。** 正文里已有指向旧算法 id 的
站内锚点（如 `configuration.md` 的 `#mcp-json-声明-mcp-server`）。Docusaurus 默认的 github-slugger
会删掉标点得到 `mcpjson声明-mcp-server`，锚点静默失效、`onBrokenAnchors: "throw"` 还会把构建打红。

**文案成对加。** UI 字符串都在 `src/i18n/zh-CN.ts` 与 `en-US.ts`，加键时两侧同时加；
`zh-CN` 是兜底语言。

**静态托管的行为都落在 `edgeone.json`。** 缓存头与路由重写只写在这里。不要加「未命中
一律回退 `index.html`」的兜底重写：缺失的 `.js` 必须如实返回 404，否则客户端会把 HTML 当
JSON 解析并抛 `Unexpected token '<'`。

## 目录与配置落点

| 路径 | 角色 |
| --- | --- |
| `src/` | 应用代码：`pages/`（路由）、`views/`（页面组件）、`components/`、`theme/`（swizzle 的 `Layout` 与 `DocItem`）、`i18n/`、`lib/`、`plugins/`、`remark/`、`css/style.css`（手写 CSS + 设计变量，无 Tailwind / UnoCSS） |
| `content/docs/` | 站点文档（双语 Markdown），**不是**生成物；由 docs 插件直接读，正文不解析 MDX |
| `content/market.json` | 生成物：目录页数据源 |
| `content/release.json` | 版本号单一真源，站点 UI 与 `scripts/release.mjs` 共用同一个号 |
| `market-source/` | 生成物：市场树镜像（约 22.6k 文件），刻意不在 `static/`，因为构建期拷贝整个静态目录会拖垮构建 |
| `static/` | Docusaurus 的静态目录（原 `public/`）：`install.ps1`、favicon 等 |
| `scripts/` | 市场同步、市场与文档门禁、构建期拷贝、本地预览、发版 |
| `docs/` | 面向维护者的中文文档，不进站点 |
| `docusaurus.config.ts` | 站点配置：两个 docs 实例、`markdown.format: "md"`、Prism、静态目录 |
| `tsconfig.json` | **不继承** `@docusaurus/tsconfig`（其 `baseUrl` 在 TypeScript 7 已移除），按需显式声明 |
| `edgeone.json` | EdgeOne Makers 的构建/部署配置：`outputDirectory: "build"`、`/assets/**` 与 `/source/**` 缓存头。**推送到 `main` 本应触发构建，但该自动触发自 2026-09-17 起失效**，当前需按 [`docs/deploy-trigger.md`](docs/deploy-trigger.md) 手动触发 |

## 文档索引

| 文档 | 用途 |
| --- | --- |
| [`README.md`](README.md) | 构建、部署、市场源地址、内容来源 |
| [`docs/docusaurus-migration.md`](docs/docusaurus-migration.md) | **迁移纪要**：为何不启用 i18n、URL 映射、swizzle 与插件落点、踩过的六个坑（`type: module`、prism `jsonc`、`LayoutProvider`、TypeScript 7 的 `baseUrl`、remark 插件只写 `data.id` 被覆盖、单 locale 的 `<html lang>`）、与旧站的差异清单 |
| [`docs/market-maintenance.md`](docs/market-maintenance.md) | 市场相关问题的入口：条目规范、更新流程、换机与多人协作、冲突处理、门禁报错与故障排查 |
| [`docs/release-process.md`](docs/release-process.md) | 发布流程（本站仓这一半）：本仓在发布里的四个角色、站点侧有序步骤、顺序约束、部署后自检、已知缺口。权威清单在源仓库 `allo` 的 `docs/agent-store/25-release-runbook.zh.md` |
| [`docs/deploy-trigger.md`](docs/deploy-trigger.md) | **手动触发部署**：项目类型（`Github` 型不能用 CLI 上传通道）、三条只读接口、`CreatePagesDeployment` 的形状与实测、构建日志定位失败原因、令牌与部署后自检 |
| [`docs/connector-coverage.md`](docs/connector-coverage.md) | 连接器覆盖现状、近似项甄别方法 |
| [`docs/modelscope-mcp-api.md`](docs/modelscope-mcp-api.md) | ModelScope MCP 开放接口（当前未接入本站） |

# AGENTS.md

Flowy Agent Store 官网：React Router v8（framework 模式 + SSG）、Vite 8、React 19、
TypeScript 的**纯静态**站点。它同时承担三件事：产品落地页、双语文档站、以及三个市场源
（专家 / 技能 / 连接器）的自托管宿主。

## 命令

| 命令 | 说明 |
| --- | --- |
| `bun run dev` | 开发服务器 → `http://127.0.0.1:5173`。启动报 safe-delete / trash 失败时，先 `$env:NODE_OPTIONS=""` 再启动。 |
| `bun run build` | 预渲染 → `build/client/`，并把市场树拷成 `build/client/source/`。直接跑 `react-router build` 会漏掉拷贝步骤，线上 `/source/…` 全部 404。 |
| `bun run preview` | 本地托管构建产物。它刻意不为 `/source` 兜底，用来暴露上一条的漏拷贝。 |
| `bun run check:docs-sync` | 双语文档结构门禁，改过 `content/docs/` 后必跑；`bun run test:docs-sync` 是它自身的测试。 |
| `bun run sync` | 市场树同步（`sync:tree` + `sync:market`）。这是唯一允许写 `market-source/` 与 `content/market.json` 的入口，流程见 [市场维护](docs/market-maintenance.md)。 |
| `bun run check:market` | 市场门禁：查清单内重复登记，并核对 `market-source/` 与 `content/market.json` 是否一致（条目数、条目集合、头像文件是否存在、`_files.txt` 与树）。改过任一产物后必跑；`bun run test:market` 是它自身的测试。 |
| `bun run check:release` | 发布门禁（站点半边）：`check:docs-sync` + `test:docs-sync` + `check:market` + `test:market` + `typecheck`。发版时与源仓库的 `bun run release:check` 一起跑，流程见 [发布流程](docs/release-process.md)。 |

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
`bun run check:docs-sync` 就是这条约束的判据。新增一篇文档要同时建两份。

**每个对外页面都要进预渲染清单。** 线上只部署 `build/client/` 里的静态文件，没有运行时
服务端。新页面若未被 `react-router.config.ts` 的 `prerender()` 枚举到，线上只会拿到
SPA 空壳，SEO 与社交预览都是空的。

**文案成对加。** UI 字符串都在 `app/i18n/zh-CN.ts` 与 `en-US.ts`，加键时两侧同时加；
`zh-CN` 是兜底语言。

**静态托管的行为都落在 `edgeone.json`。** 缓存头与路由重写只写在这里。不要加「未命中
一律回退 `index.html`」的兜底重写：缺失的 `.data` / `.js` 必须如实返回 404，否则客户端
会把 HTML 当 JSON 解析并抛 `Unexpected token '<'`。

## 目录与配置落点

| 路径 | 角色 |
| --- | --- |
| `app/` | 应用代码：`routes.ts` 路由表、`pages/`、`components/`、`i18n/`、`lib/`、`styles/style.css`（手写 CSS + 设计变量，无 Tailwind / UnoCSS） |
| `content/docs/` | 站点文档（双语 Markdown），**不是**生成物 |
| `content/market.json` | 生成物：目录页数据源 |
| `content/release.json` | 版本号单一真源，站点 UI 与 `scripts/release.mjs` 共用同一个号 |
| `market-source/` | 生成物：市场树镜像（约 8.9k 文件），刻意不在 `public/`，因为构建期拷贝 `publicDir` 会让预渲染卡住 |
| `scripts/` | 市场同步、市场与文档门禁、构建期拷贝、发版 |
| `docs/` | 面向维护者的中文文档，不进站点 |
| `react-router.config.ts` | 预渲染路由清单 + `routeDiscovery: initial` |
| `vite.config.ts` | `BASE_PATH` → `base`；开发态托管 `/source/**` |
| `edgeone.json` | EdgeOne Makers 的构建/部署配置：部署命令、`_files.txt` 缓存头、`.data` 重写。**推送到 `main` 即由它触发构建并上线** |

## 文档索引

| 文档 | 用途 |
| --- | --- |
| [`README.md`](README.md) | 构建、部署、市场源地址、内容来源 |
| [`docs/market-maintenance.md`](docs/market-maintenance.md) | 市场相关问题的入口：条目规范、更新流程、换机与多人协作、冲突处理、门禁报错与故障排查 |
| [`docs/release-process.md`](docs/release-process.md) | 发布流程（本站仓这一半）：本仓在发布里的四个角色、站点侧有序步骤、顺序约束、部署后自检、已知缺口。权威清单在源仓库 `allo` 的 `docs/agent-store/25-release-runbook.zh.md` |
| [`docs/connector-coverage.md`](docs/connector-coverage.md) | 连接器覆盖现状、近似项甄别方法 |
| [`docs/modelscope-mcp-api.md`](docs/modelscope-mcp-api.md) | ModelScope MCP 开放接口（当前未接入本站） |

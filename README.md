# Flowy Agent Store — 官网

**Flowy Agent Store** 的营销 + 文档站点：一个本地优先、单文件形态的智能体
运行时，内嵌 Web UI，并通过命令行启动。

> 本站为纯静态站点（SSG），无需服务器。推送到 `main` **本应**触发 EdgeOne Makers 构建并上线，
> 但该自动触发自 2026-09-17 起失效，当前需要手动触发（见 [`docs/deploy-trigger.md`](docs/deploy-trigger.md)）；
> 构建、缓存与重写配置见[部署](#部署)一节。

## 技术栈

- Docusaurus 3.10（SSG，纯静态产物 → `build/`）
- React 19 + TypeScript
- 站点内建双语层（`src/i18n/`，上下文驱动；`zh-CN` / `en-US` 两套 URL 前缀）
- 文档由 docs 插件在构建期解析（按纯 Markdown，非 MDX），围栏代码由 Prism 高亮
- `lucide-react` 图标 + 自定义 CSS 设计变量（不使用 Tailwind/UnoCSS）

> 本站原先基于 React Router v8 + Vite 8，已整站迁移到 Docusaurus；迁移的取舍与踩过的坑见
> [`docs/docusaurus-migration.md`](docs/docusaurus-migration.md)。

## 快速开始

```bash
bun install
bun run dev      # 启动开发服务器 → http://127.0.0.1:5173
```

> 若启动时报 safe-delete / trash 操作失败，先 `$env:NODE_OPTIONS=""` 再启动。

## 构建与预览

| 命令 | 说明 |
| --- | --- |
| `bun run sync` | 同步市场树（`sync:tree` + `sync:market`），见下一节 |
| `bun run sync:tree` | 把本地三个市场工作目录镜像进 `market-source/`，并生成 `_files.txt` |
| `bun run sync:market` | 由 `market-source/` 生成 `content/market.json`（纯本地读取，无网络） |
| `bun run build` | SSG 生成静态站点 → `build/`，随后把目录页头像拷为 `build/source/` |
| `bun run preview` | 本地托管 `build/`（**刻意不做 SPA 兜底**，缺失路径如实 404） |
| `bun run typecheck` | 类型检查（`tsc --noEmit`） |
| `bun run check:market` | 市场门禁：查清单内重复，并核对 `market-source/` 与 `content/market.json` 是否一致 |
| `bun run check:docs-sync` | 双语文档结构门禁，改过 `content/docs/` 后必跑 |

> 部署到子路径时用 `BASE_PATH`：`BASE_PATH=/<repo>/ bun run build`。

### 关于 `market-source/`

市场树（experts / skills / connectors，约 22.6k 个文件）**刻意不放在 `static/`**：
Docusaurus 会在构建期拷贝整个静态目录，而这棵树让构建卡在拷贝阶段。因此由
`scripts/copy-market-tree.mjs` 在 `docusaurus build` 之后拷贝，公开 URL 仍是
`/source/<market>/…`；开发态则由 `src/plugins/market-source-dev.ts` 直接把
`/source/**` 映射到 `market-source/`（仅 dev，不进产物）。

> 注意：**本站不再整树托管任何市场**。三个市场已迁到 ModelScope 的 zip 归档
> （`pack:market` / `publish:market`），产物里只留目录页引用的头像（约 648 个文件）。

## 市场源

本站自身就是三个市场源（`url` 型 `source_kind`），供运行时/工作台镜像：

| 市场 | 清单 | 目录清单 |
| --- | --- | --- |
| 专家 | `/source/experts/.codebuddy-plugin/marketplace.json` | `/source/experts/_files.txt` |
| 技能 | `/source/skills/.codebuddy-skill/marketplace.json` | `/source/skills/_files.txt` |
| 连接器 | `/source/connectors/.codebuddy-connector/connectors.json` | `/source/connectors/_files.txt` |

`_files.txt` 是预生成的目录清单（一行一个相对路径，不含自身），静态托管没有
动态枚举端点，客户端以此镜像整棵条目树。目录页 `/market` 的头像直接引用同一批
文件（`source/<market>/…`），不再有单独的图标下载缓存。

**托管边界。** EdgeOne Makers 对构建产物有两条硬上限：**≤ 20,000 个文件**、**单文件 ≤ 25 MiB**
（无提额入口）。三个市场合计 22,612 个文件、且专家市场里有一个 45.8 MiB 的数据集，因此
`scripts/copy-market-tree.mjs` 支持只**整树**托管其中一部分，开关是脚本里的 `HOSTED_DEFAULT`
常量（随提交进仓库、推送即生效）；环境变量 `SITE_HOSTED_MARKETS` 只是本地试算用的覆盖：

```powershell
$env:SITE_HOSTED_MARKETS="skills,connectors"   # 未列出的市场只留目录页引用的图片
```

默认仍是三个全托管。切换前必须先给搬出去的市场安排新宿主——客户端 `config.toml` 里写的是
`<本站>/source/<market>/…`，市场消失而没有替代会让它们拉不到市场。细节见
[`docs/market-maintenance.md`](docs/market-maintenance.md) §1「托管边界」。

## 内容来源

1. **源仓库** —— `app/lib/platform.ts` 中的 `GITHUB_REPO`（`Michael-Lfx/allo`）
   是**源**仓库；发布版二进制文件既不存在于该仓库，也不由本站托管，而是由
   GitHub Releases（`content/release.json` 的 `repo`）分发。
2. **下载链接** —— 同一文件中的 `RELEASED_PLATFORMS` 是“实际已发布内容”的
   唯一权威来源：只有已发布的平台（目前为 Windows x64）会获得直接的资源 URL
   （`flowy-agent-store-<tag>-<os>-<arch>.zip`）；其余平台统一导向 GitHub
   Releases 页，而非返回 404。**本站不托管下载产物**：域名下没有 `/downloads/*`
   （也不做重定向），二进制一律走 GitHub Releases——产物体积和 git 历史都不受影响。
   请与 `content/docs/{zh-CN,en-US}/compatibility.md` 保持一致。
3. **CLI 名称** —— 文档中以 `flowy-agent-store` 作为运行时命令；若可分发包
   名称不同，请相应调整。

## 部署

本站由 **腾讯云 EdgeOne Makers（Pages）** 部署，项目以 Git 方式连接本仓库，
构建配置在同目录的 [`edgeone.json`](./edgeone.json)：

| 配置项 | 值 |
| --- | --- |
| `installCommand` | `bun install` |
| `buildCommand` | `bun run build`（含拷贝目录页头像 → `build/source/`） |
| `outputDirectory` | `build` |

`edgeone.json` 里固化了两条缓存策略：

1. **`headers` → `/assets/**`** —— Docusaurus 产出的 JS / CSS 文件名带内容 hash，
   可以放心长缓存（`max-age=31536000, immutable`）。
2. **`headers` → `/source/**`** —— 头像与市场清单路径**不带 hash**，必须
   `max-age=0, must-revalidate`，否则替换图标后客户端会一直拿旧图。

`rewrites` 现在是**空的**：旧站需要把 `/zh-CN/_.data` 重写到 `/zh-CN.data`（React Router
的 SSG 布局数据），Docusaurus 的客户端路由不产出 `.data` 请求，那两条重写已无对象。

> **不要**加「未命中一律回退 `index.html`」的兜底重写：缺失的 `.js` 必须老老实实返回
> 404，否则客户端会把 HTML 当 JSON 解析并抛 `Unexpected token '<'`。

**每个对外页面都会进产物。** 与旧站不同，Docusaurus 不需要手写预渲染清单：
`src/pages/` 下的每个文件、以及两个 docs 插件 `path` 下的每篇 Markdown 都会生成静态 HTML。
新增文档时**必须同时在 `src/lib/docOrder.ts` 登记**——`docusaurus.config.ts` 会在构建期
核对「侧边栏顺序表」与「磁盘上的文档集合」是否一致，不一致直接构建失败。

**发布方式：** 推送到 `main` **本应**触发 EdgeOne Makers 构建并上线；但自 2026-09-17 起
**GitHub 自动触发失效**（最后一次平台产生的部署是当日 07:38 的 `47bcdff5`，其后的推送都没有
产生部署）。在控制台修好 Git 集成之前，发布必须用 **API 手动触发一次**，做法与实测见
[`docs/deploy-trigger.md`](docs/deploy-trigger.md)。注意本站项目是 **`Github` 型**，
`edgeone makers deploy`（上传通道）对它**不可用**。
市场内容更新走 `bun run sync` → 提交 → 部署，无需在构建期访问任何外部源。

**一次发布含两个出口**（npm 的 `@flowy-agent-store/*` 与本站的 GitHub Release）：站点侧动作、
顺序约束与部署后自检见 [`docs/release-process.md`](docs/release-process.md)，权威清单在源仓库
`Michael-Lfx/allo` 的 `docs/agent-store/25-release-runbook.zh.md`。发版前先在源仓库跑
`bun run release:check`，再在本仓跑 `bun run check:release`。

**待定：** 自定义域名与 HTTPS 尚未绑定；EdgeOne 的预览域名带签名 `eo_token`
会过期，不能作为长期对外公布的市场源地址。

## 目录结构

```
docusaurus.config.ts     站点配置（两个 docs 实例、markdown.format、Prism、静态目录）
src/                     应用代码（pages 路由 / views 页面 / components / theme 外壳 / i18n / lib / plugins / remark / css）
static/                  Docusaurus 静态目录（install.ps1、favicon）
content/docs/            Markdown 文档，含 zh-CN 与 en-US（与上游源仓库 Michael-Lfx/allo 的 docs/agent-store 保持同步）
content/market.json      由市场树生成的目录页快照（bun run sync:market）
market-source/           市场树（experts / skills / connectors + _files.txt），提交进仓库
scripts/                 市场同步、市场/文档门禁、构建期拷贝、本地预览、发版
docs/                    面向维护者的中文文档（不进站点）
edgeone.json             EdgeOne Makers 构建/缓存配置
```

目录内部划分与迁移取舍见 [`docs/docusaurus-migration.md`](docs/docusaurus-migration.md) §8。


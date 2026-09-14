# Flowy Agent Store — 官网

**Flowy Agent Store** 的营销 + 文档站点：一个本地优先、单文件形态的智能体
运行时，内嵌 Web UI，并通过命令行启动。

> 本站为纯静态站点（SSG），无需服务器。当前发布为**手动**方式：合并到 `main`
> 并不会自动上线，请先阅读[部署](#部署)一节。

## 技术栈

- React Router v8（framework 模式，内置 SSG，无需额外 prerender 插件）
- Vite 8 + React 19 + TypeScript
- `i18next` / `react-i18next`，支持 `zh-CN` / `en-US`（复用 `web/` 模式）
- `react-markdown` + `remark-gfm` + `rehype-highlight`，用于渲染文档
- `lucide-react` 图标 + 自定义 CSS 设计变量（不使用 Tailwind/UnoCSS）

## 快速开始

```bash
bun install
bun run dev      # 启动开发服务器 → http://localhost:5173
```

## 构建与预览

| 命令 | 说明 |
| --- | --- |
| `bun run sync` | 同步市场树（`sync:tree` + `sync:market`），见下一节 |
| `bun run sync:tree` | 把本地三个市场工作目录镜像进 `market-source/`，并生成 `_files.txt` |
| `bun run sync:market` | 由 `market-source/` 生成 `content/market.json`（纯本地读取，无网络） |
| `bun run build` | 预渲染静态 HTML → `build/client/`，随后把 `market-source/` 拷为 `build/client/source/` |
| `bun run preview` | 本地托管生产构建产物 |
| `bun run typecheck` | 类型检查（`tsc --noEmit`） |

> 部署到子路径时用 `BASE_PATH`：`BASE_PATH=/<repo>/ bun run build`。

### 关于 `market-source/`

市场树（experts / skills / connectors，约 8.5k 个文件）**刻意不放在 `public/`**：
Vite 会在构建期拷贝 `publicDir`，而位于项目根目录的这棵树会让 React Router 的
prerender 请求失败（构建卡在准备输出目录阶段）。因此由
`scripts/copy-market-tree.mjs` 在 `react-router build` 之后拷贝进产物，公开 URL
仍是 `/source/<market>/…`；`vite.config.ts` 里同时把该目录排除出 watcher，
以免拖慢开发态。

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

## 内容来源

1. **源仓库** —— `app/lib/platform.ts` 中的 `GITHUB_REPO`（`Michael-Lfx/allo`）
   是**源**仓库；发布版二进制文件并不存放在该仓库，而是由 VPS 下载主机
   （`DOWNLOAD_HOST`，目前为裸 IP 的 HTTP 源）分发。
2. **下载链接** —— 同一文件中的 `RELEASED_PLATFORMS` 是“实际已发布内容”的
   唯一权威来源：只有已发布的平台（目前为 Windows x64）会获得直接的资源 URL
   （`flowy-agent-store-<tag>-<os>-<arch>.zip`）；其余平台统一导向下载中心，
   而非返回 404。请与 `content/docs/{zh-CN,en-US}/compatibility.md` 保持一致。
3. **CLI 名称** —— 文档中以 `flowy-agent-store` 作为运行时命令；若可分发包
   名称不同，请相应调整。

## 部署

本站由 **腾讯云 EdgeOne Makers（Pages）** 部署，项目以 Git 方式连接本仓库，
构建配置在同目录的 [`edgeone.json`](./edgeone.json)：

| 配置项 | 值 |
| --- | --- |
| `installCommand` | `bun install` |
| `buildCommand` | `bun run build`（含拷贝 `market-source/` → `build/client/source/`） |
| `outputDirectory` | `build/client` |

`edgeone.json` 里还固化了两件静态托管必需的事：

1. **`headers`** —— 三个 `_files.txt` 显式 `no-cache`。Makers 默认按文件名是否带
   hash 分流浏览器缓存（带 hash → 一年，`index.html` 等 → `max-age=0`），而清单
   必须在每次部署后立刻可见。边缘缓存本身会在每次部署后自动失效。
2. **`rewrites`** —— `/zh-CN/_.data` → `/zh-CN.data`（`en-US` 同理）。SSG 的布局
   数据落在 `zh-CN.data`，而客户端导航到 `/zh-CN/` 时请求的是 `zh-CN/_.data`，
   缺这条重写会出现回首页白屏。

> **不要**加「未命中一律回退 `index.html`」的兜底重写：缺失的 `.data`/`.js` 必须
> 老老实实返回 404，否则客户端会把 HTML 当 JSON 解析并抛
> `Unexpected token '<'`。

> **注意：预渲染列表必须覆盖全部对外页面。** 站点只部署 `build/client/`
> （静态文件），不存在运行时服务端。只有 `react-router.config.ts` 中
> `prerender()` 枚举到的路由才会生成带内容的静态 HTML；未被覆盖的页面
> 线上只会拿到 SPA 空壳，对 SEO 与社交分享预览不友好。新增文档/页面后，
> 务必保证 `prerender()`（目前通过 `docSlugs(lang)` 遍历所有文档 slug）能
> 枚举到它。

**发布方式：** 推送到 `main` 由 EdgeOne 侧触发构建（或在其控制台手动触发）。
市场内容更新走 `bun run sync` → 提交 → 部署，无需在构建期访问任何外部源。

**待定：** 自定义域名与 HTTPS 尚未绑定；EdgeOne 的预览域名带签名 `eo_token`
会过期，不能作为长期对外公布的市场源地址。

## 目录结构

```
app/                     React Router 应用（根、路由、布局、页面、组件、i18n、lib）
content/docs/            Markdown 文档，含 zh-CN 与 en-US（与上游源仓库 Michael-Lfx/allo 的 docs/agent-store 保持同步）
content/market.json      由市场树生成的目录页快照（bun run sync:market）
market-source/           市场树（experts / skills / connectors + _files.txt），提交进仓库
scripts/sync-market-tree.mjs   本地市场工作目录 → market-source/ + 生成清单 + 校验
scripts/sync-market-data.mjs   市场树 → content/market.json（纯本地）
scripts/copy-market-tree.mjs   构建后拷贝 market-source/ → build/client/source/
edgeone.json             EdgeOne Makers 构建/缓存/重写配置
react-router.config.ts   ssr 默认开启 + prerender()
vite.config.ts           base = BASE_PATH；watcher 忽略 market-source/
```


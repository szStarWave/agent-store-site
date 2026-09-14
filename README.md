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
| `bun run build` | 按路由预渲染静态 HTML，输出至 `build/client/` |
| `bun run preview` | 本地托管生产构建产物 |
| `bun run typecheck` | 类型检查（`tsc --noEmit`） |

> 发布到 GitHub Pages 时，需将仓库子路径设为 base URL：
> ```bash
> BASE_PATH=/<repo>/ bun run build
> ```

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

上游源仓库 [`Michael-Lfx/allo`](https://github.com/Michael-Lfx/allo) 中的 [`.github/workflows/deploy-site.yml`](https://github.com/Michael-Lfx/allo/blob/main/.github/workflows/deploy-site.yml) 负责部署：
它基于仓库名推导 `BASE_PATH` 进行构建，
并将 `build/client/` 发布到 GitHub Pages。它还会将 `index.html` 复制为
`404.html`，使未知深层链接回退到 SPA 外壳。

> **注意：预渲染列表必须覆盖全部对外页面。** 站点只部署 `build/client/`
> （静态文件），不存在运行时服务端。只有 `react-router.config.ts` 中
> `prerender()` 枚举到的路由才会生成带内容的静态 HTML；未被覆盖的页面
> 线上只会拿到 SPA 空壳（`404.html` 兜底），对 SEO 与社交分享预览不友好。
> 新增文档/页面后，务必保证 `prerender()`（目前通过 `docSlugs(lang)` 遍历
> 所有文档 slug）能枚举到它，否则该页面线上将缺少预渲染内容。

**触发方式：仅手动。** 工作流中的 `push:` 触发已被注释掉，因此仅通过
`workflow_dispatch` 运行（Actions → “Deploy site” → Run workflow）。
合并到 `main` 分支并**不会**自动发布站点。

待定事项（尚未确定）：最终托管入口及其域名/HTTPS。这与裸 IP 的 HTTP 下载源
是同一个开放性问题，也是安全工具对 `irm … | iex` 一行命令保持警惕的原因 ——
详见上游源仓库 [`Michael-Lfx/allo`](https://github.com/Michael-Lfx/allo) 的 [`docs/agent-store/16-sdk-webui-site-priority-plan.zh.md`](https://github.com/Michael-Lfx/allo/blob/main/docs/agent-store/16-sdk-webui-site-priority-plan.zh.md)（Q2 / C5）。

## 目录结构

```
app/            React Router 应用（根、路由、布局、页面、组件、i18n、lib）
content/docs/   Markdown 文档，含 zh-CN 与 en-US（与上游源仓库 [`Michael-Lfx/allo`](https://github.com/Michael-Lfx/allo) 的 `docs/agent-store` 保持同步）
react-router.config.ts   ssr 默认开启 + prerender()
vite.config.ts          base = BASE_PATH
```

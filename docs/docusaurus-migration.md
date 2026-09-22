# Docusaurus 迁移纪要

本站原先基于 **React Router v8（framework 模式 + SSG）+ Vite 8 + React 19**，现已整站迁移到
**Docusaurus 3.10**。这份文档记录「为什么这么迁」以及「踩过哪些坑」，供后续维护者与
Agent 判断改动边界。它不是上手文档——命令与目录落点见仓库根目录的 [`AGENTS.md`](../AGENTS.md)。

## 1. 迁移范围

整站迁移，三类页面全部落在同一个 Docusaurus 站点里：

| 页面 | 旧实现 | 新实现 |
| --- | --- | --- |
| 落地页 `/`、`/zh-CN`、`/en-US` | `app/pages/Landing.tsx` | `src/views/Landing.tsx` + `src/pages/{index,zh-CN/index,en-US/index}.tsx` |
| 市场目录页 `/market`、`/zh-CN/market`、`/en-US/market` | `app/pages/Market.tsx` | `src/views/Market.tsx` + `src/pages/market.tsx` 等 |
| 文档站 `/zh-CN/docs/*`、`/en-US/docs/*` | `app/pages/Docs.tsx`（`react-markdown` 运行时解析） | docs 插件构建期解析 + 原生 `@theme/DocItem`（本分支不再 swizzle） |
| 站点外壳（导航 / 页脚 / 主题 / 动效） | `app/root.tsx` + `app/layouts/Lang.tsx` | 原生 `@theme/Navbar` / `@theme/Footer` + `src/theme/Root`（语言 context）+ `src/theme/Footer`、`src/theme/NavbarItem`（文案与语言前缀） |

**产物仍是纯静态**：`docusaurus build` → `build/`，由 EdgeOne Makers 托管。旧站的
`build/client/` 目录形态不复存在。

## 2. URL 完全不变

这是本次迁移最硬的一条要求，也是方案选择的起点：

**文档正文里的站内链是绝对路径。** `content/docs/{zh-CN,en-US}/` 从上游 `Michael-Lfx/allo`
同步，正文中写死了 70 处 `/zh-CN/docs/x` 与 70 处 `/en-US/docs/x` 形态的链接
（如 `configuration.md` 的 `[升级与迁移指引](/zh-CN/docs/upgrade)`）。这些文件**不为迁移动**：
它们是上游同步的产物，也是 `bun run check:docs-sync` 的输入。

因此迁移后逐个 URL 与旧站一致：

```
/                      /zh-CN                  /en-US
/market                /zh-CN/market           /en-US/market
                       /zh-CN/docs             /en-US/docs
                       /zh-CN/docs/<slug>      /en-US/docs/<slug>   （各 10 页）
```

**没有做任何重定向**，因为不需要——旧链接直接命中新产物。

## 3. 为什么不启用 Docusaurus 的 i18n

Docusaurus 的 i18n 机制会**省略默认语言前缀**：`defaultLocale: "zh-CN"` 时中文文档的 URL 是
`/docs/x`，而不是 `/zh-CN/docs/x`。这与第 2 节的要求直接冲突，也与线上既有外链冲突。

所以站点**只声明一个 locale**（`i18n.locales = ["zh-CN"]`，仅用于 `<html lang>`），语言改用
**两个 docs 插件实例**各自保留带前缀的 `routeBasePath`：

```ts
// docusaurus.config.ts
function docsPlugin(lang) {
  return ["@docusaurus/plugin-content-docs", {
    id: lang,
    path: `content/docs/${lang}`,        // 源树按语言分开，与上游同步约定一致
    routeBasePath: `${lang}/docs`,       // URL 保留前缀：/zh-CN/docs/…
    sidebarPath: false,                  // 侧边栏由站点自己的外壳渲染
    beforeDefaultRemarkPlugins: [legacyHeadingIds],
  }];
}
plugins: [...LANGUAGES.map(docsPlugin), marketSourceDevPlugin]
```

站点语言由 **URL** 决定（`src/lib/locale-constants.ts` 的 `languageFromPath()`），
`src/theme/Root` 把它注入 React context，组件用 `useLanguage()` / `useTranslation()` 读取。

> **旧站靠 i18next 的全局可变语言**（路由 loader 在渲染前 `changeLanguage()`）。Docusaurus
> 没有路由 loader，而 SSG 与客户端 hydration 必须得到同一种语言——全局可变状态在预渲染时
> 会把语言串页。因此 `src/i18n/index.tsx` 改成**上下文驱动的纯函数** `t`，并去掉了
> `i18next` / `react-i18next` 依赖。语言不做浏览器自动探测：旧站的 `/` 本就固定渲染 zh-CN，
> 探测只影响初值、随后被 loader 覆盖，所以按 URL 决定与旧行为等价，还避免了 hydration 错配。

**新增文档的连带动作**：`content/docs/` 的 Markdown 不带 front matter，所以「有哪些页」
只能由磁盘决定、「按什么顺序展示」写在 `src/lib/docOrder.ts`。`docusaurus.config.ts` 在构建期
核对两者，**漏登记直接构建失败**（旧站的等价缺陷是 `prerender()` 清单漏页 → 线上只拿到
SPA 空壳）。

## 4. Markdown 按 `md` 解析，不按 MDX

文档正文含 `<n>`、`{...}` 这类 CommonMark 文本（如 `` `--port <n>` ``、`` `{ code, signal }` ``）。
Docusaurus 默认用 MDX，会把它们当 JSX / 表达式解析并报错。

站点不写 MDX，因此 `markdown.format = "md"`，整站按纯 Markdown 处理：

```ts
markdown: {
  format: "md",                    // 关键：让 <n>、{...} 原样通过
  mermaid: false,
  hooks: { onBrokenMarkdownLinks: "warn" },
}
```

GFM 表格、围栏代码块与 Prism 高亮都不受影响（Docusaurus 的 `md` 处理器仍会挂 `remark-gfm`）。

## 5. 文档锚点 id 必须沿用旧算法

旧站由 `react-markdown` 渲染，标题 id 来自 `app/lib/docs.ts` 的 `slugify()`——把非字母/数字的
连续片段压成一个 `-`：

| 标题 | 旧算法（保留） | Docusaurus 默认（github-slugger） |
| --- | --- | --- |
| `` `mcp.json`：声明 MCP server `` | `mcp-json-声明-mcp-server` | `mcpjson声明-mcp-server` |

正文里已有指向旧 id 的站内锚点（`configuration.md` 的 `#mcp-json-声明-mcp-server`），
所以 `src/remark/legacy-heading-ids.ts` 用旧算法生成 id，挂在
`beforeDefaultRemarkPlugins`（必须早于内置 headings / toc 插件）。删掉它的后果是锚点静默失效，
且 `onBrokenAnchors: "throw"` 会把构建打红。

## 6. 迁移期踩过的六个坑

### 6.1 `"type": "module"` 会让 SSG 崩在 `require.resolveWeak`

**现象**：webpack 编译成功，SSG 阶段抛
`TypeError: require.resolveWeak is not a function`（`server.bundle.js` 里）。

**根因**：Docusaurus 生成的 `.docusaurus/registry.js` 是 CommonJS 形态，内容形如
`require.resolveWeak("@site/content/docs/…")`；它靠 webpack 的 CommonJS 解析把它改写掉。
旧站的 `package.json` 有 `"type": "module"`（React Router 需要），而一旦整仓声明 ESM，
webpack 就按模块语义解析那些 `.js`，`require.resolveWeak` **原样留在 server bundle 里**，
Node 的 `require` 没有这个方法，于是渲染时崩。

**修复**：给 `package.json` **不加** `"type": "module"`。`AGENTS.md` 把这条写成了硬约束。

**排查手法**（供将来定位同类问题）：
```powershell
# 客户端产物已被 webpack 改写 → 计数 0；server bundle 残留 → 计数 > 0
Select-String -Path build/__server/server.bundle.js -Pattern "resolveWeak" | Measure-Object
```

### 6.2 Prism 没有 `jsonc` 语法包

**现象**：`Error: Cannot find module './prism-jsonc'`。

**根因**：文档里有两条 `````jsonc````` 围栏，而 `themeConfig.prism.additionalLanguages: ["jsonc"]`
会让 `prism-include-languages` 去 `require("prismjs/components/prism-jsonc")`——Prism 不提供
这个包。旧站用 `rehype-highlight`，它内部把 jsonc 归到 json，所以一直有高亮。

**修复**：`additionalLanguages` 里去掉 `"jsonc"`，改由 `src/clientModules/prism-jsonc.ts`
把它注册成 `json` 的别名（经 `clientModules` 注入，时机在主题装配 Prism 之后）。

### 6.3 替换 `Layout` 会丢 `ScrollControllerProvider`

**现象**：每个文档页在 SSG 阶段抛
`Hook useScrollController is called outside the <ScrollControllerProvider>`。

**根因**：主题的 `@theme/DocRoot/Layout` 会渲染 `BackToTopButton`，而它依赖
`ScrollControllerProvider`——那个 provider 由 `LayoutProvider` 提供，theme-classic 是在
**自己的 `Layout` 里**挂的。站点替换了 `Layout`（为了保留自己的站点 chrome），
于是这层 provider 一起没了。

**修复**：站点 swizzle 的 `Layout` 里显式包一层 `@theme/Layout/Provider`。
（这条坑值得留档：**只要替换 `Layout`，就必须自己挂 `LayoutProvider`**；
当前分支已移除 `Layout` swizzle、改 swizzle `Root`，该 provider 由原生 `Layout` 自己提供。）

### 6.4 TypeScript 7 移除了 `baseUrl`

**现象**：`tsconfig.json(3,3): error TS5102: Option 'baseUrl' has been removed.`

**根因**：`@docusaurus/tsconfig` 预设里写着 `"baseUrl": "."`。

**修复**：本站的 `tsconfig.json` **不继承**该预设，按需显式声明——唯一真正需要的等价物是
`paths` 里的 `@site/*`（TS7 起 `paths` 相对 tsconfig 自身解析，不再依赖 `baseUrl`）。
另需 `src/types/assets.d.ts` 补图片模块声明（`@docusaurus/module-type-aliases` 只声明了少数几种）。

### 6.5 自定义 remark 插件只写 `data.id` 会被内置插件覆盖

**现象**：迁移后锚点 id 变成了 github-slugger 的形态（`mcpjson声明-mcp-server`），
而 `#mcp-json-声明-mcp-server` 这类既有深链静默失效。诡异之处在于**插件明明执行了**
（加 `console.error` 能看到），却完全没生效。

**根因**：Docusaurus 的内置 headings 插件排在 `beforeDefaultRemarkPlugins` **之后**。
它的取值顺序是：先看 `hProperties.id`（有就沿用），没有才按 github-slugger 从标题文本重算，
**然后把结果写回 `hProperties.id` 与 `data.id`**。所以只写 `data.id` 等于白写——内置插件读不到
`hProperties.id`，就自己算一个并覆盖回去。

**修复**（`src/remark/legacy-heading-ids.ts`）：两个字段都写。另外注意必须用**回写赋值**
（`node.data ??= {}`、`data.hProperties ??= {}`），写成 `const p = data.hProperties ?? {}`
会得到一个没挂回 `data` 的孤儿对象，同样不生效。

**自查手法**（不依赖肉眼比对）：
```powershell
# 全站逐页核对：每个 href="#x" 是否都有对应的 id
Select-String -Path build/zh-CN/docs/configuration/index.html -Pattern 'id="mcp-json-声明-mcp-server"' -AllMatches
```

### 6.6 单 locale 会让 `frontMatter` 之外的 `<html lang>` 全是 `zh-CN`

**现象**：英文页面的 `<html>` 是 `<html lang="zh-CN">`。

**根因**：`<html lang>` 由 `@docusaurus/core` 的 `SiteMetadataDefaults` 用
`localeConfigs[currentLocale].htmlLang` 设置。站点只声明一个 locale（这是 §3 的前提），
所以每页都拿到 `zh-CN`。搜索引擎与屏幕阅读器据此选断词与发音规则，英文页被判成中文是实打实的缺陷。

**修复**：在 swizzle 的最外层组件里用 `<Head><html lang={lang} /></Head>` 按 URL 覆写。
react-helmet 的 `<html>` 属性是合并语义，后写的值覆盖先写的，所以能生效。
**不要**改用 `useEffect` 改 `document.documentElement.lang`：那只在客户端生效，SSG 产物里仍是错的。

**踩过的第二个坑**：`<Head>` 的位置很关键，必须放在 `children` **之后**。
`@docusaurus/core` 的 `SiteMetadataDefaults` 挂在 `Root` 的**子树上**
（见 core 的 `App.js`：`<Root><ThemeProvider><SiteMetadataDefaults/>…`），
所以放在 `children` 之前会被它覆盖——构建出来英文页仍是 `lang="zh-CN"`，且没有任何报错。
当前的落点是 `src/theme/Root/index.tsx`。

## 7. 与旧站的差异清单

这些是**有意**的行为差异，不是缺陷：

| 项 | 旧站 | 现在 |
| --- | --- | --- |
| 文档正文渲染 | 客户端 `react-markdown` + `rehype-highlight` | 构建期编译（解析器与 highlight.js 不再进客户端 bundle） |
| 页面目录（TOC） | `extractHeadings()` 重走文档、**按位置**套 id | 直接用 docs 插件解析出的 `toc`（id 与正文同源，不会再错位） |
| 静态资源 | `public/install.ps1`，`import.meta.env.BASE_URL` | `static/install.ps1`，`@generated/docusaurus.config` 的 `baseUrl` |
| 构建产物 | `build/client/` | `build/` |
| 布局数据重写 | `edgeone.json` 里的 `/zh-CN/_.data` → `/zh-CN.data` | **不需要**：Docusaurus 的客户端路由不产出 `.data` 请求 |
| 开发态 `/source/**` | `vite.config.ts` 的 `marketSourcePlugin()` | `src/plugins/market-source-dev.ts`（经 `devServer.setupMiddlewares`） |
| 主题切换 | 站点自绘 `ThemeToggle` 写 `<html data-theme>` | 改用 Docusaurus 原生 `ColorModeToggle`（同样写 `data-theme`），站点令牌因此无需自管主题状态 |
| 侧边栏顺序 | `app/lib/docs.ts` 的 `DOC_ORDER`，站点自绘侧边栏 | 原生侧边栏 + `sidebars.ts`（顺序**生成自** `src/lib/docOrder.ts`，与页脚、文档索引页共用一个真源） |

**CSS 分三层**（早期版本是三处混在一起，改为按「作用范围」分层）：

| 文件 | 作用范围 | 内容 |
| --- | --- | --- |
| `src/css/tokens.css` | **全局** | 设计令牌（颜色 / 间距 / 圆角 / 字体 / `--maxw` / `--nav-h`）。深色令牌写在 `[data-theme="dark"]` 上，与 Docusaurus 原生 ColorMode 同属性。 |
| `src/css/style.css` | 非文档页 | 站点组件样式（落地页 / 市场页），58 KB 手写设计系统，页面类名与旧站一致。 |
| `src/css/docusaurus-overrides.css` | **全局** | 全站外壳（导航 / 页脚）与接缝：令牌 → `--ifm-*` 变量映射、`.skip-to-content` 定位。 |

**为什么令牌要单独一层**：导航栏与页脚是全站共用组件（文档页也有）。若令牌留在
`style.css`（被 `html:not(.docs-wrapper)` 守卫、只在非文档页生效），文档页就取不到
`--bg` / `--maxw`，全站统一的外壳会退化成无色。令牌本身只是变量定义、不产生视觉，
所以在文档页多定义一组是无害的——正文排版仍完全由 Infima 掌控。

**导航与页脚的做法**：不替换组件，仍由 theme-classic 的原生 `@theme/Navbar` 与
`@theme/Footer` 渲染（因此文档页侧边栏、移动端抽屉、滚动隐藏、明暗切换全部保留），
只把站点令牌映射到它们读取的 `--ifm-*` 变量上，再补少量「布局本身就不同」的规则
（导航高度 / 内边距 / 药丸链接 / 页脚配色）。

## 8. 迁移后的目录速查

```
docusaurus.config.ts      站点配置（两个 docs 实例、markdown.format、Prism、静态目录）
src/pages/                路由：index / market / 404 / {zh-CN,en-US}/{index,market,docs}
src/views/                页面组件（Landing / Market / DocsIndex）
src/theme/Root/           swizzle：语言 context + 按 URL 覆写 <html lang>
src/theme/Footer/         swizzle：页脚（文案词条解析 + 语言前缀），包原生 Footer/Layout
src/theme/NavbarItem/     swizzle：自定义导航项（custom-localeLink / custom-localeToggle）
src/css/tokens.css        设计令牌（全局）
src/css/style.css         站点组件样式（非文档页，被 scope-site-css 加守卫）
src/css/docusaurus-overrides.css  全站外壳（导航 / 页脚）与接缝（全局）
sidebars.ts               侧边栏顺序，生成自 src/lib/docOrder.ts
src/i18n/                 上下文驱动的双语层（zh-CN / en-US 词条 + t 函数）
src/lib/                  locale-constants / docOrder / i18n-value / market / platform / effects
src/plugins/              market-source-dev（开发态 /source/**）、scope-site-css（CSS 作用域）
src/remark/               legacy-heading-ids（文档锚点沿用旧算法）
src/clientModules/        prism-jsonc（jsonc → json 别名）
src/types/assets.d.ts     图片 / 字体模块声明
static/                   Docusaurus 静态目录（install.ps1、favicon）
content/docs/             双语文档（来自上游同步，不是生成物）
```

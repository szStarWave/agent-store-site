# Docusaurus 迁移架构纪要

本站原基于 **React Router v8（framework 模式 + SSG）+ Vite 8 + React 19** 构建，现已全站迁移至 **Docusaurus 3.10**。
本文档系统记录迁移架构决策、技术约束与踩坑规避指南，供后续工程维护与 Agent 参考。
日常开发命令与目录规范参见 [`AGENTS.md`](../AGENTS.md)。

## 1. 迁移范围与架构映射

全站采用单站点统一托管模式，三大核心页面领域均平移至 Docusaurus 架构体系：

| 页面业务领域 | 迁移前实现 | 迁移后实现 |
| --- | --- | --- |
| 官网落地页 `/`、`/zh-CN`、`/en-US` | `app/pages/Landing.tsx` | `src/views/Landing.tsx` + `src/pages/{index,zh-CN/index,en-US/index}.tsx` |
| 市场目录页 `/market`、`/zh-CN/market`、`/en-US/market` | `app/pages/Market.tsx` | `src/views/Market.tsx` + `src/pages/market.tsx` 等 |
| 双语技术文档 `/zh-CN/docs/*`、`/en-US/docs/*` | `app/pages/Docs.tsx`（依赖 `react-markdown` 运行时解析） | docs 插件构建期预编译 + 原生 `@theme/DocItem` 渲染 |
| 站点基础外壳（导航 / 页脚 / 语言上下文 / 动效） | `app/root.tsx` + `app/layouts/Lang.tsx` | 原生 `@theme/Navbar` / `@theme/Footer` + `src/theme/Root`（注入语言 Context）+ `src/theme/Footer`、`src/theme/NavbarItem` |

- **产物形态保持纯静态**：执行 `docusaurus build` 输出至 `build/` 目录，由 EdgeOne Makers 负责静态分发；旧架构的 `build/client/` 结构彻底弃用。

## 2. 核心约束：URL 结构保持绝对一致

URL 结构的向下兼容是本次迁移的基础约束：

- **上游绝对路径站内链硬性约束**：`content/docs/{zh-CN,en-US}/` 源自上游 `Michael-Lfx/allo` 仓库同步，文档正文硬编码了 70 处 `/zh-CN/docs/x` 与 70 处 `/en-US/docs/x` 绝对链接（例如 `configuration.md` 中的 `[升级与迁移指引](/zh-CN/docs/upgrade)`）。此类文件作为跨仓同步产物与 `bun run check:docs-sync` 门禁输入，严禁为适应站点框架调整内部路径。
- **路由无缝平移矩阵**：
  ```
  /                      /zh-CN                  /en-US
  /market                /zh-CN/market           /en-US/market
                         /zh-CN/docs             /en-US/docs
                         /zh-CN/docs/<slug>      /en-US/docs/<slug>   （各 10 页）
  ```
- **零服务端重定向**：新构建产物直接与历史 URL 1:1 精确映射，无需配置额外的 301/302 重定向规则。

## 3. 多语言架构：禁用 Docusaurus 内置 i18n 的原因

Docusaurus 默认的 i18n 机制会自动**省略默认语言的前缀**：当配置 `defaultLocale: "zh-CN"` 时，中文文档的访问路径为 `/docs/x` 而非 `/zh-CN/docs/x`。该行为破坏了 §2 中约定的现有外链与内部绝对链接。

### 架构方案：单 Locale + 多 Docs 插件实例

站点配置仅声明单一基础语言（`i18n.locales = ["zh-CN"]`，仅用于兜底 `<html lang>`），通过挂载**两个独立的 `@docusaurus/plugin-content-docs` 实例**，分别配置带语言前缀的 `routeBasePath`：

```ts
// docusaurus.config.ts
function docsPlugin(lang: string) {
  return ["@docusaurus/plugin-content-docs", {
    id: lang,
    path: `content/docs/${lang}`,        // 物理路径隔离，与上游同步约定对齐
    routeBasePath: `${lang}/docs`,       // 保留显式语言前缀：/zh-CN/docs/…
    sidebarPath: false,                  // 侧边栏由站点外壳独立接管渲染
    beforeDefaultRemarkPlugins: [legacyHeadingIds],
  }];
}
plugins: [...LANGUAGES.map(docsPlugin), marketSourceDevPlugin]
```

- **语言状态由 URL 单向驱动**：通过 `src/lib/locale-constants.ts` 的 `languageFromPath()` 提取当前语言，由 `src/theme/Root` 注入 React Context，各组件统一通过 `useLanguage()` 与 `useTranslation()` 读取。
- **避免全局状态引发的水合错配**：旧站依赖 `i18next` 的全局可变状态（在路由 loader 中动态调用 `changeLanguage()`）。由于 Docusaurus SSG 预渲染与客户端 Hydration 必须保证状态一致性，全局可变状态易导致页面跨语言串扰。现架构重构为**基于 Context 的无副作用纯函数 `t`**，彻底移除了 `i18next` / `react-i18next` 运行时依赖；同时禁用不可控的客户端浏览器语言探测，避免 Hydration Mismatch。
- **文档注册与构建校验约束**：`content/docs/` 下的 Markdown 文件未声明 Front Matter，系统通过扫描磁盘确定页面集合，并在 `src/lib/docOrder.ts` 声明展示顺序。`docusaurus.config.ts` 在构建期比对磁盘文件与排序列表，**一旦缺失注册直接中断构建**。

## 4. Markdown 解析契约：纯 MD 模式

技术文档正文普遍包含形如 `<n>`、`{...}` 的文本内容（例如 `` `--port <n>` `` 或 `` `{ code, signal }` ``）。Docusaurus 默认启用 MDX 解析引擎，会将此类标记误判为 JSX 语法或表达式从而报错。

站点未采用 MDX 语法特性，因此显式配置 `markdown.format = "md"`，全站作为纯 Markdown 解析：

```ts
markdown: {
  format: "md",                    // 保证 `<n>`、`{...}` 等文本按字面量安全渲染
  mermaid: false,
  hooks: { onBrokenMarkdownLinks: "warn" },
}
```

GFM 增强表格、围栏代码块与 Prism 语法高亮均保持正常工作（Docusaurus 的 `md` 解析器默认挂载 `remark-gfm`）。

## 5. 标题锚点 ID 兼容算法

旧版站点依赖 `app/lib/docs.ts` 中的 `slugify()` 函数生成锚点（将连续非字母数字字符合并折叠为单破折号 `-`）。正文内部已存在指向历史 ID 的跨文档锚点引用（如 `configuration.md` 的 `#mcp-json-声明-mcp-server`）：

| 标题原始文本 | 兼容算法（当前保留） | Docusaurus 默认规则（github-slugger） |
| --- | --- | --- |
| `` `mcp.json`：声明 MCP server `` | `mcp-json-声明-mcp-server` | `mcpjson声明-mcp-server` |

为确保深链可用，站点引入 `src/remark/legacy-heading-ids.ts` 插件，并挂载于 `beforeDefaultRemarkPlugins`（执行时序必须先于内置 headings 与 toc 插件）。若移除该插件，锚点将静默失效；且构建配置 `onBrokenAnchors: "throw"` 将触发致命错误阻断编译。

## 6. 迁移踩坑记录与排查指南

### 6.1 `"type": "module"` 导致 SSG 阶段抛出 `require.resolveWeak` 异常

- **故障现象**：Webpack 编译完成，但在 SSG 静态预渲染阶段抛出 `TypeError: require.resolveWeak is not a function`（发生于 `server.bundle.js`）。
- **根因分析**：Docusaurus 自动生成的 `.docusaurus/registry.js` 为 CommonJS 规范，内部包含 `require.resolveWeak("@site/content/docs/…")` 代码，依赖 Webpack 的 CommonJS 转换器进行转译。旧站 `package.json` 声明了 `"type": "module"`；在整仓 ESM 模式下，Webpack 将其作为原生模块解析，导致 `require.resolveWeak` 原样保留在 Server Bundle 中，Node.js 运行时执行缺失该方法从而崩溃。
- **解决方案**：`package.json` **严禁声明 `"type": "module"`**（此规则已写入 `AGENTS.md` 硬约束）。
- **排查验证命令**：
  ```powershell
  # 正常情况下 Client Bundle 计数为 0；若 Server Bundle 出现残留则大于 0
  Select-String -Path build/__server/server.bundle.js -Pattern "resolveWeak" | Measure-Object
  ```

### 6.2 Prism 官方缺少 `jsonc` 语法定义包

- **故障现象**：编译时抛出 `Error: Cannot find module './prism-jsonc'`。
- **根因分析**：文档包含 `````jsonc````` 语法块，而在 `themeConfig.prism.additionalLanguages` 中声明 `"jsonc"` 会触发 `prism-include-languages` 动态加载 `require("prismjs/components/prism-jsonc")`，而 Prism 官方并未提供独立的 `jsonc` 模块。旧站使用的 `rehype-highlight` 在底层将 `jsonc` 自动归类为 `json` 处理。
- **解决方案**：从 `additionalLanguages` 中移除 `"jsonc"`，在 `src/clientModules/prism-jsonc.ts` 中通过客户端模块生命周期将 `jsonc` 注册为 `json` 的别名。

### 6.3 替换 `Layout` 组件导致 `ScrollControllerProvider` 丢失

- **故障现象**：文档预渲染阶段抛出 `Hook useScrollController is called outside the <ScrollControllerProvider>`。
- **根因分析**：官方主题 `@theme/DocRoot/Layout` 渲染 `BackToTopButton` 时依赖 `ScrollControllerProvider` 上下文；该 Provider 原由官方 `@theme/Layout/Provider` 挂载。早期由于站点 Swizzle 了完整的 `Layout` 外壳，导致该 Provider 实例丢失。
- **解决方案**：重构外壳层级，避免侵入性 Swizzle `Layout`，转为 Swizzle 顶层 `Root` 组件；该 Provider 保持由官方 `Layout` 原生挂载提供。

### 6.4 TypeScript 7 废弃 `baseUrl` 编译选项

- **故障现象**：TypeScript 编译报错 `tsconfig.json(3,3): error TS5102: Option 'baseUrl' has been removed.`。
- **根因分析**：官方预设 `@docusaurus/tsconfig` 仍显式声明 `"baseUrl": "."`，与 TS 7 规范冲突。
- **解决方案**：本站 `tsconfig.json` **不继承官方预设**，显式按需声明配置项。`paths` 别名 `@site/*` 在 TS 7 下直接相对于 `tsconfig.json` 所在目录解析，无需 `baseUrl` 支持。另建 `src/types/assets.d.ts` 补齐静态资源类型声明。

### 6.5 自定义 Remark 插件属性被内置插件覆盖

- **故障现象**：编译后锚点 ID 仍然表现为 `github-slugger` 计算的形态，导致历史锚点失效，且自定义 Remark 插件日志打印显示其已被执行。
- **根因分析**：Docusaurus 内置 headings 插件在 `beforeDefaultRemarkPlugins` 之后执行。其取值逻辑为：优先读取 `hProperties.id`；若未找到，则重新计算并**全量覆写 `hProperties.id` 与 `data.id`**。若自定义插件仅设置 `data.id`，内置插件检测不到 `hProperties.id`，将重新生成并覆盖既有结果。
- **解决方案**（见 `src/remark/legacy-heading-ids.ts`）：同时向 `data.id` 与 `hProperties.id` 写入目标值，且必须使用回写赋值语法（如 `node.data ??= {}`，避免生成游离对象）。
- **核验排查命令**：
  ```powershell
  Select-String -Path build/zh-CN/docs/configuration/index.html -Pattern 'id="mcp-json-声明-mcp-server"' -AllMatches
  ```

### 6.6 单 Locale 模式下非默认语言 `<html lang>` 属性固化

- **故障现象**：英文页面输出的 HTML 根节点为 `<html lang="zh-CN">`。
- **根因分析**：`<html lang>` 属性由 `@docusaurus/core` 中的 `SiteMetadataDefaults` 基于当前 Locale 配置注入。为保留 URL 前缀，站点声明了单 Locale，导致所有静态页面默认继承 `zh-CN`，引发多语言 SEO 与屏幕阅读器解析偏差。
- **解决方案**：在 Swizzle 的外层组件 `src/theme/Root/index.tsx` 中通过 `<Head><html lang={lang} /></Head>` 依据当前 URL 路径覆写根属性。
- **执行时序约束**：`<Head>` 声明必须置于组件 `children` **之后**渲染。由于 core 的 `SiteMetadataDefaults` 挂载于 `Root` 的子树内，若置于 `children` 之前，覆写值将被其后续生命周期覆盖导致失效。严禁通过客户端 `useEffect` 动态修改 `document.documentElement.lang`，该方式无法在 SSG 产物中固化正确属性。

## 7. 架构演进与设计差异

以下为迁移过程中经过评估的技术变更：

| 对比维度 | 迁移前实现 | 迁移后规范 |
| --- | --- | --- |
| 文档正文渲染引擎 | 客户端 `react-markdown` + `rehype-highlight` 动态解析 | 构建期 SSG 预编译（解析器与高亮库彻底移出客户端 JS Bundle） |
| 目录大纲提取 (TOC) | 运行时执行 `extractHeadings()` 计算 | 直接复用 Docs 插件预编译输出的 `toc` 结构体，消除锚点漂移 |
| 静态资源引用方式 | `public/install.ps1`，`import.meta.env.BASE_URL` | `static/install.ps1`，`@generated/docusaurus.config` 的 `baseUrl` |
| 构建产物输出目录 | `build/client/` | `build/` |
| 路由数据请求重写 | `edgeone.json` 包含 `/zh-CN/_.data` 重写规则 | **彻底移除**：Docusaurus 客户端路由无需中间 `.data` 数据请求 |
| 开发态市场镜像托管 | `vite.config.ts` 的 `marketSourcePlugin()` | `src/plugins/market-source-dev.ts`（挂载于 `devServer.setupMiddlewares`） |
| 明暗主题状态管理 | 自研 `ThemeToggle` 写入 `<html data-theme>` | 接入原生 `ColorModeToggle` 并共用 `data-theme` 属性 |
| 文档侧边栏编排 | `app/lib/docs.ts` 结合自研侧边栏组件 | 原生侧边栏组件与 `sidebars.ts`（由 `src/lib/docOrder.ts` 统一生成） |

### 样式系统分层设计

全站样式拆分为清晰的三层架构：

| 样式文件 | 作用域 | 职能划分 |
| --- | --- | --- |
| `src/css/tokens.css` | **全站全局** | 设计系统全局令牌（颜色、间距、圆角、字体、`--maxw`、`--nav-h`）。深色令牌统一作用于 `[data-theme="dark"]`。 |
| `src/css/style.css` | 非文档页面 | 站点专属视觉组件样式（落地页与市场页），页面类名保持与原设计系统一致。 |
| `src/css/docusaurus-overrides.css` | **全站全局** | 全站布局外壳（导航栏与页脚）及接缝适配：负责将系统设计令牌映射至 Infima `--ifm-*` 变量体系。 |

- **设计令牌分层必要性**：导航与页脚属于全站级共享组件。若将令牌限制在 `style.css` 局部，文档页将因作用域隔离无法读取 `--bg` 与 `--maxw` 变量，导致外壳褪色。变量声明本身不产生视觉副作用，全局注入可在不侵入 Infima 文档排版的前提下保证外壳风格统一。
- **导航与页脚集成策略**：保留官方 theme-classic 原生组件渲染（确保移动端抽屉导航、滚动隐显与明暗切换机制完备），仅通过 CSS 变量映射将品牌设计令牌传递至 `--ifm-*` 变量层，并叠加关键布局覆盖样式。

## 8. 核心源码目录清单

```
docusaurus.config.ts      站点核心配置（双 docs 插件实例、markdown.format、Prism 扩展、静态目录）
src/pages/                静态路由定义（index、market、404、双语复合路由）
src/views/                页面级业务组件（Landing、Market、DocsIndex）
src/theme/Root/           Swizzle 扩展：语言 Context 注入及根 HTML lang 属性动态覆写
src/theme/Footer/         Swizzle 扩展：页脚国际化词条解析与语言前缀组装
src/theme/NavbarItem/     Swizzle 扩展：自定义导航动作项（custom-localeLink、custom-localeToggle）
src/css/tokens.css        全局设计系统令牌
src/css/style.css         非文档页专有业务样式（受 scope-site-css 插件作用域保护）
src/css/docusaurus-overrides.css  全站全局外壳样式与 Infima 变量适配层
sidebars.ts               文档侧边栏结构定义（生成自 src/lib/docOrder.ts）
src/i18n/                 上下文驱动的轻量级双语层（词条字典与纯函数 t）
src/lib/                  工具库（locale-constants、docOrder、i18n-value、market、platform、effects）
src/plugins/              自定义插件（market-source-dev 开发态代理、scope-site-css 样式作用域隔离）
src/remark/               自定义 Remark 语法插件（legacy-heading-ids 历史锚点算法兼容）
src/clientModules/        Prism 语言扩展模块（prism-jsonc）
src/types/assets.d.ts     多媒体与字体静态资源类型声明
static/                   Docusaurus 原生静态资源目录（install.ps1、favicon）
content/docs/             双语技术文档源文件（由上游同步仓库直接维护）
```

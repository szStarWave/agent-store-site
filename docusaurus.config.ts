import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Config } from "@docusaurus/types";
import type { Options as DocsOptions } from "@docusaurus/plugin-content-docs";
import { themes as prismThemes } from "prism-react-renderer";

import { DOC_SLUGS, DOC_ORDER } from "./src/lib/docOrder";
import { LANGUAGES } from "./src/lib/locale-constants";
import legacyHeadingIds from "./src/remark/legacy-heading-ids";
import marketSourceDevPlugin from "./src/plugins/market-source-dev";
import scopeSiteCssPlugin from "./src/plugins/scope-site-css";

/**
 * Flowy Agent Store 官网 —— Docusaurus 站点配置。
 *
 * 三类页面并存：产品落地页（`src/pages/`）、市场目录页（`/market`）、双语文档站
 * （`/zh-CN/docs/…` 与 `/en-US/docs/…`），另有一份 `src/theme/` 下的站点外壳。
 *
 * **刻意不启用 Docusaurus 的 i18n。** 文档源树 `content/docs/{zh-CN,en-US}/` 与上游
 * `Michael-Lfx/allo` 同步，正文里的站内链写死为 `/zh-CN/docs/x` 与 `/en-US/docs/x`
 * （每种语言 70 处）。Docusaurus 的 i18n 会**省掉默认语言前缀**（zh-CN 文档变成 `/docs/x`），
 * 与这些链接以及线上既有 URL 全部冲突。因此改用**两个 docs 插件实例**：各指向一个语言目录、
 * 各自保留带前缀的 `routeBasePath`，于是 URL 与迁移前逐个一致，`content/docs/` 一个字都不用改。
 *
 * 产物是纯静态文件：`bun run build` → `build/`，由 EdgeOne Makers 托管。
 */

const siteDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * 构建期校验：侧边栏顺序表必须覆盖 `content/docs/` 里真实存在的每一页。
 *
 * `content/docs/` 来自上游同步、**不带 front matter**，所以「有哪些页」只能由磁盘决定，
 * 而「按什么顺序展示」写在 `src/lib/docOrder.ts`。两者一旦脱节，新文档会静默地从侧边栏消失
 * ——正是旧站 `prerender()` 清单漏页那类缺陷的等价物，所以这里宁可让构建失败。
 */
function assertDocOrderCoversAllPages(): void {
  const expected = new Set(DOC_SLUGS);
  for (const lang of LANGUAGES) {
    const dir = path.join(siteDir, "content", "docs", lang);
    const onDisk = new Set(
      readdirSync(dir)
        .filter((name) => name.endsWith(".md"))
        .map((name) => name.replace(/\.md$/, "")),
    );
    const missing = [...onDisk].filter((slug) => !expected.has(slug));
    const stale = [...expected].filter((slug) => !onDisk.has(slug));
    if (missing.length || stale.length) {
      throw new Error(
        `[docusaurus.config] src/lib/docOrder.ts 与 content/docs/${lang}/ 不一致：` +
          `${missing.length ? `未登记 ${missing.join(", ")}` : ""}` +
          `${missing.length && stale.length ? "；" : ""}` +
          `${stale.length ? `已登记但磁盘上不存在 ${stale.join(", ")}` : ""}`,
      );
    }
  }
}

assertDocOrderCoversAllPages();

/**
 * docs 插件实例。
 *
 * 本分支（`test/docs-default-theme`）**回归 theme-classic 原生文档页**：不再 swizzle
 * `@theme/DocItem`，侧边栏、页内目录、面包屑、上下页导航全部交给原生主题渲染，
 * 排版交给 Infima。
 */
function docsPlugin(lang: string): [string, DocsOptions] {
  return [
    "@docusaurus/plugin-content-docs",
    {
      id: lang,
      // 源树就是仓库里既有的双语目录，与上游同步脚本的约定保持不动。
      path: `content/docs/${lang}`,
      routeBasePath: `${lang}/docs`,
      /**
       * 侧边栏顺序由 `sidebars.ts` 提供，而那份顺序**生成自 `src/lib/docOrder.ts`**。
       *
       * 不能省掉 `sidebarPath` 依赖自动生成：自动生成的顺序是**按 slug 字母序**
       * （`architecture → changelog → cli → …`），与「快速开始」打头的引导顺序不符，
       * 也与页脚、文档索引页的顺序互相矛盾——那两处一直读 `DOC_ORDER`。
       * 指向 `sidebars.ts` 后，三者共用同一个真源，改顺序只改 `DOC_ORDER` 一处。
       *
       * 两个语言实例共用同一个文件：中英目录文件名一致（由 `check:docs-sync` 保证），
       * doc id 因此相同；而侧边栏**标签**取自各文档的 h1，天然就是双语的。
       */
      sidebarPath: path.join(siteDir, "sidebars.ts"),
      // 面包屑用原生默认（true），恢复「文档 / 当前页」层级。
      /**
       * 用**旧站的 slug 算法**覆盖标题锚点 id。
       *
       * 文档正文里写死了指向旧 id 的站内锚点（如 configuration.md 的
       * `#mcp-json-声明-mcp-server`），而 Docusaurus 默认的 github-slugger 会得到
       * `mcpjson声明-mcp-server`——锚点会静默失效，`onBrokenAnchors: "throw"` 还会把构建打红。
       * 该插件必须排在 `beforeDefaultRemarkPlugins`：内置的 headings / toc 插件会读取它写入的 id。
       */
      beforeDefaultRemarkPlugins: [legacyHeadingIds],
    },
  ];
}

const config: Config = {
  title: "Flowy Agent Store",
  tagline: "本地优先的单文件 Agent 运行时",
  favicon: "favicon.ico",

  // 线上由 EdgeOne Makers 托管；子路径部署用 BASE_PATH 覆盖（与旧站一致）。
  url: "https://agent-store.flowyaipc.cn",
  baseUrl: process.env.BASE_PATH ?? "/",

  organizationName: "Michael-Lfx",
  projectName: "agent-store-site",

  onBrokenLinks: "throw",
  onBrokenAnchors: "throw",
  // 文档正文的站内链是绝对路径（`/zh-CN/docs/x`），由 docs 插件校验；
  // Markdown 里的相对 `.md` 链接（上游同步过来的文件用不到）在这里只警告。
  markdown: {
    // 纯 Markdown 解析：正文含 `<n>`、`{...}` 这类 CommonMark 文本，走 MDX 会被当成
    // JSX / 表达式解析并报错；站点不写 MDX，所以整站按 `md` 处理（GFM 表格与代码块不受影响）。
    format: "md",
    mermaid: false,
    hooks: { onBrokenMarkdownLinks: "warn" },
  },

  // 只声明一个 locale：站点用 URL 前缀区分语言，不借 Docusaurus 的 i18n 机制（见文件头说明）。
  i18n: { defaultLocale: "zh-CN", locales: ["zh-CN"] },

  /**
   * 纯 Markdown 解析。文档正文含 `<n>`、`{...}` 这类 CommonMark 文本，走 MDX 会被当成
   * JSX / 表达式解析并报错；站点不写 MDX，所以整站按 `md` 处理（GFM 表格与代码块不受影响）。
   */
  // （已并入上面的 `markdown` 配置块。）

  // 市场树（约 22.6k 文件）刻意不放 `static/`：构建期拷贝会拖垮构建，
  // 且线上只托管目录页头像（见 scripts/copy-market-tree.mjs）。
  staticDirectories: ["static"],

  presets: [
    [
      "classic",
      {
        // 文档由上面两个显式实例提供；博客与默认 docs 都不需要。
        docs: false,
        blog: false,
        pages: { path: "src/pages" },
        theme: {
          /**
           * 三份 CSS 的职责划分（顺序即层叠顺序）：
           *
           * 1. `tokens.css` —— 设计令牌，**全局**。导航与页脚在文档页也要用同一套令牌，
           *    所以令牌不能留在被守卫的 `style.css` 里（否则文档页取不到色值）。
           * 2. `style.css` —— 站点组件样式（落地页 / 市场页）。规则被
           *    `src/plugins/scope-site-css.ts` 加了 `html:not(.docs-wrapper)` 守卫，
           *    **只在非文档页生效**，文档页拿到干净的 Infima。
           * 3. `docusaurus-overrides.css` —— 全站外壳（导航、页脚）与接缝，不加守卫。
           *
           * 注意一个硬约束：**Docusaurus 把所有 CSS 合并进单个 `styles.css`**
           * （`@docusaurus/core/lib/webpack/base.js` 的 `cacheGroups.styles` 带 `enforce: true`，
           * 官方注释写明是为了避免多 CSS chunk 的加载顺序不确定）。所以**无法**靠
           * 「只在某些页面 import」来隔离——「文档页回归原生」是靠选择器作用域实现的。
           */
          customCss: [
            "./src/css/tokens.css",
            "./src/css/style.css",
            "./src/css/docusaurus-overrides.css",
          ],
        },
        sitemap: { changefreq: "weekly", priority: 0.5 },
      },
    ],
  ],

  plugins: [
    ...LANGUAGES.map((lang) => docsPlugin(lang)),
    marketSourceDevPlugin,
    // 给 style.css 的规则加 `html:not(.docs-wrapper)` 作用域，让文档页保持纯 Infima。
    scopeSiteCssPlugin,
  ],

  themeConfig: {
    colorMode: {
      /**
       * 本分支交给**原生** ColorModeToggle：`disableSwitch: false` 让 Navbar 右侧出现
       * Docusaurus 原生的明暗切换按钮（此前站点用自己的 ThemeToggle 写 `data-theme`）。
       */
      disableSwitch: false,
      respectPrefersColorScheme: true,
      defaultMode: "light",
    },
    /**
     * 原生 Navbar / Footer 的链接来自 `themeConfig`，而它**在构建期就固定**，
     * 不能按 URL 变语言。本站是 `/zh-CN/…` 与 `/en-US/…` 双前缀，因此：
     *
     * - 站内项用 `type: "custom-localeLink"`（见 `src/theme/NavbarItem/LocaleNavbarItem`），
     *   `to` 写**不带语言前缀**的路径，渲染时按当前语言补上。
     * - **文案写 `src/i18n/*.ts` 的词条键**（如 `nav.docs`），渲染时解析成当前语言；
     *   写普通文案（`GitHub`）则原样显示。见 `src/lib/i18n-value.ts`。
     * - 语言切换按钮是 `type: "custom-localeToggle"`，跳到同一页面另一种语言的地址。
     * - 外链仍用原生 `href`（不补前缀）。
     *
     * 这两个类型以官方约定的 `custom-` 前缀注册
     * （theme-classic 的 `NavbarItemSchema` 只放行以 `custom-` 开头的未知 type）。
     */
    navbar: {
      title: "Flowy Agent Store",
      hideOnScroll: false,
      items: [
        { type: "custom-localeLink", to: "/market", label: "nav.market", position: "left" },
        { type: "custom-localeLink", to: "/docs", label: "nav.docs", position: "left" },
        {
          href: "https://github.com/Michael-Lfx/allo",
          label: "GitHub",
          position: "right",
        },
        {
          type: "custom-localeLink",
          href: "https://github.com/szStarWave/agent-store-site/releases",
          label: "nav.download",
          position: "right",
        },
        { type: "custom-localeToggle", position: "right" },
      ],
    },
    /**
     * 页脚链接列。
     *
     * 文案直接写在**原生字段**里，值是 `src/i18n/*.ts` 的词条键，
     * 由 `src/theme/Footer` 与 `Footer/LinkItem` 在渲染时解析：
     * `title` → `footer.docs`、`label` → `docs.sections.cli`、`copyright` → `footer.copyright`。
     *
     * 为什么不用自定义的 `titleKey` / `copyrightKey`：Joi 对 `FooterColumnItemSchema` 与
     * footer 根对象**没有** `.unknown()`，自定义键会被直接拒绝，且报错是
     * 「footer 必须要么简单要么多列，不能混用」——看不出真因。只有
     * `FooterLinkItemSchema` 允许未知键。既然列标题与版权行只能用原生字段，
     * 链接项也统一用它，全配置只有一种约定。
     *
     * 顺带一提：`isMultiColumnFooterLinks()` 靠 `'title' in links[0]` 判断多列形态，
     * 所以列标题**必须**存在。
     */
    footer: {
      /**
       * `"light"` 而非 `"dark"`：站点页脚是「白底 + 1px 上边框」，用边框而非色块表达层次。
       * 写成 `"dark"` 会加上 `.footer--dark`（#303846 色块），与站点设计不是一套。
       * 具体配色见 `src/css/docusaurus-overrides.css` 的页脚段。
       */
      style: "light",
      links: [
        {
          title: "footer.docs",
          items: [
            { label: "docs.sections.quickStart", to: "/docs/quick-start" },
            { label: "docs.sections.cli", to: "/docs/cli" },
            { label: "docs.sections.configuration", to: "/docs/configuration" },
            { label: "docs.sections.typescriptSdk", to: "/docs/typescript-sdk" },
          ],
        },
        {
          title: "footer.resources",
          items: [
            { label: "nav.market", to: "/market" },
            {
              label: "footer.releases",
              href: "https://github.com/szStarWave/agent-store-site/releases",
            },
            { label: "footer.github", href: "https://github.com/Michael-Lfx/allo" },
          ],
        },
      ],
      copyright: "footer.copyright",
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      // 与旧站一致的围栏语言集合。**不含 `jsonc`**：Prism 没有 jsonc 语法包，
      // 写进来会让 prism-include-languages 的 require 失败并中断构建；
      // 它由 src/clientModules/prism-jsonc.ts 以 json 的别名补上。
      additionalLanguages: ["bash", "json", "toml"],
    },
  },

  /** `jsonc` 别名必须发生在主题装配 Prism 之后，因此走客户端模块注入。 */
  clientModules: ["./src/clientModules/prism-jsonc.ts"],

  /** 供测试与维护脚本读取的构建期数据。 */
  customFields: {
    docOrder: DOC_ORDER.map((entry) => entry.slug),
    languages: [...LANGUAGES],
  },
};

export default config;

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
 * docs 插件实例：只负责文档页本身，索引页与侧边栏由站点自己的 React 页面渲染
 * （见 `src/theme/DocItem/Layout`）。
 */
function docsPlugin(lang: string): [string, DocsOptions] {
  return [
    "@docusaurus/plugin-content-docs",
    {
      id: lang,
      // 源树就是仓库里既有的双语目录，与上游同步脚本的约定保持不动。
      path: `content/docs/${lang}`,
      routeBasePath: `${lang}/docs`,
      // 侧边栏由站点自己的外壳渲染（顺序见 src/lib/docOrder.ts），不用插件的自动侧边栏。
      sidebarPath: false,
      breadcrumbs: false,
      exclude: [],
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
          customCss: ["./src/css/style.css", "./src/css/docusaurus-overrides.css"],
        },
        sitemap: { changefreq: "weekly", priority: 0.5 },
      },
    ],
  ],

  plugins: [...LANGUAGES.map((lang) => docsPlugin(lang)), marketSourceDevPlugin],

  themeConfig: {
    colorMode: {
      // 主题由站点自己的 ThemeToggle 写入 `data-theme`；Docusaurus 的切换器不参与。
      disableSwitch: true,
      respectPrefersColorScheme: true,
      defaultMode: "light",
    },
    navbar: { title: "Flowy Agent Store", items: [] },
    footer: { style: "dark", links: [], copyright: "Flowy Agent Store" },
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

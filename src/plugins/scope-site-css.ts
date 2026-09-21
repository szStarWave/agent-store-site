import path from "node:path";

import type { LoadContext, Plugin } from "@docusaurus/types";

/**
 * 把站点设计系统（`src/css/style.css`）的规则**限定在非文档页**上，
 * 让文档页拿到干净的 Infima / theme-classic 原生样式。
 *
 * ## 为什么必须是选择器作用域
 *
 * Docusaurus 把所有 CSS 合并进**单个** `styles.css`：
 *
 * ```js
 * // node_modules/@docusaurus/core/lib/webpack/base.js
 * // Only create one CSS file to avoid
 * // problems with code-split CSS loading in different orders
 * // causing inconsistent/non-deterministic styling
 * styles: { name: 'styles', type: 'css/mini-extract', chunks: 'all', enforce: true, priority: 50 },
 * ```
 *
 * 所以「只在落地页 `import` style.css」挡不住它进文档页——它必然出现在每一页上。
 *
 * 也**不要**去改那个 cacheGroup 拆成多 chunk：试过，确实能把 `style.css` 隔离成独立
 * 异步 chunk，但那样首屏 HTML 不再内联它，落地页会先无样式再上样式（FOUC）——
 * 正是官方那条注释要避免的情况。
 *
 * ## 做法
 *
 * 给 `style.css` 的每条规则套一层 `html:not(.docs-wrapper)` 守卫。
 * Docusaurus 给文档页的 `<html>` 打了 `docs-wrapper`（theme-classic `DocsRoot` 的
 * `ThemeClassNames.wrapper.docsPages`），而落地页 / 市场页的 `<html>` 只有
 * `plugin-pages plugin-id-default`。因此文档页完全不受站点样式影响。
 *
 * 只作用于 `style.css`；Infima 与 `docusaurus-overrides.css` 保持原样全局生效
 * （后者是站点与原生主题的接缝，本来就需要作用于两种页面）。
 */

/** 守卫选择器：文档页的 `<html>` 带 `docs-wrapper`，其余页面没有。 */
const GUARD = "html:not(.docs-wrapper)";

/**
 * 给一条选择器加守卫。
 *
 * 关键是区分「这个选择器挂在 `<html>` 上」还是「是 `<html>` 的后代」：
 * `:root` 与 `[data-theme="dark"]` 都写在 `<html>` 元素本身，必须紧贴 html 而不能当后代，
 * 否则 `html:not(.docs-wrapper) [data-theme="dark"]` 会变成「html 后代里带 data-theme 的元素」，
 * 而那个属性在 html 上，规则就永远不会命中。
 */
function scopeSelector(selector: string): string {
  const sel = selector.trim();
  if (!sel) return sel;
  if (/^html\b/.test(sel)) return sel.replace(/^html\b/, GUARD);
  if (sel.startsWith(":root")) return `${GUARD}${sel}`;
  if (sel.startsWith("[data-theme")) return `${GUARD}${sel}`;
  return `${GUARD} ${sel}`;
}

/** PostCSS 插件本体。 */
function scopeSiteCss(options: { targetFile: string }) {
  return {
    postcssPlugin: "scope-site-css",
    Once(root: any, { result }: any) {
      const from: string = result.opts?.from ?? "";
      if (!from.replace(/\\/g, "/").endsWith(options.targetFile)) return;

      root.walkRules((rule: any) => {
        const parent = rule.parent;
        // `@keyframes` 内部是 `0% { … }` 这类关键帧选择器，不能加作用域。
        if (parent?.type === "atrule" && /keyframes$/i.test(parent.name)) return;
        if (!rule.selector) return;
        rule.selectors = rule.selectors.map(scopeSelector);
      });
    },
  };
}
scopeSiteCss.postcss = true;

export default function scopeSiteCssPlugin(context: LoadContext): Plugin {
  // 以仓库根为基准，避免不同 cwd 下匹配不到。
  const target = path
    .relative(context.siteDir, path.join(context.siteDir, "src/css/style.css"))
    .replace(/\\/g, "/");

  return {
    name: "scope-site-css",

    configurePostCss(postcssOptions) {
      postcssOptions.plugins = [
        ...(postcssOptions.plugins ?? []),
        scopeSiteCss({ targetFile: target }),
      ];
      return postcssOptions;
    },
  };
}

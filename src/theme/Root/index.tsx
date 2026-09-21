import { useLocation } from "@docusaurus/router";
import type { ReactNode } from "react";

import { LanguageProvider, languageFromPath } from "../../i18n";

/**
 * 应用最外层包装（theme-classic 的 `@theme/Root` 是空实现，这里只补一层 provider）。
 *
 * **本分支（`test/docs-default-theme`）把文档页与站点外壳都交回原生主题**：
 * 不再 swizzle `@theme/Layout`，也不再自定义 `@theme/DocItem`，因此
 * Navbar / 侧边栏 / 页内目录 / 面包屑 / 上下页 / 页脚全部由 theme-classic 渲染，
 * 排版由 Infima 负责。
 *
 * 那为什么还要 swizzle `Root`？因为本站用「**单 locale + 两个 docs 插件实例**」
 * 保留 `/zh-CN/…` 与 `/en-US/…` 双 URL 前缀（见 `docusaurus.config.ts` 文件头），
 * 语言只能从 URL 推出。站点自己的组件（落地页、市场页等）靠 `useLanguage()` 取文案，
 * 所以必须有一层 provider。
 *
 * 选 `Root` 而不是 `Layout` 的原因：`Root` 在**路由之上**、跨页面导航不会重挂载
 * （官方注释即为此意），而 `Layout` 会随路由重建。放在这里既能提供语言上下文，
 * 又完全不动原生的布局结构——这是本次试验「不自定义样式」的关键。
 */
export default function Root({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const lang = languageFromPath(pathname);

  return <LanguageProvider lang={lang}>{children}</LanguageProvider>;
}

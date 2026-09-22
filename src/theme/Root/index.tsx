import Head from "@docusaurus/Head";
import { useLocation } from "@docusaurus/router";
import type { ReactNode } from "react";

import { LanguageProvider, languageFromPath } from "../../i18n";

/**
 * 应用最外层包装（theme-classic 的 `@theme/Root` 是空实现，这里补语言上下文与 `<html lang>`）。
 *
 * **本分支（`test/docs-default-theme`）把文档页与站点外壳都交回原生主题**：
 * 不 swizzle `@theme/Layout`，也不自定义 `@theme/DocItem`，因此
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
 *
 * `<html lang>` 也必须在这里按 URL 覆写：Docusaurus 的 `SiteMetadataDefaults` 用
 * **构建期唯一的 locale** 写 `<html lang>`，本站只声明了一个 locale（zh-CN），
 * 于是英文页也会输出 `lang="zh-CN"`，影响可访问性与搜索引擎判定。
 * react-helmet 的 `<html>` 属性会合并、后写的覆盖先写的，因此这里能生效
 * （实测：zh-CN 页 `zh-CN`，en-US 页 `en-US`）。
 */
export default function Root({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const lang = languageFromPath(pathname);

  return (
    <LanguageProvider lang={lang}>
      {children}
      {/* 必须放在 `children` **之后**：`<Head>` 的生效顺序是「后渲染的覆盖先渲染的」，
          而 core 的 `SiteMetadataDefaults` 在 `Root` 的子树上（见 core/App.js），
          放在 children 之前会被它覆盖。 */}
      <Head>
        <html lang={lang} />
      </Head>
    </LanguageProvider>
  );
}

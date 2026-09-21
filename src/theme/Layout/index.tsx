import Head from "@docusaurus/Head";
import { useLocation } from "@docusaurus/router";
import type { ReactNode } from "react";

import LayoutProvider from "@theme/Layout/Provider";

import Footer from "../../components/Footer";
import NavBar from "../../components/NavBar";
import { LanguageProvider, languageFromPath, useLanguage } from "../../i18n";
import { useScrollProgress } from "../../lib/effects";

/**
 * 站点外壳 —— 取代旧站 `app/root.tsx` + `app/layouts/Lang.tsx`。
 *
 * Swizzle `@theme/Layout`（而不是沿用 theme-classic 的 Navbar/Footer），理由是本站有自己
 * 一整套站点 chrome 与设计变量（`src/css/style.css`，58 KB 手写 CSS），页面结构
 * （`.site` / `.site-main` / `.scroll-progress`）与旧站 HTML 逐类对齐。保留这套结构，
 * 迁移后视觉与旧站完全一致，`.js-fx`、`[data-reveal]` 等 CSS 钩子也继续生效。
 *
 * **`LayoutProvider` 不能省。** 主题的 `@theme/DocRoot/Layout` 会渲染 `BackToTopButton`，
 * 而它依赖 `ScrollControllerProvider`——那个 provider 由 `LayoutProvider` 提供
 * （theme-classic 是在自己的 `Layout` 里挂的）。替换掉 `Layout` 就得把它补回来，
 * 否则每个文档页在 SSG 阶段都会抛
 * `Hook useScrollController is called outside the <ScrollControllerProvider>`。
 *
 * 语言从 **URL** 推出（`/en-US/…` → en-US）：SSG 与 hydration 因此得到同一种语言。
 * 旧站靠路由 loader 调 `i18n.changeLanguage()`，那是全局可变状态，Docusaurus 里没有等价物。
 */

/** 与旧 `root.tsx` 等价：首屏前挂 `js-fx`，保证无 JS 时内容仍可见。 */
const JS_FX = "document.documentElement.classList.add('js-fx');";

function Shell({ children }: { children: ReactNode }) {
  const lang = useLanguage();
  useScrollProgress();

  return (
    <div className="site">
      <div className="scroll-progress" aria-hidden="true" />
      <NavBar />
      <main className="site-main" id="main">
        {children}
      </main>
      <Footer />
      {/* 供辅助技术跳到正文，与 theme-classic 的约定一致（样式见 docusaurus-overrides.css）。 */}
      <a className="skip-to-content" href="#main">
        {lang === "en-US" ? "Skip to main content" : "跳到主要内容"}
      </a>
      <Head>
        <script>{JS_FX}</script>
      </Head>
    </div>
  );
}

/** 语言分发器：内层组件用 `useLanguage()` 即可拿到由 URL 决定的语言。 */
export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const lang = languageFromPath(pathname);

  return (
    <LayoutProvider>
      <LanguageProvider lang={lang}>
        {/*
          `<html lang>` 必须在这里按 URL 覆写。Docusaurus 的 `SiteMetadataDefaults` 用
          `localeConfigs[currentLocale].htmlLang` 设置它，而本站只声明了一个 locale
          （见 docusaurus.config.ts 的说明），所以每个页面都会拿到 `zh-CN`——英文页面也是。
          搜索引擎与屏幕阅读器据此选断词与发音规则，读成中文对英文页是实打实的缺陷。
          react-helmet 的 `<html>` 属性会合并，后写的值覆盖先写的，因此这里能生效。
        */}
        <Head>
          <html lang={lang} />
        </Head>
        <Shell>{children}</Shell>
      </LanguageProvider>
    </LayoutProvider>
  );
}

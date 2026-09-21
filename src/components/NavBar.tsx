import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import { Download, Languages } from "lucide-react";

import { otherLanguage, rememberLanguage, useLanguage, useTranslation } from "../i18n";
import { githubUrl, releaseAssetUrl } from "../lib/platform";
import logoUrl from "../assets/logo.png";
import ThemeToggle from "./ThemeToggle";

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/**
 * 顶部导航。
 *
 * 语言切换沿用旧站语义：**跳到同一页面在另一种语言下的地址**，并记住这次选择。
 * 旧站用 `useNavigate()` + `setLanguage()`（同时改 i18next 全局状态）；现在语言完全由 URL
 * 决定，所以只需构造目标 URL。用 `window.location.assign` 而不是客户端路由跳转，
 * 是因为语言前缀变了，整页重新渲染能保证 `useLanguage()` 派生的语言与 URL 一致。
 */
export default function NavBar() {
  const { t } = useTranslation();
  const lang = useLanguage();
  const { pathname } = useLocation();

  /** 去掉语言前缀，得到与语言无关的路径。 */
  const withoutLang = (path: string) => path.replace(/^\/(zh-CN|en-US)/, "");

  /** 给路径加上目标语言前缀（zh-CN 也带前缀，与旧站 URL 逐个对齐）。 */
  const withLang = (path: string, target = lang) => {
    const clean = withoutLang(path);
    return clean === "" ? `/${target}` : `/${target}${clean}`;
  };

  const switchLang = () => {
    const target = otherLanguage(lang);
    rememberLanguage(target);
    if (typeof window !== "undefined") window.location.assign(withLang(pathname, target));
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to={withLang("/")} className="brand" aria-label="Flowy Agent Store">
          <img className="brand-mark" src={logoUrl} alt="" width={24} height={24} />
          <span className="brand-name">Flowy Agent Store</span>
        </Link>
        <nav className="navbar-links" aria-label="Primary">
          <Link
            to={withLang("/market")}
            className={pathname.includes("/market") ? "nav-link is-active" : "nav-link"}
          >
            {t("nav.market")}
          </Link>
          <Link
            to={withLang("/docs")}
            className={pathname.includes("/docs") ? "nav-link is-active" : "nav-link"}
          >
            {t("nav.docs")}
          </Link>
          <a className="nav-link nav-github" href={githubUrl()} target="_blank" rel="noreferrer">
            <GitHubMark />
            {t("nav.github")}
          </a>
          <a
            className="btn btn-primary nav-download"
            href={releaseAssetUrl({ os: "windows", arch: "x86_64" })}
          >
            <Download size={16} />
            {t("nav.download")}
          </a>
          <button className="icon-btn" onClick={switchLang} aria-label={t("nav.lang")}>
            <Languages size={18} />
          </button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

import useBaseUrl from "@docusaurus/useBaseUrl";
import { useLocation } from "@docusaurus/router";
import { Languages } from "lucide-react";

import { otherLanguage, useLanguage, useTranslation } from "../../../i18n";
import { switchLanguagePath } from "../../../lib/locale-constants";

/**
 * 语言切换按钮 —— 供 `themeConfig.navbar.items` 里 `type: "custom-localeToggle"` 使用。
 *
 * 语义与迁移前一致：**跳到同一页面在另一种语言下的地址**。
 *
 * ## 为什么不用原生的 `localeDropdown`
 *
 * `@theme/NavbarItem/LocaleDropdownNavbarItem` 是为 Docusaurus 的 i18n 机制设计的，
 * 靠 `useAlternatePageUtils()` 由 locale 配置算出对端地址；而本站**刻意不启用 i18n**
 * （只声明一个 locale，见 `docusaurus.config.ts` 文件头），那条路径算不出
 * `/zh-CN` ↔ `/en-US` 的对应关系。
 *
 * 这里按**路径前缀替换**推导目标地址（`switchLanguagePath`），与两个 docs 实例的
 * 实际路由形态一致，覆盖落地页 / 市场页 / 文档页三类页面。
 *
 * 注意必须用 `switchLanguagePath()` 而不是 `withLanguagePrefix()`：后者对已带前缀的
 * 路径原样返回，而当前页面地址必然带前缀——那样切换按钮会指向自己。
 */
export const LOCALE_TOGGLE_ITEM_TYPE = "custom-localeToggle";

export default function LocaleToggleNavbarItem({
  className,
  // `position` 由 NavbarItem 用于分组，不该落到 DOM 上（原生 item 也不渲染它）。
  position: _position,
  ...props
}: {
  className?: string;
  position?: string;
  [key: string]: unknown;
}) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const { pathname } = useLocation();
  const baseUrl = useBaseUrl("/");

  /** 目标语言（zh-CN ↔ en-US）。 */
  const target = otherLanguage(lang);
  /**
   * 同一页面在目标语言下的地址。
   *
   * 404 页面要单独处理：它在 SSG 阶段的 pathname 是 `/404.html`，直接套前缀会得到
   * `/en-US/404`——一条不存在的地址。这时退回语言首页即可（运行时该页可能因任意
   * 未命中的 URL 而渲染，指向首页总比指向一个确定的死链好）。
   */
  const is404 = /^\/404(\.html)?$/.test(pathname);
  const targetPath = is404 ? `/${target}` : switchLanguagePath(pathname, target);
  /** 拼接 baseUrl：站点部署在子路径时也要正确（本站 baseUrl 为 `/`）。 */
  const href = `${baseUrl.replace(/\/$/, "")}${targetPath}` || "/";

  return (
    <a
      className={`navbar__item navbar__link navbar-locale-toggle ${className ?? ""}`.trim()}
      href={href}
      // 用目标语言的名字做标签/提示，比「语言」更直观。
      aria-label={target === "en-US" ? "English" : "简体中文"}
      title={target === "en-US" ? "English" : "简体中文"}
      {...props}
    >
      <Languages size={18} aria-hidden="true" />
      <span className="navbar-locale-label">{target === "en-US" ? "EN" : "中文"}</span>
    </a>
  );
}

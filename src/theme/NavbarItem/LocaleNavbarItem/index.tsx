import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import IconExternalLink from "@theme/Icon/ExternalLink";
import clsx from "clsx";

import { useLanguage, useTranslation } from "../../../i18n";
import { resolveText } from "../../../lib/i18n-value";
import { withLanguagePrefix } from "../../../lib/locale-constants";

/**
 * 本地化导航链接 —— 供 `themeConfig.navbar.items` 里 `type: "custom-localeLink"` 使用。
 *
 * ## 为什么需要它
 *
 * 原生 Navbar 的链接来自 `themeConfig`，而它**在构建期就固定**：`to: "/zh-CN/docs"` 写死
 * 就是中文路径。本站用「单 locale + 两个 docs 插件实例」保留双前缀（见
 * `docusaurus.config.ts` 文件头），语言只能从 URL 推出，所以要在**渲染时**补前缀。
 *
 * Docusaurus 为此留了正式扩展点：navbar item 的 `type` 只要以 `custom-` 开头
 * （theme-classic 的 `CustomNavbarItemSchema`），配置校验即放行，再由
 * `NavbarItem/ComponentTypes` 决定渲染组件（见同目录旁的 `ComponentTypes.tsx`）。
 * 这样不必覆盖整个 Navbar，原生外观、移动端抽屉、滚动隐藏等行为全部保留。
 *
 * ## 配置约定
 *
 * ```js
 * { type: "custom-localeLink", to: "/docs", label: "nav.docs" }
 * ```
 *
 * - `to` 写**不带语言前缀**的站内路径，渲染时按当前语言补上；已带前缀或非站内路径原样保留。
 * - `label` 写词条键（`src/i18n/*.ts`，如 `nav.docs`），由 `resolveText()` 解析；
 *   写普通文案（`GitHub`）则原样显示。
 * - 外链用 `href`（不补前缀，并带外链图标）。
 */

/** `themeConfig.navbar.items[].type` 的取值。 */
export const LOCALIZED_NAV_ITEM_TYPE = "custom-localeLink";

export default function LocaleNavbarItem({
  to,
  href,
  label,
  className,
  mobile = false,
  // `position` 由 NavbarItem 用于分组，不该落到 DOM 上（原生 item 也不渲染它）。
  position: _position,
  ...props
}: {
  to?: string;
  href?: string;
  label?: string;
  className?: string;
  mobile?: boolean;
  position?: string;
  [key: string]: unknown;
}) {
  const { t } = useTranslation();
  const lang = useLanguage();

  // Hooks 必须无条件调用：不能放进下面的分支里。
  const internalUrl = useBaseUrl(withLanguagePrefix(to ?? "/", lang));
  const externalUrl = useBaseUrl(href ?? "", { forcePrependBaseUrl: true });

  const text = resolveText(label, t);
  // 移动端抽屉与桌面端的类名不同，与原生 item 保持一致。
  const linkClass = clsx(mobile ? "menu__link" : "navbar__item navbar__link", className);

  if (href) {
    return (
      <Link className={linkClass} href={externalUrl} {...props}>
        {text}
        <IconExternalLink />
      </Link>
    );
  }

  return (
    <Link className={linkClass} to={internalUrl} {...props}>
      {text}
    </Link>
  );
}

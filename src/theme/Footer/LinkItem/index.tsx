import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import isInternalUrl from "@docusaurus/isInternalUrl";
import IconExternalLink from "@theme/Icon/ExternalLink";
import clsx from "clsx";

import { useLanguage, useTranslation } from "../../../i18n";
import { resolveText } from "../../../lib/i18n-value";
import { withLanguagePrefix } from "../../../lib/locale-constants";

/**
 * 页脚链接项 —— 原生 `@theme/Footer/LinkItem` 的薄包装（`wrap` 出来的）。
 *
 * ## 为什么必须动这一层
 *
 * 原生 Footer 的链接来自 `themeConfig.footer.links`，而那是**构建期静态**的：
 * `to: "/zh-CN/docs/cli"` 写死就是中文路径。本站用「单 locale + 两个 docs 实例」保留
 * `/zh-CN/…` 与 `/en-US/…` 双前缀（见 `docusaurus.config.ts` 文件头），语言只能从 URL 推出，
 * 因此要在渲染时补前缀。这一层是所有页脚链接的唯一入口，改它最省。
 *
 * ## 配置约定
 *
 * - `to` 写**不带语言前缀**的路径（如 `/docs/cli`），由本组件按当前语言补上；
 *   已带前缀的路径原样保留（作者的显式选择）。
 * - `label` 写词条键（如 `docs.sections.cli`），由 `resolveText()` 解析；
 *   写普通文案则原样显示。用原生字段而不是自定义键，因为
 *   `FooterLinkItemSchema` 虽允许未知键，但列标题 / 版权行只能用原生字段，
 *   全配置统一成一种约定更好维护。
 */
export default function FooterLinkItem({ item }: { item: Record<string, unknown> }) {
  const { to, href, label, prependBaseUrlToHref, className, ...props } = item as {
    to?: string;
    href?: string;
    label?: string;
    prependBaseUrlToHref?: boolean;
    className?: string;
    [key: string]: unknown;
  };

  const { t } = useTranslation();
  const lang = useLanguage();

  // Hooks 必须无条件调用，不能放进分支。
  const toUrl = useBaseUrl(withLanguagePrefix(to, lang));
  const normalizedHref = useBaseUrl(href ?? "", { forcePrependBaseUrl: true });

  const text = resolveText(label, t);

  return (
    <Link
      className={clsx("footer__link-item", className)}
      {...(href
        ? { href: prependBaseUrlToHref ? normalizedHref : href }
        : { to: toUrl })}
      {...props}
    >
      {text}
      {href && !isInternalUrl(href) && <IconExternalLink />}
    </Link>
  );
}

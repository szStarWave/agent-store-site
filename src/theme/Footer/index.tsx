import { useThemeConfig } from "@docusaurus/theme-common";
import FooterCopyright from "@theme/Footer/Copyright";
import FooterLayout from "@theme/Footer/Layout";
import FooterLinks from "@theme/Footer/Links";
import FooterLogo from "@theme/Footer/Logo";

import { useTranslation } from "../../i18n";
import { resolveText } from "../../lib/i18n-value";

/**
 * 页脚 —— 原生 `@theme/Footer` 的薄包装，只做一件事：把配置里的词条键解析成当前语言。
 *
 * ## 为什么需要它
 *
 * 原生 Footer 把 `themeConfig.footer` 的 `title` / `copyright` 原样渲染，而 `themeConfig`
 * 是**构建期静态**的，只能存一种语言。本站按 URL 决定语言（见 `docusaurus.config.ts` 文件头），
 * 所以配置里存词条键，渲染时用 `resolveText()` 解析：
 *
 * - 列标题 `title`（如 `footer.docs`）；
 * - 版权行 `copyright`（如 `footer.copyright`）；
 * - 链接项由 `@theme/Footer/LinkItem` 处理（它同时负责补语言前缀）。
 *
 * 链接项的文案在**原生字段 `label`** 里存键，而不是自定义 `labelKey`：
 * Joi 对 `FooterColumnItemSchema` 与 footer 根对象都**没有** `.unknown()`，
 * 自定义键会被直接拒绝（报「footer 必须要么简单要么多列」这种看不出真因的错）；
 * 只有 `FooterLinkItemSchema` 有 `.unknown()`。既然列标题与版权行只能用原生字段，
 * 链接项也统一用它，全配置只有一种约定。
 *
 * ## 为什么这样写而不是「传 props 覆盖」
 *
 * 原生 Footer 是从 `useThemeConfig()`（context）读配置的，不是从 props 读，
 * 所以包一层再传 `themeConfig` 无效。这里改为：读 context → 解析文案 →
 * 交给**原生的子组件**（`Footer/Layout`、`Footer/Links`、`Footer/Logo`、`Footer/Copyright`）渲染。
 * 本文件只重新组装原生零件，不复制任何标记或类名，列宽、Logo、深色样式都由原生负责。
 */
export default function Footer() {
  const { t } = useTranslation();
  const themeConfig = useThemeConfig();

  const footer = themeConfig.footer as
    | {
        style?: "dark" | "light";
        links?: Array<{ title?: string; [key: string]: unknown }>;
        // `src` 必填：与原生 `BaseLogo` 一致，缺了就不渲染 Logo。
        logo?: { alt?: string; src: string; [key: string]: unknown };
        copyright?: string;
      }
    | undefined;

  // 与原生一致：没有 footer 配置就不渲染。
  if (!footer) return null;

  const { style, links, logo, copyright } = footer;

  // 列标题：词条键 → 当前语言。
  const resolvedLinks = Array.isArray(links)
    ? links.map((column) =>
        column?.title ? { ...column, title: resolveText(column.title, t) } : column,
      )
    : links;

  const resolvedCopyright = resolveText(copyright, t);

  return (
    <FooterLayout
      // 原生 Footer 是 JS，`style` 未定义时由 FooterLayout 兜底（只有 `style === "dark"`
      // 才加 `footer--dark`）。`themeConfig` 的 Joi 校验已把默认值填成 "light"，
      // 这里只需给 TS 一个兜底值。
      style={style ?? "light"}
      links={resolvedLinks?.length ? <FooterLinks links={resolvedLinks} /> : undefined}
      logo={logo ? <FooterLogo logo={logo} /> : undefined}
      copyright={resolvedCopyright ? <FooterCopyright copyright={resolvedCopyright} /> : undefined}
    />
  );
}

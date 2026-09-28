import type { TFunction } from "../i18n";

/**
 * 把配置里的文案解析成当前语言。
 *
 * ## 背景
 *
 * Docusaurus 的 `themeConfig` 是**构建期静态**的，只能存一种语言；而本站按 URL 决定语言
 * （见 `docusaurus.config.ts` 文件头）。所以配置里存的是 `src/i18n/*.ts` 的**词条键**
 * （如 `footer.docs`、`docs.sections.cli`），渲染时再解析。
 *
 * ## 为什么不做「无条件 `t(value)`」
 *
 * 我们的 `t()` 在查不到键时原样返回入参，所以无条件调用其实也能跑通。但那会依赖
 * 「查不到就回退」这条隐式行为，一旦将来有人给 `nav` 这类前缀加了个同名键，
 * 普通文案就可能被意外翻译。这里改用**显式判据**：只有形如 `a.b` / `a.b.c` 的词条键
 * 才去查表，其余（`GitHub`、`TypeScript SDK` 这类字面文案）原样返回。
 *
 * ## 为什么标点在键里是安全的
 *
 * 词条键只由字母、数字、下划线组成，段之间用 `.` 分隔；而普通文案极少长成这个样子。
 * 万一确实长得像（例如某个标签真的叫 `foo.bar`），解析不到也会回退成原文。
 */
const I18N_KEY = /^[A-Za-z][\w]*(?:\.[\w]+)+$/;

export function resolveText(value: string | undefined | null, t: TFunction): string | undefined {
  if (!value) return value ?? undefined;
  return I18N_KEY.test(value) ? t(value) : value;
}

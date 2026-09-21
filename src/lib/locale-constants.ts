/**
 * 语言常量（构建期可用，不含任何 React 依赖）。
 *
 * 独立于 `src/i18n/index.tsx`：`docusaurus.config.ts` 跑在 Node 里，不该把组件树拉进配置。
 */
export type Language = "zh-CN" | "en-US";

export const LANGUAGES: readonly Language[] = ["zh-CN", "en-US"];

/** 兜底语言：zh-CN 是本站源语言，缺失的词条回落到它。 */
export const DEFAULT_LANGUAGE: Language = "zh-CN";

/** 把任意值收敛成受支持的语言，未知一律回落 zh-CN。 */
export function toLanguage(value: string | undefined | null): Language {
  return value === "en-US" ? "en-US" : DEFAULT_LANGUAGE;
}

/** 从站内路径推断语言：`/en-US/…` → en-US，其余一律 zh-CN。 */
export function languageFromPath(pathname: string): Language {
  return pathname === "/en-US" || pathname.startsWith("/en-US/") ? "en-US" : DEFAULT_LANGUAGE;
}

export function otherLanguage(lang: Language): Language {
  return lang === "zh-CN" ? "en-US" : "zh-CN";
}

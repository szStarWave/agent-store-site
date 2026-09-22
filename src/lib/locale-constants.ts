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

/** 语言前缀：本站两种语言都带前缀（`/zh-CN/…` 与 `/en-US/…`），与旧站 URL 一致。 */
const LANGUAGE_PREFIX = /^\/(zh-CN|en-US)(?=\/|$)/;

/**
 * 给站内路径补上目标语言前缀 —— 供「按 URL 决定语言」的链接统一使用。
 *
 * 三类情况原样返回，不做改写：
 * - 已带语言前缀（`/zh-CN/...`、`/en-US/...`）—— 不必也不该再补；
 * - 非站内路径（不以 `/` 开头，如外链、`mailto:`）；
 * - 空值。
 *
 * 其余：`/` → `/<lang>`，`/docs/cli` → `/<lang>/docs/cli`。
 */
export function withLanguagePrefix(path: string | undefined | null, lang: Language): string {
  if (!path) return "";
  if (LANGUAGE_PREFIX.test(path)) return path;
  if (!path.startsWith("/")) return path;
  return path === "/" ? `/${lang}` : `/${lang}${path}`;
}

/**
 * 把路径的语言前缀**换成**目标语言 —— 供语言切换按钮使用。
 *
 * 与 `withLanguagePrefix()` 的区别是关键的：后者对已带前缀的路径「原样返回」，
 * 因为它服务于「配置里的裸路径」这一场景（`/docs/cli` → `/zh-CN/docs/cli`）。
 * 而切换按钮拿到的是**当前页面地址**，它必然已带前缀，原样返回就等于把链接指向自己——
 * 切换按钮会变成无效链接。所以这里必须先剥掉旧前缀再换新的。
 *
 * `/zh-CN/docs/cli` + en-US → `/en-US/docs/cli`
 * `/zh-CN`            + en-US → `/en-US`
 * `/docs/cli`（无前缀）+ en-US → `/en-US/docs/cli`
 */
export function switchLanguagePath(
  path: string | undefined | null,
  lang: Language,
): string {
  if (!path) return `/${lang}`;
  if (!path.startsWith("/")) return path;
  // 剥掉已有的语言前缀（若有），再套上目标语言。
  const stripped = path.replace(LANGUAGE_PREFIX, "");
  const rest = stripped === "" ? "" : stripped.startsWith("/") ? stripped : `/${stripped}`;
  return rest === "" || rest === "/" ? `/${lang}` : `/${lang}${rest}`;
}

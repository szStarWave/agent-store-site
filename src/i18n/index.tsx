import { createContext, useContext, useMemo, type ReactNode } from "react";

import { DEFAULT_LANGUAGE, type Language } from "../lib/locale-constants";
import zhCN from "./zh-CN";
import enUS from "./en-US";

/**
 * 站点内建的双语层（**不再依赖 i18next / react-i18next**）。
 *
 * 旧的 React Router 站点用 i18next 的**全局可变语言**，由路由 loader 在渲染前
 * `changeLanguage()`。Docusaurus 没有路由 loader，而 SSG 与客户端 hydration 必须得到同一种
 * 语言——全局可变状态在预渲染时会把语言串页。所以改为**由上下文决定**：语言从 URL 推出
 * （`Layout` 解析路径），`t` 是该语言的纯函数，渲染结果可复现。
 *
 * 语言**不做浏览器自动探测**：旧站的 `/` 本来就固定渲染 zh-CN（`:lang` 缺省即 zh-CN），
 * 探测只影响 i18n 初值、随后被 loader 覆盖，所以「按 URL 决定」与旧行为等价，
 * 还避免了「服务端按默认语言渲染、客户端按 navigator 语言 hydration」的错配。
 */

export type { Language } from "../lib/locale-constants";
export {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  languageFromPath,
  otherLanguage,
  toLanguage,
} from "../lib/locale-constants";

/** zh-CN 的词条形状即全站键空间的真源。 */
export type Resources = typeof zhCN;

const RESOURCES: Record<Language, Resources> = {
  "zh-CN": zhCN,
  "en-US": enUS as unknown as Resources,
};

const STORAGE_KEY = "flowy-lang";

type TOptions = Record<string, unknown> & { returnObjects?: boolean };

/** `t` 的签名覆盖旧代码用到的子集（`returnObjects` 与 `{{var}}` 插值）。 */
export type TFunction = {
  (key: string): string;
  (key: string, options: { returnObjects: true } & Record<string, unknown>): unknown;
  (key: string, options: TOptions): string;
};

/** 按 `a.b.c` 取值；任一段不是对象即 undefined。 */
function lookup(dict: unknown, path: string): unknown {
  let cursor: unknown = dict;
  for (const part of path.split(".")) {
    if (cursor === null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

/** `{{name}}` 插值；未提供的变量原样保留，避免静默产出空串。 */
function interpolate(template: string, vars?: Record<string, unknown>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    vars[name] === undefined || vars[name] === null ? match : String(vars[name]),
  );
}

function createT(lang: Language): TFunction {
  const t = (key: string, options?: TOptions): unknown => {
    let value = lookup(RESOURCES[lang], key);
    if (value === undefined && lang !== DEFAULT_LANGUAGE) value = lookup(RESOURCES[DEFAULT_LANGUAGE], key);
    if (value === undefined) return key;
    // `returnObjects` 交出整个子树（数组 / 对象），由调用方定型。
    if (options?.returnObjects) return value;
    if (typeof value !== "string") return key;
    return interpolate(value, options);
  };
  return t as TFunction;
}

const T_BY_LANG: Record<Language, TFunction> = {
  "zh-CN": createT("zh-CN"),
  "en-US": createT("en-US"),
};

const LanguageContext = createContext<Language>(DEFAULT_LANGUAGE);

export function LanguageProvider({ lang, children }: { lang: Language; children: ReactNode }) {
  return <LanguageContext.Provider value={lang}>{children}</LanguageContext.Provider>;
}

/** 当前渲染语言（由 `Layout` 从 URL 得出并注入）。 */
export function useLanguage(): Language {
  return useContext(LanguageContext);
}

/** 与旧 `react-i18next` 的 `useTranslation()` 同名同形，组件只换 import 路径。 */
export function useTranslation(): { t: TFunction; i18n: { language: Language } } {
  const lang = useLanguage();
  return useMemo(() => ({ t: T_BY_LANG[lang], i18n: { language: lang } }), [lang]);
}

/** 记住语言选择（仅浏览器）；SSR 期间是 no-op。 */
export function rememberLanguage(lang: Language): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 隐私模式下 localStorage 可能抛错；记不住偏好不该影响切换本身。
  }
}

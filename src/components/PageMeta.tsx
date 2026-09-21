import Head from "@docusaurus/Head";
import { useLocation } from "@docusaurus/router";

import { languageFromPath, otherLanguage, type Language } from "../lib/locale-constants";
import { SITE_ORIGIN } from "../lib/platform";

/**
 * 页面级 `<head>` 元数据（取代旧站的 React Router `MetaFunction`）。
 *
 * 旧站由路由的 `export const meta` 产出 title / description / OG / canonical / hreflang；
 * Docusaurus 没有 `MetaFunction`，等价物是 `@docusaurus/Head`。这里把旧站那套标签原样搬过来，
 * 只把相对 canonical 改成**绝对地址**（相对 canonical 会被搜索引擎按当前页面解析，等于没写）。
 *
 * `canonicalPath` 用于消歧：zh 的落地页同时存在于 `/` 与 `/zh-CN`，旧站把 canonical 指向 `/`，
 * 这里保持同样的选择，避免自己跟自己重复收录。
 */

type Props = {
  title: string;
  description?: string;
  /** 覆盖 canonical 路径（如 zh 落地页用 `/`）；缺省则用当前路径。 */
  canonicalPath?: string;
};

/** 把路径换成另一种语言的对应路径（语言前缀的替换）。 */
function alternatePath(pathname: string, target: Language): string {
  const clean = pathname.replace(/^\/(zh-CN|en-US)/, "");
  return clean === "" ? `/${target}` : `/${target}${clean}`;
}

export default function PageMeta({ title, description, canonicalPath }: Props) {
  const { pathname } = useLocation();
  const lang = languageFromPath(pathname);
  const canonical = `${SITE_ORIGIN}${canonicalPath ?? pathname}`;
  const enPath = alternatePath(pathname, "en-US");
  const zhPath = alternatePath(pathname, "zh-CN");

  return (
    <Head>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:locale" content={lang === "en-US" ? "en_US" : "zh_CN"} />
      <meta property="og:locale:alternate" content={lang === "en-US" ? "zh_CN" : "en_US"} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description ? <meta name="twitter:description" content={description} /> : null}
      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="zh" href={`${SITE_ORIGIN}${zhPath}`} />
      <link rel="alternate" hrefLang="en" href={`${SITE_ORIGIN}${enPath}`} />
      {/* x-default 指向源语言，与旧站一致。 */}
      <link rel="alternate" hrefLang="x-default" href={`${SITE_ORIGIN}${zhPath}`} />
    </Head>
  );
}

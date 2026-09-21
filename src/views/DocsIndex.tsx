import Link from "@docusaurus/Link";
import { ArrowRight } from "lucide-react";

import { DOC_ORDER } from "../lib/docOrder";
import { useLanguage, useTranslation } from "../i18n";
import PageMeta from "../components/PageMeta";

/**
 * 文档首页（`/zh-CN/docs` 与 `/en-US/docs`）。
 *
 * 由普通页面渲染，而不是 docs 插件的自动索引：那需要一篇 `index.md`，而
 * `content/docs/` 是从上游同步的 Markdown 目录、**不带 front matter 也不该多出文件**
 * （`check:docs-sync` 会按两种语言的文件集合比对）。所以索引页留在站点自己的页面里，
 * 与旧站 `app/pages/DocsIndex.tsx` 的行为一致。
 */
export default function DocsIndex() {
  const { t } = useTranslation();
  const lang = useLanguage();

  return (
    <div className="docs">
      <PageMeta title={t("docs.title")} description={t("docs.subtitle")} />
      <div className="docs-inner">
        <header className="docs-header">
          <p className="eyebrow">{t("landing.eyebrow")}</p>
          <h1>{t("docs.title")}</h1>
          <p className="subtle">{t("docs.subtitle")}</p>
        </header>

        <ul className="doc-list">
          {DOC_ORDER.map(({ slug, sectionKey }) => (
            <li key={slug}>
              <Link className="doc-row" to={`/${lang}/docs/${slug}`}>
                <span className="doc-row-title">{t(`docs.sections.${sectionKey}`)}</span>
                <ArrowRight size={16} className="doc-row-arrow" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

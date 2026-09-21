import Link from "@docusaurus/Link";

import { DOC_ORDER } from "../lib/docOrder";
import { useLanguage, useTranslation } from "../i18n";

/**
 * 文档左侧导航：全量文档目录，高亮当前页。
 *
 * 旧站从 `app/lib/docs.ts` 的 `DOC_ORDER` 生成同一份列表；现在顺序表独立成
 * `src/lib/docOrder.ts`，被页脚、索引页与这里共用。
 *
 * `current` 是 docs 插件给出的 doc id（即 `content/docs/<lang>/<slug>.md` 的文件名）。
 */
export default function DocsSidebar({ current }: { current?: string }) {
  const { t } = useTranslation();
  const lang = useLanguage();

  return (
    <aside className="docs-sidebar" aria-label={t("docs.title")}>
      <Link className="docs-back" to={`/${lang}/docs`}>
        {t("docs.backToDocs")}
      </Link>
      <nav className="docs-toc">
        {DOC_ORDER.map(({ slug, sectionKey }) => (
          <Link
            key={slug}
            to={`/${lang}/docs/${slug}`}
            className={slug === current ? "is-active" : ""}
          >
            {t(`docs.sections.${sectionKey}`)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

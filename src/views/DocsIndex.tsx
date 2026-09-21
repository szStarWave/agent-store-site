import Link from "@docusaurus/Link";
import Head from "@docusaurus/Head";
import { HtmlClassNameProvider, ThemeClassNames } from "@docusaurus/theme-common";

import { DOC_ORDER } from "../lib/docOrder";
import { useLanguage, useTranslation } from "../i18n";

/**
 * 文档首页（`/zh-CN/docs` 与 `/en-US/docs`）。
 *
 * **本分支（`test/docs-default-theme`）用 Infima 原生类名重写**，不再使用站点
 * `style.css` 里的 `.docs` / `.doc-list` / `.doc-row` 等自定义类。
 *
 * 为什么需要显式套 `docs-wrapper` 类：这个页面由 **pages 插件**渲染（不是 docs 插件），
 * 所以 Docusaurus 给的 `<html>` 类名是 `plugin-pages plugin-id-default`，**不带**
 * `docs-wrapper`。而 `src/plugins/scope-site-css.ts` 正是用 `html:not(.docs-wrapper)`
 * 把站点设计系统挡在文档页之外的——少了这个类，本页会拿到站点样式，
 * 与 `/zh-CN/docs/cli` 的原生外观明显不一致。这里手工补上，保证文档区整体一致。
 *
 * 为什么仍需这个页面：docs 插件不会自动产出 `/zh-CN/docs` 索引。它的 `DocRoot` 只匹配
 * 具体文档路由，匹配不到就渲染 NotFound；而加一篇 `index.md` 又会动 `content/docs/`
 * （上游同步产物，且 `docusaurus.config.ts` 要求每篇都被 `DOC_ORDER` 登记）。
 */
export default function DocsIndex() {
  const { t } = useTranslation();
  const lang = useLanguage();

  return (
    <HtmlClassNameProvider className={ThemeClassNames.wrapper.docsPages}>
      <Head>
        <title>{t("docs.title")}</title>
        <meta name="description" content={t("docs.subtitle")} />
      </Head>

      <main className="container margin-vert--lg">
        <div className="row">
          <div className="col col--8 col--offset-2">
            <h1>{t("docs.title")}</h1>
            <p className="margin-bottom--lg">{t("docs.subtitle")}</p>

            <div className="row">
              {DOC_ORDER.map(({ slug, sectionKey }) => (
                <div className="col col--6 margin-bottom--md" key={slug}>
                  <Link className="card padding--md" to={`/${lang}/docs/${slug}`}>
                    <span className="text--bold">{t(`docs.sections.${sectionKey}`)}</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </HtmlClassNameProvider>
  );
}

import Link from "@docusaurus/Link";

import { DOC_ORDER } from "../lib/docOrder";
import { useLanguage, useTranslation } from "../i18n";
import { githubUrl, releasesPageUrl } from "../lib/platform";
import logoUrl from "../assets/logo.png";

/**
 * 页脚：品牌 + 文档全量目录 + 资源链接。
 *
 * 文档列表以 `DOC_ORDER`（`src/lib/docOrder.ts`）为顺序真源。旧站从 `app/lib/docs.ts` 读它，
 * 但那个模块还负责解析 Markdown（依赖 `import.meta.glob`），现在解析交给 docs 插件，
 * 顺序表被单独抽出，好让构建期配置也能引用。
 */
export default function Footer() {
  const { t } = useTranslation();
  const lang = useLanguage();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <img className="brand-mark" src={logoUrl} alt="" width={28} height={28} />
          <div>
            <div className="brand-name">Flowy Agent Store</div>
            <p className="footer-tagline">{t("footer.tagline")}</p>
          </div>
        </div>
        <div className="footer-cols">
          <nav className="footer-col" aria-label={t("footer.docs")}>
            <h4>{t("footer.docs")}</h4>
            {DOC_ORDER.map(({ slug, sectionKey }) => (
              <Link key={slug} to={`/${lang}/docs/${slug}`}>
                {t(`docs.sections.${sectionKey}`)}
              </Link>
            ))}
          </nav>
          <nav className="footer-col" aria-label={t("footer.resources")}>
            <h4>{t("footer.resources")}</h4>
            <Link to={`/${lang}/market`}>{t("nav.market")}</Link>
            <a href={releasesPageUrl()} target="_blank" rel="noreferrer">
              {t("footer.releases")}
            </a>
            <a href={githubUrl()} target="_blank" rel="noreferrer">
              {t("footer.github")}
            </a>
          </nav>
        </div>
      </div>
      <div className="footer-bottom">
        <p>{t("footer.copyright")}</p>
      </div>
    </footer>
  );
}

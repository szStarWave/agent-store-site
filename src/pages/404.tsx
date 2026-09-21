import Head from "@docusaurus/Head";
import Layout from "@theme/Layout";

import { useTranslation } from "../i18n";

/**
 * 404 页面。
 *
 * 站点是纯静态托管：EdgeOne Makers 对未命中的路径使用 `404.html`（与旧站一致，
 * React Router 的 SSG 同样产出 `404.html`）。刻意**不**给缺失的 `.js` / `.data` 兜底返回
 * `index.html`——那正是 `edgeone.json` 那条硬约束要防的事。
 */
export default function NotFound() {
  const { t } = useTranslation();

  return (
    <Layout>
      <Head>
        <title>{t("common.notFound")}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="docs">
        <div className="docs-inner">
          <header className="docs-header">
            <h1>{t("common.notFound")}</h1>
            <p className="subtle">
              <a href="/">← {t("common.home")}</a>
            </p>
          </header>
        </div>
      </div>
    </Layout>
  );
}

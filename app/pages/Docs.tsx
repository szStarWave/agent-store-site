import { Link, useParams, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

import { applyLanguage, type Language } from "../i18n";
import { DOC_ORDER, extractHeadings, loadDoc } from "../lib/docs";

export async function loader({ params }: LoaderFunctionArgs) {
  const lang: Language = params.lang === "en-US" ? "en-US" : "zh-CN";
  applyLanguage(lang);
  const doc = loadDoc(lang, params.slug ?? "");
  if (!doc) throw new Response("Not Found", { status: 404 });
  return { lang, slug: params.slug, ...doc };
}

export default function Docs() {
  const { lang: raw, slug } = useParams();
  const lang: Language = raw === "en-US" ? "en-US" : "zh-CN";
  const { t } = useTranslation();
  const data = useLoaderData() as { title: string; body: string };
  const headings = extractHeadings(data.body);

  /** Level-3 headings hang off the level-2 heading above them. */
  const toc = headings.reduce<{ heading: (typeof headings)[number]; children: typeof headings }[]>(
    (groups, heading) => {
      if (heading.level === 2 || groups.length === 0) groups.push({ heading, children: [] });
      else groups[groups.length - 1].children.push(heading);
      return groups;
    },
    [],
  );

  // Anchor ids are applied **by position** rather than re-derived from the
  // rendered text: `extractHeadings` walked the same document, so the n-th
  // rendered h2/h3 is the n-th entry it returned. Re-slugifying rendered
  // children would risk drifting from the TOC's own slugs (inline code, links).
  const anchorIds = headings.map((heading) => heading.id);
  let anchorIndex = 0;
  const components: Components = {
    // `node` is react-markdown's own AST handle, not a DOM attribute — dropping
    // it here keeps it out of the markup (`node="[object Object]"` otherwise).
    h2: ({ node: _node, ...props }) => <h2 {...props} id={anchorIds[anchorIndex++]} />,
    h3: ({ node: _node, ...props }) => <h3 {...props} id={anchorIds[anchorIndex++]} />,
  };

  // One list, two mount points: the right rail on wide screens and the
  // collapsible block above the prose below the breakpoint. CSS decides which
  // is shown (`display: none` also keeps the hidden one out of the a11y tree).
  const tocList = (
    <ol className="docs-page-toc-list">
      {toc.map(({ heading, children }) => (
        <li key={heading.id}>
          <a href={`#${heading.id}`}>{heading.text}</a>
          {children.length > 0 && (
            <ol>
              {children.map((child) => (
                <li key={child.id}>
                  <a href={`#${child.id}`}>{child.text}</a>
                </li>
              ))}
            </ol>
          )}
        </li>
      ))}
    </ol>
  );

  return (
    <div className="docs docs-detail">
      <aside className="docs-sidebar" aria-label={t("docs.title")}>
        <Link className="docs-back" to={`/${lang}/docs`}>
          {t("docs.backToDocs")}
        </Link>
        <nav className="docs-toc">
          {DOC_ORDER.map(({ slug: s, sectionKey }) => (
            <Link key={s} to={`/${lang}/docs/${s}`} className={s === slug ? "is-active" : ""}>
              {t(`docs.sections.${sectionKey}`)}
            </Link>
          ))}
        </nav>
      </aside>

      <article className="docs-content markdown-body">
        {headings.length > 0 && (
          <details className="docs-page-toc">
            <summary>
              {t("docs.onThisPage")}
              <span className="docs-page-toc-count">{headings.length}</span>
            </summary>
            {tocList}
          </details>
        )}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={components}
        >
          {data.body}
        </ReactMarkdown>
      </article>

      {headings.length > 0 && (
        <nav className="docs-page-toc-rail" aria-label={t("docs.onThisPage")}>
          <p className="docs-page-toc-rail-title">{t("docs.onThisPage")}</p>
          {tocList}
        </nav>
      )}
    </div>
  );
}

import { useDoc } from "@docusaurus/plugin-content-docs/client";

import DocsSidebar from "../../../components/DocsSidebar";
import PageMeta from "../../../components/PageMeta";
import { useTranslation } from "../../../i18n";

/**
 * 文档详情页外壳 —— 取代旧站 `app/pages/Docs.tsx`。
 *
 * Swizzle `@theme/DocItem`（用 `--wrap` 会在外层再套一层 theme-classic 布局），这里直接
 * **替换** 实现，好让文档页复用站点自己的两栏结构（`.docs-sidebar` + `.docs-content`）
 * 以及与旧站逐类对齐的 CSS。
 *
 * 三处与旧站的关键对应：
 *
 * 1. **正文** 由 docs 插件把 Markdown 编译成 React 组件后以 `children` 传入——旧站用
 *    `react-markdown` 在运行时解析，现在解析发生在构建期（更快，且不再把 markdown 解析器
 *    与 highlight.js 打进客户端）。
 * 2. **右侧目录** 来自插件解析出的 `toc`（含标题 id），所以站点**不再自己算锚点**
 *    ——旧站靠 `extractHeadings()` 重走一遍文档并按位置套 id，那套逻辑正是锚点错位的来源。
 *    id 由 `src/remark/legacy-heading-ids.ts` 用旧算法生成，保证既有深链不失效。
 * 3. **长文档默认展开目录** 的阈值沿用旧站实测值（见 `TOC_OPEN_MIN_HEADINGS`）。
 */

/**
 * 页内目录（TOC）默认展开所需的最少标题数。
 *
 * 断点以下，「可折叠目录」是页面内唯一的导航，默认收起等于在最需要它的地方藏起来——
 * 但四条目的列表占的纵向空间比它省下的还多。这些文档实测为 4 / 4 / 4 / 7 / 7 / 9 / 13
 * / 17 / 21 / 28，阈值取 10 恰好让最长的四页默认展开，短的保持收起。
 */
const TOC_OPEN_MIN_HEADINGS = 10;

export default function DocItemLayout({ children }: { children: React.ReactNode }) {
  const { metadata, toc } = useDoc();
  const { t } = useTranslation();

  // 目录只保留 h2 / h3：`toc` 里还有 h4 及更深的层级，旧站的目录也只到 h3。
  const headings = toc.filter((item) => item.level === 2 || item.level === 3);

  /** h3 挂在它上面的 h2 之下。 */
  const groups = headings.reduce<
    { heading: (typeof headings)[number]; children: typeof headings }[]
  >((acc, heading) => {
    if (heading.level === 2 || acc.length === 0) acc.push({ heading, children: [] });
    else acc[acc.length - 1].children.push(heading);
    return acc;
  }, []);

  // 一个列表，两个挂载点：宽屏右侧栏 + 断点以上的可折叠块，由 CSS 决定显示哪个
  // （`display: none` 也会把隐藏的那个移出无障碍树）。
  const tocList = (
    <ol className="docs-page-toc-list">
      {groups.map(({ heading, children: subHeadings }) => (
        <li key={heading.id}>
          <a href={`#${heading.id}`} dangerouslySetInnerHTML={{ __html: heading.value }} />
          {subHeadings.length > 0 && (
            <ol>
              {subHeadings.map((child) => (
                <li key={child.id}>
                  <a href={`#${child.id}`} dangerouslySetInnerHTML={{ __html: child.value }} />
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
      <PageMeta title={`${metadata.title} — Flowy Agent Store`} description={metadata.description} />
      <DocsSidebar current={metadata.id} />

      <article className="docs-content markdown-body">
        {headings.length > 0 && (
          <details className="docs-page-toc" open={headings.length >= TOC_OPEN_MIN_HEADINGS}>
            <summary>
              {t("docs.onThisPage")}
              <span className="docs-page-toc-count">{headings.length}</span>
            </summary>
            {tocList}
          </details>
        )}
        {children}
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

import type { Root } from "mdast";
import type { Plugin } from "unified";

/**
 * 用**旧站的 slug 算法**给文档标题生成锚点 id。
 *
 * 为什么需要它：迁移前文档由 `react-markdown` 渲染，标题 id 由
 * `app/lib/docs.ts` 的 `slugify()` 产生（把「非字母/数字」的连续片段压成一个 `-`，
 * 例如 `` `mcp.json`：声明 MCP server `` → `mcp-json-声明-mcp-server`）。
 * Docusaurus 默认用 `github-slugger`，会**删掉**标点而不是替换成 `-`
 * （同一标题变成 `mcpjson声明-mcp-server`）。
 *
 * `content/docs/` 与上游 `Michael-Lfx/allo` 同步、正文里已经写死了指向旧 id 的站内锚点
 * （如 `configuration.md` 的 `#mcp-json-声明-mcp-server`）与外部深链。锚点 id 变了，
 * 这些链接就静默失效，而 `onBrokenAnchors: "throw"` 会直接把构建打红。
 *
 * 这个插件挂在 docs 插件的 `beforeDefaultRemarkPlugins`（早于内置的 headings 与 toc 插件），
 * 因此正文标题 id 与目录（TOC）里的 id 会一致地使用旧算法。
 */

/** 与旧 `app/lib/docs.ts` 的 `slugify()` 完全一致：保留字母（含 CJK）与数字。 */
export function legacySlugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

const legacyHeadingIds: Plugin<[], Root> = () => async (tree) => {
  const { toString } = await import("mdast-util-to-string");
  const { visit } = await import("unist-util-visit");
  const seen = new Map<string, number>();

  visit(tree, "heading", (node) => {
    // 标题里的行内代码 / 强调都应参与文本化，与旧站 `headingText()` 的处理等价。
    const text = toString(node).trim();
    const base = legacySlugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    // 旧站的重名策略：首个用基名，其后依次追加 -2、-3…
    const id = count === 0 ? base : `${base}-${count + 1}`;

    // `data` 的类型来自 mdast；`hProperties` 与自定义 `id` 是 Docusaurus 的扩展位。
    //
    // **两个字段都必须写。** 内置的 headings 插件排在 `beforeDefaultRemarkPlugins` 之后，
    // 它先读 `hProperties.id`（作为已存在的 id 沿用），读不到才按 github-slugger 从标题文本
    // 重新生成；随后把结果写进 `hProperties.id` 与 `data.id`。所以这里若不写 `hProperties.id`，
    // 内置插件会直接覆盖掉本插件算出的 `data.id`——站点会静默退回 github 算法。
    // 注意 `node.data ??= {}` 与 `data.hProperties ??= {}` 这种**回写赋值**是必需的：
    // 写成 `const p = data.hProperties ?? {}` 会得到一个没有挂回 `data` 的孤儿对象。
    const data = (node.data ??= {});
    const properties = (data.hProperties ??= {}) as Record<string, unknown>;
    properties.id = id;
    // `data.id` 不在 mdast 的 `HeadingData` 类型里（是 Docusaurus 读 toc 时的扩展位），
    // 因此这里按记录写。
    (data as Record<string, unknown>).id = id;
  });
};

export default legacyHeadingIds;

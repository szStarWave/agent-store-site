import { DocProvider } from "@docusaurus/plugin-content-docs/client";
import type { PropDocContent } from "@docusaurus/plugin-content-docs";

import DocItemLayout from "./Layout";

/**
 * 文档条目 —— docs 插件的 `docItemComponent` 指向这里（theme-classic 的 `DocItem` 的替换实现）。
 *
 * 必须自己提供 `DocProvider`：`Layout` 用 `useDoc()` 读 metadata 与 toc，而那个 context
 * 正是由 theme-classic 的 `DocItem` 提供的；替换掉它就得把这一层补回来。
 */
export default function DocItem({ content }: { content: PropDocContent }) {
  // `content` 既是编译后的 MDX 组件，也挂载着 metadata / frontMatter / toc。
  const MDXComponent = content as unknown as React.ComponentType;

  return (
    <DocProvider content={content}>
      <DocItemLayout>
        <MDXComponent />
      </DocItemLayout>
    </DocProvider>
  );
}

import Layout from "@theme/Layout";

import DocsIndex from "../../views/DocsIndex";

/**
 * `/zh-CN/docs` —— 中文文档首页。
 *
 * 路径与 docs 插件的 `routeBasePath: "zh-CN/docs"` 重叠：插件为这个前缀注册了一个
 * `exact: false` 的父路由（只渲染文档条目），而 pages 插件的 `exact: true` 路由优先级更高，
 * 因此索引页由本文件渲染（已在 spike 中实测确认）。
 */
export default function ZhDocsIndex() {
  return (
    <Layout>
      <DocsIndex />
    </Layout>
  );
}

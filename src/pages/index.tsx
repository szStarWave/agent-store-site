import Layout from "@theme/Layout";

import Landing from "../views/Landing";

/**
 * 站点根 `/` —— 与旧站一致，直接渲染**中文**落地页，而不是跳转到 `/zh-CN`。
 *
 * 旧站 `app/routes.ts` 的注释说明了同样的选择：`/` 上渲出内容，dev 预览与 SSG 才都有东西，
 * 且省掉一次客户端重定向。`Layout` 按 URL 判定语言，`/` 不属于 `/en-US`，因此即为 zh-CN。
 *
 * `src/pages/*` 的路由**不会**被自动套上 `Layout`（只有 docs 路由经 `DocsRoot` 拿到），
 * 所以每个页面显式包一层——这与 Docusaurus 对普通页面的惯例一致。
 */
export default function Home() {
  return (
    <Layout>
      <Landing />
    </Layout>
  );
}

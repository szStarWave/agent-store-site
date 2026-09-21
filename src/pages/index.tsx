import Layout from "@theme/Layout";

import Landing from "../views/Landing";

/**
 * 站点根 `/` —— 与旧站一致，直接渲染**中文**落地页，而不是跳转到 `/zh-CN`。
 *
 * 旧站 `app/routes.ts` 的注释说明了同样的选择：`/` 上渲出内容，dev 预览与 SSG 才都有东西，
 * 且省掉一次客户端重定向。`Root` 按 URL 判定语言，`/` 不属于 `/en-US`，因此即为 zh-CN。
 *
 * 样式说明：站点设计系统 `src/css/style.css` 由 `theme.customCss` **全局**加载，
 * 其规则被 `src/plugins/scope-site-css.ts` 加了 `html:not(.docs-wrapper)` 守卫，
 * 因此只在非文档页生效。这里不需要单独 import。
 */
export default function Home() {
  return (
    <Layout>
      <Landing />
    </Layout>
  );
}

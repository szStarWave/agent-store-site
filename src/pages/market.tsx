import Layout from "@theme/Layout";

import Market from "../views/Market";

/**
 * 根路径的无前缀市场页 `/market`。
 *
 * 旧站把它保留为「缺省语言即 zh-CN」的等价入口（`app/routes.ts` 里 `route("market", …)`
 * 同时挂在 `/` 与 `/:lang` 两组布局下）。`/zh-CN/market` 才是规范地址，这里保持可达，
 * 与旧站行为一致。
 */
export default function MarketRoot() {
  return (
    <Layout>
      <Market />
    </Layout>
  );
}

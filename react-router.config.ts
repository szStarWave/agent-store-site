import type { Config } from "@react-router/dev/config";
import { docSlugs } from "./app/lib/docs";

/**
 * React Router v8 framework 模式 —— 静态站点生成（SSG）。
 *
 * 构建时由 loader 预渲染每个路由（含文档内容与各语言版本），
 * 在 `build/client/` 下生成静态 HTML。我们仅将 `build/client/` 部署到
 * GitHub Pages；服务端 bundle 不会被使用。
 *
 * `ssr` 保持默认开启（不显式设为 false），以便允许路由 `loader` 运行——
 * 这是数据驱动的预渲染所必需的。若设置 `ssr: false`，则会禁止 `loader`。
 */
const LOCALES = ["zh-CN", "en-US"] as const;

export default {
  // 静态托管（Caddy/EdgeOne）没有运行时的 `__manifest` 接口，因此
  // Lazy Route Discovery 会去请求它，却只拿到 SPA 回退的 HTML，从而
  // 抛出 "Unexpected token '<'"。改为在初始文档中加载全部路由。
  routeDiscovery: { mode: "initial" },
  async prerender() {
    const paths: string[] = ["/", "/market"];
    for (const lang of LOCALES) {
      paths.push(`/${lang}`, `/${lang}/market`, `/${lang}/docs`);
      for (const slug of docSlugs(lang)) {
        paths.push(`/${lang}/docs/${slug}`);
      }
    }
    return paths;
  },
} satisfies Config;

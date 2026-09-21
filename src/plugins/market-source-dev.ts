import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { LoadContext, Plugin } from "@docusaurus/types";

/** webpack-dev-server 的中间件签名（这里只用到子集）。 */
type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void;

/**
 * `configureWebpack` 的返回值。
 *
 * Docusaurus 的 `ConfigureWebpackResult` 没有从包入口导出，而它本身也只是
 * `WebpackConfiguration & { mergeStrategy? }`；`devServer` 更是 webpack-dev-server 的扩展字段，
 * 不在 webpack 的 `Configuration` 里。这里按实际用到的形状声明。
 */
type DevServerResult = {
  devServer?: { setupMiddlewares?: (middlewares: Middleware[]) => Middleware[] };
};

/**
 * 开发态托管 `/source/**`（仅 dev，进不了构建产物）。
 *
 * 为什么需要它：市场目录页的头像直接引用 `source/<market>/…`（见 `content/market.json` 与
 * `src/lib/market.ts` 的 `avatarUrl()`）。生产环境由 `scripts/copy-market-tree.mjs` 把那些文件
 * 拷进 `build/source`，静态托管自然能服务；但 dev server 不跑拷贝步骤，`webpack-dev-server`
 * 的 `static` 只映射 `static/`，于是 `/source/**` 会落到 SPA 兜底——返回一个 HTML，
 * `<img>` 解析失败、`onError` 触发，目录页**全部退化成字母徽标**。看起来像「图标没做」，
 * 真实原因是路由没人接。
 *
 * 实现方式：`webpack-dev-server` 会读取 webpack config 上的 `devServer` 字段
 * （`@docusaurus/core` 的 `commands/start/webpack.js` 里 `merge([default, config.devServer])`），
 * 所以本插件用 `configureWebpack` 挂一个 `setupMiddlewares`，把 `/source/**` 直接映射到
 * 仓库里的 `market-source/`。
 *
 * 刻意**只绑 dev**：`configureWebpack` 里用 `isServer`/`dev` 判断跳过生产构建，
 * 同时也**不**把 `market-source/` 塞进 `staticDirectories`——那会让构建期拷贝约 22.6k 个文件，
 * 拖垮构建（这正是旧站把树放在 `public/` 之外的原因）。
 */

/** 与旧站 `vite.config.ts` 的 dev 服务器同一张表。 */
const MIME: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

export default function marketSourceDevPlugin(context: LoadContext): Plugin {
  const sourceRoot = path.resolve(context.siteDir, "market-source");
  const mount = `${(context.baseUrl || "/").replace(/\/+$/, "")}/source/`;

  return {
    name: "market-source-dev",

    configureWebpack(_config, isServer, { currentBundler }) {
      // 只在开发态、且只在客户端 bundle 上挂中间件。
      if (process.env.NODE_ENV === "production" || isServer) return undefined;
      // webpack-dev-server 与 Rspack 的 dev server 都读 `devServer` 字段。
      void currentBundler;

      // `devServer` 是 webpack-dev-server 的扩展字段，不在 webpack 自己的
      // `Configuration` 类型里（Docusaurus 的 `ConfigureWebpackResult` 基于后者），
      // 因此这里断言过去；运行时行为在 `commands/start/webpack.js` 里被 merge 读取。
      return {
        devServer: {
          setupMiddlewares: (middlewares: Middleware[]) => {
            // 放在最前面：必须在 SPA 兜底之前命中，否则又会拿到 HTML。
            middlewares.unshift((req, res, next) => {
              const [urlPath] = (req.url ?? "").split("?");
              if (!urlPath.startsWith(mount)) return next();

              let rel: string;
              try {
                rel = decodeURIComponent(urlPath.slice(mount.length));
              } catch {
                return next();
              }

              const file = path.resolve(sourceRoot, rel);
              // 防目录穿越：解析结果必须仍在市场树内。
              if (!file.startsWith(sourceRoot + path.sep)) return next();
              if (!existsSync(file) || !statSync(file).isFile()) return next();

              const info = statSync(file);
              res.setHeader(
                "Content-Type",
                MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
              );
              res.setHeader("Content-Length", String(info.size));
              // 与 `edgeone.json` 的 `_files.txt` 规则一致：客户端会轮询清单，不能缓存。
              res.setHeader(
                "Cache-Control",
                rel.endsWith("_files.txt") ? "no-cache" : "public, max-age=0, must-revalidate",
              );
              if (req.method === "HEAD") {
                res.end();
                return;
              }
              createReadStream(file).pipe(res);
            });
            return middlewares;
          },
        },
      } as DevServerResult as never;
    },
  };
}

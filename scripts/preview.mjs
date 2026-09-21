#!/usr/bin/env node
/**
 * 本地托管构建产物（`build/`）—— 取代旧站的 `react-router preview`。
 *
 * Docusaurus 自带的 `serve` 会给未命中的路径回退 `index.html`，这会**掩盖**
 * `copy-market-tree.mjs` 漏拷的那类问题：`/source/…` 一旦缺失，`serve` 会回一个 HTML，
 * 浏览器把它当图片解析并静默失败，于是目录页退化成字母徽标——看起来「只是没图标」，
 * 而真实原因是产物里没有那些文件。
 *
 * 所以这里是一个**刻意不兜底**的静态服务器：
 *   - 命中文件 → 按扩展名给出正确的 Content-Type；
 *   - 未命中 → 如实 404（与线上 EdgeOne 的行为一致）。
 *
 * 它同时镜像 `edgeone.json` 的两条行为：`_files.txt` 走 `no-cache`，其余静态资源
 * `max-age=0, must-revalidate`（不带 hash 的路径不能长缓存）。
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
const root = path.join(siteRoot, "build");
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";

if (!existsSync(root)) {
  console.error("[preview] build/ 不存在 —— 先跑 `bun run build`");
  process.exit(1);
}

/** 与旧站 dev server 同一张表，外加 Docusaurus 会产出的类型。 */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** 把 URL 路径解析到产物目录内的真实文件；越界或目录一律返回 null。 */
function resolveFile(urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const candidates = rel.endsWith("/") ? [`${rel}index.html`] : [rel, `${rel}/index.html`, `${rel}.html`];
  for (const candidate of candidates) {
    const file = path.resolve(root, `.${candidate}`);
    if (!file.startsWith(root + path.sep)) continue;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

createServer((req, res) => {
  const [urlPath] = (req.url ?? "/").split("?");
  const file = resolveFile(urlPath);

  if (!file) {
    // 如实 404：缺失的 .js / .data / 图片必须能被看见，而不是被 HTML 兜底掉。
    const notFound = path.join(root, "404.html");
    if (existsSync(notFound)) {
      res.writeHead(404, { "Content-Type": MIME[".html"] });
      createReadStream(notFound).pipe(res);
      return;
    }
    res.writeHead(404, { "Content-Type": MIME[".txt"] });
    res.end("404");
    return;
  }

  const ext = path.extname(file).toLowerCase();
  const rel = path.relative(root, file).split(path.sep).join("/");
  // 与 edgeone.json 保持一致：市场清单必须随时可见，其余不长缓存（产物文件名不带 hash 的除外）。
  const cacheControl = rel.endsWith("_files.txt")
    ? "no-cache"
    : /\.(js|css|woff2?)$/.test(rel) && /[.-][0-9a-f]{8,}\./.test(rel)
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate";

  res.writeHead(200, {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Content-Length": String(statSync(file).size),
    "Cache-Control": cacheControl,
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}).listen(port, host, () => {
  console.log(`[preview] build/ → http://${host}:${port}（未命中的路径如实返回 404，不做 SPA 兜底）`);
});

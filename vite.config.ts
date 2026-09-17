import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type Plugin } from "vite";

const siteRoot = path.dirname(fileURLToPath(import.meta.url));

// Static site. `BASE_PATH` lets CI point assets at a project subpath (e.g.
// `/flowy-agent-store/`) without touching source; local dev/build default to
// `/` so `react-router dev` / `preview` work at the domain root.
//
// `market-source/` holds the committed market tree (~22.6k files, copied into
// the build output by scripts/copy-market-tree.mjs). It is data, not app code:
// watching it keeps the dev server busy enough that React Router's prerender
// requests fail, so the watcher skips it and HMR stays fast too.
const MARKET_TREE = "**/market-source/**";

// Atomic writers (write a sibling temp directory, then rename into place) leave
// short-lived `.<name>.<pid>.<uuid>.tmpdir/` directories next to the file they
// replace. Watching one of those crashes the dev server outright with
// `EBUSY: resource busy or locked, watch ...` when the rename wins the race, so
// the watcher skips the pattern. Real edits under `content/docs/` still trigger
// HMR — only those transient directories are ignored.
const ATOMIC_WRITE_TEMP = "**/*.tmpdir/**";

// React Router's SSG output (React Router's `buildDirectory`, not Vite's
// `build.outDir`) holds a copy of the ~22.6k-file market tree under
// `build/client/source`, so an unignored `build/` makes the watcher fire a
// reload per copied file and starves the dev server. Vite only auto-ignores its
// own `outDir`, hence the explicit pattern.
const BUILD_OUTPUT = "**/build/**";

/** Extensions reachable under `/source/…` (icons + the `_files.txt` listings). */
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

/**
 * Dev-only static host for `<base>/source/…`.
 *
 * In production `scripts/copy-market-tree.mjs` drops the tree into
 * `build/client/source`, so the static host serves it. The dev server never
 * runs that step, so `/source/**` used to fall through to the SPA fallback —
 * a 302 to `/zh-CN`, whose HTML no `<img>` can decode. Every catalog avatar
 * then tripped `onError` and the page showed only letter badges.
 *
 * Mounted here instead of via `publicDir`, for the reason spelled out in
 * `scripts/copy-market-tree.mjs`: a ~22.6k-file `publicDir` stalls prerender.
 * Deliberately dev-only — `preview` must keep serving `build/client` verbatim
 * so that a broken copy step fails locally rather than only after deploy.
 */
function marketSourcePlugin(): Plugin {
  const root = path.resolve(siteRoot, "market-source");
  return {
    name: "market-source-dev",
    apply: "serve",
    configureServer(server) {
      const mount = `${(server.config.base || "/").replace(/\/+$/, "")}/source/`;
      server.middlewares.use((req, res, next) => {
        const [urlPath] = (req.url ?? "").split("?");
        if (!urlPath.startsWith(mount)) return next();

        let rel: string;
        try {
          rel = decodeURIComponent(urlPath.slice(mount.length));
        } catch {
          return next();
        }

        const file = path.resolve(root, rel);
        if (!file.startsWith(root + path.sep)) return next();

        stat(file)
          .then((info) => {
            if (!info.isFile()) return next();
            res.setHeader(
              "Content-Type",
              MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
            );
            res.setHeader("Content-Length", String(info.size));
            // Mirrors the `_files.txt` no-cache rule in edgeone.json: the market
            // client polls those listings, stale copies would hide new entries.
            res.setHeader(
              "Cache-Control",
              rel.endsWith("_files.txt") ? "no-cache" : "public, max-age=0, must-revalidate",
            );
            if (req.method === "HEAD") {
              res.end();
              return;
            }
            createReadStream(file).pipe(res);
          })
          .catch(() => next());
      });
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    reactRouter(),
    marketSourcePlugin(),
  ],
  server: {
    // Bind the IPv4 loopback explicitly. The default (`host: "localhost"`)
    // resolves to `::1` only on Windows, which makes the market tree
    // unreachable for clients that go through a local HTTP proxy: the proxy
    // forwards to `127.0.0.1:<port>` and gets ECONNREFUSED, so it answers
    // 502 — that is exactly how the Agent Store's HTTP market mirror failed
    // (`reqwest` picks up the Windows system proxy and does not honour the
    // `*localhost*` wildcard in `ProxyOverride`). `localhost` in a browser
    // still works: it falls back to 127.0.0.1.
    host: "127.0.0.1",
    watch: { ignored: [MARKET_TREE, ATOMIC_WRITE_TEMP, BUILD_OUTPUT] },
  },
});

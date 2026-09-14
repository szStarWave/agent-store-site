import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

// Static site. `BASE_PATH` lets CI point assets at a project subpath (e.g.
// `/flowy-agent-store/`) without touching source; local dev/build default to
// `/` so `react-router dev` / `preview` work at the domain root.
//
// `market-source/` holds the committed market tree (~8.5k files, copied into
// the build output by scripts/copy-market-tree.mjs). It is data, not app code:
// watching it keeps the dev server busy enough that React Router's prerender
// requests fail, so the watcher skips it and HMR stays fast too.
const MARKET_TREE = "**/market-source/**";

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [reactRouter()],
  server: {
    watch: { ignored: [MARKET_TREE] },
  },
});

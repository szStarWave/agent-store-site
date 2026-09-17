#!/usr/bin/env node
/**
 * 把已提交的市场树拷进构建产物，落点为 `/source/<market>/…`。
 *
 * 这棵树刻意不放在 `public/`：Vite 会在构建期拷贝 `publicDir`，而约 8.9k 文件的树
 * 放在那里会让 React Router 的预渲染步骤失败（dev server 在准备 out dir 时卡住），
 * 还会拖慢每次 HMR 重载。在 `react-router build` 之后再拷贝，既保住了开发循环与
 * 预渲染的速度，对外 URL 也仍然是 `/source/…`。
 *
 * 由 `package.json` → `build` 串起来，所以 EdgeOne Makers 也会跑到它。
 */

import { existsSync } from "node:fs";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
const sourceRoot = path.join(siteRoot, "market-source");
const clientRoot = path.join(siteRoot, "build", "client");
const outRoot = path.join(clientRoot, "source");
const MARKETS = ["experts", "skills", "connectors"];

async function countFiles(dir) {
  let n = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += await countFiles(path.join(dir, entry.name));
    else n += 1;
  }
  return n;
}

if (!existsSync(sourceRoot)) {
  console.error(`[copy-market-tree] missing market tree: ${path.relative(siteRoot, sourceRoot)}`);
  process.exit(1);
}
if (!existsSync(clientRoot)) {
  console.error("[copy-market-tree] build/client not found — run `bun run build` first");
  process.exit(1);
}

await rm(outRoot, { recursive: true, force: true });
await mkdir(outRoot, { recursive: true });

let total = 0;
for (const market of MARKETS) {
  const from = path.join(sourceRoot, market);
  const to = path.join(outRoot, market);
  if (!existsSync(from)) {
    console.error(`[copy-market-tree] missing market: ${market}`);
    process.exit(1);
  }
  await cp(from, to, { recursive: true });
  const n = await countFiles(to);
  total += n;
  const listing = path.join(to, "_files.txt");
  if (!existsSync(listing)) {
    console.error(`[copy-market-tree] ${market} has no _files.txt — run \`bun run sync:tree\``);
    process.exit(1);
  }
  console.log(`[copy-market-tree] ${market.padEnd(11)} files=${n}`);
}
console.log(`[copy-market-tree] → build/client/source (${total} files)`);

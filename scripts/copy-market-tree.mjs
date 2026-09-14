#!/usr/bin/env node
/**
 * Copy the committed market tree into the build output as `/source/<market>/…`.
 *
 * The tree deliberately does NOT live in `public/`: Vite copies `publicDir`
 * during the build, and a ~8.5k-file tree there makes React Router's prerender
 * step fail (the dev server stalls while preparing the out dir) as well as
 * slowing every HMR reload. Copying after `react-router build` keeps both the
 * dev loop and the prerender fast, while the published URL stays `/source/…`.
 *
 * Wired into `package.json` → `build`, so EdgeOne Makers runs it too.
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

#!/usr/bin/env node
/**
 * 把已提交的市场树里**目录页引用的头像**拷进构建产物，落点为 `/source/<market>/…`。
 *
 * 这棵树刻意不放在 `static/`：Docusaurus 会在构建期拷贝整个静态目录，而约 22.6k 文件的树
 * 放在那里会让构建卡在拷贝阶段（旧站同理，只是那时叫 `public/`）。因此本脚本在
 * `docusaurus build` **之后**运行，只把产物需要的文件放进去，对外 URL 仍是 `/source/…`。
 *
 * 由 `package.json` → `build` 串起来，所以 EdgeOne Makers 也会跑到它。
 *
 * 支持**按市场选择性托管**（`SITE_HOSTED_MARKETS`）：不整树托管的市场只保留目录页引用的图片。
 * 背景是 EdgeOne Makers 的两条产物上限——20,000 个文件与单文件 25 MiB——而三个市场合计
 * 22,612 个文件，**全托管必然超限**。
 *
 * 现状（doc 30）：**三个市场都迁到了 ModelScope 的 zip 归档**（`pack:market` 打包、
 * `publish:market` 上传），本站不再整树托管任何一个，`HOSTED_DEFAULT` 是空数组。客户端改成
 * 一次请求取一个归档，官方源也不再指向本站的 `/source/<market>/…`。于是本站只留目录页头像
 * （约 648 个文件）。「只托管部分市场」这条能力仍留着：将来若要回退，改这一个常量即可。
 *
 * 注意开发态与它不一致：`src/plugins/market-source-dev.ts` 直接把 `market-source/` 托管在
 * `/source/**` 上、不看这个开关，所以本地永远能看到完整树（仅 dev，不进产物）。
 */

import { existsSync, readFileSync } from "node:fs";
import { copyFile, cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
const sourceRoot = path.join(siteRoot, "market-source");
// Docusaurus 的产物目录是 `build/`（旧站是 React Router 的 `build/client/`）。
const outRoot = path.join(siteRoot, "build", "source");
const clientRoot = path.join(siteRoot, "build");
const SNAPSHOT = path.join(siteRoot, "content", "market.json");
const MARKETS = ["experts", "skills", "connectors"];

/**
 * 本站**整树托管**的市场 —— 过滤掉的市场只保留目录页引用的图片。
 *
 * 为什么需要它：EdgeOne Makers 的产物上限是 **20,000 个文件**与**单文件 25 MiB**（官方排障
 * 指南，无提额入口）。三个市场合计 22,612 个文件，全托管必然超限。
 *
 * **默认是空的**（doc 30）：三个市场都已迁到 ModelScope 的 zip 归档，本站一个都不托管。
 * 这不是「暂时」状态——客户端的官方默认源就是那些归档地址，与本站产物无关。
 *
 * 把一个市场放回这个列表时必须**同时**安排好它的来源可被客户端取到：客户端的
 * `config.toml` 若指向 `<站点>/source/<market>/…`，那个市场从站点消失就会让这些客户端
 * 刷新失败（`fetch_remote` 失败不碰 last-good，所以是「停在旧数据」而不是「条目被删」）。
 *
 * 不在列表里的市场仍会保留**目录页引用的图片**：目录页头像按同源解析（`avatarUrl()`，见
 * `app/lib/market.ts`），少一张就退化成字母徽标，与市场树托管在哪无关。
 */
const HOSTED_DEFAULT = [];

/** `SITE_HOSTED_MARKETS` 只是本地/一次性构建的覆盖，不写进部署。 */
const HOSTED = (process.env.SITE_HOSTED_MARKETS?.trim() || HOSTED_DEFAULT.join(","))
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

/** 目录页快照里某个市场引用到的图片，转成相对市场根的路径。 */
function snapshotAssets(market) {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  const prefix = `${snapshot.base ?? "source"}/${market}/`;
  const rels = new Set();
  for (const entry of snapshot[market] ?? []) {
    const avatar = entry?.avatar;
    if (typeof avatar === "string" && avatar.startsWith(prefix)) rels.add(avatar.slice(prefix.length));
  }
  return [...rels].sort();
}

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
  console.error("[copy-market-tree] build/ 不存在 —— 先跑 `bun run build`");
  process.exit(1);
}

const unknown = HOSTED.filter((market) => !MARKETS.includes(market));
if (unknown.length) {
  console.error(
    `[copy-market-tree] SITE_HOSTED_MARKETS 里有未知市场：${unknown.join(", ")}（可选 ${MARKETS.join(" / ")}）`,
  );
  process.exit(2);
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

  if (!HOSTED.includes(market)) {
    // 只拷目录页引用到的图片：整棵市场树由另一个宿主提供。
    await mkdir(to, { recursive: true });
    const assets = snapshotAssets(market);
    for (const rel of assets) {
      const src = path.join(from, rel);
      if (!existsSync(src)) {
        console.error(
          `[copy-market-tree] ${market}: content/market.json 指向 ${rel}，树里却没有 —— 先跑 \`bun run check:market\``,
        );
        process.exit(1);
      }
      const target = path.join(to, rel);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(src, target);
    }
    const n = await countFiles(to);
    total += n;
    console.log(`[copy-market-tree] ${market.padEnd(11)} catalog-assets=${n}（整树托管在别处）`);
    continue;
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
console.log(`[copy-market-tree] → build/source (${total} files；整树托管：${HOSTED.join(" / ")}）`);

#!/usr/bin/env node
/**
 * 把三个市场工作树打成**确定性** zip，并写出 `content/market-hosts.json`。
 *
 * 为什么要 zip（doc 30）：官方市场原先由本站按「逐文件托管 + `_files.txt` 清单」分发，
 * 客户端要逐个 GET 镜像整棵树——`experts` 一棵就是 **14,714 个请求 / 611 MiB**，
 * 而 EdgeOne Makers 的产物上限是 20,000 个文件，三个市场合计 22,706 个文件，
 * **默认构建必然超限**。改成「一个市场一个归档」后：站点只留目录页图标（约 648 个文件），
 * 客户端一次请求拿到同样那些字节（`experts` 压缩后 289.0 MiB）。
 *
 * 三个刻意的性质：
 *   - **先过闸门再打包**：`check:market` 不通过就不产出任何归档。打包是发布动作，
 *     而「树内部自洽」这件事 `sync:tree` 已经管了、`check:market` 管的是产物之间的一致；
 *   - **文件集只有一个定义**：条目清单来自 `sync-market-tree.mjs` 的 `listFiles`，
 *     不在这里重述「什么算市场里的文件」（清单、`.gitignore` 交付性都由它那侧守着）；
 *   - **确定性**：条目按路径排序、mtime 固定、压缩参数固定。同一棵树重复打包得到
 *     **字节相同**的归档，因此 sha256 可以直接当版本标识用，也才能不写时间戳而保持
 *     `market-hosts.json` 幂等（哪次打的、什么时候打的，问 git）。
 *
 * 用法：
 *   bun run pack:market              # 打包三个市场 + 写 market-hosts.json
 *   bun run pack:market -- --only experts
 *   bun run pack:market -- --check   # 只校验确定性（重打包比对摘要），不落盘
 */
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkMarkets, readSnapshot } from "./check-market.mjs";
import { listFiles, sourceRoot } from "./sync-market-tree.mjs";
import { writeZipFile } from "./lib/zip-lite.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
const outRoot = path.join(siteRoot, "dist-market");
const hostsFile = path.join(siteRoot, "content", "market-hosts.json");
const MARKETS = ["experts", "skills", "connectors"];

/**
 * 官方归档宿主的**唯一真源**。客户端 `builtin_default_marketplaces()`
 * （`crates/backend/nomifun-app-server/src/agent_store.rs`）必须与本常量给出同一批地址，
 * 两边各有单测钉住自己的那份；这里不再有第三份副本。
 *
 * `master` 是刻意的：市场是**移动目标**，钉 commit sha 会把每个客户端冻在「这个二进制
 * 构建时的那一版」，发一次市场就得发一次程序。客户端用 `HEAD` 的 `X-Linked-Etag`
 * （内容 sha256）判新旧，未变的归档不会被重复下载。
 */
const MARKET_HOST = "https://www.modelscope.cn/models/me9rez/flowy-marketplace/resolve/master";

/** 固定 mtime：确定性打包的前提（ZIP 的 DOS 时间戳只有 2 秒精度）。 */
const MTIME = new Date(Date.UTC(2020, 0, 1, 0, 0, 0));

/** 流式摘要：归档有近 300 MiB，不为了算个哈希把它读进内存。 */
async function sha256File(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

/**
 * 大小写碰撞：Linux 打得出来、Windows 解不开的两个条目名。
 * 归档是要给 Windows 客户端解的，所以这里直接拒绝，而不是让它到用户机器上炸。
 */
export function caseCollisions(names) {
  const seen = new Map();
  const collisions = [];
  for (const name of names) {
    const key = name.toLowerCase();
    const previous = seen.get(key);
    if (previous !== undefined && previous !== name) collisions.push([previous, name]);
    else seen.set(key, name);
  }
  return collisions;
}

function parseArgs(argv) {
  const out = { only: null, check: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") out.only = argv[++i];
    else if (argv[i] === "--check") out.check = true;
  }
  return out;
}

async function packMarket(market, { destDir, outDir }) {
  const names = (await listFiles(destDir)).slice().sort();
  if (names.length === 0) {
    throw new Error(`${market}: 市场树里一个文件都没有（先跑 \`bun run sync:tree\`）`);
  }
  const collisions = caseCollisions(names);
  if (collisions.length) {
    throw new Error(
      `${market}: 大小写碰撞（Windows 客户端会解不开）：` +
        collisions.map(([a, b]) => `${a} ↔ ${b}`).join("、"),
    );
  }

  const zipPath = path.join(outDir, `${market}.zip`);
  const { entries, bytes } = await writeZipFile(
    zipPath,
    names.map((name) => ({ name, path: path.join(destDir, name) })),
    { mtime: MTIME },
  );
  if (entries !== names.length) {
    throw new Error(`${market}: 写入 ${entries} 个条目，清单是 ${names.length} 个`);
  }
  const digest = await sha256File(zipPath);
  return { url: `${MARKET_HOST}/${market}.zip`, sha256: digest, bytes, files: names.length };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("usage: node scripts/pack-market-zips.mjs [--only <market>] [--check]");
    process.exit(0);
  }
  const args = parseArgs(argv);

  if (!existsSync(sourceRoot)) {
    console.error(`[pack-market] 缺少市场树：${path.relative(siteRoot, sourceRoot)}`);
    process.exit(1);
  }

  // 先过闸门：不合格的树不产出任何归档。
  const snapshot = readSnapshot();
  const results = await checkMarkets(snapshot);
  const findings = results.flatMap((result) => result.findings);
  if (findings.length) {
    console.error(`[pack-market] check:market 有 ${findings.length} 条发现，拒绝打包：`);
    for (const f of findings) console.error(`  ✗ ${f.message ?? JSON.stringify(f)}`);
    process.exit(1);
  }

  const markets = args.only ? [args.only] : MARKETS;
  const unknown = markets.filter((market) => !MARKETS.includes(market));
  if (unknown.length) {
    console.error(`[pack-market] 未知市场：${unknown.join("、")}（可选 ${MARKETS.join(" / ")}）`);
    process.exit(2);
  }

  // `--check` 打到临时目录：它只回答「同样输入是否得到同样字节」，
  // 绝不能顺手把 `dist-market/` 里已打好（可能刚上传过）的归档删掉——
  // `--only <market> --check` 曾会只重打一个市场、删掉另外两个。
  const checkRoot = path.join(os.tmpdir(), `market-zips-check-${process.pid}`);
  const outDir = args.check ? checkRoot : outRoot;
  if (args.check) {
    await rm(checkRoot, { recursive: true, force: true });
  } else {
    await rm(outRoot, { recursive: true, force: true });
  }
  await mkdir(outDir, { recursive: true });

  const hosts = { host: MARKET_HOST, markets: {} };
  for (const market of markets) {
    const destDir = path.join(sourceRoot, market);
    const packed = await packMarket(market, { destDir, outDir });
    hosts.markets[market] = packed;
    const mib = (packed.bytes / 1024 / 1024).toFixed(1);
    console.log(
      `[pack-market] ${market.padEnd(11)} files=${String(packed.files).padStart(6)} ` +
        `${mib.padStart(7)} MiB  sha256=${packed.sha256}`,
    );
    if (args.check) {
      // 确定性自检：同一次运行里重打一遍，摘要必须一致。
      const again = await packMarket(market, { destDir, outDir });
      if (again.sha256 !== packed.sha256) {
        console.error(`[pack-market] ${market} 打包不确定：两次 sha256 不同`);
        process.exit(1);
      }
    }
  }

  if (args.check) {
    await rm(checkRoot, { recursive: true, force: true });
    console.log("[pack-market] --check：重复打包摘要一致（确定性成立），未触碰 dist-market/");
    return;
  }

  // 不写时间戳：内容相同则文件相同（幂等）。改了什么问 git。
  await writeFile(hostsFile, `${JSON.stringify(hosts, null, 2)}\n`, "utf8");
  console.log(
    `[pack-market] → dist-market/（${markets.length} 个归档）与 ${path.relative(siteRoot, hostsFile)}`,
  );
}

// 与 `check-market.mjs` / `sync-market-tree.mjs` 同一守卫：被当作模块导入时
// 不得执行打包（测试直接驱动 `caseCollisions`，导入即打包会让测试变成发布动作）。
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();

#!/usr/bin/env node
/**
 * 把三个本地市场工作树镜像到 `market-source/`，并为每个市场生成静态 `_files.txt` 清单。
 *
 * 为什么要静态清单：App Server 的 `url` 市场抓取器会探测
 * `{base}/{market}/_files.txt`，并通过 HTTP 镜像其中列出的每个文件，所以由纯静态托管
 * （EdgeOne Makers）提供的市场必须在发布时预先算好清单——不存在动态目录接口。
 *
 * 用法：
 *   bun run sync:tree                     # 镜像 + 生成清单 + 校验
 *   bun run sync:tree -- --dry-run        # 只显示差异，不写任何东西
 *   bun run sync:tree -- --listing-only   # 只从镜像重生成清单，不需要源
 *   bun run sync:tree -- --markets experts=D:\\exp skills=D:\\skl connectors=D:\\con
 *
 * 默认值：每个市场从运行环境的标准工作目录读取（见下面的 `DEFAULT_SOURCES`）。
 * 可用环境变量 MARKET_SRC_EXPERTS / MARKET_SRC_SKILLS / MARKET_SRC_CONNECTORS 按市场覆盖，
 * 或用 `--markets` 按次覆盖。
 *
 * 发布门禁（不通过即整轮失败，坏树绝不会进到部署）：
 *   - 每个市场的发现清单存在且能解析；
 *   - 清单里每个条目的 `source` 都是相对路径，且解析后落在树内
 *     （不允许绝对路径、不允许 `..`、不允许反斜杠）；
 *   - 生成的清单覆盖树里的每个文件（除了它自己），每行一个 POSIX 相对路径，
 *     不留空行与非法条目。
 *
 * 只告警、不失败——条目的 `source` 在源树里没有载荷（`grill-me`、`web-access` 等在上游
 * 只是元数据）。站点镜像的是上游市场实际有的东西；为站点修不了的上游元数据卡住整个
 * 发布，只会更糟。
 *
 * 镜像时排除（只排顶层，因此条目内容永远不会被悄悄丢掉）：`logs/`、`dist/`、
 * `market-icons/`，外加任意层级的 `.git/` 与 `node_modules/`，再加 `FILE_EXCLUDES`
 * 里的垃圾文件名。
 *
 * **清单必须描述 git 真正会交付的内容。** `listFiles` 是「什么算在市场里」的唯一
 * 定义——同步按它拷贝、按它生成清单、`check-market.mjs` 拿它做比对——所以 `git add`
 * 会悄悄拒绝的名字绝不允许进入清单：App Server 会通过 HTTP 镜像清单里的每个路径，
 * 而一个被 git 丢掉的路径就是每个客户端的一次 404，且在跑同步的机器上完全看不出来
 * （那台机器的磁盘上还有这个文件）。`.gitignore` 里没锚定的 `.codebuddy/` 对专家市场
 * 干的正是这件事：84 个文件被列了出来，提交里却什么都没有。
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
export const sourceRoot = path.join(siteRoot, "market-source");

const home = homedir();
const DEFAULT_SOURCES = {
  experts: process.env["MARKET_SRC_EXPERTS"] ?? path.join(home, ".workbuddy", "plugins", "marketplaces", "experts"),
  skills: process.env["MARKET_SRC_SKILLS"] ?? path.join(home, ".workbuddy", "skills-marketplace"),
  connectors: process.env["MARKET_SRC_CONNECTORS"] ?? path.join(home, ".workbuddy", "connectors-marketplace"),
};

/**
 * doc 18 §3 的发现顺序；第一个命中项决定了市场种类。
 *
 * `contentRoot` 是条目 `source` 相对的目录。插件市场在市场根写
 * `source: "./plugins/<name>"`，而技能与连接器市场声明的是裸 slug
 * （`source: "tencent-docs"`），它位于同名子目录下——`.codebuddy-skill/marketplace.json`
 * 加 `skills/<slug>/`，`.codebuddy-connector/connectors.json` 加 `connectors/<slug>/`。
 */
export const MANIFESTS = {
  experts: { rel: ".codebuddy-plugin/marketplace.json", entries: "plugins", contentRoot: "" },
  skills: { rel: ".codebuddy-skill/marketplace.json", entries: "skills", contentRoot: "skills" },
  connectors: { rel: ".codebuddy-connector/connectors.json", entries: "connectors", contentRoot: "connectors" },
};

export const LISTING = "_files.txt";
const TOP_EXCLUDES = new Set(["logs", "dist", "market-icons"]);
const DEEP_EXCLUDES = new Set([".git", "node_modules"]);
/**
 * 垃圾文件名，任意层级都排除。`git add` 会拒绝它们（`.gitignore`），
 * `import-expert-bundles.mjs` 也把带这类文件的 bundle 判为垃圾，所以市场树在磁盘上
 * 可以有、已发布的树里不能有——见文件头关于「清单为何不能宣传它们」的说明。
 */
const FILE_EXCLUDES = new Set([".DS_Store", "Thumbs.db"]);

function parseArgs(argv) {
  const sources = { ...DEFAULT_SOURCES };
  let dryRun = false;
  let listingOnly = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--listing-only") listingOnly = true;
    else if (arg === "--markets") {
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        const pair = argv[++i];
        const eq = pair.indexOf("=");
        if (eq > 0) sources[pair.slice(0, eq)] = path.resolve(pair.slice(eq + 1));
      }
    }
  }
  return { sources, dryRun, listingOnly };
}

const { sources, dryRun, listingOnly } = parseArgs(process.argv.slice(2));

/**
 * 递归列出 `dir` 下的文件，返回相对它的 POSIX 路径。
 *
 * 顺序为逐层 `localeCompare`（已发布清单用的就是这个顺序）。注意它依赖 ICU，
 * 因此 CJK 文件名在 zh-CN 工作站与 CI runner 上可能排出不同顺序——换一台 locale 不同的
 * 机器同步时，会有少数几行换位。没有任何东西消费这个顺序，所以不值得钉死。
 */
export async function listFiles(dir, prefix = "") {
  const out = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      if (DEEP_EXCLUDES.has(entry.name)) continue;
      if (prefix === "" && TOP_EXCLUDES.has(entry.name)) continue;
      out.push(...(await listFiles(path.join(dir, entry.name), `${rel}/`)));
    } else if (entry.isFile()) {
      if (FILE_EXCLUDES.has(entry.name)) continue;
      if (prefix === "" && entry.name === LISTING) continue;
      out.push(rel);
    }
  }
  return out;
}

const sha256 = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");

/** 树与其镜像之间的新增 / 删除 / 变更文件集合。 */
async function diffMarket(name, srcDir, destDir) {
  const srcFiles = await listFiles(srcDir);
  const destFiles = existsSync(destDir) ? await listFiles(destDir) : [];
  const srcSet = new Set(srcFiles);
  const destSet = new Set(destFiles);
  const added = srcFiles.filter((f) => !destSet.has(f));
  const removed = destFiles.filter((f) => !srcSet.has(f));
  const changed = [];
  for (const rel of srcFiles) {
    if (!destSet.has(rel)) continue;
    const [a, b] = await Promise.all([sha256(path.join(srcDir, rel)), sha256(path.join(destDir, rel))]);
    if (a !== b) changed.push(rel);
  }
  return { name, srcDir, destDir, srcFiles, added, removed, changed };
}

/** 删掉上游已不存在的文件，再剪掉空目录。 */
async function prune(destDir, removed) {
  for (const rel of removed) await rm(path.join(destDir, rel), { force: true });
  const dirs = [...new Set(removed.map((rel) => path.dirname(path.join(destDir, rel))))].sort((a, b) => b.length - a.length);
  for (const dir of dirs) {
    if (!dir.startsWith(destDir) || dir === destDir) continue;
    try {
      if ((await readdir(dir)).length === 0) await rm(dir, { recursive: true, force: true });
    } catch {
      // 目录已经没了
    }
  }
}

async function copyAll(srcDir, destDir, files) {
  for (const rel of files) {
    const target = path.join(destDir, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(srcDir, rel), target);
  }
}

/**
 * 发布门禁：清单形状 + 条目 source + 清单/树一致性。
 * 返回 `{ findings, warnings }`——findings 阻止发布，warnings 是镜像只能上报的
 * 上游缺口（见文件头说明）。
 */
async function validate(name, destDir) {
  const findings = [];
  const warnings = [];
  const manifest = MANIFESTS[name];
  const manifestPath = path.join(destDir, manifest.rel);
  if (!existsSync(manifestPath)) {
    findings.push(`${name}: missing manifest ${manifest.rel}`);
    return { findings, warnings };
  }
  let parsed;
  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    findings.push(`${name}: manifest is not valid JSON (${error.message})`);
    return { findings, warnings };
  }
  const contentDir = path.join(destDir, manifest.contentRoot);
  const entries = Array.isArray(parsed[manifest.entries]) ? parsed[manifest.entries] : [];
  if (entries.length === 0) findings.push(`${name}: manifest has no "${manifest.entries}" entries`);
  for (const [index, entry] of entries.entries()) {
    const label = `${name}: entries[${index}]`;
    const source = entry?.source;
    if (source === undefined) continue; // source 可省略（仅登记在清单里的条目）
    if (typeof source !== "string" || source.trim() === "") {
      findings.push(`${label}: source must be a non-empty string`);
      continue;
    }
    const clean = source.replace(/^\.\//, "");
    if (path.isAbsolute(clean) || /^[a-z]:/i.test(clean) || clean.startsWith("\\\\")) {
      findings.push(`${label}: source must be relative, got "${source}"`);
      continue;
    }
    if (clean.includes("\\") || clean.split("/").includes("..")) {
      findings.push(`${label}: source must be a POSIX relative path without "..", got "${source}"`);
      continue;
    }
    const resolved = path.join(contentDir, clean);
    if (!resolved.startsWith(destDir + path.sep)) {
      findings.push(`${label}: source "${source}" escapes the market`);
    } else if (!existsSync(resolved)) {
      warnings.push(`${label}: source "${source}" ships no payload`);
    }
  }

  // 清单就是镜像契约：它必须与树完全一致。
  // 顺序不属于契约——它按 `listFiles` 的顺序生成。
  const listed = (await readFile(path.join(destDir, LISTING), "utf8")).split("\n").filter((line) => line !== "");
  const actual = await listFiles(destDir);
  const missing = actual.filter((rel) => !listed.includes(rel));
  const phantom = listed.filter((rel) => !actual.includes(rel));
  if (missing.length) findings.push(`${name}: listing misses ${missing.length} file(s), e.g. ${missing[0]}`);
  if (phantom.length) findings.push(`${name}: listing references ${phantom.length} missing file(s), e.g. ${phantom[0]}`);
  if (listed.includes(LISTING)) findings.push(`${name}: listing must exclude itself`);
  for (const rel of listed) {
    if (rel.startsWith("/") || rel.includes("\\") || rel.split("/").includes("..")) {
      findings.push(`${name}: illegal path in listing: ${rel}`);
      break;
    }
  }
  return { findings, warnings };
}

/** 校验每个市场，只要有东西挡住发布就以非零码退出。 */
async function report(markets) {
  const results = await Promise.all(markets.map(({ name, destDir }) => validate(name, destDir)));
  const findings = results.flatMap((r) => r.findings);
  const warnings = results.flatMap((r) => r.warnings);
  for (const warning of warnings) console.warn(`[sync-market-tree] ! ${warning}`);
  if (warnings.length) {
    console.warn(
      `[sync-market-tree] ${warnings.length} entr(ies) ship no payload upstream — metadata-only, nothing to mirror`,
    );
  }
  if (findings.length) {
    for (const finding of findings) console.error(`[sync-market-tree] ✗ ${finding}`);
    console.error(`[sync-market-tree] ${findings.length} problem(s) — tree is not publishable`);
    process.exit(1);
  }
  console.log("[sync-market-tree] validation passed — tree is publishable");
}

/**
 * 从镜像本身生成某个市场的清单——清单正是由它推导出来的，
 * 所以写它不需要任何别的东西。
 */
async function writeListing(destDir) {
  const files = await listFiles(destDir);
  await writeFile(path.join(destDir, LISTING), files.length ? `${files.join("\n")}\n` : "");
  console.log(`[sync-market-tree] wrote ${path.join(destDir, LISTING)} (${files.length} files)`);
}

/**
 * 只靠镜像重生成清单，不读任何源。
 *
 * 上游工作副本是每台机器各自的（见 `DEFAULT_SOURCES`），而镜像是跟仓库走的。
 * 所以当排除规则变了，一台没有源的机器别无办法把已提交的清单重新对齐——
 * 而清单与树不一致，正是本脚本门禁存在的理由。
 */
async function relist() {
  const markets = Object.keys(MANIFESTS);
  for (const name of markets) {
    const destDir = path.join(sourceRoot, name);
    if (!existsSync(destDir)) {
      console.error(`[sync-market-tree] no mirror for ${name}: ${destDir}`);
      process.exit(2);
    }
    await writeListing(destDir);
  }
  await report(markets.map((name) => ({ name, destDir: path.join(sourceRoot, name) })));
}

export async function main() {
  if (listingOnly) return relist();

  const starts = Object.entries(sources);
  const unknown = starts.filter(([name]) => !MANIFESTS[name]);
  if (unknown.length) {
    console.error(`[sync-market-tree] unknown market(s): ${unknown.map(([n]) => n).join(", ")}`);
    process.exit(2);
  }

  const diffs = [];
  for (const [name, srcDir] of starts) {
    if (!existsSync(srcDir)) {
      console.error(`[sync-market-tree] source missing for ${name}: ${srcDir}`);
      process.exit(2);
    }
    diffs.push(await diffMarket(name, srcDir, path.join(sourceRoot, name)));
  }

  const totals = diffs.reduce(
    (acc, d) => ({
      files: acc.files + d.srcFiles.length,
      added: acc.added + d.added.length,
      removed: acc.removed + d.removed.length,
      changed: acc.changed + d.changed.length,
    }),
    { files: 0, added: 0, removed: 0, changed: 0 },
  );
  for (const d of diffs) {
    console.log(
      `[sync-market-tree] ${d.name.padEnd(11)} files=${String(d.srcFiles.length).padStart(5)} ` +
        `+${d.added.length} -${d.removed.length} ~${d.changed.length}`,
    );
  }
  console.log(
    `[sync-market-tree] total files=${totals.files} added=${totals.added} removed=${totals.removed} changed=${totals.changed}`,
  );

  if (dryRun) {
    for (const d of diffs) {
      for (const f of d.added.slice(0, 5)) console.log(`[dry-run] + ${d.name}/${f}`);
      for (const f of d.removed.slice(0, 5)) console.log(`[dry-run] - ${d.name}/${f}`);
      for (const f of d.changed.slice(0, 5)) console.log(`[dry-run] ~ ${d.name}/${f}`);
    }
    console.log("[sync-market-tree] dry run — nothing written");
    return;
  }

  for (const d of diffs) {
    await prune(d.destDir, d.removed);
    await copyAll(d.srcDir, d.destDir, [...d.added, ...d.changed]);
    await writeListing(d.destDir);
  }

  await report(diffs);
}

// 供 `check-market.mjs` 导入（共享清单/市场定义）。只在作为 CLI 调用时才执行镜像，
// 因此 import 本文件没有副作用。
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();

#!/usr/bin/env node
/**
 * release — 打包并发布 Flowy Agent Store 预览版（GitHub Releases）。
 *
 *   node scripts/release.mjs pack --exe <可执行文件> [--out <目录>]
 *       打包：<out>/flowy-agent-store-v<版本>-windows-x86_64.zip
 *             <out>/SHA256SUMS.txt、<out>/RELEASE_NOTES.md
 *   node scripts/release.mjs publish [--out <目录>] [--keep-draft] [--no-verify]
 *       建草稿 Release → 上传资产 → 校验体积/哈希 → 发布（标为 prerelease）
 *   node scripts/release.mjs status
 *       查看当前版本 Release 的远端状态
 *
 * 单一真源 = content/release.json：站点 UI（app/lib/platform.ts）与本脚本共用
 * 同一个版本号，版本号须与 npm 包 @flowy-agent-store/* 一致。
 *
 * 约定：
 *   - 资产名 flowy-agent-store-v<版本>-windows-x86_64.zip，zip 内为
 *     flowy-agent-store.exe（对用户的正式名，不是构建产物名 agent-store.exe）
 *   - Release 一律标 prerelease：GitHub 的 /releases/latest/... 只解析「最新的
 *     非预发布」Release，所以站点 URL 固定用显式 tag，不依赖 latest
 *   - 同一个版本号不允许对应两个不同二进制：pack 前用 --expect-sha256 核对
 *     （发布 npm 同版本包时用的那份 exe）
 *
 * 上传走 gh CLI；国内网络需 HTTPS_PROXY（或用 GH 的代理配置）。
 * 打包用内置 ZIP 写入器（node:zlib），不依赖系统 zip/Compress-Archive。
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDeflateRaw } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE = JSON.parse(readFileSync(join(ROOT, "content/release.json"), "utf8"));
const VERSION = String(RELEASE.version);
const REPO = String(RELEASE.repo);
const TAG = `v${VERSION}`;
const PLATFORM = "windows-x86_64";
const ASSET = `flowy-agent-store-v${VERSION}-${PLATFORM}.zip`;
const INNER_EXE = "flowy-agent-store.exe";
const SUM_FILE = "SHA256SUMS.txt";
const NOTES_FILE = "RELEASE_NOTES.md";
const GH = process.platform === "win32" ? "gh.exe" : "gh";

// ---------------------------------------------------------------- 小工具

const log = (...a) => console.log(...a);
const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[a.slice(2)] = true;
    else {
      out[a.slice(2)] = next;
      i++;
    }
  }
  return out;
}

function dryRun(cmd, args, { inherit = false } = {}) {
  if (process.env.RELEASE_DRY_RUN === "1") {
    log(`  [dry-run] ${cmd} ${args.join(" ")}`);
    return "";
  }
  return execFileSync(cmd, args, { encoding: "utf8", stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"] }) ?? "";
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

// ---------------------------------------------------------------- ZIP 写入器
// 单条目、deflate、固定时间戳（取源文件 mtime）→ 同一个输入永远得到同一个 zip。

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf, seed = 0) {
  let crc = seed ^ 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(d) {
  const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  const date = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  return { time, date };
}

async function deflateFile(path) {
  const chunks = [];
  let crc = 0;
  let usize = 0;
  const dfl = createDeflateRaw({ level: 6 });
  const finished = new Promise((res, rej) => {
    dfl.on("data", (c) => chunks.push(c));
    dfl.on("end", res);
    dfl.on("error", rej);
  });
  for await (const chunk of createReadStream(path)) {
    crc = crc32(chunk, crc);
    usize += chunk.length;
    if (!dfl.write(chunk)) await new Promise((r) => dfl.once("drain", r));
  }
  dfl.end();
  await finished;
  return { data: Buffer.concat(chunks), crc, usize };
}

function zipSingle(zipPath, entryName, { data, crc, usize }, mtime) {
  const name = Buffer.from(entryName, "utf8");
  const { time, date } = dosDateTime(mtime);

  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(0x04034b50, 0);
  lfh.writeUInt16LE(20, 4); // 需要的版本
  lfh.writeUInt16LE(0x0800, 6); // 标志位：UTF-8 条目名
  lfh.writeUInt16LE(8, 8); // deflate 压缩
  lfh.writeUInt16LE(time, 10);
  lfh.writeUInt16LE(date, 12);
  lfh.writeUInt32LE(crc, 14);
  lfh.writeUInt32LE(data.length, 18);
  lfh.writeUInt32LE(usize, 22);
  lfh.writeUInt16LE(name.length, 26);
  lfh.writeUInt16LE(0, 28);
  const local = Buffer.concat([lfh, name, data]);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4); // 创建者版本
  cd.writeUInt16LE(20, 6); // 需要的版本
  cd.writeUInt16LE(0x0800, 8);
  cd.writeUInt16LE(8, 10);
  cd.writeUInt16LE(time, 12);
  cd.writeUInt16LE(date, 14);
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(data.length, 20);
  cd.writeUInt32LE(usize, 24);
  cd.writeUInt16LE(name.length, 28);
  cd.writeUInt32LE(0, 42); // 本地文件头的相对偏移
  const central = Buffer.concat([cd, name]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8); // 本磁盘上的条目数
  eocd.writeUInt16LE(1, 10); // 条目总数
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length, 16); // 中央目录偏移
  writeFileSync(zipPath, Buffer.concat([local, central, eocd]));
}

// ---------------------------------------------------------------- pack

async function pack(args) {
  const exe = args.exe && resolve(String(args.exe));
  if (!exe || !existsSync(exe)) die(`缺少 --exe <可执行文件>（或文件不存在）：${args.exe ?? "(未提供)"}`);

  const outDir = resolve(String(args.out ?? join(ROOT, "dist-release")));
  mkdirSync(outDir, { recursive: true });

  const exeSize = statSync(exe).size;
  const exeSha = sha256(exe);
  log(`▶ 打包 v${VERSION}`);
  log(`  源文件   ${basename(exe)}  ${mb(exeSize)}`);
  log(`  sha256   ${exeSha}`);

  // 版本号与 npm 同号 ⇒ 必须是同一个二进制；允许显式核对。
  if (args["expect-sha256"] && String(args["expect-sha256"]).toLowerCase() !== exeSha) {
    die(`--expect-sha256 不匹配：期望 ${args["expect-sha256"]}，实际 ${exeSha}`);
  }

  const t0 = Date.now();
  const zipPath = join(outDir, ASSET);
  const deflated = await deflateFile(exe);
  zipSingle(zipPath, INNER_EXE, deflated, statSync(exe).mtime);
  const zipSize = statSync(zipPath).size;
  const zipSha = sha256(zipPath);
  log(`  zip      ${ASSET}  ${mb(zipSize)}（${((1 - zipSize / exeSize) * 100).toFixed(0)}% 压缩，${Date.now() - t0}ms）`);

  const sums = `${zipSha}  ${ASSET}\n${exeSha}  ${INNER_EXE}（zip 内）\n`;
  writeFileSync(join(outDir, SUM_FILE), sums);

  const notes = [
    `# Flowy Agent Store ${TAG} · Windows x64 预览版`,
    "",
    "> 预览版本：功能与接口仍在调整，不建议用于生产环境。",
    "",
    "## 下载",
    "",
    `| 平台 | 文件 | 大小 |`,
    `| --- | --- | --- |`,
    `| Windows x64 | \`${ASSET}\` | ${mb(zipSize)} |`,
    "",
    `解压后得到 \`${INNER_EXE}\`，双击或命令行运行。`,
    "",
    "## 校验",
    "",
    "```text",
    `${zipSha}  ${ASSET}`,
    "```",
    "",
    "## 其他",
    "",
    `- 同版本 npm 包：\`@flowy-agent-store/runtime-win32-x64@${VERSION}\``,
    `- 本 Release 为预发布（pre-release），不参与 GitHub 的 “latest” 解析`,
    "",
  ].join("\n");
  writeFileSync(join(outDir, NOTES_FILE), notes);

  log(`✓ 产物目录 ${outDir}`);
  log(`  ${ASSET}`);
  log(`  ${SUM_FILE} / ${NOTES_FILE}`);
}

// ---------------------------------------------------------------- publish

function ghJson(args) {
  try {
    return JSON.parse(dryRun(GH, args) || "{}");
  } catch (e) {
    const msg = `${e?.stderr ?? ""}${e?.stdout ?? ""}`;
    // `gh release view` 对不存在的 Release 退出码非零 —— 视为「尚无」而非失败。
    if (/release not found|HTTP 404|not Found/i.test(msg)) return {};
    die(`gh ${args.join(" ")} 失败：${msg.trim().split("\n").slice(0, 3).join(" / ")}`);
  }
}

async function publish(args) {
  const outDir = resolve(String(args.out ?? join(ROOT, "dist-release")));
  const zipPath = join(outDir, ASSET);
  const sumPath = join(outDir, SUM_FILE);
  const notesPath = existsSync(String(args.notes ?? "")) ? resolve(String(args.notes)) : join(outDir, NOTES_FILE);
  for (const f of [zipPath, sumPath]) if (!existsSync(f)) die(`缺少 ${f}（先跑 release:pack）`);

  const zipSha = sha256(zipPath);
  log(`▶ 发布 ${TAG} → ${REPO}`);
  log(`  ${ASSET}  ${mb(statSync(zipPath).size)}  sha256=${zipSha.slice(0, 16)}…`);

  const existing = ghJson([ "release", "view", TAG, "--repo", REPO, "--json", "tagName,isDraft,assets" ]);
  if (existing.tagName && !args["replace-existing"]) {
    log(`  已存在同名 Release（draft=${existing.isDraft}），改用 --replace-existing 可重传资产`);
  } else if (!existing.tagName) {
    dryRun(GH, [
      "release", "create", TAG,
      "--repo", REPO,
      "--title", `Flowy Agent Store ${TAG}（Windows x64 预览版）`,
      "--notes-file", notesPath,
      "--prerelease",
      "--draft",
    ], { inherit: true });
    log("  已建草稿 Release");
  }

  dryRun(GH, [ "release", "upload", TAG, zipPath, sumPath, "--repo", REPO, "--clobber" ], { inherit: true });
  log("  资产已上传");

  // 读回校验：远端资产体积必须与本地一致
  const after = ghJson([ "release", "view", TAG, "--repo", REPO, "--json", "tagName,isDraft,isPrerelease,assets" ]);
  for (const local of [zipPath, sumPath]) {
    const want = statSync(local).size;
    const got = after.assets?.find((a) => a.name === basename(local));
    if (!got) die(`远端缺少资产 ${basename(local)}`);
    if (got.size !== want) die(`资产 ${basename(local)} 体积不符：远端 ${got.size} / 本地 ${want}`);
    log(`  ✓ ${basename(local)}  ${got.size} B`);
  }

  if (!args["no-verify"]) {
    const tmp = join(outDir, ".verify");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    dryRun(GH, [ "release", "download", TAG, "--repo", REPO, "--pattern", ASSET, "--dir", tmp, "--clobber" ], { inherit: true });
    const got = sha256(join(tmp, ASSET));
    if (got !== zipSha) die(`下载回来的资产哈希不符：${got} ≠ ${zipSha}`);
    log(`  ✓ 下载回验通过（sha256 一致）`);
    rmSync(tmp, { recursive: true, force: true });
  }

  if (args["keep-draft"]) {
    log(`✓ 已停在草稿态（--keep-draft）。手动发布：gh release edit ${TAG} --repo ${REPO} --draft=false --prerelease`);
    return;
  }
  dryRun(GH, [ "release", "edit", TAG, "--repo", REPO, "--draft=false", "--prerelease" ], { inherit: true });
  const final = ghJson([ "release", "view", TAG, "--repo", REPO, "--json", "url,isDraft,isPrerelease,assets" ]);
  log(`✓ 已发布：${final.url ?? "(dry-run)"}  draft=${final.isDraft} prerel=${final.isPrerelease}`);
  log(`  资产下载地址：https://github.com/${REPO}/releases/download/${TAG}/${ASSET}`);
}

function status() {
  const info = ghJson([ "release", "view", TAG, "--repo", REPO, "--json", "tagName,url,isDraft,isPrerelease,publishedAt,assets" ]);
  if (!info.tagName) return log(`（${REPO} 上暂无 ${TAG}）`);
  log(`${info.tagName}  draft=${info.isDraft} prerelease=${info.isPrerelease}  ${info.publishedAt ?? ""}`);
  log(info.url);
  for (const a of info.assets ?? []) log(`  ${a.name}  ${a.size} B`);
}

// ---------------------------------------------------------------- 入口

const argv = process.argv.slice(2);
const cmd = argv[0];
const args = parseArgs(argv.slice(1));

if (cmd === "pack") await pack(args);
else if (cmd === "publish") await publish(args);
else if (cmd === "status") status();
else {
  log("用法：");
  log("  node scripts/release.mjs pack --exe <可执行文件> [--out <目录>] [--expect-sha256 <哈希>]");
  log("  node scripts/release.mjs publish [--out <目录>] [--keep-draft] [--no-verify] [--replace-existing]");
  log("  node scripts/release.mjs status");
  process.exit(cmd ? 1 : 0);
}

#!/usr/bin/env node
/**
 * 从上游专家市场（bundle 通道）批量获取专家插件，落到**站外副本**并登记清单。
 *
 * 为何走 bundle：专家的发行物是 `bundles/<slug>.tar.gz`（见 docs/market-expert-import-plan.md
 * §3.1），与 WorkBuddy 召唤落盘的包内容一致（仅换行符差异）。本站的 url 市场契约要求
 * 上架物是解包后的文件树，因此本脚本只负责「获取 + 核验 + 解包 + 登记副本」，绝不写
 * `market-source/` 或 `content/market.json`（两者仍由 sync 脚本成对生成）。
 *
 * 用法：
 *   node scripts/import-expert-bundles.mjs --slugs a,b,c --copy <dir> [--archive <dir>]
 *   node scripts/import-expert-bundles.mjs --from-file list.txt --copy <dir> --dry-run
 *   node scripts/import-expert-bundles.mjs --from-file list.txt --copy <dir> --allow-b
 *
 * 选项：
 *   --slugs a,b,c        逗号分隔的 slug 列表
 *   --from-file <file>   每行一个 slug（# 开头与空行忽略）
 *   --copy <dir>         站外副本目录（必须含 .codebuddy-plugin/marketplace.json）
 *   --archive <dir>      存档目录；给了就保留 tar.gz（默认不保留）
 *   --report <file>      JSON 报告输出路径
 *   --catalog <file>     目录 JSON（默认取远端 expert_center.json）
 *   --allow-b            允许 B 档（缺头像或缺本地化字段但结构合法）入库
 *   --retry <n>          单个包下载失败的重试次数（默认 2）
 *   --dry-run            只下载与判定，不解包、不登记
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { gunzip, listEntries, extractEntries, readEntry } from "./lib/tar-lite.mjs";

const MARKET_BASE =
  "https://acc-1258344699.cos.accelerate.myqcloud.com/workbuddy/expert-marketplace";
const CATALOG_URL = `${MARKET_BASE}/expert_center.json`;
const TAG = "[import-expert-bundles]";

function parseArgs(argv) {
  const out = { slugs: [], fromFile: null, copy: null, archive: null, report: null, catalog: null, allowB: false, dryRun: false, retry: 2 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slugs") out.slugs = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--from-file") out.fromFile = argv[++i];
    else if (a === "--copy") out.copy = resolve(argv[++i] ?? "");
    else if (a === "--archive") out.archive = resolve(argv[++i] ?? "");
    else if (a === "--report") out.report = resolve(argv[++i] ?? "");
    else if (a === "--catalog") out.catalog = resolve(argv[++i] ?? "");
    else if (a === "--allow-b") out.allowB = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--retry") out.retry = Number(argv[++i] ?? 2);
    else throw new Error(`unknown argument: ${a}`);
  }
  if (out.fromFile) {
    const lines = readFileSync(resolve(out.fromFile), "utf8").split(/\r?\n/);
    for (const line of lines) {
      const s = line.trim();
      if (s && !s.startsWith("#")) out.slugs.push(s);
    }
  }
  out.slugs = [...new Set(out.slugs)];
  if (!out.slugs.length) throw new Error("no slugs given (--slugs or --from-file)");
  if (!out.copy) throw new Error("--copy <dir> is required");
  return out;
}

async function loadCatalog(path) {
  if (path) return JSON.parse(readFileSync(path, "utf8"));
  const res = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`catalog fetch failed: HTTP ${res.status}`);
  return res.json();
}

async function downloadBundle(slug, destDir, retry) {
  let lastErr;
  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const res = await fetch(`${MARKET_BASE}/bundles/${slug}.tar.gz`, { signal: AbortSignal.timeout(600000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const file = join(destDir, `${slug}.tar.gz`);
      writeFileSync(file, buf);
      return { file, bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex").slice(0, 16) };
    } catch (e) {
      lastErr = e;
      if (attempt < retry) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw new Error(`download failed: ${lastErr?.message}`);
}

const asArray = (v) => (Array.isArray(v) ? v : typeof v === "string" ? [v] : []);

/** 结构与字段判定：A 档 = 展示字段 + 头像 + README 齐全；B 档 = 结构合法但缺上述项。 */
function gradeBundle(tarBuf, entries) {
  const files = entries.filter((e) => e.type === "0" || e.type === "\0" || e.type === "7");
  const names = new Set(entries.map((e) => e.name));
  const covers = (rel) => {
    const want = rel.replace(/^\.\//, "").replace(/\/+$/, "");
    if (!want) return false;
    return names.has(want) || [...names].some((n) => n.startsWith(`${want}/`));
  };
  const pjBuf = readEntry(tarBuf, entries, "./.codebuddy-plugin/plugin.json");
  let pj = null;
  try {
    pj = JSON.parse(pjBuf?.toString("utf8") ?? "");
  } catch {
    return { grade: "X", reason: "plugin.json missing or invalid" };
  }
  if (pj.expertType !== "agent") return { grade: "X", reason: `expertType=${pj.expertType}` };

  const missing = [];
  for (const rel of asArray(pj.agents)) {
    if (!covers(rel)) missing.push(`agent:${rel}`);
  }
  for (const rel of asArray(pj.skills)) {
    if (!covers(rel)) missing.push(`skill:${rel}`);
  }
  const hasAvatar = [...names].some((n) => /avatars\/expert\.png$/.test(n));
  const hasReadme = [...names].some((n) => /README\.md$/.test(n));
  const hasZhFields = Boolean(pj.profession?.zh && pj.displayDescription?.zh && asArray(pj.tags).length > 0);
  const junk = [...names].filter((n) => /(\.DS_Store$|node_modules\/|\.git\/)/.test(n));
  for (const j of junk) missing.push(`junk:${j}`);

  if (missing.length) return { grade: "X", reason: `declared path missing -> ${missing.slice(0, 6).join(", ")}` };
  const grade = hasAvatar && hasReadme && hasZhFields ? "A" : "B";
  const bReason = [
    hasAvatar ? null : "no avatars/expert.png",
    hasReadme ? null : "no README.md",
    hasZhFields ? null : "no zh display fields",
  ].filter(Boolean).join(", ");
  return {
    grade,
    bReason,
    plugin: { name: pj.name, version: pj.version, expertType: pj.expertType, agentName: pj.agentName },
    files: files.length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalog = await loadCatalog(args.catalog);
  const bySlug = new Map(catalog.experts.map((e) => [e.plugin, e]));

  if (!existsSync(args.copy)) throw new Error(`--copy dir not found: ${args.copy}`);
  const manifestPath = join(args.copy, ".codebuddy-plugin", "marketplace.json");
  if (!existsSync(manifestPath)) throw new Error(`marketplace.json not found under --copy: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const registered = new Set(manifest.plugins.map((p) => p.name));

  const staging = join(args.copy, ".import-staging");
  mkdirSync(staging, { recursive: true });
  if (args.archive) mkdirSync(args.archive, { recursive: true });

  const report = [];
  console.log(`${TAG} slugs=${args.slugs.length} copy=${args.copy} dryRun=${args.dryRun} allowB=${args.allowB}`);

  for (const slug of args.slugs) {
    const entry = bySlug.get(slug);
    const row = { slug, status: "pending" };
    try {
      if (registered.has(slug)) {
        row.status = "skipped-already-registered";
        report.push(row);
        continue;
      }
      if (!entry) {
        row.status = "skipped-not-in-catalog";
        report.push(row);
        continue;
      }
      const dl = await downloadBundle(slug, staging, args.retry);
      row.bytes = dl.bytes;
      row.sha256 = dl.sha256;
      const tarBuf = gunzip(readFileSync(dl.file));
      const entries = listEntries(tarBuf);
      const g = gradeBundle(tarBuf, entries);
      row.grade = g.grade;
      row.detail = g.plugin ?? { reason: g.reason };
      row.files = g.files ?? entries.length;
      if (g.grade === "X") {
        row.status = "rejected";
        row.reason = g.reason;
      } else if (g.grade === "B" && !args.allowB) {
        row.status = "held-b-grade";
        row.reason = g.bReason;
      } else if (args.dryRun) {
        row.status = "dry-run-ok";
      } else {
        const dest = join(args.copy, "plugins", slug);
        const ex = extractEntries(tarBuf, entries, dest);
        row.extracted = { files: ex.files, skipped: ex.skipped.length };
        if (ex.errors.length) {
          rmSync(dest, { recursive: true, force: true });
          row.status = "error";
          row.reason = `extract: ${ex.errors.slice(0, 3).map((x) => `${x.name} (${x.reason})`).join("; ")}`;
        } else {
          const desc = entry.description?.en ?? entry.description?.zh ?? "";
          if (!registered.has(slug)) {
            manifest.plugins.push({ name: slug, source: `./plugins/${slug}`, description: desc });
            registered.add(slug);
          }
          row.status = "imported";
        }
      }
      if (args.archive) {
        const target = join(args.archive, `${slug}.tar.gz`);
        if (!existsSync(target)) writeFileSync(target, readFileSync(dl.file));
      }
      rmSync(dl.file, { force: true });
    } catch (e) {
      row.status = "error";
      row.reason = e.message;
    }
    report.push(row);
  }

  if (!args.dryRun) {
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  const counts = {};
  for (const r of report) counts[r.status] = (counts[r.status] ?? 0) + 1;
  console.log(`${TAG} summary: ${JSON.stringify(counts)}`);
  const totalBytes = report.reduce((a, r) => a + (r.bytes ?? 0), 0);
  console.log(`${TAG} downloaded=${(totalBytes / 1024 / 1024).toFixed(1)} MB  registered_total=${manifest.plugins.length}`);
  for (const r of report) {
    if (["imported", "held-b-grade", "rejected", "error"].includes(r.status)) {
      console.log(`${TAG}   ${r.status.padEnd(18)} ${r.slug.padEnd(38)} ${r.grade ?? "-"} ${(r.bytes ? (r.bytes / 1024).toFixed(0) + "KB" : "")} ${r.reason ?? ""}`);
    }
  }
  if (args.report) {
    writeFileSync(args.report, `${JSON.stringify({ at: new Date().toISOString(), copy: args.copy, report }, null, 2)}\n`);
    console.log(`${TAG} report -> ${args.report}`);
  }
  const bad = report.filter((r) => ["error", "rejected"].includes(r.status)).length;
  if (bad) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`${TAG} FAILED: ${e.message}`);
  process.exit(2);
});

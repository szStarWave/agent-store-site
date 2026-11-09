#!/usr/bin/env node
/**
 * 一次性维护脚本：把 workbuddy-market-collect（WMC）的**专家/连接器索引**写成站点的
 * `market-source/{experts,connectors}`，但不复制 `plugins/<slug>/`、`connectors/<slug>/` 载荷。
 *
 * 数据来源（默认读环境变量 WMC_DIR）：
 *   dist-market/experts/index.json   (403 条；display/description/tags/icon_url 均已本地化)
 *   dist-market/experts/icons/       (icon_url 引用 383 个)
 *   dist-market/connectors/index.json (476 条；display/description/examples/icon_url)
 *   dist-market/connectors/icons/    (icon_url 引用 460 个)
 *
 * 产物：
 *   market-source/experts/.codebuddy-plugin/marketplace.json    403 条，index_only: true
 *   market-source/experts/icons/<name>.<ext>                    383 个头像
 *   market-source/connectors/.codebuddy-connector/connectors.json 476 条，index_only: true
 *   market-source/connectors/icons/<member>.<ext>               460 个图标
 *
 * 刻意**不写**两棵载荷树：完整专家/连接器包已在 ModelScope 的 `wb-market/experts/`、
 * `wb-market/connectors/` 归档里。索引型市场在 `sync:tree` 里只告警缺载荷、在
 * `pack:market` 里会被跳过。
 *
 * 用法：
 *   node scripts/import-wmc-expert-connector-index.mjs
 *   node scripts/import-wmc-expert-connector-index.mjs --source-dir D:\\dist-market
 *
 * 写完后再跑：
 *   pnpm run sync:tree -- --listing-only
 *   pnpm run sync:market
 *   pnpm run check:market
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
const sourceRoot = path.join(siteRoot, "market-source");
const WMC = process.env.WMC_DIR
  || "C:\\Users\\15165\\Documents\\temp\\projects\\workbuddy-market-collect";

const readJson = async (p, fallback = null) => {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return fallback;
  }
};
const text = (v, fallback = "") => (typeof v === "string" && v.trim() ? v : fallback);
const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

function parseArgs(argv) {
  const out = { sourceDir: process.env.WMC_MARKET_DIR || path.join(WMC, "dist-market") };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--source-dir") out.sourceDir = path.resolve(argv[++i]);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

/** 把一个 icon_url 指向的源文件复制成 `icons/<stem><ext>`，返回是否有可复制的图标。 */
async function copyIcon(iconUrl, iconsSrcDir, iconsDstDir, stem) {
  const iconName = text(iconUrl).split("/").pop();
  if (!iconName) return false;
  const src = path.join(iconsSrcDir, iconName);
  if (!existsSync(src)) return false;
  const dst = path.join(iconsDstDir, `${stem}${path.extname(iconName).toLowerCase()}`);
  await copyFile(src, dst);
  return true;
}

async function doExperts() {
  const index = await readJson(path.join(args.sourceDir, "experts", "index.json"));
  if (!index || !Array.isArray(index.entries)) {
    console.error("[import-expert-connector-index] 找不到 experts/index.json");
    process.exit(1);
  }
  const base = path.join(sourceRoot, "experts");
  const manifestPath = path.join(base, ".codebuddy-plugin", "marketplace.json");
  const existing = (await readJson(manifestPath, {})) || {};
  const iconsSrcDir = path.join(args.sourceDir, "experts", "icons");
  const iconsDstDir = path.join(base, "icons");

  await rm(path.join(base, "plugins"), { recursive: true, force: true });
  await rm(iconsDstDir, { recursive: true, force: true });
  await mkdir(iconsDstDir, { recursive: true });

  const plugins = [];
  let icons = 0;
  for (const item of index.entries) {
    const name = text(item.name);
    if (!name) continue;
    const display = item.display || {};
    const description = item.description || {};
    const tagsZh = list(item.tags_zh);
    const tagsEn = list(item.tags_en);
    const tags = tagsZh.map((zh, i) => ({ zh, en: tagsEn[i] || "" }));
    for (const [i, en] of tagsEn.entries()) {
      if (!tags[i]) tags[i] = { zh: "", en };
    }
    plugins.push({
      name,
      source: `./plugins/${name}`,
      description: text(description.en, text(description.zh, name)),
      // 站点 sync-market-data 读插件清单里的这三个本地化字段；索引型市场把它们内联在清单里，
      // 这样就不需要每个专家都保留一份 plugin.json。
      profession: { zh: text(display.zh, name), en: text(display.en, text(display.zh, name)) },
      displayDescription: { zh: text(description.zh), en: text(description.en) },
      tags,
      category: { id: text(item.category_id), zh: text(item.category_zh), en: text(item.category_en) },
      version: text(item.version),
      kind: text(item.kind),
    });
    if (await copyIcon(item.icon_url, iconsSrcDir, iconsDstDir, name)) icons += 1;
  }

  const manifest = {
    ...existing,
    name: text(existing.name, "experts"),
    description: text(existing.description, "Expert marketplace (auto-generated)"),
    index_only: true,
    index_generated_at: text(index.generated_at),
    index_source_revision: text(index.source_revision),
    plugins,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[import-expert-connector-index] experts=${plugins.length} icons=${icons}`);
}

async function doConnectors() {
  const index = await readJson(path.join(args.sourceDir, "connectors", "index.json"));
  if (!index || !Array.isArray(index.entries)) {
    console.error("[import-expert-connector-index] 找不到 connectors/index.json");
    process.exit(1);
  }
  const base = path.join(sourceRoot, "connectors");
  const manifestPath = path.join(base, ".codebuddy-connector", "connectors.json");
  const existing = (await readJson(manifestPath, {})) || {};
  const iconsSrcDir = path.join(args.sourceDir, "connectors", "icons");
  const iconsDstDir = path.join(base, "icons");

  await rm(path.join(base, "connectors"), { recursive: true, force: true });
  await rm(iconsDstDir, { recursive: true, force: true });
  await mkdir(iconsDstDir, { recursive: true });

  const connectors = [];
  let icons = 0;
  for (const item of index.entries) {
    const id = text(item.member, text(item.name));
    if (!id) continue;
    const display = item.display || {};
    const description = item.description || {};
    connectors.push({
      id,
      name: text(display.zh, id),
      name_en: text(display.en, text(display.zh, id)),
      description: text(description.en, text(description.zh)),
      description_zh: text(description.zh),
      description_en: text(description.en),
      source: id,
      type: "mcp",
      auth_mode: text(item.auth_mode),
      examples_zh: list(item.examples_zh),
      examples_en: list(item.examples_en),
      tags_zh: list(item.tags_zh),
      tags_en: list(item.tags_en),
      visible_in: [],
    });
    if (await copyIcon(item.icon_url, iconsSrcDir, iconsDstDir, id)) icons += 1;
  }

  const manifest = {
    ...existing,
    name: text(existing.name, "codebuddy-connectors-official"),
    description: text(existing.description, "CodeBuddy 官方连接器配置索引"),
    owner: existing.owner || { name: "CodeBuddy", email: "codebuddy@tencent.com" },
    index_only: true,
    index_generated_at: text(index.generated_at),
    index_source_revision: text(index.source_revision),
    connectors,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[import-expert-connector-index] connectors=${connectors.length} icons=${icons}`);
}

await doExperts();
await doConnectors();
console.log("[import-expert-connector-index] done");

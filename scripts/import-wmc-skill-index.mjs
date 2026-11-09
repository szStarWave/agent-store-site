#!/usr/bin/env node
/**
 * 一次性维护脚本：把 workbuddy-market-collect（WMC）的**技能索引**写成站点的
 * `market-source/skills`，但不复制 `skills/<slug>/` 载荷。
 *
 * 数据来源（默认读环境变量 WMC_DIR）：
 *   .state/recommend-build/market/index.json   (1889 条，与 ModelScope `wb-market/skills/index.json` 同源)
 *   .state/recommend-build/market/icons/       (865 个图标，按条目 icon_url 匹配)
 *
 * 产物：
 *   market-source/skills/.codebuddy-skill/marketplace.json   清单（1889 条，index_only: true）
 *   market-source/skills/icons/<member>.webp|.svg            目录页头像（默认压到 128px WebP）
 *   market-source/skills/README.md                           索引型市场说明
 *
 * 刻意**不写** `market-source/skills/skills/`：这棵树只服务官网目录页与客户端索引，
 * 完整技能载荷在 ModelScope 的 `wb-market/skills/payload` 归档里。缺载荷是 `sync:tree`
 * 明确允许的 metadata-only 形态（只告警，不失败）。
 *
 * 用法：
 *   node scripts/import-wmc-skill-index.mjs
 *   node scripts/import-wmc-skill-index.mjs --icons copy    # 原图复制，不压缩（约 89MB）
 *   node scripts/import-wmc-skill-index.mjs --source-dir D:\\recommend-build
 *   node scripts/import-wmc-skill-index.mjs --python C:\\...\\python.exe
 *
 * 写完后再跑：
 *   pnpm run sync:tree -- --listing-only
 *   pnpm run sync:market
 *   pnpm run check:market
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
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

function parseArgs(argv) {
  const out = {
    sourceDir: process.env.WMC_RECOMMEND_DIR || path.join(WMC, ".state", "recommend-build"),
    icons: "optimize",
    maxSize: 128,
    python: process.env.PYTHON || "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--source-dir") out.sourceDir = path.resolve(argv[++i]);
    else if (arg === "--icons") out.icons = argv[++i];
    else if (arg === "--max-size") out.maxSize = Number(argv[++i]);
    else if (arg === "--python") out.python = argv[++i];
  }
  if (!["optimize", "copy"].includes(out.icons)) {
    throw new Error(`--icons 只支持 optimize / copy，收到 ${out.icons}`);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const indexPath = path.join(args.sourceDir, "market", "index.json");
const iconsSrc = path.join(args.sourceDir, "market", "icons");
const indexPathForDisplay = path.relative(siteRoot, indexPath);

const index = await readJson(indexPath);
if (!index || !Array.isArray(index.entries)) {
  console.error(`[import-skill-index] 找不到或无法解析索引：${indexPathForDisplay}`);
  process.exit(1);
}
if (index.schema_version !== 2 || index.market !== "skills") {
  console.error(
    `[import-skill-index] 索引不是技能市场 schema 2：schema=${index.schema_version} market=${index.market}`,
  );
  process.exit(1);
}

const target = path.join(sourceRoot, "skills");
const manifestPath = path.join(target, ".codebuddy-skill", "marketplace.json");
const existing = (await readJson(manifestPath, {})) || {};

const entries = [];
const iconMapping = [];
let missingIcons = 0;

for (const item of index.entries) {
  const member = text(item.member);
  if (!member) continue;

  entries.push({
    name: text(item.name, member),
    version: text(item.version),
    description: text(item.description?.en, text(item.description?.zh)),
    description_zh: text(item.description?.zh),
    description_en: text(item.description?.en),
    source: member,
    examples_zh: Array.isArray(item.examples_zh) ? item.examples_zh : [],
    examples_en: Array.isArray(item.examples_en) ? item.examples_en : [],
    tags_zh: Array.isArray(item.tags_zh) ? item.tags_zh : [],
    tags_en: Array.isArray(item.tags_en) ? item.tags_en : [],
  });

  const iconUrl = text(item.icon_url);
  if (!iconUrl) continue;
  const iconName = iconUrl.split("/").pop();
  const src = path.join(iconsSrc, iconName);
  if (!iconName || !existsSync(src)) {
    missingIcons += 1;
    continue;
  }
  const ext = path.extname(iconName).toLowerCase();
  const dst = ext === ".svg" ? `${member}.svg` : `${member}.webp`;
  iconMapping.push({ src, dst });
}

if (missingIcons) {
  console.warn(`[import-skill-index] ${missingIcons} 个 icon_url 在源里找不到，跳过`);
}

const manifest = {
  ...existing,
  name: text(existing.name, "codebuddy-skills-official"),
  description: text(existing.description, "CodeBuddy 官方技能市场"),
  owner: existing.owner || { name: "CodeBuddy", email: "codebuddy@tencent.com" },
  tags_zh: Array.isArray(existing.tags_zh) ? existing.tags_zh : [],
  tags_en: Array.isArray(existing.tags_en) ? existing.tags_en : [],
  // 显式标记：本市场只有索引，没有 `skills/<slug>/` 载荷。
  index_only: true,
  index_generated_at: text(index.generated_at),
  index_source_revision: text(index.source_revision),
  skills: entries,
};

await mkdir(path.dirname(manifestPath), { recursive: true });
await rm(path.join(target, "skills"), { recursive: true, force: true });
await rm(path.join(target, "icons"), { recursive: true, force: true });
await mkdir(path.join(target, "icons"), { recursive: true });

if (iconMapping.length) {
  if (args.icons === "copy") {
    for (const { src, dst } of iconMapping) {
      await copyFile(src, path.join(target, "icons", dst));
    }
    console.log(`[import-skill-index] copied ${iconMapping.length} icon(s)`);
  } else {
    if (!args.python) {
      console.error(
        "[import-skill-index] 压缩图标需要 Python + Pillow：传 --python <python.exe> 或设 PYTHON，\n" +
          "                      也可以用 --icons copy 直接复制原图。",
      );
      process.exit(1);
    }
    const mappingFile = path.join(os.tmpdir(), `wmc-skill-icons-${process.pid}.json`);
    await writeFile(mappingFile, JSON.stringify(iconMapping), "utf8");
    const helper = path.join(here, "optimize-skill-icons.py");
    const result = spawnSync(args.python, [helper, mappingFile, path.join(target, "icons"), String(args.maxSize)], {
      stdio: "inherit",
    });
    await rm(mappingFile, { force: true });
    if (result.error || result.status !== 0) {
      console.error(`[import-skill-index] 图标压缩失败：${result.error?.message ?? `exit ${result.status}`}`);
      process.exit(1);
    }
  }
}

const iconFiles = (await readdir(path.join(target, "icons"))).length;

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(
  path.join(target, "README.md"),
  [
    "# CodeBuddy 官方技能市场（索引镜像）",
    "",
    "本目录只保留官网目录页与客户端索引需要的 `.codebuddy-skill/marketplace.json` 和 `icons/`，",
    "**不包含** `skills/<slug>/` 载荷。1889 条技能索引来自 workbuddy-market-collect 的",
    "`recommend-build/market/index.json`（全部来自 `builtin-market`）；完整技能载荷在",
    "ModelScope 的 `wb-market/skills/index.json` 与 `payload/` 归档中。",
    "",
    "图标由 `scripts/import-wmc-skill-index.mjs` 按条目 `icon_url` 生成（默认最长边 128px WebP，",
    "SVG 原样保留）。没有图标的条目在目录页显示字母徽标。",
    "",
  ].join("\n"),
  "utf8",
);

console.log(
  `[import-skill-index] skills=${entries.length} icons=${iconFiles} no-icon=${entries.length - iconMapping.length} ` +
    `source=${path.relative(siteRoot, args.sourceDir) || "."}`,
);

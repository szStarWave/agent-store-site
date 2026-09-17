#!/usr/bin/env node
/**
 * 从随站点一起发布的市场树（`market-source/<market>/`）生成目录页渲染用的精简快照。
 *
 * 须在 `sync-market-tree.mjs` 之后运行（后者镜像工作树并产出 `_files.txt`）。这里全部是
 * 本地文件访问——不联网——所以快照与已发布的树完全一致，构建也能离线跑。
 *
 * 产物：`content/market.json`（提交入库），头像路径是站内相对路径
 * （`source/<market>/…`），因此同一份文件既服务目录页，也服务客户端镜像的市场源。
 *
 * 头像规则对齐商店后端（`crates/backend/nomifun-app/src/app_server_store.rs` 里的
 * `market_icon_for`）：技能/连接器用市场根目录下的 `icons/<源文件基名>.<ext>`；
 * 专家用插件自己的 `avatars/expert.png`。没有图标的条目得到 `avatar: null`，
 * UI 渲染字母徽标。
 *
 * 文案规则：技能/连接器在各自的清单里内联写出双语；专家只写在插件的
 * `.codebuddy-plugin/plugin.json` 里（`profession` / `displayDescription` / `tags`，
 * 每个键都按 locale 分键——注意市场清单只带一句英文简介）。读那个文件正是让专家卡片
 * 在 zh-CN 目录页上不再显示英文文案的原因。
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
const sourceRoot = path.join(siteRoot, "market-source");

const text = (v, fallback = "") => (typeof v === "string" && v.trim() ? v : fallback);
const strArray = (v, max = 5) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, max) : []);

/** 按序探测的图标扩展名（与商店后端同序）。 */
const ICON_EXTS = ["png", "svg", "jpg", "jpeg", "webp", "gif"];

const cleanSource = (s) => text(s).replace(/^\.\//, "");
const baseName = (s) => cleanSource(s).split("/").pop() ?? "";

async function readManifest(market, rel) {
  const file = path.join(sourceRoot, market, rel);
  if (!existsSync(file)) throw new Error(`missing manifest: market-source/${market}/${rel}`);
  return JSON.parse(await readFile(file, "utf8"));
}

/**
 * 返回第一个存在的候选者对应的站内相对路径
 * （`source/<market>/<candidate>`），条目未带图标时返回 null。
 */
function pickAvatar(market, candidates) {
  for (const suffix of candidates) {
    if (existsSync(path.join(sourceRoot, market, suffix))) return `source/${market}/${suffix}`;
  }
  return null;
}

/** 只有专家把自己的本地化文案放在插件清单里。 */
async function readExpertPlugin(src) {
  const file = path.join(sourceRoot, "experts", src, ".codebuddy-plugin", "plugin.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

/** 从 plugin.json 的 `{ zh, en }` 键对里取一个 locale，缺失时为 null。 */
const pickLocale = (value, lang) => {
  const out = typeof value?.[lang] === "string" ? value[lang].trim() : "";
  return out || null;
};

/** `tags: [{ zh, en }]` → 某一个 locale 的字符串数组。 */
const pickTagLocale = (tags, lang) =>
  Array.isArray(tags) ? tags.map((tag) => pickLocale(tag, lang)).filter(Boolean).slice(0, 5) : [];

const experts = await readManifest("experts", ".codebuddy-plugin/marketplace.json");
const skills = await readManifest("skills", ".codebuddy-skill/marketplace.json");
const connectors = await readManifest("connectors", ".codebuddy-connector/connectors.json");

const expertEntries = experts.plugins ?? [];
const skillEntries = skills.skills ?? [];
const connectorEntries = connectors.connectors ?? [];

const expertAvatars = expertEntries.map((e) => {
  // `source` 本就相对市场根目录，且已包含 `plugins/`。
  const src = cleanSource(e.source);
  return pickAvatar("experts", [
    `${src}/avatars/expert.png`,
    `${src}/avatars/avatar.png`,
    `${src}/avatar.png`,
    `${src}/icon.png`,
  ]);
});

/**
 * 本地化的专家文案。`profession`（专家的角色）是目录页标题，`displayDescription`
 * 是简介，`tags` 是标签行；市场清单只是那些早于 locale 字段的插件的单语言兜底。
 */
const expertCopy = await Promise.all(
  expertEntries.map(async (e) => {
    const plugin = await readExpertPlugin(cleanSource(e.source));
    const fallbackName = text(e.name);
    const fallbackDescription = text(e.description);
    const describe = (lang) => pickLocale(plugin?.displayDescription, lang) || fallbackDescription;
    return {
      name: pickLocale(plugin?.profession, "zh") || fallbackName,
      name_en: pickLocale(plugin?.profession, "en") || fallbackName,
      description_zh: describe("zh"),
      description_en: describe("en"),
      tags_zh: pickTagLocale(plugin?.tags, "zh"),
      tags_en: pickTagLocale(plugin?.tags, "en"),
    };
  }),
);

const skillAvatars = skillEntries.map((s) =>
  pickAvatar("skills", ICON_EXTS.map((ext) => `icons/${baseName(s.source)}.${ext}`)),
);
const connectorAvatars = connectorEntries.map((c) =>
  pickAvatar("connectors", ICON_EXTS.map((ext) => `icons/${baseName(c.source)}.${ext}`)),
);

const out = {
  updatedAt: new Date().toISOString(),
  // 市场树由本站自己托管，因此路径都是站内相对路径。
  base: "source",
  experts: expertEntries.map((_, i) => ({
    ...expertCopy[i],
    avatar: expertAvatars[i],
  })),
  skills: skillEntries.map((s, i) => ({
    name: text(s.name),
    version: text(s.version),
    source: text(s.source),
    description_zh: text(s.description_zh, text(s.description)),
    description_en: text(s.description_en, text(s.description)),
    tags_zh: strArray(s.tags_zh),
    tags_en: strArray(s.tags_en),
    avatar: skillAvatars[i],
  })),
  connectors: connectorEntries.map((c, i) => ({
    id: text(c.id, c.name),
    name: text(c.name, c.id),
    name_en: text(c.name_en),
    description_zh: text(c.description_zh, text(c.description)),
    description_en: text(c.description_en, text(c.description)),
    description: text(c.description),
    avatar: connectorAvatars[i],
  })),
};

await mkdir(path.join(siteRoot, "content"), { recursive: true });
const target = path.join(siteRoot, "content", "market.json");
await writeFile(target, JSON.stringify(out));
const hits =
  expertAvatars.filter(Boolean).length + skillAvatars.filter(Boolean).length + connectorAvatars.filter(Boolean).length;
console.log(
  `[sync-market-data] ${path.relative(siteRoot, target)}: experts=${out.experts.length} skills=${out.skills.length} ` +
    `connectors=${out.connectors.length} avatars=${hits}`,
);

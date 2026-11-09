#!/usr/bin/env node
/**
 * 一次性维护脚本：用 workbuddy-market-collect（WMC）的**选中集**重建本站
 * market-source/{experts,skills,connectors}，使官网目录页数量与 WMC 一致。
 *
 * 数据来源（WMC 目录，默认读环境变量 WMC_DIR）：
 *   dist-market/experts/index.json   (403)  + dist/experts/<name>/          (插件目录)
 *   dist/skills/_index.json          (578)  + dist/skills/<folder>/         (技能目录)
 *   dist/connectors/_index.json      (476)  + dist/connectors/<folder>/     (连接器目录)
 *   dist-market/{experts,skills,connectors}/icons/                          (图标)
 *   dist/upstream/workbuddy-connector-plugins-official/.codebuddy-connector/connectors.json
 *                                                                          (连接器富字段)
 *
 * 只重写生成物 market-source；写完后再跑：
 *   pnpm run sync:tree -- --listing-only
 *   pnpm run sync:market
 *   pnpm run check:market
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
const sourceRoot = path.join(siteRoot, "market-source");
const WMC = process.env.WMC_DIR
  || "C:\\Users\\15165\\Documents\\temp\\projects\\workbuddy-market-collect";

const readJson = async (p, fallback = null) => {
  try { return JSON.parse(await readFile(p, "utf8")); } catch { return fallback; }
};
const text = (v, fb = "") => (typeof v === "string" && v.trim() ? v : fb);

async function copyDir(src, dst) {
  await rm(dst, { recursive: true, force: true });
  await mkdir(path.dirname(dst), { recursive: true });
  await cp(src, dst, { recursive: true, force: true });
}

async function copyIcons(srcDir, dstDir) {
  await rm(dstDir, { recursive: true, force: true });
  await mkdir(dstDir, { recursive: true });
  if (!existsSync(srcDir)) return 0;
  let n = 0;
  for (const fn of await readdir(srcDir)) {
    const src = path.join(srcDir, fn);
    try {
      await cp(src, path.join(dstDir, fn));
      n += 1;
    } catch { /* ignore */ }
  }
  return n;
}

function frontmatter(md) {
  const m = /^---\s*\n([\s\S]*?)\n---/.exec(md || "");
  const block = m ? m[1] : "";
  const get = (key) => {
    const r = new RegExp(`^${key}\\s*:\\s*(.+)$`, "m").exec(block);
    return r ? r[1].trim().replace(/^["']|["']$/g, "") : "";
  };
  return { name: get("name"), description: get("description"), version: get("version") };
}

async function doExperts() {
  const idx = (await readJson(path.join(WMC, "dist-market/experts/index.json"), {}))?.entries || [];
  const base = path.join(sourceRoot, "experts");
  const manifestPath = path.join(base, ".codebuddy-plugin", "marketplace.json");
  const manifest = (await readJson(manifestPath, {})) || {};
  const pluginsDir = path.join(base, "plugins");
  await rm(pluginsDir, { recursive: true, force: true });
  await mkdir(pluginsDir, { recursive: true });
  const plugins = [];
  let copied = 0;
  for (const e of idx) {
    const name = text(e.name);
    const src = path.join(WMC, "dist/experts", name);
    if (!name || !existsSync(src)) continue;
    const dst = path.join(pluginsDir, name);
    await cp(src, dst, { recursive: true, force: true });
    // 专家图标：优先 plugin.json.avatar，其次 WMC 归一化图标；统一落成 avatars/expert.png
    const pj = (await readJson(path.join(src, ".codebuddy-plugin/plugin.json"), {})) || {};
    let av = text(pj.avatar) ? path.join(src, String(pj.avatar).replace(/^\/+/, "")) : "";
    if (!av || !existsSync(av)) {
      av = "";
      const iconsDir = path.join(WMC, "dist-market/experts/icons");
      if (existsSync(iconsDir)) {
        for (const fn of await readdir(iconsDir)) {
          if (fn.replace(/\.[^.]+$/, "").toLowerCase() === name.toLowerCase()) {
            av = path.join(iconsDir, fn);
            break;
          }
        }
      }
    }
    if (av && existsSync(av) && path.extname(av).toLowerCase() === ".png") {
      await mkdir(path.join(dst, "avatars"), { recursive: true });
      await cp(av, path.join(dst, "avatars", "expert.png"));
    }
    plugins.push({
      name,
      source: `./plugins/${name}`,
      description: text(e.description?.en, text(e.display?.en, name)),
    });
    copied += 1;
  }
  manifest.plugins = plugins;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`experts: ${copied}`);
}

async function doSkills() {
  const idx = (await readJson(path.join(WMC, "dist/skills/_index.json"), [])) || [];
  const base = path.join(sourceRoot, "skills");
  const manifestPath = path.join(base, ".codebuddy-skill", "marketplace.json");
  const manifest = (await readJson(manifestPath, {})) || {};
  const skillsDir = path.join(base, "skills");
  await rm(skillsDir, { recursive: true, force: true });
  await mkdir(skillsDir, { recursive: true });
  const iconCount = await copyIcons(path.join(WMC, "dist-market/skills/icons"), path.join(base, "icons"));
  const skills = [];
  const usedNames = new Set();
  let copied = 0;
  for (const s of idx) {
    const folder = text(s.folder);
    const src = path.join(WMC, "dist/skills", folder);
    if (!folder || !existsSync(src)) continue;
    await cp(src, path.join(skillsDir, folder), { recursive: true, force: true });
    const md = await readFile(path.join(src, "SKILL.md"), "utf8").catch(() => "");
    const fm = frontmatter(md);
    // 门禁要求清单 name 唯一：同名技能用目录名消歧
    let displayName = text(fm.name, text(s.skill, folder));
    if (usedNames.has(displayName.toLowerCase())) displayName = `${displayName} · ${folder}`;
    let n = 2;
    while (usedNames.has(displayName.toLowerCase())) {
      displayName = `${text(fm.name, text(s.skill, folder))} · ${folder} #${n++}`;
    }
    usedNames.add(displayName.toLowerCase());
    skills.push({
      name: displayName,
      version: text(fm.version),
      description: text(fm.description),
      description_zh: text(fm.description),
      description_en: text(fm.description),
      source: folder,
      examples_zh: [],
      examples_en: [],
      tags_zh: [],
      tags_en: [],
    });
    copied += 1;
  }
  manifest.skills = skills;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`skills: ${copied} (icons ${iconCount})`);
}

async function doConnectors() {
  const idx = (await readJson(path.join(WMC, "dist/connectors/_index.json"), [])) || [];
  const catalog = (await readJson(
    path.join(WMC, "dist/upstream/workbuddy-connector-plugins-official/.codebuddy-connector/connectors.json"), {},
  ))?.connectors || [];
  const byId = new Map();
  for (const r of catalog) {
    for (const k of [r.id, r.source, r.name]) if (k) byId.set(String(k).toLowerCase(), r);
  }
  const base = path.join(sourceRoot, "connectors");
  const manifestPath = path.join(base, ".codebuddy-connector", "connectors.json");
  const manifest = (await readJson(manifestPath, {})) || {};
  const connDir = path.join(base, "connectors");
  await rm(connDir, { recursive: true, force: true });
  await mkdir(connDir, { recursive: true });
  const iconCount = await copyIcons(path.join(WMC, "dist-market/connectors/icons"), path.join(base, "icons"));
  const connectors = [];
  let copied = 0;
  for (const c of idx) {
    const folder = text(c.folder);
    const src = path.join(WMC, "dist/connectors", folder);
    if (!folder || !existsSync(src)) continue;
    await cp(src, path.join(connDir, folder), { recursive: true, force: true });
    const row = byId.get(folder.toLowerCase()) || byId.get(String(c.connector).toLowerCase());
    connectors.push(row ? { ...row } : {
      id: folder, name: text(c.display_zh, folder), name_en: text(c.display_en),
      description: "", description_zh: "", description_en: "", source: folder,
      auth_mode: text(c.auth), type: "mcp", examples_zh: [], examples_en: [], visible_in: [],
    });
    copied += 1;
  }
  manifest.connectors = connectors;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`connectors: ${copied} (icons ${iconCount})`);
}

await doExperts();
await doSkills();
await doConnectors();
console.log("done");

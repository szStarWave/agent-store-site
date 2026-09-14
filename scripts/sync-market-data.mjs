#!/usr/bin/env node
/**
 * Build the slim market snapshot the catalog page renders, from the market
 * tree that ships with the site (`market-source/<market>/`).
 *
 * Run after `sync-market-tree.mjs` (which mirrors the working trees and emits
 * `_files.txt`). Everything here is local file access — no network — so the
 * snapshot matches the published tree exactly and builds work offline.
 *
 * Output: `content/market.json` (committed) with site-relative avatar paths
 * (`source/<market>/…`), so the same files serve both the catalog page and the
 * market source clients mirror.
 *
 * Avatar rules mirror the store backend (`market_icon_for` in
 * `crates/backend/nomifun-app/src/app_server_store.rs`):
 * skills/connectors use `icons/<source-basename>.<ext>` in the market root;
 * experts use the plugin's `avatars/expert.png`. Entries without an icon get
 * `avatar: null` and the UI renders a letter badge.
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

/** Icon extensions probed in order (same order as the store backend). */
const ICON_EXTS = ["png", "svg", "jpg", "jpeg", "webp", "gif"];

const cleanSource = (s) => text(s).replace(/^\.\//, "");
const baseName = (s) => cleanSource(s).split("/").pop() ?? "";

async function readManifest(market, rel) {
  const file = path.join(sourceRoot, market, rel);
  if (!existsSync(file)) throw new Error(`missing manifest: market-source/${market}/${rel}`);
  return JSON.parse(await readFile(file, "utf8"));
}

/**
 * Return the first existing candidate as a site-relative path
 * (`source/<market>/<candidate>`), or null when the entry ships no icon.
 */
function pickAvatar(market, candidates) {
  for (const suffix of candidates) {
    if (existsSync(path.join(sourceRoot, market, suffix))) return `source/${market}/${suffix}`;
  }
  return null;
}

const experts = await readManifest("experts", ".codebuddy-plugin/marketplace.json");
const skills = await readManifest("skills", ".codebuddy-skill/marketplace.json");
const connectors = await readManifest("connectors", ".codebuddy-connector/connectors.json");

const expertEntries = experts.plugins ?? [];
const skillEntries = skills.skills ?? [];
const connectorEntries = connectors.connectors ?? [];

const expertAvatars = expertEntries.map((e) => {
  // `source` is already market-root relative and includes `plugins/`.
  const src = cleanSource(e.source);
  return pickAvatar("experts", [
    `${src}/avatars/expert.png`,
    `${src}/avatars/avatar.png`,
    `${src}/avatar.png`,
    `${src}/icon.png`,
  ]);
});
const skillAvatars = skillEntries.map((s) =>
  pickAvatar("skills", ICON_EXTS.map((ext) => `icons/${baseName(s.source)}.${ext}`)),
);
const connectorAvatars = connectorEntries.map((c) =>
  pickAvatar("connectors", ICON_EXTS.map((ext) => `icons/${baseName(c.source)}.${ext}`)),
);

const out = {
  updatedAt: new Date().toISOString(),
  // The market tree is served from this site itself; paths are site-relative.
  base: "source",
  experts: expertEntries.map((e, i) => ({
    name: text(e.name),
    description: text(e.description),
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

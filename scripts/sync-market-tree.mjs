#!/usr/bin/env node
/**
 * Mirror the three local marketplace working trees into `market-source/` and
 * emit a static `_files.txt` listing per market.
 *
 * Why static listings: the App Server's `url` market fetcher detects
 * `{base}/{market}/_files.txt` and mirrors every listed file over HTTP, so a
 * market served by plain static hosting (EdgeOne Makers) needs the listing
 * pre-generated at publish time — there is no dynamic directory endpoint.
 *
 * Usage:
 *   bun run sync:tree                 # mirror + emit listings + validate
 *   bun run sync:tree -- --dry-run    # show the diff, change nothing
 *   bun run sync:tree -- --markets experts=D:\\exp skills=D:\\skl connectors=D:\\con
 *
 * Defaults: each market is read from the runtime's standard working directory
 * (see `DEFAULT_SOURCES` below). Override per market with the env vars
 * MARKET_SRC_EXPERTS / MARKET_SRC_SKILLS / MARKET_SRC_CONNECTORS, or per run
 * with `--markets`.
 *
 * Publish gate (fails the run, so a broken tree never reaches a deployment):
 *   - each market's discovery manifest exists and parses;
 *   - every manifest entry `source` is a relative path that resolves inside
 *     the tree (no absolute paths, no `..`, no backslashes);
 *   - the emitted listing covers every file in the tree (minus itself),
 *     one relative POSIX path per line, no blank/illegal entries.
 *
 * Warned, not failed — an entry whose declared `source` ships no payload in the
 * source tree (`grill-me`, `web-access`, … are listed upstream as metadata only).
 * The site mirrors whatever the upstream market actually contains; blocking the
 * whole publish on upstream metadata the site cannot fix would be worse.
 *
 * Excluded from the mirror (top-level only, so entry content is never
 * silently dropped): `logs/`, `dist/`, `market-icons/`, plus `.git/` and
 * `node_modules/` at any depth.
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
 * doc 18 §3 discovery order; the first hit identifies the market kind.
 *
 * `contentRoot` is the directory an entry's `source` is relative to. The plugin
 * market keeps `source: "./plugins/<name>"` at the market root, while the skill
 * and connector markets declare a bare slug (`source: "tencent-docs"`) that
 * lives under a same-named subdirectory — `.codebuddy-skill/marketplace.json`
 * plus `skills/<slug>/`, `.codebuddy-connector/connectors.json` plus
 * `connectors/<slug>/`.
 */
export const MANIFESTS = {
  experts: { rel: ".codebuddy-plugin/marketplace.json", entries: "plugins", contentRoot: "" },
  skills: { rel: ".codebuddy-skill/marketplace.json", entries: "skills", contentRoot: "skills" },
  connectors: { rel: ".codebuddy-connector/connectors.json", entries: "connectors", contentRoot: "connectors" },
};

export const LISTING = "_files.txt";
const TOP_EXCLUDES = new Set(["logs", "dist", "market-icons"]);
const DEEP_EXCLUDES = new Set([".git", "node_modules"]);

function parseArgs(argv) {
  const sources = { ...DEFAULT_SOURCES };
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--markets") {
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        const pair = argv[++i];
        const eq = pair.indexOf("=");
        if (eq > 0) sources[pair.slice(0, eq)] = path.resolve(pair.slice(eq + 1));
      }
    }
  }
  return { sources, dryRun };
}

const { sources, dryRun } = parseArgs(process.argv.slice(2));

/**
 * Recursively list files under `dir` as POSIX paths relative to it.
 *
 * Order is per-level `localeCompare` (the order the published listing uses).
 * Note it is ICU-backed, so CJK filenames can order differently between a
 * zh-CN workstation and a CI runner — expect a handful of reordered lines
 * when syncing from a machine with a different locale. Nothing consumes the
 * order, so it is not worth pinning.
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
      if (prefix === "" && entry.name === LISTING) continue;
      out.push(rel);
    }
  }
  return out;
}

const sha256 = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");

/** added / removed / changed file sets between the tree and its mirror. */
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

/** Delete files that no longer exist upstream, then prune empty directories. */
async function prune(destDir, removed) {
  for (const rel of removed) await rm(path.join(destDir, rel), { force: true });
  const dirs = [...new Set(removed.map((rel) => path.dirname(path.join(destDir, rel))))].sort((a, b) => b.length - a.length);
  for (const dir of dirs) {
    if (!dir.startsWith(destDir) || dir === destDir) continue;
    try {
      if ((await readdir(dir)).length === 0) await rm(dir, { recursive: true, force: true });
    } catch {
      // directory already gone
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
 * Publish gate: manifest shape + entry sources + listing/tree agreement.
 * Returns `{ findings, warnings }` — findings block the publish, warnings are
 * upstream gaps the mirror can only report (see the header note).
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
    if (source === undefined) continue; // source is optional (manifest-only entry)
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

  // The listing is the mirroring contract: it must cover the tree exactly.
  // Order is not part of the contract — it is emitted in `listFiles` order.
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

export async function main() {
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
    const files = await listFiles(d.destDir);
    await writeFile(path.join(d.destDir, LISTING), files.length ? `${files.join("\n")}\n` : "");
    console.log(`[sync-market-tree] wrote ${path.join(d.destDir, LISTING)} (${files.length} files)`);
  }

  const results = await Promise.all(diffs.map((d) => validate(d.name, d.destDir)));
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

// Exported for `check-market.mjs` (shared listing/manifest definitions). Only run
// the mirror when invoked as a CLI, so importing this file stays side-effect free.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();

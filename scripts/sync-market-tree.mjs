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
 * Defaults (override per market with MARKET_SRC_EXPERTS / _SKILLS / _CONNECTORS):
 *   experts    = ~/.workbuddy/plugins/marketplaces/experts
 *   skills     = ~/.workbuddy/skills-marketplace
 *   connectors = ~/.workbuddy/connectors-marketplace
 *
 * Publish gate (fails the run, so a broken tree never reaches a deployment):
 *   - each market's discovery manifest exists and parses;
 *   - every manifest entry `source` is a relative path that resolves inside
 *     the tree (no absolute paths, no `..`, no backslashes);
 *   - the emitted listing covers every file in the tree (minus itself),
 *     one relative POSIX path per line, sorted, no blank/illegal entries.
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
const sourceRoot = path.join(siteRoot, "market-source");

const home = homedir();
const DEFAULT_SOURCES = {
  experts: process.env["MARKET_SRC_EXPERTS"] ?? path.join(home, ".workbuddy", "plugins", "marketplaces", "experts"),
  skills: process.env["MARKET_SRC_SKILLS"] ?? path.join(home, ".workbuddy", "skills-marketplace"),
  connectors: process.env["MARKET_SRC_CONNECTORS"] ?? path.join(home, ".workbuddy", "connectors-marketplace"),
};

/** doc 18 §3 discovery order; the first hit identifies the market kind. */
const MANIFESTS = {
  experts: { rel: ".codebuddy-plugin/marketplace.json", entries: "plugins" },
  skills: { rel: ".codebuddy-skill/marketplace.json", entries: "skills" },
  connectors: { rel: ".codebuddy-connector/connectors.json", entries: "connectors" },
};

const LISTING = "_files.txt";
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

/** Recursively list files under `dir` as POSIX paths relative to it. */
async function listFiles(dir, prefix = "") {
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

/** Publish gate: manifest shape + entry sources + listing/tree agreement. */
async function validate(name, destDir) {
  const findings = [];
  const manifest = MANIFESTS[name];
  const manifestPath = path.join(destDir, manifest.rel);
  if (!existsSync(manifestPath)) {
    findings.push(`${name}: missing manifest ${manifest.rel}`);
    return findings;
  }
  let parsed;
  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    findings.push(`${name}: manifest is not valid JSON (${error.message})`);
    return findings;
  }
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
    const resolved = path.join(destDir, clean);
    if (!resolved.startsWith(destDir + path.sep) || !existsSync(resolved)) {
      findings.push(`${label}: source "${source}" does not resolve inside the market`);
    }
  }

  // The listing is the mirroring contract: it must cover the tree exactly.
  const listed = (await readFile(path.join(destDir, LISTING), "utf8")).split("\n").filter((line) => line !== "");
  const actual = await listFiles(destDir);
  const missing = actual.filter((rel) => !listed.includes(rel));
  const phantom = listed.filter((rel) => !actual.includes(rel));
  const unsorted = listed.some((rel, i) => i > 0 && listed[i - 1] > rel);
  if (missing.length) findings.push(`${name}: listing misses ${missing.length} file(s), e.g. ${missing[0]}`);
  if (phantom.length) findings.push(`${name}: listing references ${phantom.length} missing file(s), e.g. ${phantom[0]}`);
  if (unsorted) findings.push(`${name}: listing is not sorted`);
  if (listed.includes(LISTING)) findings.push(`${name}: listing must exclude itself`);
  for (const rel of listed) {
    if (rel.startsWith("/") || rel.includes("\\") || rel.split("/").includes("..")) {
      findings.push(`${name}: illegal path in listing: ${rel}`);
      break;
    }
  }
  return findings;
}

async function main() {
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

  const findings = (await Promise.all(diffs.map((d) => validate(d.name, d.destDir)))).flat();
  if (findings.length) {
    for (const finding of findings) console.error(`[sync-market-tree] ✗ ${finding}`);
    console.error(`[sync-market-tree] ${findings.length} problem(s) — tree is not publishable`);
    process.exit(1);
  }
  console.log("[sync-market-tree] validation passed — tree is publishable");
}

await main();

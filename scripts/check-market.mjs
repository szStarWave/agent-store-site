#!/usr/bin/env node
/**
 * Guard the two artifacts of one market sync against drift and duplication.
 *
 * A sync produces two things that must agree:
 *   market-source/<market>/   mirrored tree + `_files.txt` — what clients fetch
 *   content/market.json       slim snapshot — what the catalog page renders
 *
 * Nothing else cross-checks them: `sync:tree`'s publish gate only looks inside the
 * tree, and `sync:market` only reads the tree. So a half-finished sync — one
 * artifact committed without the other, a merge that kept only one side, a manifest
 * registering the same resource twice — passes both and ships. This is the check
 * that catches it before commit.
 *
 * What is checked, per market:
 *   1. manifest.duplicate       one entry registered twice
 *   2. snapshot.count           snapshot entry count vs its manifest
 *   3. snapshot.entry           snapshot identity set vs its manifest
 *   4. snapshot.avatar-missing  snapshot avatar path vs the mirrored tree
 *   5. listing.*                `_files.txt` vs the tree
 *
 * Duplicates get a rule of their own because neither the gate nor
 * `sync-market-data.mjs` deduplicates: a manifest listing one connector twice
 * renders two identical cards, and nothing else in the pipeline notices.
 *
 * The listing rules, exclusion sets and manifest paths are imported from
 * `sync-market-tree.mjs` rather than restated — that script produces the listing,
 * so its definition must not be copied here where it could drift.
 *
 *   node scripts/check-market.mjs
 *   node scripts/check-market.mjs --json
 *   bun test scripts/check-market.test.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LISTING, MANIFESTS, listFiles, sourceRoot } from "./sync-market-tree.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = path.resolve(here, "..", "content", "market.json");

/** `./plugins/x` → `plugins/x`; the manifests use both spellings. */
const normalizeSource = (value) => String(value ?? "").replace(/^\.\//, "").trim();

const text = (value) => (typeof value === "string" ? value.trim() : "");

/** `sync-market-data.mjs` resolves a connector's identity as `id || name`. */
const connectorId = (entry) => text(entry?.id) || text(entry?.name);

/**
 * Identities that must be unique per market, as `[label, reader]` pairs. A repeat
 * means the catalog renders the same resource more than once.
 */
const IDENTITY = {
  experts: [
    ["source", (entry) => normalizeSource(entry?.source)],
    ["name", (entry) => text(entry?.name)],
  ],
  skills: [
    ["source", (entry) => normalizeSource(entry?.source)],
    ["name", (entry) => text(entry?.name)],
  ],
  connectors: [
    ["id", connectorId],
    ["source", (entry) => normalizeSource(entry?.source)],
  ],
};

/**
 * How to read an entry's identity out of the snapshot, or null when the snapshot
 * stores nothing that traces back to the manifest — an expert's snapshot name comes
 * from the plugin's own `profession`, so only its entry count is checkable.
 */
const SNAPSHOT_IDENTITY = {
  experts: null,
  skills: (entry) => normalizeSource(entry?.source),
  connectors: (entry) => text(entry?.id),
};

const MANIFEST_IDENTITY = {
  experts: (entry) => normalizeSource(entry?.source),
  skills: (entry) => normalizeSource(entry?.source),
  connectors: connectorId,
};

const finding = (market, rule, message) => ({ market, level: "error", rule, message });

/** Count occurrences of every non-empty value. */
function countBy(values) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/** Repeated identities in one manifest's entry list. */
export function checkManifestDuplicates(market, entries) {
  const findings = [];
  for (const [label, read] of IDENTITY[market] ?? []) {
    const indexesByValue = new Map();
    entries.forEach((entry, index) => {
      const value = read(entry);
      if (!value) return;
      indexesByValue.set(value, [...(indexesByValue.get(value) ?? []), index]);
    });
    for (const [value, indexes] of indexesByValue) {
      if (indexes.length < 2) continue;
      findings.push(
        finding(
          market,
          "manifest.duplicate",
          `${market} manifest registers ${label} "${value}" ${indexes.length}× (entries[${indexes.join("], entries[")}])`,
        ),
      );
    }
  }
  return findings;
}

/**
 * Snapshot vs the manifest it was generated from.
 *
 * `fileExists` receives a path relative to the tree root (`sourceRoot`) and lets
 * the caller own filesystem access, so this stays testable.
 */
export function checkSnapshot(market, { manifestEntries, snapshotEntries, base, fileExists = () => true }) {
  const findings = [];

  if (manifestEntries.length !== snapshotEntries.length) {
    findings.push(
      finding(
        market,
        "snapshot.count",
        `${market}: manifest has ${manifestEntries.length} entr(ies), content/market.json has ${snapshotEntries.length} — re-run \`bun run sync:market\` and commit both paths`,
      ),
    );
  }

  const identity = SNAPSHOT_IDENTITY[market];
  if (identity) {
    const expected = countBy(manifestEntries.map(MANIFEST_IDENTITY[market]));
    const actual = countBy(snapshotEntries.map(identity));
    for (const [value, count] of expected) {
      const present = actual.get(value) ?? 0;
      if (present < count) {
        findings.push(
          finding(
            market,
            "snapshot.entry",
            `${market}: content/market.json is missing "${value}" (${present}/${count} present)`,
          ),
        );
      }
    }
    for (const [value, count] of actual) {
      const wanted = expected.get(value) ?? 0;
      if (count > wanted) {
        const detail = wanted === 0 ? "which the manifest does not list" : `${count - wanted}× too many`;
        findings.push(
          finding(market, "snapshot.entry", `${market}: content/market.json has "${value}" ${detail}`),
        );
      }
    }
  }

  // Avatar paths are `base`-relative; without a known base there is nothing to
  // resolve them against, so report that instead of firing on every entry.
  if (base !== "source") {
    findings.push(
      finding(
        market,
        "snapshot.base",
        `content/market.json base is "${base}", expected "source" — avatar paths cannot be resolved`,
      ),
    );
    return findings;
  }

  for (const [index, entry] of snapshotEntries.entries()) {
    const avatar = entry?.avatar;
    if (!avatar) continue;
    const rel = avatar.startsWith("source/") ? avatar.slice("source/".length) : avatar;
    if (fileExists(rel)) continue;
    const name = text(entry?.name) || text(entry?.id);
    findings.push(
      finding(
        market,
        "snapshot.avatar-missing",
        `${market}[${index}]${name ? ` (${name})` : ""} points at ${avatar}, which is not in the tree`,
      ),
    );
  }

  return findings;
}

/** `_files.txt` against the files actually present. */
export function compareListing(market, listed, actual) {
  const findings = [];
  const listedSet = new Set(listed);
  const actualSet = new Set(actual);

  const missing = actual.filter((rel) => !listedSet.has(rel));
  if (missing.length) {
    findings.push(
      finding(
        market,
        "listing.missing",
        `${market}: ${LISTING} misses ${missing.length} file(s), e.g. ${missing[0]}`,
      ),
    );
  }
  const phantom = listed.filter((rel) => !actualSet.has(rel));
  if (phantom.length) {
    findings.push(
      finding(
        market,
        "listing.phantom",
        `${market}: ${LISTING} references ${phantom.length} file(s) that are not in the tree, e.g. ${phantom[0]}`,
      ),
    );
  }
  if (listedSet.has(LISTING)) {
    findings.push(finding(market, "listing.self", `${market}: ${LISTING} lists itself`));
  }
  const duplicated = [...countBy(listed)].filter(([, count]) => count > 1).map(([rel]) => rel);
  if (duplicated.length) {
    findings.push(
      finding(market, "listing.duplicate", `${market}: ${LISTING} lists ${duplicated[0]} more than once`),
    );
  }
  const illegal = listed.find(
    (rel) => rel.startsWith("/") || rel.includes("\\") || rel.split("/").includes(".."),
  );
  if (illegal) {
    findings.push(finding(market, "listing.illegal", `${market}: illegal path in ${LISTING}: ${illegal}`));
  }

  return findings;
}

export function readSnapshot() {
  return JSON.parse(readFileSync(SNAPSHOT, "utf8"));
}

/** Run every rule for one market. */
export async function checkMarket(market, snapshot) {
  const destDir = path.join(sourceRoot, market);
  const manifest = MANIFESTS[market];
  const manifestPath = path.join(destDir, manifest.rel);

  if (!existsSync(manifestPath)) {
    return { market, findings: [finding(market, "manifest.missing", `${market}: missing ${manifest.rel}`)] };
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    return {
      market,
      findings: [finding(market, "manifest.invalid-json", `${market}: ${manifest.rel} is not valid JSON (${error.message})`)],
    };
  }

  const entries = Array.isArray(parsed[manifest.entries]) ? parsed[manifest.entries] : [];
  const listed = readFileSync(path.join(destDir, LISTING), "utf8").split("\n").filter((line) => line !== "");

  return {
    market,
    findings: [
      ...checkManifestDuplicates(market, entries),
      ...checkSnapshot(market, {
        manifestEntries: entries,
        snapshotEntries: snapshot[market] ?? [],
        base: snapshot.base,
        fileExists: (rel) => existsSync(path.join(sourceRoot, rel)),
      }),
      ...compareListing(market, listed, await listFiles(destDir)),
    ],
  };
}

export async function checkMarkets(snapshot = readSnapshot()) {
  return Promise.all(Object.keys(MANIFESTS).map((market) => checkMarket(market, snapshot)));
}

/** Same shape as `sync-market-data.mjs` prints, so the two lines can be diffed. */
const snapshotLine = (snapshot) => {
  const counts = Object.keys(MANIFESTS)
    .map((market) => `${market}=${(snapshot[market] ?? []).length}`)
    .join(" ");
  const avatars = Object.keys(MANIFESTS).reduce(
    (total, market) => total + (snapshot[market] ?? []).filter((entry) => entry?.avatar).length,
    0,
  );
  return `[check-market] content/market.json: ${counts} avatars=${avatars}`;
};

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("usage: node scripts/check-market.mjs [--json]");
    process.exit(0);
  }

  const snapshot = readSnapshot();
  const results = await checkMarkets(snapshot);
  const asJson = argv.includes("--json");
  let errors = 0;

  for (const result of results) {
    errors += result.findings.length;
    if (asJson) continue;
    console.log(`${result.findings.length === 0 ? "✓" : "✗"} ${result.market} — ${result.findings.length} finding(s)`);
    for (const entry of result.findings) {
      console.log(`    [${entry.level}] ${entry.rule}: ${entry.message}`);
    }
  }
  if (asJson) console.log(JSON.stringify(results, null, 2));

  console.log(`\n${results.length} market(s), ${errors} finding(s)`);
  console.log(snapshotLine(snapshot));
  process.exit(errors > 0 ? 1 : 0);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();

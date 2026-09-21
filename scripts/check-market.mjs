#!/usr/bin/env node
/**
 * 守住一次市场同步的两个产物，防漂移、防重复登记。
 *
 * 一次同步产出两样必须彼此一致的东西：
 *   market-source/<market>/   镜像树 + `_files.txt` —— 客户端抓取的
 *   content/market.json       精简快照 —— 目录页渲染的
 *
 * 没有别的东西会在它们之间交叉核对：`sync:tree` 的发布门禁只看树内部，
 * `sync:market` 只读树。于是半截同步——只提交了一个产物、合并时只留了一边、
 * 清单把同一个资源登记了两次——两道门禁都能过，然后就上线了。这个检查就是在提交前
 * 把它抓住的那一道。
 *
 * 逐市场检查的内容：
 *   1. manifest.duplicate       一个条目被登记两次
 *   2. snapshot.count           快照条目数 vs 其清单
 *   3. snapshot.entry           快照身份集合 vs 其清单
 *   4. snapshot.avatar-missing  快照头像路径 vs 镜像树
 *   5. listing.*                `_files.txt` vs 树
 *   6. listing.undeliverable    `_files.txt` vs git 实际会交付的东西
 *   7. ignore.market-tree       `.gitignore` vs 树里的载荷
 *
 * 重复登记单独成规则，因为门禁与 `sync-market-data.mjs` 都不去重：清单把一个连接器列
 * 两次，目录页就渲染两张一模一样的卡片，而流水线上没有别的东西会发现。
 *
 * 清单规则、排除集合与清单路径是从 `sync-market-tree.mjs` 导入的，而不是在这里重述——
 * 清单由那个脚本产出，它的定义不能抄到这里来漂移。
 *
 * 规则 6 与 7 要 fork git，所以它们只在 CLI 里跑，不进 `checkMarkets`：
 * 这样导出的函数仍是一个纯文件系统单元，测试文件能直接驱动。两者在 git 答不上来的地方
 * （没有 checkout）都会带说明地跳过，而不是默默通过。
 *
 *   node scripts/check-market.mjs
 *   node scripts/check-market.mjs --json
 *   bun test scripts/check-market.test.mjs
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LISTING, MANIFESTS, listFiles, sourceRoot } from "./sync-market-tree.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
const SNAPSHOT = path.resolve(siteRoot, "content", "market.json");

/** 某个市场树的仓库相对前缀——清单就是相对它写的。 */
const marketPrefix = (market) => `market-source/${market}`;

/** `./plugins/x` → `plugins/x`；清单里两种写法都有。 */
const normalizeSource = (value) => String(value ?? "").replace(/^\.\//, "").trim();

const text = (value) => (typeof value === "string" ? value.trim() : "");

/** `sync-market-data.mjs` 把连接器的身份解析为 `id || name`。 */
const connectorId = (entry) => text(entry?.id) || text(entry?.name);

/**
 * 每个市场内必须唯一的身份，写成 `[标签, 读取器]` 对。重复意味着
 * 目录页会把同一个资源渲染不止一次。
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
 * 如何从快照里读出条目的身份；当快照没存任何能追溯到清单的东西时为 null——
 * 专家快照名来自插件自己的 `profession`，所以只能查它的条目数。
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

/** 统计每个非空值出现的次数。 */
function countBy(values) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/** 某个清单的条目列表里重复出现的身份。 */
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
 * 快照 vs 生成它的清单。
 *
 * `fileExists` 接收相对树根（`sourceRoot`）的路径，由调用方掌握文件系统访问，
 * 这样本函数仍可测试。
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

  // 头像路径是相对 `base` 的；没有已知 base 就无从解析，
  // 因此报这一条，而不是对每个条目都开火。
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

/** `_files.txt` vs 实际存在的文件。 */
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

/**
 * `_files.txt` vs git 实际会交付的东西。
 *
 * 上面每条规则都是拿清单与文件系统比，而文件系统并不是一次 clone 收到的东西：
 * `git add` 会悄悄丢掉 `.gitignore` 命中的路径。清单宣传了这样的路径比文件缺失更糟——
 * App Server 会通过 HTTP 镜像清单里的每个路径，于是客户端拿到一个它无法解释的 404，
 * 而跑同步的机器永远发现不了（它磁盘上有这个文件）。一个没锚定的 `.codebuddy/`
 * 对 84 个专家载荷文件干的正是这件事。
 *
 * `undeliverable` 里是仓库相对路径，与 `undeliverablePaths` 的返回一致。
 */
export function compareDeliverable(market, listed, undeliverable) {
  const prefix = `${marketPrefix(market)}/`;
  const offending = listed.filter((rel) => undeliverable.has(`${prefix}${rel}`));
  if (!offending.length) return [];
  return [
    finding(
      market,
      "listing.undeliverable",
      `${market}: ${LISTING} lists ${offending.length} path(s) git will not deliver (ignored and untracked), e.g. ${offending[0]}`,
    ),
  ];
}

/** 规则 7：不允许任何 ignore 规则命中市场树内部的载荷路径。 */
export function compareIgnoreRules(market, probes, matched) {
  const caught = probes.filter((path) => matched.has(path));
  if (!caught.length) return [];
  const [first] = caught;
  const rel = first.slice(marketPrefix(market).length + 1);
  const more = caught.length > 1 ? ` (+${caught.length - 1} more)` : "";
  return [
    finding(
      market,
      "ignore.market-tree",
      `${market}: .gitignore catches payload inside the tree — probe ${rel} is ignored by ${matched.get(first)}${more}; a payload file of that name would be listed but never delivered`,
    ),
  ];
}

/**
 * `paths` 里会被 `git add` 拒绝的仓库相对路径：被某条 ignore 模式命中且未被跟踪。
 *
 * `git check-ignore` 按模式作答并跳过已跟踪路径，而这个区别正是关键——
 * 已跟踪路径不管有没有模式命中都会进 clone（技能市场就带着早于该规则的
 * `…/.codebuddy/` 文件）。索引内的路径先被过滤掉，因为该检查对每个传入路径
 * 约花 0.3 ms：在这个市场上不过滤的调用要 ~8 s。
 *
 * git 答不上来时返回 `null`，让调用方如实说明，而不是报「树很干净」。
 */
export function undeliverablePaths(paths) {
  const run = (args, input) => {
    const result = spawnSync("git", args, { cwd: siteRoot, encoding: "utf8", input, maxBuffer: 8 << 20 });
    // 无命中时 `check-ignore` 退出码为 1；高于 1 的都算致命。
    if (result.error || result.status === null || result.status > 1) return null;
    return result.stdout ?? "";
  };

  const indexed = run(["ls-files", "-z", "--", "market-source"]);
  if (indexed === null) return null;
  const tracked = new Set(indexed.split("\0"));
  const unchecked = paths.filter((rel) => !tracked.has(rel));
  if (!unchecked.length) return new Set();

  const ignored = run(["check-ignore", "--stdin"], `${unchecked.join("\n")}\n`);
  return ignored === null ? null : new Set(ignored.split("\n").filter((line) => line !== ""));
}

/**
 * 每类「可能过宽」的 ignore 规则各配一个探针：命中其中任何一个的规则，
 * 丢的是市场载荷，而不是在忽略本仓库自己的某个文件。
 *
 * 两侧刻意共用的那些名字是有意不列进来的——`node_modules/`、`.DS_Store`
 * 与 `Thumbs.db` 也被 `sync-market-tree.mjs` 排除，`.env` 则出于密钥卫生保持全局，
 * 所以清单永远不会宣传它们，探测它们只会添噪声。
 *
 * `git check-ignore` 没有「列出你的模式」这种模式，所以这是一个对代表性名字的
 * 冒烟测试，不是证明。它只花一次批量调用，因此可以每道门禁都跑。
 */
const PROBE_NAMES = [
  "build/out.js",
  "dist/out.js",
  "logs/run.md",
  "market-icons/a.svg",
  ".codebuddy/agents/a.md",
  ".docusaurus/x.ts",
  ".tef_dist/a.js",
  ".edgeone/a.json",
  ".cache/a.json",
  "tmp/a.txt",
  "coverage/lcov.info",
  "__pycache__/a.pyc",
  "dev.log",
  "server.err",
];

/**
 * 载荷真正所在的位置，让探针的深度与条目内容所在深度一致。
 * 在市场根探测反而会把覆盖那里 `logs/`、`dist/`、`market-icons/` 的规则标出来——
 * 那些是同步自己的顶层排除，它们与 git 一致，因此不是缺陷。
 */
const probeBase = (market) => `${marketPrefix(market)}/${MANIFESTS[market].contentRoot || "plugins"}/_probe`;

/** 每个路径背后的规则，形如 `<source>:<line>:<pattern>`；git 答不上来时是 `null`。 */
export function ignoreRuleMatches(paths) {
  const result = spawnSync("git", ["check-ignore", "--no-index", "-v", "--stdin"], {
    cwd: siteRoot,
    encoding: "utf8",
    input: paths.length ? `${paths.join("\n")}\n` : "",
    maxBuffer: 8 << 20,
  });
  // 无命中时 `check-ignore` 退出码为 1；高于 1 的都算致命。
  if (result.error || result.status === null || result.status > 1) return null;
  const matched = new Map();
  for (const line of (result.stdout ?? "").split("\n")) {
    const [rule, path] = line.split("\t");
    if (path) matched.set(path, rule);
  }
  return matched;
}

/** 给每个市场跑规则 7，产出可按市场合并的 `checkMarkets` 结果。 */
function ignoreRuleFindings(markets) {
  const probes = markets.map((market) => ({
    market,
    paths: PROBE_NAMES.map((name) => `${probeBase(market)}/${name}`),
  }));
  const matched = ignoreRuleMatches(probes.flatMap((probe) => probe.paths));
  if (matched === null) {
    console.error("[check-market] ! git cannot answer here — .gitignore was not checked against the market trees");
    return [];
  }
  return probes.flatMap(({ market, paths }) => compareIgnoreRules(market, paths, matched));
}

/** 给每个市场跑规则 6，产出可按市场合并的 `checkMarkets` 结果。 */
function deliverableFindings(markets) {
  const listed = new Map(
    markets.map((market) => [
      market,
      readFileSync(path.join(sourceRoot, market, LISTING), "utf8")
        .split("\n")
        .filter((line) => line !== ""),
    ]),
  );
  const paths = [...listed].flatMap(([market, rels]) => rels.map((rel) => `${marketPrefix(market)}/${rel}`));
  const undeliverable = undeliverablePaths(paths);
  if (undeliverable === null) {
    console.error(`[check-market] ! git cannot answer here — ${LISTING} was not checked against what git delivers`);
    return [];
  }
  return [...listed].flatMap(([market, rels]) => compareDeliverable(market, rels, undeliverable));
}

export function readSnapshot() {
  return JSON.parse(readFileSync(SNAPSHOT, "utf8"));
}

/** 跑某个市场的全部规则。 */
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

/** 与 `sync-market-data.mjs` 打印的形状相同，方便把两行对起来看。 */
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

  const markets = results.map((result) => result.market);
  for (const extra of [...deliverableFindings(markets), ...ignoreRuleFindings(markets)]) {
    results.find((result) => result.market === extra.market)?.findings.push(extra);
  }

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

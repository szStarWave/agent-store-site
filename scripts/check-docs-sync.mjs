#!/usr/bin/env node
/**
 * 守住本站双语文档的结构一致性，防止译文悄悄跑偏。
 *
 * `content/docs/{zh-CN,en-US}/` 是同样 9 个页面的两种语言。译文可以自由改措辞，
 * 但不能改*结构*：掉了一节、丢了一个代码示例、表格多了一列、相对链接只存在于一种
 * 语言里——这些都是读者会真撞上的缺陷。行数不是判据——它们今天碰巧接近，
 * 明天就会变成误报的门禁。
 *
 * 站点独立成仓时从 `nomifun-tauri` monorepo 挪到这里：被守护的页面在这里，
 * 守护脚本自然也在这里。
 *
 * 逐页比较的内容：
 *   1. 标题层级序列        （`#` / `##` / `###` …）
 *   2. 围栏代码块          （数量，然后是语言标记序列）
 *   3. 表格列数            （列宽序列）
 *   4. 相对链接目标        （`[..](path)` 目标集合，剥掉锚点）
 *
 * 每条发现都同时指向两侧：`zh-CN/<file>:<line> ↔ en-US/<file>:<line>`。
 *
 *   node scripts/check-docs-sync.mjs                 # 检查全部页面（有漂移则退出码 1）
 *   node scripts/check-docs-sync.mjs --doc cli.md    # 只查一页
 *   node scripts/check-docs-sync.mjs --json
 *   node scripts/check-docs-sync.mjs --self-test     # 检查器自身必须能拒绝漂移
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_DIR = path.join(ROOT, "content", "docs");
const LANGS = ["zh-CN", "en-US"];
const FENCE = /^\s*(`{3,}|~{3,})\s*([^\s`]*)/;
const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEP = /^\s*\|[\s:|-]*-[\s:|-]*\|\s*$/;
const LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

/** 非仓库相对路径的链接目标（外链、锚点、邮件）。 */
function isExternalTarget(target) {
  return /^(https?:|mailto:|tel:|#)/i.test(target);
}

/** 剥掉 `./`、反斜杠和 `#锚点`——只有文件身份有意义。 */
function normalizeTarget(target) {
  const withoutAnchor = target.split("#")[0];
  const slashed = withoutAnchor.replace(/\\/g, "/").replace(/^\.\//, "").trim();
  // 站点路由按设计带语言前缀：`/zh-CN/docs/cli` 与
  // `/en-US/docs/cli` 是同一个页面。因此语言段不携带任何
  // 结构信息，不能算作漂移。
  for (const lang of LANGS) {
    if (slashed.startsWith(`/${lang}/`)) return slashed.slice(lang.length + 1);
  }
  return slashed;
}

/** markdown 表格行里的单元格数，正确处理 `\|` 转义。 */
function countCells(line) {
  const cells = line.replace(/\\\|/g, "\u0000").split("|");
  if (cells.length > 0 && cells[0].trim() === "") cells.shift();
  if (cells.length > 0 && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.length;
}

/**
 * 单页的结构骨架。刻意对正文视而不见，因此译文可以随意重写，
 * 只要形状还在。
 */
export function scanDoc(text) {
  const lines = text.split(/\r?\n/);
  const headings = [];
  const codeBlocks = [];
  const tables = [];
  const links = [];
  let fence = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const fenceMatch = FENCE.exec(line);
    if (!fence && fenceMatch) {
      fence = fenceMatch[1][0];
      codeBlocks.push({ lang: fenceMatch[2] || "", line: i + 1 });
      continue;
    }
    if (fence) {
      if (new RegExp(`^\\s*\\${fence}{3,}\\s*$`).test(line)) fence = null;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) headings.push({ level: heading[1].length, line: i + 1 });

    if (TABLE_ROW.test(line) && TABLE_SEP.test(lines[i + 1] ?? "")) {
      tables.push({ cols: countCells(line), line: i + 1 });
      // 整张表一次消费掉，表体行不再重复匹配。
      i += 2;
      while (i + 1 < lines.length && TABLE_ROW.test(lines[i + 1])) i += 1;
      continue;
    }

    if (line.includes("](")) {
      for (const match of line.matchAll(LINK)) {
        const raw = match[1];
        if (isExternalTarget(raw)) continue;
        links.push({ target: normalizeTarget(raw), line: i + 1 });
      }
    }
  }

  return { headings, codeBlocks, tables, links };
}

function firstDifference(left, right) {
  const size = Math.max(left.length, right.length);
  for (let i = 0; i < size; i += 1) {
    if (left[i] !== right[i]) return i;
  }
  return -1;
}

function finding(rule, message, zhLine, enLine) {
  return { level: "error", rule, message, zhLine: zhLine ?? null, enLine: enLine ?? null };
}

/**
 * 比较两个骨架。`file` 是两语言共用的页面名，仅用于消息。
 */
export function compareSkeletons(zh, en, file = "page.md") {
  const findings = [];

  const headingDiff = firstDifference(
    zh.headings.map((heading) => heading.level),
    en.headings.map((heading) => heading.level),
  );
  if (headingDiff !== -1) {
    findings.push(
      finding(
        "heading.levels",
        `section shape differs at heading #${headingDiff + 1}: zh has ${zh.headings[headingDiff] ? `h${zh.headings[headingDiff].level}` : "nothing"}, en has ${en.headings[headingDiff] ? `h${en.headings[headingDiff].level}` : "nothing"}`,
        zh.headings[headingDiff]?.line,
        en.headings[headingDiff]?.line,
      ),
    );
  }

  if (zh.codeBlocks.length !== en.codeBlocks.length) {
    findings.push(
      finding(
        "code.count",
        `code samples differ: zh has ${zh.codeBlocks.length}, en has ${en.codeBlocks.length}`,
        zh.codeBlocks[Math.min(zh.codeBlocks.length, en.codeBlocks.length)]?.line,
        en.codeBlocks[Math.min(zh.codeBlocks.length, en.codeBlocks.length)]?.line,
      ),
    );
  } else {
    const langDiff = firstDifference(
      zh.codeBlocks.map((block) => block.lang),
      en.codeBlocks.map((block) => block.lang),
    );
    if (langDiff !== -1) {
      findings.push(
        finding(
          "code.lang",
          `code sample #${langDiff + 1} language differs: zh \`${zh.codeBlocks[langDiff].lang || "(none)"}\` vs en \`${en.codeBlocks[langDiff].lang || "(none)"}\``,
          zh.codeBlocks[langDiff].line,
          en.codeBlocks[langDiff].line,
        ),
      );
    }
  }

  const tableDiff = firstDifference(
    zh.tables.map((table) => table.cols),
    en.tables.map((table) => table.cols),
  );
  if (tableDiff !== -1) {
    findings.push(
      finding(
        "table.cols",
        `table #${tableDiff + 1} width differs: zh ${zh.tables[tableDiff]?.cols ?? "(missing)"} column(s), en ${en.tables[tableDiff]?.cols ?? "(missing)"} column(s)`,
        zh.tables[tableDiff]?.line,
        en.tables[tableDiff]?.line,
      ),
    );
  }

  const zhTargets = new Map(zh.links.map((link) => [link.target, link.line]));
  const enTargets = new Map(en.links.map((link) => [link.target, link.line]));
  for (const [target, line] of zhTargets) {
    if (!enTargets.has(target)) {
      findings.push(finding("link.targets", `link target only in zh: ${target}`, line, null));
    }
  }
  for (const [target, line] of enTargets) {
    if (!zhTargets.has(target)) {
      findings.push(finding("link.targets", `link target only in en: ${target}`, null, line));
    }
  }

  return findings.map((entry) => ({ ...entry, file }));
}

/** 任一侧出现的页面名，外加只在单侧缺失的那些。 */
function listPages(only) {
  const byLang = new Map();
  for (const lang of LANGS) {
    let names = [];
    try {
      names = readdirSync(path.join(DOCS_DIR, lang)).filter((name) => name.endsWith(".md"));
    } catch {
      names = [];
    }
    byLang.set(lang, new Set(names));
  }
  const all = new Set([...byLang.get("zh-CN"), ...byLang.get("en-US")]);
  const pages = [];
  for (const name of [...all].sort()) {
    if (only && name !== only) continue;
    const missing = LANGS.filter((lang) => !byLang.get(lang).has(name));
    pages.push({ name, missing });
  }
  return pages;
}

export function checkDocs(only) {
  const results = [];
  for (const page of listPages(only)) {
    if (page.missing.length > 0) {
      results.push({
        name: page.name,
        findings: [
          finding("doc.missing", `missing in ${page.missing.join(", ")}`, null, null),
        ],
      });
      continue;
    }
    const zh = scanDoc(readFileSync(path.join(DOCS_DIR, "zh-CN", page.name), "utf8"));
    const en = scanDoc(readFileSync(path.join(DOCS_DIR, "en-US", page.name), "utf8"));
    results.push({ name: page.name, findings: compareSkeletons(zh, en, page.name) });
  }
  return results;
}

// ── 自检：检查器必须能拒绝漂移，而不是照单全收 ──────────────────────────────

const FIXTURE = [
  "# Title",
  "",
  "## First",
  "",
  "```js",
  "code();",
  "```",
  "",
  "| a | b |",
  "| --- | --- |",
  "| 1 | 2 |",
  "",
  "See [other](./other.md).",
  "",
].join("\n");

export function selfTestCases() {
  const cases = [
    { name: "identical-skeleton", zh: FIXTURE, en: FIXTURE, expect: 0 },
    {
      name: "translated-prose-is-accepted",
      zh: FIXTURE,
      en: FIXTURE.replace("# Title", "# 标题").replace("## First", "## 第一节"),
      expect: 0,
    },
    {
      name: "invalid-heading-level-drift",
      zh: FIXTURE,
      en: FIXTURE.replace("## First", "### First"),
      expect: 1,
    },
    {
      name: "invalid-code-block-dropped",
      zh: FIXTURE,
      en: FIXTURE.replace("```js\ncode();\n```\n\n", ""),
      expect: 1,
    },
    {
      name: "invalid-code-language-drift",
      zh: FIXTURE,
      en: FIXTURE.replace("```js", "```bash"),
      expect: 1,
    },
    {
      name: "invalid-table-column-dropped",
      zh: FIXTURE,
      en: FIXTURE.replace("| a | b |", "| a |").replace("| --- | --- |", "| --- |").replace("| 1 | 2 |", "| 1 |"),
      expect: 1,
    },
    {
      name: "invalid-relative-link-only-in-one-language",
      zh: FIXTURE,
      en: FIXTURE.replace("[other](./other.md)", "[other](./elsewhere.md)"),
      expect: 1,
    },
    {
      name: "external-links-are-ignored",
      zh: FIXTURE,
      en: `${FIXTURE}\n[upstream](https://example.com/a) and [anchor](#first)\n`,
      expect: 0,
    },
    {
      name: "language-scoped-routes-are-equal",
      zh: FIXTURE.replace("[other](./other.md)", "[other](/zh-CN/docs/other)"),
      en: FIXTURE.replace("[other](./other.md)", "[other](/en-US/docs/other)"),
      expect: 0,
    },
  ];
  return { cases, invalidNames: cases.filter((entry) => entry.name.startsWith("invalid-")).map((entry) => entry.name) };
}

function runSelfTest() {
  const { cases, invalidNames } = selfTestCases();
  let failures = 0;
  for (const testCase of cases) {
    const findings = compareSkeletons(scanDoc(testCase.zh), scanDoc(testCase.en), testCase.name);
    const expectedToFail = testCase.name.startsWith("invalid-");
    const failed = findings.length > 0;
    if (failed === expectedToFail) {
      const detail = failed
        ? ` rejected — ${findings[0].rule}: ${findings[0].message}`
        : " accepted";
      console.log(`✓ ${testCase.name}:${detail}`);
    } else {
      failures += 1;
      console.log(`✗ ${testCase.name}: expected ${expectedToFail ? "rejection" : "acceptance"}, got ${JSON.stringify(findings)}`);
    }
  }
  console.log(`\nself-test: ${cases.length - failures}/${cases.length} as expected (${invalidNames.length} invalid samples must be rejected)`);
  return failures === 0;
}

// ── 命令行入口 ───────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("usage: node scripts/check-docs-sync.mjs [--doc <page.md>] [--json] | --self-test");
    process.exit(0);
  }
  if (argv.includes("--self-test")) process.exit(runSelfTest() ? 0 : 2);

  const docIndex = argv.indexOf("--doc");
  const only = docIndex === -1 ? undefined : argv[docIndex + 1];
  if (docIndex !== -1 && !only) {
    console.error("error: --doc needs a page name, e.g. --doc cli.md");
    process.exit(2);
  }

  const results = checkDocs(only);
  const asJson = argv.includes("--json");
  let errors = 0;
  for (const result of results) {
    errors += result.findings.length;
    if (asJson) continue;
    console.log(`${result.findings.length === 0 ? "✓" : "✗"} ${result.name} — ${result.findings.length} finding(s)`);
    for (const entry of result.findings) {
      const where =
        entry.zhLine || entry.enLine
          ? ` (zh-CN:${entry.zhLine ?? "—"} ↔ en-US:${entry.enLine ?? "—"})`
          : "";
      console.log(`    [${entry.level}] ${entry.rule}: ${entry.message}${where}`);
    }
  }
  if (asJson) console.log(JSON.stringify(results, null, 2));
  console.log(`\n${results.length} page(s) in ${LANGS.length} language(s), ${errors} drift(s)`);
  process.exit(errors > 0 ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

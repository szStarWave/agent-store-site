import type { Language } from "../i18n";

/**
 * Build-time Markdown loading for the Docs section.
 *
 * `import.meta.glob` with `eager` + `?raw` inlines every doc file into the
 * bundle, so the route `loader` (and therefore SSG) can read content without a
 * network request. Keys look like `../../content/docs/zh-CN/quick-start.md`.
 */
const rawDocs = import.meta.glob("../../content/docs/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const LOCALE_PREFIX = "../../content/docs/";

function keyFor(locale: Language, slug: string): string {
  return `${LOCALE_PREFIX}${locale}/${slug}.md`;
}

/** Slugs available for a locale (falls back to zh-CN if a locale is empty). */
export function docSlugs(locale: Language): string[] {
  const slugs = new Set<string>();
  for (const key of Object.keys(rawDocs)) {
    const m = key.match(new RegExp(`^${LOCALE_PREFIX}(${locale}|zh-CN)/(.+)\\.md$`));
    if (m) slugs.add(m[2]);
  }
  return [...slugs].sort();
}

function parseTitle(body: string): string {
  const line = body.split("\n").find((l) => l.startsWith("# "));
  return line ? line.replace(/^#\s+/, "").trim() : "";
}

export interface DocContent {
  title: string;
  body: string;
}

export function loadDoc(locale: Language, slug: string): DocContent | null {
  const direct = rawDocs[keyFor(locale, slug)];
  const body = direct ?? rawDocs[keyFor("zh-CN", slug)];
  if (body == null) return null;
  return { title: parseTitle(body) || slug, body };
}

/** One entry of a docs page's in-page table of contents. */
export interface DocHeading {
  level: 2 | 3;
  /** Heading text with inline markdown stripped — what the TOC should show. */
  text: string;
  /** Anchor id; `Docs.tsx` puts this exact id on the rendered heading. */
  id: string;
}

const FENCE = /^\s*(`{3,}|~{3,})\s*([^\s`]*)/;
const ATX_HEADING = /^(#{2,3})\s+(.+?)\s*$/;

/**
 * Inline markdown off: links keep their label, code and emphasis lose their
 * markers.
 *
 * **`_` is deliberately not stripped.** These docs name config keys inside code
 * spans (`connector_proxy`, `default_marketplaces`, `AGENT_STORE_TOOLS`), and a
 * blanket `[*_]{1,3}` strip turned them into `connectorproxy` /
 * `defaultmarketplaces` / `AGENTSTORETOOLS` — the TOC then said one thing while
 * the heading right below it said another. CommonMark does not read an intraword
 * `_` as emphasis either, so only `*` emphasis is removed; an underscore-emphasis
 * heading would need its paired form handled explicitly, and no page has one.
 */
function headingText(raw: string): string {
  return raw
    .replace(/\[([^\]]*)\]\([^)\s]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

/** Letters (CJK included) and digits survive, everything else becomes `-`. */
function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

/**
 * Level-2/3 headings in document order, for the in-page table of contents.
 *
 * Two properties matter:
 *
 * 1. **Fenced code is skipped**, with the rule `scripts/check-docs-sync.mjs`
 *    already uses. `examples-sdk.md` carries a shell comment
 *    (`# 运行时二进制：SDK 不下载…`) inside a fence; a naive line scan would
 *    list it as a section.
 * 2. **The order is load-bearing.** `Docs.tsx` assigns these ids to the
 *    rendered `h2` / `h3` elements by position, so this list *is* the page's
 *    anchor map — the headings the renderer sees must be exactly these, in this
 *    order.
 */
export function extractHeadings(body: string): DocHeading[] {
  const headings: DocHeading[] = [];
  const seen = new Map<string, number>();
  let fence: string | null = null;

  for (const line of body.split("\n")) {
    const fenceMatch = FENCE.exec(line);
    if (!fence && fenceMatch) {
      fence = fenceMatch[1][0];
      continue;
    }
    if (fence) {
      if (new RegExp(`^\\s*\\${fence}{3,}\\s*$`).test(line)) fence = null;
      continue;
    }

    const heading = ATX_HEADING.exec(line);
    if (!heading) continue;
    const text = headingText(heading[2]);
    if (!text) continue;
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    headings.push({
      level: heading[1].length as 2 | 3,
      text,
      id: count === 0 ? base : `${base}-${count + 1}`,
    });
  }

  return headings;
}

/** Stable ordering of docs for the sidebar, shared across locales. */
export const DOC_ORDER: { slug: string; sectionKey: keyof DocSections }[] = [
  { slug: "quick-start", sectionKey: "quickStart" },
  { slug: "cli", sectionKey: "cli" },
  { slug: "plugins-market", sectionKey: "pluginsMarket" },
  { slug: "typescript-sdk", sectionKey: "typescriptSdk" },
  { slug: "examples-sdk", sectionKey: "examplesSdk" },
  { slug: "upgrade", sectionKey: "upgrade" },
  { slug: "changelog", sectionKey: "changelog" },
  { slug: "configuration", sectionKey: "configuration" },
  { slug: "architecture", sectionKey: "architecture" },
  { slug: "compatibility", sectionKey: "compatibility" },
];

export interface DocSections {
  quickStart: string;
  cli: string;
  pluginsMarket: string;
  typescriptSdk: string;
  examplesSdk: string;
  upgrade: string;
  changelog: string;
  configuration: string;
  architecture: string;
  compatibility: string;
}
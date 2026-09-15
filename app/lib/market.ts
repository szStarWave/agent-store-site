import data from "../../content/market.json";

import type { Language } from "../i18n";

export interface MarketExpert {
  name: string;
  name_en: string;
  description_zh: string;
  description_en: string;
  tags_zh: string[];
  tags_en: string[];
  avatar: string | null;
}

export interface MarketSkill {
  name: string;
  version: string;
  source: string;
  description_zh: string;
  description_en: string;
  tags_zh: string[];
  tags_en: string[];
  avatar: string | null;
}

export interface MarketConnector {
  id: string;
  name: string;
  name_en: string;
  description_zh: string;
  description_en: string;
  description: string;
  avatar: string | null;
}

export interface MarketSnapshot {
  updatedAt: string;
  base: string;
  experts: MarketExpert[];
  skills: MarketSkill[];
  connectors: MarketConnector[];
}

export type MarketEntry = MarketExpert | MarketSkill | MarketConnector;

export type MarketTab = "experts" | "skills" | "connectors";

export const MARKET_TABS: MarketTab[] = ["experts", "skills", "connectors"];

export const market: MarketSnapshot = data as MarketSnapshot;

export const marketCounts: Record<MarketTab, number> = {
  experts: market.experts.length,
  skills: market.skills.length,
  connectors: market.connectors.length,
};

export const marketTotal = market.experts.length + market.skills.length + market.connectors.length;

/** Deterministic pastel hue for letter-badge fallbacks. */
export function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/** Site-absolute URL for a snapshot avatar path (respects the base path). */
export function avatarUrl(avatar: string): string {
  if (/^https?:\/\//i.test(avatar)) return avatar;
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/*$/, "/")}${avatar.replace(/^\/+/, "")}`;
}

/** Localized display name for an entry. */
export function entryName(entry: MarketEntry, lang: Language): string {
  if ("name_en" in entry && lang === "en-US" && entry.name_en) return entry.name_en;
  return entry.name;
}

/** Localized description for an entry (falls back to whichever locale exists). */
export function entryDescription(entry: MarketEntry, lang: Language): string {
  return lang === "en-US"
    ? entry.description_en || entry.description_zh
    : entry.description_zh || entry.description_en;
}

/** Localized tags: skills and experts carry them, connectors do not. */
export function entryTags(entry: MarketEntry, lang: Language): string[] {
  if (!("tags_zh" in entry)) return [];
  return (lang === "en-US" ? entry.tags_en : entry.tags_zh) ?? [];
}

/** Case-insensitive match over name + description + tags. */
export function entryMatches(entry: MarketEntry, lang: Language, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [entryName(entry, lang), entryDescription(entry, lang), ...entryTags(entry, lang)]
    .join("\n")
    .toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}

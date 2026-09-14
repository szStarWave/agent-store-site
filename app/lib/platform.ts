import release from "../../content/release.json";

import type { Language } from "../i18n";

export type TargetOS = "macos" | "windows" | "linux";
export type TargetArch = "aarch64" | "x86_64";

export interface DetectedPlatform {
  os: TargetOS;
  arch: TargetArch;
}

/**
 * Published preview version — single source: `content/release.json`, kept in
 * sync with the npm packages (`@flowy-agent-store/{protocol,sdk,runtime-*}`).
 * Bump it once per release; `scripts/release.mjs` reads the same file.
 */
export const RELEASE_VERSION: string = release.version;

/** Repository that hosts the release assets (this site's own repo). */
const RELEASE_REPO = release.repo;

/** Git tag of the published release (GitHub release URLs carry the explicit tag). */
const RELEASE_TAG = `v${RELEASE_VERSION}`;

/** Source repository (code only — downloads live in the releases above). */
const GITHUB_REPO = "Michael-Lfx/allo";

/** Asset file name convention produced by `scripts/release.mjs`. */
function assetName(version: string, p: DetectedPlatform): string {
  return `flowy-agent-store-v${version}-${p.os}-${p.arch}.zip`;
}

export function detectPlatform(): DetectedPlatform {
  if (typeof window === "undefined") return { os: "macos", arch: "aarch64" };

  const nav = window.navigator;
  const ua = (nav.userAgent || "").toLowerCase();
  const uaData = (nav as unknown as {
    userAgentData?: { platform?: string; architecture?: string };
  }).userAgentData;
  // `navigator.platform` is the most reliable signal inside embedded webviews
  // (IDE previews, Tauri, etc.) where the User-Agent string is often stripped
  // of OS tokens. Fall back to Client Hints, then the raw UA.
  const platformHint = (
    (nav as unknown as { platform?: string }).platform ||
    uaData?.platform ||
    ""
  ).toLowerCase();

  let os: TargetOS = "linux";
  if (/mac|iphone|ipad|ipod/.test(platformHint) || /mac os x|macintosh/.test(ua))
    os = "macos";
  else if (/win/.test(platformHint) || /windows nt/.test(ua)) os = "windows";

  let arch: TargetArch = "x86_64";
  if (uaData?.architecture) {
    // Client Hints expose the real CPU arch (e.g. "arm" on Apple Silicon).
    arch = /arm/.test(uaData.architecture) ? "aarch64" : "x86_64";
  } else if (/aarch64|arm64|\(arm;|arm;|\(arm\)/.test(ua) || /arm/.test(platformHint)) {
    arch = "aarch64";
  }
  return { os, arch };
}

/** Direct download URL for a platform's asset.
 *
 * Releases are published as **prereleases** (preview builds), and GitHub only
 * resolves `/releases/latest/download/<asset>` for the latest published
 * *non-prerelease* release — so the URL is pinned to the explicit tag instead.
 */
export function releaseAssetUrl(p: DetectedPlatform): string {
  const file = assetName(RELEASE_VERSION, p);
  return `https://github.com/${RELEASE_REPO}/releases/download/${RELEASE_TAG}/${file}`;
}

/**
 * Platforms with a published build artifact. The download host currently serves
 * Windows x64 only, so everything else must be pointed at the downloads page
 * instead of a direct asset URL (which would 404). Add targets here only once
 * their builds are actually published.
 */
export const RELEASED_PLATFORMS: readonly DetectedPlatform[] = [{ os: "windows", arch: "x86_64" }];

/** Whether a detected platform has a downloadable artifact right now. */
export function isReleasedPlatform(p: DetectedPlatform): boolean {
  return RELEASED_PLATFORMS.some((r) => r.os === p.os && r.arch === p.arch);
}

/** Release page: every published build, previews included. */
export function releasesPageUrl(): string {
  return `https://github.com/${RELEASE_REPO}/releases`;
}

export function githubUrl(): string {
  return `https://github.com/${GITHUB_REPO}`;
}

/** URL of the PowerShell install script (base-path aware, works under GitHub Pages subpaths). */
export function installScriptUrl(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base}${base.endsWith("/") ? "" : "/"}install.ps1`;
}

export const PLATFORM_LABELS: Record<TargetOS, Record<Language, string>> = {
  macos: { "zh-CN": "macOS", "en-US": "macOS" },
  windows: { "zh-CN": "Windows", "en-US": "Windows" },
  linux: { "zh-CN": "Linux", "en-US": "Linux" },
};

export const ARCH_LABELS: Record<TargetArch, Record<Language, string>> = {
  aarch64: { "zh-CN": "Apple 芯片", "en-US": "Apple silicon" },
  x86_64: { "zh-CN": "Intel / x64", "en-US": "Intel / x64" },
};

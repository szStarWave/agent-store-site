import siteConfig from "@generated/docusaurus.config";

import release from "../../content/release.json";
import type { Language } from "./locale-constants";

export type TargetOS = "macos" | "windows" | "linux";
export type TargetArch = "aarch64" | "x86_64";

export interface DetectedPlatform {
  os: TargetOS;
  arch: TargetArch;
}

/**
 * 已发布的预览版本号 —— 单一真源是 `content/release.json`，与 npm 包
 * （`@flowy-agent-store/{protocol,sdk,runtime-*}`）保持一致。
 * 每次发版改这一处；`scripts/release.mjs` 读同一个文件。
 */
export const RELEASE_VERSION: string = release.version;

/** 存放发布产物的仓库（本站自己的仓库）。 */
const RELEASE_REPO = release.repo;

/** 已发布版本的 git tag（GitHub 的发布地址带明确的 tag）。 */
const RELEASE_TAG = `v${RELEASE_VERSION}`;

/** 源仓库（只有代码——产物由上面的 Releases 分发）。 */
const GITHUB_REPO = "Michael-Lfx/allo";

/** `scripts/release.mjs` 产出的资产命名约定。 */
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
  // `navigator.platform` 是内嵌 webview（IDE 预览、Tauri 等）里最可靠的信号：那些环境的
  // User-Agent 常被抹掉 OS 标记。依次回退到 Client Hints，再到原始 UA。
  const platformHint = (
    (nav as unknown as { platform?: string }).platform ||
    uaData?.platform ||
    ""
  ).toLowerCase();

  let os: TargetOS = "linux";
  if (/mac|iphone|ipad|ipod/.test(platformHint) || /mac os x|macintosh/.test(ua)) os = "macos";
  else if (/win/.test(platformHint) || /windows nt/.test(ua)) os = "windows";

  let arch: TargetArch = "x86_64";
  if (uaData?.architecture) {
    // Client Hints 给出真实 CPU 架构（Apple 芯片上是 "arm"）。
    arch = /arm/.test(uaData.architecture) ? "aarch64" : "x86_64";
  } else if (/aarch64|arm64|\(arm;|arm;|\(arm\)/.test(ua) || /arm/.test(platformHint)) {
    arch = "aarch64";
  }
  return { os, arch };
}

/**
 * 某平台资产的直接下载地址。
 *
 * 发布物一律标为 **prerelease**（预览版），而 GitHub 只对「最新的非预发布版本」解析
 * `/releases/latest/download/<asset>`，所以这里把 URL 钉在明确的 tag 上。
 */
export function releaseAssetUrl(p: DetectedPlatform): string {
  const file = assetName(RELEASE_VERSION, p);
  return `https://github.com/${RELEASE_REPO}/releases/download/${RELEASE_TAG}/${file}`;
}

/**
 * 已有构建产物的平台。Releases 目前只发 Windows x64，其余平台必须指向发布页
 * 而不是直接资产地址（后者会 404）。只有产物真的发布之后才往这里加。
 */
export const RELEASED_PLATFORMS: readonly DetectedPlatform[] = [{ os: "windows", arch: "x86_64" }];

/** 探测到的平台当前是否有可下载的产物。 */
export function isReleasedPlatform(p: DetectedPlatform): boolean {
  return RELEASED_PLATFORMS.some((r) => r.os === p.os && r.arch === p.arch);
}

/** 发布页：包含全部已发布构建（含预览版）。 */
export function releasesPageUrl(): string {
  return `https://github.com/${RELEASE_REPO}/releases`;
}

/**
 * 本站的规范外网源。
 *
 * 用在「复制到别处之后仍需有效」的地方。交给 Agent 的提示词可能很久以后才在另一台机器上执行，
 * 因此不能带上页面当时所在的源：那可能是本地 dev server，或带签名 `eo_token`、会过期的
 * EdgeOne 预览域名。下载区那一行命令可以保持相对源，因为它是在访客正看着可用页面时粘贴的。
 */
export const SITE_ORIGIN = "https://agent-store.flowyaipc.cn";

export function githubUrl(): string {
  return `https://github.com/${GITHUB_REPO}`;
}

/** 当前站点的 base 路径（`/` 或 `/<repo>/`），取自 Docusaurus 的 baseUrl。 */
function siteBase(): string {
  const base = siteConfig.baseUrl || "/";
  return base.endsWith("/") ? base : `${base}/`;
}

/** `static/` 下静态文件的站内地址（自动带上 base 路径，子路径部署可用）。 */
export function staticAssetUrl(file: string): string {
  return `${siteBase()}${file.replace(/^\/+/, "")}`;
}

/** PowerShell 安装脚本的地址。 */
export function installScriptUrl(): string {
  return staticAssetUrl("install.ps1");
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

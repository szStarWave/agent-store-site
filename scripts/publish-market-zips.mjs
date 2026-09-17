#!/usr/bin/env node
/**
 * 把 `dist-market/` 里的市场归档上传到 ModelScope，并用 `HEAD` **回验远端摘要**。
 *
 * 前提：
 *   - 先跑 `bun run pack:market`（本脚本只上传已打好、且与 `content/market-hosts.json`
 *     摘要一致的东西——绝不上传一个「和记录不符」的归档）；
 *   - `MODELSCOPE_API_TOKEN` 在环境里（ModelScope 的访问令牌）。**令牌只从环境读，
 *     绝不写进仓库、不作为命令行参数**（argv 在进程列表里是公开的）；
 *   - `ms`（`pip install modelscope`）在 PATH 上。上传走官方 CLI 而不是自己拼 LFS
 *     批量接口：那条路能用但没文档，CLI 是上游承诺维护的那条。
 *
 * 回验为什么是必须的：客户端的「是否要重新下载」靠稳定 URL 上的
 * `X-Linked-Etag`——它就是归档内容的 **sha256**（已实测比对过）。上传成功后这个头
 * 必须等于本地摘要，否则客户端要么永远判定「没变」（拿不到新市场），要么每次刷新
 * 都重下 289 MiB。所以这里把它当作上传的**验收条件**，而不是「顺便看一眼」。
 *
 * 用法：
 *   bun run publish:market                 # 上传三个市场并回验
 *   bun run publish:market -- --only experts
 *   bun run publish:market -- --verify-only  # 只回验（不依赖 ms / 令牌）
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
const outRoot = path.join(siteRoot, "dist-market");
const hostsFile = path.join(siteRoot, "content", "market-hosts.json");
const REPO_ID = "me9rez/flowy-marketplace";

/** 回验的重试次数与间隔：CDN 生效不是瞬时的。 */
const VERIFY_ATTEMPTS = 6;
const VERIFY_DELAY_MS = 5000;

async function sha256File(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 读稳定 URL 的 `X-Linked-Etag`（内容 sha256），不带正文。 */
async function remoteDigest(url) {
  const response = await fetch(url, { method: "HEAD", redirect: "follow" });
  if (!response.ok) return { error: `HTTP ${response.status}` };
  const raw = response.headers.get("x-linked-etag");
  if (!raw) return { error: "响应没有 X-Linked-Etag（该宿主不报告内容摘要）" };
  const value = raw.trim().replace(/^"|"$/g, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(value)) return { error: `X-Linked-Etag 不是 sha256：${raw}` };
  return { digest: value };
}

async function verify(market, expected) {
  const url = expected.url;
  let last = "未尝试";
  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
    const { digest, error } = await remoteDigest(url);
    if (digest === expected.sha256) return { ok: true, attempts: attempt };
    last = error ?? `远端 ${digest?.slice(0, 12)}… ≠ 本地 ${expected.sha256.slice(0, 12)}…`;
    if (attempt < VERIFY_ATTEMPTS) await sleep(VERIFY_DELAY_MS);
  }
  return { ok: false, reason: last };
}

function parseArgs(argv) {
  const out = { only: null, verifyOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") out.only = argv[++i];
    else if (argv[i] === "--verify-only") out.verifyOnly = true;
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("usage: node scripts/publish-market-zips.mjs [--only <market>] [--verify-only]");
    process.exit(0);
  }
  const args = parseArgs(argv);

  if (!existsSync(hostsFile)) {
    console.error("[publish-market] 缺少 content/market-hosts.json —— 先跑 `bun run pack:market`");
    process.exit(1);
  }
  const hosts = JSON.parse(readFileSync(hostsFile, "utf8"));
  const markets = args.only ? [args.only] : Object.keys(hosts.markets);

  if (!args.verifyOnly && !process.env.MODELSCOPE_API_TOKEN) {
    console.error(
      "[publish-market] 环境里没有 MODELSCOPE_API_TOKEN。\n" +
        "  令牌从 https://www.modelscope.cn/my/myaccesstoken 取，只放在环境变量里。",
    );
    process.exit(1);
  }

  let failed = false;
  for (const market of markets) {
    const expected = hosts.markets[market];
    if (!expected) {
      console.error(`[publish-market] market-hosts.json 里没有 ${market}`);
      failed = true;
      continue;
    }
    const zipPath = path.join(outRoot, `${market}.zip`);
    if (!existsSync(zipPath)) {
      console.error(`[publish-market] ${market}: 缺少 ${path.relative(siteRoot, zipPath)}`);
      failed = true;
      continue;
    }

    // 上传前先比对本地摘要与记录：记录是给客户端当 revision 用的，上传一个
    // 与记录不符的归档等于把一个错的 revision 发出去。
    const local = await sha256File(zipPath);
    if (local !== expected.sha256) {
      console.error(
        `[publish-market] ${market}: 本地归档与 market-hosts.json 不符（${local.slice(0, 12)}… ≠ ` +
          `${expected.sha256.slice(0, 12)}…）—— 重新跑 \`bun run pack:market\``,
      );
      failed = true;
      continue;
    }

    if (!args.verifyOnly) {
      console.log(`[publish-market] ${market}: 上传 ${path.basename(zipPath)} …`);
      const upload = spawnSync(
        process.platform === "win32" ? "ms.exe" : "ms",
        ["upload", REPO_ID, zipPath, "--repo-type", "model", "--commit-message", `Publish ${market} market`],
        { stdio: "inherit" },
      );
      if (upload.error) {
        console.error(
          `[publish-market] 无法运行 \`ms\`：${upload.error.message}\n` +
            "  安装：pip install modelscope（然后把 ms 放进 PATH）",
        );
        process.exit(1);
      }
      if (upload.status !== 0) {
        console.error(`[publish-market] ${market}: ms upload 退出码 ${upload.status}`);
        failed = true;
        continue;
      }
    }

    const result = await verify(market, expected);
    if (result.ok) {
      console.log(`[publish-market] ${market}: ✓ 远端摘要与本地一致（第 ${result.attempts} 次探测）`);
    } else {
      console.error(`[publish-market] ${market}: ✗ 回验失败 —— ${result.reason}`);
      failed = true;
    }
  }

  if (failed) process.exit(1);
  console.log("[publish-market] 全部市场已上传并通过摘要回验");
}

await main();

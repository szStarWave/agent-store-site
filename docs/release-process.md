# 发布流程（本站仓这一半）

> 最后核对：2026-09-16
> **权威清单在源仓库**：`Michael-Lfx/allo` 的 `docs/agent-store/25-release-runbook.zh.md`（npm 四包 + 本站 GitHub Release + 站点上线，含不变量与失败回退）。本文只写**本站独有的动作与判据**，不复制那份清单；两份文档冲突时以源仓库那份为准。

## 本站仓在发布里的四个角色

| 角色 | 落点 | 发布时必须一致的东西 |
|---|---|---|
| 官网（落地页 / 兼容性页） | `app/pages/`、`app/lib/platform.ts` | 下载直链的**版本号与资产名** |
| 双语文档站 | `content/docs/{zh-CN,en-US}/` | 与源仓库的 wire 面一致（协议指纹、方法计数、未发布台账） |
| 三个市场源的宿主 | `market-source/` → 线上 `/source/**`（**只整树托管 `SITE_HOSTED_MARKETS` 里的市场**，见 `market-maintenance.md` §1「托管边界」） | `bun run check:market` |
| **二进制分发** | 本仓的 GitHub Releases（`content/release.json` 的 `repo`） | 与 npm 里那份**同一份 exe** |

**版本单一真源 = `content/release.json`**：`app/lib/platform.ts` 的下载链接与 `scripts/release.mjs` 的标签/资产名都读它。它必须与 npm 的 `@flowy-agent-store/*` 同版本——这条跨仓不变量由源仓库的 `bun run check:release-sync` 守着（它会读本仓的 `content/release.json` 与两语言 `typescript-sdk.md`）。

## 站点侧有序步骤

0. **前置**：源仓库与本站同级 checkout；两仓各自 `bun install`；两仓工作树干净。
1. **文档同步**：按源仓库 `25` §4 的清单改 `content/docs/`（指纹、方法计数、新方法/错误码、`changelog` §4 台账、`upgrade` §8、`examples-sdk`）。本仓判据：`bun run check:docs-sync` 报 `0 drift`。
2. **版本**：`content/release.json` 的 `version` 改成本次 npm 版本。
3. **门禁**：`bun run check:release`（本文档所对应的命令）。
4. **GitHub Release**：
   ```powershell
   bun run release:pack -- --exe C:\workspace\allo\target\release\agent-store.exe --expect-sha256 <哈希>
   bun run release:publish     # 草稿 → 上传 → 体积回读 → 下载回验 → 转正式（prerelease）
   bun run release:status
   ```
   `--exe` 用源仓库构建的那一个（**必须带 `--features static-webui`**，否则二进制没有内嵌 WebUI）；`--expect-sha256` 填**源仓库 `web/packages/runtime/vendor/flowy-agent-store.exe` 的哈希**，即 npm 里真正发布出去的那份字节。
5. **部署**：commit → `git push origin main` → EdgeOne Makers 构建上线（也可在其控制台手动触发）。
6. **部署后自检**：`/<lang>/docs/typescript-sdk` 中英两页有正文（不是 SPA 空壳）；**本站托管的市场**（`SITE_HOSTED_MARKETS`，默认三个）的 `/source/<market>/_files.txt` 可访问且带 `cache-control: no-cache`；首页下载直链真能下到 `v<版本>` 的 zip。
7. **台账**：`changelog` §2 追加「已发布事实」（版本号 + 发布时间 + 改了什么），本次的「未发布」条目从 §4 转正；`upgrade.md` §8 同步。

> **顺序约束：先有 Release 资产，再推站点。** `content/release.json` 一上线，首页就在宣告那个版本；资产还不存在就是 404。所以在拿到 `release:status` 的正式 Release 之前不要 `push main`。

## 发版时最容易踩的三条硬约束

1. **用 `bun run build`，不要直接 `react-router build`**——后者漏掉 `copy-market-tree.mjs`，线上 `/source/**` 全部 404。
2. **新页必须进 `react-router.config.ts` 的 `prerender()`**，否则线上只拿到 SPA 空壳，SEO 与社交预览都是空的。
3. **市场树与 `content/market.json` 是生成物，必须成对提交**，且只由 `bun run sync` 写；不要在仓里手工改市场条目。发布流程**不含**市场刷新（源仓库 `16` R6② 已延后），只有本次发布确实改了市场树才做。
4. **产物规模有硬上限**：EdgeOne Makers 只接受 **≤ 20,000 个文件**、**单文件 ≤ 25 MiB** 的产物（官方排障指南给的三个限制之一，无提额入口）。专家市场单独就是 14,714 个文件且含一个 45.8 MiB 的数据集，与站点一起部署必然被拒（现象：日志停在 `Checking output`，随后 `File count exceeds project limit.` / `Build error`）。所以站点只**整树**托管 `copy-market-tree.mjs` 里 `HOSTED_DEFAULT` 指定的市场（`SITE_HOSTED_MARKETS` 只是本地覆盖）；`bun run build` 末尾那行 `[copy-market-tree] → build/client/source (N files…)` 就是部署前该看的数字。

## 已知缺口

- **本仓无 CI**：`check:release` 与部署后自检都是人工执行；EdgeOne 只在 `push main` 时构建。
- **域名与 HTTPS 未定**：EdgeOne 预览域名带签名的 `eo_token` 会过期，不能长期对外公布为市场源地址（见 `README.md` §部署「待定」）。
- **平台清单是两处字面量**：`app/lib/platform.ts` 的 `RELEASED_PLATFORMS` 与 `scripts/release.mjs` 的 `PLATFORM = "windows-x86_64"` 必须人工保持一致（跨仓的 `check:release-sync` 只守版本号与文档计数，不守这个）。

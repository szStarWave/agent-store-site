# 用 API 触发部署（EdgeOne Makers）

> 最后核对：2026-09-17
> 背景：2026-09-17 本站的 **GitHub 自动触发失效**——最后一次由平台产生的部署是当日 07:38 的
> `dp8pmldfzpbw`（提交 `47bcdff5`，Failed），其后的 `c5293ba8` / `e7901aad` / `4b6b32ff` 三次推送
> **一个部署都没生成**。本文记录不依赖 GitHub 集成的触发方式，以及一次完整实测。

## 1. 先分清项目类型：决定 CLI 能不能用

| `Provider` | 谁构建 | `edgeone makers deploy` 能用吗 |
|---|---|---|
| `Github` | 平台拉仓库、按 `edgeone.json` 构建 | **不能** |
| `Upload` | 本地构建后上传产物 | 能 |

本站 `agent-store-site` 是 **`Github`** 型，所以 CLI 的上传通道不适用。实测原始报错（原样引用，不转述）：

```
[getOrCreateProject] Project agent-store-site exists but has Provider 'Github'.
This project type does not support direct folder or zip file deployment.
Only projects with Provider 'Upload' are supported.
```

> 官方「[使用 Github Action](https://cloud.tencent.com/document/product/1552/127398)」那条路
> （`npx edgeone makers deploy <outputDirectory> -n <projectName> -t <token>`）走的也是**上传**通道，
> 所以同样不适用于本站——除非把项目改成 `Upload` 型（那是换一种部署模型，不是修一个开关）。

## 2. 先查清，再动手：三条只读接口

统一约定：

| 项 | 值 |
|---|---|
| 端点（china） | `https://pages-api.cloud.tencent.com/v1` |
| 端点（global） | `https://pages-api.edgeone.ai/v1` |
| `Region` | china = `ap-guangzhou`；global = `ap-singapore` |
| 认证 | 请求头 `Authorization: Bearer <API Token>`（**不是**腾讯云 SecretId/SecretKey） |
| 请求体 | **平铺**：`Action` 与参数同级 |

> ⚠️ **不要把参数套进 `Data`**。套了会得到 `InvalidParameter.Security: ProjectId should not be empty`
> ——这个报错指向的是包装层次，不是参数本身。

### 2.1 列项目 `DescribePagesProjects`（**必须先做**）

```jsonc
{ "Action": "DescribePagesProjects", "PageNumber": 1, "PageSize": 50,
  "Region": "ap-guangzhou" }
```

返回里每个项目带 `ProjectId` / `Name` / `Status` / `RepoUrl` / `Provider` / `RepoBranch` /
`OutputDir` / `CustomDomains` / `Deployment{ DeploymentId, Status, RepoCommitHash … }`。

**为什么这步不能跳**：`edgeone` CLI **没有列举项目的命令**，而 `-n <名字>` 对**不存在的名字会直接
创建项目**（`link` / `deploy` 都是），账号还有 40 个项目上限。2026-09-17 就是因为拿一个名字去试，
误建了一个 `agent-store-market`。**先用本接口拿到确切名字，再用 CLI 或 API。**

本站的真实读数（14 个项目里相关两行）：

| Name | ProjectId | Provider | RepoBranch | OutputDir | CustomDomains |
|---|---|---|---|---|---|
| `agent-store-site` | `makers-yjnkgelxhduo` | Github | `main` | `build` | `agent-store.flowyaipc.cn` |
| `agent-store-market` | `makers-cl4lnfggoyim` | — | — | — | — |

### 2.2 列部署 `DescribePagesDeployments`

```jsonc
{ "Action": "DescribePagesDeployments", "ProjectId": "makers-yjnkgelxhduo",
  "Offset": 0, "Limit": 20, "OrderBy": "CreatedOn", "Order": "Desc",
  "Region": "ap-guangzhou" }
```

**分页要开大一点**：`Limit: 3` 时新部署可能不在返回里，用它轮询会误判成「已经结束」。

### 2.3 取构建日志 `DescribePagesDeploymentLog`

```jsonc
{ "Action": "DescribePagesDeploymentLog", "ProjectId": "makers-yjnkgelxhduo",
  "DeploymentId": "dp0u1kd7xfh8", "Region": "ap-guangzhou" }
```

返回 `LogUrl`，形如：

```
https://dpl-edgeone.cloud.tencent.com/<APPID>/<ProjectId>/<DeploymentId>/build.log
```

该地址可**匿名**取到，内容是逐行 JSON（`{"t":"i","ls":[[<ms>,"<文本>"]]}`），即控制台构建日志的原文。
**失败原因只在日志里**——部署对象只给 `Status: Failed` 与一个数字 `Code`。

## 3. 触发部署 `CreatePagesDeployment`

```jsonc
{ "Action": "CreatePagesDeployment",
  "ProjectId": "makers-yjnkgelxhduo",
  "Region": "ap-guangzhou",
  "Env": "Production",          // 或 Preview
  "Provider": "Github",
  "ViaMeta": "Github",
  "RepoBranch": "main",
  "RepoCommitHash": "<推送后 main 的 40 位 sha>" }
```

返回 `{"Data":{"Response":{"DeploymentId":"dp…"}}}`。平台随后按该提交拉仓库、跑 `edgeone.json` 的
安装/构建命令（本站是 `bun install` / `bun run build`，产物 `build`），成功即自动切到生产。

> ⚠️ **该请求形状未见于官方文档**。CLI 包内只实现了 `ViaMeta:"Upload"` 那条路（
> `CreatePagesDeployment` + `Provider:"Upload"` + `DistType` + `TempBucketPath` + `BuildFrom:"CLI"`），
> Github 这条是从 CLI 的接口封装与已有部署对象的字段推出的，**并已实测两次**（见 §4）。
> 平台侧若调整契约，这里要重新核对；核对方法就是拿一次真实提交触发，看是否真的产生了部署。

**幂等性**：每次调用都会新建一个部署（不会去重）。同一次推送触发两次就会有两个部署。

**失败不会动线上**：失败的部署不会拿到 `UsedInProd`，当前生产始终是最后一个 `UsedInProd: true` 的成功部署。

## 4. 一次完整实测（2026-09-17）

| 提交 | 部署 | 结果 | 说明 |
|---|---|---|---|
| `4b6b32ff`（市场源改 zip） | `dp0u1kd7xfh8` | **Failed**（`Code 18`，46s） | 构建失败：`content/market.json` 里的头像路径大小写与磁盘不符，Linux 构建机上找不到文件（详见 §5 日志） |
| `02703bfc`（修大小写） | `dp8tjrs20wnj` | **Success**（`UsedInProd: true`） | 构建通过并切到生产 |

对照：上一次由平台自己触发的部署是 `dp8pmldfzpbw`（`47bcdff5`，Failed）——**GitHub 触发已经不再产生部署**。

## 5. 失败时怎么定位（真实例子）

`dp0u1kd7xfh8` 的日志末尾（节选，`\u001b` 为 ANSI 色码）：

```
[copy-market-tree] experts  catalog-assets=306（整树托管在别处）
[copy-market-tree] skills: content/market.json 指向 icons/fbs-bookwriter.png，树里却没有 —— 先跑 `bun run check:market`
error: script "build" exited with code 1
[builder] "bun run build" failed, exit code: 1
[CI][dp0u1kd7xfh8] ✗ CLI Building failed after 14.62s (exit: 18)
```

原因值得记住：Windows 文件系统大小写不敏感，`icons/fbs-bookwriter.png` 在**本机**能匹配到磁盘上的
`icons/FBS-BookWriter.png`，于是本机 `bun run build` 通过、`check:market` 也是 0 发现；**Linux 构建机上
这个路径不存在，构建直接失败**。这类「只在本机看不见」的问题，定位入口就是这份构建日志。

## 6. 令牌

- 在控制台 **API Token** 页创建：china <https://console.cloud.tencent.com/edgeone/pages?tab=settings>；
  global <https://console.intl.cloud.tencent.com/edgeone/pages?tab=settings>。
- CLI 的 `edgeone login -t <token>` 会自动识别 china/global 并持久化到 `~/.edgeone/<hash>`；
  之后再跑 CLI 命令不必再带 `-t`。
- **本题流程不需要把令牌交给任何人**：它只从环境变量/本地文件读，**不要写进仓库、不要作为命令行参数**
  （argv 在进程列表里可见）。
- 令牌是**账号级**权限，泄漏等同于交出该腾讯云账号的 Makers 控制面。

## 7. 部署后自检（本站判据）

按用户体验顺序：

1. `/<lang>/docs/typescript-sdk` 中英两页有正文（不是 SPA 空壳）；
2. **产物规模**：构建日志里没有 `File count exceeds project limit` / `File size limit exceeded`。
   上限是 **20,000 个文件**与**单文件 25 MiB**（[排障指南](https://cloud.tencent.com/document/product/1552/127457)），
   另有一条**账号存储 5 GiB**（超出时报 `The account storage limit is 5 GiB`）。本站自 doc 30 起
   不再整树托管市场，产物约 **742 个文件 / 102.9 MiB**；
3. **退役路径不应存在**：`/source/<market>/_files.txt` 与 `/source/<market>/.codebuddy-*/…` 应返回 **404**
   ——这是「新产物真的上线了」最省事的判据（旧产物是 200）；
4. 目录页头像可取：例如 `/source/skills/icons/FBS-BookWriter.png` 返回 200（**注意大小写**，CDN 是大小写敏感的）；
5. 首页下载直链真能下到 `v<版本>` 的 zip。

## 8. 仍然待办

- **GitHub 集成仍是断的**（本文只绕过它，没有修它）。修复途径在控制台：项目的 Git 集成重新授权/重连仓库。
  在修好之前，每次发布都要按本文手动触发一次。
- **误建的项目待删**：`agent-store-market`（`makers-cl4lnfggoyim`，Status `Pending`），
  在控制台项目列表里删除。CLI 没有删除命令，且官方技能明确要求**代理不得自行删除项目**。

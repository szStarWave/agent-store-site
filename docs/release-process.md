# 发布流程（本站仓规范）

> 最后核对：2026-09-16  
> **权威清单以源仓库为准**：`Michael-Lfx/allo` 仓 `docs/agent-store/25-release-runbook.zh.md`（定义了 npm 四包锁步发布、本站 GitHub Release 资产生成、站点上线流程及失败回退机制）。本文档仅声明**本站仓专属执行规范与验收判据**；若两份文档发生冲突，以源仓库规范为准。

## 1. 站点仓在发布体系中的四大角色

| 角色领域 | 代码/产物落点 | 发布一致性契约要求 |
|---|---|---|
| **官网前端**（落地页 / 兼容性矩阵） | `src/pages/`、`src/lib/platform.ts` | 客户端下载直链中的**版本号与二进制资产文件名**严格匹配 |
| **双语技术文档站** | `content/docs/{zh-CN,en-US}/` | 与源仓库协议 wire 面严格对齐（包含协议指纹、RPC 方法计数、未发布台账） |
| **市场源静态分发** | `market-source/` → 线上 `/source/**` | 仅整树托管 `SITE_HOSTED_MARKETS` 所列市场源（详见 `market-maintenance.md` §1「托管边界」）；门禁满足 `bun run check:market` |
| **可执行二进制分发** | GitHub Releases（由 `content/release.json` 的 `repo` 声明） | 分发的二进制产物与 npm 运行时包中的 exe **二进制字节严格同一（SHA256 完全一致）** |

- **版本号单一真实源 (Single Source of Truth)**：`content/release.json`。`src/lib/platform.ts` 的下载直链构造与 `scripts/release.mjs` 中的 Git 标签与 Release 资产命名均读取该配置文件。
- **跨仓版本锁步约束**：该版本号必须与 npm 发布的 `@flowy-agent-store/*` 套件版本保持一致。该不变量由源仓库门禁 `bun run check:release-sync` 强制校验（比对本仓 `content/release.json` 及双语 `typescript-sdk.md` 文档）。

## 2. 站点发布标准化步骤

### 阶段 0：前置条件检查 (Preconditions)
- 源仓库（`Michael-Lfx/allo`）与本站仓在本地同级检出。
- 两个仓库均已完成 `bun install` 依赖安装。
- 两个仓库工作树均为 clean 状态（无未提交的脏改动）。

### 阶段 1：双语文档同步与门禁校验
- 根据源仓库 `25-release-runbook.zh.md` §4 清单更新 `content/docs/`：更新协议指纹、方法计数、新增 RPC 接口与错误码枚举、`changelog` §4 待发布台账、`upgrade` §8 及 `examples-sdk`。
- **验收判据**：运行 `bun run check:docs-sync`，检查结果必须为 `0 drift`。

### 阶段 2：版本号更新
- 将 `content/release.json` 中的 `version` 字段更新为本次发布的 npm 目标版本号。

### 阶段 3：发布门禁全量检测
- 执行本仓综合发布门禁脚本：
  ```bash
  bun run check:release
  ```
  门禁覆盖：文档结构同构检测、文档同步测试、市场数据一致性检测、市场打包测试及 TypeScript 全局类型检查。

### 阶段 4：GitHub Release 打包与正式发布
```powershell
bun run release:pack -- --exe C:\workspace\allo\target\release\agent-store.exe --expect-sha256 <SHA256哈希>
bun run release:publish     # 流程：创建草稿 -> 上传资产 -> 体积回读校验 -> 下载回验 -> 转为正式发布（prerelease）
bun run release:status      # 查看发布状态与已上传资产列表
```
- `--exe` 参数必须指向源仓库构建出的可执行文件（**构建时必须启用 `--features static-webui`**，否则生成的二进制文件将缺失内置 WebUI）。
- `--expect-sha256` 必须填入**源仓库 `web/packages/runtime/vendor/flowy-agent-store.exe` 的哈希值**，即校验发布资产与 npm 运行时内置文件完全一致。

### 阶段 5：站点提交与部署触发
1. 提交发布改动并推送至主干：
   ```bash
   git commit -am "chore(release): v<版本号>"
   git push origin main
   ```
2. **API 触发 EdgeOne Makers 构建**：自 2026-09-17 起，EdgeOne 的 GitHub Webhook 自动触发构建链路失效，且本站项目属性为 `Github` 型（CLI 产物上传通道不可用）。必须调用 EdgeOne Makers API 手动下发构建任务；具体接口规范、请求体结构与实测记录详见 [`deploy-trigger.md`](deploy-trigger.md)。

> ⚠️ **发布时序不变式 (Ordering Invariant)**：**必须先完成 Release 资产发布，再推送站点主分支**。`content/release.json` 一旦随站点发布生效，官网首页将立即引导用户下载新版本；若 GitHub Release 资产未处于就绪状态，将引发客户端下载 404 故障。

### 阶段 6：生产部署后验收 (Verification)
1. **SSG 预渲染检验**：直接访问 `/<lang>/docs/typescript-sdk`（中英文），确认服务端已渲染完整 HTML 正文而非客户端空容器。
2. **构建配额检验**：构建日志中严禁出现 `File count exceeds project limit` 或 `File size limit exceeded`。
3. **退役资源 404 核验**：验证 `/source/<market>/_files.txt` 及相关旧目录响应 **HTTP 404**（自 doc 30 起市场改由 ModelScope 压缩包托管，历史静态目录不再对外提供服务，这是新版本构建切流成功的关键判据）。
4. **静态图标寻址**：目录页头像请求返回 HTTP 200，且请求 URL 大小写与磁盘资源完全一致。
5. **下载链路连通**：官网首页客户端下载按钮可正常下载最新 `v<版本号>` 的 ZIP 压缩包。

### 阶段 7：变更日志归档
- 在 `changelog` §2 追加正式发布记录（包含版本号、发布日期与特性变更明细）；将此前记录在 §4 的未发布条目移入正式列表。
- 同步更新 `upgrade.md` §8 对应升级指南。

## 3. 核心硬性约束与避坑指南

1. **必须使用 `bun run build`**：严禁直接调用 `docusaurus build`。直接调用将跳过 `scripts/copy-market-tree.mjs` 执行，导致编译产物缺少头像资源，线上市场目录页头像全部降级为字母占位符（`bun run preview` 默认禁用 SPA 兜底以确保此类遗漏能被立即发现）。
2. **新增文档必须在 `src/lib/docOrder.ts` 完成注册**：虽然 `src/pages/` 下的页面与 docs 插件目录下的 Markdown 均支持自动化静态构建，但侧边栏渲染顺序表与磁盘文件集合强绑定。`docusaurus.config.ts` 在构建阶段执行严格一致性核验，遗漏注册将直接阻断构建。
3. **市场树与 `content/market.json` 生成物强绑定**：二者必须通过 `bun run sync` 统一生成并成对提交，禁止人工手动篡改。常规版本发布无需重新执行市场同步，仅在发布明确涉及市场树更新时才需同步。
4. **产物规模配额约束**：EdgeOne Makers 构建平台严格限制**总文件数 ≤ 20,000** 且**单文件体积 ≤ 25 MiB**（无提额渠道）。三个市场源历史完整文件树包含 22,612 个文件且专家市场包含 45.8 MiB 数据集，全量打包必然导致构建因配额超限失败。**当前架构规范**：三个市场源已全量迁移至 ModelScope ZIP 归档存储，本站不再进行整树托管，构建产物仅保留目录页头像。构建完成时需核对 `[copy-market-tree] → build/source (N files…)` 的文件总量。

## 4. 已知系统缺口与局限

- **缺乏自动化 CI 流水线**：`check:release` 校验与线上回归测试仍需人工手动触发；EdgeOne Makers 的 GitHub Webhook 自动构建自 2026-09-17 起处于失效状态，需依赖 API 手动调用（参考 [`deploy-trigger.md`](deploy-trigger.md)）。
- **静态市场源域名未完全固化**：EdgeOne 临时预览域名附带包含时效的 `eo_token` 签名，不可作为市场源外部长期引用地址（参考 `README.md`）。
- **跨文件平台清单字面量冗余**：`src/lib/platform.ts` 中的 `RELEASED_PLATFORMS` 与 `scripts/release.mjs` 中的 `PLATFORM = "windows-x86_64"` 为两处独立字面量声明，发布多平台时需人工同步修改维护（跨仓 `check:release-sync` 仅约束版本号与接口计数，未覆盖此字面量）。

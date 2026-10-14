# 升级与迁移指引

本文档面向集成 Flowy Agent Store 的开发者，阐述 `@flowy-agent-store/{protocol,client,sdk}` 及其平台依赖包的版本演进策略、兼容性约束及各版本迁移步骤。

## 1. 兼容性承诺（当前口径）

**预发布阶段不提供向后兼容承诺。** 当前软件包处于 `0.1.0-beta.*` 预发布阶段，API 规范尚未冻结：类型声明收窄、接口方法增删及事件模型调整可能在 beta 迭代中引入。

版本演进原则：

- beta 线内的**破坏性变更随下一个预发布版本发布**（如 `0.1.0-beta.3` $\to$ `0.1.0-beta.4`），并在 [变更日志](/zh-CN/docs/changelog) 中明确标注文档与迁移方案；次版本号（如 `0.2.0`）保留给退出 beta 阶段后的破坏性更新。
- 每次发布的详细变更分类详见 [变更日志](/zh-CN/docs/changelog)。

工程集成建议：

- 生产环境务必**锁定确切版本号**（详见 §5），避免依赖包管理器对未固定版本的动态解析（详见 §4）；
- 版本升级前应查阅目标版本的 [变更日志条目](/zh-CN/docs/changelog)，并执行 §6 中的迁移步骤。

## 2. 已发布的版本序列（事实）

下表汇总已发布版本的发布记录、标签指向及变更属性：

| 版本 | 发布时间（UTC） | 当前 dist-tag | 与上一版的实质差异 |
| --- | --- | --- | --- |
| `0.1.0-beta.11` | 2026-10-14T11:18:29Z | `beta` | **破坏性**：协议指纹递增至 `fp-16`（跨过 `fp-15`；握手全等校验）；新增 `store/categories` 市场分类字典与标签词表（`GET /api/app-server/store/categories`），方法总数扩充至 83（HTTP 路由映射数扩充至 56）；商店条目携带 `category_id` / 宿主解析的 `category`，专家与团队列表携带 `tags` / `category_id`、技能列表携带 `tags`，`ExpertPack` 升至 `pack_format 3`；`AgentDetail` 的 `tags` / `category_id` 上移到 `AgentSummary`（升级步骤见 §6.10） |
| `0.1.0-beta.10` | 2026-10-12T07:31:25Z | — | **破坏性**：协议指纹递增至 `fp-14`（握手全等校验）；新增 WebSocket 专用接口 `import/assets` 与 `import/asset`，方法总数扩充至 82（HTTP 路由映射数保持 55）；专家包升至 `pack_format 2`（插件级资产 `avatars/ bin/ scripts/` 随包导出，`materializePack` 落盘 `writtenAssets`）；连接器授权回调页改为交换后才出结果、`auth/status` 新增 `authorization_pending`、WebUI 安装走 `store.install()`、新增 `store.findByConnector()` 与 `MCP_OAUTH_CLIENT_NAME`（升级步骤见 §6.9） |
| `0.1.0-beta.9` | 2026-10-10T04:34:35Z | — | **破坏性**：协议指纹递增至 `fp-13`（握手全等校验）；新增 `market/settings` / `market/settings-set` 市场策略读写，方法总数扩充至 80、HTTP 路由映射数扩充至 55；新增市场源 per-source `download_on_start`、`AGENT_STORE_MARKET_DOWNLOAD` / `AGENT_STORE_CONFIG` 与受控自动升级；`exportTeam()` 修复团队包级技能（升级步骤见 §6.8） |
| `0.1.0-beta.8` | 2026-09-28T10:23:47Z | — | **破坏性**：协议指纹递增至 `fp-12`（握手全等校验）；新增 `store/update-entry` 商店条目原地更新与连接器用户凭据体系（`connector/credential/*`、`connector/register`），方法总数扩充至 78、HTTP 路由映射数扩充至 53；`updateHint()` 返回值收窄（升级步骤见 §6.7） |
| `0.1.0-beta.7` | 2026-09-20T10:33:48Z | — | **破坏性**：协议指纹递增至 `fp-8`（握手全等校验）；新增 WebSocket 专用接口 `agent/export` 与 `team/export`，方法总数扩充至 73；接口参数保持平稳（升级步骤见 §6.6） |
| `0.1.0-beta.6` | 2026-09-18T11:08:21Z | — | **破坏性**：SDK 入口与结构重构（`launchClient` 重命名为 `launchHarness`，移除 `.client` 包装，`initializeResult` 调整为 `handshake`），需同步修改调用代码；线协议维持 `fp-7`（升级步骤见 §6.5） |
| `0.1.0-beta.5` | 2026-09-17T11:41:10Z | — | **破坏性**：协议指纹调整为 `fp-7`；扩充连接器工具 `input_schema`、单轮技能挂载、`agent_id`/`team_id` 会话参数及 `zip` 市场源协议（升级步骤见 §6.4） |
| `0.1.0-beta.4` | 2026-09-16T10:24:02Z | — | **破坏性**：协议指纹调整为严格全等模式 `fp-1`；`event_type` 收窄为封闭联合 `ConversationEventType`；新增技能文件读取与连接器代理功能（升级步骤见 §6.3） |
| `0.1.0-beta.3` | 2026-09-10T04:44:34Z | — | 增强客户端生命周期订阅（`onLifecycle`、退出监测）；补全 `engines.node >= 22` 与元数据声明（升级步骤见 §6.1） |
| `0.1.0-beta.2` | 2026-09-09T09:27:36Z | `latest` | 补齐 SDK 的平台运行时依赖包声明（涵盖 darwin、linux、win32 架构） |
| `0.1.0` | 2026-09-09T09:09:04Z | 无 | 初始发布版本；核心代码及类型与 `beta.2` 一致，未包含平台包可选依赖 |

## 3. dist-tag 语义

`dist-tag` 为 npm 仓库的可变标签引用：

| dist-tag | 当前指向 |
| --- | --- |
| `latest` | `0.1.0-beta.2` |
| `beta` | `0.1.0-beta.11` |

```bash
npm view @flowy-agent-store/sdk versions dist-tags --json
```

```json
{
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0-beta.5", "0.1.0-beta.6", "0.1.0-beta.7", "0.1.0-beta.8", "0.1.0-beta.9", "0.1.0-beta.10", "0.1.0-beta.11", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.11", "latest": "0.1.0-beta.2" }
}
```

注意事项：
1. `latest` 标签并不代表最新代码提交，当前固定于 `0.1.0-beta.2`，最新预发布版本通过 `beta` 标签维护。
2. 初始版本 `0.1.0` 无关联标签，但版本范围选择器可能匹配该版本。

## 4. 裸安装与范围解析

默认安装命令将解析至 `latest` 标签对应的历史版本；部分包管理器写入的非精确版本范围（如 `^0.1.0-beta.2`）在不同工具间可能产生歧义解析。

```bash
bun add @flowy-agent-store/sdk                     # → 0.1.0-beta.2（latest）
bun add @flowy-agent-store/sdk@beta                # → 0.1.0-beta.11
bun add '@flowy-agent-store/sdk@^0.1.0-beta.2'     # → 解析为 0.1.0-beta.2
npm view '@flowy-agent-store/sdk@^0.1.0-beta.2' version   # → 可能解析为 0.1.0
```

规范要求：**生产工程严禁依赖非精确版本范围或动态标签**，应将明确的版本号写入 `package.json`。

## 5. 固定确切版本（推荐做法）

```bash
# 声明确切版本号安装
bun add @flowy-agent-store/sdk@0.1.0-beta.7
bun add @flowy-agent-store/protocol@0.1.0-beta.7

# 使用 npm / pnpm
npm install @flowy-agent-store/sdk@0.1.0-beta.7
```

确保 `package.json` 中移除了 `^` 或 `~` 等范围前缀，并将生成的 Lockfile（`bun.lock`、`package-lock.json` 或 `pnpm-lock.yaml`）提交至代码版本控制系统。

## 6. 逐版本升级步骤

### 6.1 从 0.1.0-beta.2 升到 0.1.0-beta.3

此版本不包含破坏性变更，接口纯增量扩充：

```bash
# 1) 查看当前安装版本
bun pm ls | grep '@flowy-agent-store'
# 2) 安装目标固定版本
bun add @flowy-agent-store/sdk@0.1.0-beta.3
bun add @flowy-agent-store/protocol@0.1.0-beta.3
# 3) 校验解析结果
node -p "require('@flowy-agent-store/sdk/package.json').version"
# 4) 执行类型检查与单测
bun run typecheck && bun run test
```

若通过 `AGENT_STORE_BIN` 引用自定义二进制，需确保二进制版本与 SDK 同步更新以满足握手校验。

### 6.2 从 0.1.0 回到 beta 线

从未打标的 `0.1.0` 迁移至标准预发布版本：

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.7
bun pm ls | grep '@flowy-agent-store'
```

### 6.3 从 0.1.0-beta.3 升到 0.1.0-beta.4

此版本引入破坏性变更：

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.4
bun add @flowy-agent-store/protocol@0.1.0-beta.4
bun run typecheck && bun run test
```

核心适配项：
1. **协议指纹全等比对**：指纹更新为 `fp-1`，必须同步更新运行时二进制。
2. **事件类型收窄**：`ConversationEvent.event_type` 调整为封闭联合 `ConversationEventType`，调用方需通过 `decodeConversationEvent` 判定类型。

### 6.4 从 0.1.0-beta.4 升到 0.1.0-beta.5

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.5
bun add @flowy-agent-store/protocol@0.1.0-beta.5
bun run typecheck && bun run test
```

- **协议指纹变更**：指纹升级为 `fp-7`，需同批升级二进制运行时。
- **代理授权规则变更**：`[connector_proxy]` 中的 `allow` 调整为可选白名单，未声明 `allow` 时默认放行所有已启用连接器。

### 6.5 从 0.1.0-beta.5 升到 0.1.0-beta.6

此版本调整了 SDK 编程接口：

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.6
bun add @flowy-agent-store/protocol@0.1.0-beta.6
bun run typecheck
```

代码迁移对照：

```ts
// 历史用法（0.1.0-beta.5）
const session = await launchClient({ client: { name: "my-app", version: "1.0.0" } });
await session.client.conversations.create({ name: "demo" });
session.initializeResult.protocol_version;

// 新版规范（0.1.0-beta.6）
const harness = await launchHarness({ client: { name: "my-app", version: "1.0.0" } });
await harness.conversations.create({ name: "demo" });
harness.handshake.protocol_version;
```

1. 入口函数重命名为 `launchHarness`；
2. 业务客户端直接挂载于返回值根路径；
3. 握手结果属性重命名为 `handshake`。

### 6.6 从 0.1.0-beta.6 升到 0.1.0-beta.7

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.7
bun add @flowy-agent-store/protocol@0.1.0-beta.7
bun run typecheck
```

- 协议指纹递增至 `fp-8`，客户端与运行时需保持版本对齐；
- 新增 `agents.export` 与 `teams.export` 接口，支持资产结构导出。

### 6.7 从 0.1.0-beta.7 升到 0.1.0-beta.8

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.8
bun add @flowy-agent-store/protocol@0.1.0-beta.8
bun run typecheck
```

- **协议指纹由 `fp-11` 递增到 `fp-12`**（叠加本次跨过的 `fp-9` 至 `fp-11`），握手执行严格全等校验：**客户端与运行时必须同批升级**，只升一边会直接连不上；
- **有一处 TS 签名变化需要改代码**：`StoreClient.updateHint()` 的返回值由 `"uninstall_reinstall"` 改为 `"update"`，以它分支的调用方要同步；`StoreOperationOutcome` 另新增 `errors` 与 `warnings`（加法）；
- 新增 `store.update()`：已安装的商店条目可以显式升级（协议方法 `store/update-entry`），不再需要「卸载再安装」；
- 连接器用户凭据体系（`credential` 块、`connector/credential/{get,set,clear}`、`connector/register`）与 SDK 的 `exportAgent` / `exportTeam` / `materializePack` 随本版首次发布。

### 6.8 从 0.1.0-beta.8 升到 0.1.0-beta.9

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.9
bun add @flowy-agent-store/protocol@0.1.0-beta.9
bun run typecheck
```

- **协议指纹由 `fp-12` 递增到 `fp-13`**，握手执行严格全等校验：**客户端与运行时必须同批升级**，只升一边会直接连不上；
- 本次**没有 TypeScript 签名破坏**：新增的 `getMarketSettings()` / `setMarketSettings()` 与 `SpawnOptions.marketDownload` / `configPath` 都是加法，`bun run typecheck` 应当照旧通过；
- 新增两个 HTTP 映射方法 `market/settings` / `market/settings-set`（`GET` / `POST /api/app-server/market-settings`），协议方法总数 80、HTTP 路由映射数 55；
- **`exportTeam()` 的输出变了**（协议与类型形态未变）：团队的 `pack.skills` 不再恒为空，它现在是该团队包级声明且已安装的技能；若你此前自行遍历 `pack.team.members[].skills` 来收集团队技能，那段代码可以删掉，直接读 `result.writtenSkills`（用法见 [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk) §4.4）；
- 若你希望宿主启动时不自动下载市场源，可用 `download_on_start = false` 或 `AGENT_STORE_MARKET_DOWNLOAD=none`；自动升级的条目类型与扫掠周期可在运行期经 `market/settings-set` 改写（配置写法见 [配置参考](/zh-CN/docs/configuration)）。

### 6.9 从 0.1.0-beta.9 升到 0.1.0-beta.10

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.10
bun add @flowy-agent-store/protocol@0.1.0-beta.10
bun run typecheck
```

- **协议指纹由 `fp-13` 递增到 `fp-14`**，握手执行严格全等校验：**客户端与运行时必须同批升级**，只升一边会直接连不上；
- **没有 TypeScript 签名破坏**：`ExpertPack.assets` / `ExpertPack.avatar`、`ExpertAssetRef`、`client.listImportAssets()` / `client.readImportAsset()`、`ExportResult.writtenAssets`、能力位 `snapshot_assets` 全部是**加法**，`bun run typecheck` 应当照旧通过；
- 新增两个 **WebSocket-only** 方法 `import/assets` / `import/asset`，协议方法总数 82、HTTP 路由映射数保持 55；
- **`exportTeam()` / `exportAgent()` 的输出目录变多了**（不删任何东西）：插件级 `avatars/`、`bin/`、`scripts/` 会按快照相对路径落盘（`result.writtenAssets`），物化目录成为完整的插件根——若你的消费逻辑此前假设目录里只有 `expert-pack.json` / `persona.md` / `members/` / `skills/`，需要确认新增目录不会干扰它；
- **可执行内容的边界**：`kind: "script"` 是类别标注不是许可——宿主自己从不执行插件级脚本，字节按 0644 交付；不想让包声明这一类的运营者，在 `config.toml` 加 `[expert_export] scripts = false` 即可（头像不受影响）；
- 宿主升级后，连接器授权回调页会在 token 交换出结果后才显示成功/失败，`connector/auth/status` 在流程进行中报告 `authorization_pending`；从 WebUI 安装连接器现在与 SDK 行为一致（装完即可用）。

### 6.10 从 0.1.0-beta.10 升到 0.1.0-beta.11

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.11
bun add @flowy-agent-store/protocol@0.1.0-beta.11
bun run typecheck
```

- **协议指纹由 `fp-14` 递增到 `fp-16`**（一次发布跨过 `fp-15`），握手执行严格全等校验：**客户端与运行时必须同批升级**，只升一边会直接连不上；
- **没有 TypeScript 签名破坏**：新字段全部是**可选**加法——`StoreItem.category_id` / `.category`、`AgentSummary.tags` / `.category_id`、`TeamSummary.tags` / `.category_id`、`SkillSummary.tags`、`ExpertPack.tags` / `.category_id`、`StoreCategories`、`client.listStoreCategories()` / `client.store.categories()`，`bun run typecheck` 应当照旧通过；
- **有一处字段搬家**：`AgentDetail` 的 `tags` / `category_id` 上移到 `AgentSummary`（扁平 JSON 无法让同一个键在 summary 与 detail 各出现一次）。`AgentDetail` 继承 `AgentSummary`，读 `detail.tags` 的代码照旧可用；若你的代码里手写了 `AgentDetail` 对象字面量去喂断言或 mock，需要把这两个键挪到 summary 那一层；
- 新增 `store/categories`（HTTP `GET /api/app-server/store/categories`），协议方法总数 83、HTTP 路由映射数 56；它返回所有**已启用**市场的分类字典与市场级标签词表（`marketplace_tags`，按位配对的双语数组），冷启动即完整；
- **新字段的读取口径**：`category` 是宿主用字典解析出来的名字，**id 未命中字典时就缺席**（宿主不猜）；技能的 `tags` 来自市场索引行并在导入时固化，市场事后改标签需要升级该条目才生效；连接器条目**没有标签来源**，其标签恒为缺席。请把这几处都按「有就读、没有就退化成原始 id」写，`item.tags ?? []` 是安全默认；
- **`pack_format 3` 的消费方**：导出包只携带**裸 `category_id`**，要显示名字必须自带等价字典（本宿主的字典经 `store.categories()` 提供，**不跨宿主通用**）；分类的作用域与 `assets` 相反——顶层包取自身声明、每个成员包取该成员自己的值（用法见 [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk) §4.4）。

## 7. 自查当前安装的版本

```bash
# 查看项目实际解析到的版本
bun pm ls | grep '@flowy-agent-store'
# 读取已安装模块 package.json
node -p "require('@flowy-agent-store/protocol/package.json').version"
# 校验 Lockfile 锁定记录
grep -o '@flowy-agent-store/sdk@[0-9][^"]*' bun.lock | head -1
# 查看远程仓库标签状态
npm view @flowy-agent-store/sdk versions dist-tags --json
```

## 8. 已发布产物的差异与自查方法

截至 `0.1.0-beta.11`，工作区与线上发布产物保持一致：

1. **市场分类与标签全链路透出 —— `fp-14` $\to$ `fp-16`**：新增 `store/categories`（`GET /api/app-server/store/categories`），协议方法总数扩充至 83、HTTP 路由映射数扩充至 56；商店条目携带 `category_id` 与宿主解析的 `category`，专家 / 团队列表携带 `tags` / `category_id`、技能列表携带 `tags`，`ExpertPack` 升至 `pack_format 3`；`AgentDetail` 的 `tags` / `category_id` 上移到 `AgentSummary`。
2. **专家导出补齐插件级资产 —— `fp-13` $\to$ `fp-14`**：新增 `import/assets` / `import/asset`（WebSocket-only），方法总数扩充至 82（HTTP 路由映射数保持 55）；`ExpertPack` 升至 `pack_format 2`（`assets` / `avatar`），`materializePack` 落盘 `writtenAssets`，导出目录成为完整插件根；能力位 `snapshot_assets`、减项 `[expert_export] scripts`。
3. **连接器授权可见性修复**：回调页在 token 交换出结果后才出页面；`auth/status` 新增 `authorization_pending`；WebUI 安装走 `store.install()`；新增 `store.findByConnector()` 与 `StoreOperationOutcome.installedCount`；`MCP_OAUTH_CLIENT_NAME`。
4. **市场源策略与受控自动升级 —— `fp-12` $\to$ `fp-13`**：新增 `market/settings` / `market/settings-set`（`GET` / `POST /api/app-server/market-settings`），协议方法总数扩充至 80、HTTP 路由映射数扩充至 55；per-source `download_on_start`、`AGENT_STORE_MARKET_DOWNLOAD`、`AGENT_STORE_CONFIG`；市场级 `auto_update` 从「只刷索引」扩为「刷新 + 自动升级」，默认白名单 `["agent","team","skill"]`（连接器不隐式包含）。
5. **`exportTeam()` 补齐团队包级技能**：团队的顶层 `skills` 由该团队自身快照已安装的技能填充，与成员声明一并去重落盘；协议与类型形态未变。
6. **商店条目原地更新 —— `fp-11` $\to$ `fp-12`**：新增 `store/update-entry` 与客户端 `store.update()`，协议方法总数扩充至 78，HTTP 路由映射数扩充至 53。
7. **连接器用户凭据体系 —— `fp-8` $\to$ `fp-11`**：`credential` 块与 `token-schema.json` 声明、`connector/credential/{get,set,clear}`、`connector/register`（模板即声明）；凭据按调用者键控。
8. **SDK 资源物化助手**：`exportAgent` / `exportTeam` / `materializePack`。
9. **条目版本与安装态的两处修复**：技能与连接器条目的版本不再被钉在占位版本 `1.0.0`；安装态写入按 `(snapshot_id, component_id)` 收窄。

### 8.1 迁移已有配置里的市场源

官方市场源已全面迁移至 ModelScope 单 Zip 归档架构，历史文件树路径已废弃。若本地 `~/.agent-store/config.toml` 包含旧版 URL：

```toml
[default_marketplaces.experts]
source_kind = "url"
source = "https://agent-store.flowyaipc.cn/source/experts/.codebuddy-plugin/marketplace.json"
```

处理方案：
- 直接移除 `[default_marketplaces]` 配置块以采用运行时内置默认源；
- 或将源配置更新为官方 Zip 归档格式：

```toml
[default_marketplaces.experts]
source_kind = "zip"
source = "https://www.modelscope.cn/models/me9rez/flowy-marketplace/resolve/master/experts.zip"

[default_marketplaces.skills]
source_kind = "zip"
source = "https://www.modelscope.cn/models/me9rez/flowy-marketplace/resolve/master/skills.zip"

[default_marketplaces.connectors]
source_kind = "zip"
source = "https://www.modelscope.cn/models/me9rez/flowy-marketplace/resolve/master/connectors.zip"
```

差异验证脚本范例：

```bash
# 验证协议导出符号差异
mkdir -p b6 b7
(cd b6 && npm pack @flowy-agent-store/protocol@0.1.0-beta.6 --silent && tar xzf *.tgz)
(cd b7 && npm pack @flowy-agent-store/protocol@0.1.0-beta.7 --silent && tar xzf *.tgz)
diff <(grep -o '^export [a-z]* [A-Za-z]*' b6/package/dist/index.d.mts) \
     <(grep -o '^export [a-z]* [A-Za-z]*' b7/package/dist/index.d.mts)
```

## 9. changelog 与 release notes 的边界

| 事项 | 现状 | 依据 |
| --- | --- | --- |
| 破坏性变更版本号 | beta 阶段随预发布序号更新并标明破坏性影响 | 兼容性承诺原则（beta 期间不承诺绝对向后兼容） |
| 独立变更日志页面 | [变更日志](/zh-CN/docs/changelog) | 规范化版本记录 |
| 本页职责 | 提供版本演进事实与具体升级迁移指引 | 保持操作导向 |
| 与 changelog 的分工 | 本页说明迁移流程；changelog 记录版本详细功能变更 | 双向交叉引用 |

## 10. 另见

- [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk)：接口参数与错误模型说明。
- [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk)：各场景开箱即用代码实现。
- [快速开始](/zh-CN/docs/quick-start)：单文件二进制运行指南。
- [兼容性矩阵](/zh-CN/docs/compatibility)：平台及数据格式支持边界。
- [变更日志](/zh-CN/docs/changelog)：已发布版本的详细改动记录。

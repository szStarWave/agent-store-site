# 变更日志

本页记录 `@flowy-agent-store/*` 每个**已发布**版本改了什么，并且是**破坏性变更的唯一公告面**。

发布事实（发布时间、dist-tag 指向、产物差异如何核对）在[升级与迁移指引](/zh-CN/docs/upgrade)；本页只回答「每一版改了什么」。

## 1. 本页范围

- **只登记已经发布到 npm 的版本**：`@flowy-agent-store/protocol`、`client`、`sdk`，以及随 sdk 一起分发的 `@flowy-agent-store/runtime-*` 平台包。
- **未发布的改动不构成本页条目**：工作区里已经存在、但尚未随任何版本发布的差异，只登记在[升级与迁移指引](/zh-CN/docs/upgrade) §8 与本文 §4。
- **不预告日期**：本页不出现「即将发布」「计划于」这类表述；条目只在发布**之后**追加。
- 版本号语义与兼容性承诺（beta 期不承诺向后兼容、破坏性变更走 minor 号）见[升级与迁移指引](/zh-CN/docs/upgrade) §1 与本文 §3。

## 2. 已发布版本（事实）

三个包与平台运行时包当前共用同一组版本号。复现命令：

```bash
npm view @flowy-agent-store/sdk versions dist-tags time --json
```

```json
{
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.4", "latest": "0.1.0-beta.2" },
  "time": {
    "0.1.0": "2026-09-09T09:09:04.795Z",
    "0.1.0-beta.2": "2026-09-09T09:27:36.122Z",
    "0.1.0-beta.3": "2026-09-10T04:44:34.609Z",
    "0.1.0-beta.4": "2026-09-16T10:24:02.588Z"
  }
}
```

| 版本 | 发布（UTC） | 变更类型 | 当前 dist-tag |
| --- | --- | --- | --- |
| `0.1.0-beta.4` | 2026-09-16 | 破坏性（协议指纹严格相等 + 类型收窄） | `beta` |
| `0.1.0-beta.3` | 2026-09-10 | 加法（无破坏性） | — |
| `0.1.0-beta.2` | 2026-09-09 | 加法（无破坏性） | `latest` |
| `0.1.0` | 2026-09-09 | 首次发布 | 无 |

`versions` 的排列顺序**不是**时间顺序：`0.1.0` 排在最后，却是**最早**的一次发布（比 `beta.2` 早约 18 分钟），且不带任何 dist-tag。它不是稳定版，也不比 beta 线新——dist-tag 语义见[升级与迁移指引](/zh-CN/docs/upgrade) §3。

### 2.1 `0.1.0-beta.4` — 2026-09-16T10:24:02Z

> **本版含破坏性变更**：`0.1.0-beta.3` 及更早版本的客户端**连不上**本版运行时，必须一并升级（步骤见[升级与迁移指引](/zh-CN/docs/upgrade) §6.3）。

- **破坏性 — 协议指纹改为严格相等的计数器**：指纹值由日期戳换成 `fp-1`（形状改为 `fp-<n>` 计数器）。它**不改变任何 wire 行为**，但握手与 SDK 对指纹做**严格相等**校验，所以按旧值编出来的客户端会被新运行时拒绝。经 `AGENT_STORE_BIN` 注入自建二进制时，SDK 与二进制必须同批升级。
- **破坏性 — `event_type` 收窄**：`ConversationEvent` 的 `event_type` 从「开放联合 + `| string` 兜底」改为封闭类型 `ConversationEventType`，并新增包内解码器 `decodeConversationEvent`（把事件收敛成带 `kind` 判别式的 `DecodedConversationEvent`）。读取 `ConversationEvent.event_type` 并把它当 `string` 用的代码会开始报类型错误；`RunEvent.event_type` 是**另一处**声明，仍是有意保持开放的 `string`，未受影响。**此前三个已发布版本的声明里那个 `| string` 都还在**（复现方法见[升级与迁移指引](/zh-CN/docs/upgrade) §8）。
- **加法 — 协议方法面增量**：新增 `run/plan`、`config/get`、`config/set`、`config/get-mcp`、`config/set-mcp`、`config/set-mcp-enabled`、`run/answer-decision`，以及市场条目快照与 `store/list` 的 `published_at` 等字段。
- **加法 — 技能文件树读面** `skill/files` / `skill/file`：技能是目录，此前只有 `SKILL.md` 可读。`skill/file` 在服务端回原始字节 + `content-type`（不是 JSON 信封），因此没有进 JSON 传输的路由表。客户端映射到 HTTP 的方法数现为 **48 / 71**（已按本版已发布产物实测，见[TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk) §5.3）。
- **加法 — 连接器调用代理** `connector/call`：宿主持有连接与凭据、替调用方执行 MCP 工具；**默认全关**，需 `[connector_proxy]` allowlist；工具级失败以 `is_error` 返回而不是抛错。
- **加法 — 新通知** `conversation/list-changed`：会话**列表**投影的 `created` / `updated` / `deleted`；不设订阅门槛、不带 `sequence`。
- **升级影响**：**需要改代码**（类型收窄）且**必须升级**（指纹严格相等），步骤见[升级与迁移指引](/zh-CN/docs/upgrade) §6.3。

### 2.2 `0.1.0-beta.3` — 2026-09-10T04:44:34Z

- **client**：新增公开声明 `TransportLifecycle`、`onLifecycle`、`connectTimeoutMs`，以及订阅状态机的 `rearm()`。
- **sdk**：新增公开声明 `assertProtocolCompatible`、`SpawnOptions.env` / `cwd` / `onExit`、`SpawnedServer.exited`、`SpawnExitInfo`。
- **`package.json` 元数据**：client 与 sdk 补上 `engines.node >= 22`、`repository`、`sideEffects`。
- **protocol**：类型声明**逐字节未变**。
- **升级影响**：从 `0.1.0-beta.2` 升级**无需改代码**，步骤见[升级与迁移指引](/zh-CN/docs/upgrade) §6.1。

### 2.3 `0.1.0-beta.2` — 2026-09-09T09:27:36Z

- **sdk**：补齐 `optionalDependencies`，按同一版本号钉住五个平台运行时包——`runtime-win32-x64`、`runtime-linux-x64`、`runtime-linux-arm64`、`runtime-darwin-x64`、`runtime-darwin-arm64`。
- 此前的 `0.1.0` 没有这份依赖，`launchClient` 可能因此找不到可执行文件（见[升级与迁移指引](/zh-CN/docs/upgrade) §6.2）。
- 它是 `latest` 标签当前指向的版本——**不是最新版**。

### 2.4 `0.1.0` — 2026-09-09T09:09:04Z

- **首次发布**：三个包的第一个公开版本；没有更早的版本可破坏，因此不含破坏性变更。
- 三个包的**代码与类型声明与 `0.1.0-beta.2` 逐字节相同**，差别只在 `package.json`——sdk 当时**没有** `optionalDependencies`。
- 不带任何 dist-tag。

> 上面「与上一版的实质差异」来自 `npm pack` 取回已发布产物后的逐字节比对，原始记录在计划文档 `16` 的 R4 行与 `21` 的 R4 落地记录；本页只做汇总，不新增判据。

## 3. 变更类型与破坏性变更的公告规则（D10=A）

口径：**beta 期间不承诺向后兼容**，破坏性变更**随下一个预发布序号发布**（`0.1.0-beta.N` → `0.1.0-beta.N+1`）并在条目里标「破坏性」；`0.1.x` → `0.2.0` 这类 **minor 号留给退出 beta 之后的破坏性变更**——现在还没有稳定版可破坏，因此不做 major 号。

| 变更类型 | 版本号 | 本页动作 |
| --- | --- | --- |
| 首次发布 | 该版本号本身 | 新增条目，标「首次发布」 |
| 加法（新增声明、新增依赖、元数据） | patch / 预发布序号 | 新增条目，标「加法（无破坏性）」 |
| 破坏性（类型收窄、方法增删、事件面调整） | beta 线内：**下一个预发布序号**；退出 beta 后：**minor 号** | 新增条目，标「破坏性」并给出迁移做法 |

> **口径修订（2026-09-16）**：原口径为「破坏性变更走 minor 号」，与 beta 线内的实际发布节奏不符——`0.1.0-beta.4` 载有 `event_type` 类型收窄与协议指纹严格相等变更，仍是预发布序号。现改为「beta 线内随下一个预发布序号发布并逐条标注，minor 号保留给退出 beta 之后的破坏性变更」。**已发布条目的版本号与发布时间不受此修订影响**（见下方「永不改写」）。

**本页是破坏性变更的唯一公告面**：它不靠 commit message、聊天记录或 release 页通知——只有本页条目写了「破坏性」并给出迁移做法，才算公告（版本号规则见[升级与迁移指引](/zh-CN/docs/upgrade) §1）。

条目的新增与更正规则：

- **新增**：向 npm 发布新版本**之后**追加，不写「预告」条目。
- **永不改写**：已发布条目的版本号与发布时间一经写下不再修改。
- **更正**：条目写错时在同一处追加一行「更正（日期）」说明，不静默改历史。
- **dist-tag 移动不产生条目**：`latest` / `beta` 指向哪个版本属于发布状态，记在[升级与迁移指引](/zh-CN/docs/upgrade) §3。

## 4. 未发布的变更与发布节奏

截至 `0.1.0-beta.4`（2026-09-16），**工作区（`web/packages/*`）领先于已发布产物**：`0.1.0-beta.4` 之后工作区又积累了协议指纹 `fp-1` → **`fp-2`** 的增量——连接器工具的 `input_schema`（`ConnectorTool` 加字段）与 `ConnectorDetail` / `ConnectorProbeResult` 的 `tools_truncated`，**无方法增删**（映射数仍是 `48 / 71`）——以及宿主配置 `[connector_proxy]` 授权形状的变更（`allow` 变可选收窄、新增 `deny`，`enabled` 为真即默认可调，取代此前的强制逐工具白名单）。这些**尚未随任何版本发布**，自查方法见[升级与迁移指引](/zh-CN/docs/upgrade) §8。

其上再叠加 **`fp-2` → `fp-3`** 的增量：`conversation/send` 新增可选的 `mentions`（现有 DTO **加字段**），**只认 `kind: "skill"`**，让单轮消息可以挂载技能；`agent` / `connector` 两类以 `invalid_request` **显式拒绝**（它们在 `send` 上没有载体）。同样**无方法增删**，`48 / 71` 不变。

再叠加 **`fp-3` → `fp-4`**：`conversation/create` 新增可选的 `agent_id`（同为现有 DTO **加字段**），把一个会话**建成某个已安装专家**——该专家的 preset 身份、它自带的技能与连接器一并冻结进会话，此后不可改写（`conversation/update` 拒绝 preset / 技能 / 连接器键；换专家＝新建会话）。仍然**无方法增删**。

再叠加 **`fp-4` → `fp-5`**：`conversation/create` 新增可选的 `team_id`（同样**加字段**），用来**打开某个专家团的 Leader 会话**——与 `team/run` 共用同一段编排（成员校验、物化/复用执行模板、会话栅栏），唯一区别是**不发 `goal` 首轮**，第一句话由调用方说。`agent_id` 与 `team_id` **互斥**。仍然**无方法增删**。

再叠加 **`fp-5` → `fp-6`**：`conversation/send` 与 `agent/run` 各新增可选的 `model` 与 `reasoning_effort`（都是**给现有 DTO 加字段**），让调用方在**发起这次调用时**指定模型与思考等级；`ConversationView` 同时新增 `reasoning_effort`，把会话当前的等级**读得回来**（此前三条写入路径存在、却没有任何读面）。语义是**粘性**的：`send` 上带的值写进会话行，**从这条消息起生效**、此后每轮沿用——Nomi 运行时按会话行构建，所以这**不是**「只影响这一轮」；`agent/run` 上带的值只作用于**那次运行**（优先级：显式 > preset 自带 > 宿主默认），随快照落到该运行的每个 attempt。会话正跑着一个 turn 时 `send` 的切换会被拒（`conflict`）。仍然**无方法增删**，`48 / 71` 不变。

再叠加 **`fp-6` → `fp-7`**：`AppServerMarketplaceSourceKind` 新增枚举值 `zip`——一个 **HTTP(S) 归档**，**归档根目录即市场根**（清单在归档根，不套一层目录）。官方三个市场（`experts` / `skills` / `connectors`）随之从本站的 `/source/<market>/…` 逐文件树迁到 ModelScope 上的三个 zip 归档；归档的 sha256 就是 revision（对稳定 URL 发 `HEAD`、读 `X-Linked-Etag`），内容未变即不下载。`url` / `github` / `git` / `directory` 全部保留，第三方源继续可用整树镜像。仍然**无方法增删**，`48 / 71` 不变；手改配置的迁移做法见[升级与迁移指引](/zh-CN/docs/upgrade) §8。

再往前：`0.1.0-beta.3` 之后积累的那批改动——`event_type` 收窄、协议方法面增量、`conversation/list-changed`、技能文件树读面、`connector/call`、协议指纹形状变更——已全部随 `0.1.0-beta.4` 发布，逐条见 §2.1。

「已发布产物里到底有什么」可以自己复现，做法是把相邻两版取回来对读：`0.1.0-beta.3` 的 `event_type` 仍带 `| string` 兜底、指纹是日期戳；`0.1.0-beta.4` 已是封闭联合 `ConversationEventType`、指纹是 `fp-1`。具体命令见[升级与迁移指引](/zh-CN/docs/upgrade) §8。

发布节奏：条目在版本**发布之后**才追加（见 §3 的「新增」规则），本页不预告日期。

因此：**没有列在本页的变更，不要假定它已经发布。**

## 5. 另见

- [升级与迁移指引](/zh-CN/docs/upgrade)：发布事实表、dist-tag 语义、固定确切版本、逐版本升级步骤与自查命令。
- [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk)：安装、API、事件与错误模型；其 §1 给出当前版本状态。可运行示例见 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk)。
- [快速开始](/zh-CN/docs/quick-start)：终端用户的安装包路径。

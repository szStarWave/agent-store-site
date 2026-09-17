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
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0-beta.5", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.5", "latest": "0.1.0-beta.2" },
  "time": {
    "0.1.0": "2026-09-09T09:09:04.795Z",
    "0.1.0-beta.2": "2026-09-09T09:27:36.122Z",
    "0.1.0-beta.3": "2026-09-10T04:44:34.609Z",
    "0.1.0-beta.4": "2026-09-16T10:24:02.588Z",
    "0.1.0-beta.5": "2026-09-17T11:41:10.171Z"
  }
}
```

| 版本 | 发布（UTC） | 变更类型 | 当前 dist-tag |
| --- | --- | --- | --- |
| `0.1.0-beta.5` | 2026-09-17 | 破坏性（协议指纹严格相等：`fp-1` → `fp-7`） | `beta` |
| `0.1.0-beta.4` | 2026-09-16 | 破坏性（协议指纹严格相等 + 类型收窄） | — |
| `0.1.0-beta.3` | 2026-09-10 | 加法（无破坏性） | — |
| `0.1.0-beta.2` | 2026-09-09 | 加法（无破坏性） | `latest` |
| `0.1.0` | 2026-09-09 | 首次发布 | 无 |

`versions` 的排列顺序**不是**时间顺序：`0.1.0` 排在最后，却是**最早**的一次发布（比 `beta.2` 早约 18 分钟），且不带任何 dist-tag。它不是稳定版，也不比 beta 线新——dist-tag 语义见[升级与迁移指引](/zh-CN/docs/upgrade) §3。

### 2.1 `0.1.0-beta.5` — 2026-09-17T11:41:10Z

> **本版含破坏性变更**：`0.1.0-beta.4` 及更早版本的客户端**连不上**本版运行时，必须一并升级（步骤见[升级与迁移指引](/zh-CN/docs/upgrade) §6.4）。

- **破坏性 — 协议指纹从 `fp-1` 跳到 `fp-7`**：本版一次性发布工作区里积累的六次递增。指纹**不改变任何 wire 行为**，但握手与 SDK 对它做**严格相等**校验，所以按 `fp-1` 编出来的客户端会被本版运行时拒绝。经 `AGENT_STORE_BIN` 注入自建二进制时，SDK 与二进制必须同批升级。
- **加法 — `fp-2` 连接器工具的参数面**：`ConnectorTool` 新增 `input_schema`（上游 `tools/list` 的原样 schema），`ConnectorDetail` / `ConnectorProbeResult` 新增 `tools_truncated`（为守住宿主的工具预算而**诚实省略**，schema 只会整条带或整条不带）。同一批改了**宿主配置** `[connector_proxy]` 的授权形状：`allow` 变为可选并收窄语义、新增 `deny`，`enabled = true` 即**默认可调**，取代此前强制的逐工具白名单——这是宿主配置面的变化，不改 npm 包的类型面，但自建宿主需要重读该表。
- **加法 — `fp-3` 技能可按轮挂载**：`conversation/send` 的 `mentions` 只认 `kind: "skill"`，`agent` / `connector` 两类以 `invalid_request` **显式拒绝**。注意 `MentionRef` / `mentions` 的**类型面在 `0.1.0-beta.4` 的已发布声明里已经存在**（那版的 `index.d.mts` 已含 `MentionKind` / `MentionRef` 与两处 `mentions`）；本版带来的是宿主侧语义与随之而来的指纹递增。
- **加法 — `fp-4` 会话可以建成一个已安装专家**：`conversation/create` 新增 `agent_id`。专家的 preset 身份、它自带的技能与连接器一并**冻结**进会话，此后不可改写（换专家＝新建会话）。
- **加法 — `fp-5` 专家团的 Leader 会话**：`conversation/create` 新增 `team_id`，与 `team/run` 共用同一段编排（成员校验、模板、会话栅栏），唯一区别是**不发 `goal` 首轮**，第一句话由调用方说。`agent_id` 与 `team_id` **互斥**。
- **加法 — `fp-6` 按调用选模型与思考等级**：`conversation/send` 与 `agent/run` 各新增 `model` / `reasoning_effort`，`ConversationView` 新增 `reasoning_effort`（此前三条写入路径存在、却没有任何读面）。语义是**粘性**的：`send` 上带的值写进会话行、**从这条消息起生效**并此后每轮沿用；`agent/run` 上带的值只作用于**那次运行**。会话正跑着一个 turn 时 `send` 的切换会被拒（`conflict`）。
- **加法 — `fp-7` 市场源新增 `zip` 类型**：`MarketplaceSourceKind` 新增 `"zip"`——一个 **HTTP(S) 归档**，**归档根目录即市场根**（清单在归档根，不套一层目录）。官方三个市场（`experts` / `skills` / `connectors`）随之从本站的 `/source/<market>/…` 逐文件树迁到 ModelScope 上的三个 zip 归档；归档的 sha256 就是 revision（对稳定 URL 发 `HEAD` 读 `X-Linked-Etag`），内容未变即不下载。`url` / `github` / `git` / `directory` 全部保留，第三方源继续可用整树镜像。手改配置的迁移做法见[升级与迁移指引](/zh-CN/docs/upgrade) §8.1。
- **无方法增删**：客户端映射到 HTTP 的方法数仍是 **48 / 71**。
- **升级影响**：**必须升级**（指纹严格相等），**无需改代码**——把相邻两版的已发布产物取回来对读（命令见[升级与迁移指引](/zh-CN/docs/upgrade) §8），141 个导出**一个不多一个不少**，新增的只有可选字段，没有任何声明被收窄或删除。

### 2.2 `0.1.0-beta.4` — 2026-09-16T10:24:02Z

> **本版含破坏性变更**：`0.1.0-beta.3` 及更早版本的客户端**连不上**本版运行时，必须一并升级（步骤见[升级与迁移指引](/zh-CN/docs/upgrade) §6.3）。

- **破坏性 — 协议指纹改为严格相等的计数器**：指纹值由日期戳换成 `fp-1`（形状改为 `fp-<n>` 计数器）。它**不改变任何 wire 行为**，但握手与 SDK 对指纹做**严格相等**校验，所以按旧值编出来的客户端会被新运行时拒绝。经 `AGENT_STORE_BIN` 注入自建二进制时，SDK 与二进制必须同批升级。
- **破坏性 — `event_type` 收窄**：`ConversationEvent` 的 `event_type` 从「开放联合 + `| string` 兜底」改为封闭类型 `ConversationEventType`，并新增包内解码器 `decodeConversationEvent`（把事件收敛成带 `kind` 判别式的 `DecodedConversationEvent`）。读取 `ConversationEvent.event_type` 并把它当 `string` 用的代码会开始报类型错误；`RunEvent.event_type` 是**另一处**声明，仍是有意保持开放的 `string`，未受影响。**此前三个已发布版本的声明里那个 `| string` 都还在**（复现方法见[升级与迁移指引](/zh-CN/docs/upgrade) §8）。
- **加法 — 协议方法面增量**：新增 `run/plan`、`config/get`、`config/set`、`config/get-mcp`、`config/set-mcp`、`config/set-mcp-enabled`、`run/answer-decision`，以及市场条目快照与 `store/list` 的 `published_at` 等字段。
- **加法 — 技能文件树读面** `skill/files` / `skill/file`：技能是目录，此前只有 `SKILL.md` 可读。`skill/file` 在服务端回原始字节 + `content-type`（不是 JSON 信封），因此没有进 JSON 传输的路由表。客户端映射到 HTTP 的方法数现为 **48 / 71**（已按本版已发布产物实测，见[TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk) §5.3）。
- **加法 — 连接器调用代理** `connector/call`：宿主持有连接与凭据、替调用方执行 MCP 工具；**默认全关**，需 `[connector_proxy]` allowlist；工具级失败以 `is_error` 返回而不是抛错。
- **加法 — 新通知** `conversation/list-changed`：会话**列表**投影的 `created` / `updated` / `deleted`；不设订阅门槛、不带 `sequence`。
- **升级影响**：**需要改代码**（类型收窄）且**必须升级**（指纹严格相等），步骤见[升级与迁移指引](/zh-CN/docs/upgrade) §6.3。

### 2.3 `0.1.0-beta.3` — 2026-09-10T04:44:34Z

- **client**：新增公开声明 `TransportLifecycle`、`onLifecycle`、`connectTimeoutMs`，以及订阅状态机的 `rearm()`。
- **sdk**：新增公开声明 `assertProtocolCompatible`、`SpawnOptions.env` / `cwd` / `onExit`、`SpawnedServer.exited`、`SpawnExitInfo`。
- **`package.json` 元数据**：client 与 sdk 补上 `engines.node >= 22`、`repository`、`sideEffects`。
- **protocol**：类型声明**逐字节未变**。
- **升级影响**：从 `0.1.0-beta.2` 升级**无需改代码**，步骤见[升级与迁移指引](/zh-CN/docs/upgrade) §6.1。

### 2.4 `0.1.0-beta.2` — 2026-09-09T09:27:36Z

- **sdk**：补齐 `optionalDependencies`，按同一版本号钉住五个平台运行时包——`runtime-win32-x64`、`runtime-linux-x64`、`runtime-linux-arm64`、`runtime-darwin-x64`、`runtime-darwin-arm64`。
- 此前的 `0.1.0` 没有这份依赖，`launchClient` 可能因此找不到可执行文件（见[升级与迁移指引](/zh-CN/docs/upgrade) §6.2）。
- 它是 `latest` 标签当前指向的版本——**不是最新版**。

### 2.5 `0.1.0` — 2026-09-09T09:09:04Z

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

截至 `0.1.0-beta.5`（2026-09-17），**工作区与已发布产物之间没有未发布的协议差异**：`0.1.0-beta.4` 之后积累的六次指纹递增（`fp-1` → `fp-7`）已全部随本版发布，逐条见 §2.1。上一版留下的这份台账因此清零。

一处口径更正（2026-09-17）：上一版台账把 `mentions` 记作「`fp-2` → `fp-3` 新增」的字段。把两版已发布产物对读可见，`MentionKind` / `MentionRef` 与两处 `mentions` **在 `0.1.0-beta.4` 的 `index.d.mts` 里就已经存在**，所以 §2.1 把它写成宿主侧的**语义**变化，不声称是 beta.5 新增的字段。已发布条目的版本号与发布时间不受此更正影响。

发布节奏：条目在版本**发布之后**才追加（见 §3 的「新增」规则），本页不预告日期。

因此：**没有列在本页的变更，不要假定它已经发布。**

## 5. 另见

- [升级与迁移指引](/zh-CN/docs/upgrade)：发布事实表、dist-tag 语义、固定确切版本、逐版本升级步骤与自查命令。
- [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk)：安装、API、事件与错误模型；其 §1 给出当前版本状态。可运行示例见 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk)。
- [快速开始](/zh-CN/docs/quick-start)：终端用户的安装包路径。

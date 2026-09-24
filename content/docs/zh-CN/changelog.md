# 变更日志

本页记录 `@flowy-agent-store/*` 每个**已发布**版本改了什么，并且是**破坏性变更的唯一公告面**。

发布事实（发布时间、dist-tag 指向、产物差异如何核对）在[升级与迁移指引](/zh-CN/docs/upgrade)；本页只回答「每一版改了什么」。

## 1. 本页范围

- **只登记已经发布到 npm 的版本**：`@flowy-agent-store/protocol`、`client`、`sdk`，以及随 sdk 一起分发的 `@flowy-agent-store/runtime-*` 平台包。
- **未发布的改动不构成本页条目**：工作区里已经存在、但尚未随任何版本发布的差异，只登记在[升级与迁移指引](/zh-CN/docs/upgrade) §8 与本文 §4。
- **不预告日期**：本页不出现「即将发布」「计划于」这类表述；条目只在发布**之后**追加。
- 版本号语义与兼容性承诺（beta 期不承诺向后兼容、破坏性变更**随下一个预发布序号发布**）见[升级与迁移指引](/zh-CN/docs/upgrade) §1 与本文 §3。

## 2. 已发布版本（事实）

三个包与平台运行时包当前共用同一组版本号。复现命令：

```bash
npm view @flowy-agent-store/sdk versions dist-tags time --json
```

```json
{
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0-beta.5", "0.1.0-beta.6", "0.1.0-beta.7", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.7", "latest": "0.1.0-beta.2" },
  "time": {
    "0.1.0": "2026-09-09T09:09:04.795Z",
    "0.1.0-beta.2": "2026-09-09T09:27:36.122Z",
    "0.1.0-beta.3": "2026-09-10T04:44:34.609Z",
    "0.1.0-beta.4": "2026-09-16T10:24:02.588Z",
    "0.1.0-beta.5": "2026-09-17T11:41:10.171Z",
    "0.1.0-beta.6": "2026-09-18T11:08:21.813Z",
    "0.1.0-beta.7": "2026-09-20T10:33:48.685Z"
  }
}
```

| 版本 | 发布（UTC） | 变更类型 | 当前 dist-tag |
| --- | --- | --- | --- |
| `0.1.0-beta.7` | 2026-09-20 | 破坏性（协议指纹严格相等：`fp-7` → `fp-8`，**必须升级**） | `beta` |
| `0.1.0-beta.6` | 2026-09-18 | 破坏性（SDK 入口改名 + 返回形状变更，**要改代码**） | — |
| `0.1.0-beta.5` | 2026-09-17 | 破坏性（协议指纹严格相等：`fp-1` → `fp-7`） | — |
| `0.1.0-beta.4` | 2026-09-16 | 破坏性（协议指纹严格相等 + 类型收窄） | — |
| `0.1.0-beta.3` | 2026-09-10 | 加法（无破坏性） | — |
| `0.1.0-beta.2` | 2026-09-09 | 加法（无破坏性） | `latest` |
| `0.1.0` | 2026-09-09 | 首次发布 | 无 |

`versions` 的排列顺序**不是**时间顺序：`0.1.0` 排在最后，却是**最早**的一次发布（比 `beta.2` 早约 18 分钟），且不带任何 dist-tag。它不是稳定版，也不比 beta 线新——dist-tag 语义见[升级与迁移指引](/zh-CN/docs/upgrade) §3。

### 2.1 `0.1.0-beta.7` — 2026-09-20T10:33:48Z

> **本版含破坏性变更**：协议指纹从 `fp-7` 跳到 `fp-8`，握手与 SDK 按**严格相等**校验——按 `fp-7` 编出来的客户端**连不上**本版运行时，必须一并升级（步骤见[升级与迁移指引](/zh-CN/docs/upgrade) §6.6）。

#### 破坏性

- 协议指纹 `fp-7` → **`fp-8`**：新增两个 **WebSocket-only** 方法 `agent/export` / `team/export`（返回一份可移植的 `ExpertPack`）。方法计数 `48 / 71` → **`48 / 73`**，**映射数不变**（两个新方法与 `agent/list` · `agent/get` · `team/list` · `team/get` 同族，都没有 HTTP 路由）。

#### 新增

- **专家 / 专家团定义导出**：`agent/export` · `team/export` 返回 `ExpertPack`——persona 正文、模型提示、**按引用**的技能清单，以及（团的）固定名单加逐成员展开。这是本仓**第一次把 Agent Markdown 正文放上协议面**；目录面（`agent/list` / `agent/get`）**刻意永远不带**它，导出因此是独立方法、独立闸门 `[expert_export]`（默认开的**减项表**，与 `[tools]` 同族）。`pack_format`（=1）**独立于 `fp-n`**：指纹管 wire 兼容，它管给第三方的产物契约。**没有时间戳**——同一快照两次导出逐字节相同，消费方可拿 `content_digest` 当缓存键。
- SDK：`agents.export(agentId)` 与 `teams.export(teamId, teamVersion?)`（`@flowy-agent-store/client` 的 `agents` / `teams` 子客户端）。
- **宿主配置**：`~/.agent-store/config.toml` 的 `[memory]` 表新增 `enabled`（内置文件型记忆系统的总开关，`false` 时四面同停：系统提示词的记忆段落 / `remember` 工具 / 轮后蒸馏 / 引用回写；与既有的 `distill_enabled` **独立**，后者只管蒸馏一半）。默认**开**，不写该键即沿用上游默认，所以升级后行为不变。

#### 修复

- **`[models.*]` 的 `max_output_size` / `protocol` 此前声明了却没有任何消费者**：provider DTO 没有对应列，`provider_models.output_limit` 一直是 `NULL`，而 anthropic / bedrock / vertex 协议的线上请求**必须**带 `max_tokens`，运行时构建直接以 `BAD_REQUEST`（`the anthropic protocol requires an explicit output ceiling`）失败。现改为经**行级**写面补齐（与设置界面同一条路径），并且**只填空、不覆盖**——仅在行为 `NULL` 时按配置写入，所以幂等，也不会静默推翻用户在设置界面里的手填值；同一 provider key 复用时同样执行补齐，早前注册出的 `NULL` 行会在下次解析时就地修复。`protocol` 同批接线。

**升级影响**：用 `@flowy-agent-store/sdk` 的**必须升级**——指纹严格相等，`fp-7` 的客户端连不上本版运行时。**只改指纹与新增方法，没有类型收窄或改名**，所以 `launchHarness` 的用法不变（`beta.6` 的入口改名见 §2.2），代码在绝大多数情况下**无需改动**；`[memory] enabled` 与 `max_output_size` 两项只改宿主读配置的行为，**不进指纹**。

### 2.2 `0.1.0-beta.6` — 2026-09-18T11:08:21Z

> **本版含破坏性变更**：`@flowy-agent-store/sdk` 的入口**改了名、也改了形状**，用它的代码必须跟着改（wire 面未动，运行时可以混用），迁移步骤见[升级与迁移指引](/zh-CN/docs/upgrade) §6.5。

#### 破坏性

- `launchClient` → **`launchHarness`**；类型 `LaunchedClient` → **`Harness`**、`LaunchOptions` → **`HarnessOptions`**。
- 返回值不再有 `.client` 一跳：解析出的对象**就是** `AppServerClient`，业务面直接挂在它身上（`session.client.conversations` → `harness.conversations`）。
- `initializeResult` → **`handshake`**（非空握手响应）；基类的 `initializeInfo` 仍是「当前连接状态」，`close()` 之后为 `null`。
- `close()` 的语义变强：一次覆盖「退订 → 关传输 → 终止子进程 → 删除自动创建的 data-dir」。

**升级影响**：用 `@flowy-agent-store/sdk` 的**必须升级、且必须改代码**（上面四处）；只用 `protocol` / `client`，或只用运行时二进制的，**不受影响**——协议指纹仍是 `fp-7`、方法计数仍是 `48 / 71`，wire 面与 `0.1.0-beta.5` 互通。

### 2.3 `0.1.0-beta.5` — 2026-09-17T11:41:10Z

> **本版含破坏性变更**：`0.1.0-beta.4` 及更早版本的客户端**连不上**本版运行时，必须一并升级，步骤见[升级与迁移指引](/zh-CN/docs/upgrade) §6.4。

#### 破坏性

- 协议指纹从 `fp-1` 跳到 `fp-7`：握手与 SDK 按**严格相等**校验，按旧值编出来的客户端会被直接拒绝；经 `AGENT_STORE_BIN` 注入自建二进制时，SDK 与二进制必须同批升级。
- 宿主配置 `[connector_proxy]` 的授权形状变了：`allow` 由必填白名单改为**可选收窄**，于是 `enabled = true` 且没写 `allow` 等于**该连接器全部工具可调**——只写了 `enabled` 的自建宿主需重读该表（启动时会打一条告警）。

#### 新增

- **连接器工具的参数面**：`ConnectorTool.input_schema`，以及 `ConnectorDetail` / `ConnectorProbeResult` 的 `tools_truncated`（预算不足时整条省略 schema，而不是截断）。
- **技能可按轮挂载**：`conversation/send` 的 `mentions` **只认 `kind: "skill"`**，单轮消息即可挂载技能。
- **会话可建成一个已安装专家**：`conversation/create` 的 `agent_id`，专家的 preset / 技能 / 连接器一并冻结进会话。
- **专家团 Leader 会话**：`conversation/create` 的 `team_id`，与 `team/run` 同编排但**不发 `goal` 首轮**；与 `agent_id` 互斥。
- **按调用指定模型与思考等级**：`conversation/send` 与 `agent/run` 的 `model` / `reasoning_effort`，并在 `ConversationView` 补上读面；`send` 上带的值**粘性**生效，此后每轮沿用。
- **市场源新增 `zip` 类型**：一个 **HTTP(S) 归档**，**归档根即市场根**；官方三个市场随之迁到 ModelScope 的 zip 归档，revision 就是归档 sha256（`HEAD` 读 `X-Linked-Etag`，未变不下载）。配置迁移见[升级与迁移指引](/zh-CN/docs/upgrade) §8.1。

#### 优化

- `mentions` 里的 `agent` / `connector` 两类改以 `invalid_request` **显式拒绝**，不再静默忽略。

#### 修复

- `~/.agent-store/config.toml` 里 `source_kind = "zip"` 的市场源不再被静默丢弃——此前它会被一份过期的内部 kind 白名单挡掉，store 变空却仍报「注册完成」，`agent-store init` 生成的配置同样中招。

**升级影响**：**必须升级**，但**无需改代码**——两版已发布产物的导出名都是 **141 个**，新增的只有可选字段。

### 2.4 `0.1.0-beta.4` — 2026-09-16T10:24:02Z

> **本版含破坏性变更**：`0.1.0-beta.3` 及更早版本的客户端**连不上**本版运行时，必须一并升级，步骤见[升级与迁移指引](/zh-CN/docs/upgrade) §6.3。

#### 破坏性

- 协议指纹由日期戳改为 **`fp-<n>` 计数器**（本版为 `fp-1`）：它不改变任何 wire 行为，但严格相等的校验会让旧客户端连不上新运行时。
- `ConversationEvent.event_type` 从「开放联合 + `| string` 兜底」**收窄**为封闭类型 `ConversationEventType`：读它并当 `string` 用的代码会开始报类型错误（`RunEvent.event_type` 是另一处声明，仍有意保持开放）。

#### 新增

- **协议方法面**：`run/plan`、`config/get`、`config/set`、`config/get-mcp`、`config/set-mcp`、`config/set-mcp-enabled`、`run/answer-decision`。
- **技能文件树读面** `skill/files` / `skill/file`：技能是目录，此前只有 `SKILL.md` 可读。
- **连接器调用代理** `connector/call`：宿主持有连接与凭据、替调用方执行 MCP 工具，**默认全关**，工具级失败以 `is_error` 返回。
- **新通知** `conversation/list-changed`：会话**列表**投影的 `created` / `updated` / `deleted`。
- **市场条目快照字段**：`store/list` 增加 `published_at` 等。
- **包内解码器** `decodeConversationEvent`：把事件收敛成带 `kind` 判别式的 `DecodedConversationEvent`。

#### 优化

- 客户端映射到 HTTP 的方法数变为 **48 / 71**（按本版已发布产物实测，见 [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk) §5.3）。

**升级影响**：**必须升级**，且**需要改代码**——`event_type` 现在按封闭联合检查。

### 2.5 `0.1.0-beta.3` — 2026-09-10T04:44:34Z

#### 新增

- **client 公开声明**：`TransportLifecycle`、`onLifecycle`、`connectTimeoutMs`，以及订阅状态机的 `rearm()`。
- **sdk 公开声明**：`assertProtocolCompatible`、`SpawnOptions.env` / `cwd` / `onExit`、`SpawnedServer.exited`、`SpawnExitInfo`。

#### 优化

- **`package.json` 元数据**：client 与 sdk 补上 `engines.node >= 22`、`repository`、`sideEffects`。

**升级影响**：从 `0.1.0-beta.2` 升级**无需改代码**（protocol 的类型声明逐字节未变），步骤见[升级与迁移指引](/zh-CN/docs/upgrade) §6.1。

### 2.6 `0.1.0-beta.2` — 2026-09-09T09:27:36Z

#### 新增

- **sdk 补齐 `optionalDependencies`**：按同一版本号钉住五个平台运行时包——`runtime-win32-x64`、`runtime-linux-x64`、`runtime-linux-arm64`、`runtime-darwin-x64`、`runtime-darwin-arm64`。

#### 修复

- 此前的 `0.1.0` 没有这份依赖，`launchHarness` 可能因此**找不到可执行文件**（见[升级与迁移指引](/zh-CN/docs/upgrade) §6.2）。

它是 `latest` 标签当前指向的版本——**不是最新版**；升级无需改代码。

### 2.7 `0.1.0` — 2026-09-09T09:09:04Z

#### 新增

- **首次发布**：三个包的第一个公开版本；没有更早的版本可破坏，因此不含破坏性变更。

三个包的**代码与类型声明与 `0.1.0-beta.2` 逐字节相同**，差别只在 `package.json`——sdk 当时**没有** `optionalDependencies`；本版不带任何 dist-tag。

> 上面「与上一版的实质差异」来自 `npm pack` 取回已发布产物后的逐字节比对，原始记录在计划文档 `16` 的 R4 行与 `21` 的 R4 落地记录；本页只做汇总，不新增判据。

## 3. 变更类型与破坏性变更的公告规则（D10=A）

口径：**beta 期间不承诺向后兼容**，破坏性变更**随下一个预发布序号发布**（`0.1.0-beta.N` → `0.1.0-beta.N+1`）并在条目里标「破坏性」；`0.1.x` → `0.2.0` 这类 **minor 号留给退出 beta 之后的破坏性变更**——现在还没有稳定版可破坏，因此不做 major 号。

| 变更类型 | 版本号 | 本页动作 |
| --- | --- | --- |
| 首次发布 | 该版本号本身 | 追加条目，含「新增」组 |
| 加法（新增声明、新增依赖、元数据） | patch / 预发布序号 | 追加条目，按内容归入「新增 / 优化 / 修复」 |
| 破坏性（类型收窄、方法增删、事件面调整） | beta 线内：**下一个预发布序号**；退出 beta 后：**minor 号** | 追加条目，含「破坏性」组并给出迁移做法 |

**每个版本的条目按四组排列**：**破坏性 / 新增 / 优化 / 修复**。后三组的分工是——「新增」给对外能力，「优化」是不改变能力面的改进（错误语义更明确、覆盖面变化），「修复」是对已有缺陷的修正；**没有内容的小组不出现**。组标题用 `####`，所以**不进本页目录**——目录仍然只列版本。含破坏性变更的版本在最前面加一行**横幅**，并在条目末尾给出**升级影响**（是否必须升级、是否要改代码）。

> **口径修订（2026-09-16）**：原口径为「破坏性变更走 minor 号」，与 beta 线内的实际发布节奏不符——`0.1.0-beta.4` 载有 `event_type` 类型收窄与协议指纹严格相等变更，仍是预发布序号。现改为「beta 线内随下一个预发布序号发布并逐条标注，minor 号保留给退出 beta 之后的破坏性变更」。**已发布条目的版本号与发布时间不受此修订影响**（见下方「永不改写」）。

**本页是破坏性变更的唯一公告面**：它不靠 commit message、聊天记录或 release 页通知——只有本页条目写了「破坏性」并给出迁移做法，才算公告（版本号规则见[升级与迁移指引](/zh-CN/docs/upgrade) §1）。

条目的新增与更正规则：

- **追加**：向 npm 发布新版本**之后**追加，不写「预告」条目。
- **永不改写**：已发布条目的版本号与发布时间一经写下不再修改。
- **更正**：条目写错时在同一处追加一行「更正（日期）」说明，不静默改历史。
- **dist-tag 移动不产生条目**：`latest` / `beta` 指向哪个版本属于发布状态，记在[升级与迁移指引](/zh-CN/docs/upgrade) §3。

## 4. 未发布的变更与发布节奏

**待发布（尚未发版）**：连接器用户凭据（`fp-9`，方法计数 `48 / 73` → `51 / 76`）——
连接器摘要多一个 `credential` 块，并新增 `connector/credential/get` · `set` · `clear` 三个方法
与 SDK 上的 `connectors.credentials()` / `setCredentials()` / `clearCredentials()`。需要用户自己
填 key / token 的连接器从此有正式输入口：密钥值两个方向都不过线（`fields[].value` 只对 `plain`
字段出现），写入按调用者命名空间落库，`connector/credential/*` 只接受该连接器声明里出现过的键。
详见 [TypeScript SDK](/zh-CN/docs/typescript-sdk)。**指纹严格相等，升级到此版必须同时升级 SDK。**

截至 2026-09-20，**已发布产物 `0.1.0-beta.7` 对应的是 `fp-8` 与 `48 / 73`**，`[memory] enabled` 与 `max_output_size` / `protocol` 接线这两项也已在同一个工作区里（它们不进指纹，因此对读产物看不出来，见[升级与迁移指引](/zh-CN/docs/upgrade) §8）。

上一批（`0.1.0-beta.6` 之后积累的专家 / 专家团定义导出与宿主配置增量）已随 `0.1.0-beta.7` 发布，逐条见 §2.1；`beta.6` 的 SDK 入口改名与返回形状变更见 §2.2，`0.1.0-beta.4` 及更早的批次见 §2.4–§2.5。

一处口径更正（2026-09-17）：上一版台账把 `mentions` 记作「`fp-2` → `fp-3` 新增」的字段。把两版已发布产物对读可见，`MentionKind` / `MentionRef` 与两处 `mentions` **在 `0.1.0-beta.4` 的 `index.d.mts` 里就已经存在**，所以 §2.3 把它写成宿主侧的**语义**变化，不声称是 beta.5 新增的字段。已发布条目的版本号与发布时间不受此更正影响。

发布节奏：条目在版本**发布之后**才追加（见 §3 的「新增」规则），本页不预告日期。

因此：**没有列在本页的变更，不要假定它已经发布。**

## 5. 另见

- [升级与迁移指引](/zh-CN/docs/upgrade)：发布事实表、dist-tag 语义、固定确切版本、逐版本升级步骤与自查命令。
- [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk)：安装、API、事件与错误模型；其 §1 给出当前版本状态。可运行示例见 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk)。
- [快速开始](/zh-CN/docs/quick-start)：终端用户的安装包路径。

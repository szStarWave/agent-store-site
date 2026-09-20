# 升级与迁移指引

本页回答三个问题：**能不能升**、**升到哪个版本**、**怎么升**。适用范围：`@flowy-agent-store/{protocol,client,sdk}` 三个 npm 包，以及随它们一起分发的平台运行时包。

发布事实与升级步骤都在这里；协议方法语义全集仍在仓库文件 `docs/agent-store/05-allo-app-server-protocol.md`。

## 1. 兼容性承诺（当前口径）

**beta 期间不承诺向后兼容。** 三个包都是 `0.1.0-beta.*` 预发布，API 未冻结：类型收窄、方法增删、事件面调整都可能在 beta 线内部发生。

配套两条约定（口径 D10=A 已拍板）：

- beta 线内**破坏性变更随下一个预发布序号发布**（`0.1.0-beta.3` → `0.1.0-beta.4`），并在 changelog **逐条标注「破坏性」并给出迁移做法**；`0.1.x` → `0.2.0` 这类 **minor 号留给退出 beta 之后的破坏性变更**——现在还没有稳定版可破坏，所以不做 major 号；
- 每次发布的变更类型在 **[变更日志](/zh-CN/docs/changelog)** 明示（见 §9）。

由此得到两条操作建议：

- 生产接入请**固定确切版本**（见 §5），不要依赖裸 `bun add` / `npm install` 的解析结果（见 §4）；
- 升级前先读目标版本的 [changelog 条目](/zh-CN/docs/changelog)，再按 §6 的逐版本步骤操作。

## 2. 已发布的版本序列（事实）

下表由注册表元数据与已发布产物核对得出（复现命令见 §8）：

| 版本 | 发布时间（UTC） | 当前 dist-tag | 与上一版的实质差异 |
| --- | --- | --- | --- |
| `0.1.0` | 2026-09-09T09:09:04Z | 无 | 首次发布；三个包的**代码与类型声明与 beta.2 逐字节相同**，只有 `package.json` 不同：当时的 sdk 没有 `optionalDependencies`（未随附平台运行时包） |
| `0.1.0-beta.2` | 2026-09-09T09:27:36Z | `latest` | 补齐 sdk 的 `optionalDependencies`（darwin / linux / win32 五个平台运行时包，同一版本号） |
| `0.1.0-beta.3` | 2026-09-10T04:44:34Z | — | 为 client / sdk 新增公开声明（重连生命周期、退出观测，见 §6.1）；`package.json` 补 `engines.node >= 22`、`repository`、`sideEffects`；protocol 声明逐字节未变 |
| `0.1.0-beta.5` | 2026-09-17T11:41:10Z | — | **破坏性**：协议指纹从 `fp-1` 跳到 `fp-7`（旧客户端连不上新运行时）；其余为加法项——连接器工具的 `input_schema` / `tools_truncated`、按轮挂载技能（`mentions` 只认 `kind: "skill"`）、`agent_id` / `team_id`、`model` / `reasoning_effort`，以及市场源新增 `zip` 类型。方法面无增删，仍是 `48 / 71`（升级步骤见 §6.4） |
| `0.1.0-beta.4` | 2026-09-16T10:24:02Z | — | **破坏性**：协议指纹改为严格相等的 `fp-1`（旧客户端连不上新运行时）、`event_type` 收窄为封闭联合 `ConversationEventType`；同时带上技能文件树读面、`connector/call` 调用代理与 `conversation/list-changed` 等加法项，客户端映射到 HTTP 的方法数现为 `48 / 71`（升级步骤见 §6.3） |
| `0.1.0-beta.7` | 2026-09-20T10:33:48Z | `beta` | **破坏性**：协议指纹改为严格相等的 `fp-8`（旧客户端连不上本版运行时）——新增两个 WebSocket-only 方法 `agent/export` / `team/export`，返回可移植的 `ExpertPack`；方法计数 `48 / 71` → `48 / 73`，映射数不变。**没有类型收窄或改名**，所以代码通常无需改动（升级步骤见 §6.6） |
| `0.1.0-beta.6` | 2026-09-18T11:08:21Z | — | **破坏性**：`@flowy-agent-store/sdk` 入口**改名并改了形状**（`launchClient` → `launchHarness`、返回值不再有 `.client` 一跳、`initializeResult` → `handshake`），**必须改代码**；wire 面未动——指纹仍 `fp-7`、方法仍 `48 / 71`（升级步骤见 §6.5） |
| `0.1.0-beta.5` | 2026-09-17T11:41:10Z | — | **破坏性**：协议指纹从 `fp-1` 跳到 `fp-7`（旧客户端连不上新运行时）；其余为加法项——连接器工具的 `input_schema` / `tools_truncated`、按轮挂载技能（`mentions` 只认 `kind: "skill"`）、`agent_id` / `team_id`、`model` / `reasoning_effort`，以及市场源新增 `zip` 类型。方法面无增删，仍是 `48 / 71`（升级步骤见 §6.4） |
| `0.1.0-beta.4` | 2026-09-16T10:24:02Z | — | **破坏性**：协议指纹改为严格相等的 `fp-1`（旧客户端连不上新运行时）、`event_type` 收窄为封闭联合 `ConversationEventType`；同时带上技能文件树读面、`connector/call` 调用代理与 `conversation/list-changed` 等加法项，客户端映射到 HTTP 的方法数现为 `48 / 71`（升级步骤见 §6.3） |

注意 `0.1.0` 是**时间最早**的一次发布（比 beta.2 早约 18 分钟），却没有任何 dist-tag 指向它；它既不是稳定版，也不比 beta 线新。

## 3. dist-tag 语义

`dist-tag` 是发布者可以移动的标签，与版本号大小无关：

| dist-tag | 当前指向 |
| --- | --- |
| `latest` | `0.1.0-beta.2` |
| `beta` | `0.1.0-beta.7` |

`0.1.0` 不带任何 tag。三个包与 `@flowy-agent-store/runtime-*` 两个 tag 的指向一致（已实测）。

```bash
npm view @flowy-agent-store/sdk versions dist-tags --json
```

```json
{
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0-beta.5", "0.1.0-beta.6", "0.1.0-beta.7", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.7", "latest": "0.1.0-beta.2" }
}
```

两个陷阱：

1. `latest` **不是**最新版——它指向 `0.1.0-beta.2`；最新的 beta 是 `beta` tag 指向的 `0.1.0-beta.7`。
2. `0.1.0` 虽然没有 tag，但版本范围仍可能解析到它（见 §4）。

另外，`versions` 数组的**排列顺序不是时间顺序**：`0.1.0` 排在最后，却是最早发布的。

## 4. 裸安装与范围解析

裸安装走 `latest`，所以拿到的是 `0.1.0-beta.2`；更麻烦的是 bun 会把**范围**写进 `package.json`（`^0.1.0-beta.2`），下一次安装会重新解析——而同一个范围在不同工具里的解析结果并不相同。

实测（临时目录、空 `node_modules`）：

```bash
bun add @flowy-agent-store/sdk                     # → 0.1.0-beta.2（latest）
bun add @flowy-agent-store/sdk@beta                # → 0.1.0-beta.7
bun add '@flowy-agent-store/sdk@^0.1.0-beta.2'     # → bun 解析到 0.1.0-beta.2
npm view '@flowy-agent-store/sdk@^0.1.0-beta.2' version   # → npm 解析到 0.1.0（那个无 tag 的早期发布）
```

结论：**不要依赖范围解析**。用 tag 别名也不安全——`latest` 会在下次发布时被移动（`beta` 同样），今天写 `@beta` 明天可能装到别的版本。请把确切版本写进 `package.json`。

## 5. 固定确切版本（推荐做法）

```bash
# 明确写出确切版本；不要用 ^ 或 ~
bun add @flowy-agent-store/sdk@0.1.0-beta.7
bun add @flowy-agent-store/protocol@0.1.0-beta.7   # 需要协议类型时

# npm / pnpm 同理
npm install @flowy-agent-store/sdk@0.1.0-beta.7
```

`package.json` 里应当落到 `"@flowy-agent-store/sdk": "0.1.0-beta.7"`（**不带** `^`）。sdk 的平台运行时包由它的 `optionalDependencies` 按同一版本号钉住，不需要单独声明。

锁文件也要提交进版本库：`bun.lock` / `package-lock.json` / `pnpm-lock.yaml` 是「这次到底装了什么」的唯一权威记录。

于是升级就是：改这一个字符串、重装、重跑测试，没有别的步骤。

## 6. 逐版本升级步骤

### 6.1 从 0.1.0-beta.2 升到 0.1.0-beta.3

这是**第一次** beta 内部跳跃，**无需改代码**：实测差异只有新增声明（client 的 `TransportLifecycle` / `onLifecycle` / `connectTimeoutMs` / 订阅 `rearm()`；sdk 的 `assertProtocolCompatible`、`SpawnOptions.env` / `cwd` / `onExit`、`SpawnedServer.exited`、`SpawnExitInfo`）与 `package.json` 元数据；protocol 的类型声明逐字节未变。

```bash
# 1) 先看当前实际装的是什么
bun pm ls | grep '@flowy-agent-store'          # npm 项目：npm ls @flowy-agent-store/sdk
# 2) 固定到目标版本（需要几个包就升几个，版本号保持一致）
bun add @flowy-agent-store/sdk@0.1.0-beta.3
bun add @flowy-agent-store/protocol@0.1.0-beta.3
# 3) 确认解析结果
node -p "require('@flowy-agent-store/sdk/package.json').version"
# 4) 重跑自己的类型检查与测试
bun run typecheck && bun run test
```

如果你用 `AGENT_STORE_BIN` 指向自建二进制，请注意 SDK 会**校验就绪行里的 `protocol_version` 与自己是否一致**（见 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §12）：升级 SDK 之后旧二进制会被拒绝，请在同一步里一并更新二进制。

### 6.2 从 0.1.0 回到 beta 线

`0.1.0` 是首次发布且不带任何 dist-tag；三个包的**代码与类型声明与 `0.1.0-beta.2` 逐字节相同**，差别只在 `package.json`——尤其当时的 sdk **没有** `optionalDependencies`，不会随附 `@flowy-agent-store/runtime-win32-x64` 等平台运行时包，`launchHarness` 可能因此找不到可执行文件。

```bash
# 从无 tag 的 0.1.0 切到当前 beta 线（当前 beta 见 §3）
bun add @flowy-agent-store/sdk@0.1.0-beta.7
bun pm ls | grep '@flowy-agent-store'   # 确认 0.1.0 已经不在了
```

`0.1.0` 升到 `beta.3` 是纯加法：公开声明面只增不减（`beta.2` 补的运行时包、`beta.3` 补的重连与退出观测），没有删除或改名；**再往上的 `beta.4` 不是纯加法**——它带类型收窄与严格相等的协议指纹，见 §6.3；**`beta.5` 也不是纯加法**（指纹再次严格相等），但**不需要改代码**，见 §6.4；**`beta.6` 也不是纯加法**——SDK 入口改名且形状变了，是**必须改代码**的一版，见 §6.5；**`beta.7` 也不是纯加法**（指纹 `fp-7` → `fp-8`），但**不需要改代码**，见 §6.6。

### 6.3 从 0.1.0-beta.3 升到 0.1.0-beta.4

这是**第一次带破坏性变更的 beta 内部跳跃**，不能只换版本号：

```bash
# 1) 先看当前实际装的是什么
bun pm ls | grep '@flowy-agent-store'          # npm 项目：npm ls @flowy-agent-store/sdk
# 2) 固定到 0.1.0-beta.4（需要几个包就升几个，版本号保持一致）
bun add @flowy-agent-store/sdk@0.1.0-beta.4
bun add @flowy-agent-store/protocol@0.1.0-beta.4
# 3) 确认解析结果
node -p "require('@flowy-agent-store/sdk/package.json').version"
# 4) 重跑类型检查与测试——ConversationEvent.event_type 现在按封闭联合检查
bun run typecheck && bun run test
```

两处必须处理的差异：

1. **协议指纹改成严格相等**：`0.1.0-beta.3` 报 `2026-08-26`，`0.1.0-beta.4` 报 `fp-1`。握手与 SDK 的就绪行校验都是严格相等，所以**旧客户端连不上新运行时**。若用 `AGENT_STORE_BIN` 指向自建二进制，请把 SDK 与二进制**同批**升级（或直接升到 `@flowy-agent-store/runtime-win32-x64@0.1.0-beta.4`）。
2. **`ConversationEvent.event_type` 收窄**：读它并当 `string` 用的代码要按封闭联合 `ConversationEventType` 处理（`RunEvent.event_type` 仍是开放的 `string`，不受影响）。需要判别式分支时用包内解码器 `decodeConversationEvent(event)` 拿到 `DecodedConversationEvent`（带 `kind`），不要靠 `default: break` 静默吞掉未知类型。

加法项不需要改代码：技能文件树读面（`skill/files` / `skill/file`）、连接器调用代理（`connector/call`，默认全关）、`conversation/list-changed` 通知等。

### 6.4 从 0.1.0-beta.4 升到 0.1.0-beta.5

指纹再次严格相等（`fp-1` → `fp-7`），所以**必须升级**；但本版**没有类型收窄、没有方法增删**，所以**不需要改代码**：

```bash
# 1) 先看当前实际装的是什么
bun pm ls | grep '@flowy-agent-store'          # npm 项目：npm ls @flowy-agent-store/sdk
# 2) 固定到 0.1.0-beta.5（需要几个包就升几个，版本号保持一致）
bun add @flowy-agent-store/sdk@0.1.0-beta.5
bun add @flowy-agent-store/protocol@0.1.0-beta.5
# 3) 确认解析结果
node -p "require('@flowy-agent-store/sdk/package.json').version"
# 4) 重跑类型检查与测试——应当是零改动通过
bun run typecheck && bun run test
```

唯一必须处理的是**指纹**：`0.1.0-beta.4` 报 `fp-1`，本版报 `fp-7`。若用 `AGENT_STORE_BIN` 指向自建二进制，请把 SDK 与二进制**同批**升级（或直接升到 `@flowy-agent-store/runtime-win32-x64@0.1.0-beta.5`）。

新增的可选字段（都不改变现有行为）：`ConnectorTool.input_schema`、`ConnectorDetail.tools_truncated`、`ConnectorProbeResult.tools_truncated`、`ConversationCreateInput.agentId` / `teamId`、`AgentRunInput.model` / `reasoningEffort`、`ConversationView.reasoning_effort`、`MarketplaceSourceKind` 的 `"zip"`。

两处**行为**变化（签名不变，类型检查抓不到）：

1. **宿主配置 `[connector_proxy]` 的授权形状**（`fp-2`）：`allow` 由**必填的逐工具白名单**改为**可选收窄**，并新增 `deny`（在 `allow` 之后做减法）。现在的语义是——`enabled = true` 且**没有** `allow` ⇒ 该连接器的工具**全部可调**；写了 `allow` 就按它收窄，而 `allow` 存在但为空（`allow = []`）⇒ **什么都调不了**；整张表不存在 ⇒ 什么都不调。因此**此前只写了 `enabled = true`、没逐条列工具的宿主，升级后授权面会变大**，请重读该表；启动时会为此打一条告警（`enabled with neither "allow" nor "deny"`），按它核对即可。
2. **`conversation/send` 的 `mentions` 只认 `kind: "skill"`**（`fp-3`）：`agent` / `connector` 两类以 `invalid_request` 显式拒绝。该字段的类型面在 `0.1.0-beta.4` 就已发布，所以这一条只在运行期可见。

### 6.5 从 0.1.0-beta.5 升到 0.1.0-beta.6

**必须升级，而且必须改代码**：指纹没动（仍是 `fp-7`，wire 面与 `0.1.0-beta.5` 互通），但 `@flowy-agent-store/sdk` 的入口**改了名、也改了形状**——这是本版唯一的破坏性变更，也是它走预发布序号而不是 minor 号的原因。

```bash
# 1) 先看当前实际装的是什么
bun pm ls | grep '@flowy-agent-store'          # npm 项目：npm ls @flowy-agent-store/sdk
# 2) 固定到 0.1.0-beta.6（需要几个包就升几个，版本号保持一致）
bun add @flowy-agent-store/sdk@0.1.0-beta.6
bun add @flowy-agent-store/protocol@0.1.0-beta.6
# 3) 确认解析结果
node -p "require('@flowy-agent-store/sdk/package.json').version"
# 4) 重跑类型检查——这一次会**报错**，每个报错点就是要改的地方
bun run typecheck
```

**要改的三件事**（`launchClient` 返回的对象**就是**那个 client，不再有外壳）：

```ts
// 之前（0.1.0-beta.5）
const session = await launchClient({ client: { name: "my-app", version: "1.0.0" } });
await session.client.conversations.create({ name: "demo" });
session.initializeResult.protocol_version;

// 之后（0.1.0-beta.6）
const harness = await launchHarness({ client: { name: "my-app", version: "1.0.0" } });
await harness.conversations.create({ name: "demo" });
harness.handshake.protocol_version;
```

1. 函数 `launchClient` → **`launchHarness`**，类型 `LaunchedClient` → **`Harness`**、`LaunchOptions` → **`HarnessOptions`**；
2. 业务面**直接**挂在返回值上：`session.client.conversations` → `harness.conversations`（`store` / `agents` / `teams` / `skills` / `connectors` / `models` / `workspaces` / `runs` 同理）；
3. `initializeResult` → **`handshake`**（非空握手响应）。基类的 `initializeInfo` 仍在，语义是「**当前**连接状态」，`close()` 之后变回 `null`。

`close()` 的语义**变强**了：现在一次覆盖「退订 → 关传输 → 终止子进程 → 删除自动创建的 data-dir」。此前只调 `server.close()` 的代码留着也能跑，但不会再漏掉传输。

**不需要改的**：wire 面。指纹仍是 `fp-7`、方法计数仍是 `48 / 71`，所以 `0.1.0-beta.5` 的运行时与本版 SDK 可以混用（改名本身跨版本类型不兼容）。`client` 选项（自报身份）与直传 `transport.request(...)` 的用法都不变。

### 6.6 从 0.1.0-beta.6 升到 0.1.0-beta.7

**必须升级，但不需要改代码**：指纹从 `fp-7` 跳到 `fp-8`，握手与 SDK 按**严格相等**校验——`beta.6` 及更早版本的客户端**连不上**本版运行时，必须一并升级。除此之外，本版**只新增方法、没有类型收窄或改名**，SDK 入口仍是 `launchHarness`，所以调用方代码通常一行都不用动。

```bash
# 1) 先看当前实际装的是什么
bun pm ls | grep '@flowy-agent-store'          # npm 项目：npm ls @flowy-agent-store/sdk
# 2) 固定到 0.1.0-beta.7（需要几个包就升几个，版本号保持一致）
bun add @flowy-agent-store/sdk@0.1.0-beta.7
bun add @flowy-agent-store/protocol@0.1.0-beta.7
# 3) 确认解析结果
node -p "require('@flowy-agent-store/sdk/package.json').version"
# 4) 重跑类型检查与测试——应当是零改动通过
bun run typecheck
```

**要确认的两件事**：

```ts
// 指纹变了：手写断言过旧值的代码要放宽或改掉
harness.handshake.protocol_version;   // 现在是 "fp-8"，beta.6 的运行时是 "fp-7"

// 新增能力（可选）：把专家 / 专家团导出给外部 runtime
const pack = await harness.agents.export(agentId);
const team = await harness.teams.export(teamId);          // 团的定义，逐成员展开
```

1. **如果你断言过指纹的具体值**（例如拿 `handshake.protocol_version === "fp-7"` 当判据），它现在会**失败**——请改为与 `APP_SERVER_PROTOCOL_VERSION` 常量比较，或干脆不写死值。正常经 SDK 连接不受影响：SDK 自己会用新常量去校验，旧运行时会被直接拒绝。
2. **`AGENT_STORE_BIN` 注入自建二进制的**：SDK 与二进制必须**同批**升级，否则握手直接失败。

**顺带说明（不影响 SDK 用法）**：`~/.agent-store/config.toml` 的 `[memory]` 表新增 `enabled`（内置记忆总开关，默认**开**，不写即沿用上游默认，所以升级后行为不变），见[配置文件](/zh-CN/docs/configuration)的 `memory` 一节；`[models.*]` 的 `max_output_size` / `protocol` 此前**声明了却没有消费者**（会导致 anthropic / bedrock / vertex 协议的运行时以 `BAD_REQUEST` 失败），本版补齐了这条接线，并且**只填空、不覆盖**。这两项都**不进指纹**，只影响宿主读配置的行为——所以只升级 npm 包、不换运行时的，看不到它们。

## 7. 自查当前安装的版本

```bash
# 项目实际解析到的版本（先看这条）
bun pm ls | grep '@flowy-agent-store'      # npm：npm ls @flowy-agent-store/sdk
# 直接读已安装包的 package.json（三个包都导出 ./package.json）
node -p "require('@flowy-agent-store/protocol/package.json').version"
# 锁文件钉住的版本
grep -o '@flowy-agent-store/sdk@[0-9][^"]*' bun.lock | head -1
# 注册表上有什么、tag 指向哪
npm view @flowy-agent-store/sdk versions dist-tags --json
```

三者不一致时，以**锁文件与已安装包的 `package.json`** 为准：`package.json` 里的范围只表达意图，装进 `node_modules` 的才是事实。

## 8. 已发布产物的差异与自查方法

截至 `0.1.0-beta.7`（2026-09-20），**工作区与已发布产物一致**——`beta.7` 之后工作区**没有**新的未发布增量。`beta.6` 之后积累的两批内容都随本版发布：

1. **专家 / 专家团定义导出 —— `fp-7` → `fp-8`（破坏性）**：新增两个 WebSocket-only 方法 `agent/export` / `team/export`，方法计数 `48 / 71` → `48 / 73`（映射数不变）。完整条目见[变更日志](/zh-CN/docs/changelog) §2.1，迁移步骤见本文 §6.6。
2. **宿主配置增量 —— 零 wire 变更**：`~/.agent-store/config.toml` 的 `[memory]` 表新增 `enabled`（内置记忆总开关，与既有的 `distill_enabled` **独立**）；同批补齐了 `[models.*]` 的 `max_output_size` / `protocol` 接线。两者都**不进指纹**，所以**无法通过「对读两版产物」观察到**——它们只改变宿主读配置的行为，见[配置文件](/zh-CN/docs/configuration)。

`0.1.0-beta.6` 的 SDK 入口改名与形状变更见[变更日志](/zh-CN/docs/changelog) §2.2（迁移步骤见本文 §6.5），`0.1.0-beta.5` 的六次指纹递增见同页 §2.3，`0.1.0-beta.4` 相对 `0.1.0-beta.3` 的改动见同页 §2.4。下面的命令用来核对**协议面**差异——把任意两版已发布产物取回来对读。

> 口径：本节的自查命令只能证明**wire 面**是否一致。宿主配置类的增量（如上面的 `[memory] enabled` 与 `max_output_size`）不进指纹，因此对读产物**看不出**它们；判断这类改动要看[配置文件](/zh-CN/docs/configuration)而不看本文。

### 8.1 迁移已有配置里的市场源

官方三个市场源（`experts` / `skills` / `connectors`）已从本站的 `/source/<market>/…` 逐文件树迁到 ModelScope 上的 zip 归档，站点不再托管市场树。**没有自动改写地址**，所以升级后要人工处理一次——只影响配置里已经声明 `[default_marketplaces]` 的机器（`agent-store init` 或照旧文档手抄 URL 都会写进去）。

先看 `~/.agent-store/config.toml` 里有没有这三段：

```toml
[default_marketplaces.experts]
source_kind = "url"
source = "https://agent-store.flowyaipc.cn/source/experts/.codebuddy-plugin/marketplace.json"
```

有的话二选一：

- **删掉这三段 `[default_marketplaces.*]` 整块** —— 不下声明表时，运行时的内置默认源（即下面的 zip 地址）自动生效；
- **改成新的 zip 地址** —— 三个市场各一个归档，`source_kind = "zip"`：

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

若配置里没有这三段，就什么都不用做。**失败方式是温和的**：拉取失败不碰上一次成功留下的本地副本，条目不会消失，只是停在旧数据上。改完第一次拉取会下整个归档（三个市场里最大的是 experts 的 289.0 MiB）。

想自己核对「已发布产物里到底是什么」，按相邻两版对读最直观：

```bash
# beta.3：ConversationEvent.event_type 仍带 | string 兜底，指纹是日期戳
npm pack @flowy-agent-store/protocol@0.1.0-beta.3 --silent
tar xzf flowy-agent-store-protocol-0.1.0-beta.3.tgz
grep -n 'event_type' package/dist/index.d.mts
# 0.1.0 / 0.1.0-beta.2 / 0.1.0-beta.3 三者的 index.d.mts 都是 20049 字节，逐字节相同
# event_type: "message.created" | ... | "context.usage" | string;   ← 那个 | string 还在

# beta.4：同一处已是封闭联合，指纹是 fp-1
npm pack @flowy-agent-store/protocol@0.1.0-beta.4 --silent
tar xzf flowy-agent-store-protocol-0.1.0-beta.4.tgz
grep -n 'event_type:\|APP_SERVER_PROTOCOL_VERSION' package/dist/index.d.mts
# export declare const APP_SERVER_PROTOCOL_VERSION = "fp-1";
# event_type: ConversationEventType;   ← ConversationEvent（收窄）
# event_type: string;                  ← RunEvent，另一处声明，有意保持开放

# beta.5：指纹从 fp-1 跳到 fp-7，新增的只有可选字段
mkdir -p b4 b5
(cd b4 && npm pack @flowy-agent-store/protocol@0.1.0-beta.4 --silent && tar xzf *.tgz)
(cd b5 && npm pack @flowy-agent-store/protocol@0.1.0-beta.5 --silent && tar xzf *.tgz)
grep -n 'APP_SERVER_PROTOCOL_VERSION' b5/package/dist/index.d.mts
# export declare const APP_SERVER_PROTOCOL_VERSION = "fp-7";
diff <(grep -o '^export [a-z]* [A-Za-z]*' b4/package/dist/index.d.mts) \
     <(grep -o '^export [a-z]* [A-Za-z]*' b5/package/dist/index.d.mts)
# （无输出）141 个导出名一个不多一个不少 → 只是加字段，没有任何声明被收窄或删除
```

客户端侧同理：把 `@flowy-agent-store/client` 装进临时目录后数 `httpRouteTable()` 的键数，就是 §5.3 引用的映射数（`0.1.0-beta.5` 为 48）。协议侧的「没有增删类型」用上面那条 `diff` 数导出名即可核对——`0.1.0-beta.4` 与 `0.1.0-beta.5` 都是 **141 个**。

## 9. changelog 与 release notes 的边界

| 事项 | 现状 | 依据 |
| --- | --- | --- |
| 破坏性变更的版本号 | beta 线内随**下一个预发布序号**发布并在 changelog 明示；minor 号保留给退出 beta 之后 | 兼容性口径 D10=A（beta 期不承诺向后兼容）；口径修订记录见[变更日志](/zh-CN/docs/changelog) §3 |
| 独立 changelog / release notes 页 | ✅ **已建设**：[变更日志](/zh-CN/docs/changelog) | 计划文档 `16` 的 R6（批 4 落地） |
| 本页职责 | 只登记已发布的版本事实与已核实的未发布差异 | 不发明版本历史 |
| 本页与 changelog 的分工 | 本页讲**怎么升**；changelog 讲**每一版改了什么**，并且是破坏性变更的唯一公告面 | 两页交叉引用，不互相复制 |

因此本页给出的是**已发生的事**（发布时间、dist-tag、产物差异）与**已发布产物里实际有什么**（§8）。任何未在此列出的变更，不要假定它已经发生。

## 10. 另见

- [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk)：安装、API、事件与错误模型；可运行示例见 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk)。
- [快速开始](/zh-CN/docs/quick-start)：终端用户的安装包路径。
- [兼容性矩阵](/zh-CN/docs/compatibility)：平台与来源格式的支持范围。
- [变更日志](/zh-CN/docs/changelog)：每个已发布版本改了什么，以及破坏性变更的公告面。

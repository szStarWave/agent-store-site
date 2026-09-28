# TypeScript SDK 接口参考

Flowy Agent Store 提供三个配套的 TypeScript 软件包，用于在 Node.js、Electron 及浏览器环境中以强类型方式接入本地 App Server：

| 包 | 职责 | 运行环境 | 依赖 |
| --- | --- | --- | --- |
| `@flowy-agent-store/protocol` | 协议线类型定义（请求/响应/通知/错误） | 通用环境（零运行时，无 DOM/Node 依赖） | 无 |
| `@flowy-agent-store/client` | `AppServerClient` 核心客户端、9 个业务子客户端及 `Transport` 抽象 | 通用环境（无外部 I/O 绑定） | `@flowy-agent-store/protocol` |
| `@flowy-agent-store/sdk` | 宿主运行时进程管理（二进制拉起、回环建连与就绪客户端封装） | Node.js（依赖 `node:child_process` 等系统模块） | `@flowy-agent-store/client`、`@flowy-agent-store/protocol` |

三个包按集成场景组合使用：**仅需类型契约**时引入 `protocol`；**连接既有运行中的 App Server 实例**时引入 `client` 并注入 `WebSocketTransport`；**需在 Node 宿主中自主拉起并管理运行时生命周期**时使用 `sdk` 的 `launchHarness`。

完整示例（覆盖 Node、浏览器、Electron、商店管理、会话及 Run 调度）请参阅 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk)。

> **开发集成说明**：本文档面向开发者。终端桌面用户请直接下载预编译二进制安装包，详见 [快速开始](/zh-CN/docs/quick-start)。

---

## 1. 安装

```bash
# 通常只需要 sdk（它 re-export client 的能力并自带 spawn）
bun add @flowy-agent-store/sdk        # 或 npm install / pnpm add

# 需要协议类型时显式声明
bun add @flowy-agent-store/protocol
```

软件包均编译为 ESM 与 CJS 双重格式（在 `exports` 中提供 `import`、`require` 及 `types` 声明）。

> **版本状态**：三个包当前处于 `0.1.0-beta.*` 预发布阶段。生产环境建议锁定具体版本号（如当前与文档对齐的 `0.1.0-beta.7`）。版本演进规范与迁移步骤详见 [升级与迁移指引](/zh-CN/docs/upgrade)。
> **协议口径**：§2 中的 `APP_SERVER_PROTOCOL_VERSION` 与 §5.3 的方法计数基于当前仓库工作区契约。协议指纹执行严格全等校验，跨版本客户端与运行时不兼容。
> **运行环境**：Node.js **≥ 22**（需支持全局 `WebSocket`）或 Bun；版本要求以各包 `engines.node` 声明为准。

---

## 2. `@flowy-agent-store/protocol` — 协议层

### 2.1 定位

线协议的强类型事实来源：定义所有请求、响应、通知类型、`APP_SERVER_PROTOCOL_VERSION` 常量以及结构化错误类。该模块不包含网络 I/O 与传输实现，仅包含纯函数工具（错误判定、事件解码与本地化格式化），可供任意上层实现消费。

### 2.2 主要导出

| 导出 | 说明 |
| --- | --- |
| `APP_SERVER_PROTOCOL_VERSION` | 协议契约指纹（格式为 `fp-<n>` 单调自增标识，当前值为 `"fp-11"`）。握手与 SDK 初始化时执行严格全等校验，跨版本不兼容 |
| `InitializeRequest` / `InitializeResult` | 协议握手请求/响应载荷（包含 `protocol_version` 及服务端信息） |
| `ClientInfo` / `ClientCapabilities` | 客户端身份自述与能力声明 |
| `StoreList` / `StoreInstallResult` | 统一资源商店目录结构 |
| `AgentSummary` / `AgentDetail` | Agent 专家目录视图 |
| `TeamSummary` / `TeamDetail` | Agent Team 团队目录视图 |
| `SkillSummary` / `SkillDetail` | 技能目录视图 |
| `ConnectorSummary` / `ConnectorDetail` / `ConnectorStatusView` / `ConnectorProbeResult` | 连接器目录视图、运行时状态及连通性探测结果 |
| `OAuthStartResult` / `OAuthStatusView` | OAuth 鉴权流程状态视图 |
| `ConversationView` / `ConversationMessage` / `ConversationEvent` / `ConversationSendReceipt` | 持久会话视图及消息模型 |
| `RunReceipt` / `RunView` / `RunResult` / `RunEvent` | Run 执行实例生命周期模型 |
| `JsonRpcRequest` / `JsonRpcResponse` / `JsonRpcNotification` | 基础 RPC 报文线协议模型 |
| `ServerNotification` | 服务端下行推送通知（涵盖会话事件、列表变更及重同步信号等） |
| `WireError` | 服务端标准化错误载荷 |

> 协议导出面统一维护单一基线，不划分实验性分支。Team 团队协作及游标增量追平能力均位于同一协议接口面。

### 2.3 错误模型（包内 `errors.ts`）

调用方应基于稳定的错误标识 `code` 执行业务分支判断，避免依赖人类可读的 `message` 文本：

| 类型 | 触发 | 关键字段 |
| --- | --- | --- |
| `AppServerError` | 服务端返回的业务异常 JSON-RPC error | `code`、`requestId`（对应线协议 `request_id`）、`retryable`、`details` |
| `TransportError` | 传输层物理通信失败（建连、发送、接收、关闭） | `phase`（`connect`/`send`/`receive`/`close`）、`retryable` |
| `ProtocolError` | 本地协议层校验失败 | `kind`（`invalid_message` / `version_mismatch` / `unexpected_response`） |
| `RequestTimeoutError` | 接口请求响应超时 | `method`、`timeoutMs` |

辅助判断方法：

```ts
import { isAppServerError, isRetryableTransportError, formatError } from "@flowy-agent-store/protocol";

try {
  await client.runs.agent({ agentId, goal });
} catch (error) {
  if (isAppServerError(error)) {
    // 稳定 code（如 version_mismatch / marketplace_not_found），勿用 message
    console.log(error.code, error.retryable);
  } else if (isRetryableTransportError(error)) {
    // 连接断开、可重试
  }
  console.log(formatError(error)); // UI 唯一共享的错误渲染
}
```

> 幂等冲突（`conflict`）与策略拒绝（`policy_denied`）默认标记为不可重试（`retryable: false`）。

---

## 3. `@flowy-agent-store/client` — 传输无关客户端

### 3.1 定位

业务逻辑客户端抽象：所有 API 均依托外部注入的 `Transport` 实现，核心包内不硬编码特定网络协议。连接生命周期状态机（`connect → initialize → 版本校验 → initialized → ready`）在此层封装，隔离底层传输细节（如 WebSocket、stdio 或 HTTP）。

### 3.2 `Transport` 接口

```ts
export interface Transport {
  connect(): Promise<void>;                          // 建立通道（幂等）
  request<T>(method: string, params: unknown): Promise<T>;  // 请求-响应
  notify(method: string, params: unknown): void;     // 通知（无响应）
  onNotification(listener: NotificationListener): () => void; // 订阅下行通知，返回退订函数
  close(): void;
  onLifecycle?(listener: (state: "open" | "closed") => void): () => void; // 可选：通道生命周期
}
```

内置实现 `WebSocketTransport`（支持浏览器、Node 22+ 及 Bun，使用全局 `WebSocket`）：

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const transport = new WebSocketTransport({ url: "ws://127.0.0.1:8787/api/app-server/ws" });
const client = new AppServerClient(transport);
await client.connect();
```

### 3.3 业务子客户端接口

#### `connectors` — 连接器管理与调用

```ts
client.connectors.list(): Promise<ConnectorSummary[]>;
client.connectors.get(connectorId: string): Promise<ConnectorDetail>;        // 命名空间工具 + 认证态
client.connectors.status(connectorId: string): Promise<ConnectorStatusView>; // connected 仅在认证就绪且最近探测成功
client.connectors.test(connectorId: string): Promise<ConnectorProbeResult>;  // 运行连接探测（真连接、结果持久化）；工具签名从这里取
client.connectors.authStatus(connectorId: string): Promise<OAuthStatusView>; // 失败原因在 error 里；state 不会变成「失败」
client.connectors.authStart(connectorId: string): Promise<OAuthStartResult>; // 发起宿主浏览器 OAuth 流；只确认「浏览器已拉起」
client.connectors.waitForAuth(connectorId: string, options?: { timeoutMs?, pollMs? }): Promise<WaitForAuthOutcome>; // 等到结束，并带回失败原因
client.connectors.logout(connectorId: string): Promise<void>;                // 吊销令牌
client.connectors.call(connectorId: string, tool: string, args?: unknown): Promise<ConnectorCallResult>; // 调用代理
client.connectors.register(registration: ConnectorRegistration): Promise<ConnectorDetail>; // 交一个宿主没导入过的 MCP server（自带 key 的开发者入口，`fp-11`）
client.connectors.credentials(connectorId: string): Promise<ConnectorCredential>;      // 需要用户填的表单与状态（`fp-11`）
client.connectors.setCredentials(connectorId: string, values: Record<string, string>): Promise<ConnectorCredential>; // 存储并回新状态
client.connectors.clearCredentials(connectorId: string, keys?: string[]): Promise<ConnectorCredential>;              // keys 省略 = 全部 secret 字段
```

> **动态连接器注册**（`fp-11` 起支持）：开发者持有独立 MCP Server 及鉴权密钥时，可通过 `register()` 直接注册服务模板而无需打包为市场条目：
>
> ```ts
> const created = await client.connectors.register({
>   name: "acme-mcp",
>   transport: {
>     type: "http",
>     url: "https://mcp.acme.com/mcp",
>     headers: { Authorization: "Bearer ${secret:ACME_KEY}" },
>     values: {},                       // 连接器专有配置（对应 `${NAME}`）
>   },
> });
> created.credential?.missing;          // ["ACME_KEY"] —— 待填充键名
> await client.connectors.setCredentials(created.id, { ACME_KEY: process.env.ACME_KEY! });
> const probe = await client.connectors.test(created.id);   // 验证连通性
> ```
>
> 模板通过 `Bearer ${secret:NAME}` 或 stdio 环境变量 `secret:NAME` 声明密钥引用。系统自动派生凭据表单，`missing` 数组标明未配置的键名。
>
> 核心约束：
> - **凭据单向写入保护**：注册接口不接受明文密钥，敏感字段必须通过 `setCredentials()` 单独写入，查询响应中敏感字段严格脱敏。
> - **初始状态受控**：动态注册的连接器初始状态为 `disabled`，必须在连通性探测成功后方可激活。
> - **权限与幂等更新**：该接口限宿主所有者调用，相同名称重复注册将执行配置更新而非创建新实例。

> **凭据管理模型**（`fp-9` 引入）：`credentials(id)` 返回连接器的凭据状态块，包含 `mode`（`none` / `oauth` / `token`）、`status`（`not_required` / `requires_input` / `configured` / `error`）、`missing`（缺失键名列表）及 `fields[]`（表单字段定义）。敏感凭据按调用方主体（`<principal>:NAME`）隔离存储，接口响应严格过滤敏感字段值。
>
> 写入凭据通过 `setCredentials(id, values)` 完成，清理凭据调用 `clearCredentials(id, keys?)`。

> **工具代理调用**：`call()` 通过宿主维护的物理连接执行 MCP 工具，调用方仅需传递工具名与参数对象，底层连接参数、鉴权头与 OAuth 令牌由宿主托管。调用权限由宿主 `[connector_proxy]` 策略判定，拦截时返回 `policy_denied`。
>
> **参数校验模型**：`get()` 与 `test()` 返回的工具信息携带 `input_schema`（上游 `tools/list` 原始 JSON Schema）。客户端不做静态截断校验，参数非法由服务端返回 `{ is_error: true }`。

> **工具执行异常处理**：业务级工具错误返回 `{ is_error: true, content }` 载荷，不触发 Promise Reject。仅在无法触达工具或基础设施异常（超时、连接不可达、权限拦截、未找到）时抛出异常。

> **OAuth 流程机制**：OAuth 鉴权在宿主侧由受信任浏览器流完成，客户端仅负责触发与等待状态变更。`waitForAuth(id)` 执行异步轮询（默认超时 120s）。

#### `store` — 商店生命周期（获取 / 安装 / 使用 / 禁用 / 卸载）

```ts
client.store.list(): Promise<StoreItem[]>;
client.store.search(query: string, filter?: { kind?: StoreItemKind }): Promise<StoreItem[]>;
client.store.installed(): Promise<StoreItem[]>;
client.store.checkUpdates(): Promise<StoreItem[]>;                 // installed 且 update_available
client.store.updateHint(item): "none" | "uninstall_reinstall" | "unknown";
client.store.install(item, opts?: { waitForReady?, timeoutMs?, signal? }): Promise<StoreOperationOutcome>;
client.store.setEnabled(item, enabled: boolean, opts?: { componentIds? }): Promise<StoreOperationOutcome>;
client.store.uninstall(item, opts?: { componentIds? }): Promise<StoreOperationOutcome>;
```

> `store` 客户端对底层原子方法进行状态机编排。`install` 默认设置 `waitForReady: true`，对技能执行静态导入，对连接器执行激活与连通性轮询探测。`outcome.components` 逐项返回各组件的安装执行状态。

#### `conversations` — 持久会话

```ts
client.conversations.create(input): Promise<ConversationView>;  // model 省略时由服务端按 config.toml 解析默认模型
client.conversations.update(id, input): Promise<ConversationView>;
client.conversations.modelOptions(): Promise<ConversationModelOptions>;
client.conversations.list(limit = 100): Promise<ConversationView[]>;
client.conversations.get(id): Promise<ConversationView>;
client.conversations.messages(query): Promise<ConversationMessagesPage>; // page/page_size/cursor
client.conversations.send(id, content, idempotencyKey, options?): Promise<ConversationSendReceipt>; // 必须显式幂等键
client.conversations.cancel(id): Promise<ConversationView>;
client.conversations.delete(id): Promise<{ conversation_id: string; deleted: boolean }>;
await client.conversations.follow(id): Promise<ConversationSubscription>;
```

`send()` 的第 4 个参数为本轮执行选项：

```ts
client.conversations.send(id, content, key, {
  attachments: ["/abs/path/inside/workspace.png"],   // 会话工作区内的绝对路径
  mentions: [{ kind: "skill", id: "release-notes" }], // 本轮挂载的技能
});
```

> **技能动态挂载**：`mentions` 仅接受 `kind: "skill"`。技能按轮次动态挂载，不修改会话创建时的基础快照。传入非技能类型将被服务端显式拒绝（`invalid_request`）。

`send()` 同时支持动态调整当前会话的模型配置与推理深度：

```ts
await client.conversations.send(id, content, key, {
  model: { provider_id: "opencode", model: "mimo-v2.5" }, // 亦可为 config.toml 中配置的供应商名称
  reasoningEffort: "high",                                 // low | medium | high | xhigh | max
});
```

> **会话级配置生效机制**：配置更新写入会话记录，并对后续所有轮次持续生效。当会话正在执行轮次（`running`）时，修改模型将被拒绝并返回 `conflict`。

`create()` 支持指定 `agentId` 初始化绑定专家的会话：

```ts
const experts = await client.agents.list();
const architect = experts.find((agent) => agent.name === "software-architect");

const conv = await client.conversations.create({
  name: "重构讨论",
  agentId: architect!.id,     // agent/list 的 id；未安装会得到 agent_not_installed
});
```

> **专家绑定约束**：专家作为会话的静态身份在创建时冻结，其预置快照及依赖不可原地修改；变更专家需建立新会话。

`create()` 亦可通过 `teamId` 初始化专家团队 Leader 会话：

```ts
const teams = await client.teams.list();
const company = teams.find((team) => team.name === "Software Company");

const leader = await client.conversations.create({ teamId: company!.id });
// 沿用团队编排逻辑，初始化进入 Leader 交互会话
await client.conversations.send(leader.conversation_id, "把这版需求拆成计划", crypto.randomUUID());
```

> `teamId` 与 `agentId` 互斥。若团队成员未安装、被停用或依赖连接器不可达，会话创建将快速失败并返回对应错误码。

`modelOptions()` 返回的模型元数据包含 models.dev 目录信息（如 Token 费率 `cost_input`/`cost_output` 及上下文上限）。未收录模型对应字段缺省。

实时订阅对象：

```ts
const sub = await client.conversations.follow(convId);
sub.onEvent((event) => console.log("seq", event.sequence, event)); // 自动按 sequence 去重
sub.onResync((reason) => console.log("resync required:", reason)); // 断网追平提示
sub.lastSequence; // 已见最大序号
await sub.rearm(); // 重连后：重注册监听 + 游标归零 + 重发 conversation/subscribe
await sub.close(); // 服务器端退订（也可靠关闭 socket 隐式退订）
```

> `rearm()` 调用后建议通过 `conversation/messages` 拉取断网期间的消息快照以补充上下文。

#### `runs` — Run 生命周期与实时事件

```ts
client.runs.agent(input: AgentRunInput): Promise<RunReceipt>; // 异步回执，非最终结果
client.runs.team(input: TeamRunInput): Promise<TeamRunReceipt>; // Team Run：Leader 会话 + planned 委派
client.runs.get(runId): Promise<RunView>;                     // 权威状态
client.runs.plan(runId): Promise<RunPlan>;                    // 计划视图（run/plan，HTTP 也有绑定）
client.runs.result(runId): Promise<RunResult>;                // 终态后才成功
client.runs.events({ runId, afterSequence, limit }): Promise<RunEvent[]>; // 游标重放
client.runs.cancel({ runId, expectedVersion, commandId, idempotencyKey }): Promise<RunView>;
await client.runs.follow(runId): Promise<EventSubscription>;
```

`runs.agent()` 支持覆盖当前运行的模型与思考等级：

```ts
await client.runs.agent({
  agentId: architect!.id,
  goal: "把这版需求拆成计划",
  model: { provider_id: "opencode", model: "mimo-v2.5" },
  reasoningEffort: "high",
});
```

> 参数优先级：显式参数 > Preset 预设绑定 > 宿主默认配置（`default_model`）。

```ts
const sub = await client.runs.follow(runId);
sub.onEvent((event) => console.log(event));       // 尽力而为实时事件（可丢、可乱序）
sub.onResync(({ run_ids, reason }) => …);         // 订阅失效要求重放
sub.onError((error) => …);                        // 传输错误转发
sub.lastSequence;
const replayed = await sub.rearm();               // 重连后：游标归零 + 重订阅 + 全量重放
await sub.close();
```

> 事件语义是尽力而为：持久性依赖 `run/events` 游标重放，节点实现需自行去重排序。

#### `workspaces` — 工作区注册

```ts
client.workspaces.list(): Promise<WorkspaceView[]>;
client.workspaces.create(path: string): Promise<WorkspaceView>; // 服务端 canonicalize + 拒绝链接/重解析点
client.workspaces.revoke(workspaceId: string): Promise<WorkspaceRevokeResult>; // 软删除，会话保留
```

---

## 4. `@flowy-agent-store/sdk` — Node 宿主

### 4.1 `launchHarness(options): Promise<Harness>`

集成入口方法：负责定位并拉起运行时二进制进程、等待标准输出就绪通知获取动态端口、建立回环连接并完成 `initialize` / `initialized` 握手。返回的对象继承 `AppServerClient` 并附带进程管理句柄。

```ts
interface HarnessOptions extends SpawnOptions {
  client: ClientInfo;             // { name, version }
  capabilities?: ClientCapabilities;
  token?: string;                 // 传给 WebSocketTransport
  requestTimeoutMs?: number;      // 默认 30s（不足以覆盖首次 store/list，见 §3.3 警告）
}

interface Harness extends AppServerClient {
  server: SpawnedServer;          // readiness / dataDir / exited / close
  handshake: InitializeResult;    // 本次握手响应（非空）
  close(): Promise<void>;         // 退订 → 关传输 → 终止子进程 → 删临时 data-dir
}
```

`HarnessOptions` 配置字段：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `client` | — | **必填**；客户端身份标识，记录于服务端审计日志中 |
| `capabilities` | 省略 | 客户端功能特性声明（`{ events?, approvals?, team_runtime?, artifacts? }`） |
| `token` | 省略 | 传递给 `WebSocketTransport` 的鉴权令牌（拼装于 `?token=...` 查询参数中） |
| `requestTimeoutMs` | `30000` | 单次 RPC 请求超时时间（毫秒） |

`Harness` 实例成员：

| 成员 | 内容 | 用途 |
| --- | --- | --- |
| `conversations` / `agents` / `teams` / `skills` / `connectors` / `models` / `workspaces` / `runs` / `store` | `AppServerClient` 业务子客户端 | 直接通过 `harness` 句柄发起业务调用 |
| `handshake` | 握手响应对象（非空） | 校验与记录协议指纹及服务端版本 |
| `initializeInfo` | 当前就绪状态 | 监测连接连通性（`close()` 后为 `null`） |
| `server.readiness` | 就绪行解析结果对象 | 包含 host、port、url、protocol_version、auth 等元数据 |
| `server.dataDir` | 实际数据存储目录 | 用于目录检查与测试隔离审计 |
| `server.exited` | 进程退出 Promise | 监测子进程异常终止或退出信号 |
| `close()` | 资源清理函数 | 退订事件、关闭连接、终止子进程并清理自动生成的临时数据目录 |

> **边界说明**：`launchHarness` 不自动修改模型供应商配置（需通过 `config.toml` 配置）；未提供 `dataDir` 时采用临时沙箱目录；不自动捕获未处理的进程退出信号。

### 4.2 底层原语

| 导出 | 说明 |
| --- | --- |
| `spawnAppServer(options: SpawnOptions)` | 仅拉起子进程并等待 stdout 就绪通知（不建立通信连接） |
| `resolveAppServerBin(explicit?)` | 解析并定位可执行二进制路径 |
| `parseReadinessLine(line)` | 解析标准输出单行 JSON 就绪报文 |
| `ReadinessInfo` | 就绪通知元数据模型 `{ host, port, url, protocol_version, version, auth }` |
| `assertProtocolCompatible(runtimeVersion)` | 校验协议版本一致性，不符时抛出异常 |
| `SpawnExitInfo` | 子进程退出状态载荷 `{ code, signal }` |

`SpawnOptions` 接口定义：

```ts
interface SpawnOptions {
  bin?: string;            // 显式路径（覆盖一切）
  dataDir?: string;        // 自持 data-dir；省略则自动临时目录（close 时删除）
  port?: number;           // 默认 0 = 系统分配
  extraArgs?: string[];    // 追加 CLI 参数
  readyTimeoutMs?: number; // 默认 120s（冷启动建库）
  env?: Record<string, string | undefined>; // 在 process.env 之上合并
  cwd?: string;            // 子进程工作目录；省略即继承父进程
  onExit?: (info: SpawnExitInfo) => void;   // 子进程退出时回调一次
}
```

### 4.3 二进制定位

按以下优先级顺序解析：`bin` 参数 $\to$ 环境变量 `AGENT_STORE_BIN` $\to$ 平台可选运行时依赖包 `@flowy-agent-store/runtime-<platform>-<arch>` 中的内置可执行文件 $\to$ 系统 `PATH` 路径。均未命中时直接抛出错误。

```bash
AGENT_STORE_BIN=/opt/flowy-agent-store/flowy-agent-store node your-app.mjs
```

### 4.4 运行契约

- **回环网络隔离**：子进程强制绑定 `--host 127.0.0.1 --no-open`，客户端仅允许与本地回环建立连接。
- **数据目录互斥**：缺省时自动通过 `mkdtemp` 创建临时工作目录；指定既有目录时若被占用将快速失败退出。
- **协议版本门禁**：就绪报文中的 `protocol_version` 与 SDK 不一致时立即终止进程并抛出版本冲突异常。
- **就绪报文解析**：通过扫描子进程 stdout 中包含 `"agent_store":"listening"` 的单行 JSON 获取分配端口及状态。
- **标准输出持续排空**：就绪后 SDK 持续流式消费 stdout 避免底层 OS 管道缓冲区填满导致子进程阻塞。
- **环境配置合并**：`env` 字典与父进程 `process.env` 合并传递；`cwd` 缺省继承父进程当前路径。

### 4.5 错误与清理

- 启动失败抛出异常并附带 stderr 尾部输出；
- 超时保护：超出 `readyTimeoutMs`（默认 120s）未完成就绪即终止子进程；
- 建议在 `try/finally` 块中调用 `harness.close()`，确保临时文件及子进程句柄完全释放。

```ts
const harness = await launchHarness({ client: { name: "x", version: "1" } });
try {
  await harness.connectors.list();
} finally {
  await harness.close();
}
```

### 4.6 导出助手：`exportAgent` / `exportTeam` / `materializePack`

将专家/团队配置及关联技能资源打包固化到本地目录。底层编排现有的协议方法（`agent/export`、`team/export`、`skill/files`、`skill/file`），不修改线协议契约。

```ts
import { exportAgent, exportTeam, materializePack } from "@flowy-agent-store/sdk";

// 单专家；专家团用 exportTeam(client, teamId, dir, teamVersion?)（整包失败语义留在服务端）
const result = await exportAgent(client, agentId, "./my-expert");
result.pack;           // ExpertPack —— 内存里也拿得到
result.writtenSkills;  // 实际写入的技能名（跨成员去重后）
result.danglingSkills; // 声明了但本机取不到的技能：{ id, error }，如实上报不静默跳过
```

- **目录布局**：生成 `expert-pack.json`（核心元数据）、`persona.md`（专家形象定义）以及 `skills/<name>/...`（引用的具体技能资产）。
- **执行语义**：采用预拉取校验再写入机制，元数据查询失败时不产生碎片文件。

---

## 5. 逐方法 API 参考

### 5.1 `AppServerClient` 顶层方法

| 方法 | 参数 | 返回 | 协议方法 |
| --- | --- | --- | --- |
| `connect()` | — | `InitializeResult` | `initialize` → `initialized` |
| `onNotification(listener)` | `(notification) => void` | 取消订阅函数 | —（服务端通知） |
| `close()` | — | `void` | — |
| `runImport(input)` | `ImportRequest` | `ImportResult` | `import/run` |
| `listImports()` | — | `ImportSummary[]` | `import/list` |
| `getImport(snapshotId)` | `string` | `ImportDetail` | `import/get` |
| `runInstall(input)` | `InstallRequest` | `InstallResult` | `install/run` |
| `getInstallStatus(snapshotId)` | `string` | `InstallStatus` | `install/status` |
| `disableInstall(snapshotId, componentIds)` | `string, string[]` | `InstallStatus` | `install/disable` |
| `enableInstall(snapshotId, componentIds)` | `string, string[]` | `InstallStatus` | `install/enable` |
| `uninstallInstall(snapshotId, componentIds)` | `string, string[]` | `InstallStatus` | `install/uninstall` |
| `addMarketplace(input)` | `MarketplaceAddRequest` | `MarketplaceSummary` | `market/add` |
| `listMarketplaces()` | — | `MarketplaceSummary[]` | `market/list` |
| `getMarketplace(marketplaceId)` | `string` | `MarketplaceDetail` | `market/get` |
| `removeMarketplace(marketplaceId, cascade)` | `string, boolean` | `MarketplaceRemoveResult` | `market/remove` |
| `setMarketplaceAutoUpdate(marketplaceId, enabled)` | `string, boolean` | `MarketplaceSummary` | `market/auto-update` |
| `refreshMarketplace(marketplaceId)` | `string` | `MarketplaceRefreshResult` | `market/refresh` |
| `importMarketplaceEntry(marketplaceId, entryName)` | `string, string` | `ImportResult` | `market/entry-import` |
| `listStore()` | — | `StoreList` | `store/list` |
| `installStoreEntry(marketplaceId, entryName)` | `string, string` | `StoreInstallResult` | `store/install-entry` |

### 5.2 子客户端

| 子客户端 | 方法 | 协议方法 |
| --- | --- | --- |
| `agents` | `list()` / `get(agentId)` / `export(agentId)` | `agent/list` / `agent/get` / `agent/export` |
| `teams` | `list()` / `get(teamId)` / `export(teamId, teamVersion?)` | `team/list` / `team/get` / `team/export` |
| `skills` | `list()` / `get(skillId)` / `files(skillId)` / `readFile(skillId, path)` / `readFileWithType(skillId, path)` | `skill/list` / `skill/get` / `skill/files` / `skill/file` |
| `connectors` | `list()` / `get(id)` / `status(id)` / `test(id)` / `authStatus(id)` / `authStart(id)` / `waitForAuth(id, opts?)` / `logout(id)` / `call(id, tool, args?)` | `connector/list` · `get` · `status` · `test` · `auth/status` · `auth/start` · `auth/logout` · `call` |
| `store` | `list()` / `search(query, filter?)` / `installed()` / `checkUpdates()` / `updateHint(item)` / `install(item, opts?)` / `setEnabled(item, enabled, opts?)` / `uninstall(item, opts?)` | 组合方法，无独立 wire 方法：`store/list` · `store/install-entry` · `install/run` · `install/status` · `install/disable` · `install/enable` · `install/uninstall` |
| `conversations` | `create(input)` / `update(id, input)` / `modelOptions()` / `list(limit?)` / `get(id)` / `messages(query)` / `send(id, content, idempotencyKey, options?)` / `cancel(id)` / `delete(id)` / `follow(id, options?)` | `conversation/*` 同名方法 |
| `runs` | `agent(input)` / `team(input)` / `get(id)` / `plan(id)` / `result(id)` / `events(query)` / `cancel(input)` / `steer(input)` / `answerDecision(input)` / `follow(id, options?)` | `agent/run` · `team/run` · `run/get` · `run/plan` · `run/result` · `run/events` · `run/cancel` · `run/steer` · `run/answer-decision` |
| `workspaces` | `list()` / `create(path)` / `revoke(id)` | `workspace/list` / `workspace/create` / `workspace/revoke` |
| `models` | `list()` | `models/list` |

### 5.3 HTTP 绑定

HTTP 与 WebSocket 为同一套方法契约的两种传输绑定。`httpRouteTable()` 返回映射路由表：

```ts
import { httpRouteTable } from "@flowy-agent-store/client";

const routes = httpRouteTable();
// { "market/remove": { verb: "POST", path: "/markets/:marketplace_id/remove", source: "…" }, … }
```

- 覆盖 **52 / 77** 个协议方法。未包含在路由表中的 25 个方法主要涵盖握手接口、长连接推送及宿主本地特权管理面。
- 宿主管理接口（如 `config/get`、`config/set`、`config/get-mcp`、`skill/create` 等）仅暴露于本地管理连接，不向公共客户端开放。

### 5.4 审批回答：`run/answer-decision`

当执行暂停并进入人工审批状态时，`run/events` 抛出 `approval.requested`，调用方通过 `runs.answerDecision(input)` 提交决策：

```ts
const pending = (await client.runs.events({ runId })).find(
  (event) => event.event_type === "approval.requested",
);

await client.runs.answerDecision({
  runId,
  stepId: pending.step_id!,                    // 事件投影的 attempt 作用域
  attemptId: pending.attempt_id!,
  answer: "批准，继续执行",
  expectedExecutionVersion: pending.expected_execution_version!,  // 三个 CAS 版本
  expectedStepVersion: pending.expected_step_version!,
  expectedAttemptVersion: pending.expected_attempt_version!,
});
```

- **CAS 乐观并发控制**：三个 `expected*Version` 参数为必填版本校验令牌，版本不匹配时直接返回 `conflict`。
- 仅处于 `waiting_input` 状态的执行步骤允许提交回答。

## 6. 事件参考：`sequence` 与追平

### 6.1 事件类型

`ConversationEventType` 包含 9 种联合枚举：

| 事件类型 | 含义 | 解码后 kind |
| --- | --- | --- |
| `message.created` | 新消息已持久化入库 | `message.created` |
| `message.delta` | 消息正文增量内容 | `message.delta` |
| `message.thinking` | 推理思考段落增量 | `message.thinking` |
| `message.tips` | 系统提示与警告条目 | `message.tips` |
| `message.tool` | 工具调用执行状态流转 | `message.tool` |
| `message.error` | 终态异常载荷 | `message.error` |
| `message.activity` | 交互活动与轮次完成事件 | `message.activity` |
| `turn.status` | 轮次运行状态变更通知 | `turn.status` |
| `context.usage` | 上下文 Token 用量统计 | `context.usage` |

### 6.2 `sequence` 语义

- `sequence` 为单会话连接维度的自增连续序列号，断开重连后序列号重置；
- 收到 `sequence > lastSeen + 1` 判定为网络丢帧，触发追平通知；
- 重复或乱序消息由客户端本地静默过滤。

### 6.3 追平（catch-up）

| 场景 | 服务端信号 | 追平手段 | 包内入口 |
| --- | --- | --- | --- |
| 会话 | `conversation/resync-required` | `conversation/messages` 重新拉取（V1 不提供会话事件回放） | `follow(..., { fetchMessages })` → `onBackfill` |
| Run | `run/resync-required` | `run/events` 带 `after_sequence` 回放 | `follow()` 自动追平；手动只有 **`resync()`**（`catchUp()` **不是**追平——它只把已持久化事件标为已见、**不投递**，`follow()` 建订阅时自己调它一次） |

```ts
const subscription = await client.conversations.follow(conversationId);
subscription.onEvent((event) => {
  const decoded = decodeConversationEvent(event);
  if (decoded.kind === "message.delta") render(decoded.delta, decoded.replace);
});
subscription.onBackfill((snapshot) => resetTranscript(snapshot.messages));
subscription.onError((error) => report(error));
```

## 7. 错误模型与重试

| 类 | 出现场景 | `retryable` |
| --- | --- | --- |
| `AppServerError` | 服务端返回的业务错误；带 `code` / `requestId` / `details` | 由服务端 hint 决定 |
| `TransportError` | 连接、发送、接收、关闭失败；带 `phase` | 由 `phase` 与调用方判定 |
| `ProtocolError` | 报文不合规、版本不匹配、响应不符合预期；带 `kind` | 否 |
| `RequestTimeoutError` | 请求超时；带 `method` / `timeoutMs` | 否 |

`withRetry(operation, options)` 提供指数退避重试能力：

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `maxAttempts` | `3` | 含首次在内的总尝试次数 |
| `baseDelayMs` | `500` | 首次退避 |
| `maxDelayMs` | `8000` | 单次退避上限 |
| `jitter` | `0.25` | 抖动比例，延迟落在 `[0.75×, 1.0×]` |
| `onRetry` | — | 每次重试前回调 `{ attempt, delayMs, error }` |
| `shouldRetry` | 协议 `retryable` | 自定义判定 |
| `sleep` | `setTimeout` | 注入用（测试） |

带有 `idempotency_key` 的写操作支持安全幂等重试。

## 8. MCP 接入指南

连接器声明格式与位置：

| 场景 | 声明位置 |
| --- | --- |
| 连接器市场条目 | `.codebuddy-connector/connectors.json` 的条目 |
| 插件自带的 MCP server | 插件清单的 `mcpServers` 字段 |

敏感参数在导入时自动转换为 `secret:<KEY>` 占位引用，运行时仅从安全存储中解析并注入内存。详细格式见 [插件与市场](/zh-CN/docs/plugins-market)。

## 9. 下一步

- 协议方法语义全集：见仓库 `docs/agent-store/05-flowy-agent-store-app-server-protocol.md`。
- 包实现与测试样例：`web/packages/{protocol,client,sdk}/src`。
- 业务实战示例：[TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk)。

# TypeScript SDK 接口参考

Flowy Agent Store 提供三个分层解耦的官方 TypeScript 软件包，支持在 Node.js、Electron 及浏览器环境中以强类型形式访问本地 App Server：

| 包名 | 架构职责 | 运行环境 | 核心依赖 |
| --- | --- | --- | --- |
| `@flowy-agent-store/protocol` | 协议线类型定义（请求/响应/通知/错误）与编解码工具 | 通用环境（零运行时开销，无 Node/DOM 依赖） | 无 |
| `@flowy-agent-store/client` | `AppServerClient` 核心客户端、9 个业务子客户端及 `Transport` 抽象 | 通用环境（不绑定特定 I/O 实现） | `@flowy-agent-store/protocol` |
| `@flowy-agent-store/sdk` | 宿主运行时进程管理（二进制查找、回环建连、动态端口分配与就绪封装） | Node.js ≥ 22 或 Bun | `@flowy-agent-store/client`、`@flowy-agent-store/protocol` |

三个包按集成场景灵活组合：**仅需契约类型定义**时引入 `protocol`；**连接既有运行中的 App Server 实例**时使用 `client`；**由 Node.js 进程托管运行时生命周期**时使用 `sdk` 的 `launchHarness`。

完整场景应用范例请参阅配套的 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk)。

> **集成前置说明**：本文档面向开发者集成。终端桌面用户推荐直接安装官方可执行程序，详见 [快速开始](/zh-CN/docs/quick-start)。

---

## 1. 安装与包架构分工

```bash
# 标准场景：引入 SDK 统一封装（内置 client 与进程托管能力）
bun add @flowy-agent-store/sdk # 或 npm install @flowy-agent-store/sdk

# 仅消费协议类型定义
bun add @flowy-agent-store/protocol
```

所有软件包均提供标准的 ESM 与 CommonJS 双格式产物，通过 `package.json` 的 `exports` 字段导出 TypeScript 类型定义。

> **版本发布规范**：当前软件包处于 `0.1.0-beta.*` 预发布阶段。生产环境建议锁定固定版本号（如 `0.1.0-beta.7`）。版本演进机制详见 [升级与迁移指引](/zh-CN/docs/upgrade)。
> **环境要求**：Node.js 运行环境要求 **≥ 22.0.0**（依托全局内置 `WebSocket` 支持）或 Bun ≥ 1.1。

---

## 2. `@flowy-agent-store/protocol` — 协议层

### 2.1 模块定位与职责

协议层是整个生态的强类型事实源：定义全部 JSON-RPC 请求、响应、下行通知载荷、常量契约及标准化错误模型。该模块不产生网络 I/O，仅包含无副作用的纯函数工具（事件反序列化、状态断言与错误格式化）。

### 2.2 核心导出与类型定义

| 导出符号 | 类型定义与用途 |
| --- | --- |
| `APP_SERVER_PROTOCOL_VERSION` | 协议指纹常量（当前值为 `"fp-12"`）。建连握手时执行全等校验，跨版本不兼容 |
| `InitializeRequest` / `InitializeResult` | 协议初始化握手载荷（交换协议版本、客户端标识及服务端能力集） |
| `ClientInfo` / `ClientCapabilities` | 客户端身份声明（名称、版本）与能力声明（`events`、`approvals`、`team_runtime`） |
| `StoreList` / `StoreItem` / `StoreInstallResult` | 统一资源商店目录结构与安装回执模型 |
| `AgentSummary` / `AgentDetail` | Agent 专家目录概要与详细配置视图 |
| `TeamSummary` / `TeamDetail` | 专家团队目录概要与多 Agent 拓扑配置 |
| `SkillSummary` / `SkillDetail` | 原子技能元数据与权限标记 |
| `ConnectorSummary` / `ConnectorDetail` / `ConnectorStatusView` | 连接器目录视图、运行时连通性与探测结果 |
| `ConnectorRegistration` / `ConnectorCredential` | 动态 MCP 连接器注册配置与凭据表单状态 |
| `ConversationView` / `ConversationMessage` / `ConversationEvent` | 会话视图、历史消息结构及流式增量事件模型 |
| `RunReceipt` / `RunView` / `RunResult` / `RunEvent` | 批处理任务生命周期模型与决策事件 |
| `ServerNotification` / `WireError` | 服务端下行推送通知与标准化错误传输载荷 |

### 2.3 结构化错误模型与判定工具

调用方应始终依托结构化的 `code` 标识执行业务分流，避免解析依赖本地化语言的人类可读 `message`：

| 错误类 | 抛出触发条件 | 核心专有字段 |
| --- | --- | --- |
| `AppServerError` | 服务端返回的业务异常 JSON-RPC 响应 | `code`（枚举错误码）、`requestId`、`retryable`、`details` |
| `TransportError` | 物理传输通道异常（连接断开、发送失败、套接字超时） | `phase`（`connect`/`send`/`receive`/`close`）、`retryable` |
| `ProtocolError` | 本地协议契约违规（报文解析失败、版本不兼容、非法数据） | `kind`（`invalid_message`/`version_mismatch`/`unexpected_response`） |
| `RequestTimeoutError` | 单次 RPC 请求超时未收到确认响应 | `method`、`timeoutMs` |

```ts
import { isAppServerError, isRetryableTransportError, formatError } from "@flowy-agent-store/protocol";

try {
  await client.runs.agent({ agentId, goal });
} catch (error) {
  if (isAppServerError(error)) {
    // 依据稳定业务错误码进行确定性分支处理（如 agent_not_installed / conflict）
    console.error(`业务异常: code=${error.code}, 可重试=${error.retryable}`);
  } else if (isRetryableTransportError(error)) {
    // 属于瞬时网络闪断，可安全进入重试逻辑
    console.warn("网络连接瞬时异常，准备重连");
  }
  console.error("规范格式化错误描述:", formatError(error));
}
```

---

## 3. `@flowy-agent-store/client` — 客户端层

### 3.1 客户端生命周期与 Transport 抽象

`AppServerClient` 抽象了核心业务操作，网络传输通过外部注入的 `Transport` 解耦。客户端内部维护标准的生命周期状态机：`idle → connecting → initializing → ready → closed`。

```ts
export interface Transport {
  connect(): Promise<void>;                                      // 建立物理网络通道（幂等）
  request<T>(method: string, params: unknown): Promise<T>;       // 双向请求-响应调用
  notify(method: string, params: unknown): void;                  // 单向通知调用（无回执）
  onNotification(listener: NotificationListener): () => void;     // 注册下行通知监听，返回退订函数
  close(): void;                                                 // 物理断开连接
  onLifecycle?(listener: (state: "open" | "closed") => void): () => void; // 通道生命周期变化监听
}
```

官方内置提供 `WebSocketTransport` 实现，支持在浏览器与 Node.js 22+ 中直接使用：

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const transport = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", {
  token: process.env.AGENT_STORE_TOKEN,
  requestTimeoutMs: 30_000,
});
const client = new AppServerClient({
  transport,
  client: { name: "desktop-app", version: "1.0.0" },
});
await client.connect();
```

### 3.2 顶层生命周期方法

`AppServerClient` 实例直接挂载顶层生命周期与管理方法：

| 方法签名 | 入参说明 | 返回值契约 | 对应底层协议方法 |
| --- | --- | --- | --- |
| `connect()` | 无 | `Promise<InitializeResult>` | `initialize` → `initialized` |
| `close()` | 无 | `void` | 客户端本地状态重置与连接释放 |
| `onNotification(listener)` | 下行消息回调函数 | 退订闭包函数 `() => void` | 监听服务端广播通知 |
| `listStore()` | 无 | `Promise<StoreList>` | `store/list` |
| `installStoreEntry(marketplaceId, entryName)` | 市场 ID 与条目名称 | `Promise<StoreInstallResult>` | `store/install-entry` |
| `listMarketplaces()` | 无 | `Promise<MarketplaceSummary[]>` | `market/list` |
| `addMarketplace(input)` | 市场源配置请求体 | `Promise<MarketplaceSummary>` | `market/add` |
| `refreshMarketplace(marketplaceId)` | 目标市场 ID | `Promise<MarketplaceRefreshResult>` | `market/refresh` |
| `removeMarketplace(marketplaceId, cascade)` | 目标市场 ID 与是否级联删除 | `Promise<MarketplaceRemoveResult>` | `market/remove` |

### 3.3 业务子客户端完整参考

#### `agents` — 专家目录与导出

```ts
// 1. 查询全部已安装及可用的专家概要
client.agents.list(): Promise<AgentSummary[]>;

// 2. 查询指定专家的详细配置视图（包含绑定的技能与连接器依赖）
client.agents.get(agentId: string): Promise<AgentDetail>;

// 3. 导出专家完整定义包（包含 Persona 指令及配置契约）
client.agents.export(agentId: string): Promise<ExpertPack>;
```

#### `teams` — 专家团队目录与协同

```ts
// 1. 查询已配置的专家团队列表
client.teams.list(): Promise<TeamSummary[]>;

// 2. 查询指定团队的拓扑定义（成员角色与协作规则）
client.teams.get(teamId: string): Promise<TeamDetail>;

// 3. 导出团队全量定义包（支持传入可选的语义化版本进行校验）
client.teams.export(teamId: string, teamVersion?: string): Promise<ExpertPack>;
```

#### `skills` — 技能检索与内部文件读取

```ts
// 1. 列出本地所有原子技能摘要
client.skills.list(): Promise<SkillSummary[]>;

// 2. 获取技能详细定义
client.skills.get(skillId: string): Promise<SkillDetail>;

// 3. 列出指定技能目录下的所有静态资源清单
client.skills.files(skillId: string): Promise<SkillFileList>;

// 4. 读取技能包内的指定文件字节数组
client.skills.readFile(skillId: string, path: string): Promise<Uint8Array>;
```

#### `connectors` — 连接器管理、动态注册与工具代理

```ts
// 1. 目录与状态查询
client.connectors.list(): Promise<ConnectorSummary[]>;
client.connectors.get(connectorId: string): Promise<ConnectorDetail>;
client.connectors.status(connectorId: string): Promise<ConnectorStatusView>;
client.connectors.test(connectorId: string): Promise<ConnectorProbeResult>;

// 2. OAuth 授权流程
client.connectors.authStatus(connectorId: string): Promise<OAuthStatusView>;
client.connectors.authStart(connectorId: string): Promise<OAuthStartResult>;
client.connectors.waitForAuth(connectorId: string, options?: { timeoutMs?: number }): Promise<WaitForAuthOutcome>;
client.connectors.logout(connectorId: string): Promise<void>;

// 3. 工具动态代理调用
client.connectors.call(connectorId: string, tool: string, args?: unknown): Promise<ConnectorCallResult>;

// 4. 动态连接器注册与凭据表单管理
client.connectors.register(registration: ConnectorRegistration): Promise<ConnectorDetail>;
client.connectors.credentials(connectorId: string): Promise<ConnectorCredential>;
client.connectors.setCredentials(connectorId: string, values: Record<string, string>): Promise<ConnectorCredential>;
client.connectors.clearCredentials(connectorId: string, keys?: string[]): Promise<ConnectorCredential>;
```

#### `store` — 资源市场综合生命周期

```ts
// 1. 统一目录检索
client.store.list(): Promise<StoreItem[]>;
client.store.search(query: string, filter?: { kind?: StoreItemKind }): Promise<StoreItem[]>;
client.store.installed(): Promise<StoreItem[]>;

// 2. 状态机安装与版本管理
client.store.install(item: StoreItem, options?: { waitForReady?: boolean; timeoutMs?: number }): Promise<StoreOperationOutcome>;
client.store.update(item: StoreItem, options?: { waitForReady?: boolean; timeoutMs?: number }): Promise<StoreOperationOutcome>;
client.store.checkUpdates(): Promise<StoreItem[]>;
client.store.updateHint(item: StoreItem): "none" | "update" | "unknown";

// 3. 启用状态切换与完全卸载
client.store.setEnabled(item: StoreItem, enabled: boolean): Promise<StoreOperationOutcome>;
client.store.uninstall(item: StoreItem): Promise<StoreOperationOutcome>;
```

#### `conversations` — 会话创建、模型配置与交互

```ts
// 1. 会话生命周期
client.conversations.create(input: ConversationCreateInput): Promise<ConversationView>;
client.conversations.get(conversationId: string): Promise<ConversationView>;
client.conversations.list(limit?: number): Promise<ConversationView[]>;
client.conversations.update(conversationId: string, input: ConversationUpdateInput): Promise<ConversationView>;
client.conversations.delete(conversationId: string): Promise<{ conversation_id: string; deleted: boolean }>;

// 2. 消息流与交互发送
client.conversations.messages(query: ConversationMessagesQuery): Promise<ConversationMessagesPage>;
client.conversations.send(
  conversationId: string,
  content: string,
  idempotencyKey: string,
  options?: ConversationSendOptions,
): Promise<ConversationSendReceipt>;
client.conversations.cancel(conversationId: string): Promise<ConversationView>;

// 3. 流式订阅与模型元数据
client.conversations.follow(conversationId: string): Promise<ConversationSubscription>;
client.conversations.subscribe(conversationId: string, onEvent: (event: ConversationEvent) => void): () => void;
client.conversations.modelOptions(): Promise<ConversationModelOptions>;
```

#### `runs` — 独立任务批处理、计划与审批

```ts
// 1. 触发任务执行
client.runs.agent(input: AgentRunInput): Promise<RunReceipt>;
client.runs.team(input: TeamRunInput): Promise<TeamRunReceipt>;

// 2. 状态监控与执行计划
client.runs.get(runId: string): Promise<RunView>;
client.runs.plan(runId: string): Promise<RunPlan>;
client.runs.result(runId: string): Promise<RunResult>;
client.runs.events(query: RunEventsQuery): Promise<RunEvent[]>;

// 3. 任务干预、审批提交与流式追踪
client.runs.cancel(input: CancelRunInput): Promise<RunView>;
client.runs.steer(input: SteerRunInput): Promise<RunView>;
client.runs.answerDecision(input: AnswerDecisionInput): Promise<RunView>;
client.runs.follow(runId: string): Promise<EventSubscription>;
```

#### `workspaces` — 本地工作区注册与权限管理

```ts
// 1. 查询当前已登记的工作区列表
client.workspaces.list(): Promise<WorkspaceView[]>;

// 2. 注册并规范化物理路径为安全工作区
client.workspaces.create(path: string): Promise<WorkspaceView>;

// 3. 注销工作区（软删除引用，不物理清空磁盘文件）
client.workspaces.revoke(workspaceId: string): Promise<WorkspaceRevokeResult>;
```

#### `models` — 可用模型元数据检索

```ts
// 查询当前宿主环境内已配置且可供调用的模型列表及费率参数
client.models.list(): Promise<ModelSummary[]>;
```

---

## 4. `@flowy-agent-store/sdk` — Node 宿主

### 4.1 `launchHarness` 集成入口

`launchHarness` 是 Node.js 宿主测试与集成环境下的标准入口。负责定位二进制进程、分配回环端口、建立 WebSocket 连接并完成协议握手：

```ts
export interface HarnessOptions extends SpawnOptions {
  client: ClientInfo;                  // 客户端身份标识（name, version）
  capabilities?: ClientCapabilities;   // 能力集声明（events, approvals, team_runtime）
  token?: string;                      // 传递给 WebSocketTransport 的凭据
  requestTimeoutMs?: number;           // 默认 RPC 超时（30,000 毫秒）
}

export interface Harness extends AppServerClient {
  server: SpawnedServer;               // 底层进程控制柄（readiness, dataDir, exited, close）
  handshake: InitializeResult;         // 本次初始化的服务端握手回执
  close(): Promise<void>;              // 退订事件 → 关闭通信 → 终止子进程 → 清理临时目录
}
```

配置字段契约：

| 配置字段 | 默认取值 | 行为说明 |
| --- | --- | --- |
| `client` | — | **必填项**；客户端唯一声明名称与版本号 |
| `capabilities` | `{}` | 客户端功能集声明，支持按需声明 `events`、`approvals` 等 |
| `token` | 省略 | 鉴权令牌，自动组装为 WebSocket 连接的 `?token=...` 查询参数 |
| `requestTimeoutMs` | `30000` | 单次 RPC 调用超时上限（毫秒） |

`Harness` 实例成员构成：

| 属性成员 | 类型定义 | 核心用途 |
| --- | --- | --- |
| `conversations` 等 9 个子模块 | `AppServerClient` 业务客户端 | 直接通过 `harness.<subclient>` 发起强类型调用 |
| `handshake` | `InitializeResult` | 读取已验证的协议版本指纹与服务端特性清单 |
| `server.readiness` | `ReadinessInfo` | 获取运行时动态分配的物理主机地址、端口及服务状态 |
| `server.dataDir` | `string` | 获取当前实例绑定的本地存储路径 |
| `server.exited` | `Promise<SpawnExitInfo>` | 监听子进程异常终止信号 |
| `close()` | `() => Promise<void>` | 释放网络长连接、终止子进程并安全回收资源 |

### 4.2 底层进程原语与配置选项

| 导出原语 | 接口签名与职责说明 |
| --- | --- |
| `spawnAppServer(options)` | 仅拉起运行时子进程并等待 stdout 就绪通知（不建立长连接） |
| `resolveAppServerBin(path?)` | 解析并定位可执行二进制绝对路径 |
| `parseReadinessLine(line)` | 解析标准输出中的单行 JSON 就绪日志并提取端口号 |
| `assertProtocolCompatible(ver)` | 校验协议指纹严格全等性，不匹配时抛出 `ProtocolError` |

```ts
export interface SpawnOptions {
  bin?: string;                             // 显式指定二进制路径
  dataDir?: string;                         // 显式数据存储路径（省略时自动创建临时目录并在 close 时回收）
  port?: number;                            // 监听端口（默认 0，由操作系统动态分配可用端口）
  extraArgs?: string[];                     // 附加 CLI 命令行启动参数
  readyTimeoutMs?: number;                  // 就绪等待超时上限（默认 120,000 毫秒）
  env?: Record<string, string | undefined>; // 传递给子进程的环境变量（与父进程合并）
  cwd?: string;                             // 子进程工作路径
  onExit?: (info: SpawnExitInfo) => void;    // 进程退出通知回调
}
```

### 4.3 二进制检索顺序与解析契约

SDK 定位运行时的顺序为：
1. `options.bin` 显式指定的路径；
2. 操作系统环境变量 `AGENT_STORE_BIN`；
3. 当前平台对应的可选安装包 `@flowy-agent-store/runtime-<platform>-<arch>` 的内置制品；
4. 宿主系统的系统 `PATH` 环境变量。

```bash
# 显式指定运行二进制路径
AGENT_STORE_BIN=/opt/flowy-agent-store/flowy-agent-store node app.mjs
```

所有未指定 `dataDir` 的实例均被视作临时测试环境，实例关闭时临时目录自动物理移除；显式提供 `dataDir` 时数据持久化保留。

```ts
const harness = await launchHarness({ client: { name: "test-runner", version: "1.0.0" } });
try {
  await harness.connectors.list();
} finally {
  await harness.close(); // 确保子进程与临时目录释放
}
```

### 4.4 导出助手函数

SDK 提供高阶导出工具，用于将专家与团队资产完整解构物化到本地磁盘：

```ts
import { exportAgent, exportTeam, materializePack, type ExportResult } from "@flowy-agent-store/sdk";

// 1. 导出单专家定义及关联技能资源到本地目录
const result: ExportResult = await exportAgent(client, "software-architect", "./dist/architect");
console.log(`成功导出技能: ${result.writtenSkills.join(", ")}`);
if (result.danglingSkills.length > 0) {
  console.warn("未在宿主安装的悬空技能引用:", result.danglingSkills);
}

// 2. 导出专家团队全量定义包（Leader 成员优先排列）
await exportTeam(client, "dev-team", "./dist/dev-team");

// 3. 将内存中的 ExpertPack 结构物理物化为磁盘目录
const pack = await client.agents.export("software-architect");
await materializePack(client, pack, "./dist/architect-manual");
```

物化产物遵循以下标准目录树规范：
- `expert-pack.json`：完整的标准化 `ExpertPack` 格式定义（包含 `pack_format`、角色信息及依赖清单）；
- `persona.md`：单专家的 Prompt 指令正文（仅 `kind === "agent"` 时生成）；
- `members/<member.id>/persona.md`：团队成员的专属 Persona 指令（仅 `kind === "team"` 时生成）；
- `skills/<name>/...`：引用的原子技能文件树，自动在顶层去重聚合。

---

## 5. 协议通信与 HTTP 路由绑定

### 5.1 HTTP 路由映射表（`httpRouteTable`）

部分只读查询与无状态写入支持通过 HTTP 直接调用，路由映射表由客户端内置导出：

```ts
import { httpRouteTable } from "@flowy-agent-store/client";

const routes = httpRouteTable();
// 输出: { "market/list": { verb: "GET", path: "/markets", ... }, ... }
console.log(`已映射 HTTP 接口总数: ${Object.keys(routes).length}`);
```

- 公共 HTTP 接口覆盖 **53 / 78** 个协议方法；
- 需保持持续双向通信的实时流式推送方法（如 `follow`）以及宿主本地特权接口不在 HTTP 中开放。

### 5.2 审批决策 CAS 乐观并发控制

当异步任务执行进入等待决策状态（`waiting_input`）时，调用方通过 `runs.answerDecision` 提交结构化决策：

```ts
const pendingEvent = (await client.runs.events({ runId })).find(
  (e) => e.event_type === "approval.requested",
);

await client.runs.answerDecision({
  runId,
  stepId: pendingEvent.step_id!,
  attemptId: pendingEvent.attempt_id!,
  answer: "确认批准操作",
  expectedExecutionVersion: pendingEvent.expected_execution_version!,
  expectedStepVersion: pendingEvent.expected_step_version!,
  expectedAttemptVersion: pendingEvent.expected_attempt_version!,
});
```

必须完整传入三个 `expected*Version` 乐观并发校验字段，版本不匹配时服务端快速返回 `conflict` 拒绝写入。

---

## 6. 事件流模型与断网追平机制

### 6.1 会话事件联合枚举（`ConversationEventType`）

实时会话流包含 9 种结构化联合类型：

| 事件枚举 | 触发场景 | 解码后标准 kind 标识 |
| --- | --- | --- |
| `message.created` | 会话消息完成入库与持久化 | `message.created` |
| `message.delta` | 模型流式文本输出增量 | `message.delta` |
| `message.thinking` | 推理思考块输出增量 | `message.thinking` |
| `message.tips` | 运行状态提示与警告 | `message.tips` |
| `message.tool` | 工具调用状态转换（调用、完成、异常） | `message.tool` |
| `message.error` | 轮次终态异常报错 | `message.error` |
| `message.activity` | 交互式动作与轮次结束标识 | `message.activity` |
| `turn.status` | 轮次流转生命周期变更 | `turn.status` |
| `context.usage` | 会话上下文与 Token 计费统计 | `context.usage` |

### 6.2 `sequence` 连续序号语义

- 每一个下行事件携带连接局部的单调自增连续整数 `sequence`；
- 当客户端检测到 `currentSequence > lastSeenSequence + 1` 时，判定发生了底层丢包，触发重同步追平流程；
- 客户端订阅实现自动针对重复 `sequence` 执行本地静默去重。

### 6.3 断网检测与增量追平策略

| 订阅类型 | 服务端失步通知 | 客户端追平实现 | 核心调用接口 |
| --- | --- | --- | --- |
| 会话流（Conversation） | `conversation/resync-required` | 拉取全量历史消息重建视图 | `follow()` 订阅后监听 `onBackfill` 回调 |
| 任务流（Run） | `run/resync-required` | 基于最后连续序号游标向后重放 | `follow()` 自动调度；手动调用 `client.runs.events({ afterSequence })` |

```ts
const subscription = await client.conversations.follow(conversationId);
subscription.onEvent((event) => {
  const decoded = decodeConversationEvent(event);
  if (decoded.kind === "message.delta") {
    process.stdout.write(decoded.delta);
  }
});
subscription.onBackfill((snapshot) => {
  console.log(`已执行断网回补，最新消息数: ${snapshot.messages.length}`);
});
```

---

## 7. 生产重试策略与故障恢复

### 7.1 指数退避重试（`withRetry`）

`@flowy-agent-store/client` 内置提供符合分布式规范的指数退避重试执行器：

| 配置选项 | 默认数值 | 机制说明 |
| --- | --- | --- |
| `maxAttempts` | `3` | 最大重试执行次数（包含首次请求） |
| `baseDelayMs` | `500` | 首次退避初始等待延迟（毫秒） |
| `maxDelayMs` | `8000` | 单次退避等待时间上限（毫秒） |
| `jitter` | `0.25` | 随机抖动因子，避免请求拥塞波峰 |
| `onRetry` | 省略 | 触发重试前的监控回调 `({ attempt, delayMs, error })` |

```ts
import { withRetry } from "@flowy-agent-store/client";

const result = await withRetry(() => client.runs.get(runId), {
  maxAttempts: 4,
  baseDelayMs: 300,
  maxDelayMs: 5000,
  onRetry: ({ attempt, delayMs, error }) => {
    console.warn(`第 ${attempt} 次尝试失败，等待 ${delayMs}ms 后重试:`, error);
  },
});
```

### 7.2 幂等性保障与重试安全边界

- **非幂等写操作安全边界**：向会话发送消息（`conversations.send`）必须显式传递 UUID 形式的 `idempotencyKey`，相同键重复投递不触发二次执行；
- **排他锁冲突处理**：相同 `dataDir` 具有单进程互斥锁，冲突时立即快速失败，禁止在无隔离保护下直接重试启动；
- **状态不一致规避**：对返回不可重试（`retryable: false`）的策略拒绝、版本冲突（`conflict`）与参数错误，重试器将直接终止抛出。

---

## 8. MCP 连接器声明规范

连接器在运行时的物理声明路径与位置规范：

| 声明场景 | 配置文件物理位置 |
| --- | --- |
| 市场分发连接器 | `.codebuddy-connector/connectors.json` 目录定义 |
| 插件内部绑定的私有 MCP 服务 | 插件清单描述文件的 `mcpServers` 字段 |

敏感参数在导入时自动转换为 `secret:<KEY>` 占位引用，运行时仅从安全存储中解析并注入内存。详细格式见 [插件与市场](/zh-CN/docs/plugins-market)。

---

## 9. 参考资源与相关文档

- 业务实战与开箱即用代码：[TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk)。
- 运行时底层配置参考：[配置文件说明](/zh-CN/docs/configuration)。
- 平台适配与 Node/OS 支持矩阵：[兼容性矩阵](/zh-CN/docs/compatibility)。
- 版本发布与升级历史：[升级与迁移指引](/zh-CN/docs/upgrade)。

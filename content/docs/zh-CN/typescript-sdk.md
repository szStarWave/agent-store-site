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
| `APP_SERVER_PROTOCOL_VERSION` | 协议指纹常量（当前值为 `"fp-19"`）。建连握手时执行全等校验，跨版本不兼容 |
| `InitializeRequest` / `InitializeResult` | 协议初始化握手载荷（交换协议版本、客户端标识及服务端能力集） |
| `ClientInfo` / `ClientCapabilities` | 客户端身份声明（名称、版本）与能力声明（`events`、`approvals`、`team_runtime`） |
| `StoreList` / `StoreItem` / `StoreInstallResult` | 统一资源商店目录结构与安装回执模型 |
| `StoreCategory` / `StoreCategories` | 市场分类字典与市场级标签全集（`store.categories()` 的返回形状） |
| `AgentSummary` / `AgentDetail` | Agent 专家目录概要与详细配置视图（均带 `tags` / `category_id`） |
| `TeamSummary` / `TeamDetail` | 专家团队目录概要与多 Agent 拓扑配置（带包级 `tags` / `category_id`） |
| `SkillSummary` / `SkillDetail` | 原子技能元数据与权限标记（带市场索引行来源的 `tags`） |
| `ExpertPack` / `ExpertPersona` / `ExpertAssetRef` | 专家导出契约（`pack_format 3`：persona、技能与资产引用、展示元数据） |
| `ConnectorSummary` / `ConnectorDetail` / `ConnectorStatusView` | 连接器目录视图、运行时连通性与探测结果 |
| `ConnectorRegistration` / `ConnectorCredential` | 动态 MCP 连接器注册配置与凭据表单状态 |
| `ConversationView` / `ConversationMessage` / `ConversationEvent` | 会话视图、历史消息结构及流式增量事件模型 |
| `RunReceipt` / `RunView` / `RunResult` / `RunEvent` | 批处理任务生命周期模型与决策事件 |
| `ServerNotification` / `WireError` | 服务端下行推送通知与标准化错误传输载荷 |
| `LocalizedText` / `LocalizedLang` | 多语言展示元数据契约（`{ en?, zh? }`）与语种枚举（`"zh"` \| `"en"`） |
| `pickLocalized` / `pickLocalizedList` | 本地化文案解析纯函数工具（按语种优先级链回退并过滤空值） |

### 2.3 结构化错误模型与判定工具

调用方应始终依托结构化的 `code` 标识执行业务分流，避免解析依赖本地化语言的人类可读 `message`：

| 错误类 | 抛出触发条件 | 核心专有字段 |
| --- | --- | --- |
| `AppServerError` | 服务端返回的业务异常 JSON-RPC 响应 | `code`（枚举错误码）、`requestId`、`retryable`、`details` |
| `TransportError` | 物理传输通道异常（连接断开、发送失败、套接字超时） | `phase`（`connect`/`send`/`receive`/`close`）、`retryable` |
| `ProtocolError` | 本地协议契约违规（报文解析失败、版本不兼容、非法数据） | `kind`（`invalid_message`/`version_mismatch`/`unexpected_response`） |
| `RequestTimeoutError` | 单次 RPC 请求超时未收到确认响应 | `method`、`timeoutMs` |

协议层导出的类型安全错误判定工具函数：

```ts
/** 判定捕获的异常是否为 App Server 服务端返回的业务错误 (AppServerError) */
export function isAppServerError(error: unknown): error is AppServerError;

/** 判定是否为可安全重试的网络传输异常（如物理断连、握手超时、套接字重置） */
export function isRetryableTransportError(error: unknown): boolean;

/** 将任意捕获的错误规范化格式化为可安全打印或落盘的诊断字符串 */
export function formatError(error: unknown): string;
```

业务错误分类与指数退避重试的完整实战模式请参阅 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §6.3。

---

## 3. `@flowy-agent-store/client` — 客户端层

### 3.1 客户端生命周期与 Transport 抽象

`AppServerClient` 抽象了核心业务操作，网络传输通过外部注入的 `Transport` 解耦。客户端内部维护标准的生命周期状态机：`idle → connecting → initializing → ready → closed`。

```ts
export interface Transport {
  /** 建立物理网络连接通道（具备幂等性） */
  connect(): Promise<void>;
  /** 发起标准的双向请求-响应 RPC 调用 */
  request<T>(method: string, params: unknown): Promise<T>;
  /** 发送单向通知消息（不等待服务端回执） */
  notify(method: string, params: unknown): void;
  /** 注册下行广播通知监听器，返回注销监听的退订闭包函数 */
  onNotification(listener: NotificationListener): () => void;
  /** 物理断开连接通道并清理底层套接字资源 */
  close(): void;
  /** 监听通信通道生命周期状态变动（open / closed） */
  onLifecycle?(listener: (state: "open" | "closed") => void): () => void;
}
```

官方内置的 `WebSocketTransport` 配置接口契约：

```ts
export interface WebSocketTransportOptions {
  /** 访问鉴权令牌（自动挂载为 WebSocket URL 的 ?token=... 查询参数） */
  token?: string;
  /** 单次 RPC 请求超时时间上限（毫秒，默认 30,000） */
  requestTimeoutMs?: number;
  /** 自定义底层 WebSocket 构造器实现（默认在 Node.js 环境使用全局全局 WebSocket） */
  WebSocket?: unknown;
}
```

客户端初始化与连接生命周期的完整实战请参阅 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §6.1。

### 3.2 顶层生命周期方法

`AppServerClient` 实例直接挂载顶层生命周期与管理方法：

| 方法签名 | 入参说明 | 返回值契约 | 对应底层协议方法 |
| --- | --- | --- | --- |
| `connect()` | 无 | `Promise<InitializeResult>` | `initialize` → `initialized` |
| `close()` | 无 | `void` | 客户端本地状态重置与连接释放 |
| `onNotification(listener)` | 下行消息回调函数 | 退订闭包函数 `() => void` | 监听服务端广播通知 |
| `readImportAsset(snapshotId, path)` | 导出快照 ID 与相对路径 | `Promise<Uint8Array>` | `import/assets` |
| `listStore()` | 无 | `Promise<StoreList>` | `store/list` |
| `installStoreEntry(marketplaceId, entryName)` | 市场 ID 与条目名称 | `Promise<StoreInstallResult>` | `store/install-entry` |
| `listMarketplaces()` | 无 | `Promise<MarketplaceSummary[]>` | `market/list` |
| `addMarketplace(input)` | 市场源配置请求体 | `Promise<MarketplaceSummary>` | `market/add` |
| `refreshMarketplace(marketplaceId)` | 目标市场 ID | `Promise<MarketplaceRefreshResult>` | `market/refresh` |
| `removeMarketplace(marketplaceId, cascade)` | 目标市场 ID 与是否级联删除 | `Promise<MarketplaceRemoveResult>` | `market/remove` |

### 3.3 业务子客户端完整参考

#### `agents` — 专家目录与导出

```ts
export interface AgentSummary {
  /** 专家唯一标识符（组件 ID，形如 wb-<包名>-expert 或自定义 ID） */
  id: string;
  /** 专家显示名称 */
  name: string;
  /** 专家能力描述与定位说明 */
  description: string;
  /** 所属分类唯一 ID（需通过 store.categories() 映射展示名） */
  category_id?: string | null;
  /** 双语标签列表（{ zh?: string; en?: string }） */
  tags?: Array<{ zh?: string; en?: string }>;
  /** 绑定的技能名称列表 */
  skills: string[];
  /** 所需连接器依赖 ID 列表 */
  connectors: string[];
}

export interface AgentDetail extends AgentSummary {
  /** 专家的 Prompt 人设指令正文 */
  persona: string;
  /** 绑定的推荐模型标识（如 gpt-4o 等） */
  model?: string;
  /** 系统预置的快捷输入提示词列表 */
  quick_prompts?: Array<{ zh?: string; en?: string }>;
}

export interface AgentsSubclient {
  /** 查询全部已安装及可用的专家概要 */
  list(): Promise<AgentSummary[]>;
  /** 查询指定专家的详细配置视图（包含绑定的技能与连接器依赖） */
  get(agentId: string): Promise<AgentDetail>;
  /** 导出专家完整定义包（包含 Persona 指令及配置契约） */
  export(agentId: string): Promise<ExpertPack>;
}
```

#### `teams` — 专家团队目录与协同

```ts
export interface TeamMemberSummary {
  /** 成员专家唯一标识 */
  id: string;
  /** 成员专家名称 */
  name: string;
  /** 成员在团队中承担的分工角色描述 */
  role: string;
  /** 成员自身声明的技能依赖列表 */
  skills: string[];
  /** 成员自身所属的独立分类 ID */
  category_id?: string | null;
  /** 成员独立声明的双语标签列表 */
  tags?: Array<{ zh?: string; en?: string }>;
}

export interface TeamSummary {
  /** 专家团队唯一标识（组件 ID，形如 wb-<包名>-team） */
  id: string;
  /** 团队显示名称 */
  name: string;
  /** 团队协同功能描述 */
  description: string;
  /** 团队包所属分类 ID */
  category_id?: string | null;
  /** 团队包级声明的双语标签列表 */
  tags?: Array<{ zh?: string; en?: string }>;
  /** 团队包级声明的全局技能列表 */
  skills: string[];
  /** 团队包含的成员专家概要列表 */
  members: TeamMemberSummary[];
}

export interface TeamDetail extends TeamSummary {
  /** 团队多智能体协作拓扑模式（如 sequential / hierarchical / broadcast） */
  topology: string;
  /** 团队主导协调专家（Leader）的唯一 ID */
  leader_id: string;
}

export interface TeamsSubclient {
  /** 查询已配置的专家团队列表 */
  list(): Promise<TeamSummary[]>;
  /** 查询指定团队的拓扑定义（成员角色与协作规则） */
  get(teamId: string): Promise<TeamDetail>;
  /** 导出团队全量定义包（支持传入可选的语义化版本进行校验） */
  export(teamId: string, teamVersion?: string): Promise<ExpertPack>;
}
```

#### `skills` — 技能检索与内部文件读取

```ts
export interface SkillSummary {
  /** 原子技能唯一标识符 */
  id: string;
  /** 技能唯一名称 */
  name: string;
  /** 技能功能说明 */
  description: string;
  /** 技能来源标签（固化自市场索引行） */
  tags?: Array<{ zh?: string; en?: string }>;
}

export interface SkillDetail extends SkillSummary {
  /** 技能主入口文件名或元数据定义 */
  entrypoint?: string;
  /** 技能所需环境权限与外部依赖声明 */
  permissions?: string[];
}

export interface SkillFileEntry {
  /** 技能包内相对 POSIX 路径（服务端已做穿越防范校验） */
  path: string;
  /** 文件字节大小 */
  size: number;
  /** 文件内容的 SHA-256 校验摘要 */
  digest: string;
}

export interface SkillFileList {
  /** 技能包含的所有静态文件元数据清单 */
  files: SkillFileEntry[];
}

export interface SkillsSubclient {
  /** 列出本地所有原子技能摘要 */
  list(): Promise<SkillSummary[]>;
  /** 获取技能详细定义 */
  get(skillId: string): Promise<SkillDetail>;
  /** 列出指定技能目录下的所有静态资源清单（需宿主具备 skill_files 能力位） */
  files(skillId: string): Promise<SkillFileList>;
  /** 读取技能包内的指定文件字节数组（需宿主具备 skill_files 能力位） */
  readFile(skillId: string, path: string): Promise<Uint8Array>;
}
```

#### `connectors` — 连接器管理、动态注册与工具代理

```ts
export interface ConnectorSummary {
  /** 连接器唯一实例标识（UUID） */
  id: string;
  /** 连接器标识名（如 github-token） */
  name: string;
  /** 连接器展示标题 */
  title: string;
  /** 连接器运行时状态（ready / disabled / authorization_required 等） */
  status: string;
  /** 底层通信传输通道类型（fp-17 更名，固定为 none 或 oauth） */
  auth_transport: "none" | "oauth";
  /** 当前是否已启用 */
  enabled: boolean;
}

export interface ConnectorDetail extends ConnectorSummary {
  /** 连接器导出的 MCP 工具清单 */
  tools: Array<{ name: string; description?: string; input_schema?: unknown }>;
  /** 连接器导出的 MCP 资源清单 */
  resources?: Array<{ uri: string; name: string; mimeType?: string }>;
}

export interface ConnectorStatusView {
  /** 连接器当前运行状态 */
  status: "ready" | "disabled" | "authorization_required" | "error" | "stopped";
  /** 状态补充说明或异常详情 */
  message?: string;
}

export interface ConnectorCredential {
  /** 认证模式（市场声明：token / oauth / none） */
  mode: "token" | "oauth" | "none";
  /** 当前仍缺失的必填凭据键名列表（只返回键名，不回显明文值） */
  missing: string[];
  /** 已完成配置的凭据键名列表 */
  configured: string[];
}

export interface ConnectorRegistration {
  /** 自定义连接器名称 */
  name: string;
  /** 通信传输类型（stdio / sse / streamable） */
  transport: "stdio" | "sse" | "streamable";
  /** 远端接入服务 URL（sse / streamable 模式必选） */
  url?: string;
  /** 本地执行可执行文件命令（stdio 模式必选） */
  command?: string;
  /** 命令行参数列表 */
  args?: string[];
  /** 注入的环境变量键值字典 */
  env?: Record<string, string>;
}

export interface ConnectorsSubclient {
  // 1. 目录与状态查询
  /** 查询所有已注册连接器的概要列表 */
  list(): Promise<ConnectorSummary[]>;
  /** 获取指定连接器的详细配置与所含工具清单 */
  get(connectorId: string): Promise<ConnectorDetail>;
  /** 查询连接器当前运行状态（运行中、待授权、已停止等） */
  status(connectorId: string): Promise<ConnectorStatusView>;
  /** 执行连接器连通性探测与心跳测试 */
  test(connectorId: string): Promise<ConnectorProbeResult>;

  // 2. OAuth 授权流程
  /** 获取指定连接器的 OAuth 授权状态 */
  authStatus(connectorId: string): Promise<OAuthStatusView>;
  /** 发起 OAuth 授权流程，返回浏览器跳转 URL 与会话标识 */
  authStart(connectorId: string): Promise<OAuthStartResult>;
  /** 轮询等待 OAuth 授权流程完成（支持超时控制） */
  waitForAuth(connectorId: string, options?: { timeoutMs?: number }): Promise<WaitForAuthOutcome>;
  /** 清除连接器的 OAuth 授权态并注销凭据 */
  logout(connectorId: string): Promise<void>;

  // 3. 工具动态代理调用
  /** 通过宿主动态代理调用指定连接器提供的 MCP 工具 */
  call(connectorId: string, tool: string, args?: unknown): Promise<ConnectorCallResult>;

  // 4. 动态连接器注册与凭据表单管理
  /** 动态注册自定义连接器定义 */
  register(registration: ConnectorRegistration): Promise<ConnectorDetail>;
  /** 读取连接器所需的凭据字段元数据与当前填充状态 */
  credentials(connectorId: string): Promise<ConnectorCredential>;
  /** 提交或更新连接器所需的密钥凭据（如 API Key、Token） */
  setCredentials(connectorId: string, values: Record<string, string>): Promise<ConnectorCredential>;
  /** 清除已保存的指定凭据键（省略 keys 则清空全部） */
  clearCredentials(connectorId: string, keys?: string[]): Promise<ConnectorCredential>;
}
```

##### 字段改名：`auth_mode` → `auth_transport`（`fp-17`）

`fp-17` 起 `ConnectorSummary` 的 `auth_mode` 更名 **`auth_transport`**，取值仍是 `none` / `oauth`。旧字段**直接消失**，没有过渡双写：指纹在握手阶段做严格相等校验，任何一端停留在 `fp-16` 都会连不上，因此宿主与客户端必须同步升级。

改名的原因是原字段命名存在语义歧义：该字段由底层通信 transport 推导，仅描述通信协议形状——URL 型连接器一律返回 `oauth`，即使其本质采用 API Key 或凭据由平台代持。**调用方的授权交互行为由以下两个明确字段驱动**：

- `credential.mode`：连接器真正需要的认证方式（市场声明：`token` / `oauth` / `none`）；
- `status`：当前是否缺少授权（`authorization_required` 才是可操作信号）。

```ts
export interface ConnectorAuthState {
  /** 底层通信传输通道类型（fp-17 更名，仅反映传输拓扑：none | oauth） */
  auth_transport: "none" | "oauth";
  /** 运行时授权状态（仅 authorization_required 代表需引导用户触发授权流程） */
  status: "ready" | "disabled" | "authorization_required" | "error" | "stopped";
  /** 市场声明的认证模式要求（token | oauth | none） */
  credential: { mode: "token" | "oauth" | "none" };
}
```

从 `fp-16` 升级时：把读 `summary.auth_mode` 的地方改成 `summary.auth_transport`（它只适合展示），把「是否显示授权按钮」的判断改成上面的 `status`。完整的连接器凭据表单与 OAuth 授权流程请参阅 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §4.5 及 §4.7。

#### `store` — 资源市场综合生命周期

```ts
export type StoreItemKind = "agent" | "team" | "skill" | "connector";

export interface StoreItem {
  /** 市场条目全局唯一名称 */
  entry_name: string;
  /** 资源类别（专家 / 团队 / 技能 / 连接器） */
  kind: StoreItemKind;
  /** 显示名称 */
  name: string;
  /** 详细功能描述 */
  description: string;
  /** 所属市场唯一 ID */
  marketplace_id: string;
  /** 当前已安装版本号（未安装时为 null） */
  installed_version: string | null;
  /** 远端市场最新可用版本号 */
  latest_version: string;
  /** 本机当前是否已安装 */
  installed: boolean;
  /** 是否存在可升级的新版本 */
  update_available: boolean;
  /** 预置快捷输入提示词（专家取自 quickPrompts，技能/连接器取自 examples） */
  quick_prompts?: Array<{ zh?: string; en?: string }>;
}

export interface StoreOperationOutcome {
  /** 安装或卸载操作是否成功 */
  ok: boolean;
  /** 本次操作成功变更的条目数量 */
  installedCount?: number;
  /** 操作过程中的告警或提示信息清单 */
  warnings: string[];
}

export interface StoreSubclient {
  // 1. 统一目录检索
  /** 获取全量市场条目列表（每次触发全量目录投影） */
  list(): Promise<StoreItem[]>;
  /** 获取全量市场条目及后台内置市场的异步就绪状态标志 */
  listStatus(): Promise<{ items: StoreItem[]; marketsPending: boolean }>;
  /** 按多词 AND 匹配检索市场条目，支持按条目类型过滤 */
  search(query: string, filter?: { kind?: StoreItemKind }): Promise<StoreItem[]>;
  /** 检索市场条目并返回命中的字段、语种与字符级高亮区间（传入 items 可实现零 I/O 内存匹配） */
  searchWithHits(
    query: string,
    options?: { kind?: StoreItemKind; items?: StoreItem[]; installedOnly?: boolean; lang?: "zh" | "en" },
  ): Promise<StoreMatch[]>;
  /** 仅在已安装条目范围内执行多词匹配检索 */
  searchInstalled(
    query: string,
    options?: { kind?: StoreItemKind; items?: StoreItem[]; lang?: "zh" | "en" },
  ): Promise<StoreItem[]>;
  /** 查询当前已安装的所有市场条目清单 */
  installed(): Promise<StoreItem[]>;

  // 2. 状态机安装与版本管理
  /** 安装指定的市场条目（支持等待就绪与超时控制） */
  install(item: StoreItem, options?: { waitForReady?: boolean; timeoutMs?: number }): Promise<StoreOperationOutcome>;
  /** 更新指定的已安装条目至目标版本 */
  update(item: StoreItem, options?: { waitForReady?: boolean; timeoutMs?: number }): Promise<StoreOperationOutcome>;
  /** 检查所有已安装条目是否有远端新版本可用 */
  checkUpdates(): Promise<StoreItem[]>;
  /** 获取指定条目的版本更新提示状态 */
  updateHint(item: StoreItem): "none" | "update" | "unknown";

  // 3. 启用状态切换与完全卸载
  /** 切换已安装条目的启用/禁用状态 */
  setEnabled(item: StoreItem, enabled: boolean): Promise<StoreOperationOutcome>;
  /** 彻底卸载指定的条目并清理本地安装数据 */
  uninstall(item: StoreItem): Promise<StoreOperationOutcome>;
}
```

```ts
export type StoreSearchField = "name" | "tags" | "category" | "profession" | "description";

export interface StoreFieldHit {
  /** 命中的条目字段标识 */
  field: StoreSearchField;
  /** 命中词所属语言（"zh" 或 "en"） */
  lang?: "zh" | "en";
  /** 原文字符串上的半开区间 [start, end) 数组（已预先排序合并） */
  ranges: Array<[number, number]>;
}

export interface StoreMatch {
  /** 命中的市场条目对象 */
  item: StoreItem;
  /** 各可搜字段的命中区间列表 */
  hits: StoreFieldHit[];
  /** 为 true 时表示命中词位于另一语种字段，当前语言展示文本中不含该词 */
  offLanguage: boolean;
}
```

检索语义与取数契约（`store` 子客户端）：

| 维度 | 契约约束与行为保证 |
| --- | --- |
| **匹配规则** | **多词 AND 匹配**：查询字符串按空白切分为多个 term，所有 term 均须在条目的某个可搜字段中命中（支持跨字段组合命中）；大小写无关且不做分词。检索结果按三档相关性排序：`名称 (name)` > `标签/分类/职业 (tags/category/profession)` > `描述 (description)`，同档内维持目录原生顺序。`examples_*` 与 `quick_prompts` 不参与检索匹配。 |
| **高亮区间** | `searchWithHits` 返回的 `ranges` 为原文字符串上的半开区间 `[start, end)`，已预先排序并合并重叠区域；偏移量直接作用于未折叠原文（不指向小写副本）。若 `offLanguage: true`，表示命中词位于另一语种字段，当前语言展示文本中不含该词，切勿直接截取切片。 |
| **就绪判断** | `listStatus().marketsPending` 为 `true` 表示内置市场后台仍在异步注册，目录尚未加载完整。冷启动后立即发起的检索必须先校验该标志（空结果不代表条目不存在）；`list()` 不返回此状态位。 |
| **取数开销** | 传入 `options.items`（来自 `listStatus()` 或前次检索缓存）时不触发 `store/list` 远端调用，直接在内存中执行本地匹配（**零 I/O**）；未传入时每次调用均触发一次全量目录投影（逐条读取磁盘 manifest 并追加两次数据库查询）。客户端不对结果执行静态缓存（`installed` 与 `update_available` 随安装状态实时变动）。 |
| **提示词来源** | 技能与连接器条目的 `quick_prompts` 取自市场索引行的 `examples_zh` / `examples_en`（该类条目不包含 `plugin.json`）；专家与专家团条目取自 `plugin.json` 中的 `quickPrompts`。条目未声明提示词时该键为空数组 `[]`，客户端不应渲染提示词行。 |
| **反模式** | ❌ **禁止在 `input` 等高频事件中调用未传入 `items` 的 `search()`**：否则每次击键均引发全量磁盘读取与 DB 查询；传入预取数组后调用退化为纯内存过滤，方可安全内嵌于事件中。<br>❌ **禁止依据 `search()` 返回空数组断定目录无条目**：冷启动阶段必须先检查 `marketsPending` 标志。<br>❌ **禁止将 `ranges` 跨字段混用**：偏移量严格绑定至对应 `field` 的原文字符串，应用于其他文本必然导致错位或乱码。 |

#### `conversations` — 会话创建、模型配置与交互

```ts
export interface ConversationCreateInput {
  /** 会话初始名称或标题 */
  name: string;
  /** 关联绑定的专家或团队唯一标识（可选） */
  expertId?: string;
  /** 自定义覆盖的模型标识（可选） */
  model?: string;
}

export interface ConversationView {
  /** 会话全局唯一标识符 (UUID) */
  conversation_id: string;
  /** 会话显示标题 */
  name: string;
  /** 当前会话是否正在流式生成或执行任务 */
  is_processing: boolean;
  /** 会话创建时的 Unix 毫秒时间戳 */
  created_at: number;
  /** 会话最近一次活动更新的 Unix 毫秒时间戳 */
  updated_at: number;
}

export interface ConversationUpdateInput {
  /** 更新后的会话名称（可选） */
  name?: string;
  /** 更新后的关联模型参数（可选） */
  model?: string;
}

export interface ConversationSendOptions {
  /** 单轮交互中动态注入的技能或专家实体引用 */
  mentions?: Array<{ kind: "skill" | "agent"; id: string }>;
  /** 附加到本轮交互中的工作区文件绝对路径列表 */
  attachments?: string[];
}

export interface ConversationSendReceipt {
  /** 消息是否成功被服务端持久化排队并受理 */
  accepted: boolean;
  /** 服务端分配的单调连续消息序号 (sequence) */
  sequence: number;
}

export interface ConversationsSubclient {
  // 1. 会话生命周期
  /** 创建新的交互会话并初始化上下文 */
  create(input: ConversationCreateInput): Promise<ConversationView>;
  /** 获取指定会话的当前视图快照（包含模型配置与状态） */
  get(conversationId: string): Promise<ConversationView>;
  /** 列出最近的会话列表（支持指定分页数量上限） */
  list(limit?: number): Promise<ConversationView[]>;
  /** 更新会话元数据（如会话标题、关联模型配置） */
  update(conversationId: string, input: ConversationUpdateInput): Promise<ConversationView>;
  /** 软删除指定会话 */
  delete(conversationId: string): Promise<{ conversation_id: string; deleted: boolean }>;

  // 2. 消息流与交互发送
  /** 分页拉取指定会话的历史消息列表 */
  messages(query: ConversationMessagesQuery): Promise<ConversationMessagesPage>;
  /** 向会话发送用户消息并触发模型推理（需传入幂等键保障重试安全） */
  send(
    conversationId: string,
    content: string,
    idempotencyKey: string,
    options?: ConversationSendOptions,
  ): Promise<ConversationSendReceipt>;
  /** 中断并取消指定会话当前正在执行的流式生成任务 */
  cancel(conversationId: string): Promise<ConversationView>;

  // 3. 流式订阅与模型元数据
  /** 打开会话事件流的异步迭代器订阅对象（用于 for-await 遍历） */
  follow(conversationId: string): Promise<ConversationSubscription>;
  /** 注册会话事件下行回调监听，返回退订闭包函数 */
  subscribe(conversationId: string, onEvent: (event: ConversationEvent) => void): () => void;
  /** 查询当前会话可用的模型参数配置项与默认值 */
  modelOptions(): Promise<ConversationModelOptions>;
}
```

#### `runs` — 独立任务批处理、计划与审批

```ts
export interface AgentRunInput {
  /** 目标专家的唯一标识 */
  agentId: string;
  /** 本次独立运行需要完成的总体目标指令 */
  goal: string;
  /** 挂载的安全工作区 ID 列表（可选） */
  workspaces?: string[];
}

export interface TeamRunInput {
  /** 目标专家团队的唯一标识 */
  teamId: string;
  /** 本次多智能体协同运行的总体目标指令 */
  goal: string;
  /** 挂载的安全工作区 ID 列表（可选） */
  workspaces?: string[];
}

export interface RunReceipt {
  /** 批处理任务运行唯一标识 (UUID) */
  run_id: string;
  /** 初始状态（queued 或 running） */
  status: "queued" | "running";
}

export interface RunView {
  /** 任务运行唯一标识 (UUID) */
  run_id: string;
  /** 任务当前生命周期状态 */
  status: "queued" | "running" | "waiting_input" | "succeeded" | "failed" | "cancelled";
  /** 失败终止时的错误详情说明 */
  error?: string;
}

export interface RunResult {
  /** 任务最终终态 */
  status: "succeeded" | "failed" | "cancelled";
  /** 任务执行交付物或最终产出结果对象 */
  output?: unknown;
}

export interface RunsSubclient {
  // 1. 触发任务执行
  /** 发起单专家（Agent）独立批处理任务运行 */
  agent(input: AgentRunInput): Promise<RunReceipt>;
  /** 发起专家团队（Team）多智能体协同任务运行 */
  team(input: TeamRunInput): Promise<TeamRunReceipt>;

  // 2. 状态监控与执行计划
  /** 获取任务运行的当前状态快照与基本信息 */
  get(runId: string): Promise<RunView>;
  /** 获取任务的执行计划（包含各步骤分解与依赖拓扑） */
  plan(runId: string): Promise<RunPlan>;
  /** 获取已完结任务的最终产出结果与交付物 */
  result(runId: string): Promise<RunResult>;
  /** 查询任务执行期间产生的时间线事件序列 */
  events(query: RunEventsQuery): Promise<RunEvent[]>;

  // 3. 任务干预、审批提交与流式追踪
  /** 取消并终止正在执行的任务运行 */
  cancel(input: CancelRunInput): Promise<RunView>;
  /** 动态干预与引导正在运行的任务（注入上下文或重定向方向） */
  steer(input: SteerRunInput): Promise<RunView>;
  /** 提交对待决决策项（如工具调用审批、高危操作授权）的人工答复 */
  answerDecision(input: AnswerDecisionInput): Promise<RunView>;
  /** 开启任务事件流的实时异步流式订阅 */
  follow(runId: string): Promise<EventSubscription>;
}
```

#### `workspaces` — 本地工作区注册与权限管理

```ts
export interface WorkspaceView {
  /** 工作区唯一分配标识 (UUID) */
  workspace_id: string;
  /** 经规范化解析后的本地物理目录绝对路径 */
  path: string;
  /** 工作区登记注册的 Unix 毫秒时间戳 */
  created_at: number;
}

export interface WorkspaceRevokeResult {
  /** 已注销的工作区唯一标识 */
  workspace_id: string;
  /** 是否注销成功 */
  revoked: boolean;
}

export interface WorkspacesSubclient {
  // 1. 查询当前已登记的工作区列表
  /** 查询当前宿主中已登记的所有安全工作区视图 */
  list(): Promise<WorkspaceView[]>;

  // 2. 注册并规范化物理路径为安全工作区
  /** 将本地物理目录路径登记并规范化为受控工作区 */
  create(path: string): Promise<WorkspaceView>;

  // 3. 注销工作区（软删除引用，不物理清空磁盘文件）
  /** 注销指定工作区的登记记录（软注销，不删除物理磁盘文件） */
  revoke(workspaceId: string): Promise<WorkspaceRevokeResult>;
}
```

#### `models` — 可用模型元数据检索

```ts
export interface ModelSummary {
  /** 模型全局标识字符串（如 gpt-4o、claude-3-5-sonnet） */
  id: string;
  /** 模型展示名称 */
  name: string;
  /** 模型底层服务提供商 */
  provider: string;
  /** 模型最大上下文窗口容量（Token 上限） */
  context_window?: number;
}

export interface ModelsSubclient {
  /** 查询当前宿主环境内已配置且可供调用的模型列表及费率参数 */
  list(): Promise<ModelSummary[]>;
}
```

---

#### 应用面实体的展示字段（`fp-18`）

自 `fp-18` 起，`agents`、`teams`、`skills`、`connectors` 四个子客户端返回的实体摘要均统一扩展**相同的四个可选多语言展示字段**。宿主在条目导入阶段从 `plugin.json` 与市场索引行按语种合并数据并持久化至快照，调用方可直接用于双语卡片渲染，无需额外请求市场源文件。

```ts
export interface LocalizedText {
  /** 英文文案（未声明或缺席时为 null / undefined） */
  en?: string | null;
  /** 中文文案（未声明或缺席时为 null / undefined） */
  zh?: string | null;
}

export type LocalizedLang = "zh" | "en";

/** 四类应用实体摘要统一扩展的可选多语言展示字段集 */
export interface LocalizedDisplayFields {
  /** 实体展示名称（缺席时回退至 name；连接器 name 为内部标识禁止直出） */
  display_name?: LocalizedText | null;
  /** 实体展示简介完整长描述 */
  display_description?: LocalizedText | null;
  /** 双语展示标签列表（按数组索引位置配对） */
  tags?: LocalizedText[] | null;
  /** 引导提示词示例列表 */
  quick_prompts?: LocalizedText[];
}
```

| 字段 | 类型 | 语义契约 |
| --- | --- | --- |
| `display_name?` | `LocalizedText` | 展示名称。字段缺席时回退至 `name`；连接器的 `name` 为运行时内部标识（如 `fenbi_mcp`），禁止直接作为界面标题渲染 |
| `display_description?` | `LocalizedText` | 展示简介（完整描述文本） |
| `tags[]` | `LocalizedText[]` | 展示标签列表（按索引位置进行中英双语配对） |
| `quick_prompts[]` | `LocalizedText[]` | 引导提示词列表（推荐的用户交互用例） |

字段消费契约与边界约束：

1. **可选字段无隐式默认值**：`display_*` 字段可能为 `null` 或未定义，数组可能为空；未声明展示字段时由调用方显式执行回退（Fallback）至单语言字段。协议层内置了开箱即用的解析工具：

   ```ts
   import { pickLocalized, pickLocalizedList } from "@flowy-agent-store/protocol";

   // 单字段逐级回退（当前语言 -> 备选语言 -> ""），未命中时回退至运行名
   const title = pickLocalized(item.display_name, "zh") || item.name;

   // 列表字段批量解析，自动剔除空字符串
   const prompts = pickLocalizedList(item.quick_prompts, "zh");
   ```

2. **多语种取值相互独立**：`display_name.zh` 与 `display_name.en` 独立解析，任一语种存在不保证另一语种同时存在（例如技能市场当前 268 个条目中仅 15 项声明中文名称）。UI 渲染需按目标语言优先级链逐级回退。
3. **历史持久化快照不含新增字段**：在 `fp-18` 之前已安装的条目，宿主升级不会自动补齐展示字段；需通过 `store.updateEntry` 刷新或重新安装条目以生成新快照。业务层必须始终将上述字段视为可选。
4. **仅作为 UI 展示元数据**：展示字段不参与目录检索索引构建，亦不改变运行时标识（如工具命名空间 `connector__<name>__<tool>` 始终以 `name` 为准）。各子客户端的 `get` 与 `list` 接口返回的展示字段保持一致。

---

#### 导出包内的逐实体图标引用（`fp-19`）

自 `fp-19`（`pack_format 4`）起，`agents.export()` / `teams.export()` 返回的 `ExpertPack` 里，被引用的技能与连接器各自带上**图标路径**。包**只带路径**，字节仍走已有的两个读取面——这与 `pack.avatar` / `assets` 的口径一致。

```ts
export interface ExpertSkillRef {
  name: string;
  id: string;
  /** 技能目录相对路径（如 "assets/icon.png"）；无图标则整个键缺席 */
  icon?: string | null;
}

export interface ExpertConnectorRef {
  id: string;
  name: string;
  enabled: boolean;
  /** 快照相对路径（如 "avatars/connectors/github.svg"）；必须在包的 assets 里 */
  icon?: string | null;
}
```

| 字段 | 坐标系 | 字节怎么取 |
| --- | --- | --- |
| `skills[].icon` | **技能目录相对**（与 `SKILL.md` 同一坐标系） | `harness.skills.readFile(skillId, icon)` |
| `connectors[].icon` | **快照相对** | `harness.readImportAsset(pack.provenance.snapshot_id, icon)` |
| `avatar?` / `assets[]`（`fp-14` 起） | 快照相对 | 同上 |

消费契约与边界约束：

1. **字节的来路是安装期固化**：市场里 `icons/<entry>.<ext>` 与 entry 目录是兄弟关系，导入时带不进快照，所以宿主在安装那一步把它落进不可变快照，并把路径写进组件 payload；导出期只读快照，因此同一快照两次导出逐字节相同。**作者的 `plugin.json.avatar` 永远优先，市场图标只补空缺且绝不覆盖**。
2. **SDK 零额外代码**：`materializePack` 已经走过这两个面——技能图标落在 `<dir>/skills/<name>/assets/icon.*`，连接器图标落在 `<dir>/avatars/connectors/…`（并出现在 `ExportResult.writtenAssets` 里）。
3. **`connectors[].icon` 的可达性边界**：它只在"连接器自己有声明的场合"出现（当前市场形态下 = 单连接器条目）。团包里由 `mcpServers` 声明的连接器**没有自己的图标来源**，`icon` 恒缺席——宿主不会把包级图标广播给包里的连接器，因为那等于给同一张图造两个语义主体。调用方应把缺席当作常态并回落默认图。
4. **缺席 ≠ `null`**：字段缺席表示"没有图标"，与"这个格式没有该字段"可区分；`pack_format < 4` 的包不会有这两个键。老快照不会回填，需 `store.updateEntry` 或重装才会带上图标。

---
## 4. `@flowy-agent-store/sdk` — Node 宿主

### 4.1 `launchHarness` 集成入口

`launchHarness` 是 Node.js 宿主测试与集成环境下的标准入口。负责定位二进制进程、分配回环端口、建立 WebSocket 连接并完成协议握手：

```ts
export interface HarnessOptions extends SpawnOptions {
  /** 客户端身份声明（包含唯一名称与语义化版本号） */
  client: ClientInfo;
  /** 客户端能力集声明（如 events、approvals、team_runtime） */
  capabilities?: ClientCapabilities;
  /** 传递给底层 WebSocket 传输层的访问鉴权凭据 */
  token?: string;
  /** 单次 RPC 请求的默认超时时限（毫秒，默认 30,000） */
  requestTimeoutMs?: number;
}

export interface Harness extends AppServerClient {
  /** 底层进程生命周期控制句柄（就绪态、数据目录、退出监控等） */
  server: SpawnedServer;
  /** 建连初始化阶段服务端返回的标准握手回执 */
  handshake: InitializeResult;
  /** 优雅释放长连接通信、终止托管子进程并回收临时资源目录 */
  close(): Promise<void>;
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
export interface ReadinessInfo {
  /** 运行时绑定的回环主机名或 IP */
  host: string;
  /** 运行时动态分配的物理监听端口号 */
  port: number;
  /** 服务端协议指纹与初始化状态 */
  status: string;
}

export interface SpawnExitInfo {
  /** 进程退出状态码（正常退出为 0） */
  code: number | null;
  /** 终止进程的操作信号（如 SIGTERM 等） */
  signal: NodeJS.Signals | null;
}

export interface SpawnOptions {
  /** 显式指定宿主运行时可执行二进制文件的绝对路径 */
  bin?: string;
  /** 显式指定数据存储路径（未指定时自动创建临时目录并在 close 时彻底回收） */
  dataDir?: string;
  /** 监听端口号（默认 0，由操作系统动态分配可用端口） */
  port?: number;
  /** 传递给运行时进程的额外命令行参数列表 */
  extraArgs?: string[];
  /** 服务启动就绪日志等待时限（毫秒，默认 120,000） */
  readyTimeoutMs?: number;
  /** 注入子进程的环境变量键值字典（与父进程合并） */
  env?: Record<string, string | undefined>;
  /** 子进程的工作目录绝对路径 */
  cwd?: string;
  /** 监听子进程异常终止的回调函数 */
  onExit?: (info: SpawnExitInfo) => void;
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
/** 解析并返回 App Server 运行时的可执行文件绝对路径 */
export function resolveAppServerBin(customPath?: string): Promise<string>;

/** 快速拉起托管的 App Server 子进程并完成协议握手初始化 */
export function launchHarness(options: HarnessOptions): Promise<Harness>;
```

进程启动与临时目录释放的完整生命周期范式请参阅 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §1 及 §6.2.1。

### 4.4 导出助手函数

SDK 提供高阶导出工具，用于将专家与团队资产完整解构物化到本地磁盘：

```ts
/** 将指定专家及其所有绑定的技能解构并物化导出到本地磁盘目录 */
export function exportAgent(client: AppServerClient, agentId: string, destDir: string): Promise<ExportResult>;

/** 将指定专家团队、所有成员人设及包级/成员技能完整物化导出到本地目录 */
export function exportTeam(client: AppServerClient, teamId: string, destDir: string, options?: ExportTeamOptions): Promise<ExportResult>;

/** 将内存中的 ExpertPack 契约对象完整物化落盘为符合规范的资产目录树 */
export function materializePack(client: AppServerClient, pack: ExpertPack, destDir: string): Promise<ExportResult>;

export interface ExportResult {
  /** 产物物化落盘的目标物理目录绝对路径 */
  dir: string;
  /** 成功写入落盘的技能名称列表 */
  writtenSkills: string[];
  /** 声明了依赖但在当前宿主环境无法解析的悬空技能列表 */
  danglingSkills: Array<{ id: string; error?: string }>;
  /** 成功写入落盘的插件级资产相对路径列表 */
  writtenAssets: string[];
  /** 本次导出的标准化 ExpertPack 契约对象 */
  pack: ExpertPack;
}
```

完整的导出物化运行示例请参阅 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §5.2。

物化产物遵循以下标准目录树规范：
- `expert-pack.json`：完整的标准化 `ExpertPack` 格式定义（包含 `pack_format`、角色信息及依赖清单）；
- `persona.md`：单专家的 Prompt 指令正文（仅 `kind === "agent"` 时生成）；
- `members/<member.id>/persona.md`：团队成员的专属 Persona 指令（仅 `kind === "team"` 时生成）；
- `skills/<name>/...`：技能文件树，默认按技能 id 在顶层去重聚合。

#### 团队技能的两个来源

专家团队（`kind === "team"`）的技能存在**两个定义来源**。服务端保持二者独立存储，由客户端在调用 `materializePack` 时执行并集去重（`id === name`）：

| 来源 | 包内字段 | 安装后映射位置 | 常见场景 |
| --- | --- | --- | --- |
| 团队自身的包级技能 | `pack.skills` | 包描述文件 `plugin.json` 中声明的技能，安装时物化至宿主托管的技能根目录 | **官方团队大多仅在此处声明** |
| 团队成员的独立声明 | `pack.team.members[].skills` | 各成员 Markdown frontmatter 里的 `skills:` 依赖列表 | 通常为空数组 |

若仅遍历成员声明将导致技能遗漏：以官方市场包 `stock-partner-team` 为例，其包级声明了 3 个技能，而 7 名成员未显式声明技能。因此推荐直接调用 `exportTeam` 或 `materializePack` 统一物化，避免手动遍历成员；服务端未将包级技能隐式下发至各成员，以保持运行时绑定的真实性。

#### 一行导出团队的技能

```ts
export interface DanglingSkillRef {
  /** 缺失的技能唯一标识 */
  id: string;
  /** 错误分类原因（未安装或宿主缺少能力位） */
  error?: string;
}

export interface ExportTeamOptions {
  /** 目标专家团队版本号（校验版本一致性） */
  teamVersion?: string;
}
```

团队导出与物化实战请参阅 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §5.2。

```text
./dist/stock-partner-team/
├── expert-pack.json                  # 线上 pack 逐字节（含 pack_format 与 provenance）
├── members/<成员 id>/persona.md       # 团队成员人设；团队本身没有顶层 persona.md
├── skills/                           # 两个来源并集去重后的技能文件
│   ├── westock-data/{SKILL.md, package.json, references/...}
│   ├── westock-tool/{SKILL.md, package.json, references/...}
│   └── md-to-html/{SKILL.md, shell.html, scripts/...}
├── avatars/team.png                  # 插件级资产（fp-14 / pack_format 2 起随包导出）
└── bin/init_task.py                  # 包自带脚本；宿主自身从不执行，字节按 0644 交付
```

#### 插件级资产（`fp-14` / `pack_format 2` 起随包导出）

技能目录之外、与 `skills/` 平级的 `avatars/`、`bin/`、`scripts/` 也属于包的交付物——很多团队的自带脚本就假设插件根持有它们（如 `md-to-html` 的 `render.py` 按 `PLUGIN_ROOT/bin/init_task.py` 寻址）。`fp-14` 起 `ExpertPack` 携带：

- `pack.assets`：按引用的资产清单（`path` / `kind: "avatar" | "script"` / `size` / sha256 `digest`），按 `path` 排序。字节不在包里，用 `client.readImportAsset(pack.provenance.snapshot_id, path)` 拉取；`materializePack` 已替你做完全部落盘。
- `pack.avatar`：包级头像的快照相对路径（如 `avatars/team.png`），且**只会在该文件确实列在 `assets` 里时出现**。
- `ExportResult.writtenAssets`：实际落盘的快照相对路径列表。

两项核心作用域约束：资产具有**快照作用域**——成员 pack 的 `assets` 恒为空表，统一读取顶层 pack；`kind: "script"` 为**类别标注而非执行许可**——宿主自身不直接执行插件级脚本，具体调用由消费方调度，运营者可通过 `config.toml` 中的 `[expert_export] scripts = false` 显式剔除该类资产。宿主能力位 `snapshot_assets` 为 false 时，`assets` 恒为空表（明确区分「未接入」与「无资产」）。

#### 类别与标签（`fp-16` / `pack_format 3` 起随包导出）

`fp-16` 起 `ExpertPack` 携带市场声明的展示元数据，供第三方 runtime 还原市场组织方式：

- `pack.tags`：本地化标签数组（`{zh, en}` 可选对，按位配对）。
- `pack.category_id`：裸分类引用（如 `04-DataAI`）——包**只携带 id**，解析分类名要求消费方持有等价字典（本仓字典由 `store.categories()` 提供，不跨宿主通用）。

作用域与 `assets` **相反**：分类为**逐包声明**，顶层包携带团队行的值，**每个成员包携带该成员自己的值**（`pack.team.members[].tags` / `.category_id`）；未声明即字段缺席，不会补空串或 `null` 占位。目录面与导出面同源：

```ts
export interface ExpertAssetRef {
  /** 资产在插件包内的相对路径（如 avatars/team.png, bin/init_task.py） */
  path: string;
  /** 资产类别标注（avatar 供界面渲染，script 供外部调用，宿主自身不执行） */
  kind: "avatar" | "script";
  /** 资产文件字节大小 */
  size: number;
  /** SHA-256 内容校验哈希 */
  digest: string;
}

export interface ExpertPack {
  /** 包格式契约版本号（当前最新为 3） */
  pack_format: number;
  /** 导出的实体种类（agent | team） */
  kind: "agent" | "team";
  /** 双语本地化标签列表 */
  tags?: Array<{ zh?: string; en?: string }>;
  /** 裸分类标识（如 "04-DataAI"，需结合 store.categories() 解析） */
  category_id?: string | null;
  /** 插件级静态资产元数据列表（需宿主 snapshot_assets 能力位） */
  assets?: ExpertAssetRef[];
  /** 包级头像的快照相对路径 */
  avatar?: string;
}
```

类别与标签读取的完整实战请参阅 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §5.2.2。

#### 只要技能字节，不落盘

`exportTeam` 之外的公开原语是 `skills.files(id)` 与 `skills.readFile(id, path)`；两者都受宿主能力位 `skill_files` 门禁：

```ts
/**
 * 通过底层 RPC 逐字节流式读取技能包内文件内容（需宿主具备 skill_files 能力位）
 * @param client 客户端实例
 * @param skillId 目标技能唯一标识符
 * @param path 技能目录内的 POSIX 相对路径（服务端已做目录穿越防范校验）
 * @returns 技能文件的原始字节数据流 (Uint8Array)
 */
export function readSkillFile(
  client: AppServerClient,
  skillId: string,
  path: string,
): Promise<Uint8Array>;
```

内存读取技能字节流的完整范式见 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §5.3。

#### 前置条件与注意事项

1. **标识符规范**：`teamId` 必须是 `teams.list()` 返回的组件 ID（形如 `wb-<包名>-team`），而非原始包名。单专家条目请调用 `exportAgent`，两类实体接口不通用。
2. **完整依赖前置**：`exportTeam` 要求团队所有成员均处于已安装且启用状态；若存在成员缺失或禁用，将返回 `agent_not_installed` 或 `agent_disabled` 错误并定位到具体成员，避免导出残缺的团队包。
3. **悬空引用判定**：`danglingSkills` 产生于本地未安装该技能，或宿主未开启 `skill_files` 能力位。该列表为空时，方可确保离线完整可用。
4. **增量写入特性**：物化导出采用增量写入，不会清理目标目录中既有的无关文件。版本升级重新导出时，建议指定新目录或预先清空目标路径。
5. **按需流式拉取**：`pack.skills` 仅包含元数据引用，具体二进制由 SDK 通过 `skill/files` 与 `skill/file` 流式拉取。跨环境迁移时需完整携带物化后的 `skills/` 目录。

---

## 5. 协议通信与 HTTP 路由绑定

### 5.1 HTTP 路由映射表（`httpRouteTable`）

部分只读查询与无状态写入支持通过 HTTP 直接调用，路由映射表由客户端内置导出：

```ts
export interface HttpRouteInfo {
  /** HTTP 请求动词（GET / POST / DELETE / PUT） */
  verb: "GET" | "POST" | "DELETE" | "PUT";
  /** 映射的 HTTP 相对请求 URL 路径（如 /api/app-server/markets） */
  path: string;
  /** 对应的底层协议 RPC 方法名 */
  protocolMethod: string;
}

/** 导出全部支持 HTTP 直调的路由映射字典表 */
export function httpRouteTable(): Record<string, HttpRouteInfo>;
```

HTTP 模式与 WebSocket 选型及直连示例请参阅 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §6.1。

- 公共 HTTP 接口覆盖 **56 / 83** 个协议方法；
- 需保持持续双向通信的实时流式推送方法（如 `follow`）以及宿主本地特权接口不在 HTTP 中开放。

### 5.2 审批决策 CAS 乐观并发控制

当异步任务执行进入等待决策状态（`waiting_input`）时，调用方通过 `runs.answerDecision` 提交结构化决策：

```ts
export interface AnswerDecisionInput {
  /** 关联的任务运行唯一标识 (UUID) */
  runId: string;
  /** 产生待决决策的步骤唯一标识 */
  stepId: string;
  /** 产生待决决策的执行尝试唯一标识 */
  attemptId: string;
  /** 提交的人工或策略决策答复内容 */
  answer: string;
  /** 任务运行执行版本乐观锁校验值（CAS 防止并发冲突） */
  expectedExecutionVersion: number;
  /** 步骤版本乐观锁校验值 */
  expectedStepVersion: number;
  /** 尝试版本乐观锁校验值 */
  expectedAttemptVersion: number;
}
```

必须完整传入三个 `expected*Version` 乐观并发校验字段，版本不匹配时服务端快速返回 `conflict` 拒绝写入。CAS 决策审批完整监听与提交实战请参阅 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §5.1。

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
export interface ConversationSubscription {
  /** 注册下行实时会话增量事件回调（文本 delta、思考块、工具调用等） */
  onEvent(listener: (event: ConversationEvent) => void): () => void;
  /** 注册底层丢包失步时的全量历史消息回补快照监听回调 */
  onBackfill(listener: (snapshot: ConversationMessagesPage) => void): () => void;
  /** 注册流式通道连接与协议异常监听回调 */
  onError(listener: (error: unknown) => void): () => void;
  /** 主动关闭长连接事件订阅并释放通道底层监听器 */
  close(): void;
}
```

会话流式订阅、打字机输出与断网重连回补实战请参阅 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §2.1。

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
export interface RetryOptions {
  /** 最大重试执行次数（包含首次请求，默认 3） */
  maxAttempts?: number;
  /** 首次退避初始等待基底时间（毫秒，默认 500） */
  baseDelayMs?: number;
  /** 单次退避等待时间上限（毫秒，默认 8,000） */
  maxDelayMs?: number;
  /** 随机退避抖动因子（0-1，默认 0.25） */
  jitter?: number;
  /** 触发重试前的监控与告警回调函数 */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

/** 使用指数退避与随机抖动策略执行异步操作 */
export function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
```

生产环境错误分流与重试实战请参阅 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §6.3。

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

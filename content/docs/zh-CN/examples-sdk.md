# TypeScript SDK 实战示例

本文档为 [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk) 的配套实战代码示例集，按场景划分模块，集中提供开箱即用的工程实现范式。

> 三个包的架构分工：`@flowy-agent-store/protocol` 提供纯类型契约与错误模型；`@flowy-agent-store/client` 提供传输解耦的 `AppServerClient` 及业务子客户端；`@flowy-agent-store/sdk` 封装 Node.js 宿主进程生命周期管理（`launchHarness`）。**实时事件订阅需使用 `WebSocketTransport`**，无状态请求响应可选用 `HttpTransport`。

## 1. 包分工与运行环境架构

| 包名 | 职责与适用场景 | 运行环境 |
| --- | --- | --- |
| `@flowy-agent-store/protocol` | 纯类型契约、错误定义与编解码工具函数 | 通用环境（Node.js / 浏览器 / 零运行时依赖） |
| `@flowy-agent-store/client` | 传输解耦的 `AppServerClient` 客户端及各业务子模块 | 通用环境（Node.js / 浏览器 / Electron 渲染进程） |
| `@flowy-agent-store/sdk` | Node.js 宿主进程生命周期管理、端口分配与测试编排 | Node.js ≥ 22 或 Bun |

```bash
# 确认 Node.js 版本（依赖全局 WebSocket 支持），或改用 Bun
node -v

# 安装 SDK 核心包
bun add @flowy-agent-store/sdk # 或 npm install @flowy-agent-store/sdk

# 声明预构建二进制路径（未指定时按规则自动检索系统 PATH 及平台依赖包）
export AGENT_STORE_BIN=/opt/flowy-agent-store/flowy-agent-store
```

## 2. 传输层与通信协议选型

系统提供两种传输通道实现，二者的功能边界与选型依据如下：

| 关键特性 | WebSocketTransport | HttpTransport |
| --- | --- | --- |
| 实时事件订阅（`follow` / `onNotification`） | **支持**（双向长连接，流式推送） | **不支持**（调用将抛出 `TransportError`） |
| 握手与连接生命周期 | 单次握手建立会话，复用长连接通道 | 每次调用独立建立 HTTP 请求并认证 |
| 推荐应用场景 | 桌面 GUI、Web 前端界面、持续任务执行监听 | 运维脚本、CI 单次检查、一次性数据查询 |

```ts
import { AppServerClient, HttpTransport, WebSocketTransport, httpRouteTable } from "@flowy-agent-store/client";

// 模式 A：WebSocketTransport（适用于实时交互界面与流式事件监听）
const wsTransport = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", {
  token: process.env.AGENT_STORE_TOKEN,
  requestTimeoutMs: 30_000,
});
const wsClient = new AppServerClient({
  transport: wsTransport,
  client: { name: "desktop-ui", version: "1.0.0" },
});
await wsClient.connect();

// 模式 B：HttpTransport（适用于轻量无状态脚本与一次性查询）
const httpTransport = new HttpTransport({
  baseUrl: "http://127.0.0.1:8787",
  token: process.env.AGENT_STORE_TOKEN,
});
const httpClient = new AppServerClient({
  transport: httpTransport,
  client: { name: "cli-tool", version: "1.0.0" },
});
await httpClient.connect(); // HTTP 模式下 connect() 为空操作（No-op）
const store = await httpClient.listStore();

// 可调用的 HTTP 路由可通过路由表自查（不支持流式订阅方法）
console.log(`HTTP 支持的方法数: ${Object.keys(httpRouteTable()).length}`);
```

## 3. 运行时接入与宿主进程托管

### 3.1 Node.js 托管模式（launchHarness 单生命周期）

通过单次调用完成运行时进程启动、动态端口探测、回环建连与协议握手：

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

// 单命令启动宿主进程、完成握手并获取初始化的客户端实例
const harness = await launchHarness({
  client: { name: "my-service", version: "1.0.0" },
  capabilities: { events: true, approvals: true, team_runtime: true },
});

try {
  console.log(`服务端就绪地址: ${harness.server.readiness.url}`);
  console.log(`协议版本: ${harness.handshake.protocol_version}`);

  const store = await harness.listStore();
  console.log(`已就绪市场条目数: ${store.items.length}`);
} finally {
  // 必须在 finally 中关闭：安全终止子进程并清理临时数据目录
  await harness.close();
}
```

`launchHarness` 内部执行流程：
1. 按顺序检索运行时二进制（`bin` $\to$ `AGENT_STORE_BIN` $\to$ 平台依赖包 $\to$ 系统 `PATH`）；
2. 携带 `--host 127.0.0.1 --port 0 --no-open` 及自动生成的临时 `--data-dir` 启动子进程；
3. 监听标准输出中的 JSON 就绪报文（包含 `"agent_store":"listening"`）获取动态分配的端口；
4. 校验就绪通知中的 `protocol_version` 与 SDK 版本一致性，版本冲突时立即终止子进程并报错；
5. 建立回环 WebSocket 通道并完成握手，返回初始化的 `AppServerClient`。完整参数规则见 [接口参考](/zh-CN/docs/typescript-sdk) §4。

### 3.2 自定义配置与自持数据目录（生产与测试部署）

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({
  bin: "/opt/flowy-agent-store/flowy-agent-store", // 显式锁定二进制制品
  dataDir: "/var/lib/my-app/agent-store",          // 自持目录：进程关闭时不被删除，持久化复用
  readyTimeoutMs: 180_000,                         // 冷启动建库超时预算（180 秒）
  requestTimeoutMs: 120_000,                       // 单次请求超时预算（120 秒）
  extraArgs: ["--agent-store-config", "/etc/my-app/agent-store.toml"],
  client: { name: "ci-worker", version: "1.0.0" },
  onExit: (info) => console.warn(`运行时退出: code=${info.code}, signal=${info.signal}`),
});

try {
  const store = await harness.listStore();
  console.log(`市场条目: ${store.items.length}, 市场更新中: ${store.markets_pending}`);
} finally {
  await harness.close(); // 优雅关闭进程，自持数据目录保持完整
}
```

### 3.3 独立进程托管（spawnAppServer 与客户端解耦）

仅托管运行时进程生命周期，由外部自行管理网络连接：

```ts
import { spawnAppServer } from "@flowy-agent-store/sdk";
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

// 仅拉起并托管独立服务端进程，不绑定内建客户端
const server = await spawnAppServer({
  dataDir: "/var/lib/my-app/agent-store",
  host: "127.0.0.1",
  port: 0, // 由操作系统动态分配可用端口
});

try {
  const wsUrl = `ws://${server.readiness.host}:${server.readiness.port}/api/app-server/ws`;
  const client = new AppServerClient({
    transport: new WebSocketTransport(wsUrl),
    client: { name: "external-client", version: "1.0.0" },
  });
  await client.connect();

  const catalog = await client.connectors.list();
  console.log(`连接器数量: ${catalog.length}`);
} finally {
  await server.close(); // 终止服务端进程
}
```

### 3.4 Web 浏览器长连接模式（直接连接运行中服务端）

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

// 浏览器运行环境中无法执行进程 spawn，仅作为客户端连接既有服务端
const token = window.sessionStorage.getItem("agent_store_token") ?? undefined;
const transport = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", {
  token, // 在带鉴权模式下，token 将作为 URL 查询参数自动附加
  requestTimeoutMs: 15_000,
});

const client = new AppServerClient({
  transport,
  client: { name: "web-dashboard", version: "1.0.0" },
});

await client.connect();
const experts = await client.agents.list();
console.log(`已就绪专家数量: ${experts.length}`);
```

### 3.5 Electron 混合架构（主进程 spawn 与渲染进程安全直连）

主进程管理运行时二进制与数据存储目录；渲染进程仅接收回环连接地址及鉴权令牌。私有密钥仅保存在主进程受控的安全存储中。

```ts
// 1. Electron 主进程 (main.ts)：管理后台进程与数据存储
import { app, ipcMain } from "electron";
import { spawnAppServer, type SpawnedServer } from "@flowy-agent-store/sdk";
import { join } from "node:path";

let server: SpawnedServer | null = null;

async function bootstrap() {
  server = await spawnAppServer({
    dataDir: join(app.getPath("userData"), "agent-store"),
  });

  const wsUrl = `ws://${server.readiness.host}:${server.readiness.port}/api/app-server/ws`;
  const token = server.readiness.auth === "disabled-local" ? undefined : process.env.AGENT_STORE_TOKEN;

  ipcMain.handle("agent-store:get-connection", () => ({ url: wsUrl, token }));

  server.exited.then((info) => {
    console.warn(`运行时退出: code=${info.code}, signal=${info.signal}`);
  });
}

app.whenReady().then(bootstrap);
app.on("before-quit", async (event) => {
  if (server) {
    event.preventDefault();
    await server.close();
    server = null;
  }
  app.exit();
});

// 2. 渲染进程 (renderer.ts)：通过 IPC 获取连接凭据并建立 WebSocket 通信
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const { url, token } = await (window as any).agentStore.getConnection();
const client = new AppServerClient({
  transport: new WebSocketTransport(url, { token }),
  client: { name: "electron-renderer", version: "1.0.0" },
});
await client.connect();
```

## 4. 会话交互与多 Agent 编排

### 4.1 基础会话交互（创建、流式事件订阅与幂等发送）

```ts
import { decodeConversationEvent } from "@flowy-agent-store/protocol";

// 1. 创建新会话
const conversation = await client.conversations.create({ name: "技术方案调研" });
const conversationId = conversation.conversation_id;

// 2. 订阅流式事件流
const subscription = await client.conversations.follow(conversationId);
subscription.onEvent((rawEvent) => {
  const event = decodeConversationEvent(rawEvent);
  if (event.kind === "message.delta") {
    process.stdout.write(event.delta);
  }
});
subscription.onError((error) => console.error("流式接收异常:", error));

// 3. 发送消息（必须显式指定客户端生成的 UUID 作为幂等键）
const receipt = await client.conversations.send(
  conversationId,
  "请评估单二进制架构的利弊并输出分析大纲",
  crypto.randomUUID(),
);
console.log(`消息已受理: ${receipt.accepted}`);
```

### 4.2 动态挂载原子技能（单轮请求能力注入）

技能挂载仅对当前对话轮次生效，不影响会话快照：

```ts
// 检索本地可用的技能组件
const skills = await client.skills.list();
const gitSkill = skills.find((item) => item.name === "git-workflow");

if (!gitSkill) throw new Error("未安装 git-workflow 技能");

// 在特定对话轮次中通过 mentions 注入技能，仅对当前轮生效，不污染会话快照
await client.conversations.send(
  conversationId,
  "请根据 Git 规范检查当前分支提交历史",
  crypto.randomUUID(),
  {
    mentions: [{ kind: "skill", id: gitSkill.id }],
    // attachments: ["/absolute/path/to/diff.patch"], // 可选挂载工作区内的文件附件
  },
);
```

### 4.3 角色化会话与专家团编排（专家与团队绑定）

```ts
// 模式 A：单专家会话绑定（从首轮起受专家的 Instructions、技能与连接器栅栏约束）
const experts = await client.agents.list();
const architect = experts.find((item) => item.name === "software-architect");

const expertChat = await client.conversations.create({
  name: "架构设计会话",
  agentId: architect!.id, // 未安装时抛出 agent_not_installed 错误
});
await client.conversations.send(expertChat.conversation_id, "规划微内核扩展架构", crypto.randomUUID());

// 模式 B：专家团队（Team）会话绑定（由 Team Leader 统筹并分发协作任务）
const teams = await client.teams.list();
const teamChat = await client.conversations.create({
  teamId: teams[0].id, // teamId 与 agentId 严格互斥
});
await client.conversations.send(teamChat.conversation_id, "对当前重构需求制定跨角色执行计划", crypto.randomUUID());
```

### 4.4 多会话并发与单 WebSocket 连接多路复用

单一宿主支持管理多个独立会话，单条 WebSocket 连接即可实现事件流多路分发：

```ts
// 1. 并发创建多个独立业务会话
const chatA = await client.conversations.create({ name: "错误日志分析" });
const chatB = await client.conversations.create({ name: "API 接口设计" });
const activeChats = [chatA, chatB];

// 2. 在同一条 WebSocket 连接上并行订阅各个会话，通过闭包实现事件分流
for (const chat of activeChats) {
  const sub = await client.conversations.follow(chat.conversation_id);
  sub.onEvent((event) => {
    console.log(`[会话 ${chat.name} 收到事件]`, event.event_type);
  });
}

// 3. 同时向多个会话发起并发请求（服务端按会话隔离判定，互不阻塞）
const receipts = await Promise.all([
  client.conversations.send(chatA.conversation_id, "分析日志异常原因", crypto.randomUUID()),
  client.conversations.send(chatB.conversation_id, "生成用户中心 API 定义", crypto.randomUUID()),
]);
console.log("并发受理状态:", receipts.map((r) => r.accepted));

// 4. 查询当前宿主中的全量会话视图及执行中状态
const allViews = await client.conversations.list();
for (const view of allViews) {
  console.log(`会话: ${view.name}, 执行中: ${view.is_processing}`);
}
```

### 4.5 独立任务（Run）编排与人机交互审批

```ts
// 1. 发起单次独立的 Agent 批处理任务
const receipt = await client.runs.agent({
  agentId: "frontend-backend-experts",
  goal: "为订单服务编写 OpenAPI 规范与 Mock 数据",
});
const runId = receipt.run_id;

// 2. 订阅运行状态与实时审批请求
const runSub = await client.runs.follow(runId);
runSub.onEvent(async (event) => {
  if (event.event_type === "approval.requested") {
    // 捕获决策请求并向服务端提交批准判定（携带版本乐观锁字段）
    await client.runs.answerDecision({
      runId,
      stepId: event.step_id!,
      attemptId: event.attempt_id!,
      answer: "确认批准，准许写文件操作",
      expectedExecutionVersion: event.expected_execution_version!,
      expectedStepVersion: event.expected_step_version!,
      expectedAttemptVersion: event.expected_attempt_version!,
    });
  }
});

// 3. 阻塞等待终态并提取执行结果
const result = await client.runs.result(runId);
console.log(`任务终态: ${result.status}`);
```

## 5. 市场资源与连接器集成

### 5.1 市场条目检索与生命周期状态机

```ts
// 1. 统一目录列表检索与一键快速安装
const store = await client.listStore();
const targetItem = store.items.find((item) => item.entry_name === "frontend-backend-experts");

if (targetItem && !targetItem.installed) {
  await client.installStoreEntry(targetItem.marketplace_id, targetItem.entry_name);
}

// 2. 高阶状态机安装编排（内置就绪等待与 OAuth 认证引导）
const searchResults = await client.store.search("github", { kind: "connector" });
const outcome = await client.store.install(searchResults[0], { waitForReady: true });

if (!outcome.ok) {
  console.warn("部分依赖组件安装失败:", outcome.components.filter((c) => !c.ok));
}
if (outcome.ready === false && outcome.readyIssue === "authorization_required") {
  console.log("连接器需要完成用户授权，请跳转授权流程");
}

// 3. 查询已安装组件与版本更新提示
const installedEntries = await client.store.installed();
const outdated = await client.store.checkUpdates();
for (const entry of outdated) {
  console.log(`更新策略: ${client.store.updateHint(entry)}`); // 输出 "update"
  // 原地原子升级：先装新版本，就绪后安全释放旧版本产物；中途失败保留旧安装
  const updateOutcome = await client.store.update(entry, { waitForReady: true });
  console.log(`升级结果: ${updateOutcome.ok ? "成功" : "失败"}`);
}

// 4. 停用与彻底卸载
await client.store.setEnabled(searchResults[0], false); // 变更目录启用标记
await client.store.uninstall(searchResults[0]);         // 彻底清理并释放运行时磁盘快照
```

### 5.2 市场源动态管理

```ts
// 1. 列出当前已配置的所有市场源
const marketplaces = await client.listMarketplaces();

// 2. 动态注册新的第三方市场源
const added = await client.addMarketplace({
  source_kind: "url",
  source: "https://example.com/custom-market.json",
});

// 3. 强制触发市场源远端索引刷新
await client.refreshMarketplace(added.marketplace_id);

// 4. 级联移除市场源（cascade: true 将同步注销来自该市场的未持久化快照）
await client.removeMarketplace(added.marketplace_id, /* cascade */ true);
```

### 5.3 连接器 OAuth 授权全流程

```ts
const connectorId = "github";

// 1. 检查当前认证状态，已处于 authenticated 时无需重复授权
const initialStatus = await client.connectors.authStatus(connectorId);

if (initialStatus.state !== "authenticated") {
  // 2. 发起宿主浏览器 OAuth 授权流（此调用立即返回 started 状态，非阻塞）
  const startResult = await client.connectors.authStart(connectorId);
  if (startResult.state !== "started") {
    throw new Error(startResult.error ?? "启动 OAuth 浏览器窗口失败");
  }

  // 3. 等待用户在浏览器中完成授权（默认 120 秒超时预算）
  const authResult = await client.connectors.waitForAuth(connectorId);
  if (authResult.state === "error") {
    throw new Error(`OAuth 授权失败: ${authResult.error}`);
  }
  if (authResult.state === "timeout") {
    throw new Error("用户浏览器授权超时");
  }
}

// 4. 验证连接器健康状态（期望处于 connected 状态）
const health = await client.connectors.status(connectorId);
console.log(`连接器运行状态: ${health.status}`);

// 5. 任务结束后安全吊销凭据
await client.connectors.logout(connectorId);
```

### 5.4 连接器工具探针与动态调用

```ts
// 1. 执行连通性测试并探针获取可用工具签名
const probe = await client.connectors.test("github");
if (!probe.success) {
  throw new Error(probe.error ?? "连接器探针测试失败");
}
if (probe.tools_truncated) {
  console.warn("由于响应包体预算限制，部分工具的 JSON Schema 已省略");
}

// 2. 检索指定工具及其输入参数契约
const targetTool = probe.tools?.find((tool) => tool.name === "create_issue");
console.log("工具描述:", targetTool?.description);
console.log("参数模式:", targetTool?.input_schema);

// 3. 结构化传参调用外部工具
const invocation = await client.connectors.call("github", "create_issue", {
  owner: "flowy-org",
  repo: "agent-store",
  title: "SDK 文档示例同步",
});

if (invocation.is_error) {
  // 外部调用被拒绝或参数不符时，Promise 正常返回，错误承载在 result 对象中
  console.error("工具执行返回错误:", invocation.result);
} else {
  console.log("工具执行成功:", invocation.result);
}
```

### 5.5 连接器用户凭据表单与私有服务注册

```ts
// 1. 查询连接器所需的凭据配置表单（来自 token-schema 声明）
const credForm = await client.connectors.credentials("weather-service");
console.log(`认证模式: ${credForm.mode}`); // "token" | "oauth" | "none"
console.log(`获取密钥链接: ${credForm.doc_url?.zh}`);

if (credForm.status === "missing") {
  console.warn(`缺失必需凭据: ${credForm.missing.join(", ")}`);

  // 2. 定向安全写入敏感凭据（单向加密落盘，网络回包中值永不越界）
  await client.connectors.setCredentials("weather-service", {
    WEATHER_API_KEY: "sk-live-mock-api-key-9988",
  });
}

// 3. 动态注册私有 MCP 模板服务（由 ${secret:NAME} 模板自动派生凭据字段）
const registered = await client.connectors.register({
  name: "custom-internal-db",
  transport: {
    sse: {
      url: "https://internal.corp/db/sse",
      headers: { Authorization: "Bearer ${secret:INTERNAL_DB_TOKEN}" },
    },
  },
});

// 4. 重置或清除不再需要的凭据
await client.connectors.clearCredentials("weather-service", ["WEATHER_API_KEY"]);
```

## 6. 资源导出与宿主管控

### 6.1 工作区管理与技能内部文件读取

```ts
// 1. 工作区（Workspaces）声明周期管理
const workspaces = await client.workspaces.list();
const newWorkspace = await client.workspaces.create("/abs/path/to/project");
await client.workspaces.revoke(newWorkspace.workspace_id); // 软删除，既有会话保留引用

// 2. 技能内部文件读取（受宿主 skill_files 能力门禁管控）
if (client.initializeInfo?.capabilities.skill_files) {
  const inventory = await client.skills.files("release-notes");
  for (const file of inventory.files) {
    console.log(`文件: ${file.path}, 大小: ${file.size}, 摘要: ${file.digest}`);
  }

  // 读取技能包内的相对路径文件字节流并转码
  const fileBytes = await client.skills.readFile("release-notes", "references/guide.md");
  const content = new TextDecoder().decode(fileBytes);
  console.log("文件内容:", content);
}
```

### 6.2 专家与团队打包导出至本地目录

```ts
import { exportAgent, exportTeam, materializePack } from "@flowy-agent-store/sdk";

// 模式 A：使用 SDK 高阶函数 exportTeam 完整物化团队及跨成员技能
const teamId = "frontend-backend-experts";
const exportResult = await exportTeam(client, teamId, "./exported-team");
console.log(`已物化技能数: ${exportResult.writtenSkills.length}`);
if (exportResult.danglingSkills.length > 0) {
  console.warn("缺失引用的悬空技能:", exportResult.danglingSkills);
}

// 模式 B：使用 exportAgent 高阶函数物化单专家
const agentResult = await exportAgent(client, "wb-architect", "./exported-expert");
console.log(`单专家物化路径: ${agentResult.dir}`);

// 模式 C：内存中处理 ExpertPack 并调用 materializePack 落盘
const pack = await client.agents.export("wb-architect");
const customResult = await materializePack(client, pack, "./exported-custom");
console.log(`自定义物化技能: ${customResult.writtenSkills.join(", ")}`);
```

### 6.3 宿主工具域裁剪与策略控制

通过环境变量动态重载宿主工具策略：

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

// 通过环境变量 AGENT_STORE_TOOLS 注入工具策略配置，覆盖宿主默认行为
const harness = await launchHarness({
  client: { name: "sandboxed-client", version: "1.0.0" },
  env: {
    AGENT_STORE_TOOLS: JSON.stringify({
      web: true,       // 允许联网检索与只读网页抓取
      computer: false, // 禁用键鼠桌面控制
      browser: false,  // 禁用带登录态的浏览器自动化
      domains: {
        cron: false,
        meeting: false,
        knowledge: false,
        learning: false,
        media: false,
        companion: false,
        requirement: false,
      },
    }),
  },
});

try {
  const store = await harness.listStore();
  console.log(`受限环境下已加载条目: ${store.items.length}`);
} finally {
  await harness.close();
}
```

| 属性规则 | 运行机制与约束 |
| --- | --- |
| 值格式规范 | 合法 JSON 字符串，对象结构与 `config.toml` 中的 `[tools]` 严格一致 |
| 配置优先级 | 环境变量**整份完全替换**配置文件中的 `[tools]` 配置，不执行递归合并 |
| 容错回退机制 | 若 JSON 字符串解析失败，服务端记录告警日志并自动回落使用配置文件 |
| 作用生命周期 | 宿主进程启动初始化时读取一次；`launchHarness` 每次拉起新进程天然生效 |

## 7. 生产实践与故障恢复

### 7.1 结构化错误处理与指数退避重试

```ts
import { withRetry } from "@flowy-agent-store/client";
import { AppServerError, formatError, isRetryableError } from "@flowy-agent-store/protocol";

// 模式 A：使用 withRetry 自动执行幂等操作的指数退避重试
const runDetails = await withRetry(() => client.runs.get("run-12345"), {
  maxAttempts: 4,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  onRetry: ({ attempt, delayMs, error }) => {
    console.warn(`执行第 ${attempt} 次重试，等待 ${delayMs}ms, 原因: ${formatError(error)}`);
  },
});

// 模式 B：捕获 AppServerError 依据结构化 code 进行确定性业务分流
try {
  await client.runs.result("run-12345");
} catch (error) {
  if (error instanceof AppServerError) {
    switch (error.code) {
      case "connector_unavailable":
        console.error("连接器离线或未完成认证，请引导用户重新连接");
        break;
      case "agent_not_installed":
        console.error("目标专家未安装至本地存储");
        break;
      default:
        console.error(`服务端业务异常 [${error.code}]:`, formatError(error));
    }
  } else if (isRetryableError(error)) {
    console.warn("网络层瞬时异常，可择机重试");
  } else {
    throw error;
  }
}
```

### 7.2 生产环境核心规范与避坑要点

- **数据目录互斥排他锁**：同一 `dataDir` 具有独占文件锁，禁止并发多个进程挂载同一目录；自动化测试或多实例场景需分配独立隔离路径。
- **异步消息受理语义**：`conversations.send` 返回的 `accepted: true` 仅代表任务已入库排队，不能视为处理完毕；流式回复必须通过 `follow` 订阅或轮询 `is_processing`。
- **市场后台异步预热**：冷启动时首个 `store/list` 不阻塞等待市场包解压；空列表时需持续检查 `markets_pending` 标志直至为 `false`。
- **连接器初始状态控制**：新导入的连接器默认处于禁用（`disabled`）状态；通过高阶 API `store.install` 会自动完成启用及探针连通性校验。
- **版本演进与升级规约**：系统未提供原地补丁升级操作，统一遵循卸载后重新安装（`uninstall_reinstall`）生命周期规范。
- **技能停用与卸载区别**：技能无运行时热卸载机制，`store.setEnabled(item, false)` 仅置目录状态标记，完全移除需执行 `uninstall`。
- **协议版本全等校验**：运行时进程与 SDK 之间的 `protocol_version` 必须完全一致，存在版本差异时子进程启动阶段将立即主动退出并报错。
- **临时目录安全回收**：在测试或脚本中使用 `launchHarness` 且未指定 `dataDir` 时，必须确保在 `finally` 块中调用 `close()`，以防进程强制退出遗留孤儿文件。

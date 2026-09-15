# TypeScript SDK 实战示例

本文是 [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk) 的配套**示例集**：类型、逐方法对照表与运行契约在那边，这里只放**可直接复制运行**的代码。

> 三个包的分工：`@flowy-agent-store/protocol` 只有类型与错误模型；`@flowy-agent-store/client` 是传输无关的 `AppServerClient` + 子客户端；`@flowy-agent-store/sdk` 额外提供 `launchClient`（spawn 二进制 + 回环建连 + 握手）。**实时事件与订阅只能走 `WebSocketTransport`**，纯请求-响应可以用 `HttpTransport`。

## 1. 三个包与运行环境对照

| 包 | 用在什么场景 | 运行环境 |
| --- | --- | --- |
| `@flowy-agent-store/protocol` | 只要类型与错误模型，或自己实现传输 | 任意（零运行时代码） |
| `@flowy-agent-store/client` | 连一个**已经跑起来**的 App Server（桌面端、自建宿主） | 任意（Node / 浏览器都行） |
| `@flowy-agent-store/sdk` | 由你的进程**自己拉起**运行时 | Node.js ≥ 22 或 Bun |

## 2. 运行前准备

```bash
node -v                      # Node.js >= 22（依赖全局 WebSocket），或改用 Bun
bun add @flowy-agent-store/sdk   # 或 npm install / pnpm add

# 运行时二进制：SDK 不下载，按 bin 参数 → AGENT_STORE_BIN → 平台运行时包的 vendor/ → PATH 查找
export AGENT_STORE_BIN=/opt/flowy-agent-store/flowy-agent-store
```

## 3. Node：一行拉起 + 完整生命周期

最小用法——spawn 运行时、回环建连、握手都在一次调用里完成：

```ts
import { launchClient } from "@flowy-agent-store/sdk";

const session = await launchClient({
  client: { name: "my-app", version: "0.1.0" },
});
const store = await session.client.listStore();
await session.close();
```

`launchClient` 完成的事：

1. 按 `bin` → `AGENT_STORE_BIN` → 平台运行时包的 `vendor/` → `PATH` 定位 `flowy-agent-store` 可执行文件；
2. 以 `--host 127.0.0.1 --port 0 --no-open` 并携带自动创建的临时 `--data-dir` 启动子进程；
3. 扫描 stdout 就绪行（`{"agent_store":"listening",...}`），取得实际端口；
4. **校验就绪行 `protocol_version` 与 SDK 一致**，不一致则杀进程并报错（含两端版本）；
5. 建立回环 WebSocket、执行 `initialize` → `initialized` 握手，返回可用的 `AppServerClient`。

> 选项的完整语义（`token` / `capabilities` / `requestTimeoutMs` 与 `SpawnOptions`）和失败清理口径见[接口参考](/zh-CN/docs/typescript-sdk) §4；下面几段只给可直接复制的配方。

### 3.1 装专家 → 跑一次 → 取结果

```ts
import { launchClient } from "@flowy-agent-store/sdk";

const session = await launchClient({ client: { name: "demo", version: "1.0.0" } });
try {
  // 目录（Store）
  const items = await session.client.listStore();
  console.log(`${items.items.length} items in the store`);

  // 安装并运行一个 Agent
  await session.client.installStoreEntry("experts", "frontend-backend-experts");
  const receipt = await session.client.runs.agent({
    agentId: "frontend-backend-experts",
    goal: "Generate a todo REST API",
  });
  const result = await session.client.runs.result(receipt.run_id);
  console.log(result.status);
} finally {
  await session.close(); // 终止子进程 + 删除临时 data-dir
}
```

### 3.2 会话 + 实时事件

```ts
import { launchClient } from "@flowy-agent-store/sdk";

const launched = await launchClient({ client: { name: "my-tool", version: "1.0.0" } });
try {
  const conversation = await launched.client.conversations.create({ name: "demo" });
  const subscription = await launched.client.conversations.follow(conversation.conversation_id);
  subscription.onEvent((event) => console.log(event.event_type));
  await launched.client.conversations.send(conversation.conversation_id, "你好", crypto.randomUUID());
} finally {
  await launched.close(); // 终止子进程 + 删除临时 data-dir
}
```

### 3.3 固定二进制 + 自持 data-dir（CI / 多实例 / 复用库）

```ts
import { launchClient } from "@flowy-agent-store/sdk";

const session = await launchClient({
  bin: "/opt/flowy-agent-store/flowy-agent-store", // 省略则按 §2 的四条途径自动查找
  dataDir: "/var/lib/my-app/agent-store",          // 自持目录 ⇒ 不删除，跨调用复用同一个库
  readyTimeoutMs: 180_000,                         // 冷启动要建库
  requestTimeoutMs: 120_000,                       // 首个 store/list 会镜像整棵市场树
  extraArgs: ["--agent-store-config", "/etc/my-app/agent-store.toml"], // 换一份宿主配置
  client: { name: "ci-smoke", version: "1.0.0" },
  onExit: (info) => console.error("runtime exited", info.code, info.signal),
});
try {
  const store = await session.client.listStore();
  console.log(store.items.length, store.markets_pending);
} finally {
  await session.close(); // 自持目录不会被删除
}
```

> 端口默认 `0`（系统分配）不必指定；**并发要用不同的 `dataDir`**——同一个目录有单实例锁，后启动的那个会 fail-fast。

### 3.4 带 token 的宿主与 capabilities

```ts
const session = await launchClient({
  client: { name: "internal-ui", version: "2.0.0" },
  // 宿主以 --auth 启动时必需；本地模式（server.readiness.auth === "disabled-local"）可省略
  token: process.env.AGENT_STORE_TOKEN ?? "",
  // 声明会消费哪些能力：events / approvals / team_runtime / artifacts
  capabilities: { events: true, approvals: true, team_runtime: true, artifacts: false },
});
console.log(session.server.readiness.url, session.initializeResult.protocol_version);
```

### 3.5 启动失败怎么兜

```ts
import { launchClient } from "@flowy-agent-store/sdk";

try {
  const session = await launchClient({ client: { name: "my-app", version: "1.0.0" } });
  // … 正常使用 session.client
} catch (error) {
  // 三类启动失败都从这里抛出，message 已含可行动信息：
  // 1) 找不到二进制        → "cannot find the flowy-agent-store runtime binary: …"（逐条列出四条途径）
  // 2) 就绪超时 / 启动即退  → "timed out after …ms waiting for the runtime readiness line"
  // 3) 协议指纹不一致      → "protocol version mismatch: runtime speaks X, SDK expects Y"
  console.error(String(error));
}
```

失败路径由 SDK 自己兜底：先 `child.kill()`，2 秒宽限后 `SIGKILL`，并删除自动创建的 data-dir；子进程 stderr 的尾部 50 行会附在错误信息里。已就绪之后子进程再崩溃**不会**走这条路——那只能通过 `session.server.exited` / `onExit` 观察，SDK 不自动重启。

### 3.6 只要进程、不要客户端：`spawnAppServer`

```ts
import { spawnAppServer } from "@flowy-agent-store/sdk";
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const server = await spawnAppServer({ dataDir: "/var/lib/my-app/agent-store" });
try {
  const url = `ws://${server.readiness.host}:${server.readiness.port}/api/app-server/ws`;
  const client = new AppServerClient({
    transport: new WebSocketTransport(url),
    client: { name: "my-app", version: "1.0.0" },
  });
  await client.connect();
  // … 也可以换成 HttpTransport，或自己接别的传输
} finally {
  await server.close();
}
```

> 这些配方都走 `launchClient` / `spawnAppServer`：省略 `dataDir` 时自动创建临时目录并在 `close()` 时删除；要跨调用复用同一个库（会话、已装组件都留着），显式传 `dataDir`——见 §12。

## 4. 浏览器：只连已运行的服务端

浏览器不 spawn 进程，只连 WebSocket；`WebSocketTransport` 会把 `token` 追加为 `?token=` 查询参数（浏览器 WebSocket 不能设自定义头）。

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const transport = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", { token });
const client = new AppServerClient({ transport, client: { name: "web", version: "1.0.0" } });
await client.connect();
```

> 宿主是本地可信模式（就绪行 `auth: "disabled-local"`）时不需要 token。纯请求-响应也可以走 `HttpTransport`——见 §13。

## 5. Electron：主进程 spawn，渲染进程连回环

主进程持二进制与数据目录；渲染进程只拿回环 URL 与（可选的）token。凭据放主进程的系统凭据存储，不要进渲染进程或配置文件明文。

**Electron：主进程 spawn，渲染进程连回环**（凭据留主进程，不进渲染进程）：

```ts
import { spawnAppServer } from "@flowy-agent-store/sdk";

const server = await spawnAppServer({ dataDir: app.getPath("userData") });
win.webContents.send("app-server-ready", {
  url: `ws://${server.readiness.host}:${server.readiness.port}/api/app-server/ws`,
});
app.on("before-quit", () => void server.close());
```

> **Electron 完整接入（主进程 / 预加载 / 渲染进程）**
>
> 上面是最小骨架。真实 Electron 应用要把「运行时拉起与凭据」留在主进程，渲染进程只拿到回环 URL（和可选的 token）。凭据（OAuth 令牌、系统凭据存储）永远不要进渲染进程或配置文件明文。

**主进程 `main.ts`** — spawn 运行时、经 IPC 把连接信息交给渲染进程、退出时清理：

```ts
import { app, BrowserWindow, ipcMain } from "electron";
import { spawnAppServer, type SpawnedServer } from "@flowy-agent-store/sdk";
import { join } from "node:path";

let server: SpawnedServer | null = null;

async function startBackend() {
  server = await spawnAppServer({
    dataDir: join(app.getPath("userData"), "agent-store"),
  });

  // 回环 WS 地址（loopback 下 auth 通常为 disabled-local，无需 token）
  const wsUrl = `ws://${server.readiness.host}:${server.readiness.port}/api/app-server/ws`;
  const token = server.readiness.auth === "disabled-local" ? undefined : await getHostToken();

  // 渲染进程主动来取
  ipcMain.handle("agent-store:get-connection", () => ({ url: wsUrl, token }));

  // 崩溃可见：进程意外退出时记日志（SDK 不自动重启）
  server.exited.then((info) => {
    console.warn("agent-store runtime exited:", info.code, info.signal);
  });
}

app.whenReady().then(startBackend);

app.on("before-quit", async (event) => {
  if (server) {
    event.preventDefault(); // 先等清理完成再退出
    await server.close();
    server = null;
  }
  app.exit();
});
```

> `getHostToken()` 由宿主自己实现——只有服务端要求 token（非 `disabled-local`）时才需要；token 由主进程生成 / 获取，绝不写入渲染进程可访问的明文。

**预加载 `preload.ts`** — 用 `contextBridge` 安全地暴露给渲染进程（不暴露整个 `ipcRenderer`）：

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("agentStore", {
  getConnection: () => ipcRenderer.invoke("agent-store:get-connection"),
});
```

**渲染进程 `renderer.ts`** — 拿到 URL 后自建 `AppServerClient` 并握手：

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const { url, token } = await window.agentStore.getConnection();
const transport = new WebSocketTransport(url, { token, requestTimeoutMs: 30_000 });
const client = new AppServerClient({ transport, client: { name: "electron-ui", version: "1.0.0" } });
await client.connect();

// 之后即可使用全部子客户端
const catalog = await client.connectors.list();
```

> 渲染进程走 `WebSocketTransport` 的 `token` 选项会被自动追加为 `?token=` 查询参数（浏览器 / Electron 的 WebSocket 不能设自定义头）。纯请求-响应场景可用 `HttpTransport`。

## 6. Store：浏览 → 安装 → 就绪 → 卸载

顶层平方法适合一次性脚本：

```ts
// 列出全市场统一目录（首次可能为空，含 markets_pending 标志，见接口参考 §3.3）
const store = await client.listStore();
for (const item of store.items) {
  console.log(item.marketplace_id, item.entry_name, item.kind, item.installed);
}

// 一键安装：缺导入就导入 + 注册
const receipt = await client.installStoreEntry("experts", "frontend-backend-experts");
console.log("installed:", receipt.installed);

// 市场源管理
const markets = await client.listMarketplaces();
const added = await client.addMarketplace({ source_kind: "url", source: "https://example.com/market.json" });
await client.refreshMarketplace(added.marketplace_id);
await client.removeMarketplace(added.marketplace_id, /* cascade */ true);
```

`client.store` 子客户端把同一批 wire 方法编排成一条状态机（`search → install → … → uninstall`），并默认**等到可用**：

```ts
// 找到目标条目（分类过滤可选）
const items = await client.store.search("frontend", { kind: "agent" });

const outcome = await client.store.install(items[0]); // 默认 waitForReady: true
if (!outcome.ok) console.warn("components failed:", outcome.components.filter((c) => !c.ok));
if (outcome.ready === false) {
  // 需要授权的连接器会立刻返回，不会把就绪超时预算烧光
  if (outcome.readyIssue === "authorization_required") {
    await client.connectors.authStart(outcome.readyComponentId!);
  } else {
    console.warn("not ready:", outcome.readyIssue);
  }
}

// 已安装清单与版本提示（没有「更新」动词）
const installed = await client.store.installed();
const behind = await client.store.checkUpdates();
if (behind.length > 0) console.log(client.store.updateHint(behind[0])); // "uninstall_reinstall"

await client.store.setEnabled(items[0], false); // 技能只翻目录标记，见下
await client.store.uninstall(items[0]);         // 真的释放运行时产物
```

几条实测结论：

- 技能拷完即可用；连接器注册出来是 **disabled** 的既定默认，所以就绪检查会先 enable 再探针。
- 就绪超时**不丢安装结果**：返回成功安装 + `ready: false` / `readyIssue: "ready_timeout"`。
- 没有更新动词：`checkUpdates()` / `updateHint()` 只告诉你该「卸载后重装」。
- 卸载是**可重入**的：产物已不在算成功；部分失败时那些组件保持已安装、`ok: false`、并点名到组件。
- `setEnabled(item, false)` 对技能只翻一个目录层标记，返回 `code: "skill_disable_flag_only"`——要让技能离开运行时只能 `uninstall`。

## 7. 会话与 Run

**会话：创建 → 发送 → 实时接收**

```ts
import { decodeConversationEvent } from "@flowy-agent-store/protocol";

const conv = await client.conversations.create({ name: "demo" });
const sub = await client.conversations.follow(conv.conversation_id);
sub.onEvent((event) => {
  const decoded = decodeConversationEvent(event);
  if (decoded.kind === "message.delta") render(decoded.delta, decoded.replace);
});
sub.onBackfill((snapshot) => resetTranscript(snapshot.messages));
sub.onError((error) => report(error));

const receipt = await client.conversations.send(
  conv.conversation_id,
  "帮我写个 REST API",
  crypto.randomUUID(), // 必须显式幂等键
);
```

**Run：发起 → 等待结果 → 处理审批**

```ts
const run = await client.runs.agent({
  agentId: "frontend-backend-experts",
  goal: "Generate a todo REST API",
});
const result = await client.runs.result(run.run_id); // 终态后才成功
console.log(result.status);

// 若 Agent 需要人决策，follow 实时事件并回答
const sub = await client.runs.follow(run.run_id);
sub.onEvent((event) => {
  if (event.event_type !== "approval.requested") return;
  client.runs.answerDecision({
    runId: run.run_id,
    stepId: event.step_id!,
    attemptId: event.attempt_id!,
    answer: "批准，继续执行",
    expectedExecutionVersion: event.expected_execution_version!,
    expectedStepVersion: event.expected_step_version!,
    expectedAttemptVersion: event.expected_attempt_version!,
  });
});
```

> `answerDecision` 的三个 `expected*Version` 是必填 CAS 令牌，任一变化即返回 `conflict`（见[接口参考](/zh-CN/docs/typescript-sdk) §5.4）。带 `idempotency_key` 的写操作可安全重放。

## 8. Connector OAuth 全流程

典型链路：`list` 取 `connectorId` → `authStart` 发起浏览器流 → 轮询 `authStatus` 至 `authenticated` → 用完 `logout` 吊销。

```ts
// 1) 从目录取得 connectorId
const catalog = await client.connectors.list();
const github = catalog.find((c) => c.id === "github");
if (!github) throw new Error("github connector not found in catalog");

// 2) 先看认证态：已认证则可跳过授权
const before = await client.connectors.authStatus(github.id);
if (before.state !== "authenticated") {
  // 3) 发起宿主浏览器 OAuth 流（立即返回 started，不阻塞）
  const started = await client.connectors.authStart(github.id);
  if (started.state !== "started") {
    throw new Error(started.error ?? "auth start failed");
  }

  // 4) 轮询直到 authenticated（或超时 / 需要重新授权）
  const deadline = Date.now() + 5 * 60_000; // 5 分钟宽限
  let authenticated = false;
  while (Date.now() < deadline) {
    const status = await client.connectors.authStatus(github.id);
    if (status.state === "authenticated") { authenticated = true; break; }
    if (status.state === "reauthorization_required") {
      throw new Error("reauthorization required");
    }
    await new Promise((r) => setTimeout(r, 1_500)); // 1.5s 间隔
  }
  if (!authenticated) throw new Error("oauth timed out");
}

// 5) 授权后连接器状态应为 connected（认证就绪 + 最近探测成功）
const status = await client.connectors.status(github.id);
console.log(status.status);

// 6) 用完吊销令牌
await client.connectors.logout(github.id);
```

> `authStart` 只返回 `started`，**不返回授权 URL 或 token**——浏览器流程由可信宿主持有，客户端只触发与轮询（见[接口参考](/zh-CN/docs/typescript-sdk) §3.4）。stdio 类型连接器不支持 OAuth，服务端会报 `OAuth is not supported for stdio connectors`。

## 9. 目录类短例：agents / teams / skills / models / workspaces

```ts
const agents = await client.agents.list();          // AgentSummary[]
const one = await client.agents.get(agents[0].id);  // AgentDetail：含声明式 skills / connectors
console.log(one.name, one.skills, one.preset_id);   // preset_id 在 install/* 之后才有

const teams = await client.teams.list();            // TeamSummary[]
const team = await client.teams.get(teams[0].id);   // TeamDetail：成员 + 可绑定的 Connector 面

const skills = await client.skills.list();          // SkillSummary[]
console.log(skills.filter((s) => s.writable).map((s) => s.name)); // 可写的用户技能

const models = await client.models.list();          // ModelSummary[]：当前宿主可用模型

const workspaces = await client.workspaces.list();  // WorkspaceView[]
const created = await client.workspaces.create("/abs/path/to/project"); // 服务端 canonicalize
await client.workspaces.revoke(created.workspace_id); // 软删除，既有会话保留
```

## 10. 工具面控制：`AGENT_STORE_TOOLS`

宿主的工具面来自 `~/.agent-store/config.toml` 的 `[tools]` 表。**自己 spawn 宿主时不必改那份文件**——用环境变量 `AGENT_STORE_TOOLS` 传 JSON，`launchClient` 会把它合并进子进程环境：

```ts
const session = await launchClient({
  client: { name: "basic-only", version: "1.0.0" },
  env: {
    AGENT_STORE_TOOLS: JSON.stringify({
      web: true,       // 联网检索 / 读页面：保留为基础能力
      computer: false, // 桌面控制（键鼠 / UIA）
      browser: false,  // 浏览器自动化（带操作者 profile 与登录态）
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
```

| 事实 | 行为 |
| --- | --- |
| 值 | JSON，形状同 `[tools]` 表；`{}` = 全部默认开 |
| 优先级 | 环境变量**整份替换**文件里的 `[tools]`，不是合并 |
| 生效范围 | 只有采纳 `[tools]` 的宿主（`apps/agent-store`）；桌面 / Web 宿主不采纳 |
| 不可解析 | 打 warning 后回落文件；**空值 = 未设置**（不是「全禁」） |
| 生效时机 | 宿主启动时读一次；`launchClient` 每次都是新进程，天然生效 |

> 环境变量一旦存在，文件里的 `[tools]` 就被忽略——包括宿主自己经设置写进去的值。字段与坑的完整口径见仓库 `docs/agent-store/20-tool-injection-policy.zh.md`。

## 11. 错误与重试

四个错误类与 `isRetryableError` / `formatError` 都从 `@flowy-agent-store/protocol` 导出，`withRetry` 按稳定 `retryable` 指数退避：

```ts
import { withRetry } from "@flowy-agent-store/client";

const view = await withRetry(() => client.runs.get(runId), {
  maxAttempts: 4,
  onRetry: ({ attempt, delayMs }) => log(`retry ${attempt} in ${delayMs}ms`),
});
```

按错误类型分支时**只认稳定 `code`，不要解析 message**：

```ts
import { AppServerError, formatError, isRetryableError } from "@flowy-agent-store/protocol";

try {
  await client.runs.result(runId);
} catch (error) {
  if (error instanceof AppServerError && error.code === "connector_unavailable") {
    await enableConnector(); // 稳定 code 是唯一可分支的契约
  } else if (isRetryableError(error)) {
    // 交回 withRetry，或自行退避后重试
  }
  console.error(formatError(error)); // 唯一的人读文案
}
```

带 `idempotency_key` / `command_id` 的写操作可安全重放：服务端对同键请求去重，不会重复执行。

## 12. 在 CI / 测试里用

```ts
const session = await launchClient({
  bin: process.env.AGENT_STORE_BIN, // 预构建二进制；省略则按四条途径自动查找
  dataDir: process.env.CI_DATA_DIR, // 自持目录 → 不删除；省略 = 临时目录 + close 时删除
  readyTimeoutMs: 180_000,          // 冷启动建库
  requestTimeoutMs: 120_000,        // 首个 store/list 会触发市场镜像下载
  client: { name: "ci-smoke", version: "1.0.0" },
  onExit: (info) => console.error("runtime exited", info.code, info.signal),
});
try {
  const store = await session.client.listStore();
  // 冷启动时目录可能是空的：markets_pending 为 true 表示内置市场仍在后台注册
  if (store.items.length === 0) console.warn("store still warming:", store.markets_pending);
} finally {
  await session.close();
}
```

- 二进制定位顺序 `bin` → `AGENT_STORE_BIN` → 平台运行时包的 `vendor/` → `PATH`；**找不到就报错，不会下载**，CI 里请固定一份预构建产物。
- 同一 `dataDir` 有**单实例锁**：并行跑测试要各用各的目录，否则后启动的那个会 fail-fast。
- 冷启动的首次 `store/list` 会触发市场镜像下载（全新 data-dir 实测约 90 秒），所以要放宽 `requestTimeoutMs`；它返回空目录**不是错误**。
- 子进程异常退出**不会自动重启**：用 `server.exited` / `onExit` 观测，并用 `try/finally`（或测试框架的 `afterAll`）保证 `close()`。

## 13. 自建传输：WebSocket 还是 HTTP

```ts
import { AppServerClient, HttpTransport, WebSocketTransport, httpRouteTable } from "@flowy-agent-store/client";

// 实时事件 / 订阅：只能 WebSocket
const ws = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", { token });
const live = new AppServerClient({ transport: ws, client: { name: "ui", version: "1.0.0" } });
await live.connect();
const sub = await live.conversations.follow(conversationId); // 只有 WS 绑定的传输能订阅

// 纯请求-响应：HTTP 够用（每次调用独立握手，connect() 是 no-op）
const http = new HttpTransport({ baseUrl: "http://127.0.0.1:8787" });
const plain = new AppServerClient({ transport: http, client: { name: "cli", version: "1.0.0" } });
await plain.connect();
await plain.listStore();

// 有 22 个方法没有 HTTP 绑定：调用会抛 TransportError；路由表可自查
console.log(Object.keys(httpRouteTable()).length);
```

| | `WebSocketTransport` | `HttpTransport` |
| --- | --- | --- |
| 实时事件与订阅（`follow`、`onNotification`） | 支持 | **不支持**（`notify()` 抛错、`onNotification()` 返回空订阅） |
| 连接方式 | 长连接，一次握手 | 每次调用独立握手 |
| 适合 | UI、长会话、Run 事件 | 脚本、CI、一次性查询 |

## 14. 常见坑（实测结论）

- **临时 data-dir**：省略 `dataDir` → 每次 `launchClient` 新建临时目录并在 `close()` 时删除；进程被强杀时目录会残留。
- **单实例锁**：同一个 data-dir 不能并发跑两个宿主。
- **首个 `store/list` 慢**：默认 30s 的请求超时可能不够；返回空目录可能是 `markets_pending: true`（仍在后台注册），**不是错误**。
- **连接器装完是 disabled**：`store.install` 会先 enable 再探针；用顶层 `installStoreEntry` 则要自己 `enableInstall`。
- **没有更新动词**：`checkUpdates()` / `updateHint()` → `uninstall_reinstall`。
- **技能禁用只是目录标记**：`store.setEnabled(item, false)` 对技能返回 `code: "skill_disable_flag_only"`；要让技能离开运行时只能 `uninstall`。
- **协议指纹**：就绪行的 `protocol_version` 与 SDK 不一致时，SDK 直接杀掉子进程并报错——它是契约指纹，不是版本号。
- **二进制不下载**：`bin` → `AGENT_STORE_BIN` → 平台运行时包的 `vendor/` → `PATH`，找不到直接报错。
- **实时事件尽力而为**：会丢、会乱序；持久性靠 `run/events` 游标重放，`rearm()` 会重放全部历史（自行按 `sequence` 去重）。

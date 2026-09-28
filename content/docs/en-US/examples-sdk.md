# TypeScript SDK cookbook

This document serves as the practical example companion to the [TypeScript SDK reference](/en-US/docs/typescript-sdk), providing copy-paste integration patterns across major usage scenarios.

> Architecture breakdown: `@flowy-agent-store/protocol` supplies pure type contracts and error classes; `@flowy-agent-store/client` provides transport-decoupled client abstractions; `@flowy-agent-store/sdk` encapsulates Node.js host lifecycle orchestration (`launchHarness`). **Real-time subscriptions mandate `WebSocketTransport`**; stateless request-response invocations can use `HttpTransport`.

## 1. Which package for which job

| Package | Use it when | Runtime |
| --- | --- | --- |
| `@flowy-agent-store/protocol` | You only need type contracts and error definitions, or build a custom transport | Universal (zero-runtime overhead) |
| `@flowy-agent-store/client` | Connecting to an active App Server instance (desktop client or standalone daemon) | Universal (Node.js or browser) |
| `@flowy-agent-store/sdk` | Orchestrating runtime process lifecycles programmatically | Node.js ≥ 22 or Bun |

## 2. Before you start

```bash
node -v                      # Node.js >= 22 (global WebSocket), or use Bun instead
bun add @flowy-agent-store/sdk   # or npm install / pnpm add

# The runtime binary: the SDK never downloads it — bin → AGENT_STORE_BIN → the runtime package's vendor/ → PATH
export AGENT_STORE_BIN=/opt/flowy-agent-store/flowy-agent-store
```

## 3. Node: one call to launch, one full lifecycle

Spawns the local runtime, discovers dynamic port allocations, binds over loopback, and completes handshake initialization in a single call:

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({
  client: { name: "my-app", version: "0.1.0" },
});
const store = await harness.listStore();
await harness.close();
```

Internal lifecycle steps performed by `launchHarness`:

1. Discovers the runtime binary (`bin` $\to$ `AGENT_STORE_BIN` $\to$ optional platform packages $\to$ system `PATH`);
2. Spawns a child process with `--host 127.0.0.1 --port 0 --no-open` and an isolated temporary `--data-dir`;
3. Scans stdout for the machine-readable readiness line (`{"agent_store":"listening",...}`) to extract assigned ports;
4. Enforces strict `protocol_version` equality against the SDK, terminating child processes on mismatch;
5. Connects via loopback WebSocket and completes `initialize` $\to$ `initialized` handshakes, returning an active `AppServerClient`.

> See [TypeScript SDK reference](/en-US/docs/typescript-sdk) §4 for complete parameter options and lifecycle teardown rules.

### 3.1 Install an expert → run it once → read the result

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({ client: { name: "demo", version: "1.0.0" } });
try {
  // Catalog (Store)
  const items = await harness.listStore();
  console.log(`${items.items.length} items in the store`);

  // Install and run an agent
  await harness.installStoreEntry("experts", "frontend-backend-experts");
  const receipt = await harness.runs.agent({
    agentId: "frontend-backend-experts",
    goal: "Generate a todo REST API",
  });
  const result = await harness.runs.result(receipt.run_id);
  console.log(result.status);
} finally {
  await harness.close(); // terminate child + remove temp data-dir
}
```

### 3.2 Sessions + live events

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({ client: { name: "my-tool", version: "1.0.0" } });
try {
  const conversation = await harness.conversations.create({ name: "demo" });
  const subscription = await harness.conversations.follow(conversation.conversation_id);
  subscription.onEvent((event) => console.log(event.event_type));
  await harness.conversations.send(conversation.conversation_id, "hello", crypto.randomUUID());
} finally {
  await harness.close(); // terminate the child process + remove the temp data-dir
}
```

### 3.3 A fixed binary plus your own data-dir (CI / parallel instances / a reusable store)

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({
  bin: "/opt/flowy-agent-store/flowy-agent-store", // omitted ⇒ §2's four routes are searched
  dataDir: "/var/lib/my-app/agent-store",          // you own it ⇒ never deleted; the store survives across calls
  readyTimeoutMs: 180_000,                         // cold start builds the database
  requestTimeoutMs: 120_000,                       // store/list does not wait for market registration; empty? check markets_pending
  extraArgs: ["--agent-store-config", "/etc/my-app/agent-store.toml"], // point at another host config
  client: { name: "ci-smoke", version: "1.0.0" },
  onExit: (info) => console.error("runtime exited", info.code, info.signal),
});
try {
  const store = await harness.listStore();
  console.log(store.items.length, store.markets_pending);
} finally {
  await harness.close(); // your own directory is left in place
}
```

> Defaults to port `0` (dynamic allocation); parallel instances must use isolated `dataDir` paths to prevent file lock contention.

### 3.4 A host behind a token, plus capabilities

```ts
const harness = await launchHarness({
  client: { name: "internal-ui", version: "2.0.0" },
  // required when the host runs with --auth; optional in local mode (server.readiness.auth === "disabled-local")
  token: process.env.AGENT_STORE_TOKEN ?? "",
  // declare what you will consume: events / approvals / team_runtime / artifacts
  capabilities: { events: true, approvals: true, team_runtime: true, artifacts: false },
});
console.log(harness.server.readiness.url, harness.handshake.protocol_version);
```

### 3.5 Catching a failed launch

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

try {
  const harness = await launchHarness({ client: { name: "my-app", version: "1.0.0" } });
  // Normal business operations
} catch (error) {
  // Catches three primary startup failure categories:
  // 1) Binary not found: details searched file locations
  // 2) Readiness timeout or premature process exit
  // 3) Protocol version contract mismatch
  console.error(String(error));
}
```

The SDK enforces clean teardown upon failure, emitting the final 50 stderr lines. Unexpected crashes following readiness can be monitored via `server.exited` and `onExit` callbacks.

### 3.6 Process only, no client: `spawnAppServer`

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
} finally {
  await server.close();
}
```

## 4. Browser: connect to an already-running server

Browser environments connect exclusively over persistent sockets. `WebSocketTransport` injects `token` parameters as query strings automatically:

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const transport = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", { token });
const client = new AppServerClient({ transport, client: { name: "web", version: "1.0.0" } });
await client.connect();
```

> Tokens are optional in local trusted mode; stateless requests can switch to `HttpTransport`.

## 5. Electron: spawn in the main process, connect from the renderer

The Electron main process manages runtime binaries and physical data directories, while the renderer receives only loopback socket URLs and session tokens. Secrets remain strictly confined to the main process.

**Main Process `main.ts`**:

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

**Preload Script `preload.ts`**:

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("agentStore", {
  getConnection: () => ipcRenderer.invoke("agent-store:get-connection"),
});
```

**Renderer Process `renderer.ts`**:

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const { url, token } = await window.agentStore.getConnection();
const transport = new WebSocketTransport(url, { token, requestTimeoutMs: 30_000 });
const client = new AppServerClient({ transport, client: { name: "electron-ui", version: "1.0.0" } });
await client.connect();

// 之后即可使用全部子客户端
const catalog = await client.connectors.list();
```

## 6. Store: browse → install → ready → uninstall

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

Using the `client.store` sub-client for orchestrated state transitions:

```ts
// 找到目标条目（分类过滤可选）
const items = await client.store.search("frontend", { kind: "agent" });

const outcome = await client.store.install(items[0]); // 默认 waitForReady: true
if (!outcome.ok) console.warn("components failed:", outcome.components.filter((c) => !c.ok));
if (outcome.ready === false) {
  // 需要授权的连接器会立刻返回，不会把就绪超时预算烧光
  if (outcome.readyIssue === "authorization_required") {
    const started = await client.connectors.authStart(outcome.readyComponentId!);
    // authStart 只确认「浏览器已拉起」：之前的失败同步回 state:"error"
    if (started.state === "error") throw new Error(started.error ?? "auth start failed");
    const auth = await client.connectors.waitForAuth(outcome.readyComponentId!);
    // 之后的失败只能从 authStatus.error 读到，waitForAuth 会把它带回来
    if (auth.state !== "authenticated") {
      throw new Error(auth.state === "error" ? auth.error : "oauth timed out in the browser");
    }
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

- Connectors initialize as `disabled`; `store.install` automatically handles enablement and periodic probe validation.
- Readiness timeouts preserve installed asset records while indicating `ready: false`.
- Upgrades follow uninstall-and-reinstall (`uninstall_reinstall`) semantics.

## 7. Sessions and Runs

### 7.1 Session: create → send → receive in real time

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

### 7.2 Mount a Skill for one turn (`fp-3`)

Skill attachments apply dynamically to the target turn only:

```ts
const skills = await client.skills.list();
const releaseNotes = skills.find((skill) => skill.name === "release-notes");

await client.conversations.send(conv.conversation_id, "按这个技能的步骤发版", crypto.randomUUID(), {
  mentions: [{ kind: "skill", id: releaseNotes!.id }],
});
// 同一轮也可以带图片附件（会话工作区内的绝对路径）：
// { attachments: ["/abs/path/inside/workspace.png"] }
```

> `mentions` accepts only `kind: "skill"`. Non-skill kinds fail with `invalid_request`.

### 7.3 Open a conversation as an expert (`fp-4`)

```ts
const experts = await client.agents.list();
const architect = experts.find((agent) => agent.name === "software-architect");

const expertChat = await client.conversations.create({
  name: "重构讨论",
  agentId: architect!.id, // 未安装会得到 agent_not_installed
});
// 之后照常 send：每一轮都在这个专家的身份、技能与连接器栅栏下运行。
await client.conversations.send(expertChat.conversation_id, "先看模块边界", crypto.randomUUID());
```

> Expert identities bind during conversation creation; switching experts requires creating a new session.

### 7.4 Open a team's Leader conversation (`fp-5`)

```ts
const teams = await client.teams.list();
const leader = await client.conversations.create({ teamId: teams[0].id });

// 你的第一条消息就是 Leader 的首轮：它在这里调用 nomi_delegate 把活分下去。
await client.conversations.send(leader.conversation_id, "把这版需求拆成计划", crypto.randomUUID());
```

> `teamId` and `agentId` are mutually exclusive; team conversations generate standard system display titles.

### 7.5 Several conversations in one host

A single host instance manages multiple concurrent sessions, multiplexed across a single WebSocket connection:

```ts
// ① 并存：三个普通会话（要用专家 / 团 Leader，给 create 加 agentId / teamId 即可，见 §7.3 / §7.4）
const explain = await client.conversations.create({ name: "解释报错" });
const review = await client.conversations.create({ name: "评审 A 分支" });
const notes = await client.conversations.create({ name: "写发布说明" });
const chats = [explain, review, notes];

// ② 一条 WS 连接把它们全订上：服务端按连接维护订阅集合，事件按 conversation_id 分流
for (const view of chats) {
  const sub = await client.conversations.follow(view.conversation_id);
  // 分流就是这一行：闭包记住是哪个会话，同一根连接上三个会话的事件不会串
  sub.onEvent((event) => render(view.conversation_id, event));
}

// ③ 并发：两个会话同时各跑一轮，互不阻塞（忙判定按会话，没有宿主级并发闸）
const receipts = await Promise.all([
  client.conversations.send(explain.conversation_id, "解释一下这个报错", crypto.randomUUID()),
  client.conversations.send(review.conversation_id, "评审 A 分支的改动", crypto.randomUUID()),
]);
// 回执是「已受理」不是「已跑完」（§14）：两轮在后台流式跑，终态从 ② 的事件里拿
console.log(receipts.map((r) => ({ accepted: r.accepted, completed: r.completed })));

// ④ 枚举续聊：list 默认 100，返回的都是这个宿主里的会话
for (const view of await client.conversations.list()) {
  console.log(view.conversation_id, view.name, view.is_processing);
}
```

> Concurrency conflicts evaluate per-conversation; process-level isolation requires independent `dataDir` assignments.

### 7.6 Run: start → await result → handle approval

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

## 8. Connector OAuth end-to-end

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
    // 浏览器之前的失败：当场就有原因
    throw new Error(started.error ?? "auth start failed");
  }

  // 4) 等到结束（默认 120s 预算 = 宿主的回调窗口）
  const auth = await client.connectors.waitForAuth(github.id);
  if (auth.state === "error") {
    // 浏览器之后的失败只有这一条通道：换 token 被拒 / 回调超时 / 被限流
    throw new Error(auth.error);
  }
  if (auth.state === "timeout") {
    throw new Error("oauth did not finish in the browser");
  }
}

// 5) 授权后连接器状态应为 connected（认证就绪 + 最近探测成功）
const status = await client.connectors.status(github.id);
console.log(status.status);

// 6) 用完吊销令牌
await client.connectors.logout(github.id);
```

### 8.1 Calling a tool: read the signature first

```ts
// 1) 现场探针：真连接一次（stdio 会 spawn 子进程），结果落库——get() 随后读的就是它
const probe = await client.connectors.test(github.id);
if (!probe.success) throw new Error(probe.error ?? "probe failed");
if (probe.tools_truncated) {
  // 名字与描述永不省略；只有 schema 会为控制体积被整份略去
  console.warn("host omitted some schemas to stay inside its size budget");
}

// 2) 挑一个工具，读它收什么参数
const tool = probe.tools?.find((t) => t.name === "create_issue");
console.log(tool?.description, tool?.input_schema);

// 3) 按签名传参调用
const call = await client.connectors.call(github.id, "create_issue", {
  owner: "acme",
  repo: "site",
  title: "flush the docs",
});
if (call.is_error) {
  // 参数不对 / 服务器自己拒绝：promise 仍然 resolve，错误在结果对象里
  console.error(call.result);
}
```

## 9. Catalogue one-liners

### 9.1 Catalogue calls: list / get

```ts
const agents = await client.agents.list();          // AgentSummary[]
const one = await client.agents.get(agents[0].id);  // AgentDetail：含声明式 skills / connectors
console.log(one.name, one.skills, one.preset_id);   // preset_id 在 install/* 之后才有

const teams = await client.teams.list();            // TeamSummary[]
const team = await client.teams.get(teams[0].id);   // TeamDetail：成员 + 可绑定的 Connector 面

const skills = await client.skills.list();          // SkillSummary[]
console.log(skills.filter((s) => s.writable).map((s) => s.name)); // 可写的用户技能

const models = await client.models.list();          // ModelSummary[]：当前宿主可用模型
```

### 9.2 workspaces: create and revoke

```ts
const workspaces = await client.workspaces.list();  // WorkspaceView[]
const created = await client.workspaces.create("/abs/path/to/project"); // 服务端 canonicalize
await client.workspaces.revoke(created.workspace_id); // 软删除，既有会话保留
```

### 9.3 Reading the files a Skill ships

```ts
if (client.initializeInfo?.capabilities.skill_files) {   // 宿主可以只接目录不接文件面
  const inventory = await client.skills.files("release-notes");
  for (const file of inventory.files) {
    console.log(file.path, file.size, file.digest);
  }
  console.log("tree digest:", inventory.content_digest); // 该技能目录的摘要，不是快照摘要
  if (inventory.truncated) console.warn("inventory incomplete");

  const bytes = await client.skills.readFile("release-notes", "references/guide.md");
  console.log(new TextDecoder().decode(bytes));
}
```

### 9.4 Exporting an expert / team to an external runtime (`fp-8`)

```ts
if (client.initializeInfo?.capabilities.expert_export) {  // 报的是「这个面接没接」，不是「这个 id 能不能导」
  const pack = await client.agents.export("wb-…");         // ExpertPack
  console.log(pack.pack_format, pack.kind, pack.persona.instructions);
  console.log(pack.model, pack.skills, pack.provenance.content_digest);

  const team = await client.teams.export("wb-…", "1.0.0"); // 第二参是可选的版本钉；不匹配即 version_mismatch
  for (const member of team.team!.members) console.log(member.id, member.name); // 团长在首位
}
```

Export definitions and materialize to disk via `exportTeam`:

```ts
import { exportTeam } from "@flowy-agent-store/sdk";

// 整包失败留在服务端：任一成员缺失 ⇒ 整个调用失败，不落任何文件
const result = await exportTeam(client, teamId, "./frontend-backend-experts");
result.pack;           // ExpertPack —— 内存里也拿得到，不需要二次调用
result.writtenSkills;  // 实际写入的技能名（跨成员去重后）
result.danglingSkills; // 声明了但本机取不到的技能：{ id, error } —— 如实上报，不静默跳过
```

Low-level directory assembly pattern:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const pack = await client.agents.export(agentId);
await mkdir(dir, { recursive: true });
await writeFile(join(dir, "expert-pack.json"), JSON.stringify(pack, null, 2));
await writeFile(join(dir, "persona.md"), pack.persona.instructions);
for (const skill of pack.skills) {
  for (const file of (await client.skills.files(skill.id)).files) {
    const target = join(dir, "skills", skill.name, file.path); // path 是技能目录内的 POSIX 相对路径
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await client.skills.readFile(skill.id, file.path));
  }
}
```

## 10. Controlling the tool surface: `AGENT_STORE_TOOLS`

Override host tool configurations dynamically via environment variables:

```ts
const harness = await launchHarness({
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

| Fact | Behavior |
| --- | --- |
| Value | JSON matching the `[tools]` table schema; `{}` resets to permissive defaults |
| Precedence | Replaces the configuration file `[tools]` table completely |
| Scope | Enforced exclusively by `apps/agent-store` |
| Fallback | Parsing errors emit warnings and fallback to file configuration |
| Lifecycle | Evaluated once during process initialization |

## 11. Errors and retry

```ts
import { withRetry } from "@flowy-agent-store/client";

const view = await withRetry(() => client.runs.get(runId), {
  maxAttempts: 4,
  onRetry: ({ attempt, delayMs }) => log(`retry ${attempt} in ${delayMs}ms`),
});
```

Branch on structured error `code` fields:

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

## 12. Using it in CI and tests

```ts
const harness = await launchHarness({
  bin: process.env.AGENT_STORE_BIN, // 预构建二进制；省略则按四条途径自动查找
  dataDir: process.env.CI_DATA_DIR, // 自持目录 → 不删除；省略 = 临时目录 + close 时删除
  readyTimeoutMs: 180_000,          // 冷启动建库
  requestTimeoutMs: 120_000,        // store/list 不等市场注册（zip 归档在后台下载）
  client: { name: "ci-smoke", version: "1.0.0" },
  onExit: (info) => console.error("runtime exited", info.code, info.signal),
});
try {
  const store = await harness.listStore();
  // 冷启动时目录可能是空的：markets_pending 为 true 表示内置市场仍在后台注册
  if (store.items.length === 0) console.warn("store still warming:", store.markets_pending);
} finally {
  await harness.close();
}
```

- Provide precompiled binary paths in CI environments;
- Assign unique `dataDir` directories to concurrent test jobs to prevent lock collisions;
- The initial `store/list` call returns immediately; poll `markets_pending` to confirm background sync completion;
- Ensure `harness.close()` is called within `afterAll` hooks to release process resources.

## 13. Rolling your own transport: WebSocket or HTTP

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

// 有 25 个方法没有 HTTP 绑定：调用会抛 TransportError；路由表可自查
console.log(Object.keys(httpRouteTable()).length);
```

| | `WebSocketTransport` | `HttpTransport` |
| --- | --- | --- |
| Real-time events and subscriptions (`follow`, `onNotification`) | Supported | **Unsupported** (`notify()` throws, `onNotification()` returns empty subscription) |
| Connection mode | Persistent socket with single handshake | Independent handshake per invocation |
| Best for | UI clients, continuous conversations, Run events | Scripts, CI jobs, one-off queries |

## 14. Traps (verified against the runtime)

- **Ephemeral Data Directories**: Omitting `dataDir` creates a temporary directory deleted upon `close()`; process aborts may leave uncollected files.
- **Single-Instance Locks**: Concurrent processes targeting the same `dataDir` fail fast.
- **Asynchronous Acceptance**: `send()` resolving with `accepted: true` denotes persistence only; model generation streams must be observed via `follow()`.
- **Asynchronous Marketplace Sync**: Initial `store/list` calls return immediately; poll `markets_pending` to detect background sync completion.
- **Initial Connector State**: Connectors register in a `disabled` state by default; `store.install` handles activation automatically.
- **Upgrade Semantics**: Upgrades execute via uninstall and reinstall (`uninstall_reinstall`).
- **Skill Disable Boundaries**: Skills do not support dynamic unloading; `store.setEnabled(item, false)` sets a catalog flag only, requiring `uninstall` for full removal.
- **Protocol Fingerprint Enforcement**: Mismatches in `protocol_version` between client and host terminate execution immediately.
- **Binary Resolution**: Binaries are not retrieved over the network; paths must resolve via configuration or `PATH`.
- **Event Stream Resync**: Real-time push events provide best-effort ordering; reliable consumption requires cursor replays via `run/events`.

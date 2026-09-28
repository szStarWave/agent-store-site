# TypeScript SDK 实战示例

本文档为 [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk) 的配套实战代码示例集，集中提供各应用场景下开箱即用的工程实现范式。

> 三个包的架构分工：`@flowy-agent-store/protocol` 提供纯类型契约与错误模型；`@flowy-agent-store/client` 提供传输解耦的 `AppServerClient` 及业务子客户端；`@flowy-agent-store/sdk` 封装 Node.js 宿主进程编排（`launchHarness`）。**实时事件订阅需使用 `WebSocketTransport`**，无状态请求响应可选用 `HttpTransport`。

## 1. 三个包与运行环境对照

| 包 | 用在什么场景 | 运行环境 |
| --- | --- | --- |
| `@flowy-agent-store/protocol` | 仅需类型定义与错误类型，或自主实现传输层 | 通用环境（零运行时开销） |
| `@flowy-agent-store/client` | 连接已运行的 App Server 实例（桌面端或独立服务） | 通用环境（Node.js / 浏览器） |
| `@flowy-agent-store/sdk` | 由 Node.js 进程自主拉起并托管运行时生命周期 | Node.js ≥ 22 或 Bun |

## 2. 运行前准备

```bash
node -v                      # Node.js >= 22（依赖全局 WebSocket），或改用 Bun
bun add @flowy-agent-store/sdk   # 或 npm install / pnpm add

# 运行时二进制：SDK 不下载，按 bin 参数 → AGENT_STORE_BIN → 平台运行时包的 vendor/ → PATH 查找
export AGENT_STORE_BIN=/opt/flowy-agent-store/flowy-agent-store
```

## 3. Node：一行拉起 + 完整生命周期

通过单次调用完成运行时进程启动、动态端口探测、回环建连与协议握手：

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({
  client: { name: "my-app", version: "0.1.0" },
});
const store = await harness.listStore();
await harness.close();
```

`launchHarness` 内部执行流程：

1. 按顺序检索运行时二进制（`bin` $\to$ `AGENT_STORE_BIN` $\to$ 可选平台依赖包 $\to$ 系统 `PATH`）；
2. 携带 `--host 127.0.0.1 --port 0 --no-open` 及自动生成的临时 `--data-dir` 启动子进程；
3. 监听标准输出中的 JSON 就绪报文（包含 `"agent_store":"listening"`）获取动态分配的端口；
4. 校验就绪通知中的 `protocol_version` 与 SDK 版本一致性，版本冲突时立即终止子进程并报错；
5. 建立回环 WebSocket 通道并完成 `initialize` $\to$ `initialized` 握手，返回初始化的 `AppServerClient`。

> 完整参数定义与错误恢复规则详见 [接口参考](/zh-CN/docs/typescript-sdk) §4。

### 3.1 装专家 → 跑一次 → 取结果

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({ client: { name: "demo", version: "1.0.0" } });
try {
  // 目录（Store）
  const items = await harness.listStore();
  console.log(`${items.items.length} items in the store`);

  // 安装并运行一个 Agent
  await harness.installStoreEntry("experts", "frontend-backend-experts");
  const receipt = await harness.runs.agent({
    agentId: "frontend-backend-experts",
    goal: "Generate a todo REST API",
  });
  const result = await harness.runs.result(receipt.run_id);
  console.log(result.status);
} finally {
  await harness.close(); // 终止子进程 + 删除临时 data-dir
}
```

### 3.2 会话 + 实时事件

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({ client: { name: "my-tool", version: "1.0.0" } });
try {
  const conversation = await harness.conversations.create({ name: "demo" });
  const subscription = await harness.conversations.follow(conversation.conversation_id);
  subscription.onEvent((event) => console.log(event.event_type));
  await harness.conversations.send(conversation.conversation_id, "你好", crypto.randomUUID());
} finally {
  await harness.close(); // 终止子进程 + 删除临时 data-dir
}
```

### 3.3 固定二进制 + 自持 data-dir（CI / 多实例 / 复用库）

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({
  bin: "/opt/flowy-agent-store/flowy-agent-store", // 省略则按 §2 的四条途径自动查找
  dataDir: "/var/lib/my-app/agent-store",          // 自持目录 ⇒ 不删除，跨调用复用同一个库
  readyTimeoutMs: 180_000,                         // 冷启动要建库
  requestTimeoutMs: 120_000,                       // store/list 不等市场注册；空目录看 markets_pending
  extraArgs: ["--agent-store-config", "/etc/my-app/agent-store.toml"], // 换一份宿主配置
  client: { name: "ci-smoke", version: "1.0.0" },
  onExit: (info) => console.error("runtime exited", info.code, info.signal),
});
try {
  const store = await harness.listStore();
  console.log(store.items.length, store.markets_pending);
} finally {
  await harness.close(); // 自持目录保持原样，不被删除
}
```

> 监听端口默认设为 `0`（由系统分配空闲端口）；多个并发运行的实例必须指定互不重叠的 `dataDir`，否则将触发文件锁保护并报错。

### 3.4 带 token 的宿主与 capabilities

```ts
const harness = await launchHarness({
  client: { name: "internal-ui", version: "2.0.0" },
  // 宿主以 --auth 启动时必填；本地免密模式可省略
  token: process.env.AGENT_STORE_TOKEN ?? "",
  // 声明当前客户端订阅的能力域
  capabilities: { events: true, approvals: true, team_runtime: true, artifacts: false },
});
console.log(harness.server.readiness.url, harness.handshake.protocol_version);
```

### 3.5 启动失败怎么兜

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

try {
  const harness = await launchHarness({ client: { name: "my-app", version: "1.0.0" } });
  // 正常执行业务调用
} catch (error) {
  // 异常处理覆盖三种启动失败场景：
  // 1) 未找到二进制文件：报错包含检索路径详情
  // 2) 就绪等待超时或进程过早退出
  // 3) 协议版本不匹配（protocol_version mismatch）
  console.error(String(error));
}
```

启动失败时，SDK 自动执行安全终止（`SIGKILL`）并附带子进程 stderr 尾部 50 行日志；就绪完成后的非预期崩溃可通过 `server.exited` 与 `onExit` 回调捕获。

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
} finally {
  await server.close();
}
```

## 4. 浏览器：只连已运行的服务端

浏览器运行环境不负责拉起进程，仅建立长连接通信。`WebSocketTransport` 会自动将 `token` 作为 `?token=` 查询参数注入 WebSocket 连接：

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const transport = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", { token });
const client = new AppServerClient({ transport, client: { name: "web", version: "1.0.0" } });
await client.connect();
```

> 本地可信模式下可省略 Token；纯请求响应调用可切换为 `HttpTransport`。

## 5. Electron：主进程 spawn，渲染进程连回环

主进程管理运行时二进制与数据存储目录；渲染进程仅接收回环连接地址及鉴权令牌。私有密钥仅保存在主进程受控的安全存储中。

**主进程 `main.ts`**：

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

**预加载脚本 `preload.ts`**：

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("agentStore", {
  getConnection: () => ipcRenderer.invoke("agent-store:get-connection"),
});
```

**渲染进程 `renderer.ts`**：

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const { url, token } = await window.agentStore.getConnection();
const transport = new WebSocketTransport(url, { token, requestTimeoutMs: 30_000 });
const client = new AppServerClient({ transport, client: { name: "electron-ui", version: "1.0.0" } });
await client.connect();

// 之后即可使用全部子客户端
const catalog = await client.connectors.list();
```

## 6. Store：浏览 → 安装 → 就绪 → 卸载

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

通过 `client.store` 子客户端执行具备就绪等待的状态机编排：

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

- 连接器初始状态为 `disabled`，`store.install` 会自动执行启用与探测，探测以固定节律轮询以避免频繁刷新 Token。
- 就绪超时时保留已安装资产记录，返回 `ready: false` 并附带具体原因。
- 升级操作采用卸载后重新安装（`uninstall_reinstall`）语义。

## 7. 会话与 Run

### 7.1 会话：创建 → 发送 → 实时接收

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

### 7.2 给单独一轮挂技能（`fp-3`）

技能挂载仅对当前对话轮次生效，不影响会话快照：

```ts
const skills = await client.skills.list();
const releaseNotes = skills.find((skill) => skill.name === "release-notes");

await client.conversations.send(conv.conversation_id, "按这个技能的步骤发版", crypto.randomUUID(), {
  mentions: [{ kind: "skill", id: releaseNotes!.id }],
});
// 同一轮也可以带图片附件（会话工作区内的绝对路径）：
// { attachments: ["/abs/path/inside/workspace.png"] }
```

> `mentions` 仅接受 `kind: "skill"`。传入非技能组件将返回 `invalid_request`。

### 7.3 以专家开场（`fp-4`）

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

> 专家角色在会话创建时绑定，变更所属专家需创建新会话。

### 7.4 以专家团开场（`fp-5`）

```ts
const teams = await client.teams.list();
const leader = await client.conversations.create({ teamId: teams[0].id });

// 你的第一条消息就是 Leader 的首轮：它在这里调用 nomi_delegate 把活分下去。
await client.conversations.send(leader.conversation_id, "把这版需求拆成计划", crypto.randomUUID());
```

> `teamId` 与 `agentId` 互斥。绑定团队时无需传入自定义名称，服务端自动生成标准标识。

### 7.5 一个宿主里同时管多个会话

单一宿主进程支持管理多个独立会话，并通过单条 WebSocket 连接实现多会话事件多路复用：

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

> 状态冲突判定基于会话维度生效；若需进程级状态完全隔离，应指定不同的 `dataDir`。

### 7.6 Run：发起 → 等待结果 → 处理审批

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

## 8. Connector OAuth 全流程

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

### 8.1 调用工具：先读签名，再调用

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

## 9. 目录面速查

### 9.1 目录面：list / get

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

### 9.2 workspaces：创建与吊销

```ts
const workspaces = await client.workspaces.list();  // WorkspaceView[]
const created = await client.workspaces.create("/abs/path/to/project"); // 服务端 canonicalize
await client.workspaces.revoke(created.workspace_id); // 软删除，既有会话保留
```

### 9.3 读技能目录下的文件

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

### 9.4 导出专家 / 专家团给外部 runtime（`fp-8`）

```ts
if (client.initializeInfo?.capabilities.expert_export) {  // 报的是「这个面接没接」，不是「这个 id 能不能导」
  const pack = await client.agents.export("wb-…");         // ExpertPack
  console.log(pack.pack_format, pack.kind, pack.persona.instructions);
  console.log(pack.model, pack.skills, pack.provenance.content_digest);

  const team = await client.teams.export("wb-…", "1.0.0"); // 第二参是可选的版本钉；不匹配即 version_mismatch
  for (const member of team.team!.members) console.log(member.id, member.name); // 团长在首位
}
```

通过 `exportTeam` 将专家定义及技能资源完整物化至目标文件目录：

```ts
import { exportTeam } from "@flowy-agent-store/sdk";

// 整包失败留在服务端：任一成员缺失 ⇒ 整个调用失败，不落任何文件
const result = await exportTeam(client, teamId, "./frontend-backend-experts");
result.pack;           // ExpertPack —— 内存里也拿得到，不需要二次调用
result.writtenSkills;  // 实际写入的技能名（跨成员去重后）
result.danglingSkills; // 声明了但本机取不到的技能：{ id, error } —— 如实上报，不静默跳过
```

底层文件结构组装范式：

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

## 10. 工具面控制：`AGENT_STORE_TOOLS`

通过环境变量动态重载宿主工具策略：

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

| 事实 | 行为 |
| --- | --- |
| 值 | JSON，形状同 `[tools]` 表；`{}` = 全部默认开 |
| 优先级 | 环境变量**整份替换**文件里的 `[tools]`，不是合并 |
| 生效范围 | 只有采纳 `[tools]` 的宿主（`apps/agent-store`）；桌面 / Web 宿主不采纳 |
| 不可解析 | 打 warning 后回落文件；**空值 = 未设置**（不是「全禁」） |
| 生效时机 | 宿主启动时读一次；`launchHarness` 每次都是新进程，天然生效 |

## 11. 错误与重试

```ts
import { withRetry } from "@flowy-agent-store/client";

const view = await withRetry(() => client.runs.get(runId), {
  maxAttempts: 4,
  onRetry: ({ attempt, delayMs }) => log(`retry ${attempt} in ${delayMs}ms`),
});
```

根据错误对象中的结构化 `code` 执行业务分支逻辑：

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

## 12. 在 CI / 测试里用

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

- 二进制定位失败时直接报错，CI 环境中建议固定提供构建制品；
- 相同 `dataDir` 具有单实例排他锁，并发用例需分配独立工作目录；
- 首次调用 `store/list` 不阻塞等待市场包解压同步，空列表时需轮询 `markets_pending` 标志；
- 运行时异常退出不执行自动重启，测试生命周期必须通过 `try/finally` 调用 `close()` 释放。

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

// 有 25 个方法没有 HTTP 绑定：调用会抛 TransportError；路由表可自查
console.log(Object.keys(httpRouteTable()).length);
```

| | `WebSocketTransport` | `HttpTransport` |
| --- | --- | --- |
| 实时事件与订阅（`follow`、`onNotification`） | 支持 | **不支持**（`notify()` 抛错、`onNotification()` 返回空订阅） |
| 连接方式 | 长连接，一次握手 | 每次调用独立握手 |
| 适合 | UI、长会话、Run 事件 | 脚本、CI、一次性查询 |

## 14. 常见坑（实测结论）

- **临时数据目录回收**：未指定 `dataDir` 时，`launchHarness` 默认创建临时目录并在 `close()` 时自动删除；宿主进程被强制杀除可能遗留未清理临时文件。
- **单实例互斥锁**：同一数据目录仅允许单一进程独占访问，并发启动将触发快速失败。
- **异步受理语义**：`send()` 返回的 `accepted: true` 仅代表消息已持久化入库，模型流式生成需通过 `follow()` 订阅事件或查询 `is_processing`。
- **市场后台异步同步**：首个 `store/list()` 不等待市场解压，若返回空目录且 `markets_pending: true`，需轮询该标志确认就绪。
- **连接器初始状态**：连接器安装后默认处于禁用状态，高阶方法 `store.install` 会自动启用并执行连通性探测。
- **版本升级机制**：系统未提供原地就地升级命令，资源版本演进遵循卸载并重新安装（`uninstall_reinstall`）规范。
- **技能停用语义**：技能不支持运行时热卸载，`store.setEnabled(item, false)` 仅置目录状态标记，完全移除需执行 `uninstall`。
- **协议版本指纹全等**：就绪通知中的 `protocol_version` 必须与 SDK 完全一致，否则初始化阶段直接终止子进程。
- **二进制查找逻辑**：SDK 不自动从网络下载二进制文件，必须确保系统在指定路径或 `PATH` 中可定位执行文件。
- **实时事件尽力而为**：实时流推送不保证绝对保序，可靠消费需依托 `run/events` 游标接口重放。

# TypeScript SDK 实战示例

本文档为 [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk) 的配套实战示例集，采用由浅入深的进阶编排，覆盖从 5 行代码极简上手到多 Agent 编排、连接器集成及生产高可用治理的完整工程范式。

> **分层架构速查**：`@flowy-agent-store/protocol` 提供纯类型契约与错误模型；`@flowy-agent-store/client` 提供传输解耦的 `AppServerClient` 及 9 个业务子客户端；`@flowy-agent-store/sdk` 封装 Node.js 宿主进程管理（`launchHarness`）。实时事件流推荐使用 `WebSocketTransport`。

## 1. 快速上手：5 行代码拉起与首个对话

| 包名 | 职责与适用场景 | 运行环境 |
| --- | --- | --- |
| `@flowy-agent-store/protocol` | 纯类型契约、错误定义与编解码工具函数 | 通用环境（Node.js / 浏览器 / 零运行时依赖） |
| `@flowy-agent-store/client` | 传输解耦的 `AppServerClient` 客户端及各业务子模块 | 通用环境（Node.js / 浏览器 / Electron 渲染进程） |
| `@flowy-agent-store/sdk` | Node.js 宿主进程生命周期管理、端口分配与测试编排 | Node.js ≥ 22 或 Bun |

```bash
# 安装 SDK 统一封装包（依赖 Node.js ≥ 22 或 Bun）
bun add @flowy-agent-store/sdk # 或 npm install @flowy-agent-store/sdk
```

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

// 1. 一键启动本地宿主进程、动态分配端口并完成协议握手
const harness = await launchHarness({
  client: { name: "quickstart-app", version: "1.0.0" },
});

try {
  // 2. 创建会话并发送第一条消息（显式传递 UUID 确保幂等）
  const chat = await harness.conversations.create({ name: "快速入门" });
  const receipt = await harness.conversations.send(
    chat.conversation_id,
    "你好，请简要介绍你自己",
    crypto.randomUUID(),
  );
  console.log(`消息已成功受理: ${receipt.accepted}`);
} finally {
  // 3. 退出时安全释放连接并回收临时数据目录
  await harness.close();
}
```

## 2. 核心会话与流式事件交互

### 2.1 订阅流式增量事件（打字机输出）

通过 `follow()` 订阅会话流式通道，实时解码接收模型的思考推理过程与正文文本增量：

```ts
import { decodeConversationEvent } from "@flowy-agent-store/protocol";

const chat = await client.conversations.create({ name: "流式交互演示" });
const conversationId = chat.conversation_id;

// 1. 订阅流式事件：实时接收模型思考过程与文本增量
const subscription = await client.conversations.follow(conversationId);
subscription.onEvent((rawEvent) => {
  const event = decodeConversationEvent(rawEvent);
  if (event.kind === "message.thinking") {
    process.stderr.write(`[思考] ${event.thinking}\n`);
  } else if (event.kind === "message.delta") {
    process.stdout.write(event.delta);
  }
});
subscription.onError((error) => console.error("流式接收异常:", error));

// 2. 发送对话消息
await client.conversations.send(
  conversationId,
  "请评估单二进制架构的利弊并输出分析大纲",
  crypto.randomUUID(),
);
```

### 2.2 动态挂载原子技能（单轮请求能力注入）

技能挂载仅对当前对话轮次生效，不影响会话的持久化快照：

```ts
// 1. 检索本地已安装的技能组件
const skills = await client.skills.list();
const gitSkill = skills.find((item) => item.name === "git-workflow");

if (!gitSkill) throw new Error("未安装 git-workflow 技能");

// 2. 在特定对话轮次中通过 mentions 注入技能
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

### 2.3 多会话并发与单 WebSocket 连接多路复用

单一宿主支持并发运行多个独立业务会话，单条 WebSocket 连接即可实现事件流多路分发：

```ts
// 1. 并发创建多个独立业务会话
const chatA = await client.conversations.create({ name: "错误日志分析" });
const chatB = await client.conversations.create({ name: "API 接口设计" });

// 2. 在同一条 WebSocket 连接上并行订阅各个会话
for (const chat of [chatA, chatB]) {
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
```

## 3. 专家角色化与多 Agent 团队编排

### 3.1 单专家角色化会话绑定

为会话绑定专家后，从首轮起受该专家的 Instructions、预设技能与连接器栅栏约束：

```ts
// 1. 检索本地可用专家
const experts = await client.agents.list();
const architect = experts.find((item) => item.name === "software-architect");

if (!architect) throw new Error("目标专家未安装");

// 2. 创建绑定单专家的会话（未安装时抛出 agent_not_installed 错误）
const expertChat = await client.conversations.create({
  name: "架构设计会话",
  agentId: architect.id,
});
await client.conversations.send(expertChat.conversation_id, "规划微内核扩展架构", crypto.randomUUID());
```

### 3.2 专家团队（Team）协同会话

绑定专家团队后，由 Team Leader 统筹规划并将子任务分发给各成员角色：

```ts
// 1. 检索已配置的专家团队
const teams = await client.teams.list();
const teamChat = await client.conversations.create({
  teamId: teams[0].id, // teamId 与 agentId 严格互斥
});

// 2. 发起跨角色协作请求
await client.conversations.send(teamChat.conversation_id, "对当前重构需求制定跨角色执行计划", crypto.randomUUID());
```

## 4. 资源市场与连接器集成

### 4.1 市场条目检索、安装与原地原子升级

```ts
// 1. 统一目录列表检索与一键安装
const store = await client.listStore();
const targetItem = store.items.find((item) => item.entry_name === "frontend-backend-experts");

if (targetItem && !targetItem.installed) {
  await client.installStoreEntry(targetItem.marketplace_id, targetItem.entry_name);
}

// 2. 高阶状态机安装编排（内置就绪等待与状态校验）
const searchResults = await client.store.search("github", { kind: "connector" });
const outcome = await client.store.install(searchResults[0], { waitForReady: true });

if (!outcome.ok) {
  console.warn("部分依赖组件安装失败:", outcome.components.filter((c) => !c.ok));
}

// 3. 检查更新并执行原地原子升级（0.1.0-beta.8 起推荐用法）
const outdated = await client.store.checkUpdates();
for (const entry of outdated) {
  if (client.store.updateHint(entry) === "update") {
    // 原地原子升级：先装新版本，就绪后安全释放旧版本产物；中途失败保留旧安装
    const updateOutcome = await client.store.update(entry, { waitForReady: true });
    console.log(`升级结果: ${updateOutcome.ok ? "成功" : "失败"}`);
  }
}

// 4. 停用与彻底卸载
// await client.store.setEnabled(searchResults[0], false); // 变更目录启用标记
// await client.store.uninstall(searchResults[0]);         // 彻底清理并释放运行时磁盘快照
```

### 4.2 分类筛选与双语标签渲染（fp-15 起）

市场源自带的分类字典与标签元数据现已透出到协议面：`store/categories` 返回各启用市场的分类字典与市场级标签全集；每个条目携带 `category_id`（裸引用）与宿主解析好的 `category`（未命中字典时省略）。本地化文本为 `{zh, en}` 可选对，按当前语言取值即可：

```ts
// 1. 拉取分类字典与标签全集（筛选栏素材；items 为空 = 市场未声明字典，不是错误）
const { items: categories, marketplace_tags } = await client.store.categories();
const activeCategory = categories.find((c) => c.id === "04-DataAI");
console.log(`分类: ${activeCategory?.name.zh} / ${activeCategory?.name.en}`);
console.log("市场级标签:", marketplace_tags?.map((t) => t.zh ?? t.en));

// 2. 按分类筛选条目（宿主已 join 字典，客户端一行 filter 即可）
const catalog = await client.store.list();
const dataAiExperts = catalog.filter((item) => item.category?.id === "04-DataAI");

// 3. 渲染条目标签角标（skill/connector 条目来自市场索引行，legacy 旧名已并入去重）
for (const item of dataAiExperts) {
  const tags = (item.tags ?? []).map((tag) => tag.zh ?? tag.en ?? "");
  console.log(`${item.name} [${item.category?.name.zh ?? item.category_id ?? "未分类"}]: ${tags.join(" · ")}`);
}

// 4. 搜索自然命中标签与分类名（haystack 已包含 tags 与 category.name）
const hits = await client.store.search("办公协同");
```

| 字段 | 语义 | 缺席含义 |
| --- | --- | --- |
| `item.category_id` | 源 manifest 的裸分类引用（如 `04-DataAI`） | 该条目源上未声明分类 |
| `item.category` | 宿主 join 字典后的完整分类（含双语 `name`） | 字典缺失该 id——**宿主不猜**，此时只有裸 id |
| `item.tags` | 本地化标签数组（`{zh, en}` 按位配对） | 空数组或省略 = 无标签 |
| `marketplace_tags` | 市场级标签全集（与 `store/categories` 一同返回） | 无启用市场声明标签全集 |

### 4.3 连接器工具探针测试与动态调用

```ts
// 1. 执行连通性测试并探针获取可用工具签名
const probe = await client.connectors.test("github");
if (!probe.success) {
  throw new Error(probe.error ?? "连接器探针测试失败");
}

// 2. 检索指定工具及其输入参数契约
const targetTool = probe.tools?.find((tool) => tool.name === "create_issue");
console.log("工具描述:", targetTool?.description);

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

### 4.4 连接器用户凭据表单与私有服务注册

```ts
// 1. 查询连接器所需的凭据配置表单
const credForm = await client.connectors.credentials("weather-service");

if (credForm.status === "missing") {
  console.warn(`缺失必需凭据: ${credForm.missing.join(", ")}`);

  // 2. 定向安全写入敏感凭据（单向加密落盘，网络回包中永不越界返回明文）
  await client.connectors.setCredentials("weather-service", {
    WEATHER_API_KEY: "sk-live-mock-api-key-9988",
  });
}

// 3. 动态注册私有 MCP 模板服务（由 ${secret:NAME} 模板自动派生凭据字段）
await client.connectors.register({
  name: "custom-internal-db",
  transport: {
    sse: {
      url: "https://internal.corp/db/sse",
      headers: { Authorization: "Bearer ${secret:INTERNAL_DB_TOKEN}" },
    },
  },
});

// 4. 重置或清除不再需要的凭据
// await client.connectors.clearCredentials("weather-service", ["WEATHER_API_KEY"]);
```

### 4.5 连接器 OAuth 授权全流程

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

// 4. 验证连接器健康状态
const health = await client.connectors.status(connectorId);
console.log(`连接器运行状态: ${health.status}`);

// 5. 任务结束后可安全吊销凭据
// await client.connectors.logout(connectorId);
```

### 4.6 市场源动态管理

```ts
// 1. 列出当前已配置的所有市场源
const marketplaces = await client.listMarketplaces();

// 2. 动态注册新的第三方市场源并立即刷新索引
const added = await client.addMarketplace({
  source_kind: "url",
  source: "https://example.com/custom-market.json",
});
await client.refreshMarketplace(added.marketplace_id);

// 3. 级联移除市场源（cascade: true 同步注销关联的未持久化快照）
await client.removeMarketplace(added.marketplace_id, /* cascade */ true);
```

## 5. 进阶编排与资产物化导出

### 5.1 独立任务（Run）编排与 CAS 决策审批

独立任务适用于长周期、多步骤自治作业，与交互式会话解耦：

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
    // 捕获决策请求并向服务端提交批准判定（必须携带三项版本乐观锁字段）
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

### 5.2 专家与团队全量资源物化导出

```ts
import { exportAgent, exportTeam, materializePack } from "@flowy-agent-store/sdk";

// 模式 A：使用 exportTeam 物化团队（自动聚合包级技能与各成员声明，按 id 去重）
// teamId 取自 teams.list() 的组件 ID（形如 wb-<包名>-team）
const teamResult = await exportTeam(client, "wb-stock-partner-team-team", "./exported-team");
console.log(`已物化技能数: ${teamResult.writtenSkills.length}`);
if (teamResult.danglingSkills.length > 0) {
  console.warn("缺失引用的悬空技能:", teamResult.danglingSkills);
}

// 模式 B：使用 exportAgent 物化单专家
const agentResult = await exportAgent(client, "wb-architect", "./exported-expert");
console.log(`单专家物化路径: ${agentResult.dir}`);

// 模式 C：内存中处理 ExpertPack 并调用 materializePack 落盘
const pack = await client.agents.export("wb-architect");
const customResult = await materializePack(client, pack, "./exported-custom");
console.log(`自定义物化技能: ${customResult.writtenSkills.join(", ")}`);
```

#### 5.2.1 插件级资产（avatars / bin / scripts）随包导出

`fp-14`（`pack_format 2`）起随包导出与 `skills/` 平级的 `avatars/`、`bin/`、`scripts/` 资产，以支持自带脚本基于插件根路径的相对寻址（如 `PLUGIN_ROOT/bin/init_task.py`）：

```ts
// 确认宿主支持资产面（未提供时 pack.assets 恒为空表）
if (client.initializeInfo?.capabilities.snapshot_assets) {
  const result = await exportTeam(client, "wb-stock-partner-team-team", "./exported-team");

  // pack.assets：按引用的清单，按 path 排序，kind 区分显示资产与可执行脚本
  for (const asset of result.pack.assets) {
    console.log(`${asset.kind.padEnd(6)} ${asset.digest.slice(0, 12)} ${asset.path}`);
  }

  // 包级头像：快照相对路径，保证已列在 assets 里
  console.log(`包级头像: ${result.pack.avatar}`);
  console.log(`已落盘资产: ${result.writtenAssets.join(", ")}`);
}
```

```text
./exported-team/
├── expert-pack.json
├── members/<id>/persona.md
├── skills/md-to-html/scripts/render.py
├── avatars/team.png
├── bin/init_task.py
└── scripts/check.sh
```

#### 5.2.2 类别与标签随包导出（pack_format 3 起）

`fp-16`（`pack_format 3`）起包的展示元数据随定义一起交付。注意作用域与 `assets` **相反**：分类是逐包自己的声明，成员包各带自己的值：

```ts
const result = await exportTeam(client, "wb-stock-partner-team-team", "./exported-team");

// 顶层包 = 团队行自己的声明
console.log(`格式: ${result.pack.pack_format}`);            // 3
console.log(`团队标签: ${JSON.stringify(result.pack.tags)}`);
console.log(`团队分类: ${result.pack.category_id}`);         // 裸 id，如 "04-DataAI"

// 成员包各带自己的（未声明的成员就是缺席，不是空数组伪造）
for (const member of result.pack.team?.members ?? []) {
  console.log(`${member.name}: ${member.category_id ?? "(未分类)"}`);
}

// 把裸 id 解析成双语名：id 由宿主给，名字由你在本地字典里查
const { items: categories } = await client.store.categories();
const categoryName = (id?: string | null) => categories.find((c) => c.id === id)?.name.zh ?? "未分类";
console.log(`解析后: ${categoryName(result.pack.category_id)}`);
```

已安装资源的目录面同源：`client.teams.list()` 的 `tags` / `category_id` 是包级声明，`client.skills.list()` 的 `tags` 来自市场索引行（导入时固化，市场其后改标签需走一次 `store.update()` 才生效）。

### 5.3 工作区管理与技能内部文件读取

```ts
// 1. 工作区声明周期管理
const workspaces = await client.workspaces.list();
const newWorkspace = await client.workspaces.create("/abs/path/to/project");
await client.workspaces.revoke(newWorkspace.workspace_id); // 软注销，既有会话保留引用

// 2. 技能内部文件读取（受宿主 skill_files 能力门禁管控）
if (client.initializeInfo?.capabilities.skill_files) {
  const inventory = await client.skills.files("release-notes");
  for (const file of inventory.files) {
    console.log(`文件: ${file.path}, 大小: ${file.size}, 摘要: ${file.digest}`);
  }

  // 读取技能包内的相对路径文件字节流并转码（路径已做穿越校验）
  const fileBytes = await client.skills.readFile("release-notes", "references/guide.md");
  const content = new TextDecoder().decode(fileBytes);
  console.log("文件内容:", content);
}
```

### 5.4 宿主工具域裁剪与策略控制

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

## 6. 宿主接入架构与生产工程化

### 6.1 传输层与通信协议选型

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
console.log(`HTTP 支持的方法数: ${Object.keys(httpRouteTable()).length}`);
```

### 6.2 宿主多形态接入范式

#### 6.2.1 自持数据目录托管（生产与测试部署）

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

#### 6.2.2 独立进程托管（spawnAppServer 与客户端解耦）

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

#### 6.2.3 Web 浏览器与 Electron 混合架构

```ts
// 模式 A：Web 浏览器环境（连接既有服务端，无法执行进程 spawn）
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const token = window.sessionStorage.getItem("agent_store_token") ?? undefined;
const transport = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", {
  token,
  requestTimeoutMs: 15_000,
});
const webClient = new AppServerClient({
  transport,
  client: { name: "web-dashboard", version: "1.0.0" },
});
await webClient.connect();

// 模式 B：Electron 混合架构（主进程 spawn 托管进程，渲染进程通过 IPC 建立通信）
// 主进程管理二进制与数据目录，渲染进程仅持有连接凭据，隔离私有密钥
```

### 6.3 结构化错误处理与指数退避重试

```ts
import { withRetry } from "@flowy-agent-store/client";
import { AppServerError, formatError, isRetryableError } from "@flowy-agent-store/protocol";

// 模式 A：使用 withRetry 自动执行幂等操作的指数退避重试
const runDetails = await withRetry(() => client.runs.get("run-12345"), {
  maxAttempts: 4,
  baseDelayMs: 500,
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

### 6.4 生产环境核心规范与避坑要点

- **数据目录互斥排他锁**：同一 `dataDir` 具有独占文件锁，禁止并发多个进程挂载同一目录；自动化测试或多实例场景需分配独立隔离路径。
- **异步消息受理语义**：`conversations.send` 返回的 `accepted: true` 仅代表任务已入库排队，不能视为处理完毕；流式回复必须通过 `follow` 订阅或轮询 `is_processing`。
- **市场后台异步预热**：冷启动时首个 `store/list` 不阻塞等待市场包解压；空列表时需持续检查 `markets_pending` 标志直至为 `false`。
- **连接器初始状态控制**：新导入的连接器默认处于禁用（`disabled`）状态；通过高阶 API `store.install` 会自动完成启用及探针连通性校验。
- **版本演进与升级规约**：早期版本遵循卸载后重新安装（`uninstall_reinstall`）生命周期规范；`0.1.0-beta.8` 起商店条目推荐使用 `store.update()` 执行原地原子更新。
- **技能停用与卸载区别**：技能无运行时热卸载机制，`store.setEnabled(item, false)` 仅置目录状态标记，完全移除需执行 `uninstall`。
- **协议版本全等校验**：运行时进程与 SDK 之间的 `protocol_version` 必须完全一致，存在版本差异时子进程启动阶段将立即主动退出并报错。
- **临时目录安全回收**：在测试或脚本中使用 `launchHarness` 且未指定 `dataDir` 时，必须确保在 `finally` 块中调用 `close()`，以防进程强制退出遗留孤儿文件。

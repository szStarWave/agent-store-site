# 快速开始

Flowy Agent Store 是一款**本地优先（Local-First）**的 Agent 运行时与可视化工作台。系统将 Rust 原生核心执行引擎（`allo`）与全功能内嵌 Web UI 打包为单可执行二进制文件。无需外部数据库、容器运行时或常驻后台守护进程，零门槛即开即用。

---

## 1. 系统要求与环境准备

在开始安装前，请确认您的系统满足基本运行条件：

- **操作系统**：Windows 10/11 (x64 / ARM64 转译)、macOS 12+ (Apple Silicon / Intel)、主流 Linux 发行版（Ubuntu 20.04+、Debian 11+、Fedora 36+ 等）；
- **网络访问**：首次启动或同步市场资源时需能访问互联网（用于拉取 ModelScope / GitHub 市场清单）；
- **大模型 API 访问**：至少准备一个可用的大模型 API 凭据或本地模型服务。

系统原生支持主流云端大模型服务商与本地推理后端：

| 提供商类别 | 推荐接入模型 | API Base URL | 必要鉴权凭据 |
| --- | --- | --- | --- |
| OpenAI 及兼容服务 | `gpt-4o`, `gpt-4o-mini`, `o1` | `https://api.openai.com/v1` | `OPENAI_API_KEY` |
| Anthropic Claude | `claude-3-7-sonnet`, `claude-3-5-haiku` | `https://api.anthropic.com` | `ANTHROPIC_API_KEY` |
| 阿里云百炼 (通义千问) | `qwen-plus`, `qwen-turbo`, `qwen-max` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `DASHSCOPE_API_KEY` |
| DeepSeek | `deepseek-chat`, `deepseek-reasoner` | `https://api.deepseek.com` | `DEEPSEEK_API_KEY` |
| 本地 Ollama | `llama3.1`, `qwen2.5-coder`, `deepseek-r1` | `http://127.0.0.1:11434/v1` | 无需凭据（本地免密） |

---

## 2. 下载与一键安装

系统支持一键脚本、npm 全局安装或手动下载二进制包三种方式：

```bash
# 方式 A：Windows PowerShell 一键脚本安装（自动完成安装并将 flowy-agent-store 写入 PATH）
irm https://agent-store.szstarwave.com/install.ps1 | iex

# 方式 B：通过 npm 全局安装预编译二进制包（需 Node.js 18+ 环境）
npm install -g @flowy-agent-store/runtime-win32-x64

# 方式 C：手动下载 GitHub Releases 发布包并解压至目标目录
# 访问 https://github.com/szStarWave/agent-store-site/releases 下载对应平台的最新归档
```

安装完成后，打开新的终端会话执行 `flowy-agent-store --version` 即可确认版本。

---

## 3. 启动本地服务与工作台

直接执行主程序，系统将自动拉起本地 App Server 并打开系统默认浏览器进入工作台：

```bash
# 默认启动：监听 127.0.0.1:8787 并自动唤起浏览器工作台
flowy-agent-store

# 指定端口启动（当默认 8787 端口已被占用时）
flowy-agent-store --port 8788

# 无头服务器（Headless）部署：禁止自动弹窗并自定义数据存储路径
flowy-agent-store --data-dir /data/agent-store --no-open
```

服务就绪后，进程将向控制台输出包含协议指纹与服务信息的就绪通知：

```json
{"agent_store":"listening","host":"127.0.0.1","port":8787,"url":"http://127.0.0.1:8787/","protocol_version":"2026.03.v1","version":"0.8.2","auth":"disabled-local"}
```

工作台界面将在浏览器中打开 `http://127.0.0.1:8787/`。所有会话数据、工具配置及模型密钥均安全持久化于本地设备。

---

## 4. 环境初始化与模型配置

首次使用前需配置大模型 API 供应商。您可以通过以下三种方式之一完成配置：

- **方式一（命令行交互向导）**：在终端运行 `flowy-agent-store init`，根据交互式提示选择模型供应商并输入 API 密钥，向导将自动生成配置文件。
- **方式二（工作台图形化设置）**：在打开的 Web UI 中，点击右上角 **设置** $\to$ **模型供应商**，添加并填入您的 API 密钥与端点地址。
- **方式三（直接编辑配置文件）**：直接创建或修改配置文件 `~/.agent-store/config.toml`：

```toml
# ~/.agent-store/config.toml 最小配置示例

# 配置云端 API 供应商（以 DeepSeek 为例）
[providers.deepseek]
api_base = "https://api.deepseek.com"
api_key = "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
models = ["deepseek-chat", "deepseek-reasoner"]

# 或接入本地 Ollama
[providers.ollama]
api_base = "http://127.0.0.1:11434/v1"
models = ["qwen2.5-coder", "llama3.1"]

# 默认会话模型
default_model = "deepseek-chat"
```

完整配置项定义与环境变量优先级详见 [配置文件](/zh-CN/docs/configuration)。

---

## 5. 发现与激活首个 Agent 资产

Flowy Agent Store 内置连接官方 ModelScope 资源市场，覆盖专家（Agent）、原子技能（Skill）与系统连接器（Connector）：

1. **进入市场**：在工作台顶部导航栏点击 **市场**；
2. **检索目标组件**：在搜索栏中输入功能关键词（例如 `代码审查`、`网页抓取` 或 `GitHub`）；
3. **一键安装**：在资源卡片上点击 **安装**。系统将执行静态路径与安全性审计，计算 SHA-256 全树摘要，并固化为本地不可变快照（`PluginSnapshot`）；
4. **即刻可用**：安装完成后无需重启服务，该资产已自动注册至本地资源目录（Catalog），随时可在会话中调用。

如需了解自研插件与私有 MCP Server 接入规范，请参阅 [插件与市场](/zh-CN/docs/plugins-market)。

---

## 6. 发起首次会话运行（First Run）

资产就绪后，即可开启 Agent 交互与推理编排：

1. **新建会话**：在工作台侧边栏点击 **新建会话**；
2. **绑定专家角色**：在会话顶部选择刚刚安装的专家（或选用默认通用助手）；
3. **提交任务指令**：在输入框提交业务需求（例如：`请帮我审查当前工作区下的项目配置并指出潜在安全隐患`）；
4. **实时观测推理流**：
   - 界面实时展现大模型的思维链推理（Thinking Stream）；
   - 工具与连接器调用经过权限栅栏校验后，在受控沙箱内异步执行；
   - 最终执行产物（生成的 Markdown 文档、图表代码或补丁文件）在右侧产物面板中结构化呈现。

除了 Web UI 外，开发者亦可通过 TypeScript SDK 以代码化方式驱动全量执行：

```typescript
import { AgentStoreClient } from "@flowy-agent-store/sdk";

// 连接本地 App Server 实例
const client = new AgentStoreClient({ endpoint: "ws://127.0.0.1:8787" });
await client.connect();

// 创建会话并绑定专家
const session = await client.sessions.create({
  title: "快速体验会话",
  expert_id: "expert_general_assistant",
});

// 发起流式推理 Run
const run = await client.sessions.prompt(session.session_id, {
  prompt: "请用三句话介绍 Flowy Agent Store 的本地优先架构。",
});

// 监听实时事件流
for await (const event of client.runs.streamEvents(run.run_id)) {
  if (event.event_type === "message/delta") {
    process.stdout.write(event.payload.delta);
  }
}
```

更多 SDK 调用模式与事件订阅细节，请参考 [TypeScript SDK 接口](/zh-CN/docs/typescript-sdk) 与 [SDK 示例](/zh-CN/docs/examples-sdk)。

---

## 7. 常见问题排查（FAQ）

在初次安装与运行过程中若遇到异常，可对照下表进行快速自检：

| 异常现象 | 排查切入点 | 潜在原因分析 | 解决与修复建议 |
| --- | --- | --- | --- |
| 启动报错 `Address already in use` | 控制台端口占用提示 | 默认端口 `8787` 已被本机其他开发服务占用 | 启动时通过 `--port 8788` 参数指定其他空闲端口 |
| 浏览器未自动唤起工作台 | 宿主机默认浏览器配置 | 操作系统未关联默认 Web 浏览器或运行在 SSH 终端 | 手动访问 `http://127.0.0.1:8787/`，或加 `--no-open` 忽略 |
| 会话提问报错 `401 Unauthorized` | 模型服务响应状态码 | API 密钥填写错误、已过期或平台未配置充值额度 | 检查 `~/.agent-store/config.toml` 中的 `api_key` 格式 |
| 进程报错 `database is locked` | SQLite 文件锁排查 | 存在另一个后台进程同时锁定了 `store.db` 数据目录 | 检查正在运行的进程，避免同一数据目录多实例并发运行 |

更多命令行参数与高级运行配置见 [命令行用法](/zh-CN/docs/cli)；系统设计理念与执行模型见 [架构设计与系统规范](/zh-CN/docs/architecture)。

---

## 8. 下一步

随着您对系统的深入探索，推荐继续阅读以下进阶指引：

- [命令行用法](/zh-CN/docs/cli) —— 掌握服务启动参数、守护进程配置与认证网关。
- [架构设计与系统规范](/zh-CN/docs/architecture) —— 深入了解 Rust 执行引擎、App Server 协议与事件溯源机制。
- [配置文件](/zh-CN/docs/configuration) —— 全面掌握多模型路由、代理设置与私有 MCP 声明。
- [插件与市场](/zh-CN/docs/plugins-market) —— 探索专家团、技能扩展与私有连接器接入规范。
- [TypeScript SDK 接口](/zh-CN/docs/typescript-sdk) —— 为您的应用、IDE 插件或企业系统接入 Agent 能力。
- [SDK 示例](/zh-CN/docs/examples-sdk) —— 查阅覆盖多 Agent 协作、MCP 测试与事件订阅的端到端范式。
- [兼容性矩阵](/zh-CN/docs/compatibility) —— 确认系统平台支持范围与清单格式版本。
- [升级与迁移指引](/zh-CN/docs/upgrade) —— 了解跨版本数据结构兼容性与平滑迁移策略。

# 插件与市场

Flowy Agent Store 原生支持插件（Plugin）与插件市场（Marketplace）：插件是预打包的功能资产集合（包含专家、专家团、技能、连接器及命令），市场则提供这些资产的发现与分发通道。系统遵循**本地优先（Local-First）**架构原则——市场负责资产编排与分发，导入后的数据快照、凭据托管与执行调度完全在本地进行。

---

## 1. 插件体系与核心组件模型

插件导入后转换为本地资源目录（Catalog）中标准化、可复用的组件定义：

| 组件类型 | 声明位置 | 运行时挂载机制 | 状态与执行边界 |
| --- | --- | --- | --- |
| 专家（AgentDefinition） | `plugin.json` 中的 `agents` 数组 | 会话启动时通过 Preset 机制选定为当前角色 | 具备独立提示词与角色约束，不独立持久化状态 |
| 专家团（AgentTeamDefinition） | `plugin.json` 中的 `teams` 数组 | 启动时加载名册，Leader 动态生成 Planned DAG | 固定成员名册协同，各步骤并发执行与动态重规划 |
| 技能（SkillDefinition） | `skills/<slug>/SKILL.md` | 会话提问时按需声明或由模型自动路由 | 仅作为原子能力扩展注入上下文，不维护独立会话 |
| 连接器（ConnectorDefinition） | `connectors/<slug>/mcp.json` | 经权限栅栏校验后由 MCP 客户端建立物理连接 | 严格遵循 MCP 规范，敏感凭据由本地金库物理托管 |
| 命令（CommandDefinition） | `plugin.json` 中的 `commands` 数组 | 用户输入 `/cmd` 指令时直接激活 Prompt 模板 | 无状态交互快捷指令，展开为常规对话提示词 |

---

## 2. 市场源协议与配置规范

市场源通过 [`~/.agent-store/config.toml`](/zh-CN/docs/configuration) 进行声明，支持五种 `source_kind` 协议：

| source_kind | 声明协议格式 | 缓存更新机制 | 适用分发场景 |
| --- | --- | --- | --- |
| `zip` | HTTP(S) 归档地址 | HTTP `HEAD` 校验 `X-Linked-Etag`（SHA-256 内容摘要） | **官方市场标准格式**：单文件分发，单次请求同步全量元数据 |
| `url` | HTTPS/HTTP 清单目录 | 依据根目录 `_files.txt` 清单进行增量哈希比对 | 自建静态 HTTP 服务器或 CDN 托管的解包市场树 |
| `github` | GitHub 仓库标识 | 基于 GitHub API 查询 Release 资产与归档哈希 | 借助开源仓库自动发布与分发市场组件 |
| `git` | Git 远程仓库地址 | 基于 Git 协议执行 fetch 与 commit 变更追踪 | 团队内部私有 Git 仓库协同维护与测试 |
| `directory` | 本地文件系统绝对路径 | 本地文件系统 mtime 与哈希监听 | 本地开发阶段的专家与技能实时调试 |

```toml
# 官方三个市场各是一个托管在 ModelScope 上的 zip 归档；
# 未声明 [default_marketplaces] 时，运行时的内置默认源就是它们
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

- **内容摘要校验与缓存**：对于 `zip` 格式，客户端发起 HTTP `HEAD` 请求获取响应头 `X-Linked-Etag`（即归档文件 SHA-256 摘要）；摘要未变更时跳过下载，下载完成后二次校验确保文件完整性；
- **ModelScope 稳定下载地址**：ModelScope LFS 稳定下载地址会自动 302 重定向至附带时效签名的 CDN 节点，配置与文档中**必须始终使用官方持久稳定 URL**，禁止硬编码临时 CDN 地址；
- **全树镜像支持**：对于 `url` / `git` / `github` / `directory` 等源类型，服务端可提供预编译的 `_files.txt`（包含相对路径清单），客户端据此同步镜像文件。

---

## 3. 资产摄取与安全审计管线

通过市场触发安装（`store/install-entry`）或本地导入时，导入引擎（Importer）执行以下标准化安全管线：

```text
[ 外部市场源 / 插件压缩包 / 本地开发目录 ]
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ 1. 来源定位与 Manifest 解析 (plugin/marketplace.json)   │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ 2. 静态安全审计 (路径穿越 ../ 检测、符号链接逃逸防御)     │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ 3. 计算全树 SHA-256 内容摘要 (content_digest)           │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ 4. 复制至版本化快照目录 (~/.agent-store/snapshots/...)  │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ 5. 生成 PluginSnapshot 并向本地 SQLite Catalog 登记定义 │
└────────────────────────────────────────────────────────┘
```

支持的三大类清单文件与目录规范如下：

| 清单类别 | 根文件路径 | 核心声明字段 | 资产规范 |
| --- | --- | --- | --- |
| 专家插件清单 | `.codebuddy-plugin/plugin.json` | `name`, `version`, `agents`, `teams`, `commands` | 包含专家系统提示词模板、模型推荐参数与专属技能挂载声明 |
| 技能市场清单 | `.codebuddy-skill/marketplace.json` | `name`, `skills` (包含 `id`, `name`, `source`) | 每个技能独立放置于 `skills/<slug>/`，必须包含 `SKILL.md` |
| 连接器市场清单 | `.codebuddy-connector/connectors.json` | `name`, `connectors` (包含 `id`, `source`) | 每个连接器独立放置于 `connectors/<slug>/`，必须包含 `mcp.json` |

---

## 4. PluginSnapshot 不可变快照机制

资产导入的核心产物为 **PluginSnapshot**，代表资源内容在特定时间点的不可变物理镜像：

- **写一次只读（Write-Once Read-Only）**：快照一旦完成物理归档并写入本地数据库，其目录属性设为只读。来源内容的任何修改或上游更新均触发生成全新的快照实体；
- **运行期执行版本锁定**：执行中的会话（Session）与运行实例（Run）强绑定启动时的 `snapshot_id`，杜绝因外部源或本地库动态更新导致的运行时漂移；
- **确定性溯源与审计**：执行事件流中记录完整的快照 ID、定义版本与 SHA-256 摘要，支持 100% 确定性历史审计与场景重放；
- **原地安全原子更新（store/update-entry）**：当条目发布新版本后，宿主支持通过 `store.update` 执行原子升级。升级管线遵循「先装新版、验证通过后才释放旧版运行时」原则；若新版本构建或探针失败，旧版本物理产物完整保留，绝不破坏现有会话。专家的预设 ID 在升级时保持不变（不重复产生同名预设），技能完成新目录物化后清理旧目录，连接器在校验共享物理记录后平滑过渡；
- 系统的执行引擎分层与快照隔离原理详见 [架构设计与系统规范](/zh-CN/docs/architecture)。

---

## 5. 自定义 MCP 连接器接入指南

开发者接入自定义 MCP Server 无需发布到官方市场，支持三种灵活路径：

| 接入途径 | 存储落点 | 生效作用域 | 最佳适用场景 |
| --- | --- | --- | --- |
| `~/.agent-store/mcp.json` 本机静态配置 | **不写入数据库**；宿主启动时自动加载 | 当前宿主的所有会话 | 本机私有服务、开发者本地调试 |
| HTTP 管理接口动态注册 | `mcp_servers` 数据表 | 会话或 Run 中显式绑定 | 自研/私有部署服务，支持连通性探测与 OAuth 鉴权 |
| 市场 / 插件分发包导入 | 安装后写入 `mcp_servers` 数据表 | 同上 | 面向团队组织或社区公开发布的集成包 |

传输层支持三种标准形态（`transport` 载荷结构）：

```json
{
  "stdio": {
    "command": "./my-mcp-server",
    "args": ["--port", "9000"],
    "env": { "DEBUG": "1" }
  },
  "http": {
    "url": "https://mcp.example.com/mcp",
    "headers": { "Authorization": "Bearer secret:MY_MCP_TOKEN" }
  },
  "sse": {
    "url": "https://mcp.example.com/sse",
    "headers": { "X-Api-Key": "secret:MY_API_KEY" }
  }
}
```

### 5.1 凭据声明与表单解耦（token-schema.json）

连接器支持三种标准认证模式（`credential.mode`）：`none`（无需凭据）、`oauth`（浏览器 OAuth 流程）与 `token`（用户填写 Key/Token）。对于 `token` 模式，连接器目录需提供 `token-schema.json` 声明字段契约：

```json
{
  "title": { "zh": "高德地图密钥配置", "en": "AMap Key Setup" },
  "description": { "zh": "请输入高德开放平台 Web 服务 API Key", "en": "Enter AMap Web Service API Key" },
  "doc_url": { "zh": "https://lbs.amap.com/dev/key", "en": "https://lbs.amap.com/dev/key" },
  "doc_label": { "zh": "前往获取高德 Key", "en": "Get AMap Key" },
  "fields": [
    {
      "key": "AMAP_API_KEY",
      "label": { "zh": "API Key", "en": "API Key" },
      "placeholder": { "zh": "请输入 Web 服务 Key", "en": "e.g. 88374f..." },
      "required": true,
      "sensitive": true,
      "type": "string"
    }
  ]
}
```

通过统一的面向对象 TypeScript SDK（`AppServerClient`）实现连接器的编排与调用：

```typescript
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

// 1. 初始化客户端
const client = new AppServerClient({
  transport: new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws"),
  client: { name: "connector-workflow-app", version: "1.0.0" },
});
await client.connect();

// 2. 检查已启用的连接器并测试物理连通性
const connectors = await client.connectors.list();
const testResult = await client.connectors.test("conn_github_integration");
console.log(`连通性测试: ${testResult.ok ? "成功" : "失败"}`);

// 3. 在会话中调度连接器（亦可通过 client.connectors.call 直接调用指定工具）
const conv = await client.conversations.create({
  name: "GitHub 自动化工作流",
});

// 4. 发起交互推理
await client.conversations.send(
  conv.id,
  "请列出当前仓库最新的 3 个 Pull Request 并在右侧生成报告。",
  crypto.randomUUID(),
);
```

更多连接器接口与错误处理范式详见 [TypeScript SDK 接口](/zh-CN/docs/typescript-sdk)。

---

## 6. 自研 Skill 开发与规范

自研技能无需编写复杂的后端常驻服务，仅需按规范组织 `SKILL.md` 即可被 Agent 智能感知与调度：

```markdown
---
name: web-scraper
display_name: 网页正文抓取
version: 1.0.0
description: 抓取指定 URL 网页的纯文本与 Markdown 结构，剥离干扰元素
tags: ["crawler", "html", "parser"]
---

# 网页正文抓取技能

## 描述
当用户需要获取公开网页的详细内容、文档或博文正文时触发本技能。

## 参数声明
- `url` (string, required): 目标网页完整的 HTTP(S) 地址
- `format` (string, optional): 输出格式，支持 `markdown` 或 `text`，默认为 `markdown`

## 执行与约束
1. 仅限抓取公开网络资源，遵守目标站点 robots.txt 规范；
2. 自动移除 `<script>`、`<style>` 与广告弹窗 DOM 节点；
3. 将最终解析结果通过 Markdown 格式回填至会话上下文。
```

- **目录结构规范**：将上述文件保存至 `skills/<slug>/SKILL.md`；
- **本地导入与安装**：在 Web UI 工作台直接导入该技能目录，或通过 SDK `client.store.installEntry` 进行程序化安装；
- **运行时动态路由**：Agent 根据系统提示词与任务需求，自动选择匹配的技能并注入当前轮次的推理上下文中。

---

## 7. 凭据隔离与权限控制

系统在处理敏感凭据时遵循「零泄漏与物理脱敏」原则：

- **`secret:<KEY>` 占位符机制**：连接器配置中禁止硬编码明文密钥，统一采用 `secret:NAME` 格式；
- **安全金库隔离存储**：实际明文仅持久化在本地受操作系统保护的安全存储（如 DPAPI / Keychain / 加密数据文件）中；
- **反向代理权限控制**：通过 `~/.agent-store/config.toml` 中的 `[connector_proxy]` 控制工具执行权限：
  - `enabled = false`：完全禁止外部代理调用工具；
  - `enabled = true`：允许已启用的连接器执行工具；可进一步配置 `allow` 与 `deny` 名单执行细粒度白名单过滤；
- 详细配置参数详见 [配置文件](/zh-CN/docs/configuration)。

---

## 8. 延伸阅读

- 浏览官方预置资产：[资源市场](/zh-CN/market)
- 市场源配置与代理策略：[配置文件](/zh-CN/docs/configuration)
- 运行时分层与架构模型：[架构设计与系统规范](/zh-CN/docs/architecture)
- 客户端编排与接口参考：[TypeScript SDK 接口](/zh-CN/docs/typescript-sdk)
- 真实工程场景范式：[SDK 示例](/zh-CN/docs/examples-sdk)

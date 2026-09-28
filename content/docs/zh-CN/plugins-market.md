# 插件与市场

Flowy Agent Store 原生支持插件（Plugin）与插件市场（Marketplace）：插件是预打包的功能资产集合（包含专家、专家团、技能、连接器及命令），市场则提供这些资产的发现与分发通道。系统遵循**本地优先（Local-First）**架构原则——市场负责资产编排与分发，导入后的数据快照、凭据托管与执行调度完全在本地进行。

## 1. 插件包含什么

插件导入后转换为资源目录（Catalog）中标准化、可复用的组件定义：

| 组件 | 说明 |
| --- | --- |
| 专家（AgentDefinition） | 可复用的 Agent 角色配置，运行时基于 Preset 机制挂载 |
| 专家团（AgentTeamDefinition） | 多 Agent 协作编排定义，包含成员名册与协作策略 |
| 技能（SkillDefinition） | 原子功能扩展，由 Agent 按需调用，不独立建立会话 |
| 连接器（ConnectorDefinition） | 外部系统集成组件（MCP），附带凭据模式声明（Token Schema） |
| 命令（CommandDefinition） | 用户交互指令与预置 Prompt 模板 |
| 钩子 / LSP | 运行时生命周期钩子与语言服务扩展（元数据定义） |

## 2. 市场从哪里来

市场源通过 [`~/.agent-store/config.toml`](/zh-CN/docs/configuration) 进行声明，支持五种 `source_kind` 协议：

| source_kind | source | 说明 |
| --- | --- | --- |
| `zip` | HTTP(S) 归档地址 | **官方市场标准格式**：采用单归档分发，归档根目录即市场清单根路径，单次请求即可同步全量元数据 |
| `url` | HTTPS/HTTP 清单地址 | 远程清单目录，建议提供文件索引清单（`_files.txt`）以支持增量树形镜像 |
| `github` | GitHub 仓库 | 通过 GitHub 仓库分发市场清单 |
| `git` | Git 仓库地址 | 基于 Git 协议克隆与同步 |
| `directory` | 本地目录路径 | 直接映射本地文件系统的市场开发目录 |

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

`zip` 格式的缓存更新基于内容摘要：客户端发起 HTTP `HEAD` 请求获取响应头 `X-Linked-Etag`（即归档文件 sha256 摘要）；摘要未变更时跳过下载，下载后通过校验该摘要确保文件完整性。注意：ModelScope LFS 稳定下载地址会自动 302 重定向至附带时效签名的 CDN 节点，配置与文档中**必须始终使用官方持久稳定 URL**，禁止硬编码临时 CDN 地址。

`url` / `git` / `github` / `directory` 等源类型支持全树镜像同步：对于 `url` 类型，服务端可在根目录提供预编译的 `_files.txt`（包含相对路径清单），客户端据此同步镜像文件。

启动时运行时自动解析已配置的市场清单，通过 Web UI 顶部导航的 **市场** 入口即可检索专家、技能与连接器。

## 3. 导入：从市场到 Catalog

通过市场触发安装（`store/install-entry`）时，导入引擎（Importer）执行以下标准化流程：

```text
1. 定位来源（市场清单条目 / 插件根 / 技能或连接器目录）
2. 解析 Manifest（plugin.json / marketplace.json / connectors.json）
3. 路径校验：拒绝 ../ 越界与符号链接逃逸
4. 复制到版本化不可变缓存，计算 content_digest
5. 生成 PluginSnapshot（组件清单 + 来源信息 + 兼容性报告）
6. 按组件类型产出标准化定义，注册到本地 Catalog
```

受支持的清单来源格式包括：

- **CodeBuddy / WorkBuddy 插件包**：`.codebuddy-plugin/plugin.json` 与附属组件目录
- **WorkBuddy Skill 市场包**：`.codebuddy-skill/marketplace.json` 与 `skills/<slug>/` 结构（同时兼容包含 `SKILL.md` 的独立目录）
- **WorkBuddy Connector 市场包**：`.codebuddy-connector/connectors.json` 与 `connectors/<slug>/` 结构

## 4. PluginSnapshot：不可变快照

资产导入的核心产物为 **PluginSnapshot**，代表资源内容在特定时间点的不可变镜像：

- 记录来源类型、来源 URI、声明版本、`content_digest`、组件元数据清单与兼容性评估报告；
- 来源内容更新时必须生成新快照实例，既有快照保持只读不可变；
- 执行中的 Agent / Team 强绑定执行快照版本，不受后续 Catalog 变动影响；
- 审计与复盘可精确溯源至具体 Snapshot ID、定义版本与内容摘要。

未通过静态兼容性检查的组件将记录降级状态而非静默丢弃；未明确版权或再分发授权的资源禁止加入公开分发。

## 5. 凭据与安全

- **凭据模式隔离**：连接器导入时仅注册凭据 Schema 结构，不读取或持久化敏感密钥；
- **运行时动态注入**：敏感凭据仅留存于本地受控安全存储，外部接口（Web / SDK）仅暴露凭据配置状态与脱敏标识；
- **本地执行闭环**：市场同步与导入解析全程不执行远程非受信代码，工具执行语义严格受限在本地 `allo` Runtime 沙箱内。

## 6. 自研 MCP Server / 自定义技能怎么接入

开发者接入自定义 MCP Server 无需发布到官方市场。MCP Server 支持三种接入路径：

| 来源 | 落点 | 生效范围 | 适合 |
| --- | --- | --- | --- |
| `~/.agent-store/mcp.json` 声明文件 | **不写入持久数据库**；宿主启动时加载一次 | 当前宿主的所有会话 | 本机私有服务。配置语法与字段校验详见 [配置文件](/zh-CN/docs/configuration) |
| MCP 配置接口（HTTP 管理接口） | `mcp_servers` 数据表 | 会话或 Run 中显式绑定 | 自研/私有部署服务，支持连通性探测与 OAuth 鉴权 |
| 市场 / 插件分发包 | 安装后写入 `mcp_servers` 数据表 | 同上 | 面向组织或公开分发的集成包 |

优先级规则：同名配置下，**`mcp.json` 声明文件优先于 `mcp_servers` 数据表**；而在具体调用时显式指定的绑定拥有最高优先级。

以下详细说明持久化注册的两种实现路径：

### 路径 A：直接注册（自研 / 私有部署推荐）

通过宿主提供的 HTTP 管理接口按名称注册：

- `POST /api/mcp/servers` — 注册或更新 MCP Server（按名称 upsert）
- `POST /api/mcp/servers/import` — 批量导入配置
- `POST /api/mcp/test-connection` — 执行连通性测试
- `/api/mcp/oauth/*` — 标准 OAuth（PKCE Loopback）鉴权端点

传输层支持三种形态（`transport` 载荷结构）：

```jsonc
// 本地子进程 (stdio)
{ "stdio": { "command": "./my-mcp-server", "args": [], "env": {} } }
// Streamable HTTP (远程推荐)
{ "http": { "url": "https://mcp.example.com/mcp", "headers": { "Authorization": "Bearer <token>" } } }
// SSE (兼容模式远程)
{ "sse": { "url": "https://mcp.example.com/sse", "headers": {} } }
```

静态 API Key 与自定义鉴权头通过 `headers` 注入；OAuth 流程由运行时代理登录、密钥持久化及请求签名。注册完成后，在会话或 Run 启动配置中声明 `selected_mcp_server_ids`，运行时将在执行时按需建连并注入工具定义。

### 通过 TypeScript SDK 接入

TypeScript SDK 提供目录查询、OAuth 流程代理及工具调用功能（`list` / `get` / `status` / `test` / `call`）。针对自研 MCP Server，可通过原生的**导入 $\to$ 安装**链路实现程序化编排：

1. 组织两级目录结构的连接器市场源：

   ```text
   my-market/
   ├── .codebuddy-connector/
   │   └── connectors.json        # 市场清单：id/name + source（相对路径）
   └── my-mcp/
       └── mcp.json               # server 声明：mcpServers
   ```

   ```json
   {
     "name": "my-connectors",
     "connectors": [
       { "id": "my-mcp", "name": "My MCP", "version": "0.1.0", "source": "my-mcp" }
     ]
   }
   ```

   `source` 必须为相对路径；`mcp.json` 内的 `mcpServers` 结构遵循标准规范：

   ```json
   {
     "mcpServers": {
       "my-mcp": { "url": "https://mcp.example.com/mcp" }
     }
   }
   ```

2. 在 SDK 会话中执行导入与安装：

   ```ts
   import { launchHarness } from "@flowy-agent-store/sdk";

   const harness = await launchHarness({ client: { name: "my-app", version: "0.1.0" } });

   // 1. 导入：生成不可变 PluginSnapshot（同 digest 重复导入幂等，返回 reused=true）
   const snap = await harness.transport.request("import/run", {
     source_path: "C:/abs/path/to/my-market", // 市场根目录（含 .codebuddy-connector/）
     source_kind: "workbuddy-connector-market",
   });

   // 2. 安装：connector 组件自动注册进运行时 mcp_servers
   await harness.transport.request("install/run", { snapshot_id: snap.snapshot_id });

   // 3. 查询目录并在 Run 中注入
   const connectors = await harness.connectors.list();
   await harness.runs.agent({
     agentId: "<agent-id>",
     goal: "……",
     mentions: [{ kind: "connector", id: connectors[0].id }],
   });

   await harness.close();
   ```

3. OAuth 鉴权通过 `connector.authStart(connectorId)` 与 `connector.waitForAuth(connectorId)` 完成异步等待；
4. 运行时通过 `mentions` 动态挂载组件：连接器使用 `{ kind: "connector", id }`，技能使用 `{ kind: "skill", id }`。状态可通过 `install/status` 查询，并支持 `install/enable` / `install/disable` 管理。

### 路径 B：市场 / 插件分发（面向公开分发）

公开发布资产时，可将 MCP Server 打包为以下形式：

- **独立连接器市场包**：`.codebuddy-connector/connectors.json` 搭配 `connectors/<slug>/`，托管至任一市场源；
- **组合插件包内置 MCP**：在插件包的 `.codebuddy-plugin/` 目录下提供 `.mcp.json`（配置 `mcpServers` 键值）。

用户安装后自动同步至本地 `mcp_servers` 注册表。

### 自定义 Skill

- **SDK / 协议接入**：调用 `import/run`（`source_kind: "workbuddy-skill-market"`）生成快照，调用 `install/run` 完成注册，并在 Run 中通过 `mentions` 挂载；
- **本机文件导入**：通过 `POST /api/skills/import`（支持本地目录或 ZIP 归档）导入为私有技能；
- **市场源分发**：按照 `.codebuddy-skill/marketplace.json` + `skills/<slug>/` 标准结构发布。

## 7. 延伸阅读

- 市场条目浏览：[市场页面](/zh-CN/market)
- 市场源配置：[配置文件](/zh-CN/docs/configuration)
- 架构与导入分层：[架构说明](/zh-CN/docs/architecture)

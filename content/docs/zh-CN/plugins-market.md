# 插件与市场

Agent Store 原生支持**插件**与**插件市场**：插件是打包好的能力集合（专家、团队、技能、连接器、命令），市场则是这些能力的分发渠道。与运行时一致，插件体系同样遵循**本地优先**——市场只负责发现与分发，导入后的一切（快照、凭据、运行）都发生在本机。

## 1. 插件包含什么

一个插件（Plugin）可以携带以下组件，导入后成为 Catalog 中可复用的标准化定义：

| 组件 | 说明 |
| --- | --- |
| 专家（AgentDefinition） | 可复用的专家配置，在运行时通过 Preset 机制承载 |
| 专家团（AgentTeamDefinition） | 固定成员名册 + 协作规则 |
| 技能（SkillDefinition) | 原子能力，被 Agent 调用，不独立对话 |
| 连接器（ConnectorDefinition） | 与外部系统交互的受管能力，附凭据 Schema |
| 命令（CommandDefinition） | 用户可调用的提示/命令 |
| 钩子 / LSP | 生命周期钩子与语言服务器（元数据级） |

## 2. 市场从哪里来

市场来源在 [`~/.agent-store/config.toml`](/zh-CN/docs/configuration) 中声明，支持五种 `source_kind`：

| source_kind | source | 说明 |
| --- | --- | --- |
| `zip` | HTTP(S) 归档地址 | **官方三个市场用的就是这一种**：一个归档，**归档根目录即市场根**（清单在归档根，不套一层目录），一次请求取回整棵条目树 |
| `url` | HTTPS/HTTP 清单地址 | 建议同时提供目录枚举（`_files.txt`）以支持条目树镜像 |
| `github` | GitHub 仓库 | 从 GitHub 拉取市场清单 |
| `git` | Git 仓库地址 | 通过 Git 协议同步 |
| `directory` | 本地目录路径 | 直接指向本地市场/插件根 |

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

`zip` 源的新鲜度与完整性都用归档自身的 sha256：客户端对稳定 URL 发 `HEAD`，读 `X-Linked-Etag`（就是内容 sha256）；摘要没变就不下载，下载下来的字节也按同一个摘要校验。`.zip` 在 ModelScope 上走 LFS，稳定地址会 **302** 到带临时签名（`auth_key`）的 CDN 地址——**只写稳定地址，永远不要把 CDN 地址抄进配置或文档**。

`url` / `git` / `github` / `directory` 全部保留，第三方源可以继续用整树镜像：`url` 源的市场根目录下可以放一份预生成的 `_files.txt`（一行一个相对路径），客户端据此逐文件镜像整棵条目树。

启动时运行时会拉取并解析这些市场清单，Web UI 的 **市场** 页面（顶部导航 / 页脚入口）即可浏览全部条目：专家、技能与连接器。

## 3. 导入：从市场到 Catalog

在市场中安装一个条目（`store/install-entry`）后，导入器（Importer）按固定顺序处理：

```text
1. 定位来源（市场清单条目 / 插件根 / 技能或连接器目录）
2. 解析 Manifest（plugin.json / marketplace.json / connectors.json）
3. 路径校验：拒绝 ../ 越界与符号链接逃逸
4. 复制到版本化不可变缓存，计算 content_digest
5. 生成 PluginSnapshot（组件清单 + 来源信息 + 兼容性报告）
6. 按组件类型产出标准化定义，注册到本地 Catalog
```

支持的来源格式：

- **CodeBuddy / WorkBuddy 插件**：`.codebuddy-plugin/plugin.json` + 组件目录
- **WorkBuddy Skill 市场**：`.codebuddy-skill/marketplace.json` + `skills/<slug>/`（单个含 `SKILL.md` 的目录同样支持）
- **WorkBuddy Connector 市场**：`.codebuddy-connector/connectors.json` + `connectors/<slug>/`

## 4. PluginSnapshot：不可变快照

导入的核心产出是 **PluginSnapshot**——来源内容的一次不可变镜像：

- 包含来源类型、来源 URI、声明版本、`content_digest`、组件清单与兼容性报告；
- 来源内容一旦变化，必须生成**新**快照，历史快照永不原地修改；
- 运行中的 Agent / Team 冻结其目标快照，不受 Catalog 后续更新影响；
- 历史运行可追溯到具体 snapshot、definition version 与 content digest。

未通过兼容性校验的组件会被标记状态而不是静默丢弃；许可证不明的资源不会进入公开分发。

## 5. 凭据与安全

- 导入连接器时**只建立凭据 Schema**，不读取真实密钥；
- 真实凭据只在运行时进入本地安全存储，Web / SDK 仅接触状态、账号标识与过期时间；
- 市场同步与导入全程不做远程执行，执行语义唯一归属本地 `allo` Runtime。

## 6. 自研 MCP Server / 自定义技能怎么接入

**自研 MCP Server 不需要走 Marketplace 注册接口。** 市场只是分发渠道。MCP server 的来源其实有**三条**，落点与生效范围各不相同：

| 来源 | 落点 | 生效范围 | 适合 |
| --- | --- | --- | --- |
| `~/.agent-store/mcp.json` 声明文件 | **不写库**；宿主启动时读一次 | 该宿主的会话 | 本机固定的私有 server。文件格式、字段与校验见[配置文件](/zh-CN/docs/configuration) |
| MCP 配置接口（运行时自己的 HTTP 面） | `mcp_servers` 数据行 | 会话 / Run 里显式绑定 | 自研 / 私有部署，且需要连接测试与 OAuth |
| 市场 / 插件分发 | 安装时自动落到 `mcp_servers` 行 | 同上一行 | 面向公开分发 |

三者可以并存。同名时**声明文件 > `mcp_servers` 行**，而一次调用里的显式绑定优先级最高；来源优先级与读取时机只在[配置文件](/zh-CN/docs/configuration)那一节定义，本节不重复。

下面两条路径说的是**后两条**（都落 `mcp_servers`）：

### 路径 A：直接注册（自研 / 私有部署推荐）

通过 MCP 配置接口按名注册（这是运行时自己的 HTTP 接口，宿主就提供它；Agent Store 的 Web UI **不用**这套接口——那个界面读写的是 `mcp.json` 声明文件，见[配置文件](/zh-CN/docs/configuration)）：

- `POST /api/mcp/servers` — 注册/更新一个 MCP Server（按名称 upsert）
- `POST /api/mcp/servers/import` — 批量导入
- `POST /api/mcp/test-connection` — 连接测试
- `/api/mcp/oauth/*` — 标准 OAuth（PKCE Loopback）登录

传输层支持三种，按你的服务器形态选择（下面这段是 `transport` 字段的**取值形状**，整份请求体还要带 `name`；`mcp.json` 用的是另一套写法，见[配置文件](/zh-CN/docs/configuration)）：

```jsonc
// 本地进程
{ "stdio": { "command": "./my-mcp-server", "args": [], "env": {} } }
// Streamable HTTP（远程推荐）
{ "http": { "url": "https://mcp.example.com/mcp", "headers": { "Authorization": "Bearer <token>" } } }
// SSE（旧式远程）
{ "sse": { "url": "https://mcp.example.com/sse", "headers": {} } }
```

API Key / 自定义鉴权直接写在传输层的 `headers`；标准 OAuth 由运行时负责登录、存储与请求注入。注册后在会话/Run 中绑定该 Server（`selected_mcp_server_ids`），运行时 `McpManager` 建连并把工具注入模型。

### 通过 TypeScript SDK 接入

SDK 的连接器客户端是**目录读面 + OAuth 直通 + 调用代理**：`list` / `get` / `status` / `test`（`get` 与 `test` 会带上每个工具的参数 schema，先看清怎么调再调）、`authStart` / `authStatus` / `logout`，以及真正执行工具的 `call`（走宿主自己的连接，需宿主在 `[connector_proxy]` 里放行，见[配置文件](/zh-CN/docs/configuration)）。**但** App Server 协议**没有**「注册 MCP Server」的 WebSocket 方法，所以 SDK 内的自研 MCP Server 接入走协议原生的**导入 → 安装**链路：把 Server 打包为连接器市场目录，`import/run` 导入为不可变 PluginSnapshot，`install/run` 安装时由运行时自动注册进 `mcp_servers`。

1. 写一个最小连接器市场目录——**两级**：市场清单列条目，`source` 指向条目自己的目录，server 声明装在那个目录里：

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

   条目按 `id` 或 `name` 唯一，`source` **必须是相对路径**；`mcp.json` 里 `mcpServers` 的字段与 `~/.agent-store/mcp.json` 是**同一套**（`command` / `url` / `headers` / `env`），导入器按它逐条产出连接器组件——字段与校验见[配置文件](/zh-CN/docs/configuration)。

   ```json
   {
     "mcpServers": {
       "my-mcp": { "url": "https://mcp.example.com/mcp" }
     }
   }
   ```

2. SDK 会话内导入并安装（`import` / `install` 暂无子客户端封装，用 `transport.request` 透传协议方法）：

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

3. 标准 OAuth 直接用 SDK 的 `connector.authStart(connectorId)` 发起、轮询 `connector.authStatus` 至 `authenticated`；
4. Run 时通过 `mentions` 注入：`{ kind: "connector", id }` 追加到 run 的 MCP 列表（须为已启用 Server）；技能则用 `{ kind: "skill", id }` 挂载。安装状态可用 `install/status` 查询、`install/enable` / `install/disable` 管理。

### 路径 B：市场 / 插件分发（面向公开分发）

希望别人能从市场一键安装时，把自研 MCP Server 打包为：

- **连接器市场条目**：`.codebuddy-connector/connectors.json` + `connectors/<slug>/`，发布到一个市场源（`source_kind` 支持 `zip` / `url` / `github` / `git` / `directory`）；
- **插件级 MCP**：插件包内 `.codebuddy-plugin/` 附带 `.mcp.json`（`mcpServers` 字段）。

用户安装后同样落到 `mcp_servers`——两条路径最终殊途同归。注意 V1 的 OAuth 仅支持标准 PKCE Loopback，自定义 URI scheme、公网 relay 等复杂授权暂不支持。

### 自定义 Skill

- SDK / 协议接入：`import/run`（`source_kind: "workbuddy-skill-market"`，单个含 `SKILL.md` 的目录同样支持）→ `install/run`，随后 Run 中 mention 挂载；
- 本机接入：`POST /api/skills/import`（目录或 zip）导入为用户技能；
- 市场分发：按 `.codebuddy-skill/marketplace.json` + `skills/<slug>/` 布局发布到市场源。

## 7. 延伸阅读

- 市场条目浏览：[市场页面](/zh-CN/market)
- 市场源配置：[配置文件](/zh-CN/docs/configuration)
- 架构与导入分层：[架构说明](/zh-CN/docs/architecture)

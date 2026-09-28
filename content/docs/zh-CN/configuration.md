# 配置文件（config.toml）

Agent Store 将持久化配置集中管理于 `~/.agent-store/config.toml`（采用 TOML 格式），用于声明默认模型、API 供应商映射、模型别名以及默认市场源。

- **默认存储路径**：`~/.agent-store/config.toml`（Windows 平台对应 `%USERPROFILE%\.agent-store\config.toml`）
- **加载策略**：该配置文件为可选。文件不存在时，App Server 正常运行，模型调用需在 Web UI 中手动添加供应商；文件存在时，服务启动阶段自动注册其中声明的供应商、默认模型参数与市场源。

> 本配置文件遵循用户级 `config.toml` 规范（采用 `[providers.<name>]` 与 `[models."<provider>/<model>"]` 命名空间）。解析器采用宽容解析策略，容忍未知的顶层与嵌套键，支持与第三方工具共用配置文件。

同级目录下可选的 `mcp.json` 独立维护 MCP 服务声明，详见 [`mcp.json`：声明 MCP server](#mcp-json-声明-mcp-server)。

## 完整示例

```toml
default_model = "opencode/mimo-v2.5-free"

[providers.opencode]
type = "openai"
api_key = "sk-..."
base_url = "https://opencode.ai/zen/v1"

[providers.mimo]
type = "openai"
base_url = "https://api.xiaomimimo.com/v1"

[models."opencode/mimo-v2.5-free"]
provider = "opencode"
model = "mimo-v2.5-free"
display_name = "MiMo V2.5 Free"
max_context_size = 200000
max_output_size = 8000
capabilities = ["thinking", "tool_use"]

[models."opencode/laguna-s-2.1-free"]
provider = "opencode"
model = "laguna-s-2.1-free"
max_context_size = 256000
display_name = "Laguna S 2.1 Free"

# 默认市场源（首次调 store/market 时自动注册；官方三个市场各是一个 ModelScope 上的 zip 归档）
[default_marketplaces.experts]
source_kind = "zip"
source = "https://www.modelscope.cn/models/me9rez/flowy-marketplace/resolve/master/experts.zip"
```

> 官方市场（`experts` / `skills` / `connectors`）采用单 Zip 归档格式托管于 ModelScope。客户端通过 HTTP `HEAD` 请求获取 `X-Linked-Etag`（内容 sha256 摘要）实现增量缓存校验；当摘要未发生变化时跳过下载，下载后通过校验 sha256 确保完整性。

`[default_marketplaces]` 声明自定义市场源。配置规则如下：
- **覆盖机制**：一旦显式声明，运行时仅注册配置中指定的源，内置默认源不再加载；若需恢复默认行为，清空或删除该配置块即可。
- **格式规范**：官方市场已切换为 Zip 单归档分发模式，已弃用历史版本中的 `/source/<market>/...` 树形静态目录。
- **容灾策略**：拉取失败时保留本地最近一次有效快照，不影响既有已安装条目的索引与运行。

## 顶层字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `default_model` | `string` | 默认模型别名，格式为 `"<provider>/<model>"`，必须在 `[models]` 中存在；调用方未显式指定模型时缺省生效 |
| `providers` | `table` | API 供应商映射表 → `providers` |
| `models` | `table` | 模型别名配置表 → `models` |
| `default_marketplaces` | `table` | 启动时自动注册的市场源配置表 → `default_marketplaces` |
| `memory` | `table` | 本地文件型记忆系统策略：`enabled` 控制总开关，`distill_enabled` 控制会话后记忆蒸馏 → `memory` |
| `marketplace` | `table` | 后台市场自动同步轮询配置 → `marketplace` |
| `tools` | `table` | 宿主级工具策略（仅支持减法裁剪） → `tools` |
| `connector_proxy` | `table` | 连接器调用代理授权策略（缺省禁用） → `connector_proxy` |
| `credentials` | `table` | `secret:NAME` 敏感引用的映射表；仅限本地编辑，不通过网络接口暴露 |

## `providers`

以唯一标识符为键的供应商映射表。凭据严格从配置文件中解析，不从系统环境变量中隐式回落。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | `string` | 否 | 供应商协议类型，映射到底层运行时平台（如 `openai`、`anthropic`）；具体枚举见下表 |
| `api_key` | `string` | 否 | API 鉴权密钥，以明文存储于配置文件中 |
| `base_url` | `string` | 否 | API 基础端点 URL |
| `enabled` | `boolean` | 否 | 是否启用该供应商；缺省为 `true` |

> 密钥安全性：`api_key` 仅在运行时初始化供应商实例时读取，不记录于任何系统日志或分布式链路追踪上下文中。建议限制文件权限为当前用户只读（如 `chmod 600`）。

### `type` 的实际取值

未声明 `type` 或设为 `""` 均等价于 `custom`（OpenAI Chat Completions 兼容协议）。系统仅识别受支持的特定枚举，未匹配项将默认按 OpenAI 兼容协议处理：

| 你写的值 | 实际使用的协议 | 说明 |
| --- | --- | --- |
| 不写 / `""` / `custom` / `openai` / `kimi` | OpenAI Chat Completions | `kimi`、`mimo`、`deepseek` 等兼容 OpenAI 协议的服务均归入此类 |
| `anthropic` | Anthropic Messages | 严格遵守 Anthropic Messages 协议；对 `max_output_size` 具有硬性校验要求 |
| `openai_responses` | **OpenAI Chat Completions**（并非 Responses） | 若需启用 OpenAI Responses 协议，应在**模型级别**指定 `protocol = "openai-responses"` |
| `google-genai` / `vertexai` | **OpenAI Chat Completions**（协议不符） | 系统对应支持的供应商类型为 `gemini` 与 `gemini-vertex-ai` |

模型级协议覆盖（`[models]` 中的 `protocol` 字段）具备不同效力：`"openai-responses"` 在所有平台上均生效；而 `"anthropic"` 等协议转换仅在 `new-api` 兼容网关中生效。

## `models`

以 `"<provider>/<model>"` 字符串为键的模型配置表。`provider` 必须对应 `[providers]` 中已存在的键。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `provider` | `string` | 所属供应商标识符（必填） |
| `model` | `string` | 向上游服务发出的实际模型标识符（必填） |
| `display_name` | `string` | 界面展示名称 |
| `max_context_size` | `integer` | 上下文窗口上限（Token 数） |
| `max_output_size` | `integer` | 单次生成的输出上限（Token 数）；`anthropic` 协议必填，且受上下文窗口限制 |
| `protocol` | `string` | 单模型协议覆盖（如 `"openai-responses"`、`"anthropic"`） |
| `capabilities` | `array<string>` | 模型能力标签（如 `["thinking", "tool_use", "image_in"]`）；当前仅解析，保留配置兼容性 |
| `reasoning_key` | `string` | 推理思考内容在响应体中的键名（如 `reasoning_content`）；当前仅解析 |

### 输出上限（`max_output_size`）

`anthropic` 协议要求线上请求必须显式携带 `max_tokens` 参数。若该协议下的模型未声明输出上限，运行时构建请求时将直接返回错误：

```text
Bad request: the anthropic protocol requires an explicit output ceiling;
set Max output tokens on the <provider>/<model> model in Settings -> Models
```

| 协议 | `max_output_size` 缺失时 | 声明了之后 |
| --- | --- | --- |
| `anthropic` | **报错**：运行时以 `BAD_REQUEST` 拒绝，请求无法发出 | 映射为 `max_tokens` 参数发出 |
| OpenAI Chat Completions | 允许缺省：请求体不包含该字段，由服务端决定 | 映射为 `max_tokens`（部分网关为 `max_completion_tokens`）参数发出 |
| OpenAI Responses | 允许缺省：同上 | 映射为 `max_output_tokens` 参数发出 |

### 声明值不一定原样发出

`max_output_size` 实际生效值受两重向下收敛约束：

**一、上下文窗口比例约束（本地钳制）**

实际发出请求的输出上限为 `min(声明值, max_context_size / 4)`。当上下文窗口较小时，输出上限会被本地收缩以预留上下文缓冲：

| 上下文窗口 | 声明 `max_output_size` | 实际发出 |
| --- | --- | --- |
| 1,000,000 | 8000 | 8000（1/4 为 250,000，不触发收缩） |
| 8,000 | 8192 | 2000（触发 1/4 上限限制） |

**二、上游范围超限协商（仅限 OpenAI Chat Completions）**

当上游网关返回 `supported range is from L to U` 拒绝响应时，客户端自动解析其支持的最大上限，收敛数值后触发单次重试，并在进程生命周期内缓存该上限值：

- 协商值具有单向性：仅在进程内存中生效，重启后重新以配置文件为准。
- 错误信息需严格匹配 `supported range is from L ... to U ...` 模式，其他错误格式不触发重试。
- OpenAI Responses 协议不包含此协商机制。

### 两条与本键相关的注册行为

- **非破坏性写入**：模型注册时仅当目标模型缺失输出上限时填补配置值，不会覆盖用户在 Web UI 中手动调整的数值。
- **存量平滑补齐**：早期版本注册的供应商模型若缺失输出上限，下次模型解析时将自动按配置补齐，无需删除重建。

> 未配置 `max_output_size` 时系统不推测默认数值，以避免意外截断长输出。非正整数（`<= 0`）按未声明处理。

## `default_marketplaces`

默认市场源配置表。App Server 在首次接收 `store` 或 `market` 调用时自动注册；相同 ID 存在时按新源重新激活。

配置文件缺失或未声明 `[default_marketplaces]` 时，运行时自动加载内置官方源；显式声明后仅加载配置中指定的源。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `source_kind` | `string` | 来源协议类型：`zip` \| `url` \| `github` \| `git` \| `directory` |
| `source` | `string` | 目标地址；`url` 类型建议包含 `_files.txt` 索引，`zip` 类型仅接受 HTTP(S) URL |

```toml
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

## `memory`

配置本地文件型记忆系统策略。包含两个相互独立的作用域开关：

### `enabled`：内置记忆总开关

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | `boolean` | 设为 `false` 停用内置记忆系统；缺省为 `true`（启用） |

设为 `false` 时以下子系统同步停止运作：

| 面 | 关闭后的行为 |
| --- | --- |
| 系统提示词记忆注入 | 停止注入（不向模型呈现 `MEMORY.md` 索引） |
| `remember` 工具 | 停止注册，禁止写入新记忆 |
| 轮后记忆蒸馏 | 停止触发会话后额外模型抽取调用 |
| 记忆引用解析 | 停止解析 `<nomi-mem-citation>` 标签及引用计数更新 |

```toml
# 完全关闭内置记忆系统
[memory]
enabled = false
```

- 缺省为开启状态。已生成的本地记忆文件完整保留，重新开启后恢复生效。
- 该开关与 `distill_enabled` 相互独立；`enabled = false` 时蒸馏开关自动失效。
- 仅 Agent Store 宿主采纳该配置，修改后需重启宿主进程生效。

### `distill_enabled`：只关掉轮后蒸馏

记忆蒸馏（Distillation）指在每轮会话完成后异步调用模型提取关键信息写入文件存储。该过程在对话结束信号前触发，通常伴随 6~15 秒处理延迟。可通过禁用该阶段优化交互耗时。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `distill_enabled` | `boolean` | 设为 `false` 禁用轮后蒸馏；缺省为 `true`（启用） |

```toml
# 关闭会话结束后的记忆蒸馏
[memory]
distill_enabled = false
```

> 优先级策略：环境变量 `NOMIFUN_MEMORY_DISTILL` > 配置文件 `[memory].distill_enabled` > 默认值（启用）。

## `marketplace`

配置后台自动更新轮询策略。默认处于关闭状态。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `auto_update_interval_hours` | `integer` | 轮询间隔小时数。`0` 或未设置表示禁用；正整数表示启用 |

```toml
# 每 6 小时在后台检查一次官方市场源
[marketplace]
auto_update_interval_hours = 6
```

> 自动更新仅针对源地址属于官方镜像且标记了自动更新的市场生效。轮询时基于 ETag 及 SHA256 执行增量判定，无变更时不触发重复拉取。

## `tools`

宿主级工具策略：定义全局注入会话的工具集。该配置仅支持减法裁剪，禁用后在当前宿主的所有会话中不可用。

> 该配置仅由 Agent Store 命令行宿主生效，启动时加载一次，变更需重启生效。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | `array<string>` | 工具白名单：非空时仅保留列表中声明的工具；空数组或未指定表示不设白名单限制 |
| `disabled` | `array<string>` | 工具黑名单：在白名单之后求交生效；内置工具按精确名称匹配，`mcp__` 前缀支持通配符 |
| `web` | `boolean` | `WebSearch` / `WebExtract` 联网工具开关；缺省为 `true` |
| `computer` | `boolean` | `Computer` 桌面键鼠及界面控制工具开关；缺省为 `true` |
| `browser` | `boolean` | `Browser` 浏览器自动化工具开关；缺省为 `true` |
| `plan` | `boolean` | `EnterPlanMode` / `ExitPlanMode` 规划模式工具开关；缺省为 `true` |
| `lsp` | `boolean` | `Lsp` 语言服务工具开关（需配置对应 LSP 服务端）；缺省为 `true` |
| `domains` | `table` | 业务能力域级开关映射表 → `tools.domains`；各项缺省为 `true` |

> 核心文件操作工具（`Read` / `Write` / `Edit` / `Glob` / `Grep` / `Bash`）不受上述布尔开关影响，需通过 `disabled` 列表显式禁用。

### `tools.domains`

| 键 | 关掉的能力 |
| --- | --- |
| `cron` | 定时任务能力（`cron_create` / `cron_list` / `cron_delete`） |
| `meeting` | 会议音频与听会上下文工具族（`meeting.*`） |
| `knowledge` | 知识库检索与写入工具（`knowledge_*`）及知识库挂载 |
| `learning` | 结构化课程生成与状态工具（`learning_*`） |
| `media` | 多媒体内容生成能力（`image_generate` 等） |
| `companion` | 陪伴记忆检索与主动建议工具（`companion_*`） |
| `requirement` | 需求流转与状态管理能力（`requirement_*`） |
| `goal` | 目标驱动与自主多轮循环能力（`update_goal` 等） |

关闭对应业务域不仅停止注册相关工具，同时卸载宿主关联的底层上下文挂载机制。

```toml
# 仅保留基础工程工具能力，裁剪高级业务能力域
[tools]
web = true
computer = false
browser = false

[tools.domains]
cron = false
meeting = false
knowledge = false
learning = false
media = false
companion = false
requirement = false
```

### 用环境变量覆盖（`AGENT_STORE_TOOLS`）

运行时支持通过环境变量直接覆盖工具策略：

| 事实 | 行为 |
| --- | --- |
| 格式 | JSON 字符串，结构与 `[tools]` 表一致；`{}` 表示保持全量默认 |
| 优先级 | 环境变量 `AGENT_STORE_TOOLS` > `config.toml` > 默认宽松策略 |
| 生效机制 | 覆盖整张 `[tools]` 表（完全替换而非字段合并） |
| 容错规则 | JSON 解析失败时输出告警并回落至配置文件；空字符串视为未设置 |
| 读取时机 | 宿主进程启动时读取一次 |

```bash
AGENT_STORE_TOOLS='{"computer":false,"domains":{"knowledge":false}}' agent-store
```

完整调用范例请参阅 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §10。

## `connector_proxy`

连接器调用代理授权表：控制外部调用方（如外部 Agent 或 SDK 客户端）能否通过宿主代理调用本地已安装的 MCP 连接器。代理机制确保敏感凭据和物理连接始终保留在本地宿主环境中。

> 该配置仅由 Agent Store 命令行宿主生效，不暴露于远程管理接口，启动时加载一次。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | `boolean` | 代理总开关；设为 `true` 开启代理，缺省为 `false`（关闭） |
| `allow` | `array<string>` | 白名单限制：声明后仅放行命中的工具；未声明表示放行所有已启用的连接器 |
| `deny` | `array<string>` | 黑名单限制：在白名单之后求交生效 |

工具匹配格式为 `mcp__<连接器>__<工具>`，支持以 `mcp__<连接器>__*` 进行前缀通配。

```toml
[connector_proxy]
enabled = true                    # 开启调用代理
allow = ["mcp__github__*"]        # 仅放行 GitHub 连接器下的所有工具
deny = ["mcp__*__delete_*"]       # 拦截所有连接器下的删除类工具
```

权限判决顺序：

| # | 门 | 不过时返回 |
| --- | --- | --- |
| 1 | 配置块缺失或 `enabled != true` | `policy_denied` |
| 2 | 目标连接器不存在 | `not_found` |
| 3 | 配置了 `allow` 且无规则匹配 | `policy_denied` |
| 4 | 命中 `deny` 黑名单规则 | `policy_denied` |
| 5 | 连接器存在但处于禁用状态 | `connector_unavailable` |

> 环境变量 `AGENT_STORE_CONNECTOR_PROXY` 支持通过传入 JSON 字符串完全覆盖此表配置。

## `mcp.json`：声明 MCP server

`mcp.json` 与 `config.toml` 同级存放，专门用于以文件形式声明本地接入的 MCP 服务定义：

- **默认存储路径**：`~/.agent-store/mcp.json`（与当前生效的 `config.toml` 同目录）。
- **加载策略**：可选文件；启动时解析一次，变更需重启宿主生效。
- **存储语义**：声明的服务属于非持久化运行时视图，不写入本地 `mcp_servers` 数据库表。
- **优先级**：同名服务按照 **`mcp.json` 声明 > `mcp_servers` 数据行** 生效；单次会话中的显式绑定具备最高优先级。

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/srv/data"],
      "env": { "UPSTREAM_TOKEN": "secret:UPSTREAM_TOKEN" },
      "cwd": "servers/filesystem",
      "toolTimeoutMs": 30000
    },
    "linear": {
      "url": "https://mcp.linear.app/mcp",
      "headers": { "X-Tenant": "acme" },
      "bearerTokenEnvVar": "LINEAR_TOKEN"
    },
    "legacy": {
      "transport": "sse",
      "url": "https://mcp.example.com/sse"
    }
  }
}
```

包含 `command` 字段声明为 stdio 进程；包含 `url` 且未指定 `transport` 声明为 Streamable HTTP；声明 `"transport": "sse"` 时采用 SSE 协议。

| 字段 | 适用 | 说明 |
| --- | --- | --- |
| `command` | stdio | 执行文件路径或命令 |
| `args` | stdio | 命令行参数列表，缺省为空数组 |
| `env` | stdio | 环境变量映射表；支持 `secret:NAME` 引用 |
| `cwd` | stdio | 工作目录；相对路径相对于 `mcp.json` 所在目录解析 |
| `url` | 远程 | 服务端点 URL（缺省使用 Streamable HTTP 协议） |
| `headers` | 远程 | 自定义请求头映射表；支持 `secret:NAME` 引用 |
| `bearerTokenEnvVar` | 远程 | 存放 Bearer Token 的环境变量名称 |
| `transport` | 远程 | 传输协议覆盖；仅接受 `"sse"` |
| `enabled` | 全部 | 是否启用当前服务；缺省为 `true` |
| `deferred` | — | 不受支持；声明该字段将导致条目解析失败 |
| `startupTimeoutMs` | 全部 | 握手与工具列表初始化超时时间（毫秒），缺省为 30000 |
| `toolTimeoutMs` | 全部 | 单次工具执行调用超时时间（毫秒） |
| `enabledTools` | 全部 | 工具白名单列表 |
| `disabledTools` | 全部 | 工具黑名单列表；在白名单之后求交排除 |

解析器执行严格校验，包含未知字段或传输模式不匹配（如 stdio 声明 `headers`）将导致单条记录加载失败，不影响文件中其他合法服务声明。

### 与参考实现的五处差异

与标准 CLI 参考实现相比，本规范存在以下边界差异：

- **不支持 `deferred` 字段**：系统通过 `ToolSearch` 与工具减项策略管理工具加载，暂不采用延迟声明机制；声明该键将拒绝加载对应条目。
- **作用域限定为用户级**：仅解析 `~/.agent-store/mcp.json`，不支持项目级目录自动覆盖。
- **静态声明周期**：配置仅在宿主进程启动阶段加载，运行中修改需重启生效。
- **无全局超时缺省继承**：不从主配置中继承超时参数，超时设置需在各条目中独立指定。
- **超时上限严格收敛**：超时上限设为 600,000 毫秒（10 分钟），超出范围将直接拒绝加载该条目。

### server key、工具名与工具过滤

`mcpServers` 中的服务键名将作为工具名称的前缀（格式为 `mcp__<key>__<tool>`）。键名必须满足以下约束：由 ASCII 字母、数字、`_`、`-` 组成，必须以字母或数字开头及结尾，且长度不超过 40 个字符。

`enabledTools` 与 `disabledTools` 支持两种过滤模式：
- 以 `mcp__` 开头：执行完整工具名匹配（兼容运行时派生哈希后缀）；
- 常规字符串：匹配服务内部的局部工具名称；
- `*`：匹配当前服务下的所有工具。

若需从全局范围禁用指定服务的所有工具，可通过 `[tools]` 表声明：

```toml
[tools]
disabled = ["mcp__<key>__*"]
```

### `secret:NAME`：凭据不写进声明文件

在 `env` 与 `headers` 中支持使用 `secret:NAME` 进行敏感凭据引用。宿主进程启动时将从 `[credentials]` 表（或进程环境变量）中解析实际数值并注入内存，避免敏感信息直接暴露在声明文件中。

```toml
# 与 mcp.json 同级的 config.toml
[credentials]
UPSTREAM_TOKEN = "…"    # 注入到 mcp.json 中的 secret:UPSTREAM_TOKEN
```

> `[credentials]` 表不支持通过管理 API 读取或修改。若引用的密钥名不存在，宿主将省略该字段并记录告警。

### 在 Web UI 里读、开关与编辑

Web UI 的「MCP 服务管理」模块直接呈现当前配置文件的状态：
- 集中展示已声明服务的名称、传输协议、运行状态及异常条目的诊断原因。
- 界面开关直接通过文本级编辑更新目标服务的 `enabled` 字段，完整保留既有缩进与注释排版。
- 内置编辑器保存时执行语法校验，校验失败时阻止写入并高亮错误行号。

## 与 Kimi Code / Claude Code 配置的异同

| 维度 | Agent Store | Kimi Code 等 |
| --- | --- | --- |
| 文件位置 | `~/.agent-store/config.toml` | 各工具专属目录（如 `~/.kimi-code/config.toml`） |
| `[providers]` / `[models]` | 结构同构，支持通用字段 | 结构同构，部分特定供应商拼写存在差异 |
| `max_output_size` | 遵循配置并受 1/4 上下文窗口限制；`anthropic` 协议必填 | 通常根据模型名隐式推断默认值 |
| `default_model` | `"<provider>/<model>"` 别名格式 | 结构同构 |
| 未知键 | 容忍保留，不影响解析 | 容忍保留 |
| 环境变量后备 | 不隐式从 Shell 变量读取凭证 | 部分工具支持环境变量回落 |
| Agent Store 专属 | `default_marketplaces`、`[memory]`、`[marketplace]`、`[tools].domains`、`[connector_proxy]`、`[credentials]` | 无业务域开关及连接器调用代理表 |
| MCP 声明 | `~/.agent-store/mcp.json`（仅用户级） | 支持项目级 `.kimi-code/mcp.json` 覆盖 |

迁移配置时的注意事项：
- **供应商类型枚举校验**：部分第三方工具中合法的特定拼写（如 `google-genai` / `vertexai`）在未适配时将回落为通用 OpenAI 兼容协议。
- **Anthropic 输出上限硬性要求**：接入 `anthropic` 协议时必须显式配置 `max_output_size` 参数。
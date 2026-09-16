# 配置文件（config.toml）

Agent Store 把所有长期偏好写进 `~/.agent-store/config.toml`（TOML 格式）：默认模型、API 供应商、模型别名与默认市场源。改一次，每次启动都生效。

- **默认位置**：`~/.agent-store/config.toml`（Windows 上为 `%USERPROFILE%\.agent-store\config.toml`）
- **可选文件**：文件缺失时 App Server 正常运行，但模型调用需要先在 Web UI 中手工创建供应商；存在时启动即自动注册其中声明的供应商、模型默认值与市场源。

> 本文件沿用 Claude Code / Codex / Kimi Code 风格的用户级 `config.toml` 惯例（`[providers.<name>]` + `[models."<provider>/<model>"]`）。**未知的顶层与嵌套键会被容忍**——文件属于你，可以携带 Agent Store 不消费的其他工具（如 Kimi Code 的 `thinking`、`permission`、`hooks`）的设置，不会导致解析失败。

同目录下还有第二份可选文件 `mcp.json`：它不属于本文件的任何一张表，声明的是**本机接入哪些 MCP server**，因此单独成节——见 [`mcp.json`：声明 MCP server](#mcp-json-声明-mcp-server)。

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

# 默认市场源（首次调 store/market 时自动注册；由官网站点自托管）
[default_marketplaces.experts]
source_kind = "url"
source = "https://agent-store.flowyaipc.cn/source/experts/.codebuddy-plugin/marketplace.json"
```

## 顶层字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `default_model` | `string` | 默认模型别名，格式 `"<provider>/<model>"`，必须能在 `[models]` 中解析；调用方不指定模型时使用 |
| `providers` | `table` | API 供应商表 → `providers` |
| `models` | `table` | 模型别名表 → `models` |
| `default_marketplaces` | `table` | 启动自动注册的市场源表 → `default_marketplaces` |
| `memory` | `table` | 会话结束后的记忆策略 → `memory`（见下） |
| `marketplace` | `table` | 后台自动更新节奏 → `marketplace`（见下） |
| `tools` | `table` | 宿主级工具策略（只做减法） → `tools`（见下） |

## `providers`

以唯一名称为 key 的供应商表。Agent Store 从**这里**读取凭证，不会从 shell 环境变量自动取后备值。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | `string` | 否 | 供应商类型（映射到运行时平台），如 `openai`、`anthropic` |
| `api_key` | `string` | 否 | API 密钥，明文写在配置文件里 |
| `base_url` | `string` | 否 | API 基础 URL |
| `enabled` | `boolean` | 否 | 是否启用以自动注册；缺省视为启用 |

> 密钥安全：`api_key` 只用于加密的供应商注册，读取后即被丢弃，**不会**出现在任何日志与追踪负载中。文件权限建议自行收紧（`chmod 600`）。

## `models`

以 `"<provider>/<model>"` 为 key 的模型别名表。`provider` 必须指向 `[providers]` 中已声明的键。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `provider` | `string` | 所属供应商 key（必填） |
| `model` | `string` | 发给上游的模型名（必填） |
| `display_name` | `string` | 界面显示名 |
| `max_context_size` | `integer` | 上下文窗口上限（token 数） |
| `max_output_size` | `integer` | 单次输出上限（token 数） |
| `capabilities` | `array<string>` | 能力标记，如 `["thinking", "tool_use", "image_in"]` |
| `reasoning_key` | `string` | 思考内容在响应中的字段名，如 `reasoning_content` |

## `default_marketplaces`

默认市场源（winget 风格的软件源）。App Server 在首次 `store` / `market` 调用时自动注册；同 id 已存在时按新 source 重新激活。

下面这三个源就是**发布版内置默认源**：`config.toml` 缺失、或文件里没有 `[default_marketplaces]` 时，运行时会自动注册它们（每个源都带 `_files.txt`，整棵条目树会被镜像）；一旦你自己声明了这张表，就只注册你写的源。官方源与第三方源的区别见 [插件与市场](/zh-CN/docs/plugins-market)：只有官方源默认开启自动更新。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `source_kind` | `string` | `url` \| `github` \| `git` \| `directory` |
| `source` | `string` | 具体地址；`url` 类型建议同时提供目录枚举（`_files.txt`）以支持条目树镜像 |

```toml
[default_marketplaces.experts]
source_kind = "url"
source = "https://agent-store.flowyaipc.cn/source/experts/.codebuddy-plugin/marketplace.json"

[default_marketplaces.workbuddy-skills]
source_kind = "url"
source = "https://agent-store.flowyaipc.cn/source/skills/.codebuddy-skill/marketplace.json"

[default_marketplaces.connectors]
source_kind = "url"
source = "https://agent-store.flowyaipc.cn/source/connectors/.codebuddy-connector/connectors.json"
```

## `memory`

会话结束后的记忆策略。**记忆蒸馏**（distillation）会在每个正常对话轮次结束后额外调用一次模型，把本轮会话蒸馏进基于文件的记忆；这次调用发生在该轮**终止信号之前**，所以客户端会看到「回答已经完整，但会话仍显示正在处理」约 **6~15 秒**（随模型响应时间波动）。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `distill_enabled` | `boolean` | `false` 关闭记忆蒸馏（本轮结束后不再有额外模型调用，「回答完成」与「轮次结束」同时发生）；`true` 或不写该键 = 沿用上游默认（**开**） |

```toml
# 关闭会话结束后的记忆蒸馏（省掉每轮一次的额外模型调用与 6~15 秒收尾等待）
[memory]
distill_enabled = false
```

> 优先级：环境变量 `NOMIFUN_MEMORY_DISTILL`（`0`/`false` 关、`1`/`true` 开）> 本文件的 `[memory].distill_enabled` > 上游默认（开）。不写 `[memory]` 段落时行为与以前完全一致。

## `marketplace`

后台**自动更新**节奏。开启后，运行时按该间隔在后台轮询市场源；**默认关闭**——不写 `[marketplace]` 段落就不会产生任何后台请求。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `auto_update_interval_hours` | `integer` | 两次轮询之间的小时数。不写或 `0` = 关闭；写了正整数才启用 |

```toml
# 每 6 小时在后台检查一次市场源（仅官方源；第三方源永不自动更新）
[marketplace]
auto_update_interval_hours = 6
```

> 两道闸同时成立才会真正拉取：① 该市场的「自动更新」开关为开；② 其源地址属于**官方镜像**。第三方源即使手动把开关打开也只保留标记，不会自动拉取。每次轮询仍走 `market/refresh` 的 revision / ETag 短路，内容未变时不会重新下载整棵树。

## `tools`

宿主级工具策略：**决定这台宿主给每个会话注入哪些工具**。它只做减法——没有任何「强制开启」的开关，被关掉的能力在该宿主上对所有会话都不可用。

> **只有 Agent Store 宿主采纳这张表**（`agent-store` 可执行文件）。桌面端与 Web 宿主读同一个文件拿 `[providers]` / `[default_marketplaces]`，但**忽略 `[tools]`**。宿主**启动时读一次**，改完需重启才生效。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | `array<string>` | 白名单：非空时**只**保留列出的工具；空数组或缺省 = 不约束（不是「全禁」） |
| `disabled` | `array<string>` | 黑名单：在 `enabled` **之后**应用，因此永远只会更严；内置工具按**完整名字**精确匹配（区分大小写），只有 `mcp__<server>__*` 这类 MCP 名字按通配处理 |
| `web` | `boolean` | `WebSearch` / `WebExtract`。缺省 `true` |
| `computer` | `boolean` | `Computer`（桌面控制：键鼠 / UIA）。缺省 `true` |
| `browser` | `boolean` | `Browser` 工具族（携带操作者的 profile 与登录态）。缺省 `true` |
| `plan` | `boolean` | `EnterPlanMode` / `ExitPlanMode`。缺省 `true` |
| `lsp` | `boolean` | `Lsp` 导航工具（只有配置了 LSP server 才会注册）。缺省 `true` |
| `domains` | `table` | 产品域开关 → `tools.domains`（见下）；每个键缺省 `true` |

> 基础工具**不受这张表影响**：`Read` / `Write` / `Edit` / `Glob` / `Grep` / `Bash`（以及 `ToolSearch`、MCP 代理工具）不在上面的开关里，只能用 `disabled` 逐个点名移除。把 `ToolSearch` 放进 `disabled` 会让**所有**连接器工具不可达——宿主只在启动日志里告警，不会拒绝启动。

### `tools.domains`

| 键 | 关掉的能力 |
| --- | --- |
| `cron` | `cron_create` / `cron_list` / `cron_delete`（原生定时任务） |
| `meeting` | `meeting.*` 工具族与听会上下文 |
| `knowledge` | `knowledge_search` / `knowledge_read` / `knowledge_write` 与知识库挂载 |
| `learning` | `learning_generate_course` / `learning_course_status` |
| `media` | Flowy 媒体生成（当前只有 `image_generate`；视频走 vimax 页面，不在这张表里） |
| `companion` | `recall_memories` / `propose_companion_memory` 与会话内 summon |
| `requirement` | `requirement_complete` / `requirement_update_status`（AutoWork） |
| `goal` | `update_goal` 与目标驱动的续轮 |

域开关关掉的是**接线**：不只工具不注册，知识库挂载与 cron / meeting 的宿主接缝也一并不接，不会留下「工具没了但挂载还在」的半截状态。

```toml
# 只保留基础助手能力：关掉两个宿主控制开关与七个没有管理面的产品域
[tools]
web = true          # 联网检索 / 读页面：保留
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

`agent-store init` 生成的模板写的就是上面这份默认值；`plan` / `lsp` / `goal` 不写 = 保持默认开。

### 用环境变量覆盖（`AGENT_STORE_TOOLS`）

自己 spawn 宿主时（例如 SDK 的 `launchClient`）不必改这份文件：环境变量 `AGENT_STORE_TOOLS` 的值是一段 JSON（形状同 `[tools]` 表），**整份替换**文件里的策略，而不是与它合并。

| 事实 | 行为 |
| --- | --- |
| 值 | JSON，形状同 `[tools]` 表；`{}` = 全部默认开 |
| 优先级 | 环境变量 > 本文件 > 宽松默认 |
| 生效范围 | 与文件同一道闸：只有采纳 `[tools]` 的宿主生效 |
| 不可解析 | 打 warning 后回落到本文件；空值 = 未设置（不是「全禁」） |
| 生效时机 | 宿主启动时读一次 |

```bash
AGENT_STORE_TOOLS='{"computer":false,"domains":{"knowledge":false}}' agent-store
```

完整用法示例见 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk) §10。

## `mcp.json`：声明 MCP server

`config.toml` 管的是长期偏好；**MCP server 从哪来**写在它同级的一份独立文件 `mcp.json`（JSON）里。这份文件的 schema 沿用 [Kimi Code CLI 的 MCP 配置](https://www.kimi.com/code/docs/kimi-code-cli/customization/mcp.html)：字段同名同义，照抄通常可用，差异见本节末。

- **默认位置**：`~/.agent-store/mcp.json`（Windows 上为 `%USERPROFILE%\.agent-store\mcp.json`）。它跟着宿主解析出的 `config.toml` 走——配置文件指到哪个目录，读的就是那个目录下的 `mcp.json`；没有独立的环境变量能把它挪走。
- **可选文件**：不存在 = 没有声明任何 server，行为与此前完全一致。
- **只有 Agent Store 宿主读它**（`agent-store` 可执行文件）。桌面端与 Web 宿主指向同一个目录、读同一份 `config.toml` 拿供应商与市场源，但**不读**这份声明——能读到不等于该由它采用。
- 宿主**启动时读一次**，改完要重启才生效（在 Web UI 里改也一样）。

声明的 server **不会写进 `mcp_servers` 表**：它们不进连接器目录、不能被预设（preset）的 `mcp_server_ids` 引用，也没有持久化的连接测试状态与工具清单。同名条目按 **`mcp.json` > `mcp_servers` 数据行** 生效——声明文件是操作者逐字写下的意图，而数据行通常只是导入的残留；一次调用里的显式绑定优先级最高，声明不会覆盖调用方本轮点名的 server。换句话说，这份文件只是 server 的**来源之一**：经 MCP 配置接口注册、或由市场 / 插件装进来的 server 落在 `mcp_servers` 行，见[插件与市场](/zh-CN/docs/plugins-market) §6。

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

`mcpServers` 的每个 key 是一个 server，它属于哪一类由 `command` / `url` 二选一决定：含 `command` 的是 stdio server，含 `url` 且不写 `transport` 的是 HTTP server，旧式 SSE 才需要显式写 `"transport": "sse"`。

| 字段 | 适用 | 说明 |
| --- | --- | --- |
| `command` | stdio | 要启动的可执行文件。写了它就按 stdio 处理 |
| `args` | stdio | 参数数组，缺省为空 |
| `env` | stdio | 注入子进程的环境变量；值是整值 `secret:NAME` 时按引用解析 |
| `cwd` | stdio | 子进程的工作目录。相对路径**相对 `mcp.json` 所在目录**解析，与宿主进程从哪个目录启动无关 |
| `url` | 远程 | 远程地址。不写 `transport` 即 Streamable HTTP |
| `headers` | 远程 | 附加到每次请求的静态请求头；整值 `secret:NAME` 按引用解析 |
| `bearerTokenEnvVar` | 远程 | 存放 bearer token 的**变量名**（`[credentials]` 或进程环境变量）。宿主自己把它解析成 `Authorization: Bearer <值>`，引擎看不到这个字段；同时写了 `headers.Authorization` 时以显式 header 为准 |
| `transport` | 远程 | 只接受 `"sse"`。Streamable HTTP 请**省略**该字段——写 `"http"` 会被拒 |
| `enabled` | 全部 | `false` = 条目仍可读、可编辑，但不进任何会话；缺省 `true` |
| `deferred` | — | **不支持**（参考实现里它是实验性的「按需加载工具」）。在这里它算未知字段，会让整个条目被拒 |
| `startupTimeoutMs` | 全部 | 连接握手（启动子进程 + `initialize` + `tools/list`）的预算，缺省 30 秒 |
| `toolTimeoutMs` | 全部 | 单次工具调用的墙钟预算 |
| `enabledTools` | 全部 | 工具白名单：只注册匹配的工具。先应用 |
| `disabledTools` | 全部 | 工具黑名单：匹配的工具永不注册。在 `enabledTools` **之后**应用，两个列表里都出现的模式 = 排除 |

解析是**严格**的：只接受上表列出的字段，未识别的键会让**该条目**被拒，报错会点名那个键并列出被接受的字段集合。静默忽略会改变声明的安全语义——一个被忽略的 `disabledTools`，正是用户以为已经关掉、实际上仍可调用的工具。字段放错传输同样拒绝：stdio 条目写 `headers` / `bearerTokenEnvVar`，或远程条目写 `args` / `env` / `cwd`，都是错误而不是被忽略。

拒绝的粒度是**逐条目**的：一个条目写坏只影响它自己，同一个文件里其他 server 照常加载。只有**整份文件**级别的问题（JSON 非法、顶层不是对象、`mcpServers` 不是对象）才让整份声明作废，那时宿主按「什么都没声明」处理，并把原因打进启动日志。

### 与参考实现的五处差异

除下面五点外，`mcp.json` 与[参考实现](https://www.kimi.com/code/docs/kimi-code-cli/customization/mcp.html)同名同义，可以直接照抄：

- **没有 `deferred`**。参考实现后来补的第十个字段（它的实验性「按需加载工具」）在这里按**未知字段**处理，会让**整个条目**被拒——照抄参考实现的 `mcp.json` 时，除了两个超时越界，这是唯一会被整条目拒绝的字段。我们的按需加载走的是 `ToolSearch` 与宿主 `[tools]` 的减项策略，声明路径固定按「急切 schema」接线，所以接这个字段是**新增一项能力**，而不是补一个漏掉的字段；在它落地之前保持拒绝。
- **只做用户级**。参考实现有项目级 `.kimi-code/mcp.json` 并让它覆盖用户级；这里只有 `~/.agent-store/mcp.json` 这一层，项目级路径**保留但不实现**。要在某个项目里换一组 server，只能改这份用户级文件。
- **生效时机更严格**。参考实现是「编辑只对新会话生效」，这里是「宿主启动时读一次」：新增、编辑、删除都要到下一次**宿主启动**才生效。因此这里也没有 `removed` 墓碑态——删掉的 server 在已开会话里直接不可见。
- **没有全局超时默认值**。参考实现的 `config.toml [mcp] startup_timeout_ms` / `tool_timeout_ms` 以及对应的环境变量在这里没有对应物，两个超时只能逐条目写。
- **两个超时的上界更紧**。参考实现允许 `1..=2147483647` 毫秒，这里按引擎自己的上界卡在 **600000 毫秒（10 分钟）**，越界**拒绝该条目**，不夹取也不静默改小。一个挂死的 MCP 调用会把整个 agent 轮次拖住，这是我们主动不要的能力；而声明文件是用户唯一的意图表达，悄悄改小会让「这个 server 从来不返回」无法归因。两个超时另外按**整秒**执行：不足一秒的向上取整，保证声明的条目不会拿到比它要求的更少的预算。

> 参考实现的 OAuth 登录（`/mcp-config login`）不在声明文件这条路径上：`mcp.json` 只走静态凭据（`secret:NAME` / `headers` / `bearerTokenEnvVar`）。需要浏览器授权时，把 server 作为连接器注册成 `mcp_servers` 行，走运行时那套 OAuth。

### server key、工具名与工具过滤

`mcpServers` 的 key 会成为工具名的前缀：模型看到的是 `mcp__<key>__<tool>`（例：`mcp__linear__create_issue`）。所以 key 有硬约束，**不满足就拒绝该条目**：只能是 ASCII 字母、数字、`_`、`-`，必须**以字母或数字开头、也以字母或数字结尾**，且**不超过 40 个字符**。40 这个上界不是拍脑袋定的——工具名由 `mcp__` + `<key>__<tool>` 的截断 slug + 16 位摘要拼成，总长上限 64，40 是让 `<key>__` 这个分隔符能完整存活的保守值；一旦 key 被截断，用户写的 `mcp__<key>__*` 就再也命不中。

`enabledTools` / `disabledTools` 的条目有两种写法，两种都收：

- 以 `mcp__` 开头 → 当通配：先匹配原始来源名 `mcp__<server>__<tool>`，再匹配运行时实际的名字 `mcp__<server>__<tool>__<摘要>`；
- 其余写法 → 当通配匹配该 server 的**局部工具名**（如 `read_file`）；
- `*` 表示该 server 的全部工具。

白名单条目一个都没命中、或白名单把该 server 的工具全裁光时，宿主会告警——否则「被裁到空」与「这个 server 本来就没这个工具」在界面上完全一样。黑名单未命中只记 debug：一份共享的减项清单覆盖多个 server 是正常用法。

要整组关掉一个 server，两种写法层级不同：

```toml
# 全局：本宿主的每个会话都不注册这个 server 的工具
[tools]
disabled = ["mcp__<key>__*"]
```

写在 `mcp.json` 自己的 `disabledTools` 里则只作用于这一个 server。宿主 `[tools]` 永远在**最后**求交，是那道兜底——声明只拓宽 server 的**来源**，从不改变对工具的**策略**。

### `secret:NAME`：凭据不写进声明文件

`env` 与 `headers` 的值支持**整值**引用 `secret:NAME`：宿主按名字从 `[credentials]` 取值（找不到再回落到进程环境变量），只在 spawn 时于内存里填入。值不写回快照、数据行或日志。

```toml
# 与 mcp.json 同级的 config.toml
[credentials]
UPSTREAM_TOKEN = "…"    # 填给 mcp.json 里的 secret:UPSTREAM_TOKEN
```

> `[credentials]` 只能手工编辑：它不在 `config/get` 的投影里，也不在 `config/set` 的白名单里——凭据不该被任何请求读回或改写。引用查不到名字时，宿主**省掉那个变量 / header** 并告警，绝不会把 `secret:NAME` 当字面量发出去。唯一的常见误写是 `"Authorization": "Bearer secret:TOKEN"`——它落在**整值**引用之外，会被原样发出，因此宿主专门为它打一条告警（只记 header 名，不记值）；这种场景请改用 `bearerTokenEnvVar`，或把 `Bearer ` 前缀放进凭据值本身。

### 在 Web UI 里读、开关与编辑

设置里有一个 **MCP** 分区（连接器目录页的「MCP 服务管理」打开的是同一个面板），它读的就是宿主上的这份文件，不需要你去翻命令行：

- 列出已声明的 server（名字、传输、启用状态）与**被拒绝的条目及其原因**，并单独回答「本宿主是否启用该声明」——`exists: true` 却没有被采用，正是「文件没问题、本机不读它」这一对组合。
- 每个 server 有一个开关，翻转的是它自己的 `enabled` 成员，且是**文本级最小编辑**：只替换那个值，缩进、键顺序与注释原样保留。
- 「配置 MCP」打开正文编辑器。保存前宿主用**同一个解析器**验一遍：解析不过就一个字节都不写，并把原始原因（含行号与列号）显示回来。这份正文是唯一会把声明取值（含 `env` / `headers`）交给客户端的读面，因此只在打开编辑器时才按需读取；其余读面只有名字、传输与启用状态。

这些方法只走宿主本机的 WebSocket、没有 HTTP 绑定，也不在 SDK 包里——它们是宿主管理面，不是给远程调用方用的。方法名与判定依据见 [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk) §5.3。

## 与 Kimi Code / Claude Code 配置的异同

| 维度 | Agent Store | Kimi Code 等 |
| --- | --- | --- |
| 文件位置 | `~/.agent-store/config.toml` | `~/.kimi-code/config.toml` 等（各工具独立目录） |
| `[providers]` / `[models]` | 同构：`type`/`api_key`/`base_url`、`provider`/`model`/`max_context_size`/`capabilities` | 同构 |
| `default_model` | `"<provider>/<model>"` 别名 | 同构 |
| 未知键 | 容忍，不报错 | 容忍 |
| 环境变量后备 | **无**——凭证只从文件读取 | 部分工具有 `env` 子表/环境变量后备 |
| Agent Store 专属 | `default_marketplaces`、`[memory]`、`[marketplace]`、`[tools].domains`（`[tools]` 的 `enabled` / `disabled` 两边同构，域开关是本产品特有） | 无 `domains` 域开关 |
| MCP 声明 | `~/.agent-store/mcp.json`（与 `config.toml` 同级，**只做用户级**） | `~/.kimi-code/mcp.json` 加项目级 `.kimi-code/mcp.json`（项目级覆盖用户级） |

如果你的配置里已经有 Kimi Code 或其他工具的 `[providers]`、`[models]` 段落，可以**直接复制**它们到 `~/.agent-store/config.toml` 使用（前提是该供应商走 OpenAI/Anthropic 兼容协议）；不相关的段落（`thinking`、`permission`、`hooks` 等）保留与否都不影响 Agent Store 解析。
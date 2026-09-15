# 配置文件（config.toml）

Agent Store 把所有长期偏好写进 `~/.agent-store/config.toml`（TOML 格式）：默认模型、API 供应商、模型别名与默认市场源。改一次，每次启动都生效。

- **默认位置**：`~/.agent-store/config.toml`（Windows 上为 `%USERPROFILE%\.agent-store\config.toml`）
- **可选文件**：文件缺失时 App Server 正常运行，但模型调用需要先在 Web UI 中手工创建供应商；存在时启动即自动注册其中声明的供应商、模型默认值与市场源。

> 本文件沿用 Claude Code / Codex / Kimi Code 风格的用户级 `config.toml` 惯例（`[providers.<name>]` + `[models."<provider>/<model>"]`）。**未知的顶层与嵌套键会被容忍**——文件属于你，可以携带 Agent Store 不消费的其他工具（如 Kimi Code 的 `thinking`、`permission`、`hooks`）的设置，不会导致解析失败。

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

## 与 Kimi Code / Claude Code 配置的异同

| 维度 | Agent Store | Kimi Code 等 |
| --- | --- | --- |
| 文件位置 | `~/.agent-store/config.toml` | `~/.kimi-code/config.toml` 等（各工具独立目录） |
| `[providers]` / `[models]` | 同构：`type`/`api_key`/`base_url`、`provider`/`model`/`max_context_size`/`capabilities` | 同构 |
| `default_model` | `"<provider>/<model>"` 别名 | 同构 |
| 未知键 | 容忍，不报错 | 容忍 |
| 环境变量后备 | **无**——凭证只从文件读取 | 部分工具有 `env` 子表/环境变量后备 |
| Agent Store 专属 | `default_marketplaces`、`[memory]`、`[marketplace]`、`[tools].domains`（`[tools]` 的 `enabled` / `disabled` 两边同构，域开关是本产品特有） | 无 `domains` 域开关 |

如果你的配置里已经有 Kimi Code 或其他工具的 `[providers]`、`[models]` 段落，可以**直接复制**它们到 `~/.agent-store/config.toml` 使用（前提是该供应商走 OpenAI/Anthropic 兼容协议）；不相关的段落（`thinking`、`permission`、`hooks` 等）保留与否都不影响 Agent Store 解析。
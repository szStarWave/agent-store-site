# 兼容性矩阵

这页回答三件事：**哪些平台能跑**、**哪些来源能装进来**、**装进来的东西能用到什么程度**。

## 平台

当前仅发布 **Windows x64** 构建；其余平台暂未提供，需按需立项后再开放。二进制在 [GitHub Releases](https://github.com/szStarWave/agent-store-site/releases) 按目标命名分发（当前为预览版，标为 pre-release）。

| 操作系统 | 架构 | 状态 |
| --- | --- | --- |
| Windows | x86_64 | 已发布 |
| macOS | Apple 芯片（aarch64） | 未提供 |
| macOS | Intel（x86_64） | 未提供 |
| Linux | x86_64 | 未提供 |
| Linux | aarch64 | 未提供 |

> 下载按钮会按你的系统识别平台：仅 Windows x64 提供直链，其余平台引导至 GitHub Releases 手动查看。

## 来源格式

| 来源 | 导入方式 | 可能得到的兼容性状态 |
| --- | --- | --- |
| CodeBuddy Plugin | Importer → PluginSnapshot | `compatible` / `compatible-with-adapter` / `manual-review` |
| WorkBuddy Skill | Importer → PluginSnapshot | `compatible`（附属脚本只导入、不执行） |
| WorkBuddy Connector | Importer → PluginSnapshot | `compatible-with-adapter`（MCP）；`manual-review`（CLI 连接器） |
| 未确认版权资源 | 标记 `pending-legal-review` | 不进入公开分发 |

### 兼容性状态的含义

状态说的是**它在本产品里当前能用到什么程度**，不是它在来源产品里的能力：

| 状态 | 含义 |
| --- | --- |
| `compatible` | 语义与形态都可直接使用 |
| `compatible-with-adapter` | 经适配层转换后可用（例：MCP 连接器经工具命名空间化接入） |
| `manual-review` | 需人工审查后才能启用（例：CLI 连接器、Hook、LSP） |
| `unsupported` | 当前明确不支持 |
| `pending-legal-review` | 版权 / 分发授权未确认，禁止进入公开市场与默认安装包 |

### 它其实是三个维度

界面上看到的那一个状态只是其中一维。导入报告同时记录三条独立事实，避免把「可以转换」误报成「已经能运行」：

| 维度 | 取值 | 回答的问题 |
| --- | --- | --- |
| `semantic_status` | 上面那张状态表 | 语义能不能保留 |
| `runtime_status` | `not-verified` → `adapter-verified` → `runtime-verified` → `release-eligible` | 适配器与运行时是否真的验证过 |
| `distribution_status` | `local-only` | 是否允许安装 / 分发 |

> 只有 `runtime-verified` 且通过发布门禁的组件才标记为可运行；`pending-legal-review` 始终覆盖分发状态。所以**「导入成功」不等于「可以运行」**——把状态拆成三维就是为了让这句话在报告里看得见。
>
> 拼写差异：目录面（`compatibility_status`）用连字符写法，导入报告的三维面用下划线写法——同一组值的两种拼法，不要当成两组状态。

## 连接器

连接器（MCP server）是**宿主持有连接与凭据、替调用方执行**的那一类组件。能力分两半，权限也分两半：

| 面 | 方法 | 需要宿主授权吗 |
| --- | --- | --- |
| **读面**（目录 / 状态 / 探测） | `connector/list`、`connector/get`、`connector/status`、`connector/test` | 不需要。`get` / `test` 会带上每个工具的参数 schema，先看清怎么调再调 |
| **调用面**（真正执行工具） | `connector/call` | **需要**。宿主的 `[connector_proxy]` 默认关闭；开启后**已启用的连接器即可调用**，`allow` / `deny` 是操作者的可选收窄与减法——见[配置文件](/zh-CN/docs/configuration) |

- **三种传输都支持**：stdio、Streamable HTTP 与旧式 SSE。
- **凭据不出宿主**：OAuth 走标准 PKCE Loopback，令牌进安全存储、调用时注入；`mcp.json` 声明里的 `env` / `headers` 用 `secret:NAME` 引用，取值只在启动子进程时填进内存。
- **调用方点不了名之外的东西**：只能点名一个**已注册**的连接器 id，不能指定 URL / 命令 / header——地址永远来自宿主自己的配置。

### 运行时状态

`connector/status` 的 `status` 只有这几个取值，判定顺序即下表顺序（`connector/list` 给的是同一份事实的**摘要视图**，两者可能不一致，见下）：

| 顺序 | 条件 | 状态 |
| --- | --- | --- |
| 1 | 连接器被停用 | `installed` |
| 2 | 最近一次探测失败 | `error` |
| 3 | 需要 OAuth 且尚未授权 | `authorization_required` |
| 4 | 最近一次探测成功 | `connected` |
| 5 | 其它（已启用、认证就绪，但还没探测成功过） | `configured` |

> **`connected` 需要两件事同时成立**：认证就绪**且**最近一次探测成功。缺一不算——「登录成功但调用不通」不会得到某个中间状态，它表现为 `configured`（探测没成功）或 `error`（探测失败）。
>
> 判断「能不能调」请以 `connector/status` 为准：`connector/list` 里的 `status` 是同一份事实的摘要视图，它不查 OAuth 的实时状态，所以在「已授权但上次探测未成功」的连接器上可能比 `connector/status` 更悲观。

## 非目标（V1）

云端执行、多租户、HA、完整 Marketplace 审核后台、签名更新体系、任意 Hook/bin 执行——均不在 V1 范围。

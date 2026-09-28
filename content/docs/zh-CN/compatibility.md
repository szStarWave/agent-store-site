# 兼容性矩阵

本文说明 Flowy Agent Store 的运行环境支持范围、资源导入来源规范以及资产兼容性状态评定体系。

## 平台

当前官方提供 **Windows x64** 预编译二进制构建；其他系统平台处于规划阶段。二进制构建通过 [GitHub Releases](https://github.com/szStarWave/agent-store-site/releases) 提供分发（当前预览版本标记为 pre-release）。

| 操作系统 | 架构 | 状态 |
| --- | --- | --- |
| Windows | x86_64 | 已发布 |
| macOS | Apple 芯片（aarch64） | 未提供 |
| macOS | Intel（x86_64） | 未提供 |
| Linux | x86_64 | 未提供 |
| Linux | aarch64 | 未提供 |

> 官网下载模块自动检测客户端操作系统；非 Windows x64 环境将重定向至 GitHub Releases 发布列表。

## 来源格式

| 来源 | 导入方式 | 可能得到的兼容性状态 |
| --- | --- | --- |
| CodeBuddy Plugin | Importer → PluginSnapshot | `compatible` / `compatible-with-adapter` / `manual-review` |
| WorkBuddy Skill | Importer → PluginSnapshot | `compatible`（附属脚本仅导入存储，不自动执行） |
| WorkBuddy Connector | Importer → PluginSnapshot | `compatible-with-adapter`（MCP）；`manual-review`（CLI 连接器） |
| 未确认版权资源 | 标记 `pending-legal-review` | 排除在公开分发之外 |

### 兼容性状态的含义

兼容性状态用于界定资产在当前产品中的可用程度与适配边界，而非其在原生宿主中的功能特性：

| 状态 | 含义 |
| --- | --- |
| `compatible` | 结构与语义完全原生支持 |
| `compatible-with-adapter` | 经适配层协议转换后可用（例如：MCP 连接器经工具命名空间注入后接入） |
| `manual-review` | 需人工安全审查后方可启用（例如：CLI 连接器、Hook、LSP 服务） |
| `unsupported` | 当前环境明确不受支持 |
| `pending-legal-review` | 资产版权或再分发授权尚未明确，禁止进入公开市场与默认安装包 |

### 它其实是三个维度

UI 界面所呈现的状态仅为单一综合视图。导入报告从三个独立维度进行评估，防止将模型层「可完成转换」误判为「具备实际运行能力」：

| 维度 | 取值 | 回答的问题 |
| --- | --- | --- |
| `semantic_status` | 上述兼容性状态枚举 | 资产语义能否在导入后完整保留 |
| `runtime_status` | `not-verified` → `adapter-verified` → `runtime-verified` → `release-eligible` | 适配层与核心运行时是否完成验证 |
| `distribution_status` | `local-only` | 是否允许安装与再分发 |

> 组件仅在满足 `runtime-verified` 且通过发布门禁的前提下才标记为可运行；`pending-legal-review` 具备最高优先级，将覆盖所有分发状态（即导入成功不代表具备执行条件）。注：目录接口使用连字符命名（如 `compatibility_status`），导入报告内部则使用下划线字段，两者映射同一状态枚举。

## 连接器

连接器（MCP Server）由本地宿主统一管理物理连接与敏感凭据，代调用方执行特定工具能力。其接口能力与权限控制严格划分为两套访问面：

| 面 | 方法 | 需要宿主授权吗 |
| --- | --- | --- |
| **读面**（目录 / 状态 / 探测） | `connector/list`、`connector/get`、`connector/status`、`connector/test` | 否。`connector/get` 与 `connector/test` 附带工具参数 JSON Schema，供调用方校验参数结构 |
| **调用面**（真正执行工具） | `connector/call` | **是**。宿主配置中的 `[connector_proxy]` 默认处于关闭状态；开启后已启用的连接器方可被调用，支持通过 `allow` / `deny` 名单执行细粒度权限过滤（详见 [配置文件](/zh-CN/docs/configuration)） |

- **传输协议支持**：支持 stdio、Streamable HTTP 以及标准 SSE 传输。
- **凭据隔离边界**：OAuth 流程遵循标准 PKCE Loopback 协议，访问令牌注入本地安全存储；`mcp.json` 中配置的 `env` 与 `headers` 采用 `secret:NAME` 格式引用，仅在子进程启动时动态注入运行时内存。
- **安全调用寻址**：调用方仅允许按已注册的连接器 ID 发起请求，禁止直接指定上游 URL、本地命令或请求头参数，通信目标严格以宿主配置为准。

### 运行时状态

`connector/status` 返回连接器的精确生命周期状态，系统严格按以下判定优先级顺序计算（`connector/list` 则返回轻量级摘要视图）：

| 顺序 | 条件 | 状态 |
| --- | --- | --- |
| 1 | 连接器已被禁用 | `installed` |
| 2 | 最近一次物理探测失败 | `error` |
| 3 | 声明了 OAuth 鉴权且尚未完成授权 | `authorization_required` |
| 4 | 最近一次物理探测成功 | `connected` |
| 5 | 其余状态（已启用且鉴权正常，但尚未完成有效探测） | `configured` |

> `connected` 状态的充要条件为：鉴权就绪且最近一次物理探测成功。若仅完成鉴权但通信异常，状态将标为 `configured`（未探测成功）或 `error`（探测失败）。
>
> 判断调用可用性应以 `connector/status` 为准；`connector/list` 中的状态为摘要视图，不进行实时 OAuth 鉴权检测。

## 非目标（V1）

云端托管执行、多租户隔离、高可用编排（HA）、市场审核管理后台、代码签名热更新体系以及任意非受控 Hook/可执行文件执行，均不在 V1 版本支持范围内。

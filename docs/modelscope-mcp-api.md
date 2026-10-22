# ModelScope MCP 广场开放接口规范

魔搭社区（ModelScope）MCP 广场对外通信接口技术说明。本文内容基于 2026-09-15 实际接口测试核验，记录真实协议行为与限制。

- **官方控制台页面**：<https://www.modelscope.cn/mcp>
- **OpenAPI 规范源**：<https://modelscope.cn/.well-known/openapi.json>（基于 OpenAPI 3.1.1 规范，包含 40 个路由，其中 5 个属于 MCP 域）
- **网关基址**：`https://modelscope.cn/openapi/v1`

## 1. 核心调研结论与协议特征

| 评估维度 | 核心结论与技术特征 |
| --- | --- |
| **前端抓取可行性** | 无法直接静态抓取。`/mcp` 采用 Umi 框架客户端渲染（SPA），初始 HTML 仅返回 `<div id="root"></div>`，核心列表依赖客户端异步请求。 |
| **开放接口存在性** | 完备开放。官方提供公开的 OpenAPI 规范，接口定义明确，无需进行逆向抓包。 |
| **鉴权机制** | 规范声明标记了 `bearerAuth`，但**实测公开列表与详情接口匿名即可正常请求（HTTP 200）**（详见 §3 与 §4）。 |
| **HTTP 请求谓词约束** | 列表检索接口强制使用 **`PUT`** 谓词，而非通用的 GET 或 POST（协议特殊性见 §3）。 |
| **全网资源总量** | 平台共收录 `total_count = 12449` 个服务（2026-09-15 实测读数）。 |
| **单次查询深度限制** | 受深度分页约束：`page_number * page_size <= 100`，单次线性遍历深度仅支持至第 100 条。 |

## 2. 接口清单

OpenAPI 规范中声明的 5 个 MCP 接口路由：

| HTTP 方法 | 请求路径 | 职能描述 | 鉴权约束 |
| --- | --- | --- | --- |
| `PUT` | `/mcp/servers` | 获取公共 MCP 服务列表（支持分类与关键词搜索） | 匿名可读 |
| `GET` | `/mcp/servers/{id}` | 获取指定 MCP 服务元数据及连接配置详情 | 匿名可读 |
| `GET` | `/mcp/servers/operational` | 查询当前登录用户托管的 MCP 服务实例 | 强制 Bearer Token |
| `POST` | `/mcp/servers/{id}/deploy` | 触发 MCP 服务部署并分配托管连接点 | 强制 Bearer Token |
| `DELETE` | `/mcp/servers/{id}/undeploy` | 卸载并释放已部署的 MCP 服务 | 强制 Bearer Token |

## 3. 列表检索接口 `PUT /mcp/servers`

```http
PUT https://modelscope.cn/openapi/v1/mcp/servers
Content-Type: application/json

{
  "search": "",
  "filter": { "category": "browser-automation", "is_hosted": true },
  "page_number": 1,
  "page_size": 20
}
```

### 请求参数契约

| 参数字段 | 数据类型 | 默认值 | 语义与约束说明 |
| --- | --- | --- | --- |
| `search` | string | — | 针对服务中文名、英文名、所有者账户执行模糊检索 |
| `filter.category` | string | — | 按类别过滤（例如 `communication`、`browser-automation`） |
| `filter.is_hosted` | boolean | — | 筛选是否支持云端托管部署能力 |
| `page_number` | integer | 1 | 查询页码，必须满足 `page_number * page_size <= 100` |
| `page_size` | integer | 20 | 分页大小，约束同上 |

> 规范文本中提及了 `tag` 维度，但 JSON Schema 仅正式声明了 `category` 与 `is_hosted`，传递 `tag` 的服务端过滤行为未经验证。

### 响应体结构

```jsonc
{
  "success": true,
  "request_id": "4266e730-...",
  "data": {
    "total_count": 12449,
    "mcp_server_list": [ /* McpServerSummary[] */ ]
  }
}
```

### 列表项字段规范 (`McpServerSummary`)

| 字段名称 | 类型 | 规格说明 |
| --- | --- | --- |
| `id` | string | 服务唯一标识符。平台预收录条目为 `@author/server_name`；社区认领后或用户自提交条目为 `user_name/server_name` |
| `publisher` | string | 发布者原始 ID 标识 |
| `name` | string | 社区展示名称 |
| `chinese_name` | string | 中文展示名称 |
| `description` | string | 简短描述文本（默认返回中文） |
| `tags` | string[] | 标签集合 |
| `categories` | string[] | 所属业务分类数组，例如 `["browser-automation"]` |
| `logo_url` | string | 服务图标 CDN 绝对 URL |
| `view_count` | integer | 页面累计曝光与浏览计数 |
| `locales.zh` / `locales.en` | object | 多语言本地化元数据（含 `name` 与 `description`；`readme` 仅在详情接口提供） |

响应实测数据样本：

```jsonc
{
  "id": "@modelcontextprotocol/fetch",
  "publisher": "@modelcontextprotocol/fetch",
  "name": "Fetch网页内容抓取",
  "chinese_name": "Fetch网页内容抓取",
  "description": "该服务器使大型语言模型能够检索和处理网页内容，将HTML转换为markdown格式…",
  "tags": [],
  "categories": ["browser-automation"],
  "logo_url": "https://resources.modelscope.cn/studio-cover-pre/…png",
  "view_count": 609330,
  "locales": {
    "zh": { "name": "Fetch网页内容抓取", "description": "…" },
    "en": { "name": "fetch", "description": "This server enables LLMs to retrieve…" }
  }
}
```

## 4. 服务详情接口 `GET /mcp/servers/{id}`

```http
GET https://modelscope.cn/openapi/v1/mcp/servers/{id}?get_operational_url=false
```

| 参数名称 | 位置 | 说明与默认值 |
| --- | --- | --- |
| `id` | path | 目标服务唯一标识符，例如 `@modelcontextprotocol/fetch` 或 `username/server-name` |
| `get_operational_url` | query | 布尔值，设为 `true` 时返回当前登录用户在魔搭平台已部署的托管连接地址（如 SSE 端点），默认为 `false` |

响应体 `data` 对象在列表项字段基础上增加以下属性：

| 属性字段 | 数据类型 | 职能描述 |
| --- | --- | --- |
| `author` | string | 服务核心开发者名称 |
| `owner` | string | 隶属的魔搭社区用户或企业组织 ID |
| `source_url` | string | 源码主页地址（通常为 GitHub 仓库绝对路径） |
| `github_stars` | integer | 上游代码仓库 Star 计数 |
| `readme` | string | 详细技术说明文档（完整 Markdown 格式） |
| `is_hosted` | boolean | 是否支持在线一键部署与托管 |
| `is_verified` | boolean | 是否通过官方安全与可用性验证 |
| `server_config` | array | 客户端连接所需的 MCP 配置对象结构（即标准 `mcpServers`） |
| `env_schema` | object | 服务连接或部署依赖的环境变量 JSON Schema |
| `operational_urls` | array | 托管服务连接实例列表（仅在 `get_operational_url=true` 且存在活动实例时有效） |

`server_config` 配置数据实测样例：

```jsonc
[{ "mcpServers": { "fetch": { "command": "uvx", "args": ["mcp-server-fetch"] } } }]
```

`operational_urls` 结构字段说明：

| 字段 | 含义说明 |
| --- | --- |
| `id` | 连接实例唯一命名标识 |
| `url` | 远程接入端点绝对 URL |
| `transport_type` | 底层通信传输协议（如 `sse` 或 `streamable_http`） |
| `auth_required` | 建立连接时是否强制要求魔搭鉴权令牌 |
| `expiration` | 当前连接凭据有效截止时间 |
| `accessible` | 当前访问主体是否具备连接权限 |

## 5. 部署管理相关接口

```http
GET    /mcp/servers/operational
POST   /mcp/servers/{id}/deploy
DELETE /mcp/servers/{id}/undeploy
```

`POST /mcp/servers/{id}/deploy` 请求载荷结构：

| 载荷字段 | 类型 | 说明与可选范围 |
| --- | --- | --- |
| `transport_type` | string | 支持 `sse` 或 `streamable_http` |
| `expiration_minutes` | integer | 实例生命周期（分钟），传 `-1` 代表长期持久运行 |
| `auth_check` | boolean | 访问远程连接 URL 时是否强制开启魔搭 Token 鉴权，默认为 `false` |
| `env_info` | object | 部署运行时环境变量键值对，结构遵循详情接口给出的 `env_schema` |

部署成功后返回生成的 `McpOperationalUrl` 对象。此类管理接口均需请求头携带用户认证令牌。

## 6. 异常响应结构与状态码

统一错误响应结构规范：

```jsonc
{
  "success": false,
  "code": "InvalidParameter",
  "message": "...",
  "request_id": "..."
}
```

各端点在 OpenAPI 规范中声明的 HTTP 状态码分布：
- 列表接口：`200`、`401`、`500`、`503`
- 详情接口：`200`、`401`、`404`、`500`、`503`
- 部署与卸载管理：`200`、`401`、`404`、`500`、`503`

## 7. 调试验证与复现脚本

```powershell
# 1. 列表接口调用（强制要求 PUT 谓词；请求 JSON 必须使用单引号，避免反斜杠转义引发解析异常）
curl.exe -s -X PUT "https://modelscope.cn/openapi/v1/mcp/servers" `
  -H "Content-Type: application/json" `
  -d '{"page_number":1,"page_size":3}'

# 2. 详情接口调用
curl.exe -s "https://modelscope.cn/openapi/v1/mcp/servers/@modelcontextprotocol/fetch"

# 3. 下载平台完整 OpenAPI 规范用于离线分析
curl.exe -s -o openapi.json "https://modelscope.cn/.well-known/openapi.json"
```

实测执行第一项检索指令正常返回 `success=true`、`total_count=12449`，首项条目为 `@modelcontextprotocol/fetch`。

## 8. 调用约束与边界限制

1. **深度遍历硬性限制**：由于限制 `page_number * page_size <= 100`，总量 12,449 条数据无法通过全量翻页拉取；必须通过 `search` 关键词或 `filter.category` 进行空间切片后再逐片检索。
2. **连接配置非列表返回**：`server_config`、`readme` 及 `env_schema` 属于详情级别专属字段；批量获取连接信息需依序发起详情请求。
3. **接口鉴权变更高危提示**：规范虽然正式声明了 `bearerAuth`，当前匿名可访问属于服务实现宽松现状；生产对接必须预留 `Authorization: Bearer <token>` 注入通道以防网关策略收紧。
4. **类别枚举未开放字典**：官方规范仅给出 `communication`、`browser-automation` 等示例，未公开标准分类字典，系统分类需从返回集 `categories` 动态聚合。

## 9. 与本站架构关系声明

本站市场源（`market-source/`）目前采用 WorkBuddy 连接器体系（基于 `.codebuddy-connector/connectors.json` 结合 `connectors/<slug>/` 文件树）。ModelScope MCP 广场属于异构数据源，在数据模型、参数结构及分发机制上完全独立，**当前站点尚未接入**。后续若计划整合魔搭生态，需设计独立的解析适配层与静态产物生成脚本，严禁与现有市场树逻辑混淆。

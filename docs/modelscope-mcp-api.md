# ModelScope MCP 广场开放接口

魔搭社区（ModelScope）MCP 广场的对外接口说明。本文所有内容均为 2026-09-15 实测所得，
不是根据页面推测。

- 页面：<https://www.modelscope.cn/mcp>
- 规范：<https://modelscope.cn/.well-known/openapi.json>（OpenAPI 3.1.1，共 40 个 path，其中 5 个属 MCP）
- 接口基址：`https://modelscope.cn/openapi/v1`

## 1. 先说结论

| 问题 | 结论 |
| --- | --- |
| 页面能否静态抓取 | 不能。`/mcp` 是 umi SPA，HTML 只有 `<div id="root"></div>`，列表靠 JS 异步加载 |
| 是否有公开接口 | 有。官方 OpenAPI 规范文件公开可下载，接口无需逆向 |
| 是否要登录 | 规范里标了 `bearerAuth`，但**实测列表与详情不带 token 也返回 200**（见 §3） |
| 调用方式 | 列表接口是 **`PUT`**，不是 GET/POST —— 这是最容易踩的坑 |
| 数据规模 | `total_count = 12449`（2026-09-15 实测） |
| 一次能取多少 | `page_number * page_size <= 100`，即单次查询最多只能翻到第 100 条 |

## 2. 接口清单

规范中共 5 个 MCP 接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `PUT` | `/mcp/servers` | 获取 MCP 服务列表（广场公开数据） |
| `GET` | `/mcp/servers/{id}` | 获取指定 MCP 服务详情 |
| `GET` | `/mcp/servers/operational` | 获取当前用户托管的 MCP 服务列表 |
| `POST` | `/mcp/servers/{id}/deploy` | 部署 MCP 服务 |
| `DELETE` | `/mcp/servers/{id}/undeploy` | 解除 MCP 服务部署 |

除列表接口外，其余都带 `401` 响应，即需要令牌。列表与详情实测匿名可读。

## 3. 列表接口

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

### 请求参数

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `search` | string | — | 按服务中文名、英文名、作者/所有者用户名搜索 |
| `filter.category` | string | — | 按分类筛选，例：`communication`、`browser-automation` |
| `filter.is_hosted` | boolean | — | 筛选是否支持托管部署 |
| `page_number` | integer | 1 | 页码，限制 `page_number * page_size <= 100` |
| `page_size` | integer | 20 | 每页条数，同上限制 |

> 规范描述提到 `tag`，但 schema 里实际只声明了 `category` 与 `is_hosted`，传 `tag` 的行为未验证。

### 响应

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

### `mcp_server_list` 元素字段（McpServerSummary）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 服务 ID。平台收录的为 `@author/server_name`，被社区认领后变 `user_name/server_name`；社区自提交的即 `user_name/server_name` |
| `publisher` | string | 发布时的原始 ID |
| `name` | string | 社区名称 |
| `chinese_name` | string | 中文名称 |
| `description` | string | 简介（默认中文） |
| `tags` | string[] | 标签列表 |
| `categories` | string[] | 所属分类，例：`["browser-automation"]` |
| `logo_url` | string | logo 图片地址 |
| `view_count` | integer | 累计访问量 |
| `locales.zh` / `locales.en` | object | 分语言的 `name` / `description`（`readme` 仅详情接口返回） |

实测返回样例：

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

## 4. 详情接口

```http
GET https://modelscope.cn/openapi/v1/mcp/servers/{id}?get_operational_url=false
```

| 参数 | 位置 | 说明 |
| --- | --- | --- |
| `id` | path | 服务 ID，形如 `@modelcontextprotocol/fetch` 或 `username/server-name` |
| `get_operational_url` | query | 传 `true` 时返回当前用户在魔搭托管的连接地址（如 SSE_URL），默认 `false` |

返回 `data` 在列表字段基础上增加（字段集为实测结果）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `author` | string | 服务开发者 |
| `owner` | string | 归属的魔搭用户/组织 ID |
| `source_url` | string | 来源项目主页（多为 GitHub 仓库） |
| `github_stars` | integer | 来源仓库 stars |
| `readme` | string | 服务介绍（Markdown） |
| `is_hosted` | boolean | 是否支持托管部署 |
| `is_verified` | boolean | 是否经平台验证测试 |
| `server_config` | array | MCP 连接配置，即 `mcpServers` 结构 |
| `env_schema` | object | 连接/部署所需环境变量的 JSON Schema |
| `operational_urls` | array | 托管连接列表，仅当 `get_operational_url=true` 且已连接时非空 |

`server_config` 实测形如：

```jsonc
[{ "mcpServers": { "fetch": { "command": "uvx", "args": ["mcp-server-fetch"] } } }]
```

`operational_urls` 元素（McpOperationalUrl）：

| 字段 | 说明 |
| --- | --- |
| `id` | 链接命名标识 |
| `url` | 远程连接地址 |
| `transport_type` | 传输方式 |
| `auth_required` | 连接时是否需要魔搭访问令牌 |
| `expiration` | 有效期 |
| `accessible` | 当前用户是否有权限访问 |

## 5. 部署相关接口

```http
GET    /mcp/servers/operational
POST   /mcp/servers/{id}/deploy
DELETE /mcp/servers/{id}/undeploy
```

`deploy` 请求体：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `transport_type` | string | `sse` 或 `streamable_http` |
| `expiration_minutes` | integer | 有效期（分钟），`-1` 为长期有效 |
| `auth_check` | boolean | 远程 URL 连接时是否需要魔搭访问令牌鉴权，默认 `false` |
| `env_info` | object | 环境变量，字段取自详情接口的 `env_schema` |

`deploy` 返回部署后的链接信息（`McpOperationalUrl`）。这三个接口都需要令牌。

## 6. 错误响应

```jsonc
{ "success": false, "code": "…", "message": "…", "request_id": "…" }
```

各接口声明的响应码：列表 `200 / 401 / 500 / 503`；详情 `200 / 401 / 404 / 500 / 503`；
部署与解除部署 `200 / 401 / 404 / 500 / 503`。

## 7. 复现命令

```powershell
# 列表（注意是 PUT；JSON 用单引号包裹，不要写成 {\"a\":1}，curl 不会反转义，
# 服务端会返回 InputParameterError: invalid request body）
curl.exe -s -X PUT "https://modelscope.cn/openapi/v1/mcp/servers" `
  -H "Content-Type: application/json" `
  -d '{"page_number":1,"page_size":3}'

# 详情
curl.exe -s "https://modelscope.cn/openapi/v1/mcp/servers/@modelcontextprotocol/fetch"

# 下载规范文件后本地检索 MCP 接口
curl.exe -s -o openapi.json "https://modelscope.cn/.well-known/openapi.json"
```

上面第一条实测返回 `success=true`、`total_count=12449`、首条 `@modelcontextprotocol/fetch`。

## 8. 使用限制

1. **分页封顶 100**：`page_number * page_size <= 100`。总量 12449，无法靠翻页遍历全量，
   只能按 `search` 或 `filter.category` 切片后再逐片翻页。
2. **列表不含连接配置**：`server_config`、`readme`、`env_schema` 只在详情接口返回，
   若需要逐条连接信息，等于要发 12449 次详情请求。
3. **鉴权可能收紧**：接口在规范中声明为 `bearerAuth`，当前匿名可读属于现状而非承诺；
   接入方应预留令牌配置（`Authorization: Bearer <token>`）。
4. **分类枚举未公开**：规范只给了 `communication`、`browser-automation` 两个示例，
   没有完整分类字典；实际取值需从返回数据里统计（`categories` 字段）。

## 9. 与本站的关系

本站市场（`market-source/`）镜像的是 WorkBuddy 连接器市场，格式为
`.codebuddy-connector/connectors.json` + `connectors/<slug>/`。ModelScope MCP 广场
是另一个数据源，字段与目录结构都不同，**当前未接入**。若将来要引入，需要新增独立的
同步脚本与目录，并处理上面第 8 节的限制——不要把它混进现有连接器市场的镜像流程。

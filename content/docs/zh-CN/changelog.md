# 变更日志

本文按版本时间线记录 `@flowy-agent-store/*` 各正式发布版本的更新内容，并作为**破坏性变更的权威公告面**。

发布记录元数据与具体升级迁移指引详见 [升级与迁移指引](/zh-CN/docs/upgrade)。

## 1. 本页范围

- **收录范围**：严格收录已发布至 npm 的软件包，包括 `@flowy-agent-store/protocol`、`client`、`sdk` 以及各平台运行时依赖包 `@flowy-agent-store/runtime-*`。
- **未发布特性界定**：开发中但未正式发布的增量改动归集于 [升级与迁移指引](/zh-CN/docs/upgrade) §8 及本文 §4。
- **发布事实原则**：仅记录已发生的版本事实，不预告未经发布的交付预期。
- **兼容性原则**：预发布阶段的破坏性变更随下一预发布版本发布，具体规范详见 [升级与迁移指引](/zh-CN/docs/upgrade) §1。

## 2. 已发布版本（事实）

版本发布记录查询命令：

```bash
npm view @flowy-agent-store/sdk versions dist-tags time --json
```

```json
{
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0-beta.5", "0.1.0-beta.6", "0.1.0-beta.7", "0.1.0-beta.8", "0.1.0-beta.9", "0.1.0-beta.10", "0.1.0-beta.11", "0.1.0-beta.12", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.12", "latest": "0.1.0-beta.2" },
  "time": {
    "0.1.0": "2026-09-09T09:09:04.795Z",
    "0.1.0-beta.2": "2026-09-09T09:27:36.122Z",
    "0.1.0-beta.3": "2026-09-10T04:44:34.609Z",
    "0.1.0-beta.4": "2026-09-16T10:24:02.588Z",
    "0.1.0-beta.5": "2026-09-17T11:41:10.171Z",
    "0.1.0-beta.6": "2026-09-18T11:08:21.813Z",
    "0.1.0-beta.7": "2026-09-20T10:33:48.685Z",
    "0.1.0-beta.8": "2026-09-28T10:23:47.656Z",
    "0.1.0-beta.9": "2026-10-10T04:34:35.842Z",
    "0.1.0-beta.10": "2026-10-12T07:31:25.974Z",
    "0.1.0-beta.11": "2026-10-14T11:18:29.844Z",
    "0.1.0-beta.12": "2026-10-22T08:27:59.013Z"
  }
}
```

> **更正（2026-10-14）**：上一版发布时把 `0.1.0-beta.10` 的发布时间写成了整点值 `2026-10-12T07:30:00.000Z`，注册表实际输出为 `2026-10-12T07:31:25.974Z`。本块与 [升级与迁移指引](/zh-CN/docs/upgrade) §2 的对应表行、本文 §2.3 标题均已按注册表改正：发布日期 `2026-10-12` 这一事实不变，其余版本的 `time` 与注册表逐字一致；`versions` 数组按版本先后排列以便阅读，成员与注册表相同。

| 版本 | 发布（UTC） | 变更类型 | 当前 dist-tag |
| --- | --- | --- | --- |
| `0.1.0-beta.12` | 2026-10-22 | 破坏性（协议指纹严格相等：`fp-16` → `fp-18`，**必须升级**） | `beta` |
| `0.1.0-beta.11` | 2026-10-14 | 破坏性（协议指纹严格相等：`fp-14` → `fp-16`，**必须升级**） | — |
| `0.1.0-beta.10` | 2026-10-12 | 破坏性（协议指纹严格相等：`fp-13` → `fp-14`，**必须升级**） | — |
| `0.1.0-beta.9` | 2026-10-10 | 破坏性（协议指纹严格相等：`fp-12` → `fp-13`，**必须升级**） | — |
| `0.1.0-beta.8` | 2026-09-28 | 破坏性（协议指纹严格相等：`fp-8` → `fp-12`，**必须升级**） | — |
| `0.1.0-beta.7` | 2026-09-20 | 破坏性（协议指纹严格相等：`fp-7` → `fp-8`） | — |
| `0.1.0-beta.6` | 2026-09-18 | 破坏性（SDK 入口改名 + 返回形状变更，**要改代码**） | — |
| `0.1.0-beta.5` | 2026-09-17 | 破坏性（协议指纹严格相等：`fp-1` → `fp-7`） | — |
| `0.1.0-beta.4` | 2026-09-16 | 破坏性（协议指纹严格相等 + 类型收窄） | — |
| `0.1.0-beta.3` | 2026-09-10 | 加法（无破坏性） | — |
| `0.1.0-beta.2` | 2026-09-09 | 加法（无破坏性） | `latest` |
| `0.1.0` | 2026-09-09 | 首次发布 | 无 |

### 2.1 `0.1.0-beta.12` — 2026-10-22T08:27:59Z

> **本版含破坏性变更**：协议指纹由 `fp-16` 递增至 `fp-18`（一次发布跨过两级），客户端与运行时需保持版本对齐（迁移步骤见 [升级与迁移指引](/zh-CN/docs/upgrade) §6.11）。

#### 破坏性

- **协议契约指纹更新**：`fp-16` $\to$ **`fp-18`**。`fp-17` 把 `ConnectorSummary.auth_mode` 更名为 `auth_transport`（取值仍是 `none` / `oauth`，旧字段**直接消失、无过渡双写**），并把「是否显示授权入口」的判断改由 `credential.mode` + `credential.status` 决定，不再从 transport 形状反推；`fp-18` 给四类实体补多语言展示字段。两次都没有增删方法，协议方法总数与 HTTP 路由映射数保持 **83 / 56**。握手仍是严格相等校验：SDK 与宿主必须同批升级。
- **`AgentDetail` 的两个字段上移**：`display_description` 与 `quick_prompts` 从专家详情面移到专家列表行（与上一版 `tags` / `category_id` 同型）。`AgentDetail` 继承 `AgentSummary`，读 `detail.display_description` 照旧可用；手写 `AgentDetail` 字面量喂 mock 的代码需要把这两个键挪到 summary 层。

#### 新增

- **四类实体的多语言展示字段（`fp-18`）**：`AgentSummary` / `TeamSummary` / `SkillSummary` / `ConnectorSummary` 各带 `display_name` / `display_description` / `tags` / `quick_prompts` 四个**可选**字段，`list` 与 `get` 两面取值一致。数据在条目导入期按「作者声明 → 市场索引行 → 缺席」逐语种合并后固化进快照，读面不产生额外请求；连接器首次拥有这四个字段，其 `name` 仍是运行期标识，展示名单独走 `display_name`。
- **团队包的兄弟键解析**：`plugin.json` 的 `description_zh` / `description_en` 现在会被读取（团队市场 30 个包里 18 个用这种写法）；团队条目的 `tags` / `category_id` / 展示字段此前从未被写入 payload，本版一并补齐。
- **目录检索与使用提示**（不换指纹）：`store.search` 改为多词 AND + 三档相关性排序，新增 `store.searchWithHits` / `store.searchInstalled` / `store.listStatus`；技能与连接器条目的索引行 `examples_*` 进入 `StoreItem.quick_prompts`。

#### 已知边界（如实登记）

- **老快照不会自己长出新字段**：`fp-18` 之前安装的条目需要 `store.update()` 或重装才会形成带展示字段的快照，四个字段必须按可选读。
- **单语 `description` 不可当作某语种文案**：连接器索引行顶层 `description` 的语言不可靠（283 行里 210 行是英文），双语文案只从 `display_description` 取。
- **`market/get` 仍返回裸 `_zh` / `_en` 变体**：本版没有把它改成结构化对象，协议侧的 `pickVariantText` / `pickEntryText` 继续适用。
### 2.2 `0.1.0-beta.11` — 2026-10-14T11:18:29Z

> **本版含破坏性变更**：协议指纹由 `fp-14` 递增至 `fp-16`（一次发布跨过两级），客户端与运行时需保持版本对齐（迁移步骤见 [升级与迁移指引](/zh-CN/docs/upgrade) §6.10）。

#### 破坏性

- **协议契约指纹更新**：`fp-14` $\to$ **`fp-16`**。`fp-15` 新增 `store/categories` 用于读取市场的分类字典与标签词表（HTTP `GET /api/app-server/store/categories`），协议方法总数由 82 扩充至 **83**、HTTP 路由映射数由 55 扩充至 **56**；`fp-16` 不增删任何方法，计数保持 83 / 56，只在既有响应里补字段（因此没有方法签名破坏）。握手仍执行严格相等校验：SDK 与宿主必须同批升级。
- **`AgentDetail` 的两个字段上移到 `AgentSummary`**：`tags` 与 `category_id` 从专家详情面移到专家列表行。扁平化的 JSON 无法让同一个键同时出现在 summary 与 detail 里，所以读取口统一到 summary；`AgentDetail` 继承 `AgentSummary`，此前读 `detail.tags` 的调用方不受影响。

#### 新增

- **市场分类与标签透出（`fp-15`）**：新增 `store/categories` 协议方法与客户端 `store.categories()`（`AppServerClient` 面为 `listStoreCategories()`），返回所有**已启用**市场的分类字典（`items: StoreCategory[]`，含 `id` / 双语 `name` / 可选 `description`）与市场级标签词表 `marketplace_tags`（按位配对的双语数组）；`StoreItem` 新增 `category_id`（源 `plugin.json` 的裸引用，如 `04-DataAI`）与 `category`（宿主用字典解析出的双语名，**id 未命中字典时缺席，宿主不做推断**）；`AgentSummary` 携带本地化的 `tags` 与 `category_id`。字典的解析顺序为「市场自己声明的 `categories[]` 优先，未声明时用宿主内置的 15 类兜底表」；冷启动（此前未调用过 `store/list`）也返回完整的市场标签词表，且市场根集合按**当前启用**的市场整体替换。
- **剩余展示面补齐（`fp-16`）**：`TeamSummary` 新增 `tags` / `category_id`，`SkillSummary` 新增 `tags`；`ExpertPack` 升至 `pack_format 3` 并携带 `tags` / `category_id`——顶层包取该包自身的声明，**每个成员包取该成员自己的值**（作用域与快照级的 `assets` 相反）。
- **技能标签的来源固定为市场索引行**：技能不带 `plugin.json`，其标签在导入时取自市场索引行并随快照固化，之后按与图标相同的溯源链读回；市场事后修改标签，需升级该条目才生效——与技能内容本身的口径一致。

#### 已知边界（如实登记）

- **导出包只携带裸 `category_id`**：将其解析为名称需要一份等价字典。宿主通过 `store.categories()` 提供该字典，但它**不跨宿主通用**。
- **技能没有分类**：技能市场只声明扁平标签，因此 `SkillSummary` 只有 `tags`，没有 `category_id`。
- **连接器没有标签来源**：当前市场数据里不存在连接器标签字段，因此连接器条目的标签恒为缺席。

### 2.3 `0.1.0-beta.10` — 2026-10-12T07:31:25Z

> **本版含破坏性变更**：协议指纹由 `fp-13` 递增至 `fp-14`，客户端与运行时需保持版本对齐（迁移步骤见 [升级与迁移指引](/zh-CN/docs/upgrade) §6.9）。

#### 破坏性

- **协议契约指纹更新**：`fp-13` $\to$ **`fp-14`**。新增两个 **WebSocket-only** 方法 `import/assets`（列出不可变快照的插件级资产清单）与 `import/asset`（获取单文件 base64 字节流，与 `skill/file` 同形）。协议方法总数由 80 扩充至 **82**，HTTP 路由映射数保持 **55**（两个新方法均不带 HTTP 绑定）。握手执行严格相等校验：客户端与宿主版本不一致时将被直接拒绝，SDK 与宿主必须同步升级。握手能力位新增 `snapshot_assets`。

#### 新增

- **专家 / 专家团导出补齐插件级资产**：`ExpertPack` 升至 `pack_format 2`，新增 `assets`（插件级 `avatars/`、`bin/`、`scripts/` 的按引用清单：`path` / `kind: "avatar" | "script"` / `size` / sha256 `digest`，按 `path` 排序）与 `avatar`（包级头像在快照中的相对路径，仅当该文件存在于 `assets` 时提供）。`materializePack` 将资产按快照相对路径物化落盘，`ExportResult` 新增 `writtenAssets`。导出目录由此具备**完整的插件根目录结构**：团队私有脚本通过 `PLUGIN_ROOT/bin/init_task.py` 与 `../../../avatars` 进行的寻址均正常解析。资产受快照作用域限定：成员 pack 的 `assets` 始终为空列表，统一读取顶层 pack。
- **宿主运营者能力裁剪**：`[expert_export]` 新增 `scripts` 配置项（缺省为 `true`，遵循 fail-open 原则）；设为 `false` 时导出的包 `assets` 将移除 `kind: "script"` 条目（头像不受影响）。该配置作用于**包级契约**：`import/asset` 与 `import/get` 维持同等权限，且 `skill/files` 不受该配置限制。
- **未关联技能状态收录（规范声明）**：成员 frontmatter 中的 `skills:` 声明在源运行时（WorkBuddy / CodeBuddy）中无执行机制，本系统与源逻辑对齐；导出时未关联的声明将如实记录于 `danglingSkills`（不静默处理，不中断流程），官方团队包级技能保证完整可用。

#### 修复

- **优化连接器 OAuth 授权回调状态反馈**：此前回调在收到 code 时即返回 "Authorization successful!"，而 token 交换在此后异步执行，导致网关限流（`slow_down`）失败时前端误判为成功并提前关闭窗口。现调整为在完成 token 交换后才向浏览器返回结果页面（成功页，或含脱敏原因的“未完成”页）；对被拒绝的回调（CSRF 失败、路径不匹配、参数缺失、无待处理登录）亦分别返回明确提示页。
- **`connector/auth/status` 新增 `authorization_pending` 状态**：浏览器授权流程进行中时如实上报该状态（此前在协议层无法区分“等待用户操作”与“从未发起”）。该状态优先级高于已存凭据，并在授权流程结束时自动清除。无字段、方法与事件变更，不触发协议指纹递增。
- **Web UI 安装商店条目对齐 `store.install()`**：此前直接调用裸动词 `store/install-entry`，绕过了“连接器注册后默认处于 disabled，就绪检查需先 enable 再发起探针”的处理流程，导致商店页安装的连接器停留在已禁用状态。现两个安装入口（商店页、市场管理）均统一接入该状态机。
- **`store.findByConnector(connectorId)` 反查支持**：支持按连接器的 `id` 或运行时 `name` 反查安装该连接器的 `StoreItem`（例如：条目 `fenbi-baokao-decision` 安装的 server 名为 `fenbi_mcp`，此前 `search()` 无法反查）；`StoreOperationOutcome` 新增 `installedCount` 字段。
- **`MCP_OAUTH_CLIENT_NAME` 动态客户端标识**：动态客户端注册时上报宿主名称（环境变量优先，默认 `Nomifun MCP Client`，空值视为未设置），支持私有化部署在无需修改二进制的情况下在服务商授权页展示自定义品牌；仅对当前宿主自主注册的 client 生效，既有注册保持原名。

### 2.4 `0.1.0-beta.9` — 2026-10-10T04:34:35Z

> **本版含破坏性变更**：协议指纹由 `fp-12` 递增至 `fp-13`，客户端与运行时需保持版本对齐（迁移步骤见 [升级与迁移指引](/zh-CN/docs/upgrade) §6.8）。

#### 破坏性

- **协议契约指纹更新**：`fp-12` $\to$ **`fp-13`**。新增两个同面方法 `market/settings`（读取市场源策略）与 `market/settings-set`（持久化写入 `config.toml`）。协议方法总数由 78 扩充至 **80**，HTTP 路由映射数由 53 扩充至 **55**。本次无 TypeScript 方法签名破坏性变更，调用方代码保持兼容。

#### 新增

- **市场源下载策略支持按源配置**：`[default_marketplaces.<id>]` 新增 per-source `download_on_start` 字段（默认 `true`，保持启动时即下载的语义；设为 `false` 时仅注册记录，归档留待显式刷新）；支持通过环境变量 `AGENT_STORE_MARKET_DOWNLOAD=eager|lazy|none` 覆盖全局行为（`none` 时不执行注册）；通过 `AGENT_STORE_CONFIG=<path>` 支持将宿主指向自定义配置文件（使 SDK 调用者可使用 per-source 配置）。
- **市场策略支持运行期读写**：新增 `market/settings` 与 `market/settings-set` 接口（HTTP `GET` / `POST /api/app-server/market-settings`），单一真源为 `~/.agent-store/config.toml`。写操作仅更新指定键并在回读文件确认后响应，保存即生效无需重启；自动校验并拒绝未知条目类型、超范围周期、空补丁与白名单外字段。TS 客户端配套提供 `getMarketSettings()` 与 `setMarketSettings()`，SDK `SpawnOptions` 新增 `marketDownload` 与 `configPath`。
- **受控自动升级**：市场级 `auto_update` 语义从“仅刷新索引”扩展为“刷新索引并自动升级从该市场安装的条目”，默认白名单为 `["agent","team","skill"]`；**连接器绝不隐式自动升级**（避免配置变更后触发 `upsert_server` 导致服务静默停用）。手动停用、带 `blocked_reason` 以及仅导入未安装的条目一律跳过；设为 `entry_auto_update_kinds = []` 即可恢复为仅刷新索引行为。调度器改为 60 秒轮询到期判定，支持运行时热更新周期；`market/settings` 响应中附带纯内存维护的 `last_sweep { at, refreshed, upgraded, failed[] }` 状态。
- **设置页市场策略卡片**：Web UI「设置 $\to$ 市场源」新增宿主级策略卡片（包含扫掠周期、可升级条目类型多选、连接器排除提示、上次扫掠读数与失败明细），双语支持齐备。

#### 修复

- **`exportTeam()` 导出团队自身包级技能**：修复团队 `ExpertPack` 顶层 `skills` 此前硬编码为空数组的缺陷（此前仅读取成员 Agent frontmatter 声明，导致包级声明但成员未声明的团队导出后丢失技能）。现调整为读取该团队快照已安装的技能组件，并与成员声明合并去重后物化至 `skills/<name>/...`。协议与类型无形态变更（详见 [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk) §4.4）。

### 2.5 `0.1.0-beta.8` — 2026-09-28T10:23:47Z

> **本版含破坏性变更**：协议指纹由 `fp-8` 递增至 `fp-12`，客户端与运行时需保持版本对齐（迁移步骤见 [升级与迁移指引](/zh-CN/docs/upgrade) §6.7）。

#### 破坏性

- **协议契约指纹更新**：`fp-8` $\to$ **`fp-12`**。本次跨越四个指纹（`fp-9` 至 `fp-12`）：连接器凭据读面、凭据表单文案归位、`connector/register` 与 `store/update-entry`。协议方法总数由 73 扩充至 **78**，HTTP 路由映射数由 48 扩充至 **53**。
- **TS 客户端签名变更**：`StoreClient.updateHint()` 返回值由 `"uninstall_reinstall"` 更新为 `"update"`，依赖该返回值的调用方需同步调整；`StoreOperationOutcome` 新增 `errors` 与 `warnings` 字段（保持向后兼容）。

#### 新增

- **连接器用户凭据体系**：连接器元数据增加 `credential` 配置块与 `token-schema.json` 声明支持；新增 `connector/credential/{get,set,clear}` 凭据管理接口（值单向写入，回包仅含键名与缺项）与 `connector/register` 私有 MCP 服务注册（以模板方式声明：`transport` 中的 `${secret:NAME}` 即作为凭据项）；凭据按调用方（Principal）隔离，历史宿主级密钥归属于安装所有者。
- **商店条目原地安全更新**：新增 `store/update-entry` 协议动词，提供原子升级语义——新版本安装验证成功后方释放旧版本；升级失败时保留旧版本并回滚新快照。专家预设原地升级并保留预设 ID，连接器复用同一 `mcp_servers` 记录，技能按快照各自隔离目录且解析时取最新版本。客户端配套提供 `store.update()`。
- **SDK 资源物化助手**：`@flowy-agent-store/sdk` 提供 `exportAgent`、`exportTeam` 与 `materializePack`，将资产定义与引用技能规范化物化至本地目录（`members/<id>/persona.md` 与去重后的 `skills/<name>/...`）。

#### 修复

- **修复技能与连接器条目版本固化问题**：此前因导入侧未读取市场索引导致版本被固定在占位符 `1.0.0`，进而引发重复提示更新及快照 digest 冲突。现条目版本随导入请求持久化落库。
- **安装状态限定快照作用域**：避免跨快照组件 ID 冲突导致释放旧版本时误清理新版本的安装记录，写入操作收窄为 `(snapshot_id, component_id)` 联合键。
- **过滤连接器配置中的空 `values`**：避免空配置写入后被误判为配置变更导致连接器服务异常停用。

### 2.6 `0.1.0-beta.7` — 2026-09-20T10:33:48Z

> **本版含破坏性变更**：协议指纹更新为 `fp-8`，客户端与运行时需保持版本对齐（迁移步骤见 [升级与迁移指引](/zh-CN/docs/upgrade) §6.6）。

#### 破坏性

- **协议契约指纹更新**：`fp-7` $\to$ **`fp-8`**。新增两个 WebSocket 专用方法 `agent/export` 与 `team/export`，协议方法总数由 71 扩充至 **73**，HTTP 路由映射数保持 48 不变。

#### 新增

- **专家与团队资产导出**：引入 `agent/export` 与 `team/export` 协议接口，返回包含角色指令、模型配置及依赖引用的标准化 `ExpertPack` 结构；客户端增加 `agents.export()` 与 `teams.export()` 封装。
- **宿主记忆总开关**：配置文件 `~/.agent-store/config.toml` 中 `[memory]` 配置块新增 `enabled` 布尔开关（默认开启），支持全局停用本地文件记忆子系统。

#### 修复

- **模型输出上限映射修复**：修复 `[models.*]` 中的 `max_output_size` 与 `protocol` 在部分供应商中未正确生效的缺陷，采用非覆盖式写入填补数据库空值。

### 2.7 `0.1.0-beta.6` — 2026-09-18T11:08:21Z

> **本版含破坏性变更**：`@flowy-agent-store/sdk` 入口重命名与返回对象扁平化（迁移步骤见 [升级与迁移指引](/zh-CN/docs/upgrade) §6.5）。

#### 破坏性

- `launchClient` 重命名为 **`launchHarness`**，对应类型更新为 `Harness` 与 `HarnessOptions`。
- 移除返回对象的 `.client` 嵌套层级，各业务子客户端直接挂载于根实例上。
- `initializeResult` 重命名为 **`handshake`**。
- `close()` 增强为统一安全清理：退订事件通道、关闭底层传输、终止子进程并清理自动生成的临时数据目录。

### 2.8 `0.1.0-beta.5` — 2026-09-17T11:41:10Z

> **本版含破坏性变更**：协议指纹更新至 `fp-7`，旧版客户端与新版运行时互不兼容。

#### 破坏性

- 协议指纹更新为 `fp-7`，执行严格全等校验。
- `[connector_proxy]` 策略配置调整：`allow` 调整为可选白名单，未显式声明时默认允许调用所有已启用连接器。

#### 新增

- **连接器 Schema 暴露**：工具信息模型新增 `input_schema` 与 `tools_truncated` 字段。
- **按轮挂载技能**：`conversation/send` 支持通过 `mentions` 按轮挂载技能。
- **特定专家与团队会话**：`conversation/create` 新增 `agent_id` 与 `team_id` 参数。
- **动态模型参数指定**：支持在发送消息及启动运行实例时覆盖 `model` 与 `reasoning_effort`。
- **Zip 归档市场源**：支持通过单 Zip 归档分发与消费市场资源。

#### 优化

- `mentions` 传入非技能组件时返回 `invalid_request`，不再静默忽略。

#### 修复

- 修复 `source_kind = "zip"` 市场源在特定配置解析时被意外过滤的问题。

### 2.9 `0.1.0-beta.4` — 2026-09-16T10:24:02Z

> **本版含破坏性变更**：协议指纹更新为 `fp-1`；`event_type` 收窄为封闭联合类型。

#### 破坏性

- 协议版本引入 `fp-<n>` 单调计数指纹规范（本版为 `fp-1`）。
- `ConversationEvent.event_type` 收窄为封闭枚举联合 `ConversationEventType`。

#### 新增

- 新增 `run/plan`、`config/get`、`config/set`、`config/get-mcp`、`config/set-mcp` 及 `run/answer-decision` 等协议接口。
- 新增技能文件系统读取接口 `skill/files` 与 `skill/file`。
- 新增连接器工具代理调用接口 `connector/call`。
- 新增会话列表变更事件 `conversation/list-changed`。
- 提供 `decodeConversationEvent` 结构化事件解码器。

#### 优化

- HTTP 路由表映射数扩充至 48。

### 2.10 `0.1.0-beta.3` — 2026-09-10T04:44:34Z

#### 新增

- 客户端导出 `TransportLifecycle`、`onLifecycle` 及订阅重置 `rearm()` 方法。
- SDK 增加子进程退出监听与环境参数覆盖能力。

#### 优化

- 补充软件包 `package.json` 中的 `engines.node >= 22` 与代码仓库元数据。

### 2.11 `0.1.0-beta.2` — 2026-09-09T09:27:36Z

#### 新增

- SDK 声明平台运行时可选依赖（覆盖 darwin、linux、win32 平台）。

#### 修复

- 修复 `0.1.0` 缺少平台依赖导致可执行文件定位失败的问题。

### 2.12 `0.1.0` — 2026-09-09T09:09:04Z

#### 新增

- 核心软件包首次发布。

## 3. 变更类型与破坏性变更的公告规则（D10=A）

| 变更类型 | 版本号 | 本页动作 |
| --- | --- | --- |
| 首次发布 | 该版本号本身 | 追加条目，含「新增」组 |
| 加法（新增声明、新增依赖、元数据） | patch / 预发布序号 | 追加条目，按内容归入「新增 / 优化 / 修复」 |
| 破坏性（类型收窄、方法增删、事件面调整） | beta 线内：**下一个预发布序号**；退出 beta 后：**minor 号** | 追加条目，含「破坏性」组并给出迁移做法 |

## 4. 未发布的变更与发布节奏

**已落地但未发布**：当前没有 —— 本页 §2.1 已收编此前三个待发布批次。

| 批次 | 内容 | 线协议 | 指针 |
| --- | --- | --- | --- |
| 四类实体多语言展示字段 | 四类实体摘要模型（`AgentSummary` / `TeamSummary` / `SkillSummary` / `ConnectorSummary`）统一扩展可选展示字段：`display_name`、`display_description`、`tags`、`quick_prompts`；`agent.get` 对应字段提升至摘要层（保持 JSON 兼容）；连接器首次补齐展示字段。导入期按「作者声明 → 市场索引」逐语种合并并持久化至快照，读取时零额外查询 | `fp-17` → **`fp-18`** | [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk) §3.3「应用面实体的展示字段」 |

当前通过 `beta` dist-tag 发布的版本为 `0.1.0-beta.12`（对应线协议 `fp-18`）。未收录于本页的版本特性不应假定为已生效。

## 5. 另见

- [升级与迁移指引](/zh-CN/docs/upgrade)：发布元数据、标签规范与版本迁移指南。
- [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk)：接口声明与错误模型。
- [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk)：各场景实战代码范式。
- [快速开始](/zh-CN/docs/quick-start)：单文件运行时启动指南。

# 三个市场：清单位置、内容基准与字段

写市场数据之前对照本文。这是**摘要**，权威定义在 `scripts/sync-market-data.mjs`（快照字段
与回落）和 `scripts/sync-market-tree.mjs`（清单与门禁）；完整说明见
`docs/market-maintenance.md` 第 2、5 节。

## 三个市场的差异（最容易踩的一处）

| 市场 | 清单 | 条目键 | `source` 相对谁解析 | `source` 形态 |
| --- | --- | --- | --- | --- |
| 专家 | `.codebuddy-plugin/marketplace.json` | `plugins` | 市场根 | `./plugins/<name>` |
| 技能 | `.codebuddy-skill/marketplace.json` | `skills` | `<市场>/skills/` | 裸 slug |
| 连接器 | `.codebuddy-connector/connectors.json` | `connectors` | `<市场>/connectors/` | 裸 slug |

`source` 用错基准，门禁会报 `ships no payload` 或 `escapes the market`。

## 目录结构

```text
experts/
├── .codebuddy-plugin/marketplace.json      清单
├── plugins/<name>/
│   ├── .codebuddy-plugin/plugin.json       该专家的本地化文案
│   ├── agents/*.md
│   ├── avatars/expert.png                  卡片图标（可选）
│   └── skills/…                            该专家内置的技能
└── _files.txt                              镜像清单（生成物，勿手改）

skills/
├── .codebuddy-skill/marketplace.json
├── skills/<slug>/SKILL.md                  技能内容
├── icons/<slug>.<ext>                      图标必须在市场根，不在条目目录里
└── _files.txt

connectors/
├── .codebuddy-connector/connectors.json
├── connectors/<slug>/                      mcp.json / cli.json / token-schema.json …
├── icons/<slug>.<ext>
└── _files.txt
```

注意专家内置技能里出现的 `.codebuddy/`：例如
`plugins/<name>/skills/fbs-bookwriter/.codebuddy/{agents,providers}/*.md`。它是上游的合法载荷，
要随树一起交付。因此 `.gitignore` 里那条忽略规则必须锚到仓库根（`/.codebuddy/`）——写成
不带锚点的 `.codebuddy/` 会命中这里，把这些文件挡在提交之外，而清单仍在收录它们
（判据 `listing.undeliverable`，见 `references/checks-and-collaboration.md`）。

图标命名规则：`icons/<source 的 basename>.<ext>`，扩展名依次探测
`png → svg → jpg → jpeg → webp → gif`。专家则探测条目目录内
`avatars/expert.png` → `avatars/avatar.png` → `avatar.png` → `icon.png`，
建议只放第一种。都没有时页面渲染字母徽标（`market-avatar-fallback`），底色由名称哈希决定。

## 影响显示的字段

### 专家 / 专家团

`plugins/<name>/.codebuddy-plugin/plugin.json`，值都是 `{ "zh": …, "en": … }` 对：

| 字段 | 作用 | 缺失时 |
| --- | --- | --- |
| `profession` | 卡片标题（角色名） | 回落清单 `name`，即显示成插件 id |
| `displayDescription` | 卡片简介 | 回落清单 `description`（通常只有英文，中文站就会显示英文） |
| `tags` | 卡片标签，最多取 5 个 | 无标签行 |
| `displayName` | 人格昵称（如「吴八哥」），**本站不读** | — |

专家团与专家同市场、同结构，区别在 `plugin.json` 有 `expertType: "team"`、`agentName`、
`teamInfo`、`members`。注意：**团队层级同样要有 `profession` / `displayDescription`**，
否则标题会回落成插件 id（`frontend-backend-experts`、`software-company` 就是这种状态）。

清单条目：`{ "name": "<插件 id>", "source": "./plugins/<name>", "description": "<英文兜底简介>" }`。

### 技能

| 字段 | 作用 | 缺失时 |
| --- | --- | --- |
| `source` | 定位 `skills/<slug>/` | 门禁报错 |
| `name` | 卡片标题 | — |
| `version` | 标题旁的 `v…` | 不显示版本 |
| `description_zh` / `description_en` | 卡片简介 | 回落 `description` |
| `tags_zh` / `tags_en` | 卡片标签，最多 5 个 | 无标签行 |

**技能清单没有 `name_en`**，所以英文站的技能标题仍是中文名。这是上游数据限制，
不要在站点侧造一个英文名。

### 连接器

| 字段 | 作用 | 缺失时 |
| --- | --- | --- |
| `id` | 条目唯一标识 | 回落 `name` |
| `name` | 中文名 | 回落 `id` |
| `name_en` | 英文名 | 英文站回落中文名 |
| `description_zh` / `description_en` | 简介 | 回落 `description` |
| `source` | 定位 `connectors/<slug>/`，同时决定图标文件名 | 门禁报错 |

**本站不读**的字段：`type`、`auth_mode`、`minWorkbuddyVersion`、`visible_in`、`provider_id`、
`version`、`examples_*`。目录页不做可见性、客户端版本或鉴权方式的过滤与展示，所有条目
一视同仁地列出。

## 快照字段映射（`content/market.json`）

| 快照字段 | 来源 | 缺失时 |
| --- | --- | --- |
| `updatedAt` | 每次 `sync:market` 的当前时间 | — |
| `base` | 固定 `"source"` | — |
| 专家 `name` / `name_en` | `plugin.json` 的 `profession.zh` / `.en` | 回落清单 `name`（插件 id） |
| 专家 `description_zh` / `_en` | `displayDescription.zh` / `.en` | 回落清单 `description` |
| 专家 `tags_zh` / `_en` | `tags[{zh,en}]`，取前 5 | 空数组 |
| 专家 `avatar` | 插件目录内四个候选文件 | `null` |
| 技能 `name` / `version` / `source` | 清单同名字段 | — |
| 技能 `description_zh` / `_en` | 清单同名字段 | 回落 `description` |
| 技能 `tags_zh` / `_en` | 清单同名字段 | 空数组 |
| 技能 `avatar` | 市场根 `icons/<slug>.<ext>` | `null` |
| 连接器 `id` / `name` / `name_en` | 清单同名字段 | `id` 回落 `name`，`name` 回落 `id` |
| 连接器 `description_zh` / `_en` | 清单同名字段 | 回落 `description` |
| 连接器 `avatar` | 市场根 `icons/<slug>.<ext>` | `null` |

## 页面读取规则（`app/lib/market.ts`）

- `entryName`：当前语言是 `en-US` 且条目有 `name_en` 时用 `name_en`，否则用 `name`
- `entryDescription`：取当前语言的 `description_*`，一侧为空时回落另一侧
- `entryTags`：只有带 `tags_zh` 的条目有标签（专家与技能；连接器没有）
- `avatar` 为 `null` 时渲染字母徽标

结论：**上游缺字段不会报错，只会显示成回落值**。想让卡片显示正确，只能去上游补字段。

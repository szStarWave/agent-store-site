# 连接器覆盖现状

对照「超级小爱灵感广场 · MCP」列出的 16 项能力，核对两个数据源的收录与支持情况：

| 数据源 | 说明 |
| --- | --- |
| WorkBuddy 连接器市场 | 本站市场页展示的数据，来自 `content/market.json`（由 `market-source/` 快照生成） |
| ModelScope MCP 广场 | 魔搭社区公开接口，接口细节见 [`modelscope-mcp-api.md`](./modelscope-mcp-api.md) |

- 核对时间：2026-09-15
- WorkBuddy 快照版本：`updatedAt = 2026-09-15T03:27:59Z`，同步提交 `332ad34`
- ModelScope 侧：`total_count = 12449`（同一时间实测）

## 1. 结论

16 项里**只有 6 项有厂商发布版本**，5 项仅社区第三方，5 项两个来源都查无。

| 支持程度 | 数量 | 条目 |
| --- | --- | --- |
| 厂商发布，可对接 | 6 | 飞常准、东方财富妙想、百度地图、快递100、高德地图、航班管家 |
| 仅社区第三方（质量不可控） | 5 | 同程搜索、携程旅行-机票、携程旅行-火车票、携程旅行-酒店、京东金融 |
| 两个来源均查无 | 5 | T3出行、喜马拉雅、小米商城、哈啰出行、闲鱼 |

两个来源**交叉互补**，同时收录的只有飞常准：

| | 条目 |
| --- | --- |
| 两边都有厂商版本 | 飞常准 |
| 仅 WorkBuddy 有 | 东方财富妙想 |
| 仅 ModelScope 有 | 百度地图、快递100、高德地图、航班管家 |
| 两边都没有厂商版本 | T3出行、喜马拉雅、同程搜索、携程系 3 条、京东金融、小米商城、哈啰出行、闲鱼 |

未收录的条目在 WorkBuddy 侧是上游连接器市场本身没有（不是本站快照滞后）；
要区分这两种情况，跑 `bun run sync:tree -- --dry-run` 即可（见第 9 节）。

## 2. 逐条对照

| 连接器 | 分类 | 能力 | WorkBuddy 连接器市场 | ModelScope MCP 广场 |
| --- | --- | --- | --- | --- |
| 飞常准 | 出行旅行 | 实时航班动态追踪、机场到发大屏查询、航班票价查询 | 厂商 `variflight-mcp` | 厂商 `@variflight-ai/variflight-mcp`、`@variflight/variflight-mcp` |
| 东方财富妙想 | 金融 | 智能选股与交易页面跳转 | 厂商 `mx-ds-mcp` | 无（仅第三方 `valarmoes/EastMoney-MCP`） |
| T3出行 | 出行旅行 | 呼叫网约车，生成 App 打车跳转链接 | 无 | 无 |
| 喜马拉雅 | 生活服务 | 音频内容搜索与播放页打开 | 无 | 无 |
| 百度地图 | 出行旅行 | 地理编码、地点检索、路线规划、天气、路况查询 | 无 | 厂商 `@baidu-maps/mcp` |
| 同程搜索 | 出行旅行 | 机票、火车票、酒店、景区、综合旅行搜索 | 无（近似 `同程程心`） | 无（仅第三方 `mako2026/TongchengTravel`） |
| 携程旅行-机票 | 出行旅行 | 航班号、航司、价格、余票、经停信息 | 无 | 无（仅第三方 `mako2026/Trip.com-mcp`，携程国际版） |
| 携程旅行-火车票 | 出行旅行 | 车次、票价、余票、座位类型 | 无 | 无（有第三方 12306/火车票类） |
| 携程旅行-酒店 | 出行旅行 | 酒店名称、评分、房价、地址、经纬度 | 无 | 无（有第三方酒店查询/比价类） |
| 京东金融 | 金融 | 金融产品、行情数据与基础金融服务查询 | 无 | 无（只有第三方京东电商类） |
| 小米商城 | 购物 | 小米商品搜索、商品详情与购买链接查询 | 无 | 无 |
| 快递100 | 生活服务 | 快递查询、时效预估、运费估算 | 无 | 厂商 `kuaidi100/kuaidi100-mcp` |
| 高德地图 | 出行旅行 | POI 搜索、地理编码、路线规划、天气查询、导航唤起 | 无（站点只有腾讯地图） | 厂商 `@amap/amap-maps` |
| 哈啰出行 | 出行旅行 | POI 搜索、打车估价、生成 App 跳转链接 | 无 | 无 |
| 航班管家 | 出行旅行 | 航旅票务实时查询、航铁动态追踪、航铁知识问答 | 无 | 厂商 `flightmanager/aviation-data-mcp` |
| 闲鱼 | 购物 | 二手商品搜索 | 无 | 无 |

> 「分类」一列取自灵感广场表格：两个市场的清单都不含分类字段（见第 10 节）。

按来源统计（两行各自相加为 16）：

| 数据源 | 厂商发布 | 仅近似项（非同一服务） | 查无 |
| --- | --- | --- | --- |
| WorkBuddy 连接器市场 | 2 | 1（同程程心） | 13 |
| ModelScope MCP 广场 | 5 | 6 | 5 |

## 3. 按品类看缺口

| 分类 | 总数 | 厂商发布 | 仅第三方 | 查无 |
| --- | --- | --- | --- | --- |
| 出行旅行 | 10 | 4（飞常准、百度地图、高德地图、航班管家） | 4 | 2（T3出行、哈啰出行） |
| 金融 | 2 | 1（东方财富妙想） | 1（京东金融） | 0 |
| 生活服务 | 2 | 1（快递100） | 0 | 1（喜马拉雅） |
| 购物 | 2 | 0 | 0 | 2（小米商城、闲鱼） |

出行旅行是主战场，也是唯一已有 4 项厂商覆盖的品类；购物两项为零。
WorkBuddy 侧单看缺口更集中在出行旅行：出行旅行 10 项里只收录了 1 项（飞常准）。

## 4. 补齐路径

四类条目的补齐方式完全不同，不要混为一谈：

| 类别 | 条目 | 补齐方式 |
| --- | --- | --- |
| 站点已有 | 飞常准、东方财富妙想 | 无需动作 |
| 可补，但依赖新数据源 | 百度地图、快递100、高德地图、航班管家 | **全部只在 ModelScope**，WorkBuddy 市场没有；不接 ModelScope 就没有第二个来源 |
| 仅社区第三方，不建议引入 | 同程搜索、携程旅行-机票/火车票/酒店、京东金融 | 均为个人账号批量发布（`mako2026/...` 一人发了同程、携程、京东、酒店等多条），可用性与维护性无保障 |
| 只能等厂商 | T3出行、喜马拉雅、小米商城、哈啰出行、闲鱼 | 两个来源都没有任何版本 |

## 5. 两个数据源的接入状态

| 数据源 | 条目总量 | 对这 16 项的厂商覆盖 | 站点接入状态 |
| --- | --- | --- | --- |
| WorkBuddy 连接器市场 | 228 | 2 | 已接入（市场页 `/zh-CN/market`） |
| ModelScope MCP 广场 | 12449 | 5 | **未接入** |
| 去重合计 | — | 6 | — |

两者形态不同：WorkBuddy 连接器含 `mcp` 与 `cli` 两类，目录结构为
`.codebuddy-connector/connectors.json` + `connectors/<slug>/`；ModelScope 全部是
MCP Server，只有远程/stdio 连接配置。**不要混进同一套镜像流程**（见第 10 节）。

## 6. ModelScope 侧要点

**判官方看 ID 前缀**。按规范说明，`@author/server_name` 是平台后台收录、尚未被社区认领，
`user_name/server_name` 是已被认领或用户自提交：

| ID 形式 | 含义 | 本文中的例子 |
| --- | --- | --- |
| `@amap/amap-maps`、`@baidu-maps/mcp`、`@variflight-ai/variflight-mcp` | 平台收录（未被认领） | 高德地图、百度地图、飞常准 |
| `kuaidi100/kuaidi100-mcp`、`flightmanager/aviation-data-mcp` | 账号与厂商同名，可信度最高 | 快递100、航班管家 |
| `mako2026/...`、`valarmoes/...`、`dingtalk/...` | 社区个人/第三方发布，**不能当作官方服务** | 同程、携程、京东、东方财富那些「近似项」 |

**搜索是模糊匹配**，容易撞上字符巧合：搜 `T3` 命中的是 `@t3ta/sql-mcp-server`（发布者 ID 含 t3）、
搜 `xiaomi` 命中的是 `xiami`**`zhou1`**`/MZMCP`（华云 OCR，与小米无关）。判定必须看名称，不能只看命中。

**有速率限制**：连续请求约 15 次即返回 `429 Too Many Requests`，批量核对需要加延时
（实测 2.2s/次 + 指数退避可跑完）。

## 7. 近似但不同名

以下条目名相近但并非同一能力，不要误判为已覆盖。

WorkBuddy 连接器市场：

| 参考条目 | 市场内的近似项 | 差异 |
| --- | --- | --- |
| 同程搜索 | `同程程心` (`tc-chengxin`) | 同程系，但不是「综合旅行搜索」那一条 |
| 百度地图 / 高德地图 | `腾讯地图`、`腾讯地图·指南制作` | 地图类仅腾讯系，无百度、高德 |
| 携程旅行（机票/火车票/酒店） | `途牛旅行` | 同属旅行，但不是携程 |
| 京东金融 | `同花顺iFinD金融数据查询`、`Wind Alice 万得金融数据`、`今日投资金融数据` 等 8 项 | 均为金融**数据/研究**，无消费金融类 |
| 小米商城 / 闲鱼 | 无 | 市场暂无购物类连接器 |

ModelScope MCP 广场：

| 参考条目 | 广场内的近似项 | 差异 |
| --- | --- | --- |
| 东方财富妙想 | `valarmoes/EastMoney-MCP` | 社区个人发布，非官方妙想 |
| 同程搜索 | `mako2026/TongchengTravel` | 社区个人发布 |
| 携程旅行 | `mako2026/Trip.com-mcp` | 社区个人发布的携程**国际版**，非国内机票/火车票/酒店 |
| 携程旅行-火车票 | `dingtalk/Train-ticket-inquiry`、`seanhol/12306-mcp`、`Alphar/Railway-Real-Time-MCP-Server` 等 | 第三方 12306/铁路查询，非携程 |
| 携程旅行-酒店 | `mako2026/hotel-recommend`、`liu860502/Hotel_MCP` 等 | 第三方酒店查询/比价，非携程 |
| 京东金融 | `mako2026/JdSelection`、`mako2026/jd-seckill` 等 | 京东**电商**类，且为个人发布，与金融无关 |

## 8. 市场数据现状

WorkBuddy 三个市场（本站镜像的内容）：

| 市场 | 条目数 | 带图标 | 图标缺口 |
| --- | --- | --- | --- |
| 专家 experts | 13 | 7 | 6 |
| 技能 skills | 268 | 114 | 154 |
| 连接器 connectors | 228 | 228 | 0 |
| 合计 | 509 | 349 | 160 |

`market-source/` 共 8892 个文件（含三个 `_files.txt` 清单）。
专家与技能的无图标条目在上游就没有 `avatars/expert.png` 或 `icons/<slug>.<ext>`，
页面按设计回落为字母徽标。

连接器 228 条自身的字段情况：

| 维度 | 情况 |
| --- | --- |
| 图标 | 228/228 齐备（svg 126、png 102） |
| 中英文描述 | en 228/228；zh 227/228，仅 `ifind-mcp` 缺中文 |
| 类型 `type` | mcp 167、cli 36、未声明 25 |
| 鉴权 `auth_mode` | 仅 61 条声明（token 49、server-side 7、oauth 3、oneid-token 1、mcp 1），167 条未声明 |
| 最低客户端版本 `minWorkbuddyVersion` | 163 条声明，范围 4.20.0–5.5.0；65 条未声明 |
| 版本 `version` | 113 条声明；`provider_id` 仅 3 条声明 |

ModelScope MCP 广场：`total_count = 12449`，列表接口单次最多只能取到第 100 条。

## 9. 如何复核

WorkBuddy 侧：

```powershell
# 站点快照 vs 上游的差异（不改动任何文件）
bun run sync:tree -- --dry-run

# 由 market-source/ 重新生成 content/market.json
bun run sync:market

# 本地查看市场页
bun run dev            # http://localhost:5173/zh-CN/market
```

判定某条是否收录时，务必**精确匹配名字**，不要只按关键词：

```powershell
bun -e "const c = require('./content/market.json').connectors; console.log(c.filter(x => x.name.includes('飞常准')).map(x => x.name + '/' + x.id));"
```

ModelScope 侧（JSON 用单引号包裹，不要写成带反斜杠的 `{\"a\":1}`，服务端会报
`InputParameterError: invalid request body`）：

```powershell
curl.exe -s -X PUT "https://modelscope.cn/openapi/v1/mcp/servers" `
  -H "Content-Type: application/json" `
  -d '{"search":"高德","page_number":1,"page_size":5}'
```

批量检索请加 2.2s 以上间隔并处理 `429`。完整字段与限制见
[`modelscope-mcp-api.md`](./modelscope-mcp-api.md)。

## 10. 已知事项

- **6 个技能上游只有元数据、没有内容**：`grill-me`、`handoff`、`mcp-builder`、
  `impeccable`、`web-access`、`skill-creator`。`sync:tree` 会输出警告但不阻断发布；
  上游补齐内容后会自动落地。
- **快照不含分类字段**：`connectors.json` 只有 `id` / `name` / `name_en` /
  `description*` / `source` / `auth_mode` 等，ModelScope 列表也没有分类型字段，
  本文件中的「分类」一列取自灵感广场表格。若市场页需要按分类筛选，需上游补
  `category` 或站点侧另建映射。
- **站点不读可见性与版本约束**：市场页没有使用 `visible_in`、`minWorkbuddyVersion`、
  `auth_mode`，228 条一视同仁地列出。清单里存在 `visible_in: ["internal"]` 以及带
  `plan:ultimate` / `plan:exclusive` 的付费计划限定条目，客户端可能会隐藏，站点照常展示。
  是否在站点侧过滤需要单独决策（现状：按「与上游一致、不额外推断」全量展示）。
- **两个来源当前互不相通**：本站只镜像 WorkBuddy 连接器市场，ModelScope MCP 广场
  没有接入。要引入需要独立的同步脚本与目录，并处理分页上限、速率限制与
  「社区个人发布 vs 厂商发布」的甄别，不要混进现有连接器市场的镜像流程。
- **`_files.txt` 行序随 locale 浮动**：清单按各层 `localeCompare` 输出，
  CJK 文件名在 zh-CN 与 en-US 环境下会有十几行顺序差异。顺序不在镜像契约内，
  不影响客户端镜像，但会让 `git diff` 出现少量噪声。

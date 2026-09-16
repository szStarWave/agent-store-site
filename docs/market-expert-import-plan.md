# 专家市场导入当前项目的工作依据

更新时间：2026-09-16（第 2 版：纳入 `user-experience-architect` 核验结果与最新预检数字）  
状态：方案与基线记录，尚未同步或修改专家市场生成物。

## 0. 给后续 agent 的背景与执行摘要

### 0.1 为什么要做这件事

本站是一个纯静态的 Agent Store，专家卡片和专家包不是本站自行生成的内容，而是把上游市场
目录镜像后发布：`market-source/experts/` 提供 `/source/experts/**` 的实际文件，
`content/market.json` 提供市场目录页的卡片数据。要让线上市场出现新专家，必须先在 WorkBuddy
中获取专家，再把经过核验的完整上游副本同步到本站。

当前项目已有 13 个专家；本任务的目的是真正增加新的“专家（Agent）”，不是增加“专家团（Team）”。
WorkBuddy 的专家列表很长，无法可靠地滚动到底部；每次点击“召唤”后会跳回首页，返回专家列表时
滚动位置会重置；而且已召唤专家仍可能显示“召唤”按钮。因此，界面操作本身不能提供可靠的
全量进度或已安装状态，必须建立可恢复的进度账本，并用本地插件文件做最终证据。

### 0.2 目标

1. 在 WorkBuddy 中按“专家”范围逐个获取目标条目，并记录每个条目的唯一 `slug` 和处理状态。
2. 每次从首页返回后，都能根据账本恢复到下一个未处理专家，不依赖列表滚动位置或按钮状态。
3. 证明专家确实落盘：市场登记、`plugin.json`、Agent、技能、头像和必要文档均可解析且路径存在。
4. 在仓库外形成包含现有 13 个专家和新增候选的完整上游副本，避免用不完整本地副本覆盖本站。
5. 通过项目同步脚本成对生成 `market-source/experts/` 和 `content/market.json`，再验证、审阅和发布。

### 0.3 非目标与禁止的捷径

- 不把“分类=全部”理解成必须盲目滚动到列表底部；列表没有稳定终点时，以账本和本地核验为准。
- 不把首页跳转、对话框出现专家或“召唤”按钮当作完整安装证明；这些只能作为获取动作的辅助信号。
- 不直接把 WorkBuddy 当前看到的局部专家目录作为 `sync:tree` 的整棵来源；上游副本不完整会让
  单向同步把本站已有专家误判为下架并删除。
- 不把运行时缓存、`expert.json` 或界面状态当成可发布专家包；它们只能辅助确认最近选择过谁。
- 不把 `expertType=team` 的专家团混入本站专家市场，也不为同一 `slug` 重复登记卡片。
- 不手工编辑 `market-source/` 或 `content/market.json`；它们必须由同步脚本成对生成。
- 不在 `-removed` 数量未解释、门禁失败或构建未验证时提交、推送或上线。

### 0.4 关键决策及原因

| 现象 / 风险 | 采用的做法 | 原因 |
| --- | --- | --- |
| 列表很长、滚动位置不稳定 | 记录顺序、显示名、分类和唯一 `slug`；优先精确搜索 | 位置和滚动距离不是稳定身份，`slug` 才能跨页面重置恢复 |
| 召唤后跳回首页 | 先把当前条目标记为进行中，返回后再继续账本中的下一条 | 防止重复处理，也能识别中途失败或未完成跳转 |
| 已安装条目仍显示“召唤” | 先查本地市场清单和插件目录 | UI 按钮不是安装状态，重复点击可能制造版本和来源混淆 |
| 本地源可能只有部分条目 | 先准备包含现有 13 个条目的完整上游副本，再 dry-run | `sync:tree` 是单向镜像，缺失条目会产生危险的删除 |
| 站点需要目录卡片和实际文件 | 只通过 `sync` 同时生成树镜像和市场快照 | 两者不成对会出现卡片指向 404 或文件没有卡片 |
| 同名专家已有不同版本 | 先比较版本、声明技能和文件集合，再决定更新或跳过 | 新增同 slug 不是新增卡片，直接覆盖可能丢技能或内容 |

## 1. 目标

从 WorkBuddy 获取新的专家插件，完成结构和内容核验后，安全合并到本站专家市场，最终让
`/zh-CN/market` 与 `/en-US/market` 展示新的专家卡片，并让客户端可以通过
`/source/experts/**` 镜像完整专家包。

## 2. 数据边界

专家市场的真实来源是运行时维护的上游专家市场工作目录，不是本站仓库。

```text
WorkBuddy 专家市场工作目录
        │  sync:tree
        ▼
market-source/experts/           # 上游 1:1 镜像，禁止手工编辑
        │  sync:market
        ▼
content/market.json              # 目录页快照，禁止手工编辑
```

默认来源由 `scripts/sync-market-tree.mjs` 定义，也可通过 `MARKET_SRC_EXPERTS` 显式指定。
本站的 `sync:market` 只读取仓库内的 `market-source/`，不负责联网下载专家。

一个完整专家插件通常包括：

```text
.codebuddy-plugin/marketplace.json
plugins/<slug>/.codebuddy-plugin/plugin.json
plugins/<slug>/agents/*.md
plugins/<slug>/skills/**
plugins/<slug>/avatars/**
```

## 3. 当前核验基线

当前项目已有 13 个专家插件。截至 2026-09-16，本机专家源共 5 个插件
（`remotion-video-generator`、`senior-developer` 为已有落盘；`carousel-content-growth-expert`
于 2026-08-21 下载；`user-experience-architect` 于 2026-09-16 新召唤）：

| 插件 | 类型 / 版本 | 落盘核验（清单唯一登记、`plugin.json` 合法、声明路径均存在） | 与本站关系 |
| --- | --- | --- | --- |
| `ai-content-creator-team` | team / 1.0.0 | 5 个 Agent、1 个技能（`ai-content-production`）、19 个文件、约 8.47 MiB；中英文 `profession`/`displayDescription`/3 个标签齐全；头像为 `avatars/team.png`（站点不识别） | 本站没有；是否收录待决策（见 §5.3） |
| `carousel-content-growth-expert` | agent / 1.0.0 | 1 个 Agent、无随包技能、`avatars/expert.png`、5 个文件、约 0.28 MiB；中英文展示字段齐全 | 本站没有，可新增 |
| `remotion-video-generator` | agent / 1.0.2 | 86 个文件、约 0.77 MiB；与本站文件集合一致（仅 `.downloaded_at` 与换行符不同） | 已存在，不重复新增 |
| `senior-developer` | agent / 1.1.0 | 1 个 Agent、3 个随包技能、118 个文件、约 5.83 MiB；带一个 `.DS_Store` | 本站同 slug 为 1.0.0、4 个技能、222 个文件（含本站独有的 `capability-evolver`），暂不覆盖 |
| `user-experience-architect` | agent / 1.0.1 | 1 个 Agent、1 个随包技能（`browser-use`）、`avatars/expert.png`、10 个文件、约 0.36 MiB；中英文展示字段齐全；无脏文件 | 本站没有，可新增 |

本机源仍不能作为当前项目的整棵同步源。2026-09-16 预检（默认来源）结果：

```text
[sync-market-tree] experts     files=  239 +37 -787 ~91
[sync-market-tree] skills      files= 3960 +190 -863 ~1073
[sync-market-tree] connectors  files= 3550 +328 -41 ~160
```

直接同步会大量剪除现有专家（`-787`），而且 **`sync:tree` 没有「只同步单个市场」的开关**
（`scripts/sync-market-tree.mjs` 的 `main()` 会遍历全部三个市场），skills 与 connectors
也会按本机残缺副本一起重写。正式同步必须同时满足：

1. `experts` 指向包含现有 13 个专家与新增候选的完整副本，且 `-removed` 为 0；
2. `MARKET_SRC_SKILLS` / `MARKET_SRC_CONNECTORS` 指回仓库内的 `market-source/<market>`
   （自镜像，实测 `+0 -0 ~0`，不写盘时无副作用），避免误剪另外两个市场。

## 3.1 市场发行通道（2026-09-16 实测）

专家的真实发行物是 **bundle（tar.gz）**，不是裸文件树：

- 目录（远端）：`https://acc-1258344699.cos.accelerate.myqcloud.com/workbuddy/expert-marketplace/expert_center.json`
  （缓存副本在 `~/.workbuddy/app/cache/experts/manifest.json`，同目录 `metadata.json` 记录 baseUrl）。
- 包（公开、无需鉴权、按 slug 枚举）：`https://<base>/bundles/<slug>.tar.gz`。
- 全量普查：目录 428 条（375 agent + 53 team），**428/428 都有 bundle**。
- 裸文件路径（`/plugins/<slug>/agents/*.md`）只对 244/428 存在，**不能用它的 404 判断条目缺失**。
- 等值验证：`code-review-expert` 的 bundle 与 WorkBuddy 召唤落盘的包，版本同为 1.0.3、
  文件集合相同（本机多一个 `.downloaded_at`）、5 个「哈希不同」的文件规范化后内容完全一致
  （bundle 为 LF，app 落盘为 CRLF）。
- app 侧下载路径（daemon 日志 `expert-market`）：优先用 bundle，部分条目走
  `https://openplatform-cdn.codebuddy.cn/openplatform/experts/<expertId>/eu_*.zip`（带签名）。

因此，导入新专家有两条等效通道：

1. **WorkBuddy 召唤**（原流程）：产出 `plugins/<slug>/` + `.downloaded_at`，本机市场清单自动登记；
   需要 UI 操作，受列表/搜索可用性影响。
2. **bundle 直下**（可脚本化）：下载 `bundles/<slug>.tar.gz` → 解包进站外上游副本 →
   在副本的 `.codebuddy-plugin/marketplace.json` 登记。无需 UI 与登录态，可批量；
   代价是 `.downloaded_at` 与「app 侧登记」由我们补齐，需要自行做结构核验。

无论走哪条通道，`-removed` 为 0 的预检、`sync` 成对生成、`check:market`、构建与页面验证都不变。

## 4. 卡片字段和头像注意事项

专家目录页的卡片字段来自专家自己的 `plugin.json`：

- `profession.zh` / `profession.en`：中英文卡片标题
- `displayDescription.zh` / `displayDescription.en`：中英文卡片简介
- `tags[{zh,en}]`：卡片标签

头像探测规则目前只尝试：

```text
avatars/expert.png → avatars/avatar.png → avatar.png → icon.png
```

`ai-content-creator-team` 虽然有 `avatars/team.png` 和成员头像，但当前规则不会将
`team.png` 识别为目录页卡片头像；如果要求卡片显示头像，应在上游按现有规范补充
`avatars/expert.png`，而不是直接修改本站镜像或快照。`carousel-content-growth-expert`
与 `user-experience-architect` 均已有标准的 `avatars/expert.png`。

## 5. 推荐执行流程

### 5.0 WorkBuddy 获取闭环（已按实际操作确认）

只处理“专家”页，不进入“专家团”。分类可以选择“全部”，但不要把“滚动到底部”当作
完成条件；应以每个目标卡片的本地落盘核验为准：

1. 在专家列表定位目标卡片；必要时使用搜索或分类筛选缩小范围。
2. 鼠标悬停卡片，点击“召唤”。
3. 等待 WorkBuddy 自动跳转到首页对话页。
4. 首页输入框或当前对话中出现目标专家，说明本次召唤已完成运行时绑定；这只是“下载成功”的
   候选信号，不替代文件核验。
5. 从左侧“专家·技能·连接器”返回专家列表，继续处理下一个目标。
6. 对每个已召唤专家，在本机专家市场源中核验：市场清单有唯一登记、`source` 可解析、插件
   `plugin.json` 合法、声明的 Agent 与技能路径均存在、头像与 README 存在，并记录文件数、
   体积、版本和 `expertType`。

#### 5.0.1 安装进度账本与恢复定位

专家列表会在“召唤”后跳转首页；从左侧入口返回时，列表滚动位置会被重置。WorkBuddy 对已
添加的专家也可能继续显示“召唤”，所以按钮本身不能用来判断安装状态。每次操作都要先在本
文档账本登记，再执行下一项：

| 顺序 | 专家显示名 | 唯一 slug | 状态 | 本地核验结果 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| 1 | 高级开发工程师 | `senior-developer` | 已落盘待整理 | 118 文件、3 技能、v1.1.0；本站为 1.0.0、4 技能、222 文件（含 `capability-evolver`） | 暂不覆盖；若要升级须先确认 1.1.0 为完整权威版本 |
| 2 | 轮播内容增长专家 | `carousel-content-growth-expert` | 已落盘待整理 | 5 文件、v1.0.0、无随包技能、`avatars/expert.png` 存在、字段齐全 | 纳入合并副本（源包 2026-08-21 下载） |
| 3 | 用户体验架构师 | `user-experience-architect` | 已落盘待整理 | 10 文件、v1.0.1、技能 `browser-use`、`avatars/expert.png` 存在、字段齐全 | 纳入合并副本（2026-09-16 召唤） |
| 4 | 内容创作专家团 | `ai-content-creator-team` | 已落盘，待决策 | 19 文件、team 型、5 个 Agent、1 个技能、头像为 `team.png` | 先定「是否收录专家团」（§5.3），再决定是否纳入 |

每完成一个专家，至少记录以下状态：

- `待定位`：尚未点击卡片；
- `已点击召唤`：已点击，但尚未确认首页跳转；
- `已跳转首页`：首页已绑定目标专家，等待本地核验；
- `已落盘待整理`：本地插件目录、清单和声明路径核验通过；
- `已纳入本站候选`：已合并到完整上游副本，并通过 `sync:tree --dry-run` 的删除风险检查；
- `跳过`：本地已存在同 slug，或属于“专家团”/`expertType=team`；
- `待决策`：结构性特例（如专家团是否收录），先定策略再决定纳入或跳过。

从首页返回专家列表后，按以下顺序恢复，不依赖上一次滚动位置：

1. 读取账本中第一条不是“已落盘待整理”“已纳入本站候选”或“跳过”的记录。
2. 优先使用搜索框输入精确的专家显示名；必要时结合已记录的分类、头像和副标题确认卡片。
3. 没有搜索结果时，选择与账本相同的排序和分类，从列表顶部以固定的小步滚动定位；每次只在
   看清卡片后继续，不盲点“召唤”。
4. 如果卡片仍显示“召唤”，先按 slug 检查本地市场清单和插件目录；本地已存在且内容已核验的
   专家直接标记为已处理，不再次点击。
5. 只有本地不存在该 slug，或明确要获取新版本时，才再次执行“悬停 → 召唤 → 等待首页跳转”。

账本的唯一键使用插件 `slug`，不要使用卡片所在行、滚动距离或“召唤”按钮状态。这样列表
重置、排序变化或卡片位置变化时，仍能安全地逐个续做，并避免重复下载或误把专家团加入本站。

本次对 `senior-developer` 的落盘核验结果：

- 市场清单唯一登记为 `senior-developer`，`source` 指向对应插件目录；
- `plugin.json` 存在且可解析，`expertType=agent`、版本 `1.1.0`；
- 1 个 Agent、3 个声明技能目录、1 个 `avatars/expert.png` 和 README 均存在，声明路径全部可解析；
- 实际 118 个文件、6,113,433 字节（约 5.83 MiB）；
- WorkBuddy 的运行时专家记录也显示“吴八哥 / 高级开发工程师”，可作为辅助证据，不能替代插件目录核验。

它与当前项目已有的同 slug `senior-developer` 不等价：本地是 1.1.0、3 个技能、118 个文件，
本站镜像是 1.0.0、4 个技能、222 个文件；本站包含本地缺少的 `capability-evolver`，本地还带有
一个 `.DS_Store`。因此当前结论是“已落盘，但暂不直接上传覆盖”；需要先确认 1.1.0 是否为完整且
权威的上游版本，并取得包含现有 13 个专家的完整上游副本，再执行 `sync:tree --dry-run`。

### 5.1 获取与整理

1. 获取目标专家插件，二选一（通道对比见 §3.1）：

   - **WorkBuddy 召唤**：界面搜索 → 召唤 → 等待落盘；
   - **bundle 直下**（可批量、无需 UI）：

     ```powershell
     $base = "https://acc-1258344699.cos.accelerate.myqcloud.com/workbuddy/expert-marketplace"
     curl.exe -s -o "$env:TEMP\<slug>.tar.gz" "$base/bundles/<slug>.tar.gz"
     New-Item -ItemType Directory -Force "<副本目录>\plugins\<slug>" | Out-Null
     tar.exe -xzf "$env:TEMP\<slug>.tar.gz" -C "<副本目录>\plugins\<slug>"
     ```

     解包后按与召唤相同的口径核验：`plugin.json` 可解析、`expertType` 为 `agent`、
     声明的 agents/skills 路径与 `avatars/expert.png`、README 均存在。
2. 在仓库外准备完整的专家市场工作副本：以仓库镜像为底，再把新增插件并进去。

   ```powershell
   $copy = "<副本目录>"
   Copy-Item market-source\experts $copy -Recurse -Force   # 底座：现有 13 个专家
   # 并入本机新专家（方案 A 两个；方案 B 另加 ai-content-creator-team，并另做头像处理）
   Copy-Item "$env:USERPROFILE\.workbuddy\plugins\marketplaces\experts\plugins\carousel-content-growth-expert" "$copy\plugins\" -Recurse -Force
   Copy-Item "$env:USERPROFILE\.workbuddy\plugins\marketplaces\experts\plugins\user-experience-architect" "$copy\plugins\" -Recurse -Force
   ```

   副本里允许保留仓库镜像的 `_files.txt`：`sync:tree` 的 `listFiles()` 会跳过顶层清单，
   正式同步时会按内容重写目标清单。
3. 更新该副本的 `.codebuddy-plugin/marketplace.json`，在 `plugins` 数组里为每个新增专家
   登记唯一条目（该副本是上游，允许手工编辑；`market-source/` 里不行）。条目形态：

   `{ "name": "<slug>", "source": "./plugins/<slug>", "description": "<英文兜底简介>" }`
4. 检查新增插件的 `plugin.json`、Agent、技能、头像、README、许可证和文件体积；清除
   `.git`、`node_modules`、缓存、临时文件、密钥及 `.DS_Store` 等不应发布的内容。

### 5.2 只读预检

显式指向完整副本，并把另外两个市场指回仓库自镜像（`sync:tree` 无单市场开关）后执行：

```powershell
$env:MARKET_SRC_EXPERTS    = "<完整专家市场工作目录>"
$env:MARKET_SRC_SKILLS     = "<仓库>/market-source/skills"
$env:MARKET_SRC_CONNECTORS = "<仓库>/market-source/connectors"
bun run sync:tree -- --dry-run
```

预期形态（方案 A）：`experts` 的 `+added` 约 15（carousel 5 个 + ux-architect 10 个文件；
若含 `ai-content-creator-team` 则再 +19），`-removed` 为 0，`skills` 与 `connectors` 为
`+0 -0 ~0`。

预检重点：

- `-removed` 必须为 0，或每一项都有明确的上游下架依据；
- `+added` 只来自新增插件的文件；
- 新增插件的 `source` 必须是合法 POSIX 相对路径；
- 没有重复登记；
- `~changed` 除清单、`.downloaded_at` 与 `senior-developer` 的版本差异外，应只剩换行符差异（§6）。

### 5.3 生成与验证

预检通过后才允许执行（沿用 §5.2 的三个 `MARKET_SRC_*`）：

```powershell
bun run sync
bun run check:market
bun run build
```

> `sync` 会按同一份来源重写三个 `_files.txt`。skills / connectors 的自镜像只会产生
> 清单重写（内容集合不变）；若它们出现在 git 变更里且只是换行符，不要混入本次提交。

新增集合取决于 §3 的待决策项（按 §0.3「不混入专家团」的非目标，默认采用方案 A）：

- 方案 A（只收 agent 型）：`carousel-content-growth-expert` + `user-experience-architect`，
  专家数 13 → 15；
- 方案 B（连同 `ai-content-creator-team` 一起收）：13 → 16；若选此方案，需先更新 §0.3
  的非目标说明，并先在上游为该团队补 `avatars/expert.png` 才有卡片头像。

必须确认：

- 专家数量达到所选方案的目标值；
- `market-source/experts/` 和 `content/market.json` 同步更新；
- `check:market` 退出码为 0；
- 构建产物包含 `build/client/source/experts/`；
- `/zh-CN/market`、`/en-US/market` 的新卡片标题、简介、标签和头像符合预期；
- 新专家的关键文件通过 `/source/experts/**` 可访问。

### 5.4 提交与发布

当前工作分支：`feat/market-add-local-experts`。

市场生成物必须成对提交：

```text
market-source/experts/
content/market.json
```

建议使用中文主题的 Conventional Commit，例如方案 A：
`chore(market): 新增用户体验架构师与轮播内容增长专家`。

先在功能分支完成检查和审阅，再合并到 `main`。合并到 `main` 后由 EdgeOne Makers 触发构建，
再验证线上市场页：

`http://111.170.173.22:10014/zh-CN/market`

## 6. 已知验证环境问题

当前 Windows 工作区的 `market-source/*/_files.txt` 为 CRLF。`scripts/check-market.mjs`
目前按 `\n` 切分但未去除行尾 `\r`，因此直接运行时会把清单误报为全量缺失和多余；规范化
换行后，专家清单实际为 989 个文件、993 行记录，其中 4 行是已不存在的 `.DS_Store` 残留，
没有实际文件漏列。

另一个同类现象：本机上游副本的文本文件多为 CRLF，而仓库镜像为 LF。2026-09-16 对
`experts` 做逐字节比对（仅两侧都存在的 202 个文件）：111 个完全一致、84 个只差换行符、
7 个真实差异（`marketplace.json`、`remotion-video-generator/.downloaded_at`、
`senior-developer` 的 `.downloaded_at` / `plugin.json` / `agents/senior-developer.md` /
`skills/frontend-dev/SKILL.md` / `skills/fullstack-dev/SKILL.md`）。预检输出中的
`~91 changed` 基本是换行符噪音，判读时不要当作内容变更。

因此，正式导入前必须先区分：

1. 真正的市场源差异；
2. Windows 行尾导致的门禁误报；
3. 新增专家自身的结构、字段或资源问题。

本文件只作为导入依据，不替代同步脚本、门禁和构建验证。

## 7. 执行结果与下一步计划（2026-09-16 闭环）

### 7.1 本次导入（3 个 agent 专家，13 → 16）

| slug | 名称 | 版本 | 文件 | 来源 |
| --- | --- | --- | --- | --- |
| `code-review-expert` | 代码审查专家 | 1.0.3 | 7 | WorkBuddy 召唤落盘（与 bundle 逐字节等值） |
| `backend-architect` | 后端架构师 | 1.0.1 | 113 | bundle 直下 |
| `data-engineer` | 数据工程师 | 1.0.1 | 5 | bundle 直下 |

备选替换：`data-analysis` 的 bundle 缺 `avatars/expert.png`、README 及中英文展示字段，
按 §0.3「上游缺字段就回落、不在站点侧造数据」的原则，替换为字段完整的 `data-engineer`。

### 7.2 闭环验证（全部通过）

| 步骤 | 命令 | 结果 |
| --- | --- | --- |
| 只读预检 | `sync:tree -- --dry-run`（experts=副本，另两市场自镜像） | `experts +125 -0 ~1`，skills/connectors `+0 -0 ~0` |
| 同步 | `bun run sync` | 两产物成对更新；基线 `experts=16 skills=268 connectors=228 avatars=352` |
| 门禁 | `bun run check:market` | 0 findings，退出码 0 |
| 幂等 | `sync:tree -- --dry-run` 复跑 | `+0 -0 ~0` |
| 构建 | `bun run build` | 退出码 0；`build/client/source/experts/` 含 1115 个文件；三张新卡片的中英文名均出现在 `/zh-CN/market`、`/en-US/market` 的预渲染 HTML 中 |

提交：市场产物与文档分成两笔（见 §5.4），推送 `feat/market-add-local-experts`；合并 `main`
后由 EdgeOne Makers 触发上线。

### 7.3 下一步收录计划（草案）

- **候选池**：市场目录 428 条全部有 bundle（§3.1），其中 agent 型 375 条。筛选规则：
  bundle 内中英文 `profession` / `displayDescription` / `tags` 齐全，且有
  `avatars/expert.png` 与 README，否则跳过换下一个。
- **优先队列（建议）**：`security-engineer`、`mcp-build-expert`、
  `database-optimization-expert`、`ai-engineer`、`mobile-application-developer`、
  `product-management`、`ui-designer`、`user-experience-researcher`、
  `dev-ops-automation-engineer`、`api-dev`。
- **bundle 内实检结果（2026-09-16，10 选 8）**：`security-engineer`、`mcp-build-expert`、
  `database-optimization-expert`、`ai-engineer`、`mobile-application-developer`、
  `dev-ops-automation-engineer`、`ui-designer`（3.0 MB）、`user-experience-researcher`
  均为 agent 型、字段/头像/README 齐全；`api-dev` 缺 `avatars/expert.png`、
  `product-management` 缺全部展示字段与头像，**不入选**。
- **建议的第二批（5 个）**：`carousel-content-growth-expert`、
  `user-experience-architect`（本机已落盘核验，零成本）+ `security-engineer`、
  `mcp-build-expert`、`ai-engineer`（bundle 直下）→ 专家数 16 → 21。
- **批次规模**：每批 3–5 个，保证人工审阅与门禁覆盖。
- **挂账**：`carousel-content-growth-expert`、`user-experience-architect`（本机已落盘核验、
  未入站）；`senior-developer` 版本差异（本机 1.1.0 / 本站 1.0.0，暂不覆盖）。
- **工具化（可选）**：把「拉目录 → bundle 存在性/字段核验 → 解包 → 登记」做成
  `scripts/import-expert-bundles.mjs`（`--slugs`、`--dry-run`），下一批只给 slug 列表即可；
  先在站外副本灰度，再接标准流程。

## 8. 第二批执行计划（2026-09-16 规划，分支 `feat/market-add-experts-batch-2`）

目标：专家 16 → 21，仅收 agent 型。

### 8.1 名单与获取通道

| slug | 名称 | 版本 | 通道 |
| --- | --- | --- | --- |
| `carousel-content-growth-expert` | 轮播内容增长专家 | 1.0.0 | 本机已落盘（核验通过） |
| `user-experience-architect` | 用户体验架构师 | 1.0.1 | 本机已落盘（核验通过） |
| `security-engineer` | 安全工程师 | 1.0.1 | bundle 直下 |
| `mcp-build-expert` | MCP构建专家 | 1.0.1 | bundle 直下 |
| `ai-engineer` | AI工程师 | 1.0.2 | bundle 直下 |

三个 bundle 已完成字段/头像/README 核验（§7.3），本机两个包已通过落盘核验。

### 8.2 执行清单

1. 站外造副本：以仓库 `market-source/experts`（16）为底，并入上表 5 个包，
   在副本 `.codebuddy-plugin/marketplace.json` 登记（`name` / `source` / 英文兜底 `description`）。
2. 逐个核验：`plugin.json` 可解析、`expertType=agent`、声明 agents/skills 路径存在、
   `avatars/expert.png` 与 README 存在、无 `.DS_Store`/`.git`/`node_modules`。
3. 预检：`MARKET_SRC_EXPERTS=<副本>`，`MARKET_SRC_SKILLS/CONNECTORS` 指回仓库自镜像；
   期望 `experts` 的 `-removed=0`（`+added` ≈ 5 个包的文件数之和），另两个市场 `+0 -0 ~0`。
4. `bun run sync` → `bun run check:market`（退出码 0）→ 幂等复检 `+0 -0 ~0`。
5. `bun run build`；确认 `build/client/source/experts/` 含 5 个新包，且 `/zh-CN/market`、
   `/en-US/market` 预渲染 HTML 出现 5 张新卡片的中英文名。
6. 提交：市场产物一笔（`chore(market): …`）+ 文档一笔；推送后按 §5.4 合并 `main`。

### 8.3 验收与不变量

- 基线应为 `experts=21 skills=268 connectors=228 avatars=357`（头像数 = 352 + 5）。
- `-removed` 非 0、门禁 `✗`、构建失败、预渲染页面缺卡片——任一出现即停下排查。
- `senior-developer` 版本差异仍挂账、`ai-content-creator-team` 仍按 team 排除，
  本批不改变这两项结论。

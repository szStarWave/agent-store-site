# 市场资源维护交接文档

本文说明如何更新本站的三个市场资源：**专家 / 专家团 / 技能 / 连接器**。
目标读者是接手维护的人，以及按文档执行的 agent。

- 适用范围：新增、修改、下架市场条目
- 不适用：改站点页面与样式、改文档、发版（见文末「相关文档」）
- **关键前提：所有资源改动都不需要改代码。** 目录页直接读 `content/market.json`，
  预渲染路由 `react-router.config.ts` 已覆盖 `/market` 与 `/{lang}/market`。

## agent 执行须知

1. 所有命令都在**仓库根目录**执行；`node` / `bun` 均可，本文用 `bun run <script>`。
2. 先只读探测、再写盘：`--dry-run` 不会改动任何文件，任何没有把握的操作都先跑它。
3. 上游市场工作目录不在本仓库内（由运行时维护）。文档中一律用环境变量指代，
   不要把它写进文档、日志或提交信息。
4. 写盘操作只有三个：`sync:tree`（镜像）、`sync:market`（快照）、`git commit`。
   除此之外不应有任何文件被修改。
5. `sync:tree` 是**单向镜像**，同一时刻只允许一台机器执行。在多个机器或 clone 之间
   交替同步会静默删除资源。动手前先读第 4 节。
6. 提交前跑 `bun run check:market`：查重与「两个产物是否一致」合成一条命令，退出码非 0
   即有问题。这是整条流程里唯一挡住重复上线与半同步的检查（见 4.3、4.7）。

## 1. 数据流与目录角色

```text
上游市场工作目录（运行时维护，非本仓库）
        │  bun run sync:tree          镜像 + 生成 _files.txt + 门禁校验
        ▼
market-source/{experts,skills,connectors}/     提交进仓库，上游的 1:1 镜像
        │  bun run sync:market        纯本地读取，生成目录页快照
        ▼
content/market.json                            提交进仓库，目录页数据源
        │
        ├─ bun run dev      →  http://127.0.0.1:5173/zh-CN/market
        └─ bun run build    →  预渲染 HTML，并把 market-source/ 拷为
                               build/client/source/  →  对外 /source/<market>/…
```

| 路径 | 角色 | 谁维护 |
| --- | --- | --- |
| 上游市场工作目录 | 原始资源树 | 运行时/市场侧；**不是本仓库** |
| `market-source/` | 上游的 1:1 镜像，含每市场的 `_files.txt` | `sync:tree` 生成，**禁止手工编辑** |
| `content/market.json` | 目录页用的精简快照 | `sync:market` 生成，**禁止手工编辑** |
| `build/client/source/` | 构建产物里的同一棵树 | `copy-market-tree.mjs` 生成，构建产物不入库 |

对外，本站同时是三个市场源（`url` 型 `source_kind`）：

| 市场 | 清单地址 | 目录清单 |
| --- | --- | --- |
| 专家 | `/source/experts/.codebuddy-plugin/marketplace.json` | `/source/experts/_files.txt` |
| 技能 | `/source/skills/.codebuddy-skill/marketplace.json` | `/source/skills/_files.txt` |
| 连接器 | `/source/connectors/.codebuddy-connector/connectors.json` | `/source/connectors/_files.txt` |

`_files.txt` 是镜像契约：一行一个相对 POSIX 路径、不含自身，客户端据此镜像整棵树。
静态托管没有动态枚举端点，所以它必须在发布前生成好。

**清单还必须等于「git 真正交付的集合」。** 清单由 `listFiles()` 扫磁盘生成，而 `git add`
会静默跳过 `.gitignore` 命中的路径：被忽略且未跟踪的文件留在同步机的磁盘上、留在清单里，
却进不了提交。客户端按清单逐个拉取，拿到的是 404；而同步机自己看不出任何异常——它的磁盘
上确实有这些文件。2026-09-17 修掉的正是这样一处：不带根锚点的 `.codebuddy/` 让专家市场
多出 84 条幽灵条目（见 4.3、7）。所以改 `.gitignore` 时不要写会命中市场树的宽松规则。

## 2. 四类资源的文件与字段规范

三个市场的**清单位置、条目键、`source` 的解析基准**各不相同——这是最容易出错的地方：

| 市场 | 清单 | 条目键 | 内容基准目录 | `source` 形态 |
| --- | --- | --- | --- | --- |
| 专家 | `.codebuddy-plugin/marketplace.json` | `plugins` | 市场根 | `./plugins/<name>` |
| 技能 | `.codebuddy-skill/marketplace.json` | `skills` | `<市场>/skills/` | 裸 slug |
| 连接器 | `.codebuddy-connector/connectors.json` | `connectors` | `<市场>/connectors/` | 裸 slug |

> `source` 若写错基准（例如技能写成 `./skills/<slug>`），门禁会报
> `source "…" ships no payload` 或 `does not resolve`，同步不会通过。

### 2.1 专家（agent 型）

```text
experts/plugins/<name>/
├── .codebuddy-plugin/plugin.json
├── agents/*.md
├── avatars/expert.png        ← 卡片图标（可选）
└── skills/…                  ← 该专家内置的技能
```

`plugin.json` 里**影响本站显示**的字段（值都是 `{ "zh": …, "en": … }` 对）：

| 字段 | 作用 | 缺失时页面表现 |
| --- | --- | --- |
| `profession` | 卡片标题 | 回落清单的 `name`，即显示成插件 id |
| `displayDescription` | 卡片简介 | 回落清单的 `description`（通常只有英文） |
| `tags` | 卡片标签，最多取 5 个 | 无标签行 |
| `displayName` | 人格昵称（如「吴八哥」），**本站不读** | — |

图标探测顺序：`avatars/expert.png` → `avatars/avatar.png` → `avatar.png` → `icon.png`，
都不存在则页面显示字母徽标。建议只放 `avatars/expert.png`。

清单条目（`marketplace.json`）：

```json
{ "name": "<插件 id>", "source": "./plugins/<name>", "description": "<英文兜底简介>" }
```

### 2.2 专家团

与专家同一个市场、同一套目录结构，区别在 `plugin.json`：

| 字段 | 说明 |
| --- | --- |
| `expertType` | `"team"`（专家是 `"agent"`） |
| `agentName` | 队长 agent 的 id |
| `teamInfo` | `{ "leadAgent": …, "memberAgents": [ … ] }` |
| `members` | `[{ "id", "name": { "zh", "en" }, "profession": { "zh", "en" }, "avatar", "role" }]` |

注意两点：

1. **成员的中文名不会自动成为团队标题。** 团队层级同样要有 `profession` /
   `displayDescription`，否则卡片标题回落成插件 id（这是当前
   `frontend-backend-experts`、`software-company` 的表现）。
2. 成员的 `name` / `profession` 只在运行时展示，本站目录页只展示团队条目本身。

### 2.3 技能

```text
skills/skills/<slug>/        含 SKILL.md
skills/icons/<slug>.<ext>    图标放在市场根，不在条目目录里
skills/.codebuddy-skill/marketplace.json
```

清单条目中影响显示的字段：

| 字段 | 作用 | 缺失时 |
| --- | --- | --- |
| `source` | 定位 `skills/<slug>/` | 不显示（门禁会报错） |
| `name` | 卡片标题 | — |
| `version` | 卡片标题旁的 `v…` | 不显示版本 |
| `description_zh` / `description_en` | 卡片简介 | 回落 `description` |
| `tags_zh` / `tags_en` | 卡片标签，最多 5 个 | 无标签行 |

**技能清单没有 `name_en` 字段**，所以英文站点的技能卡片标题仍是中文名。这是上游数据
限制，不是站点缺陷；不要在站点侧造一个英文名。

图标命名：市场根 `icons/<source 的 basename>.<ext>`，扩展名依次探测
`png → svg → jpg → jpeg → webp → gif`。

### 2.4 连接器

```text
connectors/connectors/<slug>/      mcp.json / cli.json / token-schema.json 等
connectors/icons/<slug>.<ext>      图标放在市场根
connectors/.codebuddy-connector/connectors.json
```

清单条目中影响显示的字段：

| 字段 | 作用 | 缺失时 |
| --- | --- | --- |
| `id` | 条目唯一标识 | 回落 `name` |
| `name` | 中文名 | 回落 `id` |
| `name_en` | 英文名 | 英文站回落中文名 |
| `description_zh` / `description_en` | 简介 | 回落 `description` |
| `source` | 定位 `connectors/<slug>/`，同时决定图标文件名 | 门禁会报错 |

图标规则与技能相同（`icons/<source basename>.<ext>`）。

**本站不读**的字段：`type`、`auth_mode`、`minWorkbuddyVersion`、`visible_in`、
`provider_id`、`version`、`examples_*`。目录页不做可见性、客户端版本或鉴权方式的
过滤与展示——所有条目一视同仁地列出。

## 3. 更新流程

### 第 1 步：在上游市场增改条目

在上游工作目录里按第 2 节的规范增删改文件与清单条目。这一步不涉及本仓库。
不同机器的市场目录位置可能不同，用环境变量或 `--markets` 指定：

```powershell
# 方式一：环境变量（一次性覆盖某个市场来源）
$env:MARKET_SRC_EXPERTS  = "<专家市场工作目录>"
$env:MARKET_SRC_SKILLS   = "<技能市场工作目录>"
$env:MARKET_SRC_CONNECTORS = "<连接器市场工作目录>"

# 方式二：命令行按市场指定
node scripts/sync-market-tree.mjs --markets experts=<路径> skills=<路径> connectors=<路径>
```

### 第 2 步：预检（不写盘）

```powershell
bun run sync:tree -- --dry-run
```

输出形如（**示意**，数字随上游变化）：

```text
[sync-market-tree] experts     files= 2090 +1 -0 ~1
[sync-market-tree] skills      files= 4633 +0 -0 ~0
[sync-market-tree] connectors  files= 3263 +5 -1 ~3
[sync-market-tree] total files=9986 added=6 removed=1 changed=4
[dry-run] + connectors/<slug>/mcp.json
…
[sync-market-tree] dry run — nothing written
```

看到 `dry run — nothing written` 才说明确实没写盘。确认增删改符合预期再进入下一步；
若这一步就报错，先看第 6 节。

### 第 3 步：正式同步

```powershell
bun run sync          # = sync:tree + sync:market
```

它会：镜像上游 → 重写三个 `_files.txt` → 跑门禁 → 重新生成 `content/market.json`。

也可以分开跑：

```powershell
bun run sync:tree                # 只镜像与生成清单
bun run sync:market              # 只由 market-source/ 重新生成 content/market.json
bun run sync:tree -- --listing-only   # 只由镜像重出三份清单，不读上游源
```

`--listing-only` 是给「排除规则变了、但本机没有上游副本」准备的：上游工作目录是每台机器
一份，而镜像随仓库走，所以只有它能在这种机器上把清单与树重新拉齐（清单本来就是由镜像生成
的）。它同样会跑门禁；不镜像、不删文件。

`sync:market` 的输出是本次更新的**核对基线**：

```text
[sync-market-data] content/market.json: experts=381 skills=268 connectors=228 avatars=648
```

数字应与预期一致（新增一个连接器则 `connectors` +1，带图标则 `avatars` 同步 +1）。

### 第 4 步：验证

```powershell
bun run dev            # http://127.0.0.1:5173
```

- 目录页：`/zh-CN/market` 与 `/en-US/market` —— 切到对应标签页，确认新条目的
  标题、简介、标签、图标正确
- 资源可达性：抽一个图标或文件地址，例如
  `http://127.0.0.1:5173/source/connectors/icons/<slug>.svg` 应返回 200
  （开发态由 `vite.config.ts` 的 `marketSourcePlugin()` 直接托管 `market-source/`）
- 判定某条是否已被收录时**精确匹配名字**，不要只按关键词：

  ```powershell
  bun -e "const c=require('./content/market.json').connectors; console.log(c.filter(x=>x.name.includes('飞常准')).map(x=>x.name+'/'+x.id))"
  ```

### 第 5 步：提交与部署

```powershell
bun run check:market             # 查重 + 两个产物是否一致，见 4.3
git add market-source content/market.json
git commit -m "chore(market): …"
git push origin main
```

- **两个路径要一起提交**：只提交 `market-source/` 会让页面与树不一致，只提交
  `content/market.json` 则指向了不存在的文件。
- 推送 `main` 会触发 EdgeOne Makers 构建；构建里 `copy-market-tree.mjs` 把树拷进
  `build/client/source/`。`_files.txt` 在 `edgeone.json` 中被显式设为 `no-cache`，
  因为客户端会轮询该清单，缓存会导致新条目不可见。
- 提交信息建议单独成一笔，不要和业务代码改动混在一起（`market-source/` 变动通常
  几百个文件）。

## 4. 换机器与多人协作

### 4.1 换机器：动手前的三条前提

换机器**不需要**重新拉全量——`sync:tree` 本身是增量的（按 sha256 逐个比对，只拷
`+added` 与 `~changed`）。但它同时是**单向镜像**：`removed` 按「上游没有」判定，
会直接删除镜像里的文件以及随之变空的目录。所以动手前先确认三条前提：

| 前提 | 不满足的后果 |
| --- | --- |
| 上游市场工作副本**完整**（不是只有部分条目） | 镜像里对方没有的文件会被删除 |
| 副本**不旧于**当前镜像 | 上游新增的条目会被「删回」旧状态 |
| 指向**同一个**上游市场 | 相当于换了市场源，镜像被整体替换 |

这三条都无法自动校验，唯一的守卫是预检，**只看 `-removed`**：

```powershell
bun run sync:tree -- --dry-run
```

- `-0`，或数量很小且能解释成「上游确实下架了这些条目」→ 可以继续 `bun run sync`
- 出现无法解释的大量 `-N` → 停下，让对方的副本补齐或更新到与镜像同级后再预检

> 预检明细每条只打印**前 5 行**（`+` / `-` / `~` 各 5 条），真实数量以汇总行为准。
> 实测出现过 1097 个新增文件只显示 5 行的情况，只看明细会严重低估改动规模。

### 4.2 机器上没有市场工作副本时

**不要直接跑 `sync`**。上游目录不存在时脚本会立刻退出（`source missing`，退出码 2，
不写盘）；但**目录存在却是空的**更危险——镜像里所有文件都会被判为 `removed` 而删除，
几乎清空。两条可行路径：

1. 先在运行时里拉取市场，让工作副本落地，再走上面的预检流程；
2. 用仓库的 `market-source/` 当种子：把某个市场的整棵目录拷到本地任意位置，
   用 `--markets <market>=<该目录>` 指过去，之后就在这份副本上增删改。

第 2 条与「禁止手改 `market-source/`」（见第 8 节）不冲突：被编辑的是**仓库之外的
中间副本**，仓库里的镜像仍然只由 `sync:tree` 生成。反过来，直接编辑仓库里的
`market-source/` 会在下次同步被覆盖或剪除。

来源目录一律显式指定（不同客户端版本的目录位置可能不同）：环境变量
`MARKET_SRC_EXPERTS` / `MARKET_SRC_SKILLS` / `MARKET_SRC_CONNECTORS`，
或 `--markets`（写法见第 3 节第 1 步）。

### 4.3 多人更新：丢失与重复是怎么发生的

本站的镜像机制对多人协作很敏感，原因有三条：

1. **删除以「上游没有」为准。** 本机副本旧或不全，副本里没有的条目就会被判定为
   已下架并删除；`_files.txt` 随之重写，**客户端会跟着删掉本地已装条目**——站点少几张
   卡片只是表象。
2. **粒度是文件，不是条目。** 两边都有 `connectors/<slug>/` 但内部文件版本不同时，不会
   整条替换，而是逐文件覆盖，可能出现「清单是新的、某个子文件是旧的」这种半新半旧状态。
   条目级原子性没有保证。
3. **没有版本号或时间戳，脚本无法判断谁更权威。** 仓库永远只是「最后一次同步那台机器的
   视图」，脚本不会（也无法）提示你正在把别人的成果删掉。

#### 丢失的形态

| 形态 | 触发条件 | 表现 |
| --- | --- | --- |
| 回退式删除 | 本机副本比仓库旧 | `-removed` 里出现别人刚补的条目，同步后从镜像与目录页消失 |
| 覆盖式丢失 | 两人在各自副本上增删同一市场 | 后同步者的副本里没有对方的条目，于是被删除 |
| 合并后错位 | `push` 被拒后直接合并再推 | 合并结果不等于任何一台机器的镜像，清单与树可能不一致 |
| 只提交一半 | 只 `git add market-source`，或只加 `content/market.json` | 页面指向不存在的文件，或树里有条目但页面搜不到 |
| 解冲突选错一侧 | 手工解决 `_files.txt` / 清单冲突 | 静默回退，门禁只有在你重跑同步时才会报 |

前两种是**静默**的：命令成功、门禁通过、构建正常，只有下次有人比对时才会发现条目少了。

#### 重复的形态

| 形态 | 触发条件 | 表现 |
| --- | --- | --- |
| 同一条目登记两次 | 两人在各自副本加了同一资源，之后把两份清单合并到一起 | 目录页出现两张相同卡片 |
| 同一资源用了两个 slug | 双方各自起名（`foo` 与 `foo-2`）后合并 | 同上，且两份内容都真实存在 |
| 清单里出现重复条目 | 手工编辑清单，或合并时未清理 | 同上 |

> **门禁不检查清单内部是否重复。** `validate()` 只校验清单能解析、`source` 合法、
> `_files.txt` 与树互为覆盖；`sync-market-data.mjs` 也是逐条映射、不做去重。所以重复会
> 一路通过构建直接上线，**只能靠提交前检查**（见 4.7）。

查重与「两个产物是否一致」由同一条命令完成：

```powershell
bun run check:market          # 退出码非 0 即有问题；--json 供脚本消费
```

它逐市场检查六件事：清单内重复登记（`manifest.duplicate`）、快照条目数与清单是否一致
（`snapshot.count`）、快照条目集合是否与清单一一对应（`snapshot.entry`）、快照里的头像路径
是否真有文件（`snapshot.avatar-missing`）、`_files.txt` 与树是否互相覆盖（`listing.*`）、
清单里有没有 git 不会交付的路径（`listing.undeliverable`）。

```text
✓ experts — 0 finding(s)
✓ skills — 0 finding(s)
✓ connectors — 0 finding(s)

3 market(s), 0 finding(s)
[check-market] content/market.json: experts=381 skills=268 connectors=228 avatars=648
```

前五条都以**磁盘**为准，第六条补的正是「磁盘有、提交没有」那一类：被 `.gitignore` 忽略且
未跟踪的路径，`git add` 会静默丢掉它。它需要 git（`git check-ignore`）来判定，所以只在
CLI 里跑；git 不可用时打一行提示而不是当作通过。

出现重复时**去上游删掉多余条目**，不要改镜像。`_files.txt` 里的重复行不必担心：
每次 `sync:tree` 都整份重写它。

### 4.4 串行化流程

**同一时刻只允许一台机器执行 `sync:tree`**，且这台机器要有一份完整的、不旧于镜像的
上游副本。固定按这五步走：

```powershell
git pull                                   # 1. 先对齐仓库
bun run sync:tree -- --dry-run             # 2. 预检，只看 -removed（判读见 4.1）
bun run sync                               # 3. 同步：镜像 + 清单 + 快照
git add market-source content/market.json  # 4. 两个路径一起提交
git commit -m "chore(market): …"
git push origin main                       # 5. 被拒则回到第 1 步重来（见 4.5）
```

按协作规模选做法：

| 协作规模 | 做法 |
| --- | --- |
| 单人，或指定单一同步机（**推荐**） | 只在这台机器上跑 `sync:tree`；其他人用仓库做页面开发与验证 |
| 多人，但市场资源有单一负责人 | 由负责人独占同步；其他人只改代码与文档，不碰上游市场 |
| 多人各自维护上游 | 不推荐。至少要约定「谁跑同步谁先通知」，且每次都走完上面五步 |

两条能显著降低风险的做法：

- **按市场分工不可行。** `--markets` 只用来指定**来源路径**，三个市场每次都会一起镜像。
  所以「我只负责连接器」不成立：只要本机缺专家或技能的副本，那一次同步就会去删它们
  （这正是 4.2 存在的原因）。分工要落到「这个条目由谁改」。
- **种子法保证同源。** 各机器都从仓库的 `market-source/<market>` 拷一份当来源
  （用 `--markets` 指过去，见 4.2），本机「上游」就始终等于仓库镜像，同步只能前进、
  不会因副本旧而回退；要改的条目直接加进这份副本即可。

### 4.5 `push` 被拒时怎么办

**不要**直接合并一个含 `market-source/` 的分支再推。合并出来的镜像不等于任何一台机器的
上游，而 `_files.txt` 与三个清单是行级合并的，很可能只保留了一侧的内容——树与清单不一致。
门禁的 `listing misses` / `listing references` 正是这种状态的信号，但它只在你重跑同步时才跑。

先看对方改了什么：

```powershell
git --no-pager log --oneline HEAD..origin/main
git --no-pager diff --stat HEAD..origin/main -- market-source content/market.json
```

- **对方也做了市场同步** → 放弃自己这份镜像结果，把上游副本补齐到含对方条目后重做：
  ```powershell
  git checkout origin/main -- market-source content/market.json
  # 把对方新增的条目放回自己的上游副本（可从 market-source/ 拷出），再走 4.4 的五步
  ```
- **对方改的是代码或文档** → 常规合并即可，但**合并后必须重跑 `bun run sync`**
  （至少 `sync:market`），让生成物与树重新对齐，然后单独提交生成物。

一条硬规则：**只要合并动过 `market-source/`，就必须重跑同步，不能手工解冲突。**

### 4.6 冲突文件的处理规则

`_files.txt` 与 `content/market.json` 都是**整份重写的生成物**，它们的冲突不该被「解决」，
只该被重新生成：

| 冲突文件 | 处理 |
| --- | --- |
| `market-source/*/_files.txt` | 任选一侧，随后 `bun run sync:tree` 整份重写 |
| `market-source/*/.codebuddy-*/**.json` | 以上游为准：改上游副本后重新同步，不要用编辑器手工合并两个分支的清单 |
| 图标等二进制文件 | 不要用 merge 工具挑一侧；先决定保留哪份文件，两份都要就给不同 slug 并分别登记 |
| `content/market.json` | 永远由 `bun run sync:market` 重新生成，禁止手工合并 |

```powershell
git checkout --theirs -- market-source/*/_files.txt
bun run sync:tree
bun run sync:market
```

### 4.7 提交前自检

```powershell
bun run check:market             # 查重 + 两个产物是否一致，一条命令覆盖第 1–3 条
bun run sync:tree -- --dry-run   # 应为 +0 -0 ~0（幂等：镜像与来源一致）
git status --short               # 两个产物成对出现，且没有手改过的文件
```

1. `bun run check:market` 退出码为 0。它查清单内重复、快照与清单的条目数及条目集合是否
   一致、快照头像是否真有文件、`_files.txt` 与树是否互相覆盖（判读见 4.3）。
2. `sync:tree` 的门禁输出 `validation passed — tree is publishable`；出现任何 `✗` 都不提交。
3. `git status` 里 `market-source/` 与 `content/market.json` **成对出现**，且没有手改过的文件。

这几条是整条流程里**唯一**能挡住「静默丢失」与「重复上线」的检查——门禁只管树内部，
既不看快照，也不查重复。

## 5. 目录页映射与回落

`content/market.json` 的结构与取值来源：

| 快照字段 | 来源 | 缺失时 |
| --- | --- | --- |
| `updatedAt` | 每次 `sync:market` 的当前时间 | —（页面显示「更新于 …」） |
| `base` | 固定 `"source"` | — |
| 专家 `name` / `name_en` | 插件 `plugin.json` 的 `profession.zh` / `.en` | 回落清单 `name`（插件 id） |
| 专家 `description_zh` / `_en` | 插件 `displayDescription.zh` / `.en` | 回落清单 `description` |
| 专家 `tags_zh` / `_en` | 插件 `tags[{zh,en}]`，取前 5 | 空数组 |
| 专家 `avatar` | 插件目录内四个候选文件，见 2.1 | `null` |
| 技能 `name` / `version` / `source` | 清单同名字段 | — |
| 技能 `description_zh` / `_en` | 清单同名字段 | 回落 `description` |
| 技能 `tags_zh` / `_en` | 清单同名字段 | 空数组 |
| 技能 `avatar` | 市场根 `icons/<slug>.<ext>` | `null` |
| 连接器 `id` / `name` / `name_en` | 清单同名字段 | `id` 回落 `name`，`name` 回落 `id` |
| 连接器 `description_zh` / `_en` | 清单同名字段 | 回落 `description` |
| 连接器 `avatar` | 市场根 `icons/<slug>.<ext>` | `null` |

页面读取规则（`app/lib/market.ts`）：

- `entryName`：当前语言是 `en-US` 且条目有 `name_en` 时用 `name_en`，否则用 `name`
- `entryDescription`：取当前语言的 `description_*`，一侧为空时回落另一侧
- `entryTags`：只有带 `tags_zh` 的条目有标签（即专家与技能；连接器没有）
- `avatar` 为 `null` 时渲染 `market-avatar-fallback` 字母徽标，底色由 `nameHue(name)` 决定

> 由此可知：**上游缺字段时页面不报错，只是显示成回落值**。想让它显示正确，只能去上游
> 补字段，不要在站点侧加推断。

## 6. 校验结果解读

`sync:tree` 的门禁失败会整次不通过（退出码 1），警告则不阻断。

### 失败项

| 报错 | 含义 | 处理 |
| --- | --- | --- |
| `missing manifest <路径>` | 清单文件不在镜像里 | 检查上游是否有该清单、排除规则是否误伤 |
| `manifest is not valid JSON` | 清单解析失败 | 修上游 JSON |
| `manifest has no "<entries>" entries` | 条目数组为空 | 检查清单结构 |
| `entries[N]: source must be a non-empty string` | `source` 空或非字符串 | 补齐 |
| `entries[N]: source must be relative` | 写成了绝对路径或带盘符 | 改为相对路径 |
| `entries[N]: source must be a POSIX relative path without ".."` | 含反斜杠或 `..` | 改为 POSIX 相对路径 |
| `entries[N]: source "…" escapes the market` | 按基准目录解析后跑到市场外 | 检查 `source` 与基准目录的搭配 |
| `listing misses N file(s)` | `_files.txt` 漏了实际存在的文件 | 重跑 `sync:tree` 会用实际文件重写清单 |
| `listing references N missing file(s)` | 清单引用了不存在的文件 | 同上；若上游刚删文件，重跑即可 |
| `listing must exclude itself` / `illegal path in listing` | 清单格式被手工破坏 | 重跑 `sync:tree` |

> 门禁比对的是**磁盘上的镜像**，所以它发现不了「清单收录了 git 不会交付的路径」——那些文件
> 就在磁盘上。这一类由 `bun run check:market` 的 `listing.undeliverable` 判定，见 7。

### 警告项（不阻断发布）

```text
[sync-market-tree] ! skills: entries[N]: source "xxx" ships no payload
[sync-market-tree] 1 entr(ies) ship no payload upstream — metadata-only, nothing to mirror
```

含义：上游清单声明了这个条目，但它的内容目录不存在——上游只登记了元数据。
镜像会照实复制（没有内容就没有内容），目录页仍会展示该条目。
**不需要也不能在站点侧修**；等上游补上内容，下次同步自动落地。

### 关于 `_files.txt` 的顺序

清单按各层 `localeCompare` 的深度优先顺序输出。含中文文件名时，不同 locale 的机器
（例如 zh-CN 与 en-US）会产生十几行的顺序差异。顺序不在镜像契约内，客户端不依赖它，
**看到这类 diff 属正常，不要手工调整清单**。

## 7. 故障排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 卡片显示字母徽标 | 上游没有图标文件 | 专家补 `avatars/expert.png`；技能/连接器补市场根 `icons/<slug>.<ext>` |
| 中文站出现英文简介 | 专家缺 `profession`/`displayDescription`，或技能/连接器缺 `description_zh` | 上游补字段（站点不推断） |
| 卡片标题变成插件 id | 专家/团队缺 `profession` | 上游补 `profession` |
| 英文站技能标题是中文 | 技能清单没有 `name_en` | 上游数据限制，需上游补字段 |
| 目录页数字没变化 | 只跑了 `sync:tree`，或 `content/market.json` 没提交 | 跑 `bun run sync`，并把两个路径一起提交 |
| 条目在树里但页面搜不到 | 只提交了 `market-source/` | 补提交 `content/market.json` |
| 线上 `/source/…` 404 | 构建未完成，或直接跑了 `react-router build`（漏掉拷贝步骤） | 用 `bun run build`；本地 `preview` 刻意不兜底 `/source`，以便暴露这种情况 |
| `bun run dev` 起不来，报 safe-delete / trash 操作失败 | 环境变量 `NODE_OPTIONS` 注入了 node-language-shim，`react-router dev` 清理 `.react-router/types` 时触发 | 先 `$env:NODE_OPTIONS=""` 再启动 |
| 市场镜像客户端连不上开发服务器，本地代理报 502 / ECONNREFUSED | 默认 `host: "localhost"` 在 Windows 上只绑到 `::1`，而代理转发到 `127.0.0.1` 被拒 | 已由 `vite.config.ts` 的 `host: "127.0.0.1"` 处理；浏览器访问 `localhost` 仍可用（会回落） |
| git 提示 `CRLF will be replaced by LF` | Windows 行尾差异 | 正常，忽略 |
| 同步后条目「凭空」少了几个 | 本机上游副本旧或不全，预检的 `-removed` 没被检查（见 4.3） | 从 `git log` 找回被删条目并补回上游副本，再按 4.4 重做 |
| 目录页出现两张重复卡片 | 上游清单里同一资源登记了两次（门禁不拦，见 4.3） | 上游删掉重复条目后重新同步；提交前跑 4.3 的查重命令 |
| 门禁报 `listing misses` / `listing references` | 合并动过 `market-source/` 但没重跑同步（见 4.5） | 按 4.6 重跑 `sync:tree` 与 `sync:market` |
| `check:market` 报 `snapshot.count` / `snapshot.entry` | 只改或只提交了两个产物中的一个 | 跑 `bun run sync:market` 重新生成快照，再成对提交 |
| `check:market` 报 `snapshot.avatar-missing` | 快照指向的图标文件不在树里（通常是被剪除或没随树提交） | 重新同步；若上游确实没有图标，让快照回落为 `null`（即重新生成） |
| `check:market` 报 `listing.undeliverable` | 清单收录了被 `.gitignore` 忽略且未跟踪的路径——同步机的磁盘有这些文件，`git add` 不会把它们放进提交 | 用 `git check-ignore -v <路径>` 看是哪条规则：把规则锚到根（`/.codebuddy/`）或收窄，再 `bun run sync:tree -- --listing-only` 重出清单；若这些文件确实不该上架，就按 4.6 的思路重跑同步 |
| `check:market` 报 `listing.phantom`（或有人比对出「清单里有文件、提交里没有」），本机磁盘上文件都在 | 与上一条同源：清单由磁盘生成，提交由 git 决定，两侧对「被忽略的文件」看法不同 | 同上；排查命令见 7 末「一条命令自检清单与提交是否一致」 |
| `check:market` 报 `listing.missing`（例：`…/fbsir-super-partner/.DS_Store`），但 `git status` 里看不到这些文件 | 镜像里有**未跟踪且被忽略**的垃圾文件（macOS 元数据等） | 删掉即可；`sync:tree` 的 `FILE_EXCLUDES` 已把 `.DS_Store` / `Thumbs.db` 排除在清单外，重出清单不会再收录它们 |

### 一条命令自检「清单与提交是否一致」

```powershell
git ls-files --others --ignored --exclude-standard -- market-source
# 输出为空才算通过：列出什么，就说明镜像里有什么是 git 不会交付的
```

它列的是**镜像里存在、被忽略、且未跟踪**的文件。其中任何一个出现在 `_files.txt` 里，客户端
就会去拉一个永远 404 的地址。要定位是哪条规则命中：

```powershell
git check-ignore -v market-source/experts/plugins/<专家>/skills/<技能>/.codebuddy/agents/x.md
# 形如：.gitignore:28:.codebuddy/  …   ← 第 28 行的规则命中了它
```

`bun run check:market` 的 `listing.undeliverable` 做的就是这件事，只是它会自己比对三份清单，
并且把结果算进退出码。

## 8. 不要做的事

1. **不要手工编辑 `market-source/` 里的任何文件**（包括清单与 `_files.txt`）。
   它是上游的 1:1 镜像，下次 `sync:tree` 会覆盖改动，并把上游不存在的文件直接剪除。
2. **不要在站点侧做字段推断或补齐。** 上游缺字段就按回落显示；站点侧补的东西既会与
   上游不一致，也会在同步时被覆盖。
3. **不要为了让某个条目「显示正常」而改脚本的回落逻辑**（`sync-market-data.mjs` 与
   `app/lib/market.ts`）。回落规则是刻意的：显示必须能反映上游数据的真实状态。
4. **不要提交临时文件**：`dev.log` / `dev.err` 已在 `.gitignore` 中；调试用的中间文件
   用完删掉。
5. **不要只提交一半**：`market-source/` 与 `content/market.json` 是同一次同步的两个
   产物，必须一起提交。
6. 不要在文档、日志、提交信息里写上游工作目录的绝对路径。
7. **不要多人同时跑 `sync:tree`。** 同一时刻只允许一台机器，否则后同步者会删掉前者的
   条目（见 4.3、4.4）。
8. **不要在 `push` 被拒后直接合并含 `market-source/` 的分支再推。** 先按 4.5 处理。
9. **不要手工合并生成物**（`_files.txt`、`content/market.json`）。它们由脚本整份重写，
   冲突时重跑脚本（见 4.6）。
10. **不要在 `.gitignore` 里写会命中市场树的宽松规则**，尤其是不带根锚点的目录名与宽通配
    （`.codebuddy/`、`*.log` 这类）。命中就等于让清单指向客户端拉不到的 404，而且是静默的：
    同步机、门禁、构建全都正常（见 1、7）。要忽略仓库自己的东西就锚到根（`/.codebuddy/`）。

## 9. 当前基线（供交接时对照）

截至 **2026-09-17** 实测（批量收录后）：

| 项 | 数值 |
| --- | --- |
| 条目总数 | 877（专家 381、技能 268、连接器 228） |
| 带图标条目 | 648（专家 306 / 381、技能 114 / 268、连接器 228 / 228） |
| `market-source/` 文件数 | 22,612（含三份 `_files.txt`） |
| 三份清单行数 | 专家 14,713、技能 4,633、连接器 3,263 |
| 仓库体积 | `market-source` 695.3 MB、`build/client` 699.1 MB、`.git` 约 277 MB |

> **2026-09-17 更正**：此前记的 22,696 含 84 个只存在于同步机磁盘、进不了提交的文件
> （4 个专家的 `skills/fbs-bookwriter/.codebuddy/{agents,providers}`）。它们从未出现在已发布
> 的树里；清单中的对应行已删除，误伤的 `.gitignore` 规则也已修正（见 1、7）。

2026-09-16 批量收录：专家 16 → **381**（agent 378 / team 3），覆盖目录 375 个 agent 中的
374 个；唯一未收 `vietnam-finance-tax-expert` 已明确放弃（bundle 495 MB）。获取通道
（bundle 直下）、核验口径、批次记录与体积指标见
[`market-expert-import-plan.md`](./market-expert-import-plan.md) 的 §3.1、§8–§10。

已知的上游侧缺口（站点无需处理，仅需知情）：

- 6 个技能上游只有元数据、没有内容目录：`grill-me`、`handoff`、`mcp-builder`、
  `impeccable`、`web-access`、`skill-creator`。同步时输出警告，不阻断发布。
- 20 个专家缺中文本地化字段（中英文简介相同，或 `profession.zh` 缺失），中文站回落成
  「英文简介 / 插件 id」；早期已知的 `frontend-backend-experts`、`software-company` 属此类。
- 75 个专家没有 `avatars/expert.png`，页面显示字母徽标（多数为 B 档回落收录，判定见
  计划 §8.2）。
- 清单没有分类字段，因此目录页没有分类筛选。
- 4 个专家的技能载荷缺失：`behavioral-nudge-engine`、`book-co-creator`、
  `feedback-synthesis-analyst`、`seo-expert` 的 `skills/fbs-bookwriter/.codebuddy/{agents,providers}`
  （共 84 个文件）曾因 `.gitignore` 误伤而进不了提交。规则已修正，下一次在**拥有上游副本的
  机器**上跑 `bun run sync` 会随树与清单一起自动补回（本机源不含这些文件时补不回来）。

## 10. 相关文档

| 文档 | 用途 |
| --- | --- |
| [`../README.md`](../README.md) | 命令速查、市场源地址表、部署说明 |
| [`connector-coverage.md`](./connector-coverage.md) | 连接器覆盖现状、近似项甄别方法 |
| [`modelscope-mcp-api.md`](./modelscope-mcp-api.md) | ModelScope MCP 开放接口（当前**未接入**本站） |
| `scripts/sync-market-tree.mjs` | 门禁与警告判定的权威定义；排除项（`logs`/`dist`/`market-icons`/`.git`/`node_modules`/`FILE_EXCLUDES`）、`--listing-only` 也在这里 |
| `scripts/check-market.mjs` | 查重、两产物一致性、清单与 git 交付集的权威定义（`bun run check:market`） |
| `.gitignore` | 哪条规则会命中市场树——`listing.undeliverable` 的判据来源（规则要锚到根） |
| `scripts/sync-market-data.mjs` | 快照字段映射与回落规则的权威定义 |
| `scripts/copy-market-tree.mjs` | 构建期拷贝逻辑（纯拷贝，不做过滤：被排除的东西根本没进 `market-source/`） |
| `app/lib/market.ts` | 目录页读取快照的规则 |
| `edgeone.json` | `_files.txt` 的缓存策略与路由重写 |

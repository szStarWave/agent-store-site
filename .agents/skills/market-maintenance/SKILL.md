---
name: market-maintenance
description: 维护本站三个市场资源（专家 / 技能 / 连接器）的上游镜像与目录页快照——同步上游、上架下架条目、修卡片图标不显示、修中英文字段错位、排查条目缺失或重复、解读 sync:tree 校验输出。凡是任务涉及 market-source/、content/market.json、sync:tree / sync:market、/source/ 下的资源地址、市场页（/market）卡片显示异常，或需要从本机上游市场拉取资源，都先读本技能——即使用户只说「市场里的图标没了」「专家简介还是英文的」「把这个连接器加上」这类没提到脚本的话。
---

# 市场资源维护

本站是三个市场的**静态镜像站**：资源不由本站产出，而是把上游市场工作目录镜像进
`market-source/`，再托管给客户端与目录页。这决定了一条贯穿始终的原则：

> **上游数据是唯一的真相来源。** 页面上任何「显示不对」都只能回上游改；站点侧不推断、
> 不补齐、不做过滤。站点侧补的东西下次同步就会被覆盖。

## 动手前必须知道的三件事

1. **`sync:tree` 是单向镜像，删除以「上游没有」为准。** 本机副本旧或不全，就会把别人刚
   同步进来的条目当成「已下架」删掉；`_files.txt` 随之重写，**装了这些条目的客户端也会
   跟着删**。命令成功、门禁通过、构建正常——这类丢失是静默的。
2. **粒度是文件，不是条目。** 两边都有 `connectors/<slug>/` 但内部文件版本不同时，是逐个
   文件比对覆盖，可能出现「清单是新的、某个子文件是旧的」这种半新半旧状态。
3. **仓库只是「最后一次同步那台机器的视图」**，没有版本号或时间戳可以判断谁更权威。

## 硬规则

- **同一时刻只允许一台机器跑 `sync:tree`。** 多人或多个 clone 交替同步会静默删资源。
- **任何写盘前先 `--dry-run`，只看 `-removed`。** `-0`，或数量很小且能解释成「上游确实下架
  了这些条目」才继续；出现无法解释的大量 `-N` 就停下，先处理副本。
- **只改上游副本**，绝不手工编辑 `market-source/` 里的任何文件（含清单与 `_files.txt`）。
- **`market-source/` 与 `content/market.json` 是同一次同步的两个产物**，必须一起改、一起提交。
- **上游缺字段就让它按回落显示。** 不在站点侧造字段，也不为了让某条「显示正常」去改脚本的
  回落逻辑——回落是刻意的，显示要如实反映上游数据的真实状态。
- 不在文档、日志、提交信息里写上游工作目录的绝对路径。
- **提交前跑 `bun run check:market`。** 一条命令查「清单内重复」与「两个产物是否一致」，
  退出码非 0 就别提交。门禁只管树内部，这两件事它都不看。

## 标准流程

```powershell
git pull                                   # 1. 先对齐仓库
bun run sync:tree -- --dry-run             # 2. 预检，不写盘；判读规则见上
bun run sync                               # 3. 同步：镜像 → 重写 _files.txt → 门禁 → 快照
bun run dev                                # 4. 验证 /zh-CN/market 与 /en-US/market
bun run check:market                       # 5. 查重 + 两个产物是否一致，非 0 就别提交
git add market-source content/market.json  # 6. 成对提交，且单独成笔
git commit -m "chore(market): …"
git push origin main
```

第 3 步会打印本次的核对基线，例如
`[sync-market-data] content/market.json: experts=13 skills=268 connectors=228 avatars=349`。
数字应与预期一致（新增一个连接器则 `connectors` +1，带图标则 `avatars` 同步 +1），
这是最省事的「改对了吗」信号。

只想刷新快照（例如改了字段映射）时用 `bun run sync:market`：它**只读仓库里的
`market-source/`**，不碰本机上游，所以不受副本新旧影响，也没有删除风险。

两个环境坑：

- 启动开发服务器前先 `$env:NODE_OPTIONS=""`。`NODE_OPTIONS` 里的 `node-language-shim`
  会让 `react-router dev` 清理 `.react-router/types` 时失败并直接退出。
- 开发态 `/source/**` 由 `vite.config.ts` 的 dev 中间件托管 `market-source/`；`preview`
  刻意不兜底 `/source`，好让「构建期拷贝坏了」在本地就暴露，而不是等线上 404。

## 按任务走

| 任务 | 做法 | 细节 |
| --- | --- | --- |
| 新增 / 修改 / 下架条目 | 改上游副本 → 预检 → 同步 → 验证 → 成对提交 | 本文「标准流程」 |
| 卡片显示字母徽标 | 上游补图标：专家 `avatars/expert.png`；技能与连接器为市场根 `icons/<slug>.<ext>` | `references/layout-and-fields.md` |
| 中文站出现英文简介、标题变成插件 id | 上游补 `profession` / `displayDescription` / `description_zh` | 同上 |
| 条目在市场上搜不到 | 先 `sync:tree --dry-run` 区分「本站快照滞后」与「上游本来就没有」；判定某条是否收录必须**精确匹配名字**，不要只按关键词 | `references/checks-and-collaboration.md` |
| 校验输出 `✗` | 按本文「校验输出解读」处理 | 同上 |
| 目录页出现重复卡片 | 上游清单里同一资源登记了两次，门禁不拦这种；`bun run check:market` 会点出来 | 同上 |
| 页面与树不一致，像是只提交了一半 | `bun run check:market` 报 `snapshot.*`：快照与清单的条目对不上 | 同上 |
| 换机器 / 多人协作 / `push` 被拒 | 先读协作规则再动手 | 同上 |

## 校验输出解读

`sync:tree` 的门禁失败会整次不通过（退出码 1），警告不阻断。

| 输出 | 含义与处理 |
| --- | --- |
| `! source "…" ships no payload`（警告） | 上游登记了条目但内容目录不存在。上游侧问题，站点不要修 |
| `✗ missing manifest …` / `manifest is not valid JSON` | 清单缺失或坏了 → 修上游 |
| `✗ source must be …` / `source "…" escapes the market` | `source` 形态或解析基准不对 → 对照三市场的基准目录 |
| `✗ listing misses …` / `listing references … missing file(s)` | `_files.txt` 与树不一致，通常是「合并过 `market-source/` 但没重跑同步」→ 重跑 |
| `✗ listing must exclude itself` / `illegal path in listing` | 清单被手工破坏 → 重跑 `sync:tree` |

完整对照表见 `docs/market-maintenance.md` 第 6 节。

> 关于 `_files.txt` 的顺序：它按各层 `localeCompare` 输出，含中文文件名时不同 locale 的机器
> 会有十几行顺序差异。顺序不在镜像契约内，客户端不依赖它，看到这类 diff 属正常，
> **不要手工调整清单**。

## 权威来源

改动前如有疑问，以下文件是权威定义，不要凭记忆：

| 需要什么 | 去哪里 |
| --- | --- |
| 完整流程、协作细节、当前基线 | `docs/market-maintenance.md` |
| 连接器条目的覆盖现状（含 ModelScope 对照） | `docs/connector-coverage.md` |
| 门禁与警告的判定逻辑 | `scripts/sync-market-tree.mjs` |
| 查重与两产物一致性的判定逻辑 | `scripts/check-market.mjs`（`bun run check:market`） |
| 快照字段映射与回落规则 | `scripts/sync-market-data.mjs` |
| 目录页读取快照的规则 | `app/lib/market.ts` |
| `_files.txt` 缓存策略、路由重写 | `edgeone.json` |

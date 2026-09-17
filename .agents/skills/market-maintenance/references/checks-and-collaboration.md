# 预检、查重与多人协作

本文是操作层面的检查清单。机制性说明与完整规则见 `docs/market-maintenance.md` 第 4 节。

## 预检判读

```powershell
bun run sync:tree -- --dry-run
```

```text
[sync-market-tree] experts     files= 2090 +1 -0 ~1
[sync-market-tree] connectors  files= 3263 +5 -1 ~3
[sync-market-tree] total files=9986 added=6 removed=1 changed=4
[sync-market-tree] dry run — nothing written
```

以 `removed` 为准：`-0`，或数量很小且能解释成「上游确实下架了这些条目」才继续。
出现无法解释的大量 `-N`，说明本机副本旧或不全，停下来先把副本补齐。

两点注意：

- 明细每条只打印**前 5 行**（`+` / `-` / `~` 各 5 条），真实规模只看汇总行。
- 看到 `dry run — nothing written` 才说明确实没写盘。

## 查重与两产物一致性（一条命令）

门禁 `validate()` 只校验清单能解析、`source` 合法、`_files.txt` 与树互为覆盖；
`sync-market-data.mjs` 逐条映射、不去重，也从不回头看上一趟写了什么。所以**上游清单里
重复登记同一资源**、或**只提交了两个产物中的一个**，都会一路通过构建直接上线。

```powershell
bun run check:market          # 退出码非 0 即有问题；--json 供脚本消费
```

它逐市场检查七件事：重复登记（`manifest.duplicate`）、快照条目数与清单是否一致
（`snapshot.count`）、快照条目集合是否与清单一一对应（`snapshot.entry`）、快照里的头像
路径是否真有文件（`snapshot.avatar-missing`）、`_files.txt` 与树是否互相覆盖（`listing.*`）、
清单里有没有 git 不会交付的路径（`listing.undeliverable`）、`.gitignore` 会不会命中市场树里的
载荷（`ignore.market-tree`）。
正常时：

```text
✓ experts — 0 finding(s)
✓ skills — 0 finding(s)
✓ connectors — 0 finding(s)

3 market(s), 0 finding(s)
[check-market] content/market.json: experts=381 skills=268 connectors=228 avatars=648
```

出现重复时**去上游删掉多余条目**，不要改镜像。`_files.txt` 里的重复行不必担心：
每次 `sync:tree` 都整份重写它。

### `listing.undeliverable`：清单说了、git 不做

前五条都以**磁盘**为准；第六条补的是「磁盘有、提交没有」这一类。清单由 `listFiles()` 扫磁盘
生成，而 `git add` 会静默跳过 `.gitignore` 命中的路径：被忽略且未跟踪的文件留在同步机的
磁盘上与 `_files.txt` 里，却进不了提交。客户端按清单逐个拉取，拿到的是 404——而同步机、
门禁、构建全都正常。2026-09-17 实测到一处：不带根锚点的 `.codebuddy/` 命中市场树里的同名
目录，让专家市场多出 84 条幽灵条目（4 个专家的 `skills/fbs-bookwriter/.codebuddy/{agents,providers}`，
共 21 × 4 个文件）。

判定与修法：

```powershell
# 1. 哪条规则命中了它
git check-ignore -v market-source/experts/plugins/<专家>/skills/<技能>/.codebuddy/agents/x.md
#    → .gitignore:28:.codebuddy/    ← 把规则锚到根：/.codebuddy/

# 2. 修好规则后重出清单（只读镜像，不碰上游）
bun run sync:tree -- --listing-only
bun run check:market
```

两点要知道：

- `check-ignore` **不报告已跟踪的路径**，这正是需要的判据：技能市场里同形状的 21 个
  `.codebuddy` 文件是早于该规则入库的，一直都在交付，不该被当成问题。
- 被这条规则点出来的文件未必「不重要」：它们是 git 交付不了的合法载荷。规则修正后，
  下一次在**拥有上游副本的机器**上跑 `bun run sync` 会把它们随树与清单一起补回来；
  本机源里没有这些文件时补不回来（只能重出不含它们的清单，让清单如实反映交付集）。

### `ignore.market-tree`：给 `.gitignore` 做规则体检

比上一条更早一步：不比对清单，而是拿一组**代表名**去问 `.gitignore` 会不会命中市场树**内部**
的路径。命中意味着「这类载荷进不了提交」，只是还没真发生。代表名覆盖的是各种「写太宽」的
形态（`build/`、`dist/`、`logs/`、`market-icons/`、`.codebuddy/`、`.cache/`、`tmp/`、
`dev.log`、`server.err`…），探针挂在各市场的内容基准目录下（专家 `plugins/`、技能 `skills/`、
连接器 `connectors/`）。刻意**不探**两侧同口径排除的名字（`node_modules/`、`.DS_Store`、
`Thumbs.db`——`sync` 的排除集合与之相同），也不探有意保持全局的 `.env`。

它是**烟雾测试而非证明**：`git check-ignore` 没有「列出你的规则」这种模式，覆盖面取决于代表名
是否覆盖了那类写法。它按市场逐个报，因为同一条规则同时压在三个市场上。看到它报错时：

```powershell
git check-ignore --no-index -v -- market-source/skills/skills/_probe/build/out.js
#  → .gitignore:16:build/      ← 把规则锚到根：/build/
```

改完规则**不必**重出清单（清单没变）；只有当这条规则此前已经吞掉过文件时，症状才会是上一条
`listing.undeliverable`，那时才需要按上面的流程重出清单。

安全写法速记：

| 写法 | 只作用于本仓库？ | 说明 |
| --- | --- | --- |
| `/build/`、`/*.log`、`/.codebuddy/` | 是 | 锚到根 |
| `.edgeone/*`、`docs/*.md` | 是 | 中间带 `/` 的 pattern，git 同样按根锚定 |
| `build/`、`*.log`、`.codebuddy/` | **否** | 任意层级都命中，会咬进市场树 |
| `node_modules/`、`.DS_Store`、`Thumbs.db` | 否，但可接受 | `sync` 侧排除集合完全相同，两侧一致 |

## 提交前自检

```powershell
bun run check:market             # 查重 + 两个产物是否一致 + 清单是否都是 git 会交付的路径
bun run sync:tree -- --dry-run   # 应为 +0 -0 ~0（幂等）
git status --short               # 两个产物成对出现，且没有手改过的文件
git ls-files --others --ignored --exclude-standard -- market-source   # 应为空
```

1. `bun run check:market` 退出码为 0。
2. `sync:tree` 的门禁输出 `validation passed — tree is publishable`；出现任何 `✗` 都不提交。
3. `git status` 里 `market-source/` 与 `content/market.json` **成对出现**，且没有手改过的文件。
4. 最后一条列的是「镜像里有、但 git 不会交付」的文件。输出为空才通过：其中任何一个出现在
   清单里，客户端就会去拉一个永远 404 的地址（判读与修法见上文 `listing.undeliverable`）。

这几条是唯一能挡住「静默丢失」「重复上线」与「清单说了但拉不到」的检查——门禁本身不负责
这三件事。

## 多人协作

唯一可靠的防丢失办法是**串行化**：同一时刻只允许一台机器跑 `sync:tree`，这台机器要有
一份完整的、不旧于镜像的上游副本。

| 协作规模 | 做法 |
| --- | --- |
| 单人，或指定单一同步机（推荐） | 只在这台机器上跑 `sync:tree`；其他人用仓库做页面开发与验证 |
| 多人，但市场资源有单一负责人 | 由负责人独占同步；其他人只改代码与文档，不碰上游市场 |
| 多人各自维护上游 | 不推荐。至少要约定「谁跑同步谁先通知」，且每次走完标准五步 |

两条容易误判的事：

- **按市场分工不可行。** `--markets` 只用来指定**来源路径**，三个市场每次都会一起镜像。
  所以「我只负责连接器」不成立：只要本机缺专家或技能的副本，那一次同步就会去删它们。
  分工要落到「这个条目由谁改」。
- **种子法保证同源。** 各机器都从仓库的 `market-source/<market>` 拷一份当来源，
  用 `--markets <market>=<该目录>` 指过去，本机「上游」就始终等于仓库镜像，同步只能前进、
  不会因副本旧而回退。要改的条目直接加进这份副本即可（编辑的是仓库之外的中间副本，
  与「禁止手改 `market-source/`」不冲突）。

机器上完全没有市场工作副本时**不要直接跑 `sync`**：上游目录不存在时脚本会立刻退出
（`source missing`，退出码 2，不写盘），但**目录存在却是空的**这种情况更危险——镜像里
所有文件都会被判为 `removed` 而删除，几乎清空。

### `push` 被拒时

不要直接合并一个含 `market-source/` 的分支再推：合并结果不等于任何一台机器的镜像，
而 `_files.txt` 与三个清单是行级合并，很可能只保留一侧内容，树与清单不一致。

```powershell
git --no-pager log --oneline HEAD..origin/main
git --no-pager diff --stat HEAD..origin/main -- market-source content/market.json
```

- 对方也做了市场同步 → 放弃自己这份镜像结果，把上游副本补齐到含对方条目后重做：
  ```powershell
  git checkout origin/main -- market-source content/market.json
  # 把对方新增的条目放回自己的上游副本（可从 market-source/ 拷出），再走标准五步
  ```
- 对方改的是代码或文档 → 常规合并即可，但合并后必须重跑 `bun run sync`（至少
  `sync:market`），让生成物与树重新对齐，然后单独提交生成物。

硬规则：**只要合并动过 `market-source/`，就必须重跑同步，不能手工解冲突。**

### 冲突文件

`_files.txt` 与 `content/market.json` 都是整份重写的生成物，冲突不该被「解决」，只该被重新生成：

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

## 基线（2026-09-17 实测，用于对照）

| 项 | 数值 |
| --- | --- |
| 条目总数 | 877（专家 381、技能 268、连接器 228） |
| 带图标条目 | 648（专家 306 / 381、技能 114 / 268、连接器 228 / 228） |
| `market-source/` 文件数 | 22,612（含三份 `_files.txt`） |
| 三份清单行数 | 专家 14,713、技能 4,633、连接器 3,263 |

> 文件数 2026-09-17 更正：此前记的 22,696 含 84 个只存在于同步机磁盘、进不了提交的文件
> （`….codebuddy/{agents,providers}`，见上文 `listing.undeliverable`）。它们从未进入已发布的
> 树，清单中的对应行已删除。

2026-09-16 批量收录：专家 16 → 381（agent 378 / team 3），覆盖目录 375 个 agent 中的
374 个；`vietnam-finance-tax-expert` 明确放弃。批次与指标见
`docs/market-expert-import-plan.md` §10。

已知的上游侧缺口（站点无需处理，仅需知情）：

- 6 个技能上游只有元数据、没有内容目录：`grill-me`、`handoff`、`mcp-builder`、
  `impeccable`、`web-access`、`skill-creator`。同步时输出警告，不阻断发布。
- 2 个专家缺本地化字段：`frontend-backend-experts`、`software-company`。
- 清单不含分类字段，因此目录页没有分类筛选。

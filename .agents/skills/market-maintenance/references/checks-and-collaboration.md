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

它逐市场检查五件事：重复登记（`manifest.duplicate`）、快照条目数与清单是否一致
（`snapshot.count`）、快照条目集合是否与清单一一对应（`snapshot.entry`）、快照里的头像
路径是否真有文件（`snapshot.avatar-missing`）、`_files.txt` 与树是否互相覆盖（`listing.*`）。
正常时：

```text
✓ experts — 0 finding(s)
✓ skills — 0 finding(s)
✓ connectors — 0 finding(s)

3 market(s), 0 finding(s)
[check-market] content/market.json: experts=13 skills=268 connectors=228 avatars=349
```

出现重复时**去上游删掉多余条目**，不要改镜像。`_files.txt` 里的重复行不必担心：
每次 `sync:tree` 都整份重写它。

## 提交前自检

```powershell
bun run check:market             # 查重 + 两个产物是否一致
bun run sync:tree -- --dry-run   # 应为 +0 -0 ~0（幂等）
git status --short               # 两个产物成对出现，且没有手改过的文件
```

1. `bun run check:market` 退出码为 0。
2. `sync:tree` 的门禁输出 `validation passed — tree is publishable`；出现任何 `✗` 都不提交。
3. `git status` 里 `market-source/` 与 `content/market.json` **成对出现**，且没有手改过的文件。

这几条是唯一能挡住「静默丢失」与「重复上线」的检查——门禁本身不负责这两件事。

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

## 基线（2026-09-16 实测，用于对照）

| 项 | 数值 |
| --- | --- |
| 条目总数 | 512（专家 16、技能 268、连接器 228） |
| 带图标条目 | 352（专家 10 / 16、技能 114 / 268、连接器 228 / 228） |
| `market-source/` 文件数 | 9013（含三份 `_files.txt`） |

2026-09-16 新增 3 个专家：`code-review-expert`、`backend-architect`、`data-engineer`。

已知的上游侧缺口（站点无需处理，仅需知情）：

- 6 个技能上游只有元数据、没有内容目录：`grill-me`、`handoff`、`mcp-builder`、
  `impeccable`、`web-access`、`skill-creator`。同步时输出警告，不阻断发布。
- 2 个专家缺本地化字段：`frontend-backend-experts`、`software-company`。
- 清单不含分类字段，因此目录页没有分类筛选。

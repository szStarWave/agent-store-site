# 升级与迁移指引

本文档面向集成 Flowy Agent Store 的开发者，阐述 `@flowy-agent-store/{protocol,client,sdk}` 及其平台依赖包的版本演进策略、兼容性约束及各版本迁移步骤。

## 1. 兼容性承诺（当前口径）

**预发布阶段不提供向后兼容承诺。** 当前软件包处于 `0.1.0-beta.*` 预发布阶段，API 规范尚未冻结：类型声明收窄、接口方法增删及事件模型调整可能在 beta 迭代中引入。

版本演进原则：

- beta 线内的**破坏性变更随下一个预发布版本发布**（如 `0.1.0-beta.3` $\to$ `0.1.0-beta.4`），并在 [变更日志](/zh-CN/docs/changelog) 中明确标注文档与迁移方案；次版本号（如 `0.2.0`）保留给退出 beta 阶段后的破坏性更新。
- 每次发布的详细变更分类详见 [变更日志](/zh-CN/docs/changelog)。

工程集成建议：

- 生产环境务必**锁定确切版本号**（详见 §5），避免依赖包管理器对未固定版本的动态解析（详见 §4）；
- 版本升级前应查阅目标版本的 [变更日志条目](/zh-CN/docs/changelog)，并执行 §6 中的迁移步骤。

## 2. 已发布的版本序列（事实）

下表汇总已发布版本的发布记录、标签指向及变更属性：

| 版本 | 发布时间（UTC） | 当前 dist-tag | 与上一版的实质差异 |
| --- | --- | --- | --- |
| `0.1.0-beta.7` | 2026-09-20T10:33:48Z | `beta` | **破坏性**：协议指纹递增至 `fp-8`（握手全等校验）；新增 WebSocket 专用接口 `agent/export` 与 `team/export`，方法总数扩充至 73；接口参数保持平稳（升级步骤见 §6.6） |
| `0.1.0-beta.6` | 2026-09-18T11:08:21Z | — | **破坏性**：SDK 入口与结构重构（`launchClient` 重命名为 `launchHarness`，移除 `.client` 包装，`initializeResult` 调整为 `handshake`），需同步修改调用代码；线协议维持 `fp-7`（升级步骤见 §6.5） |
| `0.1.0-beta.5` | 2026-09-17T11:41:10Z | — | **破坏性**：协议指纹调整为 `fp-7`；扩充连接器工具 `input_schema`、单轮技能挂载、`agent_id`/`team_id` 会话参数及 `zip` 市场源协议（升级步骤见 §6.4） |
| `0.1.0-beta.4` | 2026-09-16T10:24:02Z | — | **破坏性**：协议指纹调整为严格全等模式 `fp-1`；`event_type` 收窄为封闭联合 `ConversationEventType`；新增技能文件读取与连接器代理功能（升级步骤见 §6.3） |
| `0.1.0-beta.3` | 2026-09-10T04:44:34Z | — | 增强客户端生命周期订阅（`onLifecycle`、退出监测）；补全 `engines.node >= 22` 与元数据声明（升级步骤见 §6.1） |
| `0.1.0-beta.2` | 2026-09-09T09:27:36Z | `latest` | 补齐 SDK 的平台运行时依赖包声明（涵盖 darwin、linux、win32 架构） |
| `0.1.0` | 2026-09-09T09:09:04Z | 无 | 初始发布版本；核心代码及类型与 `beta.2` 一致，未包含平台包可选依赖 |

## 3. dist-tag 语义

`dist-tag` 为 npm 仓库的可变标签引用：

| dist-tag | 当前指向 |
| --- | --- |
| `latest` | `0.1.0-beta.2` |
| `beta` | `0.1.0-beta.7` |

```bash
npm view @flowy-agent-store/sdk versions dist-tags --json
```

```json
{
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0-beta.5", "0.1.0-beta.6", "0.1.0-beta.7", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.7", "latest": "0.1.0-beta.2" }
}
```

注意事项：
1. `latest` 标签并不代表最新代码提交，当前固定于 `0.1.0-beta.2`，最新预发布版本通过 `beta` 标签维护。
2. 初始版本 `0.1.0` 无关联标签，但版本范围选择器可能匹配该版本。

## 4. 裸安装与范围解析

默认安装命令将解析至 `latest` 标签对应的历史版本；部分包管理器写入的非精确版本范围（如 `^0.1.0-beta.2`）在不同工具间可能产生歧义解析。

```bash
bun add @flowy-agent-store/sdk                     # → 0.1.0-beta.2（latest）
bun add @flowy-agent-store/sdk@beta                # → 0.1.0-beta.7
bun add '@flowy-agent-store/sdk@^0.1.0-beta.2'     # → 解析为 0.1.0-beta.2
npm view '@flowy-agent-store/sdk@^0.1.0-beta.2' version   # → 可能解析为 0.1.0
```

规范要求：**生产工程严禁依赖非精确版本范围或动态标签**，应将明确的版本号写入 `package.json`。

## 5. 固定确切版本（推荐做法）

```bash
# 声明确切版本号安装
bun add @flowy-agent-store/sdk@0.1.0-beta.7
bun add @flowy-agent-store/protocol@0.1.0-beta.7

# 使用 npm / pnpm
npm install @flowy-agent-store/sdk@0.1.0-beta.7
```

确保 `package.json` 中移除了 `^` 或 `~` 等范围前缀，并将生成的 Lockfile（`bun.lock`、`package-lock.json` 或 `pnpm-lock.yaml`）提交至代码版本控制系统。

## 6. 逐版本升级步骤

### 6.1 从 0.1.0-beta.2 升到 0.1.0-beta.3

此版本不包含破坏性变更，接口纯增量扩充：

```bash
# 1) 查看当前安装版本
bun pm ls | grep '@flowy-agent-store'
# 2) 安装目标固定版本
bun add @flowy-agent-store/sdk@0.1.0-beta.3
bun add @flowy-agent-store/protocol@0.1.0-beta.3
# 3) 校验解析结果
node -p "require('@flowy-agent-store/sdk/package.json').version"
# 4) 执行类型检查与单测
bun run typecheck && bun run test
```

若通过 `AGENT_STORE_BIN` 引用自定义二进制，需确保二进制版本与 SDK 同步更新以满足握手校验。

### 6.2 从 0.1.0 回到 beta 线

从未打标的 `0.1.0` 迁移至标准预发布版本：

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.7
bun pm ls | grep '@flowy-agent-store'
```

### 6.3 从 0.1.0-beta.3 升到 0.1.0-beta.4

此版本引入破坏性变更：

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.4
bun add @flowy-agent-store/protocol@0.1.0-beta.4
bun run typecheck && bun run test
```

核心适配项：
1. **协议指纹全等比对**：指纹更新为 `fp-1`，必须同步更新运行时二进制。
2. **事件类型收窄**：`ConversationEvent.event_type` 调整为封闭联合 `ConversationEventType`，调用方需通过 `decodeConversationEvent` 判定类型。

### 6.4 从 0.1.0-beta.4 升到 0.1.0-beta.5

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.5
bun add @flowy-agent-store/protocol@0.1.0-beta.5
bun run typecheck && bun run test
```

- **协议指纹变更**：指纹升级为 `fp-7`，需同批升级二进制运行时。
- **代理授权规则变更**：`[connector_proxy]` 中的 `allow` 调整为可选白名单，未声明 `allow` 时默认放行所有已启用连接器。

### 6.5 从 0.1.0-beta.5 升到 0.1.0-beta.6

此版本调整了 SDK 编程接口：

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.6
bun add @flowy-agent-store/protocol@0.1.0-beta.6
bun run typecheck
```

代码迁移对照：

```ts
// 历史用法（0.1.0-beta.5）
const session = await launchClient({ client: { name: "my-app", version: "1.0.0" } });
await session.client.conversations.create({ name: "demo" });
session.initializeResult.protocol_version;

// 新版规范（0.1.0-beta.6）
const harness = await launchHarness({ client: { name: "my-app", version: "1.0.0" } });
await harness.conversations.create({ name: "demo" });
harness.handshake.protocol_version;
```

1. 入口函数重命名为 `launchHarness`；
2. 业务客户端直接挂载于返回值根路径；
3. 握手结果属性重命名为 `handshake`。

### 6.6 从 0.1.0-beta.6 升到 0.1.0-beta.7

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.7
bun add @flowy-agent-store/protocol@0.1.0-beta.7
bun run typecheck
```

- 协议指纹递增至 `fp-8`，客户端与运行时需保持版本对齐；
- 新增 `agents.export` 与 `teams.export` 接口，支持资产结构导出。

## 7. 自查当前安装的版本

```bash
# 查看项目实际解析到的版本
bun pm ls | grep '@flowy-agent-store'
# 读取已安装模块 package.json
node -p "require('@flowy-agent-store/protocol/package.json').version"
# 校验 Lockfile 锁定记录
grep -o '@flowy-agent-store/sdk@[0-9][^"]*' bun.lock | head -1
# 查看远程仓库标签状态
npm view @flowy-agent-store/sdk versions dist-tags --json
```

## 8. 已发布产物的差异与自查方法

截至 `0.1.0-beta.7`，工作区与线上发布产物保持一致：

1. **资产导出协议接口 —— `fp-7` $\to$ `fp-8`**：新增 `agent/export` 与 `team/export` 方法，总协议方法扩充至 73。
2. **宿主配置项对齐**：配置文件支持 `[memory]` 的 `enabled` 独立开关及 `max_output_size` 映射。

### 8.1 迁移已有配置里的市场源

官方市场源已全面迁移至 ModelScope 单 Zip 归档架构，历史文件树路径已废弃。若本地 `~/.agent-store/config.toml` 包含旧版 URL：

```toml
[default_marketplaces.experts]
source_kind = "url"
source = "https://agent-store.flowyaipc.cn/source/experts/.codebuddy-plugin/marketplace.json"
```

处理方案：
- 直接移除 `[default_marketplaces]` 配置块以采用运行时内置默认源；
- 或将源配置更新为官方 Zip 归档格式：

```toml
[default_marketplaces.experts]
source_kind = "zip"
source = "https://www.modelscope.cn/models/me9rez/flowy-marketplace/resolve/master/experts.zip"

[default_marketplaces.skills]
source_kind = "zip"
source = "https://www.modelscope.cn/models/me9rez/flowy-marketplace/resolve/master/skills.zip"

[default_marketplaces.connectors]
source_kind = "zip"
source = "https://www.modelscope.cn/models/me9rez/flowy-marketplace/resolve/master/connectors.zip"
```

差异验证脚本范例：

```bash
# 验证协议导出符号差异
mkdir -p b6 b7
(cd b6 && npm pack @flowy-agent-store/protocol@0.1.0-beta.6 --silent && tar xzf *.tgz)
(cd b7 && npm pack @flowy-agent-store/protocol@0.1.0-beta.7 --silent && tar xzf *.tgz)
diff <(grep -o '^export [a-z]* [A-Za-z]*' b6/package/dist/index.d.mts) \
     <(grep -o '^export [a-z]* [A-Za-z]*' b7/package/dist/index.d.mts)
```

## 9. changelog 与 release notes 的边界

| 事项 | 现状 | 依据 |
| --- | --- | --- |
| 破坏性变更版本号 | beta 阶段随预发布序号更新并标明破坏性影响 | 兼容性承诺原则（beta 期间不承诺绝对向后兼容） |
| 独立变更日志页面 | [变更日志](/zh-CN/docs/changelog) | 规范化版本记录 |
| 本页职责 | 提供版本演进事实与具体升级迁移指引 | 保持操作导向 |
| 与 changelog 的分工 | 本页说明迁移流程；changelog 记录版本详细功能变更 | 双向交叉引用 |

## 10. 另见

- [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk)：接口参数与错误模型说明。
- [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk)：各场景开箱即用代码实现。
- [快速开始](/zh-CN/docs/quick-start)：单文件二进制运行指南。
- [兼容性矩阵](/zh-CN/docs/compatibility)：平台及数据格式支持边界。
- [变更日志](/zh-CN/docs/changelog)：已发布版本的详细改动记录。

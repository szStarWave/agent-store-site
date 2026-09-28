# Flowy Agent Store — 官方网站与文档中心

<p align="center">
  <img src="src/assets/logo.png" alt="Flowy Agent Store Logo" width="120" />
</p>

<p align="center">
  <strong>本地优先（Local-First）、单文件架构的智能体运行时官方门户</strong>
</p>

<p align="center">
  <a href="https://docusaurus.io/"><img src="https://img.shields.io/badge/Docusaurus-3.10-3ECC5F?logo=docusaurus" alt="Docusaurus 3.10" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.8+-3178C6?logo=typescript" alt="TypeScript" /></a>
  <a href="https://bun.sh/"><img src="https://img.shields.io/badge/Bun-1.1+-fbf0df?logo=bun" alt="Bun" /></a>
  <a href="https://github.com/szStarWave/agent-store-site/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-blue.svg" alt="License" /></a>
  <img src="https://img.shields.io/badge/Protocol-fp--12-orange" alt="Protocol fp-12" />
</p>

---

## 📌 项目概述

**Flowy Agent Store** 是一款面向本地优先架构的智能体运行时系统，提供轻量单文件二进制、内嵌现代化 Web UI 工作台，并通过统一的 App Server 协议支持 CLI、SDK 与 IDE 全场景集成。

本仓库（`agent-store-site`）是 Flowy Agent Store 的**官方门户站点**，采用纯静态站点生成（SSG）架构，同时承担三项核心职责：

1. 🎯 **产品落地页（Product Landing Page）**：基于暖白珊瑚红视觉风格呈现产品全景架构、核心技术支柱、交互式工作流以及多端生态兼容矩阵；
2. 📚 **双语技术文档站（Bilingual Docs Station）**：提供架构设计、快速开始、配置规范、TypeScript SDK、SDK 实操范式及版本迁移的双语完整技术文档（中文 `/zh-CN/docs/*` 与英文 `/en-US/docs/*`）；
3. 🧩 **生态资源市场目录（Marketplace Catalog）**：聚合专家（Agent）、技能（Skill）、连接器（MCP Connector）三大市场源索引快照与元数据，支持全量检索与能力预览。

> [!NOTE]
> 本站原先基于 React Router v8（Framework 模式 + SSG）与 Vite 8 构建，现已整站平滑迁移至 **Docusaurus 3.10**。完整的迁移考量、架构取舍与避坑实践见 [迁移纪要](docs/docusaurus-migration.md)。

---

## 🛠️ 技术栈与核心特性

- **静态站点生成（SSG）**：Docusaurus 3.10 驱动，预渲染全量 HTML 页面，无任何服务端运行时依赖；
- **现代前端生态**：React 19 + TypeScript 5.8+ + Bun 包管理与脚本执行环境；
- **原生双语前缀架构**：采用「单 Locale + 双 Docs 插件实例」架构，严格保留 `/zh-CN/` 与 `/en-US/` 显式路由前缀，文档正文内部互链严格对称；
- **极简原生 CSS 架构**：纯 CSS 变量（`tokens.css`）+ 站点组件样式（`style.css`）+ Docusaurus 外壳覆盖（`docusaurus-overrides.css`），不依赖任何 Tailwind / UnoCSS 编译流水线；
- **历史锚点算法兼容**：内置 `src/remark/legacy-heading-ids.ts` 插件，确保已有外链和历史锚点（含复杂中文标点）永久有效；
- **高性能市场树构建**：构建期仅拷贝目录页头像资产，规避静态目录大文件阻塞，产物体积与文件数量严格控制在边缘托管平台上限之内。

---

## 🚀 快速开始

### 依赖环境
- [Bun](https://bun.sh/) ≥ 1.1（推荐）或 Node.js ≥ 22
- Git

### 本地开发

```bash
# 1. 克隆代码仓库
git clone https://github.com/szStarWave/agent-store-site.git
cd agent-store-site

# 2. 安装项目依赖
bun install

# 3. 启动本地开发服务器（默认端口 5173）
bun run dev
```

浏览器访问 `http://127.0.0.1:5173` 即可实时预览全站页面与双语文档。

> [!TIP]
> 若在 Windows PowerShell 启动时遇到 `safe-delete` 或 `trash` 操作异常报错，请先在当前终端执行 `$env:NODE_OPTIONS=""` 清空干扰环境变量后再行启动。

---

## 📋 常用命令清单

项目提供了一组开箱即用的 NPM/Bun 脚本，覆盖本地研发、市场同步、静态打包与门禁校验全周期：

| 命令 | 类别 | 功能说明 |
| --- | --- | --- |
| `bun run dev` | 本地开发 | 启动本地热重载开发服务器（`docusaurus start --host 127.0.0.1 --port 5173`） |
| `bun run build` | 静态编译 | 执行 Docusaurus SSG 静态打包至 `build/`，并自动拷贝市场头像至 `build/source/` |
| `bun run preview` | 产物预览 | 本地静态托管 `build/` 目录（**刻意不设 SPA 兜底**，严格暴露 404 漏拷贝缺陷） |
| `bun run typecheck` | 类型检查 | 执行 TypeScript 全量静态类型检查（`tsc --noEmit`） |
| `bun run sync` | 市场同步 | 完整市场树与快照同步流程（串联 `sync:tree` + `sync:market`） |
| `bun run sync:tree` | 市场镜像 | 将本地三个市场工作目录镜像写入 `market-source/` 并生成 `_files.txt` |
| `bun run sync:market` | 快照生成 | 解析 `market-source/` 生成前端目录页数据源快照 `content/market.json` |
| `bun run import:experts` | 专家导入 | 从上游专家市场 bundle 批量拉取专家至站外副本与存档目录 |
| `bun run check:docs-sync` | 文档门禁 | 双语文档结构强一致性门禁（核验标题、代码块、表格与链接对称性） |
| `bun run test:docs-sync` | 文档测试 | 执行双语文档同步检测脚本自身的单元测试套件 |
| `bun run check:market` | 市场门禁 | 校验市场清单重复项，并核对 `market-source/` 与 `content/market.json` 的一致性 |
| `bun run test:market` | 市场测试 | 执行市场校验逻辑与清单算法的单元测试套件 |
| `bun run test:market-zips` | 归档测试 | 校验确定性 Zip 压缩逻辑、CRC32 校验与大小写防撞库单测 |
| `bun run check:release` | 发布门禁 | 站点发版综合大门禁（`check:docs-sync` + `test:*` + `check:market` + `typecheck`） |

---

## 🏛️ 目录结构

```text
agent-store-site/
├── .agents/                 # 智能体技能与协作配置 (.agents/skills/market-maintenance)
├── content/                 # 静态内容与权威数据源
│   ├── docs/                # 双语 Markdown 文档（非生成物，正文纯 Markdown 解析）
│   │   ├── zh-CN/           # 中文文档站（架构、快速开始、SDK、配置等 10 篇）
│   │   └── en-US/           # 英文文档站（与 zh-CN 结构 100% 对齐）
│   ├── market.json          # 市场目录页聚合快照（由 sync:market 脚本自动生成）
│   └── release.json         # 发布版本号单一真源（站点 UI 与发版脚本共用）
├── docs/                    # 面向站长与维护者的中文开发与运维指南（不进入站点编译）
│   ├── docusaurus-migration.md # 框架迁移纪要与避坑记录
│   ├── market-maintenance.md   # 市场资源维护与同步排错指南
│   ├── release-process.md      # 站点与上游源仓库协同发版流程
│   └── deploy-trigger.md       # EdgeOne Makers 手动触发部署实操指南
├── market-source/           # 市场树本地镜像（约 22.6k 文件，严格作为生成物受版本控制）
│   ├── experts/             # 专家（Agent）市场清单与资源树
│   ├── skills/              # 技能（Skill）市场清单与资源树
│   └── connectors/          # 连接器（MCP Connector）市场清单与资源树
├── scripts/                 # 研发工程脚本（构建拷贝、预览、门禁、发版工具链）
├── src/                     # 站点应用源码
│   ├── assets/              # 全局通用静态媒体资源（Logo、Web UI 实拍截图等）
│   ├── clientModules/       # Docusaurus 客户端增强模块（Prism JSONC 高亮补全）
│   ├── components/          # 通用 React UI 组件（代码复制、SEO 元信息、折叠问答等）
│   ├── css/                 # 样式体系（tokens 全局令牌 / style 站点样式 / overrides 外壳）
│   ├── i18n/                # 站点双语文本字典与上下文提供者（zh-CN.ts / en-US.ts）
│   ├── lib/                 # 基础工具库（平台检测、市场数据模型、文档排序登记表）
│   ├── pages/               # 页面级路由定义（根重定向、双语首页、市场页、文档入口）
│   ├── plugins/             # 本地 Docusaurus 扩展插件（开发态源码映射、作用域隔离）
│   ├── remark/              # Remark AST 转换插件（历史锚点算法兼容插件）
│   ├── theme/               # Swizzle 主题扩展层（Root 状态注入、双语导航与页脚包装）
│   └── views/               # 核心大视图组件（Landing 落地页、Market 市场页）
├── static/                  # 纯静态资源托管目录（install.ps1 脚本、favicon 图标）
├── docusaurus.config.ts     # Docusaurus 核心配置文件（双 Docs 实例、Prism、构建规则）
├── edgeone.json             # 腾讯云 EdgeOne Makers 部署与缓存规则配置
├── package.json             # 依赖声明与任务脚本
└── tsconfig.json            # TypeScript 编译选项配置
```

---

## 📦 市场资源与托管机制

### 市场源规格定义

站点对外部运行时（Agent Store 宿主程序）提供三类标准的市场清单入口：

| 市场类型 | 标识与清单文件 | 目录索引清单 |
| --- | --- | --- |
| 专家市场（Experts） | `/source/experts/.codebuddy-plugin/marketplace.json` | `/source/experts/_files.txt` |
| 技能市场（Skills） | `/source/skills/.codebuddy-skill/marketplace.json` | `/source/skills/_files.txt` |
| 连接器市场（Connectors） | `/source/connectors/.codebuddy-connector/connectors.json` | `/source/connectors/_files.txt` |

### 生产托管边界与优化

1. **避免静态目录遍历风暴**：
   - 市场源文件树（含全量历史资产约 22,600+ 文件）**严禁置于 `static/` 目录下**；
   - Docusaurus 在编译时会对 `static/` 执行深层全量拷贝，会导致本地开发与 CI 构建耗时剧增并耗尽内存；
   - 本站由 `scripts/copy-market-tree.mjs` 在 `docusaurus build` 结束后，按需精准抽取市场卡片所需的图标资产（约 648 个文件）拷贝至 `build/source/`。
2. **ModelScope 归档解耦**：
   - 当前官方市场完整包已迁移至 ModelScope 的 Zip 归档服务；
   - 官网生产环境严守边缘托管平台的两项硬限制（**文件总数 ≤ 20,000**，**单文件 ≤ 25 MiB**），仅托管目录页图片与轻量元数据。

---

## 🔒 核心开发约束与设计守则

为保证站点在持续集成与长期维护中的稳定性，本仓库确立了以下几条必须严格遵守的**硬约束**：

### 1. 生成物严禁手工编辑
- `market-source/` 是上游市场的镜像，`content/market.json` 是目录页快照。**两者只能由 `bun run sync` 写入**；
- 两个产物强关联，必须成对提交，严禁单侧修改，否则会造成页面与静态文件映射失配；
- 每次修改后必须跑通 `bun run check:market`。

### 2. 双语技术文档结构强对齐
- `content/docs/zh-CN/` 与 `content/docs/en-US/` 必须具备完全对应的同名 Markdown 文档；
- 翻译文案允许根据语言习惯本土化重写，但**标题层级深度、代码块数量与标注语言、表格列数、相对路由链接必须 100% 对齐**；
- 新增或调整文档必须在 `src/lib/docOrder.ts` 中同步登记，构建期将执行严格一致性核验；
- 提交前必须通过 `bun run check:docs-sync` 门禁。

### 3. 禁止开启 Docusaurus 内置 i18n
- 站点要求对外 URL 保留显式 `/zh-CN/` 与 `/en-US/` 路径前缀（正文中存在超百处强依赖前缀的静态链接）；
- Docusaurus 默认 i18n 会省略默认语言的路径前缀，因此本项目采用单 locale + 两个独立 docs 插件实例进行加载，切勿启用全局 i18n 配置。

### 4. 禁止给 `package.json` 添加 `"type": "module"`
- Docusaurus 内部生成的 `.docusaurus/*.js` 具有 CommonJS 形态；
- 一旦根目录标记为 ESM 模块，Webpack 在构建 Server Bundle 时会将部分模块当作原生 ESM 处理，导致 `require.resolveWeak` 丢失并在 SSG 渲染阶段抛出严重运行时异常。

### 5. UI 字符串双向成对增加
- 全站 UI 文本收敛于 `src/i18n/zh-CN.ts` 与 `src/i18n/en-US.ts`，增加或修改配置项时两侧必须同步增改；`zh-CN` 作为兜底回退语言。

---

## 🚢 部署与发版流程

### 边缘托管（EdgeOne Makers）

站点部署托管于 **腾讯云 EdgeOne Makers（Pages）**，构建配置见同目录 [`edgeone.json`](./edgeone.json)：

```json
{
  "installCommand": "bun install",
  "buildCommand": "bun run build",
  "outputDirectory": "build"
}
```

- **静态长期缓存**：`/assets/**`（编译产出的哈希静态资源）配置 `max-age=31536000, immutable`；
- **强校验缓存**：`/source/**`（市场头像与元数据文件无哈希）配置 `max-age=0, must-revalidate`，确保图标更换后客户端即时刷新；
- **拒绝 SPA 兜底**：切勿添加未命中回退 `index.html` 的 Rewrite 规则，防止静态资源 404 时将 HTML 误作为 JS 加载导致语法解析崩溃。

> [!WARNING]
> **自动构建触发说明**：当前 EdgeOne 平台的 GitHub 自动化构建触发可能存在偶发延迟或失效。如推送至 `main` 后未自动触发部署，需调用 OpenAPI 执行手动触发，具体实操步骤请参考 [手动触发部署指南](docs/deploy-trigger.md)。

### 发版协同机制

每次正式发版涉及双出口发布（源仓库 `allo` 的 NPM 包与二进制发布 + 本站官网文档与 release 快照更新）：
1. 权威发布指引以源仓库 `docs/agent-store/25-release-runbook.zh.md` 为准；
2. 站点侧发版步骤、依赖包版本锁步规则与自检清单见 [发布流程指南](docs/release-process.md)；
3. 发版前须确保在源仓库跑通 `bun run release:check`，并在本仓库跑通 `bun run check:release`。

---

## 📖 维护文档索引

面向项目维护者的专题目录文档（位于 `docs/` 下，不发布至线上站点）：

| 文档路径 | 核心内容说明 |
| --- | --- |
| [`docs/docusaurus-migration.md`](docs/docusaurus-migration.md) | **架构迁移全景纪要**：框架取舍、目录落点映射、Swizzle 组件包装与六大核心踩坑实录 |
| [`docs/market-maintenance.md`](docs/market-maintenance.md) | **市场维护实操手册**：条目规范、同步操作、冲突处理、托管边界与门禁报错排查 |
| [`docs/release-process.md`](docs/release-process.md) | **跨仓协同发版流程**：版本号单一真源、站点侧发布动作序列与部署后自动化验证 |
| [`docs/deploy-trigger.md`](docs/deploy-trigger.md) | **EdgeOne 手动触发指南**：Pages API 鉴权、签名构建、部署日志排查与自检流程 |
| [`docs/connector-coverage.md`](docs/connector-coverage.md) | **连接器市场覆盖现状**：生态连接器分类、成熟度评级与近似项甄别判定标准 |
| [`docs/market-expert-import-plan.md`](docs/market-expert-import-plan.md) | **专家批量导入方案**：从上游官方市场 bundle 获取专家并处理版本快照的规划与规范 |

---

## 📄 开源许可证

本项目基于 [Apache License 2.0](LICENSE) 许可证开源。

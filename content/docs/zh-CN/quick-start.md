# 快速开始

Flowy Agent Store 将本地优先的 Agent 运行时与完整 Web UI 打包为**单可执行文件**分发。系统无需依赖外部数据库、容器编排或后台守护进程，解压即可运行。

## 1. 下载并启动

从 [GitHub Releases](https://github.com/szStarWave/agent-store-site/releases) 下载对应操作系统的发布包，解压后执行主程序：

```bash
flowy-agent-store
```

程序将在本地启动 App Server（默认端口 `http://localhost:8787`），并自动调用系统默认浏览器打开工作台。

> 本地优先特性：所有执行逻辑、私有凭据与会话状态均仅留存于本机；云端仅用于能力定义、版本元数据与归档分发。

## 2. 导入 Agent

工作台支持导入 CodeBuddy / WorkBuddy 格式的专家（Agent）、技能（Skill）与连接器（Connector）。导入后的资源将转换为**不可变快照（Immutable Snapshot）**，可在目录中检索与调用。

若需预置默认市场源或配置大模型 API 供应商，可执行环境初始化向导（可选）：

```bash
flowy-agent-store init
```

## 3. 启动一次运行

在资源目录中选择指定 Agent 并触发运行，系统将生成对应的执行实例（Run）。执行事件流、编排计划图（DAG）及生成的产物（Artifact）将通过工作台面板实时渲染。

## 下一步

- 查阅 [命令行用法](/zh-CN/docs/cli) 了解完整启动参数与环境变量。
- 查阅 [架构说明](/zh-CN/docs/architecture) 理解 Runtime 与 App Server 协议分层。
- 查阅 [兼容性矩阵](/zh-CN/docs/compatibility) 确认操作系统平台与数据来源格式支持情况。
- 如需在 Node.js / Electron / 浏览器中集成，请查阅 [TypeScript SDK 接口参考](/zh-CN/docs/typescript-sdk) 与 [TypeScript SDK 实战示例](/zh-CN/docs/examples-sdk)（桌面终端用户推荐直接使用二进制安装包，开发者推荐集成 npm 软件包）。

# 命令行用法

`flowy-agent-store` 是单文件运行时统一入口：后端服务与内嵌 Web UI 共用同一网络端口。默认直接运行即进入服务模式，并提供可选的 `init` 交互式向导。

## 启动 Web UI

```bash
flowy-agent-store
flowy-agent-store --port 8787
```

默认监听 `http://127.0.0.1:8787/`，启动后自动在系统默认浏览器中打开工作台。

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| `--port <n>` | 监听端口（API 与内嵌 Web UI 共用）；指定 `--port 0` 由系统动态分配空闲端口 | `8787` |
| `--host <ip>` | 绑定地址；本机独立运行时保持 `127.0.0.1` | `127.0.0.1` |
| `--data-dir <dir>` | 数据存储目录（含数据库与快照）；缺省为对应发布通道的用户目录（如 dev 通道为 `%LOCALAPPDATA%\Flowy\Nomi-dev`） | 用户级 Flowy/Nomi 数据目录 |
| `--auth` | 启用密码认证模式；未指定时为本地可信免密模式 | 关闭 |
| `--no-open` | 启动后不自动唤起浏览器 | 自动唤起 |
| `--admin-user <name>` | 认证模式下预置的管理员用户名 | `admin` |
| `--admin-password <pw>` | 认证模式下预置的管理员密码；未指定时在首次访问 Web UI 时由用户设置 | 无 |
| `-h, --help` / `-V, --version` | 查看帮助信息 / 版本号 | — |

## 子命令

除默认服务模式外，系统提供以下子命令：

| 子命令 | 作用 |
| --- | --- |
| `flowy-agent-store init` | 交互式初始化向导：向 `~/.agent-store/config.toml` 写入内置市场源并引导配置首个 API 供应商。此步骤为可选操作；未配置时直接加载默认市场源，详见 [配置文件](/zh-CN/docs/configuration) |

## 启动时打在 stdout 的那一行

宿主进程成功绑定端口后，将向标准输出（stdout）输出单行机器可读 JSON 就绪通知（系统日志亦输出至 stdout，该行不保证为首行）：

```json
{"agent_store":"listening","host":"127.0.0.1","port":8787,"url":"http://127.0.0.1:8787/","protocol_version":"…","version":"…","auth":"disabled-local"}
```

- **SDK 进程拉起契约**：SDK 逐行扫描 stdout，仅匹配包含 `"agent_store": "listening"` 的 JSON 载荷；该输出不包含任何敏感密钥。
- `auth` 字段声明鉴权模式：`disabled-local`（本地免密模式）或 `required`（密码认证模式）。
- `protocol_version` 为协议版本指纹，客户端初始化握手时执行严格全等校验。跨版本兼容性与升级规范详见 [升级与迁移指引](/zh-CN/docs/upgrade)。

## 常用示例

```bash
# 端口占用时指定备用端口（Web UI 自动连接当前同源后端）
flowy-agent-store --port 8788

# 局域网共享访问（建议配合 --auth 启用认证）
flowy-agent-store --host 0.0.0.0 --auth

# 启用密码认证并预置管理员凭据
flowy-agent-store --auth --admin-user admin --admin-password <pw>

# 无头服务器（Headless）部署并指定自定义数据目录
flowy-agent-store --data-dir /data/agent-store --no-open
```

## 环境变量

各命令行参数均支持对应的环境变量替代：`AGENT_STORE_HOST`、`AGENT_STORE_PORT`、`AGENT_STORE_AUTH`（设为 `1`/`true`/`yes`/`on` 时生效）、`NOMIFUN_DATA_DIR` / `FLOWY_DATA_DIR`（自定义数据目录）、`NOMIFUN_ADMIN_USERNAME` / `NOMIFUN_ADMIN_PASSWORD`（认证模式初始管理员凭据）。

## 说明

- **端口冲突处理**：默认端口被占用时进程将报错退出。可终止冲突进程或通过 `--port` 指定新端口；传入 `--port 0` 可由系统动态分配空闲端口，实际地址通过 stdout 就绪通知解析（推荐用于 CI 与并发测试）。
- **Web UI 自动寻址**：内嵌前端自动基于当前页面的源地址建立通信，修改 `--port` 或 `--host` 后无需手动更新服务连接，设置页亦支持手动覆盖。
- **数据目录互斥锁**：后端独占锁定数据目录。桌面端与命令行服务并发访问同一目录时将触发锁保护并快速失败，避免数据损坏。
- **网络访问安全**：监听非回环地址（如 `--host 0.0.0.0`）且未启用 `--auth` 时，网络内所有客户端均具备完全主机调用权限；暴露至非受信网络时必须开启 `--auth`。
- **架构访问边界**：资源导入、运行调度与状态查询均统一通过 App Server 协议进行，禁止直接读写底层数据库或私有凭据存储。

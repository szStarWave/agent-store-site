# 架构说明

Flowy Agent Store 采用**本地优先（Local-First）**的分层架构：云端仅管理资源定义与分发，本机负责核心运行时与状态执行。

## 分层

```text
CodeBuddy / WorkBuddy 来源目录
        ↓ Importer（路径/摘要/兼容性校验）
PluginSnapshot（版本化、不可变）
        ↓ Catalog
Agent / Team / Skill / Connector 定义
        ↓ Runtime Adapter（领域对象 → allo 执行语义）
allo Runtime（Rust，唯一执行引擎）
        ↓ Versioned App Server Protocol
TS SDK · CLI · Web UI（协议客户端）
```

## 关键边界

- **Runtime**：`allo` 为系统唯一执行引擎，打包为单二进制文件分发，具备零外部依赖与低资源占用特性。
- **App Server 协议**：SDK、CLI 与 Web UI 统一依赖此协议。协议提供强类型、具版本标识的生命周期与事件通信；公开资源标识符均为不透明字符串（opaque ID），隔离内部底层执行标识。
- **Runtime Adapter**：领域模型与 `allo` 内部运行时之间的唯一适配边界。Agent Team 的规划上下文（Planning Context）在运行时动态派生，严格隔离成员完整系统提示词与私密凭据。
- **凭据管理**：敏感凭据仅留存于本地安全存储。上层接口（Web / SDK）仅暴露凭据配置状态、账号标识与有效期，杜绝明文 Token 泄漏。

## Agent Team（V1）

采用固定成员编排与 Leader 规划上下文驱动的**计划有向无环图（Planned DAG）**：

- Leader 承担规划角色，不创建独立会话；
- 独立执行步骤（Step）支持细粒度并行执行、自动重试与动态重新规划（Replan）；
- 执行事件流、派生产物（Artifact）与终态持久化存储，支持完整检索与历史重放。

## 设计原则

- 优先完成单 Agent 契约验证，再进行多 Agent 协同（Team）编排；
- 事件日志（Event Log）作为系统唯一真实来源，所有运行时状态均为投影派生；
- 未通过运行时环境验证的能力，严禁标记为可运行状态。

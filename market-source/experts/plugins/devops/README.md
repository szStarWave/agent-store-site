# DevOps Delivery Expert / 部署运维专家

A WorkBuddy expert plugin for DevOps practices: CI/CD pipelines, infrastructure as code, container deployments, secrets management, and monitoring/alerting for reliable service delivery.

## Capabilities

- **CI/CD Pipelines** — fail-fast ordering, dependency caching, SHA-pinned actions, secret masking, parallel jobs.
- **Deployment Strategies** — blue-green, canary, rolling; build once, promote through stages; always-with-rollback.
- **Infrastructure as Code** — version-controlled Terraform/Ansible/CloudFormation, plan-before-apply, encrypted remote state, module reuse, workspace-separated environments.
- **Containers** — one process per container, mandatory health checks, non-root user, immutable images tagged by git SHA.
- **Secrets Management** — never in git, rotation automation, per-environment isolation, access audit, memory over disk.
- **Monitoring & Reliability** — four golden signals, symptom-based actionable alerts, SLOs and error budgets, chaos drills, blameless post-mortems.

## Quick Prompts

1. 帮我设计一条可靠的CI/CD流水线
2. 检查我的Dockerfile安全最佳实践
3. 设计基础设施监控告警方案

## Installation

Drop this directory into your WorkBuddy marketplace plugins folder. The plugin is registered via `.codebuddy-plugin/plugin.json` and exposes the `devops` agent.

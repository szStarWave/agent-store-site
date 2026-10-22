# 用 API Token 部署到 EdgeOne Makers

> 最后核对：2026-10-22（含真实部署验证 `dphseubl3zh9`）  
> 核心机制：本站项目属性为 `Provider: Github` 型（平台拉取代码仓库并在云端构建），`edgeone makers deploy` 的静态产物上传通道不适用；自动化部署方案是通过 **EdgeOne API Token** 调用 `CreatePagesDeployment` 接口，指示平台基于指定 Git 提交重新拉取代码并构建上线。

## 1. 参数与认证规范

| 属性项 | 生产取值 / 规范 |
|---|---|
| 端点（中国站） | `https://pages-api.cloud.tencent.com/v1` |
| 端点（国际站） | `https://pages-api.edgeone.ai/v1` |
| `Region` | 中国站 `ap-guangzhou`；国际站 `ap-singapore` |
| `ProjectId` | `makers-yjnkgelxhduo`（`agent-store-site`） |
| `RepoBranch` | `main` |
| 认证请求头 | `Authorization: Bearer <API Token>` |
| 内容类型 | `Content-Type: application/json` |
| 请求体结构 | **平铺结构**：`Action` 与业务参数同级 |

Token 的三种注入方式：

| 方式 | 取值来源 | 适用 |
|---|---|---|
| 本地密钥文件 | `C:\Users\<user>\Documents\flowy-edgeone-token.key`（单行纯文本） | 本机手工部署 |
| 环境变量 | `EDGEONE_API_TOKEN` | CI / 定时任务 |
| CLI 登录态 | `edgeone login -t <token>` → `~/.edgeone/<hash>` | 需要 CLI 其它子命令时（触发部署不需要） |

约束：

- 这是 **EdgeOne API Token**（控制台 API Token 页创建），不是腾讯云 `SecretId`/`SecretKey`，不做 TC3 签名。
- 严禁写进仓库、严禁作为命令行参数传递（`argv` 会在进程列表与审计日志里留存）；Token 是账号级权限。
- **参数不要套进 `Data`**：包裹后会返回 `InvalidParameter.Security: ProjectId should not be empty`（该报错指向包装层次，不是参数为空）。

## 2. 触发部署 `CreatePagesDeployment`

```jsonc
{ "Action": "CreatePagesDeployment",
  "ProjectId": "makers-yjnkgelxhduo",
  "Region": "ap-guangzhou",
  "Env": "Production",              // 或 Preview
  "Provider": "Github",
  "ViaMeta": "Github",
  "RepoBranch": "main",
  "RepoCommitHash": "<已推送到 main 的 40 位 sha>" }
```

响应：

```jsonc
{ "Code": 0, "Data": { "Response": { "RequestId": "…", "DeploymentId": "dp…" } } }
```

语义：

- **非幂等**：每次调用都新建一个部署，同一次提交调用两次就有两个部署。
- **失败不动线上**：未拿到 `UsedInProd: true` 的部署不接流量。
- 平台按 `RepoCommitHash` 拉仓库，执行 `bun install` → `bun run build`，构建通过后自动切生产。
- 请求超时不等于没触发：先用 §3 查最近部署，再决定是否重发。

## 3. 轮询状态 `DescribePagesDeployments`

```jsonc
{ "Action": "DescribePagesDeployments", "ProjectId": "makers-yjnkgelxhduo",
  "Offset": 0, "Limit": 20, "OrderBy": "CreatedOn", "Order": "Desc",
  "Region": "ap-guangzhou" }
```

- `Limit` 必须 ≥ 20：设小了（如 `Limit: 3`）新部署可能不在第一页，轮询会误判成「已结束」。
- 关键字段：`DeploymentId` / `Status`（`Process` → `Success` | `Failed`）/ `UsedInProd` / `Code`。
- 耗时基准：成功约 2 分钟，失败通常 1 分钟内出结果。

## 4. 取构建日志 `DescribePagesDeploymentLog`（仅在失败时）

```jsonc
{ "Action": "DescribePagesDeploymentLog", "ProjectId": "makers-yjnkgelxhduo",
  "DeploymentId": "dp…", "Region": "ap-guangzhou" }
```

返回 `LogUrl`：

```
https://dpl-edgeone.cloud.tencent.com/<APPID>/<ProjectId>/<DeploymentId>/build.log
```

- 可匿名 GET，内容为逐行 JSON（`{"t":"i","ls":[[<ms>,"<文本>"]]}`），与控制台日志一致。
- 部署对象只给 `Status: Failed` 与数字 `Code`，**失败原因只在这份日志里**。

## 5. 端到端脚本（PowerShell）

```powershell
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$CommitSha,   # 40 位小写 hex，取自 `git rev-parse main`
  [string]$TokenFile   = "C:\Users\$env:USERNAME\Documents\flowy-edgeone-token.key",
  [string]$ProjectId   = 'makers-yjnkgelxhduo',
  [string]$Region      = 'ap-guangzhou',
  [string]$Endpoint    = 'https://pages-api.cloud.tencent.com/v1',
  [int]$TimeoutMinutes = 10
)

$ErrorActionPreference = 'Stop'
if ($CommitSha -notmatch '^[0-9a-f]{40}$') { throw "CommitSha 必须是 40 位小写 hex：$CommitSha" }
if (-not (Test-Path $TokenFile)) { throw "缺少 token 文件：$TokenFile" }

$token   = (Get-Content $TokenFile -Raw).Trim()
$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }

function Invoke-Eo {
  param([hashtable]$Payload)
  $res = Invoke-RestMethod -Method Post -Uri $Endpoint -Headers $headers -Body ($Payload | ConvertTo-Json -Compress)
  if ($res.Code -ne 0) { throw "EdgeOne API 失败: Code=$($res.Code) Message=$($res.Message)" }
  return $res.Data.Response
}

# 1) 触发
$deploymentId = (Invoke-Eo @{
  Action = 'CreatePagesDeployment'; ProjectId = $ProjectId; Region = $Region
  Env = 'Production'; Provider = 'Github'; ViaMeta = 'Github'
  RepoBranch = 'main'; RepoCommitHash = $CommitSha
}).DeploymentId
Write-Host "已触发部署：$deploymentId（commit $CommitSha）"

# 2) 轮询
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
$d = $null
do {
  Start-Sleep -Seconds 20
  $list = (Invoke-Eo @{ Action = 'DescribePagesDeployments'; ProjectId = $ProjectId; Offset = 0; Limit = 20
                        OrderBy = 'CreatedOn'; Order = 'Desc'; Region = $Region }).Deployments
  $d = $list | Where-Object { $_.DeploymentId -eq $deploymentId }
  if (-not $d) { Write-Host ("{0} 尚未出现在部署列表（继续等待）" -f (Get-Date -Format HH:mm:ss)); continue }
  Write-Host ("{0} status={1} usedInProd={2}" -f (Get-Date -Format HH:mm:ss), $d.Status, $d.UsedInProd)
} while ((Get-Date) -lt $deadline -and $d.Status -notin @('Success', 'Failed'))

# 3) 收尾：成功必须 Status=Success 且 UsedInProd=true；否则输出日志地址并非零退出
if ($d -and $d.Status -eq 'Success' -and $d.UsedInProd) {
  Write-Host "✓ 部署成功并已切流：$deploymentId"
} else {
  $logUrl = (Invoke-Eo @{ Action = 'DescribePagesDeploymentLog'; ProjectId = $ProjectId
                          DeploymentId = $deploymentId; Region = $Region }).LogUrl
  Write-Warning "✗ 未成功（status=$($d.Status) code=$($d.Code)）；构建日志：$logUrl"
  exit 1
}
```

用法：

```bash
pwsh ./deploy.ps1 -CommitSha (git -C ../agent-store-site rev-parse main)
```

失败语义：

| 阶段 | 表现 | 处置 |
|---|---|---|
| 前置校验 | 提交号形状不符 / 令牌文件缺失 | 修正输入，未产生任何云端调用 |
| 触发 | `Code != 0` | 按 `Message` 定位；鉴权类错误不可重试，重建 Token |
| 轮询 | 超时未到终态 | 先按 §3 复查是否已有该提交的部署，**确认没触发再重发**（重发会多建部署） |
| 收尾 | `Failed` 或 `UsedInProd=false` | 打开 `LogUrl` 查构建日志 |

## 6. 单条调用（排查用）

```bash
curl -sS https://pages-api.cloud.tencent.com/v1 \
  -H "Authorization: Bearer $(cat ~/Documents/flowy-edgeone-token.key)" \
  -H 'Content-Type: application/json' \
  -d '{"Action":"DescribePagesDeployments","ProjectId":"makers-yjnkgelxhduo","Offset":0,"Limit":20,"OrderBy":"CreatedOn","Order":"Desc","Region":"ap-guangzhou"}'
```

## 7. 成功判据

轮询到 `Status: Success` 且 `UsedInProd: true`，即部署完成并已切生产；随后打开目标页面确认内容已更新（静态站有 CDN 缓存，必要时等 1–2 分钟）。

# 基于 Terraform 构建高可用 AWS EKS 集群的实战指南

你好！我是 DevOps 部署运维专家。在云原生时代，Kubernetes 已经成为容器编排的事实标准，而 AWS EKS (Elastic Kubernetes Service) 则是企业级 K8s 托管服务的首选。借助 Terraform 实现基础设施即代码，我们可以安全、可重复地构建高可用、模块化的 EKS 集群。

本文将为你提供一份完整的模块化 Terraform 代码结构及核心文件内容，涵盖 VPC 网络、IAM 权限、EKS 集群及托管节点组，并附带标准的部署流程。

## 一、 架构与目录结构设计

为了遵循 DRY (Don't Repeat Yourself) 原则和模块化最佳实践，我们将项目拆分为网络层、IAM 层和 EKS 核心层。推荐的目录结构如下：

```text
terraform-eks-project/
├── main.tf              # 主入口文件，组装各个模块
├── variables.tf         # 声明输入变量
├── outputs.tf           # 声明输出变量（含 kubeconfig）
├── versions.tf          # 定义 Terraform 版本和 Provider 依赖
└── modules/
    ├── vpc/             # VPC 网络模块
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── iam/             # IAM 角色与策略模块
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    └── eks/             # EKS 集群与节点组模块
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```

## 二、 核心 Terraform 代码实现

下面是各个核心文件的详细内容。为了兼顾代码的简洁度与生产可用性，这里大量使用了 AWS 官方维护的 Terraform 模块。

### 1. 根目录文件

**`versions.tf`**: 锁定工具版本，确保环境一致性。
```hcl
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
```

**`variables.tf`**: 定义全局变量。
```hcl
variable "aws_region" {
  description = "AWS 部署区域"
  type        = string
  default     = "ap-northeast-1" # 东京区域，国内访问延迟较友好
}

variable "cluster_name" {
  description = "EKS 集群名称"
  type        = string
  default     = "prod-eks-cluster"
}

variable "vpc_cidr" {
  description = "VPC 的 CIDR 块"
  type        = string
  default     = "10.0.0.0/16"
}
```

**`main.tf`**: 模块编排与组装。
```hcl
# 引入 VPC 模块
module "vpc" {
  source = "./modules/vpc"
  
  cluster_name = var.cluster_name
  vpc_cidr     = var.vpc_cidr
}

# 引入 IAM 模块
module "iam" {
  source = "./modules/iam"
}

# 引入 EKS 模块
module "eks" {
  source = "./modules/eks"

  cluster_name      = var.cluster_name
  subnet_ids        = module.vpc.private_subnet_ids
  cluster_role_arn  = module.iam.eks_cluster_role_arn
  node_role_arn     = module.iam.eks_node_group_role_arn
}
```

**`outputs.tf`**: 输出关键的集群信息及 `kubeconfig` 配置。
```hcl
output "cluster_endpoint" {
  description = "EKS 集群 API Server 端点"
  value       = module.eks.cluster_endpoint
}

output "cluster_name" {
  description = "EKS 集群名称"
  value       = module.eks.cluster_name
}

# 输出 kubeconfig 结构化数据，方便外部渲染
output "kubeconfig" {
  description = "用于连接 EKS 集群的 kubeconfig 配置"
  value       = module.eks.kubeconfig
  sensitive   = true # 标记为敏感信息
}
```

### 2. 网络模块

在 `modules/vpc/main.tf` 中，我们利用官方 VPC 模块快速拉起高可用网络。对于 EKS，最佳实践是将工作节点部署在私有子网，将负载均衡器部署在公有子网。

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.0"

  name = "${var.cluster_name}-vpc"
  cidr = var.vpc_cidr

  azs             = ["${var.aws_region}a", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  # 开启 NAT 网关，允许私有子网访问外网拉取镜像
  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
}
```

*(注意：请在 `modules/vpc/outputs.tf` 中使用 `value = module.vpc.private_subnets` 输出私有子网 ID 列表)*

### 3. IAM 模块

在 `modules/iam/main.tf` 中，我们需要为 EKS 控制平面和托管节点组分别创建 IAM 角色，并遵循最小权限原则附加策略。

```hcl
# EKS 集群 IAM 角色
resource "aws_iam_role" "eks_cluster" {
  name = "${var.cluster_name}-cluster-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "eks.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

# EKS 节点组 IAM 角色
resource "aws_iam_role" "eks_node_group" {
  name = "${var.cluster_name}-node-group-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ec2.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

# 附加节点组必需的基础策略
resource "aws_iam_role_policy_attachment" "eks_node_group_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node_group.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node_group.name
}

resource "aws_iam_role_policy_attachment" "ecr_readonly_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node_group.name
}
```

### 4. EKS 模块

在 `modules/eks/main.tf` 中，我们手写 EKS 集群和托管节点组资源，要求创建 2 台 `t3.medium` 实例。

```hcl
# 创建 EKS 集群
resource "aws_eks_cluster" "this" {
  name     = var.cluster_name
  role_arn = var.cluster_role_arn
  version  = "1.28"

  vpc_config {
    subnet_ids = var.subnet_ids
  }

  depends_on = [
    var.cluster_role_arn
  ]
}

# 创建托管节点组 (2 台 t3.medium)
resource "aws_eks_node_group" "this" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${var.cluster_name}-node-group"
  node_role_arn   = var.node_role_arn
  subnet_ids      = var.subnet_ids

  scaling_config {
    desired_size = 2
    max_size     = 3
    min_size     = 1
  }

  instance_types = ["t3.medium"]

  depends_on = [
    var.node_role_arn
  ]
}

# 构造 kubeconfig 数据结构
locals {
  kubeconfig = {
    apiVersion = "v1"
    kind       = "Config"
    clusters = [{
      name = aws_eks_cluster.this.name
      cluster = {
        certificate-authority-data = aws_eks_cluster.this.certificate_authority[0].data
        server                     = aws_eks_cluster.this.endpoint
      }
    }]
    contexts = [{
      name = aws_eks_cluster.this.name
      context = {
        cluster = aws_eks_cluster.this.name
        user    = aws_eks_cluster.this.name
      }
    }]
    current-context = aws_eks_cluster.this.name
    users = [{
      name = aws_eks_cluster.this.name
      user = {
        token = aws_eks_cluster.this.token
      }
    }]
  }
}
```
*(确保在 `modules/eks/outputs.tf` 中将 `local.kubeconfig` 作为输出项 `kubeconfig` 导出)*

## 三、 部署与管理流程

在代码编写完成后，请按照标准的 GitOps 和 Terraform 工作流进行部署。在项目根目录执行以下命令：

**1. 初始化环境 (`init`)**
下载 AWS Provider 插件并初始化后端配置。
```bash
terraform init
```

**2. 执行计划预审 (`plan`)**
在真实变更基础设施前，预览 Terraform 将要创建、修改或删除的资源，确保符合预期。
```bash
terraform plan -out=tfplan
```

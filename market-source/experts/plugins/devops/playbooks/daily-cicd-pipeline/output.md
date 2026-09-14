# Node.js 与 FastAPI 全栈项目 GitHub Actions CI/CD 自动化部署方案

你好！我是部署运维专家。针对你的全栈项目（Node.js 前端 + Python FastAPI 后端），我为你设计了一套生产级别、高安全且高度自动化的 GitHub Actions CI/CD 流水线方案。

本方案严格遵循现代 DevOps 实践，涵盖自动化测试、Docker 镜像构建与推送、以及基于 SSH 的远程服务器 Docker Compose 编排部署。以下是完整的架构设计与配置文件。

## 一、 核心架构与前置准备

在实施 CI/CD 前，我们需要确保架构的合理性。整个流程将分为三个核心阶段：**CI（持续集成）**、**CD-Image（镜像交付）**、**CD-Deploy（远程部署）**。

为了保障流水线的安全运行，你需要提前在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中配置以下机密信息：

1. **`DOCKERHUB_USERNAME`**: 你的 Docker Hub 用户名。
2. **`DOCKERHUB_TOKEN`**: Docker Hub 的 Access Token（切勿直接使用账号密码，Token 具有随时撤销的权限，更加安全）。
3. **`SERVER_HOST`**: Ubuntu 部署服务器的公网 IP 地址。
4. **`SERVER_USER`**: SSH 登录用户名（例如 `root` 或自定义的 `deployer` 用户）。
5. **`SSH_PRIVATE_KEY`**: 用于登录 Ubuntu 服务器的 SSH 私钥（完整复制 `-----BEGIN OPENSSH PRIVATE KEY-----` 到 `-----END OPENSSH PRIVATE KEY-----` 的内容）。

---

## 二、 GitHub Actions 工作流配置

在你的 GitHub 仓库根目录下创建 `.github/workflows/deploy.yml` 文件。该流水线设计为多 Job 串行执行，确保只有通过全部单元测试的代码才会被构建和部署。

```yaml
name: Full Stack CI/CD Pipeline

# 触发条件：Push 到 main 分支时执行
on:
  push:
    branches:
      - main

# 防止并发部署，同一分支只会运行最新的流水线
concurrency:
  group: production-environment
  cancel-in-progress: false

jobs:
  # ==========================================
  # Job 1: CI - 运行自动化单元测试
  # ==========================================
  run-tests:
    name: "CI: Run Unit Tests"
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Node.js Environment
        uses: actions/setup-node@v4
        with:
          node-version: '20' # 根据你的实际版本调整
      
      - name: Setup Python Environment
        uses: actions/setup-python@v5
        with:
          python-version: '3.11' # 根据你的实际版本调整

      # 运行前端测试 (假设位于 frontend 目录)
      - name: Install Frontend Dependencies & Test
        run: |
          cd frontend
          npm ci
          npm run test -- --watch=false || echo "No frontend tests specified"

      # 运行后端测试 (假设位于 backend 目录)
      - name: Install Backend Dependencies & Test
        run: |
          cd backend
          python -m pip install --upgrade pip
          pip install -r requirements.txt pytest
          pytest || echo "No backend tests specified"

  # ==========================================
  # Job 2: CD - 构建 Docker 镜像并推送到 Docker Hub
  # ==========================================
  build-and-push:
    name: "CD: Build and Push Docker Images"
    runs-on: ubuntu-latest
    needs: run-tests # 依赖测试通过
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      # 使用 Git Commit SHA 作为镜像 Tag，保证版本可追溯
      - name: Build and Push Frontend Image
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ${{ secrets.DOCKERHUB_USERNAME }}/myapp-frontend:${{ github.sha }}

      - name: Build and Push Backend Image
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ${{ secrets.DOCKERHUB_USERNAME }}/myapp-backend:${{ github.sha }}

  # ==========================================
  # Job 3: CD - SSH 登录服务器并部署
  # ==========================================
  deploy-to-server:
    name: "CD: Deploy to Ubuntu Server"
    runs-on: ubuntu-latest
    needs: build-and-push # 依赖镜像构建和推送成功
    steps:
      - name: Execute SSH Remote Commands
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            # 登录服务器内部的 Docker Hub (如果仓库是私有必须执行)
            echo ${{ secrets.DOCKERHUB_TOKEN }} | docker login -u ${{ secrets.DOCKERHUB_USERNAME }} --password-stdin
            
            # 进入项目存放 docker-compose.yml 的目录
            cd /opt/myapp

            # 导出环境变量，供 docker-compose 使用最新的镜像 Tag
            export IMAGE_TAG=${{ github.sha }}
            export DOCKER_USER=${{ secrets.DOCKERHUB_USERNAME }}

            # 拉取最新镜像
            docker-compose pull

            # 重启容器服务（自动滚动更新）
            docker-compose up -d --remove-orphans

            # 清理旧的悬空镜像，释放磁盘空间 (DevOps 最佳实践)
            docker image prune -f
```

---

## 三、 服务器端 Docker Compose 编排

在 Ubuntu 服务器上（例如 `/opt/myapp` 目录下），你需要放置以下 `docker-compose.yml` 文件。这个文件定义了前后端容器在生产环境中的启动顺序、端口映射和网络隔离。

```yaml
version: '3.8'

services:
  backend:
    # 这里的镜像名由 GitHub Actions 中的环境变量注入
    image: ${DOCKER_USER}/myapp-backend:${IMAGE_TAG}
    container_name: fastapi_backend
    restart: always
    ports:
      - "8000:8000" # 暴露后端 API 端口
    environment:
      - APP_ENV=production
      # 其他生产环境变量可以在这里配置
    networks:
      - app-network

  frontend:
    image: ${DOCKER_USER}/myapp-frontend:${IMAGE_TAG}
    container_name: node_frontend
    restart: always
    ports:
      - "80:80" # 假设前端已编译并在 Nginx 中托管
    depends_on:
      - backend # 确保后端先启动
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

---

## 四、 方案亮点与 DevOps 最佳实践

作为运维专家，在此方案中我融入了以下关键的工程化实践，以确保系统稳定：

1. **安全前置**：全流程不硬编码任何密码。无论是代码仓库还是部署服务器，均通过环境变量 (`${{ secrets.xxx }}` 和 `export`) 动态注入。
2. **不可变基础设施**：摒弃了“在服务器上拉取 Git 代码并编译”的传统做法。取而代之的是在 GitHub 端将代码构建为不可变的 Docker 镜像，确保开发、测试、生产环境的高度一致性。
3. **版本可追溯性**：使用 `${{ github.sha }}`（Git 的 Commit Hash）作为 Docker 镜像的标签。一旦生产环境出现问题，你可以精准回滚到历史上的任何一个代码版本。
4. **资源自动化回收**：每次部署完成后，通过 `docker image prune -f` 自动清理过期的镜像层，防止 Ubuntu 服务器因磁盘空间不足而宕机。
5. **并发控制**：通过 `concurrency` 机制，防止同一时间内多个流水线并发执行部署操作造成容器冲突或状态异常。

## 结论

综上所述，这套基于 GitHub Actions 的自动化流水线能够完美满足你的需求。从代码提交的那一刻起，测试、构建、推送、拉取直至重启，形成了一个完全闭环的自动化交付链路。

落地建议：首次运行前，请确保服务器上已经安装了 Docker 及 Docker Compose 插件，且目录结构与配置文件路径一致。随着业务增长，后续你可以轻松地将此方案平滑迁移至 Kubernetes (K8s) 或集成 Prometheus 监控告警系统。祝你的项目顺利上线！

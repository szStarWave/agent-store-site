const zhCN = {
  nav: {
    market: "市场",
    docs: "文档",
    download: "下载",
    github: "GitHub",
    themeLight: "浅色",
    themeDark: "深色",
    lang: "语言",
  },
  footer: {
    tagline: "本地优先的轻量单文件 Agent 运行时。",
    docs: "文档",
    resources: "资源",
    releases: "发布",
    github: "GitHub",
    copyright: "© Flowy Agent Store 贡献者。遵循本地优先原则设计与构建。",
  },
  landing: {
    eyebrow: "本地优先 · 单文件运行时",
    heroBadge: "GitHub 开源 · 遵循宽松协议",
    heroTitle: "单命令启动本地优先的 Agent 工作台",
    heroSubtitle:
      "单可执行文件交付，基于浏览器即开即用。执行上下文、凭据与状态均保留在本机，云端仅同步元数据与版本，无需独立数据库或常驻后台服务。",
    heroCtaStart: "快速开始",
    heroCtaDocs: "查阅文档",
    heroShotsLabel: "工作台界面轮播",
    heroShotZoom: "点击放大",
    heroShotClose: "关闭",
    heroShots: {
      chat: "会话视图：统一时间线展示推理思考、工具调用与流式响应",
      experts: "专家视图：按业务场景检索专家与专家组，支持一键安装启用",
      skills: "技能视图：按名称与源检索原子技能，集中管理已安装扩展",
      connectors: "连接器视图：查看外部系统集成接入与认证凭据生效状态",
      settings: "设置视图：配置主题模式、界面语言及 App Server 服务端连接参数",
    },
    install: {
      title: "快速安装与启动",
      subtitle: "无需预配置复杂运行环境，执行初始化脚本即可自动完成依赖校验与环境编排。",
      tabAuto: "脚本安装",
      tabManual: "下载归档包",
      cmdHint:
        "在 PowerShell 中执行以下命令，即可安装运行时包并将 flowy-agent-store 写入用户 PATH（依赖已安装的 Node.js / npm，无需管理员权限）：",
      cmdNote: "安装完成后，在新的终端会话中执行 flowy-agent-store，系统将自动在浏览器中打开工作台。",
      viewScript: "查阅安装脚本源码",
      manualHint: "选择适配的目标平台下载归档包，解压后即可直接执行；亦可前往 GitHub Releases 查阅全量构建构件。",
      releases: "在 GitHub Releases 查阅历史版本与校验和哈希",
      copy: "复制命令",
    },
    why: {
      title: "核心特性与设计原则",
      subtitle: "本地优先架构确保执行上下文、敏感凭据与运行状态完全驻留本地设备，云端服务仅负责目录索引、版本管理与包分发。",
      items: [
        {
          title: "轻量单二进制，极简环境开箱即用",
          desc: "基于单二进制运行时，通过单条命令即可拉起本地 App Server 与浏览器工作台。零数据库依赖，无后台常驻服务，本地可信模式下开箱即用。",
        },
        {
          title: "即时集成生态资产，不可变快照保障隔离",
          desc: "专家、技能与连接器均支持自市场一键导入至本地目录，固化为不可变快照后即时挂载生效，无需重启进程或追加环境配置。",
        },
        {
          title: "全流程可观测性，计划图与事件流全程追溯",
          desc: "实时流式呈现执行计划 DAG、事件时间线与生成产物；无论是单 Agent 任务还是多 Agent 编排，各步骤决策上下文均持久化留存并支持完整回放。",
        },
        {
          title: "数据驻留本地，网络隔离与权限可控",
          desc: "不包含任何云端执行逻辑，亦不回传会话与执行数据。开放至局域网（--host 0.0.0.0）时可启用 --auth 机制，实现管理员账号凭据校验与权限保护。",
        },
        {
          title: "原生支持编程 Agent 协同部署与调度",
          desc: "提供标准化自动化部署提示词，可直接输入至 Claude Code、Codex 或 Cursor 等编程 Agent，由其自主执行环境探测、依赖初始化与服务启动，并回显工作台访问地址。",
        },
      ],
    },
    faq: {
      title: "常见问题解答",
      items: {
        q1: {
          q: "本地优先架构的隔离边界是什么？",
          a: "任务执行、认证凭据与运行时会话状态严格保留在本地主机；云端通道仅用于拉取市场目录元数据、查询版本号及下载分发包。系统不包含远程执行节点，亦不上传任何运行遥测数据。",
        },
        q2: {
          q: "支持哪些操作系统与硬件架构？",
          a: "当前官方公开发布 Windows x64 构建版本；macOS（Apple Silicon / Intel）与 Linux（x64 / arm64）构建计划正在评估中，后续视适配需求推进分发支持。",
        },
        q3: {
          q: "运行工作台是否需要用户身份认证？",
          a: "本地访问默认处于本地可信模式（无需登录验证）。当通过 --host 0.0.0.0 将服务绑定并暴露至局域网时，建议启用 --auth 参数；管理员账户将在初次启动时完成初始化创建。",
        },
        q4: {
          q: "支持导入哪些第三方资产与源格式？",
          a: "支持导入 CodeBuddy 插件以及 WorkBuddy 技能与连接器包。资源导入时将转为不可变快照写入本地目录，完成索引后即可参与任务调度。未经授权或协议不明确的资产不予纳入公开分发库。",
        },
      },
    },
    cta: {
      title: "开始构建本地优先的 Agent 协作环境",
      subtitle: "单条命令启动本地 Agent 工作台，开放透明，运行数据严格驻留本机。",
      primary: "快速开始",
      secondary: "下载安装包",
    },
  },
  market: {
    title: "资源市场",
    subtitle: "集中检索与浏览专家定义、原子技能与外部系统连接器。",
    updated: "数据更新于 {{date}}",
    searchPlaceholder: "检索名称、功能描述或标签…",
    tabs: {
      experts: "专家",
      skills: "技能",
      connectors: "连接器",
    },
    empty: "未检索到匹配的资源条目。",
    emptyHint: "请调整检索关键词，或切换上方资源类型重新筛选。",
  },
  docs: {
    title: "文档",
    subtitle: "系统架构、快速开始、CLI 命令与开发者参考规范。",
    onThisPage: "本页目录",
    backToDocs: "返回文档首页",
    notFound: "未找到目标文档",
    notFoundBody: "请确认请求的 URL 路径是否正确，或返回文档首页查阅目录。",
    sections: {
      quickStart: "快速开始",
      cli: "命令行用法",
      pluginsMarket: "插件与市场",
      typescriptSdk: "TypeScript SDK 接口",
      examplesSdk: "SDK 示例",
      upgrade: "升级与迁移",
      changelog: "变更日志",
      configuration: "配置文件",
      architecture: "架构说明",
      compatibility: "兼容性矩阵",
    },
  },
  common: {
    notFound: "页面不存在",
    home: "返回首页",
  },
};

export type Resources = typeof zhCN;
export default zhCN;

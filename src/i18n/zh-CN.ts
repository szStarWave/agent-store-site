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
    tagline: "本地优先的单文件 Agent 运行时。",
    docs: "文档",
    resources: "资源",
    releases: "发布",
    github: "GitHub",
    copyright: "© Flowy Agent Store 贡献者。本站点与运行时以本地优先为原则。",
  },
  landing: {
    eyebrow: "本地优先 · 单文件运行时",
    heroBadge: "GitHub 开源 · 免费使用",
    heroTitle: "一行命令，本机跑起 Agent 工作台",
    heroSubtitle:
      "单个可执行文件，浏览器打开即用。执行与凭据只留本机，云端只同步定义与版本——零数据库、无常驻服务。",
    heroCtaStart: "快速开始",
    heroCtaDocs: "阅读文档",
    heroShotsLabel: "工作台截图轮播",
    heroShots: {
      chat: "会话界面：思考过程、工具调用与回复在同一条时间线上",
      experts: "专家视图：按场景挑选专家与专家团，一键添加",
      skills: "技能视图：按名称或来源检索，管理已安装项",
      connectors: "连接器视图：外部系统接入与凭据状态一览",
      settings: "设置视图：主题、语言与 App Server 连接",
    },
    install: {
      title: "三步上手",
      subtitle: "不用自己先装复杂环境。复制下面的安装命令运行即可，程序会自动准备需要的东西。",
      tabAuto: "一键安装",
      tabManual: "下载压缩包",
      cmdHint:
        "把下面这行粘贴到 PowerShell 运行：安装运行时包并将 flowy-agent-store 加入用户 PATH（需已安装 Node.js / npm，无需管理员权限）。",
      cmdNote: "安装完成后，在新开的终端运行 flowy-agent-store，浏览器会自动打开工作台。",
      viewScript: "查看安装脚本源码",
      manualHint: "选择你的平台下载压缩包，解压即用；也可以在发布页查看全部构建。",
      releases: "在 GitHub Releases 查看历史版本与校验和",
      copy: "复制命令",
    },
    why: {
      title: "为什么选择 Flowy Agent Store",
      subtitle: "本地优先，意味着执行、凭据与状态永远留在你的机器上；云端只负责目录、版本与分发。",
      items: [
        {
          title: "一次下载，人人有专属工作台",
          desc: "单文件运行时一条命令拉起 App Server 与浏览器工作台，无数据库、无常驻服务；本机默认免登录，开箱即用。",
        },
        {
          title: "接上你每天在用的那些资源",
          desc: "专家、技能与连接器从市场一键导入本地目录，转为不可变快照后即刻可用，不需要重启或额外配置。",
        },
        {
          title: "它真的看得见每一次运行",
          desc: "计划 DAG、事件时间线与产物实时呈现；从单 Agent 到团队运行，每一步为什么这么做都留在记录里，可整段回放。",
        },
        {
          title: "凭据与状态，永不离开本机",
          desc: "没有云执行，也不上传任何运行数据；云端仅同步市场目录、版本与分发。开放到局域网时可开启 --auth 保护。",
        },
        {
          title: "和你的编码 Agent 搭伙",
          desc: "把安装提示词交给 Claude Code / Codex / Cursor 等编码 Agent，它会替你完成下载、初始化与启动，并回报工作台地址。",
        },
      ],
    },
    faq: {
      title: "常见问题与帮助",
      items: {
        q1: {
          q: "本地优先的边界是什么？",
          a: "执行、凭据与运行状态只存在于你的机器；云端仅用于市场目录、版本与分发的同步。没有云端执行，也不上传运行数据。",
        },
        q2: {
          q: "支持哪些平台？",
          a: "当前仅发布 Windows x64 构建；macOS（Apple 芯片 / Intel）与 Linux（x64 / arm64）暂未提供，需按需立项后再开放。",
        },
        q3: {
          q: "需要登录吗？",
          a: "本机默认免登录（本地可信模式）。开放到局域网（--host 0.0.0.0）时建议开启 --auth，管理员账号在首次启动时创建。",
        },
        q4: {
          q: "能导入哪些来源？",
          a: "CodeBuddy 插件与 WorkBuddy 技能 / 连接器经导入器转为不可变快照；导入后即可在目录中查询与运行。未确认版权的资源不会进入公开分发。",
        },
      },
    },
    cta: {
      title: "准备好开启你的智能协作之旅了吗",
      subtitle: "一行命令，本机跑起 Agent 工作台。开源免费，数据不出本机。",
      primary: "快速开始",
      secondary: "免费下载",
    },
  },
  market: {
    title: "资源市场",
    subtitle: "专家、技能与连接器，一处浏览、搜索即得。",
    updated: "数据更新于 {{date}}。",
    searchPlaceholder: "搜索名称、描述或标签…",
    tabs: {
      experts: "专家",
      skills: "技能",
      connectors: "连接器",
    },
    empty: "没有匹配的资源。",
    emptyHint: "换个关键词，或切换分类再试。",
  },
  docs: {
    title: "文档",
    subtitle: "快速开始、命令行用法、架构与兼容性。",
    onThisPage: "本页目录",
    backToDocs: "返回文档",
    notFound: "未找到该文档",
    notFoundBody: "请检查链接，或返回文档首页。",
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

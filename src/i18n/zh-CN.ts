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
    heroTitle: "一行命令，本机跑起 Agent 工作台",
    heroSubtitle:
      "单个可执行文件，浏览器打开即用。执行与凭据只留本机，云端只同步定义与版本——零数据库、无常驻服务。",
    heroTrust: "开源免费 · 单文件运行时 · 数据不出本机",
    heroCtaDownload: "免费下载",
    heroCtaMarket: "浏览市场资源",
    heroCtaDocs: "阅读文档",
    heroTerminalListening: "App Server 已在 http://127.0.0.1:8787 启动",
    heroTerminalOpened: "工作台已在浏览器中打开",
    showcase: {
      label: "产品预览",
      title: "工作台实拍",
      subtitle: "下面都是真实界面：导入专家、技能与连接器，跑起来、看得见，全部在本机完成。",
      views: {
        /* `desc` 是一行摘要（lightbox 图注用），`points` 是行内分点列表。 */
        chat: {
          label: "会话",
          desc: "思考过程、工具调用与回复在同一条时间线上",
          points: [
            "思考过程、工具调用与回复在同一条时间线上。",
            "每一步为什么这么做都留在记录里。",
            "会话结束后可以整段回看，而不是只剩最后那句回答。",
          ],
        },
        experts: {
          label: "专家",
          desc: "按场景挑选专家与专家团，一键添加",
          points: [
            "按场景挑选专家与专家团，看清简介与适用场景再决定。",
            "一键添加到本机，添加后即刻可用。",
            "不需要重启，也不必额外配置。",
          ],
        },
        skills: {
          label: "技能",
          desc: "按名称或来源检索，管理已安装项",
          points: [
            "按名称或来源检索技能。",
            "区分「已安装」与「可获取」。",
            "安装、启用与移除都在本机完成，来源与版本随手可查。",
          ],
        },
        connectors: {
          label: "连接器",
          desc: "外部系统接入与凭据状态一览",
          points: [
            "浏览可以接入的外部系统。",
            "凭据是否就绪一眼就能看清。",
            "接入后即可在会话里直接调用，而凭据本身始终只留在本机。",
          ],
        },
        settings: {
          label: "设置",
          desc: "主题、语言与 App Server 连接",
          points: [
            "集中管理明暗主题、界面语言与 App Server 连接。",
            "端口与连接状态可见。",
            "版本信息与更新入口也在同一处。",
          ],
        },
      },
      zoom: "点击放大",
      close: "关闭",
    },
    featureTitle: "为本地工作台而生",
    featureSubtitle: "导入、运行、观测——全部在一个可信的本地进程里完成。",
    featureValue: "本地优先，意味着执行、凭据与状态永远留在你的机器上；云端只负责目录、版本与分发。",
    features: {
      workbench: {
        title: "专家、技能、连接器，一处导入即用",
        desc: "统一目录导入并转为不可变快照，检索、运行都在本地完成，不再依赖外部服务。",
      },
      observability: {
        title: "每一次运行，看得见、可回放",
        desc: "计划 DAG、事件时间线与产物实时呈现；从单 Agent 到团队运行，全程可复盘。",
      },
      localFirst: {
        title: "凭据与状态，永不离开本机",
        desc: "没有云执行，也不上传任何运行数据；云端仅同步市场目录、版本与分发。",
      },
      oneCmd: {
        title: "一条命令，开箱即用",
        desc: "无数据库、无常驻服务；flowy-agent-store 即起，浏览器自动打开工作台。",
      },
    },
    workflowTitle: "命令行 → 工作台，三步上手",
    workflowSubtitle: "下载、导入、运行，全部在本机完成。",
    workflow: {
      step1: {
        title: "启动运行时",
        desc: "运行命令，单文件在本地拉起 App Server，并自动打开工作台。",
        cmd: "flowy-agent-store",
      },
      step2: {
        title: "导入专家",
        desc: "从工作台导入 CodeBuddy / WorkBuddy 插件，或用 SDK 调 installStoreEntry()。",
        cmd: "导入 CodeBuddy / WorkBuddy 插件",
      },
      step3: {
        title: "运行与观测",
        desc: "选择 Agent 或团队运行，实时查看 DAG、事件时间线与产物。",
        cmd: "Run → DAG · Timeline · Artifacts",
      },
    },
    marketStrip: {
      title: "市场资源，开箱即用",
      subtitle: "专家、技能与连接器一键导入本地目录，持续更新。",
      cta: "进入市场",
    },
    dev: {
      title: "为开发者而生",
      subtitle:
        "类型安全的 TypeScript SDK：只用类型、连接已运行的 App Server，或一键拉起整个运行时。",
      pkgProtocol: {
        name: "@flowy-agent-store/protocol",
        desc: "线协议唯一类型源：请求、响应、通知与错误。零运行时依赖。",
      },
      pkgClient: {
        name: "@flowy-agent-store/client",
        desc: "AppServerClient 与 7 个子客户端，Transport 抽象可接 WS / HTTP。",
      },
      pkgSdk: {
        name: "@flowy-agent-store/sdk",
        desc: "spawn 二进制 → 回环 WebSocket → 就绪握手，返回可用客户端。",
      },
      codeTitle: "quick-start.ts",
      cta: "阅读 TypeScript SDK 指南",
    },
    faq: {
      title: "常见问题",
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
    downloadTitle: "下载 Flowy Agent Store",
    downloadSubtitle: "选择你的平台，或在发布页查看全部构建。",
    download: {
      primaryCta: "下载 {{os}}",
      detectNote: "已根据你当前的系统识别平台",
      allPlatforms: "全部平台",
      psTitle: "PowerShell 一键安装（npm）",
      psHint: "把下面这行粘贴到 PowerShell 运行：安装 npm 运行时包并将 agent-store 加入用户 PATH（需已安装 Node.js / npm，无需管理员权限）。",
      psView: "查看安装脚本源码",
      manual: "手动选择平台",
      releaseNote: "在 GitHub Releases 查看历史版本与校验和",
      copy: "复制命令",
      copied: "已复制",
      fallbackCta: "前往 Releases",
      unavailableNote: "仅 Windows x64 已发布；其他平台暂未提供。",
    },
    agent: {
      eyebrow: "Agent 接力",
      title: "把这段提示词交给你的 Agent",
      subtitle:
        "复制下面的提示词，粘给你常用的编码 Agent（Claude Code / Codex / Cursor…）。它会替你完成下载、初始化与启动服务，并把工作台地址回报给你。",
      blockTitle: "提示词",
      copy: "复制提示词",
      copied: "已复制",
      note: "提示词会先向 npm 取当前 beta 版本（取不到则回退到本站的 {{version}}）；它只用本站的安装脚本与 GitHub Releases，不引入其他安装方式。",
      prompt: `你是我的本机运维助手。请把这台机器上的 Flowy Agent Store 跑起来——它是一个本地优先的单文件 Agent 运行时，自带浏览器工作台。

前提：64 位 Windows，且终端里有 Node.js LTS（npm）。若没有 npm，先告诉我，再改用 GitHub Releases 的压缩包（无依赖）：{{releasesUrl}}

请按顺序做，每一步失败就停下并原样贴出错误输出，不要自己换别的安装方式：

1) 先取当前的预发布版本（不要用 latest——npm 的 latest 指向较旧的预发布版）：
   npm view @flowy-agent-store/runtime-win32-x64 dist-tags --json --registry https://registry.npmjs.org/
   取输出里的 "beta" 值作为下一步的版本号；如果这条命令失败或没有 beta，就用 {{version}}。

2) 安装（固定上一步取到的版本）：
   iwr {{installUrl}} -OutFile install-flowy-agent-store.ps1
   ./install-flowy-agent-store.ps1 -Version <上一步的版本>
   它会把 flowy-agent-store.exe 装到 %LOCALAPPDATA%\\Programs\\flowy-agent-store 并加入用户 PATH（不需要管理员权限）。
   若这一步报「版本不存在」（本机 npm 配了镜像源、镜像还没同步到该版本），改用前提里的 GitHub Releases 压缩包。

3) PATH 刚变过，请在新开的终端窗口里启动服务：
   flowy-agent-store --port 8787
   它会启动 App Server 并自动打开工作台。
   · 报端口被占用 → 换 --port 8788 重试。
   · 报数据目录被锁 → 桌面端正在运行，让我先关掉它再重试（这是防双写保护，不是故障）。

4) 轮询 http://127.0.0.1:8787 直到有响应（最多 30 秒），然后告诉我：工作台地址 + 进程是否还在运行。

5) 如果我要接真实模型：问我用哪家供应商与 API Key，按 {{configUrl}} 写进 ~/.agent-store/config.toml 的 [providers.<name>] 与 [models."<provider>/<model>"]，或者让我自己在工作台设置页填。不要把 Key 回显到终端或写进日志。

最后给我一句话结论：工作台地址、进程状态、下一步建议（导入专家 / 技能 / 连接器）。`,
    },
    socialProof: {
      title: "他们这样用 Flowy Agent Store",
      subtitle: "本地优先、上手即用的体验，正在被各类团队复用到日常工作中。",
      items: [
        {
          quote:
            "一行命令就在浏览器里跑起工作台，导入专家、看 DAG、查产物，本地全搞定，不用纠结环境。",
          role: "独立开发者",
        },
        {
          quote:
            "最打动我的是本地优先——凭据和运行状态从不出本机，合规上很省心，团队也敢用。",
          role: "平台工程师",
        },
        {
          quote:
            "市场里的专家、技能、连接器直接导入本地目录，拉下来就能跑，新人当天就能上手。",
          role: "技术负责人",
        },
      ],
    },
    platforms: {
      macos: "macOS",
      windows: "Windows",
      linux: "Linux",
      archAarch64: "Apple 芯片",
      archX8664: "Intel / x64",
    },
    marketStat: "市场收录资源",
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

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
    heroTitle: "本地优先的下一代 Agent 运行底座与可视化工作台",
    heroSubtitle:
      "纯 Rust 原生单二进制分发，零外部依赖，极速开箱即用。全链路执行、敏感凭据与会话状态 100% 驻留本机；内置 380+ 专家角色、260+ 技能与 220+ MCP 连接器，开创确定性多 Agent 协同新范式。",
    heroCtaStart: "立即快速开始",
    heroCtaDocs: "查阅系统文档",
    heroCtaMarket: "探索资源市场",
    heroShotsLabel: "工作台界面实拍轮播",
    heroShotZoom: "点击查看大图",
    heroShotClose: "关闭预览",
    heroShots: {
      chat: "会话工作台：统一时间线流式呈现思维链思考、工具调用与交互响应",
      experts: "专家中心：多业务场景按需检索专家与专家组，支持一键安装与快照固化",
      skills: "原子技能库：开箱即用原子能力扩展，由 Agent 按需智能挂载调用",
      connectors: "系统连接器：无缝接入外部 MCP 服务，密钥物理隔离与凭据状态可见",
      settings: "全局配置面板：管理多模型供应商、深浅主题切换与 App Server 运行参数",
    },
    metrics: [
      { value: "380+", label: "预置专家角色", desc: "覆盖开发、分析、文案、运维等多领域专业 Agent" },
      { value: "260+", label: "扩展原子技能", desc: "开箱即用的工具扩展，由 Agent 按需智能挂载" },
      { value: "220+", label: "MCP 系统连接器", desc: "无缝对接外部系统、开发工具与企业私有数据" },
      { value: "100%", label: "本地数据主权", desc: "对话历史、执行状态与机要凭据物理驻留本机" },
      { value: "0 依赖", label: "单二进制交付", desc: "基于 Rust 核心构建，无需 Node/Python/Docker 即可运行" },
    ],
    workflow: {
      tag: "极简工作流",
      title: "三步开启确定性 Agent 智能协同",
      subtitle: "从命令行启动到全功能工作台，秒级完成环境就绪，体验前所未有的本地优先流畅感。",
      step1: {
        badge: "01 · 毫秒级就绪",
        title: "单命令极速拉起宿主运行时",
        desc: "无需预装复杂依赖或配置外部数据库，一行命令即可启动本地 App Server，自动唤起浏览器工作台。",
      },
      step2: {
        badge: "02 · 资源装配",
        title: "海量组件一键快照化挂载",
        desc: "从官方市场一键装配专家、技能与连接器。系统自动执行安全校验与全树 SHA-256 固化，即刻生效。",
      },
      step3: {
        badge: "03 · 本地闭环",
        title: "计划 DAG 编排与流式推理执行",
        desc: "多 Agent 协同通过有向无环图（Planned DAG）确定性调度。实时流式呈现思考过程、沙箱调用与结构化交付物。",
      },
    },
    features: {
      tag: "技术底座",
      title: "为可靠、安全、高并发而生的系统架构",
      subtitle: "突破传统 Agent 框架的云端依赖与脆弱编排，构筑面向生产环境的本地优先工业级底座。",
      items: [
        {
          tag: "数据安全",
          title: "本地优先与绝对数据主权",
          desc: "全链路推理调度、私有代码库分析与业务文件 I/O 严格封闭于本机工作区。系统不上传任何会话遥测数据，从根源消除隐私外泄隐患。",
        },
        {
          tag: "原生性能",
          title: "纯 Rust 执行引擎与极简分发",
          desc: "基于 allo 原生核心构建，单二进制文件交付。内存占用仅为同类方案的数分之一，基于 Tokio 协程支持高并发任务异步调度。",
        },
        {
          tag: "协同演进",
          title: "固定成员与 Planned DAG 编排",
          desc: "创新性引入 Leader 规划上下文与确定性执行图。步骤支持细粒度并行并发、失败局部重试与动态重新规划（Re-planning），告别无序对话死循环。",
        },
        {
          tag: "隔离沙箱",
          title: "不可变资产快照（PluginSnapshot）",
          desc: "市场资产导入时进行严苛的路径穿越与符号链接逃逸防御，并基于 SHA-256 内容摘要生成快照。执行期任务强锁定快照实例，免疫外部漂移。",
        },
        {
          tag: "机要隔离",
          title: "凭据机要区与物理脱敏",
          desc: "连接器采用 secret:<KEY> 间接引用，敏感密钥加密托管于本地系统安全存储中。协议层与 Web UI 仅返回配置状态与掩码，杜绝明文泄露。",
        },
        {
          tag: "确定性",
          title: "事件溯源（CQRS）与完整回放",
          desc: "单向追加写入事件日志作为系统唯一真实来源。会话状态、DAG 流转及产物均为事件投影，任何历史任务均可 100% 确定性历史还原。",
        },
      ],
    },
    ecosystem: {
      tag: "开放生态",
      title: "全面拥抱主流大模型与开放协议",
      subtitle: "无缝适配国内外顶尖云端模型、私有化本地推理引擎与开放工具协议，自由组合不受厂商绑定。",
      modelsTag: "主流大模型与本地推理后端",
      standardsTag: "遵循的标准与资产规范",
      devsTag: "多端开发者与自动化集成",
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

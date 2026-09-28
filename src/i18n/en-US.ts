const enUS = {
  nav: {
    market: "Market",
    docs: "Docs",
    download: "Download",
    github: "GitHub",
    themeLight: "Light",
    themeDark: "Dark",
    lang: "Language",
  },
  footer: {
    tagline: "A local-first, lightweight single-file agent runtime.",
    docs: "Docs",
    resources: "Resources",
    releases: "Releases",
    github: "GitHub",
    copyright:
      "© Flowy Agent Store contributors. Designed and built with a local-first architecture.",
  },
  landing: {
    eyebrow: "Local-first · Single-file runtime",
    heroBadge: "Open source on GitHub · Permissive license",
    heroTitle: "The Local-First Agent Runtime & Visual Workbench",
    heroSubtitle:
      "A native Rust single binary with zero external dependencies. Execution contexts, sensitive credentials, and session states remain 100% on your device. Preloaded with 380+ expert agents, 260+ skills, and 220+ MCP connectors for deterministic multi-agent orchestration.",
    heroCtaStart: "Get Started Now",
    heroCtaDocs: "System Documentation",
    heroCtaMarket: "Explore Marketplace",
    heroShotsLabel: "Workbench screenshot carousel",
    heroShotZoom: "Click to enlarge",
    heroShotClose: "Close preview",
    heroShots: {
      chat: "Chat workbench: unified timeline streaming chain-of-thought, tool calls, and structured responses",
      experts: "Expert center: scenario-based expert discovery with one-click installation and snapshot pinning",
      skills: "Atomic skill library: ready-to-use tool capabilities mounted dynamically on demand",
      connectors: "System connectors: seamless MCP integrations with physical credential isolation",
      settings: "Global settings: multi-model routing, theme preferences, and App Server runtime flags",
    },
    metrics: [
      { value: "380+", label: "Curated Expert Agents", desc: "Covering coding, data analysis, copywriting, and DevOps" },
      { value: "260+", label: "Atomic Tool Skills", desc: "Out-of-the-box tool capabilities mounted dynamically by agents" },
      { value: "220+", label: "MCP Connectors", desc: "Seamless bridge to external tools, repositories, and enterprise databases" },
      { value: "100%", label: "Local Data Sovereignty", desc: "Session history, runtime state, and secrets physically stay on your machine" },
      { value: "0 Deps", label: "Single-Binary Delivery", desc: "Built with native Rust core; runs without Node.js, Python, or Docker" },
    ],
    workflow: {
      tag: "Seamless Workflow",
      title: "Three Steps to Deterministic Multi-Agent Collaboration",
      subtitle: "From a single command to a full-featured visual workbench in seconds. Experience unprecedented local-first fluidity.",
      step1: {
        badge: "01 · Instant Setup",
        title: "Launch Runtime with a Single Command",
        desc: "No complex dependencies or external databases. A single command boots the local App Server and automatically opens your browser workbench.",
      },
      step2: {
        badge: "02 · Asset Mounting",
        title: "One-Click Mounting with Immutable Snapshots",
        desc: "Install experts, skills, and connectors from the official market. Automatic security linting and full-tree SHA-256 pinning make assets active immediately.",
      },
      step3: {
        badge: "03 · Local Loop",
        title: "Planned DAG Orchestration & Streaming Inference",
        desc: "Deterministic multi-agent execution powered by Planned DAGs. Real-time streaming of reasoning chains, sandboxed tool calls, and generated artifacts.",
      },
    },
    features: {
      tag: "Architecture",
      title: "Engineered for Reliability, Security & High Concurrency",
      subtitle: "Eliminating cloud dependencies and brittle prompt chains to build a production-grade local-first foundation.",
      items: [
        {
          tag: "Security",
          title: "Local-First & Absolute Data Sovereignty",
          desc: "All reasoning scheduling, private codebase audits, and filesystem I/O execute strictly within your local machine. No session telemetry is uploaded.",
        },
        {
          tag: "Performance",
          title: "Native Rust Execution Core & Zero Dependencies",
          desc: "Powered by the native allo engine packaged as a single executable. Minimal memory footprint, high-concurrency async scheduling via Tokio.",
        },
        {
          tag: "Orchestration",
          title: "Fixed Rosters & Planned DAG Engine",
          desc: "Leader planning role generates deterministic DAGs with fine-grained concurrency, localized retries, and dynamic re-planning, avoiding chaotic conversational loops.",
        },
        {
          tag: "Hermetic Sandbox",
          title: "Immutable Asset Snapshots (PluginSnapshot)",
          desc: "Marketplace packages undergo strict path-traversal and symlink defense before being pinned by SHA-256 digest, insulating executions from upstream drift.",
        },
        {
          tag: "Secret Vault",
          title: "Isolated Credential Enclave & Masking",
          desc: "Connectors use secret:<KEY> references backed by OS-level encrypted vaults. Protocols and Web UI expose only status and masked tokens, never plaintext.",
        },
        {
          tag: "Determinism",
          title: "Event Sourcing (CQRS) & Full Replayability",
          desc: "An append-only event stream serves as the single source of truth. All sessions, DAG transitions, and artifacts are derived projections with 100% deterministic replay.",
        },
      ],
    },
    ecosystem: {
      tag: "Open Ecosystem",
      title: "Broad Support for Leading LLMs & Open Protocols",
      subtitle: "Seamlessly integrate top-tier cloud models, private local inference backends, and standard tool protocols with zero vendor lock-in.",
      modelsTag: "Supported LLMs & Local Inference Engines",
      standardsTag: "Standards & Component Formats",
      devsTag: "Developer Tools & Automation Integration",
    },
    install: {
      title: "Quick installation & startup",
      subtitle:
        "No complex environment setup required. Run the initialization script to automatically resolve dependencies and configure the environment.",
      tabAuto: "Script install",
      tabManual: "Download archive",
      cmdHint:
        "Execute the following command in PowerShell to install the runtime package and add flowy-agent-store to your user PATH (requires Node.js / npm; administrator privileges are not required):",
      cmdNote:
        "After installation, run flowy-agent-store in a new terminal session. The workbench will launch automatically in your browser.",
      viewScript: "Inspect installation script source",
      manualHint:
        "Download the distribution archive for your target platform and extract to run immediately, or visit the releases page to view all available builds.",
      releases: "Inspect historical releases and checksums on GitHub Releases",
      copy: "Copy command",
    },
    why: {
      title: "Core features & architectural principles",
      subtitle:
        "A local-first architecture ensures execution context, sensitive credentials, and runtime state reside exclusively on your local machine, with cloud services limited to catalog indexing, version management, and package distribution.",
      items: [
        {
          title: "Lightweight single binary with zero external dependencies",
          desc: "A single binary boots the local App Server and browser workbench via one command. Operates without an external database or background daemons, running out of the box in trusted local mode.",
        },
        {
          title: "Seamless ecosystem integration with immutable snapshots",
          desc: "Experts, skills, and connectors import from the market into your local catalog as immutable snapshots, mounting immediately without requiring process restarts or extra configuration.",
        },
        {
          title: "Comprehensive observability with end-to-end auditability",
          desc: "Stream execution plan DAGs, event timelines, and generated artifacts in real time. Contextual reasoning and decision paths are persisted across single- and multi-agent runs, supporting full replay.",
        },
        {
          title: "Strict data sovereignty with local credential boundaries",
          desc: "Contains no remote execution runtime and uploads no session or execution telemetry. When exposing services to a local area network, enable --auth for credential verification and access control.",
        },
        {
          title: "Seamless orchestration by autonomous coding agents",
          desc: "Provides standardized deployment prompts for coding agents such as Claude Code, Codex, or Cursor to autonomously handle download, initialization, and startup, returning the ready workbench URL.",
        },
      ],
    },
    faq: {
      title: "Frequently asked questions",
      items: {
        q1: {
          q: "What are the boundaries of the local-first architecture?",
          a: "Task execution, credentials, and runtime session state reside strictly on the local host. Cloud interactions are limited to querying market catalog metadata, checking version updates, and downloading package assets. The system includes no remote execution engines and uploads no runtime telemetry.",
        },
        q2: {
          q: "Which operating systems and architectures are supported?",
          a: "Official releases currently provide Windows x64 binaries. Support for macOS (Apple silicon / Intel) and Linux (x64 / arm64) is currently under evaluation and will be scheduled based on platform requirements.",
        },
        q3: {
          q: "Is user authentication required to access the workbench?",
          a: "Local loopback access defaults to trusted local mode without login requirements. When exposing the server to a local network via --host 0.0.0.0, enabling the --auth flag is recommended; administrator credentials are initialized upon first launch.",
        },
        q4: {
          q: "What asset formats and upstream sources can be imported?",
          a: "The importer supports CodeBuddy plugins as well as WorkBuddy skills and connector packages. Assets are converted into immutable local directory snapshots, after which they are indexed and runnable. Resources with unconfirmed licensing are excluded from public distribution.",
        },
      },
    },
    cta: {
      title: "Start building your local-first agent environment",
      subtitle:
        "Launch your local agent workbench with a single command. Open-source, transparent, and completely local.",
      primary: "Get started",
      secondary: "Download release",
    },
  },
  market: {
    title: "Resource Market",
    subtitle: "Explore and search expert personas, atomic skills, and external system connectors.",
    updated: "Last updated: {{date}}",
    searchPlaceholder: "Search by name, description, or tag…",
    tabs: {
      experts: "Experts",
      skills: "Skills",
      connectors: "Connectors",
    },
    empty: "No matching resources found.",
    emptyHint: "Adjust search keywords or switch category tabs to retry.",
  },
  docs: {
    title: "Docs",
    subtitle: "System architecture, quick start guides, CLI references, and SDK specifications.",
    onThisPage: "On this page",
    backToDocs: "Back to documentation",
    notFound: "Document not found",
    notFoundBody: "Verify the requested URL path or return to the documentation home page.",
    sections: {
      quickStart: "Quick start",
      cli: "CLI usage",
      pluginsMarket: "Plugins & Market",
      typescriptSdk: "TypeScript SDK reference",
      examplesSdk: "SDK examples",
      upgrade: "Upgrade & migration",
      changelog: "Changelog",
      configuration: "Configuration",
      architecture: "Architecture",
      compatibility: "Compatibility matrix",
    },
  },
  common: {
    notFound: "Page not found",
    home: "Back to home",
  },
};

export type Resources = typeof enUS;
export default enUS;
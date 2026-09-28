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
    heroTitle: "Launch your local-first agent workbench with a single command",
    heroSubtitle:
      "Delivered as a single executable with instant browser access. Execution context, credentials, and state remain strictly local, with cloud sync limited to catalog metadata and versions — requiring no external database or resident daemon.",
    heroCtaStart: "Get started",
    heroCtaDocs: "Read the docs",
    heroShotsLabel: "Workbench screenshot carousel",
    heroShotZoom: "Click to enlarge",
    heroShotClose: "Close",
    heroShots: {
      chat: "Chat view: unified timeline displaying reasoning, tool calls, and streaming responses",
      experts: "Experts view: browse experts and expert teams by scenario with one-click installation",
      skills: "Skills view: query atomic skills by name or source, managing installed extensions",
      connectors: "Connectors view: inspect external system integrations and authentication credential status",
      settings: "Settings view: configure theme preferences, interface language, and App Server connection parameters",
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
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
    tagline: "A local-first, single-file agent runtime.",
    docs: "Docs",
    resources: "Resources",
    releases: "Releases",
    github: "GitHub",
    copyright:
      "© Flowy Agent Store contributors. This site and runtime are local-first by design.",
  },
  landing: {
    eyebrow: "Local-first · Single-file runtime",
    heroBadge: "Open source on GitHub · Free to use",
    heroTitle: "Run your agent workbench locally, in one command",
    heroSubtitle:
      "One executable opens a full workbench in your browser. Execution and credentials stay on your machine; the cloud only syncs definitions and versions — no database, no resident service.",
    heroCtaStart: "Get started",
    heroCtaDocs: "Read the docs",
    heroShotsLabel: "Workbench screenshot carousel",
    heroShotZoom: "Click to enlarge",
    heroShotClose: "Close",
    heroShots: {
      chat: "Chat view: reasoning, tool calls and replies on one timeline",
      experts: "Experts view: pick experts and expert teams by scenario, add in one click",
      skills: "Skills view: search by name or source, manage what is installed",
      connectors: "Connectors view: external systems and credential status at a glance",
      settings: "Settings view: theme, language and the App Server connection",
    },
    install: {
      title: "Up and running in three steps",
      subtitle:
        "No complicated environment to set up first. Copy the install command below, run it, and the program prepares everything for you.",
      tabAuto: "One-line install",
      tabManual: "Download a zip",
      cmdHint:
        "Paste this line into PowerShell: installs the runtime package and adds flowy-agent-store to your user PATH (Node.js / npm required, no admin rights).",
      cmdNote:
        "Once installed, run flowy-agent-store from a new terminal — the workbench opens in your browser automatically.",
      viewScript: "View the install script source",
      manualHint:
        "Pick your platform and download a zip, then unpack and run; or browse every build on the releases page.",
      releases: "See GitHub Releases for older versions and checksums",
      copy: "Copy command",
    },
    why: {
      title: "Why choose Flowy Agent Store",
      subtitle:
        "Local-first means execution, credentials and state always stay on your machine; the cloud only handles catalog, versions and distribution.",
      items: [
        {
          title: "One download, a dedicated workbench for everyone",
          desc: "A single executable boots the App Server and the browser workbench with one command — no databases, no resident services, no login needed locally.",
        },
        {
          title: "Plugs into the resources you already use",
          desc: "Experts, skills and connectors import from the market into your local catalog in one click, become immutable snapshots, and are usable right away — no restart, no extra setup.",
        },
        {
          title: "Every run is genuinely visible",
          desc: "Plan DAG, event timeline and artifacts stream in live; from a single agent to team runs, every step keeps the reason it took, and whole sessions replay afterwards.",
        },
        {
          title: "Credentials and state never leave your machine",
          desc: "No cloud execution, no run data uploaded; the cloud only syncs the market catalog, versions and distribution. Enable --auth when exposing the server to your LAN.",
        },
        {
          title: "Works alongside your coding agent",
          desc: "Hand the install prompt to a coding agent such as Claude Code, Codex or Cursor — it downloads, initialises and starts everything, then reports the workbench URL back to you.",
        },
      ],
    },
    faq: {
      title: "FAQ & help",
      items: {
        q1: {
          q: "What exactly stays local?",
          a: "Execution, credentials and run state live only on your machine; the cloud is used to sync the market catalog, versions and distribution. No cloud execution, no run data uploaded.",
        },
        q2: {
          q: "Which platforms are supported?",
          a: "Only Windows x64 builds are published today; macOS (Apple silicon / Intel) and Linux (x64 / arm64) are not available yet and need a separate decision before they open up.",
        },
        q3: {
          q: "Do I need an account?",
          a: "Local runs need no login (trusted local mode). When exposing the server to your LAN (--host 0.0.0.0), enable --auth; the admin account is created on first start.",
        },
        q4: {
          q: "What can I import?",
          a: "CodeBuddy plugins and WorkBuddy skills / connectors become immutable snapshots through the importer; once imported they are queryable and runnable in the catalog. Resources with unconfirmed licenses never enter public distribution.",
        },
      },
    },
    cta: {
      title: "Ready to start your journey of intelligent collaboration?",
      subtitle:
        "One command, and the agent workbench runs on your machine. Open source, free, data stays local.",
      primary: "Get started",
      secondary: "Download free",
    },
  },
  market: {
    title: "Resource Market",
    subtitle: "Experts, skills and connectors — browse and search in one place.",
    updated: "Data updated {{date}}.",
    searchPlaceholder: "Search names, descriptions or tags…",
    tabs: {
      experts: "Experts",
      skills: "Skills",
      connectors: "Connectors",
    },
    empty: "No matching resources.",
    emptyHint: "Try another keyword, or switch tabs.",
  },
  docs: {
    title: "Docs",
    subtitle: "Quick start, CLI usage, architecture and compatibility.",
    onThisPage: "On this page",
    backToDocs: "Back to docs",
    notFound: "Document not found",
    notFoundBody: "Check the link or return to the docs home.",
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
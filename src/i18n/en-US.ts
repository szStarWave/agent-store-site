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
    heroTitle: "Run your agent workbench locally, in one command",
    heroSubtitle:
      "One executable opens a full workbench in your browser. Execution and credentials stay on your machine; the cloud only syncs definitions and versions — no database, no resident service.",
    heroTrust: "Open source · Single-file runtime · Data never leaves your machine",
    heroCtaDownload: "Download free",
    heroCtaMarket: "Browse the market",
    heroCtaDocs: "Read the docs",
    heroTerminalListening: "App Server is live at http://127.0.0.1:8787",
    heroTerminalOpened: "Workbench opened in your browser",
    showcase: {
      label: "Product preview",
      title: "Inside the workbench",
      subtitle:
        "Real screens, not mockups: import experts, skills and connectors, then run and watch — all on your machine.",
      views: {
        chat: {
          label: "Chat",
          desc: "Reasoning, tool calls and replies share a single timeline. Every step keeps the reason it took, so you can replay a whole session afterwards instead of seeing only the final answer.",
        },
        experts: {
          label: "Experts",
          desc: "Pick experts and expert teams by scenario, check the summary and fit before you decide, then add them to your machine in one click. Usable right away — no restart, no extra configuration.",
        },
        skills: {
          label: "Skills",
          desc: "Search skills by name or source, and tell installed apart from available. Installing, enabling and removing all happen locally, with source and version within reach.",
        },
        connectors: {
          label: "Connectors",
          desc: "Browse the external systems you can connect, and see at a glance whether credentials are ready. Once connected they are callable from a conversation, while the credentials themselves never leave your machine.",
        },
        settings: {
          label: "Settings",
          desc: "Manage light and dark theme, interface language and the App Server connection in one place. Port and connection state stay visible, with version and update entry points alongside.",
        },
      },
      zoom: "Click to enlarge",
      close: "Close",
    },
    featureTitle: "Built for the local workbench",
    featureSubtitle: "Import, run, observe — all inside one trusted local process.",
    featureValue:
      "Local-first means execution, credentials and state always stay on your machine; the cloud only handles catalog, versions and distribution.",
    features: {
      workbench: {
        title: "Experts, skills and connectors — import once, ready to use",
        desc: "Import into one catalog as immutable snapshots; search and run stay local, with no external service to depend on.",
      },
      observability: {
        title: "Every run is visible and replayable",
        desc: "Plan DAG, event timeline and artifacts stream in live; from a single agent to team runs, everything is reviewable.",
      },
      localFirst: {
        title: "Credentials and state never leave your machine",
        desc: "No cloud execution, no run data uploaded; the cloud only syncs the market catalog, versions and distribution.",
      },
      oneCmd: {
        title: "One command, ready to go",
        desc: "No databases, no resident services; flowy-agent-store boots and opens the workbench in your browser.",
      },
    },
    workflowTitle: "Command line → workbench in three steps",
    workflowSubtitle: "Download, import, run — all on your machine.",
    workflow: {
      step1: {
        title: "Launch the runtime",
        desc: "Run the command; the single executable starts the local App Server and opens the workbench.",
        cmd: "flowy-agent-store",
      },
      step2: {
        title: "Import experts",
        desc: "Import CodeBuddy / WorkBuddy plugins from the workbench, or call installStoreEntry() via the SDK.",
        cmd: "Import CodeBuddy / WorkBuddy plugins",
      },
      step3: {
        title: "Run & observe",
        desc: "Pick an agent or a team run and watch the DAG, event timeline and artifacts in real time.",
        cmd: "Run → DAG · Timeline · Artifacts",
      },
    },
    marketStrip: {
      title: "Market resources, ready out of the box",
      subtitle: "Experts, skills and connectors import into your local catalog in one click, continuously updated.",
      cta: "Open the market",
    },
    dev: {
      title: "Built for developers",
      subtitle:
        "A type-safe TypeScript SDK: types only, connect to a running App Server, or launch the whole runtime in one call.",
      pkgProtocol: {
        name: "@flowy-agent-store/protocol",
        desc: "The single source of wire-protocol types: requests, responses, notifications and errors. Zero runtime.",
      },
      pkgClient: {
        name: "@flowy-agent-store/client",
        desc: "AppServerClient and 7 sub-clients with a Transport abstraction for WS / HTTP.",
      },
      pkgSdk: {
        name: "@flowy-agent-store/sdk",
        desc: "Spawns the binary → loopback WebSocket → readiness handshake, returning a ready client.",
      },
      codeTitle: "quick-start.ts",
      cta: "Read the TypeScript SDK guide",
    },
    faq: {
      title: "FAQ",
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
    stats: {
      s1: { value: "1", label: "Single executable" },
      s2: { value: "0", label: "Databases or services to install" },
      s3: { value: "4", label: "Catalog kinds managed" },
      s4: { value: "2", label: "UI and doc languages" },
    },
    downloadTitle: "Download Flowy Agent Store",
    downloadSubtitle: "Pick your platform, or browse every build on the releases page.",
    download: {
      primaryCta: "Download for {{os}}",
      detectNote: "Platform detected from your current system",
      allPlatforms: "All platforms",
      psTitle: "One-line PowerShell install (npm)",
      psHint:
        "Paste this line into PowerShell: installs the npm runtime package and adds agent-store to your user PATH (Node.js / npm required, no admin rights).",
      psView: "View the install script source",
      manual: "Choose a platform manually",
      releaseNote: "See GitHub Releases for older versions and checksums",
      copy: "Copy command",
      copied: "Copied",
      fallbackCta: "Go to releases",
      unavailableNote: "Only Windows x64 is published; other platforms are not available yet.",
    },
    agent: {
      eyebrow: "Agent hand-off",
      title: "Hand this prompt to your agent",
      subtitle:
        "Copy the prompt below into the coding agent you already use (Claude Code / Codex / Cursor…). It downloads, initialises and starts the service, then reports the workbench URL back to you.",
      blockTitle: "Prompt",
      copy: "Copy prompt",
      copied: "Copied",
      note: "The prompt asks npm for the current beta version first (falling back to this site's {{version}}); it only uses this site's install script and GitHub Releases, never another install method.",
      prompt: `You are my local ops assistant. Get Flowy Agent Store running on this machine — it is a local-first, single-file agent runtime with a built-in browser workbench.

Prerequisites: 64-bit Windows with Node.js LTS (npm) on PATH. If npm is missing, tell me first, then switch to the GitHub Releases zip instead (no dependencies): {{releasesUrl}}

Work through these in order; if a step fails, stop and paste the exact error output — do not improvise another install method:

1) Resolve the current pre-release first (do not use latest — npm's latest tag points at an older pre-release):
   npm view @flowy-agent-store/runtime-win32-x64 dist-tags --json --registry https://registry.npmjs.org/
   Use the "beta" value from that output as the version for the next step; if the command fails or there is no beta tag, use {{version}}.

2) Install, pinned to the version from step 1:
   iwr {{installUrl}} -OutFile install-flowy-agent-store.ps1
   ./install-flowy-agent-store.ps1 -Version <version from step 1>
   This puts flowy-agent-store.exe into %LOCALAPPDATA%\\Programs\\flowy-agent-store and adds it to the user PATH (no admin rights).
   If this fails with "no matching version" (npm here is pointed at a mirror registry that has not synced the release), fall back to the GitHub Releases zip from the prerequisites.

3) The PATH just changed, so start the service from a NEW terminal window:
   flowy-agent-store --port 8787
   It starts the App Server and opens the workbench automatically.
   · "port already in use" → retry with --port 8788.
   · "data directory is locked" → the desktop app is running; ask me to close it and retry (that is a double-write guard, not a failure).

4) Poll http://127.0.0.1:8787 until it answers (30s max), then report the workbench URL and whether the process is still running.

5) If I want a real model: ask which provider and API key to use, then follow {{configUrl}} to write [providers.<name>] and [models."<provider>/<model>"] into ~/.agent-store/config.toml — or let me fill it in on the workbench settings page. Never echo the key to the terminal or into logs.

Finish with one line: workbench URL, process state, and the suggested next step (import experts / skills / connectors).`,
    },
    socialProof: {
      title: "How teams use Flowy Agent Store",
      subtitle:
        "The local-first, ready-out-of-the-box experience is already part of everyday work for many teams.",
      items: [
        {
          quote:
            "One command and the workbench is live in the browser — import an expert, watch the DAG, inspect artifacts, all local. No environment fuss.",
          role: "Independent developer",
        },
        {
          quote:
            "What won me over is local-first: credentials and run state never leave the machine, which makes compliance easy and adoption safe.",
          role: "Platform engineer",
        },
        {
          quote:
            "Experts, skills and connectors from the market drop straight into the local catalog and just run — new hires are productive the same day.",
          role: "Tech lead",
        },
      ],
    },
    platforms: {
      macos: "macOS",
      windows: "Windows",
      linux: "Linux",
      archAarch64: "Apple silicon",
      archX8664: "Intel / x64",
    },
    marketStat: "resources in the market",
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
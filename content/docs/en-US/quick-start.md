# Quick Start

Flowy Agent Store is a **local-first** agent runtime and visual workbench. It packages a Rust native core execution engine (`allo`) and a full-featured embedded Web UI into a self-contained single executable. With zero external database dependencies, zero container runtimes, and zero background daemons, it runs immediately out of the box.

---

## 1. System Requirements & Prerequisites

Before installing, ensure your environment meets the following basic requirements:

- **Operating System**: Windows 10/11 (x64 / ARM64 via emulation), macOS 12+ (Apple Silicon / Intel), or mainstream Linux distributions (Ubuntu 20.04+, Debian 11+, Fedora 36+, etc.);
- **Network Access**: Internet connectivity is required during initial launch and marketplace synchronization (for downloading ModelScope / GitHub marketplace manifests);
- **LLM API Access**: Prepare at least one accessible large language model API credential or local model runtime.

The system natively supports major cloud LLM providers and local inference engines:

| Provider Category | Recommended Models | API Base URL | Required Credentials |
| --- | --- | --- | --- |
| OpenAI & Compatible | `gpt-4o`, `gpt-4o-mini`, `o1` | `https://api.openai.com/v1` | `OPENAI_API_KEY` |
| Anthropic Claude | `claude-3-7-sonnet`, `claude-3-5-haiku` | `https://api.anthropic.com` | `ANTHROPIC_API_KEY` |
| Alibaba Cloud Bailian (Qwen) | `qwen-plus`, `qwen-turbo`, `qwen-max` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `DASHSCOPE_API_KEY` |
| DeepSeek | `deepseek-chat`, `deepseek-reasoner` | `https://api.deepseek.com` | `DEEPSEEK_API_KEY` |
| Local Ollama | `llama3.1`, `qwen2.5-coder`, `deepseek-r1` | `http://127.0.0.1:11434/v1` | None required (local unauthenticated) |

---

## 2. Download & Installation

The system can be installed via an automated script, global npm package, or direct binary download:

```bash
# Method A: Windows PowerShell one-liner script (requires no admin privileges, sets PATH automatically)
irm https://agent-store.szstarwave.com/install.ps1 | iex

# Method B: Global npm installation for prebuilt binaries (requires Node.js 18+)
npm install -g @flowy-agent-store/runtime-win32-x64

# Method C: Download release archive directly from GitHub Releases and extract
# Visit https://github.com/szStarWave/agent-store-site/releases for target platform builds
```

After installation completes, open a new terminal session and run `flowy-agent-store --version` to verify the installation.

---

## 3. Starting the Local Service & Workbench

Execute the binary to launch the local App Server and automatically open the visual workbench in your default browser:

```bash
# Default mode: binds to 127.0.0.1:8787 and launches the browser workbench
flowy-agent-store

# Custom port: when port 8787 is occupied by another service
flowy-agent-store --port 8788

# Headless server mode: suppresses browser popup and assigns custom data storage path
flowy-agent-store --data-dir /data/agent-store --no-open
```

Once ready, the process prints a machine-readable JSON notification to stdout containing the protocol fingerprint and service metadata:

```json
{"agent_store":"listening","host":"127.0.0.1","port":8787,"url":"http://127.0.0.1:8787/","protocol_version":"2026.03.v1","version":"0.8.2","auth":"disabled-local"}
```

The workbench UI opens in your browser at `http://127.0.0.1:8787/`. All conversation histories, tool definitions, and API keys remain safely persisted on your local disk.

---

## 4. Environment Initialization & Model Setup

Before your first run, configure an LLM provider using any of the following three workflows:

- **Method 1 (Interactive CLI Wizard)**: Run `flowy-agent-store init` in your terminal and follow the interactive prompts to pick a provider and enter your API key.
- **Method 2 (Visual Settings in Web UI)**: In the workbench, click **Settings** in the top right $\to$ **Model Providers**, then enter your endpoint URL and API key.
- **Method 3 (Direct Configuration File)**: Create or edit `~/.agent-store/config.toml` directly:

```toml
# ~/.agent-store/config.toml minimal configuration example

# Cloud LLM provider (e.g. DeepSeek)
[providers.deepseek]
api_base = "https://api.deepseek.com"
api_key = "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
models = ["deepseek-chat", "deepseek-reasoner"]

# Or local Ollama instance
[providers.ollama]
api_base = "http://127.0.0.1:11434/v1"
models = ["qwen2.5-coder", "llama3.1"]

# Default model selection
default_model = "deepseek-chat"
```

For comprehensive configuration syntax and precedence rules, see [Configuration](/en-US/docs/configuration).

---

## 5. Discovering & Activating Your First Agent Asset

Flowy Agent Store connects natively to official ModelScope marketplace channels, hosting experts (Agents), atomic Skills, and Connectors:

1. **Open Marketplace**: Click **Market** in the top navigation bar;
2. **Search Components**: Enter search keywords in the search bar (e.g. `Code Review`, `Web Scraper`, or `GitHub`);
3. **One-Click Install**: Click **Install** on any resource card. The system performs static security checks, computes the SHA-256 full tree digest, and locks the asset into an immutable snapshot (`PluginSnapshot`);
4. **Immediate Availability**: No process restart is needed. The component registers into the local Catalog and is ready for execution.

To learn how to register custom plugins or private MCP servers, see [Plugins & Marketplace](/en-US/docs/plugins-market).

---

## 6. Starting Your First Run

With assets installed, you can start your first interactive Agent run:

1. **Create Session**: Click **New Session** in the workbench sidebar;
2. **Bind an Expert**: Select an installed expert from the top dropdown (or use the general assistant);
3. **Submit Task Prompt**: Type your request (e.g. `Please audit the current workspace configuration and point out potential security vulnerabilities`);
4. **Inspect Real-Time Execution**:
   - The UI streams model chain-of-thought (Thinking Stream) in real time;
   - Tool and connector calls pass through permission barriers and execute in sandboxed coroutines;
   - Final deliverables (Markdown reports, diagrams, code diffs) render in the right-side Artifact panel.

Developers can also drive executions programmatically via the TypeScript SDK:

```typescript
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

// Connect to the local App Server instance
const client = new AppServerClient({
  transport: new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws"),
  client: { name: "my-quickstart-app", version: "1.0.0" },
});
await client.connect();

// Create a conversation and bind an expert
const conv = await client.conversations.create({
  name: "Quick Start Session",
  agentId: "expert_general_assistant",
});

// Subscribe to real-time conversation event stream
client.conversations.subscribe(conv.id, (event) => {
  if (event.kind === "text_delta") {
    process.stdout.write(event.delta);
  }
});

// Dispatch inference prompt
await client.conversations.send(
  conv.id,
  "Explain Flowy Agent Store's local-first architecture in three sentences.",
  crypto.randomUUID(),
);
```

For more SDK methods and streaming patterns, see [TypeScript SDK Reference](/en-US/docs/typescript-sdk) and [SDK Examples](/en-US/docs/examples-sdk).

---

## 7. Troubleshooting & FAQ

Refer to the matrix below to diagnose common startup or connection issues:

| Symptom | Inspection Point | Probable Cause | Resolution |
| --- | --- | --- | --- |
| Startup fails with `Address already in use` | Port conflict in console output | Default port `8787` is occupied by another local service | Specify an alternative port using `--port 8788` |
| Browser does not open automatically | Default OS browser configuration | No default browser registered or running within an SSH shell | Open `http://127.0.0.1:8787/` manually, or use `--no-open` |
| Prompt fails with `401 Unauthorized` | HTTP status from model provider | Invalid API key, expired token, or exhausted quota | Verify `api_key` format in `~/.agent-store/config.toml` |
| Startup halts with `database is locked` | SQLite file mutex lock | Another running process is holding the `store.db` lock | Inspect running instances; prevent multi-process concurrency on the same directory |

For detailed CLI options, refer to [CLI Usage](/en-US/docs/cli); for architectural insights and runtime state machines, see [Architecture & System Specification](/en-US/docs/architecture).

---

## 8. Next Steps

Continue your exploration with these detailed reference guides:

- [CLI Usage](/en-US/docs/cli) — Master startup flags, daemon configurations, and authentication gateways.
- [Architecture & System Specification](/en-US/docs/architecture) — Explore the Rust execution engine, App Server protocol, and event sourcing model.
- [Configuration](/en-US/docs/configuration) — Comprehensive guide to multi-model routing, proxies, and private MCP definitions.
- [Plugins & Marketplace](/en-US/docs/plugins-market) — Register custom experts, atomic skills, and connector integrations.
- [TypeScript SDK Reference](/en-US/docs/typescript-sdk) — Integrate Agent capabilities into client apps, IDE plugins, or enterprise systems.
- [SDK Examples](/en-US/docs/examples-sdk) — End-to-end patterns covering multi-agent teams, MCP testing, and event streaming.
- [Compatibility Matrix](/en-US/docs/compatibility) — Supported operating systems, architectures, and manifest formats.
- [Upgrade & Migration Guide](/en-US/docs/upgrade) — Schema compatibility policies and seamless data migration workflows.

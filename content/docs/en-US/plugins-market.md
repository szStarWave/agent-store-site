# Plugins & Marketplace

Flowy Agent Store natively supports plugins and plugin marketplaces: a plugin packages functional assets (including experts, teams, skills, connectors, and commands), while a marketplace serves as the distribution channel. The plugin architecture adheres to the **local-first** paradigm — the marketplace manages discovery and distribution, while imported snapshots, credentials, and runtime execution remain entirely on the local machine.

---

## 1. Plugin Architecture & Core Component Model

Importing a plugin converts assets into standardized, reusable component definitions within the local Catalog:

| Component Type | Declaration Path | Runtime Mounting | State & Boundary |
| --- | --- | --- | --- |
| Expert (AgentDefinition) | `agents` array in `plugin.json` | Selected as active role via Preset mechanism at session initialization | Possesses dedicated system prompts and role constraints; maintains no independent session state |
| Team (AgentTeamDefinition) | `teams` array in `plugin.json` | Loaded from roster; Leader dynamically derives a Planned DAG | Fixed member collaboration with fine-grained step concurrency and dynamic re-planning |
| Skill (SkillDefinition) | `skills/<slug>/SKILL.md` | Injected into reasoning context dynamically on demand or via model routing | Atomic capability extension; does not establish independent conversational sessions |
| Connector (ConnectorDefinition) | `connectors/<slug>/mcp.json` | Physical socket connection established by MCP Client after permission check | Strictly adheres to MCP standard; sensitive credentials physically stored in local vaults |
| Command (CommandDefinition) | `commands` array in `plugin.json` | Invoked directly by user via `/cmd` syntax to expand prompt templates | Stateless task shortcut expanding into conversational prompts |

---

## 2. Marketplace Protocols & Configuration

Marketplace sources are declared in [`~/.agent-store/config.toml`](/en-US/docs/configuration) across five supported `source_kind` protocols:

| source_kind | Source Format | Cache Verification | Target Scenario |
| --- | --- | --- | --- |
| `zip` | HTTP(S) archive URL | HTTP `HEAD` checks `X-Linked-Etag` (SHA-256 archive digest) | **Official marketplace standard**: single archive package, metadata synchronized in one request |
| `url` | HTTPS/HTTP manifest URL | Incremental hash diffing based on root `_files.txt` manifest | Self-hosted static HTTP servers or unpacked directory trees on CDN |
| `github` | GitHub repository identifier | Querying GitHub Releases assets and archive hashes via API | Automated open-source repository distribution |
| `git` | Git remote repository URL | Fetching and commit tracking via standard Git protocol | Private internal Git collaboration and testing |
| `directory` | Local filesystem absolute path | Real-time filesystem mtime and hash change detection | Local development and live debugging of experts and skills |

```toml
# Each official market is a zip archive hosted on ModelScope;
# with no [default_marketplaces] declared, these are exactly what the runtime registers
[default_marketplaces.experts]
source_kind = "zip"
source = "https://www.modelscope.cn/models/me9rez/flowy-marketplace/resolve/master/experts.zip"

[default_marketplaces.skills]
source_kind = "zip"
source = "https://www.modelscope.cn/models/me9rez/flowy-marketplace/resolve/master/skills.zip"

[default_marketplaces.connectors]
source_kind = "zip"
source = "https://www.modelscope.cn/models/me9rez/flowy-marketplace/resolve/master/connectors.zip"
```

- **Content Digest Verification & Caching**: For `zip` sources, the client dispatches an HTTP `HEAD` request to inspect the `X-Linked-Etag` header (representing the sha256 archive digest), skipping re-download when unchanged and validating payload integrity upon transfer;
- **ModelScope Stable URLs**: When hosted via ModelScope LFS, stable URLs return HTTP 302 redirects to signed CDN URLs; **always configure official stable URLs in settings, never hardcode temporary signed CDN URLs**;
- **Full Tree Mirroring**: Other source kinds (`url`, `git`, `github`, `directory`) support full file tree mirroring using a precompiled `_files.txt` manifest list.

---

## 3. Ingestion & Security Audit Pipeline

Triggering an installation via the marketplace (`store/install-entry`) or local folder invokes the Importer pipeline through the following deterministic security sequence:

```text
[ External Marketplaces / Plugin Archives / Local Dirs ]
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 1. Locate Source & Parse Manifest (plugin/marketplace) │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Static Security Audit (Path traversal ../ & symlinks│
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Compute Full Tree SHA-256 Digest (content_digest)   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 4. Copy to Versioned Archive (~/.agent-store/snapshots)│
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 5. Generate PluginSnapshot & Register in Local Catalog │
└────────────────────────────────────────────────────────┘
```

The three primary manifest formats and directory layouts supported are:

| Manifest Category | Root Path | Core Fields | Asset Specification |
| --- | --- | --- | --- |
| Expert Plugin Manifest | `.codebuddy-plugin/plugin.json` | `name`, `version`, `agents`, `teams`, `commands` | Encapsulates system prompts, model preferences, and bound skills |
| Skill Marketplace Manifest | `.codebuddy-skill/marketplace.json` | `name`, `skills` (with `id`, `name`, `source`) | Each skill lives in `skills/<slug>/` containing `SKILL.md` |
| Connector Marketplace Manifest | `.codebuddy-connector/connectors.json` | `name`, `connectors` (with `id`, `source`) | Each connector lives in `connectors/<slug>/` containing `mcp.json` |

---

## 4. PluginSnapshot Immutability Mechanism

The primary output of ingestion is a **PluginSnapshot**, representing a frozen, immutable physical capture of source assets:

- **Write-Once Read-Only**: Once archived to disk and registered in the database, directory permissions are locked as read-only. Any change in source files mandates generating a new snapshot;
- **In-Flight Execution Version Pinning**: Running sessions and Runs bind to the specific `snapshot_id` active at creation time, insulating active executions from concurrent catalog refreshes;
- **Deterministic Audit & Replay**: Execution event streams record Snapshot IDs, schema revisions, and SHA-256 digests, supporting 100% reproducible historical replays;
- For execution engine layering and snapshot isolation details, refer to [Architecture & System Specification](/en-US/docs/architecture).

---

## 5. Custom MCP Connector Integration Guide

Developers can integrate custom MCP servers without publishing them to the public marketplace across three flexible paths:

| Integration Path | Storage Target | Active Scope | Best Suited For |
| --- | --- | --- | --- |
| Static `~/.agent-store/mcp.json` declaration | **No database record**; read at host startup | All host sessions | Private local services and developer debugging |
| Dynamic HTTP management API | `mcp_servers` database table | Bound in explicit session or run | Self-hosted services requiring connection testing and OAuth |
| Marketplace / plugin package import | Written to `mcp_servers` upon installation | Same as above | Packaged assets intended for team or community distribution |

Three transport configurations are supported within the `transport` object:

```json
{
  "stdio": {
    "command": "./my-mcp-server",
    "args": ["--port", "9000"],
    "env": { "DEBUG": "1" }
  },
  "http": {
    "url": "https://mcp.example.com/mcp",
    "headers": { "Authorization": "Bearer secret:MY_MCP_TOKEN" }
  },
  "sse": {
    "url": "https://mcp.example.com/sse",
    "headers": { "X-Api-Key": "secret:MY_API_KEY" }
  }
}
```

Orchestrate and invoke connectors programmatically via the object-oriented TypeScript SDK (`AppServerClient`):

```typescript
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

// 1. Initialize client
const client = new AppServerClient({
  transport: new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws"),
  client: { name: "connector-workflow-app", version: "1.0.0" },
});
await client.connect();

// 2. Discover enabled connectors and verify socket connectivity
const connectors = await client.connectors.list();
const testResult = await client.connectors.test("conn_github_integration");
console.log(`Connection test: ${testResult.ok ? "Success" : "Failed"}`);

// 3. Create a conversation (connectors are also callable directly via client.connectors.call)
const conv = await client.conversations.create({
  name: "GitHub Automation Workflow",
});

// 4. Dispatch inference prompt
await client.conversations.send(
  conv.id,
  "List the 3 most recent pull requests and generate a report in the right panel.",
  crypto.randomUUID(),
);
```

For comprehensive connector method signatures and error handling, see [TypeScript SDK Reference](/en-US/docs/typescript-sdk).

---

## 6. Custom Skill Development & Guidelines

Authoring a custom skill requires no complex backend server; simply organize a valid `SKILL.md` file for the agent to discover and invoke:

```markdown
---
name: web-scraper
display_name: Web Scraper
version: 1.0.0
description: Extract clean text and Markdown structure from any target URL
tags: ["crawler", "html", "parser"]
---

# Web Scraper Skill

## Description
Invoked when the user requires content extraction from public web pages or articles.

## Parameter Definitions
- `url` (string, required): Full HTTP(S) address of the target web page
- `format` (string, optional): Output format, supports `markdown` or `text`, defaults to `markdown`

## Constraints
1. Only scrape public web resources adhering to target robots.txt guidelines;
2. Automatically sanitize `<script>`, `<style>`, and modal DOM elements;
3. Return the parsed document content as Markdown into the session context.
```

- **Directory Layout**: Save the file as `skills/<slug>/SKILL.md`;
- **Local Ingestion & Installation**: Import the skill folder via the Web UI workbench or programmatically via `client.store.installEntry`;
- **Dynamic Runtime Routing**: The Agent inspects its system instructions and task context to automatically bind and invoke the skill during relevant execution turns.

---

## 7. Credential Isolation & Access Control

The system enforces strict zero-leakage and sanitization rules when managing sensitive credentials:

- **`secret:<KEY>` Reference Pattern**: Plaintext tokens are strictly forbidden in connector manifests; use `secret:NAME` identifiers instead;
- **Local Credential Enclave**: Actual secrets reside exclusively in OS-protected vaults (e.g. DPAPI / Keychain / encrypted local data files);
- **Connector Proxy Access Control**: Controlled via `[connector_proxy]` in `~/.agent-store/config.toml`:
  - `enabled = false`: Blocks all proxy tool execution requests;
  - `enabled = true`: Allows enabled connectors to execute tools; granular `allow` and `deny` lists can be configured;
- For detailed proxy parameters, see [Configuration](/en-US/docs/configuration).

---

## 8. Further Reading

- Browse curated assets: [Marketplace](/en-US/market)
- Marketplace configuration and proxy policies: [Configuration](/en-US/docs/configuration)
- Execution engine layering and models: [Architecture & System Specification](/en-US/docs/architecture)
- Client orchestration and API reference: [TypeScript SDK Reference](/en-US/docs/typescript-sdk)
- Real-world production recipes: [SDK Examples](/en-US/docs/examples-sdk)

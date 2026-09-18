# Plugins & Marketplace

Agent Store natively supports **plugins** and a **plugin marketplace**: a plugin bundles capabilities (experts, teams, skills, connectors, commands), and the marketplace is the distribution channel. Consistent with the runtime, the plugin system is **local-first** — the market only handles discovery and distribution; after import, everything (snapshots, credentials, execution) happens on your machine.

## 1. What a plugin contains

A plugin can carry the following components, which become reusable, standardized definitions in the Catalog after import:

| Component | Description |
| --- | --- |
| Expert (AgentDefinition) | Reusable expert configuration, carried at runtime via the Preset mechanism |
| Team (AgentTeamDefinition) | Fixed member roster + collaboration rules |
| Skill (SkillDefinition) | Atomic capability invoked by an Agent; never runs standalone conversations |
| Connector (ConnectorDefinition) | Managed capability for interacting with external systems, with a credential schema |
| Command (CommandDefinition) | User-invokable prompts/commands |
| Hooks / LSP | Lifecycle hooks and language servers (metadata level) |

## 2. Where marketplaces come from

Marketplace sources are declared in [`~/.agent-store/config.toml`](/en-US/docs/configuration) with five `source_kind` values:

| source_kind | source | Notes |
| --- | --- | --- |
| `zip` | HTTP(S) archive URL | **What all three official markets use**: one archive whose **root is the market root** (the manifest sits at the archive root, not inside a wrapper folder), fetched in a single request |
| `url` | HTTPS/HTTP manifest URL | A directory listing (`_files.txt`) is recommended so entry trees can mirror over HTTP |
| `github` | GitHub repository | Fetches the marketplace manifest from GitHub |
| `git` | Git repository URL | Syncs over the Git protocol |
| `directory` | Local directory path | Points directly at a local market/plugin root |

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

A `zip` source uses the archive's own sha256 for both freshness and integrity: the client sends a `HEAD` to the stable URL and reads `X-Linked-Etag` (that sha256); an unchanged digest means no download, and the downloaded bytes are verified against the same digest. On ModelScope a `.zip` goes through LFS, so the stable address answers **302** to a CDN URL carrying a time-limited `auth_key` signature — **write only the stable address, and never copy the CDN URL into a config or a doc**.

`url` / `git` / `github` / `directory` all remain: third-party sources can still mirror a whole tree — a `url` source may ship a pre-generated `_files.txt` in the market root (one relative path per line) that clients walk to mirror the entry tree file by file.

At startup the runtime fetches and parses these manifests, and the **Market** page (top navigation / footer) lets you browse every entry: experts, skills and connectors.

## 3. Import: from market to Catalog

Installing a marketplace entry (`store/install-entry`) runs the importer in a fixed order:

```text
1. Locate the source (market entry / plugin root / skill or connector directory)
2. Parse the manifest (plugin.json / marketplace.json / connectors.json)
3. Path validation: reject ../ traversal and symlink escapes
4. Copy into a versioned immutable cache and compute the content_digest
5. Generate a PluginSnapshot (components + provenance + compatibility report)
6. Emit standardized definitions per component type and register them in the local Catalog
```

Supported source formats:

- **CodeBuddy / WorkBuddy plugins**: `.codebuddy-plugin/plugin.json` + component directories
- **WorkBuddy skill marketplaces**: `.codebuddy-skill/marketplace.json` + `skills/<slug>/` (a single directory with `SKILL.md` also works)
- **WorkBuddy connector marketplaces**: `.codebuddy-connector/connectors.json` + `connectors/<slug>/`

## 4. PluginSnapshot: immutable snapshots

The core artifact of an import is a **PluginSnapshot** — an immutable image of the source content:

- Contains source kind, source URI, declared version, `content_digest`, the component list and a compatibility report;
- Any change in source content requires a **new** snapshot; historical snapshots are never mutated in place;
- A running Agent / Team freezes its target snapshot and is unaffected by later Catalog updates;
- Historical runs can be traced back to the exact snapshot, definition version and content digest.

Components that fail compatibility checks are marked with a status rather than silently dropped; resources with unconfirmed licenses never enter public distribution.

## 5. Credentials & security

- Importing a connector only **creates the credential schema**; real secrets are never read;
- Real credentials enter local secure storage only at runtime — Web / SDK only ever see status, account identifiers and expiry;
- Market sync and import never execute anything remotely; execution semantics belong exclusively to the local `allo` runtime.

## 6. Integrating a self-developed MCP server / custom skills

**A self-developed MCP server does not need to go through the Marketplace registration interface.** The marketplace is only a distribution channel. An MCP server in fact has **three** sources, with different landing points and scopes:

| Source | Lands in | Scope | Best for |
| --- | --- | --- | --- |
| The `~/.agent-store/mcp.json` declaration file | **no row**; read once at host start | that host's sessions | fixed local private servers. File format, fields and validation are in [Configuration](/en-US/docs/configuration) |
| The MCP configuration API (the runtime's own HTTP surface) | a `mcp_servers` row | bound explicitly in a session / run | self-developed or private deployments that want connection tests and OAuth |
| Marketplace / plugin distribution | a `mcp_servers` row, written at install time | as above | public distribution |

All three can coexist. On a name collision **the declaration file > the `mcp_servers` row**, and an explicit binding made in one call outranks both; the source order and the read timing are defined once, in [Configuration](/en-US/docs/configuration), and not repeated here.

The two paths below cover the **latter two** (both land in `mcp_servers`):

### Path A: direct registration (recommended for self-developed / private deployments)

Register by name through the MCP configuration API (these are the runtime's own HTTP endpoints and the host serves them; the Agent Store Web UI does **not** use them — that panel reads and writes the `mcp.json` declaration, see [Configuration](/en-US/docs/configuration)):

- `POST /api/mcp/servers` — register/update an MCP server (upsert by name)
- `POST /api/mcp/servers/import` — batch import
- `POST /api/mcp/test-connection` — connection test
- `/api/mcp/oauth/*` — standard OAuth (PKCE Loopback) login

Three transports are supported; pick the one matching your server (the snippet below is the **value shape** of the `transport` field — a full request body also carries `name`; `mcp.json` is a different spelling, see [Configuration](/en-US/docs/configuration)):

```jsonc
// Local process
{ "stdio": { "command": "./my-mcp-server", "args": [], "env": {} } }
// Streamable HTTP (recommended for remote)
{ "http": { "url": "https://mcp.example.com/mcp", "headers": { "Authorization": "Bearer <token>" } } }
// SSE (legacy remote)
{ "sse": { "url": "https://mcp.example.com/sse", "headers": {} } }
```

API keys / custom auth go directly in the transport `headers`; standard OAuth is handled by the runtime (login, storage, request injection). After registration, bind the server in a session/run (`selected_mcp_server_ids`) — the runtime `McpManager` connects and injects the tools into the model.

### Integrating via the TypeScript SDK

The SDK's connector client is **catalog reads + OAuth pass-through + the call proxy**: `list` / `get` / `status` / `test` (`get` and `test` carry each tool's parameter schema, so you can see how to call it before calling it), `authStart` / `authStatus` / `logout`, and `call`, which actually runs a tool over the host's own connection and needs the host to admit it in `[connector_proxy]` (see the [Configuration file](/en-US/docs/configuration)). **But** the App Server protocol has **no** WebSocket method for "register an MCP server", so inside the SDK a self-developed MCP server is wired in through the protocol-native **import → install** chain: package the server as a connector market directory, `import/run` it into an immutable PluginSnapshot, and `install/run` registers the connector into the runtime `mcp_servers` automatically.

1. Create a minimal connector market directory — **two levels**: the market manifest lists entries, each entry's `source` points at its own directory, and the server declaration lives in there:

   ```text
   my-market/
   ├── .codebuddy-connector/
   │   └── connectors.json        # market manifest: id/name + source (relative)
   └── my-mcp/
       └── mcp.json               # server declaration: mcpServers
   ```

   ```json
   {
     "name": "my-connectors",
     "connectors": [
       { "id": "my-mcp", "name": "My MCP", "version": "0.1.0", "source": "my-mcp" }
     ]
   }
   ```

   An entry is keyed by `id` or `name`, and `source` **must be relative**; the fields inside `mcp.json`'s `mcpServers` are the **same set** as `~/.agent-store/mcp.json` (`command` / `url` / `headers` / `env`), and the importer turns each of them into a connector component — fields and validation are in the [Configuration file](/en-US/docs/configuration).

   ```json
   {
     "mcpServers": {
       "my-mcp": { "url": "https://mcp.example.com/mcp" }
     }
   }
   ```

2. Import and install within the SDK session (the `import` / `install` methods have no sub-client wrapper yet — pass them through `transport.request`):

   ```ts
   import { launchHarness } from "@flowy-agent-store/sdk";

   const harness = await launchHarness({ client: { name: "my-app", version: "0.1.0" } });

   // 1. Import: produces an immutable PluginSnapshot (idempotent per digest, reused=true)
   const snap = await harness.transport.request("import/run", {
     source_path: "/abs/path/to/my-market", // the market root (holds .codebuddy-connector/)
     source_kind: "workbuddy-connector-market",
   });

   // 2. Install: the connector component is registered into the runtime mcp_servers
   await harness.transport.request("install/run", { snapshot_id: snap.snapshot_id });

   // 3. Discover the catalog and inject in a run
   const connectors = await harness.connectors.list();
   await harness.runs.agent({
     agentId: "<agent-id>",
     goal: "……",
     mentions: [{ kind: "connector", id: connectors[0].id }],
   });

   await harness.close();
   ```

3. For standard OAuth, start with the SDK's `connector.authStart(connectorId)` and poll `connector.authStatus` until `authenticated`;
4. At run time, inject via `mentions`: `{ kind: "connector", id }` appends to the run's MCP list (must be an enabled server); skills mount with `{ kind: "skill", id }`. Query install state with `install/status` and manage it with `install/enable` / `install/disable`.

### Path B: marketplace / plugin distribution (for public distribution)

To let others install your server from a marketplace in one click, package it as:

- **A connector marketplace entry**: `.codebuddy-connector/connectors.json` + `connectors/<slug>/`, published to a marketplace source (`source_kind` supports `zip` / `url` / `github` / `git` / `directory`);
- **Plugin-level MCP**: a `.mcp.json` (`mcpServers` field) inside a `.codebuddy-plugin/` plugin package.

After installation both paths land in `mcp_servers` — the two paths converge. Note that V1 OAuth only supports standard PKCE Loopback; custom URI schemes, public relays and other complex auth flows are not yet supported.

### Custom skills

- SDK / protocol: `import/run` (`source_kind: "workbuddy-skill-market"`; a single directory containing `SKILL.md` also works) → `install/run`, then mount via a run mention;
- Local: `POST /api/skills/import` (directory or zip) imports as user skills;
- Marketplace: publish using the `.codebuddy-skill/marketplace.json` + `skills/<slug>/` layout.

## 7. Further reading

- Browse entries: [Market page](/en-US/market)
- Marketplace configuration: [Configuration](/en-US/docs/configuration)
- Architecture and import layering: [Architecture](/en-US/docs/architecture)

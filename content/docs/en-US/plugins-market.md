# Plugins & Marketplace

Flowy Agent Store natively supports plugins and plugin marketplaces: a plugin packages functional assets (including experts, teams, skills, connectors, and commands), while a marketplace serves as the distribution channel. The plugin architecture adheres to the **local-first** paradigm — the marketplace manages discovery and distribution, while imported snapshots, credentials, and runtime execution remain entirely on the local machine.

## 1. What a plugin contains

Importing a plugin converts assets into standardized, reusable component definitions within the Catalog:

| Component | Description |
| --- | --- |
| Expert (AgentDefinition) | Reusable agent configuration, mounted via the Preset mechanism at runtime |
| Team (AgentTeamDefinition) | Multi-agent collaboration definition containing member rosters and policies |
| Skill (SkillDefinition) | Atomic capability invoked by an Agent; does not maintain independent conversations |
| Connector (ConnectorDefinition) | Managed integration component (MCP) with credential schema declarations |
| Command (CommandDefinition) | User-invokable prompts and task execution templates |
| Hooks / LSP | Runtime lifecycle hooks and language server extensions (metadata level) |

## 2. Where marketplaces come from

Marketplace sources are declared in [`~/.agent-store/config.toml`](/en-US/docs/configuration) across five supported `source_kind` protocols:

| source_kind | source | Notes |
| --- | --- | --- |
| `zip` | HTTP(S) archive URL | **Official marketplace standard**: single archive package where the root directory matches the catalog manifest root; synchronizes full metadata in a single request |
| `url` | HTTPS/HTTP manifest URL | Remote manifest directory; supplying an index file (`_files.txt`) is recommended for incremental tree mirroring |
| `github` | GitHub repository | Synchronizes marketplace manifests directly from a GitHub repository |
| `git` | Git repository URL | Clones and pulls updates using the Git protocol |
| `directory` | Local directory path | Directly points to a local filesystem development directory |

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

The `zip` source verifies cache freshness and archive integrity via content hashes: the client dispatches an HTTP `HEAD` request to read the `X-Linked-Etag` header (representing the sha256 archive digest), skipping re-download when unchanged and validating payload integrity upon transfer. When hosted via ModelScope LFS, stable URLs return HTTP 302 redirects to signed CDN URLs; **always configure stable URLs in settings, never hardcode temporary signed CDN URLs**.

Other source kinds (`url`, `git`, `github`, `directory`) support full file tree mirroring. For `url` sources, the server may provide a precompiled `_files.txt` in the root directory for automated mirror sync.

The runtime parses configured marketplace manifests at startup. Entries can be searched and inspected via the **Market** link in the Web UI navigation.

## 3. Import: from market to Catalog

Triggering an installation via the marketplace (`store/install-entry`) invokes the importer pipeline through the following deterministic sequence:

```text
1. Locate the source (market entry / plugin root / skill or connector directory)
2. Parse the manifest (plugin.json / marketplace.json / connectors.json)
3. Path validation: reject ../ traversal and symlink escapes
4. Copy into a versioned immutable cache and compute the content_digest
5. Generate a PluginSnapshot (components + provenance + compatibility report)
6. Emit standardized definitions per component type and register them in the local Catalog
```

Supported manifest and directory structures:

- **CodeBuddy / WorkBuddy plugins**: `.codebuddy-plugin/plugin.json` with associated component trees
- **WorkBuddy skill marketplaces**: `.codebuddy-skill/marketplace.json` with `skills/<slug>/` layout (or standalone directories containing `SKILL.md`)
- **WorkBuddy connector marketplaces**: `.codebuddy-connector/connectors.json` with `connectors/<slug>/` layout

## 4. PluginSnapshot: immutable snapshots

The primary output of ingestion is a **PluginSnapshot**, representing a frozen, immutable capture of the source assets:

- Encapsulates source type, source URI, declared version, `content_digest`, component metadata, and compatibility evaluations;
- Any change in source files mandates generating a new snapshot; existing snapshots remain strictly immutable;
- Running Agent or Team instances bind to explicit snapshot IDs, insulating active runs from concurrent Catalog updates;
- Enables complete traceability across Snapshot ID, definition revision, and content digest.

Components failing static compatibility checks are marked with descriptive statuses rather than silently dropped; assets lacking explicit licensing are excluded from public catalogs.

## 5. Credentials & security

- **Schema-Only Ingestion**: Importing connectors registers credential schemas only; private keys are never accessed or stored during this phase;
- **Dynamic Runtime Injection**: Secrets reside exclusively in local secure storage; external interfaces (Web / SDK) expose only configuration state and masked identifiers;
- **Sandboxed Execution**: Manifest synchronization and asset ingestion never execute untrusted remote code; tool execution semantics are strictly isolated within the local `allo` Runtime.

## 6. Integrating a self-developed MCP server / custom skills

Developers can integrate custom MCP servers without publishing them to the public marketplace. MCP servers can be introduced through three distinct mechanisms:

| Source | Lands in | Scope | Best for |
| --- | --- | --- | --- |
| The `~/.agent-store/mcp.json` declaration file | **No database record**; read at host startup | All host sessions | Private local services. See [Configuration](/en-US/docs/configuration) for syntax and validation rules |
| The MCP configuration API (HTTP endpoints) | `mcp_servers` table | Explicitly bound in a session or run | Self-hosted services requiring connection testing and OAuth flows |
| Marketplace / plugin distribution | Written to `mcp_servers` upon installation | Same as above | Packaged assets intended for public or team distribution |

Precedence hierarchy: for matching identifiers, **`mcp.json` declarations override `mcp_servers` records**; explicit bindings provided within an active invocation take highest precedence.

The two persistent registration paths operate as follows:

### Path A: direct registration (recommended for self-developed / private deployments)

Register servers by identifier via the host HTTP management API:

- `POST /api/mcp/servers` — Upsert an MCP Server by name
- `POST /api/mcp/servers/import` — Batch import server definitions
- `POST /api/mcp/test-connection` — Test physical socket connectivity
- `/api/mcp/oauth/*` — Standard OAuth (PKCE Loopback) endpoints

Three transport configurations are supported within the `transport` object:

```jsonc
// Local child process (stdio)
{ "stdio": { "command": "./my-mcp-server", "args": [], "env": {} } }
// Streamable HTTP (recommended for remote endpoints)
{ "http": { "url": "https://mcp.example.com/mcp", "headers": { "Authorization": "Bearer <token>" } } }
// SSE (legacy remote streaming)
{ "sse": { "url": "https://mcp.example.com/sse", "headers": {} } }
```

Static authentication headers are passed within `headers`; OAuth lifecycles are orchestrated by the runtime. Once registered, servers are bound via `selected_mcp_server_ids` in session or run payloads, allowing `McpManager` to establish connections and expose tools to model prompts.

### Integrating via the TypeScript SDK

The SDK connector client provides catalog queries, OAuth lifecycles, and tool call delegation (`list`, `get`, `status`, `test`, `call`). Custom MCP servers can be registered programmatically through the native **import $\to$ install** pipeline:

1. Create a two-level directory structure for the connector source:

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

   The `source` attribute must be a relative directory path; `mcpServers` adheres to standard definitions:

   ```json
   {
     "mcpServers": {
       "my-mcp": { "url": "https://mcp.example.com/mcp" }
     }
   }
   ```

2. Execute import and installation within an active harness session:

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

3. Initiate OAuth via `connector.authStart(connectorId)` and await resolution with `connector.waitForAuth(connectorId)`;
4. Inject components at execution time via `mentions`: `{ kind: "connector", id }` mounts an active MCP server, while `{ kind: "skill", id }` mounts a skill. State can be inspected with `install/status` and toggled via `install/enable` / `install/disable`.

### Path B: marketplace / plugin distribution (for public distribution)

For public distribution, MCP servers can be bundled into either:

- **Dedicated Connector Packages**: `.codebuddy-connector/connectors.json` accompanied by `connectors/<slug>/`, hosted on any supported marketplace source;
- **Plugin-Level MCP Bundles**: A `.mcp.json` file defining `mcpServers` placed inside `.codebuddy-plugin/`.

Client installations automatically populate the local `mcp_servers` table.

### Custom skills

- **SDK / Protocol Ingestion**: Execute `import/run` (`source_kind: "workbuddy-skill-market"`) $\to$ `install/run`, then mount via run `mentions`;
- **Local Filesystem Import**: Dispatch `POST /api/skills/import` (pointing to a local directory or ZIP file) to register a private user skill;
- **Marketplace Publishing**: Distribute using the `.codebuddy-skill/marketplace.json` + `skills/<slug>/` layout.

## 7. Further reading

- Browse entries: [Market page](/en-US/market)
- Marketplace configuration: [Configuration](/en-US/docs/configuration)
- Architecture and import layering: [Architecture](/en-US/docs/architecture)

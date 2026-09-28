# TypeScript SDK reference

Flowy Agent Store distributes three companion TypeScript packages providing strongly-typed integration with the local App Server across Node.js, Electron, and browser environments:

| Package | Responsibility | Environment | Dependencies |
| --- | --- | --- | --- |
| `@flowy-agent-store/protocol` | Wire protocol type definitions (requests, responses, notifications, errors) | Universal (zero-runtime, no DOM/Node dependencies) | None |
| `@flowy-agent-store/client` | `AppServerClient` core client, 9 domain sub-clients, and `Transport` abstractions | Universal (unbound from specific I/O mechanisms) | `@flowy-agent-store/protocol` |
| `@flowy-agent-store/sdk` | Host runtime process management (binary spawning, loopback socket binding, client bootstrapping) | Node.js (requires `node:child_process` and related modules) | `@flowy-agent-store/client`, `@flowy-agent-store/protocol` |

Combine packages according to integration context: consume `protocol` for **pure type contracts**; initialize `client` with `WebSocketTransport` to **connect to an active App Server**; or use `sdk`'s `launchHarness` to **manage local runtime lifecycles programmatically**.

Complete runnable recipes (Node, browser, Electron, store management, sessions, and run execution) are available in the [TypeScript SDK cookbook](/en-US/docs/examples-sdk).

> **Integration Notice**: This document targets software developers. Desktop end-users should install precompiled binary installers directly; see [Quick start](/en-US/docs/quick-start).

---

## 1. Installation

```bash
# Usually sdk alone is sufficient (re-exports client and bundles child process orchestration)
bun add @flowy-agent-store/sdk        # or npm install / pnpm add

# Explicitly declare when consuming protocol types standalone
bun add @flowy-agent-store/protocol
```

All packages distribute in dual ESM and CJS formats (providing `import`, `require`, and `types` declarations).

> **Version Status**: Packages currently publish under `0.1.0-beta.*` prerelease semantics. Production environments should pin exact package revisions (such as `0.1.0-beta.7` documented here). Consult the [Upgrade and migration guide](/en-US/docs/upgrade) for lifecycle policies.
> **Protocol Scope**: `APP_SERVER_PROTOCOL_VERSION` in §2 and method coverage metrics in §5.3 reflect current repository contracts. Protocol fingerprints enforce strict equality; cross-version clients and hosts are strictly incompatible.
> **Runtime Environment**: Node.js **≥ 22** (requires global `WebSocket`) or Bun; version floors declared in respective package `engines.node` manifests.

---

## 2. `@flowy-agent-store/protocol` — Protocol Layer

### 2.1 Role

The single source of truth for the wire specification: exports all request, response, and notification contracts, the `APP_SERVER_PROTOCOL_VERSION` constant, and structured error models. The package is zero-I/O and contains only pure validation and utility routines.

### 2.2 Core exports

| Export | Description |
| --- | --- |
| `APP_SERVER_PROTOCOL_VERSION` | Protocol contract fingerprint (format `fp-<n>` monotonic identifier, currently `"fp-11"`). Enforces strict equality during initialization |
| `InitializeRequest` / `InitializeResult` | Handshake request/response payload models (carrying `protocol_version` and host server metadata) |
| `ClientInfo` / `ClientCapabilities` | Client self-description and feature negotiation claims |
| `StoreList` / `StoreInstallResult` | Unified package catalog interfaces |
| `AgentSummary` / `AgentDetail` | Agent expert catalog views |
| `TeamSummary` / `TeamDetail` | Agent Team collaboration catalog views |
| `SkillSummary` / `SkillDetail` | Skill capability catalog views |
| `ConnectorSummary` / `ConnectorDetail` / `ConnectorStatusView` / `ConnectorProbeResult` | Connector catalog views, lifecycle statuses, and physical probe outcomes |
| `OAuthStartResult` / `OAuthStatusView` | OAuth authorization flow lifecycle states |
| `ConversationView` / `ConversationMessage` / `ConversationEvent` / `ConversationSendReceipt` | Persistent conversation session and message contracts |
| `RunReceipt` / `RunView` / `RunResult` / `RunEvent` | Execution run lifecycle and event stream models |
| `JsonRpcRequest` / `JsonRpcResponse` / `JsonRpcNotification` | Core wire framing types |
| `ServerNotification` | Downstream server push notifications (events, list changes, resync signals) |
| `WireError` | Standardized server error payloads |

> The protocol exposes a unified interface without experimental branches. Team orchestration and event cursor catch-up mechanics ship across the standard export surface.

### 2.3 Error models (package `errors.ts`)

Callers must branch on stable `code` identifiers rather than human-readable `message` strings:

| Type | Trigger | Key fields |
| --- | --- | --- |
| `AppServerError` | Server-returned JSON-RPC error payload | `code`, `requestId` (`request_id` on the wire), `retryable`, `details` |
| `TransportError` | Transport socket failure (connect, send, receive, close) | `phase` (`connect`/`send`/`receive`/`close`), `retryable` |
| `ProtocolError` | Client-side protocol contract validation failure | `kind` (`invalid_message` / `version_mismatch` / `unexpected_response`) |
| `RequestTimeoutError` | Request timeout exceeded | `method`, `timeoutMs` |

Utility error helpers:

```ts
import { isAppServerError, isRetryableTransportError, formatError } from "@flowy-agent-store/protocol";

try {
  await client.runs.agent({ agentId, goal });
} catch (error) {
  if (isAppServerError(error)) {
    // Branch on stable code; do not parse message text
    console.log(error.code, error.retryable);
  } else if (isRetryableTransportError(error)) {
    // Socket disconnected; retryable
  }
  console.log(formatError(error)); // Canonical UI error formatting
}
```

> Idempotency conflicts (`conflict`) and policy denials (`policy_denied`) are strictly non-retryable (`retryable: false`).

---

## 3. `@flowy-agent-store/client` — Transport-Agnostic Client

### 3.1 Role

Domain client abstraction: all methods execute across an injected `Transport` interface without binding to concrete I/O implementations. Lifecycle state transitions (`connect → initialize → version check → initialized → ready`) are encapsulated within this layer.

### 3.2 `Transport` interface

```ts
export interface Transport {
  connect(): Promise<void>;                          // Idempotent socket setup
  request<T>(method: string, params: unknown): Promise<T>;  // Request-response
  notify(method: string, params: unknown): void;     // Unidirectional notification
  onNotification(listener: NotificationListener): () => void; // Event subscription returning unsubscribe fn
  close(): void;
  onLifecycle?(listener: (state: "open" | "closed") => void): () => void; // Optional socket state hooks
}
```

Built-in `WebSocketTransport` (compatible with modern browsers, Node 22+, and Bun via global `WebSocket`):

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const transport = new WebSocketTransport({ url: "ws://127.0.0.1:8787/api/app-server/ws" });
const client = new AppServerClient(transport);
await client.connect();
```

### 3.3 Domain Sub-Clients

#### `connectors` — Connector Management and Invocation

```ts
client.connectors.list(): Promise<ConnectorSummary[]>;
client.connectors.get(connectorId: string): Promise<ConnectorDetail>;        // Namespaced tools and auth state
client.connectors.status(connectorId: string): Promise<ConnectorStatusView>; // Connected requires active auth and successful probe
client.connectors.test(connectorId: string): Promise<ConnectorProbeResult>;  // Physical socket test; tool signatures resolved here
client.connectors.authStatus(connectorId: string): Promise<OAuthStatusView>; // Diagnostic failure details in error field
client.connectors.authStart(connectorId: string): Promise<OAuthStartResult>; // Initiates host browser OAuth flow
client.connectors.waitForAuth(connectorId: string, options?: { timeoutMs?, pollMs? }): Promise<WaitForAuthOutcome>; // Polls until resolution
client.connectors.logout(connectorId: string): Promise<void>;                // Revokes credentials
client.connectors.call(connectorId: string, tool: string, args?: unknown): Promise<ConnectorCallResult>; // Proxies tool execution
client.connectors.register(registration: ConnectorRegistration): Promise<ConnectorDetail>; // Programmatic MCP server registration (fp-11)
client.connectors.credentials(connectorId: string): Promise<ConnectorCredential>;      // Form definition and status (fp-11)
client.connectors.setCredentials(connectorId: string, values: Record<string, string>): Promise<ConnectorCredential>; // Persists secrets
client.connectors.clearCredentials(connectorId: string, keys?: string[]): Promise<ConnectorCredential>;              // Clears secrets
```

> **Dynamic Connector Registration** (introduced in `fp-11`): Custom MCP servers can be registered programmatically via template definitions without bundling catalog manifests:
>
> ```ts
> const created = await client.connectors.register({
>   name: "acme-mcp",
>   transport: {
>     type: "http",
>     url: "https://mcp.acme.com/mcp",
>     headers: { Authorization: "Bearer ${secret:ACME_KEY}" },
>     values: {},                       // Non-secret connector configuration
>   },
> });
> created.credential?.missing;          // ["ACME_KEY"] —— Missing key names
> await client.connectors.setCredentials(created.id, { ACME_KEY: process.env.ACME_KEY! });
> const probe = await client.connectors.test(created.id);   // Validate physical connectivity
> ```
>
> Templates reference credentials using `${secret:KEY}` syntax. The host derives the credential schema automatically, with `missing` reporting unfilled keys.
>
> Architectural invariants:
> - **Write-Only Credential Safety**: Registration accepts no plaintext secrets; sensitive values are populated via `setCredentials()`, and responses mask secret values.
> - **Disabled Initial State**: Dynamically registered connectors initialize as `disabled`, requiring a successful probe before activation.
> - **Owner Scoping**: Registration is restricted to the host owner; duplicate names update existing configurations.

> **Credential Model** (introduced in `fp-9`): `credentials(id)` returns form schema blocks (`mode`, `status`, `missing`, and `fields[]`). Secrets are scoped to the caller principal (`<principal>:NAME`) and masked in query outputs.
>
> Set credentials via `setCredentials(id, values)`; revoke via `clearCredentials(id, keys?)`.

> **Tool Invocation Proxy**: `call()` invokes MCP tools through connections maintained by the host. Callers supply the tool name and arguments; underlying parameters and tokens remain encapsulated on the host. Host policy (`[connector_proxy]`) governs access, rejecting unauthorized calls with `policy_denied`.
>
> **Parameter Validation**: `get()` and `test()` provide raw tool `input_schema` definitions. Parameter errors return `{ is_error: true }` without rejecting the invocation promise.

> **Tool Error Semantics**: Business-level tool failures resolve with `{ is_error: true, content }`. Promises reject only upon infrastructure or transport failures (timeouts, network errors, policy denials, not found).

> **OAuth Lifecycle**: OAuth authorization is managed via trusted host browser flows; clients initiate and monitor state changes asynchronously. `waitForAuth(id)` provides structured polling (default timeout 120s).

#### `store` — Catalog Operations (Search / Install / Enable / Uninstall)

```ts
client.store.list(): Promise<StoreItem[]>;
client.store.search(query: string, filter?: { kind?: StoreItemKind }): Promise<StoreItem[]>;
client.store.installed(): Promise<StoreItem[]>;
client.store.checkUpdates(): Promise<StoreItem[]>;                 // Installed items with pending updates
client.store.updateHint(item): "none" | "uninstall_reinstall" | "unknown";
client.store.install(item, opts?: { waitForReady?, timeoutMs?, signal? }): Promise<StoreOperationOutcome>;
client.store.setEnabled(item, enabled: boolean, opts?: { componentIds? }): Promise<StoreOperationOutcome>;
client.store.uninstall(item, opts?: { componentIds? }): Promise<StoreOperationOutcome>;
```

> The `store` sub-client coordinates multi-step state transitions. `install` defaults `waitForReady: true`, performing static imports for skills and probe validation for connectors. Detailed component statuses return in `outcome.components`.

#### `conversations` — Persistent Sessions

```ts
client.conversations.create(input): Promise<ConversationView>;  // Omitted model resolves to config.toml defaults
client.conversations.update(id, input): Promise<ConversationView>;
client.conversations.modelOptions(): Promise<ConversationModelOptions>;
client.conversations.list(limit = 100): Promise<ConversationView[]>;
client.conversations.get(id): Promise<ConversationView>;
client.conversations.messages(query): Promise<ConversationMessagesPage>; // page/page_size/cursor
client.conversations.send(id, content, idempotencyKey, options?): Promise<ConversationSendReceipt>; // Requires explicit idempotency key
client.conversations.cancel(id): Promise<ConversationView>;
client.conversations.delete(id): Promise<{ conversation_id: string; deleted: boolean }>;
await client.conversations.follow(id): Promise<ConversationSubscription>;
```

The fourth parameter of `send()` configures per-turn parameters:

```ts
client.conversations.send(id, content, key, {
  attachments: ["/abs/path/inside/workspace.png"],   // Absolute path within conversation workspace
  mentions: [{ kind: "skill", id: "release-notes" }], // Attached skill definition
});
```

> **Dynamic Skill Mentions**: `mentions` accepts only `kind: "skill"`. Skills attach per-turn without mutating the frozen conversation snapshot. Supplying unsupported mention kinds returns `invalid_request`.

`send()` also supports adjusting model choices and reasoning effort dynamically:

```ts
await client.conversations.send(id, content, key, {
  model: { provider_id: "opencode", model: "mimo-v2.5" }, // Maps to provider keys in config.toml
  reasoningEffort: "high",                                 // low | medium | high | xhigh | max
});
```

> **Session Configuration Persistence**: Modifications persist across subsequent conversation turns. Model mutations during an active turn (`running`) fail with `conflict`.

`create()` supports binding an expert identity via `agentId`:

```ts
const experts = await client.agents.list();
const architect = experts.find((agent) => agent.name === "software-architect");

const conv = await client.conversations.create({
  name: "Architecture Review",
  agentId: architect!.id,     // Must match agent/list; returns agent_not_installed if missing
});
```

> **Expert Immutability**: The expert identity and associated preset snapshots freeze at conversation creation; changing identities requires a new conversation.

`create()` also initializes an Agent Team Leader session via `teamId`:

```ts
const teams = await client.teams.list();
const company = teams.find((team) => team.name === "Software Company");

const leader = await client.conversations.create({ teamId: company!.id });
// Orchestrates team context and launches into the interactive Leader session
await client.conversations.send(leader.conversation_id, "Decompose requirements into steps", crypto.randomUUID());
```

> `teamId` and `agentId` are mutually exclusive. Sessions fail fast during creation if member agents or connectors are missing or disabled.

`modelOptions()` provides catalog metadata from models.dev (such as token pricing `cost_input`/`cost_output` and context capacities). Omitted for uncataloged models.

Real-time subscription object:

```ts
const sub = await client.conversations.follow(convId);
sub.onEvent((event) => console.log("seq", event.sequence, event)); // Deduplicates by sequence
sub.onResync((reason) => console.log("resync required:", reason)); // Disconnect catch-up notification
sub.lastSequence; // Highest observed sequence number
await sub.rearm(); // Re-register listeners and reset cursor on reconnect
await sub.close(); // Server-side unsubscription
```

> Call `conversation/messages` following `rearm()` to backfill transcript deltas missed during disconnects.

#### `runs` — Execution Lifecycle and Event Streams

```ts
client.runs.agent(input: AgentRunInput): Promise<RunReceipt>; // Asynchronous receipt
client.runs.team(input: TeamRunInput): Promise<TeamRunReceipt>; // Team run: Leader session + planned delegation
client.runs.get(runId): Promise<RunView>;                     // Authoritative status
client.runs.plan(runId): Promise<RunPlan>;                    // Execution plan graph (run/plan)
client.runs.result(runId): Promise<RunResult>;                // Resolves on terminal completion
client.runs.events({ runId, afterSequence, limit }): Promise<RunEvent[]>; // Cursor-based event replay
client.runs.cancel({ runId, expectedVersion, commandId, idempotencyKey }): Promise<RunView>;
await client.runs.follow(runId): Promise<EventSubscription>;
```

`runs.agent()` allows overriding model and reasoning parameters for a specific run:

```ts
await client.runs.agent({
  agentId: architect!.id,
  goal: "Decompose requirements into steps",
  model: { provider_id: "opencode", model: "mimo-v2.5" },
  reasoningEffort: "high",
});
```

> Parameter precedence: Explicit invocation parameters > Preset defaults > Host configuration defaults (`default_model`).

```ts
const sub = await client.runs.follow(runId);
sub.onEvent((event) => console.log(event));       // Best-effort event stream
sub.onResync(({ run_ids, reason }) => …);         // Reconnection catch-up signal
sub.onError((error) => …);                        // Transport error callback
sub.lastSequence;
const replayed = await sub.rearm();               // Reconnect: resets sequence and replays history
await sub.close();
```

> Event streams provide best-effort ordering; clients must deduplicate sequences using `run/events` replay cursors.

#### `workspaces` — Workspace Registration

```ts
client.workspaces.list(): Promise<WorkspaceView[]>;
client.workspaces.create(path: string): Promise<WorkspaceView>; // Canonical path resolution; rejects symlink loops
client.workspaces.revoke(workspaceId: string): Promise<WorkspaceRevokeResult>; // Soft revocation preserving sessions
```

---

## 4. `@flowy-agent-store/sdk` — Node Host Operations

### 4.1 `launchHarness(options): Promise<Harness>`

Spawns the local runtime binary, awaits the standard output readiness notification, binds a loopback connection, and performs the `initialize` / `initialized` protocol handshake. The returned `Harness` instance extends `AppServerClient` with process lifecycle management.

```ts
interface HarnessOptions extends SpawnOptions {
  client: ClientInfo;             // { name, version }
  capabilities?: ClientCapabilities;
  token?: string;                 // Forwarded to WebSocketTransport
  requestTimeoutMs?: number;      // Default 30s
}

interface Harness extends AppServerClient {
  server: SpawnedServer;          // readiness / dataDir / exited / close
  handshake: InitializeResult;    // Handshake payload (non-null)
  close(): Promise<void>;         // Unsubscribe → close socket → kill process → clean temp data-dir
}
```

`HarnessOptions` configuration fields:

| Field | Default | Description |
| --- | --- | --- |
| `client` | — | **Required**; client identification recorded in server audit logs |
| `capabilities` | omitted | Capability declarations (`{ events?, approvals?, team_runtime?, artifacts? }`) |
| `token` | omitted | Authentication token supplied to `WebSocketTransport` via query parameter |
| `requestTimeoutMs` | `30000` | RPC request timeout in milliseconds |

`Harness` instance members:

| Member | Content | Purpose |
| --- | --- | --- |
| `conversations` / `agents` / `teams` / `skills` / `connectors` / `models` / `workspaces` / `runs` / `store` | `AppServerClient` domain interfaces | Direct entry points for business operations |
| `handshake` | Handshake response payload | Access protocol version fingerprints and host capabilities |
| `initializeInfo` | Current readiness state | Connection readiness check (`null` after `close()`) |
| `server.readiness` | Parsed readiness metadata | Contains host, port, url, protocol_version, auth, etc. |
| `server.dataDir` | Active data directory | Validates directory paths and test isolation |
| `server.exited` | Process exit Promise | Observes process crashes or exit signals |
| `close()` | Teardown function | Closes transports, terminates child processes, and cleans temporary files |

> **Operational Boundaries**: `launchHarness` does not modify external model configurations (`config.toml`); runs against an ephemeral sandbox directory when `dataDir` is omitted; and does not register implicit process exit hooks.

### 4.2 Low-Level Primitives

| Export | Description |
| --- | --- |
| `spawnAppServer(options: SpawnOptions)` | Spawns child process and awaits readiness notification (without opening sockets) |
| `resolveAppServerBin(explicit?)` | Resolves runtime binary path across known locations |
| `parseReadinessLine(line)` | Parses standard output single-line JSON readiness payloads |
| `ReadinessInfo` | Structured readiness metadata `{ host, port, url, protocol_version, version, auth }` |
| `assertProtocolCompatible(runtimeVersion)` | Asserts protocol compatibility, throwing on mismatch |
| `SpawnExitInfo` | Process exit payload `{ code, signal }` |

`SpawnOptions` interface:

```ts
interface SpawnOptions {
  bin?: string;            // Explicit binary path override
  dataDir?: string;        // Dedicated data directory; temporary directory if omitted
  port?: number;           // Defaults to 0 (dynamic OS allocation)
  extraArgs?: string[];    // Additional command-line flags
  readyTimeoutMs?: number; // Defaults to 120s
  env?: Record<string, string | undefined>; // Merged with process.env
  cwd?: string;            // Working directory override
  onExit?: (info: SpawnExitInfo) => void;   // Exit callback
}
```

### 4.3 Binary Discovery

Binaries resolve sequentially: explicit `bin` flag $\to$ `AGENT_STORE_BIN` environment variable $\to$ optional platform runtime package `@flowy-agent-store/runtime-<platform>-<arch>` $\to$ system `PATH`. Unresolved paths trigger immediate errors.

```bash
AGENT_STORE_BIN=/opt/flowy-agent-store/flowy-agent-store node your-app.mjs
```

### 4.4 Process Contract

- **Loopback Enforcement**: Child processes bind `--host 127.0.0.1 --no-open`; clients connect strictly to loopback addresses.
- **Data Directory Mutual Exclusion**: Omitting `dataDir` generates an isolated temporary directory via `mkdtemp`; existing directories enforce single-instance file locks.
- **Protocol Version Verification**: Handshake mismatches terminate the child process immediately with an explanatory error.
- **Readiness Line Matching**: The SDK scans stdout for single-line JSON containing `"agent_store":"listening"` to discover port assignments.
- **Continuous Output Draining**: stdout continues draining after readiness to prevent OS pipe buffer saturation and process deadlocks.
- **Environment Inheritance**: `env` merges with `process.env`; `cwd` defaults to the parent process directory.

### 4.5 Teardown and Cleanup

- Spawning failures capture the final 50 lines of stderr;
- Failure to reach readiness within `readyTimeoutMs` terminates the process;
- Implement `try/finally` blocks to guarantee invocation of `harness.close()`, releasing file handles and temporary directories.

```ts
const harness = await launchHarness({ client: { name: "x", version: "1" } });
try {
  await harness.connectors.list();
} finally {
  await harness.close();
}
```

### 4.6 Export Helpers: `exportAgent` / `exportTeam` / `materializePack`

Serializes agent and team definitions alongside referenced skill files into a local directory. Coordinates existing wire APIs (`agent/export`, `team/export`, `skill/files`, `skill/file`) without altering wire contracts.

```ts
import { exportAgent, exportTeam, materializePack } from "@flowy-agent-store/sdk";

// Single agent export; use exportTeam for multi-agent bundles
const result = await exportAgent(client, agentId, "./my-expert");
result.pack;           // ExpertPack object in memory
result.writtenSkills;  // Written skill names
result.danglingSkills; // Unresolved skills: { id, error }
```

- **Output Structure**: Writes `expert-pack.json` (metadata manifest), `persona.md` (persona instructions), and `skills/<name>/...` (associated assets).
- **Execution Invariants**: Fetches and verifies all assets before initiating disk writes to prevent partial artifacts.

---

## 5. Method API Reference

### 5.1 `AppServerClient` Top-Level Methods

| Method | Parameters | Return | Protocol method |
| --- | --- | --- | --- |
| `connect()` | — | `InitializeResult` | `initialize` → `initialized` |
| `onNotification(listener)` | `(notification) => void` | Unsubscribe function | — (Server notifications) |
| `close()` | — | `void` | — |
| `runImport(input)` | `ImportRequest` | `ImportResult` | `import/run` |
| `listImports()` | — | `ImportSummary[]` | `import/list` |
| `getImport(snapshotId)` | `string` | `ImportDetail` | `import/get` |
| `runInstall(input)` | `InstallRequest` | `InstallResult` | `install/run` |
| `getInstallStatus(snapshotId)` | `string` | `InstallStatus` | `install/status` |
| `disableInstall(snapshotId, componentIds)` | `string, string[]` | `InstallStatus` | `install/disable` |
| `enableInstall(snapshotId, componentIds)` | `string, string[]` | `InstallStatus` | `install/enable` |
| `uninstallInstall(snapshotId, componentIds)` | `string, string[]` | `InstallStatus` | `install/uninstall` |
| `addMarketplace(input)` | `MarketplaceAddRequest` | `MarketplaceSummary` | `market/add` |
| `listMarketplaces()` | — | `MarketplaceSummary[]` | `market/list` |
| `getMarketplace(marketplaceId)` | `string` | `MarketplaceDetail` | `market/get` |
| `removeMarketplace(marketplaceId, cascade)` | `string, boolean` | `MarketplaceRemoveResult` | `market/remove` |
| `setMarketplaceAutoUpdate(marketplaceId, enabled)` | `string, boolean` | `MarketplaceSummary` | `market/auto-update` |
| `refreshMarketplace(marketplaceId)` | `string` | `MarketplaceRefreshResult` | `market/refresh` |
| `importMarketplaceEntry(marketplaceId, entryName)` | `string, string` | `ImportResult` | `market/entry-import` |
| `listStore()` | — | `StoreList` | `store/list` |
| `installStoreEntry(marketplaceId, entryName)` | `string, string` | `StoreInstallResult` | `store/install-entry` |

### 5.2 Sub-Clients

| Sub-client | Methods | Protocol method |
| --- | --- | --- |
| `agents` | `list()` / `get(agentId)` / `export(agentId)` | `agent/list` / `agent/get` / `agent/export` |
| `teams` | `list()` / `get(teamId)` / `export(teamId, teamVersion?)` | `team/list` / `team/get` / `team/export` |
| `skills` | `list()` / `get(skillId)` / `files(skillId)` / `readFile(skillId, path)` / `readFileWithType(skillId, path)` | `skill/list` / `skill/get` / `skill/files` / `skill/file` |
| `connectors` | `list()` / `get(id)` / `status(id)` / `test(id)` / `authStatus(id)` / `authStart(id)` / `waitForAuth(id, opts?)` / `logout(id)` / `call(id, tool, args?)` | `connector/list` · `get` · `status` · `test` · `auth/status` · `auth/start` · `auth/logout` · `call` |
| `store` | `list()` / `search(query, filter?)` / `installed()` / `checkUpdates()` / `updateHint(item)` / `install(item, opts?)` / `setEnabled(item, enabled, opts?)` / `uninstall(item, opts?)` | Composite client mapping: `store/list` · `store/install-entry` · `install/run` · `install/status` · `install/disable` · `install/enable` · `install/uninstall` |
| `conversations` | `create(input)` / `update(id, input)` / `modelOptions()` / `list(limit?)` / `get(id)` / `messages(query)` / `send(id, content, idempotencyKey, options?)` / `cancel(id)` / `delete(id)` / `follow(id, options?)` | `conversation/*` corresponding methods |
| `runs` | `agent(input)` / `team(input)` / `get(id)` / `plan(id)` / `result(id)` / `events(query)` / `cancel(input)` / `steer(input)` / `answerDecision(input)` / `follow(id, options?)` | `agent/run` · `team/run` · `run/get` · `run/plan` · `run/result` · `run/events` · `run/cancel` · `run/steer` · `run/answer-decision` |
| `workspaces` | `list()` / `create(path)` / `revoke(id)` | `workspace/list` / `workspace/create` / `workspace/revoke` |
| `models` | `list()` | `models/list` |

### 5.3 HTTP Bindings

HTTP and WebSocket bindings represent two transport options for the same wire specification. `httpRouteTable()` exports the mapping programmatically:

```ts
import { httpRouteTable } from "@flowy-agent-store/client";

const routes = httpRouteTable();
// { "market/remove": { verb: "POST", path: "/markets/:marketplace_id/remove", source: "…" }, … }
```

- Maps **52 of 77** protocol methods. Unmapped methods represent handshakes, continuous streaming interfaces, or privileged local management APIs.
- Privileged host operations (e.g. `config/get`, `config/set`, `config/get-mcp`, `skill/create`) are restricted to authenticated local connections.

### 5.4 Human-in-the-Loop Approvals: `run/answer-decision`

When an execution pauses awaiting user interaction, `run/events` emits `approval.requested`. Callers submit decisions via `runs.answerDecision(input)`:

```ts
const pending = (await client.runs.events({ runId })).find(
  (event) => event.event_type === "approval.requested",
);

await client.runs.answerDecision({
  runId,
  stepId: pending.step_id!,                    // Scoped step identifier
  attemptId: pending.attempt_id!,
  answer: "Approved to proceed",
  expectedExecutionVersion: pending.expected_execution_version!,  // Three CAS tokens
  expectedStepVersion: pending.expected_step_version!,
  expectedAttemptVersion: pending.expected_attempt_version!,
});
```

- **Optimistic Concurrency Control**: The three `expected*Version` parameters enforce CAS token checks, returning `conflict` if any version drifts.
- Decisions are valid only when the target attempt is in the `waiting_input` state.

## 6. Events Reference: `sequence` and Catch-Up

### 6.1 Event Types

`ConversationEventType` consists of 9 distinct event kinds:

| Event type | Meaning | Decoded kind |
| --- | --- | --- |
| `message.created` | New message record committed | `message.created` |
| `message.delta` | Incremental message body chunk | `message.delta` |
| `message.thinking` | Incremental reasoning block | `message.thinking` |
| `message.tips` | Operational tips and warnings | `message.tips` |
| `message.tool` | Tool invocation lifecycle event | `message.tool` |
| `message.error` | Terminal execution error | `message.error` |
| `message.activity` | Activity and turn completion events | `message.activity` |
| `turn.status` | Turn state transition notification | `turn.status` |
| `context.usage` | Context token consumption report | `context.usage` |

### 6.2 `sequence` Guarantees

- `sequence` numbers increment monotonically per conversation per connection, resetting upon socket reconnection;
- A delta where `sequence > lastSeen + 1` indicates network frame loss, triggering catch-up routines;
- Duplicated or disordered events are silently dropped by client filters.

### 6.3 Catch-Up Mechanics

| Scenario | Server signal | Catch-up mechanism | Client entry |
| --- | --- | --- | --- |
| Conversation | `conversation/resync-required` | Re-fetch messages via `conversation/messages` | `follow(..., { fetchMessages })` → `onBackfill` |
| Run | `run/resync-required` | Replay events via `run/events` with `after_sequence` | `follow()` auto catch-up or manual `resync()` |

```ts
const subscription = await client.conversations.follow(conversationId);
subscription.onEvent((event) => {
  const decoded = decodeConversationEvent(event);
  if (decoded.kind === "message.delta") render(decoded.delta, decoded.replace);
});
subscription.onBackfill((snapshot) => resetTranscript(snapshot.messages));
subscription.onError((error) => report(error));
```

## 7. Error Models and Retries

| Class | Trigger scenario | `retryable` |
| --- | --- | --- |
| `AppServerError` | Server-side domain error payload (`code` / `requestId` / `details`) | Determined by server hint |
| `TransportError` | Transport socket failure (`phase`) | Evaluated by client phase |
| `ProtocolError` | Malformed message or schema mismatch (`kind`) | No |
| `RequestTimeoutError` | Timeout exceeded (`method` / `timeoutMs`) | No |

`withRetry(operation, options)` coordinates exponential backoff:

| Option | Default | Description |
| --- | --- | --- |
| `maxAttempts` | `3` | Total invocation attempts |
| `baseDelayMs` | `500` | Initial delay in milliseconds |
| `maxDelayMs` | `8000` | Maximum backoff delay cap |
| `jitter` | `0.25` | Delay jitter ratio in `[0.75×, 1.0×]` |
| `onRetry` | — | Retry notification callback `{ attempt, delayMs, error }` |
| `shouldRetry` | Protocol `retryable` | Custom retry predicate |
| `sleep` | `setTimeout` | Delay function injection |

Write operations carrying an `idempotency_key` are safe for retry attempts.

## 8. MCP Integration Guide

Connector declaration locations:

| Scenario | Declaration location |
| --- | --- |
| Marketplace entry | Entries within `.codebuddy-connector/connectors.json` |
| Plugin bundled server | `mcpServers` object inside plugin manifests |

Sensitive configuration properties are mapped to `secret:<KEY>` references during ingestion, populated at runtime exclusively from secure local credential storage. Refer to [Plugins & Marketplace](/en-US/docs/plugins-market) for schema details.

## 9. Next Steps

- Protocol specification: `docs/agent-store/05-flowy-agent-store-app-server-protocol.md`.
- Implementation source: `web/packages/{protocol,client,sdk}/src`.
- Integration recipes: [TypeScript SDK cookbook](/en-US/docs/examples-sdk).

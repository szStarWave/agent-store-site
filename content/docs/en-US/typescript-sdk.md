# TypeScript SDK reference

Flowy Agent Store provides three layered, decoupled official TypeScript packages supporting strongly typed access to the local App Server across Node.js, Electron, and browser environments:

| Package | Architectural role | Runtime environment | Core dependencies |
| --- | --- | --- | --- |
| `@flowy-agent-store/protocol` | Wire protocol type definitions (requests/responses/notifications/errors) and utilities | Universal (zero-runtime overhead, no Node/DOM dependencies) | None |
| `@flowy-agent-store/client` | `AppServerClient` core client, 9 business subclients, and `Transport` abstractions | Universal (transport decoupled, no direct I/O binding) | `@flowy-agent-store/protocol` |
| `@flowy-agent-store/sdk` | Host runtime process management (binary discovery, loopback binding, port discovery, and readiness wrapper) | Node.js ≥ 22 or Bun | `@flowy-agent-store/client`, `@flowy-agent-store/protocol` |

The three packages combine across usage patterns: consume `protocol` when **only type contracts are needed**; consume `client` when **connecting to an active App Server instance**; consume `sdk`'s `launchHarness` when **managing runtime lifecycles programmatically from Node.js**.

For comprehensive end-to-end integration examples, refer to the companion [TypeScript SDK cookbook](/en-US/docs/examples-sdk).

> **Integration Notice**: This document targets software developers. Desktop end-users should install precompiled binary releases, as described in the [Quick start](/en-US/docs/quick-start).

---

## 1. Installation and package architecture

```bash
# Standard workflow: install the unified SDK package (bundles client and process management)
bun add @flowy-agent-store/sdk # or npm install @flowy-agent-store/sdk

# Consume protocol types standalone
bun add @flowy-agent-store/protocol
```

All packages distribute standard dual ESM and CommonJS bundles, exposing TypeScript type declarations through `package.json` `exports`.

> **Release Versioning**: Packages currently publish under `0.1.0-beta.*` prerelease semantics. Production environments should pin exact versions (such as `0.1.0-beta.7`). For upgrade procedures, refer to the [Upgrade and migration guide](/en-US/docs/upgrade).
> **Runtime Prerequisites**: Requires Node.js **≥ 22.0.0** (relying on global native `WebSocket`) or Bun ≥ 1.1.

---

## 2. @flowy-agent-store/protocol — Protocol layer

### 2.1 Role and scope

The protocol package serves as the definitive source of truth for wire interactions: declaring all JSON-RPC requests, responses, streaming notification payloads, constants, and structured error hierarchies. The package performs no network I/O, providing purely functional utilities for event decoding, state assertions, and error formatting.

### 2.2 Core exports and type contracts

| Export symbol | Contract definition and usage |
| --- | --- |
| `APP_SERVER_PROTOCOL_VERSION` | Protocol fingerprint constant (currently `"fp-12"`). Enforces strict equality during handshakes |
| `InitializeRequest` / `InitializeResult` | Protocol handshake payloads exchanging protocol versions, client identities, and host capabilities |
| `ClientInfo` / `ClientCapabilities` | Client identity declarations (name, version) and feature subscriptions (`events`, `approvals`, `team_runtime`) |
| `StoreList` / `StoreItem` / `StoreInstallResult` | Unified catalog structures and installation receipt models |
| `AgentSummary` / `AgentDetail` | Agent expert catalog summaries and detailed configuration views |
| `TeamSummary` / `TeamDetail` | Expert team summaries and multi-agent topologies |
| `SkillSummary` / `SkillDetail` | Atomic skill metadata and permission flags |
| `ConnectorSummary` / `ConnectorDetail` / `ConnectorStatusView` | Connector catalog views, runtime health statuses, and probe outcomes |
| `ConnectorRegistration` / `ConnectorCredential` | Dynamic MCP connector registration inputs and credential form state models |
| `ConversationView` / `ConversationMessage` / `ConversationEvent` | Conversation models, transcript message structures, and streaming delta events |
| `RunReceipt` / `RunView` / `RunResult` / `RunEvent` | Batch task execution lifecycle models and decision events |
| `ServerNotification` / `WireError` | Downstream server push notifications and standardized wire error payloads |

### 2.3 Structured error models and inspection utilities

Callers should always branch logic based on the structured `code` property rather than parsing human-readable `message` strings:

| Error class | Trigger conditions | Key properties |
| --- | --- | --- |
| `AppServerError` | Server returned a JSON-RPC error response | `code` (standard enum), `requestId`, `retryable`, `details` |
| `TransportError` | Physical network transport failure (disconnects, send errors, socket timeouts) | `phase` (`connect`/`send`/`receive`/`close`), `retryable` |
| `ProtocolError` | Local protocol contract violations (malformed envelopes, version incompatibilities) | `kind` (`invalid_message`/`version_mismatch`/`unexpected_response`) |
| `RequestTimeoutError` | Individual RPC invocation exceeded timeout budget | `method`, `timeoutMs` |

```ts
import { isAppServerError, isRetryableTransportError, formatError } from "@flowy-agent-store/protocol";

try {
  await client.runs.agent({ agentId, goal });
} catch (error) {
  if (isAppServerError(error)) {
    // Deterministic branching based on stable error codes (e.g. agent_not_installed / conflict)
    console.error(`Business error: code=${error.code}, retryable=${error.retryable}`);
  } else if (isRetryableTransportError(error)) {
    // Transient network glitch, safe to enter retry loops
    console.warn("Transient transport failure, preparing reconnection");
  }
  console.error("Standardized error formatting:", formatError(error));
}
```

---

## 3. @flowy-agent-store/client — Client layer

### 3.1 Client lifecycle and Transport abstraction

`AppServerClient` encapsulates domain operations while decoupling underlying network transports via an injected `Transport` interface. The client enforces an explicit state machine: `idle → connecting → initializing → ready → closed`.

```ts
export interface Transport {
  connect(): Promise<void>;                                      // Establish physical socket connection (idempotent)
  request<T>(method: string, params: unknown): Promise<T>;       // Bidirectional request-response RPC
  notify(method: string, params: unknown): void;                  // Unidirectional notification (no response)
  onNotification(listener: NotificationListener): () => void;     // Subscribe to downstream notifications, returns unsubscribe
  close(): void;                                                 // Physically close transport connection
  onLifecycle?(listener: (state: "open" | "closed") => void): () => void; // Channel state change listener
}
```

The package provides a built-in `WebSocketTransport` implementation supporting browsers and Node.js 22+:

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const transport = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", {
  token: process.env.AGENT_STORE_TOKEN,
  requestTimeoutMs: 30_000,
});
const client = new AppServerClient({
  transport,
  client: { name: "desktop-app", version: "1.0.0" },
});
await client.connect();
```

### 3.2 Top-level client methods

The `AppServerClient` instance exposes top-level lifecycle and catalog management methods:

| Method signature | Parameter description | Return contract | Underlying protocol method |
| --- | --- | --- | --- |
| `connect()` | None | `Promise<InitializeResult>` | `initialize` → `initialized` |
| `close()` | None | `void` | Resets client state and closes transport |
| `onNotification(listener)` | Downstream callback | Unsubscribe closure `() => void` | Listens to server broadcasts |
| `listStore()` | None | `Promise<StoreList>` | `store/list` |
| `installStoreEntry(marketplaceId, entryName)` | Marketplace ID and entry name | `Promise<StoreInstallResult>` | `store/install-entry` |
| `listMarketplaces()` | None | `Promise<MarketplaceSummary[]>` | `market/list` |
| `addMarketplace(input)` | Marketplace add payload | `Promise<MarketplaceSummary>` | `market/add` |
| `refreshMarketplace(marketplaceId)` | Target marketplace ID | `Promise<MarketplaceRefreshResult>` | `market/refresh` |
| `removeMarketplace(marketplaceId, cascade)` | Target marketplace ID and cascade deletion flag | `Promise<MarketplaceRemoveResult>` | `market/remove` |

### 3.3 Complete reference for business subclients

#### `agents` — Expert catalog and export

```ts
// 1. Query all installed and available agent expert summaries
client.agents.list(): Promise<AgentSummary[]>;

// 2. Retrieve detailed configuration view for an expert (including skill and connector bindings)
client.agents.get(agentId: string): Promise<AgentDetail>;

// 3. Export complete expert definition pack (including persona instructions and manifests)
client.agents.export(agentId: string): Promise<ExpertPack>;
```

#### `teams` — Expert team catalog and orchestration

```ts
// 1. Query configured expert teams
client.teams.list(): Promise<TeamSummary[]>;

// 2. Retrieve topology configuration for a team (member roles and delegation rules)
client.teams.get(teamId: string): Promise<TeamDetail>;

// 3. Export complete team definition package (supports optional semver validation)
client.teams.export(teamId: string, teamVersion?: string): Promise<TeamExportResult>;
```

#### `skills` — Skill discovery and file inspection

```ts
// 1. List local atomic skill summaries
client.skills.list(): Promise<SkillSummary[]>;

// 2. Retrieve detailed skill definition
client.skills.get(skillId: string): Promise<SkillDetail>;

// 3. List static file inventory within a skill directory
client.skills.files(skillId: string): Promise<SkillInventory>;

// 4. Read binary file bytes from skill package
client.skills.readFile(skillId: string, filePath: string): Promise<Uint8Array>;
```

#### `connectors` — Connector management, registration, and tool proxying

```ts
// 1. Discovery and status inspection
client.connectors.list(): Promise<ConnectorSummary[]>;
client.connectors.get(connectorId: string): Promise<ConnectorDetail>;
client.connectors.status(connectorId: string): Promise<ConnectorStatusView>;
client.connectors.test(connectorId: string): Promise<ConnectorProbeResult>;

// 2. OAuth authorization workflow
client.connectors.authStatus(connectorId: string): Promise<OAuthStatusView>;
client.connectors.authStart(connectorId: string): Promise<OAuthStartResult>;
client.connectors.waitForAuth(connectorId: string, options?: { timeoutMs?: number }): Promise<WaitForAuthOutcome>;
client.connectors.logout(connectorId: string): Promise<void>;

// 3. Tool dynamic proxy invocation
client.connectors.call(connectorId: string, tool: string, args?: unknown): Promise<ConnectorCallResult>;

// 4. Dynamic connector registration and credential management
client.connectors.register(registration: ConnectorRegistration): Promise<ConnectorDetail>;
client.connectors.credentials(connectorId: string): Promise<ConnectorCredential>;
client.connectors.setCredentials(connectorId: string, values: Record<string, string>): Promise<ConnectorCredential>;
client.connectors.clearCredentials(connectorId: string, keys?: string[]): Promise<ConnectorCredential>;
```

#### `store` — Marketplace comprehensive lifecycle

```ts
// 1. Unified catalog discovery
client.store.list(): Promise<StoreItem[]>;
client.store.search(query: string, filter?: { kind?: StoreItemKind }): Promise<StoreItem[]>;
client.store.installed(): Promise<StoreItem[]>;

// 2. State-machine installation and update tracking
client.store.install(item: StoreItem, options?: { waitForReady?: boolean; timeoutMs?: number }): Promise<StoreOperationOutcome>;
client.store.checkUpdates(): Promise<StoreItem[]>;
client.store.updateHint(item: StoreItem): "none" | "uninstall_reinstall" | "unknown";

// 3. Toggle activation and complete uninstallation
client.store.setEnabled(item: StoreItem, enabled: boolean): Promise<StoreOperationOutcome>;
client.store.uninstall(item: StoreItem): Promise<StoreOperationOutcome>;
```

#### `conversations` — Conversation creation, model options, and interaction

```ts
// 1. Conversation lifecycle
client.conversations.create(input: ConversationCreateInput): Promise<ConversationView>;
client.conversations.get(conversationId: string): Promise<ConversationView>;
client.conversations.list(limit?: number): Promise<ConversationView[]>;
client.conversations.update(conversationId: string, input: ConversationUpdateInput): Promise<ConversationView>;
client.conversations.delete(conversationId: string): Promise<{ conversation_id: string; deleted: boolean }>;

// 2. Turn execution and messaging
client.conversations.messages(query: ConversationMessagesQuery): Promise<ConversationMessagesPage>;
client.conversations.send(
  conversationId: string,
  content: string,
  idempotencyKey: string,
  options?: ConversationSendOptions,
): Promise<ConversationSendReceipt>;
client.conversations.cancel(conversationId: string): Promise<ConversationView>;

// 3. Streaming subscriptions and model metadata
client.conversations.follow(conversationId: string): Promise<ConversationSubscription>;
client.conversations.modelOptions(): Promise<ConversationModelOptions>;
```

#### `runs` — Standalone task execution, plans, and approvals

```ts
// 1. Trigger batch tasks
client.runs.agent(input: AgentRunInput): Promise<RunReceipt>;
client.runs.team(input: TeamRunInput): Promise<TeamRunReceipt>;

// 2. Execution monitoring and plans
client.runs.get(runId: string): Promise<RunView>;
client.runs.plan(runId: string): Promise<RunPlan>;
client.runs.result(runId: string): Promise<RunResult>;
client.runs.events(query: RunEventsQuery): Promise<RunEvent[]>;

// 3. Task intervention, approvals, and streaming
client.runs.cancel(input: RunCancelInput): Promise<RunView>;
client.runs.answerDecision(input: DecisionAnswerInput): Promise<RunView>;
client.runs.follow(runId: string): Promise<EventSubscription>;
```

#### `workspaces` — Local workspace registration and management

```ts
// 1. Query registered workspaces
client.workspaces.list(): Promise<WorkspaceView[]>;

// 2. Register and canonicalize path as a secure workspace
client.workspaces.create(path: string): Promise<WorkspaceView>;

// 3. Revoke workspace (soft delete reference without wiping disk content)
client.workspaces.revoke(workspaceId: string): Promise<WorkspaceRevokeResult>;
```

#### `models` — Available model metadata discovery

```ts
// Query all configured models available for invocation along with token pricing parameters
client.models.list(): Promise<ModelSummary[]>;
```

---

## 4. @flowy-agent-store/sdk — Node host orchestration

### 4.1 launchHarness integration entrypoint

`launchHarness` is the primary entrypoint for Node.js integrations and automated test suites. It resolves the runtime binary, spawns child processes, allocates ephemeral loopback ports, and establishes WebSocket handshakes:

```ts
export interface HarnessOptions extends SpawnOptions {
  client: ClientInfo;                  // Client identity declaration (name, version)
  capabilities?: ClientCapabilities;   // Feature subscriptions (events, approvals, team_runtime)
  token?: string;                      // Authentication token passed to WebSocketTransport
  requestTimeoutMs?: number;           // Default RPC timeout (30,000 ms)
}

export interface Harness extends AppServerClient {
  server: SpawnedServer;               // Low-level daemon control handle (readiness, dataDir, exited, close)
  handshake: InitializeResult;         // Handshake receipt returned by host
  close(): Promise<void>;              // Unsubscribes events → closes transport → kills child → cleans temp dir
}
```

Configuration field contract:

| Option | Default | Behavior |
| --- | --- | --- |
| `client` | — | **Required**; Unique client identity recorded in server audit logs |
| `capabilities` | `{}` | Capability declarations enabling optional features like `events` and `approvals` |
| `token` | Omitted | Authentication token appended as `?token=...` query parameter |
| `requestTimeoutMs` | `30000` | Per-request RPC timeout budget (milliseconds) |

`Harness` instance members:

| Member property | Type contract | Core purpose |
| --- | --- | --- |
| `conversations` and 8 other subclients | `AppServerClient` domain clients | Directly dispatch typed domain operations via `harness.<subclient>` |
| `handshake` | `InitializeResult` | Access verified protocol fingerprint and server capabilities |
| `server.readiness` | `ReadinessInfo` | Access dynamically allocated host, port, URL, and operational state |
| `server.dataDir` | `string` | Inspect current local storage directory |
| `server.exited` | `Promise<SpawnExitInfo>` | Await abnormal child process exits and termination signals |
| `close()` | `() => Promise<void>` | Closes connection, terminates child processes, and cleans temp storage |

### 4.2 Low-level process primitives and options

| Exported primitive | Signature and operational role |
| --- | --- |
| `spawnAppServer(options)` | Spawns daemon child process and awaits stdout readiness line (no client connection) |
| `resolveAppServerBin(path?)` | Resolves absolute path to executable binary |
| `parseReadinessLine(line)` | Parses single-line JSON readiness payload from stdout |
| `assertProtocolCompatible(ver)` | Verifies strict protocol equality, throwing `ProtocolError` on mismatch |

```ts
export interface SpawnOptions {
  bin?: string;                             // Explicit binary path override
  dataDir?: string;                         // Persistent storage path (omitted creates temp directory cleaned on close)
  port?: number;                            // Listening port (default 0 assigns ephemeral OS port)
  extraArgs?: string[];                     // Additional CLI flags passed to executable
  readyTimeoutMs?: number;                  // Maximum readiness timeout budget (default 120,000 ms)
  env?: Record<string, string | undefined>; // Environment variables merged with parent process.env
  cwd?: string;                             // Working directory for child process
  onExit?: (info: SpawnExitInfo) => void;    // Child process exit callback
}
```

### 4.3 Binary resolution order and runtime contract

The SDK resolves the runtime executable in the following order:
1. Explicit path specified in `options.bin`;
2. Operating system environment variable `AGENT_STORE_BIN`;
3. Bundled binary inside optional platform packages `@flowy-agent-store/runtime-<platform>-<arch>`;
4. System `PATH` environment variable.

```bash
# Explicitly pin runtime binary location
AGENT_STORE_BIN=/opt/flowy-agent-store/flowy-agent-store node app.mjs
```

Instances spawned without an explicit `dataDir` treat the workspace as temporary scratch storage, wiping it on `close()`. Providing an explicit `dataDir` preserves persistent storage across runs.

```ts
const harness = await launchHarness({ client: { name: "test-runner", version: "1.0.0" } });
try {
  await harness.connectors.list();
} finally {
  await harness.close(); // Ensures child process termination and scratch directory cleanup
}
```

### 4.4 Export helper utilities

The SDK provides higher-level utilities to materialize expert and team configurations directly to local disk:

```ts
import { exportAgent, exportTeam, materializePack } from "@flowy-agent-store/sdk";

// Export individual expert definition and referenced skill files to disk
const result = await exportAgent(client, "software-architect", "./dist/architect");
console.log(`Exported skills: ${result.writtenSkills.join(", ")}`);

// Export complete multi-agent team package
await exportTeam(client, "dev-team", "./dist/dev-team");
```

---

## 5. Protocol communication and HTTP route binding

### 5.1 HTTP route mapping table (httpRouteTable)

Read-only queries and stateless writes can be invoked directly over HTTP without establishing a persistent socket. The route table is exported directly by the client:

```ts
import { httpRouteTable } from "@flowy-agent-store/client";

const routes = httpRouteTable();
// Outputs: { "market/list": { verb: "GET", path: "/markets", ... }, ... }
console.log(`Mapped HTTP endpoints: ${Object.keys(routes).length}`);
```

- Public HTTP endpoints map **53 / 78** protocol methods;
- Stateful real-time streaming methods (such as `follow`) and privileged local administrative operations are excluded from HTTP bindings.

### 5.2 Approval decision CAS optimistic concurrency control

When an execution pauses awaiting user approval (`waiting_input`), callers submit decisions via `runs.answerDecision`:

```ts
const pendingEvent = (await client.runs.events({ runId })).find(
  (e) => e.event_type === "approval.requested",
);

await client.runs.answerDecision({
  runId,
  stepId: pendingEvent.step_id!,
  attemptId: pendingEvent.attempt_id!,
  answer: "Approved to proceed",
  expectedExecutionVersion: pendingEvent.expected_execution_version!,
  expectedStepVersion: pendingEvent.expected_step_version!,
  expectedAttemptVersion: pendingEvent.expected_attempt_version!,
});
```

All three `expected*Version` tokens are strictly enforced. Version mismatches reject immediately with a `conflict` status.

---

## 6. Event streaming model and catch-up mechanism

### 6.1 Conversation event discriminated union (ConversationEventType)

Live conversation event streams deliver 9 discriminated union types:

| Event type | Operational trigger | Standard decoded kind |
| --- | --- | --- |
| `message.created` | New message committed to persistent database | `message.created` |
| `message.delta` | Streaming token delta emitted by model | `message.delta` |
| `message.thinking` | Streaming reasoning thought delta | `message.thinking` |
| `message.tips` | Runtime tips and warning advisories | `message.tips` |
| `message.tool` | Tool invocation lifecycle transitions | `message.tool` |
| `message.error` | Terminal turn error payload | `message.error` |
| `message.activity` | Interactive turn actions and completion marks | `message.activity` |
| `turn.status` | Execution turn state transition | `turn.status` |
| `context.usage` | Context token usage and billing statistics | `context.usage` |

### 6.2 sequence sequence number semantics

- Every downstream event carries a connection-local strictly increasing integer `sequence`;
- When the client detects `currentSequence > lastSeenSequence + 1`, a network gap is identified, triggering catch-up logic;
- Client subscription instances automatically discard duplicated sequence numbers locally.

### 6.3 Disconnection detection and incremental catch-up strategies

| Subscription domain | Server signal | Catch-up mechanism | Client entrypoint |
| --- | --- | --- | --- |
| Conversation streams | `conversation/resync-required` | Refetches transcript messages to rebuild state | Subscribe via `follow()`, listen via `onBackfill` |
| Task runs | `run/resync-required` | Replays events from last contiguous cursor sequence | Handled automatically by `follow()`; manual replay via `client.runs.events({ afterSequence })` |

```ts
const subscription = await client.conversations.follow(conversationId);
subscription.onEvent((event) => {
  const decoded = decodeConversationEvent(event);
  if (decoded.kind === "message.delta") {
    process.stdout.write(decoded.delta);
  }
});
subscription.onBackfill((snapshot) => {
  console.log(`Backfilled state after reconnect. Total messages: ${snapshot.messages.length}`);
});
```

---

## 7. Production retry strategies and fault recovery

### 7.1 Exponential backoff retry (withRetry)

`@flowy-agent-store/client` includes a production-grade exponential backoff execution utility:

| Configuration option | Default value | Description |
| --- | --- | --- |
| `maxAttempts` | `3` | Maximum attempts including initial request |
| `baseDelayMs` | `500` | Initial backoff wait duration (milliseconds) |
| `maxDelayMs` | `8000` | Maximum cap for delay intervals (milliseconds) |
| `jitter` | `0.25` | Random jitter ratio to mitigate thundering herds |
| `onRetry` | Omitted | Interception callback before retries `({ attempt, delayMs, error })` |

```ts
import { withRetry } from "@flowy-agent-store/client";

const result = await withRetry(() => client.runs.get(runId), {
  maxAttempts: 4,
  baseDelayMs: 300,
  maxDelayMs: 5000,
  onRetry: ({ attempt, delayMs, error }) => {
    console.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms:`, error);
  },
});
```

### 7.2 Idempotency guarantees and retry safety boundaries

- **Non-idempotent write boundaries**: Sending conversation prompts (`conversations.send`) requires an explicit UUID `idempotencyKey`; identical keys deduplicate safely without duplicate inference.
- **Mutex lock contention**: Distinct processes sharing a `dataDir` trigger immediate fast-fail lock rejections; do not blindly retry without directory isolation.
- **Permanent failure termination**: Non-retryable errors (`retryable: false`), such as policy rejections, version mismatches (`conflict`), and validation failures terminate immediately without burning retry budgets.

---

## 8. MCP connector declaration specification

Physical file locations for MCP connector definitions:

| Scenario | Physical configuration location |
| --- | --- |
| Marketplace connectors | `.codebuddy-connector/connectors.json` entry manifest |
| Plugin bundled MCP servers | `mcpServers` field within plugin manifest |

Sensitive parameters are mapped to `secret:<KEY>` references during ingestion, populated at runtime exclusively from secure storage. For full syntax, refer to [Plugins & Marketplace](/en-US/docs/plugins-market).

---

## 9. References and related documentation

- Integration recipes and practical code: [TypeScript SDK cookbook](/en-US/docs/examples-sdk).
- Host runtime configuration schema: [Configuration](/en-US/docs/configuration).
- Operating system and Node.js support: [Compatibility matrix](/en-US/docs/compatibility).
- Release notes and migration instructions: [Upgrade and migration guide](/en-US/docs/upgrade).

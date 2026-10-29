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
| `APP_SERVER_PROTOCOL_VERSION` | Protocol fingerprint constant (currently `"fp-20"`). Enforces strict equality during handshakes |
| `InitializeRequest` / `InitializeResult` | Protocol handshake payloads exchanging protocol versions, client identities, and host capabilities |
| `ClientInfo` / `ClientCapabilities` | Client identity declarations (name, version) and feature subscriptions (`events`, `approvals`, `team_runtime`) |
| `StoreList` / `StoreItem` / `StoreInstallResult` | Unified catalog structures and installation receipt models |
| `StoreCategory` / `StoreCategories` | Market category dictionaries and market-level tag vocabularies (the `store.categories()` shape) |
| `AgentSummary` / `AgentDetail` | Agent expert catalog summaries and detailed configuration views (both carry `tags` / `category_id`) |
| `TeamSummary` / `TeamDetail` | Expert team summaries and multi-agent topologies (package-level `tags` / `category_id`) |
| `SkillSummary` / `SkillDetail` | Atomic skill metadata and permission flags (with `tags` from the market index row) |
| `ExpertPack` / `ExpertPersona` / `ExpertAssetRef` | Expert export contract (`pack_format 3`: persona, skill and asset references, display metadata) |
| `ConnectorSummary` / `ConnectorDetail` / `ConnectorStatusView` | Connector catalog views, runtime health statuses, and probe outcomes |
| `ConnectorRegistration` / `ConnectorCredential` | Dynamic MCP connector registration inputs and credential form state models |
| `ConversationView` / `ConversationMessage` / `ConversationEvent` | Conversation models, transcript message structures, and streaming delta events |
| `RunReceipt` / `RunView` / `RunResult` / `RunEvent` | Batch task execution lifecycle models and decision events |
| `ServerNotification` / `WireError` | Downstream server push notifications and standardized wire error payloads |
| `LocalizedText` / `LocalizedLang` | Localized display metadata contracts (`{ en?, zh? }`) and language union (`"zh"` \| `"en"`) |
| `pickLocalized` / `pickLocalizedList` | Pure resolution utilities for localized text (locale fallback chain and empty string filtering) |

### 2.3 Structured error models and inspection utilities

Callers should always branch logic based on the structured `code` property rather than parsing human-readable `message` strings:

| Error class | Trigger conditions | Key properties |
| --- | --- | --- |
| `AppServerError` | Server returned a JSON-RPC error response | `code` (standard enum), `requestId`, `retryable`, `details` |
| `TransportError` | Physical network transport failure (disconnects, send errors, socket timeouts) | `phase` (`connect`/`send`/`receive`/`close`), `retryable` |
| `ProtocolError` | Local protocol contract violations (malformed envelopes, version incompatibilities) | `kind` (`invalid_message`/`version_mismatch`/`unexpected_response`) |
| `RequestTimeoutError` | Individual RPC invocation exceeded timeout budget | `method`, `timeoutMs` |

```ts
/** Inspects whether a caught error is a server-side AppServerError */
export function isAppServerError(error: unknown): error is AppServerError;

/** Checks whether an error represents a retryable transport failure */
export function isRetryableTransportError(error: unknown): boolean;

/** Formats any caught error into a standardized diagnostics string */
export function formatError(error: unknown): string;
```

Complete fault classification and exponential backoff retry patterns are detailed in [TypeScript SDK Examples](/en-US/docs/examples-sdk) §6.3.

---

## 3. @flowy-agent-store/client — Client layer

### 3.1 Client lifecycle and Transport abstraction

`AppServerClient` encapsulates domain operations while decoupling underlying network transports via an injected `Transport` interface. The client enforces an explicit state machine: `idle → connecting → initializing → ready → closed`.

```ts
export interface Transport {
  /** Establish physical socket connection channel (idempotent) */
  connect(): Promise<void>;
  /** Bidirectional request-response RPC invocation */
  request<T>(method: string, params: unknown): Promise<T>;
  /** Unidirectional notification delivery (no response expected) */
  notify(method: string, params: unknown): void;
  /** Subscribe to downstream server notifications; returns an unsubscribe closure */
  onNotification(listener: NotificationListener): () => void;
  /** Physically close the socket and release transport resources */
  close(): void;
  /** Listen for transport lifecycle state transitions (open / closed) */
  onLifecycle?(listener: (state: "open" | "closed") => void): () => void;
}
```

The package provides a built-in `WebSocketTransport` implementation supporting browsers and Node.js 22+:

```ts
export interface WebSocketTransportOptions {
  /** Authentication access token appended as ?token=... query parameter */
  token?: string;
  /** Request timeout budget in milliseconds (defaults to 30,000) */
  requestTimeoutMs?: number;
  /** Custom underlying WebSocket constructor (defaults to global WebSocket in Node 22+) */
  WebSocket?: unknown;
}
```

Client initialization and connection lifecycle patterns are detailed in [TypeScript SDK Examples](/en-US/docs/examples-sdk) §6.1.

### 3.2 Top-level client methods

The `AppServerClient` instance exposes top-level lifecycle and catalog management methods:

| Method signature | Parameter description | Return contract | Underlying protocol method |
| --- | --- | --- | --- |
| `connect()` | None | `Promise<InitializeResult>` | `initialize` → `initialized` |
| `close()` | None | `void` | Resets client state and closes transport |
| `onNotification(listener)` | Downstream callback | Unsubscribe closure `() => void` | Listens to server broadcasts |
| `readImportAsset(snapshotId, path)` | Export snapshot ID and relative path | `Promise<Uint8Array>` | `import/assets` |
| `listStore()` | None | `Promise<StoreList>` | `store/list` |
| `installStoreEntry(marketplaceId, entryName)` | Marketplace ID and entry name | `Promise<StoreInstallResult>` | `store/install-entry` |
| `listMarketplaces()` | None | `Promise<MarketplaceSummary[]>` | `market/list` |
| `addMarketplace(input)` | Marketplace add payload | `Promise<MarketplaceSummary>` | `market/add` |
| `refreshMarketplace(marketplaceId)` | Target marketplace ID | `Promise<MarketplaceRefreshResult>` | `market/refresh` |
| `removeMarketplace(marketplaceId, cascade)` | Target marketplace ID and cascade deletion flag | `Promise<MarketplaceRemoveResult>` | `market/remove` |

### 3.3 Complete reference for business subclients

#### `agents` — Expert catalog and export

```ts
export interface AgentSummary {
  /** Unique expert identifier (component ID, shaped like wb-<package>-expert or custom ID) */
  id: string;
  /** Human-readable expert display name */
  name: string;
  /** Summary description and architectural role of the expert */
  description: string;
  /** Category ID (resolved to localized display name via store.categories()) */
  category_id?: string | null;
  /** Localized bilingual tag list ({ zh?: string; en?: string }) */
  tags?: Array<{ zh?: string; en?: string }>;
  /** List of bound skill identifiers */
  skills: string[];
  /** List of required connector dependency identifiers */
  connectors: string[];
}

export interface AgentDetail extends AgentSummary {
  /** Expert prompt persona instruction body */
  persona: string;
  /** Associated model preference identifier (e.g. gpt-4o) */
  model?: string;
  /** System preset quick prompt suggestions */
  quick_prompts?: Array<{ zh?: string; en?: string }>;
}

export interface AgentsSubclient {
  /** Query all installed and available agent expert summaries */
  list(): Promise<AgentSummary[]>;
  /** Retrieve detailed configuration view for an expert (including skill and connector bindings) */
  get(agentId: string): Promise<AgentDetail>;
  /** Export complete expert definition pack (including persona instructions and manifests) */
  export(agentId: string): Promise<ExpertPack>;
}
```

#### `teams` — Expert team catalog and orchestration

```ts
export interface TeamMemberSummary {
  /** Unique member expert identifier */
  id: string;
  /** Member expert display name */
  name: string;
  /** Assigned role and responsibility description within the team */
  role: string;
  /** Member-declared skill dependencies */
  skills: string[];
  /** Member-level category identifier */
  category_id?: string | null;
  /** Member-declared bilingual tags */
  tags?: Array<{ zh?: string; en?: string }>;
}

export interface TeamSummary {
  /** Unique team identifier (component ID, shaped like wb-<package>-team) */
  id: string;
  /** Team display name */
  name: string;
  /** Functional description of team capabilities */
  description: string;
  /** Team package-level category identifier */
  category_id?: string | null;
  /** Team package-level bilingual tags */
  tags?: Array<{ zh?: string; en?: string }>;
  /** Team package-level globally shared skill dependencies */
  skills: string[];
  /** Summary list of participating member experts */
  members: TeamMemberSummary[];
}

export interface TeamDetail extends TeamSummary {
  /** Multi-agent collaboration topology pattern (e.g. sequential / hierarchical / broadcast) */
  topology: string;
  /** Coordinating leader agent identifier */
  leader_id: string;
}

export interface TeamsSubclient {
  /** Query configured expert teams */
  list(): Promise<TeamSummary[]>;
  /** Retrieve topology configuration for a team (member roles and delegation rules) */
  get(teamId: string): Promise<TeamDetail>;
  /** Export complete team definition package (supports optional semver validation) */
  export(teamId: string, teamVersion?: string): Promise<ExpertPack>;
}
```

#### `skills` — Skill discovery and file inspection

```ts
export interface SkillSummary {
  /** Unique atomic skill identifier */
  id: string;
  /** Unique skill name */
  name: string;
  /** Functional capability description */
  description: string;
  /** Skill tags sourced from marketplace index row */
  tags?: Array<{ zh?: string; en?: string }>;
}

export interface SkillDetail extends SkillSummary {
  /** Primary entrypoint file or metadata definition */
  entrypoint?: string;
  /** Declared runtime permissions and external dependencies */
  permissions?: string[];
}

export interface SkillFileEntry {
  /** POSIX-relative file path inside skill package (traversal-checked by server) */
  path: string;
  /** File size in bytes */
  size: number;
  /** SHA-256 content verification digest */
  digest: string;
}

export interface SkillFileList {
  /** Metadata inventory of all static files contained in skill package */
  files: SkillFileEntry[];
}

export interface SkillsSubclient {
  /** List local atomic skill summaries */
  list(): Promise<SkillSummary[]>;
  /** Retrieve detailed skill definition */
  get(skillId: string): Promise<SkillDetail>;
  /** List static file inventory within a skill directory (requires skill_files capability) */
  files(skillId: string): Promise<SkillFileList>;
  /** Read binary file bytes from skill package (requires skill_files capability) */
  readFile(skillId: string, path: string): Promise<Uint8Array>;
}
```

#### `connectors` — Connector management, registration, and tool proxying

```ts
export interface ConnectorSummary {
  /** Unique connector instance identifier (UUID) */
  id: string;
  /** Connector name identifier (e.g. github-token) */
  name: string;
  /** Human-readable connector title */
  title: string;
  /** Runtime operational status (ready / disabled / authorization_required etc.) */
  status: string;
  /** Underlying transport topology type (fp-17 rename: none | oauth) */
  auth_transport: "none" | "oauth";
  /** Whether connector is currently activated */
  enabled: boolean;
}

export interface ConnectorDetail extends ConnectorSummary {
  /** MCP tool declarations exposed by the connector */
  tools: Array<{ name: string; description?: string; input_schema?: unknown }>;
  /** MCP resource definitions exposed by the connector */
  resources?: Array<{ uri: string; name: string; mimeType?: string }>;
}

export interface ConnectorStatusView {
  /** Current execution status */
  status: "ready" | "disabled" | "authorization_required" | "error" | "stopped";
  /** Status commentary or diagnostic message */
  message?: string;
}

export interface ConnectorCredential {
  /** Authentication mode (marketplace declaration: token | oauth | none) */
  mode: "token" | "oauth" | "none";
  /** List of required credential keys that remain unconfigured (secrets not echoed) */
  missing: string[];
  /** List of credential keys that have been configured */
  configured: string[];
}

export interface ConnectorRegistration {
  /** Custom connector name */
  name: string;
  /** Communication transport type (stdio | sse | streamable) */
  transport: "stdio" | "sse" | "streamable";
  /** Remote service URL (required for sse / streamable) */
  url?: string;
  /** Local executable command (required for stdio mode) */
  command?: string;
  /** Command line arguments array */
  args?: string[];
  /** Environment variable key-value overrides */
  env?: Record<string, string>;
}

export interface ConnectorsSubclient {
  // 1. Discovery and status inspection
  /** Query summary list of all registered connectors */
  list(): Promise<ConnectorSummary[]>;
  /** Retrieve detailed configuration and tool inventory for a connector */
  get(connectorId: string): Promise<ConnectorDetail>;
  /** Query live execution status (running, pending auth, stopped, etc.) */
  status(connectorId: string): Promise<ConnectorStatusView>;
  /** Execute connectivity probe and ping test against connector */
  test(connectorId: string): Promise<ConnectorProbeResult>;

  // 2. OAuth authorization workflow
  /** Check OAuth authorization status for a connector */
  authStatus(connectorId: string): Promise<OAuthStatusView>;
  /** Initiate OAuth authorization flow, returning redirect URL and session ID */
  authStart(connectorId: string): Promise<OAuthStartResult>;
  /** Await completion of OAuth authorization flow with optional timeout */
  waitForAuth(connectorId: string, options?: { timeoutMs?: number }): Promise<WaitForAuthOutcome>;
  /** Clear OAuth credentials and revoke authorization state */
  logout(connectorId: string): Promise<void>;

  // 3. Tool dynamic proxy invocation
  /** Dynamically invoke an MCP tool exposed by the specified connector */
  call(connectorId: string, tool: string, args?: unknown): Promise<ConnectorCallResult>;

  // 4. Dynamic connector registration and credential management
  /** Dynamically register a custom connector definition */
  register(registration: ConnectorRegistration): Promise<ConnectorDetail>;
  /** Inspect required credential schema and current configuration status */
  credentials(connectorId: string): Promise<ConnectorCredential>;
  /** Submit or update secret credentials (such as API keys or tokens) */
  setCredentials(connectorId: string, values: Record<string, string>): Promise<ConnectorCredential>;
  /** Clear saved credentials (clears all when keys parameter is omitted) */
  clearCredentials(connectorId: string, keys?: string[]): Promise<ConnectorCredential>;
}
```

##### Field rename: `auth_mode` → `auth_transport` (since `fp-17`)

Since `fp-17` the connector summary's `auth_mode` is renamed **`auth_transport`**, with the same `none` / `oauth` values. The old field is **gone**, with no transitional dual write: the fingerprint is compared for strict equality at handshake, so a client or host left on `fp-16` fails to connect — both sides must upgrade together.

The rename resolves semantic ambiguity in the legacy field: it was derived strictly from transport topology — every URL-based connector reported `oauth` regardless of whether it actually required an API key or platform-brokered credentials. **Caller workflows are governed by two distinct fields instead**:

- `credential.mode`: the authentication the connector actually needs (the marketplace declaration: `token` / `oauth` / `none`);
- `status`: whether an authorization is genuinely outstanding (`authorization_required` is the actionable signal).

```ts
export interface ConnectorAuthState {
  /** Underlying transport topology type (fp-17 rename: none | oauth) */
  auth_transport: "none" | "oauth";
  /** Runtime operational status (authorization_required is the actionable signal) */
  status: "ready" | "disabled" | "authorization_required" | "error" | "stopped";
  /** Required credential mode declared by the marketplace (token | oauth | none) */
  credential: { mode: "token" | "oauth" | "none" };
}
```

Upgrading from `fp-16`: change `summary.auth_mode` to `summary.auth_transport` (display only), and decide whether to offer an authorization entry point from `status` instead. Complete connector credential forms and OAuth workflows are documented in [TypeScript SDK Examples](/en-US/docs/examples-sdk) §4.5 and §4.7.

#### `store` — Marketplace comprehensive lifecycle

```ts
export type StoreItemKind = "agent" | "team" | "skill" | "connector";

export interface StoreItem {
  /** Global unique marketplace entry identifier */
  entry_name: string;
  /** Resource kind (agent / team / skill / connector) */
  kind: StoreItemKind;
  /** Display title */
  name: string;
  /** Detailed capability description */
  description: string;
  /** Unique origin marketplace ID */
  marketplace_id: string;
  /** Installed semantic version string (null when not installed) */
  installed_version: string | null;
  /** Remote latest available semantic version */
  latest_version: string;
  /** Whether the item is installed locally */
  installed: boolean;
  /** Whether an upgrade version is available */
  update_available: boolean;
  /** Quick prompt suggestions (from quickPrompts for experts/teams, examples for skills/connectors) */
  quick_prompts?: Array<{ zh?: string; en?: string }>;
}

export interface StoreOperationOutcome {
  /** Whether the operation completed successfully */
  ok: boolean;
  /** Number of modified entries affected by operation */
  installedCount?: number;
  /** Diagnostic warnings emitted during installation or removal */
  warnings: string[];
}

export interface StoreSubclient {
  // 1. Unified catalog discovery
  /** Retrieve all marketplace items (executes full projection per call) */
  list(): Promise<StoreItem[]>;
  /** Fetch all marketplace items along with background market readiness flag */
  listStatus(): Promise<{ items: StoreItem[]; marketsPending: boolean }>;
  /** Search marketplace entries with multi-term AND matching and kind filtering */
  search(query: string, filter?: { kind?: StoreItemKind }): Promise<StoreItem[]>;
  /** Search entries returning field matches, language, and highlight ranges (pass items for zero-I/O) */
  searchWithHits(
    query: string,
    options?: { kind?: StoreItemKind; items?: StoreItem[]; installedOnly?: boolean; lang?: "zh" | "en" },
  ): Promise<StoreMatch[]>;
  /** Search restricted strictly to installed marketplace entries */
  searchInstalled(
    query: string,
    options?: { kind?: StoreItemKind; items?: StoreItem[]; lang?: "zh" | "en" },
  ): Promise<StoreItem[]>;
  /** Query list of all currently installed marketplace entries */
  installed(): Promise<StoreItem[]>;

  // 2. State-machine installation and update tracking
  /** Install specified marketplace entry with optional readiness timeout */
  install(item: StoreItem, options?: { waitForReady?: boolean; timeoutMs?: number }): Promise<StoreOperationOutcome>;
  /** Update installed entry to targeted version */
  update(item: StoreItem, options?: { waitForReady?: boolean; timeoutMs?: number }): Promise<StoreOperationOutcome>;
  /** Check if remote updates are available for any installed entries */
  checkUpdates(): Promise<StoreItem[]>;
  /** Get update status hint for an entry ("none" | "update" | "unknown") */
  updateHint(item: StoreItem): "none" | "update" | "unknown";

  // 3. Toggle activation and complete uninstallation
  /** Toggle enabled/disabled status of an installed entry */
  setEnabled(item: StoreItem, enabled: boolean): Promise<StoreOperationOutcome>;
  /** Completely uninstall specified entry and purge local data */
  uninstall(item: StoreItem): Promise<StoreOperationOutcome>;
}
```

```ts
export type StoreSearchField = "name" | "tags" | "category" | "profession" | "description";

export interface StoreFieldHit {
  /** Target matched field identifier */
  field: StoreSearchField;
  /** Language of matched token ("zh" or "en") */
  lang?: "zh" | "en";
  /** Half-open character offset ranges [start, end) on source string (pre-sorted and merged) */
  ranges: Array<[number, number]>;
}

export interface StoreMatch {
  /** Matched marketplace entry */
  item: StoreItem;
  /** Hit ranges grouped by searchable field */
  hits: StoreFieldHit[];
  /** When true, match occurred in alternate language field and is absent from current display text */
  offLanguage: boolean;
}
```

Search semantics and fetching contract (`store` sub-client):

| Dimension | Contract guarantees and constraints |
| --- | --- |
| **Matching** | **Multi-term AND matching**: The query is split on whitespace; every term must appear in some searchable field (AND, not necessarily the same field), case-insensitively, with no tokenizer. Results are ordered in three relevance tiers: `name` > `tags/category/profession` > `description`, keeping original catalogue order within each tier. `examples_*` and `quick_prompts` do not participate in matching. |
| **Highlight ranges** | `searchWithHits` returns `ranges` as half-open `[start, end)` offsets on the original string, pre-sorted and merged; offsets directly index the un-folded source text. If `offLanguage: true`, the term was matched in the other language's field and does not exist in the current rendered text — do not slice or highlight. |
| **Readiness** | `listStatus().marketsPending: true` indicates builtin markets are still registering asynchronously in the background and the catalogue may be incomplete. Searches issued immediately after startup must check this flag (an empty result does not imply no match exists); `list()` does not return this status flag. |
| **Fetching cost** | Passing `options.items` (from `listStatus()` or a prior search result) skips IPC `store/list` calls, performing local in-memory filtering (**zero I/O**). When omitted, every invocation triggers a full catalogue projection (reading manifests from disk plus two database queries). Results are not statically cached by the client (`installed` and `update_available` reflect live installation state). |
| **Prompt hints** | `quick_prompts` for skill and connector entries originates from the marketplace index row (`examples_zh` / `examples_en`, as these entries lack `plugin.json`); for experts and teams it comes from `quickPrompts` in `plugin.json`. When undeclared, it defaults to an empty array `[]`, and the caller should skip rendering hint lines. |
| **Anti-patterns** | ❌ **Do not invoke `search()` without passing `items` inside high-frequency events (e.g. `input`)**: Each keystroke triggers full disk reads and DB queries; pass a pre-fetched array to degrade matching to pure in-memory filtering.<br>❌ **Do not infer an empty catalogue solely from `search()` returning empty arrays**: Always verify the `marketsPending` flag during startup.<br>❌ **Do not apply `ranges` across different fields**: Offset ranges strictly bind to the string identified by `field`; applying them to other strings causes slice misalignment or corruption. |

#### `conversations` — Conversation creation, model options, and interaction

```ts
export interface ConversationCreateInput {
  /** Initial conversation name or title */
  name: string;
  /** Bound expert or team identifier (optional) */
  expertId?: string;
  /** Explicit model override preference (optional) */
  model?: string;
}

export interface ConversationView {
  /** Unique conversation identifier (UUID) */
  conversation_id: string;
  /** Display title */
  name: string;
  /** Whether the conversation is currently generating or executing turns */
  is_processing: boolean;
  /** Unix timestamp in milliseconds when conversation was created */
  created_at: number;
  /** Unix timestamp in milliseconds of most recent turn activity */
  updated_at: number;
}

export interface ConversationUpdateInput {
  /** Updated title (optional) */
  name?: string;
  /** Updated model configuration parameters (optional) */
  model?: string;
}

export interface ConversationSendOptions {
  /** Dynamic skill or agent mentions injected into the current turn */
  mentions?: Array<{ kind: "skill" | "agent"; id: string }>;
  /** Absolute workspace filesystem file paths attached to turn */
  attachments?: string[];
}

export interface ConversationSendReceipt {
  /** Whether message turn was committed to persistent queue */
  accepted: boolean;
  /** Monotonic sequence number allocated by server */
  sequence: number;
}

export interface ConversationsSubclient {
  // 1. Conversation lifecycle
  /** Create a new interactive conversation and initialize its context */
  create(input: ConversationCreateInput): Promise<ConversationView>;
  /** Retrieve current view snapshot for a conversation (model options and state) */
  get(conversationId: string): Promise<ConversationView>;
  /** List recent conversations (supports optional pagination limit) */
  list(limit?: number): Promise<ConversationView[]>;
  /** Update conversation metadata (e.g. title or associated model options) */
  update(conversationId: string, input: ConversationUpdateInput): Promise<ConversationView>;
  /** Soft-delete a specified conversation */
  delete(conversationId: string): Promise<{ conversation_id: string; deleted: boolean }>;

  // 2. Turn execution and messaging
  /** Fetch paginated historical message turns for a conversation */
  messages(query: ConversationMessagesQuery): Promise<ConversationMessagesPage>;
  /** Send user message turn and trigger model inference with idempotency protection */
  send(
    conversationId: string,
    content: string,
    idempotencyKey: string,
    options?: ConversationSendOptions,
  ): Promise<ConversationSendReceipt>;
  /** Abort and cancel ongoing streaming inference generation for a conversation */
  cancel(conversationId: string): Promise<ConversationView>;

  // 3. Streaming subscriptions and model metadata
  /** Open async iterator subscription over conversation event stream */
  follow(conversationId: string): Promise<ConversationSubscription>;
  /** Subscribe to event notifications via callback, returning unsubscribe closure */
  subscribe(conversationId: string, onEvent: (event: ConversationEvent) => void): () => void;
  /** Query available model parameter options and defaults for current conversation */
  modelOptions(): Promise<ConversationModelOptions>;
}
```

#### `runs` — Standalone task execution, plans, and approvals

```ts
export interface AgentRunInput {
  /** Target expert identifier */
  agentId: string;
  /** Directive goal describing the desired deliverable */
  goal: string;
  /** Bound secure workspace IDs (optional) */
  workspaces?: string[];
}

export interface TeamRunInput {
  /** Target collaborative team identifier */
  teamId: string;
  /** Directive goal describing collaborative team objective */
  goal: string;
  /** Bound secure workspace IDs (optional) */
  workspaces?: string[];
}

export interface RunReceipt {
  /** Unique task run execution identifier (UUID) */
  run_id: string;
  /** Initial task state (queued or running) */
  status: "queued" | "running";
}

export interface RunView {
  /** Unique task run execution identifier (UUID) */
  run_id: string;
  /** Current execution state */
  status: "queued" | "running" | "waiting_input" | "succeeded" | "failed" | "cancelled";
  /** Diagnostic error explanation on failure */
  error?: string;
}

export interface RunResult {
  /** Terminal execution state */
  status: "succeeded" | "failed" | "cancelled";
  /** Output outcome and deliverable payload */
  output?: unknown;
}

export interface RunsSubclient {
  // 1. Trigger batch tasks
  /** Initiate standalone batch task execution with single agent expert */
  agent(input: AgentRunInput): Promise<RunReceipt>;
  /** Initiate collaborative multi-agent execution with expert team */
  team(input: TeamRunInput): Promise<TeamRunReceipt>;

  // 2. Execution monitoring and plans
  /** Query current state snapshot and status metadata for a run */
  get(runId: string): Promise<RunView>;
  /** Retrieve decomposed execution plan and dependency topology for a run */
  plan(runId: string): Promise<RunPlan>;
  /** Retrieve final deliverables and output outcome for completed run */
  result(runId: string): Promise<RunResult>;
  /** Query timeline sequence of execution events emitted during run */
  events(query: RunEventsQuery): Promise<RunEvent[]>;

  // 3. Task intervention, approvals, and streaming
  /** Cancel and terminate ongoing task execution run */
  cancel(input: CancelRunInput): Promise<RunView>;
  /** Dynamically steer ongoing execution (inject context or redirect workflow) */
  steer(input: SteerRunInput): Promise<RunView>;
  /** Submit operator decision for pending approvals (tool call or sensitive action) */
  answerDecision(input: AnswerDecisionInput): Promise<RunView>;
  /** Open real-time streaming subscription to run execution events */
  follow(runId: string): Promise<EventSubscription>;
}
```

#### `workspaces` — Local workspace registration and management

```ts
export interface WorkspaceView {
  /** Assigned workspace identifier (UUID) */
  workspace_id: string;
  /** Canonicalized absolute local filesystem path */
  path: string;
  /** Unix timestamp in milliseconds when workspace was registered */
  created_at: number;
}

export interface WorkspaceRevokeResult {
  /** Revoked workspace identifier */
  workspace_id: string;
  /** Whether revocation completed successfully */
  revoked: boolean;
}

export interface WorkspacesSubclient {
  // 1. Query registered workspaces
  /** Query all registered secure workspace views on the host */
  list(): Promise<WorkspaceView[]>;

  // 2. Register and canonicalize path as a secure workspace
  /** Register and canonicalize a local filesystem path as a managed workspace */
  create(path: string): Promise<WorkspaceView>;

  // 3. Revoke workspace (soft delete reference without wiping disk content)
  /** Revoke workspace registration (soft delete reference without removing files) */
  revoke(workspaceId: string): Promise<WorkspaceRevokeResult>;
}
```

#### `models` — Available model metadata discovery

```ts
export interface ModelSummary {
  /** Global model identifier string (e.g. gpt-4o, claude-3-5-sonnet) */
  id: string;
  /** Display title */
  name: string;
  /** Underlying provider name */
  provider: string;
  /** Maximum context window token budget */
  context_window?: number;
}

export interface ModelsSubclient {
  /** Query all configured models available for invocation along with token pricing parameters */
  list(): Promise<ModelSummary[]>;
}
```

---

#### Display fields on application entities (`fp-18`)

Starting in `fp-18`, entity summaries returned by the `agents`, `teams`, `skills`, and `connectors` catalog endpoints uniformly include the **same four optional localized display fields**. The host merges these fields at import time from `plugin.json` and market index rows per locale and persists them into snapshots, enabling callers to render bilingual cards without reading market source files.

```ts
export interface LocalizedText {
  /** English copy (null or undefined when undeclared) */
  en?: string | null;
  /** Chinese copy (null or undefined when undeclared) */
  zh?: string | null;
}

export type LocalizedLang = "zh" | "en";

/** Optional localized display fields extended across all four entity summaries */
export interface LocalizedDisplayFields {
  /** Entity display name (falls back to name when absent; connector name must not render directly) */
  display_name?: LocalizedText | null;
  /** Full descriptive long text */
  display_description?: LocalizedText | null;
  /** Bilingual tags paired by array index */
  tags?: LocalizedText[] | null;
  /** Prompt examples for end-user interaction */
  quick_prompts?: LocalizedText[];
}
```

| Field | Type | Semantic contract |
| --- | --- | --- |
| `display_name?` | `LocalizedText` | Display name. Fall back to `name` when absent; a connector's `name` is an internal runtime identifier (e.g. `fenbi_mcp`) and must not be rendered directly as a UI title |
| `display_description?` | `LocalizedText` | Display description (full descriptive text) |
| `tags[]` | `LocalizedText[]` | Display tags (zh/en paired by array index) |
| `quick_prompts[]` | `LocalizedText[]` | Prompt examples (recommended user query samples) |

Field consumption contract and boundaries:

1. **Optional fields with no implicit defaults**: `display_*` fields can be `null` or omitted, and array fields may be empty. Callers must handle fallbacks explicitly to the single-language field. The protocol package exports utility functions for this purpose:

   ```ts
   import { pickLocalized, pickLocalizedList } from "@flowy-agent-store/protocol";

   // Single-field resolution (active locale -> alternate locale -> ""), falling back to name
   const title = pickLocalized(item.display_name, "en") || item.name;

   // List field batch resolution, dropping empty results
   const prompts = pickLocalizedList(item.quick_prompts, "en");
   ```

2. **Independent locale resolution**: `display_name.zh` and `display_name.en` resolve independently. The presence of one language does not imply the presence of the other (e.g. only 15 of the skill market's 268 entries declare a Chinese name). UI rendering must traverse a language priority fallback chain.
3. **Existing snapshots omit new fields**: Entries installed prior to `fp-18` do not automatically receive display fields upon host upgrade. Callers must run `store.updateEntry` or reinstall the entry to populate updated snapshots. Always handle these fields as optional in business logic.
4. **Display metadata only**: Display fields are not indexed for catalogue search and do not alter runtime identities such as `connector__<name>__<tool>`. `get` and `list` methods across all subclients return identical display metadata.

---

#### Market index sources and entry download fields (`fp-20`)

Starting in `fp-20`, the `index` marketplace source kind is supported: the market manifest is an `index.json` (`schema_version: 2`), `store.list()` reads only the index, and an entry's archive is downloaded from its absolute `download` URL only when it is actually installed or updated. `StoreItem` gains the optional fields `icon_url` (absolute market icon; `avatar_url` prefers it), `download_size`, `sha256`, `available`, `unavailable_reason`, and `default_init_prompt`. Older hosts omit them; clients must treat `available ?? true`.

#### Per-entity icon references inside an export pack (`fp-19`)

Starting in `fp-19` (`pack_format 4`), the `ExpertPack` returned by `agents.export()` / `teams.export()` names an **icon relative path** for each referenced skill and connector. The pack payload carries **path strings only**; raw binary bytes remain accessible through the two existing offline read interfaces, adhering to the same resource resolution contract as `pack.avatar` and `assets`.

```ts
export interface ExpertSkillRef {
  name: string;
  id: string;
  /** Skill-directory-relative path (e.g. "assets/icon.png"); key is absent when no icon is declared */
  icon?: string | null;
}

export interface ExpertConnectorRef {
  id: string;
  name: string;
  enabled: boolean;
  /** Snapshot-relative path (e.g. "avatars/connectors/github.svg"); must be listed in pack assets */
  icon?: string | null;
}
```

| Field | Coordinate system | Binary read interface |
| --- | --- | --- |
| `skills[].icon` | **Skill-directory relative** (the same addressing frame as `SKILL.md`) | `harness.skills.readFile(skillId, icon)` |
| `connectors[].icon` | **Immutable snapshot root relative** | `harness.readImportAsset(pack.provenance.snapshot_id, icon)` |
| `avatar?` / `assets[]` (since `fp-14`) | Immutable snapshot root relative | same as above |

Consumption contract and boundary guarantees:

1. **Immutable snapshot install-time persistence (Immutability Invariant)**: In static market sources, `icons/<entry>.<ext>` files reside as sibling paths outside the entry directory, preventing direct transfer into snapshots during subtree copies. The host persists the market icon into the immutable snapshot during installation and stamps the normalized path into component metadata; exports subsequently read directly from the snapshot, ensuring byte-identical hashes across multiple exports. **The author's explicit `plugin.json.avatar` declaration always takes precedence; market icons only fill missing entries and never overwrite existing declarations.**
2. **Zero-overhead SDK materialization**: The `materializePack` method transparently handles both addressing frames — skill icons are written to `<dir>/skills/<name>/assets/icon.*`, while connector icons are written to `<dir>/avatars/connectors/…` (and automatically registered in `ExportResult.writtenAssets`). Callers require no custom asset-writing logic.
3. **Reachability scope boundary for `connectors[].icon`**: This field is present only when the connector itself declares an independent icon (under current market schemas, single-connector entries). Connectors declared within a team package via `mcpServers` lack an independent icon physical source, and their `icon` field is **permanently absent**. The host does not broadcast team-level package icons to internal connectors to prevent ambiguous visual asset ownership; consumers must handle absence as expected behavior and fall back to default placeholders.
4. **Distinction between field absence and null values (Field Absence vs null)**: An absent key indicates "no icon configured for this entry", maintaining clear distinction from format-level feature omission; export packages with `pack_format < 4` never contain these keys. Historical installed snapshots are not retroactively populated; callers must execute `store.updateEntry` or reinstall the entry to generate updated snapshots containing icon references.

---
## 4. @flowy-agent-store/sdk — Node host orchestration

### 4.1 launchHarness integration entrypoint

`launchHarness` is the primary entrypoint for Node.js integrations and automated test suites. It resolves the runtime binary, spawns child processes, allocates ephemeral loopback ports, and establishes WebSocket handshakes:

```ts
export interface HarnessOptions extends SpawnOptions {
  /** Client identity declaration (name, version) */
  client: ClientInfo;
  /** Capability set declarations (events, approvals, team_runtime) */
  capabilities?: ClientCapabilities;
  /** Authentication credentials passed to the underlying WebSocket transport */
  token?: string;
  /** Default RPC request timeout budget in milliseconds (defaults to 30,000) */
  requestTimeoutMs?: number;
}

export interface Harness extends AppServerClient {
  /** Low-level child process lifecycle handle (readiness, dataDir, exited, close) */
  server: SpawnedServer;
  /** Initial handshake receipt returned by the server */
  handshake: InitializeResult;
  /** Gracefully releases transport, terminates child process, and cleans temp workspace */
  close(): Promise<void>;
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
export interface ReadinessInfo {
  /** Loopback host or IP bound by the runtime */
  host: string;
  /** Ephemeral physical port dynamically allocated by the operating system */
  port: number;
  /** Protocol version fingerprint and initialization status */
  status: string;
}

export interface SpawnExitInfo {
  /** Process exit status code (0 for normal termination) */
  code: number | null;
  /** Termination signal received by the child process */
  signal: NodeJS.Signals | null;
}

export interface SpawnOptions {
  /** Explicit absolute path to runtime executable binary */
  bin?: string;
  /** Explicit persistent data directory (omitted creates temp directory cleaned on close) */
  dataDir?: string;
  /** Listening port number (default 0 assigns ephemeral OS port) */
  port?: number;
  /** Additional command line arguments passed to executable */
  extraArgs?: string[];
  /** Maximum readiness timeout budget in milliseconds (defaults to 120,000) */
  readyTimeoutMs?: number;
  /** Environment variables merged with parent process.env */
  env?: Record<string, string | undefined>;
  /** Working directory path for spawned child process */
  cwd?: string;
  /** Termination callback invoked on child process exit */
  onExit?: (info: SpawnExitInfo) => void;
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
/** Resolves absolute filesystem path to App Server runtime binary */
export function resolveAppServerBin(customPath?: string): Promise<string>;

/** Spawns managed App Server child process and performs handshake initialization */
export function launchHarness(options: HarnessOptions): Promise<Harness>;
```

Lifecycle patterns for process spawning and temporary directory release are documented in [TypeScript SDK Examples](/en-US/docs/examples-sdk) §1 and §6.2.1.

### 4.4 Export helper utilities

The SDK provides higher-level utilities to materialize expert and team configurations directly to local disk:

```ts
/** Deconstructs and materializes specified expert and bound skills to local disk */
export function exportAgent(client: AppServerClient, agentId: string, destDir: string): Promise<ExportResult>;

/** Materializes team topology, member personas, and all skills to local disk */
export function exportTeam(client: AppServerClient, teamId: string, destDir: string, options?: ExportTeamOptions): Promise<ExportResult>;

/** Materializes an in-memory ExpertPack contract object into a standard directory tree */
export function materializePack(client: AppServerClient, pack: ExpertPack, destDir: string): Promise<ExportResult>;

export interface ExportResult {
  /** Absolute target filesystem path where assets were materialized */
  dir: string;
  /** List of skill names successfully written to disk */
  writtenSkills: string[];
  /** Declared skill dependencies unresolvable in the current host environment */
  danglingSkills: Array<{ id: string; error?: string }>;
  /** Relative file paths of plugin-level assets successfully written to disk */
  writtenAssets: string[];
  /** Serialized standard ExpertPack specification object */
  pack: ExpertPack;
}
```

Complete export and materialization patterns are documented in [TypeScript SDK Examples](/en-US/docs/examples-sdk) §5.2.

Materialized assets adhere to the following standard directory tree layout:
- `expert-pack.json`: Complete serialized `ExpertPack` specification (including `pack_format`, metadata, and dependency lists);
- `persona.md`: Individual agent Prompt instructions (generated only when `kind === "agent"`);
- `members/<member.id>/persona.md`: Member-specific Persona instructions (generated only when `kind === "team"`);
- `skills/<name>/...`: Skill file trees, deduplicated by skill id at the top level.

#### Two sources of a team's skills

An expert team (`kind === "team"`) has **two distinct definition sources** for skills. The server maintains them separately, and the client unions and deduplicates them by ID (`id === name`) during `materializePack`:

| Source | Pack field | Materialized destination | Typical scenario |
| --- | --- | --- | --- |
| Package-level skills | `pack.skills` | Skills declared in the package manifest `plugin.json`, materialized into the host managed skills root at install time | **Most official teams declare skills exclusively here** |
| Member-level declarations | `pack.team.members[].skills` | Skill dependency lists in member Markdown frontmatter | Typically an empty array |

Traversing member declarations alone will result in missing skills: the official market package `stock-partner-team` declares three skills at the package level while none of its seven members declare explicit skills. Call `exportTeam` or `materializePack` to materialize the combined set rather than manually iterating members; the server does not implicitly propagate package-level skills to members to ensure runtime bindings remain authentic.

#### Exporting a team's skills in one call

```ts
export interface DanglingSkillRef {
  /** Identifier of missing skill dependency */
  id: string;
  /** Diagnostic error explanation (uninstalled or missing host capability) */
  error?: string;
}

export interface ExportTeamOptions {
  /** Expected team semantic version string for consistency validation */
  teamVersion?: string;
}
```

Team export and materialization workflows are documented in [TypeScript SDK Examples](/en-US/docs/examples-sdk) §5.2.

```text
./dist/stock-partner-team/
├── expert-pack.json                  # the live pack, byte for byte (with pack_format and provenance)
├── members/<member id>/persona.md     # member personas; a team has no top-level persona.md
├── skills/                           # the union of both sources, deduplicated
│   ├── westock-data/{SKILL.md, package.json, references/...}
│   ├── westock-tool/{SKILL.md, package.json, references/...}
│   └── md-to-html/{SKILL.md, shell.html, scripts/...}
├── avatars/team.png                  # plugin-level asset (exported since fp-14 / pack_format 2)
└── bin/init_task.py                  # package script; the host itself never executes it, bytes land 0644
```

#### Plugin-level assets (exported since `fp-14` / `pack_format 2`)

The directories beside `skills/` — `avatars/`, `bin/`, `scripts/` — are part of what a package ships, and many teams' own scripts assume the plugin root holds them (`md-to-html`'s `render.py` resolves `PLUGIN_ROOT/bin/init_task.py`). Since `fp-14` the `ExpertPack` carries:

- `pack.assets`: an asset list **by reference** (`path` / `kind: "avatar" | "script"` / `size` / sha256 `digest`), sorted by `path`. The bytes are not in the pack — fetch one with `client.readImportAsset(pack.provenance.snapshot_id, path)`; `materializePack` already does all of the writing for you.
- `pack.avatar`: the package avatar as a snapshot-relative path (e.g. `avatars/team.png`), present **only when that exact file is listed in `assets`**.
- `ExportResult.writtenAssets`: the snapshot-relative paths actually written.

Two architectural scope constraints: assets are **snapshot-scoped** — a member pack's `assets` is always empty; read the top-level pack. And `kind: "script"` is a **classification label rather than an execution permission** — the host does not directly execute plugin-level scripts; execution is mediated by the consumer, and operators can omit this class from exported packs via `[expert_export] scripts = false` in `config.toml`. When the host's `snapshot_assets` capability bit is false, `assets` remains an empty table (distinguishing unintegrated capability from absence of assets).

#### Categories and tags (exported since `fp-16` / `pack_format 3`)

Since `fp-16` an `ExpertPack` carries the market's display metadata, so a third-party runtime can restore the market's organization:

- `pack.tags`: localized tags (`{zh, en}` optional pairs, position-paired).
- `pack.category_id`: the raw category reference (e.g. `04-DataAI`). The pack carries **only the id**; resolving it to a display name requires an equivalent dictionary on the consumer's side (this host's dictionary comes from `store.categories()` and is not portable across hosts).

The scope is the **opposite of `assets`**: a category is a per-package declaration, so the top-level pack carries the team row's values and **every member pack carries its own** (`pack.team.members[].tags` / `.category_id`). An undeclared value is an absent field; no empty string or `null` placeholder is substituted. The catalog face and the export face read the same facts:

```ts
export interface ExpertAssetRef {
  /** Relative path of asset within package (e.g. avatars/team.png, bin/init_task.py) */
  path: string;
  /** Asset kind classification (avatar for UI rendering, script for execution) */
  kind: "avatar" | "script";
  /** File size in bytes */
  size: number;
  /** SHA-256 content verification digest */
  digest: string;
}

export interface ExpertPack {
  /** Package specification format version (currently 3) */
  pack_format: number;
  /** Exported entity type (agent | team) */
  kind: "agent" | "team";
  /** Localized bilingual tags */
  tags?: Array<{ zh?: string; en?: string }>;
  /** Category identifier (e.g. "04-DataAI", resolved via store.categories()) */
  category_id?: string | null;
  /** Static plugin-level asset manifests (requires snapshot_assets capability) */
  assets?: ExpertAssetRef[];
  /** Relative path to package avatar image */
  avatar?: string;
}
```

Category and tag inspection patterns are documented in [TypeScript SDK Examples](/en-US/docs/examples-sdk) §5.2.2.

#### Skill bytes only, without writing a directory

Beyond `exportTeam`, the public primitives are `skills.files(id)` and `skills.readFile(id, path)`. Both sit behind the host's `skill_files` capability bit:

```ts
/**
 * Streams raw binary bytes of a file inside a skill package (requires skill_files capability)
 * @param client Client instance
 * @param skillId Unique skill identifier
 * @param path POSIX-relative path within skill package (traversal-checked by server)
 * @returns Raw binary bytes of the file (Uint8Array)
 */
export function readSkillFile(
  client: AppServerClient,
  skillId: string,
  path: string,
): Promise<Uint8Array>;
```

In-memory skill byte retrieval patterns are documented in [TypeScript SDK Examples](/en-US/docs/examples-sdk) §5.3.

#### Prerequisites and pitfalls

1. **Identifier format**: `teamId` must be the component ID returned by `teams.list()` (such as `wb-<package>-team`), not the package name. For single expert agents, use `exportAgent`; the two entities use distinct interfaces.
2. **Complete prerequisites**: `exportTeam` requires all members to be installed and enabled; missing or disabled members return `agent_not_installed` or `agent_disabled` specifying the exact member to prevent incomplete exports.
3. **Dangling reference causes**: `danglingSkills` occurs when a skill is not installed locally or the host lacks the `skill_files` capability bit. An empty list confirms full offline readiness.
4. **Incremental write behavior**: Materialization writes incrementally without deleting existing files in the target directory. When upgrading versions, export to a new directory or clean the target folder first.
5. **Decoupled binary transfer**: `pack.skills` contains metadata references only; binaries are retrieved on demand via `skill/files` and `skill/file`. To relocate to another host, copy the entire materialized `skills/` directory.

---

## 5. Protocol communication and HTTP route binding

### 5.1 HTTP route mapping table (httpRouteTable)

Read-only queries and stateless writes can be invoked directly over HTTP without establishing a persistent socket. The route table is exported directly by the client:

```ts
export interface HttpRouteInfo {
  /** HTTP request verb (GET / POST / DELETE / PUT) */
  verb: "GET" | "POST" | "DELETE" | "PUT";
  /** Mapped relative HTTP URL path (e.g. /api/app-server/markets) */
  path: string;
  /** Corresponding protocol RPC method identifier */
  protocolMethod: string;
}

/** Exports the full mapping dictionary of methods available over HTTP */
export function httpRouteTable(): Record<string, HttpRouteInfo>;
```

HTTP modes, transport selection criteria, and direct HTTP invocation patterns are documented in [TypeScript SDK Examples](/en-US/docs/examples-sdk) §6.1.

- Public HTTP endpoints map **56 / 83** protocol methods;
- Stateful real-time streaming methods (such as `follow`) and privileged local administrative operations are excluded from HTTP bindings.

### 5.2 Approval decision CAS optimistic concurrency control

When an execution pauses awaiting user approval (`waiting_input`), callers submit decisions via `runs.answerDecision`:

```ts
export interface AnswerDecisionInput {
  /** Unique task run identifier (UUID) */
  runId: string;
  /** Step identifier that requested operator decision */
  stepId: string;
  /** Execution attempt identifier that requested decision */
  attemptId: string;
  /** Human or policy decision answer payload */
  answer: string;
  /** Run execution version token for CAS optimistic concurrency check */
  expectedExecutionVersion: number;
  /** Step version token for CAS validation */
  expectedStepVersion: number;
  /** Attempt version token for CAS validation */
  expectedAttemptVersion: number;
}
```

All three `expected*Version` tokens are strictly enforced. Version mismatches reject immediately with a `conflict` status. CAS approval decision inspection and response workflows are documented in [TypeScript SDK Examples](/en-US/docs/examples-sdk) §5.1.

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

### 6.2 sequence number semantics

- Every downstream event carries a connection-local strictly increasing integer `sequence`;
- When the client detects `currentSequence > lastSeenSequence + 1`, a network gap is identified, triggering catch-up logic;
- Client subscription instances automatically discard duplicated sequence numbers locally.

### 6.3 Disconnection detection and incremental catch-up strategies

| Subscription domain | Server signal | Catch-up mechanism | Client entrypoint |
| --- | --- | --- | --- |
| Conversation streams | `conversation/resync-required` | Refetches transcript messages to rebuild state | Subscribe via `follow()`, listen via `onBackfill` |
| Task runs | `run/resync-required` | Replays events from last contiguous cursor sequence | Handled automatically by `follow()`; manual replay via `client.runs.events({ afterSequence })` |

```ts
export interface ConversationSubscription {
  /** Register callback for real-time incremental turn events (text delta, thinking, tool calls) */
  onEvent(listener: (event: ConversationEvent) => void): () => void;
  /** Register callback invoked when reconnect backfill snapshot is fetched after gap detection */
  onBackfill(listener: (snapshot: ConversationMessagesPage) => void): () => void;
  /** Register callback for transport and streaming channel errors */
  onError(listener: (error: unknown) => void): () => void;
  /** Close subscription channel and release underlying listeners */
  close(): void;
}
```

Streaming subscriptions, typewriter output, and backfill reconnection patterns are documented in [TypeScript SDK Examples](/en-US/docs/examples-sdk) §2.1.

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
export interface RetryOptions {
  /** Maximum attempt count including initial execution (defaults to 3) */
  maxAttempts?: number;
  /** Initial backoff delay duration in milliseconds (defaults to 500) */
  baseDelayMs?: number;
  /** Maximum cap for retry delay intervals in milliseconds (defaults to 8,000) */
  maxDelayMs?: number;
  /** Random jitter ratio between 0 and 1 (defaults to 0.25) */
  jitter?: number;
  /** Monitoring callback invoked prior to dispatching each retry attempt */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

/** Executes an async operation with exponential backoff and jittered retries */
export function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
```

Production error classification and retry workflows are documented in [TypeScript SDK Examples](/en-US/docs/examples-sdk) §6.3.

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

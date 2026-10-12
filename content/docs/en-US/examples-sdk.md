# TypeScript SDK cookbook

This document serves as the practical companion cookbook for the [TypeScript SDK reference](/en-US/docs/typescript-sdk), organized progressively from a 5-line quick start to multi-agent orchestration, connector integrations, and production governance.

> **Architecture quick reference**: `@flowy-agent-store/protocol` provides pure type contracts and error models; `@flowy-agent-store/client` provides transport-decoupled `AppServerClient` and 9 business subclients; `@flowy-agent-store/sdk` encapsulates Node.js host process management (`launchHarness`). Streaming events require `WebSocketTransport`.

## 1. Quick start: launch and first conversation in 5 lines

| Package | Architectural role and scope | Runtime environment |
| --- | --- | --- |
| `@flowy-agent-store/protocol` | Pure type contracts, error hierarchies, and decoding utilities | Universal (Node.js / Browser / zero runtime dependencies) |
| `@flowy-agent-store/client` | Transport-decoupled `AppServerClient` and domain subclients | Universal (Node.js / Browser / Electron renderer) |
| `@flowy-agent-store/sdk` | Node.js host process management, port allocation, and test harness | Node.js ≥ 22 or Bun |

```bash
# Install the unified SDK package (requires Node.js ≥ 22 or Bun)
bun add @flowy-agent-store/sdk # or npm install @flowy-agent-store/sdk
```

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

// 1. Launch local host process, allocate port, and complete handshake in one call
const harness = await launchHarness({
  client: { name: "quickstart-app", version: "1.0.0" },
});

try {
  // 2. Create conversation and send first message (explicit UUID ensures idempotency)
  const chat = await harness.conversations.create({ name: "Quickstart" });
  const receipt = await harness.conversations.send(
    chat.conversation_id,
    "Hello! Please introduce yourself briefly.",
    crypto.randomUUID(),
  );
  console.log(`Message accepted: ${receipt.accepted}`);
} finally {
  // 3. Close connection and reclaim temporary data directory on teardown
  await harness.close();
}
```

## 2. Core conversations and streaming events

### 2.1 Subscribing to streaming delta events (typewriter output)

Subscribe to conversation events via `follow()` to receive model thinking streams and text deltas in real time:

```ts
import { decodeConversationEvent } from "@flowy-agent-store/protocol";

const chat = await client.conversations.create({ name: "Streaming Demo" });
const conversationId = chat.conversation_id;

// 1. Subscribe to event stream: receive model thinking and text deltas
const subscription = await client.conversations.follow(conversationId);
subscription.onEvent((rawEvent) => {
  const event = decodeConversationEvent(rawEvent);
  if (event.kind === "message.thinking") {
    process.stderr.write(`[Thinking] ${event.thinking}\n`);
  } else if (event.kind === "message.delta") {
    process.stdout.write(event.delta);
  }
});
subscription.onError((error) => console.error("Streaming error:", error));

// 2. Send message turn
await client.conversations.send(
  conversationId,
  "Evaluate trade-offs of single-binary architectures and output an outline",
  crypto.randomUUID(),
);
```

### 2.2 Dynamically mounting atomic skills per turn

Mounting skills applies exclusively to the current turn and leaves the stored conversation snapshot unmutated:

```ts
// 1. Discover locally available atomic skills
const skills = await client.skills.list();
const gitSkill = skills.find((item) => item.name === "git-workflow");

if (!gitSkill) throw new Error("git-workflow skill not installed");

// 2. Inject skill capability into turn via mentions
await client.conversations.send(
  conversationId,
  "Review current Git commit history against conventional guidelines",
  crypto.randomUUID(),
  {
    mentions: [{ kind: "skill", id: gitSkill.id }],
    // attachments: ["/absolute/path/to/diff.patch"], // Optional workspace attachment
  },
);
```

### 2.3 Concurrent conversations multiplexed over a single WebSocket

A single host instance manages multiple isolated conversations, and a single WebSocket connection multiplexes streams concurrently:

```ts
// 1. Concurrently create isolated business conversations
const chatA = await client.conversations.create({ name: "Log Analysis" });
const chatB = await client.conversations.create({ name: "API Design" });

// 2. Subscribe to each conversation independently over the same WebSocket
for (const chat of [chatA, chatB]) {
  const sub = await client.conversations.follow(chat.conversation_id);
  sub.onEvent((event) => {
    console.log(`[Conversation ${chat.name}] Event received:`, event.event_type);
  });
}

// 3. Dispatch concurrent requests across conversations without mutual blocking
const receipts = await Promise.all([
  client.conversations.send(chatA.conversation_id, "Analyze NPE root cause", crypto.randomUUID()),
  client.conversations.send(chatB.conversation_id, "Draft user center API specs", crypto.randomUUID()),
]);
console.log("Concurrent acceptance:", receipts.map((r) => r.accepted));
```

## 3. Role-based agents and multi-agent team orchestration

### 3.1 Binding conversations to a single expert agent

Binding an expert subjects the conversation from turn one to the expert instructions, skills, and connector boundaries:

```ts
// 1. Query locally available expert agents
const experts = await client.agents.list();
const architect = experts.find((item) => item.name === "software-architect");

if (!architect) throw new Error("Target expert not installed");

// 2. Create conversation bound to expert (throws agent_not_installed if missing)
const expertChat = await client.conversations.create({
  name: "Architecture Consultation",
  agentId: architect.id,
});
await client.conversations.send(expertChat.conversation_id, "Design microkernel extension architecture", crypto.randomUUID());
```

### 3.2 Expert team collaborative conversations

Binding an expert team delegates orchestration to the Team Leader to dispatch subtasks across specialist members:

```ts
// 1. Query configured expert teams
const teams = await client.teams.list();
const teamChat = await client.conversations.create({
  teamId: teams[0].id, // teamId and agentId are strictly mutually exclusive
});

// 2. Dispatch cross-role collaborative prompt
await client.conversations.send(teamChat.conversation_id, "Create implementation plan for auth refactoring across frontend and backend", crypto.randomUUID());
```

## 4. Marketplace resources and connector integrations

### 4.1 Marketplace catalog search, installation, and in-place atomic updates

```ts
// 1. Query unified catalog and install entry
const store = await client.listStore();
const targetItem = store.items.find((item) => item.entry_name === "frontend-backend-experts");

if (targetItem && !targetItem.installed) {
  await client.installStoreEntry(targetItem.marketplace_id, targetItem.entry_name);
}

// 2. High-level state-machine installation with readiness polling
const searchResults = await client.store.search("github", { kind: "connector" });
const outcome = await client.store.install(searchResults[0], { waitForReady: true });

if (!outcome.ok) {
  console.warn("Component installation incomplete:", outcome.components.filter((c) => !c.ok));
}

// 3. Inspect updates and apply in-place atomic updates (recommended since 0.1.0-beta.8)
const outdated = await client.store.checkUpdates();
for (const entry of outdated) {
  if (client.store.updateHint(entry) === "update") {
    // In-place atomic update: downloads and verifies new version, switches over, and rolls back on failure
    const updateOutcome = await client.store.update(entry, { waitForReady: true });
    console.log(`Update result: ${updateOutcome.ok ? "success" : "failed"}`);
  }
}

// 4. Disable and uninstall
// await client.store.setEnabled(searchResults[0], false); // Toggles catalog active flag
// await client.store.uninstall(searchResults[0]);         // Completely purges files from disk
```

### 4.2 Connector tool probes and dynamic invocation

```ts
// 1. Probe connector connectivity and discover tool signatures
const probe = await client.connectors.test("github");
if (!probe.success) {
  throw new Error(probe.error ?? "Connector probe failed");
}

// 2. Find target tool and verify input parameter schemas
const targetTool = probe.tools?.find((tool) => tool.name === "create_issue");
console.log("Tool description:", targetTool?.description);

// 3. Invoke external tool with structured arguments
const invocation = await client.connectors.call("github", "create_issue", {
  owner: "flowy-org",
  repo: "agent-store",
  title: "SDK documentation synchronization",
});

if (invocation.is_error) {
  // Business rejections or validation failures return in result object without throwing
  console.error("Tool invocation returned error:", invocation.result);
} else {
  console.log("Tool executed successfully:", invocation.result);
}
```

### 4.3 Connector credential forms and private service registration

```ts
// 1. Inspect required credential schema
const credForm = await client.connectors.credentials("weather-service");

if (credForm.status === "missing") {
  console.warn(`Missing required credentials: ${credForm.missing.join(", ")}`);

  // 2. Safely store sensitive secrets (encrypted on disk, never echoed in plaintext over network)
  await client.connectors.setCredentials("weather-service", {
    WEATHER_API_KEY: "sk-live-mock-api-key-9988",
  });
}

// 3. Dynamically register private MCP service (derives schema from ${secret:NAME} templates)
await client.connectors.register({
  name: "custom-internal-db",
  transport: {
    sse: {
      url: "https://internal.corp/db/sse",
      headers: { Authorization: "Bearer ${secret:INTERNAL_DB_TOKEN}" },
    },
  },
});

// 4. Reset or purge unneeded credentials
// await client.connectors.clearCredentials("weather-service", ["WEATHER_API_KEY"]);
```

### 4.4 End-to-end connector OAuth authorization flow

```ts
const connectorId = "github";

// 1. Check current authentication status
const initialStatus = await client.connectors.authStatus(connectorId);

if (initialStatus.state !== "authenticated") {
  // 2. Initiate browser OAuth flow (non-blocking call returning started status)
  const startResult = await client.connectors.authStart(connectorId);
  if (startResult.state !== "started") {
    throw new Error(startResult.error ?? "Failed to launch OAuth browser flow");
  }

  // 3. Await user authorization and token exchange (120s timeout budget)
  const authResult = await client.connectors.waitForAuth(connectorId);
  if (authResult.state === "error") {
    throw new Error(`OAuth authorization error: ${authResult.error}`);
  }
  if (authResult.state === "timeout") {
    throw new Error("User authorization timed out");
  }
}

// 4. Verify connector operational health
const health = await client.connectors.status(connectorId);
console.log(`Connector status: ${health.status}`);

// 5. Revoke credentials upon task completion
// await client.connectors.logout(connectorId);
```

### 4.5 Dynamic marketplace source management

```ts
// 1. List configured marketplace sources
const marketplaces = await client.listMarketplaces();

// 2. Dynamically register third-party source and refresh index
const added = await client.addMarketplace({
  source_kind: "url",
  source: "https://example.com/custom-market.json",
});
await client.refreshMarketplace(added.marketplace_id);

// 3. Remove marketplace source (cascade: true unregisters associated uncommitted snapshots)
await client.removeMarketplace(added.marketplace_id, /* cascade */ true);
```

## 5. Advanced workflows and pack materialization

### 5.1 Standalone run orchestration and CAS decision approval

Standalone runs operate independently of interactive conversations, optimized for long-running autonomous workflows:

```ts
// 1. Trigger standalone agent batch task
const receipt = await client.runs.agent({
  agentId: "frontend-backend-experts",
  goal: "Generate OpenAPI specifications and mock datasets for order service",
});
const runId = receipt.run_id;

// 2. Subscribe to execution progress and intercept approval requests
const runSub = await client.runs.follow(runId);
runSub.onEvent(async (event) => {
  if (event.event_type === "approval.requested") {
    // Intercept decision request and submit approval with three CAS optimistic lock versions
    await client.runs.answerDecision({
      runId,
      stepId: event.step_id!,
      attemptId: event.attempt_id!,
      answer: "Approved: file writing authorized",
      expectedExecutionVersion: event.expected_execution_version!,
      expectedStepVersion: event.expected_step_version!,
      expectedAttemptVersion: event.expected_attempt_version!,
    });
  }
});

// 3. Await terminal status and extract execution results
const result = await client.runs.result(runId);
console.log(`Run status: ${result.status}`);
```

### 5.2 Materializing expert and team resource packs to disk

```ts
import { exportAgent, exportTeam, materializePack } from "@flowy-agent-store/sdk";

// Pattern A: Export complete team (unions package-level and member-level skills, deduplicating by id)
// teamId comes from teams.list() component ID (shaped like wb-<package>-team)
const teamResult = await exportTeam(client, "wb-stock-partner-team-team", "./exported-team");
console.log(`Materialized skills count: ${teamResult.writtenSkills.length}`);
if (teamResult.danglingSkills.length > 0) {
  console.warn("Dangling skill references:", teamResult.danglingSkills);
}

// Pattern B: Export single expert agent
const agentResult = await exportAgent(client, "wb-architect", "./exported-expert");
console.log(`Expert written path: ${agentResult.dir}`);

// Pattern C: Materialize ExpertPack directly from memory to disk
const pack = await client.agents.export("wb-architect");
const customResult = await materializePack(client, pack, "./exported-custom");
console.log(`Custom materialized skills: ${customResult.writtenSkills.join(", ")}`);
```

#### 5.2.1 Plugin-level assets exported alongside packages

Starting with `fp-14` (`pack_format 2`), exported packages deliver `avatars/`, `bin/`, and `scripts/` sibling directories to support package scripts expecting standard plugin root layouts (e.g. `PLUGIN_ROOT/bin/init_task.py`):

```ts
// Verify host supports snapshot assets (pack.assets is empty when unsupported)
if (client.initializeInfo?.capabilities.snapshot_assets) {
  const result = await exportTeam(client, "wb-stock-partner-team-team", "./exported-team");

  // pack.assets: ordered list by reference with path, kind (avatar / script), and sha256
  for (const asset of result.pack.assets) {
    console.log(`${asset.kind.padEnd(6)} ${asset.digest.slice(0, 12)} ${asset.path}`);
  }

  // Package avatar: snapshot-relative path guaranteed present in assets
  console.log(`Package avatar: ${result.pack.avatar}`);
  console.log(`Written assets: ${result.writtenAssets.join(", ")}`);
}
```

```text
./exported-team/
├── expert-pack.json
├── members/<id>/persona.md
├── skills/md-to-html/scripts/render.py
├── avatars/team.png
├── bin/init_task.py
└── scripts/check.sh
```

### 5.3 Workspace management and reading internal skill files

```ts
// 1. Manage safe workspace paths
const workspaces = await client.workspaces.list();
const newWorkspace = await client.workspaces.create("/abs/path/to/project");
await client.workspaces.revoke(newWorkspace.workspace_id); // Soft revocation without deleting disk files

// 2. Read skill files (governed by host skill_files capability bit)
if (client.initializeInfo?.capabilities.skill_files) {
  const inventory = await client.skills.files("release-notes");
  for (const file of inventory.files) {
    console.log(`File: ${file.path}, Size: ${file.size}, Digest: ${file.digest}`);
  }

  // Read relative file bytes securely (path traversal verified by server)
  const fileBytes = await client.skills.readFile("release-notes", "references/guide.md");
  const content = new TextDecoder().decode(fileBytes);
  console.log("File content:", content);
}
```

### 5.4 Host tool domain tailoring and security policies

Tailor host tool capabilities dynamically via environment variables:

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

// Inject tool policy via AGENT_STORE_TOOLS to override host defaults
const harness = await launchHarness({
  client: { name: "sandboxed-client", version: "1.0.0" },
  env: {
    AGENT_STORE_TOOLS: JSON.stringify({
      web: true,       // Allow web search and read-only fetching
      computer: false, // Disable desktop mouse/keyboard control
      browser: false,  // Disable browser automation
      domains: {
        cron: false,
        meeting: false,
        knowledge: false,
        learning: false,
        media: false,
        companion: false,
        requirement: false,
      },
    }),
  },
});

try {
  const store = await harness.listStore();
  console.log(`Loaded items under restriction: ${store.items.length}`);
} finally {
  await harness.close();
}
```

| Rule property | Operational mechanism and constraints |
| --- | --- |
| Value format | Valid JSON string matching the `[tools]` structure in `config.toml` |
| Precedence | Environment variable **replaces entirety** of `[tools]` in config file without recursive merge |
| Fallback behavior | Server logs warnings and falls back to config file if JSON parsing fails |
| Lifecycle | Evaluated once during process bootstrap; automatically active in each `launchHarness` instance |

## 6. Host architecture and production engineering

### 6.1 Transport layer and communication protocol selection

The SDK supports two transport implementations suited for different architectural scenarios:

| Key capability | WebSocketTransport | HttpTransport |
| --- | --- | --- |
| Real-time streaming (`follow` / `onNotification`) | **Supported** (bidirectional persistent socket) | **Unsupported** (throws `TransportError`) |
| Handshake and lifecycle | Single handshake, multiplexed over persistent channel | Independent HTTP request and authentication per call |
| Recommended use cases | Desktop GUIs, Web frontends, continuous job monitoring | Automation scripts, CI checks, one-off queries |

```ts
import { AppServerClient, HttpTransport, WebSocketTransport, httpRouteTable } from "@flowy-agent-store/client";

// Mode A: WebSocketTransport (for real-time streaming and interactive applications)
const wsTransport = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", {
  token: process.env.AGENT_STORE_TOKEN,
  requestTimeoutMs: 30_000,
});
const wsClient = new AppServerClient({
  transport: wsTransport,
  client: { name: "desktop-ui", version: "1.0.0" },
});
await wsClient.connect();

// Mode B: HttpTransport (for stateless scripts and one-off queries)
const httpTransport = new HttpTransport({
  baseUrl: "http://127.0.0.1:8787",
  token: process.env.AGENT_STORE_TOKEN,
});
const httpClient = new AppServerClient({
  transport: httpTransport,
  client: { name: "cli-tool", version: "1.0.0" },
});
await httpClient.connect(); // connect() is a no-op under HTTP transport
const store = await httpClient.listStore();
console.log(`HTTP supported method count: ${Object.keys(httpRouteTable()).length}`);
```

### 6.2 Diverse host integration patterns

#### 6.2.1 Persistent data directory hosting (production and testing)

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({
  bin: "/opt/flowy-agent-store/flowy-agent-store", // Explicit binary path
  dataDir: "/var/lib/my-app/agent-store",          // Persistent directory: preserved across restarts
  readyTimeoutMs: 180_000,                         // Cold start database timeout (180s)
  requestTimeoutMs: 120_000,                       // Request timeout (120s)
  extraArgs: ["--agent-store-config", "/etc/my-app/agent-store.toml"],
  client: { name: "ci-worker", version: "1.0.0" },
  onExit: (info) => console.warn(`Runtime exited: code=${info.code}, signal=${info.signal}`),
});

try {
  const store = await harness.listStore();
  console.log(`Catalog entries: ${store.items.length}, warming: ${store.markets_pending}`);
} finally {
  await harness.close(); // Clean shutdown preserving persistent data directory
}
```

#### 6.2.2 Decoupled process management with spawnAppServer

```ts
import { spawnAppServer } from "@flowy-agent-store/sdk";
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

// Manage standalone daemon process without bound client
const server = await spawnAppServer({
  dataDir: "/var/lib/my-app/agent-store",
  host: "127.0.0.1",
  port: 0, // OS allocates free dynamic port
});

try {
  const wsUrl = `ws://${server.readiness.host}:${server.readiness.port}/api/app-server/ws`;
  const client = new AppServerClient({
    transport: new WebSocketTransport(wsUrl),
    client: { name: "external-client", version: "1.0.0" },
  });
  await client.connect();

  const catalog = await client.connectors.list();
  console.log(`Connector count: ${catalog.length}`);
} finally {
  await server.close(); // Terminate server process
}
```

#### 6.2.3 Web browser and Electron hybrid architectures

```ts
// Mode A: Web browser (connects to existing daemon; cannot spawn processes)
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const token = window.sessionStorage.getItem("agent_store_token") ?? undefined;
const transport = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", {
  token,
  requestTimeoutMs: 15_000,
});
const webClient = new AppServerClient({
  transport,
  client: { name: "web-dashboard", version: "1.0.0" },
});
await webClient.connect();

// Mode B: Electron hybrid architecture (main process spawns daemon, renderer communicates over IPC)
// Main process manages binaries and paths; renderer only receives socket URLs, protecting secrets
```

### 6.3 Structured error handling and exponential backoff retry

```ts
import { withRetry } from "@flowy-agent-store/client";
import { AppServerError, formatError, isRetryableError } from "@flowy-agent-store/protocol";

// Mode A: Exponential backoff retry with jitter for idempotent operations
const runDetails = await withRetry(() => client.runs.get("run-12345"), {
  maxAttempts: 4,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  onRetry: ({ attempt, delayMs, error }) => {
    console.warn(`Retry attempt ${attempt} in ${delayMs}ms, reason: ${formatError(error)}`);
  },
});

// Mode B: Deterministic branching based on structured AppServerError codes
try {
  await client.runs.result("run-12345");
} catch (error) {
  if (error instanceof AppServerError) {
    switch (error.code) {
      case "connector_unavailable":
        console.error("Connector offline or unauthenticated; prompt user to reconnect");
        break;
      case "agent_not_installed":
        console.error("Target expert not installed locally");
        break;
      default:
        console.error(`App Server error [${error.code}]:`, formatError(error));
    }
  } else if (isRetryableError(error)) {
    console.warn("Transient network error, safe to retry");
  } else {
    throw error;
  }
}
```

### 6.4 Production guidelines and operational safeguards

- **Data directory exclusive lock**: A given `dataDir` holds an exclusive filesystem lock; multiple concurrent processes cannot share the same directory. Multi-instance testing requires distinct paths.
- **Asynchronous prompt acceptance**: `conversations.send` returning `accepted: true` denotes queued ingestion, not completed inference; streaming responses require event subscriptions or polling `is_processing`.
- **Marketplace background warming**: On cold starts, `store/list` does not block for archive unpacks; poll `markets_pending` until false when an empty catalog is received.
- **Initial connector state**: Newly imported connectors default to `disabled`; high-level `store.install` automatically handles enablement and connectivity verification.
- **Upgrade lifecycle conventions**: Earlier releases followed an uninstall-then-reinstall (`uninstall_reinstall`) workflow; starting from `0.1.0-beta.8`, store entries recommend in-place atomic updates via `store.update()`.
- **Skill disabling vs uninstallation**: Skills cannot be hot-unloaded at runtime; `store.setEnabled(item, false)` sets a catalog flag, while full removal requires `uninstall`.
- **Strict protocol version matching**: The host process and SDK enforce exact `protocol_version` equality; discrepancies cause immediate child process termination during bootstrap.
- **Temporary directory cleanup**: When using `launchHarness` without an explicit `dataDir`, always call `close()` within a `finally` block to prevent orphaned temporary directory buildup.

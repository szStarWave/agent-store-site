# TypeScript SDK cookbook

This document serves as the practical example companion to the [TypeScript SDK reference](/en-US/docs/typescript-sdk), providing copy-paste integration patterns structured across major usage scenarios.

> Architecture breakdown: `@flowy-agent-store/protocol` supplies pure type contracts and error classes; `@flowy-agent-store/client` provides transport-decoupled client abstractions; `@flowy-agent-store/sdk` encapsulates Node.js host lifecycle orchestration (`launchHarness`). **Real-time subscriptions mandate `WebSocketTransport`**; stateless request-response invocations can use `HttpTransport`.

## 1. Packages and runtime architecture

| Package | Use case and role | Runtime environment |
| --- | --- | --- |
| `@flowy-agent-store/protocol` | Pure type contracts, error definitions, and encoding utilities | Universal (Node.js / browser / zero runtime dependencies) |
| `@flowy-agent-store/client` | Transport-decoupled `AppServerClient` and subclients | Universal (Node.js / browser / Electron renderer) |
| `@flowy-agent-store/sdk` | Node.js host process management, dynamic port discovery, and harness orchestration | Node.js ≥ 22 or Bun |

```bash
# Verify Node.js version (requires built-in global WebSocket), or use Bun instead
node -v

# Install the primary SDK package
bun add @flowy-agent-store/sdk # or npm install @flowy-agent-store/sdk

# Declare the prebuilt binary path (optional; searched across PATH and platform packages if omitted)
export AGENT_STORE_BIN=/opt/flowy-agent-store/flowy-agent-store
```

## 2. Transport and protocol selection

The system provides two transport implementations. Their functional boundaries and selection criteria are summarized below:

| Feature | WebSocketTransport | HttpTransport |
| --- | --- | --- |
| Real-time event streaming (`follow` / `onNotification`) | **Supported** (bidirectional long-lived streaming connection) | **Not supported** (invocations throw `TransportError`) |
| Handshake and connection lifecycle | Single handshake per session over a multiplexed persistent socket | Independent HTTP connection and auth negotiation per call |
| Recommended use cases | Desktop GUIs, Web frontends, continuous task monitoring | CLI scripts, single-pass CI smoke tests, one-off queries |

```ts
import { AppServerClient, HttpTransport, WebSocketTransport, httpRouteTable } from "@flowy-agent-store/client";

// Mode A: WebSocketTransport (for real-time interactive UIs and streaming event subscriptions)
const wsTransport = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", {
  token: process.env.AGENT_STORE_TOKEN,
  requestTimeoutMs: 30_000,
});
const wsClient = new AppServerClient({
  transport: wsTransport,
  client: { name: "desktop-ui", version: "1.0.0" },
});
await wsClient.connect();

// Mode B: HttpTransport (for lightweight stateless scripts and one-off queries)
const httpTransport = new HttpTransport({
  baseUrl: "http://127.0.0.1:8787",
  token: process.env.AGENT_STORE_TOKEN,
});
const httpClient = new AppServerClient({
  transport: httpTransport,
  client: { name: "cli-tool", version: "1.0.0" },
});
await httpClient.connect(); // In HTTP mode, connect() is a no-op
const store = await httpClient.listStore();

// Inspect supported HTTP methods via the route table (streaming methods are excluded)
console.log(`HTTP supported methods: ${Object.keys(httpRouteTable()).length}`);
```

## 3. Runtime host integration and lifecycle

### 3.1 Node.js managed mode (launchHarness lifecycle)

Spawns the local runtime, discovers dynamic port allocations, binds over loopback, and completes handshake initialization in a single call:

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

// Launch host process, complete handshake, and obtain an initialized client instance
const harness = await launchHarness({
  client: { name: "my-service", version: "1.0.0" },
  capabilities: { events: true, approvals: true, team_runtime: true },
});

try {
  console.log(`Server readiness URL: ${harness.server.readiness.url}`);
  console.log(`Protocol version: ${harness.handshake.protocol_version}`);

  const store = await harness.listStore();
  console.log(`Store items ready: ${store.items.length}`);
} finally {
  // Always close in a finally block: terminates the child process and cleans up temporary files
  await harness.close();
}
```

Internal lifecycle steps performed by `launchHarness`:
1. Discovers the runtime binary (`bin` $\to$ `AGENT_STORE_BIN` $\to$ platform packages $\to$ system `PATH`);
2. Spawns a child process with `--host 127.0.0.1 --port 0 --no-open` and an isolated temporary `--data-dir`;
3. Scans stdout for the machine-readable readiness line (`{"agent_store":"listening",...}`) to extract assigned ports;
4. Enforces strict `protocol_version` equality against the SDK, terminating child processes on mismatch;
5. Connects via loopback WebSocket and completes handshakes, returning an active `AppServerClient`. See [reference](/en-US/docs/typescript-sdk) §4 for full parameter details.

### 3.2 Custom configuration and persistent data directory (production and testing)

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({
  bin: "/opt/flowy-agent-store/flowy-agent-store", // Pin specific prebuilt binary
  dataDir: "/var/lib/my-app/agent-store",          // Persistent directory: survives process termination
  readyTimeoutMs: 180_000,                         // Extended cold-start timeout budget (180s)
  requestTimeoutMs: 120_000,                       // Extended per-request timeout budget (120s)
  extraArgs: ["--agent-store-config", "/etc/my-app/agent-store.toml"],
  client: { name: "ci-worker", version: "1.0.0" },
  onExit: (info) => console.warn(`Runtime exited: code=${info.code}, signal=${info.signal}`),
});

try {
  const store = await harness.listStore();
  console.log(`Items: ${store.items.length}, warming: ${store.markets_pending}`);
} finally {
  await harness.close(); // Gracefully stops process; persistent data directory remains intact
}
```

### 3.3 Standalone process management (spawnAppServer decoupled from client)

Manages process lifecycles independently without creating an in-memory client:

```ts
import { spawnAppServer } from "@flowy-agent-store/sdk";
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

// Spawn and manage standalone daemon process without binding an internal client
const server = await spawnAppServer({
  dataDir: "/var/lib/my-app/agent-store",
  host: "127.0.0.1",
  port: 0, // OS assigns an ephemeral free port dynamically
});

try {
  const wsUrl = `ws://${server.readiness.host}:${server.readiness.port}/api/app-server/ws`;
  const client = new AppServerClient({
    transport: new WebSocketTransport(wsUrl),
    client: { name: "external-client", version: "1.0.0" },
  });
  await client.connect();

  const catalog = await client.connectors.list();
  console.log(`Connectors count: ${catalog.length}`);
} finally {
  await server.close(); // Terminate server child process
}
```

### 3.4 Web browser persistent connection mode (connecting to an active server)

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

// Browser environments cannot spawn processes; connect to an existing server over WebSocket
const token = window.sessionStorage.getItem("agent_store_token") ?? undefined;
const transport = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", {
  token, // Automatically appended as a query parameter when authentication is enabled
  requestTimeoutMs: 15_000,
});

const client = new AppServerClient({
  transport,
  client: { name: "web-dashboard", version: "1.0.0" },
});

await client.connect();
const experts = await client.agents.list();
console.log(`Ready experts: ${experts.length}`);
```

### 3.5 Electron hybrid architecture (main process spawn and renderer connection)

The main process manages the runtime binary and data directory, while the renderer process receives loopback credentials to establish direct WebSocket connections. Private secrets stay within the main process secure enclave.

```ts
// 1. Electron main process (main.ts): manages daemon lifecycle and storage
import { app, ipcMain } from "electron";
import { spawnAppServer, type SpawnedServer } from "@flowy-agent-store/sdk";
import { join } from "node:path";

let server: SpawnedServer | null = null;

async function bootstrap() {
  server = await spawnAppServer({
    dataDir: join(app.getPath("userData"), "agent-store"),
  });

  const wsUrl = `ws://${server.readiness.host}:${server.readiness.port}/api/app-server/ws`;
  const token = server.readiness.auth === "disabled-local" ? undefined : process.env.AGENT_STORE_TOKEN;

  ipcMain.handle("agent-store:get-connection", () => ({ url: wsUrl, token }));

  server.exited.then((info) => {
    console.warn(`Runtime exited: code=${info.code}, signal=${info.signal}`);
  });
}

app.whenReady().then(bootstrap);
app.on("before-quit", async (event) => {
  if (server) {
    event.preventDefault();
    await server.close();
    server = null;
  }
  app.exit();
});

// 2. Renderer process (renderer.ts): requests connection info via IPC and binds WebSocket
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const { url, token } = await (window as any).agentStore.getConnection();
const client = new AppServerClient({
  transport: new WebSocketTransport(url, { token }),
  client: { name: "electron-renderer", version: "1.0.0" },
});
await client.connect();
```

## 4. Conversations and multi-agent orchestration

### 4.1 Basic conversation interaction (creation, event streaming, and idempotent delivery)

```ts
import { decodeConversationEvent } from "@flowy-agent-store/protocol";

// 1. Create a new conversation
const conversation = await client.conversations.create({ name: "Technical Exploration" });
const conversationId = conversation.conversation_id;

// 2. Subscribe to the real-time event stream
const subscription = await client.conversations.follow(conversationId);
subscription.onEvent((rawEvent) => {
  const event = decodeConversationEvent(rawEvent);
  if (event.kind === "message.delta") {
    process.stdout.write(event.delta);
  }
});
subscription.onError((error) => console.error("Streaming error:", error));

// 3. Send prompt (must provide a client-generated UUID as an idempotency key)
const receipt = await client.conversations.send(
  conversationId,
  "Analyze the trade-offs of a single-binary architecture and outline key findings",
  crypto.randomUUID(),
);
console.log(`Prompt accepted: ${receipt.accepted}`);
```

### 4.2 Dynamic atomic skill attachment (turn-level capability injection)

Skill attachments apply solely to the current conversational turn and do not modify the persistent conversation snapshot:

```ts
// Discover available local skills
const skills = await client.skills.list();
const gitSkill = skills.find((item) => item.name === "git-workflow");

if (!gitSkill) throw new Error("git-workflow skill not installed");

// Attach skill for this specific turn via mentions without polluting conversation state
await client.conversations.send(
  conversationId,
  "Audit git commit history against repository conventions",
  crypto.randomUUID(),
  {
    mentions: [{ kind: "skill", id: gitSkill.id }],
    // attachments: ["/absolute/path/to/diff.patch"], // Optional workspace attachment
  },
);
```

### 4.3 Persona conversations and team orchestration (expert and team binding)

```ts
// Mode A: Single-expert binding (constrained from turn 1 by persona instructions, skills, and connector fences)
const experts = await client.agents.list();
const architect = experts.find((item) => item.name === "software-architect");

const expertChat = await client.conversations.create({
  name: "Architecture Session",
  agentId: architect!.id, // Throws agent_not_installed if not present locally
});
await client.conversations.send(expertChat.conversation_id, "Plan microkernel extensions", crypto.randomUUID());

// Mode B: Team binding (orchestrated by the Team Leader who delegates subtasks)
const teams = await client.teams.list();
const teamChat = await client.conversations.create({
  teamId: teams[0].id, // teamId and agentId are mutually exclusive
});
await client.conversations.send(teamChat.conversation_id, "Break down refactoring requirements into role-specific subtasks", crypto.randomUUID());
```

### 4.4 Concurrent conversations and multiplexing over a single WebSocket connection

A single host manages multiple independent sessions while multiplexing streaming events over a single WebSocket connection:

```ts
// 1. Concurrently spawn multiple independent conversations
const chatA = await client.conversations.create({ name: "Error Log Analysis" });
const chatB = await client.conversations.create({ name: "API Schema Design" });
const activeChats = [chatA, chatB];

// 2. Subscribe to each conversation over the same WebSocket connection, dispatching via closures
for (const chat of activeChats) {
  const sub = await client.conversations.follow(chat.conversation_id);
  sub.onEvent((event) => {
    console.log(`[Conversation ${chat.name} event]`, event.event_type);
  });
}

// 3. Dispatch parallel turns across conversations (isolated per conversation without cross-blocking)
const receipts = await Promise.all([
  client.conversations.send(chatA.conversation_id, "Analyze crash trace", crypto.randomUUID()),
  client.conversations.send(chatB.conversation_id, "Draft user service API schema", crypto.randomUUID()),
]);
console.log("Acceptance status:", receipts.map((r) => r.accepted));

// 4. Query all active conversations within the host
const allViews = await client.conversations.list();
for (const view of allViews) {
  console.log(`Session: ${view.name}, processing: ${view.is_processing}`);
}
```

### 4.5 Standalone task (Run) orchestration and human-in-the-loop approvals

```ts
// 1. Dispatch an autonomous batch agent run
const receipt = await client.runs.agent({
  agentId: "frontend-backend-experts",
  goal: "Generate OpenAPI definitions and mock fixtures for the order service",
});
const runId = receipt.run_id;

// 2. Stream execution events and handle interactive decision approvals
const runSub = await client.runs.follow(runId);
runSub.onEvent(async (event) => {
  if (event.event_type === "approval.requested") {
    // Submit approval response with required optimistic concurrency versions
    await client.runs.answerDecision({
      runId,
      stepId: event.step_id!,
      attemptId: event.attempt_id!,
      answer: "Approved to modify workspace files",
      expectedExecutionVersion: event.expected_execution_version!,
      expectedStepVersion: event.expected_step_version!,
      expectedAttemptVersion: event.expected_attempt_version!,
    });
  }
});

// 3. Await terminal completion and inspect output status
const result = await client.runs.result(runId);
console.log(`Run status: ${result.status}`);
```

## 5. Marketplace and connector integration

### 5.1 Marketplace entry discovery and lifecycle state machine

```ts
// 1. Query unified catalog and install an entry
const store = await client.listStore();
const targetItem = store.items.find((item) => item.entry_name === "frontend-backend-experts");

if (targetItem && !targetItem.installed) {
  await client.installStoreEntry(targetItem.marketplace_id, targetItem.entry_name);
}

// 2. Advanced installation state machine with readiness polling and OAuth detection
const searchResults = await client.store.search("github", { kind: "connector" });
const outcome = await client.store.install(searchResults[0], { waitForReady: true });

if (!outcome.ok) {
  console.warn("Component installation failures:", outcome.components.filter((c) => !c.ok));
}
if (outcome.ready === false && outcome.readyIssue === "authorization_required") {
  console.log("Connector requires user authorization; proceed with OAuth flow");
}

// 3. Inspect installed entries and check for updates
const installedEntries = await client.store.installed();
const outdated = await client.store.checkUpdates();
for (const entry of outdated) {
  console.log(`Update strategy: ${client.store.updateHint(entry)}`); // Outputs "uninstall_reinstall"
}

// 4. Disable and uninstall entries cleanly
await client.store.setEnabled(searchResults[0], false); // Toggles catalog active flag
await client.store.uninstall(searchResults[0]);         // Purges runtime snapshot from disk
```

### 5.2 Dynamic marketplace source management

```ts
// 1. List configured marketplace sources
const marketplaces = await client.listMarketplaces();

// 2. Register a new remote marketplace source
const added = await client.addMarketplace({
  source_kind: "url",
  source: "https://example.com/custom-market.json",
});

// 3. Force re-synchronization of marketplace catalog definitions
await client.refreshMarketplace(added.marketplace_id);

// 4. Remove marketplace source (cascade: true removes unpinned snapshots registered from it)
await client.removeMarketplace(added.marketplace_id, /* cascade */ true);
```

### 5.3 Connector OAuth authorization workflow

```ts
const connectorId = "github";

// 1. Check current credential status; skip if already authenticated
const initialStatus = await client.connectors.authStatus(connectorId);

if (initialStatus.state !== "authenticated") {
  // 2. Trigger browser OAuth flow on host (returns immediately with started state)
  const startResult = await client.connectors.authStart(connectorId);
  if (startResult.state !== "started") {
    throw new Error(startResult.error ?? "Failed to launch browser OAuth window");
  }

  // 3. Await user completion in browser (defaults to 120s timeout budget)
  const authResult = await client.connectors.waitForAuth(connectorId);
  if (authResult.state === "error") {
    throw new Error(`OAuth authorization error: ${authResult.error}`);
  }
  if (authResult.state === "timeout") {
    throw new Error("User browser authorization timed out");
  }
}

// 4. Verify connector operational readiness (expected status: connected)
const health = await client.connectors.status(connectorId);
console.log(`Connector status: ${health.status}`);

// 5. Revoke tokens upon session teardown
await client.connectors.logout(connectorId);
```

### 5.4 Connector tool probes and dynamic execution

```ts
// 1. Test live connectivity and probe available tool signatures
const probe = await client.connectors.test("github");
if (!probe.success) {
  throw new Error(probe.error ?? "Connector probe failed");
}
if (probe.tools_truncated) {
  console.warn("Tool schemas were truncated by the host to respect payload size budgets");
}

// 2. Discover tool signatures and expected parameters
const targetTool = probe.tools?.find((tool) => tool.name === "create_issue");
console.log("Tool description:", targetTool?.description);
console.log("Input schema:", targetTool?.input_schema);

// 3. Invoke tool with typed payload
const invocation = await client.connectors.call("github", "create_issue", {
  owner: "flowy-org",
  repo: "agent-store",
  title: "SDK Cookbook synchronization",
});

if (invocation.is_error) {
  // Upstream rejections resolve normally; errors are encapsulated in the result payload
  console.error("Tool execution error:", invocation.result);
} else {
  console.log("Tool execution succeeded:", invocation.result);
}
```

## 6. Resource export and host controls

### 6.1 Workspace management and skill file inspection

```ts
// 1. Workspace lifecycle operations
const workspaces = await client.workspaces.list();
const newWorkspace = await client.workspaces.create("/abs/path/to/project");
await client.workspaces.revoke(newWorkspace.workspace_id); // Soft delete; active sessions retain access

// 2. Inspect skill files (governed by the host skill_files capability gate)
if (client.initializeInfo?.capabilities.skill_files) {
  const inventory = await client.skills.files("release-notes");
  for (const file of inventory.files) {
    console.log(`File: ${file.path}, size: ${file.size}, digest: ${file.digest}`);
  }

  // Read binary file content from skill directory and decode
  const fileBytes = await client.skills.readFile("release-notes", "references/guide.md");
  const content = new TextDecoder().decode(fileBytes);
  console.log("File content:", content);
}
```

### 6.2 Exporting experts and teams to local disk

```ts
import { exportTeam } from "@flowy-agent-store/sdk";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// Mode A: High-level exportTeam helper to materialize full teams and shared skill trees
const teamId = "frontend-backend-experts";
const exportResult = await exportTeam(client, teamId, "./exported-team");
console.log(`Materialized skills: ${exportResult.writtenSkills.length}`);
if (exportResult.danglingSkills.length > 0) {
  console.warn("Unresolved dangling skills:", exportResult.danglingSkills);
}

// Mode B: Assemble ExpertPack and write to disk manually
const pack = await client.agents.export("wb-architect");
const targetDir = "./exported-expert";
await mkdir(targetDir, { recursive: true });
await writeFile(join(targetDir, "expert-pack.json"), JSON.stringify(pack, null, 2));
await writeFile(join(targetDir, "persona.md"), pack.persona.instructions);

for (const skill of pack.skills) {
  const files = await client.skills.files(skill.id);
  for (const file of files.files) {
    const dest = join(targetDir, "skills", skill.name, file.path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, await client.skills.readFile(skill.id, file.path));
  }
}
```

### 6.3 Host tool policy pruning and control

Dynamic configuration of host tool policies via environment variables:

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

// Inject tool policy via AGENT_STORE_TOOLS to override host defaults
const harness = await launchHarness({
  client: { name: "sandboxed-client", version: "1.0.0" },
  env: {
    AGENT_STORE_TOOLS: JSON.stringify({
      web: true,       // Retain read-only web browsing and scraping
      computer: false, // Disable mouse and keyboard automation
      browser: false,  // Disable profile-based browser automation
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
  console.log(`Loaded items in sandboxed host: ${store.items.length}`);
} finally {
  await harness.close();
}
```

| Property | Rule and operational behavior |
| --- | --- |
| Value format | Valid JSON string conforming to the `[tools]` table structure in `config.toml` |
| Precedence | Environment variable **entirely replaces** the file `[tools]` section (no deep merge) |
| Fallback behavior | Malformed JSON triggers warning logs and automatically falls back to file configuration |
| Lifecycle scope | Evaluated once during host process bootstrap; `launchHarness` applies it to each run |

## 7. Production best practices and resilience

### 7.1 Structured error handling and exponential backoff retry

```ts
import { withRetry } from "@flowy-agent-store/client";
import { AppServerError, formatError, isRetryableError } from "@flowy-agent-store/protocol";

// Mode A: Automatic exponential backoff for idempotent operations via withRetry
const runDetails = await withRetry(() => client.runs.get("run-12345"), {
  maxAttempts: 4,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  onRetry: ({ attempt, delayMs, error }) => {
    console.warn(`Retry attempt ${attempt} in ${delayMs}ms due to: ${formatError(error)}`);
  },
});

// Mode B: Deterministic error dispatching via structured AppServerError error codes
try {
  await client.runs.result("run-12345");
} catch (error) {
  if (error instanceof AppServerError) {
    switch (error.code) {
      case "connector_unavailable":
        console.error("Connector offline or unauthenticated; prompt user to reconnect");
        break;
      case "agent_not_installed":
        console.error("Target expert not installed in local store");
        break;
      default:
        console.error(`Server error [${error.code}]:`, formatError(error));
    }
  } else if (isRetryableError(error)) {
    console.warn("Transient network error; retryable");
  } else {
    throw error;
  }
}
```

### 7.2 Production operational norms and essential gotchas

- **Data directory mutex locks**: A given `dataDir` enforces exclusive file locking; multiple concurrent processes cannot mount the same directory. Multi-instance testing requires distinct paths.
- **Asynchronous prompt acceptance**: `conversations.send` returning `accepted: true` denotes queued ingestion, not completed inference; streaming responses require event subscriptions or polling `is_processing`.
- **Marketplace background warming**: On cold starts, `store/list` does not block for archive unpacks; poll `markets_pending` until false when an empty catalog is received.
- **Initial connector state**: Newly imported connectors default to `disabled`; high-level `store.install` automatically handles enablement and connectivity verification.
- **Upgrade lifecycle conventions**: The system provides no in-place patching primitives; updates follow an uninstall-then-reinstall (`uninstall_reinstall`) workflow.
- **Skill disabling vs uninstallation**: Skills cannot be hot-unloaded at runtime; `store.setEnabled(item, false)` sets a catalog flag, while full removal requires `uninstall`.
- **Strict protocol version matching**: The host process and SDK enforce exact `protocol_version` equality; discrepancies cause immediate child process termination during bootstrap.
- **Temporary directory cleanup**: When using `launchHarness` without an explicit `dataDir`, always call `close()` within a `finally` block to prevent orphaned temporary directory buildup.

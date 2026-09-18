# TypeScript SDK cookbook

This page is the example companion to the [TypeScript SDK reference](/en-US/docs/typescript-sdk): types, the per-method table and the runtime contract live there, while everything here is code you can copy and run.

> How the three packages split: `@flowy-agent-store/protocol` is types and the error model only; `@flowy-agent-store/client` is the transport-agnostic `AppServerClient` plus its sub-clients; `@flowy-agent-store/sdk` adds `launchHarness` (spawn the binary, connect over loopback, handshake). **Live events and subscriptions only work over `WebSocketTransport`**; pure request-response can use `HttpTransport`.

## 1. Which package for which job

| Package | Use it when | Runtime |
| --- | --- | --- |
| `@flowy-agent-store/protocol` | You only need the types and the error model, or you implement a transport yourself | Anywhere (no runtime code) |
| `@flowy-agent-store/client` | You connect to an App Server that is **already running** (the desktop app, your own host) | Anywhere (Node or browser) |
| `@flowy-agent-store/sdk` | Your process **starts** the runtime itself | Node.js ≥ 22 or Bun |

## 2. Before you start

```bash
node -v                      # Node.js >= 22 (global WebSocket), or use Bun instead
bun add @flowy-agent-store/sdk   # or npm install / pnpm add

# The runtime binary: the SDK never downloads it — bin → AGENT_STORE_BIN → the runtime package's vendor/ → PATH
export AGENT_STORE_BIN=/opt/flowy-agent-store/flowy-agent-store
```

## 3. Node: one call to launch, one full lifecycle

The smallest useful call — spawn, loopback connect and handshake all happen inside it:

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({
  client: { name: "my-app", version: "0.1.0" },
});
const store = await harness.listStore();
await harness.close();
```

What `launchHarness` does:

1. Locates the `flowy-agent-store` binary via `bin` → `AGENT_STORE_BIN` → the platform runtime package's `vendor/` → `PATH`;
2. Spawns it with `--host 127.0.0.1 --port 0 --no-open` and an auto-created temp `--data-dir`;
3. Scans stdout for the readiness line (`{"agent_store":"listening",...}`) to learn the actual port;
4. **Validates the readiness `protocol_version` against the SDK** — on mismatch it kills the process and reports both versions;
5. Opens a loopback WebSocket and performs the `initialize` → `initialized` handshake, returning a ready `AppServerClient`.

> The full option semantics (`token` / `capabilities` / `requestTimeoutMs`, plus `SpawnOptions`) and the failure/cleanup contract are in the [reference](/en-US/docs/typescript-sdk) §4; the sections below are copy-paste recipes only.

### 3.1 Install an expert → run it once → read the result

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({ client: { name: "demo", version: "1.0.0" } });
try {
  // Catalog (Store)
  const items = await harness.listStore();
  console.log(`${items.items.length} items in the store`);

  // Install and run an agent
  await harness.installStoreEntry("experts", "frontend-backend-experts");
  const receipt = await harness.runs.agent({
    agentId: "frontend-backend-experts",
    goal: "Generate a todo REST API",
  });
  const result = await harness.runs.result(receipt.run_id);
  console.log(result.status);
} finally {
  await harness.close(); // terminate child + remove temp data-dir
}
```

### 3.2 Sessions + live events

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({ client: { name: "my-tool", version: "1.0.0" } });
try {
  const conversation = await harness.conversations.create({ name: "demo" });
  const subscription = await harness.conversations.follow(conversation.conversation_id);
  subscription.onEvent((event) => console.log(event.event_type));
  await harness.conversations.send(conversation.conversation_id, "hello", crypto.randomUUID());
} finally {
  await harness.close(); // terminate the child process + remove the temp data-dir
}
```

### 3.3 A fixed binary plus your own data-dir (CI / parallel instances / a reusable store)

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({
  bin: "/opt/flowy-agent-store/flowy-agent-store", // omitted ⇒ §2's four routes are searched
  dataDir: "/var/lib/my-app/agent-store",          // you own it ⇒ never deleted; the store survives across calls
  readyTimeoutMs: 180_000,                         // cold start builds the database
  requestTimeoutMs: 120_000,                       // the first store/list mirrors the whole market tree
  extraArgs: ["--agent-store-config", "/etc/my-app/agent-store.toml"], // point at another host config
  client: { name: "ci-smoke", version: "1.0.0" },
  onExit: (info) => console.error("runtime exited", info.code, info.signal),
});
try {
  const store = await harness.listStore();
  console.log(store.items.length, store.markets_pending);
} finally {
  await harness.close(); // your own directory is left in place
}
```

> The port defaults to `0` (OS-assigned), so you never need to set it; **parallel runs need distinct `dataDir`s** — one directory has a single-instance lock, and the second host fails fast.

### 3.4 A host behind a token, plus capabilities

```ts
const harness = await launchHarness({
  client: { name: "internal-ui", version: "2.0.0" },
  // required when the host runs with --auth; optional in local mode (server.readiness.auth === "disabled-local")
  token: process.env.AGENT_STORE_TOKEN ?? "",
  // declare what you will consume: events / approvals / team_runtime / artifacts
  capabilities: { events: true, approvals: true, team_runtime: true, artifacts: false },
});
console.log(harness.server.readiness.url, harness.handshake.protocol_version);
```

### 3.5 Catching a failed launch

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

try {
  const harness = await launchHarness({ client: { name: "my-app", version: "1.0.0" } });
  // … use harness normally (the business surface hangs off the returned object)
} catch (error) {
  // All three launch failures surface here, and the message is actionable:
  // 1) binary not found      → "cannot find the flowy-agent-store runtime binary: …" (names all four routes)
  // 2) readiness timeout / early exit → "timed out after …ms waiting for the runtime readiness line"
  // 3) protocol mismatch     → "protocol version mismatch: runtime speaks X, SDK expects Y"
  console.error(String(error));
}
```

The SDK cleans up after itself on every failure path: `child.kill()`, a 2-second grace period, then `SIGKILL`, plus removal of an auto-created data-dir; the child's last 50 stderr lines are attached to the error. A crash **after** readiness does not take that path — observe it through `harness.server.exited` / `onExit`, and note the SDK never restarts the child.

### 3.6 Process only, no client: `spawnAppServer`

```ts
import { spawnAppServer } from "@flowy-agent-store/sdk";
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const server = await spawnAppServer({ dataDir: "/var/lib/my-app/agent-store" });
try {
  const url = `ws://${server.readiness.host}:${server.readiness.port}/api/app-server/ws`;
  const client = new AppServerClient({
    transport: new WebSocketTransport(url),
    client: { name: "my-app", version: "1.0.0" },
  });
  await client.connect();
  // … or swap in an HttpTransport, or your own transport
} finally {
  await server.close();
}
```

> These recipes all go through `launchHarness` / `spawnAppServer`: without `dataDir` a temporary directory is created and removed on `close()`; to reuse one store across calls (conversations and installed components survive), pass `dataDir` explicitly — see §12.

## 4. Browser: connect to an already-running server

The browser spawns nothing; it only opens a WebSocket. `WebSocketTransport` appends `token` as a `?token=` query parameter (browser WebSockets cannot set custom headers).

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const transport = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", { token });
const client = new AppServerClient({ transport, client: { name: "web", version: "1.0.0" } });
await client.connect();
```

> A host in local trusted mode (readiness line `auth: "disabled-local"`) needs no token. Pure request-response can also use `HttpTransport` — see §13.

## 5. Electron: spawn in the main process, connect from the renderer

The main process owns the binary and the data dir; the renderer receives only the loopback URL and (optionally) a token. Credentials belong in the main process' OS credential store — never in the renderer or in plaintext config.

**Electron: spawn in the main process, connect over loopback in the renderer** (keep credentials in the main process, never the renderer):

```ts
import { spawnAppServer } from "@flowy-agent-store/sdk";

const server = await spawnAppServer({ dataDir: app.getPath("userData") });
win.webContents.send("app-server-ready", {
  url: `ws://${server.readiness.host}:${server.readiness.port}/api/app-server/ws`,
});
app.on("before-quit", () => void server.close());
```

> **Full Electron integration (main / preload / renderer)**
>
> The snippet above is the minimal skeleton. In a real Electron app, keep "runtime launch and credentials" in the main process; the renderer only receives the loopback URL (and an optional token). Credentials (OAuth tokens, system keychain) must never reach the renderer or be written to plaintext config.

**Main process `main.ts`** — spawn the runtime, hand the connection info to the renderer over IPC, and clean up on quit:

```ts
import { app, BrowserWindow, ipcMain } from "electron";
import { spawnAppServer, type SpawnedServer } from "@flowy-agent-store/sdk";
import { join } from "node:path";

let server: SpawnedServer | null = null;

async function startBackend() {
  server = await spawnAppServer({
    dataDir: join(app.getPath("userData"), "agent-store"),
  });

  // Loopback WS URL (under loopback, auth is usually disabled-local, no token needed)
  const wsUrl = `ws://${server.readiness.host}:${server.readiness.port}/api/app-server/ws`;
  const token = server.readiness.auth === "disabled-local" ? undefined : await getHostToken();

  // The renderer pulls it on demand
  ipcMain.handle("agent-store:get-connection", () => ({ url: wsUrl, token }));

  // Crash visibility: log unexpected exits (the SDK does not auto-restart)
  server.exited.then((info) => {
    console.warn("agent-store runtime exited:", info.code, info.signal);
  });
}

app.whenReady().then(startBackend);

app.on("before-quit", async (event) => {
  if (server) {
    event.preventDefault(); // wait for cleanup before exiting
    await server.close();
    server = null;
  }
  app.exit();
});
```

> `getHostToken()` is implemented by the host itself — only needed when the server requires a token (i.e. not `disabled-local`); the token is generated/obtained in the main process and never written to renderer-accessible plaintext.

**Preload `preload.ts`** — safely expose to the renderer via `contextBridge` (don't expose the whole `ipcRenderer`):

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("agentStore", {
  getConnection: () => ipcRenderer.invoke("agent-store:get-connection"),
});
```

**Renderer `renderer.ts`** — build `AppServerClient` and handshake once the URL arrives:

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const { url, token } = await window.agentStore.getConnection();
const transport = new WebSocketTransport(url, { token, requestTimeoutMs: 30_000 });
const client = new AppServerClient({ transport, client: { name: "electron-ui", version: "1.0.0" } });
await client.connect();

// All sub-clients are now usable
const catalog = await client.connectors.list();
```

> The renderer's `WebSocketTransport` `token` option is appended automatically as a `?token=` query parameter (browser / Electron WebSockets cannot set custom headers). For pure request-response use `HttpTransport`.

## 6. Store: browse → install → ready → uninstall

The flat top-level methods are fine for one-off scripts:

```ts
// List the unified catalog across all marketplaces (may be empty on first call; see markets_pending in the reference §3.3)
const store = await client.listStore();
for (const item of store.items) {
  console.log(item.marketplace_id, item.entry_name, item.kind, item.installed);
}

// One-click install: import if missing + register
const receipt = await client.installStoreEntry("experts", "frontend-backend-experts");
console.log("installed:", receipt.installed);

// Marketplace source management
const markets = await client.listMarketplaces();
const added = await client.addMarketplace({ source_kind: "url", source: "https://example.com/market.json" });
await client.refreshMarketplace(added.marketplace_id);
await client.removeMarketplace(added.marketplace_id, /* cascade */ true);
```

The `client.store` sub-client orchestrates those same wire methods into a state machine (`search → install → … → uninstall`) and waits for readiness by default:

```ts
// Find the entry you want (the kind filter is optional)
const items = await client.store.search("frontend", { kind: "agent" });

const outcome = await client.store.install(items[0]); // waitForReady: true by default
if (!outcome.ok) console.warn("components failed:", outcome.components.filter((c) => !c.ok));
if (outcome.ready === false) {
  // A connector that needs authorization returns immediately instead of burning the readiness budget
  if (outcome.readyIssue === "authorization_required") {
    await client.connectors.authStart(outcome.readyComponentId!);
  } else {
    console.warn("not ready:", outcome.readyIssue);
  }
}

// Installed inventory and version hints (there is no "update" verb)
const installed = await client.store.installed();
const behind = await client.store.checkUpdates();
if (behind.length > 0) console.log(client.store.updateHint(behind[0])); // "uninstall_reinstall"

await client.store.setEnabled(items[0], false); // skills only flip a catalogue marker, see below
await client.store.uninstall(items[0]);         // actually releases the runtime artifacts
```

Facts verified against the runtime:

- A skill is usable as soon as it is copied; a connector is registered **disabled** by the installer's documented default, so the readiness check enables it and then probes.
- A readiness timeout **does not lose the install result**: you get a successful install plus `ready: false` / `readyIssue: "ready_timeout"`.
- There is no update verb: `checkUpdates()` / `updateHint()` only tell you to uninstall and install again.
- Uninstall is **re-entrant**: an artifact that is already gone counts as success; on partial failure those components stay installed with `ok: false` and are named individually.
- `setEnabled(item, false)` only flips a catalogue marker for a skill and returns `code: "skill_disable_flag_only"` — only `uninstall` takes a skill out of the runtime.

## 7. Sessions and Runs

### 7.1 Session: create → send → receive in real time

```ts
import { decodeConversationEvent } from "@flowy-agent-store/protocol";

const conv = await client.conversations.create({ name: "demo" });
const sub = await client.conversations.follow(conv.conversation_id);
sub.onEvent((event) => {
  const decoded = decodeConversationEvent(event);
  if (decoded.kind === "message.delta") render(decoded.delta, decoded.replace);
});
sub.onBackfill((snapshot) => resetTranscript(snapshot.messages));
sub.onError((error) => report(error));

const receipt = await client.conversations.send(
  conv.conversation_id,
  "write me a REST API",
  crypto.randomUUID(), // explicit idempotency key is required
);
```

### 7.2 Mount a Skill for one turn (`fp-3`)

The Skill applies to that turn only; the conversation's create-time snapshot is untouched.

```ts
const skills = await client.skills.list();
const releaseNotes = skills.find((skill) => skill.name === "release-notes");

await client.conversations.send(conv.conversation_id, "ship it following this Skill", crypto.randomUUID(), {
  mentions: [{ kind: "skill", id: releaseNotes!.id }],
});
// The same turn may also carry image attachments (absolute paths inside the workspace):
// { attachments: ["/abs/path/inside/workspace.png"] }
```

> `mentions` honours `skill` only: experts and connectors have no carrier on `conversation/send` (an expert is the conversation's identity, a connector is a host-level switch), so sending them answers `invalid_request` — they are **not** silently ignored.

### 7.3 Open a conversation as an expert (`fp-4`)

An expert's identity is decided at **creation** and cannot be rewritten afterwards.

```ts
const experts = await client.agents.list();
const architect = experts.find((agent) => agent.name === "software-architect");

const expertChat = await client.conversations.create({
  name: "refactor discussion",
  agentId: architect!.id, // not installed answers agent_not_installed
});
// `send` works as usual: every turn runs under that expert's identity, Skills and Connector fence.
await client.conversations.send(expertChat.conversation_id, "start with the module boundaries", crypto.randomUUID());
```

> Switching experts means **creating another conversation** — `conversation/update` refuses preset / Skill / connector keys. That is deliberate: the conversation's preset snapshot is frozen, otherwise two consecutive turns of one conversation would be two different people.

### 7.4 Open a team's Leader conversation (`fp-5`)

The same orchestration `team/run` runs, minus the first turn it would otherwise send for you.

```ts
const teams = await client.teams.list();
const leader = await client.conversations.create({ teamId: teams[0].id });

// Your first message is the Leader's first turn: that is where it calls nomi_delegate.
await client.conversations.send(leader.conversation_id, "break this release into a plan", crypto.randomUUID());
```

> To hand over a goal and get a `run_id` back, keep using `client.runs.team({ teamId, goal })`; `create({ teamId })` is the **continuable** Leader conversation. `teamId` and `agentId` are mutually exclusive. **Do not pass `name` together with `teamId`** — the server names the Leader "<team> (leader)", so yours has no effect.

### 7.5 Several conversations in one host

`create()` has no cap: **any number of conversations can coexist inside one host (one `dataDir`)** — a single `launchHarness` from §3 is enough, and you neither need nor can start a second host per conversation. The snippet below reuses the `client` from above (the same host) and does four things:

1. **Side by side**: three plain conversations at once, each with its own `conversation_id`;
2. **One connection for all**: a single WS connection `follow()`s all three, with events routed by `conversation_id`;
3. **Concurrent turns**: two conversations each run a turn at the same time, without blocking each other;
4. **Enumerate and continue**: `conversations.list()` returns every conversation in this host.

```ts
// ① Side by side: three plain conversations (for an expert / team Leader, pass agentId /
//    teamId to create — see §7.3 / §7.4)
const explain = await client.conversations.create({ name: "explain the error" });
const review = await client.conversations.create({ name: "review branch A" });
const notes = await client.conversations.create({ name: "write the release notes" });
const chats = [explain, review, notes];

// ② One WS connection follows all of them: the server keeps a per-connection subscription
//    set, so events are routed by conversation_id
for (const view of chats) {
  const sub = await client.conversations.follow(view.conversation_id);
  // Routing is exactly this line: the closure remembers which conversation it is, so
  // three conversations on one socket never cross wires
  sub.onEvent((event) => render(view.conversation_id, event));
}

// ③ Concurrent turns: two conversations each run a turn at the same time
//    (the busy check is per conversation; there is no host-wide concurrency gate)
const receipts = await Promise.all([
  client.conversations.send(explain.conversation_id, "explain this error", crypto.randomUUID()),
  client.conversations.send(review.conversation_id, "review branch A's changes", crypto.randomUUID()),
]);
// The receipt means accepted, not finished (§14): both turns stream in the background,
// so the terminal state comes from the events in ②
console.log(receipts.map((r) => ({ accepted: r.accepted, completed: r.completed })));

// ④ Enumerate and continue: list defaults to 100, all of it this host's conversations
for (const view of await client.conversations.list()) {
  console.log(view.conversation_id, view.name, view.is_processing);
}
```

> The busy check (`conflict`) is **per conversation**: two conversations can each run a turn at once, while one conversation cannot run two. Real **process-level** isolation is not "more conversations" but several `dataDir`s (one directory holds a single-instance lock — see §14).

> This snippet deliberately uses **plain conversations only**: an expert and a team Leader both have to be **installed first** (otherwise creation fails with `agent_not_installed`, and a team additionally needs every Connector it binds to be available or you get `connector_unavailable`), which would make the example break on a machine that has not installed them. Conversations of all three identities **can coexist**; the multi-conversation mechanics do not change — the identity forms are in §7.3 / §7.4.

### 7.6 Run: start → await result → handle approval

```ts
const run = await client.runs.agent({
  agentId: "frontend-backend-experts",
  goal: "Generate a todo REST API",
});
const result = await client.runs.result(run.run_id); // only succeeds once terminal
console.log(result.status);

// If the Agent needs a human decision, follow live events and answer
const sub = await client.runs.follow(run.run_id);
sub.onEvent((event) => {
  if (event.event_type !== "approval.requested") return;
  client.runs.answerDecision({
    runId: run.run_id,
    stepId: event.step_id!,
    attemptId: event.attempt_id!,
    answer: "approve, continue",
    expectedExecutionVersion: event.expected_execution_version!,
    expectedStepVersion: event.expected_step_version!,
    expectedAttemptVersion: event.expected_attempt_version!,
  });
});
```

> The three `expected*Version` fields of `answerDecision` are required CAS tokens; any change returns `conflict` (see the [reference](/en-US/docs/typescript-sdk) §5.4). Write operations with an `idempotency_key` can be safely replayed.

## 8. Connector OAuth end-to-end

The typical path: `list` to get a `connectorId` → `authStart` to open the browser flow → poll `authStatus` until `authenticated` → `logout` to revoke when you are done.

```ts
// 1) Get the connectorId from the catalog
const catalog = await client.connectors.list();
const github = catalog.find((c) => c.id === "github");
if (!github) throw new Error("github connector not found in catalog");

// 2) Check auth state first: skip authorization if already authenticated
const before = await client.connectors.authStatus(github.id);
if (before.state !== "authenticated") {
  // 3) Start the host browser OAuth flow (returns immediately with started, non-blocking)
  const started = await client.connectors.authStart(github.id);
  if (started.state !== "started") {
    throw new Error(started.error ?? "auth start failed");
  }

  // 4) Poll until authenticated (or timeout / reauthorization required)
  const deadline = Date.now() + 5 * 60_000; // 5 minute grace period
  let authenticated = false;
  while (Date.now() < deadline) {
    const status = await client.connectors.authStatus(github.id);
    if (status.state === "authenticated") { authenticated = true; break; }
    if (status.state === "reauthorization_required") {
      throw new Error("reauthorization required");
    }
    await new Promise((r) => setTimeout(r, 1_500)); // 1.5s interval
  }
  if (!authenticated) throw new Error("oauth timed out");
}

// 5) After auth the connector status should be connected (auth ready + last probe succeeded)
const status = await client.connectors.status(github.id);
console.log(status.status);

// 6) Revoke the token when done
await client.connectors.logout(github.id);
```

> `authStart` only returns `started` and **never returns an auth URL or token** — the browser flow is owned by the trusted host, and the client only triggers and polls (see the [reference](/en-US/docs/typescript-sdk) §3.4). stdio connectors do not support OAuth; the server returns `OAuth is not supported for stdio connectors`.

### 8.1 Calling a tool: read the signature first

Every tool returned by `connector/get` and `connector/test` carries `input_schema` — the upstream `tools/list` `inputSchema`, **verbatim** — so there is nothing to guess:

```ts
// 1) Probe: really connects (spawns a child for stdio) and persists the result,
//    which is what get() reads back afterwards
const probe = await client.connectors.test(github.id);
if (!probe.success) throw new Error(probe.error ?? "probe failed");
if (probe.tools_truncated) {
  // Names and descriptions are never omitted; only schemas are, and whole.
  console.warn("host omitted some schemas to stay inside its size budget");
}

// 2) Pick a tool and read what it takes
const tool = probe.tools?.find((t) => t.name === "create_issue");
console.log(tool?.description, tool?.input_schema);

// 3) Call it with arguments that match
const call = await client.connectors.call(github.id, "create_issue", {
  owner: "acme",
  repo: "site",
  title: "flush the docs",
});
if (call.is_error) {
  // Wrong arguments / the server itself refused: the promise still resolves and
  // the complaint is in the result object.
  console.error(call.result);
}
```

> **Arguments are not validated client-side**: `input_schema` is arbitrary JSON Schema and the client only hands it to you. A wrong argument comes back as `is_error: true` with the server's own complaint — **not** as a rejected promise; only "we never reached the tool" rejects. `policy_denied` means the host never turned the proxy on, or this pair was narrowed out by `allow` / explicitly denied — no longer "you forgot to maintain an allowlist".

## 9. Catalogue one-liners: agents / teams / skills / models / workspaces

```ts
const agents = await client.agents.list();          // AgentSummary[]
const one = await client.agents.get(agents[0].id);  // AgentDetail: declared skills / connectors
console.log(one.name, one.skills, one.preset_id);   // preset_id exists only after install/*

const teams = await client.teams.list();            // TeamSummary[]
const team = await client.teams.get(teams[0].id);   // TeamDetail: members + bindable connectors

const skills = await client.skills.list();          // SkillSummary[]
console.log(skills.filter((s) => s.writable).map((s) => s.name)); // user skills you may edit

const models = await client.models.list();          // ModelSummary[]: what this host can run

const workspaces = await client.workspaces.list();  // WorkspaceView[]
const created = await client.workspaces.create("/abs/path/to/project"); // canonicalized server-side
await client.workspaces.revoke(created.workspace_id); // soft delete; existing sessions survive
```

**Reading every file a Skill ships** (a Skill is a directory: alongside `SKILL.md` it carries
`references/`, `scripts/` and friends; `skills.get()`'s body summary is truncated at ~1200
chars, so companion files are only reachable this way):

```ts
if (client.initializeInfo?.capabilities.skill_files) {   // a host may wire the catalog without this
  const inventory = await client.skills.files("release-notes");
  for (const file of inventory.files) {
    console.log(file.path, file.size, file.digest);
  }
  console.log("tree digest:", inventory.content_digest); // that skill directory, not the snapshot
  if (inventory.truncated) console.warn("inventory incomplete");

  const bytes = await client.skills.readFile("release-notes", "references/guide.md");
  console.log(new TextDecoder().decode(bytes));
}
```

## 10. Controlling the tool surface: `AGENT_STORE_TOOLS`

A host's tool surface comes from the `[tools]` table of `~/.agent-store/config.toml`. When you **spawn the host yourself** you do not have to edit that file — pass the `AGENT_STORE_TOOLS` environment variable as JSON and `launchHarness` merges it into the child environment:

```ts
const harness = await launchHarness({
  client: { name: "basic-only", version: "1.0.0" },
  env: {
    AGENT_STORE_TOOLS: JSON.stringify({
      web: true,       // web search / page reading stays on as basic assistance
      computer: false, // desktop control (keyboard / mouse / UIA)
      browser: false,  // browser automation, which uses the operator's profiles and logins
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
```

| Fact | Behaviour |
| --- | --- |
| Value | JSON with the same shape as the `[tools]` table; `{}` means "everything on" |
| Precedence | The environment variable **replaces** the file's `[tools]` wholesale, it does not merge |
| Scope | Only hosts that adopt `[tools]` (`apps/agent-store`); the desktop and web hosts do not |
| Unparseable | Warns and falls back to the file; **an empty value means "unset"** (not "deny everything") |
| When it applies | Read once at host startup; `launchHarness` always spawns a fresh process, so it always applies |

> While the variable is set, the file's `[tools]` is ignored — including values the host itself wrote from its settings UI. For the full field list and the traps, see `docs/agent-store/20-tool-injection-policy.zh.md` in the repository.

## 11. Errors and retry

The four error classes plus `isRetryableError` / `formatError` come from `@flowy-agent-store/protocol`, and `withRetry` backs off exponentially on the stable `retryable` flag:

```ts
import { withRetry } from "@flowy-agent-store/client";

const view = await withRetry(() => client.runs.get(runId), {
  maxAttempts: 4,
  onRetry: ({ attempt, delayMs }) => log(`retry ${attempt} in ${delayMs}ms`),
});
```

When branching on an error, **branch on the stable `code` only — never parse the message**:

```ts
import { AppServerError, formatError, isRetryableError } from "@flowy-agent-store/protocol";

try {
  await client.runs.result(runId);
} catch (error) {
  if (error instanceof AppServerError && error.code === "connector_unavailable") {
    await enableConnector(); // a stable code is the only branchable contract
  } else if (isRetryableError(error)) {
    // Hand it back to withRetry, or back off yourself
  }
  console.error(formatError(error)); // the single human-readable rendering
}
```

Write operations carrying an `idempotency_key` / `command_id` can be safely replayed: the server de-duplicates on that key and never executes twice.

## 12. Using it in CI and tests

```ts
const harness = await launchHarness({
  bin: process.env.AGENT_STORE_BIN, // a prebuilt binary; omit to search the four routes
  dataDir: process.env.CI_DATA_DIR, // your own dir → never removed; omit for a temp dir that close() removes
  readyTimeoutMs: 180_000,          // cold start creates the database
  requestTimeoutMs: 120_000,        // the first store/list triggers the market mirror download
  client: { name: "ci-smoke", version: "1.0.0" },
  onExit: (info) => console.error("runtime exited", info.code, info.signal),
});
try {
  const store = await harness.listStore();
  // A cold store may be empty: markets_pending === true means the builtin markets are still registering
  if (store.items.length === 0) console.warn("store still warming:", store.markets_pending);
} finally {
  await harness.close();
}
```

- Binary resolution is `bin` → `AGENT_STORE_BIN` → the platform runtime package's `vendor/` → `PATH`; **it never downloads**, so pin a prebuilt artifact in CI.
- One `dataDir` takes a **single-instance lock**: parallel tests need separate directories or the second host fails fast.
- A cold first `store/list` triggers the market mirror download (about 90 seconds on a fresh data dir), so widen `requestTimeoutMs`; an empty catalogue is **not an error**.
- A crashed child is **never restarted**: observe it via `server.exited` / `onExit`, and guarantee `close()` with `try/finally` (or your test framework's `afterAll`).

## 13. Rolling your own transport: WebSocket or HTTP

```ts
import { AppServerClient, HttpTransport, WebSocketTransport, httpRouteTable } from "@flowy-agent-store/client";

// Live events and subscriptions: WebSocket only
const ws = new WebSocketTransport("ws://127.0.0.1:8787/api/app-server/ws", { token });
const live = new AppServerClient({ transport: ws, client: { name: "ui", version: "1.0.0" } });
await live.connect();
const sub = await live.conversations.follow(conversationId); // only a WS-bound transport can subscribe

// Pure request-response: HTTP is enough (a handshake per call; connect() is a no-op)
const http = new HttpTransport({ baseUrl: "http://127.0.0.1:8787" });
const plain = new AppServerClient({ transport: http, client: { name: "cli", version: "1.0.0" } });
await plain.connect();
await plain.listStore();

// 23 methods have no HTTP binding: calling one throws TransportError; the route table is the source of truth
console.log(Object.keys(httpRouteTable()).length);
```

| | `WebSocketTransport` | `HttpTransport` |
| --- | --- | --- |
| Live events and subscriptions (`follow`, `onNotification`) | Yes | **No** (`notify()` throws, `onNotification()` returns an empty subscription) |
| Connection style | One long-lived connection, one handshake | A handshake per call |
| Good for | UIs, long sessions, Run events | Scripts, CI, one-off queries |

## 14. Traps (verified against the runtime)

- **Temporary data-dir**: without `dataDir`, every `launchHarness` creates a temp directory and `close()` removes it; a hard-killed process leaves the directory behind.
- **Single-instance lock**: one data-dir cannot host two runtimes at once.
- **A `send()` receipt means accepted, not finished**: `accepted: true` only says the message is on disk, and `completed: false` is the normal case — that turn still has work to stream. Take the terminal state from `follow()` events, or read `is_processing` from `conversation/get`; the §7 example that throws several conversations' turns into one `Promise.all` leans on exactly that asynchrony.
- **The first `store/list` is slow**: the default 30s request timeout may not be enough, and an empty catalogue can mean `markets_pending: true` (still registering) — **not an error**.
- **A freshly installed connector is disabled**: `store.install` enables it and probes; the flat `installStoreEntry` leaves that to you (`enableInstall`).
- **No update verb**: `checkUpdates()` / `updateHint()` → `uninstall_reinstall`.
- **Disabling a skill is only a catalogue marker**: `store.setEnabled(item, false)` returns `code: "skill_disable_flag_only"` for a skill; only `uninstall` removes it from the runtime.
- **Protocol fingerprint**: when the readiness line's `protocol_version` differs from the SDK's, the SDK kills the child and throws — it is a contract fingerprint, **not a version number and not a date** (the shape is now an `fp-<n>` counter; earlier values were date stamps, and that date was only a label — never the day of the change or of a release).
- **No binary downloads**: `bin` → `AGENT_STORE_BIN` → the platform runtime package's `vendor/` → `PATH`, and a miss is an error.
- **Live events are best-effort**: they can drop or arrive out of order; durability comes from `run/events` cursor replay, and `rearm()` replays the whole history (de-duplicate by `sequence` yourself).

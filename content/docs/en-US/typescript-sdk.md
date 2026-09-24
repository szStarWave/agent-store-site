# TypeScript SDK reference

Flowy Agent Store ships three companion TypeScript packages that let Node.js / Electron / browser applications talk to a local App Server in a type-safe way:

| Package | Responsibility | Runtime | Depends on |
| --- | --- | --- | --- |
| `@flowy-agent-store/protocol` | Wire types (requests/responses/notifications/errors) | Any — zero runtime, no DOM/Node | — |
| `@flowy-agent-store/client` | `AppServerClient` + 9 sub-clients + `Transport` abstraction | Any — no HTTP, no DOM, no Node | `@flowy-agent-store/protocol` |
| `@flowy-agent-store/sdk` | Spawn the `flowy-agent-store` binary → loopback WebSocket → ready client | Node.js (`node:child_process`, …) | `@flowy-agent-store/client`, `@flowy-agent-store/protocol` |

Mix and match: **types only** → `protocol`; **connect to an already-running App Server** (e.g. a desktop app) → `client` with your own `WebSocketTransport`; **launch the whole runtime yourself** → `launchHarness` from `sdk`.

Runnable, copy-pasteable examples (Node / browser / Electron / Store / sessions / Runs) live in the [TypeScript SDK cookbook](/en-US/docs/examples-sdk).

> **This page is for developers.** End users do not need it — grab the installer and follow [Quick start](/en-US/docs/quick-start). Two distinct paths: **end users → installer / `install.ps1`**; **developers → npm packages (this page)**.

---

## 1. Install

```bash
# Usually the sdk alone is enough (it re-exports client capabilities and spawns)
bun add @flowy-agent-store/sdk        # or npm install / pnpm add

# Declare protocol explicitly when you import wire types
bun add @flowy-agent-store/protocol
```

All packages ship ESM + CJS (`exports` maps `import` / `require` / `types`); they work out of the box in Node and bundlers.

> **Version status**: all three packages are `0.1.0-beta.*` pre-releases (the API is not frozen, and **no backward compatibility is promised during beta**). Pin an **exact** version in production — this page and the repo currently correspond to `0.1.0-beta.7` (the `beta` tag). Do not rely on a bare `bun add`: the registry's `latest` currently points at `0.1.0-beta.2`, **not** the newest `0.1.0-beta.7`. For dist-tag semantics, per-version upgrade steps and self-check commands see the [Upgrade and migration guide](/en-US/docs/upgrade).
> **Protocol surface scope**: the `APP_SERVER_PROTOCOL_VERSION` example in §2 and the method counts in §5.3 (`51 / 76`) are taken from the **working tree**, which currently **matches the published artifacts** (since `0.1.0-beta.7`; earlier versions led them, and that batch shipped with this release — it is recorded in §8 of the [Upgrade and migration guide](/en-US/docs/upgrade), together with the self-check commands). The fingerprint is compared for **strict equality** (a client built against an old value cannot connect to a new runtime), so when you build your own binary or touch the protocol, read the constant in §2 rather than copying a value out of this page's prose.
> **Runtime**: Node.js **≥ 22** (relies on the global `WebSocket`) or Bun; the lower bound is declared by each package's `engines.node`.

---

## 2. `@flowy-agent-store/protocol` — the wire layer

### 2.1 Position

The single TypeScript source of truth for the wire contract: every request/response/notification type, the `APP_SERVER_PROTOCOL_VERSION` constant, and structured errors. **No transport and no I/O** — the only executable code is a handful of pure functions (error predicates and formatters, event decoding, localized text), so anything speaking the protocol can consume it.

### 2.2 Main exports

| Export | Meaning |
| --- | --- |
| `APP_SERVER_PROTOCOL_VERSION` | A contract **fingerprint** (**currently** `"fp-9"` in the working tree; the shape is an `fp-<n>` counter, incremented on each wire change and never reusing a past value. It was once a date stamp, but that is a *label, not the day of the change* — consecutive changes advanced it a day each, so it ran ahead of the calendar); the handshake and SDK checks compare it for strict equality |
| `InitializeRequest` / `InitializeResult` | Handshake request/response (incl. `protocol_version`, server info) |
| `ClientInfo` / `ClientCapabilities` | Caller self-description |
| `StoreList` / `StoreInstallResult` | Winget-style unified catalog |
| `AgentSummary` / `AgentDetail` | AgentDefinition catalog views |
| `TeamSummary` / `TeamDetail` | AgentTeamDefinition catalog views |
| `SkillSummary` / `SkillDetail` | Skill catalog views |
| `ConnectorSummary` / `ConnectorDetail` / `ConnectorStatusView` / `ConnectorProbeResult` | Connector catalog / status / probe |
| `OAuthStartResult` / `OAuthStatusView` | OAuth browser-flow state |
| `ConversationView` / `ConversationMessage` / `ConversationEvent` / `ConversationSendReceipt` | Persistent conversations |
| `RunReceipt` / `RunView` / `RunResult` / `RunEvent` | Run lifecycle |
| `JsonRpcRequest` / `JsonRpcResponse` / `JsonRpcNotification` | Wire frame types |
| `ServerNotification` | Server notifications (`event`, `conversation/event`, `conversation/list-changed`, `run/resync-required`, …) |
| `WireError` | Server error payload |

> There is **exactly one** protocol surface (`16` §7 decision 4): before a release there is no separate stable and experimental export set, and no `experimental` marker exists in the source. Full Team collaboration (`TeamRunInput` / `TeamSummary` / `TeamDetail`, …) and event cursor catch-up live on that same surface.

### 2.3 Error model (`errors.ts`)

**Branch on the stable `code`, never parse the human-readable message:**

| Class | Trigger | Key fields |
| --- | --- | --- |
| `AppServerError` | Server returned a JSON-RPC error | `code`, `requestId` (wire: `request_id`), `retryable`, `details` |
| `TransportError` | Transport layer (connect/send/close) | `phase` (`connect`/`send`/`receive`/`close`), `retryable` |
| `ProtocolError` | Local protocol validation failed | `kind` (`invalid_message` / `version_mismatch` / `unexpected_response`) |
| `RequestTimeoutError` | Request timed out | `method`, `timeoutMs` |

Helpers:

```ts
import { isAppServerError, isRetryableTransportError, formatError } from "@flowy-agent-store/protocol";

try {
  await client.runs.agent({ agentId, goal });
} catch (error) {
  if (isAppServerError(error)) {
    // stable code (e.g. version_mismatch / marketplace_not_found) — not the message
    console.log(error.code, error.retryable);
  } else if (isRetryableTransportError(error)) {
    // connection dropped, safe to retry
  }
  console.log(formatError(error)); // the one shared UI rendering
}
```

> Idempotency conflicts and policy denials are **never auto-retried** (`retryable: false`) — replaying them stacks side effects.

---

## 3. `@flowy-agent-store/client` — the transport-agnostic client

### 3.1 Position

Pure business layer: every method goes through the injected `Transport`. No HTTP, no DOM, no Node in the package. The connection lifecycle (`connect → initialize → version check → initialized → ready`) lives here, so business code never knows whether the channel is WebSocket, stdio, or a future one-shot HTTP binding.

### 3.2 The `Transport` interface

```ts
export interface Transport {
  connect(): Promise<void>;                          // open the channel (idempotent)
  request<T>(method: string, params: unknown): Promise<T>;  // request-response
  notify(method: string, params: unknown): void;     // fire-and-forget
  onNotification(listener: NotificationListener): () => void; // subscribe; returns unsubscribe
  close(): void;
  onLifecycle?(listener: (state: "open" | "closed") => void): () => void; // optional channel lifecycle
}
```

Built-in `WebSocketTransport` (browser + Node 22+/Bun, uses the global `WebSocket`):

```ts
import { AppServerClient, WebSocketTransport } from "@flowy-agent-store/client";

const transport = new WebSocketTransport(
  "ws://127.0.0.1:8787/api/app-server/ws",
  { requestTimeoutMs: 30_000, connectTimeoutMs: 10_000, token: "optional-bearer" } // token becomes ?token= in browsers
);
const client = new AppServerClient({ transport, client: { name: "my-app", version: "0.1.0" } });
await client.connect(); // initialize handshake + version check
```

`WebSocketTransport` implementation contract (A2 / T8):

- **`connect()` is idempotent and concurrency-safe**: concurrent calls share one dial (no second socket is opened); after `connectTimeoutMs` (default 10s) without opening it rejects `TransportError(phase: "connect", retryable: true)` and closes that socket.
- **`close()` is terminal cleanup**: it settles every pending request and any in-flight `connect()` (`TransportError(phase: "close")`) and clears the listeners registered through `onNotification`. So **after closing, a new `connect()` must re-register its listeners** (`AppServerClient` re-arms its notification bridge automatically; custom transports must do it themselves).
- **Stale-connection isolation**: events arriving late from a replaced or closed socket are ignored and never touch the current connection.
- **No auto-reconnect**: a dropped connection only fails pending requests with `TransportError(retryable: true)`; the reconnect policy belongs to the caller.
- **Reconnect is observable (T8)**: `onLifecycle` reports `open` after every successful dial, and `closed` only when an **established** connection is lost (a failed first dial is not a disconnect, and neither is a caller-initiated `close()`). `closed → open` is one reconnect. These listeners **survive `close()`** — they exist to drive the reconnection.
- **After a reconnect you must re-handshake and re-subscribe**: a new socket means the server-side subscriptions and the local `onNotification` listeners are gone, so the flow is `transport onLifecycle("open")` → `client.connect()` (re-runs the `initialize` handshake) → `rearm()` every live subscription.

Bring your own transport by implementing the interface: an in-memory fake for tests, stdio for CLIs, Node WebSocket in Electron main — business code does not change.

### 3.3 `AppServerClient` top-level methods

| Method | Wire method | Meaning |
| --- | --- | --- |
| `connect()` | `initialize` + `initialized` | Handshake; after success `ready === true`. Version mismatch throws `ProtocolError(version_mismatch)` |
| `close()` | — | Close the transport; the server revokes the connection immediately |
| `onNotification(listener)` | — | Global notification subscription (returns unsubscribe) |
| `ready` / `initializeInfo` | — | Whether ready / handshake result |
| `runImport(input)` · `listImports()` · `getImport(snapshotId)` | `import/*` | Import local CodeBuddy/WorkBuddy dirs |
| `runInstall(input)` · `getInstallStatus(snapshotId)` | `install/run` / `install/status` | Snapshot install |
| `disableInstall(snapshotId, ids)` · `enableInstall(...)` · `uninstallInstall(...)` | `install/*` | Component enable/disable/uninstall |
| `addMarketplace(input)` · `listMarketplaces()` · `getMarketplace(id)` | `market/*` | Marketplace source management |
| `removeMarketplace(id, cascade)` | `market/remove` | `cascade=true` uninstalls snapshots installed from it |
| `setMarketplaceAutoUpdate(id, enabled)` | `market/auto-update` | Auto-update toggle (DB flag) |
| `refreshMarketplace(id)` | `market/refresh` | Re-fetch source, rebuild entries when revision changed |
| `importMarketplaceEntry(mkt, entry)` | `market/entry-import` | Import one entry (provenance-linked) |
| `listStore()` | `store/list` | Unified catalog across marketplaces (with install state) |
| `installStoreEntry(mkt, entry)` | `store/install-entry` | One-click install: import (if missing) + register |

> ℹ️ **The first `listStore()` may come back empty or partial — by design, not an error**: the built-in default marketplaces register in the **background** (D-SDK-1 ①). The first `store/list` only kicks that off and then answers from whatever is registered *right now*; it never waits for the mirror.
> Registration runs **in the background** and `store/list` does not wait for it. Since `fp-7` the built-in default markets are **one `zip` archive per market** (a single request; it replaced the old per-file whole-tree mirror — measured at 14,714 requests / 611 MiB), so on a fresh data dir the first call returns `items: 0` almost **immediately** with `markets_pending: true` (§3.3), and the same call returns the catalogue once registration completes.
> Measured (2026-09-10, fresh local data dir): `first store/list: 1ms items=0` → after 130s `store/list: 133ms items=438`, `market/list count=3`.
> So **you do not need a larger `requestTimeoutMs` for the first call**; re-list after the warm-up for the full catalog (the WebUI has an explicit refresh). If a mirror is unreachable, that warm-up counts as incomplete and the next store/market call retries automatically.
> To tell "no markets at all" from "still loading": `listStore()` (that is, `store/list`) now returns `markets_pending` — `true` means the builtin markets are still registering in the background and the catalog may be incomplete.
> If you own a fixed `dataDir`, later calls on it short-circuit idempotently and do no network I/O.

### 3.4 Sub-clients

All constructed on the same transport; every method returns `Promise<T>`.

#### `agents` — AgentDefinition catalog

```ts
client.agents.list(): Promise<AgentSummary[]>;
client.agents.get(agentId: string): Promise<AgentDetail>;
client.agents.export(agentId: string): Promise<ExpertPack>;
```

#### `teams` — AgentTeamDefinition catalog

```ts
client.teams.list(): Promise<TeamSummary[]>;
client.teams.get(teamId: string): Promise<TeamDetail>;
client.teams.export(teamId: string, teamVersion?: string): Promise<ExpertPack>;
```

#### `skills` — catalog / file tree

```ts
client.skills.list(): Promise<SkillSummary[]>;
client.skills.get(skillId: string): Promise<SkillDetail>;
client.skills.files(skillId: string): Promise<SkillFileList>;          // inventory + directory digest
client.skills.readFile(skillId: string, path: string): Promise<Uint8Array>; // WebSocket binding, base64 decoded for you
client.skills.readFileWithType(skillId: string, path: string): Promise<SkillFileContent>;
```

> A Skill is a **directory**, not a single document: alongside `SKILL.md` it ships `references/` / `scripts/` / `templates/` / `assets/`. `skills.get()`'s `instructions_summary` is a **bounded summary** (~1200 chars, truncated), so companion files are only reachable through these three methods. Check `capabilities.skill_files` first — a host may wire the catalog without the file face, in which case they answer `unsupported_operation`. `path` accepts only a skill-relative path (absolute paths, `..`, drive letters and backslashes are refused), and a single file is capped at 2 MiB. `SkillFileList.content_digest` is the digest of **that skill directory**, and is **not** the snapshot's `content_digest` (which covers the whole imported source tree) — do not compare it against `import/get`.

#### `connectors` — catalog / status / OAuth

```ts
client.connectors.list(): Promise<ConnectorSummary[]>;
client.connectors.get(connectorId: string): Promise<ConnectorDetail>;        // namespaced tools + auth state
client.connectors.status(connectorId: string): Promise<ConnectorStatusView>; // connected only when auth ready AND last probe OK
client.connectors.test(connectorId: string): Promise<ConnectorProbeResult>;  // run probe (really connects; result persisted); tool schemas come from here
client.connectors.authStatus(connectorId: string): Promise<OAuthStatusView>; // the reason lives in `error`; `state` never becomes "failed"
client.connectors.authStart(connectorId: string): Promise<OAuthStartResult>; // start the host browser OAuth flow; only confirms the browser was opened
client.connectors.waitForAuth(connectorId: string, options?: { timeoutMs?, pollMs? }): Promise<WaitForAuthOutcome>; // wait for the end, and bring back the reason
client.connectors.logout(connectorId: string): Promise<void>;                // revoke token
client.connectors.call(connectorId: string, tool: string, args?: unknown): Promise<ConnectorCallResult>; // call proxy
client.connectors.credentials(connectorId: string): Promise<ConnectorCredential>;      // the form a connector needs filled in (`fp-9`)
client.connectors.setCredentials(connectorId: string, values: Record<string, string>): Promise<ConnectorCredential>; // store, and get the new state back
client.connectors.clearCredentials(connectorId: string, keys?: string[]): Promise<ConnectorCredential>;              // `keys` omitted = every secret field
```

> **Connectors that need a key or token** (`fp-9`): `credentials(id)` returns a `credential` block —
> `mode` (`none` / `oauth` / `token`), `status` (`not_required` / `requires_input` / `configured` /
> `error`), `missing` (**key names only**) and `fields[]` (label / placeholder / description / where
> to get a key — both languages already resolved by the host). Write with
> `setCredentials(id, { KEY: "…" })`; forget with `clearCredentials(id)`, or with `keys` to clear a
> single field.
>
> **Values go in, never out**: a response **never** carries a secret's value — `fields[].value`
> appears only for `plain` fields (the connector's own settings, such as `HOST` / `PORT`). The form is
> the whole write surface: a key the connector's declaration does not name is refused. Credentials are
> stored **per caller** (`<principal>:NAME`), so `missing` / `status` are statements *about you* — the
> same connector can be `configured` for A and `requires_input` for B.

> `call()` runs one MCP tool through the **host's own connection**: the transport, its headers and its OAuth token stay on the host — you send a tool name and an argument object, and you **cannot** name a URL, a command or a header. Whether the pair is callable is the host's `[connector_proxy]` policy: once its operator turns the proxy on, the **enabled connectors are callable**, and `allow` / `deny` are that operator's optional narrowing and subtraction. So `policy_denied` means "the host never turned the proxy on" or "this pair was narrowed out or explicitly denied" — **not** "you forgot to maintain a list".
>
> **How to know the arguments**: every tool returned by `get()` / `test()` carries `input_schema` (the upstream `tools/list` `inputSchema`, verbatim). Arguments are arbitrary JSON Schema and the client does **not** validate them — a wrong argument comes back as `is_error: true` with the server's own complaint, not as a rejected promise. If the host omitted some schemas to stay inside its size budget it sets `tools_truncated: true` (names and descriptions are never omitted).
>
> **A tool-level failure is not a rejection**: when the server answers `isError: true` the promise still **resolves**, with `is_error` set. It rejects only when the call never reached the tool: `connector_call_timeout`, `connector_call_failed`, `response_too_large`, `connector_unavailable`, `policy_denied`, `not_found`. Check `capabilities.connector_calls` first (the method existing does **not** mean any tool is callable). The result object is passed through verbatim (`content`, `structuredContent`, … nothing dropped), capped at 1 MiB, default timeout 30s. All three connector transports are supported: stdio, Streamable HTTP and SSE.

> Tokens never pass through this package: the OAuth browser flow is owned by the trusted host; clients only trigger and wait. Failures have **two** channels, so do not read only one: a failure **before** the browser (endpoint discovery, client identity, binding the callback) comes back synchronously as `authStart`'s `state: "error"`; a failure **after** it (a refused token exchange, a callback timeout, an authorization server throttling with `slow_down`) appears in `authStatus().error` **only**, while `state` stays `not_authenticated` — the wire has no "failed" state. `waitForAuth(id)` is the loop over that second channel: `{state:"authenticated"}` / `{state:"error", error}` / `{state:"timeout"}`, a 120s budget by default (= the host's callback window), rejecting only when the status read itself fails.

#### `store` — store lifecycle (acquire / install / use / disable / uninstall)

```ts
client.store.list(): Promise<StoreItem[]>;
client.store.search(query: string, filter?: { kind?: StoreItemKind }): Promise<StoreItem[]>;
client.store.installed(): Promise<StoreItem[]>;
client.store.checkUpdates(): Promise<StoreItem[]>;                 // installed AND update_available
client.store.updateHint(item): "none" | "uninstall_reinstall" | "unknown";
client.store.install(item, opts?: { waitForReady?, timeoutMs?, signal? }): Promise<StoreOperationOutcome>;
client.store.setEnabled(item, enabled: boolean, opts?: { componentIds? }): Promise<StoreOperationOutcome>;
client.store.uninstall(item, opts?: { componentIds? }): Promise<StoreOperationOutcome>;
```

> It adds **no wire method**: it only composes the flat top-level methods into one state machine (`search → install → … → uninstall`). `install` defaults to `waitForReady: true` — a skill is usable once copied, a connector is not: it is registered `disabled` by documented default, so readiness enables it before probing. A readiness timeout **never discards the install** (you get the successful install plus `readyIssue: "ready_timeout"`); a connector needing authorization returns `authorization_required` immediately. Readiness polling does **not** probe on every round: it really connects on the first round (and then at most once per `readyProbeMs`, 5s by default) and reads the status in between — a probe resolves the stored token (refreshing it when near expiry, and again on a 401), so probing at the poll interval meant a dozen requests against the connector and its authorization server inside a 30s budget. `outcome.components` is the server's per-component detail (`action` / `ok` / a stable `code`) passed through **verbatim**; failures are never swallowed.

#### `conversations` — persistent conversations

```ts
client.conversations.create(input): Promise<ConversationView>;  // omit model → server resolves the default from config.toml
client.conversations.update(id, input): Promise<ConversationView>;
client.conversations.modelOptions(): Promise<ConversationModelOptions>;
client.conversations.list(limit = 100): Promise<ConversationView[]>;
client.conversations.get(id): Promise<ConversationView>;
client.conversations.messages(query): Promise<ConversationMessagesPage>; // page/page_size/cursor
client.conversations.send(id, content, idempotencyKey, options?): Promise<ConversationSendReceipt>; // explicit idempotency key required
client.conversations.cancel(id): Promise<ConversationView>;
client.conversations.delete(id): Promise<{ conversation_id: string; deleted: boolean }>;
await client.conversations.follow(id): Promise<ConversationSubscription>;
```

The fourth argument of `send()` describes **this one turn** (the legacy `string[]` attachment array is still accepted):

```ts
client.conversations.send(id, content, key, {
  attachments: ["/abs/path/inside/workspace.png"],   // absolute path inside the conversation workspace
  mentions: [{ kind: "skill", id: "release-notes" }], // a Skill mounted for this turn
});
```

> **`mentions` honours `kind: "skill"` only** (added in `fp-3`). A Skill is a **per-turn** payload: its instructions and immutable snapshot travel with that one turn, while the conversation's create-time snapshot is neither changed nor rewritable. `agent` and `connector` have **no carrier** on `send` (an expert is the conversation's identity, a connector is a host-level switch), so they are **refused with `invalid_request`** — explicitly, never silently not-mounted. `id` is the id `skill/list` publishes (the skill's name), not an `install/status` component id. Both fields stay off the wire when omitted.

`send()` can also **switch the conversation's model and reasoning level** (added in `fp-6`):

```ts
await client.conversations.send(id, content, key, {
  model: { provider_id: "opencode", model: "mimo-v2.5" }, // a config.toml provider name works too
  reasoningEffort: "high",                                 // low | medium | high | xhigh | max (the server currently accepts only the first four)
});
```

> **This is a conversation-level setting, not "this turn only"**: the value is written to the conversation row and takes effect **from this message onwards**, every later turn included — the Nomi runtime is built from that row, which is exactly why "set it before sending" is what makes it apply to this turn. To revert, send the old value once more. `model` has the same shape and resolution as `create` / `update` (a registered provider UUID is used verbatim, a `config.toml` provider name is registered idempotently), and `reasoningEffort` shares their vocabulary. **A conversation running a turn refuses the switch** (`conflict`): changing the model tears the runtime down, which cannot happen mid-turn. The current level is **readable** from `ConversationView.reasoning_effort` via `conversation/get` (absent = unspecified) — three paths can write it, so the view has to report it. Calls without either field stay byte-identical to before; whether the level actually takes effect depends on the model's catalog declaration.

`create()` can also build a conversation **as a named expert** with `agentId` (added in `fp-4`):

```ts
const experts = await client.agents.list();
const architect = experts.find((agent) => agent.name === "software-architect");

const conv = await client.conversations.create({
  name: "refactor discussion",
  agentId: architect!.id,     // an `agent/list` id; not installed answers agent_not_installed
});
```

> An expert is the conversation's **identity**, decided once at creation: its preset snapshot, its own Skills and its Connectors are frozen into that conversation and cannot be rewritten afterwards (`conversation/update` refuses preset / Skill / connector keys). **Changing the expert means creating another conversation.** With `agentId` omitted this is the plain conversation it always was, byte for byte.

`create()` can also **open a team's Leader conversation** with `teamId` (added in `fp-5`):

```ts
const teams = await client.teams.list();
const company = teams.find((team) => team.name === "Software Company");

const leader = await client.conversations.create({ teamId: company!.id });
// Same orchestration as `team/run` (member checks, template materialization or reuse,
// conversation fences) but **without the goal turn**: you speak first, and
// `delegation_policy` is already `automatic`.
await client.conversations.send(leader.conversation_id, "break this release into a plan", crypto.randomUUID());
```

> `teamId` and `agentId` are **mutually exclusive** (sending both answers `invalid_request`): a conversation opens either as one expert or as one team's Leader. A member that is not installed, a member that is disabled, and a Connector the team binds but the host disabled are all refused **at creation** with their own stable codes (`agent_not_installed` / `agent_disabled` / `connector_unavailable`) — never a half-built Leader.

Every entry in `modelOptions()` carries `name` / `display_name` / `context_limit` and may additionally carry **models.dev catalog facts**: `cost_input` / `cost_output` (USD per million tokens), `catalog_context_window`, and `supports_vision`. When the registry has no entry for that provider+model the fields are **absent entirely** — read them as "unknown", never as `false` or `0`.

Live subscription object:

```ts
const sub = await client.conversations.follow(convId);
sub.onEvent((event) => console.log("seq", event.sequence, event)); // deduped by sequence
sub.onResync((reason) => console.log("resync required:", reason)); // catch-up hint after disconnects
sub.lastSequence; // highest sequence seen
await sub.rearm(); // after a reconnect: re-register + reset cursor + re-issue conversation/subscribe
await sub.close(); // server side unsubscribe (closing the socket also works)
```

> After `rearm()` you still have to backfill the outage window yourself: this subscription has no event-replay API, so re-fetch with `conversation/messages`. The reset cursor means later duplicates are the caller's to dedupe by `sequence`.

**One client can drive several conversations at once**: `create()` has no cap, and each conversation owns its `conversation_id`, its identity (expert / team) and its own event stream; `list(limit?)` enumerates them, and a single WS connection can `follow()` many at once (events are routed by `conversation_id`). The busy check (`conflict`) is **per conversation**, so two conversations run their own turns without blocking each other. **Process-level** isolation means several `dataDir`s, not more conversations (one directory holds a single-instance lock). A runnable example is in the [cookbook](/en-US/docs/examples-sdk) §7.

#### `runs` — run lifecycle and live events

```ts
client.runs.agent(input: AgentRunInput): Promise<RunReceipt>; // async receipt, not the final result
client.runs.team(input: TeamRunInput): Promise<TeamRunReceipt>; // team run: Leader conversation + planned delegation
client.runs.get(runId): Promise<RunView>;                     // authoritative state
client.runs.plan(runId): Promise<RunPlan>;                    // plan view (run/plan, also HTTP-bound)
client.runs.result(runId): Promise<RunResult>;                // resolves only at a terminal state
client.runs.events({ runId, afterSequence, limit }): Promise<RunEvent[]>; // cursor replay
client.runs.cancel({ runId, expectedVersion, commandId, idempotencyKey }): Promise<RunView>;
await client.runs.follow(runId): Promise<EventSubscription>;
```

`runs.agent()` can name the model and reasoning level **for that one run** (added in `fp-6`):

```ts
await client.runs.agent({
  agentId: architect!.id,
  goal: "turn this requirement into a plan",
  model: { provider_id: "opencode", model: "mimo-v2.5" },
  reasoningEffort: "high",
});
```

> The precedence is **explicit > the preset's own > the host default** (`default_model` in `~/.agent-store/config.toml`): passing `model` unconditionally beats whatever the preset binds. `reasoningEffort` applies to **every attempt** of that run. Omitting either field keeps the previous behaviour byte for byte.

```ts
const sub = await client.runs.follow(runId);
sub.onEvent((event) => console.log(event));       // best-effort events (lossy, unordered)
sub.onResync(({ run_ids, reason }) => …);         // subscription invalidated, replay required
sub.onError((error) => …);                        // transport errors forwarded
sub.lastSequence;
const replayed = await sub.rearm();               // after a reconnect: reset cursor + re-subscribe + replay all
await sub.close();
```

> `rearm()` **replays the whole history** (the cursor reset is deliberate), so consumers must dedupe by `sequence`; its return value is the replayed batch. Call it only after the reconnect handshake (`initialize`) has completed.

> Event delivery is best-effort: durability relies on `run/events` cursor replay, so Node consumers should dedupe and order themselves.

#### `workspaces` — workspace registration

```ts
client.workspaces.list(): Promise<WorkspaceView[]>;
client.workspaces.create(path: string): Promise<WorkspaceView>; // server canonicalizes, rejects links/reparse points
client.workspaces.revoke(workspaceId: string): Promise<WorkspaceRevokeResult>; // soft delete; conversations kept
```

---

## 4. `@flowy-agent-store/sdk` — the Node host

### 4.1 `launchHarness(options): Promise<Harness>`

One call does four things: locate and spawn the runtime → wait for the readiness line to learn the real port → connect over loopback → run the `initialize` / `initialized` handshake. **The object it returns *is* that client** — the business surface hangs off it directly, with no `.client` hop (doc `31` §5, option B).

```ts
interface HarnessOptions extends SpawnOptions {
  client: ClientInfo;             // { name, version }
  capabilities?: ClientCapabilities;
  token?: string;                 // handed to WebSocketTransport
  requestTimeoutMs?: number;      // default 30s (not enough for the first store/list — see the §3.3 warning)
}

interface Harness extends AppServerClient {
  server: SpawnedServer;          // readiness / dataDir / exited / close
  handshake: InitializeResult;    // this launch's handshake response (never null)
  close(): Promise<void>;         // unsubscribe → close transport → kill child → remove temp data-dir
}
```

The fields `HarnessOptions` adds itself (`SpawnOptions` fields are in §4.2):

| Field | Default | Meaning |
| --- | --- | --- |
| `client` | — | **Required**; identifies the caller in the handshake (server logs and audit) |
| `capabilities` | omitted | `{ events?, approvals?, team_runtime?, artifacts? }` — which capabilities the client will consume |
| `token` | omitted | Handed to `WebSocketTransport`; the WebSocket API cannot set headers, so it travels as `?token=…` on the loopback URL. Required when the host runs with `--auth`, optional in local mode (`auth: "disabled-local"`) |
| `requestTimeoutMs` | `30000` | **Per-request** timeout, unrelated to startup. **Do not** raise it for the first `store/list` — that call does not wait for market registration (§3.3); poll `markets_pending` if you need registration to finish |

What `Harness` carries:

| Member | Content | Use it for |
| --- | --- | --- |
| (inherited) `conversations` / `agents` / `teams` / `skills` / `connectors` / `models` / `workspaces` / `runs` / `store` | The whole `AppServerClient` business surface | Every business call goes **directly** on the harness: `harness.conversations.create(...)` |
| `handshake` | This launch's handshake response (**never null**) | Recording or asserting the protocol fingerprint |
| `initializeInfo` | The **current** connection state (nullable; `null` after `close()`) | Deciding whether the connection is still ready |
| `server.readiness` | The parsed readiness line: `{ host, port, url, protocol_version, version, auth }` | Logging; deciding from `auth` whether a `token` is required. ⚠️ `url` is the **site root** (`http://{host}:{port}/`), **not** the API root — a hand-rolled transport needs `ws://{host}:{port}/api/app-server/ws` (§13 of the examples page) |
| `server.dataDir` | The data-dir the child actually uses | Diagnosis and isolation assertions (an auto-created temp dir shows up here too) |
| `server.exited` | A `Promise<{ code, signal }>` that never rejects | Observing crashes and exits (contract in §4.4) |
| `close()` | Unsubscribe → close transport → kill child → remove an auto-created data-dir | Call it in `finally`; safe to repeat |

> **Breaking change vs the published `0.1.0-beta.5`**: the entry point is renamed to `launchHarness` (types `LaunchedClient` → `Harness`, `LaunchOptions` → `HarnessOptions`), the return value lost its `.client` hop, and `initializeResult` is now `handshake`. In other words `const session = await launchClient({…})` + `session.client.conversations.create(…)` becomes `const harness = await launchHarness({…})` + `harness.conversations.create(…)`. Item-by-item migration is in the [Upgrade and migration guide](/en-US/docs/upgrade) §6.5.

**What it does not do**: it does not configure models or providers (that is `config.toml` and the host's settings surface); it does not download the binary; without `dataDir` it does not persist anything (a one-shot sandbox); it does not restart the child or install process-exit hooks.

Copy-paste recipes (minimal call, your own data-dir, a token, failure handling, process-only) live in the [examples page](/en-US/docs/examples-sdk) §3.

### 4.2 Lower-level primitives

| Export | Meaning |
| --- | --- |
| `spawnAppServer(options: SpawnOptions)` | Spawn + wait for readiness only (no connect). `SpawnOptions` below |
| `resolveAppServerBin(explicit?)` | Locate the binary (§4.3) |
| `parseReadinessLine(line)` | Parse one line; `null` when not the readiness line |
| `ReadinessInfo` | `{ host, port, url, protocol_version, version, auth }` |
| `assertProtocolCompatible(runtimeVersion)` | Throws on mismatch (both versions in the message) |
| `SpawnExitInfo` | `{ code, signal }` — how the child exited (payload of `exited` / `onExit`) |

`SpawnOptions`:

```ts
interface SpawnOptions {
  bin?: string;            // explicit path (overrides everything)
  dataDir?: string;        // your own dir ⇒ you own it; omitted ⇒ temp dir removed on close
  port?: number;           // default 0 = OS-assigned
  extraArgs?: string[];    // extra CLI args appended after managed ones
  readyTimeoutMs?: number; // default 120s (cold DB init)
  env?: Record<string, string | undefined>; // merged over process.env
  cwd?: string;            // child working directory; omitted ⇒ inherits the parent's
  onExit?: (info: SpawnExitInfo) => void;   // called once when the child exits
}
```

`SpawnedServer.exited` is a `Promise<SpawnExitInfo>` that **never rejects**: it settles whenever the child ends, for any reason — the only entry point for observing a runtime crash.

### 4.3 Binary resolution

Order: the `bin` argument → the `AGENT_STORE_BIN` environment variable → the **platform runtime package** `@flowy-agent-store/runtime-<platform>-<arch>` (`vendor/flowy-agent-store[.exe]`; it is an optionalDependency of the SDK, so a normal install has it) → `flowy-agent-store` / `flowy-agent-store.exe` on `PATH`. When none of them hits it is a **hard error — never a download or a guess** (the message names all four routes; release-asset download is P2).

```bash
AGENT_STORE_BIN=/opt/flowy-agent-store/flowy-agent-store node your-app.mjs
```

### 4.4 Runtime contract (P0, verified)

- **Loopback enforced**: the child always runs `--host 127.0.0.1 --no-open`; the SDK only ever dials the process it spawned (`isLoopbackUrl` rejects anything else before connecting).
- **Data-dir exclusivity**: omit `dataDir` ⇒ auto `mkdtemp`, removed on `close()`; passing your own dir means you own it — the backend single-instance lock fails fast (`already in use by another running Flowy backend`).
- **Version check**: readiness `protocol_version` mismatch kills the child and reports both versions.
- **Readiness line**: a single stdout JSON line `{"agent_store":"listening","host":...,"port":...,"url":...,"protocol_version":...,"version":...,"auth":...}`; the SDK scans lines and ignores everything else (tracing shares stdout).
- **stdout kept drained**: once the readiness line is parsed the SDK keeps reading and discarding the child's stdout (`readline.close()` pauses that stream, so reading must not stop there). Otherwise the runtime blocks forever once its logs fill the OS pipe buffer (~64KB) — long sessions (multi-turn runs, market-tree scans) then hang silently. Post-readiness output is only drained and dropped; this release exposes no log callback.
- **`env` / `cwd` passthrough**: `env` is **merged over** the parent's `process.env` (not a replacement, so `PATH` etc. stay visible); omitting `cwd` inherits the parent working directory. Both go to `child_process.spawn` unchanged.
- **Exit is observable**: `SpawnedServer.exited` (`{ code, signal }`) settles whenever the child ends, for **any** reason including a crash or a non-zero code, and `onExit` fires once alongside it. The SDK **never restarts** the runtime; restarting belongs to the caller of `launchHarness`.

### 4.5 Errors and cleanup

- Spawn failure: the error appends the **last 50 stderr lines** (`stderr tail:` section).
- Timeout: after the default 120s it throws `timed out after ${timeoutMs}ms waiting for the runtime readiness line` (`timeoutMs` is `readyTimeoutMs`).
- Every failure path runs `child.kill()` → 2s grace → `SIGKILL`, and removes the auto-created data dir.
- After readiness the promise is already settled: a later `exit` / `error` from the child no longer takes the failure path (it is not reported as a startup failure); such exits (crashes included) surface only through `SpawnedServer.exited` and `onExit`. The SDK never restarts the runtime, and lifetime is owned by the caller via `close()`.
- Correct usage: `close()` in a `try/finally`; without it the temp dir leaks on process exit (no exit hook installed).

```ts
const harness = await launchHarness({ client: { name: "x", version: "1" } });
try {
  await harness.connectors.list();
} finally {
  await harness.close();
}
```

---

## 5. Per-method API reference

How the three packages' real exports line up with the protocol methods. Method names follow `05`; this table introduces no new ones.

### 5.1 `AppServerClient` top-level methods

| Method | Params | Returns | Protocol method |
| --- | --- | --- | --- |
| `connect()` | — | `InitializeResult` | `initialize` → `initialized` |
| `onNotification(listener)` | `(notification) => void` | unsubscribe | — (server notifications) |
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

### 5.2 Sub-clients

| Sub-client | Methods | Protocol methods |
| --- | --- | --- |
| `agents` | `list()` / `get(agentId)` / `export(agentId)` | `agent/list` / `agent/get` / `agent/export` |
| `teams` | `list()` / `get(teamId)` / `export(teamId, teamVersion?)` | `team/list` / `team/get` / `team/export` |
| `skills` | `list()` / `get(skillId)` / `files(skillId)` / `readFile(skillId, path)` / `readFileWithType(skillId, path)` | `skill/list` / `skill/get` / `skill/files` / `skill/file` |
| `connectors` | `list()` / `get(id)` / `status(id)` / `test(id)` / `authStatus(id)` / `authStart(id)` / `waitForAuth(id, opts?)` / `logout(id)` / `call(id, tool, args?)` | `connector/list` · `get` · `status` · `test` · `auth/status` · `auth/start` · `auth/logout` · `call` |
| `store` | `list()` / `search(query, filter?)` / `installed()` / `checkUpdates()` / `updateHint(item)` / `install(item, opts?)` / `setEnabled(item, enabled, opts?)` / `uninstall(item, opts?)` | composed methods, no wire method of their own: `store/list` · `store/install-entry` · `install/run` · `install/status` · `install/disable` · `install/enable` · `install/uninstall` |
| `conversations` | `create(input)` / `update(id, input)` / `modelOptions()` / `list(limit?)` / `get(id)` / `messages(query)` / `send(id, content, idempotencyKey, options?)` / `cancel(id)` / `delete(id)` / `follow(id, options?)` | the same-named `conversation/*` methods |
| `runs` | `agent(input)` / `team(input)` / `get(id)` / `plan(id)` / `result(id)` / `events(query)` / `cancel(input)` / `steer(input)` / `answerDecision(input)` / `follow(id, options?)` | `agent/run` · `team/run` · `run/get` · `run/plan` · `run/result` · `run/events` · `run/cancel` · `run/steer` · `run/answer-decision` |
| `workspaces` | `list()` / `create(path)` / `revoke(id)` | `workspace/list` / `workspace/create` / `workspace/revoke` |
| `models` | `list()` | `models/list` |

### 5.3 HTTP binding

HTTP and WebSocket are two bindings of one method semantics. `httpRouteTable()` returns the **machine-readable route table** (method → verb + path + provenance), so this guide does not hand-copy it:

```ts
import { httpRouteTable } from "@flowy-agent-store/client";

const routes = httpRouteTable();
// { "market/remove": { verb: "POST", path: "/markets/:marketplace_id/remove", source: "…" }, … }
```

- Covers **51 / 76** methods. The 25 outside the route table: `initialize`, `initialized`, `workspace/create`, `conversation/model-options`, `conversation/update`, `conversation/subscribe`, `conversation/unsubscribe`, `run/subscribe`, `run/unsubscribe`, `agent/list`, `agent/get`, `team/list`, `team/get`, `agent/export`, `team/export`, `config/get`, `config/set`, `skill/create`, `skill/update`, `skill/delete`, `skill/copy`, `config/get-mcp`, `config/set-mcp`, `config/set-mcp-enabled`, `skill/file`.
  - Those 25 methods do **not** mean the server has no HTTP route for them: `initialize` / `initialized` do have one (`POST /api/app-server/initialize`, `/initialized` — the HTTP transport's handshake goes through them), they are simply not business methods; `skill/file` has one too (`GET /api/app-server/skills/{skill_id}/files/{path}`), but it answers with **raw bytes plus a `content-type`** rather than a JSON envelope, so it is likewise absent from the JSON transport's route table — use `client.skills.readFile()` (WebSocket, base64) or `fetch` the route directly.
- `config/get` / `config/set` (the host settings file `~/.agent-store/config.toml`) are **host management surface** (`16` §6): wire methods with no HTTP binding, and deliberately **not part of this package's client** — the Web UI calls them through its own transport helpers. Contract in `05` §4.10.
- `config/get-mcp` / `config/set-mcp` / `config/set-mcp-enabled` (the MCP declaration file `~/.agent-store/mcp.json`) are host management surface by the same `16` §6 judgement: wire-only, no HTTP binding, and not in this package. The write face is **fail-closed** (an unparseable file, or an entry the parser rejects, leaves the file byte-identical) and the toggle is a **text-level minimal edit** (only that entry's `enabled` value moves; comments and indentation survive). Note that `config/get-mcp` is the **only** read that returns the file's own text (for the host's own editor, on demand, inside the loopback + owner gate); every other read (`config/get.mcp`) still carries no `env` / `headers` values. Contract in `05` §4.10.
- `skill/create` / `skill/update` / `skill/delete` / `skill/copy` (the skill write face, `16` R17 / W12) are host management surface by the same `16` §6 judgement: a third-party consumer must not be able to write files into the host's skill tree, so they are wire-only, have no HTTP binding, and are not in this package. `skill/update` is a **field-level patch** (only the named fields move; `name` is not editable) and `skill/copy` derives a writable user skill from any origin. The read face's `SkillSummary` gains `origin` / `writable` (additive); contract in `05` §4.11.
- **`HttpTransport` is the request/response binding and is not equivalent to WebSocket**: `notify()` throws and `onNotification()` returns a no-op unsubscribe. Live events and subscriptions require `WebSocketTransport`.
- Every call performs its own handshake (`initialize` → `initialized` → business call), so `connect()` is a no-op. Host-side code that needs a ready connection id calls `openConnection()`.
- `/api/fs/*` (browse / list / read / metadata) is a host file service, not a protocol method, and is not part of this package.

### 5.4 Answering approvals: `run/answer-decision`

A run stops when it needs a human decision: `run/events` projects `approval.requested`, and the answer goes through `runs.answerDecision(input)`:

```ts
const pending = (await client.runs.events({ runId })).find(
  (event) => event.event_type === "approval.requested",
);

await client.runs.answerDecision({
  runId,
  stepId: pending.step_id!,                    // attempt scope, projected on the event
  attemptId: pending.attempt_id!,
  answer: "Approved, continue",
  expectedExecutionVersion: pending.expected_execution_version!,  // the three CAS versions
  expectedStepVersion: pending.expected_step_version!,
  expectedAttemptVersion: pending.expected_attempt_version!,
});
```

- **The three `expected*Version` values are mandatory CAS tokens**, not an optional nicety: the server passes them straight to the engine's single answer gate, and any one of them having moved returns `conflict` instead of silently overwriting. `run/events` projects the current three onto every unanswered `approval.requested` (read from the authoritative rows at projection time), so a client echoes them rather than inventing versions.
- **Only a `waiting_input` attempt can be answered**; a foreign owner, a stale version, a non-waiting attempt, or an empty answer are all refused (`NotFound` / `Conflict` / `BadRequest`).
- **There is no `always_allow`**: the desktop confirmation route's approve-all switch is not part of this protocol. The params are `deny_unknown_fields`, so sending it fails with `invalid_request`.
- `RunEvent.step_id` / `attempt_id` are present only when the engine scoped the event to an attempt (typically `approval.requested` / `approval.responded`).

## 6. Event reference: `sequence` and catch-up

### 6.1 Event types

`ConversationEventType` is a **closed union** (`protocol.ts`) with 9 members:

| Event type | Meaning | Decoded kind |
| --- | --- | --- |
| `message.created` | A message was persisted | `message.created` |
| `message.delta` | Body increment (`replace` swaps wholesale) | `message.delta` |
| `message.thinking` | Thinking increment | `message.thinking` |
| `message.tips` | Tip row (`tip_type`) | `message.tips` |
| `message.tool` | Tool call (streams running → completed) | `message.tool` |
| `message.error` | Terminal error (decoded with `code` and `retryable`) | `message.error` |
| `message.activity` | Activity row (`kind` drives rendering; carries this turn's token usage when `kind === "turn_completed"`) | `message.activity` |
| `turn.status` | Turn busy/idle (`status === "running"`) | `turn.status` |
| `context.usage` | Context usage | `context.usage` |

The server spells "thinking" two ways: `message.thinking`, and `message.activity` with `kind === "thinking"`. `decodeConversationEvent` **normalises** the latter into `message.thinking`, so callers keep one thinking path. Unknown types land in `unknown` (raw `event_type` preserved) rather than being misread as a known one.

A `message.activity` frame whose `kind === "turn_completed"` also carries **this turn's** token usage (`usage: { input_tokens, output_tokens, total_tokens }`, the runtime's per-turn report). The field decodes to `null` when the runtime reported nothing, only one side, or two zeros — **"unknown" is not "free"**, so callers must not substitute context occupancy or a zero. Per-turn usage arrives only on the live stream (the server does not persist past turns), and the field names are snake_case, matching the Run-side `TurnUsage`.

`message.error` decodes `code` (the server's error code) and `retryable` alongside the message text. `retryable` is **three-valued**: `true`, `false`, or `null` — `null` means the wire did not supply it (history rows, commonly), and callers must not guess it into `false` or `true`. Re-reading the send receipt also exposes `result_error_retryable`, which agrees with it.

### 6.2 `sequence` semantics

- `sequence` is a **per-conversation, monotonic and contiguous** counter, not a global ordinal. The server keeps it **per connection**, bucketed by conversation (source comment: `Notification sequence is connection-local`), so **a reconnect starts the numbering over** — the durable record is `conversation/messages`, not this counter.
- Unsubscribing destroys that counter; resubscribing starts at `1`, which is why `rearm()` resets the local cursor to `0`.
- Gap detection: `sequence > lastSeen + 1` while `lastSeen > 0` means loss — the subscription emits `onResync("gap")` and triggers catch-up.
- Duplicates and out-of-order frames (`sequence <= lastSeen`) are dropped and never re-delivered.
- **List-projection notifications are not part of that counter**: `conversation/list-changed` (the conversation list's `created` / `updated` / `deleted`; auto-titling arrives as `updated`) **carries no `sequence`**, so it must never advance `lastSeen` or take part in the gap check above. It is a best-effort hint — losing one only delays a refresh, while `conversation/list` stays authoritative.

### 6.3 Catch-up

Conversations and runs catch up through different carriers:

| Case | Server signal | Catch-up mechanism | Package entry point |
| --- | --- | --- | --- |
| Conversation | `conversation/resync-required` | re-fetch `conversation/messages` (V1 has no conversation event replay) | `follow(..., { fetchMessages })` → `onBackfill` |
| Run | `run/resync-required` | replay `run/events` with `after_sequence` | `follow()` auto-resyncs; manual replay is **`resync()` only** (`catchUp()` is *not* a catch-up — it marks persisted events as seen **without dispatching**, and `follow()` calls it once when it subscribes) |

Conversation subscriptions auto-catch-up by default (`autoResync`) and run at most one fetch at a time (bursts coalesce); the fetched page is handed to `onBackfill`. If your layer owns the pagination cursor, pass `autoResync: false` and listen only to `onResync`, then reload authoritatively yourself.

On a `client` that has already `connect()`ed (full setup in the [TypeScript SDK cookbook](/en-US/docs/examples-sdk)):

```ts
const subscription = await client.conversations.follow(conversationId);
subscription.onEvent((event) => {
  const decoded = decodeConversationEvent(event);
  if (decoded.kind === "message.delta") render(decoded.delta, decoded.replace);
});
subscription.onBackfill((snapshot) => resetTranscript(snapshot.messages));
subscription.onError((error) => report(error));
```

## 7. Error model and retry

All four error classes are exported from `@flowy-agent-store/protocol`; `retryable` is the stable contract (never branch on `message`):

| Class | Raised when | `retryable` |
| --- | --- | --- |
| `AppServerError` | the server returned a business error; carries `code` / `requestId` / `details` | per the server hint |
| `TransportError` | connect / send / receive / close failed; carries `phase` | decided by `phase` and the caller |
| `ProtocolError` | malformed message, version mismatch, unexpected response; carries `kind` | no |
| `RequestTimeoutError` | request timed out; carries `method` / `timeoutMs` | no |

`isRetryableError(error)` is the single retry predicate; `formatError(error)` is the single human-readable rendering. `withRetry(operation, options)` backs off exponentially (with jitter) on `retryable`:

| Option | Default | Meaning |
| --- | --- | --- |
| `maxAttempts` | `3` | total attempts including the first |
| `baseDelayMs` | `500` | first backoff |
| `maxDelayMs` | `8000` | ceiling for one delay |
| `jitter` | `0.25` | jitter fraction; delay lands in `[0.75×, 1.0×]` |
| `onRetry` | — | called before each retry with `{ attempt, delayMs, error }` |
| `shouldRetry` | protocol `retryable` | custom predicate |
| `sleep` | `setTimeout` | injectable (tests) |

For a runnable `withRetry` example see the [TypeScript SDK cookbook](/en-US/docs/examples-sdk) §11.

Writes carrying an `idempotency_key` / `command_id` replay safely: the App Server deduplicates same-key requests instead of executing twice.

## 8. MCP integration guide

The official MCP path for Agent Store is the **connector descriptor**, with no second format introduced:

| Case | Where it is declared |
| --- | --- |
| Connector market entry | an entry in `.codebuddy-connector/connectors.json` |
| MCP servers shipped by a plugin | the plugin manifest's `mcpServers` field |

Remote HTTP/SSE and local stdio servers are both described verbatim in the manifest; Agent Store only hosts them and proxies tools under a namespace — it never executes connector content. Credentials:

- Mark sensitive config entries in the `userConfig` schema; values go to the OS credential store.
- Do not put secrets in `env` as **plain values**: the importer rewrites the **values** of `env` / `headers` entries whose **key names** contain `api` / `token` / `secret` / `password` / `apikey` into `secret:<KEY>` references, and the real value is resolved from `[credentials]` (or the process environment) into memory only when the host starts the child process — never into a snapshot, the database or a log. Copying a source plugin's secret lines is therefore safe; a plaintext value under **any other key name** is not covered — use an explicit `secret:` reference or `userConfig` for credentials.

More manifest fields and examples: [Plugins and market](/en-US/docs/plugins-market).

## 9. Next steps


- Full method semantics: repo `docs/agent-store/05-flowy-agent-store-app-server-protocol.md`.
- Implementation and test samples: `web/packages/{protocol,client,sdk}/src` (the sdk has `spawn.test.ts`, `readiness.test.ts`).
- Browser-only helpers (asset `<img>` URLs, `/api/fs/browse`): implemented by the host app, not in these three packages.
- Runnable examples: [TypeScript SDK cookbook](/en-US/docs/examples-sdk).

---

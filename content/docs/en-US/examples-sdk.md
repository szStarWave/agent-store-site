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
const unsubscribe = subscription.onEvent((rawEvent) => {
  const event = decodeConversationEvent(rawEvent);
  if (event.kind === "message.thinking") {
    process.stderr.write(`[Thinking] ${event.thinking}\n`);
  } else if (event.kind === "message.delta") {
    process.stdout.write(event.delta);
  }
});
subscription.onError((error) => console.error("Streaming error:", error));

try {
  // 2. Send message turn
  await client.conversations.send(
    conversationId,
    "Evaluate trade-offs of single-binary architectures and output an outline",
    crypto.randomUUID(),
  );
} finally {
  // 3. Production cleanup: unsubscribe callbacks and close subscription channel
  // unsubscribe(); // Deregisters event callback
  // subscription.close(); // Closes streaming channel and frees WebSocket resources
}
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
  expertId: architect.id,
});
await client.conversations.send(expertChat.conversation_id, "Design microkernel extension architecture", crypto.randomUUID());
```

### 3.2 Expert team collaborative conversations

Binding an expert team delegates orchestration to the Team Leader to dispatch subtasks across specialist members:

```ts
// 1. Query configured expert teams
const teams = await client.teams.list();
const teamChat = await client.conversations.create({
  teamId: teams[0].id, // teamId and expertId are strictly mutually exclusive
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

### 4.2 Category filtering and localized tag rendering (since fp-15)

The category dictionaries and tag metadata that market sources ship are now exposed over the wire: `store/categories` returns each enabled market's category dictionary plus its market-level tag vocabulary. Every item carries `category_id` (the raw reference from the source manifest) and the host-resolved `category` (omitted when the dictionary misses the id). Localized text is an optional `{zh, en}` pair; read the field for the current language:

```ts
// 1. Fetch the category dictionary and tag vocabulary (filter-bar material;
//    empty items means the market declares no dictionary, which is not an error)
const { items: categories, marketplace_tags } = await client.store.categories();
const activeCategory = categories.find((c) => c.id === "04-DataAI");
console.log(`Category: ${activeCategory?.name.en} / ${activeCategory?.name.zh}`);
console.log("Market tags:", marketplace_tags?.map((t) => t.en ?? t.zh));

// 2. Filter items by category (the host joins the dictionary, so one client-side filter suffices)
const catalog = await client.store.list();
const dataAiExperts = catalog.filter((item) => item.category?.id === "04-DataAI");

// 3. Render item tag chips (skill / connector entries take tags from the market index row;
//    legacy names are merged in and deduplicated)
for (const item of dataAiExperts) {
  const tags = (item.tags ?? []).map((tag) => tag.en ?? tag.zh ?? "");
  console.log(`${item.name} [${item.category?.name.en ?? item.category_id ?? "Uncategorized"}]: ${tags.join(" · ")}`);
}

// 4. Search covers tags and category names (the haystack includes tags and category.name)
const hits = await client.store.search("Collaboration");
```

| Field | Meaning | Absence means |
| --- | --- | --- |
| `item.category_id` | Raw category reference from the source manifest (e.g. `04-DataAI`) | The item's source manifest declares no category |
| `item.category` | Full host-joined category (with localized `name`) | The dictionary misses the id (the host performs no inference); only the raw id remains |
| `item.tags` | Localized tag array (`{zh, en}` position-paired) | Empty array or omitted = no tags |
| `marketplace_tags` | Market-level tag vocabulary (returned with `store/categories`) | No enabled market declares a vocabulary |

> **Where the dictionary comes from**: the market's own declaration wins (a `manifest.json` at the market root); when no market declares one, the host fills in its built-in vocabulary (the same 15 category ids as the WorkBuddy catalog index), so this endpoint is rarely empty. The two are never merged — the market's declaration is authoritative, so one id can never carry two names. Category ids and an item's `plugin.json` `categoryId` share one vocabulary.

### 4.3 Connector tool probes and dynamic invocation

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

### 4.4 Connector credential forms and private service registration

> `credential/get|set`, `get` and `call` accept only the `mcp_server_id` (UUID), never the server name: resolve `.id` from `connectors.list()` by name, then pass it to all three. To keep the credential surface in focus, the snippets below omit that step.

```ts
// 1. Inspect required credential schema
const credForm = await client.connectors.credentials("weather-service");

if (credForm.missing.length > 0) {
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

### 4.5 End-to-end connector OAuth authorization flow

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

### 4.6 Dynamic marketplace source management

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

### 4.7 Bring-your-own-token connectors: GitHub / Baidu Netdisk

Marketplace entries use the same credential form as 4.4: when a market's `connectors.json` declares an entry as `auth_mode: "token"`, the installed connector provides its own credential form and needs no manual `register()` like 4.4's private service. The flow below uses allo's own `token-connectors` market (a zip archive hosted on ModelScope):

```ts
// 1. Register the market source (a zip archive; the archive root is the market root)
const market = await client.addMarketplace({
  name: "token-connectors",
  source_kind: "zip",
  source:
    "https://www.modelscope.cn/models/me9rez/flowy-marketplace/resolve/master/token-connectors.zip",
});

// 2. Locate this market's entry: the same host may also carry the official
//    connectors market, so the filter must match on marketplace_id
const item = (await client.store.search("github-token")).find(
  (hit) => hit.marketplace_id === market.marketplace_id,
);
if (!item) throw new Error("no github-token entry in the token-connectors market");

// 3. Install. While no credential is stored, install waits for ready until it
//    times out; the ready result can be ignored
const installed = await client.store.install(item, { timeoutMs: 20_000 });
console.log(installed.ok, installed.installedCount, installed.warnings);

// 4. Resolve the mcp_server_id (UUID) from connectors.list() by name:
//    credential/get|set, get and call accept the UUID only, never the server
//    name (see 4.4)
const row = (await client.connectors.list()).find((c) => c.name === "github-token");
if (!row) throw new Error("the github-token connector is not installed");

// 5. Read the credential surface: mode is token, missing lists the keys still
//    absent (names only, never values)
const form = await client.connectors.credentials(row.id);
console.log(form.mode, form.missing); // → "token" ["GITHUB_PAT"]

// 6. Store the credential: only keys declared by the entry are accepted;
//    secrets go to the host credential store and are never returned in a response
await client.connectors.setCredentials(row.id, { GITHUB_PAT: process.env.GITHUB_PAT! });

// 7. Probe and call: the tool list is returned only after a credential is
//    stored (get() returns an empty array before that); tool names are whatever
//    the server returns
const detail = await client.connectors.get(row.id);
console.log(detail.tools.map((tool) => tool.name));
const call = await client.connectors.call(row.id, detail.tools[0].name, {});
if (call.is_error) console.warn(call.result);
```

Baidu Netdisk follows the same flow with a different entry name and credential key:

| Entry | Remote service | Credential key | Where to get a credential |
| --- | --- | --- | --- |
| `github-token` | `https://api.githubcopilot.com/mcp/` | `GITHUB_PAT` | [github.com/settings/tokens](https://github.com/settings/tokens) |
| `baidu-netdisk-token` | `https://mcp-pan.baidu.com/sse` | `BAIDU_NETDISK_ACCESS_TOKEN` | [pan.baidu.com/union/doc/Wm9sl0i0j](https://pan.baidu.com/union/doc/Wm9sl0i0j) |

Both entries point at the **same remote service** as the official market's `github` / `baidu-netdisk`; only the authentication differs: the official entries are `server-side` (the platform holds the credential, so the UI shows no credential form) while these two are `token` (bring your own). Their ids and display names are deliberately distinct, so installing both markets on one host never yields same-named entries or a name-based overwrite.

Calling before a credential is stored is fail-closed: the host returns `MCP_MISSING_CREDENTIAL` and sends no request to the remote service.

> **Protocol version note (since fp-17)**: The `auth_mode` in entry manifests maps to `auth_transport` in low-level protocol summaries (`token` maps to `user_token`, `server-side` maps to `platform_proxy`); SDK client and catalogue data models maintain seamless backward compatibility.

### 4.8 Catalogue search, highlight ranges and prompt hints

`store.search` supports multi-term matching: the query is split on whitespace and an entry matches when every term appears across its searchable fields (not necessarily within the same field). `store.searchWithHits` additionally returns the matched field name, detected language, and character-level highlight ranges; `store.searchInstalled` filters strictly within installed entries; `store.listStatus` probes the asynchronous readiness state of background markets. The complete contract specification is documented in the [TypeScript SDK reference](/en-US/docs/typescript-sdk) §3.3.

The example below demonstrates the canonical workflow for interactive search and highlight rendering:
1. **Startup readiness probing**: Fetch the catalogue once and check the `marketsPending` integrity flag;
2. **High-frequency zero-I/O search**: Reuse in-memory `items` to avoid repeated disk projections, slicing `ranges` in reverse order to safely insert `<mark>` tags;
3. **Installed-only filtering and prompt hint (`quick_prompts`) extraction**.

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

// Runtime: Node.js ≥ 22 / Bun; requires the host binary (AGENT_STORE_BIN or the @flowy-agent-store/runtime-* package)
const harness = await launchHarness({
  bin: process.env["AGENT_STORE_BIN"],
  client: { name: "catalog-search-demo", version: "1.0.0" },
  marketDownload: "lazy",
});

try {
  // 1. Fetch catalogue once and inspect readiness: marketsPending is true while builtin markets register in background
  const { items, marketsPending } = await harness.store.listStatus();
  if (marketsPending) {
    console.warn("Markets are still registering; an empty result does not mean the entry does not exist");
  }

  // 2. Zero-I/O afterwards: items is retained by the caller; subsequent searches filter in memory without IPC
  const matches = await harness.store.searchWithHits("baidu netdisk", { items, kind: "connector" });
  for (const { item, hits, offLanguage } of matches) {
    const nameHit = hits.find((hit) => hit.field === "name");
    // offLanguage: the hit matched in the alternate language, which the current display label does not contain
    // reduceRight slices from end to start so preceding character offsets remain valid
    const rendered =
      nameHit && !offLanguage
        ? nameHit.ranges.reduceRight(
            (text, [start, end]) => `${text.slice(0, start)}<mark>${text.slice(start, end)}</mark>${text.slice(end)}`,
            item.name,
          )
        : item.name;
    console.log(rendered);
  }

  // 3. Search restricted to installed entries (reuses the same items, without re-fetching from host)
  const installed = await harness.store.searchInstalled("netdisk", { items });
  console.log("Installed hits:", installed.map((item) => item.entry_name).join(", "));

  // 4. Prompt hints: skill/connector entries come from index row examples_*, experts/teams from plugin.json quickPrompts
  for (const item of items.slice(0, 3)) {
    const hint = item.quick_prompts?.[0];
    console.log(`${item.name}: ${hint ? (hint.zh ?? hint.en) : "(market declared no hint, so no line is rendered)"}`);
  }
} finally {
  // Release the host child process and its data directory
  await harness.server.close();
}
```

| Constraint | Observable consequence when violated |
| --- | --- |
| Do not invoke `search()` without passing `items` inside high-frequency events (e.g. `input`) | Each keystroke executes a full catalogue projection (scanning manifests from disk plus two database queries). Passing pre-fetched `items` (`search(q, { items })` / `searchWithHits(q, { items })`) degrades to local matching (**zero I/O**), making it safe inside event listeners. |
| Do not infer an empty catalogue solely from `search()` returning empty arrays | During initial startup, builtin markets may still be registering asynchronously; an empty array is indistinguishable from "entry does not exist". Always inspect `listStatus().marketsPending`. |
| Do not apply `ranges` across different text fields | Offset ranges strictly bind to the string identified by `field`; applying them to other strings causes slice misalignment or corruption. |
| Do not highlight when `offLanguage: true` | The matched term resides in the alternate language text and does not exist in the rendered label; direct slicing causes misaligned markup. |

### 4.9 Render entity cards per UI language (`fp-18`)

Starting in `fp-18`, the catalog endpoints for installed entities (`agents`, `teams`, `skills`, `connectors`) return an identical set of optional display fields. Consumers can render titles, descriptions, tags, and prompt hints bilingually **without reading market source files**:

```ts
import { launchHarness } from "@flowy-agent-store/sdk";

const harness = await launchHarness({ bin, client: { name: "card-render", version: "1.0.0" } });
try {
  const lang = "en" as const;

  // Four catalog endpoints: unified field structure and rendering path
  const cards = [
    ...(await harness.agents.list()).map((item) => ({ kind: "expert", ...pick(item) })),
    ...(await harness.teams.list()).map((item) => ({ kind: "team", ...pick(item) })),
    ...(await harness.skills.list()).map((item) => ({ kind: "skill", ...pick(item) })),
    ...(await harness.connectors.list()).map((item) => ({ kind: "connector", ...pick(item) })),
  ];

  for (const card of cards.slice(0, 5)) {
    console.log(`[${card.kind}] ${card.title}`);
    if (card.summary) console.log(`  ${card.summary}`);
    if (card.hint) console.log(`  Prompt: ${card.hint}`);
  }

  function pick(item: {
    name: string;
    display_name?: { zh?: string; en?: string } | null;
    display_description?: { zh?: string; en?: string } | null;
    quick_prompts?: { zh?: string; en?: string }[];
  }) {
    // Per-locale fallback: active locale -> alternate locale -> name identifier
    const text = (pair?: { zh?: string; en?: string } | null) =>
      (lang === "zh" ? (pair?.zh ?? pair?.en) : (pair?.en ?? pair?.zh)) ?? null;
    return {
      title: text(item.display_name) ?? item.name,
      summary: text(item.display_description),
      hint: text(item.quick_prompts?.[0]),
    };
  }
} finally {
  await harness.server.close();
}
```

Display field consumption and boundary contract:

| Constraint | Observable consequence when violated |
| --- | --- |
| Connector titles must read from `display_name`; do not render `name` directly | `name` is the runtime identifier (e.g. `fenbi_mcp`) and forms a segment of tool namespaces (`connector__<name>__<tool>`); rendering it directly leaks internal identifiers to end users. |
| Do not assume display fields are always present | Market records frequently omit localized fields (only 15 of 268 skill entries declare a Chinese name); absent `display_*` fields conform to the protocol contract, and falling back to `name` is standard flow rather than an error branch. |
| Do not assume the top-level single-language `description` matches the active UI locale | Connector index rows carry unconstrained locales in top-level `description` (210 of 283 rows are English); deterministic localized descriptions must be read exclusively from `display_description`. |

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
try {
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
} finally {
  runSub.close(); // Cleanly releases event subscription upon reaching terminal status
}
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

#### 5.2.2 Categories and tags ride along (since pack_format 3)

Since `fp-16` (`pack_format 3`) the pack's display metadata ships with the definition. The scope is the **opposite of `assets`**: a category is a per-package declaration, so member packs carry their own values:

```ts
const result = await exportTeam(client, "wb-stock-partner-team-team", "./exported-team");

// The top-level pack carries the team row's own declaration
console.log(`format: ${result.pack.pack_format}`);           // 3
console.log(`team tags: ${JSON.stringify(result.pack.tags)}`);
console.log(`team category: ${result.pack.category_id}`);    // raw id, e.g. "04-DataAI"

// Each member pack carries its own values (an undeclared value is an absent field, not an empty array)
for (const member of result.pack.team?.members ?? []) {
  console.log(`${member.name}: ${member.category_id ?? "(uncategorized)"}`);
}

// Resolve the raw id to a localized name: the id comes from the host, the name from your
// local dictionary; a miss shows the raw id rather than inventing a label
const { items: categories } = await client.store.categories();
const categoryName = (id?: string | null) =>
  categories.find((c) => c.id === id)?.name.en ?? id ?? "Uncategorized";
console.log(`resolved: ${categoryName(result.pack.category_id)}`);
```

The installed catalogs read the same facts as the export face: `client.teams.list()` carries the package-level `tags` / `category_id`, and `client.skills.list()` carries `tags` taken from the market index row and fixed at import time — a later market-side edit only lands through a `store.update()`.

#### 5.2.3 Per-entity icon reference consumption and materialization (since pack_format 4)

Starting in `fp-19` (`pack_format 4`), referenced skills (`skills[].icon`) and connectors (`connectors[].icon`) within an `ExpertPack` can carry independent icon relative paths. The pack payload carries path strings only; retrieving binary bytes requires routing through the appropriate interface based on each entity's addressing coordinate frame:

```ts
import { exportAgent, materializePack } from "@flowy-agent-store/sdk";

// Pattern A: Automated materialization to disk via exportAgent / exportTeam (recommended)
// materializePack automatically traverses both coordinate systems and writes icons to disk
const result = await exportAgent(client, "wb-architect", "./exported-expert");

console.log(`Pack format version: ${result.pack.pack_format}`); // 4
console.log(`Written asset files: ${result.writtenAssets.join(", ")}`);

// Pattern B: Inspecting ExpertPack in memory and reading icon bytes by coordinate system
const pack = await client.agents.export("wb-architect");

// 1. Skill icons: Skill-directory relative path, retrieved via skills.readFile
for (const skill of pack.skills ?? []) {
  if (skill.icon) {
    console.log(`Skill [${skill.name}] icon path: ${skill.icon}`);
    const iconBytes = await client.skills.readFile(skill.id, skill.icon);
    console.log(`Skill icon byte length: ${iconBytes.byteLength}`);
  }
}

// 2. Connector icons: Immutable snapshot root relative path, retrieved via readImportAsset
for (const conn of pack.connectors ?? []) {
  // Note: Connectors declared via team package mcpServers lack independent icon sources; icon is always absent
  if (conn.icon) {
    console.log(`Connector [${conn.name}] icon path: ${conn.icon}`);
    const iconBytes = await client.readImportAsset(pack.provenance.snapshot_id, conn.icon);
    console.log(`Connector icon byte length: ${iconBytes.byteLength}`);
  }
}
```

```text
./exported-expert/
├── expert-pack.json
├── persona.md
├── skills/code-analysis/
│   ├── SKILL.md
│   └── assets/icon.png             ← Skill icon materialized inside skills/<name>/
└── avatars/connectors/github.svg   ← Connector icon materialized to snapshot asset path
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
import { AppServerError, formatError, isRetryableTransportError } from "@flowy-agent-store/protocol";

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
  } else if (isRetryableTransportError(error)) {
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

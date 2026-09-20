# Configuration file (config.toml)

Agent Store keeps all long-lived preferences in `~/.agent-store/config.toml` (TOML): the default model, API providers, model aliases and default marketplace sources. Change it once, it applies on every start.

- **Default location**: `~/.agent-store/config.toml` (`%USERPROFILE%\.agent-store\config.toml` on Windows).
- **Optional file**: without it the App Server runs fine, but model calls need providers created manually in the Web UI first; with it, declared providers, model defaults and marketplaces are auto-registered on startup.

> This file follows the user-level `config.toml` convention of Claude Code / Codex / Kimi Code (`[providers.<name>]` + `[models."<provider>/<model>"]`). **Unknown top-level and nested keys are tolerated** — the file is yours and may carry settings for other tools (Kimi Code's `thinking`, `permission`, `hooks`, …) without breaking parsing.

A second optional file sits next to it, `mcp.json`: it is none of this file's tables but a declaration of **which MCP servers this machine connects to**, so it gets its own section — see [`mcp.json`: declaring MCP servers](#mcp-json-declaring-mcp-servers).

## Full example

```toml
default_model = "opencode/mimo-v2.5-free"

[providers.opencode]
type = "openai"
api_key = "sk-..."
base_url = "https://opencode.ai/zen/v1"

[providers.mimo]
type = "openai"
base_url = "https://api.xiaomimimo.com/v1"

[models."opencode/mimo-v2.5-free"]
provider = "opencode"
model = "mimo-v2.5-free"
display_name = "MiMo V2.5 Free"
max_context_size = 200000
max_output_size = 8000
capabilities = ["thinking", "tool_use"]

[models."opencode/laguna-s-2.1-free"]
provider = "opencode"
model = "laguna-s-2.1-free"
max_context_size = 256000
display_name = "Laguna S 2.1 Free"

# Default marketplace sources (auto-registered on first store/market call; each official market is a zip archive on ModelScope)
[default_marketplaces.experts]
source_kind = "zip"
source = "https://www.modelscope.cn/models/me9rez/flowy-marketplace/resolve/master/experts.zip"
```

> The three official markets (`experts` / `skills` / `connectors`) now publish as **one zip archive each**, hosted on ModelScope; this site only serves the docs plus the ~648 catalog-page icons. The archive's **sha256 is the revision**: the client sends a `HEAD` to the stable URL and reads `X-Linked-Etag` (the content sha256), skips the download when the digest is unchanged, and verifies the downloaded bytes against that same digest.

`[default_marketplaces]` is your table: **once you declare it, the runtime registers your sources and the built-in defaults no longer apply**. So a machine that ran `agent-store init` (or hand-copied the addresses from older docs) has the retired `/source/<market>/…` site tree frozen in its config and must be fixed by hand. Either repoint those three blocks at the zip addresses above, or delete them and fall back to the built-in defaults; the first fetch after the switch downloads the whole archive (289.0 MiB for the largest, `experts`), where the old file-per-entry tree took 14,714 requests. Failure is benign: a failed fetch never touches the last-good local copy, so entries do not disappear — they stay at their old data.

## Top-level fields

| Field | Type | Description |
| --- | --- | --- |
| `default_model` | `string` | Default model alias in `"<provider>/<model>"` form; must resolve through `[models]`; used when the caller sends no model |
| `providers` | `table` | API provider table → `providers` |
| `models` | `table` | Model alias table → `models` |
| `default_marketplaces` | `table` | Marketplace sources auto-registered on startup → `default_marketplaces` |
| `memory` | `table` | Policy for the built-in (file-based) memory system: `enabled` is the master switch, `distill_enabled` covers session-end distillation only → `memory` (below) |
| `marketplace` | `table` | Background auto-update cadence → `marketplace` (below) |
| `tools` | `table` | Host-level tool policy (subtractive only) → `tools` (below) |
| `connector_proxy` | `table` | Authorization for the connector call proxy: which MCP tools a third party may run over the host's connections. Off unless declared → `connector_proxy` (below) |
| `credentials` | `table` | Values for `secret:NAME` references; hand-edited, never on the wire → see "`secret:NAME`: credentials stay out of the declaration file" |

## `providers`

A table keyed by unique provider name. Agent Store reads credentials **from here only** — no shell environment fallback.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `string` | no | Provider type (maps to the runtime platform), e.g. `openai`, `anthropic`; see "What `type` actually accepts" |
| `api_key` | `string` | no | API key, written in plain text in the config file |
| `base_url` | `string` | no | API base URL |
| `enabled` | `boolean` | no | Enables auto-registration; treated as enabled when omitted |

> Key safety: `api_key` is read only for the encrypted provider registration, then dropped — it never appears in logs or tracing payloads. Consider tightening file permissions yourself (`chmod 600`).

### What `type` actually accepts

**Omitting `type` and writing `type = ""` are exactly equivalent**: both fall through to `custom`, which is the OpenAI Chat Completions-compatible protocol. So only a **limited set of spellings** is recognized here; everything else is treated as OpenAI-compatible. If you copy a config from another tool (Kimi Code, say), the spellings in the last two rows below are silently taken as OpenAI rather than rejected:

| What you write | Protocol actually used | Notes |
| --- | --- | --- |
| omitted / `""` / `custom` / `openai` / `kimi` | OpenAI Chat Completions | OpenAI-compatible services such as `kimi`, `mimo`, `deepseek` all land here |
| `anthropic` | Anthropic Messages | See "Output ceiling" below — this protocol has a hard requirement on `max_output_size` |
| `openai_responses` | **OpenAI Chat Completions** (not Responses) | For the Responses protocol write `protocol = "openai-responses"` (also accepts `openai.responses`) on the **model**; it is not a provider-level value |
| `google-genai` / `vertexai` | **OpenAI Chat Completions** (wrong protocol) | The provider types recognized here are `gemini` and `gemini-vertex-ai` |

A per-model protocol override (`protocol` under `[models]`) carries two different strengths: `"openai.responses"` / `"openai-responses"` takes effect on **any** platform (it is the only way in to the Responses protocol), while `"anthropic"` and friends only change protocol selection on a `new-api` platform and are stored without effect elsewhere (recorded verbatim, no error). So "switch the `type` to switch the protocol" holds only for the first two rows above.

## `models`

A table keyed by `"<provider>/<model>"`. `provider` must point to a key declared in `[providers]`.

| Field | Type | Description |
| --- | --- | --- |
| `provider` | `string` | Owning provider key (required) |
| `model` | `string` | Model name sent upstream (required) |
| `display_name` | `string` | Display name in the UI |
| `max_context_size` | `integer` | Context window limit (tokens) |
| `max_output_size` | `integer` | Max output per response (tokens). See "Output ceiling" below — **required** for the `anthropic` protocol, and the value actually sent is clamped to a quarter of the context window |
| `protocol` | `string` | Per-model protocol override, e.g. `"openai-responses"`, `"anthropic"`; strength described at the end of "What `type` actually accepts" |
| `capabilities` | `array<string>` | Capability flags, e.g. `["thinking", "tool_use", "image_in"]`. **Parsed but not yet in effect** (the key is kept so configs from other tools stay loadable) |
| `reasoning_key` | `string` | Field name of the reasoning content in responses, e.g. `reasoning_content`. **Parsed but not yet in effect** |

### Output ceiling (`max_output_size`)

This key matters more than it looks: **the `anthropic` protocol must carry `max_tokens` on the wire**, so for that protocol a model without an output ceiling is not "let the provider pick a default" — it is a hard runtime build failure:

```text
Bad request: the anthropic protocol requires an explicit output ceiling;
set Max output tokens on the <provider>/<model> model in Settings -> Models
```

| Protocol | When `max_output_size` is absent | Once you declare it |
| --- | --- | --- |
| `anthropic` | **Error**: the runtime build fails with `BAD_REQUEST` and the turn cannot be sent | Sent as `max_tokens` |
| OpenAI Chat Completions | Omission allowed: the field is left out of the request and upstream decides | Sent as `max_tokens` (as `max_completion_tokens` on some gateways) |
| OpenAI Responses | Omission allowed: same as above | Sent as `max_output_tokens` |

**Both protocols honour the value you write** — the difference is only whether omitting it is an error. So when you point at an `anthropic`-compatible gateway (many third-party relays expose only `/v1/messages`), you **must** set it; a copied config that says `type = "anthropic"` but only sets `max_context_size` will hit the error above.

### A declared value is not always what goes on the wire

Writing `max_output_size` explicitly does not guarantee that exact number upstream: two mechanisms lower it, and neither reports anything.

**1. A quarter of the context window (local clamp)**

The effective request ceiling is `min(declared, context window / 4)`. With a large window this never bites (a 1M window and a declared 8000 sends 8000); with a small one it changes the number visibly, and **with no log line**:

| Context window | Declared `max_output_size` | Actually sent |
| --- | --- | --- |
| 1,000,000 | 8000 | 8000 (1/4 = 250,000, not binding) |
| 8,000 | 8192 | 2000 |

So the answer to "I set 8192, why did 2000 go out?" lives in `max_context_size`: the model's context window is what caps the ceiling, not your declaration.

**2. Negotiation after an upstream `supported range` rejection (OpenAI Chat Completions only)**

If a gateway rejects the value with wording like `maxOutputTokens value of 128000 but the supported range is from 1 (inclusive) to 65537 (exclusive)`, the client parses the largest accepted value, **lowers the ceiling and resends once** — and then **remembers it per model**: every later request for that model is clamped to it and never retries your configured larger value.

- Down only, never up. Raising `max_output_size` does not reclaim a remembered cap — that memory lives in the process, so only a **restart** tries the configured value again.
- The wording must match `supported range is from L (inclusive|exclusive) to U (inclusive|exclusive)` exactly; any other rejection is reported as-is rather than guessed at.
- OpenAI Responses has **no** such negotiation (it only negotiates stale `previous_response_id` values and tool schemas), so a rejection there stays a rejection.

### Two registration behaviours attached to this key

- **Fill-in only, never overwrite**: registration writes the config value only when the model does not already have an output ceiling. A value you later edit by hand in Settings → Models is not rewritten by the config — that same error is what sends you there to set it, so writing back would silently undo your edit.
- **Existing rows are repaired**: a provider registered by an earlier build can be stuck with a context window but no output ceiling. The next model resolution for that same provider key fills the gap in place, so there is no need to delete and re-register it.

> On the trade-off: when `max_output_size` is absent, **no** default is invented. The deliberate choice is to fail with an error naming the model for `anthropic` rather than guess a ceiling that might truncate long answers. A value `<= 0` is treated as "not declared".

## `default_marketplaces`

Default marketplace sources (winget-style software sources). The App Server auto-registers them on the first `store` / `market` call; an existing id is reactivated with the new source.

The three sources below are the **built-in defaults a release ships with**: when `config.toml` is missing or declares no `[default_marketplaces]`, the runtime registers exactly these (each is **one zip archive**, fetched in a single request); as soon as you declare your own table, only your sources are registered. For the official-versus-third-party distinction see [Plugins and marketplaces](/en-US/docs/plugins-market): only official sources default to auto-update.

| Field | Type | Description |
| --- | --- | --- |
| `source_kind` | `string` | `zip` \| `url` \| `github` \| `git` \| `directory` |
| `source` | `string` | Concrete address; for `url` kinds also provide a directory listing (`_files.txt`) so entry trees can mirror over HTTP, while `zip` accepts only an `http(s)://` archive address |

```toml
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

## `memory`

Policy for the built-in (file-based) memory system. This table holds **two independent switches**, both scoped to this host: `enabled` governs the whole system, while `distill_enabled` governs only the session-end distillation half of it.

### `enabled`: the built-in memory master switch

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | `boolean` | `false` turns this host's **built-in memory system** off; `true` or an absent key keeps the upstream default (**on**) |

With `false`, all four of the following stop at once — they are four faces of one system, and it never turns off only half:

| Face | Behaviour when off |
| --- | --- |
| Memory section of the system prompt | not injected (the model does not even see the `MEMORY.md` index) |
| `remember` tool | not registered, so the model cannot write new memories |
| Session-end distillation | the extra model call is not made (same effect as `distill_enabled = false`) |
| Citation write-back | `<nomi-mem-citation>` is not parsed and memory-file usage counters are not bumped |

```toml
# Turn the built-in memory system off entirely
[memory]
enabled = false
```

- **The default is on.** An absent `[memory]`, an empty `[memory]`, and `enabled = true` all mean on, so upgrading changes nothing; turning it off must be written out explicitly.
- **It neither deletes nor hides memories on disk.** Existing memory files stay exactly where they are, so setting `enabled` back to `true` restores the previous state — this is not a delete switch.
- **Independent of `distill_enabled`.** The two combine freely: to keep memory readable and `remember` available while dropping only the extra per-turn call, set just `distill_enabled = false`; to take the whole system offline, use `enabled = false` (at which point `distill_enabled` no longer matters).
- **Only the host that adopts it is affected.** Even when the desktop and web hosts read the same file (the web host does point at it for `[providers]` / `[default_marketplaces]`), they do **not** adopt `[memory]` — only the Agent Store host does. This is exactly the adoption rule `[tools]` follows.
- **Read once at startup**, like `distill_enabled` in the same table and like `[tools]`: restart the host for a change to take effect.
- **Hand-edit only.** `enabled` is currently **not** on the `config/set` write whitelist and has no settings-dialog toggle (`distill_enabled` does) — to turn it off, edit this file and restart. That is deliberate: the master switch has a far wider blast radius than distillation, so programmatic writes are not exposed for it yet.

### `distill_enabled`: session-end distillation only

**Distillation** makes one extra model call after every normal turn to distil the session into file-based memory; that call happens **before** the turn's terminal signal, so clients see the answer fully rendered while the conversation still reports "processing" for roughly **6–15 s** (it tracks model latency).

| Field | Type | Description |
| --- | --- | --- |
| `distill_enabled` | `boolean` | `false` disables distillation (no extra model call after the turn, so "answer complete" and "turn finished" coincide); `true` or an absent key keeps the upstream default (**on**) |

```toml
# Skip session-end memory distillation (one less model call per turn, and no
# 6–15 s finalization tail after the answer is complete)
[memory]
distill_enabled = false
```

> Precedence: the `NOMIFUN_MEMORY_DISTILL` environment variable (`0`/`false` off, `1`/`true` on) > this file's `[memory].distill_enabled` > the upstream default (on). Without a `[memory]` section the behaviour is exactly what it was before. Note that this variable covers **distillation** only — it cannot switch back on a system that `enabled = false` turned off.

> **Do not confuse this with the engine's own `~/.nomi/config.toml`**: that is a separate file, and its `[memory] distill_enabled` likewise covers distillation only. The built-in memory master switch lives **in this file** for now.

## `marketplace`

Background **auto-update** cadence. When enabled, the runtime polls marketplace sources on this interval in the background; it is **off by default** — without a `[marketplace]` section no background request is ever made.

| Field | Type | Description |
| --- | --- | --- |
| `auto_update_interval_hours` | `integer` | Hours between sweeps. Absent or `0` = off; a positive integer enables it |

```toml
# Check marketplace sources in the background every 6 hours (official sources
# only; third-party sources are never auto-updated)
[marketplace]
auto_update_interval_hours = 6
```

> Both gates must hold before anything is fetched: ① the marketplace's auto-update toggle is on, and ② its source address is one of the **official mirrors**. A third-party source keeps its toggle for display but is never polled. Each sweep still probes freshness first (`url` sources via revision / ETag, `zip` sources via a `HEAD` request's `X-Linked-Etag`, i.e. the content sha256), so an unchanged source is not re-fetched.

## `tools`

Host-level tool policy: it **decides which tools this host injects into every session**. It only ever subtracts — there is no "force enable" switch, and a capability switched off here is unavailable to every session on this host.

> **Only the Agent Store host adopts this table** (the `agent-store` executable). The desktop and web hosts read the same file for `[providers]` / `[default_marketplaces]` but **ignore `[tools]`**. The host **reads it once at startup**, so a change needs a restart.

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | `array<string>` | Allowlist: when non-empty, **only** the listed tools survive; an empty array or an absent key means "unconstrained" (not "deny everything") |
| `disabled` | `array<string>` | Denylist, applied **after** `enabled`, so it can only ever narrow; builtin tools match by **exact name** (case-sensitive) and only `mcp__<server>__*`-style MCP names are globs |
| `web` | `boolean` | `WebSearch` / `WebExtract`. Default `true` |
| `computer` | `boolean` | `Computer` (desktop control: keyboard / mouse / UIA). Default `true` |
| `browser` | `boolean` | The `Browser` family (it runs with the operator's profiles and logins). Default `true` |
| `plan` | `boolean` | `EnterPlanMode` / `ExitPlanMode`. Default `true` |
| `lsp` | `boolean` | The `Lsp` navigation tool (registered only when LSP servers are configured). Default `true` |
| `domains` | `table` | Product-domain switches → `tools.domains` (below); every key defaults to `true` |

> The basic tools are **not** affected by this table: `Read` / `Write` / `Edit` / `Glob` / `Grep` / `Bash` (plus `ToolSearch` and the MCP proxy tools) sit behind none of the switches above and can only be removed by naming them in `disabled`. Putting `ToolSearch` in `disabled` makes **every** Connector tool unreachable — the host warns in its startup log, it does not refuse to boot.

### `tools.domains`

| Key | What it turns off |
| --- | --- |
| `cron` | `cron_create` / `cron_list` / `cron_delete` (native scheduled jobs) |
| `meeting` | The `meeting.*` family and the listen-in context |
| `knowledge` | `knowledge_search` / `knowledge_read` / `knowledge_write` and the knowledge mounts |
| `learning` | `learning_generate_course` / `learning_course_status` |
| `media` | Flowy media generation (today only `image_generate`; video lives in the vimax page, not in this table) |
| `companion` | `recall_memories` / `propose_companion_memory` and in-session summon |
| `requirement` | `requirement_complete` / `requirement_update_status` (AutoWork) |
| `goal` | `update_goal` and goal-driven continuation |

A domain switch cuts the **wiring**: not only does the tool fail to register, the knowledge mounts and the cron / meeting host seams are not wired either — no "tool gone, mounts still there" half-state.

```toml
# Keep basic assistance only: two host-control switches off, seven product domains off
[tools]
web = true          # web search / page reading stays on
computer = false
browser = false

[tools.domains]
cron = false
meeting = false
knowledge = false
learning = false
media = false
companion = false
requirement = false
```

These are exactly the defaults `agent-store init` writes into a fresh config; `plan` / `lsp` / `goal` are absent, i.e. left on.

### Overriding it with an environment variable (`AGENT_STORE_TOOLS`)

When you spawn the host yourself (the SDK's `launchHarness`, for example) you do not have to edit this file: the `AGENT_STORE_TOOLS` environment variable takes a JSON document (the same shape as the `[tools]` table) that **replaces** the file's policy wholesale rather than merging with it.

| Fact | Behaviour |
| --- | --- |
| Value | JSON in the `[tools]` shape; `{}` means "everything at its default" |
| Precedence | environment variable > this file > permissive default |
| Scope | the same gate as the file: only a host that adopts `[tools]` |
| Unparseable | warns and falls back to this file; an empty value means "unset" (not "deny everything") |
| When it applies | read once at host startup |

```bash
AGENT_STORE_TOOLS='{"computer":false,"domains":{"knowledge":false}}' agent-store
```

Full usage examples are in the [TypeScript SDK cookbook](/en-US/docs/examples-sdk) §10.

## `connector_proxy`

The **connector call proxy** authorization table: it decides whether a **third party** (an external agent, an SDK client) may **run a tool of an installed MCP connector over the host's connection**. The connection and its credentials always stay on the host and the caller can only name a connector and a tool — this table is about *whether it is allowed*, not about *how to connect*.

> **Only the Agent Store host adopts this table** (the `agent-store` executable), behind the same gate as `[tools]`. It is **not** in `config/get`'s projection and **not** on `config/set`'s whitelist: letting a third party execute tools on the host's connections is not a setting a remote caller should be able to widen. The host reads it **once at startup**.

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | `boolean` | Only `true` turns the proxy on. Absent, or no table at all = **off** (the default) |
| `allow` | `array<string>` | **Optional narrowing**: when present, only matching entries are admitted; `allow = []` means "nothing"; **omitting** `allow` means every enabled connector is callable |
| `deny` | `array<string>` | **Optional subtraction**, applied **after** `allow`, so it can only narrow further |

Entries are written in the tool's own vocabulary: `mcp__<connector>__<tool>`. `<connector>` may be the registered **name** or the **id** (the id is the precise spelling: MCP servers are upserted by name, so a later install takes the name over and would otherwise inherit the grant). Matching follows the same rule as `[tools]` — only `mcp__` entries are globs, so `mcp__github__*` means the whole connector.

```toml
[connector_proxy]
enabled = true                    # turn the proxy on; absent = off
allow = ["mcp__github__*"]        # optional: admit just this connector (omit to admit every enabled one)
deny = ["mcp__*__delete_*"]       # optional: subtract delete-style tools across all connectors
```

Decision order (the order below is the order they are evaluated in):

| # | Gate | Code when it refuses |
| --- | --- | --- |
| 1 | Table missing, or `enabled` is not `true` | `policy_denied` |
| 2 | No such connector | `not_found` |
| 3 | `allow` was declared and nothing matched | `policy_denied` |
| 4 | `deny` matched | `policy_denied` (worded differently from the line above, so the two are distinguishable) |
| 5 | The connector is registered but disabled | `connector_unavailable` |

> **The default is off, not wide open.** A slip of the pen must not be the difference between "nothing is callable" and "everything is callable", so a missing table or a missing `enabled` always refuses. Conversely, **writing `enabled = true` is itself the grant** — `allow` only narrows it. If you are upgrading from an older version, note that the old spelling `<connector>__<tool>` (no `mcp__` prefix) **no longer matches anything** under the new rule, which narrows to nothing; the host logs one warning about that and one about "the proxy is on with no list at all", so both are easy to fix.
>
> The `AGENT_STORE_CONNECTOR_PROXY` environment variable replaces this whole table (JSON, same shape), mirroring `AGENT_STORE_TOOLS`: it **replaces** rather than merges, and an unparseable value leaves the proxy off.

## `mcp.json`: declaring MCP servers

`config.toml` holds long-lived preferences; **where MCP servers come from** is a separate file next to it, `mcp.json` (JSON). Its schema follows [Kimi Code CLI's MCP configuration](https://www.kimi.com/code/docs/kimi-code-cli/customization/mcp.html): the fields share names and meaning, so copying one over usually works — for the differences, see the end of this section.

- **Default location**: `~/.agent-store/mcp.json` (`%USERPROFILE%\.agent-store\mcp.json` on Windows). It follows the `config.toml` the host resolves — whatever directory that file points at is the directory whose `mcp.json` is read, and no environment variable can move it elsewhere.
- **Optional file**: absent means no server is declared, and the behaviour is exactly what it was before this file existed.
- **Only the Agent Store host reads it** (the `agent-store` executable). The desktop and web hosts point at the same directory and read the same `config.toml` for providers and marketplaces, but **not** this declaration — being readable is not the same as being owned.
- The host **reads it once at startup**, so a change needs a restart (including a change made in the Web UI).

Declared servers **never become `mcp_servers` rows**: they do not enter the connector catalog, cannot be referenced by a preset's `mcp_server_ids`, and have no persisted connection-test status or tool list. On a name collision the order is **`mcp.json` > `mcp_servers` row** — the declaration file is the operator's own written intent, while a row is usually the residue of an import; a binding made explicitly in one call outranks both, so a declaration never overrides the server the caller named for that run. In other words this file is only **one** of the sources: servers registered through the MCP configuration API, or installed from a marketplace / plugin, live in `mcp_servers` rows — see [Plugins & Marketplace](/en-US/docs/plugins-market) §6.

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/srv/data"],
      "env": { "UPSTREAM_TOKEN": "secret:UPSTREAM_TOKEN" },
      "cwd": "servers/filesystem",
      "toolTimeoutMs": 30000
    },
    "linear": {
      "url": "https://mcp.linear.app/mcp",
      "headers": { "X-Tenant": "acme" },
      "bearerTokenEnvVar": "LINEAR_TOKEN"
    },
    "legacy": {
      "transport": "sse",
      "url": "https://mcp.example.com/sse"
    }
  }
}
```

Each key under `mcpServers` is one server, and `command` or `url` (exactly one of them) decide which kind it is: an entry with `command` is a stdio server, one with `url` and no `transport` is an HTTP server, and only legacy SSE needs an explicit `"transport": "sse"`.

| Field | Applies to | Description |
| --- | --- | --- |
| `command` | stdio | Executable to start. Its presence is what makes the entry stdio |
| `args` | stdio | Argument array; empty when omitted |
| `env` | stdio | Environment injected into the child; a whole-value `secret:NAME` is resolved as a reference |
| `cwd` | stdio | The child's working directory. A relative path resolves **against the directory holding `mcp.json`**, never against the directory the host was started from |
| `url` | remote | Remote address. Omit `transport` and it is Streamable HTTP |
| `headers` | remote | Static headers added to every request; a whole-value `secret:NAME` is resolved as a reference |
| `bearerTokenEnvVar` | remote | **Name** of the variable holding the bearer token (`[credentials]` or the process environment). The host resolves it into `Authorization: Bearer <value>` itself and the engine never sees this field; an explicit `headers.Authorization` wins over it |
| `transport` | remote | Accepts `"sse"` only. Omit it for Streamable HTTP — writing `"http"` is refused |
| `enabled` | all | `false` keeps the entry readable and editable but out of every session; defaults to `true` |
| `deferred` | — | **Not supported** (in the reference implementation it is the experimental "load tools on demand"). Here it counts as an unknown field, which refuses the entry |
| `startupTimeoutMs` | all | Budget for the connect handshake (spawn + `initialize` + `tools/list`); defaults to 30 s |
| `toolTimeoutMs` | all | Wall-clock budget for a single tool call |
| `enabledTools` | all | Tool allowlist: only matching tools are registered. Applied first |
| `disabledTools` | all | Tool blocklist: a matching tool is never registered. Applied **after** `enabledTools`, so a pattern in both lists excludes |

Parsing is **strict**: only the fields in the table above are accepted, an unrecognised key refuses **that entry**, and the error names the key and lists the accepted set. Silently ignoring one would change the declaration's safety semantics — an ignored `disabledTools` is exactly the tool the user believes is switched off and can still call. A field on the wrong transport is refused the same way: `headers` / `bearerTokenEnvVar` on a stdio entry, or `args` / `env` / `cwd` on a remote one, is an error rather than something to ignore.

Refusal is **per entry**: one broken entry affects only itself, and the other servers in the same file load as usual. Only a **file-level** problem (invalid JSON, a top level that is not an object, an `mcpServers` that is not an object) invalidates the whole declaration — the host then declares nothing and writes the reason into its startup log.

### Five differences from the reference implementation

Apart from the five points below, `mcp.json` shares names and meaning with the [reference implementation](https://www.kimi.com/code/docs/kimi-code-cli/customization/mcp.html) and can be copied over as-is:

- **No `deferred`.** The tenth field the reference implementation added later (its experimental "load tools on demand") counts as an **unknown field** here and refuses the **whole entry** — when copying a reference `mcp.json`, that is the only field besides an out-of-range timeout that rejects an entire entry. Our on-demand loading runs through `ToolSearch` and the host `[tools]` policy, and the declaration path is wired for eager schemas, so supporting this field would **add a capability** rather than restore a missed one; until that lands, it stays refused.
- **User level only.** The reference implementation also has a project-level `.kimi-code/mcp.json` that overrides the user level; here there is only the `~/.agent-store/mcp.json` layer, and the project-level path is reserved rather than implemented. Swapping in a different set of servers for one project means editing this user-level file.
- **Stricter activation.** The reference implementation applies an edit to new sessions; here the host reads the file **once at startup**, so adding, editing or removing an entry takes effect at the next **host start**. That is also why there is no `removed` tombstone state — a deleted server is simply invisible to already-open sessions.
- **No global timeout defaults.** The reference implementation's `config.toml [mcp] startup_timeout_ms` / `tool_timeout_ms` and their environment variables have no counterpart here, so both timeouts can only be written per entry.
- **Tighter bounds on both timeouts.** The reference implementation allows `1..=2147483647` ms; here they are capped at the engine's own bound of **600000 ms (10 minutes)** and an out-of-range value **refuses that entry** rather than being clamped or quietly lowered. A hung MCP call would stall a whole agent turn, which is a capability we deliberately do not want — and since the declaration file is the user's only statement of intent, silently lowering a value would make "this server never returns" impossible to attribute. Both timeouts are also executed in **whole seconds**: a sub-second value rounds up, so a declared entry never gets less time than it asked for.

> The reference implementation's OAuth login (`/mcp-config login`) is not on this path: `mcp.json` carries static credentials only (`secret:NAME` / `headers` / `bearerTokenEnvVar`). When browser authorization is needed, register the server as a connector — an `mcp_servers` row — and use the runtime's OAuth flow.

### The server key, tool names and tool filters

The key under `mcpServers` becomes the tool name's prefix: what the model sees is `mcp__<key>__<tool>` (for example `mcp__linear__create_issue`). The key therefore has hard constraints, and **failing one refuses that entry**: ASCII letters, digits, `_` and `-` only, it must **start and end with a letter or digit**, and it must be **at most 40 characters**. That ceiling is not arbitrary — a tool name is `mcp__` + the truncated slug of `<key>__<tool>` + a 16-character digest, bounded at 64 characters in total, and 40 is the conservative value that keeps the `<key>__` separator intact; once the key is truncated, the `mcp__<key>__*` pattern the user wrote can no longer match.

`enabledTools` / `disabledTools` entries are written in two ways, and both are accepted:

- starting with `mcp__` → treated as a glob, matched first against the raw source name `mcp__<server>__<tool>` and then against the runtime's actual name `mcp__<server>__<tool>__<digest>`;
- anything else → treated as a glob over that server's **local tool name** (such as `read_file`);
- `*` means every tool of that server.

When no allowlist entry matches anything, or the allowlist trims every tool of that server away, the host warns — otherwise "trimmed to nothing" and "this server never had that tool" look identical on screen. A blocklist miss is only logged at debug level: one shared subtractive list covering several servers is normal usage.

Switching a whole server off can be written at two levels:

```toml
# Global: no session on this host registers that server's tools
[tools]
disabled = ["mcp__<key>__*"]
```

Written into the declaration's own `disabledTools` it applies to that one server only. The host `[tools]` table is always intersected **last** and is the backstop — a declaration widens where servers **come from**, never the **policy** over their tools.

### `secret:NAME`: credentials stay out of the declaration file

Values of `env` and `headers` support a **whole-value** `secret:NAME` reference: the host looks the name up in `[credentials]` (falling back to the process environment) and fills the value in, in memory, at spawn time only. The value is never written back to a snapshot, a row or a log.

```toml
# config.toml, next to mcp.json
[credentials]
UPSTREAM_TOKEN = "…"    # fills secret:UPSTREAM_TOKEN in mcp.json
```

> `[credentials]` is hand-edited only: it is absent from `config/get`'s projection and from `config/set`'s whitelist — a credential should not be readable or rewritable by any request. When a reference names something that cannot be found, the host **omits that variable / header** and warns; it never sends `secret:NAME` as a literal. The one common mis-write is `"Authorization": "Bearer secret:TOKEN"` — it falls outside a **whole-value** reference and is sent literally, so the host logs a warning naming the header (never the value); use `bearerTokenEnvVar` there instead, or put the `Bearer ` prefix into the credential's own value.

### Read, toggle and edit it in the Web UI

Settings has an **MCP** section (the **MCP servers** button on the connectors catalog page opens the same panel); it reads exactly this file, so you do not have to go through the command line:

- It lists the declared servers (name, transport, enabled state) and the **refused entries with their reasons**, and answers "does this host use this declaration?" separately — `exists: true` with the declaration not adopted is exactly the "the file is fine, this machine does not read it" pair.
- Every server has a toggle that flips its own `enabled` member as a **text-level minimal edit**: only that value is replaced, so indentation, key order and comments survive.
- **Configure MCP** opens a raw-text editor. Before saving, the host validates the text with **the same parser**: if it does not parse, not a single byte is written and the original reason (with line and column) comes back. This text is the only read surface that hands declaration values (including `env` / `headers`) to a client, so it is fetched on demand when the editor opens; every other surface carries names, transports and enabled state only.

These methods travel over the host's own loopback WebSocket only, have no HTTP binding, and are not in the SDK package — they are host management surface, not something a remote caller gets. Method names and the reasoning are in the [TypeScript SDK reference](/en-US/docs/typescript-sdk) §5.3.

## Differences from Kimi Code / Claude Code configs

| Dimension | Agent Store | Kimi Code etc. |
| --- | --- | --- |
| Location | `~/.agent-store/config.toml` | `~/.kimi-code/config.toml` etc. (per-tool directories) |
| `[providers]` / `[models]` | Same shape: `type`/`api_key`/`base_url`, `provider`/`model`/`max_context_size`/`capabilities` | Same shape, but the two recognize a different set of `type` spellings (see "What `type` actually accepts") |
| `max_output_size` | Honoured by both protocols, but the value sent is ≤ a quarter of the context window; **required for `anthropic`** | Tools infer a default per model, so omitting it usually works; Kimi Code uses the declared value as the cap directly, with no window-ratio clamp |
| `default_model` | `"<provider>/<model>"` alias | Same |
| Unknown keys | Tolerated, no error | Tolerated |
| Env fallback | **None** — credentials come from the file only | Some tools support `env`-subtables / env fallbacks |
| Agent Store only | `default_marketplaces`, `[memory]`, `[marketplace]`, `[tools].domains` (`enabled` / `disabled` have the same shape on both sides; the domain switches are ours), `[connector_proxy]` (third-party call authorization, off by default), `[credentials]` (the values behind `secret:NAME`) | No `domains` switches, and no call-proxy authorization table |
| MCP declarations | `~/.agent-store/mcp.json` (sibling of `config.toml`, **user level only**) | `~/.kimi-code/mcp.json` plus a project-level `.kimi-code/mcp.json` (project overrides user) |

If your config already has `[providers]` / `[models]` sections from Kimi Code or another tool, you can **copy them directly** into `~/.agent-store/config.toml` (as long as the provider speaks an OpenAI/Anthropic-compatible protocol); unrelated sections (`thinking`, `permission`, `hooks`, …) can stay or go — Agent Store ignores them.

Two things a straight copy will handle **silently**, so check them first:

- **A different set of `type` spellings.** `google-genai` / `vertexai` / `openai_responses`, all valid in other tools, are not recognized here and degrade to the OpenAI-compatible protocol (wrong protocol, but no config error). See "What `type` actually accepts".
- **`anthropic` needs an explicit output ceiling.** Other tools infer a default `max_tokens` per model, so omitting `max_output_size` usually runs there; Agent Store does not guess, and fails to build without it. See "Output ceiling".
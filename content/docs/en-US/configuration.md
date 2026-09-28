# Configuration file (config.toml)

Agent Store manages persistent configurations within `~/.agent-store/config.toml` (TOML format), serving as the central manifest for default models, API provider definitions, model aliases, and default marketplace sources.

- **Default path**: `~/.agent-store/config.toml` (`%USERPROFILE%\.agent-store\config.toml` on Windows).
- **Loading behavior**: The configuration file is optional. When absent, the App Server runs normally, requiring manual provider creation in the Web UI; when present, declared providers, default model parameters, and marketplace sources register automatically at startup.

> This configuration adheres to standard user-level `config.toml` conventions (`[providers.<name>]` and `[models."<provider>/<model>"]` namespaces). The parser adopts a permissive strategy that tolerates unrecognized top-level and nested keys to maintain compatibility with shared configuration files.

The adjacent optional `mcp.json` file independently maintains MCP service definitions, as detailed in [`mcp.json`: declaring MCP servers](#mcp-json-declaring-mcp-servers).

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

> Official marketplaces (`experts` / `skills` / `connectors`) are published as single Zip archives hosted on ModelScope. Clients issue HTTP `HEAD` requests to read the `X-Linked-Etag` header (representing the sha256 archive digest), bypassing redundant downloads when unchanged and validating payload integrity upon transfer.

`[default_marketplaces]` declares custom marketplace sources. Configuration rules:
- **Override behavior**: Explicit declarations supersede built-in defaults; runtime registers only declared sources. Removing or emptying this table restores default sources.
- **Distribution format**: Official marketplaces use single Zip archive packages; legacy `/source/<market>/...` static directory trees are deprecated.
- **Fault tolerance**: Sync failures retain the most recent valid local snapshot without invalidating installed entries.

## Top-level fields

| Field | Type | Description |
| --- | --- | --- |
| `default_model` | `string` | Default model alias in `"<provider>/<model>"` format; must resolve in `[models]`; applied when requests omit an explicit model |
| `providers` | `table` | API provider mapping table → `providers` |
| `models` | `table` | Model alias configuration table → `models` |
| `default_marketplaces` | `table` | Marketplace sources registered automatically at startup → `default_marketplaces` |
| `memory` | `table` | Local file-based memory system policy: `enabled` sets global availability, `distill_enabled` controls post-turn distillation → `memory` |
| `marketplace` | `table` | Background update polling cadence → `marketplace` |
| `tools` | `table` | Host-level tool policy (subtractive only) → `tools` |
| `connector_proxy` | `table` | Authorization policy for external connector invocation proxying (disabled by default) → `connector_proxy` |
| `credentials` | `table` | Mapping table for `secret:NAME` references; local-only and excluded from network APIs |

## `providers`

Table keyed by unique provider identifier. Credentials resolve strictly from this configuration table rather than implicit shell environment fallbacks.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `string` | no | Provider protocol type mapping to runtime engines (e.g. `openai`, `anthropic`); recognized enums detailed below |
| `api_key` | `string` | no | API authentication key stored in plaintext within the configuration file |
| `base_url` | `string` | no | Base API endpoint URL |
| `enabled` | `boolean` | no | Enables provider registration; defaults to `true` |

> Key security: `api_key` values are loaded solely into memory during client instantiation and excluded from system tracing and persistent logs. Restricting file permissions (e.g. `chmod 600`) is recommended.

### What `type` actually accepts

Omitting `type` or assigning `""` defaults to `custom` (OpenAI Chat Completions-compatible protocol). Specific enums map as follows:

| Declared value (type) | Resolved protocol | Notes |
| --- | --- | --- |
| omitted / `""` / `custom` / `openai` / `kimi` | OpenAI Chat Completions | Services adhering to the OpenAI wire specification (`kimi`, `mimo`, `deepseek`) map to this category |
| `anthropic` | Anthropic Messages | Requires strict adherence to the Anthropic specification; enforces mandatory `max_output_size` declarations |
| `openai_responses` | **OpenAI Chat Completions** (not Responses) | To enable the OpenAI Responses protocol, specify `protocol = "openai-responses"` at the **model level** |
| `google-genai` / `vertexai` | **OpenAI Chat Completions** (wrong protocol) | Supported provider types for Google platforms are `gemini` and `gemini-vertex-ai` |

Model-level protocol overrides (`protocol` field under `[models]`) apply with varying precedence: `"openai-responses"` takes effect globally across all platforms, while `"anthropic"` overrides apply exclusively to `new-api` gateway adapters.

## `models`

Table keyed by `"<provider>/<model>"`. The `provider` identifier must match a valid entry in `[providers]`.

| Field | Type | Description |
| --- | --- | --- |
| `provider` | `string` | Owning provider identifier (required) |
| `model` | `string` | Upstream model identifier (required) |
| `display_name` | `string` | Display name rendered in the UI |
| `max_context_size` | `integer` | Maximum context window token capacity |
| `max_output_size` | `integer` | Maximum output generation token limit; required for `anthropic` protocols and subject to context limits |
| `protocol` | `string` | Model-level protocol override (e.g. `"openai-responses"`, `"anthropic"`) |
| `capabilities` | `array<string>` | Capability feature flags (e.g. `["thinking", "tool_use", "image_in"]`); parsed for configuration compatibility |
| `reasoning_key` | `string` | Key name mapping reasoning content within responses (e.g. `reasoning_content`); parsed for compatibility |

### Output ceiling (max_output_size)

The `anthropic` protocol requires an explicit `max_tokens` parameter on outgoing requests. Models omitting this output ceiling fail request compilation:

```text
Bad request: the anthropic protocol requires an explicit output ceiling;
set Max output tokens on the <provider>/<model> model in Settings -> Models
```

| Protocol | `max_output_size` omitted | Declared explicitly |
| --- | --- | --- |
| `anthropic` | **Error**: Request construction fails with `BAD_REQUEST` | Emitted as `max_tokens` payload argument |
| OpenAI Chat Completions | Allowed: Request omits parameter, deferring to server defaults | Emitted as `max_tokens` (or `max_completion_tokens`) |
| OpenAI Responses | Allowed: Same as above | Emitted as `max_output_tokens` |

### Dynamic downward convergence constraints on output ceiling

The effective `max_output_size` parameter is subject to two downward convergence constraints:

**1. Context Window Ratio Constraint (Local Clamping)**

Outbound requests clamp maximum output tokens to `min(declared_value, max_context_size / 4)` to preserve adequate context margins:

| Context window | Declared `max_output_size` | Value sent |
| --- | --- | --- |
| 1,000,000 | 8000 | 8000 (1/4 equals 250,000; threshold unreached) |
| 8,000 | 8192 | 2000 (clamped to 1/4 context window threshold) |

**2. Upstream Range Negotiation (OpenAI Chat Completions only)**

When an upstream endpoint rejects requests with a `supported range is from L to U` payload, the client extracts the maximum allowed ceiling, clamps the value, executes a single retry, and caches the negotiated limit for the lifetime of the process:

- Cached limits persist in process memory and reset upon host restart.
- Negotiation requires strict error message format matching; unsupported formats propagate immediately.
- The OpenAI Responses protocol excludes this auto-negotiation mechanism.

### Model registration and legacy backfill semantics

- **Non-destructive writes**: Model registration populates output limits only when unconfigured, preserving adjustments made via the Web UI.
- **Legacy backfilling**: Models registered in earlier versions without explicit output limits are backfilled automatically during subsequent evaluation without requiring record recreation.

> The runtime does not generate synthetic default output limits when unconfigured, preventing unexpected truncation. Values `<= 0` are evaluated as undeclared.

## default_marketplaces

Marketplace source definitions. Registered on the first invocation of `store` or `market` APIs; duplicate IDs update existing entries with the new source.

If the configuration file is omitted or lacks `[default_marketplaces]`, official defaults load automatically.

| Field | Type | Description |
| --- | --- | --- |
| `source_kind` | `string` | Protocol kind: `zip` \| `url` \| `github` \| `git` \| `directory` |
| `source` | `string` | Target URI; `url` types recommend `_files.txt` indexing, `zip` accepts HTTP(S) URLs |

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

## memory

Configures policies for the local file-based memory system across two independent scopes:

### enabled: master switch for built-in memory

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | `boolean` | Set to `false` to disable the built-in memory system; defaults to `true` |

Disabling this switch simultaneously halts the following subsystems:

| Controlled subsystem | Disabled behavior |
| --- | --- |
| System prompt memory injection | Suspends injection (excludes `MEMORY.md` index references) |
| `remember` tool | Unregistered; models cannot persist new memory entries |
| Post-turn distillation | Bypasses post-session model extraction routines |
| Citation resolution | Ceases parsing `<nomi-mem-citation>` tags and reference count increments |

```toml
# Completely disable built-in memory
[memory]
enabled = false
```

- Enabled by default. Existing local memory files are preserved and reactivated when toggled on.
- Operates independently from `distill_enabled`; `enabled = false` invalidates distillation settings.
- Enforced exclusively by the Agent Store host process; requires a process restart to take effect.

### distill_enabled: disable post-turn memory distillation

Memory distillation extracts salient dialogue facts asynchronously at the conclusion of an interaction turn. This extra invocation occurs prior to turn completion, introducing 6~15 seconds of latency. Setting this field to `false` removes this overhead.

| Field | Type | Description |
| --- | --- | --- |
| `distill_enabled` | `boolean` | Set to `false` to disable distillation; defaults to `true` |

```toml
# Disable post-turn memory distillation
[memory]
distill_enabled = false
```

> Priority resolution: `NOMIFUN_MEMORY_DISTILL` environment variable > `[memory].distill_enabled` configuration > default (enabled).

## marketplace

Configures background update polling intervals. Disabled by default.

| Field | Type | Description |
| --- | --- | --- |
| `auto_update_interval_hours` | `integer` | Polling frequency in hours. `0` or omitted disables polling; positive integers enable it |

```toml
# Check official marketplace sources every 6 hours
[marketplace]
auto_update_interval_hours = 6
```

> Background updates apply exclusively to official marketplace endpoints flagged for automated syncing. Checks use HTTP ETag and SHA256 validation to prevent unnecessary payload transfers.

## tools

Host-level tool configuration defining the tool catalog exposed to sessions. Supports subtractive restriction only; disabled capabilities remain unavailable across all host sessions.

> Applies exclusively to the Agent Store host; read once at process startup.

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | `array<string>` | Whitelist: Retains only declared tools when non-empty; empty or omitted indicates no whitelist constraint |
| `disabled` | `array<string>` | Blacklist: Evaluated after the whitelist; matches exact tool names or `mcp__` wildcards |
| `web` | `boolean` | `WebSearch` / `WebExtract` tooling switch; defaults to `true` |
| `computer` | `boolean` | `Computer` desktop control tooling switch; defaults to `true` |
| `browser` | `boolean` | `Browser` automation tooling switch; defaults to `true` |
| `plan` | `boolean` | `EnterPlanMode` / `ExitPlanMode` planning tooling switch; defaults to `true` |
| `lsp` | `boolean` | `Lsp` language service tooling switch; defaults to `true` |
| `domains` | `table` | Functional domain switches mapping to `tools.domains`; each defaults to `true` |

> Core filesystem tools (`Read` / `Write` / `Edit` / `Glob` / `Grep` / `Bash`) are unaffected by boolean flags and must be excluded via `disabled` explicitly.

### tools.domains

| Business domain (domain) | Disabled capability and impact |
| --- | --- |
| `cron` | Scheduled task execution (`cron_create` / `cron_list` / `cron_delete`) |
| `meeting` | Meeting audio analysis and listening contexts (`meeting.*`) |
| `knowledge` | Knowledge base search and retrieval tools (`knowledge_*`) |
| `learning` | Course generation and tracking tools (`learning_*`) |
| `media` | Media synthesis capabilities (`image_generate`) |
| `companion` | Companion memory recall and active suggestion tools (`companion_*`) |
| `requirement` | Requirement pipeline tracking (`requirement_*`) |
| `goal` | Goal-directed autonomous multi-turn loops (`update_goal`) |

Disabling a domain revokes tool access and detaches associated host context listeners.

```toml
# Retain core engineering tools; disable auxiliary domain capabilities
[tools]
web = true
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

### Environment variable override (AGENT_STORE_TOOLS)

The host supports overriding tool configurations dynamically via environment variables:

| Property | Rule and operational behavior |
| --- | --- |
| Format | JSON string matching the `[tools]` table schema; `{}` resets to permissive defaults |
| Precedence | `AGENT_STORE_TOOLS` env variable > `config.toml` > default permissive policy |
| Scope | Completely replaces the `[tools]` table rather than merging fields |
| Fallback | Parsing errors trigger warning logs and revert to the configuration file |
| Lifecycle | Evaluated once during process initialization |

```bash
AGENT_STORE_TOOLS='{"computer":false,"domains":{"knowledge":false}}' agent-store
```

For complete integration examples, refer to the [TypeScript SDK cookbook](/en-US/docs/examples-sdk) §6.3.

## connector_proxy

Authorization policies for proxying external tool calls to installed MCP connectors. Proxying keeps credentials and network sockets isolated within the local host environment.

> Evaluated exclusively by the Agent Store host; excluded from remote APIs and loaded at startup.

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | `boolean` | Master proxy switch; set to `true` to enable proxying, defaults to `false` |
| `allow` | `array<string>` | Whitelist: Permits only matching tools; omitted allows all active connectors |
| `deny` | `array<string>` | Blacklist: Evaluated after the whitelist |

Tool identifiers use the format `mcp__<connector>__<tool>`, supporting wildcard patterns such as `mcp__<connector>__*`.

```toml
[connector_proxy]
enabled = true                    # Enable tool proxying
allow = ["mcp__github__*"]        # Allow tools from GitHub connector only
deny = ["mcp__*__delete_*"]       # Filter destructive operations
```

Evaluation order:

| # | Authorization gate | Failure error code |
| --- | --- | --- |
| 1 | Table absent or `enabled != true` | `policy_denied` |
| 2 | Target connector not found | `not_found` |
| 3 | Configured `allow` list matches no items | `policy_denied` |
| 4 | Matches `deny` blacklist rule | `policy_denied` |
| 5 | Connector is registered but currently disabled | `connector_unavailable` |

> Setting `AGENT_STORE_CONNECTOR_PROXY` to a valid JSON string entirely replaces this configuration table at runtime.

## mcp.json: declaring MCP servers

`mcp.json` resides adjacent to `config.toml` to provide static declarations for local MCP servers:

- **Default path**: `~/.agent-store/mcp.json` (shares directory with active `config.toml`).
- **Loading behavior**: Optional file; loaded at startup, requiring a restart when modified.
- **Storage semantics**: Declarations represent non-persistent runtime views and do not populate the `mcp_servers` database table.
- **Precedence**: Matching names prioritize **`mcp.json` declarations over `mcp_servers` table rows**; runtime invocation bindings take highest precedence.

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

The presence of `command` defines a stdio process; providing `url` without `transport` defines Streamable HTTP; setting `"transport": "sse"` engages the SSE protocol.

| Field | Applies to | Description |
| --- | --- | --- |
| `command` | stdio | Executable path or command |
| `args` | stdio | Command-line arguments array; defaults to empty |
| `env` | stdio | Environment variables map; supports `secret:NAME` references |
| `cwd` | stdio | Working directory; relative paths resolve against the `mcp.json` directory |
| `url` | remote | Remote endpoint URL (defaults to Streamable HTTP) |
| `headers` | remote | Custom HTTP request headers; supports `secret:NAME` references |
| `bearerTokenEnvVar` | remote | Environment variable name storing Bearer credentials |
| `transport` | remote | Protocol override; accepts `"sse"` only |
| `enabled` | all | Toggles server availability; defaults to `true` |
| `deferred` | — | Unsupported; presence causes item validation to fail |
| `startupTimeoutMs` | all | Handshake and initialization timeout in milliseconds; defaults to 30000 |
| `toolTimeoutMs` | all | Wall-clock execution timeout per tool invocation in milliseconds |
| `enabledTools` | all | Whitelist tool pattern array |
| `disabledTools` | all | Blacklist tool pattern array; evaluated after whitelist |

Strict schema validation rejects entries containing unrecognized keys or mismatched transport properties without invalidating surrounding definitions.

### Divergences from reference implementation

Key behavioral differences from standard CLI reference implementations:

- **`deferred` unsupported**: Dynamic tool loading is managed via `ToolSearch` and subtractive policies; explicit `deferred` keys trigger validation failure.
- **User-level scope only**: Operates strictly on `~/.agent-store/mcp.json`, excluding project-level file discovery.
- **Static lifecycle**: Configuration parses once during host startup; modifications take effect on restart.
- **No global timeout inheritance**: Timeout properties must be configured per server definition.
- **Strict timeout limits**: Timeouts are capped at 600,000 ms (10 minutes); entries exceeding this ceiling fail validation.

### Server keys, tool names, and tool filtering

Server keys prefix derived tool identifiers (`mcp__<key>__<tool>`). Keys must consist of alphanumeric characters, underscores, and hyphens, start and end with an alphanumeric character, and not exceed 40 characters in length.

`enabledTools` and `disabledTools` accept two filtering patterns:
- Prefixing with `mcp__`: Matches complete runtime tool identifiers including generated hash suffixes;
- Standard string: Matches local tool names exposed by the server;
- `*`: Wildcard matching all tools provided by the server.

To restrict all tools from a server globally, declare the rule in `[tools]`:

```toml
[tools]
disabled = ["mcp__<key>__*"]
```

### Sensitive credential references (`secret:NAME`)

The `env`, `headers`, and `url` template sections support `secret:NAME` or `${NAME}` syntax. During process execution, the host resolves references against `~/.agent-store/config.toml`'s `[credentials]` table (or process environment variables), preventing plain-text token exposure.

```toml
# Adjacent config.toml
[credentials]
UPSTREAM_TOKEN = "…"    # Injected into secret:UPSTREAM_TOKEN
```

> **Security isolation notice**: Standard management endpoints (such as `config/get` and `config/set`) strictly mask the `[credentials]` table to protect against network scanning and credential dumping. For connectors requiring API Keys or tokens, the host exposes a principal-scoped directed write surface (`connector/credential/set`) that accepts only declared keys from `token-schema.json`. Stored secrets are permanently masked in network payloads (write-only, never echoed); unresolved secret references trigger fail-closed omission and system warnings.

### Web UI management and persistent editing

The Web UI "MCP Management" interface reflects the status of this configuration directly:
- Summarizes registered servers, transport modes, active states, and validation error diagnostics.
- The interface toggles the `enabled` field using text-level minimal edits, preserving indentation and comments.
- Saving edits executes schema validation, blocking corrupt writes and highlighting invalid line positions.

## Comparison with third-party configurations (Kimi Code / Claude Code)

| Dimension | Agent Store | Kimi Code and others |
| --- | --- | --- |
| File path | `~/.agent-store/config.toml` | Tool-specific paths (e.g. `~/.kimi-code/config.toml`) |
| `[providers]` / `[models]` | Identical schema supporting standard parameters | Identical schema with provider-specific variations |
| `max_output_size` | Enforced with 1/4 context window clamping; mandatory for `anthropic` | Inferred automatically from model metadata |
| `default_model` | `"<provider>/<model>"` alias syntax | Identical syntax |
| Unrecognized keys | Permissively preserved | Permissively preserved |
| Environment fallback | Requires explicit configuration file entry | Fallbacks supported by select tools |
| Custom additions | `default_marketplaces`, `[memory]`, `[marketplace]`, `[tools].domains`, `[connector_proxy]`, `[credentials]` | Lacks domain toggles and proxy authorization tables |
| MCP declarations | `~/.agent-store/mcp.json` (user-level only) | Supports project-level `.kimi-code/mcp.json` overrides |

Migration considerations:
- **Provider Enum Compatibility**: Unrecognized provider type strings default to OpenAI-compatible handling.
- **Anthropic Output Limits**: Integrating `anthropic` endpoints mandates an explicit `max_output_size` declaration.
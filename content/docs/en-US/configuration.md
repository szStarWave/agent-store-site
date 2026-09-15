# Configuration file (config.toml)

Agent Store keeps all long-lived preferences in `~/.agent-store/config.toml` (TOML): the default model, API providers, model aliases and default marketplace sources. Change it once, it applies on every start.

- **Default location**: `~/.agent-store/config.toml` (`%USERPROFILE%\.agent-store\config.toml` on Windows).
- **Optional file**: without it the App Server runs fine, but model calls need providers created manually in the Web UI first; with it, declared providers, model defaults and marketplaces are auto-registered on startup.

> This file follows the user-level `config.toml` convention of Claude Code / Codex / Kimi Code (`[providers.<name>]` + `[models."<provider>/<model>"]`). **Unknown top-level and nested keys are tolerated** — the file is yours and may carry settings for other tools (Kimi Code's `thinking`, `permission`, `hooks`, …) without breaking parsing.

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

# Default marketplace sources (auto-registered on first store/market call; hosted by this site)
[default_marketplaces.experts]
source_kind = "url"
source = "https://agent-store.flowyaipc.cn/source/experts/.codebuddy-plugin/marketplace.json"
```

## Top-level fields

| Field | Type | Description |
| --- | --- | --- |
| `default_model` | `string` | Default model alias in `"<provider>/<model>"` form; must resolve through `[models]`; used when the caller sends no model |
| `providers` | `table` | API provider table → `providers` |
| `models` | `table` | Model alias table → `models` |
| `default_marketplaces` | `table` | Marketplace sources auto-registered on startup → `default_marketplaces` |
| `memory` | `table` | Post-session memory policy → `memory` (below) |
| `marketplace` | `table` | Background auto-update cadence → `marketplace` (below) |
| `tools` | `table` | Host-level tool policy (subtractive only) → `tools` (below) |

## `providers`

A table keyed by unique provider name. Agent Store reads credentials **from here only** — no shell environment fallback.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `string` | no | Provider type (maps to the runtime platform), e.g. `openai`, `anthropic` |
| `api_key` | `string` | no | API key, written in plain text in the config file |
| `base_url` | `string` | no | API base URL |
| `enabled` | `boolean` | no | Enables auto-registration; treated as enabled when omitted |

> Key safety: `api_key` is read only for the encrypted provider registration, then dropped — it never appears in logs or tracing payloads. Consider tightening file permissions yourself (`chmod 600`).

## `models`

A table keyed by `"<provider>/<model>"`. `provider` must point to a key declared in `[providers]`.

| Field | Type | Description |
| --- | --- | --- |
| `provider` | `string` | Owning provider key (required) |
| `model` | `string` | Model name sent upstream (required) |
| `display_name` | `string` | Display name in the UI |
| `max_context_size` | `integer` | Context window limit (tokens) |
| `max_output_size` | `integer` | Max output per response (tokens) |
| `capabilities` | `array<string>` | Capability flags, e.g. `["thinking", "tool_use", "image_in"]` |
| `reasoning_key` | `string` | Field name of the reasoning content in responses, e.g. `reasoning_content` |

## `default_marketplaces`

Default marketplace sources (winget-style software sources). The App Server auto-registers them on the first `store` / `market` call; an existing id is reactivated with the new source.

The three sources below are the **built-in defaults a release ships with**: when `config.toml` is missing or declares no `[default_marketplaces]`, the runtime registers exactly these (each carries a `_files.txt`, so the whole entry tree is mirrored); as soon as you declare your own table, only your sources are registered. For the official-versus-third-party distinction see [Plugins and marketplaces](/en-US/docs/plugins-market): only official sources default to auto-update.

| Field | Type | Description |
| --- | --- | --- |
| `source_kind` | `string` | `url` \| `github` \| `git` \| `directory` |
| `source` | `string` | Concrete address; for `url` kinds also provide a directory listing (`_files.txt`) so entry trees can mirror over HTTP |

```toml
[default_marketplaces.experts]
source_kind = "url"
source = "https://agent-store.flowyaipc.cn/source/experts/.codebuddy-plugin/marketplace.json"

[default_marketplaces.workbuddy-skills]
source_kind = "url"
source = "https://agent-store.flowyaipc.cn/source/skills/.codebuddy-skill/marketplace.json"

[default_marketplaces.connectors]
source_kind = "url"
source = "https://agent-store.flowyaipc.cn/source/connectors/.codebuddy-connector/connectors.json"
```

## `memory`

Post-session memory policy. **Distillation** makes one extra model call after every normal turn to distil the session into file-based memory; that call happens **before** the turn's terminal signal, so clients see the answer fully rendered while the conversation still reports "processing" for roughly **6–15 s** (it tracks model latency).

| Field | Type | Description |
| --- | --- | --- |
| `distill_enabled` | `boolean` | `false` disables distillation (no extra model call after the turn, so "answer complete" and "turn finished" coincide); `true` or an absent key keeps the upstream default (**on**) |

```toml
# Skip session-end memory distillation (one less model call per turn, and no
# 6–15 s finalization tail after the answer is complete)
[memory]
distill_enabled = false
```

> Precedence: the `NOMIFUN_MEMORY_DISTILL` environment variable (`0`/`false` off, `1`/`true` on) > this file's `[memory].distill_enabled` > the upstream default (on). Without a `[memory]` section the behaviour is exactly what it was before.

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

> Both gates must hold before anything is fetched: ① the marketplace's auto-update toggle is on, and ② its source address is one of the **official mirrors**. A third-party source keeps its toggle for display but is never polled. Each sweep still goes through `market/refresh`'s revision / ETag short-circuit, so an unchanged source does not re-download the whole tree.

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

When you spawn the host yourself (the SDK's `launchClient`, for example) you do not have to edit this file: the `AGENT_STORE_TOOLS` environment variable takes a JSON document (the same shape as the `[tools]` table) that **replaces** the file's policy wholesale rather than merging with it.

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

## Differences from Kimi Code / Claude Code configs

| Dimension | Agent Store | Kimi Code etc. |
| --- | --- | --- |
| Location | `~/.agent-store/config.toml` | `~/.kimi-code/config.toml` etc. (per-tool directories) |
| `[providers]` / `[models]` | Same shape: `type`/`api_key`/`base_url`, `provider`/`model`/`max_context_size`/`capabilities` | Same shape |
| `default_model` | `"<provider>/<model>"` alias | Same |
| Unknown keys | Tolerated, no error | Tolerated |
| Env fallback | **None** — credentials come from the file only | Some tools support `env`-subtables / env fallbacks |
| Agent Store only | `default_marketplaces`, `[memory]`, `[marketplace]`, `[tools].domains` (`enabled` / `disabled` have the same shape on both sides; the domain switches are ours) | No `domains` switches |

If your config already has `[providers]` / `[models]` sections from Kimi Code or another tool, you can **copy them directly** into `~/.agent-store/config.toml` (as long as the provider speaks an OpenAI/Anthropic-compatible protocol); unrelated sections (`thinking`, `permission`, `hooks`, …) can stay or go — Agent Store ignores them.
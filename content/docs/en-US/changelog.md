# Changelog

This document chronologically records release notes for `@flowy-agent-store/*` packages and serves as the **authoritative public surface for breaking changes**.

For release metadata, distribution tags, and step-by-step migration procedures, refer to the [Upgrade and migration guide](/en-US/docs/upgrade).

## 1. Scope of this page

- **Coverage**: Covers packages published to npm, including `@flowy-agent-store/protocol`, `client`, `sdk`, and platform runtime packages `@flowy-agent-store/runtime-*`.
- **Unreleased Changes**: Features in development within the repository are cataloged in §4 below and §8 of the [Upgrade and migration guide](/en-US/docs/upgrade).
- **Factual Releases**: Documents released updates only; unreleased delivery roadmaps are excluded.
- **Compatibility Principles**: Breaking changes within the beta line ship under incremented prerelease numbers; see §1 of the [Upgrade and migration guide](/en-US/docs/upgrade).

## 2. Published releases (facts)

Retrieve registry metadata:

```bash
npm view @flowy-agent-store/sdk versions dist-tags time --json
```

```json
{
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0-beta.5", "0.1.0-beta.6", "0.1.0-beta.7", "0.1.0-beta.8", "0.1.0-beta.9", "0.1.0-beta.10", "0.1.0-beta.11", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.11", "latest": "0.1.0-beta.2" },
  "time": {
    "0.1.0": "2026-09-09T09:09:04.795Z",
    "0.1.0-beta.2": "2026-09-09T09:27:36.122Z",
    "0.1.0-beta.3": "2026-09-10T04:44:34.609Z",
    "0.1.0-beta.4": "2026-09-16T10:24:02.588Z",
    "0.1.0-beta.5": "2026-09-17T11:41:10.171Z",
    "0.1.0-beta.6": "2026-09-18T11:08:21.813Z",
    "0.1.0-beta.7": "2026-09-20T10:33:48.685Z",
    "0.1.0-beta.8": "2026-09-28T10:23:47.656Z",
    "0.1.0-beta.9": "2026-10-10T04:34:35.842Z",
    "0.1.0-beta.10": "2026-10-12T07:31:25.974Z",
    "0.1.0-beta.11": "2026-10-14T11:18:29.844Z"
  }
}
```

> **Correction (2026-10-14)**: the previous release rounded `0.1.0-beta.10`'s publish time to the whole minute `2026-10-12T07:30:00.000Z`; the registry's actual output is `2026-10-12T07:31:25.974Z`. This block, the matching row in the [Upgrade and migration guide](/en-US/docs/upgrade) §2, and heading §2.2 above are corrected against the registry: the publish date `2026-10-12` is unchanged and every other version's `time` matches the registry verbatim. The `versions` array is ordered oldest-first for readability; its members are the registry's.

| Version | Published (UTC) | Change type | Current dist-tag |
| --- | --- | --- | --- |
| `0.1.0-beta.11` | 2026-10-14 | Breaking (strict protocol fingerprint `fp-14` → `fp-16`; upgrade mandatory) | `beta` |
| `0.1.0-beta.10` | 2026-10-12 | Breaking (strict protocol fingerprint `fp-13` → `fp-14`) | — |
| `0.1.0-beta.9` | 2026-10-10 | Breaking (strict protocol fingerprint `fp-12` → `fp-13`) | — |
| `0.1.0-beta.8` | 2026-09-28 | Breaking (strict protocol fingerprint `fp-8` → `fp-12`) | — |
| `0.1.0-beta.7` | 2026-09-20 | Breaking (strict protocol fingerprint `fp-7` → `fp-8`) | — |
| `0.1.0-beta.6` | 2026-09-18 | Breaking (SDK entry rename + flattened return shape) | — |
| `0.1.0-beta.5` | 2026-09-17 | Breaking (strict protocol fingerprint `fp-1` → `fp-7`) | — |
| `0.1.0-beta.4` | 2026-09-16 | Breaking (strict protocol fingerprint + type narrowing) | — |
| `0.1.0-beta.3` | 2026-09-10 | Additive (non-breaking) | — |
| `0.1.0-beta.2` | 2026-09-09 | Additive (non-breaking) | `latest` |
| `0.1.0` | 2026-09-09 | Initial release | none |

### 2.1 `0.1.0-beta.11` — 2026-10-14T11:18:29Z

> **Breaking change**: The protocol fingerprint incremented from `fp-14` to `fp-16` (one release spanning two steps); clients and runtimes must align versions (see [Upgrade and migration guide](/en-US/docs/upgrade) §6.10).

#### Breaking

- **Protocol Fingerprint Increment**: `fp-14` $\to$ **`fp-16`**. `fp-15` adds `store/categories` for reading a market's category dictionary and tag vocabulary (HTTP `GET /api/app-server/store/categories`), growing wire methods from 82 to **83** and HTTP mapped routes from 55 to **56**; `fp-16` adds and removes no methods — the counts stay 83 / 56 — and only fills fields into existing responses (so no method signature breaks). The handshake still enforces strict equality: SDK and host must be upgraded together.
- **Two `AgentDetail` fields move up to `AgentSummary`**: `tags` and `category_id` move from the expert detail face to the expert list row. Flattened JSON cannot carry the same key in both summary and detail, so the read surface is unified on the summary; `AgentDetail` extends `AgentSummary`, so callers that read `detail.tags` are unaffected.

#### Added

- **Market categories and tags exposed (`fp-15`)**: adds the `store/categories` wire method and the client's `store.categories()` (`AppServerClient` exposes `listStoreCategories()`), returning every **enabled** market's category dictionary (`items: StoreCategory[]`, with `id` / localized `name` / optional `description`) and the market-level tag vocabulary `marketplace_tags` (a position-paired localized array); `StoreItem` gains `category_id` (the raw reference from the source `plugin.json`, e.g. `04-DataAI`) and `category` (the localized name the host resolved through the dictionary — **absent when the id misses the dictionary, the host performs no inference**); `AgentSummary` carries the localized `tags` and `category_id`. The dictionary resolves as "the market's own declared `categories[]` wins; when none declares one, the host's built-in 15-category table answers"; a cold start (no prior `store/list`) also returns the complete market tag vocabulary, and the market root set is replaced wholesale from the **currently enabled** markets.
- **Remaining display faces filled in (`fp-16`)**: `TeamSummary` gains `tags` / `category_id` and `SkillSummary` gains `tags`; `ExpertPack` moves to `pack_format 3` and carries `tags` / `category_id` — the top-level pack takes its own package declaration while **every member pack takes that member's own values** (the opposite scope from the snapshot-level `assets`).
- **Skill tags are fixed to the market index row**: a skill ships no `plugin.json`, so its tags are taken from the market index row at import time and frozen into the snapshot, then read back through the same provenance chain as the icon; a later market edit to those tags only takes effect through an upgrade of that entry — the same rule as the skill's own content.

#### Known boundaries (recorded as-is)

- **The exported pack carries only the bare `category_id`**: resolving it to a name needs an equivalent dictionary. The host provides that dictionary through `store.categories()`, but it does **not travel across hosts**.
- **Skills have no category**: the skill market declares flat tags only, so `SkillSummary` has `tags` but no `category_id`.
- **Connectors have no tag source**: the current market data contains no connector tag field, so a connector entry's tags are always absent.

### 2.2 `0.1.0-beta.10` — 2026-10-12T07:31:25Z

> **Breaking change**: The protocol fingerprint incremented from `fp-13` to `fp-14`; clients and runtimes must align versions (see [Upgrade and migration guide](/en-US/docs/upgrade) §6.9).

#### Breaking

- **Protocol Fingerprint Increment**: `fp-13` $\to$ **`fp-14`**. Adds two **WebSocket-only** methods: `import/assets` (lists a snapshot's plugin-level asset inventory) and `import/asset` (gets single file base64 bytes, same envelope as `skill/file`). Wire methods grow from 80 to **82**; HTTP mapped routes stay at **55** (neither new method has an HTTP binding). The handshake enforces strict equality: old clients connecting to new hosts (or the reverse) are refused outright, requiring coordinated SDK and host upgrades. The handshake capability set gains `snapshot_assets`.

#### Added

- **Expert export carries plugin-level assets**: `ExpertPack` moves to `pack_format 2` with `assets` (a by-reference list of package-level `avatars/`, `bin/`, `scripts/` files: `path` / `kind: "avatar" | "script"` / `size` / sha256 `digest`, sorted by `path`) and `avatar` (package avatar as a snapshot-relative path, present only when listed in `assets`). `materializePack` writes assets to snapshot-relative paths and `ExportResult` gains `writtenAssets` — the exported directory is now a **complete plugin root**: team scripts resolving `PLUGIN_ROOT/bin/init_task.py` and `../../../avatars` locate their targets correctly. Assets are snapshot-scoped: a member pack's `assets` is always empty, reading the top-level pack instead.
- **Operator subtraction**: `[expert_export]` gains a `scripts` key (default `true`, fail-open doctrine unchanged); `false` drops `kind: "script"` entries from the pack's `assets` (avatars unaffected). This setting governs the **package contract**: `import/asset` reads with the same authority as `import/get`, and `skill/files` remains unconstrained by this table.
- **Dangling skills recorded as accepted status (specification note)**: A member's frontmatter `skills:` declaration lacked fulfillment mechanisms in the source runtime (WorkBuddy / CodeBuddy); this project aligns with that behavior and records unresolvable declarations into `danglingSkills` without silent failures or aborting execution. Package-level skills of an official team remain fully bound.

#### Fixed

- **Connector OAuth authorization callback feedback**: Previously, the callback returned "Authorization successful!" immediately upon receiving the authorization code while token exchange executed asynchronously afterwards, causing gateway rate limiting (`slow_down`) to prematurely look completed. The browser now receives the page only after token exchange resolves (a success page, or a "not completed" page with sanitized failure reasons); rejected callbacks (CSRF failure, path mismatch, missing parameters, no pending login) each receive a distinct status page.
- **`connector/auth/status` reports `authorization_pending`**: While browser authorization is actively in progress, the status reports `authorization_pending` (previously indistinguishable from uninitiated flows). This status takes precedence over stored credentials and clears upon flow completion. No wire fields or methods changed, avoiding fingerprint increments.
- **Installing store entries from Web UI aligns with `store.install()`**: Installation previously used the bare `store/install-entry` verb, bypassing the readiness check that enables the disabled connector before probing. Both installation entry points (store page, marketplace management) now route through the state machine.
- **`store.findByConnector(connectorId)` lookup**: Finds the `StoreItem` that installed a given connector by its `id` or runtime `name` (e.g. entry `fenbi-baokao-decision` installs a server named `fenbi_mcp`, which `search()` could not resolve); `StoreOperationOutcome` gains `installedCount`.
- **`MCP_OAUTH_CLIENT_NAME` dynamic branding**: Dynamic client registration announces the host's configured name (environment variable takes precedence, default `Nomifun MCP Client`, empty value treated as unset), allowing private deployments to display custom branding on provider consent screens without binary modifications. Applies to clients registered by this host; existing registrations retain their original names.

### 2.3 `0.1.0-beta.9` — 2026-10-10T04:34:35Z

> **Breaking change**: The protocol fingerprint incremented from `fp-12` to `fp-13`; clients and runtimes must align versions (see [Upgrade and migration guide](/en-US/docs/upgrade) §6.8).

#### Breaking

- **Protocol Fingerprint Increment**: `fp-12` $\to$ **`fp-13`**. Adds two methods on the same face: `market/settings` (read market source policy) and `market/settings-set` (persist changes to `config.toml`). Wire methods grow from 78 to **80**; HTTP mapped routes from 53 to **55**. There is no TypeScript method signature change in this release; caller code remains fully compatible.

#### Added

- **Configurable market source download policy**: Each `[default_marketplaces.<id>]` entry accepts `download_on_start` (defaults to `true`, retaining startup download semantics; `false` registers the record while leaving archive downloads to explicit refresh). `AGENT_STORE_MARKET_DOWNLOAD=eager|lazy|none` overrides process-wide behavior (`none` skips registration entirely), and `AGENT_STORE_CONFIG=<path>` points the host to a custom configuration file.
- **Market policy runtime read/write**: Adds `market/settings` and `market/settings-set` (`GET` / `POST /api/app-server/market-settings`) targeting `~/.agent-store/config.toml` as single truth source. The write interface updates only specified keys and responds by rereading the file, taking effect without restarts. Unknown entry kinds, out-of-range cadences, empty patches, and non-whitelisted fields are rejected without file modifications. The TS client adds `getMarketSettings()` / `setMarketSettings()`, and SDK `SpawnOptions` gains `marketDownload` / `configPath`.
- **Bounded auto-upgrade**: Marketplace `auto_update` expands from "refresh index only" to "refresh index and upgrade entries installed from that market", defaulting to `["agent","team","skill"]`. **Connectors are never implicitly included** (upgrades execute `upsert_server`, disabling servers with altered configurations). Manually disabled entries, blocked entries, and uninstalled imports are excluded; setting `entry_auto_update_kinds = []` restores index-only refreshing. The scheduler evaluates due checks every 60 seconds to support hot configuration reloads; `market/settings` returns the in-memory `last_sweep { at, refreshed, upgraded, failed[] }` state.
- **Market policy card in Settings**: Web UI Settings $\to$ Market Sources gains a host-level policy card (sweep cadence, upgradable entry kinds, connector exclusion warning, and last sweep readings with failure details).

#### Fixed

- **`exportTeam()` exports package-level skills**: Resolves an issue where `ExpertPack` top-level `skills` was hardcoded to an empty array (reading only member frontmatter declarations and omitting package-level skills for teams without member declarations). It now reads installed skill components from the team's own snapshot, deduplicating them with member declarations into `skills/<name>/...`. Protocol and type signatures remain unchanged (see [TypeScript SDK reference](/en-US/docs/typescript-sdk) §4.4).

### 2.4 `0.1.0-beta.8` — 2026-09-28T10:23:47Z

> **Breaking change**: The protocol fingerprint incremented from `fp-8` to `fp-12`; clients and runtimes must align versions (see [Upgrade and migration guide](/en-US/docs/upgrade) §6.7).

#### Breaking

- **Protocol Fingerprint Increment**: `fp-8` $\to$ **`fp-12`**, spanning four fingerprints (`fp-9` through `fp-12`): connector credential read interface, credential form localization, `connector/register`, and `store/update-entry`. Wire methods grow from 73 to **78**; HTTP mapped routes from 48 to **53**.
- **TypeScript Client Signature Change**: `StoreClient.updateHint()` now returns `"update"` instead of `"uninstall_reinstall"`; callers branching on that value must update. `StoreOperationOutcome` gains `errors` and `warnings` fields (backward-compatible additions).

#### Added

- **Connector User Credential System**: Connector metadata gains `credential` configuration and `token-schema.json` declaration support; adds `connector/credential/{get,set,clear}` credential endpoints (values are write-only, responses contain key names and missing entries only) and `connector/register` private MCP server registration; credentials are keyed per principal, with legacy host-level keys attributed to the installation owner.
- **In-Place Safe Store Updates**: Adds `store/update-entry` wire verb with atomic upgrade semantics — the new version installs first and releases the old version only upon success; failures roll back the snapshot while retaining the active version. Expert presets upgrade in place preserving preset IDs, connectors reuse the existing `mcp_servers` row, and skills reside in per-snapshot directories resolving to newest versions. Client provides `store.update()`.
- **SDK Pack Materialization**: `@flowy-agent-store/sdk` adds `exportAgent`, `exportTeam`, and `materializePack`, writing definitions and referenced skills to structured directories (`members/<id>/persona.md` and deduplicated `skills/<name>/...`).

#### Fixed

- **Skill and connector entry version pinning**: Resolved an issue where entry versions were pinned to placeholder `1.0.0` due to unparsed marketplace indices, causing perpetual update indications and immutable snapshot digest collisions. Entry versions now persist with import requests.
- **Install-state writes scoped to snapshots**: Prevents shared component IDs across snapshots from clearing newer installation records upon old version release, narrowing write operations to `(snapshot_id, component_id)`.
- **Filtering empty `values` in connector configurations**: Prevents empty configuration maps from being interpreted as configuration changes that trigger server deactivation.

### 2.5 `0.1.0-beta.7` — 2026-09-20T10:33:48Z

> **Breaking change**: The protocol fingerprint incremented to `fp-8`; clients and runtimes must align versions (see [Upgrade and migration guide](/en-US/docs/upgrade) §6.6).

#### Breaking

- **Protocol Fingerprint Increment**: `fp-7` $\to$ **`fp-8`**. Adds two WebSocket-only methods, `agent/export` and `team/export`, bringing wire methods to **73** while HTTP routes remain 48.

#### Added

- **Asset Serialization**: Wire methods `agent/export` and `team/export` return standardized `ExpertPack` payloads; client adds `agents.export()` and `teams.export()`.
- **Host Memory Switch**: `~/.agent-store/config.toml` adds `enabled` boolean flag under `[memory]` (enabled by default) to disable local memory systems globally.

#### Fixed

- **Model Output Limit Wiring**: Resolves issue where `max_output_size` and `protocol` in `[models.*]` were unpopulated during registration, using non-destructive writes to backfill missing limits.

### 2.6 `0.1.0-beta.6` — 2026-09-18T11:08:21Z

> **Breaking change**: SDK entry point renamed and interface shape flattened (see [Upgrade and migration guide](/en-US/docs/upgrade) §6.5).

#### Breaking

- `launchClient` renamed to **`launchHarness`**; types updated to `Harness` and `HarnessOptions`.
- Removes `.client` nesting, exposing domain clients directly on the harness instance.
- `initializeResult` renamed to **`handshake`**.
- `close()` teardown expanded to manage unsubscription, socket closure, process termination, and temporary data directory deletion.

### 2.7 `0.1.0-beta.5` — 2026-09-17T11:41:10Z

> **Breaking change**: Protocol fingerprint incremented to `fp-7`, breaking compatibility with older runtimes.

#### Breaking

- Protocol fingerprint advances to `fp-7` under strict equality checks.
- `[connector_proxy]` policy update: `allow` becomes an optional whitelist, allowing all active connectors by default when omitted.

#### Added

- **Connector Parameter Schemas**: Exposes `input_schema` and `tools_truncated` in connector models.
- **Dynamic Skill Mounting**: `conversation/send` mounts skills per-turn via `mentions`.
- **Targeted Sessions**: `conversation/create` accepts `agent_id` and `team_id`.
- **Invocation-Level Overrides**: Supports dynamic `model` and `reasoning_effort` overrides.
- **Zip Marketplace Protocol**: Supports single Zip archives for marketplace distribution.

#### Improvements

- Supplying non-skill items in `mentions` returns `invalid_request` rather than being ignored.

#### Fixed

- Resolves issue where `source_kind = "zip"` entries were filtered during configuration parsing.

### 2.8 `0.1.0-beta.4` — 2026-09-16T10:24:02Z

> **Breaking change**: Fingerprint updated to `fp-1`; `event_type` narrowed.

#### Breaking

- Introduces monotonic `fp-<n>` counter fingerprints (starting at `fp-1`).
- `ConversationEvent.event_type` narrows to closed union `ConversationEventType`.

#### Added

- Adds wire methods `run/plan`, `config/get`, `config/set`, `config/get-mcp`, `config/set-mcp`, and `run/answer-decision`.
- Adds skill filesystem read APIs `skill/files` and `skill/file`.
- Adds connector tool invocation proxy `connector/call`.
- Adds `conversation/list-changed` notification.
- Introduces `decodeConversationEvent` utility helper.

#### Improvements

- HTTP route table mapping coverage expanded to 48.

### 2.9 `0.1.0-beta.3` — 2026-09-10T04:44:34Z

#### Added

- Exports `TransportLifecycle`, `onLifecycle`, and `rearm()` subscription methods.
- SDK adds child process exit observation and environment overrides.

#### Improvements

- Adds `engines.node >= 22` and repository metadata in `package.json`.

### 2.10 `0.1.0-beta.2` — 2026-09-09T09:27:36Z

#### Added

- Bundles platform runtime packages as optional dependencies across darwin, linux, and win32.

#### Fixed

- Resolves missing runtime dependencies in `0.1.0`.

### 2.11 `0.1.0` — 2026-09-09T09:09:04Z

#### Added

- Initial release of core package suite.

## 3. Change categories and breaking change rules (D10=A)

| Change type | Version format | Documentation action |
| --- | --- | --- |
| Initial release | Base version | Add entry with "Added" group |
| Additive changes | Prerelease or patch | Categorize into "Added / Improvements / Fixed" |
| Breaking changes | Next prerelease identifier | Add entry with "Breaking" notice and migration guide |

## 4. Unpublished changes and release cadence

**Landed but unpublished** (moved into §2 as published fact on release):

| Batch | Content | Wire protocol | Pointer |
| --- | --- | --- | --- |
| Connector auth field rename | `ConnectorSummary.auth_mode` → `auth_transport`; the authorization affordance now follows `credential.mode` + `status` instead of being derived from the transport's shape | `fp-16` → **`fp-17`** | [TypeScript SDK reference](/en-US/docs/typescript-sdk) §3.3 |
| Catalogue search and prompt hints | `store.search` moves to multi-term AND with three relevance buckets; adds `store.searchWithHits` / `searchInstalled` / `listStatus`; the index row's `examples_*` for skill and connector entries reaches `StoreItem.quick_prompts` | No fingerprint change (still `fp-17` at the time, no methods added or removed) | [TypeScript SDK reference](/en-US/docs/typescript-sdk) §3.3, [SDK cookbook](/en-US/docs/examples-sdk) §4.8 |
| Localized display fields on four entity kinds | Entity summary models (`AgentSummary` / `TeamSummary` / `SkillSummary` / `ConnectorSummary`) uniformly extend optional display fields: `display_name`, `display_description`, `tags`, `quick_prompts`; `agent.get` fields move to summary level (JSON-compatible); connectors gain all four display fields for the first time. Values merge at import from author declarations and market index rows per locale, persisted to snapshots for zero-query reads | `fp-17` → **`fp-18`** | [TypeScript SDK reference](/en-US/docs/typescript-sdk) §3.3 "Display fields on application entities" |

The current stable release is `0.1.0-beta.11` (wire protocol `fp-16`). Features not listed on this page should not be considered active; the unpublished batches have advanced to `fp-18`.

## 5. See also

- [Upgrade and migration guide](/en-US/docs/upgrade): Version metadata, tag rules, and migration steps.
- [TypeScript SDK reference](/en-US/docs/typescript-sdk): Complete API specifications and error models.
- [TypeScript SDK cookbook](/en-US/docs/examples-sdk): Practical code patterns and usage examples.
- [Quick start](/en-US/docs/quick-start): Binary runtime launch guide.

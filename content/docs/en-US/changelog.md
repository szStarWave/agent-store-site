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
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0-beta.5", "0.1.0-beta.6", "0.1.0-beta.7", "0.1.0-beta.8", "0.1.0-beta.9", "0.1.0-beta.10", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.10", "latest": "0.1.0-beta.2" },
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
    "0.1.0-beta.10": "2026-10-12T07:30:00.000Z"
  }
}
```

| Version | Published (UTC) | Change type | Current dist-tag |
| --- | --- | --- | --- |
| `0.1.0-beta.10` | 2026-10-12 | Breaking (strict protocol fingerprint `fp-13` → `fp-14`) | `beta` |
| `0.1.0-beta.9` | 2026-10-10 | Breaking (strict protocol fingerprint `fp-12` → `fp-13`) | — |
| `0.1.0-beta.8` | 2026-09-28 | Breaking (strict protocol fingerprint `fp-8` → `fp-12`) | — |
| `0.1.0-beta.7` | 2026-09-20 | Breaking (strict protocol fingerprint `fp-7` → `fp-8`) | — |
| `0.1.0-beta.6` | 2026-09-18 | Breaking (SDK entry rename + flattened return shape) | — |
| `0.1.0-beta.5` | 2026-09-17 | Breaking (strict protocol fingerprint `fp-1` → `fp-7`) | — |
| `0.1.0-beta.4` | 2026-09-16 | Breaking (strict protocol fingerprint + type narrowing) | — |
| `0.1.0-beta.3` | 2026-09-10 | Additive (non-breaking) | — |
| `0.1.0-beta.2` | 2026-09-09 | Additive (non-breaking) | `latest` |
| `0.1.0` | 2026-09-09 | Initial release | none |

### 2.1 `0.1.0-beta.10` — 2026-10-12T07:30:00Z

> **Breaking change**: The protocol fingerprint incremented from `fp-13` to `fp-14`; clients and runtimes must align versions (see [Upgrade and migration guide](/en-US/docs/upgrade) §6.9).

#### Breaking

- **Protocol Fingerprint Increment**: `fp-13` $\to$ **`fp-14`**. Adds two **WebSocket-only** methods: `import/assets` (lists a snapshot's plugin-level asset inventory) and `import/asset` (one file's bytes base64, same envelope as `skill/file`). Wire methods grow from 80 to **82**; HTTP mapped routes stay at **55** (neither new method has an HTTP binding). The handshake is still strict-equality: an old client against a new host (or the reverse) is refused outright, so the SDK and the host must upgrade together. The handshake capability set gains `snapshot_assets`.

#### Added

- **Expert export carries plugin-level assets**: `ExpertPack` moves to `pack_format 2` with `assets` (a by-reference list of the package-level `avatars/`, `bin/`, `scripts/` files: `path` / `kind: "avatar" | "script"` / `size` / sha256 `digest`, sorted by `path`) and `avatar` (the package avatar as a snapshot-relative path, present only when that file is actually listed in `assets`). `materializePack` writes the assets at their snapshot-relative paths and `ExportResult` gains `writtenAssets` — the exported directory is now a **complete plugin root**: a team whose own scripts resolve `PLUGIN_ROOT/bin/init_task.py` (two levels above its skill) and `../../../avatars` finds them. Assets are snapshot-scoped: a member pack's `assets` is always empty; read the top-level pack.
- **Operator subtraction**: `[expert_export]` gains a `scripts` key (default `true`, the fail-open doctrine unchanged); `false` drops the `kind: "script"` entries from the pack's `assets` (avatars unaffected). Honest boundary: it shapes the **pack contract**, not the byte face — `import/asset` reads with the same authority as `import/get`, exactly as `skill/files` was never gated by this table.
- **Dangling skills are accepted behaviour (decision record)**: a member's frontmatter `skills:` declaration never had a fulfillment mechanism in the source runtime (WorkBuddy/CodeBuddy); this project aligns with that, and reports unresolvable declarations honestly into `danglingSkills` (never silently, never aborting). Package-level skills of an official team never dangle.

#### Fixed

- **The connector authorization page no longer lies**: the callback answered "Authorization successful!" as soon as the code arrived, while the token exchange ran after it — a login throttled by a gateway (`slow_down`) looked finished in the window, so the user closed it and never retried. The browser now receives its page only once the exchange has a verdict: a success page, or a "not completed" page with the sanitized reason; refused callbacks (CSRF, path mismatch, missing code/state, no pending login) each get a user-facing page too.
- **`connector/auth/status` reports `authorization_pending`**: while a browser flow is running the status says so (before, "waiting for the user" and "never started" were the same answer on the wire). It outranks the stored credential and disappears with the flow. No field/method/event change, so no fingerprint bump.
- **Installing a store entry from the Web UI goes through the SDK's `store.install()`**: the buttons used the bare `store/install-entry` verb, bypassing the "a connector registers as disabled; readiness enables it and probes" step — a connector installed from the store page stayed disabled. Both install entries (store page, market management) now use the state machine.
- **`store.findByConnector(connectorId)`**: finds the `StoreItem` that installed a given connector by its `id` or runtime `name` (the entry `fenbi-baokao-decision` installs a server called `fenbi_mcp`, which `search()` could not answer); `StoreOperationOutcome` gains `installedCount`.
- **`MCP_OAUTH_CLIENT_NAME`**: dynamic client registration announces the host's own name (env wins, built-in default `Nomifun MCP Client`, empty counts as unset), so a private deployment shows its own branding on the provider's consent page without patching the binary; it applies to clients this host registers itself, and an existing registration keeps the name it was created with.

### 2.2 `0.1.0-beta.9` — 2026-10-10T04:34:35Z

> **Breaking change**: The protocol fingerprint incremented from `fp-12` to `fp-13`; clients and runtimes must align versions (see [Upgrade and migration guide](/en-US/docs/upgrade) §6.8).

#### Breaking

- **Protocol Fingerprint Increment**: `fp-12` $\to$ **`fp-13`**. Adds two methods on the same face: `market/settings` (read the market source policy) and `market/settings-set` (write through to `config.toml`). Wire methods grow from 78 to **80**; HTTP mapped routes from 53 to **55**. There is **no** TypeScript signature change in this release, so caller code is unaffected.

#### Added

- **Configurable market source download policy**: each `[default_marketplaces.<id>]` entry accepts `download_on_start` (defaults to `true`, keeping the old "writing the entry downloads it at boot" semantics; `false` registers the row and leaves the archive to an explicit refresh). `AGENT_STORE_MARKET_DOWNLOAD=eager|lazy|none` overrides the whole process (`none` does not even register), and `AGENT_STORE_CONFIG=<path>` points the host at a caller-owned config file — the precondition that makes the per-source field usable from the SDK.
- **Market policy is readable and writable while running**: adds `market/settings` and `market/settings-set` (`GET` / `POST /api/app-server/market-settings`). The single source of truth is `~/.agent-store/config.toml`: the write face edits only the named keys and answers by reading the file back, so saving takes effect without a restart, while unknown entry kinds, out-of-range cadences, empty patches and non-whitelisted fields are refused without touching the file. The TS client adds `getMarketSettings()` / `setMarketSettings()`, and the SDK's `SpawnOptions` gains `marketDownload` / `configPath`.
- **Bounded auto-upgrade**: a market's `auto_update` grows from "refresh the index" to "refresh the index and upgrade the entries installed from that market", with the default whitelist `["agent","team","skill"]`. **Connectors are never implicit** (upgrading one runs `upsert_server`, which disables a server whose configuration changed — unattended that is a silent outage). Entries you switched off by hand, entries carrying a `blocked_reason`, and entries that were only imported are never touched; `entry_auto_update_kinds = []` restores the index-only behaviour. The scheduler moved from a fixed interval at startup to a 60-second due check, so the cadence is now hot-changeable; the reading `last_sweep { at, refreshed, upgraded, failed[] }` comes back with `market/settings` (in memory only, never written to disk).
- **Market policy card in Settings**: the WebUI's Settings → Market Sources page gains a host-level policy card (sweep cadence, upgradable entry kinds, the connector exclusion warning, and the last sweep reading with its failures), in both Chinese and English.

#### Fixed

- **`exportTeam()` now exports a team's own package-level skills**: a team `ExpertPack`'s top-level `skills` used to be hard-coded to an empty array while member skills came only from each member agent's frontmatter, so teams that declare their skills once at the package level — for example `stock-partner-team`, three package skills and zero declarations across seven members — exported with no skills at all. It now reads the skill components **that team's own snapshot installed**, and `materializePack` deduplicates them with the member declarations into `skills/<name>/...`. No wire or type shape change (see the [TypeScript SDK reference](/en-US/docs/typescript-sdk) §4.4).

### 2.3 `0.1.0-beta.8` — 2026-09-28T10:23:47Z

> **Breaking change**: The protocol fingerprint incremented from `fp-8` to `fp-12`; clients and runtimes must align versions (see [Upgrade and migration guide](/en-US/docs/upgrade) §6.7).

#### Breaking

- **Protocol Fingerprint Increment**: `fp-8` $\to$ **`fp-12`**, spanning four fingerprints (`fp-9` through `fp-12`): the connector credential read face, the credential form copy move, `connector/register`, and `store/update-entry`. Wire methods grow from 73 to **78**; HTTP mapped routes from 48 to **53**.
- **TypeScript Client Signature Change**: `StoreClient.updateHint()` now returns `"update"` instead of `"uninstall_reinstall"`; callers branching on that value must be updated. `StoreOperationOutcome` gains `errors` and `warnings` (additive; existing callers are unaffected).

#### Added

- **Connector User Credential System**: Connector metadata gains a `credential` block and `token-schema.json` declarations; adds `connector/credential/{get,set,clear}` (values are write-only — responses carry key names and missing entries only) and `connector/register`, which lets an MCP server the host never imported carry a credential form derived from its own template (a `${secret:NAME}` in the `transport` *is* the declaration). Credentials are keyed per caller (principal), with host-level legacy keys attributed to the installation owner.
- **In-Place Safe Store Updates**: Adds the `store/update-entry` wire verb with atomic upgrade semantics — the new version is installed first and the previous one is released only when that succeeded; a failure keeps the previous version in place and rolls the new snapshot back. Expert presets upgrade in place preserving their preset id, connectors reuse the same `mcp_servers` row, and skills live in per-snapshot directories with resolution picking the newest. Client adds `store.update()`.
- **SDK Pack Materialization**: `@flowy-agent-store/sdk` adds `exportAgent`, `exportTeam`, and `materializePack`, writing definitions and referenced skills to structured directories (`members/<id>/persona.md` and deduplicated `skills/<name>/...`).

#### Fixed

- **Skill and connector entry versions were pinned at the `1.0.0` placeholder**: the catalog read the marketplace index while the importer did not, so "update available" was permanently true and any content change collided with the immutable snapshot. Entry versions now reach the importer, and the skill-market index is read at all.
- **Install-state writes were not snapshot-scoped**: component ids are shared across snapshots, so releasing an old version also cleared the new version's install record; the three write paths now narrow on `(snapshot_id, component_id)`.
- **An empty `values` map was written into the stored connector transport config**: the next save was read as a configuration change, disabling the server and clearing its probed tools; it is now written only when non-empty.

### 2.4 `0.1.0-beta.7` — 2026-09-20T10:33:48Z

> **Breaking change**: The protocol fingerprint incremented to `fp-8`; clients and runtimes must align versions (see [Upgrade and migration guide](/en-US/docs/upgrade) §6.6).

#### Breaking

- **Protocol Fingerprint Increment**: `fp-7` $\to$ **`fp-8`**. Adds two WebSocket-only methods, `agent/export` and `team/export`, bringing wire methods to **73** while HTTP routes remain 48.

#### Added

- **Asset Serialization**: Wire methods `agent/export` and `team/export` return standardized `ExpertPack` payloads; client adds `agents.export()` and `teams.export()`.
- **Host Memory Switch**: `~/.agent-store/config.toml` adds `enabled` boolean flag under `[memory]` (enabled by default) to disable local memory systems globally.

#### Fixed

- **Model Output Limit Wiring**: Resolves issue where `max_output_size` and `protocol` in `[models.*]` were unpopulated during registration, using non-destructive writes to backfill missing limits.

### 2.5 `0.1.0-beta.6` — 2026-09-18T11:08:21Z

> **Breaking change**: SDK entry point renamed and interface shape flattened (see [Upgrade and migration guide](/en-US/docs/upgrade) §6.5).

#### Breaking

- `launchClient` renamed to **`launchHarness`**; types updated to `Harness` and `HarnessOptions`.
- Removes `.client` nesting, exposing domain clients directly on the harness instance.
- `initializeResult` renamed to **`handshake`**.
- `close()` teardown expanded to manage unsubscription, socket closure, process termination, and temporary data directory deletion.

### 2.6 `0.1.0-beta.5` — 2026-09-17T11:41:10Z

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

### 2.7 `0.1.0-beta.4` — 2026-09-16T10:24:02Z

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

### 2.8 `0.1.0-beta.3` — 2026-09-10T04:44:34Z

#### Added

- Exports `TransportLifecycle`, `onLifecycle`, and `rearm()` subscription methods.
- SDK adds child process exit observation and environment overrides.

#### Improvements

- Adds `engines.node >= 22` and repository metadata in `package.json`.

### 2.9 `0.1.0-beta.2` — 2026-09-09T09:27:36Z

#### Added

- Bundles platform runtime packages as optional dependencies across darwin, linux, and win32.

#### Fixed

- Resolves missing runtime dependencies in `0.1.0`.

### 2.10 `0.1.0` — 2026-09-09T09:09:04Z

#### Added

- Initial release of core package suite.

## 3. Change categories and breaking change rules (D10=A)

| Change type | Version format | Documentation action |
| --- | --- | --- |
| Initial release | Base version | Add entry with "Added" group |
| Additive changes | Prerelease or patch | Categorize into "Added / Improvements / Fixed" |
| Breaking changes | Next prerelease identifier | Add entry with "Breaking" notice and migration guide |

## 4. Unpublished changes and release cadence

**There are currently no landed-but-unpublished entries**: the `0.1.0-beta.10` content moved into §2 above as published fact. The next batch is registered here and promoted to §2 on release.

The current stable release is `0.1.0-beta.9` (wire protocol `fp-13`). Features not listed on this page should not be considered active.

## 5. See also

- [Upgrade and migration guide](/en-US/docs/upgrade): Version metadata, tag rules, and migration steps.
- [TypeScript SDK reference](/en-US/docs/typescript-sdk): Complete API specifications and error models.
- [TypeScript SDK cookbook](/en-US/docs/examples-sdk): Practical code patterns and usage examples.
- [Quick start](/en-US/docs/quick-start): Binary runtime launch guide.

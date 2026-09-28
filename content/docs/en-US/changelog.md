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
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0-beta.5", "0.1.0-beta.6", "0.1.0-beta.7", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.7", "latest": "0.1.0-beta.2" },
  "time": {
    "0.1.0": "2026-09-09T09:09:04.795Z",
    "0.1.0-beta.2": "2026-09-09T09:27:36.122Z",
    "0.1.0-beta.3": "2026-09-10T04:44:34.609Z",
    "0.1.0-beta.4": "2026-09-16T10:24:02.588Z",
    "0.1.0-beta.5": "2026-09-17T11:41:10.171Z",
    "0.1.0-beta.6": "2026-09-18T11:08:21.813Z",
    "0.1.0-beta.7": "2026-09-20T10:33:48.685Z"
  }
}
```

| Version | Published (UTC) | Change type | Current dist-tag |
| --- | --- | --- | --- |
| `0.1.0-beta.7` | 2026-09-20 | Breaking (strict protocol fingerprint `fp-7` → `fp-8`) | `beta` |
| `0.1.0-beta.6` | 2026-09-18 | Breaking (SDK entry rename + flattened return shape) | — |
| `0.1.0-beta.5` | 2026-09-17 | Breaking (strict protocol fingerprint `fp-1` → `fp-7`) | — |
| `0.1.0-beta.4` | 2026-09-16 | Breaking (strict protocol fingerprint + type narrowing) | — |
| `0.1.0-beta.3` | 2026-09-10 | Additive (non-breaking) | — |
| `0.1.0-beta.2` | 2026-09-09 | Additive (non-breaking) | `latest` |
| `0.1.0` | 2026-09-09 | Initial release | none |

### 2.1 `0.1.0-beta.7` — 2026-09-20T10:33:48Z

> **Breaking change**: The protocol fingerprint incremented to `fp-8`; clients and runtimes must align versions (see [Upgrade and migration guide](/en-US/docs/upgrade) §6.6).

#### Breaking

- **Protocol Fingerprint Increment**: `fp-7` $\to$ **`fp-8`**. Adds two WebSocket-only methods, `agent/export` and `team/export`, bringing wire methods to **73** while HTTP routes remain 48.

#### Added

- **Asset Serialization**: Wire methods `agent/export` and `team/export` return standardized `ExpertPack` payloads; client adds `agents.export()` and `teams.export()`.
- **Host Memory Switch**: `~/.agent-store/config.toml` adds `enabled` boolean flag under `[memory]` (enabled by default) to disable local memory systems globally.

#### Fixed

- **Model Output Limit Wiring**: Resolves issue where `max_output_size` and `protocol` in `[models.*]` were unpopulated during registration, using non-destructive writes to backfill missing limits.

### 2.2 `0.1.0-beta.6` — 2026-09-18T11:08:21Z

> **Breaking change**: SDK entry point renamed and interface shape flattened (see [Upgrade and migration guide](/en-US/docs/upgrade) §6.5).

#### Breaking

- `launchClient` renamed to **`launchHarness`**; types updated to `Harness` and `HarnessOptions`.
- Removes `.client` nesting, exposing domain clients directly on the harness instance.
- `initializeResult` renamed to **`handshake`**.
- `close()` teardown expanded to manage unsubscription, socket closure, process termination, and temporary data directory deletion.

### 2.3 `0.1.0-beta.5` — 2026-09-17T11:41:10Z

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

### 2.4 `0.1.0-beta.4` — 2026-09-16T10:24:02Z

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

### 2.5 `0.1.0-beta.3` — 2026-09-10T04:44:34Z

#### Added

- Exports `TransportLifecycle`, `onLifecycle`, and `rearm()` subscription methods.
- SDK adds child process exit observation and environment overrides.

#### Improvements

- Adds `engines.node >= 22` and repository metadata in `package.json`.

### 2.6 `0.1.0-beta.2` — 2026-09-09T09:27:36Z

#### Added

- Bundles platform runtime packages as optional dependencies across darwin, linux, and win32.

#### Fixed

- Resolves missing runtime dependencies in `0.1.0`.

### 2.7 `0.1.0` — 2026-09-09T09:09:04Z

#### Added

- Initial release of core package suite.

## 3. Change categories and breaking change rules (D10=A)

| Change type | Version format | Documentation action |
| --- | --- | --- |
| Initial release | Base version | Add entry with "Added" group |
| Additive changes | Prerelease or patch | Categorize into "Added / Improvements / Fixed" |
| Breaking changes | Next prerelease identifier | Add entry with "Breaking" notice and migration guide |

## 4. Unpublished changes and release cadence

**Recently Implemented and Planned Capabilities (Pre-release or staged)**:
- **Connector User Credential System (fp-9 through fp-11)**: Adds `credential` block and `token-schema.json` support to connectors; introduces `connector/credential/{get,set,clear}` management APIs and `connector/register` dynamic template MCP registration; enforces payload masking (`[REDACTED]`) with write-only encryption at rest.
- **SDK Pack Materialization (0.1.0-beta.8)**: Adds `exportAgent`, `exportTeam`, and `materializePack` helpers in `@flowy-agent-store/sdk` to serialize definitions and assets to structured disk directories (`members/<id>/persona.md` and deduplicated `skills/<name>/...`).
- **In-Place Safe Store Updates (fp-12)**: Introduces `store/update-entry` wire verb (wire protocol `fp-12`, total methods expanded to **78**, HTTP mapped routes to **53**); guarantees atomic upgrades (installs new version, verifies readiness, and releases old version with safe fallbacks); updates expert presets in place preserving preset IDs; equips client with `store.update()` and `updateHint`.

The current stable release is `0.1.0-beta.7` (wire protocol `fp-8`). Features not listed on this page should not be considered active.

## 5. See also

- [Upgrade and migration guide](/en-US/docs/upgrade): Version metadata, tag rules, and migration steps.
- [TypeScript SDK reference](/en-US/docs/typescript-sdk): Complete API specifications and error models.
- [TypeScript SDK cookbook](/en-US/docs/examples-sdk): Practical code patterns and usage examples.
- [Quick start](/en-US/docs/quick-start): Binary runtime launch guide.

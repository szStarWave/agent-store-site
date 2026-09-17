# Changelog

This page records what changed in every **published** release of `@flowy-agent-store/*`, and it is the **single announcement surface for breaking changes**.

Release facts (publish times, dist-tag targets, how artifact differences were verified) live in the [Upgrade and migration guide](/en-US/docs/upgrade); this page answers only "what changed in each version".

## 1. Scope of this page

- **Published npm versions only**: `@flowy-agent-store/protocol`, `client`, `sdk`, plus the `@flowy-agent-store/runtime-*` platform packages shipped alongside the sdk.
- **Unpublished work never becomes an entry here**: differences that exist in the working tree but have not shipped in any release are recorded only in §8 of the [Upgrade and migration guide](/en-US/docs/upgrade) and in §4 below.
- **No dates are promised**: this page never says "coming soon" or "planned for"; entries are appended only **after** a release.
- Version-number semantics and the compatibility stance (no backward compatibility during beta, breaking changes take a minor number) are in §1 of the [Upgrade and migration guide](/en-US/docs/upgrade) and in §3 below.

## 2. Published versions (facts)

All three packages and the platform runtime packages currently share one version set. To reproduce:

```bash
npm view @flowy-agent-store/sdk versions dist-tags time --json
```

```json
{
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0-beta.5", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.5", "latest": "0.1.0-beta.2" },
  "time": {
    "0.1.0": "2026-09-09T09:09:04.795Z",
    "0.1.0-beta.2": "2026-09-09T09:27:36.122Z",
    "0.1.0-beta.3": "2026-09-10T04:44:34.609Z",
    "0.1.0-beta.4": "2026-09-16T10:24:02.588Z",
    "0.1.0-beta.5": "2026-09-17T11:41:10.171Z"
  }
}
```

| Version | Released (UTC) | Change type | Current dist-tag |
| --- | --- | --- | --- |
| `0.1.0-beta.5` | 2026-09-17 | Breaking (strict-equality protocol fingerprint: `fp-1` → `fp-7`) | `beta` |
| `0.1.0-beta.4` | 2026-09-16 | Breaking (strict-equality protocol fingerprint + type narrowing) | — |
| `0.1.0-beta.3` | 2026-09-10 | Additive (no breaking change) | — |
| `0.1.0-beta.2` | 2026-09-09 | Additive (no breaking change) | `latest` |
| `0.1.0` | 2026-09-09 | First release | none |

The `versions` array is **not** in chronological order: `0.1.0` is listed last but was the **earliest** release (about 18 minutes before `beta.2`), and it carries no dist-tag. It is not a stable release and it is not newer than the beta line — for dist-tag semantics see §3 of the [Upgrade and migration guide](/en-US/docs/upgrade).

### 2.1 `0.1.0-beta.5` — 2026-09-17T11:41:10Z

> **This release contains breaking changes**: clients on `0.1.0-beta.4` or earlier **cannot connect** to this runtime and must be upgraded along with it (steps in §6.4 of the [Upgrade and migration guide](/en-US/docs/upgrade)).

- **Breaking — the protocol fingerprint jumped from `fp-1` to `fp-7`**: this version publishes in one go the six increments accumulated in the working tree. The fingerprint **changes no wire behaviour**, but the handshake and the SDK compare it with **strict equality**, so a client built against `fp-1` is rejected by this runtime. When injecting your own binary through `AGENT_STORE_BIN`, upgrade the SDK and the binary together.
- **Additive — `fp-2`, the connector tool parameter surface**: `ConnectorTool` gained `input_schema` (the upstream `tools/list` schema, as-is), and `ConnectorDetail` / `ConnectorProbeResult` gained `tools_truncated` (an **honest omission** that respects the host's tool budget — a schema is either carried whole or not at all). The same batch changed the **host config** `[connector_proxy]` grant shape: `allow` became optional and narrower in meaning, `deny` was added, and `enabled = true` now means **callable by default**, replacing the mandatory per-tool allowlist — a change on the host-config surface that does not alter the npm packages' type surface, but a self-built host needs to re-read that table.
- **Additive — `fp-3`, a Skill can be mounted per turn**: `conversation/send`'s `mentions` honours **`kind: "skill"` only**, and `agent` / `connector` are **explicitly refused with `invalid_request`**. Note that the **type surface of `MentionRef` / `mentions` already existed in `0.1.0-beta.4`'s published declarations** (that version's `index.d.mts` already carried `MentionKind` / `MentionRef` and both `mentions` fields); what this version brings is the host-side semantics, plus the fingerprint increment that follows.
- **Additive — `fp-4`, a conversation can be created as an installed expert**: `conversation/create` gained `agent_id`. The expert's preset identity, together with its own Skills and Connectors, is **frozen** into the conversation and cannot be rewritten afterwards (changing the expert means creating another conversation).
- **Additive — `fp-5`, a team's Leader conversation**: `conversation/create` gained `team_id`, which shares the same orchestration as `team/run` (member checks, template, conversation fences); the only difference is that it **does not send the `goal` first turn** — the caller speaks first. `agent_id` and `team_id` are **mutually exclusive**.
- **Additive — `fp-6`, the model and reasoning level can be chosen per call**: `conversation/send` and `agent/run` each gained `model` / `reasoning_effort`, and `ConversationView` gained `reasoning_effort` (three write paths already existed, yet there was no read face at all). The semantics are **sticky**: a value passed to `send` is written into the conversation row, takes effect **from that message onwards** and is reused by every later turn; a value passed to `agent/run` applies to **that run** only. While a conversation is running a turn, `send` refuses the switch (`conflict`).
- **Additive — `fp-7`, the marketplace source gained a `zip` kind**: `MarketplaceSourceKind` gained `"zip"` — an **HTTP(S) archive** whose **archive root is the market root** (the manifest sits at the archive root, with no wrapper folder). The three official markets (`experts` / `skills` / `connectors`) accordingly moved off this site's `/source/<market>/…` file-per-entry tree and onto three zip archives on ModelScope; the archive's sha256 is the revision (a `HEAD` to the stable URL reads `X-Linked-Etag`), so unchanged content is never downloaded. `url` / `github` / `git` / `directory` all remain, and third-party sources can still mirror a whole tree. For the hand-migration of an existing config see §8.1 of the [Upgrade and migration guide](/en-US/docs/upgrade).
- **No methods added or removed**: the client still maps **48 / 71** methods over HTTP.
- **Upgrade impact**: upgrading is **mandatory** (the fingerprint is compared for strict equality) and **no code changes are required** — fetch the published artifacts of two adjacent versions and read them side by side (commands in §8 of the [Upgrade and migration guide](/en-US/docs/upgrade)): the 141 exports are **neither more nor fewer**, the only additions are optional fields, and no declaration was narrowed or deleted.

### 2.2 `0.1.0-beta.4` — 2026-09-16T10:24:02Z

> **This release contains breaking changes**: clients on `0.1.0-beta.3` or earlier **cannot connect** to this runtime and must be upgraded along with it (steps in §6.3 of the [Upgrade and migration guide](/en-US/docs/upgrade)).

- **Breaking — the protocol fingerprint became a strict-equality counter**: the value moved from a date stamp to `fp-1` (shape `fp-<n>`). It **changes no wire behaviour**, but the handshake and the SDK compare it with **strict equality**, so a client built against the old value is rejected by the new runtime. When injecting your own binary through `AGENT_STORE_BIN`, upgrade the SDK and the binary together.
- **Breaking — `event_type` narrowed**: `ConversationEvent`'s `event_type` went from an open union (with a `| string` escape hatch) to the closed type `ConversationEventType`, and the in-package decoder `decodeConversationEvent` was added (it folds an event into a `kind`-discriminated `DecodedConversationEvent`). Code that reads `ConversationEvent.event_type` and treats it as a `string` will start failing type checks; `RunEvent.event_type` is a **separate** declaration that stays a deliberately open `string` and is unaffected. **All three earlier published versions still carry that `| string`** (reproduce it as in §8 of the [Upgrade and migration guide](/en-US/docs/upgrade)).
- **Additive — wire-method additions**: `run/plan`, `config/get`, `config/set`, `config/get-mcp`, `config/set-mcp`, `config/set-mcp-enabled`, `run/answer-decision`, plus marketplace entry snapshots and `store/list`'s `published_at`.
- **Additive — Skill file-tree read face** `skill/files` / `skill/file`: a Skill is a directory and only `SKILL.md` used to be readable. On the server `skill/file` answers with raw bytes plus a `content-type` (not a JSON envelope), so it is not in the JSON transport's route table. The client's mapped-over-HTTP method count is now **48 / 71** (measured against this release's published artifacts; see §5.3 of the [TypeScript SDK reference](/en-US/docs/typescript-sdk)).
- **Additive — Connector call proxy** `connector/call`: the host holds the connection and its credentials and runs the MCP tool for the caller; **off by default**, needs a `[connector_proxy]` allowlist; a tool-level failure comes back as `is_error` rather than throwing.
- **Additive — new notification** `conversation/list-changed`: the conversation **list** projection's `created` / `updated` / `deleted`; no subscription required, no `sequence`.
- **Upgrade impact**: **code changes are required** (type narrowing) and upgrading is **mandatory** (the fingerprint is compared for strict equality); steps are in §6.3 of the [Upgrade and migration guide](/en-US/docs/upgrade).

### 2.3 `0.1.0-beta.3` — 2026-09-10T04:44:34Z

- **client**: new public declarations `TransportLifecycle`, `onLifecycle`, `connectTimeoutMs`, and `rearm()` on the subscription state machine.
- **sdk**: new public declarations `assertProtocolCompatible`, `SpawnOptions.env` / `cwd` / `onExit`, `SpawnedServer.exited`, `SpawnExitInfo`.
- **`package.json` metadata**: client and sdk gained `engines.node >= 22`, `repository`, `sideEffects`.
- **protocol**: type declarations **unchanged, byte for byte**.
- **Upgrade impact**: moving up from `0.1.0-beta.2` requires **no code changes**; steps are in §6.1 of the [Upgrade and migration guide](/en-US/docs/upgrade).

### 2.4 `0.1.0-beta.2` — 2026-09-09T09:27:36Z

- **sdk**: `optionalDependencies` filled in, pinning five platform runtime packages at the same version — `runtime-win32-x64`, `runtime-linux-x64`, `runtime-linux-arm64`, `runtime-darwin-x64`, `runtime-darwin-arm64`.
- The earlier `0.1.0` lacks that dependency set, so `launchClient` could fail to find the executable (see §6.2 of the [Upgrade and migration guide](/en-US/docs/upgrade)).
- This is the version `latest` currently points at — **it is not the newest one**.

### 2.5 `0.1.0` — 2026-09-09T09:09:04Z

- **First release**: the first public version of all three packages; there was no earlier version to break, so it carries no breaking changes.
- The three packages' **code and type declarations are byte-for-byte identical to `0.1.0-beta.2`**; the only difference is `package.json` — the sdk had **no** `optionalDependencies` at that point.
- Carries no dist-tag.

> Those "substantive differences from the previous version" come from byte-for-byte comparison of artifacts fetched with `npm pack`; the raw records are row R4 of plan doc `16` and the R4 landing note in `21`. This page only summarises them and adds no new evidence.

## 3. Change types and the breaking-change announcement rule (D10=A)

Stance: **no backward compatibility is promised during beta**, and a breaking change ships under the **next pre-release counter** (`0.1.0-beta.N` → `0.1.0-beta.N+1`) with the entry marked "breaking"; a **minor** number (`0.1.x` → `0.2.0`) is reserved for breaking changes **after beta** — there is no stable release to break yet, hence no major numbers.

| Change type | Version number | Action on this page |
| --- | --- | --- |
| First release | the version itself | add an entry marked "first release" |
| Additive (new declarations, new dependencies, metadata) | patch / pre-release counter | add an entry marked "additive (no breaking change)" |
| Breaking (type narrowing, methods added or removed, event-surface changes) | inside beta: **the next pre-release counter**; after beta: **minor number** | add an entry marked "breaking" with the migration path |

> **Stance revised (2026-09-16)**: it used to say breaking changes "take a minor number", which did not match how the beta line actually ships — `0.1.0-beta.4` carries the `event_type` narrowing and the strict-equality protocol fingerprint, yet is still a pre-release counter. It now reads: inside beta, breaking changes ship under the next pre-release counter and are marked one by one; the minor number is reserved for breaking changes after beta. **This revision does not affect the version number or publish date of any published entry** (see "Never rewritten" below).

**This page is the only announcement surface for breaking changes**: they are not announced through commit messages, chat history or release pages — only an entry here marked "breaking" with a migration path counts as an announcement (version-number rules in §1 of the [Upgrade and migration guide](/en-US/docs/upgrade)).

Rules for adding and correcting entries:

- **Adding**: appended **after** a version is published to npm; no advance-notice entries.
- **Never rewritten**: the version number and publish date of a published entry are not edited once written.
- **Corrections**: if an entry is wrong, a `Correction (date)` line is appended in place; history is not silently edited.
- **Moving a dist-tag is not an entry**: which version `latest` / `beta` points at is release state, recorded in §3 of the [Upgrade and migration guide](/en-US/docs/upgrade).

## 4. Unpublished changes and release cadence

As of `0.1.0-beta.5` (2026-09-17), **there is no unpublished protocol difference between the working tree and the published artifacts**: the six fingerprint increments accumulated after `0.1.0-beta.4` (`fp-1` → `fp-7`) all shipped with this version, listed one by one in §2.1. The ledger left behind by the previous version is therefore cleared.

One correction (2026-09-17): the previous ledger recorded `mentions` as a field **added** in `fp-2` → `fp-3`. Reading the two published artifacts side by side shows that `MentionKind` / `MentionRef` and the two `mentions` fields **already existed in `0.1.0-beta.4`'s `index.d.mts`**, so §2.1 describes it as a host-side **semantics** change and does not claim it as a field added in beta.5. The version number and publish date of any published entry are unaffected by this correction.

Release cadence: entries are appended **after** a version is published (the "Adding" rule in §3); no dates are announced here.

So: **never assume a change has shipped unless it is listed on this page.**

## 5. See also

- [Upgrade and migration guide](/en-US/docs/upgrade): release-fact table, dist-tag semantics, pinning exact versions, per-version upgrade steps and self-check commands.
- [TypeScript SDK reference](/en-US/docs/typescript-sdk): install, API, events and error model; its §1 states the current version status. Runnable examples: [TypeScript SDK cookbook](/en-US/docs/examples-sdk).
- [Quick start](/en-US/docs/quick-start): the installer path for end users.

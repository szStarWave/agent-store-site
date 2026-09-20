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
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0-beta.5", "0.1.0-beta.6", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.6", "latest": "0.1.0-beta.2" },
  "time": {
    "0.1.0": "2026-09-09T09:09:04.795Z",
    "0.1.0-beta.2": "2026-09-09T09:27:36.122Z",
    "0.1.0-beta.3": "2026-09-10T04:44:34.609Z",
    "0.1.0-beta.4": "2026-09-16T10:24:02.588Z",
    "0.1.0-beta.5": "2026-09-17T11:41:10.171Z",
    "0.1.0-beta.6": "2026-09-18T11:08:21.813Z"
  }
}
```

| Version | Released (UTC) | Change type | Current dist-tag |
| --- | --- | --- | --- |
| `0.1.0-beta.6` | 2026-09-18 | Breaking (SDK entry renamed + return shape changed; **code changes required**) | `beta` |
| `0.1.0-beta.5` | 2026-09-17 | Breaking (strict-equality protocol fingerprint: `fp-1` → `fp-7`) | — |
| `0.1.0-beta.4` | 2026-09-16 | Breaking (strict-equality protocol fingerprint + type narrowing) | — |
| `0.1.0-beta.3` | 2026-09-10 | Additive (no breaking change) | — |
| `0.1.0-beta.2` | 2026-09-09 | Additive (no breaking change) | `latest` |
| `0.1.0` | 2026-09-09 | First release | none |

The `versions` array is **not** in chronological order: `0.1.0` is listed last but was the **earliest** release (about 18 minutes before `beta.2`), and it carries no dist-tag. It is not a stable release and it is not newer than the beta line — for dist-tag semantics see §3 of the [Upgrade and migration guide](/en-US/docs/upgrade).

### 2.1 `0.1.0-beta.6` — 2026-09-18T11:08:21Z

> **This release contains breaking changes**: the entry point of `@flowy-agent-store/sdk` was **renamed and reshaped**, so code that uses it must change too (the wire is untouched, and runtimes can be mixed); migration steps are in §6.5 of the [Upgrade and migration guide](/en-US/docs/upgrade).

#### Breaking

- `launchClient` → **`launchHarness`**; the types `LaunchedClient` → **`Harness`** and `LaunchOptions` → **`HarnessOptions`**.
- The return value no longer has a `.client` hop: the object it resolves to **is** the `AppServerClient`, with the business surface hanging off it directly (`session.client.conversations` → `harness.conversations`).
- `initializeResult` → **`handshake`** (the non-null handshake response); the base class still carries `initializeInfo`, meaning the **current** connection state — `null` after `close()`.
- `close()` got stronger: one call now covers unsubscribe → close transport → kill the child → remove an auto-created data-dir.

**Upgrade impact**: if you use `@flowy-agent-store/sdk` you **must upgrade and change code** (the four items above); if you only use `protocol` / `client`, or only the runtime binary, you are **unaffected** — the fingerprint is still `fp-7`, the method count is still `48 / 71`, and the wire interoperates with `0.1.0-beta.5`.

### 2.2 `0.1.0-beta.5` — 2026-09-17T11:41:10Z

> **This release contains breaking changes**: clients on `0.1.0-beta.4` or earlier **cannot connect** to this runtime and must be upgraded along with it — steps in §6.4 of the [Upgrade and migration guide](/en-US/docs/upgrade).

#### Breaking

- The protocol fingerprint jumped from `fp-1` to `fp-7`: the handshake and the SDK compare it with **strict equality**, so a client built against the old value is rejected outright. When injecting your own binary through `AGENT_STORE_BIN`, upgrade the SDK and the binary together.
- The **host config** `[connector_proxy]` grant shape changed: `allow` went from a mandatory per-tool allowlist to an **optional narrowing**, so `enabled = true` with no `allow` now means **every tool of that connector is callable** — a self-built host that only wrote `enabled` should re-read that table (startup logs a warning).

#### Added

- **Connector tool parameters**: `ConnectorTool.input_schema`, plus `tools_truncated` on `ConnectorDetail` / `ConnectorProbeResult` (over budget, a schema is omitted whole rather than truncated).
- **A Skill can be mounted per turn**: `conversation/send`'s `mentions` honours **`kind: "skill"` only**, so one turn can mount a Skill.
- **A conversation can be created as an installed expert**: `conversation/create`'s `agent_id`, freezing the expert's preset / Skills / Connectors into the conversation.
- **A team's Leader conversation**: `conversation/create`'s `team_id`, the same orchestration as `team/run` but **without the `goal` first turn**; mutually exclusive with `agent_id`.
- **Model and reasoning level per call**: `model` / `reasoning_effort` on `conversation/send` and `agent/run`, plus a read face on `ConversationView`; a value passed to `send` is **sticky** and reused by every later turn.
- **A `zip` marketplace source kind**: one **HTTP(S) archive** whose **root is the market root**; the three official markets moved to zip archives on ModelScope, where the revision is the archive's sha256 (a `HEAD` reads `X-Linked-Etag`, so unchanged content is never downloaded). Config migration in §8.1 of the [Upgrade and migration guide](/en-US/docs/upgrade).

#### Improved

- `agent` / `connector` mentions are now **explicitly refused with `invalid_request`** instead of being silently ignored.

#### Fixed

- Marketplace sources declaring `source_kind = "zip"` in `~/.agent-store/config.toml` are no longer silently dropped — a stale internal kind allowlist used to discard them, leaving an empty store that still reported the run as complete; configs written by `agent-store init` were affected too.

**Upgrade impact**: upgrading is **mandatory**, but **no code changes are required** — both published artifacts expose the same **141** export names; the only additions are optional fields.

### 2.3 `0.1.0-beta.4` — 2026-09-16T10:24:02Z

> **This release contains breaking changes**: clients on `0.1.0-beta.3` or earlier **cannot connect** to this runtime and must be upgraded along with it — steps in §6.3 of the [Upgrade and migration guide](/en-US/docs/upgrade).

#### Breaking

- The protocol fingerprint moved from a date stamp to the **`fp-<n>` counter** (this version is `fp-1`): it **changes no wire behaviour**, but the strict-equality check means an older client cannot connect to the new runtime.
- `ConversationEvent.event_type` **narrowed** from an open union (with a `| string` escape hatch) to the closed type `ConversationEventType`: code that reads it as a `string` starts failing type checks (`RunEvent.event_type` is a **separate** declaration that stays deliberately open).

#### Added

- **Wire-method additions**: `run/plan`, `config/get`, `config/set`, `config/get-mcp`, `config/set-mcp`, `config/set-mcp-enabled`, `run/answer-decision`.
- **Skill file-tree read face** `skill/files` / `skill/file`: a Skill is a directory and only `SKILL.md` used to be readable.
- **Connector call proxy** `connector/call`: the host holds the connection and its credentials and runs the MCP tool for the caller; **off by default**, and a tool-level failure comes back as `is_error` rather than throwing.
- **New notification** `conversation/list-changed`: the conversation **list** projection's `created` / `updated` / `deleted`.
- **Marketplace entry snapshot fields**: `store/list` gained `published_at` and others.
- **In-package decoder** `decodeConversationEvent`: folds an event into a `kind`-discriminated `DecodedConversationEvent`.

#### Improved

- The client now maps **48 / 71** methods over HTTP (measured against this release's published artifacts; see §5.3 of the [TypeScript SDK reference](/en-US/docs/typescript-sdk)).

**Upgrade impact**: upgrading is **mandatory**, and **code changes are required** — `event_type` is now checked as a closed union.

### 2.4 `0.1.0-beta.3` — 2026-09-10T04:44:34Z

#### Added

- **client declarations**: `TransportLifecycle`, `onLifecycle`, `connectTimeoutMs`, and `rearm()` on the subscription state machine.
- **sdk declarations**: `assertProtocolCompatible`, `SpawnOptions.env` / `cwd` / `onExit`, `SpawnedServer.exited`, `SpawnExitInfo`.

#### Improved

- **`package.json` metadata**: client and sdk gained `engines.node >= 22`, `repository`, `sideEffects`.

**Upgrade impact**: moving up from `0.1.0-beta.2` requires **no code changes** (the protocol declarations are unchanged, byte for byte); steps are in §6.1 of the [Upgrade and migration guide](/en-US/docs/upgrade).

### 2.5 `0.1.0-beta.2` — 2026-09-09T09:27:36Z

#### Added

- **sdk `optionalDependencies` filled in**: pinning five platform runtime packages at the same version — `runtime-win32-x64`, `runtime-linux-x64`, `runtime-linux-arm64`, `runtime-darwin-x64`, `runtime-darwin-arm64`.

#### Fixed

- The earlier `0.1.0` lacks that dependency set, so `launchHarness` could **fail to find the executable** (see §6.2 of the [Upgrade and migration guide](/en-US/docs/upgrade)).

This is the version `latest` currently points at — **it is not the newest one**; upgrading requires no code changes.

### 2.6 `0.1.0` — 2026-09-09T09:09:04Z

#### Added

- **First release**: the first public version of all three packages; there was no earlier version to break, so it carries no breaking changes.

The three packages' **code and type declarations are byte-for-byte identical to `0.1.0-beta.2`**; the only difference is `package.json` — the sdk had **no** `optionalDependencies` at that point; this version carries no dist-tag.

> Those "substantive differences from the previous version" come from byte-for-byte comparison of artifacts fetched with `npm pack`; the raw records are row R4 of plan doc `16` and the R4 landing note in `21`. This page only summarises them and adds no new evidence.

## 3. Change types and the breaking-change announcement rule (D10=A)

Stance: **no backward compatibility is promised during beta**, and a breaking change ships under the **next pre-release counter** (`0.1.0-beta.N` → `0.1.0-beta.N+1`) with the entry marked "breaking"; a **minor** number (`0.1.x` → `0.2.0`) is reserved for breaking changes **after beta** — there is no stable release to break yet, hence no major numbers.

| Change type | Version number | Action on this page |
| --- | --- | --- |
| First release | the version itself | append an entry with an "Added" group |
| Additive (new declarations, new dependencies, metadata) | patch / pre-release counter | append an entry, filing each item under "Added / Improved / Fixed" |
| Breaking (type narrowing, methods added or removed, event-surface changes) | inside beta: **the next pre-release counter**; after beta: **minor number** | append an entry with a "Breaking" group and the migration path |

**Every version's items are grouped four ways**: **Breaking / Added / Improved / Fixed**. The last three divide the work — "Added" is outward capability, "Improved" is a change that does not move the capability surface (clearer error semantics, coverage changes), and "Fixed" corrects an existing defect; **a group with nothing in it does not appear**. Group headings use `####`, so they **stay out of this page's table of contents** — it still lists versions only. A version with breaking changes opens with a one-line **banner** and closes with an **upgrade impact** line (whether upgrading is mandatory, and whether code changes are needed).

> **Stance revised (2026-09-16)**: it used to say breaking changes "take a minor number", which did not match how the beta line actually ships — `0.1.0-beta.4` carries the `event_type` narrowing and the strict-equality protocol fingerprint, yet is still a pre-release counter. It now reads: inside beta, breaking changes ship under the next pre-release counter and are marked one by one; the minor number is reserved for breaking changes after beta. **This revision does not affect the version number or publish date of any published entry** (see "Never rewritten" below).

**This page is the only announcement surface for breaking changes**: they are not announced through commit messages, chat history or release pages — only an entry here marked "breaking" with a migration path counts as an announcement (version-number rules in §1 of the [Upgrade and migration guide](/en-US/docs/upgrade)).

Rules for adding and correcting entries:

- **Appending**: appended **after** a version is published to npm; no advance-notice entries.
- **Never rewritten**: the version number and publish date of a published entry are not edited once written.
- **Corrections**: if an entry is wrong, a `Correction (date)` line is appended in place; history is not silently edited.
- **Moving a dist-tag is not an entry**: which version `latest` / `beta` points at is release state, recorded in §3 of the [Upgrade and migration guide](/en-US/docs/upgrade).

## 4. Unpublished changes and release cadence

As of `0.1.0-beta.6` (2026-09-18), **the working tree leads the published artifacts**: after `beta.6` it accumulated one further **zero-wire-change** host-configuration increment — the `[memory]` table in `~/.agent-store/config.toml` gained `enabled` (the built-in memory system's master switch; `false` stops all four of its faces at once — the system prompt's memory section, the `remember` tool, session-end distillation and citation write-back — and it is **independent of** the existing `distill_enabled`, which covers distillation alone).

**This increment does not move the protocol surface**: no new methods, no new DTO fields, no new error codes; the fingerprint is still `fp-7` and the method count is still `48 / 71`, so published SDK and runtime artifacts **need no update**. It is therefore not a breaking change and produces no new version entry — it only changes **how the host reads its config**, covered by the `memory` section of the [Configuration file](/en-US/docs/configuration). See §8 of the [Upgrade and migration guide](/en-US/docs/upgrade) for the read-two-artifacts-side-by-side check.

The earlier batch (the SDK entry rename and return-shape change accumulated after `0.1.0-beta.5`) shipped with this version — listed one by one in §2.1; `0.1.0-beta.4` and earlier batches are in §2.2–§2.3.

One correction (2026-09-17): the previous ledger recorded `mentions` as a field **added** in `fp-2` → `fp-3`. Reading the two published artifacts side by side shows that `MentionKind` / `MentionRef` and the two `mentions` fields **already existed in `0.1.0-beta.4`'s `index.d.mts`**, so §2.2 describes it as a host-side **semantics** change and does not claim it as a field added in beta.5. The version number and publish date of any published entry are unaffected by this correction.

Release cadence: entries are appended **after** a version is published (the "Adding" rule in §3); no dates are announced here.

So: **never assume a change has shipped unless it is listed on this page.**

## 5. See also

- [Upgrade and migration guide](/en-US/docs/upgrade): release-fact table, dist-tag semantics, pinning exact versions, per-version upgrade steps and self-check commands.
- [TypeScript SDK reference](/en-US/docs/typescript-sdk): install, API, events and error model; its §1 states the current version status. Runnable examples: [TypeScript SDK cookbook](/en-US/docs/examples-sdk).
- [Quick start](/en-US/docs/quick-start): the installer path for end users.

# Upgrade and migration guide

This page answers three questions: **can I upgrade**, **which version do I take**, and **how do I do it**. It covers `@flowy-agent-store/{protocol,client,sdk}` and the platform runtime packages that ship alongside them.

Release facts and upgrade steps live here; the full method semantics stay in the repo file `docs/agent-store/05-allo-app-server-protocol.md`.

## 1. Compatibility promise (current stance)

**No backward compatibility is promised during beta.** All three packages are `0.1.0-beta.*` pre-releases with an unfrozen API: type narrowing, methods added or dropped, and event-surface changes can all happen inside the beta line.

Two rules go with that (decided as D10=A):

- inside the beta line, a breaking change ships under the **next pre-release counter** (`0.1.0-beta.3` → `0.1.0-beta.4`) and is marked **breaking in the changelog, one entry at a time, with a migration path**; a **minor** number (`0.1.x` → `0.2.0`) is reserved for breaking changes **after beta** — there is no stable release to break yet, so no major number is used;
- every release states its change type **in the [changelog](/en-US/docs/changelog)** (see §9).

Two consequences for your daily work:

- pin an exact version in production (see §5) instead of trusting what a bare `bun add` / `npm install` resolves to (see §4);
- read the [changelog entry](/en-US/docs/changelog) for the target version first, then follow the per-version steps in §6.

## 2. Published release sequence (facts)

The table is derived from registry metadata and from the published artifacts (commands to reproduce are in §8):

| Version | Published (UTC) | dist-tag today | Difference from the previous release |
| --- | --- | --- | --- |
| `0.1.0` | 2026-09-09T09:09:04Z | none | first publish; for all three packages the **code and type declarations are byte-identical to beta.2**, only `package.json` differs: the sdk had no `optionalDependencies` then (no platform runtime packages attached) |
| `0.1.0-beta.2` | 2026-09-09T09:27:36Z | `latest` | adds the sdk `optionalDependencies` (five platform runtime packages for darwin / linux / win32, same version) |
| `0.1.0-beta.3` | 2026-09-10T04:44:34Z | — | adds public declarations to client / sdk (reconnect lifecycle, exit observation, see §6.1); `package.json` gains `engines.node >= 22`, `repository` and `sideEffects`; the protocol declarations are unchanged byte for byte |
| `0.1.0-beta.4` | 2026-09-16T10:24:02Z | `beta` | **breaking**: the protocol fingerprint became the strict-equality `fp-1` (older clients cannot connect to this runtime) and `event_type` was narrowed to the closed union `ConversationEventType`; it also carries the Skill file-tree read face, the `connector/call` proxy and `conversation/list-changed` (steps in §6.3); the client now maps `48 / 71` methods over HTTP |

Note that `0.1.0` is the **earliest** publish (about 18 minutes before beta.2) and yet no dist-tag points at it; it is neither a stable release nor newer than the beta line.

## 3. What dist-tags mean

A `dist-tag` is a label the publisher can move; it says nothing about version ordering:

| dist-tag | Points at today |
| --- | --- |
| `latest` | `0.1.0-beta.2` |
| `beta` | `0.1.0-beta.4` |

`0.1.0` carries no tag at all. The three packages and `@flowy-agent-store/runtime-*` agree on both tags (verified 2026-09-16).

```bash
npm view @flowy-agent-store/sdk versions dist-tags --json
```

```json
{
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.4", "latest": "0.1.0-beta.2" }
}
```

Two traps:

1. `latest` is **not** the newest version — it points at `0.1.0-beta.2`, while the newest beta is `0.1.0-beta.4` under the `beta` tag.
2. `0.1.0` has no tag, but a version range can still resolve to it (see §4).

Also note that the `versions` array is **not** in chronological order: `0.1.0` is listed last and was published first.

## 4. Bare installs and range resolution

A bare install follows `latest`, so it lands on `0.1.0-beta.2`; worse, bun writes a **range** into `package.json` (`^0.1.0-beta.2`), so the next install resolves again — and one range does not resolve the same way in every tool.

Measured in throwaway directories with an empty `node_modules`:

```bash
bun add @flowy-agent-store/sdk                     # → 0.1.0-beta.2 (latest)
bun add @flowy-agent-store/sdk@beta                # → 0.1.0-beta.4
bun add '@flowy-agent-store/sdk@^0.1.0-beta.2'     # → bun resolves 0.1.0-beta.2
npm view '@flowy-agent-store/sdk@^0.1.0-beta.2' version   # → npm resolves 0.1.0 (the untagged early publish)
```

Conclusion: **do not rely on range resolution**. A tag alias is no safer — `latest` moves on the next publish (so does `beta`), so `@beta` written today may install another version tomorrow. Write the exact version into `package.json`.

## 5. Pin the exact version (recommended)

```bash
# Write the exact version; avoid ^ and ~
bun add @flowy-agent-store/sdk@0.1.0-beta.4
bun add @flowy-agent-store/protocol@0.1.0-beta.4   # when you import wire types

# same for npm / pnpm
npm install @flowy-agent-store/sdk@0.1.0-beta.4
```

`package.json` should end up with `"@flowy-agent-store/sdk": "0.1.0-beta.4"` (**no** `^`). The sdk's platform runtime packages are pinned to the same version by its `optionalDependencies`, so they need no separate entry.

Commit the lockfile too: `bun.lock` / `package-lock.json` / `pnpm-lock.yaml` is the only authoritative record of what an install actually pulled.

An upgrade is then: change that one string, reinstall, re-run your tests. Nothing else.

## 6. Per-version upgrade steps

### 6.1 From 0.1.0-beta.2 to 0.1.0-beta.3

This is the **first** beta-to-beta jump and it needs **no code change**: the measured difference is added declarations only (client: `TransportLifecycle` / `onLifecycle` / `connectTimeoutMs` / subscription `rearm()`; sdk: `assertProtocolCompatible`, `SpawnOptions.env` / `cwd` / `onExit`, `SpawnedServer.exited`, `SpawnExitInfo`) plus `package.json` metadata; the protocol declarations are unchanged byte for byte. The second one — which does carry breaking changes — is §6.3.

```bash
# 1) see what is actually installed
bun pm ls | grep '@flowy-agent-store'          # npm projects: npm ls @flowy-agent-store/sdk
# 2) pin the target version (upgrade the packages you use, on one version)
bun add @flowy-agent-store/sdk@0.1.0-beta.3
bun add @flowy-agent-store/protocol@0.1.0-beta.3
# 3) confirm what got resolved
node -p "require('@flowy-agent-store/sdk/package.json').version"
# 4) re-run your own type check and tests
bun run typecheck && bun run test
```

If you point `AGENT_STORE_BIN` at a self-built binary, note that the SDK **checks the readiness line's `protocol_version` against its own** (see the [TypeScript SDK cookbook](/en-US/docs/examples-sdk) §12): after upgrading the SDK an older binary is rejected, so update the binary in the same step.

### 6.2 From 0.1.0 back onto the beta line

`0.1.0` was the first publish and carries no dist-tag; for all three packages its **code and type declarations are byte-identical to `0.1.0-beta.2`**, and the only difference is `package.json` — in particular the sdk at that time had **no** `optionalDependencies`, so it does not bring `@flowy-agent-store/runtime-win32-x64` or the other platform runtime packages, and `launchClient` may fail to find an executable.

```bash
# move off the untagged 0.1.0 onto the current beta line (current beta: see §3)
bun add @flowy-agent-store/sdk@0.1.0-beta.4
bun pm ls | grep '@flowy-agent-store'   # confirm 0.1.0 is gone
```

The move from `0.1.0` to `beta.3` is additive: the public declaration surface only grew (the runtime packages added in `beta.2`, the reconnect and exit observation added in `beta.3`) — nothing was removed or renamed. **`beta.4` is not additive** — it carries type narrowing and a strict-equality protocol fingerprint, see §6.3.

### 6.3 From 0.1.0-beta.3 to 0.1.0-beta.4

This is the **first beta-to-beta jump that carries breaking changes**, so it is not just a version bump:

```bash
# 1) see what is actually installed
bun pm ls | grep '@flowy-agent-store'          # npm projects: npm ls @flowy-agent-store/sdk
# 2) pin 0.1.0-beta.4 (upgrade the packages you use, on one version)
bun add @flowy-agent-store/sdk@0.1.0-beta.4
bun add @flowy-agent-store/protocol@0.1.0-beta.4
# 3) confirm what got resolved
node -p "require('@flowy-agent-store/sdk/package.json').version"
# 4) re-run your type check and tests — ConversationEvent.event_type is a closed union now
bun run typecheck && bun run test
```

Two differences you have to handle:

1. **The protocol fingerprint is compared for strict equality**: `0.1.0-beta.3` reports `2026-08-26`, `0.1.0-beta.4` reports `fp-1`. Both the handshake and the SDK's readiness-line check use strict equality, so **an older client cannot connect to the new runtime**. If you point `AGENT_STORE_BIN` at a self-built binary, upgrade the SDK and the binary **together** (or move to `@flowy-agent-store/runtime-win32-x64@0.1.0-beta.4`).
2. **`ConversationEvent.event_type` narrowed**: code that reads it as a `string` must handle the closed union `ConversationEventType` (`RunEvent.event_type` stays an open `string` and is unaffected). When you need a discriminated branch, use the in-package decoder `decodeConversationEvent(event)`, which returns a `DecodedConversationEvent` carrying `kind` — do not let a `default: break` swallow unknown kinds.

The additive items need no code changes: the Skill file-tree read face (`skill/files` / `skill/file`), the Connector call proxy (`connector/call`, off by default), the `conversation/list-changed` notification, and so on.

## 7. Check which version you actually have

```bash
# what the project resolved (start here)
bun pm ls | grep '@flowy-agent-store'      # npm: npm ls @flowy-agent-store/sdk
# read the installed package.json (all three packages export ./package.json)
node -p "require('@flowy-agent-store/protocol/package.json').version"
# what the lockfile pinned
grep -o '@flowy-agent-store/sdk@[0-9][^"]*' bun.lock | head -1
# what the registry offers, and where the tags point
npm view @flowy-agent-store/sdk versions dist-tags --json
```

When the three disagree, trust the **lockfile and the installed `package.json`**: the range in `package.json` states intent, what landed in `node_modules` is the fact.

## 8. Published-artifact differences and how to check them

As of `0.1.0-beta.4` (2026-09-16), **the working tree leads the published artifacts**: after `0.1.0-beta.4` it accumulated the protocol fingerprint move `fp-1` → **`fp-2`** — each connector tool's `input_schema` (a `ConnectorTool` field) plus `tools_truncated` on `ConnectorDetail` / `ConnectorProbeResult`, with **no methods added or removed** (still `48 / 71` mapped); the same batch also changed the host's `[connector_proxy]` grant shape (`allow` became optional narrowing, `deny` was added, and an enabled proxy now means callable). The working tree went on to `fp-2` → `fp-3` (`mentions` on `conversation/send`), `fp-3` → `fp-4` (`agent_id` on `conversation/create`), `fp-4` → `fp-5` (`team_id`) and `fp-5` → `fp-6` (`model` and `reasoning_effort` on `send` / `agent/run`), and at `fp-6` → `fp-7` moved the official marketplace sources onto zip archives on ModelScope. None of this has shipped in any version yet; for what `0.1.0-beta.4` changed relative to `0.1.0-beta.3`, see §2.1 of the [Changelog](/en-US/docs/changelog).

### 8.1 Migrating a config's marketplace sources

The three official marketplace sources (`experts` / `skills` / `connectors`) moved off this site's `/source/<market>/…` file-per-entry tree and onto zip archives on ModelScope, and the site no longer hosts the market trees. **No address is rewritten automatically**, so an upgrade needs one manual pass — it only affects machines whose config already declares `[default_marketplaces]` (both `agent-store init` and hand-copying the URLs from older docs write those blocks in).

First check whether `~/.agent-store/config.toml` carries these three blocks:

```toml
[default_marketplaces.experts]
source_kind = "url"
source = "https://agent-store.flowyaipc.cn/source/experts/.codebuddy-plugin/marketplace.json"
```

If it does, take one of two routes:

- **Delete the three `[default_marketplaces.*]` blocks** — with no table declared, the runtime's built-in defaults (the zip addresses below) apply;
- **Repoint them at the new zip addresses** — one archive per market, with `source_kind = "zip"`:

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

If the config has no such blocks, there is nothing to do. **Failure is benign**: a failed fetch never touches the last-good local copy, so entries do not disappear — they stay at their old data. The first fetch after the switch downloads the whole archive (the largest of the three is `experts` at 289.0 MiB).

To check for yourself what a published artifact actually contains, reading two adjacent versions side by side is the clearest way:

```bash
# beta.3: ConversationEvent.event_type still has the | string escape hatch, fingerprint is a date stamp
npm pack @flowy-agent-store/protocol@0.1.0-beta.3 --silent
tar xzf flowy-agent-store-protocol-0.1.0-beta.3.tgz
grep -n 'event_type' package/dist/index.d.mts
# 0.1.0 / 0.1.0-beta.2 / 0.1.0-beta.3 all ship an index.d.mts of 20049 bytes, identical byte for byte
# event_type: "message.created" | ... | "context.usage" | string;   ← the | string is still there

# beta.4: the same place is a closed union, and the fingerprint is fp-1
npm pack @flowy-agent-store/protocol@0.1.0-beta.4 --silent
tar xzf flowy-agent-store-protocol-0.1.0-beta.4.tgz
grep -n 'event_type:\|APP_SERVER_PROTOCOL_VERSION' package/dist/index.d.mts
# export declare const APP_SERVER_PROTOCOL_VERSION = "fp-1";
# event_type: ConversationEventType;   ← ConversationEvent (narrowed)
# event_type: string;                  ← RunEvent, a separate declaration, deliberately open
```

The same works on the client side: install `@flowy-agent-store/client` into a throwaway directory and count the keys of `httpRouteTable()` — that is the mapped number quoted in §5.3 (`0.1.0-beta.4` reports 48).

## 9. Changelog and release notes boundary

| Item | Status | Basis |
| --- | --- | --- |
| Versioning of breaking changes | inside the beta line, the **next pre-release counter**, stated in the changelog; the minor number is reserved for breaking changes after beta | the compatibility stance D10=A (no backward compatibility during beta); the revision is recorded in §3 of the [Changelog](/en-US/docs/changelog) |
| Standalone changelog / release notes page | ✅ **built**: [Changelog](/en-US/docs/changelog) | item R6 of plan doc `16` (shipped in batch 4) |
| This page's job | record published release facts and verified unpublished differences | no invented release history |
| Division of labour | this page explains **how to upgrade**; the changelog records **what changed in each version** and is the only announcement surface for breaking changes | the two pages cross-reference instead of duplicating |

So this page states **what happened** (publish times, dist-tags, artifact differences) and **what a published artifact actually contains** (§8). For any change not listed here, do not assume it has happened.

## 10. See also

- [TypeScript SDK reference](/en-US/docs/typescript-sdk): install, API, events and error model; runnable examples in the [TypeScript SDK cookbook](/en-US/docs/examples-sdk).
- [Quick start](/en-US/docs/quick-start): the installer path for end users.
- [Compatibility matrix](/en-US/docs/compatibility): supported platforms and source formats.
- [Changelog](/en-US/docs/changelog): what changed in each published version, and the announcement surface for breaking changes.

# Upgrade and migration guide

This document provides migration procedures, versioning policies, and compatibility guarantees for `@flowy-agent-store/{protocol,client,sdk}` and associated platform runtime dependencies.

## 1. Compatibility promise (current stance)

**Backward compatibility is not guaranteed during the beta phase.** The packages currently publish under `0.1.0-beta.*` prerelease semantics with unfrozen APIs: type narrowing, method signature changes, and event stream adjustments may occur across beta iterations.

Release management principles:

- Within the beta line, **breaking changes increment the prerelease identifier** (such as `0.1.0-beta.3` $\to$ `0.1.0-beta.4`) and are explicitly cataloged with migration steps in the [Changelog](/en-US/docs/changelog). Minor version increments (such as `0.2.0`) are reserved for breaking releases following graduation from beta.
- Detailed classification of modifications is documented in the [Changelog](/en-US/docs/changelog).

Integration guidelines:

- Production environments must **pin exact package revisions** (see §5) and avoid relying on loose version ranges (see §4);
- Review the target version's [Changelog entry](/en-US/docs/changelog) prior to executing the migration steps in §6.

## 2. Published release sequence (facts)

The following table documents published releases, distribution tags, and breaking characteristics:

| Version | Published (UTC) | Current dist-tag | Substantive changes from prior release |
| --- | --- | --- | --- |
| `0.1.0-beta.7` | 2026-09-20T10:33:48Z | `beta` | **Breaking**: Protocol fingerprint incremented to `fp-8` (strict equality check); adds WebSocket APIs `agent/export` and `team/export`, bringing total methods to 73 (steps in §6.6) |
| `0.1.0-beta.6` | 2026-09-18T11:08:21Z | — | **Breaking**: SDK API reshaping (`launchClient` renamed to `launchHarness`, `.client` nesting removed, `initializeResult` renamed to `handshake`), requiring code updates; wire remains `fp-7` (steps in §6.5) |
| `0.1.0-beta.5` | 2026-09-17T11:41:10Z | — | **Breaking**: Protocol fingerprint updated to `fp-7`; adds connector `input_schema`, per-turn skill mounting, session `agent_id`/`team_id`, and `zip` marketplace protocol (steps in §6.4) |
| `0.1.0-beta.4` | 2026-09-16T10:24:02Z | — | **Breaking**: Protocol fingerprint enforces strict equality `fp-1`; `event_type` narrowed to closed union `ConversationEventType`; introduces skill file reads and tool proxying (steps in §6.3) |
| `0.1.0-beta.3` | 2026-09-10T04:44:34Z | — | Introduces client lifecycle observation APIs (`onLifecycle`, exit hooks); declares `engines.node >= 22` and repository metadata (steps in §6.1) |
| `0.1.0-beta.2` | 2026-09-09T09:27:36Z | `latest` | Bundles platform runtime dependencies across darwin, linux, and win32 architectures |
| `0.1.0` | 2026-09-09T09:09:04Z | none | Initial untagged publish; source and type declarations match `beta.2` but lack optional platform dependencies |

## 3. What dist-tags mean

`dist-tag` pointers represent mutable registry aliases:

| dist-tag | Points at today |
| --- | --- |
| `latest` | `0.1.0-beta.2` |
| `beta` | `0.1.0-beta.7` |

```bash
npm view @flowy-agent-store/sdk versions dist-tags --json
```

```json
{
  "versions": ["0.1.0-beta.2", "0.1.0-beta.3", "0.1.0-beta.4", "0.1.0-beta.5", "0.1.0-beta.6", "0.1.0-beta.7", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.7", "latest": "0.1.0-beta.2" }
}
```

Key considerations:
1. `latest` does not track newest commits and remains pinned to `0.1.0-beta.2`; active prereleases track under `beta`.
2. Initial release `0.1.0` carries no tag but remains matchable by permissive version range selectors.

## 4. Bare installs and range resolution

Unspecified installation targets resolve against `latest`; ambiguous version ranges (such as `^0.1.0-beta.2`) resolve inconsistently across package managers.

```bash
bun add @flowy-agent-store/sdk                     # → 0.1.0-beta.2 (latest)
bun add @flowy-agent-store/sdk@beta                # → 0.1.0-beta.7
bun add '@flowy-agent-store/sdk@^0.1.0-beta.2'     # → resolves 0.1.0-beta.2
npm view '@flowy-agent-store/sdk@^0.1.0-beta.2' version   # → resolves 0.1.0
```

Policy: **Production dependencies must declare exact package versions** rather than dynamic tags or semver ranges.

## 5. Pin the exact version (recommended)

```bash
# Pin exact package versions
bun add @flowy-agent-store/sdk@0.1.0-beta.7
bun add @flowy-agent-store/protocol@0.1.0-beta.7

# Using npm / pnpm
npm install @flowy-agent-store/sdk@0.1.0-beta.7
```

Ensure `package.json` entries omit `^` or `~` prefixes, and commit generated lockfiles (`bun.lock`, `package-lock.json`, or `pnpm-lock.yaml`) to version control.

## 6. Per-version upgrade steps

### 6.1 From 0.1.0-beta.2 to 0.1.0-beta.3

Additive release requiring no code changes:

```bash
# 1) Inspect installed packages
bun pm ls | grep '@flowy-agent-store'
# 2) Pin target version
bun add @flowy-agent-store/sdk@0.1.0-beta.3
bun add @flowy-agent-store/protocol@0.1.0-beta.3
# 3) Verify resolved revision
node -p "require('@flowy-agent-store/sdk/package.json').version"
# 4) Run typecheck and test suite
bun run typecheck && bun run test
```

Update custom binaries referenced via `AGENT_STORE_BIN` concurrently to maintain handshake compatibility.

### 6.2 From 0.1.0 Back to the Beta Line

Migrate untagged `0.1.0` installations to the active beta branch:

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.7
bun pm ls | grep '@flowy-agent-store'
```

### 6.3 From 0.1.0-beta.3 to 0.1.0-beta.4

Introduces breaking changes:

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.4
bun add @flowy-agent-store/protocol@0.1.0-beta.4
bun run typecheck && bun run test
```

Migration requirements:
1. **Strict Protocol Equality**: Fingerprint updated to `fp-1`; update host runtime binaries concurrently.
2. **Event Type Narrowing**: `ConversationEvent.event_type` narrows to `ConversationEventType`; use `decodeConversationEvent` for discriminant matching.

### 6.4 From 0.1.0-beta.4 to 0.1.0-beta.5

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.5
bun add @flowy-agent-store/protocol@0.1.0-beta.5
bun run typecheck && bun run test
```

- **Protocol Fingerprint**: Incremented to `fp-7`; requires binary updates.
- **Proxy Permissions**: `allow` within `[connector_proxy]` becomes an optional whitelist, defaulting to permissive proxying for enabled connectors when omitted.

### 6.5 From 0.1.0-beta.5 to 0.1.0-beta.6

Refactors SDK interface contracts:

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.6
bun add @flowy-agent-store/protocol@0.1.0-beta.6
bun run typecheck
```

Code migration mapping:

```ts
// Prior usage (0.1.0-beta.5)
const session = await launchClient({ client: { name: "my-app", version: "1.0.0" } });
await session.client.conversations.create({ name: "demo" });
session.initializeResult.protocol_version;

// Updated standard (0.1.0-beta.6)
const harness = await launchHarness({ client: { name: "my-app", version: "1.0.0" } });
await harness.conversations.create({ name: "demo" });
harness.handshake.protocol_version;
```

1. Rename `launchClient` invocation to `launchHarness`;
2. Access domain clients directly on the returned harness instance;
3. Access handshake results via `handshake`.

### 6.6 From 0.1.0-beta.6 to 0.1.0-beta.7

```bash
bun add @flowy-agent-store/sdk@0.1.0-beta.7
bun add @flowy-agent-store/protocol@0.1.0-beta.7
bun run typecheck
```

- Protocol fingerprint advances to `fp-8`; host and client must align;
- Introduces `agents.export` and `teams.export` methods for asset serialization.

## 7. Verifying Installed Versions

```bash
# Verify project-level resolved versions
bun pm ls | grep '@flowy-agent-store'
# Read installed package manifests
node -p "require('@flowy-agent-store/protocol/package.json').version"
# Verify lockfile records
grep -o '@flowy-agent-store/sdk@[0-9][^"]*' bun.lock | head -1
# Check remote tag pointers
npm view @flowy-agent-store/sdk versions dist-tags --json
```

## 8. Artifact Diff Verification

As of `0.1.0-beta.7`, repository contracts align with published packages:

1. **Asset Serialization Surface — `fp-7` $\to$ `fp-8`**: Adds `agent/export` and `team/export`, bringing wire methods to 73.
2. **Host Configuration Options**: Adds `[memory]` `enabled` flag and `max_output_size` mapping.

### 8.1 Migrating Marketplace Sources in Existing Configurations

Marketplaces have migrated to single Zip archives on ModelScope. Configurations pointing to legacy paths:

```toml
[default_marketplaces.experts]
source_kind = "url"
source = "https://agent-store.flowyaipc.cn/source/experts/.codebuddy-plugin/marketplace.json"
```

Resolution options:
- Remove `[default_marketplaces]` entirely to leverage built-in official defaults;
- Or update definitions to the official Zip archive URLs:

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

Inspecting symbol changes between releases:

```bash
# Verify protocol symbol exports across releases
mkdir -p b6 b7
(cd b6 && npm pack @flowy-agent-store/protocol@0.1.0-beta.6 --silent && tar xzf *.tgz)
(cd b7 && npm pack @flowy-agent-store/protocol@0.1.0-beta.7 --silent && tar xzf *.tgz)
diff <(grep -o '^export [a-z]* [A-Za-z]*' b6/package/dist/index.d.mts) \
     <(grep -o '^export [a-z]* [A-Za-z]*' b7/package/dist/index.d.mts)
```

## 9. Changelog and Release Notes Scope

| Aspect | Current status | Basis |
| --- | --- | --- |
| Breaking change versions | Released under next prerelease identifier with explicit notices | Beta compatibility stance |
| Dedicated changelog page | [Changelog](/en-US/docs/changelog) | Standardized release documentation |
| Guide scope | Documents release facts and migration procedures | Operational focus |
| Separation of concerns | This guide details migration; the changelog logs feature modifications | Bidirectional cross-reference |

## 10. See also

- [TypeScript SDK reference](/en-US/docs/typescript-sdk): Complete API and error models.
- [TypeScript SDK cookbook](/en-US/docs/examples-sdk): Integration patterns and code recipes.
- [Quick start](/en-US/docs/quick-start): Binary runtime setup.
- [Compatibility matrix](/en-US/docs/compatibility): Supported platforms and formats.
- [Changelog](/en-US/docs/changelog): Detailed version change notes.

# Compatibility matrix

This page answers three questions: **which platforms run**, **which sources can be imported**, and **how far an imported thing actually works**.

## Platforms

Only **Windows x64** builds are published today; every other platform is not available yet and needs a separate decision before it opens up. Binaries are distributed on [GitHub Releases](https://github.com/szStarWave/agent-store-site/releases) under per-target names (current preview builds are marked as pre-releases).

| OS | Architecture | Status |
| --- | --- | --- |
| Windows | x86_64 | Published |
| macOS | Apple silicon (aarch64) | Not available |
| macOS | Intel (x86_64) | Not available |
| Linux | x86_64 | Not available |
| Linux | aarch64 | Not available |

> The download button detects your system: only Windows x64 gets a direct link; other platforms are routed to GitHub Releases.

## Source formats

| Source | Import path | Compatibility you may get |
| --- | --- | --- |
| CodeBuddy Plugin | Importer → PluginSnapshot | `compatible` / `compatible-with-adapter` / `manual-review` |
| WorkBuddy Skill | Importer → PluginSnapshot | `compatible` (attached scripts are imported, never executed) |
| WorkBuddy Connector | Importer → PluginSnapshot | `compatible-with-adapter` (MCP); `manual-review` (CLI connectors) |
| Unconfirmed-license resources | marked `pending-legal-review` | excluded from public distribution |

### What the compatibility status means

A status says **how far this thing works inside this product** — not what it can do inside the product it came from:

| Status | Meaning |
| --- | --- |
| `compatible` | Semantics and shape both work as-is |
| `compatible-with-adapter` | Works after the adapter converts it (e.g. an MCP connector, brought in through tool namespacing) |
| `manual-review` | Needs human review before it can be enabled (e.g. CLI connectors, Hooks, LSP) |
| `unsupported` | Explicitly not supported today |
| `pending-legal-review` | Copyright / distribution rights unconfirmed; barred from public markets and default installers |

### It is really three dimensions

The single status you see in the UI is only one of them. An import report records three independent facts, so that "convertible" is never mistaken for "already runnable":

| Dimension | Values | Question it answers |
| --- | --- | --- |
| `semantic_status` | the status table above | Can the semantics be preserved? |
| `runtime_status` | `not-verified` → `adapter-verified` → `runtime-verified` → `release-eligible` | Have the adapter and the runtime actually been verified? |
| `distribution_status` | `local-only` | May it be installed / distributed? |

> Only a component that is `runtime-verified` and has passed the release gate is marked runnable; `pending-legal-review` always overrides the distribution status. So **"imported successfully" is not "can run"** — splitting the status into three dimensions is what makes that visible in the report.
>
> Spelling: the catalog face (`compatibility_status`) hyphenates these values, while the three-dimension import report underscores them — two spellings of one set, not two sets of statuses.

## Connectors

A connector (an MCP server) is the kind of component where **the host holds the connection and its credentials and runs the tool for the caller**. Its surface — and therefore its permissions — splits in two:

| Face | Methods | Needs host authorization? |
| --- | --- | --- |
| **Read face** (catalog / status / probe) | `connector/list`, `connector/get`, `connector/status`, `connector/test` | No. `get` / `test` carry each tool's parameter schema, so you can see how to call it before calling it |
| **Call face** (actually runs a tool) | `connector/call` | **Yes.** The host's `[connector_proxy]` is off by default; once on, **the connectors that are enabled are callable**, and `allow` / `deny` are the operator's optional narrowing and subtraction — see [Configuration file](/en-US/docs/configuration) |

- **All three transports are supported**: stdio, Streamable HTTP and legacy SSE.
- **Credentials never leave the host**: OAuth uses standard PKCE Loopback, tokens go to secure storage and are injected at call time; `env` / `headers` in `mcp.json` declarations use `secret:NAME` references, resolved into memory only when the child process starts.
- **A caller cannot name anything else**: only a **registered** connector id — no URL, command or header, because the address always comes from the host's own configuration.

### Runtime status

The `status` in `connector/status` has only these values, and the order below is the order they are decided in (`connector/list` reports a **summary view** of the same facts and the two can disagree — see below):

| Order | Condition | Status |
| --- | --- | --- |
| 1 | The connector is disabled | `installed` |
| 2 | The last probe failed | `error` |
| 3 | OAuth is required and not yet authorized | `authorization_required` |
| 4 | The last probe succeeded | `connected` |
| 5 | Anything else (enabled, authorized, never probed successfully) | `configured` |

> **`connected` needs both**: authorization ready **and** the last probe successful. One of the two is not enough — "login worked but calls do not" has no in-between status; it shows up as `configured` (the probe never succeeded) or `error` (the probe failed).
>
> To decide "can I call this?", use `connector/status`: the `status` in `connector/list` is a summary view of the same facts and does not check OAuth state live, so on a connector that is authorized but whose last probe did not succeed it can read more pessimistically than `connector/status` does.

## Non-goals (V1)

Cloud execution, multi-tenancy, HA, a full Marketplace review backend, a signed-update system, and arbitrary Hook/bin execution are all out of V1 scope.

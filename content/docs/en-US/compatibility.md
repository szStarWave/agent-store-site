# Compatibility matrix

This document details supported host environments, ingestion specifications for external assets, and the compatibility rating taxonomy.

## Platforms

Precompiled binaries are currently distributed for **Windows x64**; other platforms are planned for future phases. Binaries are available on [GitHub Releases](https://github.com/szStarWave/agent-store-site/releases) (preview releases are tagged as pre-release).

| OS | Architecture | Status |
| --- | --- | --- |
| Windows | x86_64 | Published |
| macOS | Apple silicon (aarch64) | Not available |
| macOS | Intel (x86_64) | Not available |
| Linux | x86_64 | Not available |
| Linux | aarch64 | Not available |

> The website download button detects the client platform; non-Windows x64 clients are redirected to the GitHub Releases listing.

## Source formats

| Source | Import path | Compatibility you may get |
| --- | --- | --- |
| CodeBuddy Plugin | Importer → PluginSnapshot | `compatible` / `compatible-with-adapter` / `manual-review` |
| WorkBuddy Skill | Importer → PluginSnapshot | `compatible` (attached scripts are imported for storage, never executed) |
| WorkBuddy Connector | Importer → PluginSnapshot | `compatible-with-adapter` (MCP); `manual-review` (CLI connectors) |
| Unconfirmed-license resources | marked `pending-legal-review` | excluded from public distribution |

### What the compatibility status means

Compatibility statuses define the operational readiness and adapter boundary of an asset within this product, rather than its native capabilities in upstream environments:

| Status | Meaning |
| --- | --- |
| `compatible` | Syntax and execution semantics are natively supported |
| `compatible-with-adapter` | Operational after adapter protocol transformation (e.g. MCP connectors mapped into tool namespaces) |
| `manual-review` | Requires manual security inspection prior to activation (e.g. CLI connectors, Hooks, LSP servers) |
| `unsupported` | Explicitly unsupported in the current runtime |
| `pending-legal-review` | Copyright or redistribution rights are unverified; excluded from public markets and default bundles |

### It is really three dimensions

The single status displayed in the UI represents an aggregated view. The ingestion report evaluates three orthogonal dimensions to avoid conflating "convertible" with "verified runnable":

| Dimension | Values | Question it answers |
| --- | --- | --- |
| `semantic_status` | The status enum listed above | Can domain semantics be fully preserved? |
| `runtime_status` | `not-verified` → `adapter-verified` → `runtime-verified` → `release-eligible` | Have the adapter and runtime verified execution? |
| `distribution_status` | `local-only` | Is local installation and redistribution permitted? |

> Components are marked runnable only upon reaching `runtime-verified` status and passing release gates; `pending-legal-review` takes highest precedence and overrides all distribution flags. Note: Catalog interfaces use hyphenated identifiers (e.g. `compatibility_status`), while ingestion reports use underscored keys mapping to the same enum.

## Connectors

Connectors (MCP Servers) are managed by the local host, which owns network connections and credentials to invoke tools on behalf of callers. Interfaces and permissions are strictly bifurcated into two planes:

| Face | Methods | Needs host authorization? |
| --- | --- | --- |
| **Read face** (catalog / status / probe) | `connector/list`, `connector/get`, `connector/status`, `connector/test` | No. `connector/get` and `connector/test` provide JSON Schemas for tool parameter validation |
| **Call face** (actually runs a tool) | `connector/call` | **Yes.** The host `[connector_proxy]` setting is disabled by default; when enabled, active connectors become invocable, subject to granular `allow` / `deny` filtering (see [Configuration file](/en-US/docs/configuration)) |

- **Supported Transports**: Full support for stdio, Streamable HTTP, and standard SSE transports.
- **Credential Isolation**: OAuth flows implement standard PKCE Loopback; access tokens reside in secure storage. Environmental secrets configured in `mcp.json` (`env`/`headers`) use `secret:NAME` references, injected only into child process memory during startup.
- **Invocation Addressing**: Callers reference connectors exclusively via registered identifiers, preventing arbitrary upstream URLs, shell commands, or injected request headers.

### Runtime status

`connector/status` returns the precise operational lifecycle state, evaluated deterministically according to the following precedence:

| Order | Condition | Status |
| --- | --- | --- |
| 1 | Connector is explicitly disabled | `installed` |
| 2 | Most recent physical probe failed | `error` |
| 3 | Requires OAuth authentication that is not yet granted | `authorization_required` |
| 4 | Most recent physical probe succeeded | `connected` |
| 5 | Other states (enabled and authenticated, but not yet verified by a probe) | `configured` |

> The `connected` state requires both valid authentication and a successful physical probe. If authenticated but communication fails, the status falls back to `configured` or `error`.
>
> Invocations should rely on `connector/status` for real-time readiness; `connector/list` provides a lightweight summary without active OAuth verification.

## Non-goals (V1)

Cloud execution, multi-tenancy, high-availability clusters (HA), marketplace administrative portals, signed hot-update systems, and arbitrary untrusted Hook or executable execution are outside the scope of V1.

# Architecture

Flowy Agent Store adopts a **local-first** layered architecture: the cloud manages definitions and distribution, while the local machine owns execution and state persistence.

## Layers

```text
CodeBuddy / WorkBuddy source directories
        ↓ Importer (path / digest / compatibility checks)
PluginSnapshot (versioned, immutable)
        ↓ Catalog
Agent / Team / Skill / Connector definitions
        ↓ Runtime Adapter (domain → allo execution semantics)
allo Runtime (Rust, the only execution engine)
        ↓ Versioned App Server Protocol
TS SDK · CLI · Web UI (protocol clients)
```

## Key boundaries

- **Runtime**: `allo` serves as the sole execution engine, distributed as a self-contained single binary with zero external dependencies and low resource footprint.
- **App Server protocol**: The unified communication interface for the SDK, CLI, and Web UI. It exposes versioned, strongly-typed lifecycle and event messages; public resource identifiers are opaque to encapsulate internal execution IDs.
- **Runtime Adapter**: The sole boundary translating domain models into `allo` internal execution semantics. An Agent Team's Planning Context is derived dynamically at runtime, isolating full member prompts and sensitive credentials.
- **Credentials**: Stored exclusively within local secure storage. Client interfaces (Web / SDK) access only configuration status, account identifiers, and expiration metadata, preventing plaintext secret exposure.

## Agent Team (V1)

Fixed member orchestration driven by Leader planning context over a **planned DAG**:

- The Leader acts as the planning entity and does not maintain a standalone session.
- Independent Steps support granular concurrency, automated retries, and dynamic replanning.
- Event streams, derived artifacts, and terminal states are persisted for queryability and audit replay.

## Principles

- Validate single Agent semantics before building multi-agent Teams.
- The event log serves as the single source of truth; state views are derived projections.
- Capabilities failing runtime verification are never marked runnable.

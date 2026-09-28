# Architecture & System Specification

Flowy Agent Store adopts a **local-first**, highly decoupled, and event-sourced system architecture. Cloud services only manage the distribution and indexing of resource definitions, while the host runtime on the local machine retains full authority over model inference scheduling, tool sandbox execution, workspace state persistence, and sensitive credential management.

---

## 1. System Layered Topology

The system is structured from top to bottom into the distribution layer, ingestion and catalog layer, runtime adaptation layer, execution engine core, wire protocol layer, and presentation layer:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    Cloud & Distribution Layer                           │
│   ModelScope ZIP Archives │ Git / GitHub Repos │ Local Manifest Dirs   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ SHA-256 Digest Verification / Lint
┌────────────────────────────────────▼────────────────────────────────────┐
│                    Ingestion & Catalog Layer                            │
│  Importer Engine ───► PluginSnapshot (Immutable) ───► Local Catalog DB │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Domain Model Decoupling
┌────────────────────────────────────▼────────────────────────────────────┐
│                 Runtime Adaptation & Orchestration Layer                │
│  Agent / Skill / Connector Adapters ───► Agent Team (Planned DAG Engine)│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Execution Instruction Mapping
┌────────────────────────────────────▼────────────────────────────────────┐
│                    Execution Engine Core (allo Engine)                  │
│  Rust Async Runtime (Tokio) │ Tool Sandbox │ MCP Host │ Event Bus       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ App Server Protocol (JSON-RPC 2.0)
┌────────────────────────────────────▼────────────────────────────────────┐
│                    Wire Protocol & Transport Layer                      │
│  WebSocket Bidirectional Stream (Events/Control) │ HTTP Endpoints │ Lock│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Cross-Platform Client Abstraction
┌────────────────────────────────────▼────────────────────────────────────┐
│                    Presentation Layer                                   │
│      Flowy Embedded Web UI │ TypeScript SDK │ Flowy CLI Initializer     │
└─────────────────────────────────────────────────────────────────────────┘
```

Each tier adheres to strict boundaries and unidirectional dependencies:

| Architecture Layer | Core Components | Boundary of Responsibility | State & Lifecycle Semantics |
| --- | --- | --- | --- |
| Distribution Layer | ModelScope CDN, Git remotes, manifest indexes | Maintains metadata packages and versioned archives for experts, skills, and connectors | Stateless, remote read-only, content addressed by SHA-256 digest |
| Ingestion & Catalog Layer | Importer engine, PluginSnapshot store, Catalog index | Path verification, escape mitigation, metadata parsing, immutable snapshot generation, and local registration | Write-once read-only snapshots; version bumps generate distinct snapshot instances |
| Orchestration & Adaptation Layer | Runtime Adapter, Agent Team orchestrator, DAG scheduler | Domain object mapping, dynamic planning context derivation, step dependency resolution, and concurrency control | Dynamically evaluated at runtime, session isolation, member system prompts hermetically partitioned |
| Execution Engine Core | `allo` native core (Rust), async scheduler, MCP Client host | Single binary process, model API transport, sandboxed tool dispatch, append-only event logging | Daemon-grade persistence based on SQLite WAL and local workspace filesystem |
| Wire Protocol Layer | App Server protocol engine, WebSocket server, auth gateway | JSON-RPC 2.0 serialization, protocol version handshake, connection authentication, opaque ID translation | Stateful persistent connection supporting resume with cursor replay and backfill |
| Presentation Layer | Embedded React workbench (Web UI), TypeScript SDK, CLI init tool | User interface rendering, stream handling, command invocation, and local credential setup assistance | Client process lifecycle, fully decoupled from execution core via standard protocols |

---

## 2. Core Subsystem Architecture

### 2.1 Native allo Execution Engine (Rust Core)

The core execution engine `allo` is built entirely in Rust and distributed as a self-contained single binary:

- **Zero External Runtime Dependencies**: The host machine requires no pre-installed Node.js, Python, Docker, or system-level shared libraries; it runs directly out of the box;
- **Lightweight Async Concurrency**: Built upon the Tokio asynchronous runtime, a single thread can drive event scheduling across hundreds of concurrent sessions with significantly lower memory footprint than Electron or Python solutions;
- **Process Crash Isolation**: Model inference network calls, long-running batch operations, and external tool invocations execute within bounded asynchronous tasks, ensuring individual timeouts or errors never crash the host process;
- **Deterministic Execution Scheduling**: All runtime side effects (file mutations, network egress, environment variable reads) pass through unified I/O barriers for auditing and event recording.

### 2.2 App Server Protocol Layer

The presentation tier (Web UI, TypeScript SDK, CLI) communicates with the `allo` runtime via the standardized **App Server Protocol**:

- **Transport Medium**: Uses a bidirectional WebSocket connection for primary event streams (session lifecycles, real-time token streams, tool confirmations, DAG step transitions), supplemented by HTTP endpoints for binary uploads, health checks, and readiness probes;
- **JSON-RPC 2.0 Specification**: All control commands (such as `session/create`, `session/prompt`, `run/cancel`) adhere to JSON-RPC 2.0, providing strict request-response matching and strongly typed error codes;
- **Opaque Identifiers**: All identifiers exposed to clients (e.g. `sess_...`, `run_...`, `snap_...`) are obfuscated opaque strings, hiding database auto-increment keys and physical host file paths;
- **Protocol Version Fingerprint Handshake**: Upon port binding, the host outputs a single JSON notification to stdout containing the protocol fingerprint and authentication status. Clients must verify exact equality of `protocol_version` before proceeding:

```json
{"agent_store":"listening","host":"127.0.0.1","port":8787,"url":"http://127.0.0.1:8787/","protocol_version":"2026.03.v1","version":"0.8.2","auth":"disabled-local"}
```

### 2.3 Asset Ingestion & Immutable Snapshot Engine

External plugins and marketplace packages must traverse a rigorous Importer Pipeline before entering the local runtime, neutralizing malicious path escapes and dependency drift:

```text
[ External Marketplaces / Plugin Dirs / Local Folders ]
                         │
                         ▼
1. Source Resolution & Manifest Parsing (plugin.json / marketplace.json / connectors.json)
                         │
                         ▼
2. Static Security Audit (Directory traversal ../ detection, symlink escape checks, permission lint)
                         │
                         ▼
3. Full Tree SHA-256 Digest Computation (content_digest)
                         │
                         ▼
4. Copy to Versioned Archive Directory (~/.agent-store/snapshots/<slug>-<digest>/)
                         │
                         ▼
5. Generate PluginSnapshot (Records version manifest, dependencies, compatibility matrix)
                         │
                         ▼
[ Write to Local SQLite Catalog for Hermetic Runtime Loading ]
```

- **Snapshot Immutability**: Once written to disk and cataloged, snapshots are marked read-only. Any source code edits or upstream updates trigger the generation of an entirely new snapshot entity;
- **Execution Version Pinning**: Active (in-flight) sessions and Runs pin the specific `PluginSnapshot` instance active at creation time, immune to background catalog refreshes;
- For plugin specifications and marketplace protocols, refer to [Plugins & Marketplace](/en-US/docs/plugins-market).

### 2.4 Local Storage & Concurrency Isolation

Adhering to local data sovereignty, all operational state, session records, and asset caches are persisted within a controlled local data directory (`--data-dir`):

```text
~/.agent-store/ (or platform user directory, e.g. %LOCALAPPDATA%\Flowy\Nomi-dev)
├── config.toml               # Host configuration (API providers / default markets / proxy)
├── mcp.json                  # Static local private MCP Server declarations
├── store.db                  # Primary SQLite database (WAL mode, sessions, Runs, Catalog)
├── store.db-wal              # SQLite Write-Ahead Log
├── store.lock                # Single-instance OS file mutex lock
├── snapshots/                # Physical archive of immutable asset snapshots
│   └── <slug>-<digest>/      # Unpacked snapshot directory (scripts / prompts / assets)
└── workspaces/               # Agent execution workspaces
    └── <workspace_id>/       # Runtime sandbox directory (ephemeral artifacts / generated files)
```

- **Single-Instance Mutex**: An OS-level exclusive file lock (`store.lock`) guarantees that only one `flowy-agent-store` process accesses a data directory at any time, preventing multi-process SQLite corruption;
- **WAL Concurrency Mode**: SQLite operates in WAL (Write-Ahead Logging) mode by default, decoupling read queries from write transactions and ensuring responsive UI updates during high-frequency event streaming.

### 2.5 Security Enclave & Credential Boundaries

The system enforces zero-secret exposure and the Principle of Least Privilege (PoLP) across all authentication layers:

- **`secret:<KEY>` Reference Pattern**: Connector configurations store named credential identifiers rather than raw plaintext API keys or tokens;
- **Local Credential Enclave**: Actual secrets reside in OS-protected secure vaults (e.g. Keychain / DPAPI / restricted-permission secret stores);
- **Interface Masking**: The App Server Protocol and Web UI only expose configuration status (`configured: true`), account masks (e.g. `ak-****98a`), and expiration timestamps; raw secrets never traverse WebSocket or HTTP responses;
- **Network Boundaries**: By default, the server binds to `127.0.0.1` in trusted passwordless mode. Binding to public network interfaces (e.g. `--host 0.0.0.0`) strictly requires enabling `--auth` password protection;
- For detailed configuration parameters and CLI options, see [Configuration](/en-US/docs/configuration) and [Command-Line Interface](/en-US/docs/cli).

---

## 3. Agent Runtime & Orchestration Model

### 3.1 Single Agent Execution Lifecycle

Individual Agent execution within a session is governed by a deterministic state machine spanning context assembly, model inference, tool execution, and event dispatch:

```text
[ User Submits Prompt ]
         │
         ▼
┌─────────────────┐
│ ContextAssembly │ ◄── Assembles: System Prompt + Agent Preset + Bound Skills/Connectors + History
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ModelInference  │ ◄── Streams LLM output, parsing thoughts and Tool Calls
└────────┬────────┘
         │
    ┌────┴───────────────────────────┐
    ▼                                ▼
[ Output Text Token ]          [ Trigger Tool Call ]
    │                                │
    │                                ▼
    │                     ┌────────────────────┐
    │                     │ PermissionBarrier  │ ◄── Validates tool permissions & sandbox path
    │                     └──────────┬─────────┘
    │                                │ (Pass)
    │                                ▼
    │                     ┌────────────────────┐
    │                     │ ToolExecutionHost  │ ◄── Local async execution / MCP dispatch
    │                     └──────────┬─────────┘
    │                                │
    │                                ▼
    │                     [ Append Tool Result ] ───────┐
    │                                                   │
    └───────────────────────────────────────────────────┘
         │
         ▼ (No further tool calls)
┌─────────────────┐
│ RunCompleted    │ ──► Writes terminal event, persists Artifacts, notifies client
└─────────────────┘
```

### 3.2 Agent Team (V1) Planned DAG Orchestration

For complex, multi-step objectives, Flowy Agent Store provides a **Planned DAG** orchestration engine driven by fixed member rosters and dynamic Leader planning contexts:

```text
[ Complex User Objective ]
         │
         ▼
┌────────────────────────────────────────┐
│ Leader Planning Phase (Planning Context)│ ◄── Dynamically derived context; no standalone chat
└──────────────────┬─────────────────────┘
                   │
                   ▼ Generates Planned DAG
      ┌─────────────────────────┐
      │  Step 1: Ingest Data    │ ─── (Agent A: Scraper Expert)
      └────────────┬────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼ (Parallel Concurrency)
┌─────────────────┐ ┌─────────────────┐
│ Step 2: Analysis│ │ Step 3: Modeling│ ─── (Agent B: Analyst / Agent C: Financial Expert)
└────────┬────────┘ └────────┬────────┘
         └─────────┬─────────┘
                   ▼ (Dependency Aggregation)
┌────────────────────────────────────────┐
│ Leader Evaluation & Replan Node        │ ◄── Assesses artifact quality & branch viability
└──────────────────┬─────────────────────┘
                   ├───────────────────────┐ (Outputs fail criteria)
                   ▼ (Evaluation passed)    ▼
┌──────────────────────────────────┐ ┌──────────────────────────────────┐
│ Step 4: Final Synthesis (Agent D)│ │ Dynamic Re-planning Protocol     │
└──────────────────┬───────────────┘ └─────────────────┬────────────────┘
                   │                                   │ Mutates remaining DAG branches
                   ▼                                   └───────────────► Reschedules
[ Terminal State: Succeeded ]
```

- **Leader Planning Role Isolation**: The Leader focuses solely on goal decomposition and graph topology management. It maintains no independent chat history, and its planning prompt is synthesized dynamically, partitioned from member private instructions;
- **Granular Concurrency & Step Retries**: Independent topological steps (such as Step 2 and Step 3 above) execute in parallel; isolated step failures invoke localized retry policies rather than failing the entire graph;
- **Dynamic Re-planning**: If intermediate steps reveal missing data or conflicting assumptions, evaluation nodes trigger the Replan protocol, allowing the Leader to adjust downstream branches while preserving completed artifacts;
- **Human-in-the-Loop Interventions**: Critical decision gates pause graph progression and transition to an awaiting-decision state, accepting external resolutions via [`client.runs.answer`](/en-US/docs/typescript-sdk).

| Architectural Dimension | Single Agent Session | Agent Team (V1) DAG Orchestration | Core Design Constraints |
| --- | --- | --- | --- |
| Planning Pattern | Single-turn or multi-turn reactive Prompt response | Plan-first (Planned DAG), execute, dynamic re-planning | Unplanned out-of-order execution is prohibited; nodes must be defined before execution |
| Context Isolation | Entire conversation window stacked within one Session | Step contexts isolated in slices; members exchange explicit artifacts | Member private instructions are hermetically partitioned to avoid prompt contamination |
| Concurrency Model | Serial execution (single model reasoning stream) | Native parallel scheduling of topologically independent nodes | State synchronization enforced by DAG dependency barriers to eliminate race conditions |
| Intervention Mechanism | User submits plain text prompt in the next turn | Structured question answering (`run/answer`) with pause & resume | External answers are recorded as deterministic immutable inputs in the event log |

---

## 4. Event-Driven Architecture & State Projections

### 4.1 Append-Only Event Log (Single Source of Truth)

The architecture is built fundamentally around **CQRS (Command Query Responsibility Segregation)** and **Event Sourcing**:

- **Event Log as Single Source of Truth**: Every action during execution (state transitions, streaming tokens, tool dispatch, tool responses, file mutations, errors) is recorded as an immutable event appended to the local SQLite log;
- **State Views as Derived Projections**: Session lists, Run progress, DAG node status, and generated file catalogs are read-only projections derived from the underlying event log;
- **Deterministic Historical Replay**: Any historical Run can be reproduced identically by replaying its event stream from sequence zero, recreating the exact reasoning process.

| Event Category | Representative Event Type | Core Payload Fields | Derived Projection Target |
| --- | --- | --- | --- |
| Lifecycle Events | `run/created`, `run/completed`, `run/failed` | `run_id`, `status`, `timestamp`, `error_code` | Run terminal state, duration metrics, quota accounting |
| Orchestration Events | `team/dag_planned`, `team/step_started`, `team/replan` | `nodes`, `dependencies`, `step_id`, `diff` | DAG topology canvas, step progress percentage, active node highlights |
| Inference Events | `message/delta`, `reasoning/delta` | `message_id`, `role`, `content`, `delta` | Frontend typewriter stream, collapsible chain-of-thought panel |
| Tool Events | `tool/called`, `tool/completed`, `tool/failed` | `call_id`, `tool_name`, `arguments`, `output` | Tool inspection drawer, external system sync status, audit logs |

### 4.2 Streaming & Resilient Catch-Up Mechanism

To maintain resilience across network drops, page refreshes, or client restarts, the event stream utilizes monotonic sequences and cursor resume:

```json
{
  "sequence": 1042,
  "run_id": "run_01j7x8a9bcdef0123456789abc",
  "event_type": "team/step_completed",
  "timestamp": 1774780800000,
  "payload": {
    "step_id": "step_extract_data",
    "status": "succeeded",
    "artifact_id": "art_01j7x8b0123456789abcdef012"
  }
}
```

- **Monotonically Increasing `sequence`**: All events within a Run receive a continuous, sequential index, enabling clients to immediately detect dropped packets;
- **Cursor Replay**: When reconnecting, clients send a parameterized subscription request (e.g. `run/events?after=1041`); the server streams only missed events, avoiding heavy full-database re-queries;
- **Full State Backfill**: If a client has been disconnected beyond the memory buffer window, the protocol gracefully falls back to full state projection retrieval, ensuring frontend-backend synchronization.

---

## 5. Core Design Principles & Engineering Constraints

Every system extension and feature iteration must satisfy these five foundational principles:

1. **Local-First & Data Sovereignty**  
   User business contexts, codebases, conversation histories, and private model credentials remain strictly within the local workspace. Unauthorized cloud telemetry or background data transmission is strictly forbidden.
2. **Contract Verification Before Orchestration**  
   Before any Agent or tool participates in multi-agent team workflows, it must first pass isolated input/output contract verification and sandbox checks in single-agent mode. Capabilities failing local environment probes are never marked runnable.
3. **Fail-Fast & Deterministic Replay**  
   Underlying exceptions and tool errors must surface explicitly with typed error codes and contextual parameters; silent catch-alls and speculative guessing are prohibited. System state must always be 100% reproducible from the event log.
4. **Least Privilege & Zero-Visibility Secrets**  
   Tool invocations and MCP operations receive only the minimum file and network permissions necessary for the current task. Sensitive credentials are sanitized before traversing the protocol or rendering layers, eliminating plaintext leakage.
5. **Immutable Snapshots & Hermetic Environments**  
   Marketplace assets and dependencies are version-pinned using SHA-256 digests. Running tasks are hermetically locked to snapshot directories, insulating executions from upstream or local package changes. System upgrades follow standardized migration procedures detailed in [Upgrade & Migration Guide](/en-US/docs/upgrade).

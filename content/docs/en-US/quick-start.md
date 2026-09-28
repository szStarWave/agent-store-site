# Quick start

Flowy Agent Store distributes a local-first agent runtime and an embedded Web UI as a **single executable**. The system requires no external database, container orchestration, or background daemon services.

## 1. Download and launch

Download the release archive for the target platform from [GitHub Releases](https://github.com/szStarWave/agent-store-site/releases), extract it, and execute the binary:

```bash
flowy-agent-store
```

The process initializes the local App Server (default `http://localhost:8787`) and launches the workbench in the default browser.

> Local-first architecture: All execution logic, credentials, and session states reside exclusively on the local machine; the cloud is used solely for capability definitions, version metadata, and package distribution.

## 2. Import an Agent

The workbench imports experts (Agents), Skills, and Connectors from CodeBuddy / WorkBuddy directory formats. Imported assets are converted into **immutable snapshots** available for catalog querying and execution.

To preconfigure default marketplace sources and initialize model API providers, run the optional setup wizard:

```bash
flowy-agent-store init
```

## 3. Start a run

Select an Agent from the catalog and trigger execution to initialize a Run instance. Execution event streams, DAG orchestration plans, and generated artifacts stream into the workbench panels in real time.

## Next steps

- Read [CLI usage](/en-US/docs/cli) for launch options and environment variables.
- Read [Architecture](/en-US/docs/architecture) to understand runtime layering and protocol boundaries.
- Read the [Compatibility matrix](/en-US/docs/compatibility) for platform and source format support.
- To integrate programmatically within Node.js, Electron, or browser applications, refer to the [TypeScript SDK reference](/en-US/docs/typescript-sdk) and [TypeScript SDK cookbook](/en-US/docs/examples-sdk) (binary installers are recommended for end users; npm packages are provided for developers).

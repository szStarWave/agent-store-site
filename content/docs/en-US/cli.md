# CLI usage

`flowy-agent-store` serves as the entry point for the single-binary runtime: the backend service and the embedded Web UI are hosted on the same port. The CLI manages startup parameters and defaults directly into server mode, providing an optional `init` command for setup assistance.

## Launch the Web UI

```bash
flowy-agent-store
flowy-agent-store --port 8787
```

Listens on `http://127.0.0.1:8787/` by default and automatically launches the workbench in the default browser.

| Flag | Description | Default |
| --- | --- | --- |
| `--port <n>` | Listening port (shared between API and embedded Web UI); `--port 0` dynamically binds an available port | `8787` |
| `--host <ip>` | Bind address; keep `127.0.0.1` for local-only isolation | `127.0.0.1` |
| `--data-dir <dir>` | Backend data storage directory (database and snapshots); defaults to per-channel user data path (e.g. `%LOCALAPPDATA%\Flowy\Nomi-dev` on the `dev` channel) | Per-user Flowy/Nomi data directory |
| `--auth` | Enable password authentication; disabled by default for trusted local execution | Disabled |
| `--no-open` | Prevent opening the browser upon service startup | Auto-open |
| `--admin-user <name>` | Pre-seeded administrator username in authenticated mode | `admin` |
| `--admin-password <pw>` | Pre-seeded administrator password in authenticated mode; prompts on first Web UI access if omitted | None |
| `-h, --help` / `-V, --version` | Display help information / version number | — |

## Subcommands

In addition to direct execution, the CLI provides the following subcommand:

| Subcommand | What it does |
| --- | --- |
| `flowy-agent-store init` | Interactive setup wizard: writes default marketplace sources into `~/.agent-store/config.toml` and guides the initial API provider setup. This step is optional; default built-in sources apply automatically if skipped, as documented in [Configuration file](/en-US/docs/configuration) |

## The line it prints on stdout at startup

Upon successfully binding the socket, the host process emits a single-line machine-readable JSON readiness event to standard output (system tracing also writes to stdout; this line is not guaranteed to be the first emitted line):

```json
{"agent_store":"listening","host":"127.0.0.1","port":8787,"url":"http://127.0.0.1:8787/","protocol_version":"…","version":"…","auth":"disabled-local"}
```

- **SDK Process Contract**: The SDK parses stdout line by line and matches only the JSON payload containing `"agent_store": "listening"`. This payload exposes no secret credentials.
- The `auth` field declares the access mode: `disabled-local` (trusted local mode) or `required` (password authentication).
- `protocol_version` represents the protocol contract fingerprint. The client verifies it via strict equality during handshake. Refer to the [Upgrade and migration guide](/en-US/docs/upgrade) for version compatibility details.

## Examples

```bash
# Bind an alternate port if default is occupied (Web UI auto-connects to same origin)
flowy-agent-store --port 8788

# Enable access across local network (recommended with --auth enabled)
flowy-agent-store --host 0.0.0.0 --auth

# Seed administrator credentials in authenticated mode
flowy-agent-store --auth --admin-user admin --admin-password <pw>

# Headless server deployment with custom data directory
flowy-agent-store --data-dir /data/agent-store --no-open
```

## Environment variables

All command-line arguments support environment variable equivalents: `AGENT_STORE_HOST`, `AGENT_STORE_PORT`, `AGENT_STORE_AUTH` (set to `1`/`true`/`yes`/`on` to enable), `NOMIFUN_DATA_DIR` / `FLOWY_DATA_DIR` (custom data directory), and `NOMIFUN_ADMIN_USERNAME` / `NOMIFUN_ADMIN_PASSWORD` (initial admin credentials for authenticated mode).

## Notes

- **Port Conflict Handling**: The process terminates with an error if the specified port is already bound. Terminate the conflicting process or supply an alternative via `--port`. Specifying `--port 0` allows dynamic allocation by the OS, with the assigned port reported via the stdout JSON line (recommended for CI and multi-instance concurrency).
- **Web UI Origin Discovery**: The embedded frontend automatically binds to the origin serving it. Modifying `--port` or `--host` requires no manual configuration updates in the client, while custom API overrides remain supported via Settings.
- **Data Directory Mutual Exclusion**: The backend acquires an exclusive file lock on the data directory. Concurrent instances targeting the same directory fail fast to protect against database corruption.
- **Network Security Constraints**: Binding to a non-loopback interface (such as `--host 0.0.0.0`) without `--auth` grants full administrative host access to all reachable network clients. Always enable `--auth` in non-trusted networks.
- **Architectural Boundary**: Resource import, execution scheduling, and state inspection are strictly mediated by the App Server protocol. Direct filesystem access to internal databases or secret storage is forbidden.

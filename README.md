# webterm backend

A small Go server that bridges a real pseudo-terminal to a WebSocket and serves
the [webterm frontend](../frontend) from memory. One static binary, one
optional YAML file - nothing else to install.

- Real pty on every platform: `creack/pty` on Linux/macOS, ConPTY on Windows
- WebSocket endpoint `/pty` with a tiny raw protocol (see
  [docs/protocol.md](docs/protocol.md)), including terminal resize
- The frontend is embedded with `go:embed`, so the binary also serves the web UI
- Optional HTTP Basic Auth and/or a token, plus an IP allow-list
- Configurable shell, environment and (experimental) run-as user
- Cross-compiles to Windows, Linux and macOS on amd64 and arm64

## Quick start

Download or build a binary (see below), then:

```sh
./webterm                  # reads webterm.yml from the current directory, or uses defaults
./webterm /path/to/config.yml
```

Open <http://localhost:3000>. Without a config file the server listens on
`0.0.0.0:3000`, has no authentication and no IP restrictions, and starts
`powershell.exe` on Windows or `$SHELL` (falling back to `bash`) elsewhere.

> **Security:** this program gives whoever can reach it a shell on your machine.
> The defaults are for trying it out. For anything beyond that, listen on
> `127.0.0.1`, or enable authentication **and** an IP allow-list, and put TLS in
> front of it. WebSocket handshakes from other sites are rejected by the Origin check
> (see [docs/security.md](docs/security.md)), but set an `auth.token` regardless.

## Build

Requires Go (see `go.mod` for the version).

```sh
./build.sh      # Linux/macOS
./build.ps1     # Windows (PowerShell)
```

Binaries are written to `dist/webterm-<os>-<arch>[.exe]` for
windows/linux/darwin x amd64/arm64. For a single target:

```sh
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o webterm ./cmd/webterm
```

### The embedded frontend

The web UI is shipped as a ready copy in `internal/webassets/web/` (it is
committed, so `go build` works on a fresh clone). If you develop the frontend in
the sibling `../frontend` repository, run `./sync-frontend.sh` (or
`sync-frontend.ps1`) before building to refresh that copy; `build.sh` /
`build.ps1` do it for you. Without a sibling `../frontend` the script does
nothing.

## Configuration

Copy [config.example.yml](config.example.yml) to `webterm.yml` in the directory you
run the binary from (or pass another path as the first argument). The full guide is
[docs/configuration.md](docs/configuration.md).

| Key | Default | Description |
|---|---|---|
| `listen.ip` | `0.0.0.0` | Address to listen on |
| `listen.port` | `3000` | TCP port |
| `shell.cmd` | auto | Program to run. Empty: `powershell.exe` on Windows, `$SHELL` / `bash` elsewhere |
| `shell.args` | `[]` | Arguments for the shell |
| `env.inherit` | `true` | Pass the backend's own environment to the shell |
| `env.vars` | `{}` | Extra or overriding environment variables |
| `runas.user` | empty (off) | Run the shell as another user (experimental, see below) |
| `runas.password_env` | empty | Name of the environment variable holding the password (Windows) |
| `runas.workdir` | empty | Working directory of the shell |
| `auth.enabled` | `false` | Turn authentication on |
| `auth.user`, `auth.pass` | empty | HTTP Basic Auth for the page and the WebSocket upgrade |
| `auth.token` | empty | Token required as `?token=...` on the WebSocket URL |
| `access.allowed_ips` | `[]` (everyone) | IPs / CIDR subnets allowed to connect |
| `access.allowed_origins` | `[]` (same-origin only) | Extra web origins allowed to open the WebSocket: `https://host`, `file://` (pages opened from a file), or `*` (disables the check) |

Examples:

```yaml
# local only, bash inside WSL
listen: { ip: 127.0.0.1, port: 3000 }
shell: { cmd: wsl.exe, args: ["-d", "Ubuntu", "-e", "bash"] }
```

```yaml
# LAN access with credentials and an allow-list
listen: { ip: 0.0.0.0, port: 3000 }
auth: { enabled: true, user: me, pass: change-me, token: some-long-random-string }
access: { allowed_ips: ["192.168.1.0/24"] }
```

### Run-as (experimental)

`runas` starts the shell as a different user.

- **Unix:** the backend must run as root; it switches uid/gid on exec. No password.
- **Windows:** uses `LogonUser` and `CreateProcessAsUser` with a hand-built ConPTY.
  Provide the password through the environment variable named in
  `runas.password_env`; never put it in the config file.

Both paths are experimental and have not been tested end to end on every
platform. Test them in a safe environment before relying on them.

## Guides

- [Building and deploying](docs/deployment.md): all platforms, systemd / launchd /
  Windows scheduled task, reverse proxy with TLS
- [Configuration](docs/configuration.md): every option, recipes, how to verify
- [Security](docs/security.md): **read before exposing the server**; why a token is
  required even on localhost, allow-list limits, privileges
- [Protocol](docs/protocol.md): the WebSocket protocol, for writing other clients or backends

## Protocol

See [docs/protocol.md](docs/protocol.md). In short: text frames carry raw
input/output, and a 4-byte binary frame (`uint16` cols, `uint16` rows, big-endian)
resizes the pty.

## Project layout

```
cmd/webterm/             entry point
internal/server/         HTTP + WebSocket handlers
internal/ptyshell/       pty abstraction (unix, windows, run-as)
internal/config/         YAML config
internal/auth/           Basic auth and token checks
internal/access/         IP allow-list
internal/webassets/web/  embedded copy of the frontend
```

## License

See the `LICENSE` file. Third-party notices: [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

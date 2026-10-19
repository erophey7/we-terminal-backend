# Building and deploying

This guide covers building the backend for each platform and running it as a
long-lived service. Read the [security guide](security.md) first: the backend
hands out shells.

The configuration file is described in [configuration.md](configuration.md).

## Requirements

| | |
|---|---|
| Build | Go (the version in `go.mod`); no C compiler needed - the binaries are built with `CGO_ENABLED=0` |
| Run on Linux / macOS | nothing, it is a static binary |
| Run on Windows | Windows 10 version 1809 or later (ConPTY) |

## Building

### All platforms at once

```sh
./build.sh        # Linux / macOS
./build.ps1       # Windows PowerShell
```

This writes `dist/webterm-<os>-<arch>[.exe]`:

| Target | File |
|---|---|
| Windows x64 / ARM64 | `dist/webterm-windows-amd64.exe`, `dist/webterm-windows-arm64.exe` |
| Linux x64 / ARM64 | `dist/webterm-linux-amd64`, `dist/webterm-linux-arm64` |
| macOS Intel / Apple silicon | `dist/webterm-darwin-amd64`, `dist/webterm-darwin-arm64` |

### One target

```sh
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags="-s -w" -o webterm ./cmd/webterm
```

On Windows PowerShell:

```powershell
$env:CGO_ENABLED = "0"; $env:GOOS = "linux"; $env:GOARCH = "amd64"
go build -trimpath -ldflags="-s -w" -o webterm ./cmd/webterm
```

Cross-compiling works from any host. The embedded web UI is committed in
`internal/webassets/web/`, so a plain `go build` is enough; see the README if you
develop the frontend alongside.

### Checking what you built

```sh
sha256sum dist/*        # publish the checksums with your releases
./dist/webterm-linux-amd64 &   # start it
curl -sI http://127.0.0.1:3000/ | head -1
```

## First run

```sh
cd /opt/webterm && ./webterm                 # reads ./webterm.yml
./webterm /etc/webterm/webterm.yml           # explicit path
```

The config file is looked up in the **current working directory** unless you pass a
path. Services should therefore set a working directory or pass an absolute
path (the examples below do).

## Linux (systemd)

1. Create a dedicated unprivileged user and install the files:

   ```sh
   sudo useradd --system --create-home --home-dir /var/lib/webterm --shell /usr/sbin/nologin webterm
   sudo install -D -m 0755 dist/webterm-linux-amd64 /opt/webterm/webterm
   sudo install -D -m 0640 -o root -g webterm webterm.yml /etc/webterm/webterm.yml
   ```

   `/etc/webterm/webterm.yml` (listen on loopback and require a token):

   ```yaml
   listen: { ip: 127.0.0.1, port: 3000 }
   auth: { enabled: true, token: "REPLACE-WITH-LONG-RANDOM-VALUE" }
   shell: { cmd: /bin/bash }
   env: { inherit: false, vars: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/var/lib/webterm", LANG: "C.UTF-8", TERM: "xterm-256color" } }
   ```

2. `/etc/systemd/system/webterm.service`:

   ```ini
   [Unit]
   Description=webterm backend
   After=network.target

   [Service]
   User=webterm
   Group=webterm
   WorkingDirectory=/var/lib/webterm
   ExecStart=/opt/webterm/webterm /etc/webterm/webterm.yml
   Restart=on-failure
   RestartSec=2
   # Hardening - the shell users get is as powerful as these limits allow.
   NoNewPrivileges=true
   PrivateTmp=true
   ProtectSystem=strict
   ReadWritePaths=/var/lib/webterm
   ProtectHome=true
   ProtectKernelTunables=true
   ProtectControlGroups=true

   [Install]
   WantedBy=multi-user.target
   ```

   `ProtectSystem=strict` makes the filesystem read-only for the shell except for
   `ReadWritePaths`; loosen it if users need to work elsewhere, knowing that this
   widens what a compromise can reach.

3. ```sh
   sudo systemctl daemon-reload
   sudo systemctl enable --now webterm
   sudo systemctl status webterm
   journalctl -u webterm -f
   ```

For `runas` on Linux the backend needs root (it switches uid/gid), which conflicts with
the unprivileged-user advice above. Prefer one backend instance per user.

## macOS (launchd)

Install the binary and config (for example `/usr/local/webterm/`) and create
`~/Library/LaunchAgents/com.example.webterm.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.example.webterm</string>
  <key>ProgramArguments</key><array>
    <string>/usr/local/webterm/webterm</string>
    <string>/usr/local/webterm/webterm.yml</string>
  </array>
  <key>WorkingDirectory</key><string>/usr/local/webterm</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
```

```sh
launchctl load ~/Library/LaunchAgents/com.example.webterm.plist
```

A LaunchAgent runs as your own user, in your login session, which is what you want for
a personal terminal.

## Windows

The backend needs an interactive user context for the shell you expect (your
profile, `PATH`, WSL). The simplest robust setup is a **scheduled task that runs at
logon**:

```powershell
$exe = "C:\webterm\webterm.exe"
$action  = New-ScheduledTaskAction -Execute $exe -Argument "C:\webterm\webterm.yml" -WorkingDirectory "C:\webterm"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "webterm" -Action $action -Trigger $trigger -Settings $settings
```

To run hidden without a task: `Start-Process -WindowStyle Hidden -FilePath C:\webterm\webterm.exe -ArgumentList C:\webterm\webterm.yml`.

Notes:

- Run it as a normal user, not as Administrator.
- Allow the program through the Windows firewall only if other machines must connect;
  for local use listen on `127.0.0.1` and no rule is needed.
- Running it as a Windows service (for example with a service wrapper) puts it in a
  non-interactive session with a different environment; this has not been tested here,
  so prefer the scheduled task unless you know you need a service.
- For a Linux shell on Windows use WSL: `shell: { cmd: wsl.exe, args: ["-d", "Ubuntu", "-e", "bash"] }`.

## Behind a reverse proxy (TLS)

Keep the backend on `127.0.0.1` and let the proxy terminate TLS and forward both the
page and the `/pty` WebSocket. The proxy must support WebSocket upgrades. Remember
that the backend then sees the proxy's address as the client - do access control in the
proxy (see [security.md](security.md#ip-allow-list-limits)) and keep the token.

### Caddy

```
term.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy obtains the certificate automatically and proxies WebSockets without extra
configuration.

### nginx

```nginx
server {
    listen 443 ssl;
    server_name term.example.com;
    # ssl_certificate / ssl_certificate_key ...

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 1d;      # keep idle terminals open
    }
}
```

Open `https://term.example.com/?token=...` (or put the full WebSocket URL with the
token into the Wallpaper Engine properties: `wss://term.example.com/pty`).

## Updating

Rebuild (or download) the new binary, replace the old one and restart the service.
Sessions end when the service restarts. Keep an eye on new releases of the Go
toolchain and dependencies and rebuild periodically.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Page loads but the terminal says offline | WebSocket blocked: wrong `ws` address, missing token (HTTP 401), IP not in `allowed_ips` (HTTP 403), or a proxy without WebSocket upgrade support |
| Terminal offline, log says `rejected Origin ...` | The page's origin is not allowed: add it to `access.allowed_origins` (`file://` for Wallpaper Engine) |
| Works on `127.0.0.1`, fails on `localhost` | `localhost` resolves to `::1`; add `"::1"` to `allowed_ips`, or use `127.0.0.1` in the URL |
| Full-screen apps look garbled | The client did not send the resize frame (use the bundled frontend) |
| Shell starts with no `PATH` / wrong user | The service environment differs from your login shell; set `env.vars` or `env.inherit` |
| `bind: address already in use` | Another process uses the port; change `listen.port` |
| Config seems ignored | It is read from the working directory unless you pass a path |

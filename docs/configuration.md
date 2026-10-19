# Configuration guide

The backend is configured with one optional YAML file. A complete commented
example is in [`config.example.yml`](../config.example.yml). For hardening advice
see [security.md](security.md); for running it as a service see
[deployment.md](deployment.md).

## How the file is found

```sh
./webterm                      # reads ./webterm.yml from the CURRENT WORKING DIRECTORY
./webterm /etc/webterm.yml     # reads the given path
```

Two behaviors to know:

- **A missing file is not an error.** The server then starts with the defaults:
  `0.0.0.0:3000`, **no authentication**, no IP restrictions, auto-detected shell. A
  typo in the path therefore silently gives you an open server.
- **Unknown keys are ignored.** A misspelled key (for example `tocken:`) is skipped
  without a warning, so the protection you thought you had is not there.

Always check the startup log. For a locked-down setup you should see:

```
webterm backend listening on http://127.0.0.1:3000
  auth: enabled (user="" token=true)
  allowed_ips: [127.0.0.1 ::1]
```

If the `auth:` line is missing, authentication is off; `token=false` means the token
is not set (a misspelled `token` key looks exactly like this).

## Reference

### `listen`

```yaml
listen:
  ip: 127.0.0.1    # default 0.0.0.0
  port: 3000       # default 3000
```

`127.0.0.1` accepts local connections only. `0.0.0.0` accepts connections on every
IPv4 interface (see the [security guide](security.md) before using it).

### `shell`

```yaml
shell:
  cmd: ""          # empty: powershell.exe (Windows) / $SHELL or bash (Unix)
  args: []
```

Any program can be the "shell" - it runs inside a pty with the terminal attached:

```yaml
shell: { cmd: /bin/bash, args: ["-l"] }              # login shell
shell: { cmd: cmd.exe }                              # Windows cmd
shell: { cmd: wsl.exe, args: ["-d", "Ubuntu", "-e", "bash"] }   # bash in WSL
shell: { cmd: htop }                                 # a dashboard instead of a shell
shell: { cmd: tmux, args: ["new-session", "-A", "-s", "main"] } # attach to a persistent session
```

Every WebSocket connection starts its own process; when the connection closes the
process is terminated. For sessions that survive reconnects, run `tmux` or `screen`
as shown above.

### `env`

```yaml
env:
  inherit: true           # default true
  vars:
    LANG: "en_US.UTF-8"
```

With `inherit: true` the shell receives the backend's own environment plus `vars`
(which win on conflict). With `inherit: false` only `vars` are passed - recommended when
the backend's environment holds secrets, but then set at least `PATH`, `HOME` and
`LANG`. On Unix `TERM` defaults to `xterm-256color` if you do not set it.

### `auth`

```yaml
auth:
  enabled: true
  user: "me"             # optional: HTTP Basic Auth for the page and the WebSocket
  pass: "a-long-password"
  token: "64-hex-chars"  # optional: required as ?token=... on the WebSocket URL
```

- Nothing is enforced unless `enabled: true`.
- Basic Auth is checked when `user` is non-empty; the token when `token` is non-empty.
  If you set both, the WebSocket needs both; the static files need only Basic Auth.
- **Use a token** (see [why](security.md#why-a-token-is-mandatory-even-on-localhost)).
- Generate one with `openssl rand -hex 32`.

### `access`

```yaml
access:
  allowed_ips:
    - "127.0.0.1"
    - "::1"
    - "192.168.1.0/24"
```

An empty list allows everyone. Entries are single IPs or CIDR subnets, IPv4 or
IPv6. A malformed entry makes the server refuse to start. The check uses the TCP
peer address (proxy headers are ignored); read the
[limits](security.md#ip-allow-list-limits).

```yaml
access:
  allowed_origins:
    - "https://term.example.com"
    - "file://"
```

`allowed_origins` controls which **web pages** may open the WebSocket (see
[security.md](security.md#cross-site-websocket-hijacking-and-the-origin-check)). By
default only pages served by this server itself are accepted, plus clients that send no
`Origin` header (curl, scripts). Entries are exact origins (`scheme://host[:port]`),
`"file://"` (also written `"null"`) for pages opened from a file such as a Wallpaper
Engine wallpaper, or `"*"` to disable the check. A rejected handshake is logged with the
origin it came from, so the log tells you what to add. Allowing `file://` or `*` without
a token makes the server print a warning at startup.

### `runas` (experimental)

```yaml
runas:
  user: "svc-terminal"
  password_env: "WEBTERM_RUNAS_PASSWORD"   # Windows only
  workdir: ""
```

Starts the shell as another user. Unix: the backend must run as root; no password. Windows:
the account's password is read from the named environment variable. Both are
experimental - see [security.md](security.md#privileges-and-isolation).

## Recipes

### Personal, local only

```yaml
listen: { ip: 127.0.0.1, port: 3000 }
auth: { enabled: true, token: "REPLACE-WITH-LONG-RANDOM-VALUE" }
access: { allowed_ips: ["127.0.0.1", "::1"] }
```

Open `http://localhost:3000/?token=REPLACE...`.

### Wallpaper Engine on the same machine

```yaml
listen: { ip: 127.0.0.1, port: 3000 }
auth: { enabled: true, token: "REPLACE-WITH-LONG-RANDOM-VALUE" }
access:
  allowed_ips: ["127.0.0.1", "::1"]
  allowed_origins: ["file://"]      # the wallpaper page is loaded from a file
```

In the wallpaper properties set the address to `ws://localhost:3000/pty` and the token
to the same value. Without `allowed_origins` the backend rejects the wallpaper (the log
shows `rejected Origin "null"`). If `localhost` does not connect, use
`ws://127.0.0.1:3000/pty` or make sure `::1` is in `allowed_ips`.

### Another machine on your LAN

```yaml
listen: { ip: 0.0.0.0, port: 3000 }
auth: { enabled: true, user: me, pass: "a-long-password", token: "REPLACE-WITH-LONG-RANDOM-VALUE" }
access: { allowed_ips: ["192.168.1.0/24"] }
```

This is plain HTTP on your network; prefer a VPN or TLS
([deployment.md](deployment.md#behind-a-reverse-proxy-tls)).

### Behind a reverse proxy

```yaml
listen: { ip: 127.0.0.1, port: 3000 }
auth: { enabled: true, token: "REPLACE-WITH-LONG-RANDOM-VALUE" }
# no allowed_ips here: the backend only ever sees the proxy
```

Restrict who can reach the proxy in the proxy's own configuration.

## Validating a configuration

1. Start it and read the log lines above.
2. From another terminal, check that unauthenticated access is refused:

   ```sh
   curl -si http://127.0.0.1:3000/pty | head -1        # expect: HTTP/1.1 401 Unauthorized
   ```

3. Check the IP restriction from a machine that should be blocked (expect HTTP 403).

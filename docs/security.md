# Security guide

**webterm gives whoever can talk to it a shell on the machine, with the
privileges of the user it runs as.** That is the whole point of the program, and
it also means a configuration mistake is remote code execution. Read this page
before exposing the server to anything other than your own machine.

## Checklist

Before you use it for real:

- [ ] **Set `auth.token` to a long random value - even if you only listen on
      `127.0.0.1`.** The Origin check (below) blocks ordinary cross-site pages, but it
      cannot protect you if you allow `file://`/`null` or `*`, and scripts or
      other local programs are not covered by it at all.
- [ ] Keep `access.allowed_origins` as short as possible; never use `"*"` on a
      server that is reachable by other people.
- [ ] Listen on `127.0.0.1` unless you really need other machines to connect.
- [ ] **Verify the startup log** shows `auth: enabled (... token=true)`. A missing or
      misnamed config file silently starts an open server (see
      [configuration.md](configuration.md#how-the-file-is-found)).
- [ ] If other machines connect, put **TLS** in front (reverse proxy) or use a
      VPN such as WireGuard/Tailscale. Never expose the plain port to the Internet.
- [ ] Run the backend as a **dedicated unprivileged user**, never as root or an
      administrator.
- [ ] Restrict the config file's permissions: it contains `auth.pass` /
      `auth.token`.
- [ ] Decide what the shell may inherit: `env.inherit: true` passes the backend's
      whole environment (including any secrets in it) to every session.
- [ ] Do not rely on the frontend's `readonly` option for protection (see below).
- [ ] Keep Go and the dependencies up to date when you rebuild.

## Cross-site WebSocket hijacking and the Origin check

Browsers let **any** web page open a WebSocket to other hosts, including
`ws://127.0.0.1:3000/pty` on your own machine, and the IP allow-list cannot help:
the request really does come from `127.0.0.1` (your own browser). Without a defense,
a malicious page you happen to visit could connect to your local webterm and type
commands into your shell. This is called cross-site WebSocket hijacking.

**What the server does.** The WebSocket handshake carries an `Origin` header that
a web page cannot forge. The server rejects the handshake (HTTP 403, with a log line
naming the origin) unless:

- the request has **no** `Origin` header (it does not come from a web page: curl,
  scripts, native clients), or
- the origin is **same-origin** with the server (the page was served by this very
  backend), or
- the origin is listed in `access.allowed_origins`.

```yaml
access:
  allowed_origins:
    - "https://term.example.com"   # a frontend hosted elsewhere
    - "file://"                    # pages opened from a file (Wallpaper Engine)
```

**The `null` / `file://` caveat.** Pages loaded from files (such as a Wallpaper Engine
wallpaper) report the origin `null`. So do sandboxed iframes and `data:` pages, which a
hostile site can create at will. Allowing `file://` therefore re-opens the door for
those pages; **the token is then your only protection**. The server logs a warning at
startup when `null` is allowed and no token is set. The same applies to `"*"`, which
disables the check.

**Use a token anyway.** A token in the WebSocket URL (`?token=...`) is not known to
the attacker's page, and it also covers non-browser attackers. HTTP Basic Auth alone is
**not** a reliable defense: browsers may attach cached Basic credentials to the
handshake. Use the token, and optionally Basic Auth on top.

```yaml
auth:
  enabled: true
  token: "<64 random hex characters>"
```

Generate one:

```sh
openssl rand -hex 32                                   # Linux / macOS
```
```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })   # Windows PowerShell
```

(`Get-Random` is fine for a personal token; for a shared deployment prefer
`openssl` or another cryptographically secure generator.)

Then open the frontend with `?token=<value>` (or set it in the Wallpaper
Engine property).

## Transport security (TLS)

- Plain `ws://` / `http://` send everything - keystrokes, output, the token and
  Basic credentials - in clear text. That is acceptable only on loopback.
- A token in a URL can end up in proxy and access logs and in browser history.
  Treat it like a password: use TLS, rotate it if it leaks, and keep it out of
  shared screenshots.
- Terminate TLS in a reverse proxy (examples in
  [deployment.md](deployment.md#behind-a-reverse-proxy-tls)).

## IP allow-list limits

`access.allowed_ips` compares the **TCP peer address** of the connection. The
server deliberately ignores `X-Forwarded-For` and similar headers.

- Behind a reverse proxy the peer is the proxy (usually `127.0.0.1`), so the
  list can no longer tell clients apart. Restrict clients **in the proxy** and let
  the backend accept only the proxy's address.
- Include both `127.0.0.1` and `::1` for local use: `localhost` may resolve to
  either, and a list with only one of them rejects the other.
- NAT, VPNs and shared networks can make many users share one address.

## Privileges and isolation

- Whatever the shell can do, the connected user can do. Run the backend as a
  separate user with only the access it needs. On Linux use the sandboxing
  options in the [systemd example](deployment.md#linux-systemd); on Windows use a
  standard (non-administrator) account.
- **Run-as** (`runas`) needs root on Unix and a stored password on Windows. It is
  experimental. If you use it, treat the backend as a privileged component:
  anything that compromises the backend can start shells as the target user.
  Never write the password into the config - only the name of the environment
  variable that holds it. Environment variables are readable by the same user and
  by administrators, so do not treat them as a vault.
- Each WebSocket connection creates a new shell process. There are **no
  connection limits and no rate limiting or lockout** for wrong tokens/passwords.
  The token's length is what protects you from guessing; add limits in the
  reverse proxy (or a tool such as fail2ban) if the service is reachable by
  untrusted networks.

## `readonly` is not a security control

The frontend's `readonly` option (and the Wallpaper Engine "view-only" property)
only stops the **UI** from sending input. The backend still accepts input from
anyone who can connect. Use it for kiosk-style displays on a trusted machine, not
to make a terminal safe to share. If you need a read-only view, put a
proxy/filter or a restricted shell (for example one that only runs `tmux attach
-r`) behind it.

## Environment variables

With `env.inherit: true` (the default) the shell sees every variable of the
backend process: tokens, cloud credentials, proxy settings. If the backend is
started from a shell or service that holds secrets, set `env.inherit: false` and
list only what the session needs under `env.vars` (at least `PATH`, `HOME` and
`LANG` on Unix).

## Logs and secrets

The backend does not log terminal input or output. Reverse proxies, however,
typically log request URLs - including `?token=...`. Scrub or disable that.
Keep tokens and passwords out of the repository and out of shell history; prefer
a config file with restricted permissions.

## Wallpaper Engine specifics

The token you enter in the wallpaper's properties is stored in Wallpaper Engine's
configuration in clear text on your disk. Anyone who can read your profile can read
it. Use a token that is only valid for this backend, and keep the backend on
loopback or a trusted network.

## Reporting a vulnerability

Please report security problems privately to the maintainers (see the repository's
security policy or contact details) rather than in a public issue.

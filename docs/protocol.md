# Frontend <-> backend protocol

The frontend and the backend talk over a single WebSocket. There is no JSON
envelope: the connection is (almost) a raw pipe to a pseudo-terminal.

## Endpoint

```
ws://host:port/pty            (wss:// behind TLS)
ws://host:port/pty?token=...  (when a token is configured)
```

Every WebSocket connection starts its own shell in its own pty. When the
connection closes the shell process is terminated. There is no session
persistence or multiplexing.

## Messages

| Direction | Frame | Meaning |
|---|---|---|
| server -> client | text | Raw pty output (terminal escape sequences included) |
| client -> server | text | Raw terminal input, written to the pty as is. This is whatever a terminal emulator would send for key presses, pastes and mouse reports, including escape sequences |
| client -> server | binary, 4 or 8 bytes | **Resize**: `uint16` columns, `uint16` rows, and optionally `uint16` width and `uint16` height of the terminal area in pixels (8 bytes). All big-endian |

Binary frames of any other length are ignored. On Unix the pixel size is stored in the pty
(`ws_xpixel` / `ws_ypixel`), which graphics tools such as `kitten icat` and `chafa` read to
scale images; ConPTY on Windows has no pixel size, so it is ignored there. Text frames are never
interpreted by the server, so a client can send any byte sequence the shell
should see.

The pty starts at 120x30. A client should send a resize frame right after the
connection opens and on every layout change (the reference frontend does).

```js
// resize example (browser)
const buf = new ArrayBuffer(8);
const view = new DataView(buf);
view.setUint16(0, cols);   // big-endian by default
view.setUint16(2, rows);
view.setUint16(4, widthPx);   // optional: send a 4-byte frame without these two
view.setUint16(6, heightPx);
socket.send(buf);
```

## Authentication

Configured on the backend (see `config.example.yml`):

- **HTTP Basic Auth** protects the static files and the WebSocket upgrade.
- **Token**: when `auth.token` is set, the upgrade request must carry
  `?token=<value>`.
- When both are configured, the WebSocket upgrade needs both.

Failed authentication returns HTTP 401; a client IP outside `access.allowed_ips`
gets HTTP 403. Browser handshakes whose `Origin` is neither the server's own origin
nor listed in `access.allowed_origins` are rejected with HTTP 403 as well (requests
without an `Origin` header - scripts, native clients - are not subject to this).
Protect non-local deployments with a token and, behind a proxy, restrict clients there.

## Writing another backend

Any server that speaks the protocol above works with the frontend: accept a
WebSocket on `/pty`, relay bytes to a pty and back, and understand the 4- or 8-byte
resize frame. The frontend's transport is a small interface
(`connect`, `send`, `resize`, `onData`, `onStatus`), so other protocols can be
supported by providing a different transport class.

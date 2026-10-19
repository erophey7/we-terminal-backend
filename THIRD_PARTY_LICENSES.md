# Third-party components and their licenses

Everything this project depends on is under a permissive license (MIT, BSD, OFL,
Apache-2.0): it may be used, modified and redistributed - including in public
repositories and in binaries - as long as the copyright notices and the license
text are kept. There is no copyleft (GPL/AGPL/LGPL) code in the project.

The license of the project's own code is in the `LICENSE` file at the repository root.

## Frontend (directory `vendor/`; in the backend repository: `internal/webassets/web/vendor/`)

The files are taken from jsDelivr unmodified, and their copyright banners are intact.

| Component | Version | License | Source |
|---|---|---|---|
| xterm.js | 6.0.0 | MIT | https://github.com/xtermjs/xterm.js |
| @xterm/addon-fit | 0.11.0 | MIT | same |
| @xterm/addon-web-links | 0.12.0 | MIT | same |
| @xterm/addon-webgl | 0.19.0 | MIT | same |
| @xterm/addon-unicode11 | 0.9.0 | MIT | same |
| @xterm/addon-image | 0.9.0 | MIT (per the banner in the file; it embeds a WASM Sixel decoder whose license was not checked separately) | same |
| @xterm/addon-search | 0.16.0 | MIT | same |
| @xterm/addon-clipboard | 0.2.0 | MIT | same |

The xterm.js license text is in `vendor/licenses/xterm.js-LICENSE.txt`. xterm.js
contains code derived from term.js (Christopher Jeffrey, MIT); this is reflected in
its banner.

### Fonts (`vendor/fonts/*.woff2`, `vendor/fonts.css`)

Downloaded from Google Fonts (they used to be loaded from there at runtime; they are
now served locally, which also means the page makes no requests to Google).

| Font | License | Copyright holder | License file |
|---|---|---|---|
| JetBrains Mono | SIL OFL 1.1 | The JetBrains Mono Project Authors | `vendor/licenses/JetBrainsMono-OFL.txt` |
| Fira Code | SIL OFL 1.1 | The Fira Code Project Authors | `vendor/licenses/FiraCode-OFL.txt` |
| IBM Plex Mono | SIL OFL 1.1 | IBM Corp. (Reserved Font Name "Plex") | `vendor/licenses/IBMPlexMono-OFL.txt` |
| Source Code Pro | SIL OFL 1.1 | Adobe (Reserved Font Name "Source") | `vendor/licenses/SourceCodePro-OFL.txt` |
| Roboto Mono | SIL OFL 1.1 | The Roboto Mono Project Authors | `vendor/licenses/RobotoMono-OFL.txt` |
| Space Mono | SIL OFL 1.1 | The Space Mono Project Authors | `vendor/licenses/SpaceMono-OFL.txt` |

OFL terms: the fonts may be bundled and redistributed with software (they must not be
sold on their own) and the copyright notice and license text must be kept. The font
files are not modified by this project (Google serves unicode-range subsets), which is
the common practice for self-hosting; if you modify a font yourself, the Reserved Font
Names must be changed.

## Go backend

| Module | Version | License |
|---|---|---|
| github.com/gorilla/websocket | v1.5.3 | BSD-2-Clause |
| github.com/creack/pty | v1.1.24 | MIT |
| github.com/UserExistsError/conpty | v0.1.4 | MIT |
| golang.org/x/sys | v0.49.0 | BSD-3-Clause |
| gopkg.in/yaml.v3 | v3.0.1 | MIT + Apache-2.0 (two licenses covering different parts) |

`go.mod` also lists `golang.org/x/crypto`, `x/net` and `x/text` (BSD-3-Clause), but
the code does not import them - `go mod tidy` removes them. The binaries are built
statically; the module license texts are available in the modules' repositories.
The Go toolchain itself is BSD-3-Clause.

## Not dependencies, but worth mentioning

- **Wallpaper Engine** is a proprietary application (Steam); it is not part of this
  repository. The project only uses its documented web-wallpaper JavaScript interface
  and its command line. Publishing to the Steam Workshop is governed separately by the
  Workshop rules.
- **Kitty graphics protocol** is an open specification
  (https://sw.kovidgoyal.net/kitty/graphics-protocol/). kitty itself is GPL-3.0, but
  `kitty.js` was written from the specification; no kitty source code was copied.

import { Terminal } from './vendor/xterm.mjs';
import { FitAddon } from './vendor/addon-fit.mjs';
import { WebLinksAddon } from './vendor/addon-web-links.mjs';
import { WebglAddon } from './vendor/addon-webgl.mjs';
import { Unicode11Addon } from './vendor/addon-unicode11.mjs';
import { ImageAddon } from './vendor/addon-image.mjs';
import { SearchAddon } from './vendor/addon-search.mjs';
import { ClipboardAddon } from './vendor/addon-clipboard.mjs';
import { installKitty } from './kitty.js';

// Единая точка сборки терминала: сюда же потом добавлять новые addon'ы.
// Ничего не знает про транспорт (websocket/прокси/что угодно) и про
// обвязку UI (титлбар, поиск) — это задача main.js/ui.js.
export function createTerminal({
  container,
  colors,
  fontSize = 14,
  fontFamily = "'JetBrains Mono', ui-monospace, monospace",
  cursorStyle = 'bar',
  scrollback = 10000,
  readonly = false,
  enableWebgl = true,
  enableImages = true,
  enableKitty = true,
} = {}) {
  const term = new Terminal({
    theme: colors,
    fontFamily,
    fontSize,
    lineHeight: 1.25,
    cursorBlink: !readonly,
    cursorStyle,
    scrollback,
    allowProposedApi: true,
    // Разрешаем приложениям спрашивать размеры (CSI 14t/16t/18t): нужно графическим
    // утилитам (chafa, kitten icat) для масштабирования. Только чтение — ничего не меняет.
    windowOptions: { getWinSizePixels: true, getCellSizePixels: true, getWinSizeChars: true },
    rightClickSelectsWord: false,
    macOptionIsMeta: true,
    scrollSensitivity: 2,
    smoothScrollDuration: 90,
    disableStdin: readonly, // режим "живой картинки": ввод полностью игнорируется
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon());
  term.loadAddon(new Unicode11Addon());
  term.unicode.activeVersion = '11';

  const searchAddon = new SearchAddon();
  term.loadAddon(searchAddon);

  // Графические протоколы терминала: Sixel и iTerm2 inline images.
  // Тянет WASM-декодер — в некоторых встроенных/урезанных Chromium
  // (например CEF внутри Wallpaper Engine) это может ронять рендерер,
  // поэтому выключаемо.
  if (enableImages) {
    term.loadAddon(new ImageAddon({
      enableSizeReports: true,
      sixelSupport: true,
      iipSupport: true,
      pixelLimit: 32 * 1024 * 1024,
      showPlaceholder: true,
    }));
  }

  if (!readonly) {
    term.loadAddon(new ClipboardAddon()); // OSC 52
  }

  term.open(container);

  let usingWebgl = false;
  if (enableWebgl) {
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
      usingWebgl = true;
    } catch (e) {
      console.warn('WebGL renderer unavailable, falling back to canvas', e);
    }
  }

  fitAddon.fit();

  // Kitty graphics: чистый JS без WASM/WebGL, но xterm 6.0.0 не умеет APC,
  // поэтому вывод бэкенда нужно пропускать через feed() вместо term.write().
  const kitty = enableKitty ? installKitty(term) : null;
  const feed = kitty ? kitty.feed : (data) => term.write(data);

  return { term, fitAddon, searchAddon, usingWebgl, feed };
}

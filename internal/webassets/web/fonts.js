// Моноширинные шрифты для выбора в настройках. Все грузятся с Google Fonts
// (подключены в index.html) — добавляя сюда новый, не забудь подключить
// и его там же.
// Запасные шрифты с Braille, стрелками и символами (frontend/vendor/fonts.css) — сразу после основной гарнитуры.
const SYMBOLS = "'Cascadia Braille', 'Noto Sans Symbols 2', 'Noto Sans Symbols', ";

export const FONTS = {
  jetbrains: { label: 'JetBrains Mono', stack: "'JetBrains Mono', " + SYMBOLS + "ui-monospace, monospace" },
  firacode: { label: 'Fira Code', stack: "'Fira Code', " + SYMBOLS + "ui-monospace, monospace" },
  ibmplex: { label: 'IBM Plex Mono', stack: "'IBM Plex Mono', " + SYMBOLS + "ui-monospace, monospace" },
  sourcecodepro: { label: 'Source Code Pro', stack: "'Source Code Pro', " + SYMBOLS + "ui-monospace, monospace" },
  robotomono: { label: 'Roboto Mono', stack: "'Roboto Mono', " + SYMBOLS + "ui-monospace, monospace" },
  spacemono: { label: 'Space Mono', stack: "'Space Mono', " + SYMBOLS + "ui-monospace, monospace" },
  system: { label: 'Системный моно', stack: "ui-monospace, Menlo, Consolas, 'Cascadia Braille', 'Noto Sans Symbols 2', 'Noto Sans Symbols', monospace" },
};

// Стек шрифтов для xterm.js. nerd — подключать ли Nerd Fonts Symbols (иконки в PUA для промптов, mc, lsd и т.п.).
// Файл большой (1.6 МБ), но грузится только при первом иконочном символе (unicode-range в fonts.css).
export function fontStack(key, nerd = true) {
  const f = FONTS[key] || FONTS.jetbrains;
  return nerd ? f.stack.replace("'Cascadia Braille'", "'Cascadia Braille', 'Symbols Nerd Font Mono'") : f.stack;
}

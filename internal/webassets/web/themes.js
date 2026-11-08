// Именованные палитры. Любую можно выбрать через панель настроек
// или сразу в URL: index.html?theme=nord
export const THEMES = {
  nebula: {
    label: 'Nebula',
    colors: {
      background: '#00000000',
      foreground: '#e8e6f0',
      cursor: '#8a7dff',
      cursorAccent: '#1b1024',
      selectionBackground: 'rgba(138, 125, 255, 0.35)',
      black: '#1c1b22', red: '#ff6b81', green: '#5ee6c9', yellow: '#ffd479',
      blue: '#7aa2ff', magenta: '#c792ea', cyan: '#7ae7e0', white: '#e8e6f0',
      brightBlack: '#5b5a6b', brightRed: '#ff8a9c', brightGreen: '#8af5dd',
      brightYellow: '#ffe29b', brightBlue: '#9db8ff', brightMagenta: '#d9a8f2',
      brightCyan: '#a4f1eb', brightWhite: '#ffffff',
    },
    accent: '#8a7dff',
    accent2: '#5ee6c9',
    bgGrad1: '#1b1024',
    bgGrad2: '#0d1320',
  },
  nord: {
    label: 'Nord',
    colors: {
      background: '#00000000',
      foreground: '#d8dee9',
      cursor: '#88c0d0',
      cursorAccent: '#2e3440',
      selectionBackground: 'rgba(136, 192, 208, 0.3)',
      black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
      blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
      brightBlack: '#4c566a', brightRed: '#d08770', brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b', brightBlue: '#8fbcbb', brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb', brightWhite: '#eceff4',
    },
    accent: '#88c0d0',
    accent2: '#a3be8c',
    bgGrad1: '#232834',
    bgGrad2: '#161a22',
  },
  dracula: {
    label: 'Dracula',
    colors: {
      background: '#00000000',
      foreground: '#f8f8f2',
      cursor: '#ff79c6',
      cursorAccent: '#282a36',
      selectionBackground: 'rgba(189, 147, 249, 0.3)',
      black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
      blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
      brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94',
      brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
      brightCyan: '#a4ffff', brightWhite: '#ffffff',
    },
    accent: '#bd93f9',
    accent2: '#50fa7b',
    bgGrad1: '#1e1f29',
    bgGrad2: '#14151d',
  },
  gruvbox: {
    label: 'Gruvbox',
    colors: {
      background: '#00000000',
      foreground: '#ebdbb2',
      cursor: '#fe8019',
      cursorAccent: '#282828',
      selectionBackground: 'rgba(254, 128, 25, 0.28)',
      black: '#282828', red: '#fb4934', green: '#b8bb26', yellow: '#fabd2f',
      blue: '#83a598', magenta: '#d3869b', cyan: '#8ec07c', white: '#ebdbb2',
      brightBlack: '#928374', brightRed: '#fb4934', brightGreen: '#b8bb26',
      brightYellow: '#fabd2f', brightBlue: '#83a598', brightMagenta: '#d3869b',
      brightCyan: '#8ec07c', brightWhite: '#fbf1c7',
    },
    accent: '#fe8019',
    accent2: '#b8bb26',
    bgGrad1: '#282420',
    bgGrad2: '#1a1714',
  },
  catppuccin: {
    label: 'Catppuccin Mocha',
    colors: {
      background: '#00000000',
      foreground: '#cdd6f4',
      cursor: '#f5c2e7',
      cursorAccent: '#1e1e2e',
      selectionBackground: 'rgba(245, 194, 231, 0.28)',
      black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
      blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
      brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#f5c2e7',
      brightCyan: '#94e2d5', brightWhite: '#a6adc8',
    },
    accent: '#f5c2e7',
    accent2: '#94e2d5',
    bgGrad1: '#201b2c',
    bgGrad2: '#111119',
  },
};

// Палитра по умолчанию в Windows Terminal («Campbell»): для тех, кто хочет, чтобы TUI выглядели как в привычном терминале.
THEMES.campbell = {
  label: 'Campbell (Windows Terminal)',
  colors: {
    background: '#0c0c0c',
    foreground: '#cccccc',
    cursor: '#ffffff',
    cursorAccent: '#0c0c0c',
    selectionBackground: 'rgba(255, 255, 255, 0.3)',
    black: '#0c0c0c', red: '#c50f1f', green: '#13a10e', yellow: '#c19c00',
    blue: '#0037da', magenta: '#881798', cyan: '#3a96dd', white: '#cccccc',
    brightBlack: '#767676', brightRed: '#e74856', brightGreen: '#16c60c',
    brightYellow: '#f9f1a5', brightBlue: '#3b78ff', brightMagenta: '#b4009e',
    brightCyan: '#61d6d6', brightWhite: '#f2f2f2',
  },
  accent: '#3b78ff',
  accent2: '#16c60c',
  bgGrad1: '#0c0c0c',
  bgGrad2: '#0c0c0c',
};

// Фон терминала — сплошной цвет темы. С прозрачным фоном (#00000000) реверс-видео (подсветка вставки в bash,
// выделения в TUI) красило текст «цветом фона», то есть невидимым, а OSC 11 сообщал приложениям чёрный.
for (const t of Object.values(THEMES)) {
  if (t.colors.background === '#00000000') t.colors.background = t.bgGrad2;
}

// «Clear»: ничего не подкрашивает. Стандартная палитра xterm (её ждут оболочки и их темы — zsh/powerlevel10k, vim, btop),
// чёрный фон, а подстройка контраста (minimumContrastRatio) для неё принудительно выключена — иначе xterm.js сам
// осветляет/затемняет цвета, которые приложение выбрало осознанно. Настройка «Контраст текста» при этой теме не действует.
THEMES.clear = {
  label: 'Clear (original colors)',
  fixedContrast: 1,
  colors: {
    background: '#000000',
    foreground: '#e5e5e5',
    cursor: '#e5e5e5',
    cursorAccent: '#000000',
    selectionBackground: 'rgba(255, 255, 255, 0.3)',
    black: '#000000', red: '#cd0000', green: '#00cd00', yellow: '#cdcd00',
    blue: '#0000ee', magenta: '#cd00cd', cyan: '#00cdcd', white: '#e5e5e5',
    brightBlack: '#7f7f7f', brightRed: '#ff0000', brightGreen: '#00ff00',
    brightYellow: '#ffff00', brightBlue: '#5c5cff', brightMagenta: '#ff00ff',
    brightCyan: '#00ffff', brightWhite: '#ffffff',
  },
  accent: '#cdcd00',
  accent2: '#00cd00',
  bgGrad1: '#000000',
  bgGrad2: '#000000',
};

export function applyThemeChrome(name) {
  const t = THEMES[name] || THEMES.nebula;
  const root = document.documentElement.style;
  root.setProperty('--accent', t.accent);
  root.setProperty('--accent-2', t.accent2);
  root.setProperty('--bg-grad-1', t.bgGrad1);
  root.setProperty('--bg-grad-2', t.bgGrad2);
  return t;
}


// ---------- свои темы (localStorage) ----------
// Формат — docs/themes.md. Хранилище: { "<ключ>": { label, colors, accent, accent2, bgGrad1, bgGrad2 } }, ключи начинаются с `user-`.
export const CUSTOM_THEMES_KEY = 'webterm:themes';
export const CUSTOM_PREFIX = 'user-';

const COLOR_KEYS = [
  'background', 'foreground', 'cursor', 'cursorAccent', 'selectionBackground',
  'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
];
const CSS_COLOR = /^(#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgba?\(\s*\d{1,3}\s*(,\s*\d{1,3}\s*){2}(,\s*(0|1|0?\.\d+)\s*)?\))$/;

// Проверяет и нормализует тему из JSON. Недостающие цвета берутся из `base` (по умолчанию Nebula).
// Возвращает { theme } или { error }.
export function normalizeTheme(input, base = THEMES.nebula) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'theme must be a JSON object' };
  const colors = { ...base.colors };
  for (const [k, v] of Object.entries(input.colors ?? {})) {
    if (!COLOR_KEYS.includes(k)) return { error: `unknown color key: ${k}` };
    if (typeof v !== 'string' || !CSS_COLOR.test(v.trim())) return { error: `invalid color for ${k}: ${String(v).slice(0, 40)}` };
    colors[k] = v.trim();
  }
  const pick = (key, fallback) => {
    const v = input[key];
    if (v === undefined) return fallback;
    if (typeof v !== 'string' || !CSS_COLOR.test(v.trim())) throw new Error(`invalid color for ${key}`);
    return v.trim();
  };
  try {
    const bg = colors.background;
    const theme = {
      label: String(input.name ?? input.label ?? 'Custom theme').slice(0, 40) || 'Custom theme',
      colors,
      accent: pick('accent', colors.cursor),
      accent2: pick('accent2', colors.green),
      // фон страницы вокруг терминала: по умолчанию — фон терминала
      bgGrad1: pick('bgGrad1', bg),
      bgGrad2: pick('bgGrad2', bg),
    };
    return { theme };
  } catch (e) {
    return { error: e.message };
  }
}

export function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'theme';
}

export function loadCustomThemes(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage.getItem(CUSTOM_THEMES_KEY) || '{}');
    const out = {};
    for (const [key, def] of Object.entries(raw)) {
      if (!key.startsWith(CUSTOM_PREFIX)) continue;
      const r = normalizeTheme(def, THEMES.nebula);
      if (r.theme) out[key] = r.theme;
    }
    return out;
  } catch {
    return {};
  }
}

function saveCustomThemes(all, storage) {
  try { storage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(all)); } catch { /* хранилище недоступно */ }
}

// Добавляет сохранённые темы в THEMES (вызывать при старте).
export function registerCustomThemes(storage = globalThis.localStorage) {
  const custom = loadCustomThemes(storage);
  Object.assign(THEMES, custom);
  return Object.keys(custom);
}

// Импорт из текста JSON. Возвращает { key } или { error }. Ключ уникален: повторный импорт того же имени заменяет тему.
export function importTheme(text, storage = globalThis.localStorage) {
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { return { error: `not valid JSON: ${e.message}` }; }
  const r = normalizeTheme(parsed);
  if (r.error) return { error: r.error };
  const key = CUSTOM_PREFIX + slugify(r.theme.label);
  const all = loadCustomThemes(storage);
  all[key] = r.theme;
  saveCustomThemes(all, storage);
  THEMES[key] = r.theme;
  return { key };
}

export function deleteCustomTheme(key, storage = globalThis.localStorage) {
  if (!key.startsWith(CUSTOM_PREFIX)) return false;
  const all = loadCustomThemes(storage);
  if (!(key in all)) return false;
  delete all[key];
  saveCustomThemes(all, storage);
  delete THEMES[key];
  return true;
}

// Тема как JSON для скачивания (в том же формате, который понимает импорт).
export function exportTheme(key) {
  const t = THEMES[key];
  if (!t) return null;
  return JSON.stringify({ name: t.label, colors: t.colors, accent: t.accent, accent2: t.accent2, bgGrad1: t.bgGrad1, bgGrad2: t.bgGrad2 }, null, 2) + '\n';
}

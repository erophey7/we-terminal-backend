import { THEMES, applyThemeChrome, registerCustomThemes, importTheme, exportTheme, deleteCustomTheme, CUSTOM_PREFIX } from './themes.js';
import { FONTS, fontStack } from './fonts.js';
import { WsTransport } from './transport.js';
import { hotkeyLetter } from './hotkeys.js';
import { createTerminal } from './terminal.js';
import { DEFAULT_BINDINGS } from './actions.js';
import { installBindings } from './bindings.js';
import { installRadial } from './radial.js';
import { installKeyboard } from './keyboard.js';
import { installStatusOverlay } from './status.js';
import { translator, LANGUAGES, DEFAULT_LANGUAGE, RTL_LANGUAGES, htmlLang } from './i18n.js';
import { installHandleDrag } from './handle.js';
import { installBackground, loadStoredImage, saveStoredImage, clearStoredImage, withAlpha } from './background.js';
import { clearSavedPreferences, SETTINGS_STORAGE_KEY } from './preferences.js';
import { confirmInPage } from './confirm.js';

// webterm — универсальная точка входа фронта.
//
// Работает тремя способами:
//  1. Просто открыть index.html на хосте, где крутится server.js — всё
//     само подключится к /pty на том же origin.
//  2. Задать бэкенд явно через URL: ?ws=wss://host:port/pty (абсолютный
//     адрес — можно хостить фронт отдельно от бэкенда, хоть на статике).
//  3. Импортировать startWebterm(overrides) как модуль из своего бутстрапа
//     (см. wallpaper-engine/we-bridge.js) и передать конфиг программно —
//     так фронт встраивается куда угодно (Wallpaper Engine, iframe, Proxmox
//     и т.п.) без URL-параметров вообще.
//
// Приоритет конфига: overrides (программный) > URL-параметры > сохранённые
// настройки (localStorage) > значения по умолчанию.

const PERSIST_KEY = SETTINGS_STORAGE_KEY;
const FONT_SAMPLES = ['Aa', 'Привет', 'αβγ', 'ąčęğ', 'ạảấ', '⣿⠁', '→▲●✓'];  // по одному образцу на подмножество шрифта

// Переключатели копирования/вставки в панели настроек: [ключ в settings, ключ строки в i18n.js].
const FLAG_ROWS = [
  ['autoCopySelection', 'fAutoCopy'],
  ['copyCtrlC', 'fCopyCtrlC'],
  ['copyCtrlShiftC', 'fCopyCtrlShiftC'],
  ['pasteCtrlV', 'fPasteCtrlV'],
  ['pasteCtrlShiftV', 'fPasteCtrlShiftV'],
  ['rightClickCopy', 'fRightCopy'],
  ['rightClickPaste', 'fRightPaste'],
  ['bracketedPaste', 'fBracketed'],
];

function readConfig(overrides) {
  const qp = new URL(location.href).searchParams;
  const saved = JSON.parse(localStorage.getItem(PERSIST_KEY) || '{}');
  const flag = (key, qpName) => overrides[key] ?? (qp.has(qpName) ? qp.get(qpName) !== '0' : saved.flags?.[key] ?? true);

  return {
    theme: overrides.theme || qp.get('theme') || saved.theme || 'nebula',
    fontFamily: overrides.fontFamily || qp.get('fontFamily') || saved.fontFamily || 'jetbrains',
    fontSize: Number(overrides.fontSize || qp.get('fontSize') || saved.fontSize) || 14,
    opacity: overrides.opacity ?? (qp.has('opacity') ? Number(qp.get('opacity')) : saved.opacity ?? 72),
    cursorStyle: overrides.cursorStyle || qp.get('cursorStyle') || saved.cursorStyle || 'bar',
    readonly: overrides.readonly ?? qp.get('readonly') === '1',
    ws: overrides.wsUrl || qp.get('ws') || '/pty',
    token: overrides.token || qp.get('token') || '',
    // WebGL-рендерер и addon-image тянут WebGL-контекст и WASM —
    // в некоторых встроенных Chromium (CEF в Wallpaper Engine и т.п.)
    // это может ронять рендерер нативным крашем. Выключаемо на вход.
    enableWebgl: overrides.enableWebgl ?? qp.get('webgl') !== '0',
    enableImages: overrides.enableImages ?? qp.get('images') !== '0',
    // Kitty graphics — свой чистый JS (frontend/kitty.js), без WASM/WebGL.
    // Минимальный контраст текста (xterm.js подправляет цвета, если контраст с фоном ниже): без него палитры с яркими
    // «синим/белым» делают классические TUI (debconf/dialog) нечитаемыми. 1 — выключено.
    // Фоновая картинка (рисуется под терминалом): прозрачность картинки %, размытие px, прозрачность фона терминала %
    // (когда картинка есть; без картинки фон терминала сплошной).
    bgOpacity: Number(overrides.bgOpacity ?? qp.get('bgOpacity') ?? saved.bgOpacity ?? 60),
    bgBlur: Number(overrides.bgBlur ?? qp.get('bgBlur') ?? saved.bgBlur ?? 0),
    termAlpha: Number(overrides.termAlpha ?? qp.get('termAlpha') ?? saved.termAlpha ?? 75),
    bgUrl: overrides.bgUrl || qp.get('bg') || '',
    minContrast: Number(overrides.minContrast ?? qp.get('contrast') ?? saved.minContrast) || 4.5,
    enableKitty: overrides.enableKitty ?? qp.get('kitty') !== '0',

    // Виртуальная клавиатура: вкл/выкл и набор раскладок (коды из kblayouts.js, порядок = порядок кнопки Lang)
    keyboardEnabled: overrides.keyboardEnabled ?? qp.get('kb') !== '0',
    kbLayouts: overrides.kbLayouts || (qp.get('kblayouts') ? qp.get('kblayouts').split(',') : ['en', 'ru']),

    // Размер (px, 0 = автоматически по ширине экрана) и непрозрачность (%) кнопки радиального меню
    menuSize: Number(overrides.menuSize ?? qp.get('menusize')) || 0,
    menuOpacity: overrides.menuOpacity ?? (qp.has('menuopacity') ? Number(qp.get('menuopacity')) : 78),

    // Оверлей «нет связи с бэкендом» (status.js); ?status=0 отключает
    statusOverlay: overrides.statusOverlay ?? qp.get('status') !== '0',

    // Язык интерфейса поверх терминала — меню и сообщения (i18n.js): en по умолчанию
    menuLang: overrides.menuLang || qp.get('menulang') || 'en',

    // Кнопка радиального меню: положение (угол/сторона/free) и режим перетаскивания (для free)
    menuPos: overrides.menuPos || qp.get('menupos') || 'bottom-right',
    menuMove: overrides.menuMove ?? qp.get('menumove') === '1',

    // Показывать ли собственную панель настроек поверх терминала —
    // выключается, когда конфиг приходит снаружи (Wallpaper Engine и
    // т.п. — там настройки уже есть в хост-приложении, свои не нужны,
    // а открытие панели на некоторых встроенных Chromium ронёт рендерер).
    showUI: overrides.showUI ?? qp.get('ui') !== '0',
    // Хэндл панели полупрозрачный и всплывает только когда курсор рядом.
    handleAutoHide: overrides.handleAutoHide ?? qp.get('autohide') !== '0',

    // Копирование/вставка — несколько независимых режимов, каждый можно
    // выключить по отдельности.
    // Приоритет: overrides > URL > сохранённое в панели настроек > включено.
    copyCtrlC: flag('copyCtrlC', 'copyCtrlC'),         // Ctrl+C копирует, если есть выделение, иначе — обычный SIGINT
    pasteCtrlV: flag('pasteCtrlV', 'pasteCtrlV'),       // Ctrl+V вставляет (как в Windows); выключено — блокируется
    copyCtrlShiftC: flag('copyCtrlShiftC', 'copyCtrlShiftC'),
    pasteCtrlShiftV: flag('pasteCtrlShiftV', 'pasteCtrlShiftV'),
    autoCopySelection: flag('autoCopySelection', 'autoCopy'), // копия в буфер сразу при выделении мышью
    rightClickCopy: flag('rightClickCopy', 'rcCopy'),   // ПКМ копирует выделенное
    rightClickPaste: flag('rightClickPaste', 'rcPaste'), // ПКМ вставляет, если ничего не выделено
    // Вставка «как терминал»: с маркерами bracketed paste (оболочка видит её как вставку; bash подсвечивает вставленное).
    // Выключено — текст уходит как набранный, строки через \r.
    bracketedPaste: flag('bracketedPaste', 'bracketedPaste'),
    nerdSymbols: flag('nerdSymbols', 'nerd'),            // иконки Nerd Fonts (шрифт грузится только при первом иконочном символе)

    // Радиальное меню нужно обоям WE (там нет ни колеса, ни кнопок); в обычном браузере его можно выключить.
    radialEnabled: overrides.radialEnabled ?? qp.get('radial') !== '0',
    // Хэндл настроек показывается столько мс после открытия, потом прячется (0 — как обычно).
    handleIntroMs: Number(overrides.handleIntroMs ?? qp.get('handleIntro')) || 0,

    // Привязка кнопок мыши к действиям (actions.js). Через query: ?bind_middle=copy&bind_modButton=forward
    bindings: readBindings(qp, overrides.bindings),
  };
}

function readBindings(qp, override = {}) {
  const out = { ...DEFAULT_BINDINGS, snippets: [...DEFAULT_BINDINGS.snippets], ...override };
  for (const key of Object.keys(DEFAULT_BINDINGS)) {
    if (key !== 'snippets' && qp.has('bind_' + key)) out[key] = qp.get('bind_' + key);
  }
  return out;
}

// Строит окончательный ws(s):// адрес. Принимает как абсолютный URL
// (другой хост — фронт и бэкенд разнесены), так и путь на текущем origin.
function resolveWsUrl(ws, token) {
  let url;
  if (/^wss?:\/\//i.test(ws)) {
    url = new URL(ws);
  } else {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    url = new URL(ws, `${proto}://${location.host}`);
  }
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

export function startWebterm(overrides = {}) {
  // Контраст текста: тема может зафиксировать его (Clear = 1, цвета не искажаются); иначе действует настройка панели.
  const contrastFor = (themeKey) => THEMES[themeKey]?.fixedContrast ?? settings.minContrast;
  let updateThemeTools = null;
  registerCustomThemes();               // свои темы из localStorage должны быть известны до выбора темы
  const settings = readConfig(overrides);

  function persist() {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({
      theme: settings.theme,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      opacity: settings.opacity,
      cursorStyle: settings.cursorStyle,
      menuLang: settings.menuLang,
      menuSize: settings.menuSize,
      menuOpacity: settings.menuOpacity,
      menuPos: settings.menuPos,
      menuMove: settings.menuMove,
      minContrast: settings.minContrast,
      bgOpacity: settings.bgOpacity,
      bgBlur: settings.bgBlur,
      termAlpha: settings.termAlpha,
      flags: Object.fromEntries([...FLAG_ROWS.map(([key]) => key), 'nerdSymbols'].map((key) => [key, settings[key]])),
    }));
  }

  // Язык панели настроек — тот же menuLang, что у радиального меню (i18n.js).
  let tr = translator(LANGUAGES[settings.menuLang] ? settings.menuLang : DEFAULT_LANGUAGE);
  function applyI18n() {
    const lang = LANGUAGES[settings.menuLang] ? settings.menuLang : DEFAULT_LANGUAGE;
    document.documentElement.lang = htmlLang(lang);
    document.getElementById('drawer')?.setAttribute('dir', RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr');   // панель зеркалится для арабского, фарси, иврита
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = tr(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = tr(el.dataset.i18nPlaceholder);
    for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = tr(el.dataset.i18nTitle);
  }
  applyI18n();

  const chromeTheme = applyThemeChrome(settings.theme);
  // Фон терминала: сплошной; с фоновой картинкой — полупрозрачный (картинка видна сквозь него).
  let bgActive = false;
  // Цвета для xterm.js + тот же тон на подложке окна: полосы по краям (не кратные ячейке) тонируются так же, как терминал.
  const setTermTheme = (colors) => {
    const c = termColors(colors);
    term.options.theme = c;
    document.getElementById('termWrap').style.background = bgActive ? c.background : '';
  };
  const termColors = (colors) => (bgActive ? { ...colors, background: withAlpha(colors.background, settings.termAlpha / 100) } : colors);
  const background = installBackground({ onChange: (on) => { bgActive = on; setTermTheme(THEMES[settings.theme].colors); } });

  document.documentElement.style.setProperty('--glass-alpha', settings.opacity / 100);

  // ---------- терминал ----------
  const { term, fitAddon, searchAddon, feed, clearImages, setImagePolicy } = createTerminal({
    container: document.getElementById('terminal'),
    colors: chromeTheme.colors,
    fontFamily: fontStack(settings.fontFamily, settings.nerdSymbols),
    fontSize: settings.fontSize,
    cursorStyle: settings.cursorStyle,
    readonly: settings.readonly,
    enableWebgl: settings.enableWebgl,
    enableImages: settings.enableImages,
    enableKitty: settings.enableKitty,
    minimumContrastRatio: contrastFor(settings.theme),
  });
  term.focus();

  // ---------- транспорт ----------
  // готовый транспорт (например PveTransport) подменяет WebSocket-бэкенд целиком
  const transport = overrides.transport || new WsTransport(resolveWsUrl(settings.ws, settings.token));

  const statusDots = document.querySelectorAll('.status-dot');
  const statusText = document.getElementById('statusText');

  const STATUS_LABEL = {
    get connecting() { return tr('drawerConnecting'); },
    get online() { return tr('drawerOnline'); },
    get offline() { return tr('drawerOffline'); },
  };
  transport.onStatus((state) => {
    const cls = 'status-dot ' + (state === 'online' ? 'online' : state === 'offline' ? 'offline' : '');
    statusDots.forEach((d) => { d.className = cls; });
    if (statusText) statusText.textContent = STATUS_LABEL[state];
    // бэкенд стартует pty с размером по умолчанию — сразу сообщаем реальный
    if (state === 'online') sendResize();
  });
  // Размер терминала бэкенду: колонки/строки + пиксели (kitten icat и chafa читают их из pty).
  function sendResize() {
    const screen = term.element?.querySelector('.xterm-screen');
    const dpr = window.devicePixelRatio || 1;
    transport.resize(term.cols, term.rows,
      screen ? Math.round(screen.clientWidth * dpr) : 0, screen ? Math.round(screen.clientHeight * dpr) : 0);
  }

  const statusOverlay = installStatusOverlay({ transport, language: settings.menuLang, enabled: settings.statusOverlay });
  transport.onData((chunk) => feed(chunk));
  transport.connect();

  if (!settings.readonly) {
    term.onData((data) => transport.send(data));
  }

  term.onBell(() => {
    document.body.classList.add('bell');
    setTimeout(() => document.body.classList.remove('bell'), 180);
  });

  // ---------- ресайз ----------
  const termWrap = document.getElementById('termWrap');
  const ro = new ResizeObserver(() => {
    fitAddon.fit();
    sendResize();
  });
  ro.observe(termWrap);

  // ---------- мышь: копирование/вставка ----------
  // (mouse-tracking в приложениях вроде vim/htop/mc/tmux xterm.js обрабатывает
  // сам, через стандартные DECSET-режимы — тут ничего делать не нужно)
  if (!settings.readonly) {
    term.onSelectionChange(() => {
      if (!settings.autoCopySelection) return;
      const sel = term.getSelection();
      if (sel) navigator.clipboard.writeText(sel).catch(() => {});
    });

    // ПКМ/средняя/боковые кнопки — через привязки (bindings.js), ниже.
  }

  // ---------- выезжающая панель (настройки + поиск) ----------
  if (!settings.showUI) {
    document.body.classList.add('no-ui');
  } else if (settings.handleAutoHide) {
    document.body.classList.add('autohide-handle');
  }

  const drawer = document.getElementById('drawer');
  const drawerHandle = document.getElementById('drawerHandle');
  const themeSelect = document.getElementById('settingTheme');
  const fontFamilySelect = document.getElementById('settingFontFamily');
  const opacityInput = document.getElementById('settingOpacity');
  const cursorSelect = document.getElementById('settingCursor');
  const fontValue = document.getElementById('fontValue');
  const searchInput = document.getElementById('searchInput');
  const searchCount = document.getElementById('searchCount');

  function openDrawer() {
    drawer.hidden = false;
    drawerHandle.classList.add('open');
  }
  function closeDrawer() {
    drawer.hidden = true;
    drawerHandle.classList.remove('open');
    searchAddon.clearDecorations();
    term.focus();
  }
  function toggleDrawer() {
    if (drawer.hidden) openDrawer();
    else closeDrawer();
  }

  function fillThemes() {
    themeSelect.textContent = '';
    for (const [key, t] of Object.entries(THEMES)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key.startsWith(CUSTOM_PREFIX) ? `${t.label} (${tr('themeCustom')})` : t.label;
      themeSelect.appendChild(opt);
    }
    themeSelect.value = settings.theme;
  }
  fillThemes();

  // Свои темы: импорт JSON (хранится в localStorage), экспорт любой темы, удаление своей. Формат — docs/themes.md.
  const themeTools = document.createElement('div');
  themeTools.className = 'drawer-row theme-tools';
  const mkBtn = (key) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.i18n = `theme${key}`;
    b.dataset.i18nTitle = `theme${key}Title`;
    return b;
  };
  const importBtn = mkBtn('Import');
  const exportBtn = mkBtn('Export');
  const deleteBtn = mkBtn('Delete');
  const themeMsg = document.createElement('span');
  themeMsg.className = 'theme-msg';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.hidden = true;
  themeTools.append(importBtn, exportBtn, deleteBtn, themeMsg, fileInput);
  themeSelect.closest('label').after(themeTools);
  updateThemeTools = () => { deleteBtn.disabled = !settings.theme.startsWith(CUSTOM_PREFIX); };
  updateThemeTools();
  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const r = importTheme(await file.text());
    themeMsg.textContent = r.error ? r.error : tr('themeImported');
    if (!r.error) { fillThemes(); setTheme(r.key); persist(); }
  });
  exportBtn.addEventListener('click', () => {
    const text = exportTheme(settings.theme);
    if (!text) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = `${settings.theme}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  deleteBtn.addEventListener('click', () => {
    if (!deleteCustomTheme(settings.theme)) return;
    fillThemes();
    setTheme('nebula');
    persist();
  });

  // Минимальный контраст текста.
  const contrastRow = document.createElement('label');
  contrastRow.className = 'drawer-row';
  const contrastText = document.createElement('span');
  contrastText.dataset.i18n = 'textContrast';
  contrastRow.append(contrastText);
  const contrastSelect = document.createElement('select');
  for (const [v, key] of [[1, 'contrastOff'], [3, 'contrastLow'], [4.5, 'contrastNormal'], [7, 'contrastHigh']]) {
    const o = document.createElement('option');
    o.value = String(v);
    o.dataset.i18n = key;
    contrastSelect.appendChild(o);
  }
  contrastSelect.value = String(settings.minContrast);
  if (contrastSelect.value !== String(settings.minContrast)) contrastSelect.value = '4.5';
  // Тема может зафиксировать контраст (Clear): список тогда показывает «Выкл.» и недоступен, сохранённая настройка не меняется.
  function syncContrastSelect() {
    const fixed = THEMES[settings.theme]?.fixedContrast;
    contrastSelect.disabled = fixed !== undefined;
    contrastSelect.value = String(fixed ?? settings.minContrast);
    if (contrastSelect.value !== String(fixed ?? settings.minContrast)) contrastSelect.value = '4.5';
  }
  syncContrastSelect();
  contrastSelect.addEventListener('change', () => {
    settings.minContrast = Number(contrastSelect.value);
    term.options.minimumContrastRatio = contrastFor(settings.theme);
    persist();
  });
  contrastRow.appendChild(contrastSelect);
  themeTools.after(contrastRow);

  // Фоновая картинка: выбор файла (хранится в IndexedDB браузера), прозрачность и размытие, прозрачность терминала.
  const bgBox = document.createElement('div');
  bgBox.className = 'drawer-flags bg-tools';
  const bgTitle = document.createElement('div');
  bgTitle.className = 'drawer-row drawer-subtitle';
  bgTitle.dataset.i18n = 'bgTitle';
  const bgButtons = document.createElement('div');
  bgButtons.className = 'drawer-row theme-tools';
  const bgChoose = mkBtn('Import');
  bgChoose.dataset.i18n = 'bgChoose';
  bgChoose.dataset.i18nTitle = 'bgChooseTitle';
  const bgRemove = mkBtn('Delete');
  bgRemove.dataset.i18n = 'bgRemove';
  bgRemove.dataset.i18nTitle = 'bgRemoveTitle';
  const bgFile = document.createElement('input');
  bgFile.type = 'file';
  bgFile.accept = 'image/*';
  bgFile.hidden = true;
  bgButtons.append(bgChoose, bgRemove, bgFile);
  const slider = (key, prop, max, applyFn) => {
    const row = document.createElement('label');
    row.className = 'drawer-row';
    const text = document.createElement('span');
    text.dataset.i18n = key;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = String(max);
    input.value = String(settings[prop]);
    input.addEventListener('input', () => { settings[prop] = Number(input.value); applyFn(); persist(); });
    row.append(text, input);
    return row;
  };
  const applyBg = () => {
    background.apply({ opacity: settings.bgOpacity, blur: settings.bgBlur });
    if (bgActive) setTermTheme(THEMES[settings.theme].colors);
  };
  bgBox.append(bgTitle, bgButtons,
    slider('bgOpacity', 'bgOpacity', 100, applyBg),
    slider('bgBlur', 'bgBlur', 40, applyBg),
    slider('bgTermOpacity', 'termAlpha', 100, applyBg));
  contrastRow.after(bgBox);
  const syncBgButtons = () => { bgRemove.disabled = !bgActive; };
  syncBgButtons();
  bgChoose.addEventListener('click', () => bgFile.click());
  bgFile.addEventListener('change', async () => {
    const file = bgFile.files?.[0];
    bgFile.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    background.setBlob(file);
    applyBg();
    syncBgButtons();
    try { await saveStoredImage(file); } catch { themeMsg.textContent = 'could not store the image'; }
  });
  bgRemove.addEventListener('click', async () => {
    background.clear();
    syncBgButtons();
    await clearStoredImage();
  });
  // картинка из прошлой сессии (или адрес из ?bg= / настроек встраивающего окружения)
  if (settings.bgUrl) {
    background.setUrl(settings.bgUrl);
    applyBg();
    syncBgButtons();
  } else {
    loadStoredImage().then((blob) => {
      if (!blob) return;
      background.setBlob(blob);
      applyBg();
      syncBgButtons();
    });
  }

  for (const [key, f] of Object.entries(FONTS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = f.label;
    fontFamilySelect.appendChild(opt);
  }
  fontFamilySelect.value = settings.fontFamily;
  const nerdRow = document.createElement('label');
  nerdRow.className = 'drawer-row drawer-check';
  const nerdText = document.createElement('span');
  nerdText.dataset.i18n = 'nerdIcons';
  const nerdBox = document.createElement('input');
  nerdBox.type = 'checkbox';
  nerdBox.checked = settings.nerdSymbols;
  nerdBox.addEventListener('change', () => {
    setNerdSymbols(nerdBox.checked);
    persist();
  });
  nerdRow.append(nerdText, nerdBox);
  fontFamilySelect.closest('label').after(nerdRow);
  preloadFonts();

  opacityInput.value = settings.opacity;
  cursorSelect.value = settings.cursorStyle;
  fontValue.textContent = settings.fontSize;

  // Переключатели копирования/вставки: строятся здесь, чтобы не дублировать разметку во всех index.html.
  const flagBox = document.createElement('div');
  flagBox.className = 'drawer-flags';
  const flagTitle = document.createElement('div');
  flagTitle.className = 'drawer-row drawer-subtitle';
  flagTitle.dataset.i18n = 'copyPasteTitle';
  flagBox.appendChild(flagTitle);
  for (const [key, labelKey] of FLAG_ROWS) {
    const row = document.createElement('label');
    row.className = 'drawer-row';
    const text = document.createElement('span');
    text.dataset.i18n = labelKey;
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !!settings[key];
    box.addEventListener('change', () => { settings[key] = box.checked; persist(); });
    row.append(text, box);
    flagBox.appendChild(row);
  }
  const searchRow = drawer.querySelector('.search-row');
  drawer.insertBefore(flagBox, searchRow);
  applyI18n();                          // строки, созданные выше, тоже переводятся

  // Хэндл на первые handleIntroMs мс виден целиком, чтобы пользователь знал, где настройки.
  if (settings.showUI && settings.handleIntroMs > 0) {
    drawerHandle.classList.add('near');
    setTimeout(() => { if (drawer.hidden) drawerHandle.classList.remove('near'); }, settings.handleIntroMs);
  }

  installHandleDrag(drawerHandle);       // удержание → перетащить; прилипает к краям (не к углам)
  drawerHandle.addEventListener('click', toggleDrawer);

  if (settings.showUI && settings.handleAutoHide) {
    const WAKE_DIST = 160;
    document.addEventListener('mousemove', (e) => {
      const r = drawerHandle.getBoundingClientRect();
      const dx = Math.max(r.left - e.clientX, e.clientX - r.right, 0);
      const dy = Math.max(r.top - e.clientY, e.clientY - r.bottom, 0);
      const near = Math.hypot(dx, dy) < WAKE_DIST;
      drawerHandle.classList.toggle('near', near || !drawer.hidden);
    });
  }

  // Общие сеттеры — вызываются и из UI панели, и программно через
  // updateConfig() (например, когда Wallpaper Engine присылает новые
  // значения свойств: тут можно поменять тему/шрифт без перезагрузки
  // страницы, то есть без лишнего пересоздания WebGL/WASM).
  function setTheme(key) {
    if (!THEMES[key]) return;
    settings.theme = key;
    themeSelect.value = key;
    const t = applyThemeChrome(key);
    setTermTheme(t.colors);
    term.options.minimumContrastRatio = contrastFor(key);
    syncContrastSelect?.();
    updateThemeTools?.();
  }
  // Подмножества шрифтов (кириллица, греческий, символы, Braille) браузер грузит лениво — по первому глифу, а
  // canvas/WebGL до этого рисует запасным шрифтом и сам не перерисовывается. Загружаем всё заранее и сбрасываем атлас.
  function preloadFonts() {
    const spec = `${settings.fontSize}px ${fontStack(settings.fontFamily, settings.nerdSymbols)}`;
    const samples = settings.nerdSymbols ? [...FONT_SAMPLES, '\uf015\ue0a0'] : FONT_SAMPLES;
    Promise.all(samples.map((t) => document.fonts.load(spec, t))).then(() => {
      term.clearTextureAtlas?.();
      fitAddon.fit();
      term.refresh(0, term.rows - 1);
      sendResize();
    }).catch(() => {});
  }
  function setFontFamily(key) {
    if (!FONTS[key]) return;
    settings.fontFamily = key;
    fontFamilySelect.value = key;
    term.options.fontFamily = fontStack(key, settings.nerdSymbols);
    fitAddon.fit();
    sendResize();
    preloadFonts();
  }

  function setNerdSymbols(enabled) {
    settings.nerdSymbols = !!enabled;
    term.options.fontFamily = fontStack(settings.fontFamily, settings.nerdSymbols);
    fitAddon.fit();
    sendResize();
    preloadFonts();
    if (nerdBox) nerdBox.checked = settings.nerdSymbols;
  }
  function setFontSize(n) {
    settings.fontSize = Math.max(9, Math.min(28, n));
    fontValue.textContent = settings.fontSize;
    term.options.fontSize = settings.fontSize;
    fitAddon.fit();
    sendResize();
  }
  function setOpacity(n) {
    settings.opacity = Math.max(0, Math.min(100, n));
    opacityInput.value = settings.opacity;
    document.documentElement.style.setProperty('--glass-alpha', settings.opacity / 100);
  }
  function setCursorStyle(style) {
    if (!['bar', 'block', 'underline'].includes(style)) return;
    settings.cursorStyle = style;
    cursorSelect.value = style;
    term.options.cursorStyle = style;
  }

  themeSelect.addEventListener('change', () => { setTheme(themeSelect.value); persist(); });
  fontFamilySelect.addEventListener('change', () => { setFontFamily(fontFamilySelect.value); persist(); });
  opacityInput.addEventListener('input', () => { setOpacity(Number(opacityInput.value)); persist(); });
  cursorSelect.addEventListener('change', () => { setCursorStyle(cursorSelect.value); persist(); });
  document.getElementById('fontMinus').addEventListener('click', () => { setFontSize(settings.fontSize - 1); persist(); });
  document.getElementById('fontPlus').addEventListener('click', () => { setFontSize(settings.fontSize + 1); persist(); });

  // ---------- действия и привязка кнопок мыши ----------
  // Вставка: bracketed (term.paste ставит маркеры, если приложение их включило) либо «как набрано».
  const pasteText = (text) => {
    if (!text || settings.readonly) return;
    if (settings.bracketedPaste) term.paste(text);
    else transport.send(text.replace(/\r?\n/g, '\r'));
  };
  const pasteFromClipboard = () => {
    navigator.clipboard.readText().then(pasteText).catch(() => {});
  };
  const copySelection = () => {
    const sel = term.getSelection();
    if (sel) navigator.clipboard.writeText(sel).catch(() => {});
    return !!sel;
  };
  const actionApi = {
    term,
    settings,
    defaultFontSize: 14,
    send: (text) => { if (!settings.readonly) transport.send(text); },
    sendCursorKey: (letter) => {
      if (settings.readonly) return;
      transport.send((term.modes.applicationCursorKeysMode ? '\x1bO' : '\x1b[') + letter);
    },
    copy: copySelection,
    paste: () => { if (!settings.readonly) pasteFromClipboard(); },
    // как раньше работал ПКМ: есть выделение — копируем (по флагу) и снимаем, нет — вставляем (по флагу)
    smartCopyPaste: () => {
      if (term.hasSelection()) {
        if (settings.rightClickCopy) copySelection();
        term.clearSelection();
      } else if (settings.rightClickPaste && !settings.readonly) {
        pasteFromClipboard();
      }
    },
    setFontSize: (n) => { setFontSize(n); persist(); },
    setOpacity: (n) => { setOpacity(n); persist(); },
    cycleTheme: (dir) => {
      const keys = Object.keys(THEMES);
      const i = keys.indexOf(settings.theme);
      setTheme(keys[(i + dir + keys.length) % keys.length]);
      persist();
    },
    resetPreferences: async () => {
      if (!await confirmInPage({
        title: tr('resetPreferences'),
        message: tr('resetPreferencesConfirm'),
        confirmLabel: tr('resetPreferences'),
        cancelLabel: tr('closeHint'),
      })) return;
      if (typeof overrides.resetSavedPreferences === 'function') {
        overrides.resetSavedPreferences();
      } else if (clearSavedPreferences()) {
        location.reload();
      }
    },
    toggleDrawer,
    reconnect: () => { transport.disconnect(); transport.connect(); },
    snippet: (n) => {
      const text = settings.bindings.snippets?.[n - 1];
      // в свойстве WE перевод строки вводится как \n
      if (text && !settings.readonly) transport.send(text.replace(/\\n/g, '\r'));
    },
  };
  installBindings({ api: actionApi, getBindings: () => settings.bindings, readonly: settings.readonly });
  // Виртуальная клавиатура — физическая на настоящем столе WE до страницы не доходит.
  const keyboard = installKeyboard({
    api: actionApi, term, readonly: settings.readonly, enabled: settings.keyboardEnabled, layouts: settings.kbLayouts,
  });
  actionApi.toggleKeyboard = keyboard.toggle;
  // Радиальное меню быстрых действий: на настоящем столе WE доступна только
  // левая кнопка + наведение, так что это основной способ управления с мыши.
  const noop = () => {};
  const radial = settings.radialEnabled ? installRadial({
    api: actionApi, readonly: settings.readonly, position: settings.menuPos, moveMode: settings.menuMove,
    features: { keyboard: keyboard.enabled }, language: settings.menuLang,
    size: settings.menuSize, opacity: settings.menuOpacity,
  }) : { toggle: noop, setLanguage: noop, setSize: noop, setOpacity: noop, setPosition: noop, setMoveMode: noop };
  actionApi.toggleMenu = radial.toggle;

  // Режим «без bracketed paste»: перехватываем событие paste до xterm.js и шлём текст как набранный.
  term.textarea?.addEventListener('paste', (e) => {
    if (settings.bracketedPaste || settings.readonly) return;
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    pasteText(text);
  }, true);

  // ---------- горячие клавиши ----------
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true;
    if (overrides.keyHook?.(e)) return false;          // встраивающая страница (PVE: переключение портов) забрала клавишу
    const mod = e.ctrlKey || e.metaKey;
    const letter = hotkeyLetter(e);      // c/v/f независимо от раскладки (hotkeys.js)

    if (!settings.readonly && settings.copyCtrlShiftC && mod && e.shiftKey && letter === 'c') {
      const sel = term.getSelection();
      if (sel) navigator.clipboard.writeText(sel).catch(() => {});
      return false;
    }
    // Ctrl(+Shift)+V: вставку делает сам браузер через событие paste (xterm.js его обрабатывает) — без запроса прав
    // на буфер обмена. Если режим включён, просто не даём xterm.js отправить ^V (return false без preventDefault);
    // выключен — глушим и событие paste.
    if (mod && e.shiftKey && letter === 'v') {
      if (!settings.pasteCtrlShiftV || settings.readonly) e.preventDefault();
      return false;
    }
    // Windows-style: Ctrl+C копирует выделенное; если выделения нет —
    // пропускаем дальше как обычный SIGINT (^C) в pty.
    if (!settings.readonly && settings.copyCtrlC && mod && !e.shiftKey && letter === 'c') {
      const sel = term.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel).catch(() => {});
        term.clearSelection();
        return false;
      }
      return true;
    }
    if (mod && !e.shiftKey && letter === 'v') {
      if (!settings.pasteCtrlV || settings.readonly) e.preventDefault();
      return false;
    }
    // Ctrl+F — поиск по буферу, но на альтернативном экране (vim, less, mc, btop) Ctrl+F принадлежит приложению;
    // там поиск открывается по Ctrl+Shift+F.
    // Страница без строки поиска (PVE): Ctrl+F уходит приложению в терминале как обычно.
    if (searchInput && mod && letter === 'f' && (e.shiftKey || term.buffer.active.type !== 'alternate')) {
      openDrawer();
      searchInput.focus();
      searchInput.select();
      return false;
    }
    if (e.key === 'Escape' && !drawer.hidden) {
      closeDrawer();
      return false;
    }
    return true;
  });

  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) searchAddon.findPrevious(searchInput.value);
        else searchAddon.findNext(searchInput.value);
      } else if (e.key === 'Escape') {
        closeDrawer();
      }
    });
    document.getElementById('searchNext').addEventListener('click', () => searchAddon.findNext(searchInput.value));
    document.getElementById('searchPrev').addEventListener('click', () => searchAddon.findPrevious(searchInput.value));

    searchAddon.onDidChangeResults((res) => {
      searchCount.textContent = res ? `${res.resultIndex + 1}/${res.resultCount}` : '';
    });
  }

  // Косметическое обновление без пересоздания терминала/транспорта —
  // безопасно дёргать на каждое сообщение от хоста (WE и т.п.), в отличие
  // от полной перезагрузки страницы. Для структурных изменений (адрес
  // бэкенда, токен, readonly, webgl/images) нужен настоящий перезапуск —
  // это решает сам вызывающий код (см. wallpaper-engine/we-bridge.js).
  function updateConfig(partial = {}, { persist: shouldPersist = true } = {}) {
    if (partial.theme) setTheme(partial.theme);
    if (partial.fontFamily) setFontFamily(partial.fontFamily);
    if (partial.fontSize !== undefined) setFontSize(Number(partial.fontSize));
    if (partial.opacity !== undefined) setOpacity(Number(partial.opacity));
    if (partial.cursorStyle) setCursorStyle(partial.cursorStyle);
    if (partial.nerdSymbols !== undefined) setNerdSymbols(partial.nerdSymbols);
    if (partial.kbLayouts) keyboard.setLayouts(partial.kbLayouts);
    if (partial.menuLang) {
      radial.setLanguage(partial.menuLang); statusOverlay.setLanguage(partial.menuLang);
      settings.menuLang = partial.menuLang;
      tr = translator(LANGUAGES[partial.menuLang] ? partial.menuLang : DEFAULT_LANGUAGE);
      applyI18n();
      fillThemes();
    }
    if (partial.menuSize !== undefined) { settings.menuSize = Number(partial.menuSize); radial.setSize(settings.menuSize); }
    if (partial.menuOpacity !== undefined) { settings.menuOpacity = Number(partial.menuOpacity); radial.setOpacity(settings.menuOpacity); }
    if (partial.menuPos) { settings.menuPos = partial.menuPos; radial.setPosition(settings.menuPos); }
    if (partial.menuMove !== undefined) { settings.menuMove = !!partial.menuMove; radial.setMoveMode(settings.menuMove); }
    if (partial.bindings) settings.bindings = { ...DEFAULT_BINDINGS, ...partial.bindings };
    if (shouldPersist) persist();
  }

  return { term, transport, updateConfig, clearImages, setImagePolicy };
}

// Автозапуск для обычного браузера. Встраивающие окружения (например,
// Wallpaper Engine) ставят window.__WE_MANAGED = true ДО импорта этого
// модуля и сами вызывают startWebterm(config), когда конфиг готов.
if (!window.__WE_MANAGED) {
  startWebterm();
}

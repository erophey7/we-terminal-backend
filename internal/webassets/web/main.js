import { THEMES, applyThemeChrome } from './themes.js';
import { FONTS } from './fonts.js';
import { WsTransport } from './transport.js';
import { createTerminal } from './terminal.js';
import { DEFAULT_BINDINGS } from './actions.js';
import { installBindings } from './bindings.js';
import { installRadial } from './radial.js';
import { installKeyboard } from './keyboard.js';
import { installStatusOverlay } from './status.js';

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

const PERSIST_KEY = 'webterm:settings';

function readConfig(overrides) {
  const qp = new URL(location.href).searchParams;
  const saved = JSON.parse(localStorage.getItem(PERSIST_KEY) || '{}');

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
    copyCtrlC: overrides.copyCtrlC ?? qp.get('copyCtrlC') !== '0', // Ctrl+C копирует, если есть выделение, иначе — обычный SIGINT
    pasteCtrlV: overrides.pasteCtrlV ?? qp.get('pasteCtrlV') !== '0', // Ctrl+V всегда вставляет (как в Windows)
    copyCtrlShiftC: overrides.copyCtrlShiftC ?? qp.get('copyCtrlShiftC') !== '0',
    pasteCtrlShiftV: overrides.pasteCtrlShiftV ?? qp.get('pasteCtrlShiftV') !== '0',
    autoCopySelection: overrides.autoCopySelection ?? qp.get('autoCopy') !== '0', // копия в буфер сразу при выделении мышью
    rightClickCopy: overrides.rightClickCopy ?? qp.get('rcCopy') !== '0', // ПКМ копирует выделенное
    rightClickPaste: overrides.rightClickPaste ?? qp.get('rcPaste') !== '0', // ПКМ вставляет, если ничего не выделено

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
  const settings = readConfig(overrides);

  function persist() {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({
      theme: settings.theme,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      opacity: settings.opacity,
      cursorStyle: settings.cursorStyle,
    }));
  }

  const chromeTheme = applyThemeChrome(settings.theme);
  document.documentElement.style.setProperty('--glass-alpha', settings.opacity / 100);

  // ---------- терминал ----------
  const { term, fitAddon, searchAddon, feed } = createTerminal({
    container: document.getElementById('terminal'),
    colors: chromeTheme.colors,
    fontFamily: (FONTS[settings.fontFamily] || FONTS.jetbrains).stack,
    fontSize: settings.fontSize,
    cursorStyle: settings.cursorStyle,
    readonly: settings.readonly,
    enableWebgl: settings.enableWebgl,
    enableImages: settings.enableImages,
    enableKitty: settings.enableKitty,
  });
  term.focus();

  // ---------- транспорт ----------
  const transport = new WsTransport(resolveWsUrl(settings.ws, settings.token));

  const statusDots = document.querySelectorAll('.status-dot');
  const statusText = document.getElementById('statusText');

  const STATUS_LABEL = {
    connecting: 'подключение…',
    online: 'подключено',
    offline: 'соединение потеряно — переподключение…',
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
    if (settings.autoCopySelection) {
      term.onSelectionChange(() => {
        const sel = term.getSelection();
        if (sel) navigator.clipboard.writeText(sel).catch(() => {});
      });
    }

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

  for (const [key, t] of Object.entries(THEMES)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = t.label;
    themeSelect.appendChild(opt);
  }
  themeSelect.value = settings.theme;

  for (const [key, f] of Object.entries(FONTS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = f.label;
    fontFamilySelect.appendChild(opt);
  }
  fontFamilySelect.value = settings.fontFamily;

  opacityInput.value = settings.opacity;
  cursorSelect.value = settings.cursorStyle;
  fontValue.textContent = settings.fontSize;

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
    term.options.theme = t.colors;
  }
  function setFontFamily(key) {
    if (!FONTS[key]) return;
    settings.fontFamily = key;
    fontFamilySelect.value = key;
    term.options.fontFamily = FONTS[key].stack;
    fitAddon.fit();
    sendResize();
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
  const pasteFromClipboard = () => {
    navigator.clipboard.readText().then((text) => {
      if (text) transport.send(text);
    }).catch(() => {});
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
  const radial = installRadial({
    api: actionApi, readonly: settings.readonly, position: settings.menuPos, moveMode: settings.menuMove,
    features: { keyboard: keyboard.enabled }, language: settings.menuLang,
    size: settings.menuSize, opacity: settings.menuOpacity,
  });
  actionApi.toggleMenu = radial.toggle;

  // ---------- горячие клавиши ----------
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true;
    const mod = e.ctrlKey || e.metaKey;

    if (!settings.readonly && settings.copyCtrlShiftC && mod && e.shiftKey && e.key.toLowerCase() === 'c') {
      const sel = term.getSelection();
      if (sel) navigator.clipboard.writeText(sel).catch(() => {});
      return false;
    }
    if (!settings.readonly && settings.pasteCtrlShiftV && mod && e.shiftKey && e.key.toLowerCase() === 'v') {
      navigator.clipboard.readText().then((text) => {
        if (text) transport.send(text);
      }).catch(() => {});
      return false;
    }
    // Windows-style: Ctrl+C копирует выделенное; если выделения нет —
    // пропускаем дальше как обычный SIGINT (^C) в pty.
    if (!settings.readonly && settings.copyCtrlC && mod && !e.shiftKey && e.key.toLowerCase() === 'c') {
      const sel = term.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel).catch(() => {});
        term.clearSelection();
        return false;
      }
      return true;
    }
    if (!settings.readonly && settings.pasteCtrlV && mod && !e.shiftKey && e.key.toLowerCase() === 'v') {
      navigator.clipboard.readText().then((text) => {
        if (text) transport.send(text);
      }).catch(() => {});
      return false;
    }
    if (mod && e.key.toLowerCase() === 'f') {
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

  // Косметическое обновление без пересоздания терминала/транспорта —
  // безопасно дёргать на каждое сообщение от хоста (WE и т.п.), в отличие
  // от полной перезагрузки страницы. Для структурных изменений (адрес
  // бэкенда, токен, readonly, webgl/images) нужен настоящий перезапуск —
  // это решает сам вызывающий код (см. wallpaper-engine/we-bridge.js).
  function updateConfig(partial = {}) {
    if (partial.theme) setTheme(partial.theme);
    if (partial.fontFamily) setFontFamily(partial.fontFamily);
    if (partial.fontSize !== undefined) setFontSize(Number(partial.fontSize));
    if (partial.opacity !== undefined) setOpacity(Number(partial.opacity));
    if (partial.cursorStyle) setCursorStyle(partial.cursorStyle);
    if (partial.kbLayouts) keyboard.setLayouts(partial.kbLayouts);
    if (partial.menuLang) { radial.setLanguage(partial.menuLang); statusOverlay.setLanguage(partial.menuLang); }
    if (partial.menuSize !== undefined) radial.setSize(partial.menuSize);
    if (partial.menuOpacity !== undefined) radial.setOpacity(partial.menuOpacity);
    if (partial.menuPos) radial.setPosition(partial.menuPos);
    if (partial.menuMove !== undefined) radial.setMoveMode(partial.menuMove);
    if (partial.bindings) settings.bindings = { ...DEFAULT_BINDINGS, ...partial.bindings };
    persist();
  }

  return { term, transport, updateConfig };
}

// Автозапуск для обычного браузера. Встраивающие окружения (например,
// Wallpaper Engine) ставят window.__WE_MANAGED = true ДО импорта этого
// модуля и сами вызывают startWebterm(config), когда конфиг готов.
if (!window.__WE_MANAGED) {
  startWebterm();
}

// Виртуальная клавиатура: на настоящем столе Wallpaper Engine до страницы
// доходит только левая кнопка мыши (+ наведение), физическая клавиатура —
// нет. Поэтому клавиши нажимаются кликом, а модификаторы залипающие:
// Shift/Ctrl/Alt — тап включает на одну клавишу, второй тап фиксирует,
// третий снимает. Зажатие мыши на Backspace, стрелках, Пробеле и т.п.
// даёт автоповтор.
//
// Всё, что набрано, уходит в api.send() как обычный ввод терминала
// (байты/escape-последовательности, как у настоящей клавиатуры).
// Клавиатура лежит поверх терминала; её можно перетащить за рамку.

import { LAYOUTS, layoutRows, sp } from './kblayouts.js';

const REPEAT_DELAY = 420;
const REPEAT_RATE = 55;
const LANG_KEY = 'webterm:kblang';
const POS_KEY = 'webterm:kbpos';
const EDGE = 14;          // отступ от края при стыковке
const DEFAULT_BOTTOM = 64; // по умолчанию выше панели задач Windows

// ---------- раскладки: см. kblayouts.js ----------

const FN_ROW = [
  ...Array.from({ length: 12 }, (_, i) => sp(`F${i + 1}`, `F${i + 1}`)),
  sp('Insert', 'Ins'), sp('Delete', 'Del', 1, { repeat: true }), sp('Home', 'Home'), sp('End', 'End'), sp('PageUp', 'PgUp', 1, { repeat: true }),
  sp('PageDown', 'PgDn', 1, { repeat: true }),
];

// Esc здесь, а не в верхнем ряду: так верхние ряды выровнены как на настоящей QWERTY.
const BOTTOM_ROW = [
  sp('Esc', 'Esc', 1.1), sp('Ctrl', 'Ctrl', 1.4, { mod: 'ctrl' }), sp('Alt', 'Alt', 1.4, { mod: 'alt' }), sp('Lang', 'EN', 1.2), sp('Fn', 'Fn', 1.1),
  sp('Space', '', 5, { repeat: true }),
  sp('ArrowLeft', '←', 1, { repeat: true }), sp('ArrowUp', '↑', 1, { repeat: true }), sp('ArrowDown', '↓', 1, { repeat: true }),
  sp('ArrowRight', '→', 1, { repeat: true }),
  sp('Copy', 'Copy', 1.3), sp('Paste', 'Paste', 1.3), sp('Close', '✕', 1),
];

// ---------- кодирование клавиш ----------
const TILDE = { Insert: 2, Delete: 3, PageUp: 5, PageDown: 6, F5: 15, F6: 17, F7: 18, F8: 19, F9: 20, F10: 21, F11: 23, F12: 24 };
const SS3 = { F1: 'P', F2: 'Q', F3: 'R', F4: 'S' };
const ARROW = { ArrowUp: 'A', ArrowDown: 'B', ArrowRight: 'C', ArrowLeft: 'D' };

// m — xterm-параметр модификаторов: 1 + shift(1) + alt(2) + ctrl(4)
function encodeSpecial(id, mods, appCursor) {
  const m = 1 + (mods.shift ? 1 : 0) + (mods.alt ? 2 : 0) + (mods.ctrl ? 4 : 0);
  if (ARROW[id]) return m > 1 ? `\x1b[1;${m}${ARROW[id]}` : (appCursor ? '\x1bO' : '\x1b[') + ARROW[id];
  if (id === 'Home' || id === 'End') {
    const L = id === 'Home' ? 'H' : 'F';
    return m > 1 ? `\x1b[1;${m}${L}` : (appCursor ? '\x1bO' : '\x1b[') + L;
  }
  if (TILDE[id]) return m > 1 ? `\x1b[${TILDE[id]};${m}~` : `\x1b[${TILDE[id]}~`;
  if (SS3[id]) return m > 1 ? `\x1b[1;${m}${SS3[id]}` : `\x1bO${SS3[id]}`;
  const alt = mods.alt ? '\x1b' : '';
  switch (id) {
    case 'Enter': return alt + '\r';
    case 'Tab': return mods.shift ? '\x1b[Z' : alt + '\t';
    case 'Backspace': return alt + (mods.ctrl ? '\x08' : '\x7f');
    case 'Esc': return '\x1b';
    case 'Space': return alt + (mods.ctrl ? '\0' : ' ');
    default: return '';
  }
}

const isLetter = (def) => def.base.toLowerCase() !== def.base.toUpperCase();

function encodeChar(def, mods) {
  // у букв Caps инвертирует Shift, у остальных клавиш Caps не влияет
  const upper = isLetter(def) ? mods.shift !== !!mods.caps : mods.shift;
  let out = upper ? def.shift : def.base;
  if (mods.ctrl) {
    const e = def.en.toLowerCase();
    if (e >= 'a' && e <= 'z') out = String.fromCharCode(e.charCodeAt(0) - 96);
    else if (e === '[') out = '\x1b';
    else if (e === '\\') out = '\x1c';
    else if (e === ']') out = '\x1d';
    else if (e === '2' || e === '`') out = '\0';
    else if (e === '/' || e === '-') out = '\x1f';
  }
  return (mods.alt ? '\x1b' : '') + out;
}

const CSS = `
.vkb{position:fixed;left:0;top:0;z-index:42;display:none;cursor:grab;
  width:clamp(640px,58vw,1560px);padding:.6em;border-radius:1em;
  background:rgba(14,12,24,.9);border:1px solid color-mix(in srgb,var(--accent,#8a7dff) 45%,transparent);
  box-shadow:0 12px 40px rgba(0,0,0,.55);font:600 clamp(11px,.78vw,20px) 'JetBrains Mono',ui-monospace,monospace;
  color:#eceaff;user-select:none;-webkit-user-select:none}
.vkb.open{display:block;animation:vkb-in .16s ease-out}
.vkb.dragging{cursor:grabbing;box-shadow:0 18px 56px rgba(0,0,0,.7),0 0 0 2px var(--accent,#8a7dff)}
@keyframes vkb-in{from{opacity:0}to{opacity:1}}
.vkb-grip{height:.9em;margin:-.15em 0 .3em;display:flex;align-items:center;justify-content:center}
.vkb-grip::before{content:"";width:5em;height:.28em;border-radius:1em;background:rgba(236,234,255,.28)}
.vkb:hover .vkb-grip::before{background:var(--accent,#8a7dff)}
.vkb-row{display:flex;gap:.35em;margin-bottom:.35em}
.vkb-row:last-child{margin-bottom:0}
.vkb-key{cursor:pointer;flex:1 1 0;min-width:0;height:2.7em;border-radius:.55em;border:1px solid rgba(255,255,255,.1);
  background:rgba(36,32,56,.92);color:inherit;font:inherit;cursor:pointer;padding:0;overflow:hidden;
  transition:background .08s,border-color .08s,transform .06s;touch-action:none}
.vkb-key:hover{background:rgba(58,50,92,.95);border-color:var(--accent,#8a7dff)}
.vkb-key:active,.vkb-key.down{transform:translateY(1px);background:color-mix(in srgb,var(--accent,#8a7dff) 55%,rgba(30,26,48,.95))}
.vkb-key.mod-1{background:color-mix(in srgb,var(--accent,#8a7dff) 45%,rgba(30,26,48,.95));border-color:var(--accent,#8a7dff)}
.vkb-key.mod-2{background:var(--accent,#8a7dff);color:#10101c;border-color:#fff}
.vkb-key.on{background:color-mix(in srgb,var(--accent,#8a7dff) 45%,rgba(30,26,48,.95));border-color:var(--accent,#8a7dff)}
.vkb-key.util{background:rgba(24,22,40,.92);color:rgba(236,234,255,.75)}
.vkb-fn{display:none}
.vkb.fn .vkb-fn{display:flex}
`;

// layouts — коды включённых раскладок (порядок = порядок переключения кнопкой); enabled=false — клавиатуры нет вовсе.
export function installKeyboard({ api, term, readonly = false, enabled = true, layouts = ['en', 'ru'] }) {
  if (readonly || !enabled) return { open() {}, close() {}, toggle() {}, isOpen: () => false, setLayouts() {}, enabled: false };

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'vkb';
  document.body.appendChild(root);

  let lang = 'en';
  try { const s = localStorage.getItem(LANG_KEY); if (LAYOUTS[s]) lang = s; } catch { /* нет хранилища */ }
  const mods = { shift: 0, ctrl: 0, alt: 0, caps: 0 }; // 0 выкл, 1 на одну клавишу, 2 зафиксирована (caps — вкл/выкл)
  let fnOn = false;
  let isOpen = false;
  let repeatTimer = null;
  let repeatDelay = null;

  const keyEls = []; // { el, def }

  function activeMods() {
    return { shift: mods.shift > 0, ctrl: mods.ctrl > 0, alt: mods.alt > 0, caps: mods.caps > 0 };
  }
  // ---------- раскладки ----------
  // Системную раскладку страница в обоях WE не видит (getLayoutMap показывает раскладку
  // потока WE и не меняется), поэтому язык переключает кнопка Lang по кругу среди
  // включённых в настройках раскладок; последняя выбранная запоминается.
  let enabledLayouts = [];
  function setLayouts(list) {
    const valid = (Array.isArray(list) ? list : []).filter((c) => LAYOUTS[c]);
    enabledLayouts = valid.length ? valid : ['en'];
    if (!enabledLayouts.includes(lang)) setLang(enabledLayouts[0]);
    else if (keyEls.length) build(); // кнопка Lang могла появиться/исчезнуть
  }
  function setLang(l) {
    if (!LAYOUTS[l] || l === lang) return;
    lang = l;
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ок */ }
    build();
  }
  function nextLang() {
    const i = enabledLayouts.indexOf(lang);
    setLang(enabledLayouts[(i + 1) % enabledLayouts.length]);
  }

  function clearOneShot() {
    let changed = false;
    for (const k of ['shift', 'ctrl', 'alt']) if (mods[k] === 1) { mods[k] = 0; changed = true; }
    if (changed) refresh();
  }

  function labelFor(def) {
    if (def.type === 'char') {
      const upper = isLetter(def) ? (mods.shift > 0) !== (mods.caps > 0) : mods.shift > 0;
      return upper ? def.shift : def.base;
    }
    if (def.id === 'Lang') return lang.toUpperCase();
    return def.label;
  }
  function refresh() {
    for (const { el, def } of keyEls) {
      el.textContent = labelFor(def);
      if (def.mod) {
        el.classList.toggle('mod-1', mods[def.mod] === 1);
        el.classList.toggle('mod-2', mods[def.mod] === 2);
      }
      if (def.id === 'Fn') el.classList.toggle('on', fnOn);
    }
  }

  function press(def) {
    if (def.mod === 'caps') { // Caps Lock: просто вкл/выкл
      mods.caps = mods.caps ? 0 : 2;
      refresh();
      return;
    }
    if (def.mod) {
      mods[def.mod] = (mods[def.mod] + 1) % 3; // выкл → один раз → фиксировано → выкл
      refresh();
      return;
    }
    switch (def.id) {
      case 'Lang': nextLang(); return;
      case 'Fn': fnOn = !fnOn; root.classList.toggle('fn', fnOn); refresh(); return;
      case 'Close': close(); return;
      case 'Copy': api.copy(); return;
      case 'Paste': api.paste(); return;
      default: break;
    }
    const m = activeMods();
    const data = def.type === 'char'
      ? encodeChar(def, m)
      : encodeSpecial(def.id, m, !!term.modes.applicationCursorKeysMode);
    if (data) api.send(data);
    clearOneShot();
  }

  function stopRepeat() {
    clearTimeout(repeatDelay);
    clearInterval(repeatTimer);
    repeatDelay = repeatTimer = null;
  }

  function makeKey(def) {
    const el = document.createElement('button');
    el.className = 'vkb-key' + (['Copy', 'Paste', 'Close', 'Lang', 'Fn'].includes(def.id) ? ' util' : '');
    el.style.flexGrow = String(def.w ?? 1);
    el.type = 'button';
    el.tabIndex = -1; // фокус не уходит с терминала
    keyEls.push({ el, def });

    // Нажатие обрабатываем на pointerdown (а не click): сразу и без потери при
    // зажатии; click подавляем, чтобы не дублировать.
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('down');
      press(def);
      if (def.repeat) {
        stopRepeat();
        repeatDelay = setTimeout(() => { repeatTimer = setInterval(() => press(def), REPEAT_RATE); }, REPEAT_DELAY);
      }
    });
    el.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); }); // не сбивать выделение
    el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
    for (const t of ['pointerup', 'pointerleave', 'pointercancel']) {
      el.addEventListener(t, () => { el.classList.remove('down'); stopRepeat(); });
    }
    return el;
  }

  function build() {
    root.textContent = '';
    keyEls.length = 0;
    const rows = layoutRows(lang);
    const grip = document.createElement('div');
    grip.className = 'vkb-grip';
    root.appendChild(grip);
    const fnRow = document.createElement('div');
    fnRow.className = 'vkb-row vkb-fn';
    for (const def of FN_ROW) fnRow.appendChild(makeKey(def));
    root.appendChild(fnRow);
    for (const rowDefs of [...rows, BOTTOM_ROW]) {
      const row = document.createElement('div');
      row.className = 'vkb-row';
      for (const def of rowDefs) {
        if (def.id === 'Lang' && enabledLayouts.length < 2) continue; // переключать нечего
        row.appendChild(makeKey(def));
      }
      root.appendChild(row);
    }
    refresh();
  }

  // ---------- положение и перетаскивание ----------
  // Клавиатура накладывается на терминал (не сжимает его). Захват — за рамку и
  // полоску сверху (не за клавиши); границы — экран (без прилипания). Положение — долями свободной области, в localStorage.
  const inside = (e) => e.clientX >= 0 && e.clientY >= 0 && e.clientX < innerWidth && e.clientY < innerHeight;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  let pos = null; // { fx, fy } | null — по умолчанию: по центру внизу

  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if (p && typeof p.fx === 'number' && typeof p.fy === 'number') pos = p;
  } catch { /* нет хранилища */ }

  function place() {
    const w = root.offsetWidth, h = root.offsetHeight;
    const maxX = innerWidth - w - EDGE, maxY = innerHeight - h - EDGE;
    let x, y;
    if (pos) {
      x = EDGE + clamp(pos.fx, 0, 1) * Math.max(0, maxX - EDGE);
      y = EDGE + clamp(pos.fy, 0, 1) * Math.max(0, maxY - EDGE);
    } else {
      x = (innerWidth - w) / 2;
      y = innerHeight - h - DEFAULT_BOTTOM;
    }
    root.style.left = clamp(x, EDGE, maxX) + 'px';
    root.style.top = clamp(y, EDGE, maxY) + 'px';
  }
  new ResizeObserver(() => { if (isOpen) place(); }).observe(root); // Fn-ряд меняет высоту
  window.addEventListener('resize', () => { if (isOpen) place(); });

  let drag = null;
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.vkb-key')) return;
    e.preventDefault();
    const r = root.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    root.classList.add('dragging');
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag || !inside(e)) return; // события с соседнего монитора пропускаем
    const w = root.offsetWidth, h = root.offsetHeight;
    const maxX = innerWidth - w - EDGE, maxY = innerHeight - h - EDGE;
    let x = clamp(e.clientX - drag.dx, EDGE, maxX);
    let y = clamp(e.clientY - drag.dy, EDGE, maxY);
    root.style.left = x + 'px';
    root.style.top = y + 'px';
    drag.x = x; drag.y = y;
  }, true);
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    root.classList.remove('dragging');
    if (drag.x !== undefined) {
      const w = root.offsetWidth, h = root.offsetHeight;
      pos = {
        fx: (drag.x - EDGE) / Math.max(1, innerWidth - w - 2 * EDGE),
        fy: (drag.y - EDGE) / Math.max(1, innerHeight - h - 2 * EDGE),
      };
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* не критично */ }
    }
    drag = null;
  }, true);

  window.addEventListener('blur', stopRepeat);
  document.addEventListener('pointerup', stopRepeat, true);

  function open() {
    if (isOpen) return;
    if (!root.firstChild) build();
    isOpen = true;
    root.classList.add('open');
    place();
  }
  function close() {
    isOpen = false;
    root.classList.remove('open', 'dragging');
    drag = null;
    stopRepeat();
  }
  const toggle = () => (isOpen ? close() : open());

  setLayouts(layouts);
  build();
  return { open, close, toggle, isOpen: () => isOpen, setLayouts, enabled: true };
}

// Радиальное меню быстрых действий — по центру экрана. Рассчитано на ввод
// одной левой кнопкой мыши плюс наведение (на настоящем столе Wallpaper
// Engine больше ничего не приходит: ни колеса, ни других кнопок, ни клавиш).
//
// Открыть: круглая кнопка поверх терминала. Место — из настроек: углы и
// стороны либо «произвольно» (в режиме перемещения кнопку можно перетащить,
// положение запоминается в localStorage; у краёв кнопка стыкуется: торчит полукругом). Долгого нажатия нет — оно
// сбивало бы выделение. Действие toggleMenu можно повесить и на кнопки
// мыши в браузере.
// Закрыть: центр кольца, клик мимо кольца, Esc, либо выполнение действия.
// Страницы: главная → вид → клавиши → главная (последний сектор переключает).
//
// Действия берутся из actions.js — тот же реестр, что у привязок.

import { ACTION_BY_ID } from './actions.js';
import { DEFAULT_LANGUAGE, LANGUAGES, translator } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const R_OUT = 196;
const R_IN = 92;
const GAP_DEG = 3;
const MARGIN = 20;
const BTN_MIN = 38;
const BTN_MAX = 64;
const BTN_VW = 0.024; // доля ширины экрана: ~61 px на 2560
const SNAP = 56; // ближе этого к краю кнопка стыкуется: половина круга уходит за край
const POSITIONS = ['top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right', 'free'];
const FREE_KEY = 'webterm:menubtn';

// icon — путь в сетке 24×24 (штрих), glyph — короткий текст вместо иконки.
// stay: действие повторяют подряд, меню не закрывается.
const PAGES = {
  main: {
    title: 'quickActions',
    items: [
      { id: 'copy', label: 'copy', icon: 'M9 9h10v11H9z M5 15V4h10' },
      { id: 'paste', label: 'paste', icon: 'M8 5h8v3H8z M6 6H5v15h14V6h-1' },
      { id: 'toggleKeyboard', label: 'keyboard', icon: 'M3 7h18v11H3zM6 10h1M9 10h1M12 10h1M15 10h1M18 10h.01M7 14h10' },
      { id: 'clear', label: 'clear', icon: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13' },
      { id: 'sendCtrlC', label: 'interrupt', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9h6v6H9z' },
      { id: 'scrollPageUp', label: 'up', icon: 'M6 15l6-6 6 6', stay: true },
      { id: 'scrollPageDown', label: 'down', icon: 'M6 9l6 6 6-6', stay: true },
      { page: 'view', label: 'pageView', icon: 'M6 12h.01M12 12h.01M18 12h.01' },
    ],
  },
  view: {
    title: 'pageView',
    items: [
      { id: 'fontPlus', label: 'fontPlus', glyph: 'A+', stay: true },
      { id: 'fontMinus', label: 'fontMinus', glyph: 'A−', stay: true },
      { id: 'themeNext', label: 'theme', glyph: '◐', stay: true },
      { id: 'opacityPlus', label: 'opacityPlus', glyph: '◑', stay: true },
      { id: 'opacityMinus', label: 'opacityMinus', glyph: '○', stay: true },
      { id: 'scrollBottom', label: 'toBottom', glyph: '⤓' },
      { id: 'reconnect', label: 'reconnect', glyph: '⟳' },
      { page: 'keys', label: 'pageKeys', icon: 'M6 12h.01M12 12h.01M18 12h.01' },
    ],
  },
  keys: {
    title: 'pageKeys',
    items: [
      { id: 'sendEsc', label: 'Esc', raw: true, glyph: 'Esc' },
      { id: 'sendTab', label: 'Tab', raw: true, glyph: '⇥' },
      { id: 'sendEnter', label: 'Enter', raw: true, glyph: '↵' },
      { id: 'sendUp', label: 'historyUp', glyph: '↑', stay: true },
      { id: 'sendDown', label: 'historyDown', glyph: '↓', stay: true },
      { id: 'sendCtrlD', label: 'Ctrl+D', raw: true, glyph: '^D' },
      { id: 'selectAll', label: 'selectAll', glyph: '▣' },
      { page: 'main', label: 'back', icon: 'M15 6l-6 6 6 6' },
    ],
  },
};

// label — ключ перевода (i18n.js); raw: true — подпись не переводится (названия клавиш).
const SELECT_ALL = { id: 'selectAll', label: 'selectAll', icon: 'M4 4h4M16 4h4M4 20h4M16 20h4M4 4v4M20 4v4M4 16v4M20 16v4M9 9h6v6H9z' };

const CSS = `
.radial-handle{position:fixed;width:var(--btn,38px);height:var(--btn,38px);border-radius:50%;
  border:2px solid var(--accent,#8a7dff);background:rgba(20,18,30,.7);opacity:var(--btn-op,.78);cursor:pointer;
  transition:opacity .2s,transform .2s,box-shadow .2s;z-index:46;padding:0;touch-action:none}
.radial-handle{--il:29%;--it:29%;--ir:29%;--ib:29%}
.radial-handle::after{content:"";position:absolute;inset:var(--it) var(--ir) var(--ib) var(--il);border-radius:50%;background:var(--accent,#8a7dff);transition:inset .15s}
.radial-handle.dock-l{--il:45%;--ir:13%}
.radial-handle.dock-r{--il:13%;--ir:45%}
.radial-handle.dock-t{--it:45%;--ib:13%}
.radial-handle.dock-b{--it:13%;--ib:45%}
.radial-handle:hover{opacity:1;transform:scale(1.12);box-shadow:0 0 14px var(--accent,#8a7dff)}
.radial-handle.moving{opacity:1;cursor:grab;border-style:dashed;animation:radial-pulse 1.2s ease-in-out infinite}
.radial-handle.moving:active{cursor:grabbing}
@keyframes radial-pulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent,#8a7dff) 60%,transparent)}50%{box-shadow:0 0 0 9px transparent}}
.radial{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;
  background:radial-gradient(circle at center,rgba(8,6,16,.55),rgba(8,6,16,.78))}
.radial.open{display:flex;animation:radial-fade .16s ease-out}
.radial svg{width:min(88vmin,560px);height:min(88vmin,560px);overflow:visible;user-select:none;-webkit-user-select:none}
.radial .sector{fill:rgba(26,22,40,.82);stroke:rgba(255,255,255,.1);stroke-width:1;cursor:pointer;
  transition:fill .12s,transform .12s;transform-origin:0 0}
.radial .sector:hover,.radial .sector.hot{fill:color-mix(in srgb,var(--accent,#8a7dff) 55%,rgba(26,22,40,.9));
  stroke:var(--accent,#8a7dff);filter:drop-shadow(0 0 10px color-mix(in srgb,var(--accent,#8a7dff) 70%,transparent))}
.radial .item{pointer-events:none;fill:none;stroke:#eceaff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.radial .glyph{pointer-events:none;fill:#eceaff;font:600 17px 'JetBrains Mono',ui-monospace,monospace;
  text-anchor:middle;dominant-baseline:central}
.radial .cap{pointer-events:none;fill:rgba(236,234,255,.72);font:500 10.5px 'JetBrains Mono',ui-monospace,monospace;
  text-anchor:middle}
.radial .hub{fill:rgba(18,15,30,.92);stroke:var(--accent,#8a7dff);stroke-width:1.5;cursor:pointer;transition:fill .12s}
.radial .hub:hover{fill:rgba(40,32,70,.95)}
.radial .hub-title{pointer-events:none;fill:#eceaff;font:600 13px 'JetBrains Mono',ui-monospace,monospace;text-anchor:middle}
.radial .hub-sub{pointer-events:none;fill:rgba(236,234,255,.55);font:500 10px 'JetBrains Mono',ui-monospace,monospace;text-anchor:middle}
.radial .page-anim{animation:radial-pop .18s ease-out}
@keyframes radial-fade{from{opacity:0}to{opacity:1}}
@keyframes radial-pop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
`;

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

const rad = (deg) => (deg * Math.PI) / 180;
const pt = (r, deg) => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];

function sectorPath(a0, a1) {
  const [x0, y0] = pt(R_OUT, a0), [x1, y1] = pt(R_OUT, a1);
  const [x2, y2] = pt(R_IN, a1), [x3, y3] = pt(R_IN, a0);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R_OUT} ${R_OUT} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
    + `L${x2.toFixed(2)} ${y2.toFixed(2)}A${R_IN} ${R_IN} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
}

export function installRadial({ api, readonly = false, position = 'bottom-right', moveMode = false, features = {}, language = DEFAULT_LANGUAGE, size = 0, opacity = 78 }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'radial';
  root.hidden = false;
  const svg = el('svg', { viewBox: '-220 -220 440 440' });
  root.appendChild(svg);
  document.body.appendChild(root);

  const handle = document.createElement('button');
  handle.className = 'radial-handle';
  let tr = translator(LANGUAGES[language] ? language : DEFAULT_LANGUAGE);
  handle.title = tr('quickActions');
  document.body.appendChild(handle);

  let page = 'main';
  let isOpen = false;

  function runItem(item) {
    if (item.page) { render(item.page); return; }
    const action = ACTION_BY_ID[item.id];
    if (action && !(readonly && /^(send|paste|snippet)/.test(item.id))) {
      try { action.run(api); } catch (e) { console.warn('radial action failed:', item.id, e); }
    }
    if (!item.stay) close();
  }

  const labelOf = (item) => (item.raw ? item.label : tr(item.label));

  function render(name) {
    page = name;
    svg.textContent = '';
    const g = el('g', { class: 'page-anim' }, svg);
    const title = tr(PAGES[name].title);
    // клавиатура выключена в настройках — вместо её сектора «Выделить всё»
    const items = PAGES[name].items.map((it) => (it.id === 'toggleKeyboard' && features.keyboard === false ? SELECT_ALL : it));
    const hubTitle = el('text', { class: 'hub-title', y: -2 });
    const hubSub = el('text', { class: 'hub-sub', y: 16 });
    const setHub = (a, b) => { hubTitle.textContent = a; hubSub.textContent = b; };

    items.forEach((item, i) => {
      const mid = -90 + i * 45;
      const sector = el('path', { class: 'sector', d: sectorPath(mid - 22.5 + GAP_DEG / 2, mid + 22.5 - GAP_DEG / 2) }, g);
      sector.addEventListener('mouseenter', () => setHub(labelOf(item), item.page ? tr('openHint') : ''));
      sector.addEventListener('mouseleave', () => setHub(title, tr('closeHint')));
      sector.addEventListener('click', (e) => { e.stopPropagation(); runItem(item); });

      const [cx, cy] = pt((R_IN + R_OUT) / 2, mid);
      if (item.icon) {
        const ic = el('g', { class: 'item', transform: `translate(${(cx - 14).toFixed(1)} ${(cy - 22).toFixed(1)}) scale(1.17)` }, g);
        el('path', { d: item.icon }, ic);
      } else {
        const t = el('text', { class: 'glyph', x: cx.toFixed(1), y: (cy - 8).toFixed(1) }, g);
        t.textContent = item.glyph;
      }
      const cap = el('text', { class: 'cap', x: cx.toFixed(1), y: (cy + 20).toFixed(1) }, g);
      cap.textContent = labelOf(item);
    });

    const hub = el('circle', { class: 'hub', r: R_IN - 14 }, g);
    hub.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    g.appendChild(hubTitle);
    g.appendChild(hubSub);
    setHub(title, tr('closeHint'));
  }

  function open(at = 'main') {
    if (isOpen) return;
    render(at);
    root.classList.add('open');
    isOpen = true;
  }
  function close() {
    root.classList.remove('open');
    isOpen = false;
  }
  const toggle = () => (isOpen ? close() : open());

  // ---------- положение кнопки ----------
  let BTN = BTN_MIN;
  let fixedSize = 0; // 0 = автоматически по ширине экрана
  const updateSize = () => {
    BTN = fixedSize > 0
      ? Math.round(Math.min(160, Math.max(20, fixedSize)))
      : Math.round(Math.min(BTN_MAX, Math.max(BTN_MIN, innerWidth * BTN_VW)));
    handle.style.setProperty('--btn', BTN + 'px');
  };
  const applyOpacity = (pct) => {
    const v = Math.min(100, Math.max(10, Number(pct) || 78)) / 100;
    handle.style.setProperty('--btn-op', String(v));
  };
  fixedSize = Number(size) || 0;
  applyOpacity(opacity);
  updateSize();
  let pos = POSITIONS.includes(position) ? position : 'bottom-right';
  let moving = !!moveMode;
  const inside = (e) => e.clientX >= 0 && e.clientY >= 0 && e.clientX < innerWidth && e.clientY < innerHeight;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  function loadFree() {
    try {
      const f = JSON.parse(localStorage.getItem(FREE_KEY) || 'null');
      if (f && typeof f.fx === 'number' && typeof f.fy === 'number') {
        return { fx: f.fx, fy: f.fy, dockX: ['l', 'r'].includes(f.dockX) ? f.dockX : null, dockY: ['t', 'b'].includes(f.dockY) ? f.dockY : null };
      }
    } catch { /* нет хранилища — берём угол */ }
    return { fx: 1, fy: 1, dockX: null, dockY: null };
  }
  function saveFree(f) {
    try { localStorage.setItem(FREE_KEY, JSON.stringify(f)); } catch { /* не критично */ }
  }
  // fx, fy — доли «свободной» области (0 — левый/верхний край, 1 — правый/нижний)
  // dockX: 'l' | 'r' | null, dockY: 't' | 'b' | null — у края центр кнопки лежит на
  // линии края, наружу выступает полукруг (в углу — четверть).
  function placeFree({ fx, fy, dockX = null, dockY = null }) {
    let x = MARGIN + clamp(fx, 0, 1) * (innerWidth - 2 * MARGIN - BTN);
    let y = MARGIN + clamp(fy, 0, 1) * (innerHeight - 2 * MARGIN - BTN);
    if (dockX === 'l') x = -BTN / 2; else if (dockX === 'r') x = innerWidth - BTN / 2;
    if (dockY === 't') y = -BTN / 2; else if (dockY === 'b') y = innerHeight - BTN / 2;
    handle.style.left = x + 'px'; handle.style.top = y + 'px';
    for (const [cls, on] of [['dock-l', dockX === 'l'], ['dock-r', dockX === 'r'], ['dock-t', dockY === 't'], ['dock-b', dockY === 'b']]) {
      handle.classList.toggle(cls, on);
    }
  }
  function applyPosition() {
    const fr = { left: 0, center: 0.5, right: 1, top: 0, middle: 0.5, bottom: 1 };
    handle.style.left = handle.style.top = '';
    if (pos === 'free') { placeFree(loadFree()); return; }
    const parts = pos.split('-');
    const v = parts.includes('top') ? 'top' : parts.includes('bottom') ? 'bottom' : 'middle';
    const h = parts.includes('left') ? 'left' : parts.includes('right') ? 'right' : 'center';
    // пресеты тоже стыкуются к краю (полукруг, в углу — четверть), как при перетаскивании
    placeFree({
      fx: fr[h], fy: fr[v],
      dockX: h === 'left' ? 'l' : h === 'right' ? 'r' : null,
      dockY: v === 'top' ? 't' : v === 'bottom' ? 'b' : null,
    });
  }
  function setPosition(p) {
    if (!POSITIONS.includes(p)) return;
    pos = p;
    applyPosition();
  }
  function setMoveMode(on) {
    moving = !!on;
    handle.classList.toggle('moving', moving && pos === 'free');
  }
  setPosition(pos);
  setMoveMode(moving);
  window.addEventListener('resize', () => { updateSize(); applyPosition(); });

  // перетаскивание — только в режиме перемещения при «произвольном» положении
  let drag = null;
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !moving || pos !== 'free') return;
    e.stopPropagation();
    const r = handle.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag || !inside(e)) return; // события с соседнего монитора пропускаем
    drag.moved = true;
    const maxX = innerWidth - BTN, maxY = innerHeight - BTN;
    const rawX = clamp(e.clientX - drag.dx, 0, maxX);
    const rawY = clamp(e.clientY - drag.dy, 0, maxY);
    // стыковка по каждой оси отдельно: у края — к стороне, в углу — к обеим
    const dockX = rawX < SNAP ? 'l' : maxX - rawX < SNAP ? 'r' : null;
    const dockY = rawY < SNAP ? 't' : maxY - rawY < SNAP ? 'b' : null;
    const fx = (clamp(rawX, MARGIN, maxX - MARGIN) - MARGIN) / Math.max(1, innerWidth - 2 * MARGIN - BTN);
    const fy = (clamp(rawY, MARGIN, maxY - MARGIN) - MARGIN) / Math.max(1, innerHeight - 2 * MARGIN - BTN);
    drag.state = { fx, fy, dockX, dockY };
    placeFree(drag.state);
  }, true);
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    if (drag.moved && drag.state) saveFree(drag.state);
    drag = null;
  }, true);

  // клик мимо кольца (по затемнению) закрывает
  root.addEventListener('click', close);
  handle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (moving && pos === 'free') return; // в режиме перемещения кнопка не открывает меню
    toggle();
  });
  // мышь внутри меню не должна доходить ни до xterm, ни до привязок кнопок
  for (const type of ['mousedown', 'mouseup', 'pointerdown', 'contextmenu']) {
    root.addEventListener(type, (e) => { e.stopPropagation(); if (type === 'contextmenu') e.preventDefault(); });
  }
  document.addEventListener('keydown', (e) => { if (isOpen && e.key === 'Escape') { close(); e.stopPropagation(); } }, true);

  function setLanguage(lang) {
    tr = translator(LANGUAGES[lang] ? lang : DEFAULT_LANGUAGE);
    handle.title = tr('quickActions');
    if (isOpen) render(page); // открытое меню перерисуем сразу
  }

  function setSize(px) {
    fixedSize = Number(px) || 0;
    updateSize();
    applyPosition();
  }

  return { open, close, toggle, isOpen: () => isOpen, setPosition, setMoveMode, setLanguage, setSize, setOpacity: applyOpacity };
}

// Кнопка (хэндл) панели настроек: удержание → перетаскивание; при отпускании прилипает к ближайшему краю окна
// (но не к углу). Положение запоминается. Короткий клик по-прежнему открывает панель (обработчик у вызывающего).

export const HOLD_MS = 350;
export const CORNER_MARGIN = 32;   // отступ от угла вдоль края, px
const LONG = 44;                   // длинная сторона хэндла
const SHORT = 13;                  // короткая сторона (выступ у края)

// Куда прилипнуть: край и доля 0..1 вдоль свободного отрезка края (без угловых отступов).
export function snapToEdge(cx, cy, vw, vh, margin = CORNER_MARGIN) {
  const d = { left: cx, right: vw - cx, top: cy, bottom: vh - cy };
  const edge = Object.keys(d).reduce((a, b) => (d[a] <= d[b] ? a : b));
  const horizontal = edge === 'top' || edge === 'bottom';
  const length = horizontal ? vw : vh;
  const along = horizontal ? cx : cy;
  const free = Math.max(1, length - 2 * margin);
  const frac = Math.max(0, Math.min(1, (along - margin) / free));
  return { edge, frac };
}

// Размеры и позиция хэндла для (edge, frac) в окне vw×vh.
export function placement({ edge, frac }, vw, vh, margin = CORNER_MARGIN) {
  const horizontal = edge === 'top' || edge === 'bottom';
  const w = horizontal ? LONG : SHORT;
  const h = horizontal ? SHORT : LONG;
  const length = horizontal ? vw : vh;
  const start = margin + frac * Math.max(0, length - 2 * margin) - (horizontal ? w : h) / 2;
  const pos = { top: 'auto', right: 'auto', bottom: 'auto', left: 'auto' };
  if (edge === 'top') { pos.top = '0'; pos.left = `${start}px`; }
  if (edge === 'bottom') { pos.bottom = '0'; pos.left = `${start}px`; }
  if (edge === 'left') { pos.left = '0'; pos.top = `${start}px`; }
  if (edge === 'right') { pos.right = '0'; pos.top = `${start}px`; }
  const radius = { top: '0 0 9px 9px', bottom: '9px 9px 0 0', left: '0 9px 9px 0', right: '9px 0 0 9px' }[edge];
  return { w, h, pos, radius };
}

export function installHandleDrag(handle, { storageKey = 'webterm:handle', onPlaced } = {}) {
  let state = null;
  try { state = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { /* нет хранилища */ }
  const valid = (s) => s && ['top', 'bottom', 'left', 'right'].includes(s.edge) && s.frac >= 0 && s.frac <= 1;

  function apply(s) {
    const p = placement(s, window.innerWidth, window.innerHeight);
    handle.style.width = `${p.w}px`;
    handle.style.height = `${p.h}px`;
    handle.style.borderRadius = p.radius;
    Object.assign(handle.style, p.pos);
    handle.dataset.edge = s.edge;
    onPlaced?.(s);
  }
  if (valid(state)) apply(state);
  window.addEventListener('resize', () => { if (valid(state)) apply(state); });

  let timer = null;
  let drag = null;
  let suppressClick = false;

  // События слушаем на window: курсор во время перетаскивания уходит с хэндла, а capture не везде надёжен.
  function onMove(e) {
    if (!drag) return;
    handle.style.width = `${LONG}px`;
    handle.style.height = `${SHORT}px`;
    handle.style.borderRadius = '9px';
    Object.assign(handle.style, { top: `${e.clientY - SHORT / 2}px`, left: `${e.clientX - LONG / 2}px`, right: 'auto', bottom: 'auto' });
  }
  function stop() {
    clearTimeout(timer);
    window.removeEventListener('pointermove', onPointerMoveBeforeHold);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }
  let startPoint = null;
  function onPointerMoveBeforeHold(ev) {
    if (!drag && startPoint && Math.hypot(ev.clientX - startPoint.x, ev.clientY - startPoint.y) > 6) stop();   // обычный клик/жест
  }
  function onUp(e) {
    const wasDragging = !!drag;
    stop();
    if (!wasDragging) return;
    drag = null;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    handle.classList.remove('dragging');
    state = snapToEdge(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
    apply(state);
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* ignore */ }
  }

  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    stop();
    startPoint = { x: e.clientX, y: e.clientY };
    window.addEventListener('pointermove', onPointerMoveBeforeHold);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    timer = setTimeout(() => {
      drag = { pointer: e.pointerId };
      handle.classList.add('dragging');
      window.removeEventListener('pointermove', onPointerMoveBeforeHold);
      window.addEventListener('pointermove', onMove);
      onMove(e);
    }, HOLD_MS);
  });

  // клик после перетаскивания не должен открывать панель
  handle.addEventListener('click', (e) => { if (suppressClick) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}

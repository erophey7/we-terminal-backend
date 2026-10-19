// Привязка кнопок мыши (средняя/правая/боковые) и колеса к действиям из
// actions.js. Левая кнопка не трогается.
//
// Одна из кнопок может быть назначена «модификатором» (modButton): пока она
// зажата, остальные кнопки берут действие из варианта *Mod, а колесо
// выполняет wheelMod (например размер шрифта). Модификатор можно отследить
// надёжно — mousedown/mouseup приходят парой (проверено в WE-зонде).
//
// События слушаются на document в capture-фазе: привязанная кнопка
// "съедается" (xterm и приложения с mouse reporting её не увидят),
// непривязанная проходит как обычно.

import { ACTION_BY_ID, BINDABLE_BUTTONS, NONE, WHEEL_MOD_ACTIONS } from './actions.js';

const BY_BUTTON = Object.fromEntries(BINDABLE_BUTTONS.map((b) => [b.button, b]));
const WHEEL_MOD_BY_ID = Object.fromEntries(WHEEL_MOD_ACTIONS.map((a) => [a.id, a]));
// Кнопка 2 (правая) срабатывает на contextmenu — к этому моменту выделение
// ещё не сброшено; остальные — сразу на mousedown.
const TRIGGER = { 1: 'mousedown', 2: 'contextmenu', 3: 'mousedown', 4: 'mousedown' };

export function installBindings({ api, getBindings, readonly = false }) {
  const held = new Set();        // зажатые сейчас кнопки
  const swallowed = new Set();   // кнопки, чей mousedown мы съели → съедаем и mouseup/auxclick

  const modName = () => getBindings().modButton || NONE;
  const modHeld = () => {
    const m = BINDABLE_BUTTONS.find((b) => b.name === modName());
    return !!m && held.has(m.button);
  };

  function resolve(button) {
    const info = BY_BUTTON[button];
    if (!info) return null;
    if (info.name === modName()) return { info, id: NONE, isMod: true };
    const b = getBindings();
    const id = modHeld() ? b[info.name + 'Mod'] : b[info.name];
    return { info, id: id || NONE, isMod: false };
  }

  function run(id) {
    const action = ACTION_BY_ID[id];
    if (!action || id === NONE) return false;
    try { action.run(api); } catch (e) { console.warn('action failed:', id, e); }
    return true;
  }

  function onDown(e) {
    held.add(e.button);
    const r = resolve(e.button);
    if (!r) return;
    if (r.isMod) { e.preventDefault(); e.stopPropagation(); swallowed.add(e.button); return; }
    if (r.id === NONE) return;
    e.preventDefault();
    e.stopPropagation();
    swallowed.add(e.button);
    if (TRIGGER[e.button] === 'mousedown' && !readonly) run(r.id);
  }

  function onUp(e) {
    held.delete(e.button);
    if (!swallowed.has(e.button)) return;
    e.preventDefault();
    e.stopPropagation();
    // auxclick/contextmenu приходят следом в том же такте — снимаем отметку позже
    const b = e.button;
    setTimeout(() => swallowed.delete(b), 0);
  }

  function onAux(e) {
    if (swallowed.has(e.button)) { e.preventDefault(); e.stopPropagation(); }
  }

  function onContext(e) {
    e.preventDefault();                       // нативное меню в обоях не нужно
    const r = resolve(2);
    if (!r || r.id === NONE || r.isMod) return;
    e.stopPropagation();
    if (!readonly) run(r.id);
  }

  function onWheel(e) {
    if (!modHeld()) return;
    const mode = WHEEL_MOD_BY_ID[getBindings().wheelMod];
    if (!mode || mode.id === NONE) return;
    e.preventDefault();
    e.stopPropagation();
    if (readonly && mode.id !== 'scrollPage') return;
    mode.run(api, Math.sign(e.deltaY));
  }

  const opts = { capture: true };
  document.addEventListener('mousedown', onDown, opts);
  document.addEventListener('mouseup', onUp, opts);
  document.addEventListener('auxclick', onAux, opts);
  document.addEventListener('contextmenu', onContext, opts);
  document.addEventListener('wheel', onWheel, { capture: true, passive: false });
  const reset = () => { held.clear(); swallowed.clear(); };
  window.addEventListener('blur', reset);

  return {
    dispose() {
      document.removeEventListener('mousedown', onDown, opts);
      document.removeEventListener('mouseup', onUp, opts);
      document.removeEventListener('auxclick', onAux, opts);
      document.removeEventListener('contextmenu', onContext, opts);
      document.removeEventListener('wheel', onWheel, opts);
      window.removeEventListener('blur', reset);
    },
  };
}

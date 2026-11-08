// Буква сочетания клавиш не зависит от раскладки: при русской (и любой нелатинской) раскладке e.key — «с», «м», «а»,
// а не c, v, f, и Ctrl+C не копировал. Берём e.key, если это латинская буква (Dvorak/Colemak остаются как есть),
// иначе — физическую клавишу e.code (KeyC -> 'c').
export function hotkeyLetter(e) {
  if (/^[a-z]$/i.test(e.key)) return e.key.toLowerCase();
  return /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : String(e.key).toLowerCase();
}

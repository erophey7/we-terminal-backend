// Реестр встроенных действий терминала — единый список, к которому
// привязываются кнопки мыши (bindings.js), а потом экранная клавиатура/меню.
//
// Файл — чистые данные + функции без обращения к DOM на верхнем уровне:
// его импортирует и tools/gen-we-project.mjs (в Node), чтобы собрать
// список для выпадающих списков в project.json Wallpaper Engine.
//
// run(api): api собирает main.js (см. buildActionApi):
//   term, settings, send(text), copy(), paste(), themes[], setTheme(), setFontSize(),
//   setOpacity(), reconnect(), toggleDrawer(), snippet(n)

export const NONE = 'none';

// Не просто строки: порядок и группы идут в выпадающие списки как есть.
export const ACTIONS = [
  { id: NONE, label: '— ничего —', group: 'Без действия', run: () => {} },

  // Буфер обмена
  { id: 'smart', label: 'Копировать выделенное, иначе вставить', group: 'Буфер обмена', run: (a) => a.smartCopyPaste() },
  { id: 'copy', label: 'Копировать выделенное', group: 'Буфер обмена', run: (a) => a.copy() },
  { id: 'paste', label: 'Вставить', group: 'Буфер обмена', run: (a) => a.paste() },
  { id: 'selectAll', label: 'Выделить всё', group: 'Буфер обмена', run: (a) => a.term.selectAll() },
  { id: 'clearSelection', label: 'Снять выделение', group: 'Буфер обмена', run: (a) => a.term.clearSelection() },

  // Прокрутка
  { id: 'scrollPageUp', label: 'Прокрутка: страница вверх', group: 'Прокрутка', run: (a) => a.term.scrollPages(-1) },
  { id: 'scrollPageDown', label: 'Прокрутка: страница вниз', group: 'Прокрутка', run: (a) => a.term.scrollPages(1) },
  { id: 'scrollTop', label: 'Прокрутка: в начало', group: 'Прокрутка', run: (a) => a.term.scrollToTop() },
  { id: 'scrollBottom', label: 'Прокрутка: в конец', group: 'Прокрутка', run: (a) => a.term.scrollToBottom() },

  // Вид
  { id: 'fontPlus', label: 'Шрифт крупнее', group: 'Вид', run: (a) => a.setFontSize(a.settings.fontSize + 1) },
  { id: 'fontMinus', label: 'Шрифт мельче', group: 'Вид', run: (a) => a.setFontSize(a.settings.fontSize - 1) },
  { id: 'fontReset', label: 'Размер шрифта по умолчанию', group: 'Вид', run: (a) => a.setFontSize(a.defaultFontSize) },
  { id: 'opacityPlus', label: 'Прозрачность фона +10', group: 'Вид', run: (a) => a.setOpacity(a.settings.opacity + 10) },
  { id: 'opacityMinus', label: 'Прозрачность фона −10', group: 'Вид', run: (a) => a.setOpacity(a.settings.opacity - 10) },
  { id: 'themeNext', label: 'Следующая тема', group: 'Вид', run: (a) => a.cycleTheme(1) },
  { id: 'themePrev', label: 'Предыдущая тема', group: 'Вид', run: (a) => a.cycleTheme(-1) },
  { id: 'toggleKeyboard', label: 'Показать/скрыть виртуальную клавиатуру', group: 'Вид', run: (a) => a.toggleKeyboard() },
  { id: 'toggleMenu', label: 'Показать/скрыть радиальное меню', group: 'Вид', run: (a) => a.toggleMenu() },
  { id: 'toggleDrawer', label: 'Показать/скрыть панель настроек и поиска', group: 'Вид', run: (a) => a.toggleDrawer() },

  // Терминал
  { id: 'clear', label: 'Очистить экран и scrollback', group: 'Терминал', run: (a) => a.term.clear() },
  { id: 'reset', label: 'Сбросить терминал (reset)', group: 'Терминал', run: (a) => a.term.reset() },
  { id: 'reconnect', label: 'Переподключиться', group: 'Терминал', run: (a) => a.reconnect() },

  // Отправка в процесс
  { id: 'sendCtrlC', label: 'Отправить Ctrl+C (прервать)', group: 'Отправка', run: (a) => a.send('\x03') },
  { id: 'sendCtrlD', label: 'Отправить Ctrl+D (EOF)', group: 'Отправка', run: (a) => a.send('\x04') },
  { id: 'sendCtrlZ', label: 'Отправить Ctrl+Z (в фон)', group: 'Отправка', run: (a) => a.send('\x1a') },
  { id: 'sendCtrlL', label: 'Отправить Ctrl+L (перерисовать)', group: 'Отправка', run: (a) => a.send('\x0c') },
  { id: 'sendEsc', label: 'Отправить Esc', group: 'Отправка', run: (a) => a.send('\x1b') },
  { id: 'sendTab', label: 'Отправить Tab', group: 'Отправка', run: (a) => a.send('\t') },
  { id: 'sendEnter', label: 'Отправить Enter', group: 'Отправка', run: (a) => a.send('\r') },
  { id: 'sendUp', label: 'Отправить ↑ (история)', group: 'Отправка', run: (a) => a.sendCursorKey('A') },
  { id: 'sendDown', label: 'Отправить ↓', group: 'Отправка', run: (a) => a.sendCursorKey('B') },
  { id: 'snippet1', label: 'Отправить сниппет 1', group: 'Сниппеты', run: (a) => a.snippet(1) },
  { id: 'snippet2', label: 'Отправить сниппет 2', group: 'Сниппеты', run: (a) => a.snippet(2) },
  { id: 'snippet3', label: 'Отправить сниппет 3', group: 'Сниппеты', run: (a) => a.snippet(3) },
];

export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

// Что делает колесо, пока зажата кнопка-модификатор (аналог Ctrl+колесо).
// direction: -1 — колесо вверх (от себя), 1 — вниз.
export const WHEEL_MOD_ACTIONS = [
  { id: NONE, label: '— обычная прокрутка —', run: () => {} },
  { id: 'fontSize', label: 'Размер шрифта', run: (a, dir) => a.setFontSize(a.settings.fontSize - dir) },
  { id: 'opacity', label: 'Прозрачность фона', run: (a, dir) => a.setOpacity(a.settings.opacity - dir * 5) },
  { id: 'theme', label: 'Смена темы', run: (a, dir) => a.cycleTheme(dir) },
  { id: 'scrollPage', label: 'Прокрутка страницами', run: (a, dir) => a.term.scrollPages(dir) },
];

// Кнопки мыши, которые можно привязывать. Левая не привязывается —
// она нужна для выделения и кликов внутри приложений (mouse reporting).
export const BINDABLE_BUTTONS = [
  { name: 'middle', button: 1, label: 'Средняя кнопка (колесо)', def: 'paste' },
  { name: 'right', button: 2, label: 'Правая кнопка', def: 'smart' },
  { name: 'back', button: 3, label: 'Боковая «назад»', def: NONE },
  { name: 'forward', button: 4, label: 'Боковая «вперёд»', def: NONE },
];

// Какая кнопка работает как «модификатор» (зажать и действовать другим
// кнопками/колесом). Значения — name из BINDABLE_BUTTONS или none.
export const DEFAULT_BINDINGS = {
  modButton: NONE,
  wheelMod: NONE,
  snippets: ['', '', ''],
  ...Object.fromEntries(BINDABLE_BUTTONS.flatMap((b) => [[b.name, b.def], [b.name + 'Mod', NONE]])),
};

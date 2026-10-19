// Строки интерфейса, которые видит пользователь поверх терминала (радиальное меню).
// Язык выбирается настройкой menuLang (WE: свойство menulang, URL: ?menulang=ru);
// по умолчанию — английский. Чтобы добавить язык: добавить запись в MESSAGES (все
// ключи как у 'en'; отсутствующие берутся из английского) и в LANGUAGES, а в
// wallpaper-engine/project.json — вариант в свойство menulang.

export const DEFAULT_LANGUAGE = 'en';

export const LANGUAGES = { en: 'English', ru: 'Русский' };

export const MESSAGES = {
  en: {
    quickActions: 'Quick actions',
    closeHint: 'close ×',
    openHint: 'open',
    pageView: 'View',
    pageKeys: 'Keys',
    copy: 'Copy',
    paste: 'Paste',
    keyboard: 'Keyboard',
    clear: 'Clear',
    interrupt: 'Interrupt ^C',
    up: 'Up',
    down: 'Down',
    selectAll: 'Select all',
    fontPlus: 'Font +',
    fontMinus: 'Font −',
    theme: 'Theme',
    opacityPlus: 'Denser bg',
    opacityMinus: 'Fainter bg',
    toBottom: 'To bottom',
    reconnect: 'Reconnect',
    historyUp: 'History ↑',
    historyDown: 'History ↓',
    back: 'Back',
  },
  ru: {
    quickActions: 'Быстрые действия',
    closeHint: 'закрыть ×',
    openHint: 'открыть',
    pageView: 'Вид',
    pageKeys: 'Клавиши',
    copy: 'Копировать',
    paste: 'Вставить',
    keyboard: 'Клавиатура',
    clear: 'Очистить',
    interrupt: 'Прервать ^C',
    up: 'Вверх',
    down: 'Вниз',
    selectAll: 'Выделить всё',
    fontPlus: 'Шрифт +',
    fontMinus: 'Шрифт −',
    theme: 'Тема',
    opacityPlus: 'Фон плотнее',
    opacityMinus: 'Фон прозрачнее',
    toBottom: 'В конец',
    reconnect: 'Переподкл.',
    historyUp: 'История ↑',
    historyDown: 'История ↓',
    back: 'Назад',
  },
};

// Возвращает функция-переводчик для языка; неизвестный язык/ключ → английский → сам ключ.
export function translator(lang) {
  const table = MESSAGES[lang] ?? MESSAGES[DEFAULT_LANGUAGE];
  return (key) => table[key] ?? MESSAGES[DEFAULT_LANGUAGE][key] ?? key;
}

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
    statusTitle: 'No connection to the backend',
    statusTrying: 'Trying to reach',
    statusHintStart: 'Start the webterm backend on that machine.',
    statusHintAddress: 'Check the address and the token in the wallpaper settings.',
    statusHintOrigin: 'Allow this page in the backend config: `allowed_origins: ["file://"]` (plus a token).',
    statusHintLog: 'The backend log tells why a connection was refused (token, origin, IP list).',
    statusRetry: 'Retrying automatically...',
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
    statusTitle: 'Нет связи с бэкендом',
    statusTrying: 'Пытаюсь подключиться к',
    statusHintStart: 'Запустите бэкенд webterm на этой машине.',
    statusHintAddress: 'Проверьте адрес и токен в настройках обоев.',
    statusHintOrigin: 'Разрешите эту страницу в конфиге бэкенда: `allowed_origins: ["file://"]` (и задайте токен).',
    statusHintLog: 'Причина отказа видна в логе бэкенда (токен, origin, список IP).',
    statusRetry: 'Повторяю попытки автоматически...',
  },
};

// Возвращает функция-переводчик для языка; неизвестный язык/ключ → английский → сам ключ.
export function translator(lang) {
  const table = MESSAGES[lang] ?? MESSAGES[DEFAULT_LANGUAGE];
  return (key) => table[key] ?? MESSAGES[DEFAULT_LANGUAGE][key] ?? key;
}

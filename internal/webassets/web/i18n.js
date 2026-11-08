// Строки интерфейса, которые видит пользователь поверх терминала (радиальное меню).
// Язык выбирается настройкой menuLang (WE: свойство menulang, URL: ?menulang=ru);
// по умолчанию — английский. Чтобы добавить язык: добавить запись в MESSAGES (все
// ключи как у 'en'; отсутствующие берутся из английского) и в LANGUAGES, а в
// wallpaper-engine/project.json — вариант в свойство menulang.

import ar from './lang/ar.js';
import bg from './lang/bg.js';
import ca from './lang/ca.js';
import cs from './lang/cs.js';
import da from './lang/da.js';
import de from './lang/de.js';
import es from './lang/es.js';
import eu from './lang/eu.js';
import fa from './lang/fa.js';
import fr from './lang/fr.js';
import he from './lang/he.js';
import hr from './lang/hr.js';
import it from './lang/it.js';
import ja from './lang/ja.js';
import ka from './lang/ka.js';
import ko from './lang/ko.js';
import nb from './lang/nb.js';
import nl from './lang/nl.js';
import nn from './lang/nn.js';
import pl from './lang/pl.js';
import pt_BR from './lang/pt_BR.js';
import sl from './lang/sl.js';
import sv from './lang/sv.js';
import tr from './lang/tr.js';
import ukr from './lang/ukr.js';
import zh_CN from './lang/zh_CN.js';
import zh_TW from './lang/zh_TW.js';

export const DEFAULT_LANGUAGE = 'en';

export const LANGUAGES = {
  en: 'English',
  ru: 'Русский',
  ar: "العربية",
  bg: "Български",
  ca: "Català",
  cs: "Čeština",
  da: "Dansk",
  de: "Deutsch",
  es: "Español",
  eu: "Euskara",
  fa: "فارسی",
  fr: "Français",
  he: "עברית",
  hr: "Hrvatski",
  it: "Italiano",
  ja: "日本語",
  ka: "ქართული",
  ko: "한국어",
  nb: "Norsk bokmål",
  nl: "Nederlands",
  nn: "Nynorsk",
  pl: "Polski",
  pt_BR: "Português (Brasil)",
  sl: "Slovenščina",
  sv: "Svenska",
  tr: "Türkçe",
  ukr: "Українська",
  zh_CN: "中文（简体）",
  zh_TW: "中文（繁體）",
};

// Коды языков — те же, что у Proxmox VE (Proxmox.Utils.language_map), чтобы консоль PVE брала язык из PVE.
// Языки справа налево: панель настроек зеркалится.
export const RTL_LANGUAGES = new Set(['ar', 'fa', 'he']);

export const MESSAGES = {
  ar,
  bg,
  ca,
  cs,
  da,
  de,
  es,
  eu,
  fa,
  fr,
  he,
  hr,
  it,
  ja,
  ka,
  ko,
  nb,
  nl,
  nn,
  pl,
  pt_BR,
  sl,
  sv,
  tr,
  ukr,
  zh_CN,
  zh_TW,

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
    resetPreferences: 'Reset saved settings',
    resetPreferencesConfirm: 'Clear saved appearance overrides and return to host settings?',
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
    settings: 'Settings',
    drawerConnecting: 'connecting…',
    drawerOnline: 'connected',
    drawerOffline: 'connection lost — reconnecting…',
    dTheme: 'Theme',
    dFont: 'Font',
    dFontSize: 'Font size',
    dOpacity: 'Transparency',
    dCursor: 'Cursor',
    cursorBar: 'bar',
    cursorBlock: 'block',
    cursorUnderline: 'underline',
    nerdIcons: 'Nerd Font icons',
    textContrast: 'Text contrast',
    contrastOff: 'Off (exact app colors)',
    contrastLow: 'Low (3:1)',
    contrastNormal: 'Normal (4.5:1)',
    contrastHigh: 'High (7:1)',
    themeImport: 'Import',
    themeExport: 'Export',
    themeDelete: 'Delete',
    themeImportTitle: 'Import a theme from a JSON file',
    themeExportTitle: 'Download the selected theme as JSON',
    themeDeleteTitle: 'Delete the selected custom theme',
    themeImported: 'imported',
    themeCustom: 'custom',
    copyPasteTitle: 'Copy & paste',
    fAutoCopy: 'Copy on selection',
    fCopyCtrlC: 'Ctrl+C copies the selection',
    fCopyCtrlShiftC: 'Ctrl+Shift+C copies',
    fPasteCtrlV: 'Ctrl+V pastes',
    fPasteCtrlShiftV: 'Ctrl+Shift+V pastes',
    fRightCopy: 'Right click copies the selection',
    fRightPaste: 'Right click pastes (nothing selected)',
    fBracketed: 'Bracketed paste (shell sees a paste)',
    searchPlaceholder: 'Search the buffer… (Ctrl+F)',
    searchPrev: 'Previous (Shift+Enter)',
    searchNext: 'Next (Enter)',
    bgTitle: 'Background image',
    bgChoose: 'Choose…',
    bgChooseTitle: 'Pick an image file (stored in this browser)',
    bgRemove: 'Remove',
    bgRemoveTitle: 'Remove the background image',
    bgOpacity: 'Image opacity',
    bgBlur: 'Image blur',
    bgTermOpacity: 'Terminal opacity',
    pveSessionFailed: 'Could not verify the PVE session: {0}',
    pveSignIn: 'Sign in to Proxmox VE first, then reopen this console.',
    pveOpen: 'Open PVE',
    pveGuestIs: 'Guest is {0}.',
    pveStartNow: 'Start now',
    pveStarting: 'Starting…',
    pveStartFailed: 'Start failed: {0}',
    pveStatusFailed: 'Could not read guest status: {0}',
    pveSizeRetry: 'Guest terminal size is not synced ({0}; will retry when the window size changes). Run "stty rows R cols C" in the guest, or see the docs.',
    pveSizeOff: 'Guest terminal size is not synced ({0}; turned off). Run "stty rows R cols C" in the guest, or see the docs.',
    pveConnecting: 'Connecting…',
    pveConnFailed: 'Connection failed: {0}',
    pveRetry: 'Retry',
    pveDisconnected: 'Disconnected.',
    pveReconnect: 'Reconnect',
    pveSerialShared: '{0} is already open in another console: both windows share this session.',
    pveError: 'Error: {0}',
    pveProxyExpired: 'The answer did not come from Proxmox VE (the sign-in of a reverse proxy or the session expired). Reload the page and sign in again.',
    pveReload: 'Reload',
    pveWsRefused: 'The WebSocket connection was refused although the API answers. Behind a reverse proxy, /vncwebsocket needs the Upgrade and Connection headers passed on and an idle timeout of at least 60 s (see the docs).',
    pveSerialLabel: 'Port',
    pvePortsTitle: 'Ports',
    pvePortSlots: 'Keys in the quick layout',
    pveSerialAuto: 'Automatic',
    pveSerialBusy: 'in use',
    pveVirtioFirst: 'Virtio (hvc) ports first',
    pvePortKeys: 'Switch with Ctrl+Alt+1–0',
    pvePortSwitched: 'Port: {0}',
    pvePortNone: 'There is no port {0}',
    pveNoLogin: 'No login prompt on {0} in the guest. To get one, run this in the guest: {1}',
    pveNoLoginNoHint: 'No login prompt on {0} in the guest: start a getty on it in the init system of the guest.',
    pveCopyCommand: 'Copy command',
    pveCtTitle: 'Container',
    pveCtLogin: 'Login with xterm-256color (Braille, colours); off: the tty1 console',
    pveHelperAsk: 'The guest has no stty, so the window size cannot follow this window. A small helper (about 9 KB) can be written to the guest (/run, removed when you close the console).',
    pveHelperDeliver: 'Deliver the helper',
    pveUartImages: 'Images over {0} are very slow (115200 baud) and can stall the guest. Use an hvc port for images.',
    pveHelperPixelsAsk: 'Images (kitten icat, chafa) need the window size in pixels, which the guest cannot get without a helper. A small helper (about 9 KB) can be written to the guest (/run, removed when you close the console). Your answer is remembered for this VM.',
    agentSearching: 'Looking for the PVE Terminal Agent on this computer…',
    agentNotFoundTitle: 'PVE Terminal Agent not found',
    agentNotFoundText: 'System terminal opens a terminal on this computer through a small local agent. Run it once, or install it (no administrator rights needed).',
    agentDownload: 'Download for {0}',
    agentNoDownloads: 'No agent files are published on this Proxmox VE node. Ask your administrator or get the agent from the project releases.',
    agentHowTo: 'Unpack the archive and run pve-terminal-agent (double-click, or "pve-terminal-agent install" to start it at every login).',
    agentStartInstalled: 'Start the installed agent',
    agentWaiting: 'Waiting for the agent… this page connects by itself.',
    agentConfirm: 'Confirm this server in the PVE Terminal Agent window (a browser tab opened on this computer).',
    agentConfirmOpen: 'Open the window',
    agentVerifying: 'Checking your Proxmox VE session…',
    agentFailed: 'The agent refused: {0}',
    agentOutdated: 'This computer runs agent {0}; this Proxmox VE offers {1}. Update when convenient.',
    agentUpdateGet: 'Download',
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
    resetPreferences: 'Сбросить сохранённые настройки',
    resetPreferencesConfirm: 'Удалить сохранённые переопределения вида и вернуть настройки хоста?',
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
    settings: 'Настройки',
    drawerConnecting: 'подключение…',
    drawerOnline: 'подключено',
    drawerOffline: 'соединение потеряно — переподключение…',
    dTheme: 'Тема',
    dFont: 'Гарнитура',
    dFontSize: 'Размер шрифта',
    dOpacity: 'Прозрачность',
    dCursor: 'Курсор',
    cursorBar: 'палочка',
    cursorBlock: 'блок',
    cursorUnderline: 'подчёркивание',
    nerdIcons: 'Иконки Nerd Font',
    textContrast: 'Контраст текста',
    contrastOff: 'Выкл. (точные цвета программы)',
    contrastLow: 'Низкий (3:1)',
    contrastNormal: 'Обычный (4.5:1)',
    contrastHigh: 'Высокий (7:1)',
    themeImport: 'Импорт',
    themeExport: 'Экспорт',
    themeDelete: 'Удалить',
    themeImportTitle: 'Импортировать тему из JSON-файла',
    themeExportTitle: 'Скачать выбранную тему в JSON',
    themeDeleteTitle: 'Удалить выбранную свою тему',
    themeImported: 'импортировано',
    themeCustom: 'своя',
    copyPasteTitle: 'Копирование и вставка',
    fAutoCopy: 'Копировать при выделении',
    fCopyCtrlC: 'Ctrl+C копирует выделенное',
    fCopyCtrlShiftC: 'Ctrl+Shift+C копирует',
    fPasteCtrlV: 'Ctrl+V вставляет',
    fPasteCtrlShiftV: 'Ctrl+Shift+V вставляет',
    fRightCopy: 'ПКМ копирует выделенное',
    fRightPaste: 'ПКМ вставляет (если нет выделения)',
    fBracketed: 'Bracketed paste (оболочка видит вставку)',
    searchPlaceholder: 'Поиск по буферу… (Ctrl+F)',
    searchPrev: 'Предыдущее (Shift+Enter)',
    searchNext: 'Следующее (Enter)',
    bgTitle: 'Фоновая картинка',
    bgChoose: 'Выбрать…',
    bgChooseTitle: 'Выбрать файл картинки (хранится в этом браузере)',
    bgRemove: 'Убрать',
    bgRemoveTitle: 'Убрать фоновую картинку',
    bgOpacity: 'Прозрачность картинки',
    bgBlur: 'Размытие картинки',
    bgTermOpacity: 'Прозрачность терминала',
    pveSessionFailed: 'Не удалось проверить сессию PVE: {0}',
    pveSignIn: 'Сначала войдите в Proxmox VE, затем откройте консоль снова.',
    pveOpen: 'Открыть PVE',
    pveGuestIs: 'Гость: {0}.',
    pveStartNow: 'Запустить',
    pveStarting: 'Запуск…',
    pveStartFailed: 'Не удалось запустить: {0}',
    pveStatusFailed: 'Не удалось получить состояние гостя: {0}',
    pveSizeRetry: 'Размер терминала гостя не синхронизируется ({0}; повтор при смене размера окна). Выполните в госте «stty rows R cols C» или см. документацию.',
    pveSizeOff: 'Размер терминала гостя не синхронизируется ({0}; отключено). Выполните в госте «stty rows R cols C» или см. документацию.',
    pveConnecting: 'Подключение…',
    pveConnFailed: 'Не удалось подключиться: {0}',
    pveRetry: 'Повторить',
    pveDisconnected: 'Отключено.',
    pveReconnect: 'Переподключиться',
    pveSerialShared: '{0} уже открыт в другой консоли: оба окна работают в общей сессии.',
    pveError: 'Ошибка: {0}',
    pveProxyExpired: 'Ответ пришёл не от Proxmox VE (вход на reverse proxy или сеанс истёк). Обновите страницу и войдите заново.',
    pveReload: 'Обновить',
    pveWsRefused: 'Соединение WebSocket отклонено, хотя API отвечает. За reverse proxy для /vncwebsocket нужны заголовки Upgrade и Connection и таймаут простоя не менее 60 с (см. документацию).',
    pveSerialLabel: 'Порт',
    pvePortsTitle: 'Порты',
    pvePortSlots: 'Клавиш в быстрой раскладке',
    pveSerialAuto: 'Автоматически',
    pveSerialBusy: 'занят',
    pveVirtioFirst: 'Сначала virtio-порты (hvc)',
    pvePortKeys: 'Переключение Ctrl+Alt+1–0',
    pvePortSwitched: 'Порт: {0}',
    pvePortNone: 'Порта {0} нет',
    pveNoLogin: 'В госте на {0} нет приглашения входа. Чтобы оно появилось, выполните в госте: {1}',
    pveNoLoginNoHint: 'В госте на {0} нет приглашения входа: запустите на нём getty средствами init гостя.',
    pveCopyCommand: 'Скопировать команду',
    pveCtTitle: 'Контейнер',
    pveCtLogin: 'Вход с xterm-256color (Braille, цвета); выкл. — консоль tty1',
    pveHelperAsk: 'В госте нет stty, поэтому размер окна не следует за этим окном. В гостя можно записать крошечного помощника (около 9 КБ; /run, удаляется при закрытии консоли).',
    pveHelperDeliver: 'Доставить помощника',
    pveUartImages: 'Картинки через {0} очень медленные (115200 бод) и могут подвесить гостя. Для картинок используйте порт hvc.',
    pveHelperPixelsAsk: 'Картинкам (kitten icat, chafa) нужен размер окна в пикселях, а гость без помощника его не получит. В гостя можно записать крошечного помощника (около 9 КБ; /run, удаляется при закрытии консоли). Ответ запоминается для этой VM.',
    agentSearching: 'Поиск PVE Terminal Agent на этом компьютере…',
    agentNotFoundTitle: 'PVE Terminal Agent не найден',
    agentNotFoundText: 'System terminal открывает терминал на этом компьютере через небольшой локальный агент. Запустите его один раз или установите (права администратора не нужны).',
    agentDownload: 'Скачать для {0}',
    agentNoDownloads: 'На этом узле Proxmox VE нет файлов агента. Спросите администратора или возьмите агент из релизов проекта.',
    agentHowTo: 'Распакуйте архив и запустите pve-terminal-agent (двойной щелчок; «pve-terminal-agent install» — запускать при каждом входе).',
    agentStartInstalled: 'Запустить установленный агент',
    agentWaiting: 'Ожидание агента… страница подключится сама.',
    agentConfirm: 'Подтвердите этот сервер в окне PVE Terminal Agent (на этом компьютере открылась вкладка браузера).',
    agentConfirmOpen: 'Открыть окно',
    agentVerifying: 'Проверка сеанса Proxmox VE…',
    agentFailed: 'Агент отказал: {0}',
    agentOutdated: 'На этом компьютере агент {0}; этот Proxmox VE предлагает {1}. Обновите, когда удобно.',
    agentUpdateGet: 'Скачать',
  },
};

// Возвращает функция-переводчик для языка; неизвестный язык/ключ → английский → сам ключ.
// Подстановка {0}, {1}… из аргументов.
const format = (text, args) => (args.length ? text.replace(/\{(\d+)\}/g, (m, i) => (args[i] !== undefined ? String(args[i]) : m)) : text);

export function translator(lang) {
  const table = MESSAGES[lang] ?? MESSAGES[DEFAULT_LANGUAGE];
  return (key, ...args) => format(table[key] ?? MESSAGES[DEFAULT_LANGUAGE][key] ?? key, args);
}

// Код языка из PVE (cookie PVELangCookie, Proxmox.defaultLang), BCP 47 браузера или нашего URL -> наш код или null.
export function resolveLanguage(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const code = raw.trim().replace(/-/g, '_');
  if (!code || code === '__default__') return null;
  if (LANGUAGES[code]) return code;
  const lower = code.toLowerCase();
  if (/^zh(_|$)/.test(lower)) return /(^|_)(hant|tw|hk|mo)(_|$)/.test(lower) ? 'zh_TW' : 'zh_CN';   // китайский: по письму/региону
  const alias = {
    kr: 'ko', uk: 'ukr', no: 'nb', pt: 'pt_BR', pt_br: 'pt_BR', zh: 'zh_CN', zh_cn: 'zh_CN', zh_hans: 'zh_CN', zh_sg: 'zh_CN',
    zh_tw: 'zh_TW', zh_hant: 'zh_TW', zh_hk: 'zh_TW', zh_mo: 'zh_TW', nb_no: 'nb', nn_no: 'nn', iw: 'he',
  }[lower];
  if (alias) return alias;
  const primary = lower.split('_')[0];
  if (LANGUAGES[primary]) return primary;
  return { kr: 'ko', uk: 'ukr', no: 'nb', pt: 'pt_BR', zh: 'zh_CN', iw: 'he' }[primary] ?? null;
}

// Значение атрибута lang для HTML (BCP 47): у PVE `ukr`, `pt_BR`, `zh_CN` — нестандартные написания. Нужен браузеру
// для переносов и регистра (turkish İ/ı при text-transform: uppercase) и выбора шрифта для CJK.
export function htmlLang(code) {
  return code === 'ukr' ? 'uk' : String(code).replace('_', '-');
}

// Мост между панелью свойств Wallpaper Engine и startWebterm().
// index.html выставляет window.__WE_MANAGED = true ДО загрузки этого
// модуля (в inline-скрипте, чтобы успеть раньше main.js), так что
// main.js сам себя не запускает — старт делаем мы, когда (и если)
// придут свойства из WE.
import { startWebterm } from './main.js';

// Включённые раскладки: свойства kb_<код> (bool). Порядок — как в kblayouts.js.
const KB_CODES = ['en', 'ru', 'uk', 'de', 'fr', 'es', 'it', 'tr'];
function kbLayoutsFromProps(props) {
  const on = KB_CODES.filter((c) => props[`kb_${c}`]?.value === true || (props[`kb_${c}`] === undefined && (c === 'en' || c === 'ru')));
  return on.length ? on : ['en'];
}

function cfgFromProps(props) {
  return {
    wsUrl: props.wsurl?.value || 'ws://localhost:3000/pty',
    token: props.token?.value || '',
    enableWebgl: !!props.advancedgraphics?.value,
    enableImages: !!props.advancedgraphics?.value,
    theme: props.theme?.value || 'nebula',
    fontFamily: props.fontfamily?.value || 'jetbrains',
    fontSize: Number(props.fontsize?.value) || 14,
    opacity: props.opacity?.value !== undefined ? Number(props.opacity.value) : 72,
    cursorStyle: props.cursorstyle?.value || 'bar',
    readonly: !!props.readonly?.value,
    // Настройки живут в панели свойств WE — своя панель внутри обоев не нужна.
    showUI: false,
    handleAutoHide: true,
    autoCopySelection: props.autocopyselection?.value !== false,
    keyboardEnabled: props.keyboard?.value !== false,
    kbLayouts: kbLayoutsFromProps(props),
    menuLang: props.menulang?.value || 'en',
    menuSize: Number(props.menusize?.value) || 0,
    menuOpacity: props.menuopacity?.value !== undefined ? Number(props.menuopacity.value) : 78,
    menuPos: props.menupos?.value || 'top-right', // снизу кнопку закрывает панель задач Windows
    menuMove: !!props.menumove?.value,
  };
}

// Поля, смена которых требует настоящего перезапуска (новое соединение,
// другой рендерер и т.п.) — для них делаем полную перезагрузку страницы.
// Остальное (тема/шрифт/размер/прозрачность/курсор) — косметика,
// применяется на лету через updateConfig(), без пересоздания
// терминала/WebGL/транспорта. Это важно именно в WE: лишние
// пересоздания WebGL-контекста/WASM на входящем от CEF странном
// рендерере — вероятный источник крашей (STATUS_ILLEGAL_INSTRUCTION).
const STRUCTURAL_KEYS = ['wsUrl', 'token', 'enableWebgl', 'enableImages', 'readonly', 'showUI', 'keyboardEnabled'];

let webterm = null;
let lastCfg = null;
// WE присылает в applyUserProperties полный набор только в первый раз, дальше —
// только изменённые свойства. Копим всё, иначе непришедшие поля сбросились бы
// в значения по умолчанию.
const allProps = {};

window.wallpaperPropertyListener = {
  applyUserProperties(props) {
    Object.assign(allProps, props);
    const cfg = cfgFromProps(allProps);

    if (!webterm) {
      lastCfg = cfg;
      webterm = startWebterm(cfg);
      return;
    }

    const structuralChanged = STRUCTURAL_KEYS.some((k) => cfg[k] !== lastCfg[k]);
    lastCfg = cfg;
    if (structuralChanged) {
      location.reload();
      return;
    }
    webterm.updateConfig(cfg);
  },
};

// index.html — единая точка входа: внутри Wallpaper Engine конфиг приходит из свойств, в обычном
// браузере (страницу отдаёт бэкенд или статика) стартуем по URL-параметрам. Внутри самого WE функция wallpaperRegisterAudioListener определена до
// загрузки страницы — тогда ждём свойства подолгу: стартовать с умолчаниями раньше времени
// нельзя, иначе терминал поднимется с неверными настройками (панель настроек, положение
// кнопки меню), а после прихода свойств страница ещё и перезагрузится.
const IN_WE = typeof window.wallpaperRegisterAudioListener === 'function';
setTimeout(() => {
  if (webterm) return;
  if (IN_WE) {
    // WE так и не прислал свойства — стартуем с безопасными умолчаниями обоев
    lastCfg = { wsUrl: 'ws://localhost:3000/pty', showUI: false, enableWebgl: false, enableImages: false };
    webterm = startWebterm(lastCfg);
  } else {
    // обычный браузер: index.html — тот же файл, конфиг берётся из URL-параметров (?ws=…&theme=…)
    webterm = startWebterm();
  }
}, IN_WE ? 10000 : 400);

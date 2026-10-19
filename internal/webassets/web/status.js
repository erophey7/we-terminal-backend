// Оверлей «нет связи с бэкендом». Без него обои без запущенного бэкенда выглядят как пустой
// чёрный экран, и подписчик решает, что они сломаны. Появляется, если соединение не
// установилось за SHOW_AFTER_MS (и пока не установится), сам исчезает при подключении.
// Не перехватывает мышь. Тексты — i18n.js (язык тот же, что у меню). Отключается ?status=0.

import { DEFAULT_LANGUAGE, LANGUAGES, translator } from './i18n.js';

const SHOW_AFTER_MS = 3000;

const CSS = `
.status-overlay{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:38;display:none;
  width:min(40em,84vw);padding:1.2em 1.5em;border-radius:1em;pointer-events:none;
  background:rgba(14,12,24,.88);border:1px solid color-mix(in srgb,var(--accent,#8a7dff) 45%,transparent);
  box-shadow:0 10px 40px rgba(0,0,0,.5);color:#eceaff;
  font:500 clamp(13px,.95vw,24px)/1.5 'JetBrains Mono',ui-monospace,monospace}
.status-overlay.show{display:block;animation:status-in .25s ease-out}
.status-overlay h2{margin:0 0 .5em;font-size:1.15em;font-weight:700;color:var(--accent-2,#5ee6c9)}
.status-overlay .addr{margin:0 0 .7em;opacity:.85;word-break:break-all}
.status-overlay ul{margin:0 0 .7em;padding-left:1.3em}
.status-overlay li{margin:.2em 0}
.status-overlay code{background:rgba(255,255,255,.1);border-radius:.3em;padding:.05em .35em}
.status-overlay .retry{margin:0;opacity:.6;font-size:.9em}
@keyframes status-in{from{opacity:0}to{opacity:1}}
`;

// Адрес для показа: схема + хост + путь, без query (там токен).
function displayAddress(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return String(url).split('?')[0];
  }
}

export function installStatusOverlay({ transport, language = DEFAULT_LANGUAGE, enabled = true }) {
  if (!enabled) return { setLanguage() {} };

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'status-overlay';
  document.body.appendChild(root);

  let tr = translator(LANGUAGES[language] ? language : DEFAULT_LANGUAGE);
  let timer = null;
  let shown = false;

  function render() {
    const hints = [tr('statusHintStart'), tr('statusHintAddress')];
    // страница, открытая из файла (обои WE), приходит к бэкенду с origin "null"
    if (location.protocol === 'file:') hints.push(tr('statusHintOrigin'));
    hints.push(tr('statusHintLog'));
    root.textContent = '';
    const h = document.createElement('h2');
    h.textContent = tr('statusTitle');
    const addr = document.createElement('p');
    addr.className = 'addr';
    addr.textContent = `${tr('statusTrying')} ${displayAddress(transport.url)}`;
    const ul = document.createElement('ul');
    for (const text of hints) {
      const li = document.createElement('li');
      // `код` в строках переводов превращаем в <code>
      text.split('`').forEach((part, i) => {
        if (i % 2) { const c = document.createElement('code'); c.textContent = part; li.appendChild(c); }
        else li.appendChild(document.createTextNode(part));
      });
      ul.appendChild(li);
    }
    const retry = document.createElement('p');
    retry.className = 'retry';
    retry.textContent = tr('statusRetry');
    root.append(h, addr, ul, retry);
  }

  function show() {
    render();
    root.classList.add('show');
    shown = true;
  }
  function hide() {
    clearTimeout(timer);
    timer = null;
    root.classList.remove('show');
    shown = false;
  }

  // connecting/offline сменяют друг друга при каждой попытке — таймер запускаем один раз
  // и сбрасываем только при успешном подключении.
  transport.onStatus((state) => {
    if (state === 'online') hide();
    else if (!timer && !shown) timer = setTimeout(show, SHOW_AFTER_MS);
  });

  return {
    setLanguage(lang) {
      tr = translator(LANGUAGES[lang] ? lang : DEFAULT_LANGUAGE);
      if (shown) render();
    },
  };
}

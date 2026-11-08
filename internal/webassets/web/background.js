// Фоновая картинка за терминалом: прозрачность картинки, размытие и прозрачность самого терминала.
// Картинка хранится в IndexedDB браузера (blob, без лимита localStorage), числа — в настройках (main.js).
// Слой — один div под терминалом; терминал показывает его сквозь свой полупрозрачный фон (theme.background с альфой).

const DB_NAME = 'webterm';
const STORE = 'kv';
const KEY = 'background-image';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const loadStoredImage = () => idb('readonly', (s) => s.get(KEY)).catch(() => null);
export const saveStoredImage = (blob) => idb('readwrite', (s) => s.put(blob, KEY));
export const clearStoredImage = () => idb('readwrite', (s) => s.delete(KEY)).catch(() => {});

// '#rrggbb' / '#rgb' / '#rrggbbaa' + альфа 0..1 -> 'rgba(r, g, b, a)'. Другие форматы возвращаются как есть.
export function withAlpha(color, alpha) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(color).trim());
  if (!m) return color;
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(a * 1000) / 1000})`;
}

export function installBackground({ onChange } = {}) {
  const el = document.createElement('div');
  el.className = 'bg-image';
  el.hidden = true;
  document.body.prepend(el);
  let url = null;
  let hasImage = false;

  function apply({ opacity, blur }) {
    el.style.opacity = String(Math.max(0, Math.min(100, opacity)) / 100);
    el.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
    // размытые края светлеют: чуть увеличиваем картинку, чтобы край за экраном не просвечивал
    el.style.transform = blur > 0 ? `scale(${1 + Math.min(blur, 40) / 200})` : 'none';
  }

  function show(src) {
    if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    url = src;
    el.style.backgroundImage = `url("${src}")`;
    el.hidden = false;
    hasImage = true;
    onChange?.(true);
  }

  return {
    get hasImage() { return hasImage; },
    apply,
    setBlob(blob) { show(URL.createObjectURL(blob)); },
    setUrl(src) { show(src); },
    clear() {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
      url = null;
      el.hidden = true;
      el.style.backgroundImage = '';
      hasImage = false;
      onChange?.(false);
    },
  };
}

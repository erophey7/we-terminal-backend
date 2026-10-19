// Kitty graphics protocol поверх xterm.js 6.0.0.
//
// В xterm.js 6.0.0 парсер молча проглатывает APC (registerApcHandler нет,
// d.ts прямо говорит "APC, PM or SOS is currently not supported"), поэтому
// хук на уровне парсера невозможен. Вместо этого мы встаём ПЕРЕД term.write():
// ApcSplitter вырезает из потока `ESC _ G ... ESC \`, а всё остальное
// отдаётся xterm как раньше. Порядок сохраняется: перед обработкой каждой
// kitty-команды ждём, пока терминал допарсит предшествующий текст — иначе
// позиция курсора в момент команды была бы неточной.
//
// Картинки рисуются через публичные registerMarker/registerDecoration:
// DOM-оверлей, привязанный к строке буфера, поэтому скроллится вместе с
// текстом и сам исчезает, когда строка уходит из scrollback.
//
// Поддержано: a=t/T/p/d/q, f=24/32/100, t=d (прямая передача, в т.ч. чанками
// m=1), o=z, ответы OK/ошибки с учётом q, кроп x/y/w/h, смещения X/Y, c/r,
// z, C, удаление d=a/i/n/c/p/x/y/z (и заглавные). Не поддержано: t=f/t/s
// (файл на хосте бэкенда браузеру недоступен — отвечаем ошибкой, и такие
// клиенты, например icat, сами откатываются на потоковую передачу),
// анимации (a=f/a/c), unicode-плейсхолдеры (U=1).

const ESC = '\x1b';
const APC_START = ESC + '_G';
const ST = ESC + '\\';

const MAX_APC_BYTES = 64 * 1024 * 1024;     // один APC-пакет (base64)
const MAX_PIXELS = 100 * 1000 * 1000;       // одна картинка
const STORAGE_QUOTA = 320 * 1024 * 1024;    // как в kitty: декодированные байты
const CARRY_FLUSH_MS = 40;

// ---------- вырезание APC из потока ----------

export class ApcSplitter {
  constructor(maxBytes = MAX_APC_BYTES) {
    this.maxBytes = maxBytes;
    this.inApc = false;
    this.acc = [];
    this.accLen = 0;
    this.overflow = false;
    this.carry = '';
  }

  // Возвращает [{ text: '...' } | { apc: 'k=v,...;payload' | null }], null —
  // пакет превысил лимит и отброшен.
  push(str) {
    const out = [];
    if (this.carry) { str = this.carry + str; this.carry = ''; }
    let i = 0;
    while (i < str.length) {
      if (!this.inApc) {
        const j = str.indexOf(APC_START, i);
        if (j < 0) {
          // хвост "ESC" или "ESC _" может оказаться началом APC — придержим
          const keep = str.endsWith(ESC + '_') ? 2 : str.endsWith(ESC) ? 1 : 0;
          const end = str.length - keep;
          if (end > i) out.push({ text: str.slice(i, end) });
          this.carry = str.slice(end);
          break;
        }
        if (j > i) out.push({ text: str.slice(i, j) });
        this.inApc = true;
        this.acc = [];
        this.accLen = 0;
        this.overflow = false;
        i = j + APC_START.length;
      } else {
        const k = str.indexOf(ST, i);
        const end = k < 0 ? (str.endsWith(ESC) ? str.length - 1 : str.length) : k;
        if (end > i) this._take(str.slice(i, end));
        if (k < 0) {
          this.carry = str.slice(end);
          break;
        }
        out.push({ apc: this.overflow ? null : this.acc.join('') });
        this.inApc = false;
        this.acc = [];
        i = k + ST.length;
      }
    }
    return out;
  }

  _take(s) {
    if (this.overflow) return;
    this.accLen += s.length;
    if (this.accLen > this.maxBytes) { this.overflow = true; this.acc = []; return; }
    this.acc.push(s);
  }

  // Придержанный хвост, который так и не стал APC, надо всё же отдать
  // терминалу (одинокий ESC в конце вывода).
  takeCarry() {
    if (this.inApc || !this.carry) return '';
    const c = this.carry;
    this.carry = '';
    return c;
  }
}

// ---------- разбор команды ----------

function parseControl(raw) {
  const semi = raw.indexOf(';');
  const head = semi < 0 ? raw : raw.slice(0, semi);
  const payload = semi < 0 ? '' : raw.slice(semi + 1);
  const keys = {};
  for (const part of head.split(',')) {
    const eq = part.indexOf('=');
    if (eq > 0) keys[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return { keys, payload };
}

const num = (v, def = 0) => {
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

class KittyError extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function inflate(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new KittyError('ENOTSUPP', 'zlib compression is not supported by this browser');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decodeImage(keys, bytes) {
  const fmt = num(keys.f, 32);
  if (fmt === 100) {
    let bmp;
    try {
      bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    } catch {
      throw new KittyError('EBADPNG', 'Failed to decode PNG data');
    }
    return bmp;
  }
  if (fmt !== 24 && fmt !== 32) throw new KittyError('EINVAL', `Unsupported format f=${fmt}`);
  const w = num(keys.s), h = num(keys.v);
  if (!w || !h) throw new KittyError('EINVAL', 'Image width/height (s, v) are required for raw data');
  if (w * h > MAX_PIXELS) throw new KittyError('EFBIG', 'Image is too large');
  const bpp = fmt === 24 ? 3 : 4;
  if (bytes.length < w * h * bpp) {
    throw new KittyError('EINVAL', `Not enough image data: expected ${w * h * bpp} bytes, got ${bytes.length}`);
  }
  const rgba = new Uint8ClampedArray(w * h * 4);
  if (bpp === 4) {
    rgba.set(bytes.subarray(0, w * h * 4));
  } else {
    for (let s = 0, d = 0; d < rgba.length; s += 3, d += 4) {
      rgba[d] = bytes[s]; rgba[d + 1] = bytes[s + 1]; rgba[d + 2] = bytes[s + 2]; rgba[d + 3] = 255;
    }
  }
  return createImageBitmap(new ImageData(rgba, w, h));
}

// ---------- сам терминальный слой ----------

export function installKitty(term) {
  const splitter = new ApcSplitter();
  const images = new Map();       // id -> { id, number, bitmap, bytes, used }
  const placements = new Set();   // { imageId, placementId, marker, decoration, x, cols, rows, z }
  let storageBytes = 0;
  let useCounter = 0;
  let nextAutoId = 0x7fff0000;    // внутренние id для картинок без i/I
  let pending = null;             // незавершённая цепочка чанков { keys, parts }
  let queue = [];
  let busy = false;
  let carryTimer = null;
  let disposed = false;

  const disposables = [];

  function reply(keys, msg, ok) {
    const quiet = num(keys.q);
    if (ok ? quiet >= 1 : quiet >= 2) return;
    const id = num(keys.i), number = num(keys.I);
    if (!id && !number) return;
    let head = id ? `i=${id}` : '';
    if (number) head += (head ? ',' : '') + `I=${number}`;
    if (keys.p !== undefined && keys.p !== '0') head += `,p=${keys.p}`;
    term.input(`${APC_START}${head};${msg}${ST}`, false);
  }

  // ----- хранилище -----

  function freeImage(img) {
    if (!images.delete(img.id)) return;
    storageBytes -= img.bytes;
    img.bitmap.close?.();
  }

  function dropPlacements(pred) {
    const hit = [...placements].filter(pred);
    for (const p of hit) p.decoration.dispose(); // onDispose уберёт из Set
    return hit;
  }

  function enforceQuota(keepId) {
    if (storageBytes <= STORAGE_QUOTA) return;
    const hasPlacement = (id) => [...placements].some((p) => p.imageId === id);
    const byAge = [...images.values()].filter((i) => i.id !== keepId).sort((a, b) => a.used - b.used);
    for (const pass of [false, true]) {
      for (const img of byAge) {
        if (storageBytes <= STORAGE_QUOTA) return;
        if (!images.has(img.id)) continue;
        if (!pass && hasPlacement(img.id)) continue; // сначала те, что нигде не показаны
        dropPlacements((p) => p.imageId === img.id);
        freeImage(img);
      }
    }
  }

  function storeImage(keys, bitmap) {
    let id = num(keys.i);
    const number = num(keys.I);
    if (!id) id = nextAutoId++;
    const old = images.get(id);
    if (old) { dropPlacements((p) => p.imageId === id); freeImage(old); }
    const img = {
      id, number, bitmap,
      bytes: bitmap.width * bitmap.height * 4,
      used: ++useCounter,
    };
    images.set(id, img);
    storageBytes += img.bytes;
    enforceQuota(id);
    return img;
  }

  function findImage(keys) {
    const id = num(keys.i), number = num(keys.I);
    if (id) return images.get(id);
    if (number) {
      let best;
      for (const img of images.values()) if (img.number === number && (!best || img.used > best.used)) best = img;
      return best;
    }
    return undefined;
  }

  // ----- показ -----

  function cellSize() {
    const screen = term.element?.querySelector('.xterm-screen');
    if (screen && screen.clientWidth && term.cols && term.rows) {
      return { w: screen.clientWidth / term.cols, h: screen.clientHeight / term.rows };
    }
    return { w: 9, h: 18 };
  }

  // Возвращает { cols, rows } — сколько ячеек занимает размещение.
  function place(img, keys) {
    const buf = term.buffer.active;
    const cell = cellSize();

    const sx = Math.min(num(keys.x), img.bitmap.width);
    const sy = Math.min(num(keys.y), img.bitmap.height);
    const sw = Math.max(1, Math.min(num(keys.w) || img.bitmap.width - sx, img.bitmap.width - sx));
    const sh = Math.max(1, Math.min(num(keys.h) || img.bitmap.height - sy, img.bitmap.height - sy));
    const offX = Math.min(num(keys.X), cell.w - 1);
    const offY = Math.min(num(keys.Y), cell.h - 1);

    let cols = num(keys.c), rows = num(keys.r);
    let dispW, dispH;
    if (cols && rows) {
      dispW = cols * cell.w; dispH = rows * cell.h;
    } else if (cols) {
      dispW = cols * cell.w; dispH = dispW * sh / sw;
    } else if (rows) {
      dispH = rows * cell.h; dispW = dispH * sw / sh;
    } else {
      dispW = sw; dispH = sh;
    }
    cols = cols || Math.max(1, Math.ceil((dispW + offX) / cell.w));
    rows = rows || Math.max(1, Math.ceil((dispH + offY) / cell.h));

    const x = buf.cursorX;
    const z = num(keys.z);
    const marker = term.registerMarker(0);
    if (!marker) return { cols, rows };
    const decoration = term.registerDecoration({
      marker, x, width: Math.min(cols, Math.max(1, term.cols - x)), height: rows,
      layer: z < 0 ? 'bottom' : 'top',
    });
    if (!decoration) { marker.dispose(); return { cols, rows }; }

    const placement = {
      imageId: img.id, placementId: num(keys.p), marker, decoration, x, cols, rows, z,
    };
    placements.add(placement);
    decoration.onDispose(() => { placements.delete(placement); marker.dispose(); });

    // Размеры в долях контейнера (cols×rows ячеек) — картинка тянется вместе
    // с ячейками при смене шрифта, не нужно пересчитывать.
    const boxW = cols * cell.w, boxH = rows * cell.h;
    let canvas = null;
    decoration.onRender((el) => {
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = sw; canvas.height = sh;
        canvas.getContext('2d').drawImage(img.bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
        Object.assign(canvas.style, {
          position: 'absolute',
          left: `${offX / boxW * 100}%`, top: `${offY / boxH * 100}%`,
          width: `${dispW / boxW * 100}%`, height: `${dispH / boxH * 100}%`,
          pointerEvents: 'none',
        });
      }
      el.style.overflow = 'hidden';
      el.style.pointerEvents = 'none';
      if (canvas.parentNode !== el) el.appendChild(canvas);
    });

    img.used = ++useCounter;
    return { cols, rows };
  }

  async function advanceCursor(cols, rows) {
    // LF×(rows-1) прокручивает экран, если картинка не влезает; маркер
    // привязан к строке буфера и уезжает вместе с ней.
    const seq = '\n'.repeat(Math.max(0, rows - 1)) + (cols > 0 ? `${ESC}[${cols}C` : '');
    if (seq) await new Promise((r) => term.write(seq, r));
  }

  // ----- удаление -----

  function viewportLines() {
    const buf = term.buffer.active;
    return [buf.viewportY, buf.viewportY + term.rows - 1];
  }

  function placementCovers(p, col, absLine) {
    if (p.marker.isDisposed) return false;
    return absLine >= p.marker.line && absLine < p.marker.line + p.rows
      && col >= p.x && col < p.x + p.cols;
  }

  function deleteCommand(keys) {
    const what = keys.d || 'a';
    const free = what !== what.toLowerCase();
    const kind = what.toLowerCase();
    const buf = term.buffer.active;
    const [top, bottom] = viewportLines();
    const onScreen = (p) => !p.marker.isDisposed && p.marker.line + p.rows > top && p.marker.line <= bottom;
    const id = num(keys.i);
    let pred;
    switch (kind) {
      case 'a': pred = onScreen; break;
      case 'i': pred = (p) => p.imageId === id && (!keys.p || p.placementId === num(keys.p)); break;
      case 'n': {
        const img = findImage({ I: keys.I });
        pred = (p) => !!img && p.imageId === img.id && (!keys.p || p.placementId === num(keys.p));
        break;
      }
      case 'c': pred = (p) => placementCovers(p, buf.cursorX, buf.baseY + buf.cursorY); break;
      // координаты в p/x/y — 1-based, относительно активного экрана
      case 'p': pred = (p) => placementCovers(p, num(keys.x, 1) - 1, buf.baseY + num(keys.y, 1) - 1); break;
      case 'x': pred = (p) => p.x <= num(keys.x, 1) - 1 && p.x + p.cols > num(keys.x, 1) - 1; break;
      case 'y': pred = (p) => !p.marker.isDisposed
        && p.marker.line <= buf.baseY + num(keys.y, 1) - 1 && p.marker.line + p.rows > buf.baseY + num(keys.y, 1) - 1; break;
      case 'z': pred = (p) => p.z === num(keys.z); break;
      default: return; // остальные варианты (r, f, ...) не поддержаны
    }
    const hit = dropPlacements(pred);
    if (free) {
      const still = new Set([...placements].map((p) => p.imageId));
      const ids = new Set(hit.map((p) => p.imageId));
      if (kind === 'i') ids.add(id);
      for (const imgId of ids) {
        const img = images.get(imgId);
        if (img && !still.has(imgId)) freeImage(img);
      }
    }
  }

  // ----- команды -----

  async function transmit(keys, payload) {
    const medium = keys.t || 'd';
    if (medium !== 'd') {
      throw new KittyError('ENOTSUPP', `Transmission medium t=${medium} is not supported, use direct (t=d)`);
    }
    let bytes = base64ToBytes(payload);
    if (keys.o === 'z') bytes = await inflate(bytes);
    else if (keys.o) throw new KittyError('EINVAL', `Unknown compression o=${keys.o}`);
    return decodeImage(keys, bytes);
  }

  async function runCommand(keys, payload) {
    const action = keys.a || 't';
    try {
      switch (action) {
        case 'q': {
          const bmp = await transmit(keys, payload);
          bmp.close?.();
          reply(keys, 'OK', true);
          break;
        }
        case 't':
        case 'T': {
          const bitmap = await transmit(keys, payload);
          const img = storeImage(keys, bitmap);
          const replyKeys = { ...keys, i: keys.i || (keys.I ? String(img.id) : '') };
          if (action === 'T' && keys.U !== '1') {
            const { cols, rows } = place(img, keys);
            if (keys.C !== '1') await advanceCursor(cols, rows);
          }
          reply(replyKeys, 'OK', true);
          break;
        }
        case 'p': {
          const img = findImage(keys);
          if (!img) throw new KittyError('ENOENT', 'Image not found');
          if (keys.U !== '1') {
            const { cols, rows } = place(img, keys);
            if (keys.C !== '1') await advanceCursor(cols, rows);
          }
          reply(keys, 'OK', true);
          break;
        }
        case 'd':
          deleteCommand(keys);
          break; // у delete ответа нет
        default:
          throw new KittyError('ENOTSUPP', `Action a=${action} is not supported`);
      }
    } catch (e) {
      if (e instanceof KittyError) reply(keys, `${e.code}:${e.message}`, false);
      else { console.warn('kitty graphics:', e); reply(keys, `EINVAL:${e?.message || e}`, false); }
    }
  }

  async function handleApc(raw) {
    if (raw === null) { pending = null; return; } // слишком большой пакет
    const { keys, payload } = parseControl(raw);

    if (pending) {
      // продолжение цепочки: в чанках после первого есть только m (и q)
      pending.parts.push(payload);
      if (keys.m === '1') return;
      const { keys: first, parts } = pending;
      pending = null;
      await runCommand(first, parts.join(''));
      return;
    }
    if (keys.m === '1') {
      pending = { keys, parts: [payload] };
      return;
    }
    await runCommand(keys, payload);
  }

  // ----- очередь: текст и APC строго по порядку -----

  async function pump() {
    busy = true;
    try {
      while (queue.length && !disposed) {
        const seg = queue.shift();
        if (seg.text !== undefined) await new Promise((r) => term.write(seg.text, r));
        else await handleApc(seg.apc);
      }
    } finally {
      busy = false;
    }
  }

  function scheduleCarryFlush() {
    clearTimeout(carryTimer);
    if (!splitter.carry || splitter.inApc) return;
    carryTimer = setTimeout(() => {
      const c = splitter.takeCarry();
      if (c) { queue.push({ text: c }); if (!busy) pump(); }
    }, CARRY_FLUSH_MS);
  }

  function feed(data) {
    if (disposed) return;
    if (typeof data !== 'string') { term.write(data); return; } // бинарные кадры не трогаем
    const segs = splitter.push(data);
    scheduleCarryFlush();
    if (!busy && segs.every((s) => s.text !== undefined)) {
      for (const s of segs) term.write(s.text);
      return;
    }
    queue.push(...segs);
    if (!busy) pump();
  }

  // ED 2/3 и RIS стирают экран — картинки должны исчезнуть вместе с ним.
  disposables.push(term.parser.registerCsiHandler({ final: 'J' }, (params) => {
    const mode = params[0] ?? 0;
    if (mode === 3) dropPlacements(() => true);
    else if (mode === 2) {
      const [top, bottom] = viewportLines();
      dropPlacements((p) => !p.marker.isDisposed && p.marker.line + p.rows > top && p.marker.line <= bottom);
    }
    return false; // дальше обрабатывает сам xterm
  }));
  disposables.push(term.parser.registerEscHandler({ final: 'c' }, () => {
    dropPlacements(() => true);
    for (const img of [...images.values()]) freeImage(img);
    return false;
  }));

  function dispose() {
    disposed = true;
    clearTimeout(carryTimer);
    queue = [];
    dropPlacements(() => true);
    for (const img of [...images.values()]) freeImage(img);
    disposables.forEach((d) => d.dispose());
  }

  return { feed, dispose };
}

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
// Картинки рисуются DOM-оверлеем поверх .xterm-screen и привязаны к строке буфера
// через публичный registerMarker: позиция пересчитывается при прокрутке/ресайзе,
// слой обрезает по границам экрана, поэтому картинка, верх которой уже ушёл за
// край (или низ ещё не показан), рисуется частично — как в kitty. Оверлей
// исчезает, когда строка уходит из scrollback (marker.onDispose). (Раньше были
// registerDecoration, но они не рисуют картинку, если верхняя строка вне экрана.)
//
// Поддержано: a=t/T/p/d/q/f/a/c, f=24/32/100, t=d (прямая передача, в т.ч. чанками m=1), o=z, ответы OK/ошибки с учётом q,
// кроп x/y/w/h, смещения X/Y, c/r, z (в том числе отрицательный — под текстом), C, замена размещения с тем же p;
// анимация: кадры a=f (база c, правка r, фон Y, наложение X, пауза z), управление a=a (s, v, r/z, c), композиция a=c;
// относительные размещения P/Q/H/V; виртуальные размещения U=1 и Unicode-плейсхолдеры U+10EEEE (диакритики строки/столбца/старшего
// байта id, id и номер размещения — в цвете текста и подчёркивания); удаление d=a/i/n/c/p/q/x/y/z/r/f (и заглавные).
// Не поддержано: t=f/t/s (файл и общая память хоста бэкенда браузеру недоступны — отвечаем ошибкой, и такие клиенты, например
// icat, сами откатываются на потоковую передачу).

import { DIACRITICS } from './kitty-diacritics.js';

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

const PLACEHOLDER = 0x10eeee;           // символ Unicode-плейсхолдера (U=1)
const DEFAULT_GAP_MS = 40;              // пауза нового кадра анимации, если z не задан
const MAX_FRAMES = 2000;

const rowColIndex = new Map(DIACRITICS.map((cp, i) => [cp, i]));

const cssColor = (v) => `rgba(${(v >>> 24) & 255},${(v >>> 16) & 255},${(v >>> 8) & 255},${(v & 255) / 255})`;

function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function installKitty(term) {
  const splitter = new ApcSplitter();
  // id -> { id, number, width, height, frames: [{ bitmap, gap, bytes }], bytes, used, anim }
  // anim: { state: 'stopped' | 'running' | 'loading', cur (0-based), infinite, loopsLeft, timer, waiting }
  const images = new Map();
  // { imageId, placementId, marker, box, canvas, src, bufType, x, cols, rows, z, parent, children, dispose }
  const placements = new Set();
  const virtuals = new Map();     // `${imageId}:${placementId}` -> { imageId, placementId, cols, rows } — для Unicode-плейсхолдеров
  let storageBytes = 0;
  let useCounter = 0;
  let nextAutoId = 0x7fff0000;    // внутренние id для картинок без i/I
  let pending = null;             // незавершённая цепочка чанков { keys, parts }
  let queue = [];
  let busy = false;
  let carryTimer = null;
  let disposed = false;

  const disposables = [];

  // Политика порта (задаётся снаружи): UART-порт (serial0..3) — 115200 бод и эмулируемый 16550, сотни килобайт картинки занимают его на минуты и
  // подвешивают гостя (soft lockup), поэтому там на запрос поддержки (a=q) не отвечаем — icat и chafa сочтут, что графики нет, — а о большой
  // передаче предупреждаем. warnBytes: порог (оценка по s*v и размеру собранных чанков), onWarn(bytes) — не чаще раза в WARN_EVERY_MS.
  const WARN_EVERY_MS = 15000;
  let policy = { queries: true, warnBytes: Infinity, onWarn: null };
  let lastWarn = 0;
  function warnLarge(bytes) {
    if (!policy.onWarn || bytes < policy.warnBytes) return;
    const now = Date.now();
    if (now - lastWarn < WARN_EVERY_MS) return;
    lastWarn = now;
    try { policy.onWarn(bytes); } catch { /* предупреждение не должно ломать разбор */ }
  }
  function setPolicy(next) { policy = { queries: true, warnBytes: Infinity, onWarn: null, ...next }; }

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

  const frameBitmap = (img) => img.frames[img.anim.cur].bitmap;

  function freeImage(img) {
    if (!images.delete(img.id)) return;
    clearTimeout(img.anim.timer);
    storageBytes -= img.bytes;
    for (const f of img.frames) f.bitmap.close?.();
    for (const key of [...virtuals.keys()]) if (virtuals.get(key).imageId === img.id) virtuals.delete(key);
    queuePlaceholders();
  }

  function dropPlacements(pred) {
    const hit = [...placements].filter(pred);
    for (const p of hit) p.dispose();
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
    const bytes = bitmap.width * bitmap.height * 4;
    const img = {
      id, number, width: bitmap.width, height: bitmap.height,
      frames: [{ bitmap, gap: Math.max(0, num(keys.z, DEFAULT_GAP_MS)), bytes }],
      bytes, used: ++useCounter,
      anim: { state: 'stopped', cur: 0, infinite: true, loopsLeft: 0, timer: null, waiting: false },
    };
    images.set(id, img);
    storageBytes += bytes;
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

  // ----- анимация -----

  const hasPlacements = (id) => [...placements].some((p) => p.imageId === id) || [...virtuals.values()].some((v) => v.imageId === id);

  function drawPlacement(p) {
    const img = images.get(p.imageId);
    if (!img) return;
    const ctx = p.canvas.getContext('2d');
    ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);
    ctx.drawImage(frameBitmap(img), p.src.sx, p.src.sy, p.src.sw, p.src.sh, 0, 0, p.src.sw, p.src.sh);
  }

  function redrawImage(img) {
    for (const p of placements) if (p.imageId === img.id) drawPlacement(p);
    queuePlaceholders();
  }

  function scheduleFrame(img) {
    const a = img.anim;
    clearTimeout(a.timer);
    a.timer = null;
    if (disposed || a.state === 'stopped' || img.frames.length < 2 || !hasPlacements(img.id)) return;
    if (a.cur >= img.frames.length - 1 && (a.state === 'loading' || (!a.infinite && a.loopsLeft <= 0))) {
      a.waiting = true;                      // конец: ждём новых кадров (режим загрузки) или остановились на последнем
      if (a.state === 'running') a.state = 'stopped';
      return;
    }
    a.timer = setTimeout(() => stepFrame(img), Math.max(1, img.frames[a.cur].gap));
  }

  function stepFrame(img) {
    const a = img.anim;
    a.timer = null;
    if (disposed || !images.has(img.id) || a.state === 'stopped') return;
    if (a.cur + 1 < img.frames.length) a.cur++;
    else {
      if (!a.infinite) a.loopsLeft--;
      a.cur = 0;
    }
    redrawImage(img);
    scheduleFrame(img);
  }

  function controlAnimation(img, keys) {
    const a = img.anim;
    if (keys.r !== undefined && keys.z !== undefined) {
      const f = img.frames[num(keys.r) - 1];
      if (!f) throw new KittyError('ENOENT', 'Frame not found');
      f.gap = Math.max(0, num(keys.z));
    }
    if (keys.c !== undefined && num(keys.c) > 0) {
      const n = num(keys.c) - 1;
      if (!img.frames[n]) throw new KittyError('ENOENT', 'Frame not found');
      a.cur = n;
      redrawImage(img);
    }
    if (keys.v !== undefined) {
      const v = num(keys.v);
      if (v === 1) a.infinite = true;
      else if (v > 1) { a.infinite = false; a.loopsLeft = v - 1; }
    }
    if (keys.s !== undefined) {
      const s = num(keys.s);
      if (s === 1) { a.state = 'stopped'; clearTimeout(a.timer); a.timer = null; }
      else if (s === 2 || s === 3) { a.state = s === 2 ? 'loading' : 'running'; a.waiting = false; scheduleFrame(img); }
      else throw new KittyError('EINVAL', `Unknown animation state s=${s}`);
    }
  }

  // Кадр анимации: данные кладутся в прямоугольник (x, y) кадра-основы (c; без него — фон Y); r — правка существующего кадра.
  async function addFrame(img, keys, data) {
    const W = img.width, H = img.height;
    const edit = num(keys.r), baseNo = num(keys.c);
    if (edit && !img.frames[edit - 1]) { data.close?.(); throw new KittyError('ENOENT', 'Frame not found'); }
    if (baseNo && !img.frames[baseNo - 1]) { data.close?.(); throw new KittyError('ENOENT', 'Base frame not found'); }
    const x = num(keys.x), y = num(keys.y);
    if (x + data.width > W || y + data.height > H) { data.close?.(); throw new KittyError('EINVAL', 'Frame data does not fit into the image'); }
    if (!edit && img.frames.length >= MAX_FRAMES) { data.close?.(); throw new KittyError('ENOSPC', 'Too many frames'); }
    const canvas = newCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const base = edit ? img.frames[edit - 1] : baseNo ? img.frames[baseNo - 1] : null;
    if (base) ctx.drawImage(base.bitmap, 0, 0);
    else if (keys.Y) { ctx.fillStyle = cssColor(num(keys.Y)); ctx.fillRect(0, 0, W, H); }
    if (num(keys.X) === 1) ctx.clearRect(x, y, data.width, data.height);   // X=1: заменить, а не наложить
    ctx.drawImage(data, x, y);
    data.close?.();
    const bitmap = await createImageBitmap(canvas);
    if (edit) {
      const f = img.frames[edit - 1];
      f.bitmap.close?.();
      f.bitmap = bitmap;
      if (keys.z !== undefined) f.gap = Math.max(0, num(keys.z));
      if (edit - 1 === img.anim.cur) redrawImage(img);
      return edit;
    }
    const bytes = W * H * 4;
    storageBytes += bytes; img.bytes += bytes;
    enforceQuota(img.id);
    if (storageBytes > STORAGE_QUOTA) {
      storageBytes -= bytes; img.bytes -= bytes;
      bitmap.close?.();
      throw new KittyError('ENOSPC', 'Storage quota exceeded');
    }
    img.frames.push({ bitmap, gap: keys.z !== undefined ? Math.max(0, num(keys.z)) : DEFAULT_GAP_MS, bytes });
    if (img.anim.waiting && img.anim.state !== 'stopped') { img.anim.waiting = false; scheduleFrame(img); }
    return img.frames.length;
  }

  async function composeFrames(img, keys) {
    const src = img.frames[num(keys.r) - 1], dstNo = num(keys.c) - 1, dst = img.frames[dstNo];
    if (!src || !dst) throw new KittyError('ENOENT', 'Frame not found');
    const sx = num(keys.X), sy = num(keys.Y), dx = num(keys.x), dy = num(keys.y);
    const w = num(keys.w) || img.width - sx, h = num(keys.h) || img.height - sy;
    if (sx + w > img.width || sy + h > img.height || dx + w > img.width || dy + h > img.height || w <= 0 || h <= 0) {
      throw new KittyError('EINVAL', 'The rectangle is outside the image');
    }
    if (src === dst && sx < dx + w && dx < sx + w && sy < dy + h && dy < sy + h) {
      throw new KittyError('EINVAL', 'Source and destination rectangles of the same frame overlap');
    }
    const canvas = newCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(dst.bitmap, 0, 0);
    if (num(keys.C) === 1) ctx.clearRect(dx, dy, w, h);                    // C=1: заменить, а не наложить
    ctx.drawImage(src.bitmap, sx, sy, w, h, dx, dy, w, h);
    const bitmap = await createImageBitmap(canvas);
    dst.bitmap.close?.();
    dst.bitmap = bitmap;
    if (dstNo === img.anim.cur) redrawImage(img);
  }

  // ----- показ -----

  function cellSize() {
    const screen = term.element?.querySelector('.xterm-screen');
    if (screen && screen.clientWidth && term.cols && term.rows) {
      return { w: screen.clientWidth / term.cols, h: screen.clientHeight / term.rows };
    }
    return { w: 9, h: 18 };
  }

  // ----- слои оверлея и раскладка -----

  const layers = {};
  function getLayer(kind) {
    const screen = term.element?.querySelector('.xterm-screen');
    if (!screen) return null;
    if (layers[kind]?.isConnected) return layers[kind];
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute', left: '0', top: '0', right: '0', bottom: '0',
      overflow: 'hidden', pointerEvents: 'none', zIndex: kind === 'bottom' ? '1' : '7',
    });
    el.className = `kitty-layer kitty-layer-${kind}`;
    screen.appendChild(el);
    return (layers[kind] = el);
  }

  // Ставит каждый box по строке маркера относительно viewport; слой обрезает всё, что вне экрана.
  let layoutQueued = false;
  function layout() {
    layoutQueued = false;
    if (disposed) return;
    if (placements.size) {
      const buf = term.buffer.active;
      const cell = cellSize();
      for (const p of placements) {
        if (p.marker.isDisposed) continue;
        const row = p.marker.line - buf.viewportY;
        const visible = p.bufType === buf.type && row + p.rows > 0 && row < term.rows;
        p.box.style.display = visible ? '' : 'none';
        if (!visible) continue;
        p.box.style.left = `${p.x * cell.w}px`;
        p.box.style.top = `${row * cell.h}px`;
        p.box.style.width = `${p.cols * cell.w}px`;
        p.box.style.height = `${p.rows * cell.h}px`;
      }
    }
    renderPlaceholders();
  }
  function queueLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(layout);
  }
  disposables.push(term.onScroll(queueLayout), term.onRender(queueLayout), term.onResize(queueLayout));

  // Размер показа в ячейках и пикселях: c/r заданы — как есть, один из них — второй по пропорциям, ни одного — по размеру картинки.
  function sizeOf(img, keys, sw, sh, cell) {
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
    return { cols, rows, dispW, dispH, offX, offY };
  }

  // Создаёт размещение. Возвращает { cols, rows } — сколько ячеек оно занимает (для сдвига курсора).
  // Относительное (P/Q/H/V): позиция — от левого верхнего угла родительского размещения, курсор не двигается.
  // Виртуальное (U=1): ничего не рисуется, картинку показывают символы-плейсхолдеры (renderPlaceholders).
  function place(img, keys) {
    const buf = term.buffer.active;
    const cell = cellSize();

    const sx = Math.min(num(keys.x), img.width);
    const sy = Math.min(num(keys.y), img.height);
    const sw = Math.max(1, Math.min(num(keys.w) || img.width - sx, img.width - sx));
    const sh = Math.max(1, Math.min(num(keys.h) || img.height - sy, img.height - sy));
    const { cols, rows, dispW, dispH, offX, offY } = sizeOf(img, keys, sw, sh, cell);
    const placementId = num(keys.p);

    if (keys.U === '1') {
      virtuals.set(`${img.id}:${placementId}`, { imageId: img.id, placementId, cols, rows });
      img.used = ++useCounter;
      scheduleFrame(img);
      queuePlaceholders();
      return { cols: 0, rows: 0, virtual: true };
    }

    // тот же образ и номер размещения — замена, а не второе размещение
    if (placementId) dropPlacements((p) => p.imageId === img.id && p.placementId === placementId);

    let parent = null, x = buf.cursorX, markerOffset = 0;
    if (keys.P !== undefined || keys.Q !== undefined) {
      const pid = num(keys.P), qid = num(keys.Q);
      parent = [...placements].find((p) => p.imageId === pid && (!qid || p.placementId === qid) && !p.marker.isDisposed);
      if (!parent) throw new KittyError('ENOENT', 'Parent placement not found');
      if (parent.imageId === img.id && parent.placementId === placementId) throw new KittyError('ECYCLE', 'A placement cannot be its own parent');
      x = parent.x + num(keys.H);
      markerOffset = parent.marker.line + num(keys.V) - (buf.baseY + buf.cursorY);
    }
    const z = num(keys.z);
    const marker = term.registerMarker(markerOffset);
    if (!marker) {
      if (parent) throw new KittyError('EINVAL', 'The relative position is outside the buffer');
      return { cols, rows };
    }
    const layer = getLayer(z < 0 ? 'bottom' : 'top');
    if (!layer) { marker.dispose(); return { cols, rows }; }

    // box — ячейки cols×rows; картинка внутри в долях box, поэтому тянется вместе с ячейками при смене шрифта
    const box = document.createElement('div');
    box.style.position = 'absolute';
    box.style.overflow = 'hidden';
    box.style.pointerEvents = 'none';
    const boxW = cols * cell.w, boxH = rows * cell.h;
    const canvas = newCanvas(sw, sh);
    Object.assign(canvas.style, {
      position: 'absolute',
      left: `${offX / boxW * 100}%`, top: `${offY / boxH * 100}%`,
      width: `${dispW / boxW * 100}%`, height: `${dispH / boxH * 100}%`,
      pointerEvents: 'none',
    });
    box.appendChild(canvas);
    layer.appendChild(box);

    const placement = {
      imageId: img.id, placementId, marker, box, canvas, src: { sx, sy, sw, sh }, bufType: buf.type, x, cols, rows, z,
      parent, children: new Set(),
      dispose() {
        if (!placements.delete(placement)) return;
        for (const child of [...placement.children]) child.dispose();     // потомки живут, пока жив родитель
        placement.parent?.children.delete(placement);
        box.remove();
        marker.dispose();
      },
    };
    parent?.children.add(placement);
    placements.add(placement);
    marker.onDispose(() => placement.dispose());
    drawPlacement(placement);
    layout();

    img.used = ++useCounter;
    scheduleFrame(img);
    return parent ? { cols: 0, rows: 0, relative: true } : { cols, rows };
  }

  async function advanceCursor(cols, rows) {
    // LF×(rows-1) прокручивает экран, если картинка не влезает; маркер
    // привязан к строке буфера и уезжает вместе с ней.
    const seq = '\n'.repeat(Math.max(0, rows - 1)) + (cols > 0 ? `${ESC}[${cols}C` : '');
    if (seq) await new Promise((r) => term.write(seq, r));
  }

  // ----- Unicode-плейсхолдеры -----
  // Символ U+10EEEE в ячейке + диакритики: 1-й — номер строки картинки, 2-й — столбца, 3-й — старший байт id; младшие 24 бита id —
  // цвет текста (24-бит или индекс палитры), номер размещения — цвет подчёркивания. Картинка вписывается в сетку виртуального
  // размещения (c×r ячеек) с сохранением пропорций по центру; каждая ячейка показывает свой кусок.

  const ph = { els: new Map() };   // ключ прогона -> { el, used }
  let phQueued = false;
  function queuePlaceholders() {
    if (phQueued || disposed || !virtuals.size) {
      if (!virtuals.size && ph.els.size) clearPlaceholders();
      return;
    }
    phQueued = true;
    requestAnimationFrame(() => { phQueued = false; renderPlaceholders(); });
  }

  function clearPlaceholders() {
    for (const { el } of ph.els.values()) el.remove();
    ph.els.clear();
  }

  function colorId(mode, value) {
    // CM_RGB: value — 0xRRGGBB; CM_P256: индекс палитры; остальное (цвет по умолчанию, 16 цветов) — 0
    return mode === 'rgb' || mode === 'p256' ? value : 0;
  }
  function colorMode(cell, which) {
    if (which === 'fg') return cell.isFgRGB() ? 'rgb' : cell.isFgPalette() ? 'p256' : 'none';
    // без подчёркивания xterm.js отдаёт «цвет подчёркивания» = цвету текста: это не номер размещения
    if (!cell.getUnderlineStyle?.()) return 'none';
    const rgb = cell.isUnderlineColorRGB?.(), pal = cell.isUnderlineColorPalette?.();
    return rgb ? 'rgb' : pal ? 'p256' : 'none';
  }

  function scanPlaceholders() {
    const buf = term.buffer.active;
    const runs = [];
    let cell;
    for (let y = 0; y < term.rows; y++) {
      const line = buf.getLine(buf.viewportY + y);
      if (!line) continue;
      let prev = null;
      for (let x = 0; x < term.cols; x++) {
        cell = line.getCell(x, cell);
        const chars = cell?.getChars() ?? '';
        if (!chars || chars.codePointAt(0) !== PLACEHOLDER) { prev = null; continue; }
        const cps = [...chars].map((c) => c.codePointAt(0));
        const idx = (cp) => (cp === undefined ? -1 : rowColIndex.has(cp) ? rowColIndex.get(cp) : -1);
        let id = colorId(colorMode(cell, 'fg'), cell.getFgColor());
        const pid = colorId(colorMode(cell, 'ul'), cell.getUnderlineColor?.() ?? 0);
        const msb = idx(cps[3]);
        if (msb > 0) id = (id | (msb << 24)) >>> 0;
        let row = idx(cps[1]), col = idx(cps[2]);
        const same = prev && prev.id === id && prev.pid === pid && prev.x === x - 1;
        // пропущенные диакритики — продолжение предыдущей ячейки: тот же ряд, следующий столбец
        if (row < 0) { row = same ? prev.row : 0; col = same ? prev.col + 1 : 0; }
        else if (col < 0) col = same && prev.row === row ? prev.col + 1 : 0;
        const run = prev && same && prev.row === row && prev.col === col - 1 ? prev.run : null;
        if (run) run.n++;
        else runs.push({ y, x, n: 1, id, pid, row, col });
        prev = { id, pid, x, row, col, run: run || runs[runs.length - 1] };
      }
    }
    return runs;
  }

  function renderPlaceholders() {
    if (disposed) return;
    if (!virtuals.size) { if (ph.els.size) clearPlaceholders(); return; }
    const cell = cellSize();
    const layer = getLayer('top');
    if (!layer) return;
    const dpr = window.devicePixelRatio || 1;
    for (const v of ph.els.values()) v.used = false;
    for (const run of scanPlaceholders()) {
      // номер размещения — из цвета подчёркивания; xterm.js 6 хранит его, только когда подчёркивание включено (SGR 4), поэтому при
      // «чужом» номере берём единственное размещение картинки, если оно одно
      const own = [...virtuals.values()].filter((v) => v.imageId === run.id);
      const virt = virtuals.get(`${run.id}:${run.pid}`) || virtuals.get(`${run.id}:0`) || (own.length === 1 && run.pid === 0 ? own[0] : undefined);
      const img = images.get(run.id);
      if (!virt || !img) continue;
      const frame = img.anim.cur;
      const key = `${run.y}:${run.x}:${run.n}:${run.id}:${run.pid}:${run.row}:${run.col}:${frame}:${cell.w}x${cell.h}:${dpr}`;
      const have = ph.els.get(key);
      if (have) { have.used = true; continue; }
      // сетка виртуального размещения в пикселях и положение картинки в ней
      const gridW = virt.cols * cell.w, gridH = virt.rows * cell.h;
      const scale = Math.min(gridW / img.width, gridH / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      const ox = (gridW - dw) / 2, oy = (gridH - dh) / 2;
      // прямоугольник прогона в сетке и его пересечение с картинкой
      const rx = run.col * cell.w, ry = run.row * cell.h, rw = run.n * cell.w, rh = cell.h;
      const ix0 = Math.max(rx, ox), iy0 = Math.max(ry, oy), ix1 = Math.min(rx + rw, ox + dw), iy1 = Math.min(ry + rh, oy + dh);
      const el = document.createElement('canvas');
      el.className = 'kitty-placeholder';
      el.width = Math.max(1, Math.round(rw * dpr)); el.height = Math.max(1, Math.round(rh * dpr));
      Object.assign(el.style, { position: 'absolute', left: `${run.x * cell.w}px`, top: `${run.y * cell.h}px`, width: `${rw}px`, height: `${rh}px`, pointerEvents: 'none' });
      if (ix1 > ix0 && iy1 > iy0) {
        const ctx = el.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(frameBitmap(img), (ix0 - ox) / scale, (iy0 - oy) / scale, (ix1 - ix0) / scale, (iy1 - iy0) / scale,
          (ix0 - rx) * dpr, (iy0 - ry) * dpr, (ix1 - ix0) * dpr, (iy1 - iy0) * dpr);
      }
      layer.appendChild(el);
      ph.els.set(key, { el, used: true });
      img.used = ++useCounter;
    }
    for (const [key, v] of [...ph.els]) if (!v.used) { v.el.remove(); ph.els.delete(key); }
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

  function dropExtraFrames(img) {
    const a = img.anim;
    clearTimeout(a.timer);
    a.timer = null; a.state = 'stopped'; a.cur = 0; a.waiting = false;
    for (const f of img.frames.splice(1)) { f.bitmap.close?.(); storageBytes -= f.bytes; img.bytes -= f.bytes; }
    redrawImage(img);
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
      case 'q': pred = (p) => p.z === num(keys.z) && placementCovers(p, num(keys.x, 1) - 1, buf.baseY + num(keys.y, 1) - 1); break;
      case 'x': pred = (p) => p.x <= num(keys.x, 1) - 1 && p.x + p.cols > num(keys.x, 1) - 1; break;
      case 'y': pred = (p) => !p.marker.isDisposed
        && p.marker.line <= buf.baseY + num(keys.y, 1) - 1 && p.marker.line + p.rows > buf.baseY + num(keys.y, 1) - 1; break;
      case 'z': pred = (p) => p.z === num(keys.z); break;
      case 'r': pred = (p) => p.imageId >= num(keys.x, 1) && p.imageId <= num(keys.y, 0); break;   // id в диапазоне x..y
      case 'f': {
        // кадры анимации: у картинки i (или у всех) остаётся только первый кадр
        for (const img of id ? [images.get(id)].filter(Boolean) : [...images.values()]) dropExtraFrames(img);
        return;
      }
      default: return;
    }
    const hit = dropPlacements(pred);
    // виртуальные размещения удаляются теми же селекторами по образу/номеру
    if (kind === 'i' || kind === 'n' || kind === 'r') {
      const img = kind === 'n' ? findImage({ I: keys.I }) : null;
      for (const [key, v] of [...virtuals]) {
        const match = kind === 'i' ? v.imageId === id && (!keys.p || v.placementId === num(keys.p))
          : kind === 'n' ? !!img && v.imageId === img.id : v.imageId >= num(keys.x, 1) && v.imageId <= num(keys.y, 0);
        if (match) virtuals.delete(key);
      }
      queuePlaceholders();
    }
    if (free) {
      const still = new Set([...placements].map((p) => p.imageId));
      const ids = new Set(hit.map((p) => p.imageId));
      if (kind === 'i') ids.add(id);
      if (kind === 'r') for (const img of images.values()) if (img.id >= num(keys.x, 1) && img.id <= num(keys.y, 0)) ids.add(img.id);
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

  async function show(img, keys) {
    const { cols, rows, virtual, relative } = place(img, keys);
    if (!virtual && !relative && keys.C !== '1') await advanceCursor(cols, rows);
  }

  async function runCommand(keys, payload) {
    const action = keys.a || 't';
    try {
      switch (action) {
        case 'q': {
          if (!policy.queries) break;                  // UART-порт: «графики нет» — клиент не начнёт передачу
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
          if (action === 'T') await show(img, keys);
          reply(replyKeys, 'OK', true);
          break;
        }
        case 'p': {
          const img = findImage(keys);
          if (!img) throw new KittyError('ENOENT', 'Image not found');
          await show(img, keys);
          reply(keys, 'OK', true);
          break;
        }
        case 'f': {
          const img = findImage(keys);
          if (!img) throw new KittyError('ENOENT', 'Image not found');
          const data = await transmit(keys, payload);
          await addFrame(img, keys, data);
          reply(keys, 'OK', true);
          break;
        }
        case 'a': {
          const img = findImage(keys);
          if (!img) throw new KittyError('ENOENT', 'Image not found');
          controlAnimation(img, keys);                 // kitty на успешное управление анимацией не отвечает (icat шлёт его без q — ответы утекли бы в оболочку)
          break;
        }
        case 'c': {
          const img = findImage(keys);
          if (!img) throw new KittyError('ENOENT', 'Image not found');
          await composeFrames(img, keys);
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
      pending.bytes += payload.length;
      warnLarge(pending.bytes);
      if (keys.m === '1') return;
      const { keys: first, parts } = pending;
      pending = null;
      await runCommand(first, parts.join(''));
      return;
    }
    if (keys.m === '1') {
      const bpp = keys.f === '24' ? 3 : 4;
      const raw = (num(keys.s) || 0) * (num(keys.v) || 0) * bpp;              // несжатый размер: грубая оценка того, что пойдёт по линии
      pending = { keys, parts: [payload], bytes: payload.length };
      warnLarge(keys.o === 'z' ? Math.min(raw, 4 * payload.length * 8) : raw);   // сжатое: оцениваем осторожно, пока не накопится
      return;
    }
    warnLarge(payload.length);
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
    if ((!splitter.carry || splitter.inApc) && !sgrCarry) return;
    carryTimer = setTimeout(() => {
      const c = (sgrCarry || '') + splitter.takeCarry();
      sgrCarry = '';
      if (c) { queue.push({ text: c }); if (!busy) pump(); }
    }, CARRY_FLUSH_MS);
  }

  // kitty (icat, tmux) пишет цвет двоеточиями без номера цветового пространства: ESC[38:2:R:G:B m. xterm.js читает по T.416 и принимает
  // первое число за пространство (R уходит, G и B сдвигаются): id плейсхолдера выходит неверным. Приводим к виду 38:2::R:G:B.
  // Разрезанную посередине последовательность придерживаем до следующего куска (или до таймера).
  let sgrCarry = '';
  function normalizeSgr(data) {
    data = sgrCarry + data;
    sgrCarry = '';
    const tail = /\x1b(?:\[[0-9;:]*)?$/.exec(data);
    if (tail) { sgrCarry = tail[0]; data = data.slice(0, tail.index); }
    if (!data.includes(':')) return data;
    return data.replace(/\x1b\[([0-9;:]*)m/g, (m, body) => (body.includes(':')
      ? `\x1b[${body.replace(/(^|;)([345]8):2:(\d+):(\d+):(\d+)(?=;|$)/g, '$1$2:2::$3:$4:$5')}m` : m));
  }

  function feed(data) {
    if (disposed) return;
    if (typeof data !== 'string') { term.write(data); return; } // бинарные кадры не трогаем
    const segs = splitter.push(normalizeSgr(data));
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
    const buf = term.buffer.active;
    const top = buf.baseY, bottom = buf.baseY + term.rows - 1, cur = buf.baseY + buf.cursorY;
    const hit = (p, from, to) => !p.marker.isDisposed && p.marker.line + p.rows > from && p.marker.line <= to;
    if (mode === 3) dropPlacements(() => true);
    else if (mode === 2) dropPlacements((p) => hit(p, top, bottom));
    // vt220/linux: `clear` и Ctrl+L дают ESC[H ESC[J (стирание от курсора), а не ESC[2J — картинки в стираемой области тоже уходят
    else if (mode === 0) dropPlacements((p) => hit(p, cur, bottom));
    else if (mode === 1) dropPlacements((p) => hit(p, top, cur));
    return false; // дальше обрабатывает сам xterm
  }));
  // DECCOLM (CSI ? 3 h/l) на настоящем терминале стирает экран; им начинается `reset` для vt220 (rs1=ESC[?3l)
  for (const final of ['h', 'l']) {
    disposables.push(term.parser.registerCsiHandler({ prefix: '?', final }, (params) => {
      if ([...params].flat().includes(3)) dropPlacements(() => true);
      return false;
    }));
  }
  disposables.push(term.parser.registerEscHandler({ final: 'c' }, () => {
    dropPlacements(() => true);
    for (const img of [...images.values()]) freeImage(img);
    virtuals.clear();
    clearPlaceholders();
    return false;
  }));

  // Резолвится, когда всё принятое разобрано (очередь пуста, ничего не выполняется): для тестов и для тех, кому важен порядок
  function idle() {
    return new Promise((resolve) => {
      const check = () => (!busy && !queue.length && !splitter.carry && !sgrCarry ? resolve() : setTimeout(check, 5));
      check();
    });
  }

  function dispose() {
    disposed = true;
    clearTimeout(carryTimer);
    queue = [];
    dropPlacements(() => true);
    for (const img of [...images.values()]) freeImage(img);
    clearPlaceholders();
    disposables.forEach((d) => d.dispose());
  }

  // Экран очищают снаружи (переключение порта: term.reset() не проходит через парсер): картинки и память уходят вместе с ним
  function clearAll() {
    dropPlacements(() => true);
    for (const img of [...images.values()]) freeImage(img);
    virtuals.clear();
    clearPlaceholders();
  }

  return { feed, dispose, idle, clearAll, setPolicy };
}

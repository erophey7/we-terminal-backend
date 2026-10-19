// Транспорт полностью отделён от рендера терминала: main.js не знает,
// что внутри — наш node-pty/ws сервер, прокси Proxmox или что-то третье.
// Нужен любой объект с этим интерфейсом:
//
//   connect(): void
//   send(data: string): void           — отправить ввод пользователя
//   resize(cols: number, rows: number, xpix?: number, ypix?: number): void
//   onData(cb: (chunk: string) => void): void   — байты для записи в терминал
//   onStatus(cb: (state: 'connecting'|'online'|'offline') => void): void
//
// Чтобы подключить webterm к другому бэкенду (например к websocket-ручке
// Proxmox со своим ticket-хендшейком), достаточно реализовать этот же
// интерфейс в отдельном классе и подменить его в main.js — рендер,
// темы и UI трогать не придётся.
//
// Серверы (Go и server.js) — сырой pty в ws: send() шлёт ввод текстовыми
// кадрами как есть, resize() — единственный управляющий кадр (бинарный).

export class WsTransport {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.reconnectDelay = 500;
    this.dataHandlers = [];
    this.statusHandlers = [];
    this._manualClose = false;
  }

  onData(cb) { this.dataHandlers.push(cb); }
  onStatus(cb) { this.statusHandlers.push(cb); }

  _emitStatus(state) {
    this.statusHandlers.forEach((cb) => cb(state));
  }

  connect() {
    this._manualClose = false;
    this._emitStatus('connecting');
    this.socket = new WebSocket(this.url);

    this.socket.addEventListener('open', () => {
      this.reconnectDelay = 500;
      this._emitStatus('online');
    });

    this.socket.addEventListener('message', (ev) => {
      this.dataHandlers.forEach((cb) => cb(ev.data));
    });

    this.socket.addEventListener('close', () => {
      this._emitStatus('offline');
      if (!this._manualClose) {
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.6, 8000);
      }
    });

    this.socket.addEventListener('error', () => this.socket.close());
  }

  disconnect() {
    this._manualClose = true;
    this.socket?.close();
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    }
  }

  // Бинарный кадр из 4 байт: uint16 BE cols, uint16 BE rows. Ввод идёт
  // текстовыми кадрами, так что кадры не путаются. Бэкенд, который это не
  // понимает (старый), просто проигнорирует/запишет мусор — поэтому серверы
  // (Go и Node) обязаны разбирать бинарные кадры отдельно от ввода.
  // Если известен размер в пикселях (xpix, ypix), кадр — 8 байт: cols, rows, xpix, ypix.
  resize(cols, rows, xpix = 0, ypix = 0) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    if (!(cols > 0 && rows > 0)) return;
    const withPixels = xpix > 0 && ypix > 0;
    const buf = new ArrayBuffer(withPixels ? 8 : 4);
    const view = new DataView(buf);
    view.setUint16(0, cols);
    view.setUint16(2, rows);
    if (withPixels) {
      view.setUint16(4, Math.min(xpix, 0xffff));
      view.setUint16(6, Math.min(ypix, 0xffff));
    }
    this.socket.send(buf);
  }
}

// Package ptybridge runs one terminal session over an already upgraded WebSocket:
// raw pty bytes in both directions, text frames = input/output, a binary frame = resize.
// It is shared by the backend (internal/server) and the PVE "System terminal" agent (pve/agent).
package ptybridge

import (
	"encoding/binary"
	"log"
	"sync"

	"github.com/gorilla/websocket"

	"webterm-backend/internal/ptyshell"
)

// Subprotocol is offered by clients that understand binary output frames. Without it the output is sent in text
// frames (the original protocol), which breaks a multi-byte character that is split at a read boundary.
const Subprotocol = "webterm.v2"

// Reader returns the next WebSocket message; conn.ReadMessage is the usual one. A caller that has to watch the
// connection itself before the session starts (the PVE agent, during its handshake) passes its own.
type Reader func() (messageType int, data []byte, err error)

// Run starts the shell described by opts and pumps data until either side ends.
// It returns after the shell and both pumps have finished. The connection is NOT closed here.
func Run(conn *websocket.Conn, opts ptyshell.Options) error {
	return RunWith(conn, opts, conn.ReadMessage)
}

// RunWith is Run with a custom source of incoming messages.
func RunWith(conn *websocket.Conn, opts ptyshell.Options, next Reader) error {
	outType := websocket.TextMessage
	if conn.Subprotocol() == Subprotocol {
		outType = websocket.BinaryMessage // raw bytes: the client decodes UTF-8 as a stream
	}
	p, err := ptyshell.Start(opts)
	if err != nil {
		return err
	}
	// Close() закрывает хендлы и зовётся РОВНО ОДИН раз, здесь, уже после
	// того как обе горутины ниже гарантированно завершились (wg.Wait()).
	// Закрывать его раньше, из одной горутины, пока другая ещё блокирована
	// в Read() на тех же хендлах — гонка (на Windows это прямо запрещено
	// и роняет процесс целиком, см. ptyshell.PTY.Terminate).
	defer p.Close()

	var wg sync.WaitGroup
	wg.Add(2)

	// pty -> ws
	go func() {
		defer wg.Done()
		buf := make([]byte, 32*1024)
		for {
			n, rerr := p.Read(buf)
			if n > 0 {
				if werr := conn.WriteMessage(outType, buf[:n]); werr != nil {
					return
				}
			}
			if rerr != nil {
				return
			}
		}
	}()

	// ws -> pty
	go func() {
		defer wg.Done()
		for {
			msgType, data, rerr := next()
			// Бинарный кадр — resize: uint16 BE cols, rows, [xpixel, ypixel]. Кадр из 4 байт —
			// только колонки/строки, из 8 — ещё и размер окна в пикселях (для kitten icat и т.п.).
			// Текстовые кадры — обычный ввод в pty (протокол прежних клиентов).
			if rerr == nil && msgType == websocket.BinaryMessage {
				if len(data) == 4 || len(data) == 8 {
					cols := binary.BigEndian.Uint16(data[0:2])
					rows := binary.BigEndian.Uint16(data[2:4])
					if cols > 0 && rows > 0 {
						var err error
						if pr, ok := p.(ptyshell.PixelResizer); ok && len(data) == 8 {
							err = pr.ResizePixels(cols, rows, binary.BigEndian.Uint16(data[4:6]), binary.BigEndian.Uint16(data[6:8]))
						} else {
							err = p.Resize(cols, rows)
						}
						if err != nil {
							log.Printf("pty resize: %v", err)
						}
					}
				}
				continue
			}
			if rerr != nil {
				// Клиент отключился: будим блокированный Read() в другой
				// горутине безопасно — завершаем только процесс, хендлы
				// останутся целы до общего Close() после wg.Wait().
				p.Terminate()
				return
			}
			if _, werr := p.Write(data); werr != nil {
				p.Terminate()
				return
			}
		}
	}()

	wg.Wait()
	return nil
}

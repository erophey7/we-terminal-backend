//go:build !windows

package ptybridge

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"webterm-backend/internal/ptyshell"
)

// serve runs a shell that prints text and exits, over a real WebSocket.
func collect(t *testing.T, protocols []string) (frames []int, data string) {
	t.Helper()
	up := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }, Subprotocols: []string{Subprotocol}}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := up.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		// 3000 x "ж" (2 bytes each): far more than one pty read, so some character is cut at a read boundary
		err = Run(conn, ptyshell.Options{Cmd: "/bin/sh", Args: []string{"-c", `i=0; while [ $i -lt 3000 ]; do printf 'ж'; i=$((i+1)); done; printf END`}, Cols: 80, Rows: 24, EnvInherit: true})
		if err != nil {
			t.Errorf("run: %v", err)
		}
	}))
	defer srv.Close()
	d := websocket.Dialer{Subprotocols: protocols}
	c, _, err := d.Dial("ws"+strings.TrimPrefix(srv.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	var buf []byte
	for !strings.HasSuffix(string(buf), "END") {
		_ = c.SetReadDeadline(time.Now().Add(5 * time.Second))
		typ, b, err := c.ReadMessage()
		if err != nil {
			t.Fatalf("read after %d bytes: %v", len(buf), err)
		}
		frames = append(frames, typ)
		buf = append(buf, b...)
	}
	return frames, string(buf)
}

func TestBinaryOutputWhenNegotiated(t *testing.T) {
	frames, data := collect(t, []string{Subprotocol})
	for _, f := range frames {
		if f != websocket.BinaryMessage {
			t.Fatalf("frame type %d, want binary", f)
		}
	}
	if data != strings.Repeat("ж", 3000)+"END" {
		t.Fatalf("data is damaged (%d bytes)", len(data))
	}
}

func TestTextOutputForOldClients(t *testing.T) {
	frames, _ := collect(t, nil)
	for _, f := range frames {
		if f != websocket.TextMessage {
			t.Fatalf("frame type %d, want text for a client without the subprotocol", f)
		}
	}
}

// Package server поднимает HTTP(+ws) сервер: отдаёт встроенный фронт и
// проксирует /pty в pty-процесс через websocket, без протокола поверх
// (как и раньше — сырые байты в обе стороны).
package server

import (
	"log"
	"mime"
	"net/http"
	"os"

	"github.com/gorilla/websocket"

	"webterm-backend/internal/access"
	"webterm-backend/internal/auth"
	"webterm-backend/internal/config"
	"webterm-backend/internal/ptybridge"
	"webterm-backend/internal/ptyshell"
	"webterm-backend/internal/webassets"

	"io/fs"
)

type Server struct {
	cfg      *config.Config
	authChk  *auth.Checker
	allow    *access.List
	origins  *access.Origins
	fileSrv  http.Handler
	upgrader websocket.Upgrader
}

// Go берёт MIME-типы из ОС; на Windows (реестр) .mjs/.woff2 часто нет, и браузер
// отказывается исполнять module-скрипты с text/plain. Фиксируем явно.
func init() {
	for ext, typ := range map[string]string{
		".js":    "text/javascript; charset=utf-8",
		".mjs":   "text/javascript; charset=utf-8",
		".css":   "text/css; charset=utf-8",
		".woff2": "font/woff2",
		".json":  "application/json",
	} {
		_ = mime.AddExtensionType(ext, typ)
	}
}

func New(cfg *config.Config) (*Server, error) {
	sub, err := fs.Sub(webassets.FS, webassets.Root)
	if err != nil {
		return nil, err
	}
	allow, err := access.New(cfg.Access.AllowedIPs)
	if err != nil {
		return nil, err
	}
	origins, err := access.NewOrigins(cfg.Access.AllowedOrigins)
	if err != nil {
		return nil, err
	}
	return &Server{
		cfg:     cfg,
		authChk: auth.New(cfg.Auth.Enabled, cfg.Auth.User, cfg.Auth.Pass, cfg.Auth.Token),
		allow:   allow,
		origins: origins,
		fileSrv: http.FileServer(http.FS(sub)),
		// The Origin policy is enforced in handlePty (see internal/access/origin.go);
		// without this override gorilla would apply its own same-origin-only default.
		upgrader: websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }, Subprotocols: []string{ptybridge.Subprotocol}},
	}, nil
}

// OriginsDescription is shown in the startup log.
func (s *Server) OriginsDescription() string { return s.origins.Describe() }

// AllowsNullOrigin reports whether pages with origin "null" may connect (startup warning).
func (s *Server) AllowsNullOrigin() bool { return s.origins.AllowsNull() }

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !s.checkAccess(w, r) {
		return
	}
	if r.URL.Path == "/pty" {
		s.handlePty(w, r)
		return
	}
	if !s.authChk.CheckBasic(r) {
		s.authChk.RequireBasic(w)
		return
	}
	s.fileSrv.ServeHTTP(w, r)
}

func (s *Server) checkAccess(w http.ResponseWriter, r *http.Request) bool {
	if s.allow.Empty() {
		return true
	}
	ip := access.ClientIP(r)
	if ip == nil || !s.allow.Allowed(ip) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return false
	}
	return true
}

func (s *Server) handlePty(w http.ResponseWriter, r *http.Request) {
	if !s.authChk.CheckBasic(r) || !s.authChk.CheckToken(r.URL) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Cross-site WebSocket hijacking guard (see internal/access/origin.go).
	if origin := r.Header.Get("Origin"); !s.origins.Allowed(origin, r.Host) {
		log.Printf("ws: rejected Origin %q (Host %q); add it to access.allowed_origins to allow it", origin, r.Host)
		http.Error(w, "Forbidden: origin not allowed", http.StatusForbidden)
		return
	}

	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade: %v", err)
		return
	}
	defer conn.Close()

	opts := ptyshell.Options{
		Cmd:        s.cfg.Shell.Cmd,
		Args:       s.cfg.Shell.Args,
		Cols:       120,
		Rows:       30,
		EnvInherit: s.cfg.Env.InheritOrDefault(),
		EnvVars:    s.cfg.Env.Vars,
		WorkDir:    s.cfg.RunAs.WorkDir,
	}
	if s.cfg.RunAs.Enabled() {
		opts.RunAsUser = s.cfg.RunAs.User
		if s.cfg.RunAs.PasswordEnv != "" {
			opts.RunAsPassword = os.Getenv(s.cfg.RunAs.PasswordEnv)
		}
	}

	if err := ptybridge.Run(conn, opts); err != nil {
		log.Printf("pty start: %v", err)
	}
}

package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	"webterm-backend/internal/config"
	"webterm-backend/internal/server"
)

func main() {
	cfgPath := "webterm.yml"
	if len(os.Args) > 1 {
		cfgPath = os.Args[1]
	}

	cfg, err := config.Load(cfgPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	srv, err := server.New(cfg)
	if err != nil {
		log.Fatalf("server: %v", err)
	}

	addr := net.JoinHostPort(cfg.Listen.IP, fmt.Sprint(cfg.Listen.Port))
	log.Printf("webterm backend listening on http://%s", addr)
	if cfg.Auth.Enabled {
		log.Printf("  auth: enabled (user=%q token=%v)", cfg.Auth.User, cfg.Auth.Token != "")
	}
	log.Printf("  websocket origins: %s", srv.OriginsDescription())
	if srv.AllowsNullOrigin() && !(cfg.Auth.Enabled && cfg.Auth.Token != "") {
		log.Printf("  WARNING: origin \"null\" (file:// pages, sandboxed iframes) is allowed but no auth token is set - any web page can reach this server. Set auth.token.")
	}
	if len(cfg.Access.AllowedIPs) > 0 {
		log.Printf("  allowed_ips: %v", cfg.Access.AllowedIPs)
	}

	log.Fatal(http.ListenAndServe(addr, srv))
}

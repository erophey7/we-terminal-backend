// Package access реализует проверку клиентского IP по белому списку
// (точные адреса или CIDR-подсети). Пустой список значит "разрешено всё".
package access

import (
	"net"
	"net/http"
	"strings"
)

type List struct {
	nets []*net.IPNet
	ips  map[string]struct{}
}

func New(entries []string) (*List, error) {
	l := &List{ips: map[string]struct{}{}}
	for _, e := range entries {
		e = strings.TrimSpace(e)
		if e == "" {
			continue
		}
		if strings.Contains(e, "/") {
			_, n, err := net.ParseCIDR(e)
			if err != nil {
				return nil, err
			}
			l.nets = append(l.nets, n)
			continue
		}
		ip := net.ParseIP(e)
		if ip == nil {
			return nil, &net.ParseError{Type: "IP address", Text: e}
		}
		l.ips[ip.String()] = struct{}{}
	}
	return l, nil
}

// Empty — пустой список значит "ограничений нет", вызывающий код должен
// пропускать проверку целиком.
func (l *List) Empty() bool {
	return l == nil || (len(l.nets) == 0 && len(l.ips) == 0)
}

func (l *List) Allowed(ip net.IP) bool {
	if l.Empty() {
		return true
	}
	if _, ok := l.ips[ip.String()]; ok {
		return true
	}
	for _, n := range l.nets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// ClientIP достаёт реальный IP клиента из запроса (без доверия
// заголовкам прокси — бэкенд рассчитан на прямое подключение).
func ClientIP(r *http.Request) net.IP {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return net.ParseIP(r.RemoteAddr)
	}
	return net.ParseIP(host)
}

// Package auth — Basic Auth (на страницу и ws-апгрейд) и токен в query
// ws-адреса (?token=...). Оба способа опциональны и включаются конфигом.
package auth

import (
	"crypto/subtle"
	"net/http"
	"net/url"
)

type Checker struct {
	enabled bool
	user    string
	pass    string
	token   string
}

func New(enabled bool, user, pass, token string) *Checker {
	return &Checker{enabled: enabled, user: user, pass: pass, token: token}
}

func constEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// CheckBasic проверяет HTTP Basic Auth, если он сконфигурирован.
// Возвращает true, если проверка не нужна или прошла успешно.
func (c *Checker) CheckBasic(r *http.Request) bool {
	if !c.enabled || c.user == "" {
		return true
	}
	user, pass, ok := r.BasicAuth()
	if !ok {
		return false
	}
	return constEqual(user, c.user) && constEqual(pass, c.pass)
}

// CheckToken проверяет токен в query ws-запроса, если он сконфигурирован.
func (c *Checker) CheckToken(u *url.URL) bool {
	if !c.enabled || c.token == "" {
		return true
	}
	return constEqual(u.Query().Get("token"), c.token)
}

func (c *Checker) RequireBasic(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", `Basic realm="webterm"`)
	http.Error(w, "Auth required", http.StatusUnauthorized)
}

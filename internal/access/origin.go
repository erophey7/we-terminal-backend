package access

import (
	"fmt"
	"net/url"
	"strings"
)

// Origins implements the WebSocket Origin policy (protection against cross-site
// WebSocket hijacking: a web page the user happens to visit must not be able to
// open a shell on a local or LAN backend).
//
// Default (empty list): only same-origin browser pages are accepted. Requests
// without an Origin header are accepted too - they do not come from a web page
// (curl, scripts, native clients), and a page cannot omit or forge the header.
//
// allowed_origins extends this with exact origins such as "https://term.example.com",
// plus two special entries:
//
//	"null" / "file://"  pages opened from a file (for example a Wallpaper Engine
//	                    wallpaper); browsers report such pages as a "null"-like origin
//	"*"                 disable the check entirely (not recommended)
type Origins struct {
	any   bool
	exact map[string]struct{}
}

// NewOrigins validates and normalizes the configured entries.
func NewOrigins(entries []string) (*Origins, error) {
	o := &Origins{exact: map[string]struct{}{}}
	for _, e := range entries {
		e = strings.ToLower(strings.TrimSpace(e))
		e = strings.TrimSuffix(e, "/")
		switch {
		case e == "":
			continue
		case e == "*":
			o.any = true
		case e == "null" || strings.HasPrefix(e, "file:"):
			o.exact["null"] = struct{}{} // file:// pages are reported as origin "null" (or "file://")
		default:
			u, err := url.Parse(e)
			if err != nil || u.Scheme == "" || u.Host == "" || u.Path != "" {
				return nil, fmt.Errorf("allowed_origins: %q is not an origin (expected scheme://host[:port], \"file://\", \"null\" or \"*\")", e)
			}
			o.exact[u.Scheme+"://"+u.Host] = struct{}{}
		}
	}
	return o, nil
}

// Allowed reports whether a WebSocket handshake with the given Origin header
// to the given Host may proceed.
func (o *Origins) Allowed(origin, host string) bool {
	if o == nil || o.any {
		return true
	}
	origin = strings.ToLower(strings.TrimSpace(origin))
	if origin == "" {
		return true // not a browser page
	}
	if strings.HasPrefix(origin, "file:") {
		origin = "null"
	}
	if _, ok := o.exact[strings.TrimSuffix(origin, "/")]; ok {
		return true
	}
	// same-origin: the page was served by this very server (any scheme, so it also
	// works behind a TLS-terminating proxy that preserves the Host header)
	if u, err := url.Parse(origin); err == nil && u.Host != "" && strings.EqualFold(u.Host, host) {
		return true
	}
	return false
}

// AllowsNull reports whether pages with the opaque origin "null" are accepted. That origin
// is shared by file:// pages, sandboxed iframes and data: URLs, so a hostile web page can
// reproduce it: with "null" allowed, authentication (a token) is the only real protection.
func (o *Origins) AllowsNull() bool {
	if o == nil {
		return true
	}
	if o.any {
		return true
	}
	_, ok := o.exact["null"]
	return ok
}

// Describe is used for the startup log.
func (o *Origins) Describe() string {
	if o == nil || o.any {
		return "any (check disabled)"
	}
	list := make([]string, 0, len(o.exact))
	for k := range o.exact {
		list = append(list, k)
	}
	if len(list) == 0 {
		return "same-origin only"
	}
	return "same-origin + " + strings.Join(list, ", ")
}

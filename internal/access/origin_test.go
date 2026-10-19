package access

import "testing"

func TestOriginsDefault(t *testing.T) {
	o, err := NewOrigins(nil)
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		origin, host string
		want         bool
	}{
		{"", "localhost:3000", true},                           // not a browser
		{"http://localhost:3000", "localhost:3000", true},      // same origin
		{"https://term.example.com", "term.example.com", true}, // same host behind TLS proxy
		{"HTTP://LocalHost:3000", "localhost:3000", true},      // case-insensitive
		{"http://evil.example", "localhost:3000", false},       // cross-site page
		{"http://localhost:3001", "localhost:3000", false},     // other port is another origin
		{"null", "localhost:3000", false},                      // file:// pages must be listed
		{"file://", "localhost:3000", false},
	}
	for _, c := range cases {
		if got := o.Allowed(c.origin, c.host); got != c.want {
			t.Errorf("Allowed(%q, %q) = %v, want %v", c.origin, c.host, got, c.want)
		}
	}
}

func TestOriginsAllowList(t *testing.T) {
	o, err := NewOrigins([]string{"https://app.example.com/", " File:// "})
	if err != nil {
		t.Fatal(err)
	}
	for _, origin := range []string{"https://app.example.com", "null", "file://"} {
		if !o.Allowed(origin, "localhost:3000") {
			t.Errorf("%q should be allowed", origin)
		}
	}
	if o.Allowed("https://other.example.com", "localhost:3000") {
		t.Error("unlisted origin must be rejected")
	}
}

func TestOriginsWildcard(t *testing.T) {
	o, err := NewOrigins([]string{"*"})
	if err != nil {
		t.Fatal(err)
	}
	if !o.Allowed("http://evil.example", "localhost:3000") {
		t.Error("wildcard disables the check")
	}
}

func TestOriginsInvalid(t *testing.T) {
	for _, bad := range []string{"example.com", "http://", "https://host/path", "ftp"} {
		if _, err := NewOrigins([]string{bad}); err == nil {
			t.Errorf("%q should be rejected", bad)
		}
	}
}

func TestOriginsAllowsNull(t *testing.T) {
	def, _ := NewOrigins(nil)
	if def.AllowsNull() {
		t.Error("null must not be allowed by default")
	}
	f, _ := NewOrigins([]string{"file://"})
	if !f.AllowsNull() {
		t.Error("file:// allows null")
	}
	w, _ := NewOrigins([]string{"*"})
	if !w.AllowsNull() {
		t.Error("wildcard allows null")
	}
}

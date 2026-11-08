package webassets

import (
	"io/fs"
	"path"
	"regexp"
	"strings"
	"testing"
)

// Every module the embedded pages import must be in the embedded copy: the page is served from here, and a missing
// file (for example a new directory that sync-frontend does not copy) breaks the whole UI with nothing but a 404.
func TestEmbeddedImportsResolve(t *testing.T) {
	imp := regexp.MustCompile(`(?:from\s*|import\s*\(?\s*)['"](\.{1,2}/[^'"]+)['"]`)
	sub, err := fs.Sub(FS, Root)
	if err != nil {
		t.Fatal(err)
	}
	checked := 0
	err = fs.WalkDir(sub, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(p, ".js") || strings.HasPrefix(p, "vendor/") {
			return err
		}
		src, err := fs.ReadFile(sub, p)
		if err != nil {
			return err
		}
		for _, m := range imp.FindAllStringSubmatch(string(src), -1) {
			target := path.Join(path.Dir(p), m[1])
			if _, err := fs.Stat(sub, target); err != nil {
				t.Errorf("%s imports %s, which is not embedded", p, m[1])
			}
			checked++
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if checked < 10 {
		t.Fatalf("only %d imports found: the embedded frontend looks empty (run sync-frontend)", checked)
	}
}

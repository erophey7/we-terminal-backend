// Package webassets встраивает фронт в бинарник. go:embed не умеет
// смотреть в родительские директории, поэтому "web" здесь — синхронная
// копия ../../../frontend (см. backend/sync-frontend.sh|ps1); обновляй
// её каждый раз после изменений в frontend/ перед сборкой.
package webassets

import "embed"

//go:embed web
var FS embed.FS

const Root = "web"

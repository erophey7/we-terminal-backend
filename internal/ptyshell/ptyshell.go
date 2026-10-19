// Package ptyshell прячет платформенную разницу (conpty на Windows,
// обычный unix-pty на Linux/macOS) за одним интерфейсом.
package ptyshell

import (
	"io"
	"strings"
)

type PTY interface {
	io.ReadWriteCloser
	Resize(cols, rows uint16) error
	// Terminate останавливает дочерний процесс, не трогая pty-хендлы.
	// Нужен отдельно от Close(): если одна горутина блокирована в
	// Read(), а другая в это время вызывает Close() на том же хендле —
	// это гонка, на Windows прямо запрещённая (CloseHandle на хендле с
	// незавершённым синхронным ReadFile на другом потоке — undefined
	// behavior, на практике роняет процесс целиком). Terminate() будит
	// блокированный Read() естественным путём (EOF/ошибка после выхода
	// процесса), а настоящий Close() вызывается один раз — после того,
	// как обе горутины гарантированно закончили.
	Terminate()
}

// PixelResizer — необязательная возможность pty: размер окна в пикселях (ws_xpixel/ws_ypixel).
// Нужна графическим утилитам (kitten icat, chafa), которые читают его через TIOCGWINSZ.
// ConPTY на Windows пикселей не знает, поэтому реализует только unix-pty.
type PixelResizer interface {
	ResizePixels(cols, rows, xpix, ypix uint16) error
}

type Options struct {
	Cmd  string
	Args []string
	Cols uint16
	Rows uint16

	// Окружение дочернего процесса.
	EnvInherit bool              // прокинуть окружение бэкенда целиком
	EnvVars    map[string]string // доп./переопределяющие переменные

	// Смена контекста пользователя (опционально). RunAsUser пустой —
	// запускаем от текущего пользователя (как раньше).
	RunAsUser     string
	RunAsPassword string // Windows: обязателен для LogonUser. Unix: не нужен.
	WorkDir       string
}

// BuildEnv собирает итоговый env-слайс ("KEY=VALUE") из os.Environ()
// (если EnvInherit) плюс EnvVars поверх. Общая логика для unix/windows
// реализаций, чтобы не дублировать мёрж переменных в каждой из них.
func (o Options) BuildEnv(base []string) []string {
	env := map[string]string{}
	if o.EnvInherit {
		for _, kv := range base {
			if k, v, ok := strings.Cut(kv, "="); ok {
				env[k] = v
			}
		}
	}
	for k, v := range o.EnvVars {
		env[k] = v
	}
	out := make([]string, 0, len(env))
	for k, v := range env {
		out = append(out, k+"="+v)
	}
	return out
}

//go:build !windows

package ptyshell

import (
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"strconv"
	"syscall"

	"github.com/creack/pty"
)

func defaultShell() (string, []string) {
	sh := os.Getenv("SHELL")
	if sh == "" {
		sh = "bash"
	}
	return sh, nil
}

type unixPTY struct {
	f   *os.File
	cmd *exec.Cmd
}

func Start(opts Options) (PTY, error) {
	cmdName, cmdArgs := opts.Cmd, opts.Args
	if cmdName == "" {
		cmdName, cmdArgs = defaultShell()
	}
	cmd := exec.Command(cmdName, cmdArgs...)

	env := opts.BuildEnv(os.Environ())
	hasTerm := false
	for _, kv := range env {
		if len(kv) >= 5 && kv[:5] == "TERM=" {
			hasTerm = true
			break
		}
	}
	if !hasTerm {
		env = append(env, "TERM=xterm-256color")
	}
	cmd.Env = env

	workDir := opts.WorkDir

	// Смена контекста пользователя: запускаем shell от имени opts.RunAsUser,
	// а не от имени бэкенд-процесса. На Unix это требует, чтобы сам бэкенд
	// уже имел root (CAP_SETUID/CAP_SETGID) — иначе setuid в дочернем
	// процессе просто откажет при exec.
	if opts.RunAsUser != "" {
		u, err := user.Lookup(opts.RunAsUser)
		if err != nil {
			return nil, fmt.Errorf("runas: lookup user %q: %w", opts.RunAsUser, err)
		}
		uid, err := strconv.Atoi(u.Uid)
		if err != nil {
			return nil, fmt.Errorf("runas: bad uid %q: %w", u.Uid, err)
		}
		gid, err := strconv.Atoi(u.Gid)
		if err != nil {
			return nil, fmt.Errorf("runas: bad gid %q: %w", u.Gid, err)
		}
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(gid)},
		}
		if workDir == "" {
			workDir = u.HomeDir
		}
		// HOME/USER/LOGNAME должны соответствовать целевому пользователю,
		// иначе большинство shell-профилей проинициализируются неверно.
		cmd.Env = append(cmd.Env, "HOME="+u.HomeDir, "USER="+u.Username, "LOGNAME="+u.Username)
	}

	cmd.Dir = workDir

	f, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: opts.Cols, Rows: opts.Rows})
	if err != nil {
		return nil, err
	}
	return &unixPTY{f: f, cmd: cmd}, nil
}

func (p *unixPTY) Read(b []byte) (int, error)  { return p.f.Read(b) }
func (p *unixPTY) Write(b []byte) (int, error) { return p.f.Write(b) }

func (p *unixPTY) Terminate() {
	if p.cmd.Process != nil {
		_ = p.cmd.Process.Kill()
	}
}

func (p *unixPTY) Close() error {
	p.Terminate()
	return p.f.Close()
}

func (p *unixPTY) Resize(cols, rows uint16) error {
	return pty.Setsize(p.f, &pty.Winsize{Cols: cols, Rows: rows})
}

func (p *unixPTY) ResizePixels(cols, rows, xpix, ypix uint16) error {
	return pty.Setsize(p.f, &pty.Winsize{Cols: cols, Rows: rows, X: xpix, Y: ypix})
}

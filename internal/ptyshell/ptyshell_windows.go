//go:build windows

package ptyshell

import (
	"fmt"
	"os"
	"strings"
	"unsafe"

	"github.com/UserExistsError/conpty"
	"golang.org/x/sys/windows"
)

func defaultShell() string {
	return "powershell.exe"
}

func quoteArg(a string) string {
	if a == "" {
		return `""`
	}
	if !strings.ContainsAny(a, " \t\"") {
		return a
	}
	return `"` + strings.ReplaceAll(a, `"`, `\"`) + `"`
}

func buildCommandLine(cmd string, args []string) string {
	parts := []string{quoteArg(cmd)}
	for _, a := range args {
		parts = append(parts, quoteArg(a))
	}
	return strings.Join(parts, " ")
}

type winPTY struct {
	cpty *conpty.ConPty // обычный путь (UserExistsError/conpty)
	runas *runAsConPTY  // путь со сменой пользователя (свой ConPTY + CreateProcessAsUser)
}

func Start(opts Options) (PTY, error) {
	cmdName := opts.Cmd
	if cmdName == "" {
		cmdName = defaultShell()
	}
	cmdline := buildCommandLine(cmdName, opts.Args)

	if opts.RunAsUser != "" {
		rp, err := startRunAsConPTY(cmdline, opts)
		if err != nil {
			return nil, err
		}
		return &winPTY{runas: rp}, nil
	}

	// Обычный путь: без смены пользователя, через готовую библиотеку.
	envOpts := []conpty.ConPtyOption{conpty.ConPtyDimensions(int(opts.Cols), int(opts.Rows))}
	env := opts.BuildEnv(os.Environ())
	if len(env) > 0 {
		envOpts = append(envOpts, conpty.ConPtyEnv(env))
	}
	if opts.WorkDir != "" {
		envOpts = append(envOpts, conpty.ConPtyWorkDir(opts.WorkDir))
	}

	cpty, err := conpty.Start(cmdline, envOpts...)
	if err != nil {
		return nil, fmt.Errorf("conpty start: %w", err)
	}
	return &winPTY{cpty: cpty}, nil
}

func (p *winPTY) Read(b []byte) (int, error) {
	if p.runas != nil {
		return p.runas.Read(b)
	}
	return p.cpty.Read(b)
}

func (p *winPTY) Write(b []byte) (int, error) {
	if p.runas != nil {
		return p.runas.Write(b)
	}
	return p.cpty.Write(b)
}

func (p *winPTY) Close() error {
	if p.runas != nil {
		return p.runas.Close()
	}
	return p.cpty.Close()
}

// Terminate убивает только дочерний процесс (через PID, без доступа к
// внутренним хендлам библиотеки) — не трогает pty-хендлы, на которых
// может быть подвешен блокирующий Read() в другой горутине. См.
// комментарий у ptyshell.PTY.Terminate.
func (p *winPTY) Terminate() {
	if p.runas != nil {
		p.runas.Terminate()
		return
	}
	pid := p.cpty.Pid()
	if pid <= 0 {
		return
	}
	h, err := windows.OpenProcess(windows.PROCESS_TERMINATE, false, uint32(pid))
	if err != nil {
		return
	}
	defer windows.CloseHandle(h)
	_ = windows.TerminateProcess(h, 1)
}

func (p *winPTY) Resize(cols, rows uint16) error {
	if p.runas != nil {
		return p.runas.Resize(cols, rows)
	}
	return p.cpty.Resize(int(cols), int(rows))
}

// ---------- смена контекста пользователя (LogonUser + CreateProcessAsUser) ----------
//
// UserExistsError/conpty не даёт прицепить токен другого пользователя,
// поэтому для этого пути собираем ConPTY и процесс вручную через
// kernel32 (CreatePseudoConsole) + advapi32 (LogonUserW,
// CreateProcessAsUserW с STARTUPINFOEX/PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE).
// Это неверифицированный живьём путь — собирался без доступа к компилятору,
// проверить и поправить предстоит при первой реальной сборке.

var (
	modkernel32 = windows.NewLazySystemDLL("kernel32.dll")
	modadvapi32 = windows.NewLazySystemDLL("advapi32.dll")

	procCreatePseudoConsole           = modkernel32.NewProc("CreatePseudoConsole")
	procResizePseudoConsole           = modkernel32.NewProc("ResizePseudoConsole")
	procClosePseudoConsole            = modkernel32.NewProc("ClosePseudoConsole")
	procInitializeProcThreadAttrList  = modkernel32.NewProc("InitializeProcThreadAttributeList")
	procUpdateProcThreadAttribute     = modkernel32.NewProc("UpdateProcThreadAttribute")
	procDeleteProcThreadAttributeList = modkernel32.NewProc("DeleteProcThreadAttributeList")
	procLogonUserW                    = modadvapi32.NewProc("LogonUserW")
	procCreateProcessAsUserW          = modadvapi32.NewProc("CreateProcessAsUserW")
)

const (
	procThreadAttributePseudoConsole = 0x00020016
	extendedStartupinfoPresent       = 0x00080000
	createUnicodeEnvironment         = 0x00000400
	logon32LogonInteractive          = 2
	logon32ProviderDefault           = 0
)

type coord struct{ X, Y int16 }

type startupInfoEx struct {
	windows.StartupInfo
	AttributeList uintptr
}

func logonUser(username, domain, password string) (windows.Token, error) {
	u, _ := windows.UTF16PtrFromString(username)
	var d *uint16
	if domain != "" {
		d, _ = windows.UTF16PtrFromString(domain)
	}
	p, _ := windows.UTF16PtrFromString(password)

	var token windows.Token
	r, _, err := procLogonUserW.Call(
		uintptr(unsafe.Pointer(u)),
		uintptr(unsafe.Pointer(d)),
		uintptr(unsafe.Pointer(p)),
		logon32LogonInteractive,
		logon32ProviderDefault,
		uintptr(unsafe.Pointer(&token)),
	)
	if r == 0 {
		return 0, fmt.Errorf("LogonUser: %w", err)
	}
	return token, nil
}

type runAsConPTY struct {
	hpc         uintptr // HPCON
	stdinWrite  windows.Handle
	stdoutRead  windows.Handle
	process     windows.Handle
	thread      windows.Handle
	token       windows.Token
	attrListBuf []byte
}

func startRunAsConPTY(cmdline string, opts Options) (*runAsConPTY, error) {
	userName := opts.RunAsUser
	domain := ""
	if i := strings.IndexByte(userName, '\\'); i >= 0 {
		domain, userName = userName[:i], userName[i+1:]
	}

	token, err := logonUser(userName, domain, opts.RunAsPassword)
	if err != nil {
		return nil, fmt.Errorf("runas: %w", err)
	}

	// Пайпы для ConPTY: один на вход процесса, один на выход.
	var inRead, inWrite, outRead, outWrite windows.Handle
	if err := windows.CreatePipe(&inRead, &inWrite, nil, 0); err != nil {
		return nil, fmt.Errorf("runas: pipe in: %w", err)
	}
	if err := windows.CreatePipe(&outRead, &outWrite, nil, 0); err != nil {
		return nil, fmt.Errorf("runas: pipe out: %w", err)
	}

	size := coord{X: int16(opts.Cols), Y: int16(opts.Rows)}
	var hpc uintptr
	r, _, callErr := procCreatePseudoConsole.Call(
		uintptr(*(*uint32)(unsafe.Pointer(&size))),
		uintptr(inRead),
		uintptr(outWrite),
		0,
		uintptr(unsafe.Pointer(&hpc)),
	)
	// CreatePseudoConsole возвращает HRESULT; 0 (S_OK) — успех.
	if r != 0 {
		return nil, fmt.Errorf("CreatePseudoConsole: hresult=0x%x (%v)", r, callErr)
	}
	windows.CloseHandle(inRead)
	windows.CloseHandle(outWrite)

	// Список атрибутов потока с прикреплённым псевдоконсолем.
	var attrListSize uintptr
	procInitializeProcThreadAttrList.Call(0, 1, 0, uintptr(unsafe.Pointer(&attrListSize)))
	attrListBuf := make([]byte, attrListSize)
	attrList := uintptr(unsafe.Pointer(&attrListBuf[0]))
	if r, _, callErr := procInitializeProcThreadAttrList.Call(attrList, 1, 0, uintptr(unsafe.Pointer(&attrListSize))); r == 0 {
		return nil, fmt.Errorf("InitializeProcThreadAttributeList: %v", callErr)
	}
	if r, _, callErr := procUpdateProcThreadAttribute.Call(
		attrList, 0, procThreadAttributePseudoConsole, hpc, unsafe.Sizeof(hpc), 0, 0,
	); r == 0 {
		return nil, fmt.Errorf("UpdateProcThreadAttribute: %v", callErr)
	}

	si := startupInfoEx{AttributeList: attrList}
	si.Cb = uint32(unsafe.Sizeof(si))

	workDir := opts.WorkDir
	var workDirPtr *uint16
	if workDir != "" {
		workDirPtr, _ = windows.UTF16PtrFromString(workDir)
	}

	env := opts.BuildEnv(os.Environ())
	var envPtr *uint16
	if len(env) > 0 {
		envPtr = utf16BlockFromStrings(env)
	}

	cmdlineUTF16, err := windows.UTF16PtrFromString(cmdline)
	if err != nil {
		return nil, err
	}

	var pi windows.ProcessInformation
	creationFlags := uint32(extendedStartupinfoPresent)
	if envPtr != nil {
		creationFlags |= createUnicodeEnvironment
	}
	r, _, callErr = procCreateProcessAsUserW.Call(
		uintptr(token),
		0,
		uintptr(unsafe.Pointer(cmdlineUTF16)),
		0, 0,
		0, // bInheritHandles=false: пайпы ConPTY передаются через атрибут, не через наследование
		uintptr(creationFlags),
		uintptr(unsafe.Pointer(envPtr)),
		uintptr(unsafe.Pointer(workDirPtr)),
		uintptr(unsafe.Pointer(&si)),
		uintptr(unsafe.Pointer(&pi)),
	)
	if r == 0 {
		return nil, fmt.Errorf("CreateProcessAsUser: %v", callErr)
	}

	procDeleteProcThreadAttributeList.Call(attrList)

	return &runAsConPTY{
		hpc:        hpc,
		stdinWrite: inWrite,
		stdoutRead: outRead,
		process:    pi.Process,
		thread:     pi.Thread,
		token:      token,
	}, nil
}

func (r *runAsConPTY) Read(b []byte) (int, error) {
	var n uint32
	err := windows.ReadFile(r.stdoutRead, b, &n, nil)
	return int(n), err
}

func (r *runAsConPTY) Write(b []byte) (int, error) {
	var n uint32
	err := windows.WriteFile(r.stdinWrite, b, &n, nil)
	return int(n), err
}

func (r *runAsConPTY) Resize(cols, rows uint16) error {
	size := coord{X: int16(cols), Y: int16(rows)}
	ret, _, callErr := procResizePseudoConsole.Call(r.hpc, uintptr(*(*uint32)(unsafe.Pointer(&size))))
	if ret != 0 {
		return fmt.Errorf("ResizePseudoConsole: hresult=0x%x (%v)", ret, callErr)
	}
	return nil
}

func (r *runAsConPTY) Terminate() {
	if r.process != 0 {
		windows.TerminateProcess(r.process, 1)
	}
}

func (r *runAsConPTY) Close() error {
	procClosePseudoConsole.Call(r.hpc)
	windows.CloseHandle(r.stdinWrite)
	windows.CloseHandle(r.stdoutRead)
	if r.process != 0 {
		windows.TerminateProcess(r.process, 0)
		windows.CloseHandle(r.process)
	}
	if r.thread != 0 {
		windows.CloseHandle(r.thread)
	}
	if r.token != 0 {
		windows.CloseHandle(windows.Handle(r.token))
	}
	return nil
}

// utf16BlockFromStrings собирает блок переменных окружения в формате,
// который ждёт CreateProcess[AsUser]: "KEY=VAL\0KEY2=VAL2\0...\0\0".
func utf16BlockFromStrings(env []string) *uint16 {
	var block []uint16
	for _, s := range env {
		u, err := windows.UTF16FromString(s)
		if err != nil {
			continue
		}
		// UTF16FromString включает завершающий 0 — обрезаем, добавим
		// свой разделитель один раз на весь блок в конце.
		block = append(block, u[:len(u)-1]...)
		block = append(block, 0)
	}
	block = append(block, 0)
	return &block[0]
}

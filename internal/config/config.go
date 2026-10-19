package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Listen ListenConfig `yaml:"listen"`
	Shell  ShellConfig  `yaml:"shell"`
	Env    EnvConfig    `yaml:"env"`
	RunAs  RunAsConfig  `yaml:"runas"`
	Auth   AuthConfig   `yaml:"auth"`
	Access AccessConfig `yaml:"access"`
}

type ListenConfig struct {
	IP   string `yaml:"ip"`
	Port int    `yaml:"port"`
}

type ShellConfig struct {
	Cmd  string   `yaml:"cmd"`
	Args []string `yaml:"args"`
}

// EnvConfig — окружение, с которым стартует shell-процесс.
type EnvConfig struct {
	// Прокидывать ли в shell окружение самого бэкенд-процесса (PATH,
	// профильные переменные и т.п.) — то, с чем запущено приложение.
	// По умолчанию true: иначе в запущенном от службы/автозапуска
	// бэкенде shell окажется в голом окружении без PATH и прочего.
	Inherit *bool `yaml:"inherit"`
	// Доп. переменные поверх унаследованных (или вместо них, если
	// inherit: false) — например, свои маркеры, прокси, locale.
	Vars map[string]string `yaml:"vars"`
}

func (e EnvConfig) InheritOrDefault() bool {
	if e.Inherit == nil {
		return true
	}
	return *e.Inherit
}

// RunAsConfig — смена контекста пользователя: запустить shell не от
// имени процесса бэкенда, а от имени другого пользователя. Пароль в
// самом YAML не хранится намеренно — только имя переменной окружения,
// откуда его взять на старте (задай её при запуске бэкенда, не клади
// секрет в конфиг на диске).
type RunAsConfig struct {
	// Unix: "username". Windows: "username" или "DOMAIN\username" —
	// пусто означает "запускать от текущего пользователя", то есть
	// функция выключена.
	User string `yaml:"user"`
	// Имя переменной окружения с паролем (нужен на Windows для
	// LogonUser/CreateProcessAsUser; на Unix обычно не нужен, если
	// бэкенд и так работает от root — там используется прямая смена
	// uid/gid без пароля).
	PasswordEnv string `yaml:"password_env"`
	// Домашняя директория/cwd для сессии. Пусто — домашняя директория
	// целевого пользователя (Unix) или текущая директория (Windows).
	WorkDir string `yaml:"workdir"`
}

func (r RunAsConfig) Enabled() bool {
	return r.User != ""
}

type AuthConfig struct {
	Enabled bool   `yaml:"enabled"`
	User    string `yaml:"user"`
	Pass    string `yaml:"pass"`
	Token   string `yaml:"token"`
}

type AccessConfig struct {
	AllowedIPs []string `yaml:"allowed_ips"`
	// AllowedOrigins extends the WebSocket Origin policy (default: same-origin only).
	// See internal/access/origin.go.
	AllowedOrigins []string `yaml:"allowed_origins"`
}

func Default() *Config {
	return &Config{
		Listen: ListenConfig{IP: "0.0.0.0", Port: 3000},
	}
}

// Load читает YAML-конфиг с диска. Если файла нет — возвращает дефолтный
// конфиг без ошибки (чтобы бинарник запускался и без конфига рядом).
func Load(path string) (*Config, error) {
	cfg := Default()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return nil, err
	}

	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, err
	}

	if cfg.Listen.IP == "" {
		cfg.Listen.IP = "0.0.0.0"
	}
	if cfg.Listen.Port == 0 {
		cfg.Listen.Port = 3000
	}

	return cfg, nil
}

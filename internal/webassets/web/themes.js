// Именованные палитры. Любую можно выбрать через панель настроек
// или сразу в URL: index.html?theme=nord
export const THEMES = {
  nebula: {
    label: 'Nebula',
    colors: {
      background: '#00000000',
      foreground: '#e8e6f0',
      cursor: '#8a7dff',
      cursorAccent: '#1b1024',
      selectionBackground: 'rgba(138, 125, 255, 0.35)',
      black: '#1c1b22', red: '#ff6b81', green: '#5ee6c9', yellow: '#ffd479',
      blue: '#7aa2ff', magenta: '#c792ea', cyan: '#7ae7e0', white: '#e8e6f0',
      brightBlack: '#5b5a6b', brightRed: '#ff8a9c', brightGreen: '#8af5dd',
      brightYellow: '#ffe29b', brightBlue: '#9db8ff', brightMagenta: '#d9a8f2',
      brightCyan: '#a4f1eb', brightWhite: '#ffffff',
    },
    accent: '#8a7dff',
    accent2: '#5ee6c9',
    bgGrad1: '#1b1024',
    bgGrad2: '#0d1320',
  },
  nord: {
    label: 'Nord',
    colors: {
      background: '#00000000',
      foreground: '#d8dee9',
      cursor: '#88c0d0',
      cursorAccent: '#2e3440',
      selectionBackground: 'rgba(136, 192, 208, 0.3)',
      black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
      blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
      brightBlack: '#4c566a', brightRed: '#d08770', brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b', brightBlue: '#8fbcbb', brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb', brightWhite: '#eceff4',
    },
    accent: '#88c0d0',
    accent2: '#a3be8c',
    bgGrad1: '#232834',
    bgGrad2: '#161a22',
  },
  dracula: {
    label: 'Dracula',
    colors: {
      background: '#00000000',
      foreground: '#f8f8f2',
      cursor: '#ff79c6',
      cursorAccent: '#282a36',
      selectionBackground: 'rgba(189, 147, 249, 0.3)',
      black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
      blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
      brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94',
      brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
      brightCyan: '#a4ffff', brightWhite: '#ffffff',
    },
    accent: '#bd93f9',
    accent2: '#50fa7b',
    bgGrad1: '#1e1f29',
    bgGrad2: '#14151d',
  },
  gruvbox: {
    label: 'Gruvbox',
    colors: {
      background: '#00000000',
      foreground: '#ebdbb2',
      cursor: '#fe8019',
      cursorAccent: '#282828',
      selectionBackground: 'rgba(254, 128, 25, 0.28)',
      black: '#282828', red: '#fb4934', green: '#b8bb26', yellow: '#fabd2f',
      blue: '#83a598', magenta: '#d3869b', cyan: '#8ec07c', white: '#ebdbb2',
      brightBlack: '#928374', brightRed: '#fb4934', brightGreen: '#b8bb26',
      brightYellow: '#fabd2f', brightBlue: '#83a598', brightMagenta: '#d3869b',
      brightCyan: '#8ec07c', brightWhite: '#fbf1c7',
    },
    accent: '#fe8019',
    accent2: '#b8bb26',
    bgGrad1: '#282420',
    bgGrad2: '#1a1714',
  },
  catppuccin: {
    label: 'Catppuccin Mocha',
    colors: {
      background: '#00000000',
      foreground: '#cdd6f4',
      cursor: '#f5c2e7',
      cursorAccent: '#1e1e2e',
      selectionBackground: 'rgba(245, 194, 231, 0.28)',
      black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
      blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
      brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#f5c2e7',
      brightCyan: '#94e2d5', brightWhite: '#a6adc8',
    },
    accent: '#f5c2e7',
    accent2: '#94e2d5',
    bgGrad1: '#201b2c',
    bgGrad2: '#111119',
  },
};

export function applyThemeChrome(name) {
  const t = THEMES[name] || THEMES.nebula;
  const root = document.documentElement.style;
  root.setProperty('--accent', t.accent);
  root.setProperty('--accent-2', t.accent2);
  root.setProperty('--bg-grad-1', t.bgGrad1);
  root.setProperty('--bg-grad-2', t.bgGrad2);
  return t;
}

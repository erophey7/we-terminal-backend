// Раскладки виртуальной клавиатуры — данные. Каждая раскладка описана по
// физическим позициям клавиш QWERTY (строки совпадают по длине с POS), поэтому
// Ctrl-комбинации в любой раскладке идут с «физической» клавишей (en), как на
// настоящей клавиатуре. Чтобы добавить язык: добавить запись в LAYOUTS
// (и свойство kb_<код> в wallpaper-engine/project.json).
//
// Не поддержано: слои AltGr и мёртвые клавиши (диакритика набирается как
// отдельный символ), RTL-раскладки (арабская, иврит) и CJK-методы ввода —
// для таких просто не включайте раскладку.

export const POS = {
  r0: '`1234567890-=',
  r1: 'qwertyuiop[]\\',
  r2: "asdfghjkl;'",
  r3: 'zxcvbnm,./',
};

// base/shift: четыре строки (r0..r3) по длинам POS (13, 13, 11, 10).
export const LAYOUTS = {
  en: {
    label: 'English',
    base: ['`1234567890-=', 'qwertyuiop[]\\', "asdfghjkl;'", 'zxcvbnm,./'],
    shift: ['~!@#$%^&*()_+', 'QWERTYUIOP{}|', 'ASDFGHJKL:"', 'ZXCVBNM<>?'],
  },
  ru: {
    label: 'Русский',
    base: ['ё1234567890-=', 'йцукенгшщзхъ\\', 'фывапролджэ', 'ячсмитьбю.'],
    shift: ['Ё!"№;%:?*()_+', 'ЙЦУКЕНГШЩЗХЪ/', 'ФЫВАПРОЛДЖЭ', 'ЯЧСМИТЬБЮ,'],
  },
  uk: {
    label: 'Українська',
    base: ['ʼ1234567890-=', 'йцукенгшщзхїґ', 'фівапролджє', 'ячсмитьбю.'],
    shift: ['₴!"№;%:?*()_+', 'ЙЦУКЕНГШЩЗХЇҐ', 'ФІВАПРОЛДЖЄ', 'ЯЧСМИТЬБЮ,'],
  },
  de: {
    label: 'Deutsch',
    base: ['^1234567890ß´', 'qwertzuiopü+#', 'asdfghjklöä', 'yxcvbnm,.-'],
    shift: ['°!"§$%&/()=?`', "QWERTZUIOPÜ*'", 'ASDFGHJKLÖÄ', 'YXCVBNM;:_'],
  },
  fr: {
    label: 'Français',
    base: ['²&é"\'(-è_çà)=', 'azertyuiop^$*', 'qsdfghjklmù', 'wxcvbn,;:!'],
    shift: ['²1234567890°+', 'AZERTYUIOP¨£µ', 'QSDFGHJKLM%', 'WXCVBN?./§'],
  },
  es: {
    label: 'Español',
    base: ["º1234567890'¡", 'qwertyuiop`+ç', 'asdfghjklñ´', 'zxcvbnm,.-'],
    shift: ['ª!"·$%&/()=?¿', 'QWERTYUIOP^*Ç', 'ASDFGHJKLÑ¨', 'ZXCVBNM;:_'],
  },
  it: {
    label: 'Italiano',
    base: ["\\1234567890'ì", 'qwertyuiopè+ù', 'asdfghjklòà', 'zxcvbnm,.-'],
    shift: ['|!"£$%&/()=?^', 'QWERTYUIOPé*§', 'ASDFGHJKLç°', 'ZXCVBNM;:_'],
  },
  tr: {
    label: 'Türkçe',
    base: ['"1234567890*-', 'qwertyuıopğü,', 'asdfghjklşi', 'zxcvbnmöç.'],
    shift: ["é!'^+%&/()=?_", 'QWERTYUIOPĞÜ;', 'ASDFGHJKLŞİ', 'ZXCVBNMÖÇ:'],
  },
};

export const ch = (base, shift, en, w = 1) => ({ type: 'char', base, shift: shift ?? base, en: en ?? base, w });
export const sp = (id, label, w = 1, extra = {}) => ({ type: 'special', id, label, w, ...extra });

// Ряды как на настоящей QWERTY: каждый = 15 единиц ширины, средний сдвинут Caps'ом.
export function layoutRows(code) {
  const L = LAYOUTS[code] ?? LAYOUTS.en;
  const keys = (row, from = 0, to = POS[row].length) => Array.from(POS[row].slice(from, to)).map((en, i) => {
    const idx = from + i;
    return ch(Array.from(L.base[+row[1]])[idx], Array.from(L.shift[+row[1]])[idx], en);
  });
  const bs = sp('Backspace', '⌫', 2, { repeat: true });
  const lastBackslash = keys('r1', 12, 13).map((k) => ({ ...k, w: 1.5 }));
  return [
    [...keys('r0'), bs],
    [sp('Tab', 'Tab', 1.5), ...keys('r1', 0, 12), ...lastBackslash],
    [sp('Caps', 'Caps', 1.75, { mod: 'caps' }), ...keys('r2'), sp('Enter', 'Enter ↵', 2.25)],
    [sp('Shift', 'Shift', 2.25, { mod: 'shift' }), ...keys('r3'), sp('Shift', 'Shift', 2.75, { mod: 'shift' })],
  ];
}

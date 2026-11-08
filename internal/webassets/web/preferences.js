export const SETTINGS_STORAGE_KEY = 'webterm:settings';
export const MENU_POSITION_STORAGE_KEY = 'webterm:menubtn';

// Browser preferences intentionally override Wallpaper Engine property defaults.
const SAVED_KEYS = {
  theme: 'theme',
  fontFamily: 'fontFamily',
  fontSize: 'fontSize',
  opacity: 'opacity',
  cursorStyle: 'cursorStyle',
  menuLang: 'menuLang',
  menuSize: 'menuSize',
  menuOpacity: 'menuOpacity',
  menuPos: 'menuPos',
  menuMove: 'menuMove',
};

export function applySavedPreferences(config, storage = globalThis.localStorage) {
  let saved;
  try { saved = JSON.parse(storage?.getItem(SETTINGS_STORAGE_KEY) || '{}'); }
  catch { return config; }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return config;

  const result = { ...config };
  for (const [setting, key] of Object.entries(SAVED_KEYS)) {
    if (Object.hasOwn(saved, key)) result[setting] = saved[key];
  }
  if (Object.hasOwn(saved.flags || {}, 'nerdSymbols')) result.nerdSymbols = saved.flags.nerdSymbols;
  return result;
}

export function clearSavedPreferences(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(SETTINGS_STORAGE_KEY);
    storage?.removeItem(MENU_POSITION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

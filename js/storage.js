import { state } from './state.js';

const KEY = 'deckEcho.save';
const SETTINGS_KEY = 'deckEcho.settings';
const SCHEMA_VERSION = 3;   // 슬롯 구조 변경 시 ++

export function saveAll() {
  try {
    if (state.run) {
      const data = { schema: SCHEMA_VERSION, ...state.run };
      localStorage.setItem(KEY, JSON.stringify(data));
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } catch (e) { console.warn('save failed', e); }
}

export function loadRun() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.schema !== SCHEMA_VERSION) {
      console.warn('save schema mismatch — discarding old save');
      localStorage.removeItem(KEY);
      return null;
    }
    delete data.schema;
    state.run = data;
    return state.run;
  } catch { return null; }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    Object.assign(state.settings, JSON.parse(raw));
  } catch {}
}

export function clearRun() {
  try { localStorage.removeItem(KEY); } catch {}
  state.run = null;
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

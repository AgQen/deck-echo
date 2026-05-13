import { state } from './state.js';

const KEY = 'deckEcho.save';
const SETTINGS_KEY = 'deckEcho.settings';

export function saveAll() {
  try {
    if (state.run) localStorage.setItem(KEY, JSON.stringify(state.run));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } catch (e) { console.warn('save failed', e); }
}

export function loadRun() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    state.run = JSON.parse(raw);
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

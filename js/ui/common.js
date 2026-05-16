// 공통 UI 헬퍼.

import { setSceneMusic } from '../assets.js';

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k.startsWith('data-')) e.setAttribute(k, v);
    else e[k] = v;
  }
  for (const c of [].concat(children).filter(Boolean)) {
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

export function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === name));
  setSceneMusic(name);
}

let modalOpen = null;
export function openModal(name) {
  closeModal();
  const m = document.querySelector(`[data-modal="${name}"]`);
  if (!m) return;
  m.classList.add('active');
  modalOpen = name;
}
export function closeModal() {
  if (modalOpen) {
    const m = document.querySelector(`[data-modal="${modalOpen}"]`);
    if (m) m.classList.remove('active');
    modalOpen = null;
  }
}
export function currentModal() { return modalOpen; }

let toastTimer = null;
export function toast(msg, ms = 1500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

export function haptic(ms = 10) {
  try { navigator.vibrate?.(ms); } catch {}
}

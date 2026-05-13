import { $, $$, el, openModal, closeModal, toast } from './common.js';
import { state } from '../state.js';
import { saveAll, clearRun } from '../storage.js';
import { showScreen } from './common.js';
import { CARDS, STARTER_DECK } from '../data/cards.js';

export function bindModals() {
  // 닫기 버튼
  document.querySelectorAll('[data-action="close-modal"]').forEach(b => b.addEventListener('click', closeModal));

  // 설정
  document.querySelectorAll('[data-modal="settings"] [data-action]').forEach(b => {
    b.addEventListener('click', () => onSettingsAction(b.dataset.action));
  });
  document.querySelectorAll('[data-modal="settings"] [data-setting]').forEach(inp => {
    inp.addEventListener('input', () => {
      const key = inp.dataset.setting;
      const v = inp.type === 'checkbox' ? inp.checked : Number(inp.value);
      state.settings[key] = v;
      saveAll();
    });
  });

  // 세팅
  bindSetup();
}

function onSettingsAction(act) {
  switch (act) {
    case 'resume': closeModal(); break;
    case 'to-title': closeModal(); showScreen('title'); break;
    case 'abandon-run':
      if (!confirm('현재 진행을 포기합니다. 정말?')) return;
      clearRun(); closeModal(); showScreen('title'); break;
  }
}

function bindSetup() {
  document.querySelectorAll('[data-setup-group] button').forEach(b => {
    b.addEventListener('click', () => {
      const group = b.closest('[data-setup-group]');
      group.querySelectorAll('button').forEach(x => x.classList.toggle('seg-on', x === b));
      const v = b.dataset.value;
      if (group.dataset.setupGroup === 'hand-size') {
        state.settings.handSize = Number(v);
        saveAll();
      }
    });
  });
  document.querySelector('[data-action="setup-confirm"]')?.addEventListener('click', () => {
    closeModal();
    toast('세팅 저장됨');
  });
  renderSetupLists();
}

function renderSetupLists() {
  const deckList = $('#setup-deck-list');
  if (deckList) {
    deckList.innerHTML = '';
    for (const id of STARTER_DECK) {
      const card = CARDS[id];
      const row = el('div', { class: 'deck-list-row' });
      row.innerHTML = `<span>${card?.name || id}</span><span class="muted">${card?.rarity || ''}</span>`;
      deckList.appendChild(row);
    }
  }
  const pool = $('#setup-pool-list');
  if (pool) {
    pool.innerHTML = '';
    for (const id of Object.keys(CARDS)) {
      const card = CARDS[id];
      const row = el('div', { class: 'deck-list-row' });
      row.innerHTML = `<span>${card.name}</span><span class="muted">${card.rarity}</span>`;
      pool.appendChild(row);
    }
  }
}

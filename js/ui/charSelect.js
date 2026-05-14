import { $, el, showScreen, toast } from './common.js';
import { state, startNewRun } from '../state.js';
import { CHARACTERS } from '../data/characters.js';
import { CARDS } from '../data/cards.js';
import { getPortraitSVG } from '../data/portraits.js';
import { saveAll } from '../storage.js';
import { renderMap } from './map.js';

// 시작 캐릭터 선택. 단일 캐릭터로 런 시작 — 동료는 보스 처치 시 합류.
const STARTABLE = ['protagonist', 'scholar', 'scout', 'hunter', 'madman', 'monk'];

let pickedId = null;

export function bindCharacterSelect() {
  document.querySelectorAll('[data-screen="character-select"] [data-action]').forEach(b => {
    b.addEventListener('click', () => onAction(b.dataset.action));
  });
}

function onAction(act) {
  switch (act) {
    case 'cs-back': pickedId = null; showScreen('title'); break;
    case 'cs-start': commitStart(); break;
  }
}

export function openCharacterSelect() {
  pickedId = null;
  renderList();
  showScreen('character-select');
  updateStartBtn();
}

function renderList() {
  const body = $('#cs-body');
  body.innerHTML = '';
  for (const id of STARTABLE) {
    const def = CHARACTERS[id];
    if (!def) continue;
    const card = el('div', { class: 'cs-card', 'data-id': id });
    const portraitWrap = el('div', { class: 'cs-portrait' });
    const svg = getPortraitSVG(id);
    if (svg) portraitWrap.innerHTML = svg;
    else portraitWrap.textContent = def.portrait || '?';
    card.appendChild(portraitWrap);

    const meta = el('div', { class: 'cs-meta' });
    meta.appendChild(el('div', { class: 'cs-name', text: def.name }));
    meta.appendChild(el('div', { class: 'cs-blurb', text: def.blurb || '' }));

    const stats = el('div', { class: 'cs-stats' });
    stats.innerHTML = `
      <span>HP <b>${def.maxHp}</b></span>
      <span>SP <b>${def.maxSp}</b></span>
      <span>슬롯 <b>${def.actionSlots}</b></span>
      <span>속도 <b>${def.speedDice.min}-${def.speedDice.max}</b></span>
      <span>빛 <b>${def.baseMaxLight}</b></span>
    `;
    meta.appendChild(stats);

    // 시작 덱 미리보기
    const deck = el('div', { class: 'cs-deck' });
    (def.startingDeck || []).forEach(cid => {
      const c = CARDS[cid];
      if (!c) return;
      const chip = el('span', { class: 'cs-deck-chip', text: c.name });
      chip.title = `${c.rarity} · ${c.desc || ''}`;
      deck.appendChild(chip);
    });
    meta.appendChild(deck);

    card.appendChild(meta);
    card.addEventListener('click', () => {
      pickedId = id;
      renderList();
      updateStartBtn();
    });
    if (pickedId === id) card.classList.add('picked');
    body.appendChild(card);
  }
}

function updateStartBtn() {
  const btn = document.querySelector('[data-action="cs-start"]');
  if (!btn) return;
  btn.disabled = !pickedId;
  if (pickedId) {
    const def = CHARACTERS[pickedId];
    btn.textContent = `${def?.name || '?'} 으로 시작`;
  } else {
    btn.textContent = '캐릭터를 선택하세요';
  }
}

function commitStart() {
  if (!pickedId) return;
  startNewRun({ partyIds: [pickedId] });
  saveAll();
  showScreen('map');
  requestAnimationFrame(() => renderMap());
  toast(`${CHARACTERS[pickedId]?.name} — 항해 시작`);
}

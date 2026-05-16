import { $, el, showScreen, toast } from './common.js';
import { state, startNewRun } from '../state.js';
import { CHARACTERS } from '../data/characters.js';
import { CARDS } from '../data/cards.js';
import { getPortraitSVG } from '../data/portraits.js';
import { applyPortrait } from '../assets.js';
import { saveAll } from '../storage.js';
import { renderMap } from './map.js';

// 시작 캐릭터 선택. 단일 캐릭터로 런 시작 — 동료는 보스 처치 시 합류.
const STARTABLE = ['protagonist', 'scholar', 'scout', 'hunter', 'madman', 'monk'];

// 시작 보너스 카드 풀 — 캐릭터를 고른 후 2장 더 선택.
const BONUS_POOL = ['insight', 'meditation', 'innerLight', 'baseEvade', 'baseGuard', 'baseParry', 'battleHymn', 'silentBlade'];
const BONUS_PICK_COUNT = 2;

let pickedId = null;
let pickedBonuses = [];

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
  pickedBonuses = [];
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
    applyPortrait(id, portraitWrap);
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
      if (pickedId !== id) pickedBonuses = []; // 캐릭터 바꾸면 보너스 초기화
      pickedId = id;
      renderList();
      updateStartBtn();
    });
    if (pickedId === id) card.classList.add('picked');
    body.appendChild(card);
  }

  // 캐릭터 고른 뒤 보너스 카드 픽
  if (pickedId) {
    body.appendChild(el('div', { class: 'cs-bonus-title', text: `시작 보너스 — 카드 ${BONUS_PICK_COUNT}장을 골라 시작 덱에 추가하세요 (${pickedBonuses.length}/${BONUS_PICK_COUNT})` }));
    const grid = el('div', { class: 'cs-bonus-grid' });
    for (const cid of BONUS_POOL) {
      const c = CARDS[cid]; if (!c) continue;
      const div = el('div', { class: 'card-pick cs-bonus' });
      const picked = pickedBonuses.includes(cid);
      if (picked) div.classList.add('picked');
      const reached = pickedBonuses.length >= BONUS_PICK_COUNT && !picked;
      if (reached) div.classList.add('disabled');
      const actionsHtml = (c.actions || []).map(a => `<div class="card-action" data-type="${a.type}"><span>${a.type}</span><span class="card-roll">${a.min}-${a.max}</span></div>`).join('');
      div.innerHTML = `
        <div class="card-cost">◆${c.light ?? 0}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-actions">${actionsHtml}</div>
        <div class="muted">${c.rarity}</div>
        <div class="card-desc">${c.desc || ''}</div>
      `;
      div.addEventListener('click', () => {
        if (picked) {
          pickedBonuses = pickedBonuses.filter(x => x !== cid);
        } else if (pickedBonuses.length < BONUS_PICK_COUNT) {
          pickedBonuses.push(cid);
        }
        renderList();
        updateStartBtn();
      });
      grid.appendChild(div);
    }
    body.appendChild(grid);
  }
}

function updateStartBtn() {
  const btn = document.querySelector('[data-action="cs-start"]');
  if (!btn) return;
  const ready = !!pickedId && pickedBonuses.length === BONUS_PICK_COUNT;
  btn.disabled = !ready;
  if (!pickedId) btn.textContent = '캐릭터를 선택하세요';
  else if (pickedBonuses.length < BONUS_PICK_COUNT) {
    btn.textContent = `보너스 카드 ${BONUS_PICK_COUNT - pickedBonuses.length}장 더 골라요`;
  } else {
    const def = CHARACTERS[pickedId];
    btn.textContent = `${def?.name || '?'} 으로 시작`;
  }
}

function commitStart() {
  if (!pickedId || pickedBonuses.length !== BONUS_PICK_COUNT) return;
  startNewRun({ partyIds: [pickedId] });
  // 보너스 카드를 그 캐릭터의 시작 덱에 추가
  const player = state.run.party.find(p => p.id === pickedId);
  if (player) {
    player.deck = player.deck || [];
    for (const cid of pickedBonuses) player.deck.push(cid);
  }
  saveAll();
  showScreen('map');
  requestAnimationFrame(() => renderMap());
  toast(`${CHARACTERS[pickedId]?.name} — 항해 시작`);
}

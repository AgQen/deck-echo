// 전투 UI: 상단(적) / 중단(합 라인 SVG) / 하단(나)
//
// 상호작용:
//   - 빈 슬롯 (+) 탭 → 카드 선택 모달
//   - 카드 우상단 ! → 확대 보기
//   - 카드 길게 누르거나 위로 드래그 → 합 라인 모드
//   - 합 라인 모드에서 적 액션을 탭 → 연결
//   - 시작 버튼 → 합 해소 애니메이션 진행

import { $, $$, el, showScreen, openModal, closeModal, toast, haptic, currentModal } from './common.js';
import { state } from '../state.js';
import { saveAll } from '../storage.js';
import { CARDS, cardCost } from '../data/cards.js';
import { PROPERTIES } from '../data/properties.js';
import { placeCard, removeCard, linkSlot, unlinkSlot, executeTurn } from '../battle.js';
import { renderMap } from './map.js';
import { xpToNext, LEVEL_CAP, LEVEL_THRESHOLDS } from '../data/progression.js';

let selectedActorId = null;
let selectedEnemyId = null;

// 합 연결 모드: 내 슬롯 하나 선택 후 적 슬롯 클릭으로 연결
let linkMode = null; // { side: 'player', actorId, slotIdx }

export function bindBattle() {
  document.querySelectorAll('[data-screen="battle"] [data-action]').forEach(btn => {
    btn.addEventListener('click', () => onBattleAction(btn.dataset.action));
  });
}

function onBattleAction(act) {
  switch (act) {
    case 'execute': onExecute(); break;
    case 'open-items': toast('아이템 — 추후 구현'); break;
    case 'open-settings':
    case 'battle-settings': openModal('settings'); break;
    case 'battle-log': showBattleLog(); break;
  }
}

export function renderBattle() {
  const battle = state.run?.inBattle;
  if (!battle) return;

  // 기본 선택값 잡기
  if (!selectedActorId || !battle.players.find(p => p.id === selectedActorId)) {
    selectedActorId = battle.players[0]?.id;
  }
  if (!selectedEnemyId || !battle.enemies.find(e => e.id === selectedEnemyId)) {
    selectedEnemyId = battle.enemies[0]?.id;
  }

  renderActorRow('#enemy-actors', battle.enemies, selectedEnemyId, id => { selectedEnemyId = id; renderBattle(); });
  renderActorRow('#player-actors', battle.players, selectedActorId, id => { selectedActorId = id; renderBattle(); });

  renderSelectedInfo('#enemy-info', battle.enemies.find(e => e.id === selectedEnemyId));
  renderSelectedInfo('#player-info', battle.players.find(p => p.id === selectedActorId));

  renderCardRail('#enemy-cards', battle.enemies.find(e => e.id === selectedEnemyId), 'enemy');
  renderCardRail('#player-cards', battle.players.find(p => p.id === selectedActorId), 'player');

  drawClashLines();
}

function renderActorRow(sel, actors, selId, onSelect) {
  const row = $(sel);
  row.innerHTML = '';
  for (const a of actors) {
    const div = el('div', { class: 'actor' + (a.id === selId ? ' selected' : '') + (a.dead ? ' dead' : '') });
    div.appendChild(el('div', { class: 'actor-portrait', text: a.portrait || '?' }));
    div.appendChild(el('div', { class: 'actor-name', text: a.name }));
    const slots = el('div', { class: 'actor-slots' });
    for (let i = 0; i < a.actionSlots; i++) {
      const dot = el('div', { class: 'slot-dot' });
      if (a.slots[i]?.card) dot.classList.add('active');
      slots.appendChild(dot);
    }
    div.appendChild(slots);
    // 상태이상 칩
    if (a.statuses && Object.keys(a.statuses).length) {
      const chips = el('div', { class: 'actor-status-row' });
      for (const [k, v] of Object.entries(a.statuses)) {
        const cls = k === '흐트러짐' ? 'status-chip disorder' : 'status-chip bad';
        chips.appendChild(el('span', { class: cls, text: `${k}${v > 1 ? ' ' + v : ''}` }));
      }
      div.appendChild(chips);
    }
    div.addEventListener('click', () => onSelect(a.id));
    row.appendChild(div);
  }
}

function renderSelectedInfo(sel, actor) {
  const root = $(sel);
  root.innerHTML = '';
  if (!actor) return;
  root.appendChild(barRow('HP', actor.hp, actor.maxHp, 'hp'));
  root.appendChild(barRow('SP', actor.sp, actor.maxSp, 'sp'));
  if (actor.side === 'player') {
    root.appendChild(progressRow(actor));
    root.appendChild(lightRow(actor));
  }
}

function progressRow(actor) {
  const next = xpToNext(actor);
  const row = el('div', { class: 'bar-row' });
  row.appendChild(el('span', { class: 'bar-label', text: `LV${actor.level}` }));
  const track = el('div', { class: 'bar-track' });
  const fill = el('div', { class: 'bar-fill xp' });
  if (next == null) {
    fill.style.width = '100%';
  } else {
    const prev = LEVEL_THRESHOLDS[actor.level] ?? 0;
    const span = Math.max(1, next - prev);
    fill.style.width = Math.max(0, Math.min(100, ((actor.xp - prev) / span) * 100)) + '%';
  }
  track.appendChild(fill);
  row.appendChild(track);
  row.appendChild(el('span', { class: 'bar-value', text: next == null ? 'MAX' : `${actor.xp}/${next}` }));
  return row;
}

function lightRow(actor) {
  const row = el('div', { class: 'bar-row light-row' });
  row.appendChild(el('span', { class: 'bar-label', text: '빛' }));
  const dots = el('div', { class: 'light-dots' });
  for (let i = 0; i < actor.maxLight; i++) {
    dots.appendChild(el('span', { class: 'light-dot' + (i < actor.light ? ' on' : '') }));
  }
  row.appendChild(dots);
  row.appendChild(el('span', { class: 'bar-value', text: `${actor.light}/${actor.maxLight}` }));
  return row;
}

function barRow(label, cur, max, kind) {
  const row = el('div', { class: 'bar-row' });
  row.appendChild(el('span', { class: 'bar-label', text: label }));
  const track = el('div', { class: 'bar-track' });
  const fill = el('div', { class: `bar-fill ${kind}` });
  fill.style.width = Math.max(0, Math.min(100, (cur / max) * 100)) + '%';
  track.appendChild(fill);
  row.appendChild(track);
  row.appendChild(el('span', { class: 'bar-value', text: `${cur} / ${max}` }));
  return row;
}

function renderCardRail(sel, actor, side) {
  const rail = $(sel);
  rail.innerHTML = '';
  if (!actor) return;
  for (let i = 0; i < actor.slots.length; i++) {
    const slot = actor.slots[i];
    const wrap = el('div', { class: 'card-slot' + (slot.card ? ' filled' : ' empty') });
    if (slot.card) {
      // 카드 있을 때는 카드 자체에서 속도 표시
      wrap.appendChild(renderCardEl(slot.card, side, actor.id, i, slot.speed));
    } else {
      // 빈 슬롯: 큰 + 와 슬롯 속도 라벨
      wrap.appendChild(el('div', { class: 'slot-plus', text: '+' }));
      wrap.appendChild(el('div', { class: 'slot-speed-empty', text: `속도 ${slot.speed ?? '?'}` }));
      if (side === 'player') {
        wrap.addEventListener('click', () => openCardPicker(actor.id, i));
      }
    }
    rail.appendChild(wrap);
  }
}

function renderCardEl(card, side, actorId, slotIdx, slotSpeed) {
  const c = el('div', { class: 'card' + (card.consumable ? ' consumable' : '') });

  // 좌상단: 빛 비용 (플레이어만)
  if (side === 'player' && card.light != null) {
    c.appendChild(el('div', { class: 'card-cost', text: '◆' + card.light }));
  }

  // 우상단: ✕ 제거 (플레이어만)
  if (side === 'player') {
    const rb = el('button', { class: 'card-remove-btn', text: '✕' });
    rb.addEventListener('click', (ev) => {
      ev.stopPropagation();
      removeCard(state.run.inBattle, actorId, slotIdx);
      linkMode = null;
      renderBattle();
    });
    c.appendChild(rb);
  }

  // 카드 이름
  c.appendChild(el('div', { class: 'card-name', text: card.name }));

  // 액션 칩들 (정보용 — 클릭은 카드 본체로 받음)
  const list = el('div', { class: 'card-actions' });
  for (let i = 0; i < card.actions.length; i++) {
    const a = card.actions[i];
    const ae = el('div', { class: 'card-action', 'data-type': a.type });
    ae.innerHTML = `<span>${a.type}</span><span class="card-roll">${a.min}-${a.max}</span>`;
    if (a.property) ae.appendChild(el('span', { class: 'card-prop', text: a.property }));
    ae.dataset.actionIdx = String(i);
    list.appendChild(ae);
  }
  c.appendChild(list);

  // 우하단: 슬롯 속도
  if (slotSpeed != null) {
    c.appendChild(el('div', { class: 'card-speed-tag', text: '⚡' + slotSpeed }));
  }

  // 링크 모드 시각화 (선택된 자기 슬롯)
  if (linkMode && linkMode.side === side && linkMode.actorId === actorId && linkMode.slotIdx === slotIdx) {
    c.classList.add('link-source');
  }

  // 카드 클릭 = 합 연결 시도. 길게 누르기 = 확대.
  let pressTimer = null;
  let longPressFired = false;
  const onDown = (ev) => {
    if (ev.target.closest('.card-remove-btn')) return;
    longPressFired = false;
    pressTimer = setTimeout(() => {
      longPressFired = true;
      openCardZoom(card);
    }, 480);
  };
  const onUp = (ev) => {
    clearTimeout(pressTimer);
    if (longPressFired) return;
    if (ev.target.closest('.card-remove-btn')) return;
    onCardClick({ side, actorId, slotIdx });
  };
  const cancel = () => clearTimeout(pressTimer);
  c.addEventListener('pointerdown', onDown);
  c.addEventListener('pointerup', onUp);
  c.addEventListener('pointerleave', cancel);
  c.addEventListener('pointercancel', cancel);
  return c;
}

// 카드 클릭: 내 카드면 링크 시작/취소, 적 카드면 링크 완성
function onCardClick(ref) {
  const battle = state.run?.inBattle;
  if (!battle) return;
  if (ref.side === 'player') {
    // 자기 카드 다시 클릭 → 링크 모드 취소 (이미 링크 되어 있다면 풀기)
    if (linkMode && linkMode.actorId === ref.actorId && linkMode.slotIdx === ref.slotIdx) {
      unlinkSlot(battle, { side: 'player', actorId: ref.actorId, slotIdx: ref.slotIdx });
      linkMode = null;
      renderBattle();
      return;
    }
    linkMode = ref;
    haptic(8);
    toast('합칠 적 카드를 누르세요 (자기 카드 다시 누르면 취소)');
    renderBattle();
  } else {
    // 적 카드 클릭 → 링크 시도
    if (!linkMode) {
      toast('먼저 내 카드를 누르세요');
      return;
    }
    const res = linkSlot(battle, linkMode, { side: ref.side, actorId: ref.actorId, slotIdx: ref.slotIdx });
    if (!res.ok) {
      if (res.reason === 'too_slow') toast('속도가 부족해서 연결 불가 (상대보다 빨라야 함)');
      else if (res.reason === 'no_slot') toast('연결할 카드가 없습니다');
      else if (res.reason === 'same_side') toast('같은 편에는 연결 불가');
      else toast('연결 불가');
      return;
    }
    linkMode = null;
    renderBattle();
  }
}


// 계획 단계 라인 그리기.
//   - linkedTo: 슬롯-슬롯 노란 곡선
//   - 미연결 공격 카드: 가장 왼쪽 살아있는 상대 아바타로 빨간 점선 화살표
function drawClashLines() {
  const svg = $('#clash-svg');
  if (!svg) return;
  svg.innerHTML = '';
  const battle = state.run?.inBattle;
  if (!battle) return;

  const rect = svg.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <marker id="arr-red" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#e06060" />
    </marker>
  `;
  svg.appendChild(defs);

  const centerOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - rect.left, y: r.top + r.height / 2 - rect.top };
  };

  function slotEl(side, slotIdx) {
    const sel = side === 'player' ? '#player-cards' : '#enemy-cards';
    return document.querySelector(`${sel} .card-slot:nth-child(${slotIdx + 1})`);
  }

  // ── 1) 노란 합 곡선 (slot → slot)
  const players = battle.players;
  const enemies = battle.enemies;
  const selPlayer = players.find(p => p.id === selectedActorId);
  const selEnemy = enemies.find(e => e.id === selectedEnemyId);

  function drawClashCurve(srcSide, srcSlotIdx, dstSide, dstSlotIdx) {
    const srcEl = slotEl(srcSide, srcSlotIdx);
    const dstEl = slotEl(dstSide, dstSlotIdx);
    const a = centerOf(srcEl), b = centerOf(dstEl);
    if (!a || !b) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const mx = (a.x + b.x) / 2;
    path.setAttribute('d', `M ${a.x} ${a.y} Q ${mx} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`);
    path.setAttribute('class', 'clash-line');
    svg.appendChild(path);
  }

  if (selPlayer) {
    for (let si = 0; si < selPlayer.slots.length; si++) {
      const slot = selPlayer.slots[si];
      if (!slot.card || !slot.linkedTo) continue;
      if (slot.linkedTo.actorId !== selectedEnemyId) continue;
      drawClashCurve('player', si, 'enemy', slot.linkedTo.slotIdx);
    }
  }
  if (selEnemy) {
    for (let si = 0; si < selEnemy.slots.length; si++) {
      const slot = selEnemy.slots[si];
      if (!slot.card || !slot.linkedTo) continue;
      if (slot.linkedTo.actorId !== selectedActorId) continue;
      drawClashCurve('enemy', si, 'player', slot.linkedTo.slotIdx);
    }
  }

  // ── 2) 빨간 단방향 화살표 (미연결 공격이 가장 왼쪽 상대로 향함)
  const firstEnemy = enemies.find(e => !e.dead);
  const firstPlayer = players.find(p => !p.dead);

  function drawOnewayArrow(srcEl, dstEl) {
    const a = centerOf(srcEl), b = centerOf(dstEl);
    if (!a || !b) return;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('class', 'oneway-line');
    line.setAttribute('marker-end', 'url(#arr-red)');
    svg.appendChild(line);
  }

  if (selPlayer && firstEnemy) {
    for (let si = 0; si < selPlayer.slots.length; si++) {
      const slot = selPlayer.slots[si];
      if (!slot.card || slot.linkedTo) continue;
      const hasAttack = slot.card.actions.some(a => a.type === '공격');
      if (!hasAttack) continue;
      const enemyIdx = enemies.findIndex(e => e.id === firstEnemy.id);
      const dstEl = document.querySelectorAll('#enemy-actors .actor')[enemyIdx];
      drawOnewayArrow(slotEl('player', si), dstEl);
    }
  }
  if (selEnemy && firstPlayer) {
    for (let si = 0; si < selEnemy.slots.length; si++) {
      const slot = selEnemy.slots[si];
      if (!slot.card || slot.linkedTo) continue;
      const hasAttack = slot.card.actions.some(a => a.type === '공격');
      if (!hasAttack) continue;
      const playerIdx = players.findIndex(p => p.id === firstPlayer.id);
      const dstEl = document.querySelectorAll('#player-actors .actor')[playerIdx];
      drawOnewayArrow(slotEl('enemy', si), dstEl);
    }
  }
}

// 카드 선택 모달
function openCardPicker(actorId, slotIdx) {
  const battle = state.run.inBattle;
  const player = battle.players.find(p => p.id === actorId);
  const hand = battle.hand[actorId] || [];
  const grid = $('#card-pick-grid');
  grid.innerHTML = '';
  // 기존 카드 환불액 고려한 가용 빛
  const prevCard = player.slots[slotIdx]?.card;
  const refund = prevCard?.id ? cardCost(CARDS[prevCard.id] || {}) : 0;
  const availableLight = player.light + refund;
  $('#card-pick-meta').textContent = `슬롯 ${slotIdx + 1} · 속도 ${player.slots[slotIdx].speed} · 빛 ${availableLight}/${player.maxLight}`;
  if (hand.length === 0) {
    grid.appendChild(el('div', { class: 'muted', text: '손에 카드가 없습니다' }));
  }
  for (const cid of hand) {
    const card = CARDS[cid];
    if (!card) continue;
    const cost = cardCost(card);
    const affordable = cost <= availableLight;
    const div = el('div', { class: 'card-pick' + (card.consumable ? ' consumable' : '') + (affordable ? '' : ' disabled') });
    div.innerHTML = `
      <div class="card-cost">◆${cost}</div>
      <div class="card-name">${card.name}</div>
      <div class="card-actions">
        ${card.actions.map(a => `<div class="card-action" data-type="${a.type}"><span>${a.type}</span><span class="card-roll">${a.min}-${a.max}</span></div>`).join('')}
      </div>
      <div class="muted">${card.rarity}${card.consumable ? ' · 소모' : ''}</div>
    `;
    div.addEventListener('click', () => {
      const res = placeCard(battle, actorId, slotIdx, cid);
      if (!res.ok) {
        if (res.reason === 'no_light') toast(`빛 부족 (필요 ${res.need}, 보유 ${res.have})`);
        else toast('배치 실패');
        return;
      }
      closeModal();
      renderBattle();
    });
    grid.appendChild(div);
  }
  openModal('card-pick');
}

function openCardZoom(card) {
  const wrap = $('#card-zoom-wrap');
  wrap.innerHTML = '';
  const z = el('div', { class: 'card-zoomed' });
  z.innerHTML = `
    <div class="card-name">${card.name}</div>
    <div class="card-actions">
      ${card.actions.map(a => `<div class="card-action" data-type="${a.type}"><span>${a.type}</span><span class="card-roll">${a.min}-${a.max}</span><span class="card-prop">${a.property || ''}</span></div>`).join('')}
    </div>
    <div class="card-desc">${card.desc || ''}</div>
  `;
  wrap.appendChild(z);
  openModal('card-zoom');
}

function showBattleLog() {
  const battle = state.run.inBattle;
  if (!battle) return;
  const lines = battle.log.slice(-12).map(formatLog).join('\n');
  toast(lines || '아직 기록 없음', 4000);
}

function formatLog(ev) {
  switch (ev.type) {
    case 'turnStart': return `[턴 ${ev.turn}]`;
    case 'clash':     return `${ev.src.actor}(${ev.src.action}/${ev.src.roll}) ↔ ${ev.dst.actor}(${ev.dst.action}/${ev.dst.roll}) → ${ev.winner === 'a' ? '내 승' : ev.winner === 'b' ? '적 승' : '동률'}`;
    case 'unopposed': return `${ev.src} → ${ev.dst} (${ev.prop} ${ev.amount}, 미연결)`;
    default: return JSON.stringify(ev);
  }
}

async function onExecute() {
  const battle = state.run.inBattle;
  if (!battle) return;
  if (battle.phase !== 'plan') return;

  const execBtn = document.querySelector('[data-action="execute"]');
  if (execBtn) execBtn.disabled = true;

  // 시작 버튼 누르면 계획 라인은 지우고 중앙에서만 진행
  const svg = $('#clash-svg');
  if (svg) svg.innerHTML = '';

  try {
    await executeTurn(battle, {
      onClash: animateClash,
      onUnopposed: animateOneway,
      onAfterHit: animateHitResult,
    });
  } catch (e) {
    console.error(e);
    toast('전투 진행 중 오류: ' + (e.message || e));
  } finally {
    if (execBtn) execBtn.disabled = false;
  }

  renderBattle();

  if (battle.phase === 'done') {
    setTimeout(() => endBattle(battle), 700);
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 중앙에 합/일방 무대를 띄우고, 숫자를 굴린 후 승자/패자 강조
async function animateClash({ source, target, aRoll, bRoll, winner }) {
  const arena = makeArena({
    mode: 'clash',
    leftName: source.actor.name, leftAction: source.action.type,
    rightName: target.actor.name, rightAction: target.action.type,
  });
  attachArena(arena);
  await rollNumbers(arena, aRoll, bRoll, 650);
  const aEl = arena.querySelector('.num-a');
  const bEl = arena.querySelector('.num-b');
  if (winner === 'a') { aEl.classList.add('winner'); bEl.classList.add('loser'); }
  else if (winner === 'b') { bEl.classList.add('winner'); aEl.classList.add('loser'); }
  // result 라벨
  const tag = arena.querySelector('.arena-vs');
  if (tag) tag.textContent = winner === 'a' ? '◀' : winner === 'b' ? '▶' : '=';
  await sleep(450);
}

async function animateOneway({ source, target, roll }) {
  const arena = makeArena({
    mode: 'oneway',
    leftName: source.actor.name, leftAction: source.action.type,
    rightName: target?.name || '?', rightAction: '—',
    solo: true,
  });
  attachArena(arena);
  await rollNumbers(arena, roll, null, 500);
  arena.querySelector('.num-a').classList.add('winner');
  arena.querySelector('.num-b').classList.add('loser');
  await sleep(350);
}

// 데미지 적용 직후: 행위자 위에 -N 팝업 + 흔들기, HP/SP 바 갱신, 무대 제거
async function animateHitResult({ source, target, before }) {
  const battle = state.run.inBattle;
  function emitPopupAndShake(actor, beforeSide) {
    if (!actor || !beforeSide) return;
    const dHp = beforeSide.hp - actor.hp;
    const dSp = beforeSide.sp - actor.sp;
    if (dHp > 0) showDamagePopup(actor, dHp, 'hp');
    if (dSp > 0) showDamagePopup(actor, dSp, 'sp');
    if (dHp > 0 || dSp > 0) {
      const el = findActorEl(actor);
      if (el) {
        el.classList.add('hit');
        setTimeout(() => el.classList.remove('hit'), 320);
      }
    }
  }
  emitPopupAndShake(source, before.a);
  emitPopupAndShake(target, before.b);

  // HP/SP/상태 갱신
  renderActorRow('#enemy-actors', battle.enemies, selectedEnemyId, id => { selectedEnemyId = id; renderBattle(); });
  renderActorRow('#player-actors', battle.players, selectedActorId, id => { selectedActorId = id; renderBattle(); });
  renderSelectedInfo('#enemy-info', battle.enemies.find(e => e.id === selectedEnemyId));
  renderSelectedInfo('#player-info', battle.players.find(p => p.id === selectedActorId));

  await sleep(620);
  // 현재 무대 제거
  const cur = document.querySelector('#zone-mid .arena');
  if (cur) cur.remove();
  await sleep(120);
}

function makeArena({ mode, leftName, leftAction, rightName, rightAction, solo }) {
  const div = document.createElement('div');
  div.className = 'arena';
  div.innerHTML = `
    <div class="arena-mode ${mode === 'clash' ? 'clash' : 'oneway'}">${mode === 'clash' ? '합' : '일방공격'}</div>
    <div class="arena-side">
      <div class="arena-actor">${escapeHtml(leftName)}</div>
      <div class="arena-action">${escapeHtml(leftAction)}</div>
      <div class="arena-num num-a">?</div>
    </div>
    <div class="arena-vs">${mode === 'clash' ? 'VS' : '→'}</div>
    <div class="arena-side">
      <div class="arena-actor">${escapeHtml(rightName)}</div>
      <div class="arena-action">${escapeHtml(rightAction)}</div>
      <div class="arena-num num-b">${solo ? '—' : '?'}</div>
    </div>
  `;
  return div;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function attachArena(arena) {
  // 기존 무대 있으면 제거
  document.querySelectorAll('#zone-mid .arena').forEach(a => a.remove());
  $('#zone-mid').appendChild(arena);
}

function rollNumbers(arena, finalA, finalB, durationMs) {
  return new Promise(resolve => {
    const aEl = arena.querySelector('.num-a');
    const bEl = arena.querySelector('.num-b');
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= durationMs) {
        clearInterval(id);
        aEl.textContent = String(finalA);
        if (finalB != null) bEl.textContent = String(finalB);
        resolve();
        return;
      }
      aEl.textContent = String(Math.floor(Math.random() * 9 + 1));
      if (finalB != null) bEl.textContent = String(Math.floor(Math.random() * 9 + 1));
    }, 55);
  });
}

function findActorEl(actor) {
  if (!actor) return null;
  const battle = state.run?.inBattle;
  if (!battle) return null;
  if (actor.side === 'enemy') {
    const idx = battle.enemies.findIndex(e => e.id === actor.id);
    return document.querySelectorAll('#enemy-actors .actor')[idx];
  } else {
    const idx = battle.players.findIndex(p => p.id === actor.id);
    return document.querySelectorAll('#player-actors .actor')[idx];
  }
}

function showDamagePopup(actor, amount, kind) {
  const el = findActorEl(actor);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const popup = document.createElement('div');
  popup.className = 'dmg-popup ' + kind;
  popup.textContent = '-' + amount;
  popup.style.cssText = `position:fixed;left:${rect.left + rect.width / 2}px;top:${rect.top}px;`;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 1000);
}

function endBattle(battle) {
  const run = state.run;
  // HP/SP 결과를 파티에 반영
  for (const p of battle.players) {
    const orig = run.party.find(x => x.id === p.id);
    if (orig) { orig.hp = p.hp; orig.sp = p.sp; }
  }
  if (battle.victory) {
    toast('승리!', 1800);
    run.map.cleared[battle.mapNodeId] = true;
  } else {
    toast('패배… 진행이 종료됩니다', 2400);
  }
  run.inBattle = null;
  saveAll();
  setTimeout(() => {
    if (battle.victory) {
      showScreen('map');
      renderMap();
    } else {
      // 사망 → 초기화
      // (영구 진행 시스템은 추후)
      localStorage.removeItem('deckEcho.save');
      state.run = null;
      showScreen('title');
    }
  }, 900);
}

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
import { placeCard, removeCard, linkAction, executeTurn } from '../battle.js';
import { renderMap } from './map.js';
import { xpToNext, LEVEL_CAP, LEVEL_THRESHOLDS } from '../data/progression.js';

let selectedSide = 'player';
let selectedActorId = null;
let selectedEnemyId = null;

// 합 연결 모드 상태
let linkMode = null; // { actorId, slotIdx, actionIdx, side: 'player' }

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
      renderBattle();
    });
    c.appendChild(rb);
  }

  // 카드 이름 (양 옆 비용/제거 버튼 공간 확보 위해 padded)
  c.appendChild(el('div', { class: 'card-name', text: card.name }));

  // 액션 칩들
  const list = el('div', { class: 'card-actions' });
  for (let i = 0; i < card.actions.length; i++) {
    const a = card.actions[i];
    const ae = el('div', { class: 'card-action', 'data-type': a.type });
    ae.innerHTML = `<span>${a.type}</span><span class="card-roll">${a.min}-${a.max}</span>`;
    if (a.property) ae.appendChild(el('span', { class: 'card-prop', text: a.property }));
    ae.dataset.actionIdx = String(i);
    ae.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onActionClick({ side, actorId, slotIdx, actionIdx: i });
    });
    list.appendChild(ae);
  }
  c.appendChild(list);

  // 우하단: 슬롯 속도 (작게)
  if (slotSpeed != null) {
    c.appendChild(el('div', { class: 'card-speed-tag', text: '⚡' + slotSpeed }));
  }

  // 카드 본체 길게 누르기 = 확대 보기 (액션 칩/제거 버튼은 제외)
  let pressTimer = null;
  const onDown = (ev) => {
    if (ev.target.closest('.card-action, .card-remove-btn')) return;
    pressTimer = setTimeout(() => openCardZoom(card), 450);
  };
  const cancel = () => clearTimeout(pressTimer);
  c.addEventListener('pointerdown', onDown);
  c.addEventListener('pointerup', cancel);
  c.addEventListener('pointerleave', cancel);
  c.addEventListener('pointercancel', cancel);
  return c;
}

// 액션 클릭 — 연결 모드 시작/종료
function onActionClick(ref) {
  const battle = state.run.inBattle;
  if (!battle) return;
  if (!linkMode) {
    if (ref.side !== 'player') {
      // 적 액션을 먼저 누른 경우는 아무 동작 없음 — 플레이어가 자기 카드로 시작해야 함
      return;
    }
    linkMode = ref;
    haptic(10);
    toast('합 대상을 선택하세요');
    highlightLinkable(ref);
  } else {
    // 같은 카드/액션 재클릭 → 취소
    if (linkMode.side === ref.side && linkMode.actorId === ref.actorId && linkMode.slotIdx === ref.slotIdx && linkMode.actionIdx === ref.actionIdx) {
      linkMode = null; clearHighlight(); return;
    }
    if (ref.side === linkMode.side) {
      // 같은 편을 누르면 연결 시작점 변경
      linkMode = ref; highlightLinkable(ref); return;
    }
    // 시도
    const ok = linkAction(battle, linkMode, ref);
    if (!ok) toast('속도가 부족해서 연결 불가');
    linkMode = null;
    clearHighlight();
    renderBattle();
  }
}

function highlightLinkable(ref) {
  clearHighlight();
  const battle = state.run.inBattle;
  const srcActor = (ref.side === 'player' ? battle.players : battle.enemies).find(a => a.id === ref.actorId);
  const srcSpeed = srcActor.slots[ref.slotIdx]?.speed ?? 0;
  const targets = ref.side === 'player' ? battle.enemies : battle.players;
  for (const tgt of targets) {
    for (let si = 0; si < tgt.slots.length; si++) {
      const ts = tgt.slots[si];
      if (!ts.card || ts.speed > srcSpeed) continue;
      // DOM에서 해당 액션들에 강조
      // (현재 단순 구현: 대상 카드 전체에 표시)
      // 추후 더 정밀하게.
    }
  }
}
function clearHighlight() {
  $$('.card.locked-target').forEach(c => c.classList.remove('locked-target'));
}

// 계획 단계 라인 그리기. 합은 노란 곡선, 일방공격은 빨간 점선 화살표.
function drawClashLines() {
  const svg = $('#clash-svg');
  if (!svg) return;
  svg.innerHTML = '';
  const battle = state.run?.inBattle;
  if (!battle) return;

  const rect = svg.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

  // 화살표 마커 정의
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

  // 어떤 액션들이 합으로 연결되어 있는지 표시용 셋 — 미연결 화살표에서 제외하기 위함
  const linkedKey = new Set();
  const k = (side, actorId, slotIdx, actionIdx) => `${side}:${actorId}:${slotIdx}:${actionIdx}`;

  // ── 1) 양방향 합 라인 (노란 곡선)
  for (const p of battle.players) {
    for (let si = 0; si < p.slots.length; si++) {
      const slot = p.slots[si];
      if (!slot.card) continue;
      for (const pl of slot.plan) {
        const tgt = pl.target;
        linkedKey.add(k('player', p.id, si, pl.actionIdx));
        linkedKey.add(k(tgt.side, tgt.actorId, tgt.slotIdx, tgt.actionIdx));
        if (p.id !== selectedActorId) continue;
        if (tgt.actorId !== selectedEnemyId) continue;
        const srcEl = document.querySelector(`#player-cards .card-slot:nth-child(${si + 1}) .card-action[data-action-idx="${pl.actionIdx}"]`);
        const dstEl = document.querySelector(`#enemy-cards .card-slot:nth-child(${tgt.slotIdx + 1}) .card-action[data-action-idx="${tgt.actionIdx}"]`);
        const a = centerOf(srcEl), b = centerOf(dstEl);
        if (!a || !b) continue;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const mx = (a.x + b.x) / 2;
        path.setAttribute('d', `M ${a.x} ${a.y} Q ${mx} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`);
        path.setAttribute('class', 'clash-line');
        svg.appendChild(path);
      }
    }
  }
  // 적측 plan에 등록된 합도 표시 (적이 player를 향해 잠근 경우는 별로 없지만 안전망)
  for (const e of battle.enemies) {
    for (let si = 0; si < e.slots.length; si++) {
      const slot = e.slots[si];
      if (!slot.card) continue;
      for (const pl of slot.plan) {
        if (pl.target.slotIdx == null) continue;
        linkedKey.add(k('enemy', e.id, si, pl.actionIdx));
        linkedKey.add(k(pl.target.side, pl.target.actorId, pl.target.slotIdx, pl.target.actionIdx));
      }
    }
  }

  // ── 2) 미연결 공격/반격 = 빨간 화살표 (선택된 캐릭터/적 한정)
  const firstAliveEnemy = battle.enemies.find(en => !en.dead);
  const firstAlivePlayer = battle.players.find(pl => !pl.dead);

  // 플레이어 → 적 아바타
  const selPlayer = battle.players.find(p => p.id === selectedActorId);
  if (selPlayer && firstAliveEnemy) {
    for (let si = 0; si < selPlayer.slots.length; si++) {
      const slot = selPlayer.slots[si];
      if (!slot.card) continue;
      for (let ai = 0; ai < slot.card.actions.length; ai++) {
        const act = slot.card.actions[ai];
        if (act.type !== '공격' && act.type !== '반격') continue;
        if (linkedKey.has(k('player', selPlayer.id, si, ai))) continue;
        const srcEl = document.querySelector(`#player-cards .card-slot:nth-child(${si + 1}) .card-action[data-action-idx="${ai}"]`);
        const enemyIdx = battle.enemies.findIndex(en => en.id === firstAliveEnemy.id);
        const dstEl = document.querySelectorAll('#enemy-actors .actor')[enemyIdx];
        const a = centerOf(srcEl), b = centerOf(dstEl);
        if (!a || !b) continue;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
        line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
        line.setAttribute('class', 'oneway-line');
        line.setAttribute('marker-end', 'url(#arr-red)');
        svg.appendChild(line);
      }
    }
  }

  // 선택된 적 → 플레이어 아바타
  const selEnemy = battle.enemies.find(en => en.id === selectedEnemyId);
  if (selEnemy && firstAlivePlayer) {
    for (let si = 0; si < selEnemy.slots.length; si++) {
      const slot = selEnemy.slots[si];
      if (!slot.card) continue;
      for (let ai = 0; ai < slot.card.actions.length; ai++) {
        const act = slot.card.actions[ai];
        if (act.type !== '공격' && act.type !== '반격') continue;
        if (linkedKey.has(k('enemy', selEnemy.id, si, ai))) continue;
        const srcEl = document.querySelector(`#enemy-cards .card-slot:nth-child(${si + 1}) .card-action[data-action-idx="${ai}"]`);
        const playerIdx = battle.players.findIndex(pl => pl.id === firstAlivePlayer.id);
        const dstEl = document.querySelectorAll('#player-actors .actor')[playerIdx];
        const a = centerOf(srcEl), b = centerOf(dstEl);
        if (!a || !b) continue;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
        line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
        line.setAttribute('class', 'oneway-line');
        line.setAttribute('marker-end', 'url(#arr-red)');
        svg.appendChild(line);
      }
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

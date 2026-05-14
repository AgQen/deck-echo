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
import { placeCard, removeCard, engageActor, disengageActor, routeEnemySlot, clearEnemySlotRoute, executeTurn } from '../battle.js';
import { renderMap, openReward } from './map.js';
import { xpToNext, LEVEL_CAP, LEVEL_THRESHOLDS } from '../data/progression.js';
import { RELICS } from '../data/relics.js';
import { STATUSES as STATUS_DEFS } from '../data/statuses.js';

let selectedActorId = null;
let selectedEnemyId = null;

// 교전 모드: 내 캐릭터 → 적 캐릭터를 짝지어 교전.
// 한번 교전이 잡히면 그 캐릭터의 모든 공격이 그 적을 향함.
let linkMode = null; // { side: 'player', actorId }

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

  // 어느 액터 아바타든 탭하면 선택 + 교전 제스처 둘 다 동작.
  renderActorRow('#enemy-actors', battle.enemies, selectedEnemyId, id => {
    selectedEnemyId = id;
    onCardClick({ side: 'enemy', actorId: id });
  });
  renderActorRow('#player-actors', battle.players, selectedActorId, id => {
    selectedActorId = id;
    onCardClick({ side: 'player', actorId: id });
  });

  renderSelectedInfo('#enemy-info', battle.enemies.find(e => e.id === selectedEnemyId));
  renderSelectedInfo('#player-info', battle.players.find(p => p.id === selectedActorId));

  renderCardRail('#enemy-cards', battle.enemies.find(e => e.id === selectedEnemyId), 'enemy');
  renderCardRail('#player-cards', battle.players.find(p => p.id === selectedActorId), 'player');

  drawClashLines();
}

function renderActorRow(sel, actors, selId, onSelect) {
  const row = $(sel);
  row.innerHTML = '';
  const battle = state.run?.inBattle;
  // 교전 관계 표시용
  const engagedAsTarget = new Set();
  for (const p of (battle?.players || [])) {
    if (p.targetActorId) engagedAsTarget.add(p.targetActorId);
  }
  for (const a of actors) {
    let cls = 'actor' + (a.id === selId ? ' selected' : '') + (a.dead ? ' dead' : '');
    if (a.targetActorId) cls += ' engaged';
    if (engagedAsTarget.has(a.id)) cls += ' engaged-target';
    if (linkMode && linkMode.side !== 'enemy' || (linkMode && linkMode.side === 'enemy' && !linkMode.slotIdx && linkMode.actorId === a.id)) {
      // 그냥 모드 표시는 link-source만 사용
    }
    if (linkMode && linkMode.actorId === a.id && linkMode.slotIdx == null) cls += ' link-source';
    const div = el('div', { class: cls });

    // 속도 오브 — 합 연결용 아이콘. 양측 모두 "전장 앞쪽"(중앙)으로 향함.
    //   적: portrait 아래 (중앙 쪽), 플레이어: portrait 위 (중앙 쪽)
    const orbs = el('div', { class: 'speed-orbs' });
    for (let i = 0; i < a.actionSlots; i++) {
      const slot = a.slots[i];
      let orbCls = 'speed-orb' + (slot?.card ? ' filled' : '');
      if (slot?.targetPlayerId) orbCls += ' routed';
      if (linkMode && linkMode.side === a.side && linkMode.actorId === a.id && linkMode.slotIdx === i) orbCls += ' link-source';
      const orb = el('div', { class: orbCls, text: String(slot?.speed ?? '?') });
      orb.setAttribute('data-actor-id', a.id);
      orb.setAttribute('data-side', a.side);
      orb.setAttribute('data-slot-idx', String(i));
      orb.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (a.side === 'enemy' && slot?.card) {
          onCardClick({ side: 'enemy', actorId: a.id, slotIdx: i });
        } else {
          onCardClick({ side: a.side, actorId: a.id, slotIdx: i });
        }
      });
      orbs.appendChild(orb);
    }

    // 플레이어: 오브가 portrait 위로 (캐릭터 위에 떠 있음)
    if (a.side === 'player') div.appendChild(orbs);
    div.appendChild(el('div', { class: 'actor-portrait', text: a.portrait || '?' }));
    div.appendChild(el('div', { class: 'actor-name', text: a.name }));

    // HP/SP 미니 게이지
    const mini = el('div', { class: 'actor-mini' });
    const hpBar = el('div', { class: 'mini-bar hp' });
    const hpFill = el('div', { class: 'mini-fill' });
    hpFill.style.width = Math.max(0, Math.min(100, (a.hp / a.maxHp) * 100)) + '%';
    hpBar.appendChild(hpFill);
    const spBar = el('div', { class: 'mini-bar sp' });
    const spFill = el('div', { class: 'mini-fill' });
    spFill.style.width = Math.max(0, Math.min(100, (a.sp / a.maxSp) * 100)) + '%';
    spBar.appendChild(spFill);
    mini.appendChild(hpBar);
    mini.appendChild(spBar);
    div.appendChild(mini);

    // 적: 오브가 portrait 아래 (캐릭터 발치)
    if (a.side === 'enemy') div.appendChild(orbs);
    // 상태이상 칩 (호버: title 툴팁, 탭: 설명 토스트)
    if (a.statuses && Object.keys(a.statuses).length) {
      const chips = el('div', { class: 'actor-status-row' });
      for (const [k, v] of Object.entries(a.statuses)) {
        const cls = k === '흐트러짐' ? 'status-chip disorder' : 'status-chip bad';
        const def = STATUS_DEFS?.[k];
        const desc = def?.desc || k;
        const chip = el('span', { class: cls, text: `${k}${v > 1 ? ' ' + v : ''}` });
        chip.title = `${k} ${v} — ${desc}`;
        chip.addEventListener('click', (ev) => {
          ev.stopPropagation();
          toast(`${k} ${v}: ${desc}`, 2400);
        });
        chips.appendChild(chip);
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
    let cls = 'card-slot' + (slot.card ? ' filled' : ' empty');
    // 적 슬롯이 라우팅 짝지어졌으면 강조
    if (side === 'enemy' && slot.targetPlayerId) cls += ' routed';
    // 현재 link 모드의 ref가 이 적 슬롯이면 강조
    if (linkMode && linkMode.side === side && linkMode.actorId === actor.id && linkMode.slotIdx === i) cls += ' link-source';
    const wrap = el('div', { class: cls });
    if (slot.card) {
      wrap.appendChild(renderCardEl(slot.card, side, actor.id, i, slot.speed));
      // 적 카드 슬롯 클릭 → 슬롯 단위 라우팅 짝짓기
      if (side === 'enemy') {
        wrap.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onCardClick({ side: 'enemy', actorId: actor.id, slotIdx: i });
        });
      }
    } else {
      wrap.appendChild(el('div', { class: 'slot-plus', text: '+' }));
      wrap.appendChild(el('div', { class: 'slot-speed-empty', text: `속도 ${slot.speed ?? '?'}` }));
      if (side === 'player') {
        wrap.addEventListener('click', () => {
          if (linkMode) {
            linkMode = null;
            renderBattle();
            return;
          }
          openCardPicker(actor.id, i);
        });
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
  for (let i = 0; i < (card.actions || []).length; i++) {
    const a = card.actions[i];
    const ae = el('div', { class: 'card-action', 'data-type': a.type });
    ae.innerHTML = `<span>${a.type}</span><span class="card-roll">${a.min}-${a.max}</span>`;
    if (a.property) ae.appendChild(el('span', { class: 'card-prop', text: a.property }));
    ae.dataset.actionIdx = String(i);
    list.appendChild(ae);
  }
  // 유틸 효과 칩
  if (card.id && CARDS[card.id]?.effects) {
    for (const eff of CARDS[card.id].effects) {
      const ce = el('div', { class: 'card-action', 'data-type': 'effect', text: effectLabel(eff) });
      list.appendChild(ce);
    }
  }
  c.appendChild(list);

  // 우하단: 슬롯 속도
  if (slotSpeed != null) {
    c.appendChild(el('div', { class: 'card-speed-tag', text: '⚡' + slotSpeed }));
  }

  // 교전 모드 시각화 (해당 캐릭터의 카드 전체 강조)
  if (linkMode && linkMode.side === side && linkMode.actorId === actorId) {
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

// 양방향 짝짓기 — 어느 쪽을 먼저 탭해도 OK.
//   ref 종류:
//     player avatar/card → 내 캐릭터 단위
//     enemy avatar → 적 캐릭터 단위 (교전 대상으로만 쓰임)
//     enemy card (slotIdx 포함) → 그 적 슬롯 단위 라우팅
//
//   결과 매핑:
//     player + enemy avatar → engageActor (player.targetActorId = enemy.id)
//     player + enemy slot   → routeEnemySlot (enemySlot.targetPlayerId = player.id)
//     enemy slot + player   → 같음
//
//   자동 해제 없음: 새 짝짓기는 그 한 값만 덮어쓰고 다른 짝짓기는 그대로.
function onCardClick(ref) {
  const battle = state.run?.inBattle;
  if (!battle) return;

  const sameRef = (a, b) =>
    a && b && a.side === b.side && a.actorId === b.actorId && a.slotIdx === b.slotIdx;

  // A) linkMode 있고 반대편 탭 → 짝짓기 (혹은 같은 짝 재선택 시 해제)
  //    핵심: 캐릭터 교전은 무조건 덮어씀 (스틸 가능).
  //    같은 페어 재탭하면 해당 짝짓기만 해제.
  if (linkMode && linkMode.side !== ref.side) {
    const playerRef = linkMode.side === 'player' ? linkMode : ref;
    const enemyRef  = linkMode.side === 'enemy'  ? linkMode : ref;
    const player = battle.players.find(p => p.id === playerRef.actorId);
    const enemy  = battle.enemies.find(e => e.id === enemyRef.actorId);
    if (!player || !enemy) { linkMode = null; renderBattle(); return; }

    // 적 슬롯 단위 라우팅이 활성화될 짝짓기인지
    const isSlotRoute = enemyRef.slotIdx != null;

    if (isSlotRoute) {
      const slot = enemy.slots[enemyRef.slotIdx];
      if (slot?.targetPlayerId === player.id) {
        // 같은 슬롯-같은 플레이어 재탭 → 라우팅 해제 (캐릭터 교전은 유지)
        clearEnemySlotRoute(battle, enemy.id, enemyRef.slotIdx);
        toast(`${enemy.name} 카드 라우팅 해제`);
      } else {
        // 스틸/재할당
        routeEnemySlot(battle, enemy.id, enemyRef.slotIdx, player.id);
        // 캐릭터 교전도 동시에 (이미 잡혀 있어도 덮어쓰기)
        engageActor(battle, { side: 'player', actorId: player.id }, { side: 'enemy', actorId: enemy.id });
        toast(`${player.name} ↔ ${enemy.name} 교전 + 카드 라우팅`);
      }
    } else {
      // 캐릭터 교전 토글
      if (player.targetActorId === enemy.id) {
        disengageActor(battle, { side: 'player', actorId: player.id });
        toast(`${player.name} 교전 해제`);
      } else {
        engageActor(battle, { side: 'player', actorId: player.id }, { side: 'enemy', actorId: enemy.id });
        toast(`${player.name} → ${enemy.name} 교전`);
      }
    }
    linkMode = null;
    renderBattle();
    return;
  }

  // B) 같은 ref 재탭 → 모드 취소 (기존 교전/라우팅은 그대로 유지)
  if (sameRef(linkMode, ref)) {
    linkMode = null;
    renderBattle();
    return;
  }

  // C) 새 모드 (또는 같은 쪽 다른 액터로 전환)
  //    이미 교전 중이거나 라우팅된 액터/슬롯도 자유롭게 다시 시작점으로 선택 가능 (스틸 진입)
  linkMode = { ...ref };
  haptic(8);
  let msg;
  if (ref.side === 'player') msg = '맞붙일 적 또는 적 카드를 누르세요';
  else if (ref.slotIdx != null) msg = '이 적 카드를 받을 내 사람을 누르세요';
  else msg = '맞붙일 내 사람을 누르세요';
  toast(msg);
  renderBattle();
}


// 계획 단계 라인 그리기.
//   - 내 캐릭터 측: 캐릭터 아바타 → 교전 적 아바타 (노란 곡선)
//     교전 없으면 가장 왼쪽 살아있는 적으로 빨간 화살표
//   - 적 측: 각 적 카드 슬롯 → 타겟 플레이어 아바타 (적 카드 → 내 사람)
//     교전 있는 적은 노란 곡선, 없으면 첫 살아있는 플레이어로 빨간 화살표
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
    <marker id="arr-yellow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#f0c860" />
    </marker>
  `;
  svg.appendChild(defs);

  const centerOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - rect.left, y: r.top + r.height / 2 - rect.top };
  };

  const players = battle.players;
  const enemies = battle.enemies;

  // 오브 단위로 끝점을 찾는 헬퍼. 슬롯이 정해진 경우 그 오브, 없으면 첫 오브.
  function orbEl(side, actorId, slotIdx) {
    if (slotIdx != null) {
      return document.querySelector(`.speed-orb[data-side="${side}"][data-actor-id="${actorId}"][data-slot-idx="${slotIdx}"]`);
    }
    return document.querySelector(`.speed-orb[data-side="${side}"][data-actor-id="${actorId}"]`);
  }
  function actorEl(side, actorId) {
    const sel = side === 'player' ? '#player-actors' : '#enemy-actors';
    const list = side === 'player' ? players : enemies;
    const idx = list.findIndex(a => a.id === actorId);
    if (idx < 0) return null;
    return document.querySelectorAll(`${sel} .actor`)[idx];
  }
  // 끝점 우선순위: orb → actor (orb 없으면 아바타로 폴백)
  function endpointEl(side, actorId, slotIdx) {
    return orbEl(side, actorId, slotIdx) || actorEl(side, actorId);
  }

  function drawClashCurve(src, dst) {
    const a = centerOf(src), b = centerOf(dst);
    if (!a || !b) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const mx = (a.x + b.x) / 2;
    path.setAttribute('d', `M ${a.x} ${a.y} Q ${mx} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`);
    path.setAttribute('class', 'clash-line');
    path.setAttribute('marker-end', 'url(#arr-yellow)');
    svg.appendChild(path);
  }
  function drawOnewayArrow(src, dst) {
    const a = centerOf(src), b = centerOf(dst);
    if (!a || !b) return;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('class', 'oneway-line');
    line.setAttribute('marker-end', 'url(#arr-red)');
    svg.appendChild(line);
  }
  // 호환을 위해 avatarEl을 endpointEl 폴백으로 alias
  function avatarEl(side, actorId) { return endpointEl(side, actorId); }

  // ── 1) 내 캐릭터 측 라인
  //     교전 중이고 상대 적의 슬롯 중 하나라도 나를 향해 있으면 노란 곡선 (상호)
  //     교전 중이지만 상대가 반응 안 함 (스틸당함 등) → 빨간 일방 화살표
  //     교전 없음 → 빨간 일방 화살표 (가장 왼쪽 적)
  const firstEnemy = enemies.find(e => !e.dead);
  const firstPlayer = players.find(p => !p.dead);

  function enemyReciprocates(enemy, playerId) {
    return enemy.slots.some(s => s.targetPlayerId === playerId);
  }

  for (const p of players) {
    if (p.dead) continue;
    const hasAttack = p.slots.some(s => s.card && s.card.actions.some(a => a.type === '공격'));
    if (!hasAttack) continue;
    if (p.targetActorId) {
      const target = enemies.find(e => e.id === p.targetActorId && !e.dead);
      if (target) {
        const mutual = enemyReciprocates(target, p.id);
        if (mutual) drawClashCurve(avatarEl('player', p.id), avatarEl('enemy', target.id));
        else        drawOnewayArrow(avatarEl('player', p.id), avatarEl('enemy', target.id));
      }
    } else if (firstEnemy) {
      drawOnewayArrow(avatarEl('player', p.id), avatarEl('enemy', firstEnemy.id));
    }
  }

  // ── 2) 적 측 라인 — 각 적 슬롯이 어느 플레이어를 노리는지
  //     대상 플레이어가 현재 선택된 캐릭터고 그 플레이어에 방어 카드가 있으면
  //     라인을 첫 방어 슬롯으로 보냄 (방어가 합으로 받아낼 것을 시각화)
  const selEnemy = enemies.find(e => e.id === selectedEnemyId);
  const selPlayer = players.find(p => p.id === selectedActorId);
  function playerSlotDefenseEl(p, slotIdx) {
    if (!p || p.id !== selectedActorId) return null;
    return document.querySelector(`#player-cards .card-slot:nth-child(${slotIdx + 1})`);
  }
  function findFirstDefenseSlotIdx(p) {
    if (!p) return -1;
    for (let i = 0; i < p.slots.length; i++) {
      const s = p.slots[i];
      if (!s.card) continue;
      if (s.card.actions.some(a => a.type !== '공격')) return i;
    }
    return -1;
  }
  if (selEnemy && !selEnemy.dead) {
    for (let si = 0; si < selEnemy.slots.length; si++) {
      const slot = selEnemy.slots[si];
      if (!slot.card) continue;
      const hasAttack = slot.card.actions.some(a => a.type === '공격');
      if (!hasAttack) continue;
      const targetPlayer = slot.targetPlayerId
        ? players.find(p => p.id === slot.targetPlayerId && !p.dead)
        : firstPlayer;
      if (!targetPlayer) continue;
      // 소스: 적 카드 슬롯 위의 오브
      const srcOrb = orbEl('enemy', selEnemy.id, si);
      const srcEl = srcOrb || document.querySelector(`#enemy-cards .card-slot:nth-child(${si + 1})`);
      // 도착: 기본 = 플레이어 오브 컨테이너 (첫 오브)
      let dstEl = orbEl('player', targetPlayer.id, 0) || avatarEl('player', targetPlayer.id);
      // 그 플레이어가 현재 선택돼 있고 방어 카드가 있으면 → 첫 방어 슬롯의 오브로
      if (targetPlayer.id === selectedActorId) {
        const defIdx = findFirstDefenseSlotIdx(targetPlayer);
        if (defIdx >= 0) {
          const orbForDef = orbEl('player', targetPlayer.id, defIdx);
          const slotForDef = document.querySelector(`#player-cards .card-slot:nth-child(${defIdx + 1})`);
          if (slotForDef) slotForDef.classList.add('defense-incoming');
          if (orbForDef) dstEl = orbForDef;
        }
      }
      if (slot.targetPlayerId) {
        srcEl?.classList.add('routed-source');
        drawClashCurve(srcEl, dstEl);
      } else {
        drawOnewayArrow(srcEl, dstEl);
      }
    }
  }
  for (const e of enemies) {
    if (e.dead || e.id === selectedEnemyId) continue;
    // 이 적의 공격 슬롯이 노리는 플레이어들의 집합
    const targets = new Map();
    for (const slot of e.slots) {
      if (!slot.card) continue;
      const hasAttack = slot.card.actions.some(a => a.type === '공격');
      if (!hasAttack) continue;
      const p = slot.targetPlayerId
        ? players.find(pp => pp.id === slot.targetPlayerId && !pp.dead)
        : firstPlayer;
      if (!p) continue;
      const k = p.id + (slot.targetPlayerId ? '|r' : '|d');
      if (!targets.has(k)) targets.set(k, { player: p, routed: !!slot.targetPlayerId });
    }
    for (const { player, routed } of targets.values()) {
      const src = avatarEl('enemy', e.id);
      const dst = avatarEl('player', player.id);
      if (routed) drawClashCurve(src, dst); else drawOnewayArrow(src, dst);
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
    const actionsHtml = (card.actions || []).map(a => `<div class="card-action" data-type="${a.type}"><span>${a.type}</span><span class="card-roll">${a.min}-${a.max}</span></div>`).join('');
    const effectsHtml = (card.effects || []).map(e => `<div class="card-action" data-type="effect">${effectLabel(e)}</div>`).join('');
    div.innerHTML = `
      <div class="card-cost">◆${cost}</div>
      <div class="card-name">${card.name}</div>
      <div class="card-actions">${actionsHtml}${effectsHtml}</div>
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

  linkMode = null;
  const execBtn = document.querySelector('[data-action="execute"]');
  if (execBtn) execBtn.disabled = true;

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

function effectLabel(eff) {
  switch (eff.type) {
    case 'draw': return `드로우 +${eff.value}`;
    case 'light': return `빛 +${eff.value}`;
    default: return `${eff.type} ${eff.value || ''}`.trim();
  }
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
  for (const p of battle.players) {
    const orig = run.party.find(x => x.id === p.id);
    if (orig) { orig.hp = p.hp; orig.sp = p.sp; orig.statuses = {}; orig.disordered = false; }
  }
  if (battle.victory) {
    run.map.cleared[battle.mapNodeId] = true;
    run.inBattle = null;
    saveAll();
    // 보상 산정
    const node = run.map.nodes[battle.mapNodeId];
    const isBoss = node?.type === 'boss';
    const isElite = node?.type === 'elite';
    const isNormal = node?.type === 'battle';
    let gold = 0;
    const actMult = 1.0 + ((run.act || 1) - 1) * 0.15;
    if (isNormal) gold = Math.round((28 + Math.floor(battle.rng() * 16)) * actMult);
    if (isElite)  gold = Math.round((60 + Math.floor(battle.rng() * 25)) * actMult);
    if (isBoss)   gold = Math.round((130 + Math.floor(battle.rng() * 40)) * actMult);
    // 카드 선택지
    let cards = [];
    if (isNormal || isElite || isBoss) {
      const pool = Object.values(CARDS).filter(c => c.rarity === '일반' || c.rarity === '희귀');
      const choose3 = [];
      const used = new Set();
      while (choose3.length < 3 && used.size < pool.length) {
        const c = pool[Math.floor(battle.rng() * pool.length)];
        if (!used.has(c.id)) { used.add(c.id); choose3.push(c.id); }
      }
      cards = choose3;
    }
    // 보스/엘리트는 유물 보상
    let relic = null;
    if (isBoss || isElite) {
      const rest = Object.values(RELICS).filter(r => !(run.relics || []).includes(r.id));
      const pool = rest.filter(r => isBoss ? true : r.rarity !== '유물');
      if (pool.length) relic = pool[Math.floor(battle.rng() * pool.length)].id;
    }
    setTimeout(() => {
      showScreen('map');
      renderMap();
      openReward({ gold, cards, relic, isBoss });
    }, 600);
  } else {
    toast('패배… 진행이 종료됩니다', 2400);
    run.inBattle = null;
    setTimeout(() => {
      localStorage.removeItem('deckEcho.save');
      state.run = null;
      showScreen('title');
    }, 1600);
  }
}

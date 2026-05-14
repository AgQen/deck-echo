// 전투 한 판의 상태 + 턴 진행.
//
// === 합/방어 모델 (재설계) ===
//
// - 합 지정은 슬롯 단위. 내 슬롯을 "내가 합치고 싶은 상대 슬롯"으로 연결.
//   slot.linkedTo = { side, actorId, slotIdx } | null
//
// - 자동 타게팅: 연결 안 한 공격은 가장 왼쪽(첫 살아있는) 상대에게 향함.
//
// - 방어 카드 동작:
//   * 미연결 방어 카드는 "대기 풀"에 들어가 들어오는 공격에 자동으로 반응.
//   * 공격이 들어올 때, 대상 행위자의 대기 풀에서 첫 방어 액션이 꺼내져 합을 친다.
//   * 방어가 없으면 그냥 맞는다 (일방공격).
//
// - 액션 소비:
//   * 공격(공격) : 합/일방 사용 후 소비.
//   * 반격       : 사용 후 항상 소비 (이기든 지든).
//   * 막기       : 사용 후 항상 소비.
//   * 회피       : 합을 "졌을 때만" 소비. 이기거나 무승부면 풀에 남아 다음 공격에도 대응.
//
// - 방어 vs 방어 합은 직접 지정으로만 발생 (자동 대응 룰로는 시작 안 됨).

import { instantiateEnemy } from './data/enemies.js';
import { CARDS, cardCost } from './data/cards.js';
import { state } from './state.js';
import { makeRng } from './rng.js';
import { resolveClash, rollAction, applyEvents } from './clash.js';
import { tickStatuses, reduceDurations, STATUSES } from './data/statuses.js';
import { awardXp, XP_RULES, LEVEL_BONUS_LIGHT } from './data/progression.js';
import { fireRelicHook } from './data/relics.js';

export function startBattle({ enemyIds, mapNodeId, encounter } = {}) {
  const run = state.run;
  if (!run) throw new Error('no run');
  const rng = makeRng(run.rngState ?? Date.now());

  const players = run.party.map(p => {
    const maxLight = p.baseMaxLight + (LEVEL_BONUS_LIGHT[p.level] || 0);
    return { ...p, slots: [], statuses: {}, disordered: false, maxLight, light: maxLight };
  });
  const enemies = enemyIds.map(id => instantiateEnemy(id));

  // 막 + 행 심도 기반 적 스케일링
  //   막 배수: act1=1.0, act2=1.15, act3=1.30
  //   같은 막 내 심도: 첫 행 1.0 → 보스 직전 1.4 (보스는 1.5 고정)
  //   엘리트는 +0.15 가산
  const actMult = 1.0 + ((run.act || 1) - 1) * 0.15;
  const kind = encounter?.kind || 'battle';
  const depth = encounter?.depthFactor ?? 0;
  let depthMult = 1.0 + depth * 0.40;
  if (kind === 'elite') depthMult += 0.15;
  if (kind === 'boss')  depthMult = 1.5;
  const scaling = actMult * depthMult;

  for (const e of enemies) {
    e.maxHp = Math.round(e.maxHp * scaling);
    e.hp = e.maxHp;
    e.maxSp = Math.round(e.maxSp * scaling);
    e.sp = e.maxSp;
    for (const p of e.pattern) {
      p.min = Math.max(1, Math.round(p.min * Math.sqrt(scaling)));
      p.max = Math.max(p.min, Math.round(p.max * Math.sqrt(scaling)));
    }
  }

  const drawPile = rng.shuffle(run.deck.slice());

  const battle = {
    rng,
    rngState: rng.seed(),
    turn: 1,
    log: [],
    players, enemies,
    hand: Object.fromEntries(players.map(p => [p.id, []])),
    drawPile,
    discardPile: [],
    exhausted: [],
    mapNodeId,
    phase: 'plan',
    selectedPlayerId: players[0].id,
  };
  const handSize = state.settings.handSize || 3;
  for (const p of players) drawCards(battle, p.id, handSize);
  // 유물: 전투 시작 효과
  for (const p of players) fireRelicHook(run, 'onBattleStart', battle, p);
  rollAllSpeeds(battle);
  pickEnemyActions(battle);

  run.inBattle = battle;
  return battle;
}

export function drawCards(battle, playerId, n) {
  const hand = battle.hand[playerId] = battle.hand[playerId] || [];
  while (n-- > 0 && hand.length < 7) {
    if (battle.drawPile.length === 0) {
      if (battle.discardPile.length === 0) break;
      battle.drawPile = battle.rng.shuffle(battle.discardPile);
      battle.discardPile = [];
    }
    hand.push(battle.drawPile.pop());
  }
}

export function gainLight(battle, playerId, amount) {
  const p = battle.players.find(p => p.id === playerId);
  if (!p) return;
  p.light = Math.min(p.maxLight, p.light + amount);
}

// 모든 행위자의 슬롯 속도 굴림 (턴 시작 / 새 턴 준비)
// slot 구조:
//   { speed, card, linkedTo?, targetPlayerId? }
//   linkedTo: {actorId, slotIdx} — 내 슬롯이 적의 어느 슬롯과 짝지어졌는지 (양측)
//   targetPlayerId: 적 슬롯이 어떤 플레이어를 노리는지 (적 측 한정)
export function rollAllSpeeds(battle) {
  for (const a of [...battle.players, ...battle.enemies]) {
    a.slots = [];
    if (a.disordered || a.dead) continue;
    for (let i = 0; i < a.actionSlots; i++) {
      const sp = battle.rng.int(a.speedDice.min, a.speedDice.max);
      a.slots.push({ speed: sp, card: null, linkedTo: null, targetPlayerId: null });
    }
  }
}

// 적 AI: 패턴에서 슬롯 수만큼 무작위 액션. 자동 타게팅은 해소 시 처리.
function pickEnemyActions(battle) {
  for (const e of battle.enemies) {
    if (e.dead || e.disordered) continue;
    for (let i = 0; i < e.slots.length; i++) {
      const proto = battle.rng.pick(e.pattern);
      e.slots[i].card = { ad: true, name: proto.name, actions: [proto] };
      e.slots[i].linkedTo = null;
    }
  }
}

// 플레이어 카드 배치 — 빛 부족 시 실패 반환
export function placeCard(battle, playerId, slotIdx, cardId) {
  const hand = battle.hand[playerId];
  const idx = hand.indexOf(cardId);
  if (idx < 0) return { ok: false, reason: 'not_in_hand' };
  const player = battle.players.find(p => p.id === playerId);
  if (!player || !player.slots[slotIdx]) return { ok: false, reason: 'no_slot' };
  const card = CARDS[cardId];
  if (!card) return { ok: false, reason: 'no_card' };
  const cost = cardCost(card);

  const prev = player.slots[slotIdx].card;
  let refund = 0;
  if (prev && prev.id) {
    refund = cardCost(CARDS[prev.id] || {});
    hand.push(prev.id);
  }
  const available = player.light + refund;
  if (available < cost) {
    return { ok: false, reason: 'no_light', need: cost, have: available };
  }
  player.light = available - cost;
  hand.splice(idx, 1);
  // 슬롯 교체 시 슬롯-슬롯 합 해제 + 적 쪽 라우팅도 같이 끊음
  if (player.slots[slotIdx].linkedTo) {
    const e = battle.enemies.find(en => en.id === player.slots[slotIdx].linkedTo.actorId);
    const es = e?.slots[player.slots[slotIdx].linkedTo.slotIdx];
    if (es && es.targetPlayerId === playerId) es.targetPlayerId = null;
  }
  player.slots[slotIdx].card = {
    id: cardId,
    name: card.name,
    actions: card.actions || [],
    consumable: card.consumable,
    light: cost,
    effects: card.effects || null,
  };
  player.slots[slotIdx].linkedTo = null;

  // 배치 즉시 발동되는 효과 (드로우/빛 회복 등)
  if (card.effects) {
    for (const eff of card.effects) {
      if (eff.type === 'draw') drawCards(battle, playerId, eff.value);
      else if (eff.type === 'light') player.light = Math.min(player.maxLight, player.light + eff.value);
    }
  }
  // 자기 자신에게 상태이상 (강화 등)
  if (card.selfStatus) {
    for (const s of card.selfStatus) {
      if (!player.statuses) player.statuses = {};
      const def = STATUSES[s.id];
      if (def?.stack) player.statuses[s.id] = (player.statuses[s.id] || 0) + s.value;
      else player.statuses[s.id] = s.value;
    }
  }
  return { ok: true };
}

export function removeCard(battle, playerId, slotIdx) {
  const player = battle.players.find(p => p.id === playerId);
  if (!player || !player.slots[slotIdx] || !player.slots[slotIdx].card) return;
  const c = player.slots[slotIdx].card;
  if (c.id) {
    battle.hand[playerId].push(c.id);
    player.light = Math.min(player.maxLight, player.light + cardCost(CARDS[c.id] || {}));
  }
  player.slots[slotIdx].card = null;
  player.slots[slotIdx].linkedTo = null;
  // 이 슬롯을 가리키던 다른 슬롯의 link 무효화
  for (const a of [...battle.players, ...battle.enemies]) {
    for (const s of a.slots) {
      if (s.linkedTo && s.linkedTo.actorId === playerId && s.linkedTo.slotIdx === slotIdx) {
        s.linkedTo = null;
      }
    }
  }
}

// 내 캐릭터 교전 — 단방향. 내 캐릭터.targetActorId = 적.id 만 세팅.
// 자동 해제 없음 (같은 캐릭터에 새 교전 잡으면 기존 값만 덮어쓴다).
export function engageActor(battle, src, dst) {
  if (src.side !== 'player') return { ok: false, reason: 'src_not_player' };
  if (dst.side !== 'enemy')  return { ok: false, reason: 'dst_not_enemy' };
  const srcActor = getActor(battle, src.side, src.actorId);
  const dstActor = getActor(battle, dst.side, dst.actorId);
  if (!srcActor || !dstActor) return { ok: false, reason: 'no_actor' };
  if (dstActor.dead) return { ok: false, reason: 'dead' };
  srcActor.targetActorId = dstActor.id;
  return { ok: true };
}

export function disengageActor(battle, src) {
  const actor = getActor(battle, src.side, src.actorId);
  if (actor) actor.targetActorId = null;
}

// 적 카드(슬롯) → 내 캐릭터 라우팅. 그 슬롯의 공격이 그 플레이어를 노림.
export function routeEnemySlot(battle, enemyId, slotIdx, playerId) {
  const enemy = battle.enemies.find(e => e.id === enemyId);
  const player = battle.players.find(p => p.id === playerId);
  if (!enemy || !player || player.dead) return { ok: false, reason: 'no_actor' };
  const slot = enemy.slots[slotIdx];
  if (!slot || !slot.card) return { ok: false, reason: 'no_slot' };
  slot.targetPlayerId = player.id;
  return { ok: true };
}

export function clearEnemySlotRoute(battle, enemyId, slotIdx) {
  const enemy = battle.enemies.find(e => e.id === enemyId);
  const slot = enemy?.slots[slotIdx];
  if (slot) slot.targetPlayerId = null;
}

// 슬롯 ↔ 슬롯 짝짓기 — 가장 세밀한 합. 양측 slot 모두 linkedTo 세팅.
//   playerSlot.linkedTo = {actorId: enemyId, slotIdx}
//   enemySlot.targetPlayerId = playerId (호환)
export function linkSlotToSlot(battle, playerRef, enemyRef) {
  const player = battle.players.find(p => p.id === playerRef.actorId);
  const enemy  = battle.enemies.find(e => e.id === enemyRef.actorId);
  if (!player || !enemy || player.dead || enemy.dead) return { ok: false, reason: 'no_actor' };
  const pSlot = player.slots[playerRef.slotIdx];
  const eSlot = enemy.slots[enemyRef.slotIdx];
  if (!pSlot || !eSlot) return { ok: false, reason: 'no_slot' };
  pSlot.linkedTo = { actorId: enemy.id, slotIdx: enemyRef.slotIdx };
  eSlot.targetPlayerId = player.id;
  return { ok: true };
}

export function unlinkPlayerSlot(battle, playerId, slotIdx) {
  const player = battle.players.find(p => p.id === playerId);
  const slot = player?.slots[slotIdx];
  if (!slot) return;
  if (slot.linkedTo) {
    const enemy = battle.enemies.find(e => e.id === slot.linkedTo.actorId);
    const eSlot = enemy?.slots[slot.linkedTo.slotIdx];
    if (eSlot && eSlot.targetPlayerId === playerId) eSlot.targetPlayerId = null;
  }
  slot.linkedTo = null;
}

// 구버전 슬롯 단위 합 API (호환용. UI는 더이상 호출하지 않음)
export function linkSlot() { return { ok: false, reason: 'deprecated' }; }
export function unlinkSlot() {}

function getActor(battle, side, id) {
  return (side === 'player' ? battle.players : battle.enemies).find(a => a.id === id);
}

// ─────────────────────────────────────────────
// 턴 해소 (async + hooks)
// ─────────────────────────────────────────────
//   - 캐릭터에 targetActorId가 설정돼 있으면 그 적이 우선 타겟
//   - 그 외에는 가장 왼쪽 살아있는 적이 기본 타겟
//   - 미연결 방어 액션은 대기 풀에 들어가 들어오는 공격에 반응
export async function executeTurn(battle, hooks = {}) {
  battle.phase = 'resolve';
  const log = battle.log;
  log.push({ type: 'turnStart', turn: battle.turn });

  const startDead = battle.enemies.filter(e => e.dead).length;
  const startDisordered = battle.enemies.filter(e => e.disordered).length;

  // 1) 방어 대기 풀
  const defensePools = new Map();
  for (const actor of [...battle.players, ...battle.enemies]) {
    defensePools.set(actor.id, []);
    if (actor.dead || actor.disordered) continue;
    for (let si = 0; si < actor.slots.length; si++) {
      const slot = actor.slots[si];
      if (!slot.card) continue;
      for (let ai = 0; ai < slot.card.actions.length; ai++) {
        const a = slot.card.actions[ai];
        if (a.type === '공격') continue;
        defensePools.get(actor.id).push({ slotIdx: si, actionIdx: ai, action: a });
      }
    }
  }

  // 2) 공격 이벤트 큐 (속도 내림차순)
  const events = [];
  for (const actor of [...battle.players, ...battle.enemies]) {
    if (actor.dead || actor.disordered) continue;
    for (let si = 0; si < actor.slots.length; si++) {
      const slot = actor.slots[si];
      if (!slot.card) continue;
      for (let ai = 0; ai < slot.card.actions.length; ai++) {
        const a = slot.card.actions[ai];
        if (a.type === '공격') {
          events.push({ kind: 'attack', side: actor.side, actor, slotIdx: si, actionIdx: ai, action: a, speed: slot.speed });
        }
      }
    }
  }
  events.sort((x, y) => y.speed - x.speed);

  for (const ev of events) {
    if (ev.actor.dead) continue;
    await resolveAttack(battle, ev, defensePools, hooks, log);
  }

  const endDead = battle.enemies.filter(e => e.dead).length;
  const endDisordered = battle.enemies.filter(e => e.disordered).length;
  battle._extraDraw = Math.max(0, (endDead - startDead) + (endDisordered - startDisordered));

  endTurn(battle);
}

// 공격 처리. 타겟 우선순위:
//   1) 내 슬롯 linkedTo (가장 세밀한 슬롯-슬롯 짝짓기)
//   2) 적 슬롯 targetPlayerId (적 → 내 사람 라우팅) — 적 측 한정
//   3) actor.targetActorId (캐릭터 교전)
//   4) 가장 왼쪽 살아있는 상대
async function resolveAttack(battle, ev, defensePools, hooks, log) {
  const { side, actor, slotIdx, actionIdx, action } = ev;
  const oppList = side === 'player' ? battle.enemies : battle.players;
  let target = null;
  const slot = actor.slots[slotIdx];
  // 1) 슬롯-슬롯 (플레이어 측)
  if (side === 'player' && slot?.linkedTo) {
    target = oppList.find(o => o.id === slot.linkedTo.actorId && !o.dead);
  }
  // 2) 적 측 슬롯 라우팅
  if (!target && side === 'enemy' && slot?.targetPlayerId) {
    target = oppList.find(o => o.id === slot.targetPlayerId && !o.dead);
  }
  // 3) 캐릭터 교전
  if (!target && actor.targetActorId) {
    target = oppList.find(o => o.id === actor.targetActorId && !o.dead);
  }
  // 4) 폴백
  if (!target) target = oppList.find(o => !o.dead);
  if (!target) return;

  const pool = defensePools.get(target.id) || [];
  const aRoll = rollAction(action, battle.rng);

  if (pool.length === 0) {
    await hooks.onUnopposed?.({
      source: { actor, action, slotIdx, actionIdx },
      target,
      roll: aRoll,
    });
    const before = snapshot(actor, target);
    applyEvents([{ kind: 'hit', from: 'a', to: 'b', amount: aRoll, prop: action.property }], actor, target);
    await hooks.onAfterHit?.({ source: actor, target, before });
    awardXpFromDeltas(battle, actor, target, before, log);
    log.push({ type: 'unopposed', src: actor.name, dst: target.name, amount: aRoll, prop: action.property });
    return;
  }

  const def = pool[0];
  const bRoll = rollAction(def.action, battle.rng);
  const result = resolveClash({ a: action, b: def.action, aRoll, bRoll });
  await hooks.onClash?.({
    source: { actor, action, slotIdx, actionIdx },
    target: { actor: target, action: def.action, slotIdx: def.slotIdx, actionIdx: def.actionIdx },
    aRoll, bRoll, winner: result.winner, reactive: true,
  });
  log.push({ type: 'clash', src: { actor: actor.name, action: action.type, roll: aRoll }, dst: { actor: target.name, action: def.action.type, roll: bRoll }, winner: result.winner });
  const before = snapshot(actor, target);
  applyEvents(result.events, actor, target);
  await hooks.onAfterHit?.({ source: actor, target, before });
  awardXpFromDeltas(battle, actor, target, before, log);

  // 방어 액션 소비 규칙:
  //   회피: 졌을 때만 소비 (이기거나 무승부면 풀에 남음)
  //   막기/반격: 항상 소비
  const stays = def.action.type === '회피' && result.winner !== 'a';
  if (!stays) pool.shift();
}

function snapshot(a, b) {
  return {
    a: a ? { id: a.id, side: a.side, hp: a.hp, sp: a.sp, dead: a.dead, disordered: a.disordered } : null,
    b: b ? { id: b.id, side: b.side, hp: b.hp, sp: b.sp, dead: b.dead, disordered: b.disordered } : null,
  };
}

function awardXpFromDeltas(battle, srcActor, dstActor, before, log) {
  if (!before) return;
  for (const sideKey of ['a', 'b']) {
    const beforeSide = before[sideKey];
    if (!beforeSide) continue;
    const cur = sideKey === 'a' ? srcActor : dstActor;
    if (!cur) continue;
    const dHp = beforeSide.hp - cur.hp;
    const dSp = beforeSide.sp - cur.sp;
    const becameDead = !beforeSide.dead && cur.dead;
    const becameDisorder = !beforeSide.disordered && cur.disordered;

    if (dHp > 0 || dSp > 0 || becameDead || becameDisorder) {
      const attacker = sideKey === 'a' ? dstActor : srcActor;
      const victim = cur;
      if (attacker?.side === 'player' && victim.side === 'enemy') {
        let gain = 0;
        if (dHp > 0) gain += dHp * XP_RULES.perHpDamageDealt;
        if (dSp > 0) gain += dSp * XP_RULES.perSpDamageDealt;
        if (becameDisorder) gain += XP_RULES.causedDisorder;
        if (becameDead)     gain += XP_RULES.killedEnemy;
        applyXpToParty(battle, attacker.id, Math.round(gain), log);
      }
      if (attacker?.side === 'enemy' && victim.side === 'player') {
        let gain = 0;
        if (dHp > 0) gain += dHp * XP_RULES.perHpDamageTaken;
        if (dSp > 0) gain += dSp * XP_RULES.perSpDamageTaken;
        applyXpToParty(battle, victim.id, Math.round(gain), log);
      }
      if (becameDead && victim.side === 'player') {
        for (const p of battle.players) {
          if (p.id !== victim.id && !p.dead) applyXpToParty(battle, p.id, XP_RULES.allyDied, log);
        }
      }
    }
  }
}

function applyXpToParty(battle, actorId, amount, log) {
  if (amount <= 0) return;
  const battleActor = battle.players.find(p => p.id === actorId);
  if (!battleActor) return;
  const partyActor = state.run?.party.find(p => p.id === actorId);
  const events1 = awardXp(battleActor, amount);
  if (partyActor) {
    partyActor.xp = battleActor.xp;
    partyActor.level = battleActor.level;
  }
  for (const ev of events1) {
    log.push({ type: 'levelUp', who: battleActor.name, level: ev.newLevel, maxLight: ev.newMaxLight });
    // 화면에 떠오르는 알림 — toast로 노출 (UI 이벤트)
    try {
      const t = document.getElementById('toast');
      if (t) {
        t.textContent = `★ 레벨 ${ev.newLevel} — 최대 빛 ${ev.newMaxLight}`;
        t.classList.add('show');
        clearTimeout(window.__lvlupTo__);
        window.__lvlupTo__ = setTimeout(() => t.classList.remove('show'), 1800);
      }
    } catch {}
  }
  log.push({ type: 'xpGain', who: battleActor.name, amount });
}

function endTurn(battle) {
  const ctx = {
    damage(actor, amount, prop) {
      applyEvents([{ kind: 'hit', from: 'a', to: 'b', amount, prop }], actor, actor);
    },
  };
  for (const a of [...battle.players, ...battle.enemies]) {
    if (a.dead) continue;
    tickStatuses(a, ctx, 'turnEnd');
    reduceDurations(a);
  }

  for (const p of battle.players) {
    for (const slot of p.slots) {
      if (slot.card && slot.card.id) {
        const def = CARDS[slot.card.id];
        if (def?.consumable) battle.exhausted.push(slot.card.id);
        else battle.discardPile.push(slot.card.id);
      }
    }
  }

  const allEnemiesDead = battle.enemies.every(e => e.dead);
  const allPlayersDead = battle.players.every(p => p.dead);
  if (allEnemiesDead) { battle.phase = 'done'; battle.victory = true; return; }
  if (allPlayersDead) { battle.phase = 'done'; battle.victory = false; return; }

  const extra = 1 + (battle._extraDraw || 0);
  battle._extraDraw = 0;
  for (const p of battle.players) drawCards(battle, p.id, extra);

  battle.turn += 1;
  for (const p of battle.players) {
    if (!p.dead) p.light = p.maxLight;
  }
  // 유물: 매 턴 시작 효과
  for (const p of battle.players) {
    if (!p.dead) fireRelicHook(state.run, 'onTurnStart', battle, p);
  }
  rollAllSpeeds(battle);
  pickEnemyActions(battle);
  battle.phase = 'plan';
}

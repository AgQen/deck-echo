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
import { tickStatuses, reduceDurations } from './data/statuses.js';
import { awardXp, XP_RULES, LEVEL_BONUS_LIGHT } from './data/progression.js';

export function startBattle({ enemyIds, mapNodeId } = {}) {
  const run = state.run;
  if (!run) throw new Error('no run');
  const rng = makeRng(run.rngState ?? Date.now());

  const players = run.party.map(p => {
    const maxLight = p.baseMaxLight + (LEVEL_BONUS_LIGHT[p.level] || 0);
    return { ...p, slots: [], statuses: {}, disordered: false, maxLight, light: maxLight };
  });
  const enemies = enemyIds.map(id => instantiateEnemy(id));

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
export function rollAllSpeeds(battle) {
  for (const a of [...battle.players, ...battle.enemies]) {
    a.slots = [];
    if (a.disordered || a.dead) continue;
    for (let i = 0; i < a.actionSlots; i++) {
      const sp = battle.rng.int(a.speedDice.min, a.speedDice.max);
      a.slots.push({ speed: sp, card: null, linkedTo: null });
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

// 슬롯 단위 합 연결. src/dst = {side, actorId, slotIdx}
export function linkSlot(battle, src, dst) {
  if (src.side === dst.side) return { ok: false, reason: 'same_side' };
  const srcActor = getActor(battle, src.side, src.actorId);
  const dstActor = getActor(battle, dst.side, dst.actorId);
  if (!srcActor || !dstActor) return { ok: false, reason: 'no_actor' };
  const srcSlot = srcActor.slots[src.slotIdx];
  const dstSlot = dstActor.slots[dst.slotIdx];
  if (!srcSlot || !dstSlot || !srcSlot.card || !dstSlot.card) return { ok: false, reason: 'no_slot' };
  if (srcSlot.speed <= dstSlot.speed) return { ok: false, reason: 'too_slow' };
  srcSlot.linkedTo = { side: dst.side, actorId: dst.actorId, slotIdx: dst.slotIdx };
  return { ok: true };
}

export function unlinkSlot(battle, src) {
  const actor = getActor(battle, src.side, src.actorId);
  const slot = actor?.slots?.[src.slotIdx];
  if (slot) slot.linkedTo = null;
}

function getActor(battle, side, id) {
  return (side === 'player' ? battle.players : battle.enemies).find(a => a.id === id);
}

// ─────────────────────────────────────────────
// 턴 해소 (async + hooks)
// ─────────────────────────────────────────────
export async function executeTurn(battle, hooks = {}) {
  battle.phase = 'resolve';
  const log = battle.log;
  log.push({ type: 'turnStart', turn: battle.turn });

  const startDead = battle.enemies.filter(e => e.dead).length;
  const startDisordered = battle.enemies.filter(e => e.disordered).length;

  // 1) 방어 대기 풀 구축 (미연결 슬롯의 방어 액션들)
  //    actorId -> [{slotIdx, actionIdx, action}]
  const defensePools = new Map();
  for (const actor of [...battle.players, ...battle.enemies]) {
    defensePools.set(actor.id, []);
    if (actor.dead || actor.disordered) continue;
    for (let si = 0; si < actor.slots.length; si++) {
      const slot = actor.slots[si];
      if (!slot.card || slot.linkedTo) continue;
      for (let ai = 0; ai < slot.card.actions.length; ai++) {
        const a = slot.card.actions[ai];
        if (a.type === '공격') continue;
        defensePools.get(actor.id).push({ slotIdx: si, actionIdx: ai, action: a });
      }
    }
  }

  // 2) 이벤트 큐 구성 (속도 내림차순)
  //    - 연결된 슬롯은 'linked-clash' 이벤트 하나
  //    - 미연결 슬롯의 공격 액션은 각각 'attack' 이벤트
  const events = [];
  for (const actor of [...battle.players, ...battle.enemies]) {
    if (actor.dead || actor.disordered) continue;
    for (let si = 0; si < actor.slots.length; si++) {
      const slot = actor.slots[si];
      if (!slot.card) continue;
      if (slot.linkedTo) {
        events.push({ kind: 'linked', side: actor.side, actor, slotIdx: si, slot, speed: slot.speed });
      } else {
        for (let ai = 0; ai < slot.card.actions.length; ai++) {
          const a = slot.card.actions[ai];
          if (a.type === '공격') {
            events.push({ kind: 'attack', side: actor.side, actor, slotIdx: si, actionIdx: ai, action: a, speed: slot.speed });
          }
        }
      }
    }
  }
  events.sort((x, y) => y.speed - x.speed);

  // 소비 추적 (연결된 슬롯 / 풀 외부의 액션용)
  const consumed = new Set();
  const KK = (side, aid, si, ai) => `${side}:${aid}:${si}:${ai}`;

  for (const ev of events) {
    if (ev.actor.dead) continue;
    if (ev.kind === 'attack') {
      if (consumed.has(KK(ev.side, ev.actor.id, ev.slotIdx, ev.actionIdx))) continue;
      await resolveAttack(battle, ev, defensePools, consumed, hooks, log);
    } else if (ev.kind === 'linked') {
      await resolveLinkedClash(battle, ev, consumed, hooks, log);
    }
  }

  const endDead = battle.enemies.filter(e => e.dead).length;
  const endDisordered = battle.enemies.filter(e => e.disordered).length;
  battle._extraDraw = Math.max(0, (endDead - startDead) + (endDisordered - startDisordered));

  endTurn(battle);
}

// 미연결 공격 처리: 가장 왼쪽 살아있는 상대를 노리고, 그 상대의 방어 풀에서 첫 액션을 사용.
async function resolveAttack(battle, ev, defensePools, consumed, hooks, log) {
  const { side, actor, slotIdx, actionIdx, action } = ev;
  const oppList = side === 'player' ? battle.enemies : battle.players;
  const target = oppList.find(o => !o.dead);
  if (!target) return;

  const pool = defensePools.get(target.id) || [];
  const aRoll = rollAction(action, battle.rng);
  consumed.add(KK(side, actor.id, slotIdx, actionIdx));

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
  const defType = def.action.type;
  const defWon = result.winner === 'b';
  const stays = defType === '회피' && !((result.winner === 'a'));
  if (!stays) pool.shift();
}

// 슬롯-슬롯 연결 합. 액션을 순서대로 짝지어 합.
async function resolveLinkedClash(battle, ev, consumed, hooks, log) {
  const { side, actor, slotIdx, slot } = ev;
  const linked = slot.linkedTo;
  if (!linked) return;
  const dstActor = getActor(battle, linked.side, linked.actorId);
  const dstSlot = dstActor?.slots[linked.slotIdx];
  if (!dstActor || dstActor.dead || !dstSlot?.card) {
    // 대상 사라짐 → 공격은 일방으로 발산
    for (let ai = 0; ai < slot.card.actions.length; ai++) {
      const action = slot.card.actions[ai];
      if (consumed.has(KK(side, actor.id, slotIdx, ai))) continue;
      if (action.type !== '공격' && action.type !== '반격') {
        consumed.add(KK(side, actor.id, slotIdx, ai));
        continue;
      }
      const opp = side === 'player' ? battle.enemies.find(e => !e.dead) : battle.players.find(p => !p.dead);
      if (!opp) continue;
      const roll = rollAction(action, battle.rng);
      await hooks.onUnopposed?.({ source: { actor, action, slotIdx, actionIdx: ai }, target: opp, roll });
      const before = snapshot(actor, opp);
      applyEvents([{ kind: 'hit', from: 'a', to: 'b', amount: roll, prop: action.property }], actor, opp);
      await hooks.onAfterHit?.({ source: actor, target: opp, before });
      awardXpFromDeltas(battle, actor, opp, before, log);
      consumed.add(KK(side, actor.id, slotIdx, ai));
    }
    return;
  }

  const myActions = slot.card.actions;
  const dstActions = dstSlot.card.actions;
  const n = Math.max(myActions.length, dstActions.length);

  for (let ai = 0; ai < n; ai++) {
    if (actor.dead) break;
    const myAct = myActions[ai];
    const dstAct = dstActions[ai];
    const myKey = myAct ? KK(side, actor.id, slotIdx, ai) : null;
    const dstKey = dstAct ? KK(dstActor.side, dstActor.id, linked.slotIdx, ai) : null;
    if (myKey && consumed.has(myKey)) continue;
    if (dstKey && consumed.has(dstKey)) {
      // 상대 액션이 이미 다른 합에서 회피로 살아남았다가 진 경우 — 그냥 내 액션만 일방으로
    }

    if (myAct && dstAct && !(dstKey && consumed.has(dstKey))) {
      const aRoll = rollAction(myAct, battle.rng);
      const bRoll = rollAction(dstAct, battle.rng);
      const result = resolveClash({ a: myAct, b: dstAct, aRoll, bRoll });
      await hooks.onClash?.({
        source: { actor, action: myAct, slotIdx, actionIdx: ai },
        target: { actor: dstActor, action: dstAct, slotIdx: linked.slotIdx, actionIdx: ai },
        aRoll, bRoll, winner: result.winner,
      });
      log.push({ type: 'clash', src: { actor: actor.name, action: myAct.type, roll: aRoll }, dst: { actor: dstActor.name, action: dstAct.type, roll: bRoll }, winner: result.winner });
      const before = snapshot(actor, dstActor);
      applyEvents(result.events, actor, dstActor);
      await hooks.onAfterHit?.({ source: actor, target: dstActor, before });
      awardXpFromDeltas(battle, actor, dstActor, before, log);
      // 회피 소비 룰
      const myEvadeWin = myAct.type === '회피' && result.winner === 'a';
      const dstEvadeWin = dstAct.type === '회피' && result.winner === 'b';
      consumed.add(myKey);
      consumed.add(dstKey);
      if (myEvadeWin) consumed.delete(myKey);
      if (dstEvadeWin) consumed.delete(dstKey);
    } else if (myAct && !dstAct) {
      // 내 잉여 액션 → 일방
      if (myAct.type === '공격' || myAct.type === '반격') {
        const roll = rollAction(myAct, battle.rng);
        await hooks.onUnopposed?.({ source: { actor, action: myAct, slotIdx, actionIdx: ai }, target: dstActor, roll });
        const before = snapshot(actor, dstActor);
        applyEvents([{ kind: 'hit', from: 'a', to: 'b', amount: roll, prop: myAct.property }], actor, dstActor);
        await hooks.onAfterHit?.({ source: actor, target: dstActor, before });
        awardXpFromDeltas(battle, actor, dstActor, before, log);
      }
      consumed.add(myKey);
    } else if (!myAct && dstAct) {
      // 상대 잉여 액션 → 일방으로 나에게
      if (dstAct.type === '공격' || dstAct.type === '반격') {
        const roll = rollAction(dstAct, battle.rng);
        await hooks.onUnopposed?.({ source: { actor: dstActor, action: dstAct, slotIdx: linked.slotIdx, actionIdx: ai }, target: actor, roll });
        const before = snapshot(dstActor, actor);
        applyEvents([{ kind: 'hit', from: 'a', to: 'b', amount: roll, prop: dstAct.property }], dstActor, actor);
        await hooks.onAfterHit?.({ source: dstActor, target: actor, before });
        awardXpFromDeltas(battle, dstActor, actor, before, log);
      }
      consumed.add(dstKey);
    }
  }
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
  rollAllSpeeds(battle);
  pickEnemyActions(battle);
  battle.phase = 'plan';
}

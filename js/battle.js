// 전투 한 판의 상태 + 턴 진행.
//
// battle = {
//   rng, turn, log,
//   players: [actor, ...],   // state.run.party의 사본 또는 참조
//   enemies: [actor, ...],
//   hand: { [playerId]: cardIds[] },  // 현재 손에 든 카드
//   drawPile, discardPile,            // 책장 순환
//   resolvedThisRun: false,
// }

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

  // 파티 사본 — 레벨/경험치/빛 최대치는 캐릭터 객체에 영구 보존됨.
  // light(현재값)는 전투 시작마다 가득 채워서 진입.
  const players = run.party.map(p => {
    const maxLight = p.baseMaxLight + (LEVEL_BONUS_LIGHT[p.level] || 0);
    return { ...p, slots: [], statuses: {}, disordered: false, maxLight, light: maxLight };
  });
  const enemies = enemyIds.map(id => instantiateEnemy(id));

  // 책장 셔플
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
    phase: 'plan',   // 'plan' | 'resolve' | 'done'
    selectedPlayerId: players[0].id,
  };
  // 초기 패 드로우
  const handSize = state.settings.handSize || 3;
  for (const p of players) drawCards(battle, p.id, handSize);
  // 적 행동 결정 + 속도 굴림
  rollAllSpeeds(battle);
  pickEnemyActions(battle);

  run.inBattle = battle;
  return battle;
}

export function drawCards(battle, playerId, n) {
  const handSize = state.settings.handSize || 3;
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

// 모든 행위자의 슬롯 속도 굴림
export function rollAllSpeeds(battle) {
  for (const a of [...battle.players, ...battle.enemies]) {
    a.slots = [];
    if (a.disordered || a.dead) continue;
    for (let i = 0; i < a.actionSlots; i++) {
      const sp = battle.rng.int(a.speedDice.min, a.speedDice.max);
      a.slots.push({ speed: sp, card: null, plan: [] });
    }
  }
}

// 적 AI: 패턴 카드에서 슬롯 수만큼 무작위 배치, 합 타게팅도 즉시 지정.
function pickEnemyActions(battle) {
  for (const e of battle.enemies) {
    if (e.dead || e.disordered) continue;
    for (let i = 0; i < e.slots.length; i++) {
      const card = battle.rng.pick(e.pattern); // 1액션 카드처럼 다룸
      e.slots[i].card = { ad: true, name: card.name, actions: [card], property: card.property };
      // 타게팅: 살아있는 첫 플레이어
      const target = battle.players.find(p => !p.dead);
      if (target) {
        e.slots[i].plan = [{ actionIdx: 0, target: { actorId: target.id, slotIdx: null, actionIdx: null } }];
      }
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

  // 기존 카드 환불
  const prev = player.slots[slotIdx].card;
  let refund = 0;
  if (prev && prev.id) {
    refund = cardCost(CARDS[prev.id] || {});
    hand.push(prev.id);
  }
  // 빛 검사 (이전 카드 환불 포함)
  const available = player.light + refund;
  if (available < cost) {
    return { ok: false, reason: 'no_light', need: cost, have: available };
  }
  player.light = available - cost;
  hand.splice(idx, 1);
  player.slots[slotIdx].card = { id: cardId, name: card.name, actions: card.actions, consumable: card.consumable, light: cost };
  player.slots[slotIdx].plan = [];
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
  player.slots[slotIdx].plan = [];
}

// 액션 → 액션 연결 (합 지정)
// targetSide: 'enemy' | 'player', actorId, slotIdx, actionIdx
export function linkAction(battle, src, dst) {
  // src: { side, actorId, slotIdx, actionIdx }
  // 같은 편 안에서는 연결 금지 (단, 자기 자신 보호 등은 추후 확장)
  if (src.side === dst.side) return false;
  const srcActor = getActor(battle, src.side, src.actorId);
  const dstActor = getActor(battle, dst.side, dst.actorId);
  if (!srcActor || !dstActor) return false;
  const srcSlot = srcActor.slots[src.slotIdx];
  const dstSlot = dstActor.slots[dst.slotIdx];
  if (!srcSlot || !dstSlot || !srcSlot.card || !dstSlot.card) return false;

  // 속도 규칙: 자신이 상대보다 더 빨라야 연결 가능 (동률 포함 불가).
  if (srcSlot.speed <= dstSlot.speed) return false;
  // 기존 연결 제거
  srcSlot.plan = srcSlot.plan.filter(p => p.actionIdx !== src.actionIdx);
  srcSlot.plan.push({ actionIdx: src.actionIdx, target: { side: dst.side, actorId: dst.actorId, slotIdx: dst.slotIdx, actionIdx: dst.actionIdx } });
  return true;
}

function getActor(battle, side, id) {
  return (side === 'player' ? battle.players : battle.enemies).find(a => a.id === id);
}

// 턴 해소
export function executeTurn(battle) {
  battle.phase = 'resolve';
  const log = battle.log;
  log.push({ type: 'turnStart', turn: battle.turn });

  // 이번 턴 시작 시 적 상태 스냅샷 — 새로 죽거나 흐트러진 수 계산용
  const startDead = battle.enemies.filter(e => e.dead).length;
  const startDisordered = battle.enemies.filter(e => e.disordered).length;

  // 모든 슬롯을 (속도 내림차순)으로 모은다
  const allSlots = [];
  for (const side of ['player', 'enemy']) {
    const list = side === 'player' ? battle.players : battle.enemies;
    for (const a of list) for (let i = 0; i < a.slots.length; i++) {
      const s = a.slots[i];
      if (s.card) allSlots.push({ side, actor: a, slotIdx: i, slot: s });
    }
  }
  allSlots.sort((x, y) => y.slot.speed - x.slot.speed);

  // 액션 단위 소비 표시. 합으로 결의된 짝은 양쪽 모두 consumed.
  const consumed = new Set();
  const k = (side, actorId, slotIdx, actionIdx) => `${side}:${actorId}:${slotIdx}:${actionIdx}`;

  for (const slotInfo of allSlots) {
    const { side, actor, slot, slotIdx } = slotInfo;
    if (actor.dead) continue;
    const actions = slot.card.actions;
    for (let ai = 0; ai < actions.length; ai++) {
      if (consumed.has(k(side, actor.id, slotIdx, ai))) continue;
      const action = actions[ai];
      const plan = slot.plan.find(p => p.actionIdx === ai);
      if (plan) {
        const tgt = plan.target;
        const dstActor = getActor(battle, tgt.side, tgt.actorId);
        const dstSlot = dstActor?.slots[tgt.slotIdx];
        const dstAction = dstSlot?.card?.actions[tgt.actionIdx];
        if (!dstAction || dstActor.dead) {
          const before = snapshot(actor, dstActor);
          fireUnopposed(battle, slotInfo, action, dstActor);
          awardXpFromDeltas(battle, actor, dstActor, before, log);
        } else {
          const aRoll = rollAction(action, battle.rng);
          const bRoll = rollAction(dstAction, battle.rng);
          const result = resolveClash({ a: action, b: dstAction, aRoll, bRoll });
          log.push({ type: 'clash', src: { actor: actor.name, action: action.type, roll: aRoll }, dst: { actor: dstActor.name, action: dstAction.type, roll: bRoll }, winner: result.winner });
          const before = snapshot(actor, dstActor);
          applyEvents(result.events, actor, dstActor);
          awardXpFromDeltas(battle, actor, dstActor, before, log);
          consumed.add(k(side, actor.id, slotIdx, ai));
          // 회피가 승리한 경우 회피측 액션은 소비되지 않음 — 다음 합에 재사용
          const aIsEvadeWin = action.type === '회피' && (result.winner === 'a');
          const bIsEvadeWin = dstAction.type === '회피' && (result.winner === 'b');
          if (!bIsEvadeWin) consumed.add(k(tgt.side, tgt.actorId, tgt.slotIdx, tgt.actionIdx));
          if (aIsEvadeWin) consumed.delete(k(side, actor.id, slotIdx, ai));
        }
      } else {
        const opp = actor.side === 'player' ? battle.enemies.find(e => !e.dead) : battle.players.find(p => !p.dead);
        if (action.type === '공격' || action.type === '반격') {
          const before = snapshot(actor, opp);
          fireUnopposed(battle, slotInfo, action, opp);
          awardXpFromDeltas(battle, actor, opp, before, log);
        }
        consumed.add(k(side, actor.id, slotIdx, ai));
      }
      if (actor.dead) break;
    }
  }

  // 이번 턴 새로 발생한 적 사망/흐트러짐
  const endDead = battle.enemies.filter(e => e.dead).length;
  const endDisordered = battle.enemies.filter(e => e.disordered).length;
  battle._extraDraw = Math.max(0, (endDead - startDead) + (endDisordered - startDisordered));

  endTurn(battle);
}

function snapshot(a, b) {
  return {
    a: a ? { id: a.id, side: a.side, hp: a.hp, sp: a.sp, dead: a.dead, disordered: a.disordered } : null,
    b: b ? { id: b.id, side: b.side, hp: b.hp, sp: b.sp, dead: b.dead, disordered: b.disordered } : null,
  };
}

// 한 합 전후의 변동량을 보고 XP를 지급.
// 플레이어 캐릭터만 경험치를 쌓는다 (지금은 단일 파티 기준).
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
      // cur 가 피해를 입은 쪽. 가해자 = 반대편.
      const attacker = sideKey === 'a' ? dstActor : srcActor;
      const victim = cur;
      // 플레이어 → 적 가해 (XP 적립 대상: 가해한 플레이어 본인)
      if (attacker?.side === 'player' && victim.side === 'enemy') {
        let gain = 0;
        if (dHp > 0) gain += dHp * XP_RULES.perHpDamageDealt;
        if (dSp > 0) gain += dSp * XP_RULES.perSpDamageDealt;
        if (becameDisorder) gain += XP_RULES.causedDisorder;
        if (becameDead)     gain += XP_RULES.killedEnemy;
        applyXpToParty(battle, attacker.id, Math.round(gain), log);
      }
      // 적 → 플레이어 가해: 맞은 플레이어가 약간의 경험을 얻음 (시련의 보상)
      if (attacker?.side === 'enemy' && victim.side === 'player') {
        let gain = 0;
        if (dHp > 0) gain += dHp * XP_RULES.perHpDamageTaken;
        if (dSp > 0) gain += dSp * XP_RULES.perSpDamageTaken;
        applyXpToParty(battle, victim.id, Math.round(gain), log);
      }
      // 아군 사망 → 살아있는 모든 동료에게 큰 XP
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
  // run 측 파티 캐릭터에도 동기화 (영구 보존)
  const partyActor = state.run?.party.find(p => p.id === actorId);

  const events1 = awardXp(battleActor, amount);
  // 동기화: hp/sp 외 progression만 옮김
  if (partyActor) {
    partyActor.xp = battleActor.xp;
    partyActor.level = battleActor.level;
    // 영구 maxLight 는 baseMaxLight + 레벨 보너스로 결정
  }
  for (const ev of events1) {
    log.push({ type: 'levelUp', who: battleActor.name, level: ev.newLevel, maxLight: ev.newMaxLight });
  }
  log.push({ type: 'xpGain', who: battleActor.name, amount });
}

function fireUnopposed(battle, slotInfo, action, target) {
  if (!target) return;
  const { actor } = slotInfo;
  if (action.type === '공격' || action.type === '반격') {
    const roll = rollAction(action, battle.rng);
    applyEvents([{ kind: 'hit', from: 'a', to: 'b', amount: roll, prop: action.property }], actor, target);
    battle.log.push({ type: 'unopposed', src: actor.name, dst: target.name, amount: roll, prop: action.property });
  }
  // 방어류 미연결: 효과 없음
}

function endTurn(battle) {
  // 상태이상 turnEnd
  const ctx = { damage(actor, amount, prop) {
    applyEvents([{ kind: 'hit', from: 'a', to: 'b', amount, prop }], actor, actor);
  }};
  for (const a of [...battle.players, ...battle.enemies]) {
    if (a.dead) continue;
    tickStatuses(a, ctx, 'turnEnd');
    reduceDurations(a);
  }

  // 사용한 카드 처리: 소모면 exhausted, 아니면 discard
  for (const p of battle.players) {
    for (const slot of p.slots) {
      if (slot.card && slot.card.id) {
        const def = CARDS[slot.card.id];
        if (def?.consumable) battle.exhausted.push(slot.card.id);
        else battle.discardPile.push(slot.card.id);
      }
    }
  }

  // 카드 드로우: 기본 1장 + 이번 턴 새로 처치/흐트러진 적 수
  const extra = 1 + (battle._extraDraw || 0);
  battle._extraDraw = 0;
  for (const p of battle.players) drawCards(battle, p.id, extra);

  // 종료 조건
  const allEnemiesDead = battle.enemies.every(e => e.dead);
  const allPlayersDead = battle.players.every(p => p.dead);
  if (allEnemiesDead) { battle.phase = 'done'; battle.victory = true; return; }
  if (allPlayersDead) { battle.phase = 'done'; battle.victory = false; return; }

  // 다음 턴 준비 — 빛은 매 턴 가득 채워짐
  battle.turn += 1;
  for (const p of battle.players) {
    if (!p.dead) p.light = p.maxLight;
  }
  rollAllSpeeds(battle);
  pickEnemyActions(battle);
  battle.phase = 'plan';
}

// 합(클래시) 해소 로직.
//
// 액션 타입:
//   '공격'  — 합을 이기면 데미지를 준다.
//   '반격'  — 합을 하지 않고 일방적으로 맞는다. 단, 정신력 피해는 받지 않고
//             자신의 액션값만큼 상대를 때려준다.
//   '막기'  — 합을 이기면 차이만큼 상대 정신력 피해.
//             다른 방어 액션과 합쳐 이기면 자신의 값만큼 상대 정신력 피해.
//   '회피'  — 합을 이기면 무피해. 동률도 회피 측 승리.
//             패배 시 모든 데미지 그대로 받음. 합 패배 전까지 소비되지 않음.
//
// 합 순서:
//   - 양측이 연결한 합 쌍을 슬롯 속도가 빠른 쪽부터 해소.
//   - 미연결 액션: 더 빠른 쪽이 느린 쪽의 액션과 일방적으로 진행하지 않는다.
//                  대신 미연결은 "허공의 일격"으로 처리(상대 행위자에게 회피 가능한 데미지를 시도).

import { effectiveResist, PROPERTIES } from './data/properties.js';
import { applyStatus, attackerDamageMul, defenderBonusDamage } from './data/statuses.js';

export function rollAction(action, rng) {
  const { min, max } = action;
  return rng.int(min, max);
}

// 합 한 번 — 두 액션을 받아서 결과 객체를 반환
//   { winner: 'a'|'b'|'tie', aRoll, bRoll, events: [...] }
export function resolveClash({ a, b, aRoll, bRoll, attackerSide, defenderSide }) {
  const events = [];
  const aType = a.type, bType = b.type;

  // 회피 동률은 회피측 승리 (회피가 한 쪽일 때만)
  let winner = aRoll > bRoll ? 'a' : aRoll < bRoll ? 'b' : 'tie';
  if (winner === 'tie') {
    if (aType === '회피' && bType !== '회피') winner = 'a';
    else if (bType === '회피' && aType !== '회피') winner = 'b';
  }

  events.push({ kind: 'roll', a: aRoll, b: bRoll, winner });

  // 반격은 합을 하지 않음 → 어느 쪽이 반격이면 특수 처리
  if (aType === '반격' || bType === '반격') {
    handleCounter({ a, b, aRoll, bRoll, events });
    return { winner, aRoll, bRoll, events };
  }

  if (winner === 'a') applyHit(a, b, aRoll, bRoll, 'a', events);
  else if (winner === 'b') applyHit(b, a, bRoll, aRoll, 'b', events);
  else {
    // 양쪽 모두 비공격류일 때 또는 진짜 동률(둘 다 회피 아님): 둘 다 소비, 데미지 없음
    events.push({ kind: 'tieNothing' });
  }
  return { winner, aRoll, bRoll, events };
}

function handleCounter({ a, b, aRoll, bRoll, events }) {
  // 반격은 합 없이 양쪽 다 데미지를 주고받는다.
  // 반격하는 쪽: 정신력 피해 면제, 자기 액션값을 상대에게 가한다.
  // 비반격 쪽: 자기 액션이 공격류면 정상 데미지를 가한다 (방어류는 무피해).
  const aCounter = a.type === '반격', bCounter = b.type === '반격';

  if (aCounter) {
    events.push({ kind: 'hit', from: 'a', to: 'b', amount: aRoll, prop: a.property, fromCounter: true });
  }
  if (bCounter) {
    events.push({ kind: 'hit', from: 'b', to: 'a', amount: bRoll, prop: b.property, fromCounter: true });
  }
  if (!aCounter && a.type === '공격') {
    events.push({ kind: 'hit', from: 'a', to: 'b', amount: aRoll, prop: a.property, counteredByMental: true });
  }
  if (!bCounter && b.type === '공격') {
    events.push({ kind: 'hit', from: 'b', to: 'a', amount: bRoll, prop: b.property, counteredByMental: true });
  }
}

function applyHit(winAct, loseAct, winRoll, loseRoll, fromSide, events) {
  const other = fromSide === 'a' ? 'b' : 'a';
  if (winAct.type === '공격') {
    // 회피 방어가 졌으면 전부 받음, 막기는 데미지 흡수
    if (loseAct.type === '회피') {
      events.push({ kind: 'hit', from: fromSide, to: other, amount: winRoll, prop: winAct.property, fullThrough: true });
    } else if (loseAct.type === '막기') {
      const dmg = Math.max(0, winRoll - loseRoll);
      events.push({ kind: 'hit', from: fromSide, to: other, amount: dmg, prop: winAct.property, blocked: true });
    } else {
      // 공격 vs 공격
      events.push({ kind: 'hit', from: fromSide, to: other, amount: winRoll, prop: winAct.property });
    }
    // 효과 적용 (예: 떨림)
    if (winAct.effects) for (const e of winAct.effects)
      events.push({ kind: 'effect', from: fromSide, to: e.target === 'self' ? fromSide : other, id: e.id, value: e.value });
  }
  else if (winAct.type === '막기') {
    if (loseAct.type === '공격') {
      const diff = Math.max(0, winRoll - loseRoll);
      events.push({ kind: 'mentalHit', from: fromSide, to: other, amount: diff });
    } else {
      // 막기 vs 막기/회피
      events.push({ kind: 'mentalHit', from: fromSide, to: other, amount: winRoll });
    }
  }
  else if (winAct.type === '회피') {
    // 회피 승리: 데미지 없음. 회피는 소비되지 않음 표시.
    events.push({ kind: 'evade', from: fromSide });
  }
}

// 회피 액션은 합에서 졌을 때만 소비된다. 그 외에는 다음 합에 재사용.
export function isConsumedAfterClash(action, wonClash) {
  if (action.type === '회피') return !wonClash;
  return true;
}

// 이벤트들을 actor에 적용
export function applyEvents(events, actorA, actorB) {
  for (const ev of events) {
    if (ev.kind === 'hit') {
      const attacker = ev.from === 'a' ? actorA : actorB;
      const target = ev.to === 'a' ? actorA : actorB;
      const prop = PROPERTIES[ev.prop];
      if (!prop) continue;
      const mult = effectiveResist(target, ev.prop);
      const attackerMul = attackerDamageMul(attacker);
      const defenderAdd = defenderBonusDamage(target);
      const dmg = Math.max(0, Math.round((ev.amount + defenderAdd) * mult * attackerMul));
      if (prop.target === 'hp') {
        // 보호막 흡수
        const shield = target.statuses?.보호막 || 0;
        const absorbed = Math.min(shield, dmg);
        if (absorbed > 0) target.statuses.보호막 = shield - absorbed;
        const final = dmg - absorbed;
        target.hp = Math.max(0, target.hp - final);
        // SP 칩 — 막아낸/반격받은/막힌 공격은 SP 칩 없음 (제대로 막힘)
        if (!ev.counteredByMental && !ev.fromCounter && !ev.blocked) {
          target.sp = Math.max(0, target.sp - Math.floor(final * 0.25));
        }
      } else if (prop.target === 'sp') {
        target.sp = Math.max(0, target.sp - dmg);
      }
    } else if (ev.kind === 'mentalHit') {
      const target = ev.to === 'a' ? actorA : actorB;
      target.sp = Math.max(0, target.sp - ev.amount);
    } else if (ev.kind === 'effect') {
      const target = ev.to === 'a' ? actorA : actorB;
      applyStatus(target, ev.id, ev.value);
    }
    if (actorA.hp <= 0) actorA.dead = true;
    if (actorB.hp <= 0) actorB.dead = true;
    // 적용 시점이 현재 턴 도중이므로 duration=2로 잡아
    // 현재 턴 종료 시 1 감소, 다음 턴 행동 불가, 그 다음 턴 종료 시 해제.
    if (actorA.sp <= 0 && !actorA.disordered) applyStatus(actorA, '흐트러짐', 2);
    if (actorB.sp <= 0 && !actorB.disordered) applyStatus(actorB, '흐트러짐', 2);
  }
}

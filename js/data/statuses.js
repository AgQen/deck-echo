// 상태이상 정의. 초기에는 자리만 마련.
// 각 상태는 {id, label, bad, stack, onTurnEnd?, onDamageDealt?, onDamageTaken?, onApply?}
// 전투 로직에서 hook들이 호출됨.

export const STATUSES = {
  흐트러짐: {
    id: '흐트러짐', label: '흐트러짐', bad: true, stack: false,
    desc: '모든 내성이 취약으로 변하고, 다음 턴 행동 불가.',
    duration: 1,
  },
  // 예시 자리 — 추후 채울 것
  출혈: {
    id: '출혈', label: '출혈', bad: true, stack: true,
    desc: '턴 종료 시 스택만큼 체력 감소.',
    onTurnEnd: (actor, stack, ctx) => ctx.damage(actor, stack, '관통'),
  },
  떨림: {
    id: '떨림', label: '떨림', bad: true, stack: true,
    desc: '턴 종료 시 스택만큼 정신력 감소.',
    onTurnEnd: (actor, stack, ctx) => ctx.damage(actor, stack, '정신'),
  },
  보호막: {
    id: '보호막', label: '보호막', bad: false, stack: true,
    desc: '받는 체력 피해를 스택만큼 흡수.',
  },
  약화: {
    id: '약화', label: '약화', bad: true, stack: true,
    desc: '가하는 데미지가 스택당 -10% (최대 -50%).',
    // 데미지 가산은 resolveAttack 측 modifier 에서 처리 (data만 보관)
  },
  강화: {
    id: '강화', label: '강화', bad: false, stack: true,
    desc: '가하는 데미지가 스택당 +10% (최대 +50%).',
  },
  관통상: {
    id: '관통상', label: '관통상', bad: true, stack: true,
    desc: '받는 데미지가 스택만큼 가산.',
  },
};

// 액션 가하는 측 데미지 보정 — 강화/약화 결합
export function attackerDamageMul(actor) {
  let m = 1.0;
  if (actor?.statuses?.강화) m += Math.min(0.5, 0.10 * actor.statuses.강화);
  if (actor?.statuses?.약화) m -= Math.min(0.5, 0.10 * actor.statuses.약화);
  return Math.max(0.1, m);
}
// 받는 측 추가 가산 — 관통상
export function defenderBonusDamage(actor) {
  return actor?.statuses?.관통상 || 0;
}

export function tickStatuses(actor, ctx, when) {
  if (!actor.statuses) return;
  for (const key of Object.keys(actor.statuses)) {
    const def = STATUSES[key];
    if (!def) continue;
    if (when === 'turnEnd' && def.onTurnEnd) {
      def.onTurnEnd(actor, actor.statuses[key], ctx);
    }
  }
}

export function reduceDurations(actor) {
  if (!actor.statuses) return;
  // 흐트러짐 같이 duration이 있는 상태는 한 턴 줄임
  const k = '흐트러짐';
  if (actor.statuses[k] != null) {
    actor.statuses[k] -= 1;
    if (actor.statuses[k] <= 0) {
      delete actor.statuses[k];
      actor.disordered = false;
    }
  }
}

export function applyStatus(actor, id, value = 1) {
  if (!actor.statuses) actor.statuses = {};
  const def = STATUSES[id];
  if (!def) return;
  if (def.stack) actor.statuses[id] = (actor.statuses[id] || 0) + value;
  else actor.statuses[id] = value;
  if (id === '흐트러짐') actor.disordered = true;
}

// 경험치 / 레벨업 / 빛 비용 관련 튜닝 값.
// 모두 여기서 한 곳으로 모아 추후 밸런스 조정.

export const LEVEL_CAP = 5;

// 누적 경험치 임계값. 인덱스 i 까지의 합이 레벨 i 에서 (i+1)로 올라가기 위해 필요한 누적값.
// 즉 0레벨 시작이면 LEVEL_THRESHOLDS[1]=20 XP에서 레벨1, [2]=50에서 레벨2, ...
export const LEVEL_THRESHOLDS = [0, 20, 50, 100, 200, 400];

// 레벨 당 최대 빛 (기본 maxLight 에 더해짐)
//   character.maxLight + LEVEL_BONUS_LIGHT[level]
export const LEVEL_BONUS_LIGHT = [0, 1, 2, 3, 4, 5];

// XP 획득 룰
export const XP_RULES = {
  perHpDamageDealt: 1.0,      // 적에게 가한 HP 데미지 1당 XP
  perHpDamageTaken: 0.5,      // 받은 HP 데미지 1당 XP (눈물 한 방울)
  perSpDamageDealt: 0.5,      // 정신력 데미지
  perSpDamageTaken: 0.25,
  causedDisorder: 20,         // 적을 흐트러지게 함
  killedEnemy: 50,            // 적 사살
  allyDied: 50,               // 동료 사망 (감응)
};

// 레벨업 시 콜백 (battle 측에서 호출)
export function awardXp(actor, amount) {
  if (!actor) return [];
  actor.xp = (actor.xp || 0) + amount;
  const events = [];
  while (actor.level < LEVEL_CAP) {
    const need = LEVEL_THRESHOLDS[actor.level + 1] ?? Infinity;
    if (actor.xp >= need) {
      actor.level += 1;
      // 최대 빛 증가 + 가득 채우기
      actor.maxLight = actor.baseMaxLight + LEVEL_BONUS_LIGHT[actor.level];
      actor.light = actor.maxLight;
      events.push({ kind: 'levelUp', actorId: actor.id, newLevel: actor.level, newMaxLight: actor.maxLight });
    } else break;
  }
  return events;
}

export function xpToNext(actor) {
  if (actor.level >= LEVEL_CAP) return null;
  return LEVEL_THRESHOLDS[actor.level + 1];
}

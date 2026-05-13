// 플레이어블 캐릭터 (나 + 동료).
// 동료는 추후 진행 중에 합류시키도록 hire 시스템과 연결 예정.

// 캐릭터의 baseMaxLight 는 레벨 0 기준 빛 최대치.
// 레벨업 시 progression.js 의 LEVEL_BONUS_LIGHT 를 더해서 actual max 가 됨.
export const CHARACTERS = {
  protagonist: {
    id: 'protagonist',
    name: '주인공',
    portrait: '🜂',
    maxHp: 50, maxSp: 30,
    actionSlots: 2,             // 한 턴에 배치 가능한 카드 수
    speedDice: { min: 4, max: 7 }, // 슬롯마다 굴리는 속도 범위
    baseMaxLight: 5,
    resist: { 참격: '일반', 관통: '일반', 타격: '일반', 정신: '일반', 공포: '일반' },
    startingDeck: null,         // null이면 STARTER_DECK 사용
  },
  scholar: {
    id: 'scholar',
    name: '서생',
    portrait: '📖',
    maxHp: 38, maxSp: 42,
    actionSlots: 2,
    speedDice: { min: 3, max: 6 },
    baseMaxLight: 6,            // 정신력형 → 빛이 더 많음
    resist: { 참격: '취약', 관통: '일반', 타격: '일반', 정신: '저항', 공포: '저항' },
    startingDeck: null,
  },
  scout: {
    id: 'scout',
    name: '척후',
    portrait: '🏹',
    maxHp: 44, maxSp: 28,
    actionSlots: 3,             // 슬롯 많음 = 빠르게 여러 합
    speedDice: { min: 5, max: 8 },
    baseMaxLight: 4,
    resist: { 참격: '일반', 관통: '저항', 타격: '취약', 정신: '일반', 공포: '일반' },
    startingDeck: null,
  },
};

// 캐릭터를 런타임 actor로 인스턴스화
export function instantiateCharacter(id, overrides = {}) {
  const def = CHARACTERS[id];
  if (!def) throw new Error(`Unknown character ${id}`);
  return {
    side: 'player',
    id: def.id,
    name: def.name,
    portrait: def.portrait,
    maxHp: def.maxHp, hp: def.maxHp,
    maxSp: def.maxSp, sp: def.maxSp,
    actionSlots: def.actionSlots,
    speedDice: { ...def.speedDice },
    resist: { ...def.resist },
    // 빛 / 레벨 / 경험치
    baseMaxLight: def.baseMaxLight ?? 5,
    maxLight: def.baseMaxLight ?? 5,      // 레벨 0 시작
    light: def.baseMaxLight ?? 5,         // 현재 빛 (전투 시작 시 가득)
    level: 0,
    xp: 0,
    statuses: {},
    disordered: false,
    dead: false,
    // 런타임 전투 상태
    slots: [],          // [{speed, card, plan: [{actionIdx, target: {actorId, slotIdx, actionIdx}}]}]
    ...overrides,
  };
}

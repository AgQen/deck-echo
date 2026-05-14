// 플레이어블 캐릭터 (나 + 동료).
// 동료는 추후 진행 중에 합류시키도록 hire 시스템과 연결 예정.

// 캐릭터의 baseMaxLight 는 레벨 0 기준 빛 최대치.
// 레벨업 시 progression.js 의 LEVEL_BONUS_LIGHT 를 더해서 actual max 가 됨.
export const CHARACTERS = {
  protagonist: {
    id: 'protagonist',
    name: '조사관',
    portrait: '🜍',
    maxHp: 50, maxSp: 30,
    actionSlots: 2,
    speedDice: { min: 4, max: 7 },
    baseMaxLight: 5,
    resist: { 참격: '일반', 관통: '일반', 타격: '일반', 정신: '일반', 공포: '일반' },
    startingDeck: [
      'baseSlash', 'baseSlash', 'basePierce', 'baseSmash',
      'baseGuard', 'baseParry', 'baseEvade',
      'insight', 'rareWhirl',
    ],
    blurb: '균형 잡힌 검사. 합·방어 모두 안정적.',
  },
  scholar: {
    id: 'scholar',
    name: '서생',
    portrait: '📖',
    maxHp: 38, maxSp: 42,
    actionSlots: 2,
    speedDice: { min: 3, max: 6 },
    baseMaxLight: 6,
    resist: { 참격: '취약', 관통: '일반', 타격: '일반', 정신: '저항', 공포: '저항' },
    startingDeck: [
      'insight', 'insight', 'meditation',
      'baseGuard', 'mantraBlock', 'baseEvade',
      'rareDread', 'ritual', 'paranoia',
    ],
    blurb: '정신력이 두텁고 손패 회전이 빠름. 카드 콤보 빌더.',
  },
  scout: {
    id: 'scout',
    name: '척후',
    portrait: '🏹',
    maxHp: 44, maxSp: 28,
    actionSlots: 3,
    speedDice: { min: 5, max: 8 },
    baseMaxLight: 4,
    resist: { 참격: '일반', 관통: '저항', 타격: '취약', 정신: '일반', 공포: '일반' },
    startingDeck: [
      'basePierce', 'basePierce', 'baseSlash',
      'baseParry', 'baseEvade', 'baseEvade',
      'shadowStrike', 'twinFang',
    ],
    blurb: '빠른 속도로 적의 빈틈을 찌른다. 출혈·관통상 시너지.',
  },
  // ── 신규 동료
  hunter: {
    id: 'hunter',
    name: '사냥꾼',
    portrait: '🜌',
    maxHp: 46, maxSp: 30,
    actionSlots: 2,
    speedDice: { min: 4, max: 8 },
    baseMaxLight: 5,
    resist: { 참격: '일반', 관통: '저항', 타격: '일반', 정신: '일반', 공포: '저항' },
    startingDeck: [
      'piercingMark', 'piercingMark',
      'basePierce', 'baseSlash',
      'baseParry', 'baseEvade',
      'bleedingEdge', 'reckoning',
    ],
    blurb: '관통상 · 출혈을 새기고 표식 받은 적을 큰 한 방으로 정리.',
  },
  madman: {
    id: 'madman',
    name: '광인',
    portrait: '🜺',
    maxHp: 40, maxSp: 38,
    actionSlots: 2,
    speedDice: { min: 3, max: 7 },
    baseMaxLight: 5,
    resist: { 참격: '일반', 관통: '일반', 타격: '저항', 정신: '취약', 공포: '취약' },
    startingDeck: [
      'rareDread', 'rareDread',
      'mindGouge',
      'weakeningHowl',
      'baseGuard', 'baseEvade',
      'paranoia',
      'echoOfTheDeep',
    ],
    blurb: '떨림 · 약화를 광범위하게. 자기 정신력은 약하지만 적의 정신을 부순다.',
  },
  monk: {
    id: 'monk',
    name: '수도자',
    portrait: '🜔',
    maxHp: 54, maxSp: 36,
    actionSlots: 2,
    speedDice: { min: 3, max: 6 },
    baseMaxLight: 5,
    resist: { 참격: '저항', 관통: '저항', 타격: '저항', 정신: '저항', 공포: '일반' },
    startingDeck: [
      'mantraBlock', 'mantraBlock',
      'spiritGuard',
      'baseGuard', 'baseParry',
      'battleHymn',
      'meditation',
      'baseSmash',
    ],
    blurb: '강화 · 보호막 · 회복으로 버팀. 느리지만 한 명만 살아도 됨.',
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
    targetActorId: null,                  // 교전 중인 적 (캐릭터-캐릭터 합)
    statuses: {},
    disordered: false,
    dead: false,
    // 런타임 전투 상태
    slots: [],          // [{speed, card, plan: [{actionIdx, target: {actorId, slotIdx, actionIdx}}]}]
    ...overrides,
  };
}

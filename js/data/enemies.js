// 적 정의. 각 적은 카드 풀(소위 "행동 패턴")을 가지며,
// AI가 매 턴 그 풀에서 슬롯 수만큼 뽑아 배치한다.

import { CARDS } from './cards.js';

export const ENEMIES = {
  husk: {
    id: 'husk', name: '비틀거리는 잔재', portrait: '👁',
    maxHp: 11, maxSp: 18, actionSlots: 1,
    speedDice: { min: 1, max: 3 },     // 초반 적은 느리게 — 플레이어가 합을 걸기 쉽도록
    resist: { 참격: '일반', 관통: '저항', 타격: '취약', 정신: '취약', 공포: '취약' },
    // 자체 패턴: id 또는 카드 정의를 직접
    pattern: [
      { type: '공격', min: 2, max: 4, property: '타격', name: '휘청 일격' },
      { type: '막기', min: 2, max: 3, property: '타격', name: '비틀 회피' },
    ],
    reward: { type: 'card', rarity: '일반' },
  },
  watcher: {
    id: 'watcher', name: '관찰자', portrait: '🜲',
    maxHp: 15, maxSp: 24, actionSlots: 2,
    speedDice: { min: 4, max: 7 },
    resist: { 참격: '일반', 관통: '일반', 타격: '일반', 정신: '저항', 공포: '저항' },
    pattern: [
      { type: '공격', min: 3, max: 5, property: '관통', name: '응시' },
      { type: '회피', min: 3, max: 6, property: '관통', name: '잔영' },
      { type: '공격', min: 2, max: 6, property: '공포', name: '속삭임' },
    ],
    reward: { type: 'card', rarity: '희귀' },
  },
  bossWeaver: {
    id: 'bossWeaver', name: '엮는 자', portrait: '🕷',
    maxHp: 40, maxSp: 55, actionSlots: 3,
    speedDice: { min: 4, max: 8 },
    resist: { 참격: '저항', 관통: '일반', 타격: '저항', 정신: '저항', 공포: '면역' },
    pattern: [
      { type: '공격', min: 4, max: 7, property: '참격', name: '갈고리' },
      { type: '막기', min: 4, max: 6, property: '참격', name: '명주실' },
      { type: '회피', min: 5, max: 8, property: '참격', name: '실 위 걸음' },
      { type: '공격', min: 6, max: 9, property: '공포', name: '얽힘' },
    ],
    reward: { type: 'relic' },
  },

  // ── 1막 추가 적
  cultist: {
    id: 'cultist', name: '광신도', portrait: '🕯',
    maxHp: 13, maxSp: 20, actionSlots: 2,
    speedDice: { min: 2, max: 4 },
    resist: { 참격: '일반', 관통: '일반', 타격: '일반', 정신: '저항', 공포: '저항' },
    pattern: [
      { type: '공격', min: 3, max: 5, property: '참격', name: '의식 단검' },
      { type: '공격', min: 2, max: 4, property: '공포', name: '주문 영창' },
      { type: '막기', min: 2, max: 4, property: '정신', name: '경건한 자세' },
    ],
    reward: { type: 'card', rarity: '일반' },
  },

  // ── 2막 적
  thrall: {
    id: 'thrall', name: '심해의 종', portrait: '🐟',
    maxHp: 18, maxSp: 24, actionSlots: 2,
    speedDice: { min: 3, max: 6 },
    resist: { 참격: '저항', 관통: '일반', 타격: '취약', 정신: '일반', 공포: '저항' },
    pattern: [
      { type: '공격', min: 4, max: 7, property: '관통', name: '비늘 손' },
      { type: '반격', min: 3, max: 5, property: '관통', name: '반사 신경' },
      { type: '회피', min: 3, max: 5, property: '관통', name: '미끄럼' },
      { type: '공격', min: 5, max: 8, property: '타격', name: '바다 일격' },
    ],
    reward: { type: 'card', rarity: '희귀' },
  },

  // ── 3막 적
  spawn: {
    id: 'spawn', name: '심연의 자손', portrait: '🦑',
    maxHp: 24, maxSp: 30, actionSlots: 2,
    speedDice: { min: 4, max: 7 },
    resist: { 참격: '일반', 관통: '저항', 타격: '일반', 정신: '저항', 공포: '면역' },
    pattern: [
      { type: '공격', min: 5, max: 8, property: '공포', name: '망각의 손길', effects: [{ id: '떨림', value: 2 }] },
      { type: '공격', min: 4, max: 7, property: '참격', name: '촉수' },
      { type: '막기', min: 4, max: 6, property: '공포', name: '환각' },
      { type: '회피', min: 4, max: 7, property: '공포', name: '비현실' },
    ],
    reward: { type: 'card', rarity: '희귀' },
  },
  shoggothLet: {
    id: 'shoggothLet', name: '슈고스렛', portrait: '🟣',
    maxHp: 30, maxSp: 36, actionSlots: 3,
    speedDice: { min: 3, max: 7 },
    resist: { 참격: '저항', 관통: '저항', 타격: '일반', 정신: '취약', 공포: '면역' },
    pattern: [
      { type: '공격', min: 6, max: 9, property: '타격', name: '거품' },
      { type: '공격', min: 4, max: 6, property: '공포', name: '눈으로 응시' },
      { type: '반격', min: 5, max: 7, property: '타격', name: '되돌림' },
      { type: '회피', min: 4, max: 8, property: '타격', name: '액화' },
    ],
    reward: { type: 'relic' },
  },

  // ── 보스
  bossTheRitualist: {
    id: 'bossTheRitualist', name: '의식의 집전자', portrait: '🜏',
    maxHp: 65, maxSp: 80, actionSlots: 3,
    speedDice: { min: 5, max: 8 },
    resist: { 참격: '일반', 관통: '저항', 타격: '저항', 정신: '면역', 공포: '면역' },
    pattern: [
      { type: '공격', min: 5, max: 9, property: '공포', name: '광기 주입', effects: [{ id: '떨림', value: 3 }] },
      { type: '공격', min: 6, max: 10, property: '참격', name: '심연의 낫' },
      { type: '막기', min: 5, max: 8, property: '공포', name: '광기의 결계' },
      { type: '회피', min: 6, max: 9, property: '공포', name: '비실재' },
    ],
    reward: { type: 'relic' },
  },
  bossSleeperOfTheDeep: {
    id: 'bossSleeperOfTheDeep', name: '잠든 자', portrait: '🐙',
    maxHp: 100, maxSp: 120, actionSlots: 4,
    speedDice: { min: 4, max: 9 },
    resist: { 참격: '저항', 관통: '저항', 타격: '저항', 정신: '저항', 공포: '면역' },
    pattern: [
      { type: '공격', min: 7, max: 12, property: '타격', name: '깊은 곳의 발톱' },
      { type: '공격', min: 6, max: 10, property: '공포', name: '꿈의 자락', effects: [{ id: '떨림', value: 4, target: 'opponent' }] },
      { type: '공격', min: 8, max: 14, property: '관통', name: '미지의 시선' },
      { type: '막기', min: 6, max: 10, property: '공포', name: '심해의 침묵' },
      { type: '반격', min: 7, max: 10, property: '타격', name: '돌풍 같은 분노' },
      { type: '회피', min: 6, max: 11, property: '공포', name: '꿈으로 미끄러짐' },
    ],
    reward: { type: 'relic' },
  },

  // ─── 상태이상 키워드 기반 신규 적 ───
  bleedfeeder: {
    id: 'bleedfeeder', name: '혈식자', portrait: '🩸',
    maxHp: 15, maxSp: 20, actionSlots: 2,
    speedDice: { min: 2, max: 5 },
    resist: { 참격: '저항', 관통: '취약', 타격: '일반', 정신: '일반', 공포: '저항' },
    pattern: [
      { type: '공격', min: 2, max: 5, property: '참격', name: '저미는 송곳니', effects: [{ id: '출혈', value: 2, target: 'opponent' }] },
      { type: '공격', min: 3, max: 6, property: '참격', name: '뜯기', effects: [{ id: '출혈', value: 1, target: 'opponent' }] },
      { type: '회피', min: 2, max: 4, property: '참격', name: '핥기' },
    ],
    reward: { type: 'card', rarity: '일반' },
  },
  wilter: {
    id: 'wilter', name: '시들음', portrait: '🥀',
    maxHp: 14, maxSp: 26, actionSlots: 2,
    speedDice: { min: 2, max: 4 },
    resist: { 참격: '일반', 관통: '일반', 타격: '저항', 정신: '저항', 공포: '저항' },
    pattern: [
      { type: '공격', min: 1, max: 3, property: '공포', name: '시드는 입김', effects: [{ id: '약화', value: 2, target: 'opponent' }] },
      { type: '막기', min: 3, max: 5, property: '공포', name: '엉킨 가지' },
      { type: '공격', min: 3, max: 5, property: '타격', name: '뻣뻣한 가지' },
    ],
    reward: { type: 'card', rarity: '일반' },
  },
  moaningShape: {
    id: 'moaningShape', name: '신음하는 형상', portrait: '👤',
    maxHp: 16, maxSp: 30, actionSlots: 2,
    speedDice: { min: 3, max: 5 },
    resist: { 참격: '일반', 관통: '일반', 타격: '일반', 정신: '저항', 공포: '면역' },
    pattern: [
      { type: '공격', min: 2, max: 4, property: '공포', name: '귓속 신음', effects: [{ id: '떨림', value: 3, target: 'opponent' }] },
      { type: '공격', min: 3, max: 5, property: '공포', name: '낮은 외침' },
      { type: '회피', min: 3, max: 6, property: '공포', name: '흩어짐' },
    ],
    reward: { type: 'card', rarity: '희귀' },
  },
  stalker: {
    id: 'stalker', name: '추격자', portrait: '🜉',
    maxHp: 17, maxSp: 22, actionSlots: 3,
    speedDice: { min: 5, max: 8 },
    resist: { 참격: '일반', 관통: '저항', 타격: '취약', 정신: '일반', 공포: '일반' },
    pattern: [
      { type: '공격', min: 2, max: 5, property: '관통', name: '표적 새김', effects: [{ id: '관통상', value: 2, target: 'opponent' }] },
      { type: '공격', min: 4, max: 6, property: '관통', name: '추격 일격' },
      { type: '회피', min: 4, max: 7, property: '관통', name: '그림자 걸음' },
      { type: '반격', min: 3, max: 5, property: '관통', name: '반사' },
    ],
    reward: { type: 'card', rarity: '희귀' },
  },

  // ─── 새 미니보스 (정예 슬롯에서 등장) ───
  sleepWeaver: {
    id: 'sleepWeaver', name: '잠을 짜는 자', portrait: '🜗',
    maxHp: 35, maxSp: 50, actionSlots: 3,
    speedDice: { min: 3, max: 7 },
    resist: { 참격: '저항', 관통: '일반', 타격: '저항', 정신: '저항', 공포: '면역' },
    pattern: [
      { type: '공격', min: 3, max: 6, property: '공포', name: '꿈의 실', effects: [{ id: '떨림', value: 2, target: 'opponent' }, { id: '약화', value: 1, target: 'opponent' }] },
      { type: '공격', min: 4, max: 7, property: '참격', name: '엮어 자른다', effects: [{ id: '출혈', value: 1, target: 'opponent' }] },
      { type: '막기', min: 4, max: 6, property: '공포', name: '망각의 천' },
      { type: '회피', min: 4, max: 7, property: '공포', name: '꿈 사이' },
    ],
    reward: { type: 'relic' },
  },
  hollowChorus: {
    id: 'hollowChorus', name: '공허 합창', portrait: '🜍',
    maxHp: 28, maxSp: 64, actionSlots: 3,
    speedDice: { min: 2, max: 6 },
    resist: { 참격: '저항', 관통: '저항', 타격: '일반', 정신: '취약', 공포: '저항' },
    pattern: [
      { type: '공격', min: 2, max: 4, property: '공포', name: '첫 음', effects: [{ id: '떨림', value: 1, target: 'opponent' }] },
      { type: '공격', min: 3, max: 5, property: '공포', name: '둘째 음', effects: [{ id: '떨림', value: 2, target: 'opponent' }] },
      { type: '공격', min: 4, max: 7, property: '공포', name: '마지막 음', effects: [{ id: '떨림', value: 3, target: 'opponent' }, { id: '약화', value: 2, target: 'opponent' }] },
      { type: '막기', min: 3, max: 6, property: '공포', name: '울림 차단' },
    ],
    reward: { type: 'relic' },
  },
};

export function instantiateEnemy(id) {
  const def = ENEMIES[id];
  if (!def) throw new Error(`Unknown enemy ${id}`);
  return {
    side: 'enemy',
    id: def.id, name: def.name, portrait: def.portrait,
    maxHp: def.maxHp, hp: def.maxHp,
    maxSp: def.maxSp, sp: def.maxSp,
    actionSlots: def.actionSlots,
    speedDice: { ...def.speedDice },
    resist: { ...def.resist },
    pattern: def.pattern.map(a => ({ ...a })),
    statuses: {},
    disordered: false,
    dead: false,
    targetActorId: null,
    slots: [],
  };
}

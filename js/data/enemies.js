// 적 정의. 각 적은 카드 풀(소위 "행동 패턴")을 가지며,
// AI가 매 턴 그 풀에서 슬롯 수만큼 뽑아 배치한다.

import { CARDS } from './cards.js';

export const ENEMIES = {
  husk: {
    id: 'husk', name: '비틀거리는 잔재', portrait: '👁',
    maxHp: 22, maxSp: 18, actionSlots: 1,
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
    maxHp: 30, maxSp: 24, actionSlots: 2,
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
    maxHp: 80, maxSp: 55, actionSlots: 3,
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
    slots: [],
  };
}

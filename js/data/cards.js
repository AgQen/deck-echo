// 카드 정의.
// 한 카드는 여러 액션을 가질 수 있음. 각 액션 = { type, min, max, property, effects? }
//   type: '공격' | '반격' | '막기' | '회피'
//   min/max: 합 굴림 범위
//   property: 데미지 속성 (PROPERTIES key)
//   effects: 합 승리 시 부여할 상태 (옵션) [{id, value, target}]
//
// 카드 속성:
//   id, name, desc, rarity('일반'|'희귀'|'유물'|'전설')
//   light: 배치 시 소모되는 빛 비용 (필수, 기본 1)
//   consumable: 한번 쓰면 사라짐
//   tags: 검색/시너지용
//
// 비용 가이드:
//   1빛 = 일반 / 적당한 액션
//   2빛 = 희귀 / 다중 액션 또는 강한 효과
//   3빛 = 유물 / 게임을 흔드는 카드
//   0빛 = 빠른 보조용 (강력하진 않음)

export const CARDS = {
  // ── 기본 공격
  baseSlash: {
    id: 'baseSlash', name: '쾌검', rarity: '일반', light: 1,
    desc: '두 번 휘둘러 베어낸다.',
    actions: [
      { type: '공격', min: 3, max: 5, property: '참격' },
      { type: '공격', min: 2, max: 4, property: '참격' },
    ],
    tags: ['근접', '참격'],
  },
  basePierce: {
    id: 'basePierce', name: '찌르기', rarity: '일반', light: 1,
    desc: '한 점을 노린다.',
    actions: [{ type: '공격', min: 5, max: 8, property: '관통' }],
    tags: ['근접', '관통'],
  },
  baseSmash: {
    id: 'baseSmash', name: '내려치기', rarity: '일반', light: 1,
    desc: '강한 일격.',
    actions: [{ type: '공격', min: 4, max: 9, property: '타격' }],
    tags: ['근접', '타격'],
  },

  // ── 방어
  baseGuard: {
    id: 'baseGuard', name: '막아내기', rarity: '일반', light: 1,
    desc: '두 번 막는다. 합을 이기면 차이만큼 정신력 피해.',
    actions: [
      { type: '막기', min: 3, max: 5, property: '타격' },
      { type: '막기', min: 3, max: 5, property: '타격' },
    ],
    tags: ['방어'],
  },
  baseParry: {
    id: 'baseParry', name: '되받아치기', rarity: '일반', light: 1,
    desc: '맞고 되돌려준다.',
    actions: [{ type: '반격', min: 4, max: 7, property: '참격' }],
    tags: ['반격'],
  },
  baseEvade: {
    id: 'baseEvade', name: '흘러내림', rarity: '일반', light: 0,
    desc: '값싼 회피. 같은 합도 회피로 인정.',
    actions: [{ type: '회피', min: 3, max: 6, property: '참격' }],
    tags: ['회피'],
  },

  // ── 합성/특수
  rareWhirl: {
    id: 'rareWhirl', name: '소용돌이', rarity: '희귀', light: 2,
    desc: '세 번 휘두른다.',
    actions: [
      { type: '공격', min: 3, max: 5, property: '참격' },
      { type: '공격', min: 3, max: 5, property: '참격' },
      { type: '공격', min: 3, max: 5, property: '참격' },
    ],
    tags: ['근접', '참격'],
  },
  rareDread: {
    id: 'rareDread', name: '망각의 속삭임', rarity: '희귀', light: 2,
    desc: '상대 정신력을 직격한다.',
    actions: [
      { type: '공격', min: 4, max: 6, property: '공포', effects: [{ id: '떨림', value: 2, target: 'opponent' }] },
    ],
    tags: ['원거리', '정신'],
  },
  uniqueLastStand: {
    id: 'uniqueLastStand', name: '마지막 버팀', rarity: '유물', light: 3,
    desc: '회피·반격·공격 한 줄. 한번 쓰면 사라진다.',
    consumable: true,
    actions: [
      { type: '회피', min: 4, max: 7, property: '참격' },
      { type: '반격', min: 5, max: 7, property: '참격' },
      { type: '공격', min: 6, max: 9, property: '참격' },
    ],
    tags: ['소모'],
  },
};

export function cardCost(card) {
  return card.light ?? 1;
}

// 카드 풀에서 등급별 무작위 추첨용
export function cardsByRarity(rarity) {
  return Object.values(CARDS).filter(c => c.rarity === rarity);
}

// 초기 시작덱 (세팅에서 변경 가능)
export const STARTER_DECK = [
  'baseSlash', 'baseSlash',
  'basePierce',
  'baseSmash',
  'baseGuard', 'baseGuard',
  'baseParry',
  'baseEvade',
  'rareWhirl',
  'rareDread',
];

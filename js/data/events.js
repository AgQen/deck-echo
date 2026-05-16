// 사건(이벤트) — 맵의 'event' 노드에서 무작위로 하나 펼쳐진다.
// 각 이벤트는 제목, 본문, 2~4개의 선택지를 갖는다.
//
// effect 키:
//   gold: N            골드 변동
//   hp: N              모든 캐릭터 HP 변동 (음수 가능)
//   sp: N              모든 캐릭터 SP 변동
//   maxHpDelta: N      영구 최대 체력 변동
//   card: 'cardId'     특정 카드를 선택된 캐릭터의 덱에 추가
//   card: 'random_<rarity>'   해당 등급에서 무작위 카드 (일반/희귀/유물)
//   relic: 'relicId'   특정 유물 추가
//   relic: 'random_<rarity>'  해당 등급에서 무작위 유물
//   loseRandomCard: true  덱에서 무작위 카드 1장 제거
//   status: { name, stacks }  모든 캐릭터에 상태 부여
//
// requireGold: N  선택지에 골드 N 이상 필요 (부족하면 disabled)
// requireHp: N    플레이어 평균 HP가 N 이상이어야 활성

export const EVENTS = [
  {
    id: 'crossroads',
    title: '세 갈래 길',
    text: '안개 속에서 세 갈래 길이 갈라진다. 어느 길이든 후회가 따를 것이다.',
    choices: [
      { label: '오른쪽 — 거친 바위 길', effect: { hp: -4, card: 'random_uncommon' }, result: '바위에 무릎이 까였지만, 잊혀진 책장이 한 장 발견됐다.' },
      { label: '왼쪽 — 평탄한 흙길',   effect: { gold: 18 },                       result: '낯선 행인이 떨어뜨린 동전 주머니를 줍는다.' },
      { label: '되돌아간다',           effect: {},                                  result: '아무 일도 없었다.' },
    ],
  },
  {
    id: 'old-shrine',
    title: '낡은 사당',
    text: '돌무더기 안쪽에서 검게 변한 사당이 보인다. 거기 새겨진 글귀가 너를 부른다.',
    choices: [
      { label: '봉헌한다 (골드 -25)', effect: { gold: -25, maxHpDelta: 6 }, requireGold: 25, result: '돌에 손을 댄다. 너는 더 단단해진 것을 느낀다 — 최대 체력 +6.' },
      { label: '기도만 한다',         effect: { sp: 8 },                     result: '맑은 정신이 돌아온다 — 정신력 +8.' },
      { label: '글귀를 깨부순다',     effect: { hp: -6, relic: 'random_common' }, result: '신성한 무언가가 무너진다. 손이 아리지만, 그 안에서 무엇인가 떨어진다.' },
    ],
  },
  {
    id: 'wandering-merchant',
    title: '떠도는 행상',
    text: '두건을 깊게 눌러쓴 행상이 천 위에 물건을 늘어놓는다. 값을 부르지 않는다.',
    choices: [
      { label: '카드 한 장 산다 (-30 골드)', effect: { gold: -30, card: 'random_uncommon' }, requireGold: 30, result: '행상은 너에게 알 수 없는 책장을 내민다.' },
      { label: '유물 한 점 산다 (-50 골드)', effect: { gold: -50, relic: 'random_common' }, requireGold: 50, result: '오래된 물건이 손에 차갑게 와닿는다.' },
      { label: '카드 한 장을 판다 (+15 골드)', effect: { gold: 15, loseRandomCard: true }, result: '행상은 책장을 받아 두건 아래 어둠에 묻는다.' },
      { label: '지나친다', effect: {}, result: '뒤를 돌아보았을 때, 행상은 이미 없었다.' },
    ],
  },
  {
    id: 'whispering-pool',
    title: '속삭이는 웅덩이',
    text: '검은 물 위에 너의 얼굴이 비치지 않는다. 그 안에서 무언가가 너의 이름을 부른다.',
    choices: [
      { label: '물을 마신다',     effect: { sp: -8, maxHpDelta: 4 }, result: '속이 비어지지만, 무언가가 너의 안에 자리 잡는다.' },
      { label: '손을 담근다',     effect: { hp: 12 },                 result: '차가운 물이 상처를 닦아낸다 — 체력 +12.' },
      { label: '뒤를 보지 않고 떠난다', effect: { gold: 8 }, result: '이상하게도 발 밑에 동전이 떨어져 있다.' },
    ],
  },
  {
    id: 'caged-thing',
    title: '갇힌 것',
    text: '쇠창살 너머에서 무엇인가 너를 본다. 인간의 눈이 아니다. 그것이 거래를 제안한다.',
    choices: [
      { label: '풀어준다',       effect: { relic: 'random_rare', hp: -10 }, result: '그것은 너를 잊지 않을 거라 말하고 사라진다. 손에 차가운 것이 남았다.' },
      { label: '죽인다',         effect: { gold: 20 }, result: '쇠창살 안의 것은 더 이상 움직이지 않는다. 곁에 동전이 흩어져 있다.' },
      { label: '못 본 척 지나간다', effect: {}, result: '너는 빠르게 걸어 지나친다. 등 뒤에서 소리가 따라왔다.' },
    ],
  },
  {
    id: 'starving-child',
    title: '굶주린 아이',
    text: '뼈만 남은 아이가 골목에서 너를 본다. 손에는 흙으로 더러워진 종이쪽지가 있다.',
    choices: [
      { label: '동전을 준다 (-15 골드)', effect: { gold: -15, card: 'insight' }, requireGold: 15, result: '아이는 종이쪽지를 너의 손에 쥐어준다. "통찰"이 새겨져 있다.' },
      { label: '음식을 나눈다',          effect: { hp: -5 },                      result: '너는 잠시 굶주리지만, 아이의 눈에 빛이 돌아온다.' },
      { label: '무시한다',               effect: {},                              result: '아이는 너의 뒷모습을 오래 바라보았다.' },
    ],
  },
  {
    id: 'forgotten-book',
    title: '잊혀진 책',
    text: '먼지가 두껍게 쌓인 책상 위에 책 한 권이 놓여 있다. 페이지가 스스로 넘어간다.',
    choices: [
      { label: '읽는다',          effect: { sp: -10, card: 'random_rare' }, result: '문장이 너의 머릿속에 새겨진다. 정신은 닳지만 새로운 책장을 얻었다.' },
      { label: '찢어 가져간다',   effect: { card: 'random_common', hp: -3 }, result: '책이 비명을 지른다. 페이지 한 장을 거머쥔다.' },
      { label: '덮어둔다',        effect: {},                                 result: '책은 너를 부르지 않았다는 듯 조용해진다.' },
    ],
  },
  {
    id: 'cursed-mirror',
    title: '저주받은 거울',
    text: '깨진 거울 조각이 바닥에 흩어져 있다. 거울마다 너와 다른 얼굴들이 떠 있다.',
    choices: [
      { label: '조각을 줍는다',     effect: { relic: 'random_common', hp: -4 }, result: '날카로운 조각이 손을 베지만, 그 안에 무언가가 깃들어 있다.' },
      { label: '거울을 깬다',       effect: { gold: 12, status: { name: '떨림', stacks: 1 } }, result: '거울이 모두 깨진다. 그 사이로 떨어진 동전을 줍지만, 무언가가 너를 본다.' },
      { label: '눈을 감고 지나간다', effect: { sp: 6 }, result: '심호흡. 정신력 +6.' },
    ],
  },
  {
    id: 'silent-priest',
    title: '말없는 사제',
    text: '재단 앞에 사제가 무릎 꿇고 있다. 그는 말하지 않는다. 너의 손을 잡으려 한다.',
    choices: [
      { label: '손을 내민다',     effect: { hp: 20, sp: 10 },               result: '따스함이 너의 안에 퍼진다 — 체력 +20, 정신력 +10.' },
      { label: '거절한다',        effect: { gold: 25 },                       result: '사제는 너의 손에 작은 주머니를 쥐어준다. 그 안에 동전이 들었다.' },
      { label: '사제를 들여다본다', effect: { relic: 'random_rare', sp: -15 }, result: '그의 눈 안에 다른 무엇이 있다. 너는 그 잔상을 가져왔다.' },
    ],
  },
  {
    id: 'broken-statue',
    title: '부서진 조각상',
    text: '거대한 조각상의 머리가 떨어져 너의 발치에 굴러왔다. 입가에 미소가 있다.',
    choices: [
      { label: '받침대를 뒤져본다', effect: { gold: 30 },                         result: '받침대 안에 숨겨진 동전들 — 골드 +30.' },
      { label: '머리를 가져간다', effect: { maxHpDelta: -3, relic: 'random_rare' }, result: '머리가 너의 등에서 속삭이기 시작한다. 가볍지는 않다.' },
      { label: '예의를 갖춘다',   effect: { sp: 5 },                              result: '잠시 침묵. 정신력 +5.' },
    ],
  },
];

export function pickEvent(rng) {
  return EVENTS[Math.floor(rng() * EVENTS.length)];
}

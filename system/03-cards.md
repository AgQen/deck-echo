# 03 · 카드

데이터: [`js/data/cards.js`](../js/data/cards.js)

## 카드 구조

```js
silentBlade: {
  id: 'silentBlade',
  name: '소리없는 칼',
  rarity: '희귀',          // '기본' | '일반' | '희귀' | '유물'
  light: 1,                // 카드 비용 (필요 빛)
  actions: [
    { type: '공격', min: 4, max: 8, property: '날카로움' },
    { type: '반격', min: 2, max: 5 },
  ],
  desc: '두 번째 합 시 +2.',  // 짧은 효과/플레이버 텍스트
  selfSpCost: 0,            // (선택) 카드를 놓을 때 자기 SP 소모
}
```

## action.type

- `공격` — 가장 흔한 공격 액션. 짝지어지면 합.
- `반격` — 공격의 일종이지만 우선순위 가산 + 방어 후 반격 패턴.
- `방어` — 들어오는 공격을 흡수. 짝이 없으면 풀에 들어가 누구든 막아줌.
- `회피` — 굴림이 공격을 넘으면 완전 회피.

## action.property

데미지 속성. 일부 적은 특정 속성에 약함/내성.
- `날카로움`, `둔기`, `광기`, `차가움`, `불꽃`, `출혈유발` 등.

## 새 카드 추가하기

1. `js/data/cards.js`의 `CARDS` 객체에 새 항목 추가.
2. id는 camelCase, 영문.
3. 시작 캐릭터 덱에 넣으려면 `js/data/characters.js`의 `startingDeck` 배열에 id 추가.
4. 시작 보너스 카드로 노출하려면 `js/ui/charSelect.js`의 `BONUS_POOL`에 id 추가.
5. 보상으로만 나오게 하려면 추가 작업 불필요 — 보상 풀이 자동으로 카드 데이터를 읽음.

## 카드 풀 (보상)

전투 클리어 시 4~6장 중에서 1장 선택.
보상에 나올 수 있는 카드는 `rarity` 가 `'기본'` 이 아닌 것들 (`getRewardCardCandidates` 참고).

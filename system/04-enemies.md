# 04 · 적

데이터: [`js/data/enemies.js`](../js/data/enemies.js)

## 적 구조

```js
husk: {
  id: 'husk', name: '잿빛 껍데기',
  portrait: '🜸',              // SVG가 없을 때 폴백 이모지
  maxHp: 11, maxSp: 0,
  actionSlots: 2,              // 한 턴에 몇 장의 카드를 둘 수 있나
  speedDice: { min: 1, max: 5 },
  baseMaxLight: 0,
  deck: ['weakStrike', 'shamble'],   // 카드 ID 풀, 매 턴 랜덤
  ai: 'random',                 // 'random' | 'aggressive' | 'defensive'
}
```

## AI 모드

- `random` — 덱에서 무작위로 슬롯에 채움. 짝짓기는 player 슬롯에 적당히.
- `aggressive` — 공격 카드 우선, 가장 약한(낮은 HP) 캐릭터에게 짝지음.
- `defensive` — 자기 HP 가 낮으면 방어/회피 우선.

## 적 카드

전용 카드들은 `js/data/cards.js`에도 정의됨 (예: `weakStrike`, `cultBlessing`).
플레이어가 획득할 수 없는 카드는 `rarity: '적전용'` 으로 표시.

## 막별 풀 (`js/data/acts.js`)

```js
enemyPool: {
  normal: [...id 배열, 가중치는 중복으로 표현 — 'husk'가 두 번 = 더 자주],
  elite: [...id 배열],
}
boss: '단일 보스 id'
```

## 새 적 추가하기

1. `enemies.js` 에 정의 추가.
2. 사용할 카드 ID를 `deck`에 적기 (없으면 `cards.js`에 카드도 추가).
3. `acts.js` 의 막에 추가하고 싶으면 `enemyPool.normal/elite` 에 id 추가.
4. (선택) SVG 초상화는 `js/data/portraits.js`, PNG는 `assets/portraits/<id>.png`.

## 보스

보스는 일반 적의 강화판. `boss: true` 마크 필요 없음 — 그냥 적 정의 + `acts[N].boss = 'id'`.
보스 처치 시 `progression.js`의 동료 합류 후보가 활성화됨.

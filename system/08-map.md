# 08 · 맵과 막 (Acts)

데이터: [`js/data/acts.js`](../js/data/acts.js)
UI: [`js/ui/map.js`](../js/ui/map.js)

## 막 (Act) 구성

```js
1: {
  name: '폐허의 입구',
  rows: 7,                           // 행 수
  minPerRow: 2, maxPerRow: 3,        // 행마다 노드 개수
  typeWeights: { battle: 55, event: 16, shop: 9, rest: 12, elite: 8 },
  enemyPool: {
    normal: [...id 배열, 중복으로 가중치],
    elite:  [...id 배열],
  },
  boss: 'bossWeaver',
}
```

## 노드 (Node)

- `battle` — 일반 전투. `enemyPool.normal` 에서 1~2 마리 선택.
- `elite` — 정예. `enemyPool.elite` 에서 1 마리.
- `boss` — 막 마지막 노드, 단일 보스. 처치 시 동료 합류 + 다음 막.
- `rest` — 야영, HP 40% + SP 50% 회복.
- `event` — 이벤트, 선택지 모달 (자세히는 [09-events.md](09-events.md)).
- `shop` — 상점, 골드로 카드/유물/체력 구입.

## 절차 생성

각 막은 시드 기반으로 매번 새로 생성. `generateAct(actNum, rng)` 가
- 노드 위치 (x, y) — 화면 비율 좌표
- 노드 타입 (`typeWeights` 가중 추첨)
- 연결 (다음 행의 가까운 1~2개)

## 균형 조정

- 적이 너무 약/강함 → `enemies.js` 의 `maxHp`, 카드 `actions[].min/max`
- 행 수가 적/많음 → `rows`
- 특정 노드가 너무 자주/드물게 → `typeWeights`
- 보스 직전 휴식이 부족 → `generateAct` 의 `if (row === cfg.rows - 2) { w.rest = 30; ... }`

## 보상 (전투 클리어)

`js/ui/battle.js`:
- 일반: 카드 4장 중 1장
- 정예: 카드 5장 중 1장 + 골드
- 보스: 카드 6장 중 1장 + 골드 + 유물 + 동료 합류

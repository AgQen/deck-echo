# 07 · 유물 (아이템)

데이터: [`js/data/relics.js`](../js/data/relics.js)

## 유물 구조

```js
weightedPendant: {
  id: 'weightedPendant',
  name: '묵직한 펜던트',
  rarity: '일반',                       // '일반' | '희귀' | '유물'
  icon: '🜍',                            // 1글자 이모지/유니코드
  desc: '최대 체력 +10.',
  onAcquire: (run) => { ... },          // 획득 즉시 1회
  onBattleStart: (battle, player) => { },  // 매 전투 시작
  onTurnStart: (battle, player) => { },    // 매 턴 시작
  onCardPlaced: (battle, player, cardId) => { },  // 카드 배치 직후
  onBattleEnd: (run, player) => { },       // 전투 종료
  onActDone: (run, actNum) => { },         // 막 클리어
  xpMultiplier: 1.3,                       // 경험치 배수 (선택)
}
```

## 등급

- **일반** — 작은 패시브, 자주 등장.
- **희귀** — 큰 영향, 상점/엘리트 보상에서.
- **유물** — 게임 체인저, 보스 보상에서.

## 훅 (hooks)

`fireRelicHook(run, hookName, ...args)` 로 발화.
새 훅을 만들고 싶으면 battle.js / progression.js 의 해당 시점에 호출 추가.

## 새 유물 추가하기

1. [`relics.js`](../js/data/relics.js) 의 `RELICS` 객체에 새 항목 추가
2. 등급(`rarity`)을 정하고, 적절한 훅에 효과 작성
3. 보상 풀은 등급별로 자동 — `rarity` 만 지정하면 끝.

## 아이디어 (참고용)

- **공격형**: 첫 합 시 데미지 +X / 적 처치 시 X 회복
- **방어형**: 매 턴 보호 +1 / 회피 성공 시 X 회복
- **자원형**: 매 턴 빛 +1 / 골드 획득량 X%
- **상태이상형**: 화상/출혈 데미지 +1 / 모든 적에게 떨림 1로 시작

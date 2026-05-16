# 02 · 전투 시스템

`js/battle.js` (전투 본체) + `js/clash.js` (합 결과 계산) + `js/ui/battle.js` (UI).

## 한 턴의 흐름

```
1. 카드 드로우 (각 캐릭터마다 자기 손패)
2. 카드를 슬롯에 배치 → 슬롯의 속도 주사위 굴림
3. 적 슬롯에 짝(linkedTo) 설정 (드래그 또는 자동)
4. 카드 모두 배치되면 [실행] → executeTurn(battle)
   a. 짝지어진 슬롯끼리 합(clash)
   b. 짝이 없는 공격은 일방적으로 타격
   c. 방어/회피는 풀에 들어가 들어오는 공격을 받음
5. 결과 정산 (HP/SP/상태이상)
6. 다음 턴
```

## 합 (clash)

[clash.js](../js/clash.js)에서 `resolveClash({ a, b, aRoll, bRoll })`.

- 공격 vs 공격: 큰 굴림이 이김. 진 쪽은 합 데미지(이긴 굴림 - 진 굴림)를 입음.
- 공격 vs 방어: 방어가 흡수. 남은 만큼만 공격이 적중.
- 공격 vs 회피: 회피 성공 시 무적, 실패 시 풀 데미지.
- 반격: 약한 공격이지만 우선순위 가산.

## 슬롯 짝 (engagement)

세 단계로 짝지을 수 있다 — 더 구체적인 게 우선:

1. **슬롯 ↔ 슬롯** (`pSlot.linkedTo = { actorId, slotIdx }`)
2. **적 슬롯이 내 캐릭터를 겨냥** (`eSlot.targetPlayerId`)
3. **캐릭터 ↔ 적** (`player.targetActorId`)

UI에서 슬롯 드래그로 1번을 만들고, 적 카드를 탭하면 2번이 갱신됨.

## 속도 주사위

캐릭터의 `speedDice: { min, max }` 안에서 슬롯마다 따로 굴림.
높은 속도가 먼저 행동, 슬롯 ↔ 슬롯 짝짓기에는 `pSlot.speed > eSlot.speed`가 필요.

## 빛 (light) — 카드 자원

`player.light` / `player.maxLight`. 카드의 `light` 비용만큼 빛 소모.
빛이 부족하면 그 카드는 배치 불가.

## 정신력 (SP) / 흐트러짐

SP가 0이 되면 `흐트러짐` 상태 — 그 턴은 자기 슬롯이 잠긴다(행동 불가).
SP 회복은 카드(`반향 명상` 등), 야영, 유물 등으로.

## 데이터 흐름

전투 입력: `enemyIds` (배열), `encounter.depthFactor` (난이도 보정).
전투 출력: 클리어 시 `battle.victory = true`, UI가 보상 화면으로.

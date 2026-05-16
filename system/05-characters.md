# 05 · 플레이어 캐릭터

데이터: [`js/data/characters.js`](../js/data/characters.js)

## 캐릭터 구조

```js
protagonist: {
  id: 'protagonist',
  name: '잿빛 조사관',
  portrait: '🜂',                  // SVG/PNG 없을 때 폴백 이모지
  blurb: '책임감 강한 노년의 학자.',  // 캐릭터 선택 화면 소개
  maxHp: 50, maxSp: 30,
  actionSlots: 2,
  speedDice: { min: 2, max: 6 },
  baseMaxLight: 3,
  startingDeck: ['basicStrike', 'basicGuard', ...],   // 8~10장
}
```

## 시작 가능 캐릭터

`js/ui/charSelect.js` 의 `STARTABLE` 배열:
- `protagonist`, `scholar`, `scout`, `hunter`, `madman`, `monk`

신규 캐릭터를 시작 가능하게 하려면 이 배열에 id 추가.

## 동료 합류

`js/data/progression.js` 의 `ACT_RECRUIT_POOL`:
- 1막 클리어 후 후보 N명 중 1명 선택
- 2막 클리어 후 후보 N명 중 1명 선택
- 3막은 엔딩

후보를 늘리려면 그 배열에 id 추가.

## 시작 보너스 카드

`js/ui/charSelect.js` 의 `BONUS_POOL` — 시작 시 2장 픽.
추가하려면 카드 ID를 이 배열에 추가.

## 새 캐릭터 추가하기

1. [`characters.js`](../js/data/characters.js) 에 정의 추가
2. (시작 가능하게) `js/ui/charSelect.js` 의 `STARTABLE` 에 id 추가
3. (동료로 합류) `js/data/progression.js` 의 `ACT_RECRUIT_POOL` 에 추가
4. (선택) 초상화 SVG는 `js/data/portraits.js`, PNG는 `assets/portraits/<id>.png`

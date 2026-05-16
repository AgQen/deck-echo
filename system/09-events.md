# 09 · 사건 (Events)

데이터: [`js/data/events.js`](../js/data/events.js)
UI: [`js/ui/events.js`](../js/ui/events.js)

## 이벤트 구조

```js
{
  id: 'crossroads',
  title: '세 갈래 길',
  text: '안개 속에서 세 갈래 길이 갈라진다. 어디로 갈 것인가?',
  choices: [
    {
      label: '오른쪽 길 — 거친 산기슭',
      effect: { gold: -10, card: 'random_uncommon' },
      result: '바위 위에 떨어진 책장 한 장을 발견했다.',
    },
    {
      label: '왼쪽 길 — 평탄한 흙길',
      effect: { hp: 5 },
      result: '잠깐의 휴식. 체력 +5.',
    },
    {
      label: '되돌아간다',
      effect: {},
      result: '아무 일도 없었다.',
    },
  ],
}
```

## effect 키

- `gold: N` — 골드 변동 (음수 가능)
- `hp: N` — 모든 캐릭터 HP 변동
- `sp: N` — 모든 캐릭터 SP 변동
- `card: 'cardId'` — 선택 캐릭터의 덱에 카드 추가
- `card: 'random_common' | 'random_uncommon' | 'random_rare'` — 그 등급 카드 무작위
- `relic: 'random_common' | 'random_rare' | 'random_legendary'` — 무작위 유물
- `relic: 'relicId'` — 특정 유물
- `maxHpDelta: N` — 영구 최대 체력 변동 (모든 캐릭터)
- `loseCard: true` — 덱에서 카드 1장 잃기 (선택)
- `requireGold: N` — 이 선택지가 가능한 조건 (골드 N 이상)

## 새 이벤트 추가하기

1. [`events.js`](../js/data/events.js) 의 `EVENTS` 배열에 객체 추가
2. id는 유일해야 함
3. choices 는 2~4개 권장
4. 끝. 노드 진입 시 자동으로 무작위 선택됨.

## 동작

- 맵에서 `event` 노드 진입 → `doEvent(node)` 호출 → 무작위 이벤트 1개
- 이벤트 모달이 뜨고 선택지 클릭 → effect 적용 → result 텍스트 표시 → 닫기

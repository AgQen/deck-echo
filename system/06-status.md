# 06 · 상태이상

데이터: [`js/data/statuses.js`](../js/data/statuses.js)

## 모델

모든 상태이상은 두 숫자로 표현:
- **스택 (stacks)** — 강도. 화상 3 = 매 턴 3 데미지.
- **지속 턴 (duration)** — 몇 턴 지속되는지.

`actor.statuses` 는 `{ [statusName]: stacks }` 또는 `{ [statusName]: { stacks, duration } }` 형태.
`statuses.js` 가 정의를 보고 어떤 의미로 해석할지 결정.

## 주요 상태이상

| 이름 | 설명 |
|---|---|
| `흐트러짐` | SP 0 시 발생. 자기 턴 행동 불가. |
| `화상` | 매 턴 화상 스택만큼 HP 데미지. |
| `출혈` | 액션 적중 시 스택만큼 추가 HP 데미지. |
| `떨림` | 명중률 감소. |
| `취약` | 받는 데미지 증가. |
| `약화` | 주는 데미지 감소. |
| `재생` | 매 턴 시작 시 HP 회복. |
| `힘` | 공격 데미지 가산. |
| `보호` | 받는 데미지 감산. |

## 적용 흐름

1. 카드의 `actions[].applies = { name, stacks, duration }` 로 적용
2. 또는 코드에서 직접 `actor.statuses[name] = (actor.statuses[name] || 0) + n`
3. 턴 종료 시 `tickStatuses(actor)` 로 화상/출혈 등 효과 발화 + 지속 턴 감소

## 새 상태이상 추가하기

1. [`statuses.js`](../js/data/statuses.js) 에 정의 추가
2. 카드의 `applies` 로 부여하거나 카드 효과 코드에서 직접 부여
3. UI 아이콘은 statuses.js의 정의에 포함시키면 자동으로 표시

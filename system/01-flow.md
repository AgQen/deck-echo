# 01 · 게임 전체 흐름

```
타이틀  →  캐릭터 선택  →  맵 (1막)  →  전투/이벤트/상점/야영  →  보스
                                  ↑ ─────────── 반복 ──────────── ↓
                                          2막 → 3막 → 엔딩
```

## 화면 (screen)

| ID | 코드 | 설명 |
|---|---|---|
| `title` | `js/ui/title.js` | 새 게임 / 이어하기 / 설정 |
| `character-select` | `js/ui/charSelect.js` | 캐릭터 + 보너스 카드 2장 선택 |
| `map` | `js/ui/map.js` | 막의 노드 그래프, 노드 클릭으로 진입 |
| `battle` | `js/ui/battle.js` | 카드 슬롯 배치 → 턴 해결 |

화면 전환은 `showScreen(name)` (`js/ui/common.js`).
화면이 바뀔 때 `assets/music/<name>.mp3`가 자동 재생됩니다.

## 노드 타입 (`js/data/acts.js`)

- `battle` — 일반 전투
- `elite` — 정예 (강한 단일 적)
- `boss` — 막 보스
- `rest` — 야영 (체력 40% + 정신력 50% 회복)
- `event` — 사건 (이야기 + 선택지)
- `shop` — 상점

## 저장

`js/storage.js` — localStorage. 스키마 v3. 버전 불일치 시 자동 초기화.

## 진실의 원본

- 막 구조: [acts.js](../js/data/acts.js)
- 막 클리어 후 동료 합류: [progression.js](../js/data/progression.js)
- 전체 상태 모델: [state.js](../js/state.js)

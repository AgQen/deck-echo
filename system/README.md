# system — DECK·ECHO 시스템 문서

이 폴더는 게임의 서브시스템별 정리 문서입니다. 코드가 어떻게 동작하는지,
어디를 어떻게 수정하면 되는지 한국어로 설명합니다.

게임 코드(`Game/js/`)가 진실의 원본(source of truth)이고, 이 문서들은
"어디에 무엇이 있는지" 안내하는 지도입니다.

## 목차

- [01-flow.md](01-flow.md) — 게임 전체 흐름 (타이틀→캐릭터선택→맵→전투)
- [02-combat.md](02-combat.md) — 전투 규칙: 합(clash), 속도, 슬롯, 이벤트 큐
- [03-cards.md](03-cards.md) — 카드 데이터 모델과 추가 방법
- [04-enemies.md](04-enemies.md) — 적 데이터 모델과 AI
- [05-characters.md](05-characters.md) — 플레이어 캐릭터 정의
- [06-status.md](06-status.md) — 상태이상 (흐트러짐, 화상, 출혈 등)
- [07-relics.md](07-relics.md) — 유물 (아이템) 시스템과 등급
- [08-map.md](08-map.md) — 맵/노드 종류와 진행
- [09-events.md](09-events.md) — 사건 (Events) 추가 방법
- [10-assets.md](10-assets.md) — 자산 자동 로딩 (초상화/음악) 동작 방식

## 새 콘텐츠를 어떻게 추가할까

- **새 카드** → `Game/js/data/cards.js`. [03-cards.md](03-cards.md) 참고.
- **새 적** → `Game/js/data/enemies.js`. [04-enemies.md](04-enemies.md) 참고.
- **새 캐릭터** → `Game/js/data/characters.js` + `charSelect.js`의 `STARTABLE`. [05-characters.md](05-characters.md) 참고.
- **새 유물** → `Game/js/data/relics.js`. [07-relics.md](07-relics.md) 참고.
- **초상화 이미지** → `Game/assets/portraits/<id>.png` 만 넣으면 끝. [09-assets.md](09-assets.md) 참고.
- **배경음악** → `Game/assets/music/<scene>.mp3` 만 넣으면 끝. [09-assets.md](09-assets.md) 참고.

## 핵심 디자인 원칙

1. **데이터-우선**: 카드/적/캐릭터 모두 `data/*.js`의 평범한 객체. 새 항목을
   추가하면 코드 변경 없이 게임에 등장.
2. **합(clash) 우선**: 모든 공격은 가능하면 짝지어 합을 만든다. 일방적
   타격은 짝이 없을 때만.
3. **속도 = 슬롯 단위**: 한 캐릭터의 슬롯마다 따로 주사위를 굴려 속도를 정함.
4. **상태이상은 스택+지속턴 2종으로 모두 표현**: 새 상태이상도 같은 구조.

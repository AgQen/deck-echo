# DECK · ECHO — 콘텐츠 추가 가이드라인

이 문서는 코드를 거의 모르는 사람이 게임에 자산(이미지/음악) 또는 콘텐츠(카드/적/이벤트/유물 등)를 추가하는 방법을 안내합니다.

—

## 폴더 한눈에 보기

```
Game/
├── index.html              ← 게임 진입점. 직접 열어 테스트
├── GUIDELINE.md            ← 이 문서
├── README.md               ← 프로젝트 개요
├── start.bat / start.ps1   ← 로컬 서버 실행 (자세히는 아래)
├── assets/                 ← ✅ 자산만 넣으면 자동 적용
│   ├── portraits/<id>.png  ← 캐릭터/적 초상화
│   ├── music/<scene>.mp3   ← 화면별 BGM
│   └── sfx/<name>.mp3      ← 효과음 (현재 자동 트리거 없음)
├── system/                 ← 📖 시스템별 문서 (편집 안내 포함)
│   ├── README.md           ← 목차
│   └── 01~10-*.md          ← 흐름/전투/카드/캐릭터/적/상태/유물/맵/이벤트/자산
├── css/                    ← 스타일
├── js/
│   ├── data/               ← 🎯 콘텐츠 데이터 (코드 거의 없는 JS)
│   │   ├── cards.js        ← 카드
│   │   ├── characters.js   ← 캐릭터
│   │   ├── enemies.js      ← 적
│   │   ├── events.js       ← 이벤트
│   │   ├── relics.js       ← 유물 (아이템)
│   │   ├── statuses.js     ← 상태이상
│   │   ├── acts.js         ← 막/맵 구성
│   │   ├── portraits.js    ← 인라인 SVG 초상화 (PNG 폴백)
│   │   └── progression.js  ← 막 클리어 시 동료 합류 풀
│   ├── ui/                 ← UI (편집 시 코드 읽기 권장)
│   └── battle.js / state.js / storage.js / rng.js / assets.js
```

—

## 가장 자주 하는 5가지 작업

### 1. 초상화 그림 바꾸기 (가장 간단)

1. `Game/assets/portraits/` 폴더 열기
2. `<액터ID>.png` 이름으로 256×256 PNG 저장
   - 예: `protagonist.png`, `bossSleeperOfTheDeep.png`
3. 브라우저 새로고침 (F5)
4. 끝.

> 사용 가능한 액터 ID 전체 목록은 [assets/portraits/README.md](assets/portraits/README.md) 참고.

### 2. 배경음악 넣기

1. `Game/assets/music/` 폴더 열기
2. 화면 이름과 같은 MP3 저장
   - `title.mp3`           — 타이틀
   - `character-select.mp3` — 캐릭터 선택
   - `map.mp3`             — 맵
   - `battle.mp3`          — 전투
3. 브라우저 새로고침
4. 화면이 바뀌면 자동으로 음악이 전환됩니다.

### 3. 새 카드 추가

1. `Game/js/data/cards.js` 열기
2. 기존 카드(예: `silentBlade`)를 복사해서 새 ID로 붙여넣기
3. `name`, `actions`(공격/방어 등), `desc` 수정
4. 자세한 구조는 [system/03-cards.md](system/03-cards.md) 참고
5. 카드를 시작 덱에 넣으려면 [system/05-characters.md](system/05-characters.md) 참고

### 4. 새 이벤트(사건) 추가

1. `Game/js/data/events.js` 열기
2. 기존 이벤트 객체를 복사하고 `id`, `title`, `text`, `choices` 수정
3. 끝 — 다음 게임 시작부터 자동으로 등장
4. 자세히는 [system/09-events.md](system/09-events.md)

### 5. 새 유물(아이템) 추가

1. `Game/js/data/relics.js` 열기
2. 기존 유물 복사하고 `rarity` (`일반`/`희귀`/`유물`) 선택
3. 효과 훅(`onBattleStart`, `onTurnStart`, `onCardPlaced` 등) 작성
4. 자세히는 [system/07-relics.md](system/07-relics.md)

—

## 어떤 프로그램이 필요한가

### 텍스트 / 코드 편집
- **VS Code** (https://code.visualstudio.com) — 추천. 무료, 자동완성, 한국어 지원.
- 또는 메모장도 가능 (단순 편집만)

### 이미지 (초상화)
- **GIMP** (https://www.gimp.org) — 무료, PNG 투명 배경 지원
- **Krita** (https://krita.org) — 무료, 일러스트에 강함
- **Photopea** (https://www.photopea.com) — 브라우저에서 바로 사용
- 또는 AI 이미지 생성기 (Stable Diffusion, Midjourney 등) — **저작권 안전한 출력만**

### 음악 (BGM)
- **Audacity** (https://www.audacityteam.org) — 무료 편집기
- **FL Studio** / **GarageBand** — 작곡
- **OpenGameArt.org** — CC0 게임 음악 다운로드
- **freepd.com** — Public Domain 음악

### 효과음
- **freesound.org** — CC0 필터로 검색
- **sfxr** / **Bfxr** — 무료 8비트 효과음 생성기

### 로컬에서 게임 실행
1. `Game/` 폴더에서 `start.bat` 더블클릭 (Windows)
2. 또는 `start.ps1` 우클릭 → PowerShell로 실행
3. 브라우저가 자동으로 열림 (보통 http://localhost:8000)

> 직접 `index.html`을 더블클릭하면 보안 정책 때문에 ES 모듈이 로드되지 않습니다. 반드시 로컬 서버를 통해 실행해야 합니다.

—

## 변경 사항을 게시(공개)하기

이 게임은 GitHub Pages에 자동 배포됩니다 (`https://agqen.github.io/deck-echo/`).

1. 변경 후 git에 커밋
   ```
   git add .
   git commit -m "변경 요약"
   git push
   ```
2. 1~3분 후 게시 사이트가 자동으로 갱신됩니다.

> 커밋 메시지는 한국어로 OK. 푸시 후 GitHub Actions 탭에서 배포 상태 확인 가능.

—

## 안전 / 저작권 체크리스트

자산을 추가하기 전에 반드시 확인:

- [ ] 본인이 만든 것
- [ ] CC0 / Public Domain 라이선스
- [ ] 사용 허가를 받은 것
- [ ] 저작권자가 명시적으로 허용한 것

다음은 **절대 사용 금지**:
- 상업 게임/영화/만화의 캐릭터, 음악, 이미지
- 모르는 출처의 이미지/음악
- AI 생성물 중 학습 데이터 출처가 명확하지 않은 것

이 게임의 모든 기본 디자인은 추상적이고 원형(原型)적인 형태로만 구성되어 저작권 문제가 없습니다. 직접 만드신 자산을 추가하실 때도 같은 원칙을 지켜주세요.

—

## 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| 화면이 아예 뜨지 않음 | 브라우저 콘솔(F12) 확인. 보통 `start.bat`을 안 쓰고 index.html을 직접 열어서 발생. |
| 새 PNG가 안 보임 | 파일명이 정확한가? 새로고침했나? 캐시 무효화: Ctrl+Shift+R |
| 새 카드가 안 보임 | JSON 문법 오류 가능 (쉼표 빠짐 등). 콘솔에서 SyntaxError 확인. |
| 음악이 안 나옴 | 자동재생 차단. 화면 한 번 클릭해주세요 (모바일 특히). |
| 저장이 안 됨 | localStorage 용량 초과 또는 시크릿 모드. 시크릿 모드 OFF. |

—

## 도움 받기

코드 구조가 궁금하면 [system/](system/) 폴더의 문서들을 보세요.
각 시스템마다 "새 X를 어떻게 추가할까" 섹션이 있습니다.

| 알고 싶은 것 | 보는 문서 |
|---|---|
| 게임 흐름 | [system/01-flow.md](system/01-flow.md) |
| 전투 / 합 규칙 | [system/02-combat.md](system/02-combat.md) |
| 카드 데이터 | [system/03-cards.md](system/03-cards.md) |
| 적 데이터 | [system/04-enemies.md](system/04-enemies.md) |
| 캐릭터 데이터 | [system/05-characters.md](system/05-characters.md) |
| 상태이상 | [system/06-status.md](system/06-status.md) |
| 유물 / 아이템 | [system/07-relics.md](system/07-relics.md) |
| 맵 / 노드 | [system/08-map.md](system/08-map.md) |
| 이벤트 | [system/09-events.md](system/09-events.md) |
| 자산 자동 로딩 | [system/10-assets.md](system/10-assets.md) |

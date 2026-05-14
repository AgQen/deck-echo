# DECK · ECHO — 잠든 자의 메아리

크툴루 분위기의 덱빌딩 로그라이크 모바일 웹게임. 라이브러리 오브 루이나식 합 시스템 + 슬레이 더 스파이어식 절차 생성 맵.

## 플레이

핸드폰/PC 브라우저에서 바로:
```
https://agqen.github.io/deck-echo/
```

로컬로 돌리려면:
1. `git clone https://github.com/AgQen/deck-echo.git`
2. `cd deck-echo`
3. `python serve.py` 또는 `start.bat` 더블클릭
4. 콘솔에 뜨는 주소로 접속 (같은 와이파이 핸드폰도 가능)

## 폴더 구조

```
Game/
  index.html              ← 단일 페이지, 모든 화면 포함
  serve.py / start.bat    ← 로컬 정적 서버
  css/style.css
  js/
    main.js               ← 엔트리 + 전역 에러 캐처
    state.js storage.js   ← 게임 상태, 저장
    rng.js                ← 시드 RNG
    clash.js battle.js    ← 합 해소 / 턴 진행 (async + hooks)
    data/
      properties.js       ← 속성, 내성 레벨
      statuses.js         ← 상태이상 hooks
      cards.js            ← 카드 (공격/방어/유틸)
      characters.js       ← 플레이어블
      enemies.js          ← 적 (1막 ~ 3막 + 보스)
      acts.js             ← 절차 맵 생성기 (3막)
      relics.js           ← 유물 + hook
      progression.js      ← 경험치, 레벨 임계
    ui/
      title.js map.js battle.js modals.js common.js
```

## 핵심 시스템

### 합 (Clash)
- 카드 단위 슬롯-슬롯 링크 (`slot.linkedTo`)
- 내 슬롯 속도 > 상대 슬롯 속도일 때만 연결 가능
- 노란 곡선 = 합, 빨간 점선 화살표 = 일방공격 (자동 타게팅)

### 방어 풀
- 미연결 방어 카드(막기/회피/반격)는 "대기 풀"
- 들어오는 공격에 자동 반응
- 회피만 합을 이기는 동안 풀에 잔존, 다른 방어는 1회 소비
- 방어 vs 방어 합은 직접 지정으로만

### 빛 (Light)
- 카드 비용. 매 턴 가득. 0~3
- 레벨업 시 최대 +1 + 즉시 가득

### 경험치 / 레벨
- 가해·피해·흐트러짐·처치로 누적
- Lv 0~5. 임계: [0, 20, 50, 100, 200, 400]
- 막 보스 클리어 시 0 초기화 + 큰 보상

### 골드 / 유물 / 상점
- 전투/사건으로 골드 획득
- 12종 유물 (전투 시작 / 매 턴 / 획득 시 효과)
- 상점에서 카드 / 유물 / 회복 / 카드 제거 구매

### 3막 구조
- 막 1: 폐허의 입구 (잔재, 광신도, 관찰자 / 보스: 엮는 자)
- 막 2: 잠긴 신전 (광신도, 심해의 종 / 보스: 의식의 집전자)
- 막 3: 잠든 신의 곁 (심해의 종, 심연의 자손, 슈고스렛 / 보스: 잠든 자)
- 각 막은 절차 생성: 5~7행, 행마다 2~4 노드, 분기 → 보스로 수렴

### 흐트러짐 (SP 0)
- 모든 내성이 취약(2배 피해)
- 다음 한 턴 행동 불가

## 어디서부터 손대면 좋은가

| 바꾸고 싶은 것              | 파일                                |
| --------------------------- | ----------------------------------- |
| 카드 / 빛 비용 / 액션값     | `js/data/cards.js`                  |
| 상태이상                    | `js/data/statuses.js`               |
| 속성 / 내성                 | `js/data/properties.js`             |
| 캐릭터 스탯 / 슬롯 / 기본 빛 | `js/data/characters.js`             |
| 경험치 / 레벨 임계          | `js/data/progression.js`            |
| 적 패턴                     | `js/data/enemies.js`                |
| 막 구성 / 절차 생성 규칙    | `js/data/acts.js`                   |
| 유물                        | `js/data/relics.js`                 |
| 합 처리 규칙                | `js/clash.js`                       |
| 턴 진행 / 방어 풀           | `js/battle.js`                      |
| 손패 크기 등                | `js/state.js` 의 `state.settings`   |

## 조작 요약

- **빈 슬롯 (+) 탭** → 카드 픽
- **카드 ✕** → 슬롯에서 회수 (빛 환불)
- **카드 길게 누르기** → 확대
- **내 카드 클릭 → 적 카드 클릭** → 슬롯-슬롯 합 연결
- **내 카드 재클릭** → 합 모드 취소 + 기존 연결 해제
- **▶ 시작** → 합 해소 애니메이션 진행
- **📜** → 최근 전투 로그 토스트

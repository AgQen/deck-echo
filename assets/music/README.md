# assets/music — 장면별 배경음악 (BGM)

장면(screen) 이름과 같은 파일을 넣으면 그 화면으로 전환될 때 자동으로 반복 재생됩니다.

## 파일 규칙

- 형식: `mp3`, `ogg`, `wav`, `m4a` (모바일 호환 위해 **MP3 권장**)
- 볼륨: 마스터링된 -14 LUFS 정도면 적당. 너무 크면 자동으로 깎이지 않음.
- 길이: 1~3분 루프 곡 권장 (자동으로 무한 반복).

## 인식되는 장면 이름

- `title.mp3`           — 타이틀 화면
- `character-select.mp3` — 캐릭터 선택 화면
- `map.mp3`             — 지도 (탐험) 화면
- `battle.mp3`          — 전투 화면

## 예시

```
assets/music/title.mp3
assets/music/battle.mp3
```

> 화면이 바뀌면 이전 BGM은 멈추고 새 BGM이 시작됩니다.
> 파일이 없는 장면에서는 음악이 재생되지 않습니다 (조용).

## 자동재생 제한

브라우저는 첫 사용자 클릭 전까지 자동재생을 막습니다 (특히 모바일).
게임은 사용자가 화면을 처음 터치/클릭하는 순간 자동으로 BGM 재생을 시도합니다.

## 음원 추천 (저작권 안전)

- 본인이 작곡한 음악
- CC0 / Public Domain: [freepd.com](https://freepd.com/), [opengameart.org](https://opengameart.org/)
- 게임 음악 컴포저 의뢰

저작권이 있는 상업 음원은 절대 사용하지 마세요.

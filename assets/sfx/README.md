# assets/sfx — 효과음 (선택사항)

현재 게임 코드는 효과음 슬롯을 만들어 두었지만 자동 재생되는 곳은 아직 없습니다.
직접 트리거하려면 자바스크립트에서:

```js
import { playSfx } from '../assets.js';
playSfx('clash');   // assets/sfx/clash.mp3 를 한 번 재생
```

## 파일 규칙

- 형식: `mp3`, `ogg`, `wav`, `m4a` (짧은 사운드는 **WAV** 도 OK)
- 길이: 0.1~2초 권장
- 파일명: 소문자, 공백 없이 (예: `clash.mp3`, `card-place.mp3`)

## 사용 가능한 이름 (예시 — 코드가 호출하는 곳은 아직 없음)

- `clash` — 합 발생 시
- `hit` — 피격
- `card-place` — 카드 슬롯 배치
- `victory` — 전투 승리
- `defeat` — 전투 패배

> 이름은 자유롭게 추가 가능. 코드에서 `playSfx('이름')` 호출만 추가하면 됩니다.

저작권 안전 소스: [freesound.org](https://freesound.org/) (CC0 필터), 본인 녹음, 게임 효과음 라이브러리.

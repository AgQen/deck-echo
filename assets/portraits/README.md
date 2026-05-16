# assets/portraits — 초상화 이미지

여기에 `<actorId>.png` 파일을 넣으면 게임에서 자동으로 인라인 SVG 대신 그 이미지를 보여줍니다.

## 파일 규칙

- 형식: `png`, `jpg`, `jpeg`, `webp` (PNG 권장 — 투명 배경 가능)
- 권장 크기: **256×256 정사각형** (게임에서 원형 마스크로 잘립니다)
- 파일명 = 액터 ID, 소문자/카멜케이스 그대로

## 액터 ID 목록

### 플레이어 캐릭터 (`Game/js/data/characters.js`)
- `protagonist` — 잿빛 조사관
- `scholar` — 잊혀진 서생
- `scout` — 그늘 척후
- `hunter` — 침묵의 사냥꾼
- `madman` — 미친 자
- `monk` — 잿재의 수도자

### 적 (`Game/js/data/enemies.js`)
- 일반: `husk`, `watcher`, `cultist`, `thrall`, `spawn`, `shoggothLet`,
        `bleedfeeder`, `wilter`, `moaningShape`, `stalker`, `sleepWeaver`, `hollowChorus`
- 보스: `bossWeaver`, `bossTheRitualist`, `bossSleeperOfTheDeep`

## 예시

```
assets/portraits/protagonist.png       ← 256×256 PNG
assets/portraits/bossSleeperOfTheDeep.png
```

저작권 — 본인이 만들었거나 사용 권한이 있는 이미지만 넣으세요.
파일이 없으면 기존 SVG 실루엣이 그대로 사용됩니다.

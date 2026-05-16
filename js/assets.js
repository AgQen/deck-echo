// 사용자 자산 자동 로더.
//   - assets/portraits/<actorId>.png  → 초상화 교체 (없으면 SVG 폴백 유지)
//   - assets/music/<scene>.mp3        → 장면별 BGM (없으면 음악 없음)
//   - assets/sfx/<name>.mp3           → 효과음 (없으면 무음)
//
// 모든 자산은 선택사항. 없으면 게임은 그대로 동작한다.

const PORTRAIT_BASE = 'assets/portraits/';
const MUSIC_BASE = 'assets/music/';
const SFX_BASE = 'assets/sfx/';
const PORTRAIT_EXTS = ['png', 'jpg', 'jpeg', 'webp'];
const AUDIO_EXTS = ['mp3', 'ogg', 'wav', 'm4a'];

// URL -> 'loaded' | null. null은 "확인됨, 없음" 캐시. 미확인 키는 부재.
const portraitCache = new Map();
const audioCache = new Map();

function probeImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function findPortraitUrl(actorId) {
  if (portraitCache.has(actorId)) return portraitCache.get(actorId);
  for (const ext of PORTRAIT_EXTS) {
    const url = `${PORTRAIT_BASE}${actorId}.${ext}`;
    const ok = await probeImage(url);
    if (ok) { portraitCache.set(actorId, url); return url; }
  }
  portraitCache.set(actorId, null);
  return null;
}

// 컨테이너 div에 PNG가 있으면 배경 이미지로 덮어쓴다.
// 호출 후 비동기 — SVG가 잠시 보일 수 있으나 거슬리지 않게 fade-in.
export function applyPortrait(actorId, container) {
  if (!actorId || !container) return;
  findPortraitUrl(actorId).then(url => {
    if (!url) return;
    container.classList.add('has-png');
    container.style.backgroundImage = `url("${url}")`;
  });
}

// ─── 오디오 ───

let bgmEl = null;
let currentScene = null;
let musicVolume = 0.5;
let sfxVolume = 0.7;
let muted = false;

function probeAudio(url) {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.oncanplaythrough = () => resolve(url);
    a.onloadedmetadata = () => resolve(url);
    a.onerror = () => resolve(null);
    a.src = url;
  });
}

async function findAudioUrl(base, name) {
  const key = `${base}${name}`;
  if (audioCache.has(key)) return audioCache.get(key);
  for (const ext of AUDIO_EXTS) {
    const url = `${base}${name}.${ext}`;
    const ok = await probeAudio(url);
    if (ok) { audioCache.set(key, url); return url; }
  }
  audioCache.set(key, null);
  return null;
}

export async function setSceneMusic(scene) {
  if (currentScene === scene) return;
  currentScene = scene;
  const url = await findAudioUrl(MUSIC_BASE, scene);
  if (!url) {
    if (bgmEl) { bgmEl.pause(); bgmEl = null; }
    return;
  }
  if (bgmEl && bgmEl.dataset.scene === scene) return;
  if (bgmEl) bgmEl.pause();
  bgmEl = new Audio(url);
  bgmEl.loop = true;
  bgmEl.volume = muted ? 0 : musicVolume;
  bgmEl.dataset.scene = scene;
  bgmEl.play().catch(() => { /* 자동재생 차단 — 사용자 첫 클릭 후 재시도 */ });
}

export function playSfx(name) {
  findAudioUrl(SFX_BASE, name).then(url => {
    if (!url || muted) return;
    const a = new Audio(url);
    a.volume = sfxVolume;
    a.play().catch(() => {});
  });
}

export function setMusicVolume(v) {
  musicVolume = Math.max(0, Math.min(1, v));
  if (bgmEl) bgmEl.volume = muted ? 0 : musicVolume;
}
export function setSfxVolume(v) { sfxVolume = Math.max(0, Math.min(1, v)); }
export function setMuted(b) {
  muted = !!b;
  if (bgmEl) bgmEl.volume = muted ? 0 : musicVolume;
}

// 자동재생 차단 우회: 첫 사용자 입력 후 BGM 재시도.
function unlockOnce() {
  if (bgmEl && bgmEl.paused) bgmEl.play().catch(() => {});
  document.removeEventListener('pointerdown', unlockOnce);
  document.removeEventListener('keydown', unlockOnce);
}
document.addEventListener('pointerdown', unlockOnce);
document.addEventListener('keydown', unlockOnce);

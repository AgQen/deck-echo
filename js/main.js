// 엔트리 포인트
import { state } from './state.js';
import { loadSettings, hasSave } from './storage.js';
import { bindTitle } from './ui/title.js';
import { bindMap } from './ui/map.js';
import { bindBattle } from './ui/battle.js';
import { bindModals } from './ui/modals.js';
import { bindCharacterSelect } from './ui/charSelect.js';
import { CARDS } from './data/cards.js';

// 전역 노출 (디버그용)
window.__CARDS__ = CARDS;
window.__state__ = state;

// 화면에 에러를 띄우는 오버레이. 콘솔 못 보는 환경(핸드폰)에서 유용.
function showError(msg) {
  let overlay = document.getElementById('err-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'err-overlay';
    overlay.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#3a1414;color:#ffd0d0;font:12px monospace;padding:10px 12px;white-space:pre-wrap;max-height:40vh;overflow:auto;border-top:2px solid #c04040;';
    document.body.appendChild(overlay);
    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = 'position:absolute;top:4px;right:8px;background:none;border:none;color:#ffd0d0;font-size:18px;';
    close.onclick = () => overlay.remove();
    overlay.appendChild(close);
  }
  const line = document.createElement('div');
  line.textContent = msg;
  overlay.appendChild(line);
}

window.addEventListener('error', (e) => {
  showError(`[error] ${e.message}\n  @ ${e.filename}:${e.lineno}:${e.colno}`);
});
window.addEventListener('unhandledrejection', (e) => {
  showError(`[promise] ${e.reason}`);
});

function applySettingsToDOM() {
  document.body.classList.toggle('wide', !!state.settings.wide);
}

function init() {
  loadSettings();
  // 설정 입력 동기화
  for (const [k, v] of Object.entries(state.settings)) {
    const inp = document.querySelector(`[data-setting="${k}"]`);
    if (!inp) continue;
    if (inp.type === 'checkbox') inp.checked = !!v;
    else inp.value = v;
  }
  applySettingsToDOM();
  // 와이드 토글이 바뀌면 즉시 반영
  const wideInput = document.querySelector('[data-setting="wide"]');
  if (wideInput) wideInput.addEventListener('change', applySettingsToDOM);

  bindTitle();
  bindCharacterSelect();
  bindMap();
  bindBattle();
  bindModals();

  // 더블탭 줌 방지 등 모바일 동작
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // ESC 키로 모달 닫기 (보상/상점 등 명시적 종료가 필요한 모달은 닫지 않도록 제외)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const closable = ['settings', 'help', 'deck', 'card-pick', 'card-zoom', 'setup'];
    for (const name of closable) {
      const m = document.querySelector(`[data-modal="${name}"].active`);
      if (m) {
        import('./ui/common.js').then(({ closeModal }) => closeModal());
        break;
      }
    }
  });

  // 이어하기 버튼 활성/비활성 표시
  const cont = document.querySelector('[data-action="continue"]');
  if (cont && !hasSave()) cont.style.opacity = 0.5;

  // PWA 설치 가능 — 서비스 워커 등록 (캐싱 없는 최소 SW)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 실패해도 무시 */ });
  }

  // 부팅 완료 플래그 (인라인 부팅 캐처가 이걸 보고 30초 알람을 끔)
  window.__BOOTED__ = true;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

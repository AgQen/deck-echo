import { $, showScreen, openModal, toast } from './common.js';
import { startNewRun, state } from '../state.js';
import { hasSave, loadRun, clearRun } from '../storage.js';
import { renderMap } from './map.js';

export function bindTitle() {
  document.querySelectorAll('[data-screen="title"] [data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      try { onTitleAction(btn.dataset.action); }
      catch (e) { console.error(e); toast('오류: ' + (e.message || e)); throw e; }
    });
  });
}

function onTitleAction(act) {
  switch (act) {
    case 'new-game': {
      if (hasSave()) {
        if (!confirm('진행 중인 기록이 있습니다. 새로 시작하면 사라집니다.')) return;
        clearRun();
      }
      startNewRun({});
      showScreen('map');
      // 화면 전환 직후 layout이 잡히도록 다음 프레임에 렌더
      requestAnimationFrame(() => renderMap());
      break;
    }
    case 'continue': {
      const run = loadRun();
      if (!run) { toast('저장된 진행이 없습니다'); return; }
      showScreen('map');
      requestAnimationFrame(() => renderMap());
      break;
    }
    case 'setup': openModal('setup'); break;
    case 'settings': openModal('settings'); break;
    case 'credits': toast('© DECK·ECHO — v0.1.0', 2200); break;
  }
}

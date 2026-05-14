import { $, showScreen, openModal, toast } from './common.js';
import { startNewRun, state } from '../state.js';
import { hasSave, loadRun, clearRun } from '../storage.js';
import { renderMap } from './map.js';
import { openCharacterSelect } from './charSelect.js';

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
      openCharacterSelect();
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
    case 'help': openModal('help'); break;
    case 'credits': toast('© DECK·ECHO — 잠든 자의 메아리 v0.2', 2400); break;
  }
}

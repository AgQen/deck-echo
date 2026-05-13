import { $, $$, el, showScreen, toast } from './common.js';
import { state } from '../state.js';
import { saveAll } from '../storage.js';
import { renderBattle } from './battle.js';
import { startBattle } from '../battle.js';

const TYPE_ICON = {
  battle: '⚔', elite: '☠', event: '❓', shop: '🛒', rest: '🪵', boss: '👑',
};

export function bindMap() {
  document.querySelectorAll('[data-screen="map"] [data-action]').forEach(btn => {
    btn.addEventListener('click', () => onMapAction(btn.dataset.action));
  });
}

export function renderMap() {
  const run = state.run;
  if (!run) return;
  const canvas = $('#map-canvas');
  if (!canvas) return;
  // 화면 전환 직후 레이아웃이 아직 안 잡혔으면 다음 프레임에 재시도
  if (canvas.clientWidth === 0) {
    requestAnimationFrame(renderMap);
    return;
  }
  canvas.innerHTML = '';

  // 라벨 + 종류 표기
  const current = run.map.current;
  const reachable = new Set(run.map.nodes[current]?.conn || []);

  // SVG로 연결선 (viewBox 사용해서 픽셀 좌표 의존성 제거)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'map-edges');
  svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
  canvas.appendChild(svg);

  for (const [id, n] of Object.entries(run.map.nodes)) {
    for (const to of n.conn) {
      const tgt = run.map.nodes[to];
      if (!tgt) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', n.pos[0] * 100);
      line.setAttribute('y1', n.pos[1] * 100);
      line.setAttribute('x2', tgt.pos[0] * 100);
      line.setAttribute('y2', tgt.pos[1] * 100);
      const isPath = (id === current && reachable.has(to)) || (to === current && reachable.has(id));
      line.setAttribute('stroke', isPath ? '#d8a957' : '#5a5a66');
      line.setAttribute('stroke-width', isPath ? '0.6' : '0.4');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      line.style.strokeWidth = isPath ? '3' : '2';
      svg.appendChild(line);
    }
  }

  for (const [id, n] of Object.entries(run.map.nodes)) {
    const wrap = el('div', { class: 'map-node-wrap' });
    wrap.style.left = (n.pos[0] * 100) + '%';
    wrap.style.top = (n.pos[1] * 100) + '%';

    const node = el('button', {
      class: 'map-node',
      'data-type': n.type,
      'data-node-id': id,
      text: TYPE_ICON[n.type] || '·',
    });
    if (id === current) node.classList.add('current');
    if (run.map.cleared[id]) node.classList.add('cleared');
    if (reachable.has(id)) node.classList.add('reachable');
    node.addEventListener('click', () => onNodeClick(id));
    wrap.appendChild(node);

    const label = el('div', { class: 'map-node-label', text: n.label || n.type });
    wrap.appendChild(label);

    canvas.appendChild(wrap);
  }

  $('[data-stat="day"]').textContent = `${run.day}일차`;
}

let pendingNode = null;
function onNodeClick(id) {
  const run = state.run;
  const reach = new Set(run.map.nodes[run.map.current]?.conn || []);
  if (!reach.has(id)) { toast('도달할 수 없음'); return; }
  pendingNode = id;
  toast(`${run.map.nodes[id].label} 선택 — 진입 누르기`);
  document.querySelectorAll('.map-node').forEach(n => n.classList.remove('selected'));
  document.querySelector(`[data-node-id="${id}"]`)?.classList.add('selected');
}

function onMapAction(act) {
  switch (act) {
    case 'map-back': showScreen('title'); break;
    case 'open-settings': document.querySelector('[data-modal="settings"]').classList.add('active'); break;
    case 'rest': onRest(); break;
    case 'deck': openDeck(); break;
    case 'enter-node': enterNode(); break;
  }
}

function enterNode() {
  const run = state.run;
  if (!pendingNode) { toast('노드를 선택하세요'); return; }
  const node = run.map.nodes[pendingNode];
  if (!node) return;
  run.map.current = pendingNode;
  saveAll();

  switch (node.type) {
    case 'battle':
    case 'elite':
    case 'boss': {
      startBattle({ enemyIds: node.encounter.enemies, mapNodeId: pendingNode });
      showScreen('battle');
      renderBattle();
      break;
    }
    case 'rest': {
      for (const p of run.party) {
        p.hp = Math.min(p.maxHp, Math.floor(p.hp + p.maxHp * (node.encounter?.heal ?? 0.3)));
        p.sp = Math.min(p.maxSp, Math.floor(p.sp + p.maxSp * 0.5));
      }
      run.map.cleared[pendingNode] = true;
      toast('휴식 — 체력과 정신력 회복');
      saveAll();
      renderMap();
      break;
    }
    case 'event': toast('사건 — 추후 구현'); run.map.cleared[pendingNode] = true; renderMap(); break;
    case 'shop':  toast('상점 — 추후 구현'); run.map.cleared[pendingNode] = true; renderMap(); break;
  }
  pendingNode = null;
}

function onRest() {
  const run = state.run;
  for (const p of run.party) {
    p.sp = Math.min(p.maxSp, p.sp + Math.floor(p.maxSp * 0.2));
  }
  toast('잠시 가다듬음 — 정신력 +20%');
  renderMap();
}

function openDeck() {
  const modal = document.querySelector('[data-modal="deck"]');
  const grid = $('#deck-grid');
  grid.innerHTML = '';
  for (const id of state.run.deck) {
    const card = window.__CARDS__?.[id];
    const div = el('div', { class: 'card-pick' });
    div.innerHTML = `
      <div class="card-name">${card?.name || id}</div>
      <div class="muted">${card?.rarity || ''}</div>
      <div class="card-desc">${card?.desc || ''}</div>
    `;
    grid.appendChild(div);
  }
  modal.classList.add('active');
}

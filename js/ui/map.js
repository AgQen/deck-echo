import { $, $$, el, showScreen, toast, openModal, closeModal, haptic } from './common.js';
import { state, advanceToNextAct } from '../state.js';
import { saveAll } from '../storage.js';
import { renderBattle } from './battle.js';
import { startBattle } from '../battle.js';
import { CARDS, cardsByRarity } from '../data/cards.js';
import { RELICS, relicsByRarity, applyRelicOnAcquire } from '../data/relics.js';
import { makeRng } from '../rng.js';
import { generateAct } from '../data/acts.js';

const TYPE_ICON = {
  battle: '⚔', elite: '☠', event: '❓', shop: '☉', rest: '🜉', boss: '👁',
};

export function bindMap() {
  document.querySelectorAll('[data-screen="map"] [data-action]').forEach(btn => {
    btn.addEventListener('click', () => onMapAction(btn.dataset.action));
  });
  // 보상 화면 액션
  document.querySelectorAll('[data-modal="reward"] [data-action], [data-modal="shop"] [data-action]').forEach(b => {
    b.addEventListener('click', () => onMapAction(b.dataset.action));
  });
}

export function renderMap() {
  const run = state.run;
  if (!run) { console.warn('renderMap: no run'); return; }
  if (!run.map) {
    console.warn('renderMap: no map — regenerating');
    run.map = generateAct(run.act || 1, makeRng(run.seed || Date.now()));
  }
  const canvas = $('#map-canvas');
  if (!canvas) return;
  if (canvas.clientWidth === 0) { requestAnimationFrame(renderMap); return; }
  canvas.innerHTML = '';

  const current = run.map.current;
  const reachable = new Set(run.map.nodes[current]?.conn || []);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'map-edges');
  svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:1;';
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
      line.setAttribute('stroke', isPath ? '#f0c860' : '#6a6478');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      line.style.strokeWidth = isPath ? '3' : '2';
      svg.appendChild(line);
    }
  }

  let count = 0;
  for (const [id, n] of Object.entries(run.map.nodes)) {
    const wrap = el('div', { class: 'map-node-wrap' });
    wrap.style.left = (n.pos[0] * 100) + '%';
    wrap.style.top = (n.pos[1] * 100) + '%';
    const node = el('button', {
      class: 'map-node', 'data-type': n.type, 'data-node-id': id,
      text: TYPE_ICON[n.type] || '·',
    });
    if (id === current) node.classList.add('current');
    if (run.map.cleared[id]) node.classList.add('cleared');
    if (reachable.has(id)) node.classList.add('reachable');
    node.addEventListener('click', () => onNodeClick(id));
    wrap.appendChild(node);
    wrap.appendChild(el('div', { class: 'map-node-label', text: n.label || n.type }));
    canvas.appendChild(wrap);
    count++;
  }
  if (count === 0) {
    canvas.appendChild(el('div', { class: 'muted', style: 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);', text: '맵 노드가 비어 있습니다' }));
  }

  $('[data-stat="day"]').textContent = `${run.act || 1}막 · ${run.map.name}`;
  const doomEl = document.querySelector('[data-stat="doom"]');
  if (doomEl) doomEl.textContent = `골드 ${run.gold || 0}`;
  const moveEl = document.querySelector('[data-stat="move"]');
  if (moveEl) moveEl.textContent = `유물 ${(run.relics || []).length}`;
}

let pendingNode = null;
function onNodeClick(id) {
  const run = state.run;
  const reach = new Set(run.map.nodes[run.map.current]?.conn || []);
  if (!reach.has(id)) { toast('도달할 수 없음'); return; }
  pendingNode = id;
  document.querySelectorAll('.map-node').forEach(n => n.classList.remove('selected'));
  document.querySelector(`[data-node-id="${id}"]`)?.classList.add('selected');
  toast(`${run.map.nodes[id].label} 선택 — 진입 누르기`);
}

function onMapAction(act) {
  switch (act) {
    case 'map-back': showScreen('title'); break;
    case 'open-settings': openModal('settings'); break;
    case 'rest': onRestQuick(); break;
    case 'deck': openDeck(); break;
    case 'enter-node': enterNode(); break;
    case 'reward-take': onTakeReward(); break;
    case 'reward-skip': onSkipReward(); break;
    case 'shop-leave': closeShop(); break;
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
    case 'boss':
      startBattle({ enemyIds: node.encounter.enemies, mapNodeId: pendingNode });
      showScreen('battle');
      renderBattle();
      break;
    case 'rest':
      doRest(node);
      break;
    case 'event':
      doEvent(node);
      break;
    case 'shop':
      openShopFor(node);
      break;
  }
  pendingNode = null;
}

function doRest(node) {
  const run = state.run;
  const ratio = node.encounter?.heal ?? 0.4;
  for (const p of run.party) {
    p.hp = Math.min(p.maxHp, Math.floor(p.hp + p.maxHp * ratio));
    p.sp = Math.min(p.maxSp, Math.floor(p.sp + p.maxSp * 0.5));
  }
  run.map.cleared[run.map.current] = true;
  toast('휴식 — 체력 · 정신력 회복');
  saveAll();
  renderMap();
}

// 사건은 단순 형태: 작은 보상 또는 시련
function doEvent(node) {
  const run = state.run;
  const rng = makeRng((node.encounter?.seed ?? 1) ^ Date.now());
  const r = rng();
  let msg = '';
  if (r < 0.4) {
    const g = 15 + Math.floor(rng() * 20);
    run.gold = (run.gold || 0) + g;
    msg = `발견 — 골드 +${g}`;
  } else if (r < 0.7) {
    for (const p of run.party) p.hp = Math.min(p.maxHp, p.hp + 8);
    msg = '발견 — 체력 +8';
  } else if (r < 0.9) {
    const all = Object.values(CARDS).filter(c => c.rarity !== '유물');
    const card = all[Math.floor(rng() * all.length)];
    if (card) { run.deck.push(card.id); msg = `발견 — 카드 "${card.name}" 추가`; }
  } else {
    const cost = 6 + Math.floor(rng() * 6);
    for (const p of run.party) p.hp = Math.max(1, p.hp - cost);
    msg = `함정 — 체력 -${cost}`;
  }
  run.map.cleared[run.map.current] = true;
  toast(msg, 2500);
  saveAll();
  renderMap();
}

function onRestQuick() {
  const run = state.run;
  for (const p of run.party) p.sp = Math.min(p.maxSp, p.sp + Math.floor(p.maxSp * 0.2));
  toast('잠시 가다듬음 — 정신력 +20%');
  renderMap();
}

function openDeck() {
  const modal = document.querySelector('[data-modal="deck"]');
  const grid = $('#deck-grid');
  grid.innerHTML = '';
  for (const id of state.run.deck) {
    const card = CARDS[id];
    const div = el('div', { class: 'card-pick' });
    div.innerHTML = `
      <div class="card-cost">◆${card?.light ?? 0}</div>
      <div class="card-name">${card?.name || id}</div>
      <div class="muted">${card?.rarity || ''}</div>
      <div class="card-desc">${card?.desc || ''}</div>
    `;
    grid.appendChild(div);
  }
  modal.classList.add('active');
}

// ─────────────────────────────────────────
// 보상 화면 (전투 승리 후 호출)
// ─────────────────────────────────────────
export function openReward({ gold, cards, relic, isBoss }) {
  const run = state.run;
  if (gold) run.gold = (run.gold || 0) + gold;

  const body = $('#reward-body');
  body.innerHTML = '';

  if (isBoss) {
    body.appendChild(el('h3', { text: '✦ 막 클리어 보상 ✦', class: 'reward-title boss' }));
  } else {
    body.appendChild(el('h3', { text: '보상', class: 'reward-title' }));
  }

  if (gold) {
    body.appendChild(el('div', { class: 'reward-line', text: `골드 +${gold}` }));
  }

  // 카드 선택
  if (cards && cards.length) {
    body.appendChild(el('div', { class: 'reward-section-title', text: '카드 한 장을 고르세요' }));
    const grid = el('div', { class: 'reward-card-grid' });
    cards.forEach(cid => {
      const c = CARDS[cid]; if (!c) return;
      const div = el('div', { class: 'card-pick' });
      div.innerHTML = `
        <div class="card-cost">◆${c.light ?? 0}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-actions">${(c.actions || []).map(a => `<div class="card-action" data-type="${a.type}"><span>${a.type}</span><span class="card-roll">${a.min}-${a.max}</span></div>`).join('')}</div>
        <div class="muted">${c.rarity}</div>
        <div class="card-desc">${c.desc || ''}</div>
      `;
      div.addEventListener('click', () => {
        state.run.deck.push(cid);
        toast(`"${c.name}" 책장에 추가`);
        grid.querySelectorAll('.card-pick').forEach(x => x.classList.add('disabled'));
        div.classList.add('chosen');
      });
      grid.appendChild(div);
    });
    body.appendChild(grid);
  }

  if (relic) {
    const r = RELICS[relic]; if (r) {
      body.appendChild(el('div', { class: 'reward-section-title', text: '획득 유물' }));
      const div = el('div', { class: 'relic-card' });
      div.innerHTML = `
        <div class="relic-icon">${r.icon || '◆'}</div>
        <div class="relic-name">${r.name}</div>
        <div class="relic-rarity">${r.rarity}</div>
        <div class="relic-desc">${r.desc}</div>
      `;
      body.appendChild(div);
      // 즉시 인벤토리에 추가 + onAcquire
      if (!run.relics) run.relics = [];
      if (!run.relics.includes(relic)) {
        run.relics.push(relic);
        applyRelicOnAcquire(run, relic);
      }
    }
  }

  const finishBtn = el('button', { class: 'btn-primary wide', text: isBoss ? '다음 막으로' : '계속' });
  finishBtn.addEventListener('click', () => {
    closeModal();
    if (isBoss) {
      // 다음 막 진입
      if (run.act >= 3) {
        toast('전 막 클리어! 깊은 잠으로의 끝을 보았다.', 4000);
        showScreen('title');
        return;
      }
      advanceToNextAct();
      saveAll();
      renderMap();
    } else {
      saveAll();
      renderMap();
    }
  });
  body.appendChild(finishBtn);

  openModal('reward');
}

// ─────────────────────────────────────────
// 상점
// ─────────────────────────────────────────
function openShopFor(node) {
  const run = state.run;
  const rng = makeRng(node.encounter?.seed ?? Date.now());
  const stock = {
    cards: pickShopCards(rng, run.act),
    relics: pickShopRelics(rng, run.act),
    services: [
      { id: 'heal_small', name: '응급 처치', desc: '체력 +15', price: 30, apply: () => { for (const p of run.party) p.hp = Math.min(p.maxHp, p.hp + 15); } },
      { id: 'heal_full', name: '안식', desc: '체력·정신력 가득', price: 80, apply: () => { for (const p of run.party) { p.hp = p.maxHp; p.sp = p.maxSp; } } },
      { id: 'remove_card', name: '카드 제거', desc: '책장에서 카드 한 장 삭제', price: 60, apply: () => promptCardRemoval() },
    ],
  };
  renderShop(stock);
  openModal('shop');
}

function pickShopCards(rng, act) {
  const pool = Object.values(CARDS).filter(c => c.rarity === '일반' || c.rarity === '희귀');
  const out = [];
  for (let i = 0; i < 4; i++) {
    const c = pool[Math.floor(rng() * pool.length)];
    if (c) out.push({ id: c.id, price: priceForCard(c, act) });
  }
  return out;
}
function pickShopRelics(rng, act) {
  const pool = Object.values(RELICS).filter(r => r.rarity === '일반' || r.rarity === '희귀');
  const out = [];
  for (let i = 0; i < 2; i++) {
    const r = pool[Math.floor(rng() * pool.length)];
    if (r) out.push({ id: r.id, price: priceForRelic(r, act) });
  }
  return out;
}
function priceForCard(c, act) {
  const base = c.rarity === '희귀' ? 75 : 45;
  return Math.round(base * (1 + 0.2 * (act - 1)));
}
function priceForRelic(r, act) {
  const base = r.rarity === '희귀' ? 140 : 90;
  return Math.round(base * (1 + 0.25 * (act - 1)));
}

function renderShop(stock) {
  const body = $('#shop-body');
  body.innerHTML = '';
  body.appendChild(el('div', { class: 'shop-gold', text: `보유 골드: ${state.run.gold || 0}` }));

  body.appendChild(el('h3', { class: 'shop-section-title', text: '카드' }));
  const cardGrid = el('div', { class: 'shop-grid' });
  for (const it of stock.cards) {
    const c = CARDS[it.id]; if (!c) continue;
    const div = el('div', { class: 'shop-item card-pick' });
    div.innerHTML = `
      <div class="card-cost">◆${c.light ?? 0}</div>
      <div class="card-name">${c.name}</div>
      <div class="muted">${c.rarity}</div>
      <div class="card-desc">${c.desc || ''}</div>
      <div class="shop-price">${it.price} G</div>
    `;
    div.addEventListener('click', () => buyCard(it, div));
    cardGrid.appendChild(div);
  }
  body.appendChild(cardGrid);

  body.appendChild(el('h3', { class: 'shop-section-title', text: '유물' }));
  const relicGrid = el('div', { class: 'shop-grid' });
  for (const it of stock.relics) {
    const r = RELICS[it.id]; if (!r) continue;
    const div = el('div', { class: 'shop-item' });
    div.innerHTML = `
      <div class="relic-icon">${r.icon || '◆'}</div>
      <div class="relic-name">${r.name}</div>
      <div class="muted">${r.rarity}</div>
      <div class="relic-desc">${r.desc}</div>
      <div class="shop-price">${it.price} G</div>
    `;
    div.addEventListener('click', () => buyRelic(it, div));
    relicGrid.appendChild(div);
  }
  body.appendChild(relicGrid);

  body.appendChild(el('h3', { class: 'shop-section-title', text: '서비스' }));
  for (const s of stock.services) {
    const div = el('div', { class: 'shop-item shop-service' });
    div.innerHTML = `
      <div class="svc-name">${s.name}</div>
      <div class="svc-desc">${s.desc}</div>
      <div class="shop-price">${s.price} G</div>
    `;
    div.addEventListener('click', () => buyService(s, div));
    body.appendChild(div);
  }

  body.appendChild(el('div', { class: 'shop-hint muted', text: '구매 후 떠나기를 누르면 노드 클리어.' }));
}

function buyCard(it, divEl) {
  const run = state.run;
  if ((run.gold || 0) < it.price) { toast('골드 부족'); return; }
  run.gold -= it.price;
  run.deck.push(it.id);
  toast(`"${CARDS[it.id].name}" 구매`);
  divEl.classList.add('disabled');
  $('.shop-gold').textContent = `보유 골드: ${run.gold}`;
}
function buyRelic(it, divEl) {
  const run = state.run;
  if ((run.gold || 0) < it.price) { toast('골드 부족'); return; }
  run.gold -= it.price;
  if (!run.relics) run.relics = [];
  if (run.relics.includes(it.id)) { toast('이미 보유'); return; }
  run.relics.push(it.id);
  applyRelicOnAcquire(run, it.id);
  toast(`"${RELICS[it.id].name}" 획득`);
  divEl.classList.add('disabled');
  $('.shop-gold').textContent = `보유 골드: ${run.gold}`;
}
function buyService(s, divEl) {
  const run = state.run;
  if ((run.gold || 0) < s.price) { toast('골드 부족'); return; }
  run.gold -= s.price;
  s.apply();
  toast(`${s.name} 적용`);
  divEl.classList.add('disabled');
  $('.shop-gold').textContent = `보유 골드: ${run.gold}`;
}

function promptCardRemoval() {
  // 책장에서 한 장 선택해 제거 — 간단히 첫 번째를 제거 (UI 단순화)
  // 추후 카드 선택 UI 추가 가능.
  if (!state.run.deck.length) { toast('책장이 비어있습니다'); return; }
  // 가장 흔한 카드 제거 (일반 등급 우선)
  const idx = state.run.deck.findIndex(id => (CARDS[id]?.rarity === '일반'));
  const finalIdx = idx >= 0 ? idx : 0;
  const removed = state.run.deck.splice(finalIdx, 1)[0];
  toast(`"${CARDS[removed]?.name || removed}" 제거`);
}

function closeShop() {
  // 노드 클리어 처리
  if (state.run?.map?.current) {
    state.run.map.cleared[state.run.map.current] = true;
  }
  closeModal();
  saveAll();
  renderMap();
}

function onTakeReward() {}
function onSkipReward() {}

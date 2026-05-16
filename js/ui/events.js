// 이벤트 모달 — 선택지 → effect 적용 → 결과 텍스트 → 닫기.

import { $, el, openModal, closeModal, toast } from './common.js';
import { state } from '../state.js';
import { CARDS } from '../data/cards.js';
import { RELICS, applyRelicOnAcquire } from '../data/relics.js';
import { EVENTS, pickEvent } from '../data/events.js';
import { makeRng } from '../rng.js';
import { saveAll } from '../storage.js';

// ─── 효과 적용 ───

function partyAvgHp(run) {
  const alive = run.party.filter(p => !p.dead);
  if (!alive.length) return 0;
  return alive.reduce((s, p) => s + p.hp, 0) / alive.length;
}

function pickRandomCard(rng, rarity) {
  const pool = Object.values(CARDS).filter(c => c.rarity === rarity);
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}

function pickRandomRelic(rng, rarity, exclude) {
  const owned = new Set(state.run?.relics || []);
  const pool = Object.values(RELICS).filter(r => r.rarity === rarity && !owned.has(r.id));
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}

function rarityFromKey(key) {
  // 'random_common' / 'random_uncommon' / 'random_rare' / 'random_legendary'
  const map = { common: '일반', uncommon: '희귀', rare: '희귀', legendary: '유물' };
  const k = key.replace('random_', '');
  return map[k] || '일반';
}

function applyEffect(effect, rng, log) {
  if (!effect) return;
  const run = state.run;
  if (typeof effect.gold === 'number') {
    run.gold = Math.max(0, (run.gold || 0) + effect.gold);
    log.push(`골드 ${effect.gold > 0 ? '+' : ''}${effect.gold}`);
  }
  if (typeof effect.hp === 'number') {
    for (const p of run.party) {
      if (effect.hp > 0) p.hp = Math.min(p.maxHp, p.hp + effect.hp);
      else p.hp = Math.max(1, p.hp + effect.hp);
    }
    log.push(`체력 ${effect.hp > 0 ? '+' : ''}${effect.hp}`);
  }
  if (typeof effect.sp === 'number') {
    for (const p of run.party) {
      if (effect.sp > 0) p.sp = Math.min(p.maxSp, p.sp + effect.sp);
      else p.sp = Math.max(0, p.sp + effect.sp);
    }
    log.push(`정신력 ${effect.sp > 0 ? '+' : ''}${effect.sp}`);
  }
  if (typeof effect.maxHpDelta === 'number') {
    for (const p of run.party) {
      p.maxHp = Math.max(1, p.maxHp + effect.maxHpDelta);
      p.hp = Math.min(p.maxHp, p.hp);
    }
    log.push(`최대 체력 ${effect.maxHpDelta > 0 ? '+' : ''}${effect.maxHpDelta}`);
  }
  if (effect.card) {
    let cardId = effect.card;
    if (cardId.startsWith('random_')) {
      const r = pickRandomCard(rng, rarityFromKey(cardId));
      cardId = r?.id;
    }
    if (cardId && CARDS[cardId]) {
      const target = run.party.find(p => p.id === run.selectedActorId) || run.party[0];
      target.deck = target.deck || [];
      target.deck.push(cardId);
      log.push(`${target.name}: ${CARDS[cardId].name} 획득`);
    }
  }
  if (effect.relic) {
    let relicId = effect.relic;
    if (relicId.startsWith('random_')) {
      const r = pickRandomRelic(rng, rarityFromKey(relicId));
      relicId = r?.id;
    }
    if (relicId && RELICS[relicId] && !(run.relics || []).includes(relicId)) {
      run.relics = run.relics || [];
      run.relics.push(relicId);
      applyRelicOnAcquire(run, relicId);
      log.push(`${RELICS[relicId].name} 획득`);
    }
  }
  if (effect.loseRandomCard) {
    const candidates = run.party.flatMap(p => (p.deck || []).map((cid, i) => ({ p, i, cid })))
      .filter(x => CARDS[x.cid]?.rarity !== '기본');
    if (candidates.length) {
      const pick = candidates[Math.floor(rng() * candidates.length)];
      pick.p.deck.splice(pick.i, 1);
      log.push(`${pick.p.name}의 ${CARDS[pick.cid].name} 잃음`);
    }
  }
  if (effect.status) {
    for (const p of run.party) {
      p.statuses = p.statuses || {};
      p.statuses[effect.status.name] = (p.statuses[effect.status.name] || 0) + (effect.status.stacks || 1);
    }
    log.push(`${effect.status.name} +${effect.status.stacks || 1} (전원)`);
  }
}

function choiceAvailable(choice, run) {
  if (choice.requireGold && (run.gold || 0) < choice.requireGold) return false;
  if (choice.requireHp && partyAvgHp(run) < choice.requireHp) return false;
  return true;
}

// ─── UI ───

let onResolveCb = null;

export function openEventModal(node, onResolve) {
  const seed = (node?.encounter?.seed ?? Date.now()) >>> 0;
  const rng = makeRng(seed);
  const ev = pickEvent(rng);
  onResolveCb = onResolve;
  renderEvent(ev, rng);
  openModal('event');
}

function renderEvent(ev, rng) {
  const title = document.getElementById('event-title');
  const body = document.getElementById('event-body');
  if (title) title.textContent = ev.title;
  body.innerHTML = '';

  body.appendChild(el('div', { class: 'event-text', text: ev.text }));

  const choices = el('div', { class: 'event-choices' });
  ev.choices.forEach((c) => {
    const enabled = choiceAvailable(c, state.run);
    const btn = el('button', { class: 'event-choice' + (enabled ? '' : ' disabled') });
    btn.textContent = c.label;
    if (!enabled) btn.disabled = true;
    btn.addEventListener('click', () => {
      const log = [];
      applyEffect(c.effect, rng, log);
      saveAll();
      renderResult(ev, c, log);
    });
    choices.appendChild(btn);
  });
  body.appendChild(choices);
}

function renderResult(ev, choice, log) {
  const body = document.getElementById('event-body');
  body.innerHTML = '';
  body.appendChild(el('div', { class: 'event-result', text: choice.result }));
  if (log.length) {
    const list = el('div', { class: 'event-log' });
    log.forEach(l => list.appendChild(el('div', { class: 'event-log-line', text: l })));
    body.appendChild(list);
  }
  const close = el('button', { class: 'btn-primary wide event-close' });
  close.textContent = '계속';
  close.addEventListener('click', () => {
    closeModal();
    if (onResolveCb) onResolveCb();
    onResolveCb = null;
  });
  body.appendChild(close);
}

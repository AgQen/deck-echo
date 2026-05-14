// 3막 절차 생성 맵.
// 각 막은 N 행의 노드, 행마다 2~4개의 노드. 행 사이에 연결로.
// 마지막 행은 항상 단일 보스 노드.
//
// 노드 종류:
//   battle, elite, event, shop, rest, boss

import { makeRng } from '../rng.js';

// 막마다 적 풀 / 보스 / 길이
export const ACTS = {
  1: {
    name: '폐허의 입구',
    rows: 7,
    minPerRow: 2, maxPerRow: 3,
    typeWeights: { battle: 55, event: 16, shop: 9, rest: 12, elite: 8 },
    enemyPool: { normal: ['husk', 'husk', 'cultist', 'bleedfeeder', 'wilter'], elite: ['watcher', 'sleepWeaver'] },
    boss: 'bossWeaver',
  },
  2: {
    name: '잠긴 신전',
    rows: 8,
    minPerRow: 2, maxPerRow: 4,
    typeWeights: { battle: 48, event: 14, shop: 12, rest: 11, elite: 15 },
    enemyPool: { normal: ['cultist', 'watcher', 'thrall', 'moaningShape', 'stalker'], elite: ['watcher', 'thrall', 'sleepWeaver', 'hollowChorus'] },
    boss: 'bossTheRitualist',
  },
  3: {
    name: '잠든 신의 곁',
    rows: 9,
    minPerRow: 3, maxPerRow: 4,
    typeWeights: { battle: 42, event: 10, shop: 11, rest: 12, elite: 25 },
    enemyPool: { normal: ['thrall', 'spawn', 'cultist', 'moaningShape', 'stalker'], elite: ['spawn', 'shoggothLet', 'sleepWeaver', 'hollowChorus'] },
    boss: 'bossSleeperOfTheDeep',
  },
};

function weightedPick(rng, weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const [k, w] of Object.entries(weights)) {
    if ((r -= w) < 0) return k;
  }
  return Object.keys(weights)[0];
}

// 한 막의 절차 생성. seed 가능한 rng 받아 결정적.
export function generateAct(actNum, rng) {
  const cfg = ACTS[actNum];
  if (!cfg) throw new Error('unknown act ' + actNum);
  // rng가 makeRng 결과면 그대로, 아니면 wrap
  if (typeof rng !== 'function') rng = makeRng(Date.now());

  // 시작 노드 (rest)
  const nodes = {};
  const conn = {};
  const startId = 'a' + actNum + '_start';
  nodes[startId] = { type: 'rest', label: '야영', pos: [0.5, 0.94], conn: [] };
  conn[startId] = [];

  // 각 행마다 노드 생성
  const layers = [[startId]];
  for (let row = 0; row < cfg.rows; row++) {
    const isLast = row === cfg.rows - 1;
    const count = isLast ? 1 : (cfg.minPerRow + Math.floor(rng() * (cfg.maxPerRow - cfg.minPerRow + 1)));
    const rowIds = [];
    for (let i = 0; i < count; i++) {
      const id = `a${actNum}_r${row}_${i}`;
      const yBase = 0.84 - (row + 1) * (0.78 / (cfg.rows + 1));
      const xJitter = (rng() - 0.5) * 0.06;
      const x = count === 1 ? 0.5 : (0.18 + (0.64 * i / (count - 1))) + xJitter;
      const y = yBase + (rng() - 0.5) * 0.02;
      let type;
      if (isLast) type = 'boss';
      else {
        // 특수 행 가중치 조정
        let w = { ...cfg.typeWeights };
        // 첫 행: rest/event 줄임
        if (row === 0) { w.rest = 2; w.shop = 2; w.elite = 2; }
        // 마지막 직전 행: rest 강조
        if (row === cfg.rows - 2) { w.rest = 30; w.elite = 0; }
        type = weightedPick(rng, w);
      }
      const encounter = makeEncounter(type, cfg, rng, row, cfg.rows);
      nodes[id] = { type, label: typeLabel(type), pos: [x, y], conn: [], encounter };
      conn[id] = [];
      rowIds.push(id);
    }
    layers.push(rowIds);
  }

  // 연결: 각 노드는 다음 행의 1~2개 노드로 연결. 시작 노드는 1행 모든 노드 가능.
  for (let r = 0; r < layers.length - 1; r++) {
    const cur = layers[r];
    const nxt = layers[r + 1];
    for (let i = 0; i < cur.length; i++) {
      const fromId = cur[i];
      // 가장 가까운 다음 행 노드 1~2개
      const fromX = nodes[fromId].pos[0];
      const sorted = nxt.slice().sort((a, b) => Math.abs(nodes[a].pos[0] - fromX) - Math.abs(nodes[b].pos[0] - fromX));
      const linkCount = Math.min(nxt.length, 1 + (rng() < 0.5 ? 1 : 0));
      const targets = sorted.slice(0, linkCount);
      for (const t of targets) {
        if (!nodes[fromId].conn.includes(t)) nodes[fromId].conn.push(t);
      }
    }
    // 다음 행 모든 노드가 들어오는 연결이 1개 이상이도록 보장
    for (const t of nxt) {
      const hasIncoming = cur.some(fromId => nodes[fromId].conn.includes(t));
      if (!hasIncoming) {
        // 가장 가까운 cur 노드에 강제 연결
        const tx = nodes[t].pos[0];
        const closest = cur.slice().sort((a, b) => Math.abs(nodes[a].pos[0] - tx) - Math.abs(nodes[b].pos[0] - tx))[0];
        nodes[closest].conn.push(t);
      }
    }
  }

  return {
    id: 'act' + actNum,
    name: cfg.name,
    actNum,
    current: startId,
    cleared: {},
    nodes,
  };
}

function makeEncounter(type, cfg, rng, row = 0, totalRows = 5) {
  // 0.0 = 첫 행(약함), 1.0 = 보스 직전(강함)
  const depthFactor = totalRows > 1 ? row / (totalRows - 1) : 0;
  switch (type) {
    case 'battle': {
      const pool = cfg.enemyPool.normal;
      const num = 1 + (rng() < 0.4 ? 1 : 0);
      const enemies = [];
      for (let i = 0; i < num; i++) enemies.push(pool[Math.floor(rng() * pool.length)]);
      return { enemies, depthFactor, kind: 'battle' };
    }
    case 'elite': {
      const pool = cfg.enemyPool.elite;
      return { enemies: [pool[Math.floor(rng() * pool.length)]], depthFactor, kind: 'elite' };
    }
    case 'boss': return { enemies: [cfg.boss], depthFactor: 1.0, kind: 'boss' };
    case 'rest':  return { heal: 0.4 };
    case 'shop':  return { seed: Math.floor(rng() * 1e9) };
    case 'event': return { seed: Math.floor(rng() * 1e9) };
    default: return {};
  }
}

function typeLabel(t) {
  return ({ battle: '전투', elite: '정예', event: '사건', shop: '상점', rest: '야영', boss: '보스' })[t] || t;
}

// 어컴호러 스타일 노드 맵 초안.
// 각 노드는 위치(맵 캔버스 0~1 비율 좌표), 종류, 연결로, 인카운터 데이터를 가짐.
// 종류: battle/elite/event/shop/rest/boss
// 인카운터:
//   battle: { enemies: [enemyId, ...] }
//   event:  { eventId }        // 추후 events.js 추가
//   shop:   { stock: [...] }
//   rest:   { heal: 0.3 }      // 비율
//   boss:   { enemies: [bossId] }

export const MAPS = {
  prologue: {
    id: 'prologue',
    name: '폐허의 입구',
    start: 'n_start',
    nodes: {
      n_start: { type: 'rest', label: '야영', pos: [0.5, 0.92], conn: ['n_b1', 'n_e1'] },
      n_b1:    { type: 'battle', label: '전투', pos: [0.28, 0.74], conn: ['n_e2', 'n_b2'], encounter: { enemies: ['husk'] } },
      n_e1:    { type: 'event',  label: '사건', pos: [0.72, 0.74], conn: ['n_shop', 'n_b2'], encounter: { eventId: 'tbd_001' } },
      n_b2:    { type: 'battle', label: '전투', pos: [0.5, 0.58], conn: ['n_elite'], encounter: { enemies: ['husk', 'husk'] } },
      n_e2:    { type: 'event',  label: '사건', pos: [0.18, 0.54], conn: ['n_elite'], encounter: { eventId: 'tbd_002' } },
      n_shop:  { type: 'shop',   label: '상점', pos: [0.82, 0.54], conn: ['n_elite'], encounter: { stock: [] } },
      n_elite: { type: 'elite',  label: '정예', pos: [0.5, 0.38], conn: ['n_rest'], encounter: { enemies: ['watcher'] } },
      n_rest:  { type: 'rest',   label: '야영', pos: [0.5, 0.24], conn: ['n_boss'], encounter: { heal: 0.4 } },
      n_boss:  { type: 'boss',   label: '보스', pos: [0.5, 0.10], conn: [], encounter: { enemies: ['bossWeaver'] } },
    },
  },
};

export function instantiateMap(id) {
  const def = MAPS[id];
  if (!def) throw new Error(`Unknown map ${id}`);
  return {
    id: def.id, name: def.name,
    current: def.start,
    cleared: {},
    nodes: JSON.parse(JSON.stringify(def.nodes)),
  };
}

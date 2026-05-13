// 유물 (영구 패시브). 한 번 획득하면 런이 끝날 때까지 효과 유지.
// hooks 객체로 게임 이벤트에 반응:
//   onBattleStart(battle, player) - 전투 시작 시 (각 플레이어 초기화 후)
//   onTurnStart(battle, player)   - 매 턴 시작
//   onActDone(run, actNum)        - 막 클리어
//   onCardPlaced(battle, player, cardId) - 카드 배치 직후
// 효과는 stat 변경 또는 데이터 hook으로 표현.

export const RELICS = {
  weightedPendant: {
    id: 'weightedPendant', name: '묵직한 펜던트', rarity: '일반',
    icon: '🜍',
    desc: '최대 체력 +10.',
    onAcquire: (run) => { for (const p of run.party) { p.maxHp += 10; p.hp += 10; } },
  },
  burningCharm: {
    id: 'burningCharm', name: '타오르는 부적', rarity: '일반',
    icon: '🜂',
    desc: '전투 시작 시 빛 +1.',
    onBattleStart: (battle, player) => { player.light = Math.min(player.maxLight, player.light + 1); },
  },
  rustyDagger: {
    id: 'rustyDagger', name: '녹슨 단검', rarity: '일반',
    icon: '🗡',
    desc: '매 턴 시작, 가장 왼쪽 적에게 3 데미지.',
    onTurnStart: (battle, player) => {
      const target = battle.enemies.find(e => !e.dead);
      if (target) target.hp = Math.max(0, target.hp - 3);
    },
  },
  scholarsLens: {
    id: 'scholarsLens', name: '학자의 단안경', rarity: '희귀',
    icon: '🔍',
    desc: '전투 시작 시 카드 +1장 드로우.',
    onBattleStart: (battle, player) => {
      // drawCards 직접 호출
      try {
        // battle 모듈 의존성 회피 위해 직접
        const hand = battle.hand[player.id] = battle.hand[player.id] || [];
        if (hand.length < 7) {
          if (battle.drawPile.length === 0 && battle.discardPile.length > 0) {
            battle.drawPile = battle.rng.shuffle(battle.discardPile);
            battle.discardPile = [];
          }
          if (battle.drawPile.length) hand.push(battle.drawPile.pop());
        }
      } catch {}
    },
  },
  enduringWill: {
    id: 'enduringWill', name: '굳건한 의지', rarity: '희귀',
    icon: '🛡',
    desc: '최대 정신력 +10.',
    onAcquire: (run) => { for (const p of run.party) { p.maxSp += 10; p.sp += 10; } },
  },
  vesselOfDeep: {
    id: 'vesselOfDeep', name: '심연의 그릇', rarity: '희귀',
    icon: '◉',
    desc: '최대 빛 +1.',
    onAcquire: (run) => { for (const p of run.party) { p.baseMaxLight += 1; } },
  },
  whisperingShell: {
    id: 'whisperingShell', name: '속삭이는 조개', rarity: '유물',
    icon: '🐚',
    desc: '전투 시작 시 모든 적에게 떨림 1.',
    onBattleStart: (battle, player) => {
      for (const e of battle.enemies) {
        if (!e.statuses) e.statuses = {};
        e.statuses['떨림'] = (e.statuses['떨림'] || 0) + 1;
      }
    },
  },
  eyeOfRaShem: {
    id: 'eyeOfRaShem', name: '라셈의 눈', rarity: '유물',
    icon: '👁',
    desc: '경험치 획득량 +30%.',
    xpMultiplier: 1.3,  // progression 측에서 참조
  },
  fragmentOfNullity: {
    id: 'fragmentOfNullity', name: '허무의 파편', rarity: '유물',
    icon: '⊘',
    desc: '매 턴 시작 시 빛 +1.',
    onTurnStart: (battle, player) => { player.light = Math.min(player.maxLight, player.light + 1); },
  },
  oldCoin: {
    id: 'oldCoin', name: '낡은 동전', rarity: '일반',
    icon: '◎',
    desc: '획득 시 골드 +30.',
    onAcquire: (run) => { run.gold = (run.gold || 0) + 30; },
  },
  tornPage: {
    id: 'tornPage', name: '찢어진 페이지', rarity: '일반',
    icon: '📄',
    desc: '매 턴 시작 시 카드 +1장 드로우.',
    onTurnStart: (battle, player) => {
      const hand = battle.hand[player.id] = battle.hand[player.id] || [];
      if (hand.length >= 7) return;
      if (battle.drawPile.length === 0 && battle.discardPile.length > 0) {
        battle.drawPile = battle.rng.shuffle(battle.discardPile);
        battle.discardPile = [];
      }
      if (battle.drawPile.length) hand.push(battle.drawPile.pop());
    },
  },
  ironHeart: {
    id: 'ironHeart', name: '강철의 심장', rarity: '희귀',
    icon: '♥',
    desc: '전투 종료 시 체력 5 회복.',
    onBattleEnd: (run, player) => { player.hp = Math.min(player.maxHp, player.hp + 5); },
  },
};

export function relicsByRarity(rarity) {
  return Object.values(RELICS).filter(r => r.rarity === rarity);
}

export function applyRelicOnAcquire(run, relicId) {
  const r = RELICS[relicId];
  if (!r) return;
  if (r.onAcquire) r.onAcquire(run);
}

export function fireRelicHook(run, hook, ...args) {
  if (!run?.relics) return;
  for (const rid of run.relics) {
    const r = RELICS[rid];
    if (r && typeof r[hook] === 'function') {
      try { r[hook](...args); } catch (e) { console.warn('relic hook error', rid, hook, e); }
    }
  }
}

// XP 가산 배수 (모든 유물 곱)
export function relicXpMultiplier(run) {
  if (!run?.relics) return 1;
  let m = 1;
  for (const rid of run.relics) {
    const r = RELICS[rid];
    if (r?.xpMultiplier) m *= r.xpMultiplier;
  }
  return m;
}

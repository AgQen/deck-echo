// 게임 전역 상태. 단일 객체. 저장은 storage.js에서.
import { makeRng } from './rng.js';
import { instantiateCharacter } from './data/characters.js';
import { STARTER_DECK } from './data/cards.js';
import { generateAct } from './data/acts.js';

export const state = {
  screen: 'title',         // 'title' | 'map' | 'battle'
  modal: null,
  run: null,               // 현재 진행 데이터
  settings: {
    sfx: 60, bgm: 40, haptics: true, shake: true,
    handSize: 3,
  },
};

// 새 런 시작
export function startNewRun({ characterId = 'protagonist', seed = Date.now() } = {}) {
  const rng = makeRng(seed);
  const party = [instantiateCharacter(characterId)];
  const deck = STARTER_DECK.slice();
  state.run = {
    seed,
    rngState: rng.seed(),
    day: 1,
    act: 1,                // 1~3
    party,
    deck,
    relics: [],
    gold: 50,              // 시작 골드
    map: generateAct(1, rng),
    inBattle: null,
    selectedActorId: party[0].id,
  };
  return state.run;
}

// 다음 막 진입 (보스 처치 후)
export function advanceToNextAct() {
  if (!state.run) return;
  state.run.act = (state.run.act || 1) + 1;
  state.run.day += 1;
  // 레벨/XP 초기화 (보상은 별도 부여)
  for (const p of state.run.party) {
    p.xp = 0;
    p.level = 0;
  }
  const rng = makeRng((state.run.rngState || 0) ^ state.run.act);
  state.run.map = generateAct(state.run.act, rng);
  state.run.rngState = rng.seed();
}

export function endRun() { state.run = null; }

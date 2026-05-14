// 게임 전역 상태. 단일 객체. 저장은 storage.js에서.
import { makeRng } from './rng.js';
import { CHARACTERS, instantiateCharacter } from './data/characters.js';
import { STARTER_DECK } from './data/cards.js';
import { generateAct } from './data/acts.js';

export const state = {
  screen: 'title',         // 'title' | 'map' | 'battle'
  modal: null,
  run: null,               // 현재 진행 데이터
  settings: {
    sfx: 60, bgm: 40, haptics: true, shake: true,
    handSize: 3,
    wide: false,        // PC 풀 화면 모드 (체크 시 #app max-width 해제)
  },
};

// 새 런 시작.
// partyIds 로 여러 캐릭터를 받을 수 있음 (기본: 조사관 + 서생).
export function startNewRun({ partyIds = ['protagonist', 'scholar'], seed = Date.now() } = {}) {
  const rng = makeRng(seed);
  const party = partyIds.map(id => instantiateCharacter(id));
  // 덱은 각 캐릭터의 startingDeck 합집합. 캐릭터 정의에 deck이 없으면 STARTER_DECK fallback.
  const deck = [];
  for (const p of party) {
    const def = CHARACTERS[p.id];
    if (def?.startingDeck?.length) deck.push(...def.startingDeck);
    else deck.push(...STARTER_DECK);
  }
  state.run = {
    seed,
    rngState: rng.seed(),
    day: 1,
    act: 1,
    party,
    deck,
    relics: [],
    gold: 50,
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

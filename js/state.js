// 게임 전역 상태. 단일 객체. 저장은 storage.js에서.
import { makeRng } from './rng.js';
import { CHARACTERS, instantiateCharacter } from './data/characters.js';
import { STARTER_DECK } from './data/cards.js';
import { generateAct } from './data/acts.js';
import { fireRelicHook } from './data/relics.js';

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

// 새 런 시작. 단일 캐릭터로 시작 — 동료는 보스 처치 시 합류.
// 각 캐릭터는 자기 덱(p.deck)을 따로 갖는다.
export function startNewRun({ partyIds = ['protagonist'], seed = Date.now() } = {}) {
  const rng = makeRng(seed);
  const party = partyIds.map(id => {
    const actor = instantiateCharacter(id);
    const def = CHARACTERS[id];
    actor.deck = (def?.startingDeck?.length ? def.startingDeck : STARTER_DECK).slice();
    return actor;
  });
  state.run = {
    seed,
    rngState: rng.seed(),
    day: 1,
    act: 1,
    party,
    relics: [],
    gold: 80,
    map: generateAct(1, rng),
    inBattle: null,
    selectedActorId: party[0].id,
  };
  return state.run;
}

// 동료 합류 — 보스 클리어 시 호출. 이미 파티에 있으면 무시.
export function recruitCompanion(characterId) {
  if (!state.run) return false;
  if (state.run.party.find(p => p.id === characterId)) return false;
  const actor = instantiateCharacter(characterId);
  const def = CHARACTERS[characterId];
  actor.deck = (def?.startingDeck?.length ? def.startingDeck : STARTER_DECK).slice();
  state.run.party.push(actor);
  return true;
}

// 다음 막 진입 (보스 처치 후)
export function advanceToNextAct() {
  if (!state.run) return;
  const completedAct = state.run.act || 1;
  fireRelicHook(state.run, 'onActDone', state.run, completedAct);
  state.run.act = completedAct + 1;
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

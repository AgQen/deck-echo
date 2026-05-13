// 게임 전역 상태. 단일 객체. 저장은 storage.js에서.
import { makeRng } from './rng.js';
import { instantiateMap } from './data/maps.js';
import { instantiateCharacter } from './data/characters.js';
import { STARTER_DECK } from './data/cards.js';

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
export function startNewRun({ characterId = 'protagonist', mapId = 'prologue', seed = Date.now() } = {}) {
  const rng = makeRng(seed);
  const party = [instantiateCharacter(characterId)];
  const deck = STARTER_DECK.slice();
  state.run = {
    seed,
    rngState: rng.seed(),
    day: 1,
    party,                 // 플레이어 캐릭터들 (동료 합류 시 push)
    deck,                  // 책장 (카드 id 배열)
    relics: [],            // 유물 인벤토리
    map: instantiateMap(mapId),
    inBattle: null,        // 전투 중이면 battle 객체
    selectedActorId: party[0].id,
  };
  return state.run;
}

export function endRun() { state.run = null; }

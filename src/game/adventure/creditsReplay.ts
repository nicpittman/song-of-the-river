/** A disposable voyage. Replaying credits never changes either saved game. */
import { newGameState, type GameState } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { restoreAdventure } from './restore';
import { STRUCTURES } from './structures';
import { FOUNDERS } from './people';

export function creditsReplay(source?: GameState | null): GameState {
  const game = source?.boardId === adventureValley.id ? structuredClone(source) : newGameState(adventureValley, 'journey');
  const s = restoreAdventure(game.adventure);
  game.adventure = s;
  game.chapter = s.region = 2;
  // A Wander save sails home again; the replay is always the Journey's voyage to the end.
  game.mode = 'journey'; s.free = false;
  s.phase = 'morning'; s.elapsed = 0; s.moving = false;
  s.plans = []; s.outings = []; s.resting = []; s.evening = null;
  s.voyage = 'sailing'; s.voyageTime = 0;
  // The separate credits preview includes the three opening voices, even before they are met.
  for (const id of FOUNDERS) if (!s.people.some((person) => person.id === id)) s.people.push({ id, base: 2, practice: {}, memories: [] });
  s.companions = s.people.map((person) => person.id);
  s.farewell = [];
  for (const person of s.people) { person.base = 2; delete person.lodging; }
  if (!s.buildings.some((b) => b.kind === 'boat')) s.buildings.push({ id: s.nextId++, kind: 'boat', x: 1820, y: 5940, region: 2, work: STRUCTURES.find((d) => d.id === 'boat')!.work, placed: s.day });
  return game;
}

/** Helpers shared by the expedition tests and the playthrough script. Not used by the game. */

import { Simulation, TICK, newGameState } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import type { ExpeditionAdventure } from './expedition';
import type { Activity, Equipment, OutingPlan } from './model';
import { newAdventure } from './state';
import { USUAL_COURSE, type Course } from './course';

/** established-group fixture; mountain=true exercises a real new journey. */
export function newExpedition(seed = adventureValley.seed, mountain = false, course: Course = USUAL_COURSE): { sim: Simulation; a: ExpeditionAdventure } {
  const state = newGameState(adventureValley, 'journey', seed);
  state.adventure = newAdventure(false, !mountain, course);
  const sim = new Simulation(adventureValley, state);
  return { sim, a: sim.expedition! };
}

export function plan(person: string, place: string, activity: Activity, item: Equipment | null = null, companion: string | null = null): OutingPlan {
  return { person, place, activity, item, companion };
}

/** Steps the simulation until `done`, or gives up. */
export function runUntil(sim: Simulation, done: () => boolean, limit = 3000): void {
  for (let i = 0; i < limit && !done(); i++) sim.step();
}

/** Everyone not planned rests; the day is begun and played to the next morning. */
export function playToMorning(sim: Simulation): void {
  sim.expedition!.runToMorning();
}

export { TICK };

/**
 * Deductions: a few finds the player works out rather than stumbles on. One
 * observation states a plain fact about the valley (butterbur grows only over
 * running water; the race runs dry at low water); acting on it, with the right
 * outing at the right place and time, brings the find home for certain, and
 * someone says so quietly at the fire. Without the observation the same find
 * is a rare stroke of luck. Nothing announces any of this ahead of time: the
 * forecast is unchanged, so the only way to know is to have noticed.
 */

import type { FindDef } from './catalogue';
import { FINDS, PLACES } from './content';
import { nameOf } from './people';
import type { AdventureState } from './state';

/** A find in the journal, or a learned line carrying this id. */
export function knows(state: AdventureState, clue: string): boolean {
  if (state.discoveries[clue]) return true;
  return PLACES.some((place) => (state.learned[place.id] ?? []).some((index) => place.learn[index]?.id === clue));
}

/** True when this find is one to be worked out and its clue is known. */
export function workedOut(find: FindDef, state: AdventureState): boolean {
  return !!find.knowing && find.knowing.clues.some((clue) => knows(state, clue));
}

/**
 * The find this outing would bring home by having noticed, if any: one of
 * today's candidates that is worked out, not already chosen, and not packed by
 * anyone else today.
 */
export function deducedFind(state: AdventureState, candidates: readonly FindDef[], person: string, chosen: readonly string[]): FindDef | null {
  const packed = new Set(state.outings.flatMap((o) => (o.person === person ? [] : o.bundles.flatMap((b) => (b.kind === 'find' ? [b.find] : [])))));
  return candidates.find((f) => workedOut(f, state) && !chosen.includes(f.id) && !packed.has(f.id)) ?? null;
}

/** The quiet acknowledgement at the fire, when this find was worked out. */
export function deductionLine(find: FindDef, state: AdventureState, person: string): string | null {
  if (!workedOut(find, state)) return null;
  return find.knowing!.line.replace(/\{name\}/g, nameOf(person));
}

/** Every find that can be worked out, for tests and tools. */
export const DEDUCTIONS: readonly FindDef[] = FINDS.filter((f) => f.knowing);

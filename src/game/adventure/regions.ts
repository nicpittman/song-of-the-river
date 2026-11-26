/**
 * The three reaches of the river, from the mountains down, each named for its
 * settlement, where the friends live while they are there. The hearth and the
 * spots round it come from the painted board (see `settlement.ts`).
 */

import type { Vec } from '../core/math';
import { COAST_CAMP } from '../world/boards/kawagiriSites';
import { adventureValley } from '../world/boards/adventure';
import { River } from '../world/river';
import { campAt, type Camp } from './settlement';

export type { CampSpot, Camp } from './settlement';

export interface RegionDef {
  id: string;
  name: string;
  title: string;
  /** World y of the top and bottom of the reach. */
  top: number;
  bottom: number;
  /** The heart of the settlement: its yard, near its hearth. */
  settlement: Vec;
}

export const REGIONS: readonly RegionDef[] = [
  { id: 'seseragi', name: 'Seseragi', title: '', top: 0, bottom: 2500, settlement: { x: 470, y: 1900 } },
  { id: 'mio', name: 'Mio', title: '', top: 2500, bottom: 4500, settlement: { x: 610, y: 3210 } },
  { id: 'kawagiri', name: 'Kawagiri', title: '', top: 4500, bottom: 6800, settlement: COAST_CAMP },
];

let river: River | null = null;

/** The journey's river, for rules that need to know where the water is. */
export function valleyRiver(): River {
  river ??= new River(adventureValley);
  return river;
}

/** The hearth and camp spots of a reach's settlement. */
export function campOf(region: number): Camp {
  return campAt(adventureValley, valleyRiver(), REGIONS[region]!.settlement);
}

/** The reach a world point lies in. */
export function regionAt(at: Vec): number {
  const index = REGIONS.findIndex((r) => at.y >= r.top && at.y < r.bottom);
  return index < 0 ? REGIONS.length - 1 : index;
}

/** The reaches the friends are living in: the current one (and, on a moving day, the next), or in Free Play every reach someone calls home. */
export function livedIn(state: { free: boolean; region: number; moving?: boolean; people: ReadonlyArray<{ base: number }> }): number[] {
  if (state.free) return [...new Set(state.people.map((p) => p.base))];
  return state.moving && state.region + 1 < REGIONS.length ? [state.region, state.region + 1] : [state.region];
}

/** True when a point lies in one of those reaches. */
export const inLivedReach = (state: Parameters<typeof livedIn>[0], p: { y: number }): boolean => livedIn(state).some((r) => p.y >= REGIONS[r]!.top && p.y < REGIONS[r]!.bottom);

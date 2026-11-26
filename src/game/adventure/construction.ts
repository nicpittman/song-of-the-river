/**
 * Building and planting. A building is placed (paying its materials) and then
 * built by friends who stay home: each such day adds a day of work, two for
 * Aki. A planting costs nothing, goes in at once and grows over a few days.
 * Both can be placed in the morning or during the day.
 */

import { dist, type Vec } from '../core/math';
import type { River } from '../world/river';
import type { BoardDef } from '../world/types';
import { FINDS } from './content';
import type { StructureKind } from './model';
import { DAY_SECONDS } from './calendar';
import { REGIONS, regionAt, valleyRiver } from './regions';
import type { AdventureState, Building } from './state';
import { isPlanting, structureDef } from './structures';
import { homeRegion, isComplete, openedTo, setOutFrom } from './world';
import { bridgeCrossing } from './bridges';
import { COAST_BRIDGE } from '../world/boards/kawagiriSites';
import { seat } from './campSeats';
import { routeLength, type WalkingMap } from './navigation';
import { streamKnown } from './stream';

const FIXED_SITE: Partial<Record<StructureKind, string>> = {
  'ford-bridge': 'The bridge belongs at the Old Ford below the falls.',
  bridge: 'The bridge belongs at the Mio narrows, just above the mill.',
  stones: 'The stones belong where the old road meets the stream, below Furumichi.',
};

export type Answer = { ok: true } | { ok: false; reason: string };
export const yes: Answer = { ok: true };
export const no = (reason: string): Answer => ({ ok: false, reason });
type WorkMap = Pick<WalkingMap, 'route'>;

/** Why this kind cannot be placed at all just now, or null. */
export function buildingProblem(state: AdventureState, kind: StructureKind): string | null {
  const def = structureDef(kind);
  if (state.voyage !== 'preparing') return 'The boat is leaving.';
  if (!def.repeatable && state.buildings.some((b) => b.kind === kind)) return isPlanting(kind) ? 'Already planted.' : 'Already placed in the valley.';
  if (def.region > openedTo(state)) return 'Follow the river farther down first.';
  // In Free Play only plantings and the carpenter's works need their find; nothing else waits on the story.
  if (def.requires && !state.discoveries[def.requires] && (!state.free || def.planting || def.requires === 'aki-meeting')) {
    if (def.requires === 'aki-meeting') return 'Nobody here knows this work. A carpenter lodges at Toroya Inn in Mio.';
    const find = FINDS.find((f) => f.id === def.requires);
    return `Needs ${find ? find.name.toLowerCase() : 'something not yet found'} in the journal.`;
  }
  if (kind === 'ford-bridge' && !state.free && !state.known.includes('takaishi')) return 'Find the Old Ford first.';
  if (kind === 'stones' && !streamKnown(state)) return 'Follow the old road south to the stream first.';
  if (kind === 'dock' && !state.free && state.region === 2 && !state.known.includes('kawagiri')) return 'Follow Shiobashi Bridge’s eastern path to the village before choosing a dock site.';
  if (kind === 'boat' && !state.free && !boatPlansFound(state)) return 'We need boat plans to repair the old hull.';
  if (kind === 'boat' && !state.buildings.some((b) => b.kind === 'dock' && isComplete(b))) return 'Finish a dock so we can bring the old boat alongside for repairs.';
  // Only story works take days; small works and plantings go up beside them.
  if (def.major && underWay(state)) return 'A frame is already standing. Finish it first, or take it down and keep the timber.';
  if (state.materials < def.cost) return `Needs ${def.cost} materials (${state.materials} available).`;
  return null;
}

export const boatPlansFound = (state: AdventureState): boolean => !!state.discoveries['boat-ledger'] || !!state.discoveries['boatyard-moulds'];

/** Why this spot will not do, or null. */
export function siteProblem(state: AdventureState, board: BoardDef, river: River, kind: StructureKind, at: Vec): string | null {
  const def = structureDef(kind);
  const region = REGIONS[state.region]!;
  const lowest = REGIONS[openedTo(state)]!;
  // A work that belongs to one spot goes there, even just over the edge of the reach (the stones below Furumichi).
  if (def.at) {
    if (!state.free && def.region !== state.region) return 'Choose a spot near where we are living now.';
    return dist(at, def.at) > 110 ? FIXED_SITE[kind] ?? 'It belongs in one particular spot.' : null;
  }
  if (at.y < (state.free ? 0 : region.top) || at.y >= lowest.bottom) return 'Choose a spot near where we are living now.';
  if (at.x < 120 || at.x > board.width - 120 || at.y > (board.sea?.y ?? Infinity) - 60) return 'Choose firm ground in the valley.';
  if (def.major && underWay(state, regionAt(at))) return 'A frame is already standing in this reach. Finish it, or take it down and keep the timber.';
  if (kind === 'bridge') {
    if (board.id === 'river-adventure' && dist(at, COAST_BRIDGE) < 170) return 'Shiobashi Bridge already carries a footbridge across this stretch.';
    const crossing = bridgeCrossing(river, at);
    if (!crossing || dist(at, crossing) > 110) return 'Choose a narrow part of the river, between the banks.';
    if (crossing.width > 380) return 'The river is too wide here. Try a narrower crossing upstream.';
  }
  const edge = river.edgeDistance(at);
  if (def.site === 'bank' && (edge < 20 || edge > 150)) return 'This belongs on the bank, close to the water.';
  if (def.site === 'ground' && edge < 50) return 'Move a little farther onto dry ground.';
  if (state.buildings.some((b) => dist(b, at) < 90)) return 'Leave a little room beside the others.';
  return null;
}

export function placeStructure(state: AdventureState, board: BoardDef, river: River, kind: StructureKind, at: Vec): Answer {
  const problem = buildingProblem(state, kind) ?? siteProblem(state, board, river, kind, at);
  if (problem) return no(problem);
  const def = structureDef(kind);
  state.materials -= def.cost;
  state.buildings.push({ id: state.nextId++, kind, x: Math.round(def.at?.x ?? at.x), y: Math.round(def.at?.y ?? at.y), region: def.at ? def.region : regionAt(at), work: 0, placed: state.day });
  return yes;
}

/** The building friends who stay home work on, if any. */
export function underWay(state: AdventureState, region = state.region): Building | null {
  return state.buildings.find((b) => b.region === region && !isComplete(b)) ?? null;
}

/** Unused materials remain at an unfinished site; completed work cannot be reclaimed. */
export function recoverBuilding(state: AdventureState, id: number): Answer {
  if (state.phase !== 'morning') return no('Recover a building site in the morning.');
  const building = state.buildings.find((b) => b.id === id);
  if (!building || isComplete(building)) return no('Only unfinished building sites can be recovered.');
  const def = structureDef(building.kind);
  state.materials += Math.floor(def.cost * (1 - building.work / def.work) + 1e-8);
  state.buildings = state.buildings.filter((b) => b.id !== id);
  if (state.workedOn === id) state.workedOn = null;
  return yes;
}

/** Work on a bridge from dry ground at its western end, never in mid-river. */
export function workPoint(building: Pick<Building, 'kind' | 'x' | 'y'>, index: number): Vec {
  if (building.kind === 'bridge' || building.kind === 'ford-bridge') {
    const river = valleyRiver();
    const crossing = bridgeCrossing(river, building);
    if (crossing) for (let d = 32; d < 800; d += 16) {
      const at = { x: crossing.x - d, y: building.y + 32 + index * 6 };
      if (river.edgeDistance(at) > 55) return at;
    }
  }
  return { x: building.x - 30 + index * 22, y: building.y + 26 };
}

/** Placement, the notebook, work accrual and the visible walk share this journey. */
export function workTrip(state: AdventureState, person: string, building: Pick<Building, 'kind' | 'x' | 'y' | 'region'>, nav?: WorkMap) {
  if (homeRegion(state, person) !== building.region) return null;
  const index = state.people.findIndex((p) => p.id === person);
  if (index < 0) return null;
  const fire = setOutFrom(state, building, person);
  const start = seat(fire, index), spot = workPoint(building, index);
  const route = nav?.route(start, spot, REGIONS[openedTo(state)]!.bottom);
  if (nav && !route) return null;
  const walk = Math.max(1, (route ? routeLength(route) : dist(start, spot)) / 210);
  const end = DAY_SECONDS - 3 - walk;
  // Six seconds at the site leaves time for useful work and a real return home.
  return end - walk >= 6 ? { fire, spot, route, walk, end } : null;
}

export function canWorkOn(state: AdventureState, person: string, building: Building, nav?: WorkMap): boolean {
  return !!workTrip(state, person, building, nav);
}

/** Aki's experience counts as two ordinary builders. Shared with the notebook preview. */
export const workRate = (person: string): number => person === 'aki' ? 2 : 1;

/** A day's work by the friends who stayed home. Returns the building if it is now finished. */
export function workOn(state: AdventureState, builders: readonly string[], fraction = 1, building = underWay(state)): Building | null {
  if (!building || builders.length === 0 || fraction <= 0) return null;
  const def = structureDef(building.kind);
  if (building.worked?.day !== state.day) building.worked = { day: state.day, by: [] };
  for (const id of builders) if (!building.worked.by.includes(id)) building.worked.by.push(id);
  for (const id of builders) building.work += workRate(id) * fraction;
  building.work = Math.min(building.work + 1e-8 >= def.work ? def.work : building.work, def.work);
  return isComplete(building) ? building : null;
}

/** Work accrues only while the builders are at the site, and is saved every step. */
export function workDuring(state: AdventureState, before: number, now: number, nav?: WalkingMap): Building | null {
  for (const id of state.resting) {
    const building = underWay(state, homeRegion(state, id));
    if (!building) continue;
    const trip = workTrip(state, id, building, nav);
    if (!trip) continue;
    const { walk, end } = trip;
    state.workedOn = building.id;
    const seconds = Math.max(0, Math.min(now, end) - Math.max(before, walk));
    if (seconds > 0 && workOn(state, [id], seconds / (end - walk), building)) return building;
  }
  return null;
}

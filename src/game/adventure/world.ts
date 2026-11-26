/**
 * The facts every rule needs about the day: the calendar, the river, the
 * weather, and what has been built. Built fresh from the state whenever it is
 * needed; it holds nothing of its own.
 */

import type { Vec } from '../core/math';
import { seasonOf, weatherOf } from './calendar';
import type { Conditions } from './catalogue';
import type { StructureKind, WaterLevel, WaterTrend, Weather } from './model';
import { levelOf, trendOf } from './river';
import type { AdventureState, Building } from './state';
import { GROWTH_DAYS, isPlanting, structureDef } from './structures';
import { REGIONS, campOf, regionAt, valleyRiver } from './regions';
import { adventureValley } from '../world/boards/adventure';
import { campAt } from './settlement';
import type { CampOrigin } from './campSeats';
import { PLACES } from './content';

export interface Today {
  day: number;
  season: number;
  level: WaterLevel;
  trend: WaterTrend;
  weather: Weather;
}

export interface World {
  seed: number;
  state: AdventureState;
  today: Today;
  /** Supplied by the live walking map; pure content tests may omit it. */
  route?: (from: Vec, to: Vec) => Vec[] | null;
}

export function todayOf(seed: number, day: number): Today {
  return { day, season: seasonOf(day), level: levelOf(seed, day), trend: trendOf(seed, day), weather: weatherOf(seed, day) };
}

export function worldOf(seed: number, state: AdventureState, day = state.day): World {
  return { seed, state, today: todayOf(seed, day) };
}

/** 0 a seedling, 1 growing, 2 grown. Buildings count as grown once they are finished. */
export function stageOf(building: Building, day: number): 0 | 1 | 2 {
  if (!isPlanting(building.kind)) return 2;
  const age = day - building.placed;
  return age >= GROWTH_DAYS[1] ? 2 : age >= GROWTH_DAYS[0] ? 1 : 0;
}

export function isComplete(building: Building): boolean {
  return building.work >= structureDef(building.kind).work;
}

/** Finished buildings, and grown plantings. */
export function readyBuildings(state: AdventureState, day = state.day): Building[] {
  return state.buildings.filter((b) => isComplete(b) && stageOf(b, day) === 2);
}

export function isBuilt(state: AdventureState, kind: StructureKind, day = state.day): boolean {
  return readyBuildings(state, day).some((b) => b.kind === kind);
}

export function nearestBuilt(state: AdventureState, kind: StructureKind, at: Vec, within: number): Building | null {
  for (const b of readyBuildings(state)) {
    if (b.kind === kind && Math.hypot(b.x - at.x, b.y - at.y) <= within) return b;
  }
  return null;
}

/** The farthest reach on the map: the one the friends live in, or all of them in Free Play. */
export function openedTo(state: AdventureState): number {
  return state.free ? REGIONS.length - 1 : Math.min(REGIONS.length - 1, state.region + (state.moving && state.phase === 'day' ? 1 : 0));
}

/** A person's reached town; optional shelter lodging remains within that town's reach. */
export function homeRegion(state: AdventureState, person: string): number {
  return state.people.find((p) => p.id === person)?.base ?? state.region;
}

export interface Lodging { id: number | string; region: number; name: string; at: Vec; fire: CampOrigin }

const hutBases = new Map<string, Lodging>();
function hutBase(place: (typeof PLACES)[number]): Lodging {
  let base = hutBases.get(place.id);
  if (!base) {
    const hearth = adventureValley.sprites.find((s) => s.asset === 'bonfire' && Math.hypot(s.x - place.at.x, s.y - place.at.y) < 180);
    base = { id: place.id, region: place.region, name: place.name, at: place.at, fire: campAt(adventureValley, valleyRiver(), hearth ?? { x: place.at.x, y: place.at.y + 75 }, true).fire };
    hutBases.set(place.id, base);
  }
  return base;
}

export function availableLodgings(state: AdventureState): Lodging[] {
  const shelters = readyBuildings(state).filter((b) => b.kind === 'shelter').map((b) => ({ id: b.id, region: b.region, name: 'Walkers’ shelter', at: { x: b.x, y: b.y }, fire: shelterFire(b) }));
  const huts = PLACES.filter((p) => ['hut', 'inn'].includes(p.habitat) && state.known.includes(p.id) && (state.visits[p.id] ?? 0) > 0).map(hutBase);
  return [...shelters, ...huts];
}

export function lodgingById(state: AdventureState, id: number | string | undefined): Lodging | undefined {
  if (id === undefined) return undefined;
  if (typeof id === 'number') {
    const building = state.buildings.find((b) => b.id === id && b.kind === 'shelter' && isComplete(b));
    return building ? { id, region: building.region, name: 'Walkers’ shelter', at: { x: building.x, y: building.y }, fire: shelterFire(building) } : undefined;
  }
  const place = PLACES.find((p) => p.id === id && ['hut', 'inn'].includes(p.habitat));
  return place && state.known.includes(id) && (state.visits[id] ?? 0) > 0 ? hutBase(place) : undefined;
}

/** A known hut can host the outing that first visits it; rumours need scouting first. */
export function overnightAt(state: AdventureState, id: string | undefined): Lodging | undefined {
  const place = PLACES.find((p) => p.id === id && ['hut', 'inn'].includes(p.habitat));
  return place && state.known.includes(place.id) ? hutBase(place) : undefined;
}

export function lodgingOf(state: AdventureState, person: string): Lodging | undefined {
  const resident = state.people.find((p) => p.id === person);
  const lodging = lodgingById(state, resident?.lodging);
  return lodging?.region === resident?.base ? lodging : undefined;
}

export function shelterFire(building: Vec): CampOrigin {
  const region = REGIONS[regionAt(building)]!;
  // A shelter near the mist must not put its arrival point in the next chapter.
  const y = Math.max(region.top + 120, Math.min(building.y + 100, region.bottom - 150));
  return campAt(adventureValley, valleyRiver(), { x: building.x, y }, true, region).fire;
}

export function homeName(state: AdventureState, person: string): string {
  return lodgingOf(state, person)?.name ?? REGIONS[homeRegion(state, person)]!.name;
}

export function setOutFrom(state: AdventureState, _place: { region: number }, person: string): Vec {
  const lodging = lodgingOf(state, person);
  return lodging ? lodging.fire : campOf(homeRegion(state, person)).fire;
}

/** Occupied bases, with Sora’s fire winning ties. No one moves home for the camera. */
export function occupiedCamps(state: AdventureState): Array<{ id: string; at: CampOrigin; people: number }> {
  const camps = new Map<string, { id: string; at: CampOrigin; people: number }>();
  for (const person of state.people) {
    const lodging = lodgingOf(state, person.id);
    const id = lodging ? `lodging-${lodging.id}` : `town-${person.base}`;
    const group = camps.get(id) ?? { id, at: lodging?.fire ?? campOf(person.base).fire, people: 0 };
    group.people++;
    camps.set(id, group);
  }
  // The lead's fire wins a tie: Sora's in a Journey, Haru's in Free Play.
  const lead = state.people.find(p => p.id === (state.free ? 'haru' : 'sora'));
  const lodging = lead ? lodgingOf(state, lead.id) : null;
  const preferred = lodging ? `lodging-${lodging.id}` : `town-${lead?.base ?? state.region}`;
  return [...camps.values()].sort((a, b) => b.people - a.people || Number(b.id === preferred) - Number(a.id === preferred));
}

export function eveningFire(state: AdventureState): CampOrigin {
  return occupiedCamps(state)[0]?.at ?? campOf(state.region).fire;
}

export function holds(when: Conditions | undefined, today: Today, state: AdventureState): boolean {
  if (!when) return true;
  if (when.seasons && !when.seasons.includes(today.season)) return false;
  if (when.levels && !when.levels.includes(today.level)) return false;
  if (when.weather && !when.weather.includes(today.weather)) return false;
  if (when.structure && !isBuilt(state, when.structure, today.day)) return false;
  if (when.way && !state.free && state.course?.way !== when.way) return false;
  if (when.journey && state.free) return false;
  return true;
}

/**
 * The valley's other people: a few villagers in each settlement who go about
 * small routines between the doors, the well and the lanes by day, and are
 * indoors at night. They are scenery with a life; nobody sends them anywhere.
 * A settlement grows a little as it is built up, and a finished collection
 * can bring someone new (see `collections.ts`).
 */

import type { SceneFigure } from './model';
import { completeSets } from './collections';
import { homeLife } from './motion';
import { campOf } from './regions';
import { landingSpot } from './finale';
import type { AdventureState } from './state';
import { isBuilt, openedTo, readyBuildings } from './world';
import type { Pose, StructureKind } from './model';
import { placeDef } from './content';

interface Villager {
  id: string;
  look: string;
  region: number;
}

const RESIDENTS: readonly Villager[] = [
  { id: 'villager-seseragi-0', look: 'villager-a', region: 0 },
  { id: 'villager-seseragi-1', look: 'villager-farmer', region: 0 },
  { id: 'villager-seseragi-2', look: 'villager-woman', region: 0 },
  { id: 'villager-seseragi-3', look: 'villager-f', region: 0 },
  { id: 'villager-seseragi-4', look: 'villager-elder', region: 0 },
  { id: 'villager-mio-0', look: 'villager-woman', region: 1 },
  { id: 'villager-mio-1', look: 'villager-farmer', region: 1 },
  { id: 'villager-mio-3', look: 'villager-e', region: 1 },
  { id: 'villager-mio-4', look: 'villager-elder', region: 1 },
  { id: 'villager-kawagiri-0', look: 'villager-farmer', region: 2 },
  { id: 'villager-kawagiri-1', look: 'villager-woman', region: 2 },
  { id: 'villager-kawagiri-2', look: 'villager-g', region: 2 },
  { id: 'villager-kawagiri-3', look: 'villager-elder', region: 2 },
];

/** Villagers in the opened valley now, going about their day. */
export function villagerFigures(state: AdventureState, clock: number, seed: number): SceneFigure[] {
  const indoors = state.phase === 'night';
  const people: Villager[] = RESIDENTS.filter((v) => v.region <= openedTo(state));
  // A new cottage in Mio brings a new neighbour.
  if (isBuilt(state, 'cottage')) people.push({ id: 'villager-mio-2', look: 'villager-a', region: 1 });

  const seeingOff = state.voyage === 'gathering' || state.voyage === 'sailing';
  const figures = people.map((v, i): SceneFigure => {
    const camp = campOf(v.region);
    // The people of the last settlement come down to the landing to wave the boat off.
    if (seeingOff && v.region === state.region) {
      const at = landingSpot(state, state.people.length + i);
      return figure(v.id, v.look, { at, pose: 'wave', facing: 1, action: (clock * 0.8 + i * 0.4) % 1 }, true);
    }
    // They keep away from the hearth the friends use, so their round starts at a door.
    const stance = homeLife(v.id, i + 7, clock * 0.8, camp.spots[i % camp.spots.length]?.at ?? camp.fire, camp.spots, seed);
    return figure(v.id, v.look, stance, !indoors);
  });

  if (!indoors) {
    const mill = placeDef('suisha');
    const talking = state.phase === 'day' && state.outings.some((o) => o.place === mill.id && o.legs.some((leg) => leg.kind === 'beat' && state.elapsed >= leg.start && state.elapsed < leg.end));
    figures.push(figure('miller', 'villager-a', { at: { x: mill.at.x + 24, y: mill.at.y + 8 }, pose: talking ? 'talk' : 'carry', facing: -1, action: (clock * .4) % 1 }, true));
  }

  if (!indoors && openedTo(state) >= 2 && state.known.includes('funaya') && !seeingOff) {
    const yard = placeDef('funaya');
    const talking = state.phase === 'day' && state.outings.some((o) => (o.place === yard.id || o.second?.place === yard.id) && o.legs.some((leg) => leg.kind === 'beat' && leg.at && Math.hypot(leg.at.x - yard.at.x, leg.at.y - yard.at.y) < 50 && state.elapsed >= leg.start && state.elapsed < leg.end));
    figures.push(figure('boatyard-moulds', 'villager-d', { at: { x: yard.at.x + 24, y: yard.at.y + 8 }, pose: talking ? 'talk' : 'carry', facing: -1, action: (clock * .4) % 1 }, true));
  }

  // What the group built and left behind is used: a neighbour at the platform, the garden, the lookout.
  if (!indoors && !seeingOff) readyBuildings(state).filter((b) => LEFT_BEHIND_USE[b.kind] && b.region < state.region && !state.free).slice(0, 3).forEach((b, i) => {
    const use = LEFT_BEHIND_USE[b.kind]!;
    const at = { x: b.x + 18, y: b.y + 14 };
    const spots = [{ name: 'here', at, pose: use }, { name: 'nearby', at: { x: at.x + 40, y: at.y + 10 }, pose: 'look' as const }];
    figures.push(figure(`villager-at-${b.id}`, ['villager-b', 'villager-e', 'villager-c', 'villager-g', 'villager-d', 'villager-h'][i % 6]!, homeLife(`keeper-${b.id}`, 30 + i, clock * 0.5, at, spots, seed), true));
  });

  // Someone new, where a finished collection drew them.
  completeSets(state).forEach((set, i) => {
    if (set.consequence.kind !== 'villager' || set.region > openedTo(state)) return;
    const at = set.consequence.at;
    const spots = [{ name: 'here', at, pose: 'talk' as const }, { name: 'nearby', at: { x: at.x + 60, y: at.y + 16 }, pose: 'look' as const }];
    const stance = homeLife(`visitor-${set.id}`, 20 + i, clock * 0.7, at, spots, seed);
    figures.push(figure(`villager-${set.id}`, set.consequence.look, stance, !indoors));
  });
  return figures;
}

function figure(id: string, look: string, stance: ReturnType<typeof homeLife>, visible: boolean): SceneFigure {
  return {
    id,
    role: 'villager',
    look,
    at: stance.at,
    facing: stance.facing,
    // At home the first spot is the hearth; villagers stand rather than sit there.
    pose: stance.pose === 'sit' ? 'idle' : stance.pose,
    action: Math.max(0, Math.min(1, stance.action)),
    pack: null,
    item: null,
    visible,
    selected: false,
  };
}

/** How a neighbour uses each small work once the group has gone on down the river. */
const LEFT_BEHIND_USE: Partial<Record<StructureKind, Pose>> = { platform: 'fish', garden: 'forage', lookout: 'look', shelter: 'idle' };

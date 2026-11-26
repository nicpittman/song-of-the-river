/**
 * Migrating birds. They cross the valley in hops, from one resting place to
 * the next, and no hop can be longer than the flock will fly. Wetlands, woods
 * and anything the player plants are resting places, unless a footpath runs
 * beside them: birds will not settle where people walk.
 *
 * So the player helps birds by planting where the chain has a gap, and by
 * keeping footpaths away from the places it depends on.
 */

import { dist } from '../core/math';
import type { Connection } from '../world/connections';
import { Polyline, smoothCurve } from '../world/geometry';
import type { BoardDef, PlaceDef } from '../world/types';
import type { Closure } from './conditions';
import type { Leg } from './legs';

const DEFAULT_FLIGHT = 640;
/** Seconds a flock settles at each stopover. */
const STOPOVER = 2.4;
/** A footpath this close to a resting place's edge keeps birds off it. */
const SHY = 34;

/** True if people walk too close for birds to settle. */
export function isDisturbed(place: PlaceDef, connections: readonly Connection[]): boolean {
  return connections.some((c) => c.type === 'path' && c.line.nearest(place).d < place.radius + SHY);
}

/** A gently bowed flight between two points. */
function hop(a: PlaceDef, b: PlaceDef, rest: boolean): Leg {
  const d = dist(a, b);
  const bow = d * 0.1;
  const mid = { x: (a.x + b.x) / 2 - ((b.y - a.y) / d) * bow, y: (a.y + b.y) / 2 + ((b.x - a.x) / d) * bow - bow * 0.6 };
  const line = new Polyline(smoothCurve([a, mid, b], 18));
  return { line, from: 0, to: line.length, rest: rest ? STOPOVER : undefined };
}

export interface FlightRoute {
  legs: Leg[];
  /** If the chain is broken: where, and the legs lead only as far as the last place within reach. */
  closure: Closure | null;
}

/** The hops a flock would make from one place to another, or as far as it can get. */
export function flightRoute(board: BoardDef, connections: readonly Connection[], fromId: string, toId: string): FlightRoute | null {
  const range = board.flight ?? DEFAULT_FLIGHT;
  const from = board.places.find((p) => p.id === fromId);
  const to = board.places.find((p) => p.id === toId);
  if (!from || !to) return null;
  // The flock always leaves from where it is; everywhere else must be fit to land on.
  const stops = [from, ...board.places.filter((p) => p.rest && p.id !== fromId && !isDisturbed(p, connections))];
  const goal = stops.indexOf(to);

  const cost = stops.map(() => Infinity);
  const via = stops.map(() => -1);
  const done = stops.map(() => false);
  cost[0] = 0;
  for (;;) {
    let at = -1;
    for (let i = 0; i < stops.length; i++) if (!done[i] && cost[i]! < (at < 0 ? Infinity : cost[at]!)) at = i;
    if (at < 0 || at === goal) break;
    done[at] = true;
    for (let i = 0; i < stops.length; i++) {
      const d = dist(stops[at]!, stops[i]!);
      if (i === at || d > range) continue;
      // Prefer fewer, longer hops only slightly: a flock likes to rest.
      if (cost[at]! + d + 40 < cost[i]!) {
        cost[i] = cost[at]! + d + 40;
        via[i] = at;
      }
    }
  }

  const chain = (end: number): PlaceDef[] => {
    const path = [end];
    while (path[0] !== 0) path.unshift(via[path[0]!]!);
    return path.map((i) => stops[i]!);
  };
  const legsOf = (places: PlaceDef[]): Leg[] => places.slice(1).map((place, i) => hop(places[i]!, place, i < places.length - 2));

  if (goal >= 0 && cost[goal]! < Infinity) return { legs: legsOf(chain(goal)), closure: null };

  // No way through. Fly to the reachable place nearest the goal, so the gap can be seen.
  let nearest = 0;
  for (let i = 1; i < stops.length; i++) if (cost[i]! < Infinity && dist(stops[i]!, to) < dist(stops[nearest]!, to)) nearest = i;
  const last = stops[nearest]!;
  const gap = Math.min(1, (range * 0.5) / Math.max(1, dist(last, to)));
  const at = { x: last.x + (to.x - last.x) * gap, y: last.y + (to.y - last.y) * gap };
  return { legs: legsOf(chain(nearest)), closure: { cause: 'gap', span: [0, 0], at } };
}

/**
 * How the friends move, as a pure function of time. Nobody ever stands stock
 * still: at home they potter between a few spots round the settlement (the
 * hearth, a doorway, the mill, a building site, a garden) and on an outing
 * each beat wanders a little (a few steps along the bank between casts, a
 * small loop while exploring, kneeling in two or three spots).
 *
 * None of this is saved or affects the rules: it is computed from the clock,
 * the friend and the seed, so it is the same every time.
 */

import { seat } from './campSeats';
export { seat } from './campSeats';
import { clamp, dist, lerp, type Vec } from '../core/math';
import { hashString } from '../core/rng';
import type { Pose } from './model';
import { alongRoute, routeLength } from './navigation';
import type { CampSpot } from './settlement';
import type { Leg } from './state';

export interface Stance {
  at: Vec;
  pose: Pose;
  facing: -1 | 1;
  /** 0..1 through the current action. */
  action: number;
}

/** Seconds each small errand at home lasts, walk included. */
const ERRAND = 9;
const HOME_PACE = 55;
/** A beat is broken into this many moments, each in a slightly different spot. */
const MOMENTS = 3;

const unit = (key: string): number => hashString(key) / 4294967296;
const facingTo = (from: Vec, to: Vec, fallback: -1 | 1 = 1): -1 | 1 => (Math.abs(to.x - from.x) < 1 ? fallback : to.x > from.x ? 1 : -1);


/**
 * A friend at home, pottering. `spots` are the settlement's spots plus any
 * garden or building site; the hearth is always among the choices.
 */
export function homeLife(id: string, index: number, t: number, fire: Vec, spots: readonly CampSpot[], seed: number): Stance {
  const all: CampSpot[] = [{ name: 'the hearth', at: seat(fire, index), pose: 'sit' }, ...spots];
  const clock = t + index * 3.1;
  const errand = Math.floor(clock / ERRAND);
  const local = clock - errand * ERRAND;
  const pick = (k: number): CampSpot => all[hashString(`${seed}:${id}:${k}`) % all.length]!;
  const here = pick(errand);
  const before = pick(errand - 1);
  const offset = (k: number): Vec => ({ x: (unit(`${id}:${k}:x`) - 0.5) * 24, y: (unit(`${id}:${k}:y`) - 0.5) * 14 });
  const from = before.pose === 'sit' ? before.at : add(before.at, offset(errand - 1));
  const to = here.pose === 'sit' ? here.at : add(here.at, offset(errand));
  const walkTime = Math.min(ERRAND * 0.6, dist(from, to) / HOME_PACE);
  if (local < walkTime) {
    const k = local / walkTime;
    return { at: { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) }, pose: before.pose === 'carry' ? 'carry' : 'walk', facing: facingTo(from, to), action: k };
  }
  return { at: to, pose: here.pose, facing: facingTo(from, to, index % 2 ? -1 : 1), action: (local - walkTime) / Math.max(0.1, ERRAND - walkTime) };
}

/** A friend who stayed home to build: over to the site, work, and back before dusk. */
export function builderLife(id: string, index: number, t: number, fire: Vec, site: Vec, dayEnd: number, workAt?: Vec, points?: Vec[]): Stance {
  const start = seat(fire, index);
  const spot = workAt ?? { x: site.x - 30 + index * 22, y: site.y + 26 };
  const walkTime = Math.max(1, (points ? routeLength(points) : dist(start, spot)) / 210);
  if (t < walkTime) return points ? onLegs(id, [{ kind: 'walk', start: 0, end: walkTime, points, pose: 'walk' }], t, start) : walking(start, spot, t / walkTime);
  if (t > dayEnd - walkTime) return points ? onLegs(id, [{ kind: 'walk', start: dayEnd - walkTime, end: dayEnd, points: [...points].reverse(), pose: 'walk' }], t, start) : walking(spot, start, clamp((t - (dayEnd - walkTime)) / walkTime, 0, 1));
  const swing = (t - walkTime) % 2.4;
  return { at: spot, pose: unit(`${id}:${Math.floor(t / 7)}`) < 0.2 ? 'carry' : 'build', facing: spot.x > site.x ? -1 : 1, action: swing / 2.4 };
}

/** A friend on their legs at time `t`. */
export function onLegs(id: string, legs: readonly Leg[], t: number, fallback: Vec): Stance {
  const leg = legs.find((l) => t >= l.start && t < l.end) ?? (t < (legs[0]?.start ?? 0) ? legs[0] : legs[legs.length - 1]);
  if (!leg) return { at: fallback, pose: 'idle', facing: 1, action: 0 };
  const k = leg.end > leg.start ? clamp((t - leg.start) / (leg.end - leg.start), 0, 1) : 1;
  if (leg.kind === 'walk' && leg.points && leg.points.length > 0) {
    const length = routeLength(leg.points);
    if (length < .01) return { at: leg.points[0]!, pose: 'idle', facing: 1, action: 0 };
    const here = alongRoute(leg.points, k * length);
    const ahead = alongRoute(leg.points, Math.min(length, k * length + 4));
    return { at: { x: here.x, y: here.y }, pose: leg.reveal ? 'carry' : 'walk', facing: facingTo(here, ahead), action: (t * 1.6) % 1 };
  }
  return beatStance(id, leg, t);
}

/** A beat broken into a few moments, each a short step to a nearby spot and then the action. */
function beatStance(id: string, leg: Leg, t: number): Stance {
  const centre = leg.at!;
  const span = Math.max(0.1, leg.end - leg.start);
  if (leg.fork) return { at: centre, pose: 'look', facing: 1, action: ((t - leg.start) / span) % 1 };
  const moment = Math.min(MOMENTS - 1, Math.floor(((t - leg.start) / span) * MOMENTS));
  const length = span / MOMENTS;
  const local = t - leg.start - moment * length;
  const spot = (m: number): Vec => {
    if (m < 0) return centre;
    const angle = unit(`${id}:${leg.start}:${m}:a`) * Math.PI * 2;
    const radius = 14 + unit(`${id}:${leg.start}:${m}:r`) * 26;
    return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius * 0.5 };
  };
  const from = spot(moment - 1);
  const to = spot(moment);
  const step = Math.min(1.4, length * 0.3);
  if (local < step) return walking(from, to, local / step);
  return { at: to, pose: leg.pose, facing: facingTo(from, to), action: (local - step) / Math.max(0.1, length - step) };
}

function walking(from: Vec, to: Vec, k: number): Stance {
  return { at: { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) }, pose: 'walk', facing: facingTo(from, to), action: k };
}

function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}

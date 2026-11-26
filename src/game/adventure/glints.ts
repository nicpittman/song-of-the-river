/**
 * Glints: now and then (every day or three, a little oftener in Wander) a
 * small thing catches the light by a friend out for the day, just ahead of
 * them on the path or beside them where they have stopped: a
 * feather, a lost glove, an old boundary stone. Looked at, it goes into the
 * journal as one line among the small finds; left alone, it fades. Each thing
 * is found once. Never required, never announced.
 *
 * Decided as the day begins, after the sightings and crossings, and kept
 * clear of both, so only one thing asks for the eye at a time.
 */

import { dist, type Vec } from '../core/math';
import { hashString, mulberry32 } from '../core/rng';
import { DAY_SECONDS } from './calendar';
import { placeDef } from './content';
import { alongRoute, routeLength } from './navigation';
import { fitsStory } from './narrative';
import { regionAt, valleyRiver } from './regions';
import { watchedPerson, type SightingWatch } from './sightings';
import { SMALL_FINDS } from './smallFinds';
import type { AdventureState, Glint, Leg, Outing } from './state';
import { holds, type World } from './world';

/** Seconds a glint shows, untouched. */
export const GLINT_LIFE = 9;
/** The chance of a glint on any one day: one every two days or so, a little more in Wander. */
export const GLINT_CHANCE = 0.8;
export const WANDER_GLINT_CHANCE = 0.92;
/** It shows where the friend will be this many seconds later, just ahead of them. */
const AHEAD = 1.5;
/** Never by anyone's home fire, where the day begins and ends: out along the way. */
const AWAY_FROM_HOME = 200;
/** To one side of the path, in world units; and farther off a stop, beyond where they wander about it. */
const ASIDE = 24;
const STOPPED_ASIDE = 56;

const isWalk = (l: Leg): boolean => l.kind === 'walk' && !!l.points && l.points.length > 1;

/**
 * A dry spot just beside where `outing` is at `t`: to one side of the path
 * when walking, a few steps off when stopped (clear of where they potter
 * about), or null when they are not out or it is a fork.
 */
function besideAt(outing: Outing, t: number, hash: number, river: ReturnType<typeof valleyRiver>): Vec | null {
  const leg = outing.legs.find((l) => t >= l.start && t < l.end);
  if (!leg || leg.fork) return null;
  const side = hash % 2 ? 1 : -1;
  const tries: Vec[] = [];
  if (isWalk(leg)) {
    const ahead = walking(outing, t);
    if (!ahead) return null;
    for (const k of [side, -side]) tries.push({ x: ahead.x - Math.sin(ahead.angle) * ASIDE * k, y: ahead.y + Math.cos(ahead.angle) * ASIDE * 0.7 * k });
  } else if (leg.at) {
    const angle = ((hash >>> 1) % 360) * (Math.PI / 180);
    for (let i = 0; i < 4; i++) tries.push({ x: leg.at.x + Math.cos(angle + i * 1.57) * STOPPED_ASIDE, y: leg.at.y + Math.sin(angle + i * 1.57) * STOPPED_ASIDE * 0.55 });
  }
  const spot = tries.find((p) => river.edgeDistance(p) > 8);
  return spot ? { x: Math.round(spot.x), y: Math.round(spot.y) } : null;
}

function walking(outing: Outing, t: number): (Vec & { angle: number }) | null {
  const leg = outing.legs.find((l) => isWalk(l) && t >= l.start && t < l.end);
  if (!leg || leg.end <= leg.start) return null;
  const length = routeLength(leg.points!);
  return length < 1 ? null : alongRoute(leg.points!, (length * (t - leg.start)) / (leg.end - leg.start));
}

/** Never nearer a place's mark than this. */
const CLEAR_OF_MARKS = 70;
/** A creature showing nearer than this at the same time would compete for the eye. */
const CLEAR_OF_CREATURES = 450;

/** Moments already taken: creatures showing (near the spot, when one is given), crossings, forks and first meetings. */
function takenTimes(s: AdventureState): Array<[number, number, Vec?]> {
  const out: Array<[number, number, Vec?]> = [];
  for (const x of s.sightings) out.push([x.appear - 2, x.appear + x.life + 1, x.at]);
  for (const c of s.crossings) out.push([c.from - 2, c.to + 2]);
  for (const outing of s.outings) {
    const meeting = outing.bundles.some((b) => b.kind === 'find' && (b.find.endsWith('-meeting') || ['miller', 'boatyard-moulds'].includes(b.find)));
    for (const leg of outing.legs) if (leg.kind === 'beat' && (leg.fork || meeting)) out.push([leg.start - 1, leg.end + 1]);
  }
  return out;
}

/** Things that could glint here today, not yet found. */
export function glintable(w: World, at: Vec): string[] {
  const s = w.state;
  const region = regionAt(at);
  return SMALL_FINDS.filter((f) => !s.smallFinds[f.id] && f.regions.includes(region) && holds(f.when, w.today, s) && fitsStory(f.line, s, region)).map((f) => f.id);
}

/**
 * Today's glint, if any: by a friend's path just ahead of them. On a narrow
 * view (see `SightingWatch`) by the friend it keeps to when it can be.
 */
export function scheduleGlints(w: World, watch?: SightingWatch | null): Glint[] {
  const s = w.state;
  if (s.moving || (!s.free && s.day < 2)) return [];
  const rng = mulberry32(hashString(`glints:${w.seed}:${w.today.day}`));
  if (rng() >= (s.free ? WANDER_GLINT_CHANCE : GLINT_CHANCE)) return [];
  const walkers = s.outings.filter((o) => o.legs.some(isWalk));
  if (!walkers.length) return [];
  const watched = watchedPerson(s, watch);
  const order = [...walkers].sort((a, b) => (a.person === watched ? -1 : b.person === watched ? 1 : 0) || (hashString(`${w.seed}:${w.today.day}:${a.person}`) - hashString(`${w.seed}:${w.today.day}:${b.person}`)));
  const taken = takenTimes(s);
  const marks = s.known.map((id) => placeDef(id).marker ?? placeDef(id).at);
  // Where everyone sets out from and comes home to.
  const homes = s.outings.flatMap((o) => {
    const walks = o.legs.filter(isWalk);
    return walks.length ? [walks[0]!.points![0]!, walks[walks.length - 1]!.points!.at(-1)!] : [];
  });
  const river = valleyRiver();
  for (const outing of order) {
    const fork = outing.legs.find((l) => l.fork)?.start ?? Infinity;
    const moments: Array<{ t: number; at: Vec }> = [];
    for (let t = 4; t <= Math.min(fork - AHEAD, DAY_SECONDS - GLINT_LIFE - 2); t += 0.5) {
      const spot = besideAt(outing, t + AHEAD, hashString(`${w.seed}:${w.today.day}:${outing.person}:${t}`), river);
      if (!spot || homes.some((home) => dist(spot, home) < AWAY_FROM_HOME)) continue;
      // Clear of the places' marks and names, where it would be lost.
      if (marks.some((m) => dist(m, spot) < CLEAR_OF_MARKS)) continue;
      if (taken.some(([from, to, at]) => t < to && t + GLINT_LIFE > from && (!at || dist(at, spot) < CLEAR_OF_CREATURES))) continue;
      moments.push({ t, at: spot });
    }
    // Something that can be here, at a moment in the middle of the day rather than its edges.
    const usable = moments.filter((m) => glintable(w, m.at).length);
    if (!usable.length) continue;
    const moment = usable[Math.floor(rng() * usable.length)]!;
    const things = glintable(w, moment.at);
    const find = things[Math.floor(rng() * things.length)]!;
    return [{ id: `glint-${s.day}`, find, at: moment.at, appear: moment.t, life: GLINT_LIFE, person: outing.person, found: false }];
  }
  return [];
}

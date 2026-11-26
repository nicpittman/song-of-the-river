/**
 * Sightings: three to five times a day a creature shows near where a friend is
 * passing, for a few seconds. Tapping it sketches it into the journal. Never required.
 *
 * Which creatures come depends on the reach, the season, the water, the
 * weather and what has been built or planted: a garden brings swallowtails,
 * a grown willow a kingfisher. Nothing announces it; the bird just arrives.
 */

import { dist, type Vec } from '../core/math';
import { hashString, mulberry32 } from '../core/rng';
import type { FindDef } from './catalogue';
import { DAY_SECONDS } from './calendar';
import { FINDS } from './content';
import { inLivedReach, valleyRiver } from './regions';
import { inWater, livesInWater } from './waterHabitat';
import type { AdventureState, Sighting } from './state';
import { holds, readyBuildings, type World } from './world';
import { riverSign } from './signs';

/** Seconds a creature stays in view. */
export const SIGHTING_LIFE = 12;
/** The very first creature, before anything has been sketched, waits a little longer. */
export const FIRST_SIGHTING_LIFE = 15;
/** A rare creature is a moment: catch it or it is gone. */
export const RARE_SIGHTING_LIFE = 9;
/** How near a friend's path a creature shows, so it is in view when it does. */
const NEAR_PATH = 320;
/** On a narrow screen, how near the watched friend a creature shows: well inside a phone's view of them. */
const WATCH_NEAR = 220;

/**
 * A hint from the screen, which the rules cannot see: a phone's view is narrow
 * and keeps to one friend, so creatures should show where that friend is, not
 * by a path at the other end of the reach. `person` is who the view keeps to;
 * null (or a friend with no outing today) means the first friend out.
 */
export interface SightingWatch { person: string | null }

/** The friend a narrow view keeps to today: the hinted one if they are out, else the first friend out. */
export function watchedPerson(state: AdventureState, watch: SightingWatch | null | undefined): string | null {
  if (!watch) return null;
  const out = state.outings.filter((o) => o.legs.some((l) => l.kind === 'walk'));
  return (out.find((o) => o.person === watch.person) ?? out[0])?.person ?? null;
}

/** Where a creature could show today in the reach the friends are in. */
function spotsFor(find: FindDef, state: AdventureState): Vec[] {
  const inReach = (p: Vec): boolean => inLivedReach(state, p);
  const spots = (find.sighting?.near ?? []).filter(inReach);
  const structure = find.when?.structure;
  if (structure) {
    for (const b of readyBuildings(state)) if (b.kind === structure && inReach(b)) spots.push({ x: b.x, y: b.y - 20 });
  }
  return spots;
}

interface Pass { at: Vec; t: number }

/** Where a point along a route is, `along` of the way by length. */
function along(pts: Vec[], lengths: number[], at: number): Vec {
  let i = 1;
  while (i < pts.length - 1 && lengths[i]! < at) i++;
  const span = lengths[i]! - lengths[i - 1]! || 1;
  const f = Math.max(0, Math.min(1, (at - lengths[i - 1]!) / span));
  const a = pts[i - 1]!, b = pts[i]!;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/**
 * Where each friend out today is, second by second, walking or stopped. A
 * phone's view stays with them, so even a friend at work has the eye.
 */
function whereabouts(state: AdventureState): Array<Pass & { person: string }> {
  const out: Array<Pass & { person: string }> = [];
  for (const outing of state.outings) for (const leg of outing.legs) {
    const pts = leg.kind === 'walk' && leg.points && leg.points.length > 1 ? leg.points : null;
    const lengths = [0];
    if (pts) for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1]! + dist(pts[i - 1]!, pts[i]!));
    for (let t = Math.ceil(leg.start); t < leg.end; t++) {
      const at = pts ? along(pts, lengths, (lengths.at(-1)! * (t - leg.start)) / (leg.end - leg.start || 1)) : leg.at;
      if (at) out.push({ person: outing.person, at, t });
    }
  }
  return out;
}

/** Where the friends will be walking through the day. */
function passesOf(state: AdventureState): Pass[] {
  const out: Pass[] = [];
  for (const outing of state.outings) for (const leg of outing.legs) {
    if (leg.kind === 'walk' && leg.points && leg.points.length > 1) {
      const pts = leg.points;
      const lengths = [0];
      for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1]! + dist(pts[i - 1]!, pts[i]!));
      const total = lengths.at(-1)!;
      const samples = Math.max(2, Math.ceil(total / 60));
      for (let k = 0; k <= samples; k++) {
        out.push({ at: along(pts, lengths, (total * k) / samples), t: leg.start + (leg.end - leg.start) * (k / samples) });
      }
    }
    // Not during a stop: that is a conversation or work, and the eye is already busy there.
  }
  return out;
}

/** True when a creature's season, water and weather all allow it today, and a rare moment's second condition too. */
export function inSeason(find: FindDef, w: World): boolean {
  return !!find.sighting && holds(find.when, w.today, w.state) && holds(find.sighting.moment, w.today, w.state);
}

/**
 * Today's creatures: which, where and when. `watch` is the screen's hint on a
 * narrow view (see `SightingWatch`); without it, as on a wide screen, any
 * friend's path will do. Either way the day is the same for the same hint.
 */
export function scheduleSightings(w: World, watch?: SightingWatch | null): Sighting[] {
  const s = w.state;
  let planned = planDay(w, watch);
  if (watchedPerson(s, watch)) {
    // A narrow view never sees fewer creatures than a wide one: where none could
    // come by the friend it keeps to (they spend the day in a long meeting, say),
    // the wide day's creatures fill in, and the edge of the view points to them.
    const wide = planDay(w, null);
    const clear = (t: number): boolean => planned.every((p) => Math.abs(p.appear - t) >= 6);
    for (const p of wide) {
      if (planned.length >= wide.length) break;
      if (!planned.some((q) => q.find.id === p.find.id) && clear(p.appear)) planned = [...planned, p];
    }
    // Still short (their moments clash): the wide day as it is, with the edge marks to find it by.
    planned = planned.length < wide.length ? wide : planned.sort((a, b) => a.appear - b.appear);
  }
  // Until the first sketch, the first creature that shows by someone lingers so it can be learned.
  const novice = !FINDS.some((f) => s.discoveries[f.id]?.by === 'sketch');
  const teacher = novice ? (planned.find((p) => p.near) ?? planned[0]) : undefined;
  return planned.map((p, i) => ({
    id: `s${w.today.day}-${i}`,
    find: p.find.id,
    at: p.at,
    appear: p.appear,
    life: p === teacher ? Math.min(FIRST_SIGHTING_LIFE, DAY_SECONDS - p.appear - 1) : p.life,
    sketched: false,
  }));
}

interface Planned { find: FindDef; life: number; near: boolean; appear: number; at: Vec }

/** Which creatures show today, where and when, before they are numbered. */
function planDay(w: World, watch: SightingWatch | null | undefined): Planned[] {
  const s = w.state;
  const rng = mulberry32(hashString(`sightings:${w.seed}:${w.today.day}`));
  const passes = passesOf(s);
  const busy = s.outings.flatMap(outing => {
    const meeting = outing.bundles.some(b => b.kind === 'find' && (b.find.endsWith('-meeting') || ['miller', 'boatyard-moulds'].includes(b.find)));
    return outing.legs.filter(leg => leg.kind === 'beat' && leg.at && (leg.fork || meeting));
  });
  const quiet = (at: Vec, t: number, life: number): boolean => !busy.some(leg =>
    dist(at, leg.at!) < 600 && t < leg.end + 1 && t + life > leg.start - 1);
  // On a narrow view: where each friend is through the day, the watched one first.
  const watched = watchedPerson(s, watch);
  const eye = watched ? whereabouts(s) : [];
  const watchedNear = (f: FindDef): boolean => spotsFor(f, s).some((spot) => eye.some((p) => p.person === watched && dist(spot, p.at) < WATCH_NEAR));
  // A creature that can show by someone's path is far likelier to be seen.
  const seen = (f: FindDef): boolean => !passes.length || spotsFor(f, s).some((spot) => passes.some((p) => dist(spot, p.at) < NEAR_PATH));
  // On a phone, one that can show by the watched friend is likelier still; one only by a path out of view, less.
  const likely = (f: FindDef): number => !watched ? (seen(f) ? 1 : 0.2) : watchedNear(f) ? 3 : seen(f) ? 0.2 : 0.1;
  // On the walk down, only by the road: the reach ahead is still in mist away from it.
  const eligible = FINDS.filter((f) => !s.discoveries[f.id] && inSeason(f, w) && (!f.after || s.discoveries[f.after]) && spotsFor(f, s).length > 0 && (!s.moving || seen(f)));
  if (eligible.length === 0) return [];
  const grown = readyBuildings(s).some((b) => b.region === s.region && (b.kind === 'garden' || b.kind === 'willow' || b.kind === 'fruit-tree' || b.kind === 'lily-bed'));
  // Enough that every day has something to catch: three to five.
  const count = Math.min(eligible.length, 3 + (rng() < 0.5 ? 1 : 0) + (grown ? 1 : 0), 5);

  // A creature tracked yesterday comes first; then new creatures are three times as likely as known ones.
  const pool = [...eligible];
  const chosen: FindDef[] = [];
  for (const id of s.tracked) {
    const index = pool.findIndex((f) => f.id === id);
    if (index >= 0 && chosen.length < count) chosen.push(pool.splice(index, 1)[0]!);
  }
  // The morning's river sign is always true: its creature is among today's.
  const sign = riverSign(w);
  const signed = sign ? pool.findIndex((f) => f.id === sign.find) : -1;
  if (signed >= 0 && chosen.length < count) chosen.push(pool.splice(signed, 1)[0]!);
  // Creatures already in the journal fill in, two at most a day: a small reach
  // that is all known gets quieter rather than showing the same faces daily.
  const KNOWN_A_DAY = 2;
  while (chosen.length < count && pool.length > 0) {
    const known = chosen.filter((f) => s.discoveries[f.id]).length;
    const weights = pool.map((f) => (s.discoveries[f.id] ? (known >= KNOWN_A_DAY ? 0 : 1) : 3) * (f.sighting?.moment ? 2 : f.rare ? 0.5 : 1) * likely(f));
    if (weights.every((x) => x === 0)) break;
    let roll = rng() * weights.reduce((a, b) => a + b, 0);
    let index = 0;
    while (roll > weights[index]! && index < pool.length - 1) roll -= weights[index++]!;
    chosen.push(pool.splice(index, 1)[0]!);
  }

  // Each creature shows where a friend is passing, as if they noticed it: that is
  // where the eye already is. Without a path near it, it keeps an even slot in the day.
  const novice = !FINDS.some((f) => s.discoveries[f.id]?.by === 'sketch');
  const used: number[] = [];
  const span = (DAY_SECONDS - 10) / chosen.length;
  const planned = chosen.map((find, i) => {
    const spots = spotsFor(find, s);
    const life = find.rare ? RARE_SIGHTING_LIFE : SIGHTING_LIFE;
    let best: { spot: Vec; t: number; d: number } | null = null;
    const taken = (t: number): boolean => used.some((u) => Math.abs(u - (t - 1)) < 6);
    // A narrow view first looks by the friend it keeps to, then by the others (who are often in it too).
    for (const spot of spots) for (const p of eye) {
      if (p.t < 3 || p.t > DAY_SECONDS - life - 3 || taken(p.t) || !quiet(spot, Math.max(3, p.t - 1), novice ? FIRST_SIGHTING_LIFE : life)) continue;
      // Nearer is better, and so is its own even share of the day, so they do not all come at once.
      const d = dist(spot, p.at) + (p.person === watched ? 0 : WATCH_NEAR * 4) + Math.abs(p.t - (4 + (i + 0.5) * span)) * 3;
      if (dist(spot, p.at) < WATCH_NEAR && (!best || d < best.d)) best = { spot, t: p.t, d };
    }
    if (!best) for (const spot of spots) for (const pass of passes) {
      if (pass.t < 3 || pass.t > DAY_SECONDS - life - 3 || taken(pass.t) || !quiet(spot, Math.max(3, pass.t - 1), novice ? FIRST_SIGHTING_LIFE : life)) continue;
      const d = dist(spot, pass.at);
      if (d < NEAR_PATH && (!best || d < best.d)) best = { spot, t: pass.t, d };
    }
    // A phone with nothing by the way takes the spot nearest the friend it keeps to.
    const nearWatched = (v: Vec): number => eye.reduce((m, p) => (p.person === watched ? Math.min(m, dist(v, p.at)) : m), Infinity);
    const spot = best?.spot ?? (watched ? spots.reduce((a, b) => (nearWatched(b) < nearWatched(a) ? b : a)) : spots[Math.floor(rng() * spots.length)]!);
    // Without a path near it, an even slot in the day, moved along until it is clear of the others.
    const slot = 4 + i * span + rng() * Math.max(1, span - life);
    const clear = (t: number): boolean => used.every((u) => Math.abs(u - t) >= 6);
    const free = [0, 1.5, -1.5, 3, -3, 4.5, -4.5, 6, -6, 9, -9, 12, -12].map((d) => slot + d).find((t) => t >= 3 && t <= DAY_SECONDS - life - 2 && clear(t) && quiet(spot, t, novice ? FIRST_SIGHTING_LIFE : life));
    // No clear moment left: this creature waits for another day rather than crowding the others.
    if (!best && (free === undefined || s.moving)) return null;
    const appear = best ? Math.max(3, best.t - 1) : free!;
    used.push(appear);
    const scattered = { x: Math.round(spot.x + (rng() - 0.5) * 50), y: Math.round(spot.y + (rng() - 0.5) * 40) };
    return { find, life, near: !!best, appear: Math.round(appear * 10) / 10, at: livesInWater(find.id) ? inWater(valleyRiver(), scattered) : scattered };
  }).filter((p): p is NonNullable<typeof p> => p !== null).sort((a, b) => a.appear - b.appear);
  return planned;
}

export function isShowing(sighting: Pick<Sighting, 'appear' | 'life'>, t: number): boolean {
  return t >= sighting.appear && t < sighting.appear + sighting.life;
}

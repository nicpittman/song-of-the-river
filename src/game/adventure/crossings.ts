/**
 * Paths crossing: when two friends out walking pass close by each other, they
 * stop for a moment and trade a few words, shown as a conversation card.
 *
 * Decided when the day begins, from the legs already laid, so it is the same
 * at any speed and survives a save. The stop never moves a leg: the moment is
 * made up within the walk it happens in and the stop beside it (the friend
 * gets to a stop a little later and works it a little quicker, or leaves it a
 * little sooner), so every leg starts and ends exactly as laid and nothing
 * about the day's results changes. Where there is not room to stand still,
 * they slow and talk as they walk.
 *
 * At most two a day, never in the same words twice within several days,
 * never while anyone is at a fork or a first meeting, and never while a
 * creature is showing.
 */

import { dist, type Vec } from '../core/math';
import { hashString, mulberry32, type Rng } from '../core/rng';
import { DAY_SECONDS } from './calendar';
import { placeDef } from './content';
import { EXCHANGES, type Exchange } from './crossingLines';
import { alongRoute, routeLength } from './navigation';
import { fitsStory } from './narrative';
import { nameOf } from './people';
import { regionAt } from './regions';
import { beatDue, keepHeard } from './threads';
import type { AdventureState, Crossing, Leg, Outing } from './state';
import { outingStop } from './trail';
import type { World } from './world';

/** Two walkers this close at the same moment have met; within `FAR` they may, if nearer never comes. */
export const NEAR = 60;
export const FAR = 90;
/** How far apart they were a little before, so two walking together are not taken for a meeting. */
const APART = 120;
/** Seconds looked back for `APART`. */
const BEFORE = 2.5;
/** Never by either one's home fire, where everyone sets out and comes back together. */
const AWAY_FROM_HOME = 220;
/** The quickest the clock round a stop may run to make up the moment. */
const MAX_HURRY = 1.5;
/**
 * How much of their walking pace the two keep while they talk: they stand
 * still where there is room to make the moment up, and otherwise slow and
 * talk as they go. Tried in this order.
 */
const PACES = [0, 0.35, 0.6] as const;
/** Where in the talk the moment they meet falls: at its start (they stop where they meet), its middle, or its end. */
const SHARES = [0, 0.25, 0.5, 0.75, 1] as const;
/** Seconds between two crossings on one day. */
const APART_SECONDS = 8;
/** Exchanges kept out of use: two a day at most, so several days' worth. Thread beats are kept for good (see `threads.ts`). */
export const HEARD_KEPT = 12;
/** How much likelier a thread's beat, in its turn, is than an ordinary exchange. */
const THREAD_WEIGHT = 12;
const STEP = 0.1;

const isWalk = (l: Leg): boolean => l.kind === 'walk' && !!l.points && l.points.length > 1;
const hasMeeting = (o: Outing): boolean => o.bundles.some((b) => b.kind === 'find' && (b.find.endsWith('-meeting') || ['miller', 'boatyard-moulds'].includes(b.find)));

/** The walk leg `outing` is on at `t`, and where along it, or null. */
function walking(outing: Outing, t: number): { leg: Leg; at: Vec } | null {
  const leg = outing.legs.find((l) => isWalk(l) && t >= l.start && t < l.end);
  if (!leg) return null;
  const length = routeLength(leg.points!);
  if (length < 1 || leg.end <= leg.start) return null;
  return { leg, at: alongRoute(leg.points!, (length * (t - leg.start)) / (leg.end - leg.start)) };
}

/** Where `outing` is at `t` by its legs, walking or at a stop, or null before and after. */
function whereAt(outing: Outing, t: number): Vec | null {
  const leg = outing.legs.find((l) => t >= l.start && t < l.end);
  if (!leg) return null;
  if (isWalk(leg)) return walking(outing, t)?.at ?? null;
  return leg.at ?? null;
}

/**
 * The stretch of a friend's day a crossing at `t` may borrow time from: the
 * walk it is in, and an ordinary stop just before or after it (never a fork
 * or a first meeting, whose timing is the story's).
 */
function spanOf(outing: Outing, t: number): [number, number] | null {
  const i = outing.legs.findIndex((l) => isWalk(l) && t >= l.start && t < l.end);
  if (i < 0) return null;
  const leg = outing.legs[i]!;
  const lends = (l: Leg | undefined): l is Leg => !!l && l.kind === 'beat' && !l.fork && !hasMeeting(outing) && l.end < DAY_SECONDS - 0.01 && l.end - l.start >= 2;
  const before = outing.legs[i - 1], after = outing.legs[i + 1];
  return [lends(before) && Math.abs(before.end - leg.start) < 0.01 ? before.start : leg.start, lends(after) && Math.abs(after.start - leg.end) < 0.01 ? after.end : leg.end];
}

/** A busy moment: forks and first meetings by anyone, and a creature showing (within sight of the spot, when it has one). */
type Busy = [number, number, Vec?];
/** A creature showing farther off than this is well out of the picture. */
const IN_SIGHT = 1100;

function busyTimes(s: AdventureState): Busy[] {
  const out: Busy[] = [];
  for (const outing of s.outings) {
    const meeting = hasMeeting(outing);
    for (const leg of outing.legs) if (leg.kind === 'beat' && (leg.fork || meeting)) out.push([leg.start - 1, leg.end + 1]);
  }
  for (const x of s.sightings) out.push([x.appear - 1, x.appear + x.life + 1, x.at]);
  return out;
}

/** How long the two talk: a breath longer for a third line. */
export const holdFor = (lines: number): number => (lines >= 3 ? 2.6 : 2);

interface Timing { from: number; to: number; held: [number, number]; spans: [[number, number], [number, number]] }

/**
 * When two friends meeting at `at` talk, and how their clocks bend round it:
 * the gentlest that fits both their days, or null.
 */
function timingFor(first: Outing, second: Outing, at: number, hold: number): Timing | null {
  const spans = [spanOf(first, at), spanOf(second, at)];
  if (!spans[0] || !spans[1]) return null;
  for (const pace of PACES) {
    let best: { timing: Timing; hurry: number } | null = null;
    for (const share of SHARES) {
      const from = at - share * hold, to = from + hold;
      const held: [number, number] = [at - share * pace * hold, at + (1 - share) * pace * hold];
      let hurry = 0;
      for (const [s0, s1] of spans as Array<[number, number]>) {
        if (from <= s0 + 0.2 || to >= s1 - 0.2) { hurry = Infinity; break; }
        hurry = Math.max(hurry, (held[0] - s0) / (from - s0), (s1 - held[1]) / (s1 - to));
      }
      if (hurry <= MAX_HURRY && (!best || hurry < best.hurry)) best = { timing: { from, to, held, spans: [spans[0], spans[1]] }, hurry };
    }
    if (best) return best.timing;
  }
  return null;
}

interface Candidate { first: Outing; second: Outing; at: number; /** They shared a road and are parting, rather than coming from apart. */ parting: boolean }

/**
 * The moment two outings' walks meet, if they do: where two coming from
 * apart first draw near, or where two sharing a road part for their
 * different places.
 */
function meetingOf(first: Outing, second: Outing, busy: readonly Busy[]): Candidate | null {
  const homeA = first.legs.find(isWalk)?.points?.[0];
  const homeB = second.legs.find(isWalk)?.points?.[0];
  const fork = (o: Outing): number => o.legs.find((l) => l.fork)?.start ?? Infinity;
  const until = Math.min(DAY_SECONDS - 3, fork(first), fork(second));
  // The longest talk, so a moment chosen here fits whatever is said.
  const hold = holdFor(3);
  const fits = (t: number): boolean => {
    const timing = timingFor(first, second, t, hold);
    if (!timing) return false;
    const here = walking(first, t)!.at;
    return !busy.some(([from, to, at]) => timing.to + 0.5 > from && timing.from - 0.5 < to && (!at || dist(at, here) < IN_SIGHT));
  };
  let parting: number | null = null;
  let nearest: { at: number; d: number } | null = null;
  for (let t = 1; t < until; t = Math.round((t + STEP) * 10) / 10) {
    const a = walking(first, t), b = walking(second, t);
    const d = a && b ? dist(a.at, b.at) : Infinity;
    if (d > NEAR && parting !== null) return { first, second, at: parting, parting: true };
    if (!a || !b) continue;
    if (d > FAR) {
      if (nearest) break;
      continue;
    }
    if ([homeA, homeB].some((home) => home && (dist(a.at, home) < AWAY_FROM_HOME || dist(b.at, home) < AWAY_FROM_HOME))) continue;
    // Where each was a little before: still at home if they had not yet set out.
    const pa = whereAt(first, Math.max(0, t - BEFORE)) ?? homeA, pb = whereAt(second, Math.max(0, t - BEFORE)) ?? homeB;
    const together = !!pa && !!pb && dist(pa, pb) < APART;
    // Two bound for the same place go on together: that is not a crossing of paths.
    if (outingStop(first, t).place === outingStop(second, t).place) continue;
    if (!fits(t)) continue;
    // Sharing a road: the last moment before their ways part.
    if (together && d <= NEAR) { parting = t; continue; }
    if (d <= NEAR) return { first, second, at: t, parting: false };
    if (!nearest || d < nearest.d) nearest = { at: t, d };
  }
  if (parting !== null) return { first, second, at: parting, parting: true };
  return nearest ? { first, second, at: nearest.at, parting: false } : null;
}

/** "out" before the friend's last stop is done, "home" after. */
function wayOf(outing: Outing, t: number): 'out' | 'home' {
  return outing.legs.some((l) => l.kind === 'beat' && l.start >= t && !(l.end >= DAY_SECONDS - 0.01)) ? 'out' : 'home';
}

interface Spoken { exchange: Exchange; a: string; b: string }

function matches(ex: Exchange, w: World, asker: Outing, teller: Outing, c: Candidate, point: Vec): boolean {
  const s = w.state;
  const at = c.at;
  if (ex.apart && c.parting) return false;
  if (ex.a && !ex.a.includes(asker.person)) return false;
  if (ex.b && !ex.b.includes(teller.person)) return false;
  if (ex.doing && !ex.doing.includes(outingStop(teller, at).activity)) return false;
  if (ex.way && ex.way !== wayOf(teller, at)) return false;
  if (ex.seasons && !ex.seasons.includes(w.today.season)) return false;
  if (ex.weather && !ex.weather.includes(w.today.weather)) return false;
  if (ex.regions && !ex.regions.includes(regionAt(point))) return false;
  if (ex.free !== undefined && ex.free !== s.free) return false;
  if (ex.needs && !ex.needs.every((id) => s.discoveries[id])) return false;
  // A thread's beat only in its turn, and only the short ones on the road.
  if (ex.thread && (ex.byFire || !beatDue(s, ex))) return false;
  return lineTexts(ex, outingStop(teller, at).place).every((line) => fitsStory(line, s, regionAt(point)));
}

/** The exchange's lines with its place filled in. */
function lineTexts(ex: Exchange, place: string): string[] {
  const name = placeDef(place).name;
  return ex.lines.map(([, text]) => text.replaceAll('{place}', name));
}

/** What two friends say on meeting, either way round; null when nothing fits or all of it was heard lately. */
function chooseWords(w: World, rng: Rng, c: Candidate, heard: readonly string[]): Spoken | null {
  const point = walking(c.first, c.at)?.at ?? { x: 0, y: 0 };
  const options: Array<Spoken & { weight: number }> = [];
  for (const [asker, teller] of [[c.first, c.second], [c.second, c.first]] as const) {
    for (const ex of EXCHANGES) {
      if (heard.includes(ex.id) || !matches(ex, w, asker, teller, c, point)) continue;
      // The more an exchange knows about these two and their day, the likelier it is.
      // A thread's beat in its turn is the likeliest of all: these two may not cross again for days.
      const weight = ex.thread ? THREAD_WEIGHT : 1 + (ex.a ? 2 : 0) + (ex.b ? 2 : 0) + (ex.doing ? 1.5 : 0) + (ex.way ? 0.5 : 0) + (ex.seasons || ex.weather || ex.regions ? 1 : 0);
      options.push({ exchange: ex, a: asker.person, b: teller.person, weight });
    }
  }
  if (!options.length) return null;
  let roll = rng() * options.reduce((n, o) => n + o.weight, 0);
  for (const o of options) if ((roll -= o.weight) <= 0) return o;
  return options[options.length - 1]!;
}

/**
 * Today's crossings, from the legs as the day begins. Sightings must be
 * scheduled first: a crossing keeps clear of them. Records what is said in
 * `heard`, so the same words are not heard again for a while (and a thread's
 * beat never again).
 */
export function scheduleCrossings(w: World): Crossing[] {
  const s = w.state;
  if (s.moving || s.phase === 'evening') return [];
  const busy = busyTimes(s);
  const out = s.outings.filter((o) => o.legs.some(isWalk));
  const found: Candidate[] = [];
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const c = meetingOf(out[i]!, out[j]!, busy);
    if (c) found.push(c);
  }
  found.sort((x, y) => x.at - y.at);
  const rng = mulberry32(hashString(`crossings:${w.seed}:${w.today.day}`));
  // Usually one, now and then a second.
  const most = rng() < 0.35 ? 2 : 1;
  const chosen: Crossing[] = [];
  const people = new Set<string>();
  for (const c of found) {
    if (chosen.length >= most) break;
    if (people.has(c.first.person) || people.has(c.second.person) || chosen.some((x) => Math.abs(x.at - c.at) < APART_SECONDS)) continue;
    const words = chooseWords(w, rng, c, [...s.heard, ...chosen.map((x) => x.exchange)]);
    if (!words) continue;
    const timing = timingFor(c.first, c.second, c.at, holdFor(words.exchange.lines.length));
    if (!timing) continue;
    const [first, second] = words.a === c.first.person ? timing.spans : [timing.spans[1], timing.spans[0]];
    const r = (x: number): number => Math.round(x * 1000) / 1000;
    chosen.push({ id: `c${chosen.length}`, a: words.a, b: words.b, at: c.at, from: r(timing.from), to: r(timing.to), held: [r(timing.held[0]), r(timing.held[1])], spans: [[r(first[0]), r(first[1])], [r(second[0]), r(second[1])]], exchange: words.exchange.id });
    people.add(c.first.person).add(c.second.person);
  }
  s.heard = keepHeard([...s.heard, ...chosen.map((c) => c.exchange)], HEARD_KEPT);
  return chosen;
}

/**
 * A friend's clock with today's crossings in it: the clock to read their
 * legs by. Held (or slowed) while they talk, a little quicker either side of
 * it, and unchanged outside the stretch it borrows from. `talking` is the
 * crossing they are in, if any.
 */
export function crossingClock(s: AdventureState, person: string, t: number): { t: number; talking: Crossing | null } {
  for (const c of s.crossings) {
    if (c.a !== person && c.b !== person) continue;
    const [s0, s1] = c.spans[c.a === person ? 0 : 1];
    if (t < s0 || t >= s1) continue;
    const between = (t0: number, t1: number, v0: number, v1: number): number => v0 + ((t - t0) * (v1 - v0)) / Math.max(1e-6, t1 - t0);
    if (t < c.from) return { t: between(s0, c.from, s0, c.held[0]), talking: null };
    if (t < c.to) return { t: between(c.from, c.to, c.held[0], c.held[1]), talking: c };
    return { t: between(c.to, s1, c.held[1], s1), talking: null };
  }
  return { t, talking: null };
}

/** Where a friend stands for a crossing: where their walk had them at its moment. */
export function crossingSpot(s: AdventureState, c: Crossing, person: string): Vec | null {
  const outing = s.outings.find((o) => o.person === person);
  return outing ? walking(outing, c.at)?.at ?? null : null;
}

export interface CrossingLine { speaker: string; text: string; start: number; end: number }

/**
 * What is said, and when, in day seconds. Each line has room in proportion
 * to its length, and `rate` is the reading pace that lets it be read (as a
 * first meeting's does).
 */
export function crossingWords(s: AdventureState, c: Crossing): { lines: CrossingLine[]; rate: number } | null {
  const ex = EXCHANGES.find((e) => e.id === c.exchange);
  const teller = s.outings.find((o) => o.person === c.b);
  if (!ex || !teller) return null;
  const texts = lineTexts(ex, outingStop(teller, c.at).place);
  const seconds = texts.map((text) => Math.max(1.6, Math.min(4.8, 0.8 + text.trim().split(/\s+/).length * 0.19 + (text.match(/[,.?!…]/g) ?? []).length * 0.09)) + 0.16);
  const total = seconds.reduce((n, x) => n + x, 0);
  const span = c.to - c.from;
  let start = c.from;
  const lines = texts.map((text, i) => {
    const end = start + (span * seconds[i]!) / total;
    const line = { speaker: ex.lines[i]![0] === 'a' ? c.a : c.b, text, start, end };
    start = end;
    return line;
  });
  return { lines, rate: Math.min(0.85, span / total) };
}

/** The conversation card's id: one card for the whole exchange, as a first meeting's is. */
export const crossingTagId = (c: Crossing, line: number): string => `meeting-${c.a}-with${c.b}${c.id}-${line}`;

/** "Sora: “Any luck?”" */
export const spokenBy = (speaker: string, text: string): string => `${nameOf(speaker)}: ${text}`;

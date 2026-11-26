import { NEARLY_FILLED, reachFilled } from './aims';
import { catchWords, fitsStory, timberWords, wayWords } from './narrative';
import { leadSettled } from './leads';
/**
 * An outing as a trail of legs: walk out, one to three beats at the place
 * (the last one at the farther spot on a long day), walk home. Each beat is
 * something visible with a small paper tag. Everyone is home before dusk: a
 * long walk simply means a shorter stay.
 *
 * What comes home is decided when the last beats are laid (at the start of
 * the day, or when a fork is answered) from the seed, the day and the friend,
 * so the result never depends on how fast the day is watched.
 */

import { clamp, type Vec } from '../core/math';
import { hashString, mulberry32, type Rng } from '../core/rng';
import type { FindDef, PlaceDef } from './catalogue';
import { FINDS, LEADS, placeDef } from './content';
import { EMPTY_TAGS, FORK_FOR_HABITAT, FORKS, GENERIC_BEATS, forksThatFit, type ForkDef, SUPPLY_TAGS, TURNED_BACK, WAY_TAGS } from './lines';
import type { Activity, OutingPlan, PackHint, Pose } from './model';
import { HOME_BY, PROBABILITY, assess, chanceOf, routeSeconds, type Assessment } from './odds';
import { seat } from './campSeats';
import { campOf } from './regions';
import { outingPace, personDef } from './people';
import { routeLength } from './navigation';
import type { Bundle, ForkEffect, Leg, Outing } from './state';
import { holds, lodgingById, overnightAt, setOutFrom, type World } from './world';
import { detourJourney, journeyFor, type Journey } from './travel';
import { DAY_SECONDS } from './calendar';
import { deducedFind, workedOut } from './deductions';

/** How often a find meant to be worked out is even in the running without its clue. */
const STUMBLE = 0.3;

/** The slowest a short walk is shown, in world units a second, and the longest that makes it. */
const STROLL_PACE = 75, STROLL_MIN = 4;
/** Seconds a friend waits at a fork for an answer. */
export const FORK_WAIT = 11;
/** A beat is never shorter or longer than this. */
const BEAT_MIN = 4;
const BEAT_MAX = 9;
/** How many recent beat lines are kept out of use. */
const RECENT_LINES = 60;

/** Finds a walking route; falls back to a straight line if the walking map has none. */
export type Router = (from: Vec, to: Vec) => Vec[];

const POSE: Record<Activity, Pose> = { explore: 'look', fish: 'fish', forage: 'forage', investigate: 'forage', visit: 'talk', track: 'track' };

const rngFor = (w: World, person: string, purpose: string): Rng => mulberry32(hashString(`${w.seed}:${w.today.day}:${person}:${purpose}`));

/**
 * Lays out a friend's whole day at the moment it begins. Walks go at one
 * steady pace along their real routes; the beats share whatever daylight is
 * left, so a long walk means a shorter stay and everyone is home by dusk.
 */
export function departOuting(w: World, plan: OutingPlan, withFork: boolean, route: Router, origin?: Vec): Outing {
  if (plan.second) return departTwoStops(w, plan, route, origin);
  const place = placeDef(plan.place);
  if (place.kind === 'settlement' && !plan.visitOnly) {
    const start = origin ?? setOutFrom(w.state, place, plan.person);
    const lodging = lodgingById(w.state, plan.lodging);
    const points = route(start, seat(lodging?.fire ?? campOf(place.region).fire, w.state.people.findIndex((p) => p.id === plan.person)));
    const bundles: Bundle[] = [];
    if (place.id === 'seseragi' && plan.lodging === undefined) {
      const already = (id: string) => !!w.state.discoveries[id] || w.state.outings.some((o) => o.bundles.some((b) => b.kind === 'find' && b.find === id));
      if (!already('seseragi-welcome')) bundles.push({ kind: 'find', find: 'seseragi-welcome' });
      if (!w.state.people.some((p) => p.id === 'mina') && !already('mina-meeting')) {
        bundles.push({ kind: 'find', find: 'mina-meeting' });
      }
    }
    // Seseragi's mark sits behind the big timber house: the welcome is given out on the path, in view.
    const greetAt = place.id === 'seseragi' ? { x: place.at.x + 36, y: place.at.y - 28 } : place.at;
    const approach = bundles.length ? route(start, greetAt) : points;
    const arrival = Math.min(35, Math.max(4, routeLength(approach) / outingPace(plan)));
    const legs: Leg[] = [walk(approach, 0, arrival)];
    if (bundles.length) {
      const settling = route(greetAt, points[points.length - 1]!);
      const homeAt = Math.min(39, Math.max(HOME_BY, arrival + 1 + routeLength(settling) / outingPace(plan)));
      const talkUntil = homeAt - Math.max(1, routeLength(settling) / outingPace(plan));
      legs.push({ kind: 'beat', start: arrival, end: talkUntil, at: greetAt, pose: 'talk', text: 'A welcome by the village fire.', sketch: null });
      legs.push(walk(settling, talkUntil, homeAt));
    }
    return { ...plan, score: 0, certain: true, farther: false, legs, bundles, pack: packOf(bundles), fork: null };
  }
  const a = assess(w, plan);
  const home = seat(overnightAt(w.state, plan.overnight)?.fire ?? setOutFrom(w.state, place, plan.person), w.state.people.findIndex((p) => p.id === plan.person));
  const rng = rngFor(w, plan.person, 'trail');
  const outing: Outing = {
    ...plan, score: a.score, certain: a.certain, farther: false, legs: [], bundles: [], pack: null, fork: null,
  };
  const legs = outing.legs;
  const goesFarther = a.farther && !!place.farther;
  const journey = journeyFor({ ...w, route }, plan, origin);
  const { out, on, back, outward: outSeconds, onward: onSeconds, homeward: backSeconds } = journey;
  const followAt = place.farther?.at ?? { x: place.at.x + 60, y: place.at.y + 30 };
  const followWalk = routeSeconds(route(place.at, followAt), outingPace(plan)) + routeSeconds(route(followAt, home), outingPace(plan));
  const extraWalk = Math.max(0, followWalk - backSeconds);
  const fork = withFork && a.beats === 2 && !a.sure && !a.farther && journey.field >= FORK_WAIT + BEAT_MIN * 2 + extraWalk;

  const spare = journey.field - (fork ? FORK_WAIT + extraWalk : 0);
  // Surveys use real time on the ground. A distant walk shortens the visit,
  // never the walking animation or the journey home.
  const beatSeconds = Math.max(0, Math.min(spare / a.beats, Math.max(BEAT_MAX, (a.sure?.survey ?? 0) / a.beats)));
  // A short walk is still walked, not jumped: when the day has daylight to spare, it is shown at a stroll.
  const stroll = (seconds: number, points: Vec[]): number => Math.max(seconds, Math.min(STROLL_MIN, routeLength(points) / STROLL_PACE));
  const shownOut = stroll(outSeconds, out), shownBack = stroll(backSeconds, back);
  const slow = spare - beatSeconds * a.beats >= shownOut - outSeconds + shownBack - backSeconds;
  const outShown = slow ? shownOut : outSeconds, backShown = slow ? shownBack : backSeconds;
  legs.push(walk(out, 0, outShown));
  let t = outShown;

  if (fork) {
    legs.push(beat(w, plan, place, place.at, t, t + beatSeconds, rng));
    t += beatSeconds;
    const def = forkFor(w, plan, place.habitat);
    legs.push({ kind: 'beat', start: t, end: t + FORK_WAIT, at: place.at, pose: 'look', text: def.text, sketch: null, fork: true });
    outing.fork = { text: def.text, choices: [...def.choices], answer: null };
    return outing;
  }

  for (let i = 0; i < a.beats; i++) {
    const last = i === a.beats - 1;
    let at = place.at;
    if (last && goesFarther) {
      legs.push(walk(on, t, t + onSeconds));
      t += onSeconds;
      at = place.farther!.at;
      outing.farther = true;
    }
    legs.push(beat(w, plan, place, at, t, t + beatSeconds, rng, last && outing.farther));
    t += beatSeconds;
  }
  finish(w, outing, place, a, null);
  legs.push(walk(back, t, t + backShown));
  return outing;
}

/** Two shorter visits share one real walking/daylight budget; no extra fork or farther detour. */
function departTwoStops(w: World, plan: OutingPlan, route: Router, origin?: Vec): Outing {
  const journey = journeyFor({ ...w, route }, plan, origin), field = Math.min(journey.field / 2, BEAT_MAX * 2);
  let t = journey.outward;
  const main: Outing = { ...plan, score: 0, certain: false, farther: false, legs: [walk(journey.out, 0, t)], bundles: [], pack: null, fork: null };
  const first = shortVisit(w, plan, t, field);
  t += field;
  main.legs.push(...first.legs, walk(journey.on, t, t + journey.onward)); t += journey.onward;
  const second = shortVisit({ ...w, state: { ...w.state, outings: [...w.state.outings, first] } }, { ...plan, ...plan.second!, second: undefined }, t, field);
  t += field;
  main.legs.push(...second.legs, walk(journey.back, t, t + journey.homeward));
  main.bundles = [...first.bundles, ...second.bundles]; main.pack = packOf(main.bundles); main.score = first.score; main.certain = first.certain;
  return main;
}

/**
 * A moving day with a stop on the way: the walk to the stop, a shorter visit
 * there, then on to the friend's seat at the new camp's fire before dusk.
 * `w.route` must reach the new reach. The move itself (place, lodging) is kept.
 */
export function departDetour(w: World, move: Outing, from: Vec, to: Vec): Outing {
  const stop = move.detour!;
  const journey = detourJourney(w, move.person, stop, from, to);
  const field = detourField(journey);
  const visit = shortVisit(w, { person: move.person, place: stop.place, activity: stop.activity, item: null, companion: null }, journey.outward, field);
  const arrive = journey.outward + field + journey.homeward;
  return { ...move, score: visit.score, certain: visit.certain, bundles: visit.bundles, pack: visit.pack,
    legs: [walk(journey.out, 0, journey.outward), ...visit.legs, walk(journey.back, journey.outward + field, arrive), { kind: 'beat', start: arrive, end: Math.max(arrive, DAY_SECONDS), at: to, pose: 'look' }] };
}

/** Time at a stop on the way down: as long as an ordinary visit at most. */
export const detourField = (journey: Journey): number => Math.min(journey.field, BEAT_MAX * 2);

/** A shorter visit of two beats sharing `field` seconds from `start`; its bundles say where they came from. */
function shortVisit(w: World, proposal: OutingPlan, start: number, field: number): Outing {
  const place = placeDef(proposal.place), assessment = assess(w, { ...proposal, second: undefined }, field);
  const outing: Outing = { ...proposal, second: undefined, score: assessment.score, certain: assessment.certain, farther: false, legs: [], bundles: [], pack: null, fork: null };
  const rng = rngFor(w, proposal.person, `stop:${place.id}`);
  for (let i = 0, t = start; i < 2; i++, t += field / 2) outing.legs.push(beat(w, proposal, place, place.at, t, t + field / 2, rng));
  finish(w, outing, place, assessment, null);
  outing.bundles = outing.bundles.map((bundle) => ({ ...bundle, sourcePlace: place.id, sourceActivity: proposal.activity }));
  return outing;
}

/**
 * The friend at a fork has an answer: lay the rest of their day from `now`.
 * `choice` indexes the fork's choices: follow on, stay, turn back.
 */
export function continueAfterFork(w: World, outing: Outing, choice: number, now: number, route: Router): void {
  const fork = outing.fork;
  const forkLeg = outing.legs.find((l) => l.fork);
  if (!fork || fork.answer !== null || !forkLeg) return;
  fork.answer = choice;
  forkLeg.end = Math.max(forkLeg.start, Math.min(forkLeg.end, now));
  let effect: ForkEffect = choice === 0 ? 'follow' : choice === 1 ? 'stay' : 'back';
  const place = placeDef(outing.place);
  const home = seat(overnightAt(w.state, outing.overnight)?.fire ?? setOutFrom(w.state, place, outing.person), w.state.people.findIndex((p) => p.id === outing.person));
  const rng = rngFor(w, outing.person, `fork:${effect}`);
  const a = assess(w, outing);
  let t = forkLeg.end;

  if (effect === 'back') {
    finish(w, outing, place, a, effect);
    const back = route(place.at, home);
    const leg = walk(back, t, t + routeSeconds(back, outingPace(outing)));
    leg.reveal = true;
    leg.text = TURNED_BACK;
    outing.legs.push(leg);
    return;
  }

  let at = place.at;
  const followAt = place.farther?.at ?? { x: place.at.x + 60, y: place.at.y + 30 };
  if (effect === 'follow' && (w.route && (!w.route(at, followAt) || !w.route(followAt, home)) ||
    t + routeSeconds(route(at, followAt), outingPace(outing)) + routeSeconds(route(followAt, home), outingPace(outing)) + 2 > HOME_BY)) effect = 'stay';
  if (effect === 'follow') {
    at = followAt;
    const on = route(place.at, at);
    const onSeconds = routeSeconds(on, outingPace(outing));
    outing.legs.push(walk(on, t, t + onSeconds));
    t += onSeconds;
    outing.farther = !!place.farther;
  }
  const back = route(at, home);
  const backSeconds = routeSeconds(back, outingPace(outing));
  const seconds = Math.max(0, Math.min(HOME_BY - t - backSeconds, BEAT_MAX));
  outing.legs.push(beat(w, outing, place, at, t, t + seconds, rng, effect === 'follow' && !!place.farther));
  t += seconds;
  finish(w, outing, place, a, effect);
  outing.legs.push(walk(back, t, t + backSeconds));
}

/** The current destination, including the walk between two planned stops. */
export function outingStop(outing: Outing, time: number): Pick<OutingPlan, 'place' | 'activity'> {
  if (outing.detour) {
    const at = placeDef(outing.detour.place).at;
    const there = [...outing.legs].reverse().find((leg) => leg.kind === 'beat' && leg.at?.x === at.x && leg.at?.y === at.y);
    return there && time < there.end ? outing.detour : outing;
  }
  if (!outing.second) return outing;
  const at = placeDef(outing.second.place).at;
  const secondBeat = outing.legs.findIndex((leg) => leg.kind === 'beat' && leg.at?.x === at.x && leg.at?.y === at.y);
  if (secondBeat < 0) return outing;
  const before = outing.legs[secondBeat - 1];
  const starts = before?.kind === 'walk' ? before.start : outing.legs[secondBeat]!.start;
  return time >= starts ? outing.second : outing;
}

/** A fork that fits the place, the weather and the season, and has not come up lately. */
export function forkFor(w: World, plan: Pick<OutingPlan, 'person' | 'activity'>, habitat: string): ForkDef {
  const pool = forksThatFit(forkKind(plan.activity, habitat), habitat, w.today.weather, w.today.season);
  const texts = pool.map((f) => f.text);
  const text = freshLine(w, texts, rngFor(w, plan.person, 'fork'));
  return pool[texts.indexOf(text)]!;
}

/** Fishing forks are about the water and visiting forks about people; the rest follow the place. */
function forkKind(activity: Activity, habitat: string): keyof typeof FORKS {
  if (activity === 'fish') return 'water';
  if (activity === 'visit') return 'people';
  if (activity === 'forage') return habitat === 'beach' ? 'shore' : 'gather';
  if (activity === 'investigate') return 'inspect';
  if (activity === 'track') return 'tracks';
  return FORK_FOR_HABITAT[habitat] ?? 'open';
}

/** What a friend does at a fork nobody answered: follow on, or stay and see. */
export function natureChoice(person: string): number {
  return personDef(person).nature === 'follow' ? 0 : 1;
}

/** Decides the bundles and marks the last beat as the one that shows the pack. */
function finish(w: World, outing: Outing, place: PlaceDef, a: Assessment, effect: ForkEffect | null): void {
  outing.bundles = decideBundles(w, outing, place, a, effect);
  outing.pack = packOf(outing.bundles);
  // Finding the way somewhere new is news by the fire, so the knot says so too.
  if (outing.pack === 'plain' && a.geography && outing.activity === 'explore') outing.pack = 'unusual';
  const lastBeat = [...outing.legs].reverse().find((l) => l.kind === 'beat' && !l.fork);
  if (effect !== 'back' && lastBeat) {
    lastBeat.reveal = true;
    lastBeat.text = revealLine(w, outing.bundles, outing.activity, outing.person, place.habitat, a.geography, place.region);
    lastBeat.sketch = null;
  }
}

/** The outcome of the main beat: provisions (give or take one), perhaps a find, perhaps a lead. */
export function decideBundles(w: World, outing: Outing, place: PlaceDef, a: Assessment, effect: ForkEffect | null): Bundle[] {
  const rng = rngFor(w, outing.person, `outcome:${effect ?? 'plain'}`);
  const bundles: Bundle[] = [];

  const luck = rng();
  // A useful primary return is reliable. Poor and exceptional days vary it by one;
  // a non-productive activity never conjures food from a lucky roll.
  const variance = luck < 0.12 ? -1 : luck > 0.86 ? 1 : 0;
  for (const [kind, expected] of [['supplies', a.provisions], ['materials', a.materials]] as const) {
    if (expected <= 0) continue;
    const amount = clamp(expected + variance, 1, 4);
    bundles.push({ kind, amount });
  }

  if (effect !== 'back') {
    // A find meant to be worked out is hard to stumble on without the clue.
    const stumble = rngFor(w, outing.person, 'stumble')() < STUMBLE;
    const hunch = { ...a, candidates: a.candidates.filter((f) => !f.knowing || stumble || workedOut(f, w.state)) };
    const find = a.sure ?? luckyFind(rng, hunch, outing.farther, effect, w.state.free && reachFilled(w.state, place.region) >= NEARLY_FILLED);
    if (find) {
      bundles.push({ kind: 'find', find: find.id });
    }
    // Something noticed before, acted on today: no luck in it.
    const deduced = deducedFind(w.state, a.candidates.filter((f) => outing.farther || !f.farther), outing.person, find ? [find.id] : []);
    if (deduced) bundles.push({ kind: 'find', find: deduced.id });
  }

  if (place.id === 'seseragi' && !w.state.discoveries['seseragi-welcome'] && !bundles.some((b) => b.kind === 'find' && b.find === 'seseragi-welcome')
    && !w.state.outings.some((o) => o.bundles.some((b) => b.kind === 'find' && b.find === 'seseragi-welcome'))) bundles.push({ kind: 'find', find: 'seseragi-welcome' });
  const lead = leadNoticed(w, place, outing);
  if (lead) bundles.push({ kind: 'lead', lead });
  if (bundles.length === 0) bundles.push({ kind: 'nothing' });
  return bundles;
}

/** `lastPages`: Wander, in a reach nearly filled, where the rare ones left come home a little more readily. */
function luckyFind(rng: Rng, a: Assessment, farther: boolean, effect: ForkEffect | null, lastPages = false): FindDef | null {
  const pool = a.candidates.filter((f) => !f.story && (farther || !f.farther));
  if (pool.length === 0) return null;
  const bonus = effect === 'follow' ? 2 : effect === 'stay' ? 1 : 0;
  if (rng() >= PROBABILITY[chanceOf(a.score + bonus)]) return null;
  const rares = pool.filter((f) => f.rare);
  // Staying quietly favours creatures; everything else is as it comes.
  const commons = pool.filter((f) => !f.rare && (effect !== 'stay' || f.sighting || pool.every((p) => !p.sighting || p.rare)));
  const rareChance = Math.min(0.85, 0.25 + 0.05 * Math.max(0, a.score + bonus - 2) + (lastPages ? 0.3 : 0));
  if (rares.length > 0 && (commons.length === 0 || rng() < rareChance)) return rares[Math.floor(rng() * rares.length)]!;
  if (commons.length === 0) return null;
  return commons[Math.floor(rng() * commons.length)]!;
}

/** The first lead this place offers today that nobody has brought home yet. */
function leadNoticed(w: World, place: PlaceDef, outing: Outing): string | null {
  const s = w.state;
  // Every lead points within its own reach: one noticed on the way down could never be followed.
  if (s.moving) return null;
  const taken = new Set([...s.given, ...s.outings.flatMap((o) => (o === outing ? [] : o.bundles.flatMap((b) => (b.kind === 'lead' ? [b.lead] : []))))]);
  const def = LEADS.find((l) => l.from.includes(place.id) && (!l.after || !!s.discoveries[l.after]) && !taken.has(l.id) && !leadSettled(s, l.find) && holds(l.when, w.today, s));
  return def?.id ?? null;
}

export function packOf(bundles: readonly Bundle[]): PackHint {
  if (bundles.some((b) => b.kind === 'find' && FINDS.find((f) => f.id === b.find)?.rare)) return 'rare';
  if (bundles.some((b) => b.kind === 'find' || b.kind === 'lead')) return 'unusual';
  return 'plain';
}

/** The tag on the beat that shows the pack: says what happened, never what it is. */
function revealLine(w: World, bundles: readonly Bundle[], activity: Activity, person: string, habitat = '', wayFound = false, placeRegion = w.state.region): string {
  const finds = bundles.flatMap((b) => (b.kind === 'find' ? [FINDS.find((f) => f.id === b.find)!] : []));
  const best = finds.find((f) => f.rare) ?? finds[0];
  if (best) return best.tag;
  if (bundles.some((b) => b.kind === 'lead')) return 'Something worth coming back for.';
  // The way to somewhere new is the day's real result, even with an empty pack.
  const roll = hashString(`${w.seed}:${w.today.day}:${person}:way`);
  // Free Play is quieter: a friend speaks up on about one day in three, and the rest is the valley.
  const quiet = w.state.free && hashString(`${w.seed}:${w.today.day}:${person}:voice`) % 3 !== 0;
  const region = w.state.free ? placeRegion : w.state.region;
  // Farther down the river, about half these say it in the friend's own words.
  // Words that name a friend not yet met, or a boat nobody has planned, wait for their time.
  const fitting = (lines: readonly string[] | null): readonly string[] | null => {
    const kept = lines?.filter((line) => fitsStory(line, w.state, placeRegion)) ?? [];
    return kept.length ? kept : null;
  };
  const voiced = quiet ? null : fitting(wayWords(person, region));
  if (wayFound) return voiced && (roll >>> 4) % 2 === 0 ? freshLine(w, voiced, rngFor(w, person, 'words')) : WAY_TAGS[roll % WAY_TAGS.length]!;
  if (!quiet && bundles.some((b) => b.kind === 'supplies')) {
    const words = catchWords(person, activity, region, habitat, w.today.day);
    if (words && fitsStory(words, w.state, placeRegion)) return words;
  } else if (!quiet && bundles.some((b) => b.kind === 'materials')) {
    const words = fitting(timberWords(person, region));
    if (words) return freshLine(w, words, rngFor(w, person, 'words'));
  }
  const pool = bundles.some((b) => b.kind === 'supplies' || b.kind === 'materials') ? SUPPLY_TAGS[activity] : EMPTY_TAGS[activity];
  return pool[hashString(`${w.seed}:${w.today.day}:${person}:tag`) % pool.length]!;
}

function walk(points: Vec[], start: number, end: number): Leg {
  return { kind: 'walk', start, end, points, pose: 'walk' };
}

function beat(w: World, plan: OutingPlan, place: PlaceDef, at: Vec, start: number, end: number, rng: Rng, farther = false): Leg {
  const pool = farther && place.farther ? place.farther.lines : place.lines[plan.activity] ?? GENERIC_BEATS[plan.activity];
  return { kind: 'beat', start, end, at, pose: POSE[plan.activity], text: freshLine(w, pool, rng), sketch: null };
}

/** A line from the pool that has not been seen lately; falls back to the generic pool. */
function freshLine(w: World, pool: readonly string[], rng: Rng): string {
  const recent = w.state.recent;
  const unused = pool.filter((line) => !recent.includes(line));
  const choices = unused.length > 0 ? unused : pool;
  const line = choices[Math.floor(rng() * choices.length)]!;
  recent.push(line);
  if (recent.length > RECENT_LINES) recent.splice(0, recent.length - RECENT_LINES);
  return line;
}

/** The friend's knot shows once the revealing leg has begun. */
export function packShown(outing: Outing, t: number): PackHint | null {
  const reveal = outing.legs.find((l) => l.reveal);
  return reveal && t >= reveal.start ? outing.pack : null;
}

/** When the trail ends: the friend is home. */
export function trailEnd(outing: Outing): number {
  return outing.legs.length ? outing.legs[outing.legs.length - 1]!.end : 0;
}

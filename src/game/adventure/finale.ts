/**
 * The last voyage, as a timeline everything else reads: the rules (when it
 * ends), the scene (where the boat is, the light), the camera (where it
 * glides), and the captions. Pure functions of the saved state and the
 * voyage clock, so it can be watched, skipped or reloaded at any moment.
 *
 *   Gathering  the chosen friends walk to the boat and step aboard; everyone
 *              else and the villagers come down to the landing; a held moment
 *              at first light.
 *   Sailing    the view stays with the restored boat as she slips out past
 *              the bar. The closing journal remembers the journey afterwards.
 *
 * In Wander the boat is a day out, not an ending: a short sail from the
 * landing out past the bar, a word or two from Haru, and home again.
 */

import { aboardLine } from './wishes';
import { threadAboard } from './threads';
import { clamp, dist, smoothstep, type Vec } from '../core/math';
import { VOYAGE_SECONDS } from './calendar';
import { FINDS } from './content';
import { personDef } from './people';
import { campOf, valleyRiver } from './regions';
import { underBuilding } from './settlement';
import { adventureValley } from '../world/boards/adventure';
import type { AdventureState } from './state';

/** How long the sailing lasts: the whole river for the Journey, a short outing in Wander. */
export function sailSeconds(state: AdventureState): number {
  return state.free ? WANDER_SAIL : VOYAGE_SECONDS;
}

/** Where the boat crosses the bar and the sea opens out, in seconds of sailing. */
export function barSeconds(state: AdventureState): number {
  return state.free ? WANDER_BAR : AT_THE_BAR;
}

/** The held moment at first light, after the last friend is aboard. */
export const GATHER_HOLD = 2;
/** How long a friend's word on stepping aboard stays on screen: long enough to read, no longer. */
export function aboardReading(line: string): number {
  return clamp(1.6 + line.length / 20, 4, 6);
}
/** At most this many friends speak as they step aboard, so the landing never drags. */
const ABOARD_SPEAKERS = 4;
/** Where the boat crosses the bar and the open sea is first in view, in seconds of sailing. */
export const AT_THE_BAR = 27.5;
/** Sora at the bar, seeing the sea for the first time: the dream, and the hut it began in. */
export const SORA_AT_SEA = 'Sora: “The snowmelt ran past our door at Yamagoya. This is where it was going.”';
/** A Wander sail, in seconds: out past the bar and back is a short outing. */
export const WANDER_SAIL = 24;
/** Where a Wander sail crosses the bar. */
const WANDER_BAR = 14;
/** Walking pace down to the boat. */
const BOARDING_PACE = 150;

/** When each part of the voyage is on screen, in seconds of sailing. */
const WINDOWS = [
  { name: 'Seseragi', from: 5.5, to: 11 },
  { name: 'Mio', from: 11, to: 16.5 },
  { name: 'Kawagiri', from: 16.5, to: 22 },
  { name: 'The sea', from: 22, to: VOYAGE_SECONDS },
] as const;

/** Where the boat heads past the river mouth. */
const MOUTH: Vec = { x: 1010, y: 5930 };
const OPEN_SEA: Vec = { x: 1100, y: 6420 };

export interface Stop {
  at: Vec;
  t: number;
  zoom: number;
  /** The view cuts here (behind a short fade) rather than flying from the stop before. */
  cut?: boolean;
}

/** When the view cuts from the cast-off at the landing to the springs, to follow the river down. */
export const VOYAGE_CUT = 4.6;
/** Seconds either side of the cut that the paper fade covers. */
const CUT_FADE = 0.55;

/** How far the cut's fade has covered the view (0..1). */
export function voyageCutCover(t: number): number {
  const d = Math.abs(t - VOYAGE_CUT);
  return d >= CUT_FADE ? 0 : 1 - d / CUT_FADE;
}

/** Seconds a friend takes to walk from the hearth to the boat. */
export function boardingSeconds(from: Vec, boat: Vec): number {
  return clamp(dist(from, boat) / BOARDING_PACE, 1.5, 5);
}

/** How long the gathering lasts: the longest walk, a moment to step aboard, everyone's word, then the held light. */
export function gatheringSeconds(state: AdventureState): number {
  const words = aboardWords(state);
  const last = words[words.length - 1];
  const lastWord = last ? last.at + aboardReading(last.line) : 0;
  return Math.max(Math.max(2, ...state.farewell.map((f) => f.seconds)) + 1, lastWord) + GATHER_HOLD;
}

/**
 * What each sailor says as they step aboard, one at a time, in boarding order:
 * the line starts when they reach the boat, or when the one before has had its moment.
 * The renderer can read `person` to know who is speaking from the boat.
 */
export function aboardWords(state: AdventureState): Array<{ person: string; line: string; at: number }> {
  const words: Array<{ person: string; line: string; at: number }> = [];
  // In Wander only Haru says a word, and it is about the day, not the journey.
  if (state.free) {
    const haru = state.farewell.find((f) => f.person === 'haru');
    return haru ? [{ person: 'haru', line: `Haru: ${state.sailed ? '“The water again. Good.”' : '“Out past the bar, and home by supper.”'}`, at: haru.seconds }] : [];
  }
  // A wish come true (or a thread's payoff) is always said; then Sora, and Aki, whose “Cast off” closes the landing; then the rest, up to four.
  const boarding = [...state.farewell].sort((a, b) => a.seconds - b.seconds);
  const said = (person: string): string => threadAboard(state, person) ?? aboardLine(state, person, personDef(person).aboard);
  const rank = (person: string): number => said(person) !== personDef(person).aboard ? 0 : person === 'sora' ? 1 : person === 'aki' ? 2 : 3;
  const speaking = new Set([...boarding].filter((f) => said(f.person)).sort((a, b) => rank(a.person) - rank(b.person)).slice(0, ABOARD_SPEAKERS).map((f) => f.person));
  const order = boarding.filter((f) => speaking.has(f.person) && f.person !== 'aki').concat(boarding.filter((f) => speaking.has(f.person) && f.person === 'aki'));
  let free = 0;
  for (const f of order) {
    const line = `${personDef(f.person).name}: ${said(f.person)}`;
    const at = Math.max(f.seconds, free);
    words.push({ person: f.person, line, at });
    free = at + aboardReading(line);
  }
  return words;
}

/** The boat's mooring: just off the bank where it was built, afloat. */
export function moorings(state: AdventureState): Vec | null {
  const boat = state.buildings.find((b) => b.kind === 'boat');
  return boat ? afloat({ x: boat.x, y: boat.y }) : null;
}

const mooringCache = new Map<string, Vec>();

/** The nearest point a little way out into the water from a spot on the bank. */
export function afloat(at: Vec): Vec {
  const key = `${at.x},${at.y}`;
  const known = mooringCache.get(key);
  if (known) return known;
  const river = valleyRiver();
  const hit = river.nearest(at);
  const dx = hit.point.x - at.x;
  const dy = hit.point.y - at.y;
  const length = Math.hypot(dx, dy) || 1;
  let point = at;
  // Out until the hull floats clear of the bank and of anything standing in the water (a stilt hut, a jetty).
  for (let step = 0; step <= length; step += 6) {
    point = { x: Math.round(at.x + (dx / length) * step), y: Math.round(at.y + (dy / length) * step) };
    if (river.edgeDistance(point) < -26 && !underBuilding(adventureValley, point, 90)) break;
  }
  mooringCache.set(key, point);
  return point;
}

/** Where to look while everyone gathers: between the crowd on the bank and the boat. */
export function landingView(state: AdventureState): Vec | null {
  const built = state.buildings.find((b) => b.kind === 'boat');
  const water = moorings(state);
  if (!built || !water) return null;
  return { x: (built.x * 2 + water.x) / 3, y: (built.y * 2 + water.y) / 3 };
}

/** The gathering's framing: the boat afloat and the group boarding it, a little toward the bank. The sailing begins from exactly here. */
export function gatheringView(state: AdventureState, wide: boolean): { at: Vec; zoom: number } | null {
  const boat = moorings(state);
  const landing = landingView(state);
  if (!boat || !landing) return null;
  return { at: { x: boat.x * 0.88 + landing.x * 0.12, y: boat.y * 0.88 + landing.y * 0.12 }, zoom: wide ? 1 : 0.95 };
}

/** Spots on the bank behind the boat, for those seeing it off: a loose crowd facing the water. */
export function landingSpot(state: AdventureState, k: number): Vec {
  const built = state.buildings.find((b) => b.kind === 'boat');
  if (!built) return campOf(state.region).fire;
  const bank = { x: built.x, y: built.y };
  const water = afloat(bank);
  const length = Math.max(1, dist(bank, water));
  // Away from the water, and along the bank.
  const back = { x: (bank.x - water.x) / length, y: (bank.y - water.y) / length };
  const along = { x: -back.y, y: back.x };
  const row = Math.floor(k / 4);
  const side = (k % 4) - 1.5;
  return {
    x: Math.round(bank.x + back.x * (24 + row * 26) + along.x * side * 30),
    y: Math.round(bank.y + back.y * (24 + row * 26) + along.y * side * 30),
  };
}

/** Where the boat is `t` seconds into the sailing: it slips away slowly, then runs out past the bar. */
export function boatAt(state: AdventureState, t: number): { at: Vec; angle: number } | null {
  const from = moorings(state);
  if (!from) return null;
  const path = from.x > 1300
    ? [from, { x: 1600, y: Math.max(5870, from.y + 60) }, { x: 1700, y: 6150 }, { x: 1950, y: 6440 }]
    : [from, { x: (from.x + MOUTH.x) / 2 + 40, y: (from.y + MOUTH.y) / 2 }, MOUTH, OPEN_SEA];
  // The first four seconds stay at the landing as the boat pulls clear of shore.
  const k = 0.08 * smoothstep(0, 1, clamp(t / 4, 0, 1)) + 0.92 * smoothstep(0, 1, clamp((t - 4) / (sailSeconds(state) - 6), 0, 1));
  const at = alongPath(path, k);
  const ahead = alongPath(path, Math.min(1, k + 0.02));
  return { at, angle: Math.atan2(ahead.y - at.y, ahead.x - at.x) };
}

/** The clock hour for the light: first light at the landing, a clear morning on the way to the sea. */
export function voyageHour(state: AdventureState): number {
  if (state.voyage === 'gathering') return 5.4 + 0.8 * clamp(state.voyageTime / gatheringSeconds(state), 0, 1);
  if (state.voyage === 'sailing') return 6.2 + 1.6 * clamp(state.voyageTime / sailSeconds(state), 0, 1);
  return 7.8;
}

/**
 * The stops the view glides through: the springs, then in each reach the
 * things this player changed (finished buildings, grown plantings, creatures
 * and people their collections drew), then the boat out to the open sea.
 */
export function voyageStops(state: AdventureState, wide: boolean): Stop[] {
  const near = wide ? 0.62 : 0.5;
  // Far enough out that the boat grows small on the water; on a phone the valley's edge limits how far.
  const far = wide ? 0.4 : 0.46;
  const landing = landingView(state) ?? campOf(2).fire;
  const castOff = boatAt(state, 4);
  if (state.free) return wanderStops(state, landing, castOff?.at ?? landing, near, far, wide);
  // Stay with the boat as it leaves, from the very framing the gathering held, so
  // casting off is one continuous movement. Memories belong to the closing journal,
  // not an unexpected jump back to the mountains during the cast-off.
  const start = gatheringView(state, wide) ?? { at: landing, zoom: .85 };
  const stops: Stop[] = [{ at: start.at, t: 0, zoom: start.zoom }];
  for (const t of [4, 8, 13, 18, 23, AT_THE_BAR, 31, VOYAGE_SECONDS - 1]) {
    const boat = boatAt(state, t);
    if (boat) stops.push({ at: { x: boat.at.x, y: boat.at.y - 30 }, t, zoom: t > AT_THE_BAR ? (far + near) / 2 : near });
  }
  const sea = boatAt(state, VOYAGE_SECONDS - 1);
  if (sea) stops.push({ at: { x: sea.at.x, y: sea.at.y - 80 }, t: VOYAGE_SECONDS, zoom: far });
  return stops.sort((a, b) => a.t - b.t);
}

/** A Wander sail: the cast-off, a cut to the boat on the water, and with it out past the bar. */
function wanderStops(state: AdventureState, landing: Vec, castOff: Vec, near: number, far: number, wide: boolean): Stop[] {
  const start = gatheringView(state, wide) ?? { at: landing, zoom: .85 };
  const stops: Stop[] = [{ at: start.at, t: 0, zoom: start.zoom }, { at: castOff, t: VOYAGE_CUT, zoom: .8 }];
  const end = WANDER_SAIL;
  [VOYAGE_CUT, 9, WANDER_BAR, 19, end - 1].forEach((t, i) => {
    const boat = boatAt(state, t);
    if (boat) stops.push({ at: { x: boat.at.x, y: boat.at.y - 30 }, t, zoom: t > WANDER_BAR ? (far + near) / 2 : near, ...(i === 0 ? { cut: true } : {}) });
  });
  const sea = boatAt(state, end - 1);
  if (sea) stops.push({ at: { x: sea.at.x, y: sea.at.y - 80 }, t: end, zoom: far });
  return stops;
}

/** Up to four things this player changed in a reach, from the mountains down. */
/**
 * Where the view is at `t`: one smooth, time-paced curve through the stops of
 * the current shot. Speed carries through each stop (no slowing to a halt at
 * every one); the shot eases in at its start and out at its end. A `cut` stop
 * begins a new shot.
 */
export function voyageCamera(stops: readonly Stop[], t: number): Stop {
  let start = 0;
  for (let i = 1; i < stops.length; i++) if (stops[i]!.cut && t >= stops[i]!.t) start = i;
  let end = stops.findIndex((s, i) => i > start && s.cut);
  end = end < 0 ? stops.length - 1 : end - 1;
  const shot = stops.slice(start, end + 1);
  if (t <= shot[0]!.t || shot.length === 1) return { ...shot[0]!, t };
  const last = shot[shot.length - 1]!;
  if (t >= last.t) return { ...last, t };
  let i = 0;
  while (i < shot.length - 2 && t > shot[i + 1]!.t) i++;
  const a = shot[i]!, b = shot[i + 1]!;
  const h = Math.max(0.01, b.t - a.t);
  // Tangents per second from the neighbours (zero at the shot's ends, so it eases in and out).
  const tangent = (k: number, get: (s: Stop) => number): number => {
    if (k <= 0 || k >= shot.length - 1) return 0;
    const p = shot[k - 1]!, n = shot[k + 1]!;
    return (get(n) - get(p)) / Math.max(0.01, n.t - p.t);
  };
  const u = (t - a.t) / h, u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const hermite = (get: (s: Stop) => number): number => h00 * get(a) + h10 * h * tangent(i, get) + h01 * get(b) + h11 * h * tangent(i + 1, get);
  return { at: { x: hermite((s) => s.at.x), y: hermite((s) => s.at.y) }, t, zoom: hermite((s) => s.zoom) };
}

/** The quiet words on the way down: each reach's name, and one line from this journey. */
export function voyageCaption(state: AdventureState): { reach: string | null; line: string | null } | null {
  if (state.voyage === 'gathering') {
    const said = aboardWords(state).find((w) => state.voyageTime >= w.at && state.voyageTime < w.at + aboardReading(w.line));
    return said ? { reach: null, line: said.line } : null;
  }
  if (state.voyage !== 'sailing') return null;
  const t = state.voyageTime;
  if (state.free) return wanderCaption(state, t);
  if (t < WINDOWS[0].from) return { reach: null, line: 'The rope falls loose. The shore begins to slip behind.' };
  const index = WINDOWS.findIndex((w) => t >= w.from && t < w.to);
  if (index < 0) return null;
  const window = WINDOWS[index]!;
  const lines = voyageLines(state);
  // A single ordered beat owns both heading and speech. The last reply has
  // eight full seconds, and no delayed heading arrives halfway through it.
  return {
    reach: window.name,
    line: index === WINDOWS.length - 1 && lines[index + 1] && t >= AT_THE_BAR
      ? lines[index + 1]! : lines[index] ?? null,
  };
}

/** A Wander sail's few words, the first time and each time after (chosen by the day). */
const WANDER_FIRST = {
  haru: ['Haru: “The water has tracks too. See how the wind lies on it?”', 'Haru: “Far enough for today. Let’s go home.”'],
  others: ['The shore slips behind. Gulls follow us out.', 'Out past the bar, the swell lifts the boat. Then home again.'],
};
const WANDER_AGAIN = {
  haru: [
    ['Haru: “Gulls over the bar. Fish under them.”', 'Haru: “Home before the fire goes out.”'],
    ['Haru: “I can smell the pines from out here.”', 'A long, slow swell, and the shore small behind us.'],
    ['Haru trails a hand in the water and says nothing for a while.', 'Haru: “Same sea, different day.”'],
  ],
  others: [
    ['The shore slips behind. Gulls follow us out.', 'A long, slow swell, and the shore small behind us.'],
    ['The sail fills. Nobody says much.', 'Out past the bar, and round for home.'],
  ],
};

/** The words on a Wander sail: pushing off, a line on the water, and one out past the bar. */
export function wanderLines(state: AdventureState): [string, string] {
  const haru = state.companions.includes('haru');
  if (!state.sailed) return (haru ? WANDER_FIRST.haru : WANDER_FIRST.others) as [string, string];
  const pool = haru ? WANDER_AGAIN.haru : WANDER_AGAIN.others;
  return pool[state.day % pool.length] as [string, string];
}

function wanderCaption(state: AdventureState, t: number): { reach: string | null; line: string | null } | null {
  if (t < VOYAGE_CUT + 1) return { reach: null, line: 'We push off from the bank.' };
  const [water, bar] = wanderLines(state);
  if (t < WANDER_BAR) return { reach: null, line: water };
  return { reach: 'The sea', line: bar };
}

/** One line per reach, one for the sea, and Sora's at the bar if he sailed, drawn from this playthrough. Never more than five. */
export function voyageLines(state: AdventureState): Array<string | null> {
  const was = (id: string): boolean => state.people.some((p) => p.id === id);
  const story = (beat: number, prefer: readonly string[]): string | null => {
    const id = prefer.find((p) => was(p) && personDef(p).story[beat]);
    return id ? personDef(id).story[beat]! : null;
  };
  const firstRare = Object.entries(state.discoveries)
    .map(([id, d]) => ({ find: FINDS.find((f) => f.id === id), ...d }))
    .filter((x) => x.find?.rare && x.find.region === 0)
    .sort((a, b) => a.day - b.day)[0];
  const seseragi = firstRare
    ? `${firstRare.find!.name}, back up the river. We still talk about that day.`
    : 'The mountain paths, and the first bend beyond home.';
  const sailors = state.companions;
  const sora = sailors.includes('sora');
  // Ren's salt is said once, out at the bar; Kawagiri's memory goes to someone else.
  const salt = sailors.includes('ren') ? 'Ren tastes the spray, then laughs. “Salt. All that way, and it’s salt.”' : was('ren') ? 'Spray over the bow, salt at last. Somebody will have to tell Ren.' : null;
  // Haru asked us to wave as we sailed past; if she stayed among her pines, she is there on the dunes.
  const haruWaves = !!state.discoveries['haru-meeting'] && !sailors.includes('haru')
    ? 'On the Matsubara dunes, Haru waves with both arms until we are too small to see.' : null;
  const lines: Array<string | null> = [
    seseragi,
    story(0, ['mina', 'sora', 'ren', 'haru']),
    haruWaves ?? story(1, salt ? ['haru', 'yui', 'aki', 'sora', 'mina'] : ['haru', 'yui', 'ren', 'aki', 'sora', 'mina']),
    salt ?? (sora ? null : story(2, sailors.length ? sailors : ['sora'])),
  ];
  if (sora) lines.push(SORA_AT_SEA);
  return lines;
}

function alongPath(points: readonly Vec[], k: number): Vec {
  const lengths = points.slice(1).map((p, i) => dist(points[i]!, p));
  const total = lengths.reduce((a, b) => a + b, 0);
  let left = k * total;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i]! || i === lengths.length - 1) {
      const f = lengths[i]! > 0 ? Math.min(1, left / lengths[i]!) : 1;
      return { x: points[i]!.x + (points[i + 1]!.x - points[i]!.x) * f, y: points[i]!.y + (points[i + 1]!.y - points[i]!.y) * f };
    }
    left -= lengths[i]!;
  }
  return points[points.length - 1]!;
}

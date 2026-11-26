/**
 * Free Play's almanac: a year of small things, written like a nature diary
 * ("Cranes come down to the stubble when it turns cold."), never a quest log.
 * It is written on the year's first morning: a couple of things for each
 * season, from what the river and the weather will really allow then, mostly
 * near where the friends live, and a friend not yet met. Each is ticked once
 * it is in the journal; what is in season now comes first. Nothing is lost by
 * leaving one; the next year brings a new almanac.
 */

import { DAYS_PER_SEASON, lastDayOfSeason } from './calendar';
import { findPossible, findActivities, placeToday } from './conditions';
import { FINDS, findDef, placeDef } from './content';
import type { FindDef } from './catalogue';
import { hashString, mulberry32 } from '../core/rng';
import { isSecretPlace } from './places/freeplay';
import { REGIONS, inLivedReach, livedIn } from './regions';
import type { AdventureState } from './state';
import { holds, todayOf, type World } from './world';

export interface Aim {
  line: string;
  /** The season it belongs to (0 spring to 3 winter); none for a friend to meet, who can be met any time. */
  season?: number;
  /** Where to go for it, when one place is known for it (never for one already ticked). */
  place?: string;
  done: boolean;
}

/** The season counted from the very first spring. */
export const seasonIndex = (day: number): number => Math.floor(Math.max(0, day - 1) / DAYS_PER_SEASON);
/** The year counted from the very first spring, so each one's almanac is written once. */
export const yearIndex = (day: number): number => Math.floor(seasonIndex(day) / 4);
/** Things in the almanac for each season, besides a friend to meet. */
const PER_SEASON = 2;

/** The almanac's words for the season's creatures, plants and places. */
const ALMANAC: Readonly<Record<string, string>> = {
  // Spring
  'plum-blossom': 'The plum trees at Umezono flower before anything else wakes.',
  fiddleheads: 'Fern heads uncurl in the grass at Shidanohara.',
  'cherry-salmon': 'Cherry salmon come up to Fuchi on the snowmelt.',
  'marsh-marigold': 'Marsh marigolds light the ditches at Numata.',
  'orchard-blossom': 'Every tree at Ringozaka is in blossom.',
  'rice-planting': 'Mio plants its rice as soon as the water warms.',
  'wild-garlic': 'Wild garlic under the trees at Nishibayashi. You smell it first.',
  whitebait: 'Whitebait run up the Hosokawa creek in spring.',
  swallows: 'Swallows are back under the eaves at Toroya.',
  bittern: 'A bittern booms in the Numata reeds on spring evenings.',
  // Spring into summer
  plover: 'Plovers nest on the bare gravel at Koishihama when the water drops.',
  egret: 'An egret wades the Ashiura mud when the water is down.',
  'rice-frogs': 'Frogs sing on the Tanada terraces on warm nights.',
  'white-herons': 'White herons stand in the Shirasagi reeds through the warm months.',
  newt: 'Newts in the tarn shallows, now the water has warmed.',
  'old-roses': 'The old roses over the wall at Mukoniwa are out.',
  'alpine-cress': 'Cress at the lip of the high springs, in the warm months.',
  // Summer
  dragonflies: 'Dragonflies over the mill pool at Suisha.',
  'day-lilies': 'Day lilies open on the high meadow at Hanano.',
  usuyukiso: 'A pale flower grows on Hanano in summer, and nowhere else.',
  'first-beans': 'The first beans are up in the Seseragi plots.',
  ume: 'The plums are ripening at Umezono.',
  'reed-warbler': 'A reed warbler chatters all day in the Ashihara reeds.',
  'spotted-fawn': 'A fawn lies still in the woods on misty summer mornings.',
  'mill-carp': 'Carp rise at Kurumaya Mill while the summer water runs high.',
  'salt-flower': 'Salt flowers bloom on the flats at Shiohara.',
  honeycomb: 'The beekeeper at Hachiya has honey to spare after the blossom.',
  buckwheat: 'Buckwheat flowers white at the east farm.',
  sandpiper: 'Sandpipers run the point bar at Sugawara.',
  nutcracker: 'Nutcrackers call in the high pines at Matsuyama.',
  // Autumn
  'late-apples': 'Late apples at Ringozaka, sweeter for the wait.',
  chestnuts: 'Chestnuts are falling in the Nishibayashi wood.',
  shiitake: 'Mushrooms come up on fallen wood in Kamimori.',
  'maple-leaf': 'The old maple at Kaede turns before every other tree.',
  matsutake: 'Mushrooms hide under the Matsubara pines.',
  'autumn-stag': 'A stag calls across the open meadows.',
  'wild-grapes': 'Wild grapes ripen in the eastern wood at Shimomori.',
  'autumn-arrivals': 'Geese and ducks come in to Shirasagi from the north.',
  'wild-boar': 'Boar turn the leaves under Mio’s oaks.',
  'field-mushrooms': 'Field mushrooms on the Makiba pasture after rain.',
  // Autumn into winter
  'stubble-cranes': 'Cranes come down to the stubble when it turns cold.',
  swans: 'Swans come down to Kagami-numa when the cold comes.',
  mandarin: 'Mandarin ducks winter on the pools at Ashiura.',
  'reed-bunting': 'Reed buntings keep to the Shirasagi reeds in the cold months.',
  ptarmigan: 'Ptarmigan turn white, high on the mountain.',
  daikon: 'Winter radishes in the Seseragi plots.',
  // Winter
  'singing-ice': 'Kagami-numa sings when it freezes.',
  'winter-deer': 'Deer shelter in the Shimomori wood through the winter.',
  'snow-monkeys': 'Monkeys sit out the snow near the gorge.',
  'snow-hare': 'A hare in its white coat, on a snowy day.',
  // Any season, when the water and the weather allow
  seal: 'A seal hauls out on the bar at Kawaguchi on misty, low-water days.',
};

/** Friends not yet met, said the way the valley says it. */
function meetingLine(s: AdventureState, person: string): string | null {
  switch (person) {
    case 'aki': return livedIn(s).includes(1) ? 'Someone is hammering on the inn roof at Toroya, just along from camp.' : 'Someone is hammering on the inn roof at Toroya, in Mio.';
    case 'sora': return 'Someone lives up at Yamagoya, the hut below the falls, all on his own.';
    case 'ren': return `Up the valley, a fisher keeps to the water at ${placeDef(s.course.ren).name}.`;
    case 'mina': return s.course.mina === 'kamimori' ? 'Someone gathers herbs among the Kamimori trees.' : 'Someone in Seseragi knows every plant by name.';
    default: return null;
  }
}

/** Every find the almanac has words for: the season's own, and a friend still to meet. */
export const ALMANAC_FINDS: readonly string[] = [...Object.keys(ALMANAC), 'aki-meeting', 'sora-meeting', 'ren-meeting', 'mina-meeting'];

const meetingOf = (id: string): string | null => (id.endsWith('-meeting') ? id.replace('-meeting', '') : null);

/** True when the find could really come home on one of these days. */
function possibleOn(find: FindDef, w: World, from: number, to: number): boolean {
  const s = w.state;
  for (let day = from; day <= to; day++) {
    const today = todayOf(w.seed, day);
    if (!holds(find.sighting?.moment, today, s)) continue;
    if (find.at) {
      const open = (id: string): boolean => !isSecretPlace(id) && placeToday(placeDef(id), today, s).state !== 'closed';
      if (find.at.some((id) => open(id) && findActivities(find, placeDef(id)).some((act) => findPossible(find, placeDef(id), act, today, s)))) return true;
    } else if (find.sighting && holds(find.when, today, s) && find.sighting.near.some((p) => inLivedReach(s, p))) return true;
  }
  return false;
}

/** True when the find could really come home on some day left in this season. */
export function possibleThisSeason(find: FindDef, w: World): boolean {
  return possibleOn(find, w, w.today.day, lastDayOfSeason(w.today.day));
}

/** Writes this year's almanac, once, on its first morning (or the first morning seen in it). */
export function writeAlmanac(w: World): void {
  const s = w.state;
  const year = yearIndex(s.day);
  if (!s.free || s.almanac.year === year) return;
  const rng = mulberry32(hashString(`almanac:${w.seed}:${year}`));
  const lived = livedIn(s);
  const near = (f: FindDef): boolean => lived.includes(f.region);
  const open = (find: FindDef): boolean => !s.discoveries[find.id] && !find.when?.structure;
  const shuffled = (finds: FindDef[]): FindDef[] => finds.map((find) => ({ find, roll: rng() })).sort((a, b) => a.roll - b.roll).map((c) => c.find);
  const finds: string[] = [];
  const seasons: number[] = [];
  // A friend still to meet, the nearest first.
  const meeting = shuffled(ALMANAC_FINDS.filter((id) => meetingOf(id)).map(findDef).filter((f) => open(f) && !s.people.some((p) => p.id === meetingOf(f.id))));
  const friend = meeting.find(near) ?? meeting[0];
  if (friend) { finds.push(friend.id); seasons.push(-1); }
  // Then each season of the year still to come: something near home, then something farther off.
  const first = year * DAYS_PER_SEASON * 4 + 1;
  for (let q = 0; q < 4; q++) {
    const from = Math.max(s.day, first + q * DAYS_PER_SEASON), to = first + (q + 1) * DAYS_PER_SEASON - 1;
    if (from > to) continue;
    const pool = shuffled(Object.keys(ALMANAC).map(findDef).filter((f) => open(f) && !finds.includes(f.id) && possibleOn(f, w, from, to)));
    const picks = [pool.find(near), pool.find((f) => !near(f))].filter((f): f is FindDef => !!f);
    for (const f of pool) if (picks.length < PER_SEASON && !picks.includes(f)) picks.push(f);
    for (const f of picks.slice(0, PER_SEASON)) { finds.push(f.id); seasons.push(q); }
  }
  s.almanac = { year, finds, seasons };
}

/** In Wander, the share of a reach's pages already found from which the last ones get a little help. */
export const NEARLY_FILLED = 0.75;

/** The share of a reach's journal pages found so far (Wander counts every page). */
export function reachFilled(state: AdventureState, region: number): number {
  const pages = FINDS.filter((f) => f.region === region);
  return pages.length ? pages.filter((f) => state.discoveries[f.id]).length / pages.length : 0;
}

/**
 * Wander, once a reach's pages are nearly all found: one page still missing
 * there, in the almanac's margin, by its own hint. The same one all season,
 * until it is found; then another.
 */
function lastPages(state: AdventureState): Aim[] {
  if (!state.free) return [];
  const aims: Aim[] = [];
  for (let region = 0; region < REGIONS.length; region++) {
    if (reachFilled(state, region) < NEARLY_FILLED) continue;
    const missing = FINDS.filter((f) => f.region === region && !state.discoveries[f.id] && f.hint && !f.id.endsWith('-meeting') && !(f.at ?? []).some(isSecretPlace));
    if (!missing.length) continue;
    const find = missing[hashString(`last:${region}:${seasonIndex(state.day)}`) % missing.length]!;
    const place = find.at?.find((p) => state.known.includes(p));
    aims.push({ line: `Still to find near ${REGIONS[region]!.name}: ${find.hint}`, done: false, ...(place ? { place } : {}) });
  }
  return aims;
}

/** This year's almanac entries, as written, each ticked once seen: what is in season now first, then what is to come, then the rest. */
export function almanacAims(state: AdventureState): Aim[] {
  const now = seasonIndex(state.day) % 4;
  const aims = state.almanac.finds.map((id, i): Aim => {
    const find = findDef(id);
    const person = meetingOf(id);
    const done = !!state.discoveries[id] || (person !== null && state.people.some((p) => p.id === person));
    const line = (person ? meetingLine(state, person) : ALMANAC[id]) ?? find.hint;
    const place = done ? undefined : find.at?.find((p) => state.known.includes(p));
    const season = state.almanac.seasons[i] ?? -1;
    return { line, done, ...(season >= 0 ? { season } : {}), ...(place ? { place } : {}) };
  });
  aims.push(...lastPages(state));
  const rank = (aim: Aim): number => aim.done ? 9 : aim.season === undefined || aim.season === now ? 0 : aim.season > now ? 1 + aim.season - now : 6;
  return aims.map((aim, i) => ({ aim, i })).sort((a, b) => rank(a.aim) - rank(b.aim) || a.i - b.i).map((x) => x.aim);
}

/**
 * In a Journey, while the story waits on the water: one thing near home worth
 * seeing meanwhile, from the almanac, the same all day. Null when nothing fits.
 */
export function whileWeWait(w: World): string | null {
  const s = w.state;
  const lived = livedIn(s);
  const options = Object.keys(ALMANAC).map(findDef).filter((find) => !s.discoveries[find.id] && lived.includes(find.region)
    && (!find.at || find.at.some((id) => s.known.includes(id))) && possibleThisSeason(find, w));
  if (!options.length) return null;
  const pick = options[hashString(`wait:${w.seed}:${s.day}`) % options.length]!;
  return ALMANAC[pick.id]!;
}

/** What the almanac suggests now: what is in season and still to see first, then what has been ticked. Never empty. */
export function freeAims(state: AdventureState): Aim[] {
  const aims = almanacAims(state);
  const now = seasonIndex(state.day) % 4;
  const open = aims.filter((a) => !a.done).map(aim => aim.season !== undefined && aim.season !== now
    ? { ...aim, line: `In ${['spring', 'summer', 'autumn', 'winter'][aim.season]}: ${aim.line}` } : aim);
  if (open.length) return [...open, ...aims.filter((a) => a.done)];
  const line = aims.length ? 'Everything in this year’s almanac is seen. The rest of it is ours to wander.' : 'The valley is ours to wander, and the sea is there when we want it.';
  return [{ line, done: false }, ...aims];
}

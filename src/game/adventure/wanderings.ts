/**
 * Free Play's long wanderings: a few big things to work towards, each with
 * its own quiet count, kept on the River Map. They are read straight from
 * what the friends have already done (the map, the journal, the people met,
 * what has been built), so they hold no state of their own.
 *
 * And each reach keeps one place back: when every other place in it is on
 * the map, it shows itself by the fire (`secretsDue`, called from the dusk).
 */

import { SETS, isSetComplete } from './collections';
import { FINDS, PLACES, placeDef } from './content';
import type { Wandering } from './model';
import { SECRET_PLACES, isSecretPlace } from './places/freeplay';
import { PEOPLE } from './people';
import { REGIONS } from './regions';
import type { AdventureState } from './state';
import { numberWord } from './text';
import { WISHES } from './wishes';
import { readyBuildings } from './world';

/** The valley's rare moments: a fawn in the mist, cranes in the stubble, a seal on the bar. */
export const MOMENTS: readonly string[] = FINDS.filter((f) => f.sighting?.moment).map((f) => f.id);

/** Every ordinary place in a reach: what "every corner" counts. */
export const reachPlaces = (region: number): string[] => PLACES.filter((p) => p.region === region && !isSecretPlace(p.id)).map((p) => p.id);

/**
 * The secret place to show by the fire tonight: one whose reach is now found
 * end to end and which is not yet on the map. Only one an evening, so each has
 * a night of its own (after a Journey every reach is known at once).
 */
export function secretsDue(s: AdventureState): string[] {
  if (!s.free) return [];
  return Object.entries(SECRET_PLACES).filter(([region, id]) => !s.known.includes(id) && reachPlaces(Number(region)).every((p) => s.known.includes(p))).map(([, id]) => id).slice(0, 1);
}

/** "none of three", "two of six", "14 of 27": words up to ten, figures above. */
function count(found: number, total: number): string {
  if (total > 10) return `${found} of ${total}`;
  return `${found === 0 ? 'none' : numberWord(found)} of ${numberWord(total)}`;
}

export function wanderings(s: AdventureState): Wandering[] {
  const item = (id: string, line: string, found: number, total: number, progress: string, note?: string): Wandering =>
    ({ id, line, found, total, progress, done: found >= total, ...(note ? { note } : {}) });
  const reaches = REGIONS.map((region, i) => {
    const places = reachPlaces(i);
    const found = places.filter((id) => s.known.includes(id)).length;
    const secret = SECRET_PLACES[i]!;
    const note = s.known.includes(secret) ? `And ${placeDef(secret).name}, which nobody ever mentioned.` : undefined;
    return item(`reach-${region.id}`, `Every corner of ${region.name}`, found, places.length, count(found, places.length), note);
  });
  // Met, not necessarily with us: Sora keeps to his own journey.
  const met = PEOPLE.filter((p) => s.people.some((x) => x.id === p.id) || !!s.discoveries[`${p.id}-meeting`]).length;
  const pages = SETS.filter((set) => isSetComplete(set, s)).length;
  const moments = MOMENTS.filter((id) => s.discoveries[id]).length;
  const built = REGIONS.filter((_, i) => readyBuildings(s).some((b) => b.region === i)).length;
  const wishes = WISHES.filter((w) => s.discoveries[w.find]).length;
  return [
    ...reaches,
    item('friends', 'Everyone along the river met', met, PEOPLE.length, count(met, PEOPLE.length)),
    item('pages', 'Every collection completed', pages, SETS.length, count(pages, SETS.length)),
    item('moments', 'The valley’s rare moments', moments, MOMENTS.length, count(moments, MOMENTS.length)),
    item('built', 'Something of ours in every reach', built, REGIONS.length, count(built, REGIONS.length)),
    item('wishes', 'Each companion’s small wish granted', wishes, WISHES.length, count(wishes, WISHES.length)),
    item('sea', 'Out past the bar, to the sea', s.sailed ? 1 : 0, 1, s.sailed ? 'sailed' : 'not yet'),
  ];
}

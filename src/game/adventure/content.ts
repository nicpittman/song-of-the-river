/**
 * All authored content in one place, with lookups. The reaches each keep
 * their own file under `places/`; people, regions and structures have theirs.
 */

import type { FindDef, LeadDef, PlaceDef } from './catalogue';
import type { Activity } from './model';
import { KAWAGIRI } from './places/kawagiri';
import { MIO } from './places/mio';
import { OUTLYING } from './places/outlying';
import { SESERAGI } from './places/seseragi';
import { FREE_PLAY_CONTENT } from './places/freeplay';

export { PEOPLE } from './people';
export { REGIONS } from './regions';
export { EQUIPMENT, STRUCTURES } from './structures';

const REACHES = [SESERAGI, MIO, KAWAGIRI, OUTLYING, FREE_PLAY_CONTENT];

export const PLACES: readonly PlaceDef[] = REACHES.flatMap((r) => r.places);
export const FINDS: readonly FindDef[] = REACHES.flatMap((r) => r.finds);
export const LEADS: readonly LeadDef[] = REACHES.flatMap((r) => r.leads);

const placeIndex = new Map(PLACES.map((p) => [p.id, p]));
const findIndex = new Map(FINDS.map((f) => [f.id, f]));

export function placeDef(id: string): PlaceDef {
  const place = placeIndex.get(id);
  if (!place) throw new Error(`Unknown place ${id}`);
  return place;
}

export const hasPlace = (id: string): boolean => placeIndex.has(id);

export function findDef(id: string): FindDef {
  const find = findIndex.get(id);
  if (!find) throw new Error(`Unknown find ${id}`);
  return find;
}

export const hasFind = (id: string): boolean => findIndex.has(id);

/** "Fishing at Fuchi". */
export const ACTIVITY_DOING: Record<Activity, string> = {
  explore: 'Exploring',
  fish: 'Fishing',
  forage: 'Foraging',
  investigate: 'Looking closely',
  visit: 'Visiting',
  track: 'Tracking',
};

/** A find's journal words in this kind of game. */
export const findText = (find: FindDef, free: boolean): string => (free && find.freeText) || find.text;

/** What can be done at a place: its own activities, and in Free Play any it has only there. */
export function placeActivities(place: PlaceDef, free: boolean): Activity[] {
  return free && place.freeActivities ? [...place.activities, ...place.freeActivities.filter((a) => !place.activities.includes(a))] : place.activities;
}

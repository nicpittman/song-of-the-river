/**
 * Matching the morning report's entries (place ids, place names or whole
 * sentences) to the places they speak of.
 */

import type { AdventureView, PlaceView } from '../../game/adventure/model';

/** The place an entry of the report refers to: by id, by name, or by a name inside a sentence. */
export function placeFor(view: AdventureView, entry: string): PlaceView | null {
  const exact = view.places.find((p) => p.id === entry || p.name === entry);
  if (exact) return exact;
  // The longest name mentioned wins, so "The gravel bar" beats "Gravel".
  const mentioned = view.places.filter((p) => entry.includes(p.name)).sort((a, b) => b.name.length - a.name.length);
  return mentioned[0] ?? null;
}

/** Ids of the places a list of report entries refers to (for marking them on the board). */
export function placeIds(view: AdventureView, entries: string[] | undefined): string[] {
  return (entries ?? []).map((e) => placeFor(view, e)?.id).filter((id): id is string => !!id);
}

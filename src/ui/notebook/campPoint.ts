/**
 * Where the group's fire is, for the camp mark and the start of each trail.
 *
 * The view does not name the camp directly; in the morning every friend still
 * at home stands by the fire, so their position is the camp.
 */

import type { AdventureView, FriendView } from '../../game/adventure/model';
import type { Vec } from '../../game/core/math';

/** The settlement the group lives in now: the one nearest their fire, or the farthest reach's name. */
export function homeName(view: AdventureView): string {
  return view.chart.regions[campRegion(view)]?.name ?? '';

}

/** The reach the group's fire is in: in Free Play, wherever the first friend has made camp now. */
export const campRegion = (view: AdventureView): number => (view.mode === 'free' ? view.friends[0]?.base ?? view.region : view.region);

export function campPoint(view: AdventureView): Vec | null {
  const region = campRegion(view);
  const atCamp = view.friends.filter((f) => f.base === region && (f.status === 'home' || f.status === 'resting' || f.status === 'planned'));
  if (!atCamp.length) return null;
  const groups = new Map<string, FriendView[]>();
  for (const person of atCamp) {
    const key = `${person.base}:${person.lodging ?? 'town'}`;
    const group = groups.get(key) ?? []; group.push(person); groups.set(key, group);
  }
  return mapBase(view, [...groups.values()].sort((a, b) => b.length - a.length)[0]![0]!);
}

/** Match the base symbol on the notebook map, rather than somebody's seat at its fire. */
export function mapBase(view: AdventureView, person: FriendView): Vec {
  return view.places.find((place) => place.id === person.lodging)?.at
    ?? view.lodgings.find((l) => l.id === person.lodging)?.at
    ?? view.places.find((p) => p.kind === 'settlement' && p.region === person.base)?.at
    ?? person.at;
}

/**
 * The farthest reach of the river open to the player: the view's own region,
 * or further when the view already lists places there (Free Play opens the
 * whole river at once).
 */
export function reach(view: AdventureView): number {
  let far = view.region;
  for (const p of view.places) if (!(view.canTravel && p.kind === 'settlement' && p.region > view.region) && p.region > far) far = p.region;
  return Math.min(far, view.chart.regions.length - 1);
}

/** At home, use the town's symbol; only an expedition needs a live world position. */
export function mapPosition(view: AdventureView, person: FriendView): Vec {
  return person.status==='out' || person.status==='aboard' ? person.at : mapBase(view,person);
}

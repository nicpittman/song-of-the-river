import type { AdventureView, SecondStop } from '../../game/adventure/model';
import { dist } from '../../game/core/math';
import { defaultActivity } from './recommendations';

export interface StopHint {
  person: string;
  stop: SecondStop;
  moving: boolean;
}

const cached = new WeakMap<object, Map<string, Map<string, StopHint[]>>>();

/** A few legal stops beside the map pins, for confirmed trips with room left. */
export function mapStopHints(view: AdventureView, selectedPerson: string | null = null): Map<string, StopHint[]> {
  const identity = view.planningKey ?? view;
  let choices = cached.get(identity);
  if (!choices) { choices = new Map(); cached.set(identity, choices); }
  const key = selectedPerson ?? '';
  const before = choices.get(key);
  if (before) return before;
  const hints = new Map<string, StopHint[]>();
  if (view.phase !== 'morning' || view.voyage !== 'preparing') return hints;
  for (const plan of view.plans) {
    if (selectedPerson && plan.person !== selectedPerson) continue;
    if (plan.second || plan.detour || !plan.moving && (plan.overnight || plan.lodging !== undefined)) continue;
    const friend = view.friends.find(person => person.id === plan.person);
    const first = view.places.find(place => place.id === plan.place);
    if (!friend || !first) continue;
    const stops = plan.moving ? view.detourStops(plan.person) : view.places
      .filter(place => place.id !== plan.place && place.region === first.region && place.kind !== 'settlement' && !place.rumour && place.state !== 'closed')
      .map(place => ({ place, stop: { place: place.id, activity: defaultActivity(friend, place) } }))
      .filter(({ stop }) => !view.forecast({ ...plan, second: stop }).problem)
      .sort((a, b) => (dist(first.at, a.place.at) + dist(a.place.at, friend.at)) - (dist(first.at, b.place.at) + dist(b.place.at, friend.at)))
      .slice(0, 4).map(({ stop }) => stop);
    for (const stop of stops) {
      const place = view.places.find(p => p.id === stop.place);
      if (!place || place.rumour || place.state === 'closed') continue;
      const at = hints.get(stop.place) ?? [];
      at.push({ person: plan.person, stop, moving: !!plan.moving });
      hints.set(stop.place, at);
    }
  }
  choices.set(key, hints);
  return hints;
}

/** Legal additions at the place the player deliberately opened, independent of the map's short preview list. */
export function plannedStopsAt(view: AdventureView, placeId: string): StopHint[] {
  if (view.phase !== 'morning' || view.voyage !== 'preparing') return [];
  const place = view.places.find(place => place.id === placeId);
  if (!place || place.rumour || place.state === 'closed' || place.kind === 'settlement') return [];
  return view.plans.flatMap<StopHint>(plan => {
    if (plan.second || plan.detour || !plan.moving && (plan.overnight || plan.lodging !== undefined)) return [];
    if (plan.moving) {
      const stop = view.detourStops(plan.person).find(stop => stop.place === placeId);
      return stop ? [{ person: plan.person, stop, moving: true }] : [];
    }
    const first = view.places.find(place => place.id === plan.place);
    const friend = view.friends.find(friend => friend.id === plan.person);
    if (!friend || !first || first.region !== place.region || plan.place === placeId) return [];
    const stop = { place: placeId, activity: defaultActivity(friend, place) };
    return view.forecast({ ...plan, second: stop }).problem ? [] : [{ person: plan.person, stop, moving: false }];
  });
}

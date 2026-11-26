/** One daylight budget shared by the forecast, planning and visible walks. */
import { dist, type Vec } from '../core/math';
import { DAY_SECONDS } from './calendar';
import { placeDef } from './content';
import { placeToday } from './conditions';
import { routeLength } from './navigation';
import { outingPace } from './people';
import { seat } from './campSeats';
import { campOf } from './regions';
import type { OutingPlan, SecondStop } from './model';
import { lodgingById, overnightAt, setOutFrom, type World } from './world';
import type { Outing } from './state';

/** The group's arrival comes from the saved walking legs, shared by captions and the world reveal; a friend stopping on the way catches up later. */
export function arrivalOf(outings: readonly Outing[]): number {
  const together = outings.some((outing) => !outing.detour) ? outings.filter((outing) => !outing.detour) : outings;
  return Math.max(0, ...together.flatMap((outing) => outing.legs.filter((leg) => leg.kind === 'walk').map((leg) => leg.end)));
}

export const HOME_BY = DAY_SECONDS - 2.5;
export const MIN_FIELD_SECONDS = 12;
export const PACE = 210;
export const walkSeconds = (from: Vec, to: Vec, pace = PACE): number => Math.max(1, dist(from, to) * 1.15 / pace);
export const routeSeconds = (points: readonly Vec[], pace = PACE): number => Math.max(1, routeLength(points) / pace);

export interface Journey {
  out: Vec[]; on: Vec[]; back: Vec[];
  outward: number; onward: number; homeward: number;
  field: number;
  reachable: boolean;
}

type Route = (a: Vec, b: Vec) => Vec[] | null;

/** A walk that keeps to today's ford or bridge when the place has one; null when there is no way. */
function by(route: Route, a: Vec, b: Vec, via?: Vec): Vec[] | null {
  if (!via) return route(a, b);
  const first = route(a, via), last = route(via, b);
  return first && last ? [...first, ...last.slice(1)] : null;
}

export function journeyFor(w: World, plan: OutingPlan, origin?: Vec): Journey {
  const place = placeDef(plan.place);
  const index = w.state.people.findIndex((p) => p.id === plan.person);
  const home = seat(setOutFrom(w.state, place, plan.person), Math.max(0, index));
  const relocating = place.kind === 'settlement' && !plan.visitOnly;
  const lodging = lodgingById(w.state, plan.lodging);
  const overnight = overnightAt(w.state, plan.overnight);
  const destination = relocating ? seat(lodging?.fire ?? campOf(place.region).fire, Math.max(0, index)) : place.at;
  const farther = !plan.second && !relocating && !!place.farther && (plan.activity === 'explore' || plan.item === 'walking-staff');
  const end = farther ? place.farther!.at : destination;
  const route = (a: Vec, b: Vec) => w.route ? w.route(a, b) : [a, b];
  const via = relocating ? undefined : placeToday(place, w.today, w.state).via;
  const approach = (a: Vec, b: Vec): Vec[] | null => by(route, a, b, via);
  const returnTo = overnight ? seat(overnight.fire, Math.max(0, index)) : home;
  if (plan.second) {
    const second = placeDef(plan.second.place);
    const secondVia = placeToday(second, w.today, w.state).via;
    const out = approach(origin ?? home, destination), on = by(route, destination, second.at, secondVia), back = by(route, second.at, returnTo, secondVia);
    const pace = outingPace(plan), factor = w.route ? 1 : 1.15;
    const seconds = (points: Vec[] | null) => points ? routeSeconds(points, pace) * factor : Infinity;
    const outward = seconds(out), onward = seconds(on), homeward = seconds(back);
    return { out: out ?? [], on: on ?? [], back: back ?? [], outward, onward, homeward, field: Math.max(0, HOME_BY - outward - onward - homeward), reachable: !!out && !!on && !!back };
  }
  const out = approach(origin ?? home, destination), on = farther ? route(destination, end) : [], back = relocating ? [] : approach(end, returnTo);
  const pace = outingPace(plan), factor = w.route ? 1 : 1.15;
  const outward = out ? routeSeconds(out, pace) * factor : Infinity;
  const onward = farther ? (on ? routeSeconds(on, pace) * factor : Infinity) : 0;
  const homeward = relocating ? 0 : back ? routeSeconds(back, pace) * factor : Infinity;
  return { out: out ?? [], on: on ?? [], back: back ?? [], outward, onward, homeward,
    field: Math.max(0, HOME_BY - outward - onward - homeward), reachable: !!out && !!on && !!back };
}

/**
 * A moving day with a stop on the way: from where the friend slept to the
 * stop, then on to their seat at the new camp's fire. The same daylight
 * budget as any outing; `w.route` must reach the new reach.
 */
export function detourJourney(w: World, person: string, stop: SecondStop, from: Vec, to: Vec): Journey {
  const place = placeDef(stop.place);
  const route = (a: Vec, b: Vec) => w.route ? w.route(a, b) : [a, b];
  const via = placeToday(place, w.today, w.state).via;
  const out = by(route, from, place.at, via), back = by(route, place.at, to, via);
  const pace = outingPace({ person, place: stop.place, activity: stop.activity, item: null, companion: null }), factor = w.route ? 1 : 1.15;
  const outward = out ? routeSeconds(out, pace) * factor : Infinity, homeward = back ? routeSeconds(back, pace) * factor : Infinity;
  return { out: out ?? [], on: [], back: back ?? [], outward, onward: 0, homeward, field: Math.max(0, HOME_BY - outward - homeward), reachable: !!out && !!back };
}

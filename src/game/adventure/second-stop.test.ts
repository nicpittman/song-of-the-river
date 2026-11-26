import { expect, it } from 'vitest';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { newExpedition, plan, runUntil } from './testing';
import { HOME_BY, journeyFor, MIN_FIELD_SECONDS } from './travel';
import { planRoutes, planningPins } from '../../ui/notebook/planRoutes';
import { placeDef } from './content';

function nearbyTrip() {
  const game = newExpedition();
  game.a.state.day = 4;
  for (const id of ['suisha', 'hatake', 'yamagoya']) if (!game.a.state.known.includes(id)) game.a.state.known.push(id);
  return { ...game, outing: { ...plan('sora', 'suisha', 'fish'), second: { place: 'hatake', activity: 'forage' as const } } };
}

it('walks two short stops in order and returns before dusk, sharing the field time', () => {
  const { a, outing } = nearbyTrip();
  const trip = journeyFor(a.world(), outing);
  expect(trip.field).toBeGreaterThanOrEqual(MIN_FIELD_SECONDS * 2);
  expect(a.view().forecast(outing).problem).toBeNull();
  expect(a.assign(outing)).toEqual({ ok: true });
  a.begin();
  const actual = a.state.outings[0]!;
  const stops = actual.legs.filter((leg) => leg.kind === 'beat');
  expect(stops.map((leg) => leg.at)).toEqual([placeDef('suisha').at, placeDef('suisha').at, placeDef('hatake').at, placeDef('hatake').at]);
  expect(actual.legs.at(-1)!.end).toBeLessThanOrEqual(HOME_BY + .001);
  expect(actual.fork).toBeNull();
  expect(actual.bundles.some((bundle) => bundle.sourcePlace === 'hatake')).toBe(true);
});

it('saves a two-stop plan and in-flight outcome, then records both visits once', () => {
  const { a, sim, outing } = nearbyTrip();
  a.assign(outing);
  const planned = new Simulation(adventureValley, structuredClone(sim.state)).expedition!;
  expect(planned.state.plans[0]!.second).toEqual(outing.second);
  const before = { ...a.state.visits };
  a.begin(); runUntil(sim, () => a.state.elapsed >= 15);
  const resumed = new Simulation(adventureValley, structuredClone(sim.state));
  expect(resumed.expedition!.state.outings).toEqual(a.state.outings);
  runUntil(sim, () => a.view().eveningReady); a.collectReturns();
  runUntil(resumed, () => resumed.expedition!.view().eveningReady); resumed.expedition!.collectReturns();
  expect(a.state).toEqual(resumed.expedition!.state);
  expect(a.state.visits.suisha).toBe((before.suisha ?? 0) + 1);
  expect(a.state.visits.hatake).toBe((before.hatake ?? 0) + 1);
  const saved = structuredClone(a.state);
  a.collectReturns(); expect(a.state).toEqual(saved);
});

it('refuses a detour that leaves too little daylight, and rejects duplicate or overnight stops', () => {
  const { a, outing } = nearbyTrip();
  expect(a.assign({ ...outing, second: { place: 'yamagoya', activity: 'explore' } })).toMatchObject({ ok: false, reason: expect.stringMatching(/daylight|route|closed/i) });
  expect(a.assign({ ...outing, second: { place: 'suisha', activity: 'fish' } })).toMatchObject({ ok: false, reason: expect.stringContaining('different place') });
  expect(a.assign({ ...outing, overnight: 'yamagoya' }).ok).toBe(false);
});

it('draws both destinations in the route and places the person at the final stop', () => {
  const { a, outing } = nearbyTrip(); a.assign(outing);
  const view = a.view();
  const route = planRoutes(view, null, null).find((p) => p.person === 'sora')!;
  expect(route.destination).toBe('Suisha Mill → Hatake');
  expect(route.points.some((p) => p.x === view.places.find((place) => place.id === 'suisha')!.at.x && p.y === view.places.find((place) => place.id === 'suisha')!.at.y)).toBe(true);
  expect(route.points.at(-1)).toEqual(placeDef('hatake').at);
  expect(planningPins(view).find((p) => p.person === 'sora')!.at).toEqual(placeDef('hatake').at);
});

it('names the second destination and activity when the person reaches it', () => {
  const { a, outing } = nearbyTrip(); a.assign(outing);
  expect(a.view().friends.find((person) => person.id === 'sora')!.statusLine).toContain('Hatake');
  a.begin();
  const at = placeDef('hatake').at;
  const leg = a.state.outings[0]!.legs.find((leg) => leg.kind === 'beat' && leg.at?.x === at.x && leg.at?.y === at.y)!;
  a.state.elapsed = leg.start + .1;
  expect(a.view().friends.find((person) => person.id === 'sora')!.statusLine).toMatch(/Foraging.*Hatake/);
});

import { expect, it } from 'vitest';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { dist } from '../core/math';
import { seat } from './campSeats';
import { ECONOMY } from './economy';
import { campOf } from './regions';
import { newExpedition, runUntil } from './testing';
import { HOME_BY } from './travel';
import type { SecondStop } from './model';

/** The morning the group is ready to go down to Mio, with the move planned. */
function moveMorning(seed?: number) {
  const game = newExpedition(seed);
  const a = game.a;
  a.state.discoveries.waymark = { day: 1, by: 'sora' };
  a.state.provisions = 20; a.state.materials = 10; a.state.day = 5;
  for (const id of ['izumi', 'kagami']) if (!a.state.known.includes(id)) a.state.known.push(id);
  expect(a.moveEveryone('mio')).toEqual({ ok: true });
  return game;
}

const stop: SecondStop = { place: 'hatake', activity: 'forage' };

it('gives a friend a stop on the way, saves it with the plan, and takes it away again', () => {
  const { a, sim } = moveMorning();
  expect(a.view().detourStops('sora').length).toBeGreaterThan(0);
  expect(a.view().detour('sora', stop)).toMatchObject({ problem: null, length: 'Catches up at Mio by dusk' });
  expect(a.command({ type: 'detour', person: 'sora', stop })).toEqual({ ok: true });
  expect(a.state.plans.find((p) => p.person === 'sora')!.detour).toEqual(stop);
  expect(new Simulation(adventureValley, structuredClone(sim.state)).expedition!.state.plans).toEqual(a.state.plans);
  expect(a.command({ type: 'detour', person: 'sora', stop: null })).toEqual({ ok: true });
  expect(a.state.plans.every((p) => !p.detour && p.place === 'mio')).toBe(true);
});

it('refuses a stop that leaves too little daylight to reach the new camp by dusk', () => {
  const { a } = moveMorning();
  const far = a.detour('ren', { place: 'izumi', activity: 'explore' });
  expect(far).toMatchObject({ ok: false, reason: expect.stringMatching(/daylight.*Mio by dusk/) });
  expect(a.state.plans.find((p) => p.person === 'ren')!.detour).toBeUndefined();
  expect(a.detour('sora', { place: 'seseragi', activity: 'visit' }).ok).toBe(false);
});

it('walks to the stop, works there, and ends the day at a seat by the new camp’s fire', () => {
  const { a } = moveMorning();
  a.detour('sora', stop);
  expect(a.begin()).toEqual({ ok: true });
  expect(a.state.moving).toBe(true);
  const outing = a.state.outings.find((o) => o.person === 'sora')!;
  expect(outing.detour).toEqual(stop);
  expect(outing.legs.filter((leg) => leg.kind === 'beat' && leg.pose === 'forage').length).toBe(2);
  const walks = outing.legs.filter((leg) => leg.kind === 'walk');
  expect(walks.at(-1)!.end).toBeLessThanOrEqual(HOME_BY + 1e-6);
  const index = a.state.people.findIndex((p) => p.id === 'sora');
  expect(dist(walks.at(-1)!.points!.at(-1)!, seat(campOf(1).fire, index))).toBeLessThan(1);
  // The others still walk down together and arrive first.
  const others = a.state.outings.filter((o) => o.person !== 'sora');
  expect(Math.max(...others.flatMap((o) => o.legs.filter((l) => l.kind === 'walk').map((l) => l.end)))).toBeLessThan(walks.at(-1)!.end);
  runUntil(a.sim, () => a.state.phase === 'evening');
  expect(a.state.region).toBe(1);
  expect(a.state.people.every((p) => p.base === 1 && p.lodging === undefined)).toBe(true);
});

it('sets the stop’s bundles down at the new camp’s fire that evening', () => {
  const { a } = moveMorning();
  a.detour('sora', stop);
  a.begin();
  const bundles = a.state.outings.find((o) => o.person === 'sora')!.bundles;
  expect(bundles.length).toBeGreaterThan(0);
  expect(bundles.every((b) => b.sourcePlace === 'hatake')).toBe(true);
  expect(bundles.some((b) => b.kind === 'lead')).toBe(false);
  const provisions = a.state.provisions;
  const brought = bundles.reduce((n, b) => n + (b.kind === 'supplies' ? b.amount : 0), 0);
  runUntil(a.sim, () => a.state.phase === 'evening');
  expect(a.state.evening!.items.some((item) => item.person === 'sora' && bundles.some((b) => b.kind === item.kind))).toBe(true);
  a.collectReturns();
  // Upkeep is the only thing taken from what came home.
  expect(a.state.provisions).toBe(provisions + brought + ECONOMY.welcome[1]! - ECONOMY.dailyUpkeep);
});

it('records the stop as an ordinary outing, finds and all, after the reach has changed', () => {
  for (let seed = 1; seed < 80; seed++) {
    const { a } = moveMorning(seed);
    const visits = a.state.visits.hatake ?? 0;
    a.detour('sora', stop);
    a.begin();
    const find = a.state.outings.find((o) => o.person === 'sora')!.bundles.find((b) => b.kind === 'find');
    if (!find || find.kind !== 'find') continue;
    runUntil(a.sim, () => a.state.phase === 'evening');
    a.collectReturns();
    expect(a.state.region).toBe(1);
    expect(a.state.discoveries[find.find]).toMatchObject({ by: 'sora' });
    expect(a.state.visits.hatake).toBe(visits + 1);
    expect(a.state.people.find((p) => p.id === 'sora')!.practice.forage).toBeGreaterThan(0);
    expect(a.state.people.find((p) => p.id === 'sora')!.memories.some((m) => m.includes('Hatake'))).toBe(true);
    return;
  }
  throw new Error('No seed brought a find home from the stop.');
});

it('has creatures to catch by the road on a moving day', () => {
  const { a } = moveMorning();
  a.detour('sora', stop);
  a.begin();
  expect(a.state.sightings.length).toBeGreaterThan(0);
  expect(a.state.sightings.every((x) => x.appear >= 3)).toBe(true);
});

it('lets a friend moving camp within the reach stop on the way, and settle at the village by dusk', () => {
  const { sim, a } = newExpedition(7, true);
  const s = a.state;
  s.known.push('seseragi', 'kamimori', 'fuchi');
  for (const p of s.people) p.lodging = 'yamagoya';
  s.visits.seseragi = 1;
  const move = (person: string) => a.assign({ person, place: 'seseragi', activity: 'visit', item: null, companion: null });
  for (const p of s.people) expect(move(p.id)).toEqual({ ok: true });
  const sora = s.people[0]!.id;
  expect(a.view().plans.every((p) => p.moving)).toBe(true);
  const stops = a.detourStops(sora);
  expect(stops.length).toBeGreaterThan(0);
  expect(a.detour(sora, stops[0]!)).toEqual({ ok: true });
  expect(a.detourForecast(sora, stops[0]!).length).toBe('On to Seseragi by dusk');
  expect(a.begin().ok).toBe(true);
  const outing = s.outings.find((o) => o.person === sora)!;
  expect(outing.detour?.place).toBe(stops[0]!.place);
  const end = outing.legs.at(-1)!;
  expect(dist(end.at!, seat(campOf(0).fire, 0))).toBeLessThan(2);
  expect(outing.legs.filter((l) => l.kind === 'walk').at(-1)!.end).toBeLessThanOrEqual(HOME_BY + .01);
  runUntil(sim, () => s.phase === 'evening');
  expect(s.people.find((p) => p.id === sora)!.lodging).toBeUndefined();
});

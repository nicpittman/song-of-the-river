import { expect, it } from 'vitest';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { dist } from '../core/math';
import { DAY_SECONDS } from './calendar';
import { ECONOMY } from './economy';
import { GOT_AWAY } from './evening';
import { campOf } from './regions';
import { newExpedition, runUntil } from './testing';

for (const region of [0, 1]) it(`spends a visible travel day moving everyone from region ${region}, and resumes a mid-journey save`, () => {
  const { a, sim } = newExpedition();
  a.state.region = region;
  a.state.provisions = 30;
  a.state.discoveries[region === 0 ? 'long-view' : 'reed-way'] = { day: 1, by: 'sora' };
  a.state.buildings.push({ id: a.state.nextId++, kind: region === 0 ? 'lookout' : 'cottage', x: 320, y: region === 0 ? 2040 : 3200, region, work: region === 0 ? 0 : 2, placed: 1 });
  for (const person of a.state.people) person.base = region;
  // Include someone camping away from the main fire; migration brings everyone.
  if (region === 0) {
    a.state.known.push('yamagoya'); a.state.visits.yamagoya = 1;
    a.state.people[0]!.lodging = 'yamagoya';
  }
  const before = a.scene().figures.filter((figure) => figure.role === 'friend');
  expect(a.travel()).toEqual({ ok: true });
  expect(a.state.phase).toBe('day');
  expect(a.state.moving).toBe(true);
  expect(a.state.provisions).toBe(30 - ECONOMY.journeys[region]!);
  expect(sim.openBottom).toBeGreaterThan(campOf(region + 1).fire.y);
  expect(a.view().voyageCaption?.reach).toContain('Leaving');
  expect(a.state.outings).toHaveLength(a.state.people.length);
  runUntil(sim, () => a.state.elapsed >= DAY_SECONDS / 2);
  const halfway = a.scene().figures.filter((figure) => figure.role === 'friend');
  expect(halfway.every((figure, index) => dist(figure.at, before[index]!.at) > 100)).toBe(true);
  const saved = new Simulation(adventureValley, structuredClone(sim.state));
  expect(saved.expedition!.state).toEqual(a.state);
  expect(saved.openBottom).toBe(sim.openBottom);
  for (const game of [sim, saved]) {
    const rules = game.expedition!;
    runUntil(game, () => rules.state.phase === 'evening');
    expect(rules.state.region).toBe(region + 1);
    expect(rules.state.moving).toBe(false);
    expect(rules.state.people.every((person) => person.base === region + 1 && person.lodging === (region === 1 ? 'ashikari' : undefined))).toBe(true);
    rules.collectReturns();
    expect(rules.state.history[0]!.items?.filter((item) => !item.title.startsWith('Arrived in ') && item.title !== GOT_AWAY).every((item) => item.title.startsWith('Based in'))).toBe(true);
    expect(rules.state.history[0]!.items?.filter((item) => item.title === `Arrived in ${region === 0 ? 'Mio' : 'the reed beds'}`)).toHaveLength(1);
    rules.finishEvening(); rules.finishEvening();
    expect(rules.state.phase).toBe('morning');
    expect(rules.state.day).toBe(2);
    expect(rules.state.morning?.news[0]).toContain(region === 0 ? 'Mio' : 'Kawagiri');
  }
  expect(saved.expedition!.state).toEqual(a.state);
});

import { expect, it } from 'vitest';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { newExpedition, plan, playToMorning } from './testing';
import { homeName } from './world';

it('plans the whole group’s descent in one command and saves the existing travel plans', () => {
  const { a, sim } = newExpedition();
  a.state.known.push('yamagoya'); a.state.visits.yamagoya = 1;
  for (const person of a.state.people) person.lodging = 'yamagoya';
  a.assign(plan('sora', 'fuchi', 'explore'));
  expect(a.command({ type: 'move-everyone', place: 'seseragi' })).toEqual({ ok: true });
  expect(a.state.phase).toBe('morning');
  expect(a.state.plans.map((p) => [p.person, p.place])).toEqual([['sora', 'seseragi'], ['ren', 'seseragi'], ['mina', 'seseragi']]);
  const saved = new Simulation(adventureValley, structuredClone(sim.state));
  expect(saved.expedition!.state.plans).toEqual(a.state.plans);
  playToMorning(sim); playToMorning(saved);
  expect(saved.expedition!.state).toEqual(a.state);
  expect(a.state.people.every((p) => homeName(a.state, p.id) === 'Seseragi')).toBe(true);
});

it('keeps people already at the destination home and moves the others', () => {
  const { a } = newExpedition();
  a.state.known.push('yamagoya'); a.state.visits.yamagoya = 1;
  a.state.people[0]!.lodging = 'yamagoya';
  expect(a.moveEveryone('seseragi')).toEqual({ ok: true });
  expect(a.state.plans.map((p) => p.person)).toEqual(['sora']);
  expect(a.state.resting).toEqual(['ren', 'mina']);
});

it('never replaces plans partially or bypasses the next region’s route requirements', () => {
  const { a } = newExpedition(); a.assign(plan('sora', 'fuchi', 'explore'));
  const plans = structuredClone(a.state.plans);
  expect(a.moveEveryone('mio')).toMatchObject({ ok: false, reason: expect.stringContaining('miller') });
  expect(a.state.plans).toEqual(plans);
  expect(a.moveEveryone('fuchi').ok).toBe(false);
  expect(a.state.plans).toEqual(plans);
});

it('uses the existing chapter travel day once the route and supplies are prepared', () => {
  const { a } = newExpedition();
  a.state.discoveries.waymark = { day: 1, by: 'sora' };
  a.state.buildings.push({ id: a.state.nextId++, kind: 'shelter', x: 600, y: 2150, region: 0, work: 0, placed: 1 });
  a.state.provisions = 20;
  expect(a.moveEveryone('mio')).toEqual({ ok: true });
  expect(a.state.phase).toBe('morning'); expect(a.state.moving).toBe(false);
  expect(a.state.plans.map(p=>p.place)).toEqual(['mio','mio','mio']);
  expect(a.begin()).toEqual({ok:true});
  expect(a.state.moving).toBe(true); expect(a.state.phase).toBe('day');
  expect(a.state.outings.map((outing) => outing.place)).toEqual(['mio', 'mio', 'mio']);
});

it('cancels the shared chapter plan when someone is given a different outing or a day at camp',()=>{
  const {a}=newExpedition(); a.state.discoveries.waymark={day:1,by:'sora'};a.state.provisions=20;a.state.materials=10;
  expect(a.moveEveryone('mio').ok).toBe(true);
  expect(a.assign(plan('ren','suisha','fish')).ok).toBe(true);
  expect(a.state.plans.map(p=>p.place)).toEqual(['suisha']);
  expect(a.moveEveryone('mio').ok).toBe(true); a.cancelPlan('sora');
  expect(a.state.plans).toEqual([]);
  expect(a.moveEveryone('mio').ok).toBe(true); a.rest('ren');
  expect(a.state.plans).toEqual([]);expect(a.state.resting).toEqual(['ren']);
  a.begin();expect(a.state.moving).toBe(false);
});

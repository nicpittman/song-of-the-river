import { expect, it } from 'vitest';
import { dist } from '../core/math';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { stanceOf } from './scene';
import { newExpedition, plan, playToMorning } from './testing';
import { homeName } from './world';

it('walks to Seseragi together and waits for the welcome before settling at the new fire', () => {
  const { a, sim } = newExpedition(2086, true);
  a.assign(plan('sora','fuchi','explore')); playToMorning(sim);
  expect(a.moveEveryone('seseragi').ok).toBe(true);
  expect(a.begin().ok).toBe(true);
  const walks = a.state.outings.map(outing => outing.legs.filter(leg => leg.kind === 'walk')[1]!);
  // Single file: one clock, the follower a step behind, never on top of the leader.
  expect(Math.abs(walks[0]!.end - walks[1]!.end)).toBeLessThan(1.5);
  for (let t = walks[0]!.end * .3; t < walks[0]!.end * .9; t += .25) {
    a.state.elapsed = t;
    expect(dist(stanceOf(a,'sora').at,stanceOf(a,'ren').at)).toBeLessThan(130);
  }
  for (const outing of a.state.outings) for (const leg of outing.legs.filter(leg => leg.kind === 'walk')) expect(a.nav.clearAlong(leg.points!)).toBe(true);
  const saved = new Simulation(adventureValley, structuredClone(sim.state));
  playToMorning(sim); playToMorning(saved);
  expect(saved.expedition!.state).toEqual(a.state);
  expect(a.state.people.map(person => homeName(a.state, person.id))).toEqual(['Seseragi','Seseragi','Seseragi']);
  expect(a.state.discoveries['mina-meeting']).toBeTruthy();
});

it('uses one shared walking clock when several companions move to a shelter', () => {
  const { a, sim } = newExpedition();
  a.state.people.push({ id:'yui',base:0,practice:{},memories:[] });
  const shelter = { id: a.state.nextId++, kind:'shelter' as const, x:600,y:650,region:0,work:0,placed:1 };
  a.state.buildings.push(shelter);
  for (const person of a.state.people) expect(a.camp(person.id,shelter.id).ok).toBe(true);
  expect(a.begin().ok).toBe(true);
  const ends = a.state.outings.map(outing => outing.legs[1]!.end);
  expect(Math.max(...ends) - Math.min(...ends)).toBeLessThan(2);
  const arrival = a.state.outings[0]!.legs[1]!.end;
  for (let t = arrival * .35; t < arrival * .85; t += .3) {
    a.state.elapsed = t;
    const points = a.state.people.map(person => stanceOf(a, person.id).at);
    for (const p of points) expect(dist(p,points[0]!)).toBeLessThan(150);
  }
  playToMorning(sim);
  expect(a.state.people.every(person => person.lodging === shelter.id)).toBe(true);
});

it('keeps a regional journey together while preserving its arrival and welcome timing', () => {
  const { a, sim } = newExpedition();
  a.state.day=4; a.state.provisions=20; a.state.materials=20;
  a.state.discoveries.waymark={day:3,by:'sora'};
  expect(a.travel().ok).toBe(true);
  const arrivals = a.state.outings.map(outing => outing.legs.filter(leg => leg.kind === 'walk')[1]!.end);
  expect(Math.max(...arrivals) - Math.min(...arrivals)).toBeLessThan(2);
  expect(arrivals[0]).toBeGreaterThanOrEqual(24);
  expect(arrivals[0]).toBeLessThanOrEqual(30);
  for (let t=6;t<20;t+=.5) {
    a.state.elapsed=t;
    const points=a.state.people.map(person=>stanceOf(a,person.id).at);
    for(const p of points) expect(dist(p,points[0]!)).toBeLessThan(160);
  }
  playToMorning(sim);
  expect(a.state.region).toBe(1);
});

it('meets companions from separate overnight homes on the shared road and goes on together', () => {
  const { a, sim } = newExpedition();
  a.state.known.push('yamagoya'); a.state.visits.yamagoya=1;
  a.state.people.find(person=>person.id==='sora')!.lodging='yamagoya';
  a.state.day=4; a.state.provisions=20; a.state.materials=20;
  a.state.discoveries.waymark={day:3,by:'sora'};
  expect(a.travel().ok).toBe(true);
  const moving=a.state.outings.map(outing=>outing.legs.filter(leg=>leg.kind==='walk')[1]!);
  expect(Math.max(...moving.map(leg=>leg.end)) - Math.min(...moving.map(leg=>leg.end))).toBeLessThan(2);
  const joined=Math.max(...moving.map(leg=>leg.start));
  for(let t=joined+1;t<Math.min(...moving.map(leg=>leg.end))-1;t+=.5) {
    a.state.elapsed=t;
    const points=a.state.people.map(person=>stanceOf(a,person.id).at);
    for(const p of points) expect(dist(p,points[0]!)).toBeLessThan(160);
  }
  playToMorning(sim);
  expect(a.state.people.every(person=>homeName(a.state,person.id)==='Mio')).toBe(true);
});

it('walks a shared road in single file, a clear step apart', () => {
  const { a, sim } = newExpedition(2086, true);
  a.assign(plan('sora','fuchi','explore')); playToMorning(sim);
  expect(a.moveEveryone('seseragi').ok).toBe(true);
  expect(a.begin().ok).toBe(true);
  const road = a.state.outings.map(outing => outing.legs.filter(leg => leg.kind === 'walk')[1]!);
  const from = Math.max(...road.map(leg => leg.start)) + .5, to = Math.min(...road.map(leg => leg.end)) - .5;
  for (let t = from; t < to; t += .25) {
    a.state.elapsed = t;
    expect(dist(stanceOf(a,'sora').at, stanceOf(a,'ren').at)).toBeGreaterThan(20);
  }
});

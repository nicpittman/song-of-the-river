import { expect, it } from 'vitest';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { canWorkOn, workPoint, workTrip } from './construction';
import { newExpedition, plan, playToMorning, runUntil } from './testing';
import { readyToMove } from './progression';
import { structureDef } from './structures';
import { placeDef } from './content';
import { dist, pointSegment } from '../core/math';

const site = { x: 320, y: 2040 };
/** Story works (Aki's promise, the dock, the boat) keep real workdays; Mio's cottage is the usual one. */
const cottageSite = { x: 560, y: 3200 };
const farBank = { x: 1500, y: 2600 };
/** A narrows high in the Seseragi reach where a footbridge (a story work) may stand. */
const upperNarrows = { x: 1000, y: 340 };

function inMio(a: ReturnType<typeof newExpedition>['a'], materials = 6): void {
  a.state.day = 4; a.state.region = 1; a.state.materials = materials; a.state.provisions = 30;
  a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
  for (const person of a.state.people) { person.base = 1; delete person.lodging; }
  for (const id of ['toroya', 'kurumaya', 'tanada']) if (!a.state.known.includes(id)) a.state.known.push(id);
}

it('builds a story work over real workdays and names its reachable builders before charging', () => {
  const { a, sim } = newExpedition(2086, true);
  inMio(a);
  expect(a.siteBuilders('cottage', cottageSite)).toEqual(['Sora']);
  expect(a.place('cottage', cottageSite)).toEqual({ ok: true });
  expect(a.state.materials).toBe(6 - structureDef('cottage').cost);
  const building = a.state.buildings[0]!;
  expect(canWorkOn(a.state, 'sora', building, a.nav)).toBe(true);
  a.rest('sora'); playToMorning(sim);
  expect(building.work).toBeCloseTo(1, 6);
  expect(a.view().structures.find((s) => s.id === 'cottage')).toMatchObject({ workRemaining: 1, status: 'building', major: true });
  a.rest('sora'); playToMorning(sim);
  expect(building.work).toBe(2);
  expect(a.view().structures.find((s) => s.id === 'cottage')!.status).toBe('built');
});

it('puts a small work up at once, with nobody giving up their day', () => {
  const { a } = newExpedition(2086, true);
  a.state.day = 4; a.state.materials = 4; a.state.provisions = 20;
  expect(a.place('shelter', site)).toEqual({ ok: true });
  expect(a.state.materials).toBe(1);
  expect(a.view().lodgings.some((l) => l.id === a.state.buildings[0]!.id)).toBe(true);
  expect(a.view().structures.find((s) => s.id === 'shelter')).toMatchObject({ status: 'built', workRemaining: 0 });
});

it('saves real work on a story work and resumes to the same result', () => {
  const { a, sim } = newExpedition();
  inMio(a);
  a.place('cottage', cottageSite);
  a.rest('sora');
  expect(a.assign(plan('ren', 'kurumaya', 'fish')).ok).toBe(true);
  expect(a.assign(plan('mina', 'tanada', 'forage')).ok).toBe(true);
  a.begin(); runUntil(sim, () => a.state.elapsed >= 20);
  expect(a.state.buildings[0]!.work).toBeGreaterThan(0);
  expect(a.state.buildings[0]!.work).toBeLessThan(1);
  const saved = new Simulation(adventureValley, structuredClone(sim.state));
  playToMorning(sim); playToMorning(saved);
  expect(saved.expedition!.state).toEqual(a.state);
  expect(a.view().structures.find((s) => s.id === 'cottage')!.workRemaining).toBe(1);
});

it('refuses an unreachable story-work site without spending materials, but never a small work', () => {
  const { a } = newExpedition();
  inMio(a, 9);
  expect(workTrip(a.state, 'sora', { ...farBank, kind: 'cottage', region: 1 }, a.nav)).toBeNull();
  expect(a.place('cottage', farBank).ok).toBe(false);
  expect(a.state.materials).toBe(9);
  expect(a.state.buildings).toEqual([]);
  expect(a.siteProblem('garden', farBank)).toBeNull();
});

it('does no work while everyone is away, then completes with the people left at camp', () => {
  const { a, sim } = newExpedition();
  inMio(a);
  a.place('cottage', cottageSite);
  for (const p of [plan('sora', 'kurumaya', 'investigate'), plan('ren', 'kurumaya', 'fish'), plan('mina', 'tanada', 'forage')]) expect(a.assign(p).ok).toBe(true);
  playToMorning(sim);
  expect(a.state.buildings[0]!.work).toBe(0);
  a.rest('sora'); a.rest('ren'); playToMorning(sim);
  expect(a.state.buildings[0]!.work).toBe(2);
});

it('allows a new-region project after migration, and recovers unused materials from an abandoned site', () => {
  const { a, sim } = newExpedition();
  a.state.day = 4; a.state.provisions = 30; a.state.materials = 16;
  a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
  expect(a.place('bridge', upperNarrows).ok).toBe(true);
  const abandoned = a.state.buildings[0]!;
  a.state.discoveries.waymark = { day: 3, by: 'sora' };
  expect(readyToMove(a.state)).toBe(true);
  expect(a.travel().ok).toBe(true); playToMorning(sim);
  expect(a.state.region).toBe(1);
  expect(abandoned.work).toBe(0);
  expect(a.buildingProblem('cottage')).toBeNull();
  const before = a.state.materials;
  expect(a.command({ type: 'recover-building', id: abandoned.id })).toEqual({ ok: true });
  expect(a.state.materials).toBe(before + structureDef('bridge').cost);
  expect(a.state.buildings).toEqual([]);
  expect(a.command({ type: 'recover-building', id: abandoned.id }).ok).toBe(false);
  expect(a.state.materials).toBe(before + structureDef('bridge').cost); // Recovery is never paid twice.
});

it('recovers only unused materials and refuses completed buildings', () => {
  const { a } = newExpedition();
  a.state.materials = 0;
  a.state.buildings.push({ id: 91, ...cottageSite, kind: 'cottage', region: 1, work: 1, placed: 1 });
  expect(a.command({ type: 'recover-building', id: 91 }).ok).toBe(true);
  const half = Math.floor(structureDef('cottage').cost / 2);
  expect(a.state.materials).toBe(half);
  a.state.buildings.push({ id: 92, ...cottageSite, kind: 'cottage', region: 1, work: 2, placed: 1 });
  expect(a.command({ type: 'recover-building', id: 92 }).ok).toBe(false);
  expect(a.state.materials).toBe(half);
});

it('saves each builder’s contribution and reports projects in different regions correctly', () => {
  const { a, sim } = newExpedition();
  inMio(a);
  for (const person of a.state.people) person.base = person.id === 'sora' ? 0 : 1;
  const upper = { id: a.state.nextId++, ...upperNarrows, kind: 'bridge' as const, region: 0, work: 0, placed: 1 };
  a.state.buildings.push(upper);
  expect(a.place('cottage', cottageSite).ok).toBe(true);
  for (const person of a.state.people) a.rest(person.id);
  a.begin(); runUntil(sim, () => a.state.elapsed >= 20);
  const saved = new Simulation(adventureValley, structuredClone(sim.state));
  playToMorning(sim); playToMorning(saved);
  expect(saved.expedition!.state).toEqual(a.state);
  expect(upper.work).toBeCloseTo(1, 6);
  const items = a.state.history[0]!.items!;
  expect(items.some((item) => item.person === 'sora' && item.title === 'River footbridge' && item.text.includes('One more day'))).toBe(true);
  expect(items.some((item) => item.person === 'ren' && item.title === 'Village cottage' && item.text === 'Finished today.' && !!item.outcome)).toBe(true);
  expect(items.some((item) => item.person === 'mina' && item.title === 'River footbridge')).toBe(false);
});

it('keeps building the story work when a small work is placed during the day', () => {
  const { a, sim } = newExpedition();
  inMio(a, 8);
  expect(a.place('cottage', cottageSite).ok).toBe(true);
  a.rest('sora'); a.begin();
  runUntil(sim, () => a.state.elapsed >= 10);
  expect(a.state.phase).toBe('day');
  expect(a.place('garden', { x: 400, y: 3320 }).ok).toBe(true);
  expect(a.state.buildings[1]!.kind).toBe('garden');
  runUntil(sim, () => a.state.elapsed >= 20);
  const cottage = a.state.buildings[0]!;
  expect(cottage.work).toBeGreaterThan(0);
  expect(dist(a.scene().figures.find((f) => f.id === 'sora')!.at, workPoint(cottage, 0))).toBeLessThan(1);
  playToMorning(sim);
  const projects = a.state.history[0]!.items!.filter((item) => item.person === 'sora').map((item) => item.title);
  expect(projects).toContain('Village cottage');
  expect(a.view().structures.find((s) => s.id === 'garden')!.status).toBe('built');
});

it('puts the old-road pin on the physical ruts, with a continuous join into Mio', () => {
  const road = placeDef('furumichi');
  const lanes = adventureValley.lanes!.filter((lane) => lane.ruts);
  const near = lanes.flatMap((lane) => lane.points.slice(1).map((p, i) => pointSegment(road.at, lane.points[i]!, p).d));
  expect(Math.min(...near)).toBeLessThan(1);
  const upper = lanes.find((lane) => lane.points.some((p) => p.y === 2400))!;
  const lower = lanes.find((lane) => lane !== upper && lane.points[0]!.y === 2500)!;
  expect(upper.points.at(-1)).toEqual(lower.points[0]);
});

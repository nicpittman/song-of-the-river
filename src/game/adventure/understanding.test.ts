import { expect, it } from 'vitest';
import { newExpedition, plan, playToMorning, runUntil } from './testing';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { departureOf, gateOpen, goalLine, newMembers } from './progression';
import { NARROWS } from './structures';
import { homeName } from './world';
import { arrivalOf } from './travel';
import { tomorrowFor } from './evening';
import { assess } from './odds';
import { crestTime, type RevealPlan } from '../rendering/adventure/reveal';
import { placeDef } from './content';

it('brings Mina home with Ren after an individual village move, including an in-flight save', () => {
  const { a, sim } = newExpedition(2086, true);
  a.assign(plan('sora', 'fuchi', 'explore')); playToMorning(sim);
  expect(a.assign(plan('ren', 'seseragi', 'visit')).ok).toBe(true);
  a.begin(); runUntil(sim, () => a.state.elapsed >= 15);
  const saved = new Simulation(adventureValley, structuredClone(sim.state));
  for (const game of [sim, saved]) {
    playToMorning(game); const state = game.expedition!.state;
    expect(homeName(state, 'sora')).toBe('Yamagoya');
    expect(homeName(state, 'ren')).toBe('Seseragi');
    expect(homeName(state, 'mina')).toBe('Seseragi');
    expect(state.history[0]!.items!.filter((item) => item.sketch === 'mina-meeting')).toHaveLength(1);
  }
  expect(saved.expedition!.state).toEqual(a.state);
});

it.each([['reeds', 'reed-way'], ['herons', 'heron-way'], ['high-path', 'high-path']] as const)('accepts either promised Mio project in a %s year after surveying %s', (way, find) => {
  for (const kind of ['cottage', 'bridge'] as const) {
    const { a } = newExpedition(); const s = a.state;
    s.course = { ...s.course, way };
    s.region = 1; s.discoveries['aki-meeting'] = { day: 1, by: 'sora' }; s.discoveries[find] = { day: 1, by: 'sora' };
    s.buildings.push({ id: 1, kind, ...NARROWS, region: 1, placed: 1, work: kind === 'cottage' ? 3 : 2 });
    expect(gateOpen(s)).toBe(true); expect(newMembers(s)).toContain('aki');
    expect(departureOf(s)?.prepared).toBe(true); expect(goalLine(s)).not.toContain('Help');
  }
});

it('requires the actual Mio promise rather than a cottage or bridge in another reach', () => {
  const { a } = newExpedition(); a.state.region = 1;
  a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' }; a.state.discoveries['reed-way'] = { day: 1, by: 'sora' };
  a.state.buildings.push({ id: 1, kind: 'cottage', x: 400, y: 1900, region: 0, placed: 1, work: 2 });
  expect(gateOpen(a.state)).toBe(false); expect(newMembers(a.state)).not.toContain('aki');
});

it('does not name Mina before the group meets her', () => {
  const { a, sim } = newExpedition(2086, true);
  a.assign(plan('sora', 'fuchi', 'explore')); playToMorning(sim);
  expect(goalLine(a.state)).toContain('Seseragi'); expect(goalLine(a.state)).not.toContain('Mina');
});

it('keeps Sora aboard in Journey, while Free Play retains its choice of sailors', () => {
  const { a } = newExpedition(); const s = a.state;
  s.region = 2; s.provisions = 20;
  s.buildings.push({ id: 1, kind: 'boat', x: 820, y: 5350, region: 2, placed: 1, work: 3 });
  for (const id of ['mended-sail', 'tide-marks']) s.discoveries[id] = { day: 1, by: 'sora' };
  expect(a.sail(['ren'])).toMatchObject({ ok: false, reason: expect.stringContaining('Sora') });
  expect(s.provisions).toBe(20); expect(s.voyage).toBe('preparing');
  s.free = true; expect(a.sail(['ren']).ok).toBe(true);
});

it('records the evening lead and its destination in history across a reload', () => {
  const { a, sim } = newExpedition();
  a.assign(plan('sora', 'suisha', 'visit')); playToMorning(sim);
  const entry = a.state.history[0]!; expect(entry.tomorrowPlace).toBeTruthy();
  const saved = new Simulation(adventureValley, structuredClone(sim.state));
  expect(saved.expedition!.state.history[0]).toEqual(entry);
});

it('does not point tomorrow’s main lead at an unbridged far bank', () => {
  const { a } = newExpedition(); const s = a.state;
  s.region = 1; for (const person of s.people) person.base = 1;
  s.known.push('mio', 'toroya', 'kitsuneyama');
  const lead = { id: 'test-herons', place: 'kitsuneyama', find: 'heron-way', line: 'Look at Kitsuneyama Shrine.', given: s.day, expires: s.day + 2 };
  const result = tomorrowFor(a.world(), { items: [], effects: [{ person: 'sora', provisions: 0, materials: 0, find: null, lead }], shown: 0, tomorrow: '', settled: true }, a.world(s.day + 1));
  expect(result.place).not.toBe('kitsuneyama'); expect(result.line).toBeTruthy();
});

it('only warns about survey time when the environmental conditions actually permit that survey', () => {
  const { a } = newExpedition(); const s = a.state; s.region = 1;
  for (const person of s.people) person.base = 1;
  const w = a.world(); const outing = plan('sora', 'omagari', 'investigate');
  const at = (level: 'low' | 'high') => assess({ ...w, today: { ...w.today, level } }, outing, 2);
  expect(at('low').reasons.some((reason) => reason.text.includes('sleep nearer'))).toBe(true);
  expect(at('high').reasons.some((reason) => reason.text.includes('sleep nearer'))).toBe(false);
});

it('matches the Mio welcome to the group’s actual arrival, also after resuming travel', () => {
  const { a, sim } = newExpedition();
  a.state.provisions = 20; a.state.discoveries.waymark = { day: 1, by: 'sora' };
  expect(a.travel().ok).toBe(true);
  const arrival = arrivalOf(a.state.outings);
  expect(arrival).toBeGreaterThanOrEqual(24); expect(arrival).toBeLessThanOrEqual(30);
  runUntil(sim, () => a.state.elapsed >= arrival - 2);
  expect(a.view().voyageCaption?.reach).toBeNull();
  const saved = new Simulation(adventureValley, structuredClone(sim.state)); const target = placeDef('mio');
  const reveal: RevealPlan = { id: 'mio', from: 2800, to: 4800, arrival: arrivalOf(saved.expedition!.state.outings), landmarks: [{ id: target.id, name: target.name, at: target.at, settlement: true }] };
  expect(crestTime(reveal)).toBeGreaterThanOrEqual(arrival);
  for (const game of [sim, saved]) {
    runUntil(game, () => game.expedition!.state.elapsed >= arrival + .1);
    expect(game.expedition!.view().voyageCaption?.reach).toBe('Mio');
  }
});

it('marks a traveller’s portrait only while their first conversation is happening', () => {
  const { a } = newExpedition(); a.assign(plan('sora', 'suisha', 'visit')); a.begin();
  const beat = a.state.outings[0]!.legs.find((leg) => leg.kind === 'beat')!;
  a.state.elapsed = beat.start + .1;
  expect(a.view().friends.filter((friend) => friend.storyNow).map((friend) => friend.id)).toEqual(['sora']);
  a.state.phase = 'evening'; expect(a.view().friends.some((friend) => friend.storyNow)).toBe(false);
});

it('makes the first sight of the sea reliable and distinct from setting sail', () => {
  const { a } = newExpedition(); a.state.region = 2;
  for (const person of a.state.people) person.base = 2;
  a.state.known.push('shirahama');
  const sure = assess(a.world(), plan('sora', 'shirahama', 'explore')).sure;
  expect(sure?.id).toBe('first-sea');
});

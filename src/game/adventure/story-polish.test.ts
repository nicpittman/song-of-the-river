import { expect, it } from 'vitest';
import { newExpedition, plan, playToMorning, runUntil } from './testing';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { buildTags } from './view';
import { findPossible } from './conditions';
import { findDef, placeDef } from './content';
import { outingCost } from './economy';
import { gateOpen, readyToMove } from './progression';
import { journeyMemories } from '../../ui/notebook/journeyMemories';

it.each(['sora', 'ren'])('records %s’s current crossing observation at Furumichi in the daily recap', person => {
  const { a, sim } = newExpedition();
  a.state.day = 5; a.state.provisions = 20;
  if (!a.state.known.includes('furumichi')) a.state.known.push('furumichi');
  expect(a.assign(plan(person, 'furumichi', 'explore')).ok).toBe(true);
  playToMorning(sim);
  const report = a.state.history.find(day => day.day === 5)!.items!.find(item => item.person === person && item.title === 'At Furumichi');
  expect(report?.text).toContain('stream crossing');
  expect(report?.text).toContain('over the stream and into the mist');
});

it('makes the building promise the outcome of meeting Aki in the daily recap', () => {
  const { a, sim } = newExpedition();
  a.state.region = 1; a.state.provisions = 20;
  for (const person of a.state.people) person.base = 1;
  if (!a.state.known.includes('toroya')) a.state.known.push('toroya');
  expect(a.assign(plan('sora', 'toroya', 'visit')).ok).toBe(true);
  playToMorning(sim);
  const meeting = a.state.history[0].items!.find(item => item.sketch === 'aki-meeting');
  expect(meeting?.outcome).toContain('help Aki build a cottage or footbridge in Mio');
  expect(meeting?.outcome).toContain('he’ll come with us');
});

it('visits Seseragi, receives its welcome, and returns to the mountain camp after a save', () => {
  const { a, sim } = newExpedition(2086, true);
  a.state.known.push('seseragi');
  expect(a.view().places.find((p) => p.id === 'seseragi')!.home).toBe(false);
  expect(a.assign({ ...plan('sora', 'seseragi', 'visit'), visitOnly: true }).ok).toBe(true);
  const saved = new Simulation(adventureValley, structuredClone(sim.state));
  expect(saved.expedition!.state.plans[0]!.visitOnly).toBe(true);
  saved.expedition!.begin();
  const travelling = new Simulation(adventureValley, structuredClone(saved.state));
  playToMorning(travelling);
  const state = travelling.expedition!.state;
  expect(state.people[0]!.lodging).toBe('yamagoya');
  expect(state.visits.seseragi).toBe(1);
  expect(state.discoveries['seseragi-welcome']).toBeDefined();
  expect(travelling.expedition!.view().places.find((p) => p.id === 'seseragi')!.home).toBe(false);
});

it('keeps individual camp moves separate from a return visit', () => {
  const { a, sim } = newExpedition(2086, true);
  a.state.known.push('seseragi');
  expect(a.assign(plan('sora', 'seseragi', 'visit')).ok).toBe(true);
  playToMorning(sim);
  expect(a.state.people[0]!.lodging).toBeUndefined();
  expect(a.view().places.find((p) => p.id === 'seseragi')!.home).toBe(true);
});

it('always leaves a food-gathering recovery at zero provisions', () => {
  const { a, sim } = newExpedition();
  a.state.provisions = 0;
  expect(a.assign(plan('sora', 'kamimori', 'explore'))).toMatchObject({ ok: false, reason: expect.stringContaining('packs are empty') });
  expect(outingCost(a.world(), plan('sora', 'kagami', 'forage'))).toBe(0);
  expect(a.assign(plan('ren', 'suisha', 'fish')).ok).toBe(true);
  playToMorning(sim);
  expect(a.state.provisions).toBeGreaterThan(0);
});

it('keeps Mina’s mint for a later day, then saves it as a real illustrated keepsake', () => {
  const { a, sim } = newExpedition(2086, true);
  expect(a.assign(plan('sora', 'kamimori', 'explore')).ok).toBe(true);
  playToMorning(sim);
  expect(a.state.people.some((p) => p.id === 'mina')).toBe(true);
  // A memory of the day we met is never found on that same day.
  expect(a.state.discoveries['wild-mint']).toBeUndefined();
  expect(findPossible(findDef('wild-mint'), placeDef('kamimori'), 'forage', a.world().today, a.state)).toBe(true);
  a.state.discoveries['wild-mint'] = { day: a.state.day, by: 'mina' };
  const saved = new Simulation(adventureValley, structuredClone(sim.state));
  expect(saved.expedition!.view().journal.find((e) => e.id === 'wild-mint')).toMatchObject({ found: true, name: 'Mina’s wild mint' });
  const memories = journeyMemories(saved.expedition!.view());
  expect(memories.map((e) => e.id)).toContain('wild-mint');
  expect(memories.length).toBeLessThanOrEqual(4);
  expect(memories.every((e) => e.found)).toBe(true);
});

it('lets Mina receive Ren’s reply, with readable dialogue and no abrupt encounter tag afterwards', () => {
  const { a } = newExpedition();
  a.state.people = a.state.people.filter((p) => p.id !== 'ren');
  a.state.known.push('fuchi');
  expect(a.assign(plan('mina', 'fuchi', 'investigate')).ok).toBe(true);
  a.begin();
  const outing = a.state.outings[0]!;
  expect(outing.bundles).toContainEqual({ kind: 'find', find: 'ren-meeting' });
  const beats = outing.legs.filter((leg) => leg.kind === 'beat');
  const heard = new Set<string>();
  for (const beat of beats) for (let time = beat.start + .1; time < beat.end; time += .2) {
    a.state.elapsed = time;
    for (const tag of buildTags(a).filter((tag) => tag.person)) {
      expect(tag.id).toMatch(/^meeting-/);
      heard.add(tag.text);
    }
  }
  expect([...heard].some((text) => text.startsWith('Mina:') && text.includes('sea'))).toBe(true);
  expect([...heard].some((text) => text.startsWith('Ren:') && text.includes('salt'))).toBe(true);
  expect([...heard].some((text) => text.startsWith('Ren:') && text.includes('Someone has to cook'))).toBe(true);
});

it('learns the old road from the miller rather than an unrelated fishing visit', () => {
  const { a, sim } = newExpedition();
  a.assign(plan('ren', 'suisha', 'fish')); playToMorning(sim);
  expect(a.state.known).not.toContain('furumichi');
  expect(a.state.rumoured).not.toContain('furumichi');
  a.assign(plan('ren', 'suisha', 'visit')); playToMorning(sim);
  expect(a.state.discoveries.miller).toBeDefined();
  expect(a.state.known).toContain('furumichi');
});

it('does not leave the first reach before Ren and Mina have joined', () => {
  const { a } = newExpedition(2086, true);
  a.state.discoveries.waymark = { day: 1, by: 'sora' }; a.state.provisions = 20;
  a.state.buildings.push({ id: 100, kind: 'shelter', x: 400, y: 2100, region: 0, placed: 1, work: 0 });
  expect(gateOpen(a.state)).toBe(true);
  expect(readyToMove(a.state)).toBe(false);
  a.state.people.push(...['ren', 'mina'].map((id) => ({ id, base: 0, practice: {}, memories: [] })));
  expect(readyToMove(a.state)).toBe(true);
});

it('points to provisions after surveying the first route, without a building chore', () => {
  const { a, sim } = newExpedition();
  a.state.discoveries.waymark = { day: 1, by: 'sora' };
  a.state.provisions = 1;
  a.rest('sora'); a.begin();
  runUntil(sim, () => a.state.phase === 'evening'); a.collectReturns();
  // The packing count is the small note; the lead itself names a place.
  expect(a.view().evening!.tomorrowNote).toContain('provisions');
  expect(a.view().evening!.tomorrowNote).not.toContain('shelter');
  expect(a.view().evening!.tomorrow).not.toMatch(/^Pack|Camp −/);
  expect(a.view().evening!.tomorrowPlace).toBeTruthy();
  playToMorning(sim);
  expect(a.state.history[0]!.tomorrow).not.toContain('shelter');
});

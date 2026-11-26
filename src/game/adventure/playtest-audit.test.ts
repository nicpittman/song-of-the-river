import { expect, it } from 'vitest';
import { newExpedition, plan, playToMorning } from './testing';
import { WAYS } from './course';
import { departureOf, gateOpen, goalLine } from './progression';
import { assess } from './odds';
import { NARROWS } from './structures';
import { placeDef } from './content';
import { isOpen } from './conditions';
import { scheduleSightings } from './sightings';
import { morningStatus } from '../../ui/notebook/morning';
import { suggestedOutings } from '../../ui/notebook/recommendations';

it.each(WAYS)('lets the cottage-only choice reach Kawagiri in a %s run, with Ren surveying the west bank', way => {
  const { a, sim } = newExpedition(2086, false, { ren: 'fuchi', mina: 'seseragi', way });
  a.state.region = 1; a.state.provisions = 30; a.state.materials = 10;
  for (const person of a.state.people) { person.base = 1; delete person.lodging; }
  a.state.known.push('mio', 'toroya', 'omagari');
  a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
  a.state.buildings.push({ id: 100, kind: 'cottage', region: 1, x: 500, y: 3210, work: 2, placed: 1 });
  while (a.world().today.level !== 'low' && a.state.day < 40) playToMorning(sim);
  expect(goalLine(a.state)).toMatch(/Omagari|way to Kawagiri/);
  const outing = plan('ren', 'omagari', 'investigate');
  expect(a.view().forecast(outing).problem).toBeNull();
  expect(assess(a.world(), outing).sure?.id).toBe('reed-way');
  expect(a.assign(outing).ok).toBe(true); playToMorning(sim);
  expect(a.state.discoveries['reed-way']?.by).toBe('ren');
  expect(a.state.course.way).toBe('reeds');
  expect(gateOpen(a.state)).toBe(true);
  expect(a.state.buildings.some(site => site.kind === 'bridge')).toBe(false);
  a.state.provisions = 30;
  expect(a.moveEveryone('kawagiri').ok).toBe(true);
  playToMorning(sim); expect(a.state.region).toBe(2);
});

it.each(['sora', 'ren', 'mina'])('allows %s to survey the herons from Mio without a mandatory overnight shelter', person => {
  const { a } = newExpedition(); a.state.region = 1;
  for (const friend of a.state.people) { friend.base = 1; delete friend.lodging; }
  a.state.known.push('mio', 'kitsuneyama');
  a.state.buildings.push({ id: 100, kind: 'bridge', region: 1, ...NARROWS, work: 2, placed: 1 });
  const w = a.world();
  const assessment = assess({ ...w, today: { ...w.today, weather: 'clear' } }, plan(person, 'kitsuneyama', 'explore'));
  expect(assessment.problem).toBeNull(); expect(assessment.sure?.id).toBe('heron-way');
});

it.each(WAYS.flatMap(way => ['omagari', 'ashiura'].flatMap(place => ['sora', 'ren', 'mina'].map(person => ({ way, place, person })))))
('keeps the cottage route usable from $place at middle water for $person in a $way run', ({ way, place, person }) => {
  const { a, sim } = newExpedition(2086, false, { ren: 'fuchi', mina: 'seseragi', way });
  a.state.region = 1; a.state.day = 3; a.state.provisions = 30; a.state.materials = 10;
  for (const friend of a.state.people) { friend.base = 1; delete friend.lodging; }
  a.state.known.push('mio', 'toroya', 'omagari', 'ashiura', 'kitsuneyama');
  a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
  a.state.buildings.push({ id: 100, kind: 'cottage', region: 1, x: 500, y: 3210, work: 2, placed: 1 });
  expect(a.world().today.level).toBe('middle');
  expect(departureOf(a.state)?.place).toBe('omagari');
  const outing = plan(person, place, 'investigate');
  expect(a.view().forecast(outing).problem).toBeNull();
  expect(assess(a.world(), outing).sure?.id).toBe('reed-way');
  expect(a.assign(outing).ok).toBe(true); playToMorning(sim);
  expect(a.state.discoveries['reed-way']?.by).toBe(person);
  expect(gateOpen(a.state)).toBe(true);
  expect(a.state.buildings.some(site => site.kind === 'bridge')).toBe(false);
});

it('keeps Ashiura’s higher bank visitable in a flood, but never awards a hidden-stakes survey', () => {
  const { a } = newExpedition();
  a.state.region = 1; a.state.known.push('ashiura');
  for (const friend of a.state.people) friend.base = 1;
  expect(a.world().today.level).toBe('high');
  const forecast = assess(a.world(), plan('sora', 'ashiura', 'investigate'));
  expect(forecast.problem).toBeNull();
  expect(forecast.sure?.id).not.toBe('reed-way');
});

it('allows Begin the day immediately after placing a story project, and everyone available builds', () => {
  const { a, sim } = newExpedition(); a.state.region = 1;
  for (const friend of a.state.people) friend.base = 1;
  a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' }; a.state.materials = 20;
  expect(a.place('cottage', { x: 500, y: 3210 }).ok).toBe(true);
  expect(a.state.plans).toEqual([]); expect(a.state.resting).toEqual([]);
  expect(morningStatus(a.view())?.ready).toBe(true);
  expect(a.begin().ok).toBe(true); playToMorning(sim);
  expect(a.state.buildings.find(site => site.kind === 'cottage')?.work).toBe(2);
});

it('offers the unlocked Mio journey among the three morning invitations', () => {
  const { a } = newExpedition(); a.state.day = 4;
  a.state.discoveries.waymark = { day: 3, by: 'sora' }; a.state.provisions = 20; a.state.materials = 5;
  expect(a.view().canTravel).toBe(true);
  expect(suggestedOutings(a.view()).some(row => row.place === 'mio' && row.purpose === 'move-camp')).toBe(true);
});

it('does not schedule another timed target for a sketch already in the journal', () => {
  const { a } = newExpedition();
  a.state.discoveries['cherry-salmon'] = { day: 1, by: 'sketch' }; a.state.tracked = ['cherry-salmon'];
  a.rest('sora'); a.begin();
  expect(scheduleSightings(a.world()).some(sighting => sighting.find === 'cherry-salmon')).toBe(false);
});

it('keeps Ashiura’s arrival on dry ground', () => {
  const { a } = newExpedition();
  expect(a.nav.walkable(placeDef('ashiura').at)).toBe(true);
  expect(isOpen(placeDef('furumichi'), { ...a.world().today, level: 'high' }, a.state)).toBe(true);
});

it('brings Yui and her sail to the completed dock in the same evening', () => {
  const { a, sim } = newExpedition(); a.state.region = 2; a.state.provisions = 20;
  for (const friend of a.state.people) friend.base = 2;
  a.state.known.push('kawagiri', 'takayuka');
  a.state.buildings.push({ id: 100, kind: 'dock', region: 2, x: 1800, y: 5800, work: 2, placed: 1 });
  expect(a.assign(plan('sora', 'takayuka', 'visit')).ok).toBe(true); playToMorning(sim);
  expect(a.state.people.some(person => person.id === 'yui')).toBe(true);
  expect(a.state.discoveries['mended-sail']).toBeDefined();
  expect(a.state.history[0]!.items!.some(item => item.sketch === 'mended-sail')).toBe(true);
});

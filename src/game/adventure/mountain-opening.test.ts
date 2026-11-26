import { describe, expect, it } from 'vitest';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { dist } from '../core/math';
import { DAY_SECONDS } from './calendar';
import { newExpedition, plan, playToMorning, runUntil } from './testing';
import { lodgingById, homeName } from './world';
import { journeyFor, HOME_BY } from './travel';
import { assess } from './odds';
import { standoutOf } from '../../ui/notebook/evening';
import { campPoint } from '../../ui/notebook/campPoint';
import { newAdventure } from './state';
import { hasSketch } from '../../ui/sketches';

const reload = (sim: Simulation) => new Simulation(adventureValley, structuredClone(sim.state));

for (const seed of [1, 2, 2086]) it(`reaches Mio in under nine days with one daily outing and no compulsory shelter (seed ${seed})`, () => {
  const { a, sim } = newExpedition(seed, true);
  const choose = (outing: ReturnType<typeof plan>) => expect(a.assign(outing)).toEqual({ ok: true });
  while (a.state.region === 0 && a.state.day <= 9) {
    const s = a.state;
    if (a.view().canTravel) expect(a.travel()).toEqual({ ok: true });
    else if (!s.people.some((p) => p.id === 'ren')) choose(plan('sora', 'fuchi', 'explore'));
    else if (!s.people.some((p) => p.id === 'mina')) choose(plan('sora', 'kamimori', 'explore'));
    else if (s.people.some((p) => p.lodging !== undefined)) expect(a.command({ type: 'move-everyone', place: 'seseragi' })).toEqual({ ok: true });
    else if (s.provisions <= 1) choose(s.known.includes('hatake') ? plan('sora', 'hatake', 'forage') : plan('sora', 'fuchi', 'fish'));
    else if (!s.discoveries.miller) choose(plan('sora', 'suisha', 'visit'));
    else if (!s.discoveries.waymark && !a.view().forecast(plan('sora', 'furumichi', 'explore')).problem) choose(plan('sora', 'furumichi', 'explore'));
    else choose(plan('sora', s.known.includes('hatake') ? 'hatake' : 'kamimori', 'forage'));
    if (!s.moving && s.plans[0]?.place !== 'seseragi') expect(s.plans.length).toBeLessThanOrEqual(1);
    playToMorning(sim);
  }
  expect(a.state.region).toBe(1);
  expect(a.state.day - 1).toBeLessThanOrEqual(9);
  expect(a.state.people.map((p) => p.id)).toEqual(['sora', 'ren', 'mina']);
  expect(a.state.discoveries.miller).toBeDefined();
  expect(a.state.discoveries.waymark).toBeDefined();
  expect(a.state.buildings).toEqual([]);
  expect(reload(sim).expedition!.state).toEqual(a.state);
});

describe('a mountain beginning', () => {
  it('starts a real new journey alone at the ridge hut and preserves it on reload', () => {
    const { sim, a } = newExpedition(2086, true);
    expect(a.state.day).toBe(1);
    expect(a.state.people.map((p) => p.id)).toEqual(['sora']);
    expect(homeName(a.state, 'sora')).toBe('Yamagoya');
    expect(a.state.known).not.toContain('furumichi');
    expect(a.state.known).not.toContain('seseragi');
    expect(a.scene().fire.y).toBeLessThan(800);
    expect(campPoint(a.view())!.y).toBeLessThan(800);
    expect(reload(sim).expedition!.state).toEqual(a.state);
    expect(newAdventure(true).people.map((p) => p.id)).toEqual(['haru', 'yui']);
  });

  it('meets companions through reliable outings, then moves down to the existing village', () => {
    for (const seed of [1, 2086]) {
      const { sim, a } = newExpedition(seed, true);
      expect(a.scene().figures.some((p) => p.id === 'meeting-ren')).toBe(true);
      expect(a.assign(plan('sora', 'fuchi', 'explore'))).toEqual({ ok: true });
      playToMorning(sim);
      expect(a.state.people.map((p) => p.id)).toEqual(['sora', 'ren']);
      expect(homeName(a.state, 'ren')).toBe('Yamagoya');
      expect(a.state.known).toContain('seseragi');
      expect(a.state.history[0]!.items!.some((item) => item.title === 'Met Ren')).toBe(true);
      expect(a.assign(plan('sora', 'kamimori', 'explore'))).toEqual({ ok: true });
      playToMorning(sim);
      expect(a.state.people.map((p) => p.id)).toEqual(['sora', 'ren', 'mina']);
      for (const person of a.state.people) expect(a.assign(plan(person.id, 'seseragi', 'visit'))).toEqual({ ok: true });
      playToMorning(sim);
      expect(a.state.people.every((p) => p.lodging === undefined)).toBe(true);
      expect(homeName(a.state, 'sora')).toBe('Seseragi');
      expect(reload(sim).expedition!.state).toEqual(a.state);
    }
  });
});

describe('an outing that stays overnight', () => {
  it('uses one day for exploration and lodging, without walking back to the old base', () => {
    const { sim, a } = newExpedition();
    a.state.known.push('yamagoya'); a.state.visits.yamagoya = 1;
    const outing = { ...plan('sora', 'yamagoya', 'explore'), overnight: 'yamagoya' };
    a.state.discoveries['carved-steps'] = { day: 1, by: 'sora' }; // The route clue is already known; test the daylight budget.
    expect(assess(a.world(), plan('sora', 'yamagoya', 'explore')).sure?.id).not.toBe('long-view');
    expect(assess(a.world(), outing).sure?.id).toBe('long-view');
    expect(journeyFor(a.world(), outing).homeward).toBeLessThan(journeyFor(a.world(), plan('sora', 'yamagoya', 'explore')).homeward);
    expect(a.assign(outing)).toEqual({ ok: true });
    expect(reload(sim).expedition!.state.plans[0]!.overnight).toBe('yamagoya');
    a.begin(); runUntil(sim, () => a.state.elapsed >= DAY_SECONDS / 2);
    const saved = reload(sim);
    expect(a.state.outings[0]!.legs.at(-1)!.end).toBeLessThanOrEqual(HOME_BY);
    playToMorning(sim); playToMorning(saved);
    expect(a.state).toEqual(saved.expedition!.state);
    expect(homeName(a.state, 'sora')).toBe('Yamagoya');
    expect(homeName(a.state, 'ren')).toBe('Seseragi');
    expect(a.state.discoveries['long-view']).toBeDefined();
    const view = a.view().journal.find(entry => entry.id === 'long-view')!;
    expect(view.text).toContain('Seseragi');
    expect(view.text).not.toContain('Mio');
    expect(view.text).toContain('mist');
    expect(a.state.region).toBe(0);
    expect(a.state.known).not.toContain('mio');
    expect(dist(a.view().friends.find((p) => p.id === 'sora')!.at, lodgingById(a.state, 'yamagoya')!.fire)).toBeLessThan(200);
  });

  it('allows staying on the first visit to a known hut, while refusing a different destination', () => {
    const { a } = newExpedition();
    a.state.known.push('yamagoya');
    expect(a.assign({ ...plan('sora', 'yamagoya', 'explore'), overnight: 'yamagoya' }).ok).toBe(true);
    a.state.visits.yamagoya = 1;
    expect(a.assign({ ...plan('sora', 'kamimori', 'explore'), overnight: 'yamagoya' }).ok).toBe(false);
  });
});

it('stores every sketch in the evening report without paying its reward again', () => {
  const { sim, a } = newExpedition();
  a.state.discoveries['reed-warbler'] = { day: 1, by: 'sketch' };
  a.state.discoveries['star-moss'] = { day: 1, by: 'sketch' };
  a.rest('sora'); a.begin(); runUntil(sim, () => a.view().eveningReady); a.collectReturns();
  const finds = a.state.history[0]!.items!.filter((item) => item.kind === 'find');
  expect(finds.map((item) => item.sketch)).toEqual(expect.arrayContaining(['reed-warbler', 'star-moss']));
  expect(finds.find(item => item.sketch === 'star-moss')).toMatchObject({ title: 'Sketched: Star moss', kind: 'find', hint: 'unusual' });
  expect(hasSketch('star-moss')).toBe(true);
  expect(finds.every((item) => !item.provisions && !item.materials)).toBe(true);
  const saved = reload(sim).expedition!;
  expect(saved.state.history).toEqual(a.state.history);
  expect(saved.view().journal.find(entry => entry.id === 'star-moss')).toMatchObject({
    found: true, sketch: 'star-moss', name: 'Star moss', set: 'The two woods', credit: 'Day 1 · Sketched',
  });
  expect(saved.view().sets.find(set => set.id === 'woods')?.found).toBe(1);
});

it('makes an intentional chapter departure a saved illustrated arrival', () => {
  const { sim, a } = newExpedition();
  a.state.day = 4; a.state.provisions = 20;
  a.state.discoveries.waymark = { day: 3, by: 'sora' };
  a.state.buildings.push({ id: 99, kind: 'shelter', x: 320, y: 2040, work: 0, region: 0, placed: 2 });
  expect(a.view().departure).toMatchObject({ destination: 'Mio', surveyed: true, prepared: true, packed: true });
  expect(a.travel()).toEqual({ ok: true });
  runUntil(sim, () => a.view().eveningReady); a.collectReturns();
  expect(standoutOf(a.state.history[0]!.items!)).toMatchObject({ label: 'A new reach', item: { title: 'Arrived in Mio' } });
});

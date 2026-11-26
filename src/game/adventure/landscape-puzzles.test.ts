import { describe, expect, it } from 'vitest';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { dist } from '../core/math';
import { DAY_SECONDS } from './calendar';
import { placeToday } from './conditions';
import { placeDef } from './content';
import { expectedResources } from './economy';
import { applyEffect } from './evening';
import { assess } from './odds';
import { newExpedition, plan, playToMorning, runUntil } from './testing';
import { HOME_BY, journeyFor, routeSeconds } from './travel';
import { suggestedOutings } from '../../ui/notebook/recommendations';
import { NARROWS } from './structures';

it('can read the herons’ route on a clear spring day, with the crossing and enough survey time, in a herons year', () => {
  const { a } = newExpedition();
  a.state.course = { ...a.state.course, way: 'herons' };
  a.state.region = 1;
  for (const person of a.state.people) person.base = 1;
  a.state.known.push('kitsuneyama');
  a.state.buildings.push({ id: 101, kind: 'bridge', region: 1, ...NARROWS, work: 2, placed: 1 },
    { id: 102, kind: 'shelter', region: 1, x: 1750, y: 3500, work: 0, placed: 1 });
  a.state.people[0]!.lodging = 102;
  const w = a.world();
  const outing = plan('sora', 'kitsuneyama', 'explore');
  const clear = { ...w, today: { ...w.today, season: 0 as const, weather: 'clear' as const, level: 'high' as const } };
  expect(assess(clear, outing).sure?.id).toBe('heron-way');
  expect(assess({ ...clear, today: { ...clear.today, weather: 'rain' } }, outing).sure).toBeNull();
  a.state.buildings = a.state.buildings.filter(building => building.kind !== 'bridge');
  expect(assess(clear, outing).problem).toMatch(/bridge|narrows/i);
});

describe('the landscape is the puzzle', () => {
  it('connects five ordinary days into a new route, a lasting food spot and a useful shelter', () => {
    const { sim, a } = newExpedition(2086);
    const outings = [
      plan('ren', 'suisha', 'fish'), plan('mina', 'kamimori', 'forage'),
      plan('sora', 'furukawa', 'explore'), plan('ren', 'furukawa', 'investigate'),
      plan('mina', 'furukawa', 'forage'),
    ];
    for (const outing of outings) {
      if (a.state.day === 5) expect(a.place('shelter', { x: 320, y: 2040 }).ok).toBe(true);
      expect(a.assign(outing)).toEqual({ ok: true });
      expect(a.state.plans).toHaveLength(1); // A whole roster is never mandatory.
      playToMorning(sim);
    }
    expect(a.state.day).toBe(6);
    expect(a.state.known).toContain('furumichi');
    expect(a.state.discoveries['old-watercourse']?.by).toBe('ren');
    expect(a.state.discoveries['cress-bed']?.by).toBe('mina');
    expect(a.view().lodgings.some((l) => typeof l.id === 'number')).toBe(true);
    const fourth = a.state.history.find((day) => day.day === 4)!;
    expect(fourth.items?.some((item) => item.text.includes('Ren finds fish'))).toBe(true);
    expect(fourth.items?.find((item) => item.sketch === 'old-watercourse')?.materials).toBe(2);
    expect(a.state.history.find((day) => day.day === 5)!.items?.some((item) => item.text.includes('Mina leaves the roots'))).toBe(true);
    expect(suggestedOutings(a.view()).length).toBeGreaterThanOrEqual(2);

    const saved = new Simulation(adventureValley, structuredClone(sim.state)).expedition!;
    expect(saved.state.history).toEqual(a.state.history);
    expect(saved.state.discoveries).toEqual(a.state.discoveries);
    // Let the same seeded river rise again; no quest advances its level.
    while (saved.world().today.level !== 'high' && saved.state.day < 40) saved.runToMorning();
    expect(saved.world().today.level).toBe('high');
    expect(placeToday(placeDef('furumichi'), saved.world().today, saved.state).state).toBe('special');
    expect(saved.assign(plan('sora', 'furumichi', 'investigate'))).toEqual({ ok: true });
    saved.begin();
    const points = saved.state.outings[0]!.legs[0]!.points!;
    expect(points.some((at) => dist(at, { x: 650, y: 2260 }) < 24)).toBe(true);
  });

  it('keeps Furumichi reachable to check the stream, while the known raised towpath remains useful', () => {
    const { a } = newExpedition();
    const road = placeDef('furumichi'); a.state.known.push(road.id);
    const today = a.world().today;
    expect(placeToday(road, today, a.state).state).toBe('special');
    expect(a.assign(plan('sora', road.id, 'investigate')).ok).toBe(true);
    a.state.discoveries['old-watercourse'] = { day: 1, by: 'ren' };
    a.state.buildings.push({ id: 99, kind: 'shelter', x: 320, y: 2040, region: 0, work: 0, placed: 1 });
    expect(placeToday(road, today, a.state).via).toEqual({ x: 650, y: 2260 });
    expect(placeToday(road, { ...today, level: 'low' }, a.state).state).toBe('open');
  });

  it('makes the channel survey dependable whenever seeded weather exposes it', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { sim, a } = newExpedition(seed);
      a.state.known.push('furukawa');
      expect(assess(a.world(), plan('ren', 'furukawa', 'investigate')).sure).toBeNull();
      while (a.world().today.level !== 'low' && a.state.day < 40) playToMorning(sim);
      expect(a.world().today.level).toBe('low');
      expect(assess(a.world(), plan('ren', 'furukawa', 'investigate')).sure?.id).toBe('old-watercourse');
      expect(a.assign(plan('ren', 'furukawa', 'investigate'))).toEqual({ ok: true });
      playToMorning(sim);
      expect(a.state.discoveries['old-watercourse']).toBeDefined();
    }
  });

  it('uses old steps and a lookout to approach the gorge above the spray', () => {
    const { a } = newExpedition();
    a.state.known.push('hazama');
    a.state.discoveries['carved-steps'] = { day: 1, by: 'sora' };
    expect(placeToday(placeDef('hazama'), a.world().today, a.state).state).toBe('closed');
    a.state.buildings.push({ id: 99, kind: 'lookout', x: 320, y: 2040, region: 0, work: 0, placed: 1 });
    const journey = journeyFor(a.world(), plan('sora', 'hazama', 'investigate'));
    expect(journey.reachable).toBe(true);
    expect(journey.out.some((at) => dist(at, { x: 600, y: 620 }) < 24)).toBe(true);
    expect(a.assign(plan('sora', 'hazama', 'investigate'))).toEqual({ ok: true });
    expect(a.view().places.find((p) => p.id === 'hazama')!.stateLine).toContain('upper ledge');
  });

  it('changes what foraging is useful for after learning to leave the cress roots', () => {
    const { a } = newExpedition();
    a.state.day = 4;
    const outing = plan('mina', 'furukawa', 'forage');
    expect(expectedResources(a.world(), placeDef('furukawa'), outing).materials).toBeGreaterThan(0);
    a.state.discoveries['cress-bed'] = { day: 4, by: 'mina' };
    expect(expectedResources(a.world(), placeDef('furukawa'), outing)).toEqual({ provisions: 3, materials: 0 });
    a.state.day = 10; // Winter changes the opportunity again.
    expect(expectedResources(a.world(), placeDef('furukawa'), outing).provisions).toBe(0);
  });

  it('does not pay a discovery reward twice across evening effects or saves', () => {
    const { a, sim } = newExpedition();
    const effect = { person: 'ren', find: 'old-watercourse', lead: null, provisions: 0, materials: 2 };
    applyEffect(a.state, effect);
    const saved = new Simulation(adventureValley, structuredClone(sim.state)).expedition!;
    const materials = saved.state.materials;
    applyEffect(saved.state, effect);
    expect(saved.state.materials).toBe(materials);
    expect(saved.state.known.filter((id) => id === 'furumichi')).toHaveLength(1);
  });

  it('uses actual walking time for surveys, including a useful overnight advantage', () => {
    const { a, sim } = newExpedition();
    a.state.day = 4; a.state.known.push('yamagoya'); a.state.visits.yamagoya = 1;
    const outing = plan('sora', 'yamagoya', 'explore');
    a.state.discoveries['carved-steps'] = { day: 1, by: 'sora' }; // The route clue is already known; test the daylight budget.
    expect(assess(a.world(), outing).sure).toBeNull();
    a.state.people[0]!.lodging = 'yamagoya';
    expect(assess(a.world(), outing).sure?.id).toBe('long-view');
    expect(a.assign(outing)).toEqual({ ok: true }); a.begin();
    const legs = a.state.outings[0]!.legs;
    expect(legs.filter((leg) => leg.kind === 'beat').reduce((n, leg) => n + leg.end - leg.start, 0)).toBeGreaterThanOrEqual(26);
    expect(legs.at(-1)!.end).toBeLessThanOrEqual(HOME_BY + .01);
    // Walks keep their real pace, or a short one is shown at a stroll of up to four seconds.
    for (const leg of legs.filter((leg) => leg.kind === 'walk')) {
      expect(leg.end - leg.start).toBeGreaterThanOrEqual(routeSeconds(leg.points!, 240) - .01);
      expect(leg.end - leg.start).toBeLessThanOrEqual(Math.max(routeSeconds(leg.points!, 240), 4) + .01);
    }
    runUntil(sim, () => a.state.phase === 'evening');
    expect(a.state.outings[0]!.bundles.some((b) => b.kind === 'find' && b.find === 'long-view')).toBe(true);
    expect(a.state.elapsed).toBeLessThan(DAY_SECONDS);
  });

  it('keeps repeated completed works in the notebook map snapshot', () => {
    const { a } = newExpedition();
    a.state.buildings.push(...[300, 900].map((x, index) => ({ id: 90 + index, kind: 'platform' as const, x, y: 1900, region: 0, work: 0, placed: 1 })));
    expect(a.view().sites?.filter((site) => site.kind === 'platform').map((site) => site.at.x)).toEqual([300, 900]);
  });
});

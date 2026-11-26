import { describe, expect, it } from 'vitest';
import { Simulation } from '../simulation/simulation';
import { dist } from '../core/math';
import { adventureValley } from '../world/boards/adventure';
import { CAMP_GATHER_SECONDS, DAY_SECONDS } from './calendar';
import { PLACES } from './content';
import { seat } from './campSeats';
import { stanceOf } from './scene';
import { journeyFor } from './travel';
import { newExpedition, plan, playToMorning, runUntil } from './testing';
import { homeName, setOutFrom, shelterFire } from './world';
import { REGIONS } from './regions';
import { buildTags } from './view';
import type { Cue } from './model';

describe('overnight bases and the evening gathering', () => {
  it('keeps a shelter by the southern mist reachable without entering the next chapter', () => {
    const { a } = newExpedition();
    const shelter = { id: a.state.nextId++, kind: 'shelter' as const, x: 600, y: 2460, region: 0, work: 0, placed: 1 };
    a.state.buildings.push(shelter);
    const fire = shelterFire(shelter);
    for (const at of [fire, ...Array.from({ length: 6 }, (_, index) => seat(fire, index))]) {
      expect(at.y).toBeLessThan(REGIONS[0]!.bottom - 35);
      expect(a.nav.walkable(at)).toBe(true);
    }
    const move = { ...plan('sora', 'seseragi', 'visit'), lodging: shelter.id };
    expect(a.view().forecast(move).problem).toBeNull();
    expect(a.camp('sora', shelter.id)).toEqual({ ok: true });
  });

  it('reports an actually closed shelter route before the player tries to move', () => {
    const { a } = newExpedition();
    const shelter = { id: a.state.nextId++, kind: 'shelter' as const, x: 1700, y: 500, region: 0, work: 0, placed: 1 };
    a.state.buildings.push(shelter);
    const move = { ...plan('sora', 'seseragi', 'visit'), lodging: shelter.id };
    const forecast = a.view().forecast(move);
    expect(forecast.problem).toBeTruthy();
    const answer = a.camp('sora', shelter.id);
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.reason).toBe(forecast.problem);
  });

  it('can change a companion’s plan to stay at camp without cancelling the lead explorer', () => {
    const { a } = newExpedition();
    expect(a.assign(plan('sora', 'kamimori', 'explore', null, 'mina'))).toEqual({ ok: true });
    expect(a.cancelPlan('mina')).toEqual({ ok: true });
    expect(a.state.plans[0]!.person).toBe('sora');
    expect(a.state.plans[0]!.companion).toBeNull();
    expect(a.view().friends.find((f) => f.id === 'mina')!.status).toBe('home');
    expect(a.rest('mina')).toEqual({ ok: true });
    expect(a.view().friends.find((f) => f.id === 'mina')!.status).toBe('resting');
  });
  it('walks to a shelter for the day, saves the move, and explores from there tomorrow', () => {
    const { sim, a } = newExpedition();
    a.state.known = PLACES.filter((p) => p.region === 0).map((p) => p.id);
    const shelter = { id: a.state.nextId++, kind: 'shelter' as const, x: 600, y: 650, region: 0, work: 0, placed: 1 };
    a.state.buildings.push(shelter);
    const far = plan('ren', 'izumi', 'explore');
    const before = journeyFor(a.world(), far);
    expect(before.field).toBeLessThan(14); // Barely time to look, after the long return walk.
    const origin = stanceOf(a, 'ren').at;
    expect(a.camp('ren', shelter.id)).toEqual({ ok: true });
    expect(a.state.people.find((p) => p.id === 'ren')!.lodging).toBeUndefined();
    expect(a.view().friends.find((p) => p.id === 'ren')!.statusLine).toContain('shelter');
    const planned = new Simulation(adventureValley, structuredClone(sim.state)).expedition!;
    expect(planned.state.plans[0]!.lodging).toBe(shelter.id);
    a.rest('sora'); a.rest('mina');
    expect(a.begin()).toEqual({ ok: true });
    expect(dist(a.state.outings[0]!.legs[0]!.points![0]!, origin)).toBeLessThan(1);
    runUntil(sim, () => a.state.elapsed >= 4);
    const saved = new Simulation(adventureValley, structuredClone(sim.state));
    playToMorning(sim); playToMorning(saved);
    expect(saved.expedition!.state).toEqual(a.state);
    expect(homeName(a.state, 'ren')).toBe('Walkers’ shelter');
    expect(dist(setOutFrom(a.state, { region: 0 }, 'ren'), shelterFire(shelter))).toBe(0);
    expect(a.view().forecast(far).problem).toBeNull();
    expect(journeyFor(a.world(), far).field).toBeGreaterThan(before.field * 2);
    expect(a.view().forecast({ ...far, companion: 'sora' }).problem).toContain('different places');
    expect(homeName(a.state, 'sora')).toBe('Seseragi');
    expect(a.assign(far)).toEqual({ ok: true });
    a.rest('sora'); a.rest('mina'); a.begin();
    const trail = a.state.outings[0]!;
    const home = seat(shelterFire(shelter), 1);
    expect(dist(trail.legs[0]!.points![0]!, home)).toBeLessThan(1);
    runUntil(sim, () => a.state.elapsed >= 35);
    expect(dist(trail.legs.at(-1)!.points!.at(-1)!, home)).toBeLessThan(1);
    playToMorning(sim);
    expect(a.assign(plan('ren', 'seseragi', 'visit'))).toEqual({ ok: true });
    playToMorning(sim);
    expect(homeName(a.state, 'ren')).toBe('Seseragi');
    expect(a.state.people.find((p) => p.id === 'ren')!.lodging).toBeUndefined();
  });

  it('offers a placed shelter as lodging at once, and campers there can still build a story work', () => {
    const { sim, a } = newExpedition();
    a.state.materials = 3;
    expect(a.place('shelter', { x: 600, y: 650 })).toEqual({ ok: true });
    const shelter = a.state.buildings[0]!;
    expect(a.view().lodgings.map((l) => l.id)).toContain(shelter.id);
    a.state.people.find((p) => p.id === 'ren')!.lodging = shelter.id;
    a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
    a.state.buildings.push({ id: a.state.nextId++, kind: 'bridge', x: 1000, y: 340, region: 0, work: 0, placed: 1 });
    a.rest('ren');
    a.assign(plan('sora', 'kamimori', 'explore')); a.assign(plan('mina', 'kamimori', 'forage'));
    playToMorning(sim);
    expect(a.state.buildings.find((b) => b.kind === 'bridge')!.work).toBeCloseTo(1, 6);
  });

  it('opens a visited hut as a persistent base and saves both the planned move and the stay', () => {
    const { sim, a } = newExpedition();
    a.state.known.push('yamagoya');
    expect(a.camp('sora', 'yamagoya').ok).toBe(false);
    a.state.visits.yamagoya = 1;
    expect(a.view().lodgings.find((l) => l.id === 'yamagoya')!.name).toBe('Yamagoya');
    expect(a.camp('sora', 'yamagoya')).toEqual({ ok: true });
    const planned = new Simulation(adventureValley, structuredClone(sim.state));
    expect(planned.expedition!.state.plans[0]!.lodging).toBe('yamagoya');
    a.rest('ren'); a.rest('mina'); a.begin();
    expect(a.view().friends.find((f) => f.id === 'sora')!.statusLine).toBe('Moving to Yamagoya');
    playToMorning(sim);
    expect(homeName(a.state, 'sora')).toBe('Yamagoya');
    expect(homeName(a.state, 'ren')).toBe('Seseragi');
    const saved = new Simulation(adventureValley, structuredClone(sim.state));
    expect(saved.expedition!.state.people.find((p) => p.id === 'sora')!.lodging).toBe('yamagoya');
    expect(homeName(saved.expedition!.state, 'sora')).toBe('Yamagoya');
    expect(a.assign(plan('sora', 'seseragi', 'visit'))).toEqual({ ok: true });
    playToMorning(sim);
    expect(homeName(a.state, 'sora')).toBe('Seseragi');
  });

  it('holds the sunset before results and keeps automatic condition prose in the notebook', () => {
    const { sim, a } = newExpedition();
    a.rest('sora'); a.rest('ren'); a.rest('mina'); a.begin();
    runUntil(sim, () => a.state.phase === 'evening');
    expect(a.view().eveningReady).toBe(false);
    expect(a.state.evening!.shown).toBe(0);
    const dusk = a.scene().hour;
    runUntil(sim, () => a.state.elapsed >= CAMP_GATHER_SECONDS - .2);
    expect(a.view().eveningReady).toBe(false);
    expect(a.scene().hour).toBeGreaterThan(dusk);
    runUntil(sim, () => a.view().eveningReady);
    expect(a.scene().hour).toBeGreaterThanOrEqual(20);
    for (const person of a.state.people) expect(stanceOf(a, person.id).pose).not.toBe('walk');
    a.finishEvening(); runUntil(sim, () => a.state.phase === 'morning');
    a.state.morning!.opened = ['Old Ford']; a.state.morning!.closed = ['Hazama'];
    expect(buildTags(a).some((t) => t.kind === 'note')).toBe(false);
  });

  it('collects all returns once for the Journal, then advances directly to a saved new morning', () => {
    const { sim, a } = newExpedition();
    a.assign(plan('sora', 'kamimori', 'explore')); a.assign(plan('ren', 'suisha', 'fish')); a.rest('mina'); a.begin();
    runUntil(sim, () => a.view().eveningReady);
    const cues: Cue[] = [];
    sim.events.on('adventure', (event) => { if (event.cue) cues.push(event.cue); });
    expect(a.collectReturns()).toEqual({ ok: true });
    expect(a.state.phase).toBe('evening');
    expect(a.state.evening!.shown).toBe(a.state.evening!.items.length);
    expect(cues).toEqual(['unpack']);
    const provisions = a.state.provisions, materials = a.state.materials;
    a.collectReturns();
    expect(cues).toEqual(['unpack']);
    expect(a.state.provisions).toBe(provisions); expect(a.state.materials).toBe(materials);
    expect(a.state.history[0]!.items).toEqual(a.state.evening!.items);
    const saved = new Simulation(adventureValley, structuredClone(sim.state));
    expect(saved.expedition!.state.evening).toEqual(a.state.evening);
    expect(saved.expedition!.state.history).toEqual(a.state.history);
    expect(saved.expedition!.state.provisions).toBe(a.state.provisions);
    a.finishEvening(); a.finishEvening();
    expect(a.state.phase).toBe('morning'); expect(a.state.day).toBe(2);
    expect(a.state.history[0]!.day).toBe(1);
  });

  it('marks Izumi at the painted waterfall while keeping its walking destination on dry ground', () => {
    const { a } = newExpedition();
    a.state.known.push('izumi', 'yamagoya'); a.state.visits.yamagoya = 1;
    a.state.people.find((p) => p.id === 'sora')!.lodging = 'yamagoya';
    const spring = PLACES.find((p) => p.id === 'izumi')!;
    expect(a.view().places.find((p) => p.id === 'izumi')!.at).toEqual(spring.marker);
    expect(a.scene().places.find((p) => p.id === 'izumi')!.at).toEqual(spring.marker);
    expect(a.nav.walkable(spring.at)).toBe(true);
    expect(a.view().route('sora', 'izumi').at(-1)).toEqual(spring.at);
    expect(a.assign(plan('sora', 'izumi', 'explore'))).toEqual({ ok: true });
  });

  it('needs actual daily builders, carries partial work across saves, and takes two days for one person', () => {
    const { sim, a } = newExpedition();
    a.state.materials = 6; a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
    expect(a.place('bridge', { x: 1000, y: 340 })).toEqual({ ok: true });
    const make = a.view().structures.find((s) => s.id === 'bridge')!;
    expect(make.workRemaining).toBe(2);
    a.rest('mina'); a.assign(plan('sora', 'kamimori', 'explore')); a.assign(plan('ren', 'suisha', 'fish')); a.begin();
    runUntil(sim, () => a.state.elapsed >= DAY_SECONDS / 2);
    expect(a.state.buildings[0]!.work).toBeGreaterThan(0);
    expect(a.state.buildings[0]!.work).toBeLessThan(1);
    const saved = new Simulation(adventureValley, structuredClone(sim.state));
    playToMorning(sim); playToMorning(saved);
    expect(saved.expedition!.state).toEqual(a.state);
    expect(a.state.buildings[0]!.work).toBeCloseTo(1);
    a.rest('mina'); a.assign(plan('sora', 'kamimori', 'explore')); a.assign(plan('ren', 'suisha', 'fish'));
    playToMorning(sim);
    expect(a.state.buildings[0]!.work).toBe(2);
    expect(a.view().structures.find((s) => s.id === 'bridge')!.status).toBe('built');
  });

  it('includes every builder in the evening account without giving them extra resources', () => {
    const { sim, a } = newExpedition();
    a.state.materials = 6; a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
    a.place('bridge', { x: 1000, y: 340 });
    for (const person of a.state.people) a.rest(person.id);
    a.begin(); runUntil(sim, () => a.state.phase === 'evening');
    const work = a.state.evening!.items.filter(item => item.title === 'River footbridge');
    expect(work).toHaveLength(1);
    expect(work[0]!.contributors).toEqual(a.state.people.map(person => person.id));
    expect(work[0]!.provisions).toBe(0); expect(work[0]!.materials).toBe(0);
  });
});

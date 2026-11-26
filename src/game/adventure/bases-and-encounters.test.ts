import { describe, expect, it } from 'vitest';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { dist } from '../core/math';
import { DAY_SECONDS } from './calendar';
import { crossingOpen, openGround } from './conditions';
import { placeDef } from './content';
import { assess } from './odds';
import { newMembers, readyToMove } from './progression';
import { workPoint } from './construction';
import { campOf, valleyRiver } from './regions';
import { scheduleSightings } from './sightings';
import { livesInWater, inWater } from './waterHabitat';
import { eveningFire, homeName, lodgingById, occupiedCamps, todayOf, worldOf } from './world';
import { newExpedition, plan, playToMorning, runUntil } from './testing';
import { FORK_WAIT } from './trail';
import { stanceOf } from './scene';

const restore = (sim: Simulation): Simulation => new Simulation(adventureValley, structuredClone(sim.state));

describe('overnight stays earn downstream route knowledge', () => {
  it('moves to a visited hut, resumes the walk from a save, then reliably scouts the next chapter', () => {
    const { a, sim } = newExpedition();
    a.state.known.push('yamagoya'); a.state.visits.yamagoya = 1;
    a.state.buildings.push({ id: a.state.nextId++, kind: 'lookout', x: 320, y: 2040, region: 0, work: 0, placed: 1 });
    a.state.provisions = 20;
    a.state.discoveries['carved-steps'] = { day: 1, by: 'sora' }; // The route clue is already known; test the daylight budget.
    expect(assess(a.world(), plan('sora', 'yamagoya', 'explore')).sure?.id).not.toBe('long-view');
    expect(a.view().forecast(plan('sora', 'yamagoya', 'explore')).reasons.some((r) => /sleep nearer/.test(r.text))).toBe(true);
    expect(a.camp('sora', 'yamagoya')).toEqual({ ok: true });
    a.begin(); runUntil(sim, () => a.state.elapsed >= DAY_SECONDS / 2);
    const saved = restore(sim);
    playToMorning(sim); playToMorning(saved);
    expect(saved.expedition!.state).toEqual(a.state);
    expect(homeName(a.state, 'sora')).toBe('Yamagoya');
    expect(homeName(a.state, 'ren')).toBe('Seseragi');
    expect(assess(a.world(), plan('sora', 'yamagoya', 'explore')).sure?.id).toBe('long-view');
    expect(a.assign(plan('sora', 'yamagoya', 'explore'))).toEqual({ ok: true });
    playToMorning(sim);
    expect(a.state.discoveries['long-view']?.by).toBe('sora');
    expect(readyToMove(a.state)).toBe(true);
  });

  it('frames the most populated fire and leaves everyone at their own saved base', () => {
    const { a } = newExpedition();
    a.state.known.push('yamagoya'); a.state.visits.yamagoya = 1;
    const hut = lodgingById(a.state, 'yamagoya')!;
    for (const person of a.state.people.slice(0, 2)) person.lodging = 'yamagoya';
    a.state.phase = 'evening';
    expect(occupiedCamps(a.state).map((camp) => camp.people)).toEqual([2, 1]);
    expect(eveningFire(a.state)).toEqual(hut.fire);
    expect(a.scene().fire).toEqual(hut.fire);
    expect(dist(stanceOf(a, 'sora').at, hut.fire)).toBeLessThan(200);
    expect(dist(stanceOf(a, 'mina').at, campOf(0).fire)).toBeLessThan(200);
    expect(a.scene().campfires).toContainEqual({ id: 'town-0', at: campOf(0).fire });
  });

  it('uses Toroya Inn as lodging only after a visit, without changing its inn landmark to the camp', () => {
    const { a, sim } = newExpedition();
    a.state.region = 1; for (const p of a.state.people) p.base = 1;
    a.state.known.push('mio', 'toroya');
    expect(a.camp('sora', 'toroya').ok).toBe(false);
    a.assign(plan('sora', 'toroya', 'visit')); playToMorning(sim);
    expect(a.camp('sora', 'toroya')).toEqual({ ok: true });
    playToMorning(sim);
    expect(homeName(a.state, 'sora')).toBe('Toroya Inn');
    expect(restore(sim).expedition!.state.people[0]!.lodging).toBe('toroya');
    expect(a.view().places.find((p) => p.id === 'toroya')!.at).toEqual(placeDef('toroya').marker);
    expect(dist(placeDef('toroya').marker!, campOf(1).fire)).toBeGreaterThan(90);
  });

  it('allows a delayed Journal handoff at dawn without an evening warning or another day advancing', () => {
    const { a, sim } = newExpedition();
    a.rest('ren'); a.begin(); runUntil(sim, () => a.view().eveningReady); a.collectReturns();
    expect(a.command({ type: 'evening', step: 'morning' })).toEqual({ ok: true });
    const state = structuredClone(a.state);
    expect(a.command({ type: 'evening', step: 'morning' })).toEqual({ ok: true });
    expect(a.state).toEqual(state); expect(a.state.day).toBe(2);
  });
});

describe('construction changes actual crossings', () => {
  it('keeps both upper crossings seasonal until the player builds a bridge', () => {
    const { a } = newExpedition();
    const high = { ...todayOf(a.seed, 1), level: 'high' as const };
    expect(crossingOpen('middle-stones', high, a.state)).toBe(false);
    expect(crossingOpen('high-stones', high, a.state)).toBe(false);
    expect(openGround(adventureValley, high, a.state).some((g) => dist(g.at, { x: 1072, y: 1178 }) < 50)).toBe(false);
    expect(a.scene().buildings.some((b) => b.id === -1 && b.progress === 1)).toBe(false);
  });

  it('builds a chosen bridge from dry ground and only opens the crossing once it is finished', () => {
    const { a, sim } = newExpedition();
    a.state.materials = 30;
    a.state.known.push('takaishi', 'hanano');
    a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
    expect(a.place('bridge', { x: 1052, y: 432 })).toEqual({ ok: true });
    const bridge = a.state.buildings[0]!;
    expect(a.view().places.find((p) => p.id === 'takaishi')!.state).toBe('closed');
    for (let index = 0; index < a.state.people.length; index++) expect(valleyRiver().edgeDistance(workPoint(bridge, index))).toBeGreaterThan(40);
    a.rest('mina'); a.begin(); runUntil(sim, () => a.state.elapsed >= 15);
    expect(a.nav.walkable(stanceOf(a, 'mina').at)).toBe(true);
    const saved = restore(sim); playToMorning(sim); playToMorning(saved);
    expect(saved.expedition!.state).toEqual(a.state);
    expect(bridge.work).toBe(2);
    expect(a.view().places.find((p) => p.id === 'takaishi')!.state).not.toBe('closed');
    expect(a.view().places.find((p) => p.id === 'takaishi')!.stateLine).toContain('bridge stays open');
    expect(a.assign(plan('sora', 'hanano', 'explore'))).toEqual({ ok: true });
  });

  it('builds a second platform at another bank without overwriting the first', () => {
    const { a, sim } = newExpedition(); a.state.materials = 30;
    const site = () => {
      for (let y = 1500; y < 2300; y += 32) for (let x = 400; x < 1500; x += 32) if (!a.siteProblem('platform', { x, y })) return { x, y };
      throw new Error('No platform site');
    };
    const first = site();
    expect(a.place('platform', first)).toEqual({ ok: true });
    // A small work stands at once, so another can go in straight away, but not on top of the first.
    expect(a.buildingProblem('platform')).toBeNull();
    expect(a.siteProblem('platform', first)).toContain('room');
    expect(a.place('platform', site())).toEqual({ ok: true });
    expect(a.state.buildings).toHaveLength(2);
    a.rest('mina'); playToMorning(sim);
    expect(a.view().structures.find((s) => s.id === 'platform')).toMatchObject({ status: 'built', count: 2, repeatable: true });
    expect(restore(sim).expedition!.state.buildings).toEqual(a.state.buildings);
  });

  it('does not let a bridge in another reach stand in for the Mio narrows', () => {
    const { a } = newExpedition(); a.state.region = 1;
    a.state.discoveries['heron-way'] = { day: 1, by: 'sora' };
    a.state.provisions = 30;
    a.state.buildings.push({ id: 1, kind: 'bridge', x: 1052, y: 432, region: 0, work: 2, placed: 1 });
    expect(readyToMove(a.state)).toBe(false);
    expect(crossingOpen('mio-bridge', a.world().today, a.state)).toBe(false);
  });
});

describe('meeting the group and watching the water', () => {
  it('adds Aki in Mio and Yui in Kawagiri, while retaining Haru in older saves', () => {
    const { a, sim } = newExpedition();
    for (const id of ['aki-meeting', 'haru-meeting', 'yui-meeting']) a.state.discoveries[id] = { day: 1, by: 'sora' };
    a.state.buildings.push({ id: 1, kind: 'cottage', x: 300, y: 3200, region: 1, work: 2, placed: 1 }, { id: 2, kind: 'dock', x: 800, y: 5320, region: 2, work: 2, placed: 1 });
    expect(newMembers(a.state)).toEqual([]);
    a.state.region = 1; expect(newMembers(a.state)).toEqual(['aki']);
    a.state.people.push({ id: 'aki', base: 1, practice: {}, memories: [] });
    a.state.region = 2; expect(newMembers(a.state)).toEqual(['yui']);
    a.state.people.push({ id: 'haru', base: 0, practice: {}, memories: [] });
    expect(restore(sim).expedition!.state.people.some((p) => p.id === 'haru')).toBe(true);
  });

  it('keeps aquatic spawn positions in real water across seasons and seeds', () => {
    let checked = 0;
    for (const seed of [1, 2, 2086]) for (const region of [0, 1, 2]) for (const day of [1, 4, 7, 10]) {
      const { a } = newExpedition(seed); a.state.region = region; a.state.day = day;
      for (const sighting of scheduleSightings(worldOf(seed, a.state))) if (livesInWater(sighting.find)) {
        expect(valleyRiver().edgeDistance(sighting.at), sighting.find).toBeLessThan(-10); checked++;
      }
    }
    expect(checked).toBeGreaterThan(8);
    // A kingfisher waits on the bank; only the swimmers and fish go in.
    expect(livesInWater('kingfisher')).toBe(false);
    expect(livesInWater('willow-kingfisher')).toBe(false);
    expect(livesInWater('cherry-salmon')).toBe(true);
    const { a } = newExpedition(); a.state.region = 1; a.state.tracked = ['otter'];
    const otter = scheduleSightings(a.world()).find((s) => s.find === 'otter')!;
    expect(otter).toBeDefined(); expect(valleyRiver().edgeDistance(otter.at)).toBeLessThan(-10);
    expect(dist(otter.at, placeDef('yanagi').marker!)).toBeLessThan(150);
    for (const dx of [-100, 0, 100]) expect(valleyRiver().edgeDistance(inWater(valleyRiver(), { x: otter.at.x + dx, y: otter.at.y }))).toBeLessThan(-10);
  });

  it('keeps the longer choice window within the same short day and saves it mid-choice', () => {
    expect(FORK_WAIT).toBe(11);
    const { a, sim } = newExpedition(); playToMorning(sim);
    a.assign(plan('sora', 'kamimori', 'track')); a.assign(plan('ren', 'suisha', 'explore')); a.begin();
    const fork = a.state.outings.find((o) => o.fork);
    expect(fork).toBeDefined(); const leg = fork!.legs.find((l) => l.fork)!;
    expect(leg.end - leg.start).toBeCloseTo(FORK_WAIT);
    runUntil(sim, () => a.state.elapsed >= leg.start + 7.5);
    const saved = restore(sim);
    expect(a.choose(`fork-${fork!.person}`, 1)).toEqual({ ok: true });
    expect(saved.expedition!.choose(`fork-${fork!.person}`, 1)).toEqual({ ok: true });
    playToMorning(sim); playToMorning(saved);
    expect(saved.expedition!.state).toEqual(a.state); expect(a.state.day).toBe(3);
  });
});

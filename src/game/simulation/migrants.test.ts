/**
 * Fish and birds, tested on a small valley made for the purpose: one straight
 * river with a weir, an old bed looping round it, a ford below, and two
 * marshes too far apart to fly between.
 */

import { describe, expect, it } from 'vitest';
import { History } from '../interaction/history';
import { AUTUMN, SPRING, SUMMER } from '../world/types';
import { closureOf } from './conditions';
import { pond } from './fixtures/pond';
import { isDisturbed } from './flight';
import { type GameMode, Simulation, newGameState } from './simulation';

const start = (mode: GameMode = 'free') => new Simulation(pond, newGameState(pond, mode));
const wish = (id: string) => pond.objectives.find((o) => o.id === id)!;
const toSeason = (sim: Simulation, season: number) => {
  while (sim.season !== season) sim.step();
};
const run = (sim: Simulation, seconds: number) => {
  for (let i = 0; i < seconds * 10; i++) sim.step();
};
const FORD_CORRIDOR = { type: 'corridor' as const, from: 'west', to: 'east', control: [{ x: 500, y: 850 }] };

describe('fish', () => {
  it('gather below a weir and turn back', () => {
    const sim = start();
    const causes: string[] = [];
    sim.events.on('blocked', (e) => causes.push(e.closure.cause));
    expect(sim.outlook(wish('spawning'))).toMatchObject({ joined: true, closure: { cause: 'weir' } });
    run(sim, 40);
    expect(causes).toEqual(['weir']);
    expect(sim.state.arrivals.run![SPRING]).toBe(0);
    // Scouts swim up as far as the weir (y = 500) and no further.
    const fish = sim.agents.filter((a) => a.traveller === 'fish');
    expect(fish.length).toBeGreaterThan(0);
    expect(Math.min(...fish.map((a) => a.y))).toBeGreaterThan(500);
  });

  it('swim round the weir once the old bed is opened, and the wish is granted', () => {
    const sim = start('journey');
    const opened = sim.openChannel('old-bed');
    expect(opened).toEqual({ ok: true, cost: 2 });
    expect(sim.state.marks).toBe(1);
    expect(sim.river.beds).toHaveLength(0);
    expect(sim.outlook(wish('spawning')).closure).toBeNull();
    run(sim, 70);
    expect(sim.state.completed).toContain('spawning');
    expect(sim.openChannel('old-bed').ok).toBe(false);
  });

  it('will not pass stepping stones that a route is using', () => {
    const sim = start();
    sim.openChannel('old-bed');
    expect(sim.addConnection(FORD_CORRIDOR).ok).toBe(true);
    expect(sim.outlook(wish('spawning')).closure?.cause).toBe('stones');
    sim.removeConnection('c1');
    expect(sim.outlook(wish('spawning')).closure).toBeNull();
  });

  it('cannot have a channel opened across a deer corridor', () => {
    const sim = start();
    expect(sim.addConnection({ type: 'corridor', from: 'east', to: 'isle', control: [] }).ok).toBe(true);
    const result = sim.openChannel('old-bed');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/deer/i);
  });

  it('has footpaths across a newly opened channel bridged', () => {
    const sim = start();
    const path = sim.addConnection({ type: 'path', from: 'home', to: 'ferry', control: [{ x: 560, y: 610 }, { x: 660, y: 570 }] });
    if (!path.ok) throw new Error(path.reason);
    expect(path.connection.crossings).toHaveLength(1);
    expect(sim.openChannel('old-bed').ok).toBe(true);
    expect(sim.connections[0]!.crossings.map((c) => c.style)).toEqual(['bridge', 'bridge']);
  });

  it('refuses to open a channel that would wash a route away', () => {
    const sim = start();
    // This path already crosses the river twice; two more crossings are more than a path can make.
    const path = sim.addConnection({ type: 'path', from: 'farm', to: 'home', control: [{ x: 560, y: 200 }, { x: 655, y: 470 }, { x: 600, y: 760 }, { x: 500, y: 960 }, { x: 300, y: 760 }] });
    if (!path.ok) throw new Error(path.reason);
    const result = sim.openChannel('old-bed');
    expect(result.ok).toBe(false);
    expect(sim.connections).toHaveLength(1);
    expect(sim.river.beds).toHaveLength(1);
  });
});

describe('the river rising', () => {
  const MEADOW_PATH = { type: 'path' as const, from: 'home', to: 'mill', control: [{ x: 250, y: 770 }] };

  it('closes a route across a water meadow while the river is high', () => {
    const sim = start();
    const path = sim.addConnection(MEADOW_PATH);
    if (!path.ok) throw new Error(path.reason);
    expect(closureOf(path.connection, SPRING)?.cause).toBe('meadow');
    expect(closureOf(path.connection, SUMMER)).toBeNull();
  });

  it('keeps the meadow dry once an old channel carries the flood away', () => {
    const sim = start();
    sim.addConnection(MEADOW_PATH);
    expect(sim.openChannel('old-bed').ok).toBe(true);
    expect(closureOf(sim.connections[0]!, SPRING)).toBeNull();
  });

  it('grows reeds, not trees, on a water meadow', () => {
    const sim = start();
    const planted = sim.plant({ x: 300, y: 690 });
    expect(planted.ok && planted.place.kind).toBe('reeds');
  });
});

describe('stepping stones of the player\'s own', () => {
  it('can be laid on narrow water, and carry a corridor across', () => {
    const sim = start('journey');
    const laid = sim.layStones({ x: 505, y: 200 });
    if (!laid.ok) throw new Error(laid.reason);
    expect([laid.cost, laid.ford.floods]).toEqual([1, [SPRING]]);
    expect(sim.board.fords.map((f) => f.id)).toEqual(['stones', laid.ford.id]);
    // Deer may now cross here, where before they could not.
    const corridor = sim.addConnection({ type: 'corridor', from: 'north-wood', to: 'isle', control: [{ x: 500, y: 200 }, { x: 640, y: 300 }] });
    if (!corridor.ok) throw new Error(corridor.reason);
    expect(corridor.connection.crossings[0]?.ford?.id).toBe(laid.ford.id);
    expect(closureOf(corridor.connection, SPRING)?.cause).toBe('flood');
    // Stones in use cannot be taken up; once the route is gone they can.
    expect(sim.removeStones(laid.ford.id).ok).toBe(false);
    sim.removeConnection(corridor.connection.id);
    expect(sim.removeStones(laid.ford.id).ok).toBe(true);
    expect(sim.board.fords).toHaveLength(1);
  });

  it('cannot be laid on land, too near other stones, or in place of the ones that were here', () => {
    const sim = start();
    const reason = (x: number, y: number) => {
      const result = sim.canLayStones({ x, y });
      return result.ok ? 'ok' : result.reason;
    };
    expect(reason(300, 300)).toMatch(/belong in the water/i);
    expect(reason(500, 800)).toMatch(/just here/i);
    expect(sim.removeStones('stones')).toMatchObject({ ok: false });
  });
});

describe('birds', () => {
  it('turn back where the resting places lie too far apart', () => {
    const sim = start();
    expect(sim.outlook(wish('flyway'))).toMatchObject({ joined: true, closure: { cause: 'gap' } });
    toSeason(sim, AUTUMN);
    run(sim, 40);
    expect(sim.state.arrivals.passage![AUTUMN]).toBe(0);
  });

  it('cross the valley by way of what the player plants', () => {
    const sim = start();
    const grove = sim.plant({ x: 390, y: 450 });
    if (!grove.ok) throw new Error(grove.reason);
    expect(grove.place.kind).toBe('grove');
    expect(sim.outlook(wish('flyway')).closure?.cause).toBe('gap');
    // On wet ground the same gesture grows reeds.
    const reeds = sim.plant({ x: 660, y: 740 });
    if (!reeds.ok) throw new Error(reeds.reason);
    expect(reeds.place.kind).toBe('reeds');
    expect(sim.outlook(wish('flyway')).closure).toBeNull();
    toSeason(sim, AUTUMN);
    run(sim, 70);
    expect(sim.state.completed).toContain('flyway');
  });

  it('will not rest beside a footpath', () => {
    const sim = start();
    const grove = sim.plant({ x: 390, y: 450 });
    sim.plant({ x: 660, y: 740 });
    if (!grove.ok) throw new Error(grove.reason);
    expect(sim.addConnection({ type: 'path', from: 'home', to: 'farm', control: [{ x: 310, y: 400 }] }).ok).toBe(true);
    expect(isDisturbed(grove.place, sim.connections)).toBe(true);
    expect(sim.outlook(wish('flyway')).closure?.cause).toBe('gap');
  });
});

describe('the landscape as a whole', () => {
  it('undoes an opened channel and a planting, with their strokes', () => {
    const sim = start('journey');
    const history = new History(sim);
    let commit = history.begin();
    const opened = sim.openChannel('old-bed');
    if (!opened.ok) throw new Error(opened.reason);
    commit(opened.cost);
    commit = history.begin();
    const planted = sim.plant({ x: 390, y: 450 });
    if (!planted.ok) throw new Error(planted.reason);
    commit(planted.cost);
    expect(sim.state.marks).toBe(0);
    history.undo();
    history.undo();
    expect([sim.state.opened.length, sim.state.planted.length, sim.state.marks, sim.river.beds.length]).toEqual([0, 0, 3, 1]);
    history.redo();
    expect([sim.state.opened, sim.river.beds.length]).toEqual([['old-bed'], 0]);
  });

  it('resumes from a save with the same river and plantings', () => {
    const sim = start();
    sim.openChannel('old-bed');
    sim.plant({ x: 390, y: 450 });
    run(sim, 30);
    const resumed = new Simulation(pond, JSON.parse(JSON.stringify(sim.state)));
    expect(resumed.river.beds).toHaveLength(0);
    expect(resumed.board.places.filter((p) => p.kind === 'grove')).toHaveLength(1);
    expect(resumed.outlook(wish('spawning')).closure).toBeNull();
  });
});

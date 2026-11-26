/**
 * Seseragi's puzzle, checked: each trap is really refused or really closed in its
 * season, and the second solution (and a planner's shortcut) also completes the valley.
 */

import { describe, expect, it } from 'vitest';
import { closureOf } from '../../simulation/conditions';
import { type GameMode, Simulation, newGameState } from '../../simulation/simulation';
import { AUTUMN, SPRING, type Season, WINTER } from '../types';
import { seseragi as board } from './seseragi';

type Route = (typeof board.solution)[number];

const start = (mode: GameMode = 'free') => new Simulation(board, newGameState(board, mode));
const wish = (id: string) => board.objectives.find((o) => o.id === id)!;
const cause = (sim: Simulation, id: string) => sim.outlook(wish(id)).closure?.cause ?? null;
const add = (sim: Simulation, route: Route) => {
  const result = sim.addConnection(route);
  if (!result.ok) throw new Error(`${route.from} to ${route.to}: ${result.reason}`);
  return result.connection;
};
const toSeason = (sim: Simulation, season: Season) => {
  while (sim.season !== season) sim.step();
};

// Solution A, as authored in the board.
const [LEVEE, DEER_HIGH, DEER_MEADOW, HAY_ROUND, DEER_MIDDLE] = board.solution as [Route, Route, Route, Route, Route];

// The pieces of the other ways through.
const STRAIGHT: Route = { type: 'path', from: 'seseragi', to: 'ukishima', control: [] };
const HANANO_SHIMOMORI: Route = { type: 'corridor', from: 'hanano', to: 'shimomori', control: [{ x: 1560, y: 760 }, { x: 1420, y: 956 }, { x: 1620, y: 1080 }] };
/** The haymakers over the high moor, west of Kamimori, and a footbridge above the high stones. */
const HAY_MOOR: Route = {
  type: 'path', from: 'seseragi', to: 'hanano',
  control: [{ x: 200, y: 1600 }, { x: 140, y: 1150 }, { x: 190, y: 720 }, { x: 420, y: 470 }, { x: 760, y: 330 }, { x: 1000, y: 290 }, { x: 1112, y: 318 }, { x: 1300, y: 390 }],
};
/** The haymakers' shortcut over the middle stones. */
const HAY_MIDDLE: Route = { type: 'path', from: 'seseragi', to: 'hanano', control: [{ x: 640, y: 1500 }, { x: 900, y: 1260 }, { x: 1072, y: 1178 }, { x: 1250, y: 1000 }, { x: 1450, y: 760 }] };
/** Deer corridors over stones the player lays on the bend, above and below the meadow. */
const BY_UPPER_BEND = [{ x: 780, y: 1200 }, { x: 1000, y: 1330 }, { x: 1150, y: 1330 }, { x: 1240, y: 1250 }, { x: 1330, y: 1160 }, { x: 1560, y: 1170 }];
const BY_LOWER_BEND = [{ x: 640, y: 1300 }, { x: 1000, y: 1650 }, { x: 1200, y: 1680 }, { x: 1300, y: 1730 }, { x: 1450, y: 1820 }, { x: 1760, y: 1640 }, { x: 1830, y: 1420 }];
/** Where a grove bridges the flyway once the heron pool is disturbed. */
const COPSE = { x: 700, y: 1650 };

describe('Seseragi traps', () => {
  it('spring: deer on the middle stones stop the salmon below them', () => {
    const sim = start();
    add(sim, LEVEE);
    add(sim, DEER_MIDDLE);
    expect(cause(sim, 'salmon-run')).toBe('stones');
    expect(sim.outlook(wish('first-green')).closure).toBeNull();
    sim.skipToNextSeason();
    expect(sim.state.completed).toContain('first-green');
    expect(sim.state.completed).not.toContain('salmon-run');
  });

  it('spring: the high stones leave the river free, and stones laid now are under the melt', () => {
    const sim = start();
    add(sim, DEER_HIGH);
    expect(cause(sim, 'salmon-run')).toBeNull();
    expect(cause(sim, 'first-green')).toBeNull();
    const laid = sim.layStones({ x: 1240, y: 1250 });
    expect(laid.ok).toBe(true);
    const corridor = sim.addConnection({ type: 'corridor', from: 'kamimori', to: 'shimomori', control: BY_UPPER_BEND });
    if (!corridor.ok) throw new Error(corridor.reason);
    expect(closureOf(corridor.connection, SPRING)?.cause).toBe('flood');
  });

  it('summer: the haymakers cannot cut straight across the deer', () => {
    const sim = start();
    add(sim, LEVEE);
    add(sim, DEER_HIGH);
    for (const control of [[], HAY_MIDDLE.control]) {
      const result = sim.addConnection({ type: 'path', from: 'seseragi', to: 'hanano', control });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/deer's way/);
    }
    add(sim, HAY_ROUND);
  });

  it('summer: the haymakers on the middle stones take the deer\'s only crossing below the snow', () => {
    const sim = start();
    add(sim, STRAIGHT);
    add(sim, DEER_MEADOW);
    add(sim, HANANO_SHIMOMORI);
    add(sim, HAY_MIDDLE);
    const middle = sim.addConnection(DEER_MIDDLE);
    expect(middle.ok).toBe(false);
    if (!middle.ok) expect(middle.reason).toMatch(/already carry a footpath/);
    // Stones laid lower down do not help: the deer would have to cross a footpath to reach them.
    for (const [stones, control] of [
      [{ x: 1240, y: 1250 }, BY_UPPER_BEND],
      [{ x: 1300, y: 1730 }, BY_LOWER_BEND],
    ] as const) {
      const lay = sim.layStones(stones);
      expect(lay.ok).toBe(true);
      const result = sim.addConnection({ type: 'corridor', from: 'kamimori', to: 'shimomori', control: [...control] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/footpath/);
    }
    // The only corridors left go by the high stones or Hanano, and both are snowed in.
    toSeason(sim, WINTER);
    expect(cause(sim, 'winter-passage')).toBe('snow');
  });

  it('autumn: the straight walk across the water meadow drowns, and scares the herons off the flyway', () => {
    const sim = start();
    add(sim, STRAIGHT);
    expect(cause(sim, 'blossom-viewing')).toBeNull();
    expect(cause(sim, 'moon-viewing')).toBe('meadow');
    expect(cause(sim, 'swans')).toBe('gap');
    // The dry way round by the levee keeps clear of both.
    const dry = start();
    add(dry, LEVEE);
    expect(cause(dry, 'moon-viewing')).toBeNull();
    expect(cause(dry, 'swans')).toBeNull();
  });

  it('autumn: opening the old channel keeps the meadow dry, and a grove mends the flyway', () => {
    const sim = start();
    add(sim, STRAIGHT);
    expect(sim.openChannel('old-channel').ok).toBe(true);
    expect(sim.connections[0]!.crossings.map((c) => c.style)).toEqual(['bridge']);
    expect(cause(sim, 'moon-viewing')).toBeNull();
    expect(cause(sim, 'swans')).toBe('gap');
    expect(sim.plant(COPSE).ok).toBe(true);
    expect(cause(sim, 'swans')).toBeNull();
  });

  it('autumn: the old channel cannot be opened under the winter deer once they cross it', () => {
    const sim = start();
    // A corridor across the old bed's neck, from Kamimori down to stones laid on the bend.
    expect(sim.layStones({ x: 1300, y: 1730 }).ok).toBe(true);
    add(sim, { type: 'corridor', from: 'kamimori', to: 'shimomori', control: BY_LOWER_BEND });
    const open = sim.openChannel('old-channel');
    expect(open.ok).toBe(false);
    if (!open.ok) expect(open.reason).toMatch(/deer/i);
  });

  it('winter: the high stones are snowed in; the low stones flood each spring', () => {
    const sim = start();
    add(sim, DEER_HIGH);
    expect(cause(sim, 'winter-passage')).toBe('snow');
    const hay = add(sim, HAY_ROUND);
    expect(closureOf(hay, SPRING)?.cause).toBe('flood');
    expect(closureOf(hay, AUTUMN)).toBeNull();
    add(sim, DEER_MIDDLE);
    expect(cause(sim, 'winter-passage')).toBeNull();
  });
});

describe('Seseragi solutions', () => {
  /** Plays a year in Journey mode, doing each season's actions as it opens. */
  const playYear = (actions: Record<Season, (sim: Simulation) => void>) => {
    const sim = start('journey');
    for (const season of [0, 1, 2, 3] as Season[]) {
      toSeason(sim, season);
      actions[season](sim);
    }
    while (sim.year === 1 && sim.state.outcome === 'playing') sim.step();
    return sim;
  };
  const done = (result: { ok: boolean; reason?: string }) => expect(result.ok, result.ok ? '' : result.reason).toBe(true);

  it('solution A grants every wish in the first year, within par', () => {
    const sim = playYear({
      0: (s) => [LEVEE, DEER_HIGH, DEER_MEADOW].forEach((r) => done(s.addConnection(r))),
      1: (s) => [HAY_ROUND, DEER_MIDDLE].forEach((r) => done(s.addConnection(r))),
      2: () => {},
      3: () => {},
    });
    expect(sim.state.outcome).toBe('won');
    expect(sim.state.strokes).toBe(6);
    expect(sim.blossoms().map((b) => b.earned)).toEqual([true, true, true]);
  });

  it('solution B (by Hanano, over the moor, opening the old channel, planting for the swans) also completes the valley', () => {
    const sim = playYear({
      0: (s) => [STRAIGHT, DEER_MEADOW, HANANO_SHIMOMORI].forEach((r) => done(s.addConnection(r))),
      1: (s) => done(s.addConnection(HAY_MOOR)),
      2: (s) => {
        done(s.openChannel('old-channel'));
        done(s.plant(COPSE));
      },
      3: (s) => done(s.addConnection(DEER_MIDDLE)),
    });
    expect(sim.state.completed.sort()).toEqual(board.objectives.map((o) => o.id).sort());
    expect(sim.state.outcome).toBe('won');
    expect(sim.state.strokes).toBe(9);
    expect(sim.blossoms().map((b) => b.earned)).toEqual([true, true, false]);
  });

  it('a planner lets the salmon pass, then lays one corridor over the middle stones for spring and winter', () => {
    const sim = start('journey');
    done(sim.addConnection(LEVEE));
    while (!sim.state.completed.includes('salmon-run')) sim.step();
    expect(sim.season).toBe(SPRING);
    done(sim.addConnection(DEER_MIDDLE));
    sim.skipToNextSeason();
    done(sim.addConnection(DEER_MEADOW));
    done(sim.addConnection(HAY_ROUND));
    while (sim.year === 1 && sim.state.outcome === 'playing') sim.step();
    // Deer that set out late in spring arrive early in summer, and still count for spring.
    expect(sim.state.outcome).toBe('won');
    expect(sim.state.strokes).toBe(5);
  });
});

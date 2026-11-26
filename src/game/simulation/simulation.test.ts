import { describe, expect, it } from 'vitest';
import { MARKS_CAP, MARKS_PER_SEASON } from '../campaign/interventions';
import { explainShortfall } from '../campaign/objectives';
import { SAVE_VERSION, defaultSave, parseSave } from '../core/save';
import { History } from '../interaction/history';
import { resolveArt } from '../rendering/manifest';
import { BOARDS } from '../world/boards';
import { connectionTypeFor, defaultControl, snapToFords, traceToControl } from '../world/connections';
import { findRoute } from '../world/network';
import { River } from '../world/river';
import { layoutScenery } from '../world/scenery';
import { placeById } from '../world/terrain';
import { AUTUMN, SPRING, SUMMER, type Season, WINTER } from '../world/types';
import { closureOf } from './conditions';
import { brook } from './fixtures/brook';
import { type GameMode, SEASON_SECONDS, Simulation, TICK, newGameState } from './simulation';

const board = brook;
const start = (mode: GameMode = 'journey') => new Simulation(board, newGameState(board, mode));
const runSeconds = (sim: Simulation, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / TICK); i++) sim.step();
};
const ok = (result: { ok: boolean }) => expect(result.ok, JSON.stringify(result)).toBe(true);

// Authored routes used across tests. Each bends through one of the two fords, or bridges the river.
const HIGH = { type: 'corridor' as const, from: 'kamimori', to: 'shimomori', control: [{ x: 700, y: 700 }, { x: 1010, y: 610 }, { x: 1250, y: 820 }] };
const LOW = { type: 'corridor' as const, from: 'kamimori', to: 'shimomori', control: [{ x: 720, y: 1340 }, { x: 1030, y: 1570 }, { x: 1215, y: 1400 }] };
const BRIDGE = { type: 'path' as const, from: 'seseragi', to: 'sakura', control: [{ x: 944, y: 1744 }] };
const STONES = { type: 'path' as const, from: 'seseragi', to: 'sakura', control: [{ x: 800, y: 1540 }, { x: 1030, y: 1570 }, { x: 1230, y: 1650 }] };
/** A footpath up the east bank, along the shelf between the gorge and Shimomori. */
const SHELF = { type: 'path' as const, from: 'sakura', to: 'hanano', control: [{ x: 1290, y: 1560 }, { x: 1150, y: 1300 }, { x: 1150, y: 1000 }, { x: 1230, y: 790 }] };

describe('connections', () => {
  it('infers the connection type from the two places', () => {
    const p = (id: string) => placeById(board, id);
    expect(connectionTypeFor(p('kamimori'), p('shimomori'))).toBe('corridor');
    expect(connectionTypeFor(p('seseragi'), p('sakura'))).toBe('path');
    expect(connectionTypeFor(p('seseragi'), p('kamimori'))).toBeNull();
    expect(connectionTypeFor(p('kamimori'), p('kamimori'))).toBeNull();
  });

  it('rejects a line through the gorge with an explanation, at no cost', () => {
    const sim = start();
    const from = placeById(board, 'kamimori');
    const to = placeById(board, 'shimomori');
    const result = sim.addConnection({ type: 'corridor', from: from.id, to: to.id, control: defaultControl(from, to) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/gorge/i);
    expect(sim.state.marks).toBe(MARKS_PER_SEASON);
  });

  it('lets deer cross only at stepping stones, and villagers bridge elsewhere', () => {
    const sim = start('free');
    const wade = sim.addConnection({ type: 'corridor', from: 'kamimori', to: 'shimomori', control: [{ x: 700, y: 1500 }, { x: 944, y: 1744 }, { x: 1250, y: 1500 }] });
    expect(wade.ok).toBe(false);
    const high = sim.addConnection(HIGH);
    expect(high.ok && high.connection.crossings.map((c) => c.style)).toEqual(['stones']);
    const bridge = sim.addConnection(BRIDGE);
    expect(bridge.ok && bridge.connection.crossings.map((c) => c.style)).toEqual(['bridge']);
  });

  it('refuses to bridge the wide village pool', () => {
    const sim = start();
    const result = sim.addConnection({ type: 'path', from: 'seseragi', to: 'sakura', control: [{ x: 640, y: 1890 }, { x: 840, y: 1990 }, { x: 1120, y: 1900 }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too wide/i);
  });

  it('bends a gesture that passes near a ford onto the stones', () => {
    const sim = start();
    const from = placeById(board, 'kamimori');
    const to = placeById(board, 'shimomori');
    const trace = [{ x: 560, y: 900 }, { x: 760, y: 700 }, { x: 960, y: 590 }, { x: 1080, y: 640 }, { x: 1300, y: 900 }];
    const control = snapToFords(board, sim.river, from, to, traceToControl(from, to, trace));
    const result = sim.addConnection({ type: 'corridor', from: from.id, to: to.id, control });
    expect(result.ok && result.connection.crossings[0]?.ford?.id).toBe('high-ford');
  });
});

describe('deer and people keep apart', () => {
  it('refuses a footpath that would cross a corridor, and the reverse', () => {
    const sim = start('free');
    ok(sim.addConnection(LOW));
    const path = sim.addConnection(SHELF);
    expect(path.ok).toBe(false);
    if (!path.ok) expect(path.reason).toMatch(/deer/i);

    const other = start('free');
    ok(other.addConnection(SHELF));
    const corridor = other.addConnection(LOW);
    expect(corridor.ok).toBe(false);
    if (!corridor.ok) expect(corridor.reason).toMatch(/footpath/i);
  });

  it('lets one set of stones serve only one kind of route', () => {
    const sim = start('free');
    ok(sim.addConnection(LOW));
    const stones = sim.addConnection(STONES);
    expect(stones.ok).toBe(false);
    if (!stones.ok) expect(stones.reason).toMatch(/low stones already carry the deer/i);
    // Two corridors may share them.
    ok(sim.addConnection({ type: 'corridor', from: 'kamimori', to: 'sakura', control: [{ x: 700, y: 1380 }, { x: 1030, y: 1570 }, { x: 1200, y: 1690 }] }));
  });

  it('lets a corridor and a footpath meet inside a place they both serve', () => {
    const sim = start('free');
    ok(sim.addConnection(BRIDGE));
    ok(sim.addConnection({ type: 'corridor', from: 'kamimori', to: 'sakura', control: [{ x: 700, y: 1380 }, { x: 1030, y: 1570 }, { x: 1200, y: 1690 }] }));
    ok(sim.addConnection({ type: 'corridor', from: 'sakura', to: 'shimomori', control: [{ x: 1480, y: 1500 }] }));
    // The moon-viewers leave the terrace between the two corridors and follow the shelf north.
    ok(sim.addConnection(SHELF));
  });

  it('keeps footpaths out of the deer woods', () => {
    const sim = start('free');
    const result = sim.addConnection({ type: 'path', from: 'sakura', to: 'hanano', control: [{ x: 1420, y: 1120 }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/woods/i);
  });

  it('checks a reshape against the other routes but not against itself', () => {
    const sim = start('free');
    ok(sim.addConnection(LOW));
    ok(sim.addConnection(BRIDGE));
    ok(sim.reshapeConnection('c1', [{ x: 700, y: 1330 }, { x: 1030, y: 1570 }, { x: 1230, y: 1410 }]));
    // Dragging the corridor down across the footpath is refused and changes nothing.
    const before = JSON.stringify(sim.state.connections);
    const bad = sim.reshapeConnection('c1', [{ x: 720, y: 1340 }, { x: 1030, y: 1570 }, { x: 1180, y: 1900 }]);
    expect(bad.ok).toBe(false);
    expect(JSON.stringify(sim.state.connections)).toBe(before);
  });
});

describe('seasonal accessibility', () => {
  it('closes the high route in winter and the low stones in spring', () => {
    const sim = start('free');
    const high = sim.addConnection(HIGH);
    const low = sim.addConnection(LOW);
    if (!high.ok || !low.ok) throw new Error('routes should be valid');
    expect(closureOf(high.connection, WINTER)?.cause).toBe('snow');
    expect(closureOf(high.connection, SUMMER)).toBeNull();
    expect(closureOf(low.connection, SPRING)?.cause).toBe('flood');
    expect(closureOf(low.connection, WINTER)).toBeNull();
    expect(closureOf(low.connection, AUTUMN)).toBeNull();
  });

  it('routes around closures and picks the shorter open way', () => {
    const sim = start('free');
    sim.addConnection(HIGH);
    sim.addConnection(LOW);
    const route = (season: Season) => findRoute(sim.connections, 'deer', season, 'kamimori', 'shimomori');
    expect(route(WINTER)?.[0]?.connection.id).toBe('c2');
    expect(route(SPRING)?.[0]?.connection.id).toBe('c1');
    expect(findRoute(sim.connections, 'villager', SUMMER, 'kamimori', 'shimomori')).toBeNull();
  });

  it('keeps a bridge open all year but floods a stepping-stone path in spring', () => {
    const sim = start('free');
    const bridge = sim.addConnection(BRIDGE);
    if (!bridge.ok) throw new Error('bridge should be valid');
    for (const season of [SPRING, SUMMER, AUTUMN, WINTER]) expect(closureOf(bridge.connection, season)).toBeNull();
    const stones = start('free').addConnection(STONES);
    if (!stones.ok) throw new Error('stones should be valid');
    expect(closureOf(stones.connection, SPRING)?.cause).toBe('flood');
  });
});

describe('travellers', () => {
  it('sends deer along a new corridor within seconds', () => {
    const sim = start();
    sim.addConnection(HIGH);
    runSeconds(sim, 6);
    expect(sim.agents.some((a) => a.traveller === 'deer')).toBe(true);
    runSeconds(sim, 40);
    expect(sim.state.arrivals['deer-woods']![SPRING]).toBeGreaterThan(0);
  });

  it('sends scouts that turn back at a closed route and never arrive', () => {
    const sim = start();
    sim.addConnection(LOW); // flooded in spring
    const blocked: string[] = [];
    sim.events.on('blocked', (e) => blocked.push(e.closure.cause));
    runSeconds(sim, 60);
    expect(blocked).toEqual(['flood']);
    expect(sim.state.arrivals['deer-woods']![SPRING]).toBe(0);
    expect(sim.agents.every((a) => a.turnAt !== null)).toBe(true);
  });

  it('moves villagers along paths and grants the wish they fulfil', () => {
    const sim = start();
    const granted: string[] = [];
    sim.events.on('objective', (e) => granted.push(e.objective.id));
    sim.addConnection(BRIDGE);
    runSeconds(sim, 70);
    expect(sim.state.arrivals['blossom-walk']![SPRING]).toBeGreaterThanOrEqual(3);
    expect(granted).toEqual(['blossom-viewing']);
  });

  it('counts a journey toward the season it began in', () => {
    const sim = start('free');
    sim.addConnection(BRIDGE);
    runSeconds(sim, SEASON_SECONDS - 4);
    const spring = sim.state.arrivals['blossom-walk']![SPRING]!;
    const walking = sim.agents.filter((a) => a.journey === 'blossom-walk' && a.season === SPRING).length;
    expect(walking).toBeGreaterThan(0);
    runSeconds(sim, 40);
    expect(sim.state.arrivals['blossom-walk']![SPRING]).toBe(spring + walking);
  });

  it('only sends travellers out in the seasons their journey names', () => {
    const sim = start('free');
    sim.addConnection({ type: 'corridor', from: 'kamimori', to: 'hanano', control: [{ x: 700, y: 700 }, { x: 1010, y: 610 }, { x: 1170, y: 632 }] });
    while (sim.season !== WINTER) sim.step();
    runSeconds(sim, 30);
    expect(sim.agents.some((a) => a.journey === 'deer-meadow' && a.season === WINTER)).toBe(false);
  });
});

describe('time and brushstrokes', () => {
  it('advances through the seasons and years', () => {
    const sim = start('free');
    expect([sim.season, sim.year]).toEqual([SPRING, 1]);
    const seen: number[] = [];
    sim.events.on('season', (e) => seen.push(e.season));
    runSeconds(sim, SEASON_SECONDS * 4 + 1);
    expect(seen).toEqual([SUMMER, AUTUMN, WINTER, SPRING]);
    expect(sim.year).toBe(2);
  });

  it('skips to the next season while still simulating journeys', () => {
    const sim = start();
    sim.addConnection(HIGH);
    sim.skipToNextSeason();
    expect(sim.season).toBe(SUMMER);
    expect(sim.state.arrivals['deer-woods']![SPRING]).toBeGreaterThan(3);
  });

  it('charges one stroke for a line and a second for a footbridge', () => {
    const sim = start();
    const corridor = sim.addConnection(HIGH);
    expect(corridor.ok && corridor.cost).toBe(1);
    const bridge = sim.addConnection(BRIDGE);
    expect(bridge.ok && bridge.cost).toBe(2);
    expect([sim.state.marks, sim.state.strokes]).toEqual([0, 3]);
  });

  it('refuses a footbridge it cannot afford, refills each season and caps the carry-over', () => {
    const sim = start();
    sim.addConnection(HIGH);
    sim.addConnection(LOW);
    const refused = sim.addConnection(BRIDGE);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toMatch(/footbridge takes 2 brushstrokes/i);
    expect(sim.state.marks).toBe(1);
    sim.skipToNextSeason();
    expect(sim.state.marks).toBe(1 + MARKS_PER_SEASON);
    sim.skipToNextSeason();
    sim.skipToNextSeason();
    expect(sim.state.marks).toBe(MARKS_CAP);
  });

  it('never limits Free Play', () => {
    const sim = start('free');
    for (let i = 0; i < 8; i++) ok(sim.addConnection(BRIDGE));
  });
});

describe('editing', () => {
  it('reshapes for free when the route works the same, and charges when it does not', () => {
    const sim = start();
    sim.addConnection(HIGH);
    const marks = sim.state.marks;
    const nudge = sim.reshapeConnection('c1', [{ x: 720, y: 720 }, { x: 1010, y: 610 }, { x: 1230, y: 800 }]);
    expect(nudge.ok && nudge.cost).toBe(0);
    expect(sim.state.marks).toBe(marks);
    const reroute = sim.reshapeConnection('c1', LOW.control);
    expect(reroute.ok && reroute.cost).toBe(1);
    expect(sim.state.marks).toBe(marks - 1);
    expect(closureOf(sim.connections[0]!, WINTER)).toBeNull();
  });

  it('keeps the old route when a reshape is invalid', () => {
    const sim = start();
    sim.addConnection(HIGH);
    const before = JSON.stringify(sim.state.connections);
    const bad = sim.reshapeConnection('c1', [{ x: 815, y: 1000 }]);
    expect(bad.ok).toBe(false);
    expect(JSON.stringify(sim.state.connections)).toBe(before);
  });

  it('removes a connection and the travellers on it', () => {
    const sim = start();
    sim.addConnection(HIGH);
    runSeconds(sim, 10);
    expect(sim.agents.length).toBeGreaterThan(0);
    expect(sim.removeConnection('c1')).toBe(true);
    expect(sim.connections).toHaveLength(0);
    expect(sim.agents).toHaveLength(0);
    expect(findRoute(sim.connections, 'deer', SUMMER, 'kamimori', 'shimomori')).toBeNull();
  });

  it('undoes and redoes edits, returning the strokes they cost', () => {
    const sim = start();
    const history = new History(sim);
    let commit = history.begin();
    const bridge = sim.addConnection(BRIDGE);
    if (!bridge.ok) throw new Error('bridge should be valid');
    commit(bridge.cost);
    commit = history.begin();
    const grove = sim.plant({ x: 700, y: 1560 });
    if (!grove.ok) throw new Error(`grove should be plantable: ${grove.reason}`);
    commit(grove.cost);
    expect([sim.state.marks, sim.state.strokes]).toEqual([0, 3]);

    expect(history.undo()).toBe(true);
    expect(sim.state.planted).toHaveLength(0);
    expect(history.undo()).toBe(true);
    expect([sim.connections.length, sim.state.marks, sim.state.strokes]).toEqual([0, MARKS_PER_SEASON, 0]);
    expect(history.redo()).toBe(true);
    expect(history.redo()).toBe(true);
    expect([sim.connections.length, sim.state.planted.length, sim.state.marks]).toEqual([1, 1, 0]);
  });
});

describe('planting', () => {
  it('plants a grove that corridors can meet at, and deer travel through', () => {
    const sim = start('free');
    const grove = sim.plant({ x: 690, y: 760 });
    if (!grove.ok) throw new Error(grove.reason);
    expect(placeById(sim.board, grove.place.id).kind).toBe('grove');
    ok(sim.addConnection({ type: 'corridor', from: 'kamimori', to: grove.place.id, control: [] }));
    ok(sim.addConnection({ type: 'corridor', from: grove.place.id, to: 'hanano', control: [{ x: 1010, y: 610 }, { x: 1170, y: 632 }] }));
    expect(findRoute(sim.connections, 'deer', SUMMER, 'kamimori', 'hanano')).toHaveLength(2);
  });

  it('explains where a grove cannot go', () => {
    const sim = start('free');
    const reason = (x: number, y: number) => {
      const result = sim.canPlant({ x, y });
      return result.ok ? 'ok' : result.reason;
    };
    expect(reason(1030, 1700)).toMatch(/water/i);
    expect(reason(820, 1000)).toMatch(/rock/i);
    expect(reason(480, 1600)).toMatch(/too close to seseragi/i);
    sim.addConnection(BRIDGE);
    expect(reason(720, 1742)).toMatch(/route already runs/i);
  });

  it('removes a grove together with the corridors that ended there', () => {
    const sim = start('free');
    const grove = sim.plant({ x: 690, y: 760 });
    if (!grove.ok) throw new Error(grove.reason);
    sim.addConnection({ type: 'corridor', from: 'kamimori', to: grove.place.id, control: [] });
    sim.addConnection(BRIDGE);
    expect(sim.removePlant(grove.place.id)).toBe(true);
    expect(sim.connections.map((c) => c.type)).toEqual(['path']);
    expect(sim.board.places.some((p) => p.kind === 'grove')).toBe(false);
  });
});

describe('campaign', () => {
  it('can be completed within par and the first year on every board', () => {
    for (const valley of [brook, ...BOARDS]) {
      const sim = new Simulation(valley, newGameState(valley, 'free'));
      let won = false;
      // Free Play proves the routes are legal together; Journey proves they fit the allowance.
      for (const route of valley.solution) ok(sim.addConnection(route));
      expect(sim.state.strokes).toBeLessThanOrEqual(valley.par);

      const journey = new Simulation(valley, newGameState(valley, 'journey'));
      journey.events.on('won', () => (won = true));
      const pending = [...valley.solution];
      // A valley of several reaches is played a chapter at a time; each should fall within its year and par.
      const chapters = valley.reaches?.length ?? 1;
      while (journey.state.outcome === 'playing' && journey.year <= valley.years * chapters) {
        // Draw each route as soon as the season's strokes allow (and its reach has opened).
        while (pending.length && journey.addConnection(pending[0]!).ok) pending.shift();
        journey.step();
      }
      expect(pending).toHaveLength(0);
      expect(won).toBe(true);
      expect(journey.state.ratings).toEqual(new Array(chapters).fill(3));
    }
  });

  it('does not grant a wish for a line that merely joins two places: the season must allow the journey', () => {
    const sim = start();
    sim.addConnection(HIGH); // snowed in every winter
    let overtime = false;
    sim.events.on('overtime', () => (overtime = true));
    while (!overtime) sim.step();
    expect(sim.state.completed).toContain('first-green');
    expect(sim.state.completed).not.toContain('winter-passage');
    expect(sim.state.outcome).toBe('playing');
    const failing = board.objectives.find((o) => o.id === 'winter-passage')!;
    expect(explainShortfall(sim, failing)).toMatch(/snow/i);
    // The valley plays on, and a late answer still completes it, without the first-year blossom.
    for (const route of [BRIDGE, LOW, { type: 'corridor' as const, from: 'hanano', to: 'shimomori', control: [{ x: 1352, y: 850 }] }]) ok(sim.addConnection(route));
    sim.skipToNextSeason();
    ok(sim.addConnection({ type: 'path', from: 'sakura', to: 'hanano', control: [{ x: 1620, y: 1560 }, { x: 1690, y: 1120 }, { x: 1600, y: 760 }] }));
    for (let i = 0; i < 8 && sim.state.outcome === 'playing'; i++) sim.skipToNextSeason();
    expect(sim.state.outcome).toBe('won');
    expect(sim.blossoms().map((b) => b.earned)).toEqual([true, false, true]);
  });

  it('explains a journey nobody connected', () => {
    const sim = start();
    expect(explainShortfall(sim, board.objectives[0]!)).toMatch(/nothing yet joins/i);
  });

  it('grants wishes in Free Play without ever ending', () => {
    const sim = start('free');
    for (const route of board.solution) sim.addConnection(route);
    for (let i = 0; i < 4; i++) sim.skipToNextSeason();
    expect(sim.state.completed).toHaveLength(board.objectives.length);
    expect(sim.state.outcome).toBe('playing');
  });
});

describe('determinism and persistence', () => {
  const play = () => {
    const sim = start();
    sim.addConnection(HIGH);
    runSeconds(sim, 90);
    sim.plant({ x: 700, y: 1560 });
    sim.addConnection(BRIDGE);
    runSeconds(sim, 200);
    return sim;
  };

  it('replays identically from the same seed and inputs', () => {
    const a = play();
    const b = play();
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.agents.map((x) => [x.id, x.x, x.y])).toEqual(b.agents.map((x) => [x.id, x.x, x.y]));
  });

  it('round-trips a saved valley', () => {
    const sim = play();
    const save = { ...defaultSave(), journey: sim.state, last: 'journey' as const, completed: ['seseragi'], best: { seseragi: 2 } };
    const loaded = parseSave(JSON.stringify(save));
    expect(loaded.journey).toEqual(sim.state);
    expect(loaded.best).toEqual({ seseragi: 2 });
    const resumed = new Simulation(board, loaded.journey!);
    expect(resumed.connections.map((c) => c.id)).toEqual(sim.connections.map((c) => c.id));
    expect(resumed.board.places.filter((p) => p.kind === 'grove')).toHaveLength(1);
    expect([resumed.season, resumed.year, resumed.state.marks]).toEqual([sim.season, sim.year, sim.state.marks]);
  });

  it('falls back to defaults for missing, corrupt or outdated saves', () => {
    expect(parseSave(null)).toEqual(defaultSave());
    expect(parseSave('{not json')).toEqual(defaultSave());
    expect(parseSave(JSON.stringify({ version: SAVE_VERSION - 1, completed: ['x'] }))).toEqual(defaultSave());
    expect(parseSave(JSON.stringify({ version: SAVE_VERSION, journey: { boardId: 3 } })).journey).toBeNull();
  });
});

describe('scenery and art', () => {
  it('lays out the same scenery every time, clear of water and settlements', () => {
    const river = new River(board);
    const a = layoutScenery(board, river);
    const b = layoutScenery(board, river);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(300);
    const village = placeById(board, 'seseragi');
    const authored = new Set(board.sprites.map((sprite) => `${sprite.x},${sprite.y}`));
    const trees = new Set(['dense-forest', 'forest-grove', 'sparse-woodland', 'pine', 'deciduous-small', 'maple']);
    for (const item of a) {
      if (authored.has(`${item.x},${item.y}`)) continue;
      // Bank boulders may stand in the shallows; nothing sits out in the stream.
      expect(river.edgeDistance(item)).toBeGreaterThanOrEqual(-12);
      // The village clearing is kept open: no tree is scattered into it.
      if (trees.has(item.asset)) expect(Math.hypot(item.x - village.x, item.y - village.y)).toBeGreaterThanOrEqual(village.radius * 0.8);
    }
  });

  it('falls back to procedural art for ids missing from the manifest', () => {
    const entry = { file: 'deer.webp', size: [10, 10] as [number, number], logical: [10, 10] as [number, number], anchor: [0.5, 1] as [number, number], category: 'wildlife', kind: 'sprite', season: 'shared', group: 'deer', approved: true };
    const manifest = { version: 1, assets: { deer: entry } };
    expect(resolveArt(manifest, 'deer').source).toBe('image');
    expect(resolveArt(manifest, 'villager').source).toBe('fallback');
    expect(resolveArt(null, 'deer').source).toBe('fallback');
  });
});

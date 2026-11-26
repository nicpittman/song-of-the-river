import { describe, expect, it } from 'vitest';
import { dist, type Vec } from '../core/math';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { COAST_BRIDGE } from '../world/boards/kawagiriSites';
import { River } from '../world/river';
import { bridgeDeck } from './bridges';
import { openGround } from './conditions';
import { WalkingMap } from './navigation';
import { reviewGame } from './review';
import { newAdventure, type AdventureState, type Building } from './state';
import { NARROWS } from './structures';
import { STREAM_CROSSING } from './stream';
import { todayOf } from './world';

const river = new River(adventureValley);
const nav = new WalkingMap(adventureValley, river);
const OLD_FORD = { x: 1052, y: 432 };
const SEED = 2086;

/** The deck's walking band: between the deck ends (and a step onto each bank), no wider than the deck. */
function onDeck(p: Vec, at: Vec): boolean {
  const deck = bridgeDeck(river, at)!;
  return Math.abs(p.y - at.y) <= 22 && p.x >= deck.banks[0].x - 64 && p.x <= deck.banks[1].x + 64;
}

/** A route sampled every 6 px. */
function samples(route: readonly Vec[]): Vec[] {
  const out: Vec[] = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!, b = route[i]!;
    const steps = Math.max(1, Math.ceil(dist(a, b) / 6));
    for (let k = 0; k <= steps; k++) out.push({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps });
  }
  return out;
}

/** The first point of a route over water outside `allowed`, or null. */
function wetPoint(route: readonly Vec[], allowed: (p: Vec) => boolean): Vec | null {
  return samples(route).find((p) => river.edgeDistance(p) < 0 && !allowed(p)) ?? null;
}

/** Dry points on each bank around a crossing, at several heights above and below it. */
function banks(at: Vec, west: number, east: number): Array<[Vec, Vec]> {
  const pairs: Array<[Vec, Vec]> = [];
  for (const dy of [-200, -90, 0, 90, 200]) {
    for (const ey of [-160, 0, 160]) {
      const from = { x: west, y: at.y + dy }, to = { x: east, y: at.y + ey };
      if (nav.walkable(from) && nav.walkable(to)) pairs.push([from, to]);
    }
  }
  return pairs;
}

function built(state: AdventureState, kind: Building['kind'], at: Vec, region: number): void {
  state.buildings.push({ id: state.nextId++, kind, x: at.x, y: at.y, region, work: 2, placed: 1 });
}

function firstDay(level: 'high' | 'middle' | 'low'): number {
  for (let day = 1; day < 60; day++) if (todayOf(SEED, day).level === level) return day;
  throw new Error(`no ${level} water day`);
}

describe('bridge crossings', () => {
  const cases: Array<{ name: string; at: Vec; kind: Building['kind'] | null; region: number; west: number; east: number }> = [
    { name: 'Shiobashi Bridge', at: COAST_BRIDGE, kind: null, region: 2, west: 760, east: 1560 },
    { name: 'the Mio footbridge', at: NARROWS, kind: 'bridge', region: 1, west: 820, east: 1330 },
    { name: 'the Old Ford footbridge', at: OLD_FORD, kind: 'ford-bridge', region: 0, west: 860, east: 1260 },
  ];
  for (const c of cases) {
    it(`walks over ${c.name} from deck end to deck end, never through the water beside it`, () => {
      const state = newAdventure();
      if (c.kind) built(state, c.kind, c.at, c.region);
      // High water: the stones below the Old Ford are covered, so the deck is the only way over.
      const today = todayOf(SEED, firstDay('high'));
      nav.setOpenGround(openGround(adventureValley, today, state));
      const deck = bridgeDeck(river, c.at)!;
      const pairs = banks(c.at, c.west, c.east);
      expect(pairs.length).toBeGreaterThan(4);
      for (const [from, to] of pairs) {
        for (const [a, b] of [[from, to], [to, from]] as const) {
          const route = nav.route(a, b, 6800);
          expect(route, `${c.name}: ${a.x},${a.y} to ${b.x},${b.y}`).not.toBeNull();
          const wet = wetPoint(route!, (p) => onDeck(p, c.at));
          expect(wet, `${c.name}: in the water at ${wet?.x},${wet?.y}`).toBeNull();
          // Over the whole deck, end to end, on its level line.
          const along = samples(route!);
          for (const end of deck.banks) expect(along.some((p) => dist(p, end) < 24), `${c.name}: misses the deck end ${end.x}`).toBe(true);
        }
      }
    });
  }

  it('uses the stones at the Old Ford only when they are above water', () => {
    const state = newAdventure();
    built(state, 'ford-bridge', OLD_FORD, 0);
    const high = openGround(adventureValley, todayOf(SEED, firstDay('high')), state);
    const low = openGround(adventureValley, todayOf(SEED, firstDay('low')), state);
    const stones = (g: typeof high) => g.some((o) => o.at.x === OLD_FORD.x && o.at.y === OLD_FORD.y);
    expect(stones(high)).toBe(false);
    expect(stones(low)).toBe(true);
  });

  it('crosses the Numata stream only at the stones or the ford', () => {
    const state = newAdventure();
    built(state, 'stones', STREAM_CROSSING, 1);
    for (const day of [firstDay('high'), firstDay('low')]) {
      const ground = openGround(adventureValley, todayOf(SEED, day), state);
      nav.setOpenGround(ground);
      const crossing = ground.find((g) => dist(g.at, STREAM_CROSSING) < 1);
      if (!crossing) continue;
      for (const [from, to] of banks(STREAM_CROSSING, STREAM_CROSSING.x - 160, STREAM_CROSSING.x + 160)) {
        const route = nav.route(from, to, 6800);
        if (!route) continue;
        const wet = wetPoint(route, (p) => ground.some((g) => dist(g.at, p) < g.r));
        expect(wet, `day ${day}: in the water at ${wet?.x},${wet?.y}`).toBeNull();
      }
    }
  });

  it('keeps the walks of a real outing over Shiobashi on the deck', () => {
    const sim = new Simulation(adventureValley, reviewGame('crossing'));
    const a = sim.expedition!;
    const [first, ...rest] = a.state.people.map((p) => p.id);
    expect(a.assign({ person: first!, place: 'shiobashi', activity: 'explore', item: null, companion: null }).ok).toBe(true);
    for (const person of rest) a.rest(person);
    expect(a.begin().ok).toBe(true);
    const walks = a.state.outings.flatMap((o) => o.legs).filter((leg) => leg.kind === 'walk' && leg.points);
    expect(walks.length).toBeGreaterThan(0);
    let crossed = false;
    for (const leg of walks) {
      expect(wetPoint(leg.points!, (p) => onDeck(p, COAST_BRIDGE))).toBeNull();
      crossed ||= leg.points!.some((p) => onDeck(p, COAST_BRIDGE) && river.edgeDistance(p) < 0);
    }
    expect(crossed).toBe(true);
  });
});

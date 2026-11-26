/**
 * Where people can walk. A grid over the valley: a cell is walkable if it is
 * on dry ground outside every building, or inside one of today's "open ground"
 * circles (stepping stones the river has uncovered, a gravel bar at low water,
 * a finished bridge). The valley's lanes cost much less to walk, so people keep
 * to them where they go the right way and leave them only for the last stretch.
 * Routes are found with A*, rounded into smooth curves, and cached until the
 * ground changes.
 *
 * Diagonal steps never cut a wet or walled corner, smoothing never moves a
 * route off walkable ground, and nothing crosses a bridge's sides: people step
 * onto a deck at one end and off at the other.
 */

import { dist, pointSegment, type Vec } from '../core/math';
import type { River } from '../world/river';
import type { BoardDef } from '../world/types';
import { buildingFootprints } from './settlement';

const STEP = 32;
/** Walking along a lane costs this fraction of walking across open ground. */
const LANE_COST = 0.4;
/** Rounding passes over each route. */
const SMOOTHING = 3;
/** How far inside the water's edge a cell must be before it counts as wet. */
const BANK = 32;
const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

export interface OpenGround {
  at: Vec;
  r: number;
  /** Set on a bridge's walking band: the deck it belongs to, whose sides no walk may cross. */
  deck?: Deck;
}

/** A bridge deck on its level line, from its west end to its east end. */
export interface Deck {
  y: number;
  west: number;
  east: number;
}

/** A deck's sides stand this far either side of its level line, just outside its walking band. */
const RAIL = 24;

export class WalkingMap {
  private readonly columns: number;
  private readonly dryCache = new Map<number, boolean>();
  private readonly laneCache = new Map<number, boolean>();
  private readonly routes = new Map<string, Vec[] | null>();
  private readonly nearest = new Map<string, number | null>();
  private readonly endpoints = new Map<string, Vec[] | null>();
  private readonly footprints: ReturnType<typeof buildingFootprints>;
  /** Building geometry is static; keep edge checks across water-level changes. */
  private readonly wallEdges = new Map<string, boolean>();
  private ground: readonly OpenGround[] = [];
  private decks: Deck[] = [];

  constructor(
    private readonly board: BoardDef,
    private readonly river: River,
  ) {
    this.columns = Math.ceil(board.width / STEP) + 1;
    this.footprints = buildingFootprints(board);
  }

  /** Replaces today's open ground and forgets every cached route. */
  setOpenGround(ground: readonly OpenGround[]): void {
    const same = ground.length === this.ground.length && ground.every((g, i) => g.at.x === this.ground[i]!.at.x && g.at.y === this.ground[i]!.at.y && g.r === this.ground[i]!.r);
    if (same) return;
    this.ground = ground;
    this.decks = [...new Set(ground.flatMap((g) => g.deck ? [g.deck] : []))];
    this.invalidate();
  }

  invalidate(): void {
    this.dryCache.clear();
    this.routes.clear();
    this.nearest.clear();
    this.endpoints.clear();
  }

  /** The route's first and last points are the true ends, not their grid cells. */
  private withEnds(route: Vec[] | null, from: Vec, to: Vec): Vec[] | null {
    if (!route) return null;
    const ends = [...route];
    if (this.walkable(from) && this.clearAlong([from, ends[0]!])) ends.unshift(from);
    if (this.walkable(to) && this.clearAlong([ends[ends.length - 1]!, to])) ends.push(to);
    return ends;
  }

  /** A walking route between two points, or null if water is in the way. `bottom` is the lowest y open to walkers. */
  route(from: Vec, to: Vec, bottom: number): Vec[] | null {
    const exact = `${from.x}:${from.y}:${to.x}:${to.y}:${bottom}`;
    if (this.endpoints.has(exact)) {
      const cached = this.endpoints.get(exact)!;
      return cached ? [...cached] : null;
    }
    const start = this.nearestOpen(from);
    const end = this.nearestOpen(to);
    if (start === null || end === null) return null;
    const key = `${start}:${end}:${bottom}`;
    if (!this.routes.has(key)) {
      const reverse = this.routes.get(`${end}:${start}:${bottom}`);
      this.routes.set(key, reverse === undefined ? this.search(start, end, bottom) : reverse ? [...reverse].reverse() : null);
    }
    const result = this.withEnds(this.routes.get(key)!, from, to);
    if (this.endpoints.size >= 512) this.endpoints.clear();
    this.endpoints.set(exact, result);
    return result ? [...result] : null;
  }

  /** True if a point is walkable today. */
  walkable(p: Vec): boolean {
    if (p.x < 40 || p.x > this.board.width - 40 || p.y < 0) return false;
    if (p.y > (this.board.sea?.y ?? this.board.height) - 45) return false;
    if (this.insideBuilding(p)) return false;
    if (this.ground.some((g) => dist(g.at, p) < g.r)) return true;
    return this.river.edgeDistance(p) > BANK;
  }

  /** True if a point stands on a solid building's ground. */
  insideBuilding(p: Vec): boolean {
    return this.footprints.some((f) => p.x > f.left && p.x < f.right && p.y > f.top && p.y < f.bottom);
  }

  /** True if a point is on one of the valley's lanes. */
  onLane(p: Vec): boolean {
    return this.board.lanes.some((lane) => {
      const half = (lane.width ?? 26) / 2 + 12;
      for (let i = 1; i < lane.points.length; i++) {
        if (pointSegment(p, lane.points[i - 1]!, lane.points[i]!).d < half) return true;
      }
      return false;
    });
  }

  private point(id: number): Vec {
    return { x: (id % this.columns) * STEP, y: Math.floor(id / this.columns) * STEP };
  }

  private cellOf(p: Vec): number {
    return Math.round(p.y / STEP) * this.columns + Math.round(p.x / STEP);
  }

  private lane(id: number): boolean {
    let on = this.laneCache.get(id);
    if (on === undefined) {
      on = this.onLane(this.point(id));
      this.laneCache.set(id, on);
    }
    return on;
  }

  private open(id: number): boolean {
    let dry = this.dryCache.get(id);
    if (dry === undefined) {
      dry = id >= 0 && this.walkable(this.point(id));
      this.dryCache.set(id, dry);
    }
    return dry;
  }

  /** The closest walkable cell within a few steps of `p`. */
  private nearestOpen(p: Vec): number | null {
    const key = `${p.x}:${p.y}`;
    if (this.nearest.has(key)) return this.nearest.get(key)!;
    const centre = this.cellOf(p);
    let best: number | null = null;
    let bestDistance = Infinity;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const id = centre + dy * this.columns + dx;
        if (!this.open(id)) continue;
        const d = dist(p, this.point(id));
        if (d < bestDistance) {
          best = id;
          bestDistance = d;
        }
      }
    }
    if (this.nearest.size > 2048) this.nearest.clear();
    this.nearest.set(key, best);
    return best;
  }

  private search(start: number, end: number, bottom: number): Vec[] | null {
    const goal = this.point(end);
    const cost = new Map<number, number>([[start, 0]]);
    const previous = new Map<number, number>();
    const frontier = new MinHeap();
    frontier.push(start, 0);
    const closed = new Set<number>();
    let iterations = 0;
    while (frontier.size > 0 && iterations++ < 20000) {
      const current = frontier.pop();
      if (closed.has(current)) continue;
      closed.add(current);
      if (current === end) return this.unwind(start, end, previous);
      const here = this.point(current);
      const base = cost.get(current)!;
      for (const [dx, dy] of NEIGHBOURS) {
        const next = current + dy * this.columns + dx;
        if (closed.has(next)) continue;
        const there = this.point(next);
        if (there.y > bottom - 35 || Math.abs(there.x - here.x) > STEP * 1.1 || !this.open(next)) continue;
        // No cutting diagonally past a wet corner.
        if (dx && dy && (!this.open(current + dx) || !this.open(current + dy * this.columns))) continue;
        const edge = current < next ? `${current}:${next}` : `${next}:${current}`;
        let clear = this.wallEdges.get(edge);
        if (clear === undefined) {
          clear = this.clearBuildings(here, there);
          if (this.wallEdges.size >= 32768) this.wallEdges.clear();
          this.wallEdges.set(edge, clear);
        }
        if (!clear || !this.clearRails(here, there)) continue;
        const total = base + dist(here, there) * (this.lane(next) && this.lane(current) ? LANE_COST : 1);
        if (total >= (cost.get(next) ?? Infinity)) continue;
        cost.set(next, total);
        previous.set(next, current);
        frontier.push(next, total + dist(there, goal) * LANE_COST);
      }
    }
    return null;
  }

  private unwind(start: number, end: number, previous: Map<number, number>): Vec[] {
    const path: Vec[] = [];
    for (let id = end; id !== start; id = previous.get(id)!) path.push(this.point(id));
    path.push(this.point(start));
    let route = simplify(path.reverse());
    for (let i = 0; i < SMOOTHING; i++) route = this.round(route);
    return route;
  }

  /** One pass of corner cutting (Chaikin), kept only where the new curve stays walkable. */
  private round(points: Vec[]): Vec[] {
    if (points.length < 3) return points;
    const out: Vec[] = [points[0]!];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const q = { x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 };
      const r = { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 };
      if (i > 0) out.push(q);
      if (i < points.length - 2) out.push(r);
    }
    out.push(points[points.length - 1]!);
    return this.clearAlong(out) ? out : points;
  }

  /** True if every stretch of a route keeps to walkable ground. */
  clearAlong(points: readonly Vec[]): boolean {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      if (!this.clearBuildings(a, b) || !this.clearRails(a, b)) return false;
      const steps = Math.max(1, Math.ceil(dist(a, b) / 10));
      for (let k = 0; k <= steps; k++) {
        const p = { x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps };
        if (!this.walkable(p)) return false;
      }
    }
    return true;
  }

  /** People step onto a bridge at its ends, never over its sides: no stretch may cross a deck's rail. */
  private clearRails(a: Vec, b: Vec): boolean {
    for (const deck of this.decks) {
      if (Math.max(a.x, b.x) <= deck.west || Math.min(a.x, b.x) >= deck.east) continue;
      if (Math.max(a.y, b.y) <= deck.y - RAIL || Math.min(a.y, b.y) >= deck.y + RAIL) continue;
      for (const y of [deck.y - RAIL, deck.y + RAIL]) {
        if ((a.y - y) * (b.y - y) >= 0) continue;
        const x = a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
        if (x > deck.west && x < deck.east) return false;
      }
    }
    return true;
  }

  /** A thin shed can sit between two dry grid nodes; test the entire segment. */
  private clearBuildings(a: Vec, b: Vec): boolean {
    return !this.footprints.some(f => segmentEntersRectangle(a, b, f));
  }
}

/** Strict interior intersection: grazing an outer edge is allowed, cutting a corner is not. */
export function segmentEntersRectangle(a: Vec, b: Vec, rect: { left: number; right: number; top: number; bottom: number }): boolean {
  if (Math.max(a.x, b.x) <= rect.left || Math.min(a.x, b.x) >= rect.right ||
      Math.max(a.y, b.y) <= rect.top || Math.min(a.y, b.y) >= rect.bottom) return false;
  let enter = 0, exit = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx) { const t1 = (rect.left - a.x) / dx, t2 = (rect.right - a.x) / dx; enter = Math.max(enter, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2)); }
  if (dy) { const t1 = (rect.top - a.y) / dy, t2 = (rect.bottom - a.y) / dy; enter = Math.max(enter, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2)); }
  return enter < exit;
}

/** Drops points that lie on a straight run, keeping the shape of the route. */
function simplify(points: Vec[]): Vec[] {
  if (points.length < 3) return points;
  const out = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const straight = (b.x - a.x) * (c.y - b.y) === (b.y - a.y) * (c.x - b.x);
    if (!straight) out.push(b);
  }
  out.push(points[points.length - 1]!);
  return out;
}

export function routeLength(points: readonly Vec[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1]!, points[i]!);
  return total;
}

/** The point `travelled` units along a route, with the heading there. */
export function alongRoute(points: readonly Vec[], travelled: number): Vec & { angle: number } {
  let left = travelled;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const d = dist(a, b);
    if (left <= d) {
      const t = d > 0 ? left / d : 1;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    left -= d;
  }
  const last = points[points.length - 1] ?? { x: 0, y: 0 };
  return { x: last.x, y: last.y, angle: 0 };
}

/** A small binary heap of cell ids keyed by priority. */
class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, key: number): void {
    this.ids.push(id);
    this.keys.push(key);
    let i = this.ids.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent]! <= key) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.ids[0]!;
    const lastId = this.ids.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.ids.length > 0) {
      this.ids[0] = lastId;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.ids.length && this.keys[left]! < this.keys[smallest]!) smallest = left;
        if (right < this.ids.length && this.keys[right]! < this.keys[smallest]!) smallest = right;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.ids[a], this.ids[b]] = [this.ids[b]!, this.ids[a]!];
    [this.keys[a], this.keys[b]] = [this.keys[b]!, this.keys[a]!];
  }
}

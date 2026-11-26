/**
 * Connections are the player's whole vocabulary: a curve drawn between two
 * places. This module turns a gesture into control points, control points into
 * a validated connection, and explains (gently) when a route cannot exist.
 *
 * Geometry is kept separate from function. `ConnectionData` is what the player
 * made and what gets saved; `Connection` adds everything derived from it that
 * the simulation needs (the walkable line, crossings, snow exposure).
 */

import { type Vec, dist } from '../core/math';
import { Polyline, polylineIntersections, simplify, smoothCurve, thin } from './geometry';
import type { River } from './river';
import { isSnowbound, placeById, zoneAt } from './terrain';
import type { BoardDef, ConnectionType, FloodplainDef, FordDef, PlaceDef } from './types';

export interface ConnectionData {
  id: string;
  type: ConnectionType;
  from: string;
  to: string;
  /** Interior control points; the endpoints are derived from the two places. */
  control: Vec[];
}

export interface Crossing extends Vec {
  /** Distance along the connection. */
  along: number;
  /** `stones` use a natural ford and can flood; a `bridge` is always passable. */
  style: 'stones' | 'bridge';
  ford: FordDef | null;
  width: number;
  /** Direction of travel across the water, radians. */
  angle: number;
}

export interface Connection extends ConnectionData {
  line: Polyline;
  crossings: Crossing[];
  /** Stretch of the line (start, end distance) that lies above the winter snowline, if any. */
  snow: [number, number] | null;
  /** Stretches of the line that cross water meadows, which flood when the river is high. */
  wet: Array<{ plain: FloodplainDef; span: [number, number] }>;
}

export type Verdict = { ok: true; connection: Connection } | { ok: false; reason: string; at: Vec };

/** How far inside a place its routes begin, as a fraction of the radius. */
const ENTRY_DEPTH = 0.45;
/** A crossing this close to a ford is pulled onto it. */
const FORD_SNAP = 95;
const MAX_CROSSINGS = 3;

/** The connection a gesture between two places would create, or null if they have nothing in common. */
export function connectionTypeFor(from: PlaceDef, to: PlaceDef): ConnectionType | null {
  if (from.id === to.id) return null;
  return from.links.find((type) => to.links.includes(type)) ?? null;
}

/**
 * Turns a raw pointer trace into interior control points: thinned, simplified
 * and trimmed to the stretch between the two places.
 */
export function traceToControl(from: PlaceDef, to: PlaceDef, trace: readonly Vec[]): Vec[] {
  const outside = thin(trace, 14).filter(
    (p) => dist(p, from) > from.radius * 0.8 && dist(p, to) > to.radius * 0.8,
  );
  if (outside.length <= 2) return outside.length ? [outside[Math.floor(outside.length / 2)]!] : [];
  // Simplify, then drop the first and last points: the derived endpoints take their place.
  return simplify(outside, 16);
}

/** A gently bowed default route, used when the player taps two places instead of drawing. */
export function defaultControl(from: PlaceDef, to: PlaceDef): Vec[] {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const span = dist(from, to);
  // Bow downhill a little so the default reads as a drawn line, not a ruler.
  return [{ x: mx - ((to.y - from.y) / span) * span * 0.06, y: my + (Math.abs(to.x - from.x) / span) * span * 0.06 }];
}

/** Where a route enters a place: inside the rim, facing the next point on the route. */
function entryPoint(place: PlaceDef, toward: Vec): Vec {
  const d = Math.max(1, dist(place, toward));
  const depth = place.radius * ENTRY_DEPTH;
  return { x: place.x + ((toward.x - place.x) / d) * depth, y: place.y + ((toward.y - place.y) / d) * depth };
}

function fordNear(board: BoardDef, p: Vec, reach: number): FordDef | null {
  let best: FordDef | null = null;
  let bestD = reach;
  for (const ford of board.fords) {
    const d = dist(p, ford);
    if (d <= bestD) {
      best = ford;
      bestD = d;
    }
  }
  return best;
}

/** The smoothed line a set of control points describes between two places, valid or not. */
export function routeLine(from: PlaceDef, to: PlaceDef, control: readonly Vec[]): Polyline {
  return controlLine(from, to, control);
}

function controlLine(from: PlaceDef, to: PlaceDef, control: readonly Vec[]): Polyline {
  const first = control[0] ?? to;
  const last = control[control.length - 1] ?? from;
  return new Polyline(smoothCurve([entryPoint(from, first), ...control, entryPoint(to, last)], 10));
}

/**
 * Soft snapping: where the drawn line crosses the river close to a ford, bend
 * it through the stones. The preview uses this same function, so the player
 * sees the nudge while drawing rather than getting a silently different route.
 */
export function snapToFords(board: BoardDef, river: River, from: PlaceDef, to: PlaceDef, control: readonly Vec[]): Vec[] {
  let out = control.map((p) => ({ ...p }));
  for (const crossing of river.crossings(controlLine(from, to, out))) {
    const ford = fordNear(board, crossing, FORD_SNAP);
    if (!ford || dist(crossing, ford) < ford.radius * 0.35) continue;
    // Replace nearby control points with one on the ford, keeping route order.
    const kept = out.filter((p) => dist(p, ford) > FORD_SNAP);
    const line = controlLine(from, to, kept);
    const along = line.nearest(ford).along;
    let index = 0;
    while (index < kept.length && line.nearest(kept[index]!).along < along) index++;
    kept.splice(index, 0, { x: ford.x, y: ford.y });
    out = kept;
  }
  return out;
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Derives the functional connection from player geometry, or explains why it
 * cannot exist. `others` are the routes already in the valley: deer and people
 * keep apart, so a corridor and a footpath may never cross or share stones.
 */
export function buildConnection(board: BoardDef, river: River, data: ConnectionData, others: readonly Connection[] = []): Verdict {
  const from = placeById(board, data.from);
  const to = placeById(board, data.to);
  const line = controlLine(from, to, data.control);
  const fail = (reason: string, at: Vec): Verdict => ({ ok: false, reason, at });

  if (line.length < 80) return fail('These two are already neighbours.', line.at(line.length / 2));

  for (const p of line.points) {
    if (p.x < 0 || p.y < 0 || p.x > board.width || p.y > board.height) {
      return fail('That wanders out of the valley.', p);
    }
    if (board.sea && p.y > board.sea.y - 30) return fail('That way lies the sea.', p);
    const zone = zoneAt(board, p);
    if (zone) return fail(zone.reason, p);
    if (data.type === 'corridor') {
      const village = board.places.find(
        (place) => place.kind === 'village' && place.id !== from.id && place.id !== to.id && dist(p, place) < place.radius * 0.85,
      );
      if (village) return fail(`Deer keep well clear of ${village.name}.`, p);
    } else {
      const wood = board.places.find(
        (place) => (place.kind === 'forest' || place.kind === 'grove') && place.id !== from.id && place.id !== to.id && dist(p, place) < place.radius * 0.8,
      );
      if (wood) return fail(`Footpaths keep out of the deer's woods.`, p);
    }
  }

  const raw = river.crossings(line);
  if (raw.length > MAX_CROSSINGS) return fail('That crosses the water too many times.', raw[MAX_CROSSINGS]!);
  const crossings: Crossing[] = [];
  for (const hit of raw) {
    const ford = fordNear(board, hit, 0) ?? board.fords.find((f) => dist(hit, f) <= f.radius) ?? null;
    const a = line.points[hit.segment]!;
    const b = line.points[hit.segment + 1]!;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    if (ford) {
      crossings.push({ x: hit.x, y: hit.y, along: hit.along, style: 'stones', ford, width: hit.width, angle });
    } else if (data.type === 'corridor') {
      return fail('Deer need shallow water to cross. Look for stepping stones.', hit);
    } else if (hit.width > board.maxBridgeSpan) {
      return fail('The river is too wide to bridge here.', hit);
    } else {
      crossings.push({ x: hit.x, y: hit.y, along: hit.along, style: 'bridge', ford: null, width: hit.width, angle });
    }
  }

  const strangers = others.filter((other) => other.type !== data.type && other.id !== data.id);
  for (const other of strangers) {
    for (const crossing of crossings) {
      if (crossing.ford && other.crossings.some((c) => c.ford?.id === crossing.ford!.id)) {
        return fail(`${capitalise(crossing.ford.name)} already carry ${other.type === 'corridor' ? 'the deer' : 'a footpath'}.`, crossing);
      }
    }
    // Two routes may mingle inside a place they both serve; anywhere else, crossing is not allowed.
    const shared = [from, to].filter((place) => place.id === other.from || place.id === other.to);
    const hit = polylineIntersections(line, other.line).find((p) => !shared.some((place) => dist(p, place) < place.radius));
    if (hit) return fail(data.type === 'corridor' ? 'Deer will not cross a footpath.' : `A footpath here would cut across the deer's way.`, hit);
  }

  // A route may touch water only where it crosses: no wading along the riverbed.
  for (const p of line.points) {
    const hit = river.nearest(p);
    if (hit.d - hit.half < -4 && !crossings.some((c) => dist(c, p) < hit.half + 46)) {
      return fail('A route cannot follow the riverbed.', p);
    }
  }

  let snow: [number, number] | null = null;
  line.points.forEach((p, i) => {
    if (!isSnowbound(board, p)) return;
    const d = line.cumulative[i]!;
    snow = snow ? [snow[0], d] : [d, d];
  });

  // Water meadows the line crosses. One relieved by an open channel stays dry, so it is no concern.
  const wet: Connection['wet'] = [];
  for (const plain of board.floodplains ?? []) {
    if (plain.relievedBy?.some((id) => river.channels.some((c) => c.id === id))) continue;
    let span: [number, number] | null = null;
    line.points.forEach((p, i) => {
      if (!plain.blobs.some((b) => dist(p, b) < b.r * 0.85)) return;
      const d = line.cumulative[i]!;
      span = span ? [span[0], d] : [d, d];
    });
    if (span) wet.push({ plain, span });
  }

  return { ok: true, connection: { ...data, control: data.control.map((p) => ({ ...p })), line, crossings, snow, wet } };
}

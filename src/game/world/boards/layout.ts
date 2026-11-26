/**
 * Small helpers for composing a board by hand: rows of planted trees, fence
 * lines, items strung along a curve, and moving a reach drawn in valley
 * coordinates into its own frame. They only produce plain board data.
 */

import type { Vec } from '../../core/math';
import { mulberry32 } from '../../core/rng';
import type { Blob, BoardDef, SpriteDef } from '../types';

/**
 * A straight row of sprites from one point to another, as planted trees or a fence line.
 * Alternate items are mirrored and nudged by `jitter`, so a row never looks stamped.
 */
export function row(asset: string, x0: number, y0: number, x1: number, y1: number, n: number, scale: number, jitter = 0): SpriteDef[] {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return {
      asset,
      x: Math.round(x0 + (x1 - x0) * t + (i % 2 ? jitter : -jitter)),
      y: Math.round(y0 + (y1 - y0) * t),
      scale: scale * (i % 3 === 1 ? 0.94 : 1),
      flip: i % 2 === 1,
    };
  });
}

/**
 * Sprites strung along a curve through `points` (a terrace row that follows the
 * contour, a line of willows down a bank), about `every` apart. `seed` drives a
 * little wander in position and size so the line reads as planted by hand.
 */
export function along(asset: string, points: readonly Vec[], every: number, scale: number, seed: number, wander = 8): SpriteDef[] {
  const rng = mulberry32(seed);
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y));
  const total = lengths.reduce((a, b) => a + b, 0);
  const count = Math.max(1, Math.round(total / every) + 1);
  const out: SpriteDef[] = [];
  for (let k = 0; k < count; k++) {
    let d = count === 1 ? total / 2 : (k / (count - 1)) * total;
    let i = 0;
    while (i < lengths.length - 1 && d > lengths[i]!) d -= lengths[i++]!;
    const a = points[i]!;
    const b = points[i + 1] ?? a;
    const t = lengths[i] ? Math.min(1, d / lengths[i]!) : 0;
    out.push({
      asset,
      x: Math.round(a.x + (b.x - a.x) * t + (rng() - 0.5) * 2 * wander),
      y: Math.round(a.y + (b.y - a.y) * t + (rng() - 0.5) * wander),
      scale: Math.round(scale * (0.9 + rng() * 0.2) * 100) / 100,
      flip: rng() < 0.5,
    });
  }
  return out;
}

/**
 * A bar or islet drawn out along the current, from (x0, y0) to (x1, y1): a chain
 * of overlapping blobs, fullest in the middle and tapering to both ends, so the
 * shore stays one soft, continuous outline even when high water trims it.
 */
export function bar(x0: number, y0: number, x1: number, y1: number, width: number, n = 7): Blob[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const swell = Math.sin(Math.PI * (0.12 + 0.76 * t));
    return { x: Math.round(x0 + (x1 - x0) * t), y: Math.round(y0 + (y1 - y0) * t), r: Math.round((width / 2) * (0.45 + 0.55 * swell)) };
  });
}

/** Shorthand for a list of points. */
export const pts = (...xy: number[]): Vec[] => Array.from({ length: xy.length / 2 }, (_, i) => ({ x: xy[i * 2]!, y: xy[i * 2 + 1]! }));

/**
 * The lower reaches are drawn in valley coordinates, so their landmarks carry
 * the same numbers as the journey that visits them. `composeValley` expects each
 * reach in its own frame (y = 0 at its top edge); this moves one there.
 */
export function intoOwnFrame(board: BoardDef, top: number): BoardDef {
  const up = <T extends Vec>(p: T): T => ({ ...p, y: p.y - top });
  const blobs = <T extends Vec>(list: readonly T[]): T[] => list.map(up);
  return {
    ...board,
    hills: blobs(board.hills),
    relief: blobs(board.relief),
    channels: board.channels.map((c) => ({ ...c, points: c.points.map(([x, y, w]) => [x, y - top, w] as [number, number, number]) })),
    islands: blobs(board.islands),
    shallows: blobs(board.shallows),
    fords: blobs(board.fords),
    zones: board.zones.map((z) => ({ ...z, blobs: blobs(z.blobs) })),
    places: blobs(board.places),
    patches: board.patches.map((p) => ({ ...p, blobs: blobs(p.blobs) })),
    woods: board.woods.map((w) => ({ ...w, blobs: blobs(w.blobs) })),
    outcrops: blobs(board.outcrops),
    lanes: board.lanes.map((l) => ({ ...l, points: blobs(l.points) })),
    sprites: blobs(board.sprites),
    scatter: board.scatter.map((s) => ({ ...s, blobs: blobs(s.blobs) })),
    floodplains: board.floodplains?.map((f) => ({ ...f, blobs: blobs(f.blobs) })),
    weirs: board.weirs?.map(up),
    hearths: blobs(board.hearths),
    sea: board.sea ? { y: board.sea.y - top } : undefined,
  };
}

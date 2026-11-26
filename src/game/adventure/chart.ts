/**
 * The drawn river map for the notebook: the river's channels as centre lines
 * with half-widths, the woods and hills, and the reaches. Built once per
 * session; it does not change.
 */

import type { River } from '../world/river';
import type { BoardDef } from '../world/types';
import type { Chart } from './model';
import { bridgeCrossing } from './bridges';
import { COAST_BRIDGE } from '../world/boards/kawagiriSites';
import { REGIONS } from './regions';

/** Keep about one channel point in this many, which is plenty for a pen drawing. */
const EVERY = 2;

export function buildChart(board: BoardDef, river: River): Chart {
  const channels = river.channels.map((channel) => {
    const points = channel.line.points;
    const out: Array<{ x: number; y: number; half: number }> = [];
    for (let i = 0; i < points.length; i += EVERY) out.push(pointAt(points, channel.widths, i));
    if ((points.length - 1) % EVERY !== 0) out.push(pointAt(points, channel.widths, points.length - 1));
    return out;
  });
  return {
    width: board.width,
    height: board.height,
    channels,
    woods: board.woods.flatMap((wood) => wood.blobs.map((b) => ({ x: b.x, y: b.y, r: b.r }))),
    hills: board.relief.map((h) => ({ x: h.x, y: h.y, r: h.r })),
    regions: REGIONS.map((r) => ({ id: r.id, name: r.name, title: r.title, top: r.top, bottom: r.bottom })),
    sea: board.sea?.y ?? null,
    bridges: board.id === 'river-adventure' ? [{ ...COAST_BRIDGE, half: (bridgeCrossing(river, COAST_BRIDGE)?.width ?? 260) / 2 + 36 }] : [],
  };
}

function pointAt(points: ReadonlyArray<{ x: number; y: number }>, widths: readonly number[], i: number): { x: number; y: number; half: number } {
  const p = points[i]!;
  return { x: Math.round(p.x), y: Math.round(p.y), half: Math.round((widths[i] ?? 0) / 2) };
}

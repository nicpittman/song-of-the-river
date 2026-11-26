/**
 * Where the river level changes the ground, for the ground shader.
 *
 * Each feature is a low place the river takes at high water, or a raised one
 * it leaves bare at low water. They are written into the alpha channel of the
 * canopy map as signed heights (0.5 is ordinary ground, above it floods at
 * high water, below it surfaces at low water), and the shader draws them with
 * the river's own water and banks: at high water the flood front creeps out
 * from the lowest ground exactly as the season's water meadows do; at low
 * water the waterline draws back off a bar and the river's gravel shore shows.
 *
 *   Ukishima Shrine    the old channel behind the shrine fills, and the shrine is an island
 *   Sagi-ike    the heron pool spreads into the meadow round it
 *   Koishihama  a gravel bar below Fuchi surfaces only at low water
 *   Omagari     Mio's bend floods over the path beside it
 *   Iso         the sea covers Kawagiri's rock pools
 *
 * The Takaishi stepping stones are fords: they sink and surface in
 * `connectionLayer.ts` (see `ValleyView.setWaterLevel`).
 */

import type { Vec } from '../core/math';
import type { River } from '../world/river';
import { type DataMap, type Extent, TERRAIN_STEP } from './fields';

interface Rise {
  kind: 'blob';
  at: Vec;
  r: number;
  /** +1 floods at high water at its middle; -1 surfaces at low water. */
  height: number;
}

/** Fixed features in valley coordinates. The old channel comes from the river's closed beds. */
const FEATURES: readonly Rise[] = [
  // Sagi-ike: the pool at the low heart of the water meadow spreads outward.
  { kind: 'blob', at: { x: 896, y: 1596 }, r: 120, height: 0.85 },
  // Koishihama: the bar on the inside of the bend below Fuchi.
  { kind: 'blob', at: { x: 1018, y: 1098 }, r: 84, height: -1 },
  // Omagari: the low ground on the west side of Mio's long bend.
  { kind: 'blob', at: { x: 584, y: 4096 }, r: 92, height: 0.8 },
  // Iso: the rock pools on Kawagiri's shore.
  { kind: 'blob', at: { x: 116, y: 5990 }, r: 130, height: 0.9 },
];

/** Beds that fill at high water (by the board's channel id). */
const FLOODED_BEDS = ['old-channel'];

/** Writes the level map into the canopy map's alpha channel. */
export function bakeLevels(river: River, extent: Extent, into: DataMap): void {
  const { data, width, height } = into;
  const value = new Float32Array(width * height);
  const cell = (x: number, y: number): number => {
    const tx = Math.floor((x - extent.x) / TERRAIN_STEP);
    const ty = Math.floor((y - extent.y) / TERRAIN_STEP);
    return tx < 0 || ty < 0 || tx >= width || ty >= height ? -1 : ty * width + tx;
  };
  const visit = (at: Vec, r: number, fn: (i: number, wx: number, wy: number) => void): void => {
    for (let y = at.y - r; y <= at.y + r; y += TERRAIN_STEP) {
      for (let x = at.x - r; x <= at.x + r; x += TERRAIN_STEP) {
        const i = cell(x, y);
        if (i >= 0) fn(i, x, y);
      }
    }
  };
  const keep = (i: number, v: number): void => {
    value[i] = Math.abs(v) > Math.abs(value[i]!) ? v : value[i]!;
  };
  for (const f of FEATURES) {
    visit(f.at, f.r, (i, x, y) => {
      const d = Math.hypot(x - f.at.x, y - f.at.y) / f.r;
      if (d < 1) keep(i, f.height * (1 - d * d));
    });
  }
  // Beds: distance to the bed's centreline, segment by segment, over only the texels near each.
  for (const bed of river.beds) {
    if (!FLOODED_BEDS.includes(bed.id)) continue;
    const pts = bed.line.points;
    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s]!;
      const b = pts[s + 1]!;
      const half = bed.widths[s]! / 2;
      const r = half * 1.1;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      for (let y = Math.min(a.y, b.y) - r; y <= Math.max(a.y, b.y) + r; y += TERRAIN_STEP) {
        for (let x = Math.min(a.x, b.x) - r; x <= Math.max(a.x, b.x) + r; x += TERRAIN_STEP) {
          const i = cell(x, y);
          if (i < 0) continue;
          const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / len2));
          const d = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)) / half;
          // Full almost to the bed's edges, so the water covers the gravel rather than running down its middle.
          if (d < 1.1) keep(i, Math.max(0, 1 - d ** 6));
        }
      }
    }
  }
  for (let i = 0; i < width * height; i++) data[i * 4 + 3] = Math.round(127.5 + value[i]! * 127.5);
}

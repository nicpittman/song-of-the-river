/** A ford is a row of separate, upright river stones, never a stretched picture. */
import type { Vec } from '../core/math';
import { hashString, mulberry32 } from '../core/rng';
import type { River } from '../world/river';
import { WATER_OFFSET } from '../world/river';
import type { FordDef } from '../world/types';

export const FORD_STONE_IDS = ['ford-stone-0', 'ford-stone-1', 'ford-stone-2', 'ford-stone-3'] as const;

export interface FordStone extends Vec {
  asset: (typeof FORD_STONE_IDS)[number];
  width: number;
  flip: boolean;
}

/** Measured banks, small gaps and a little irregularity; individual stones retain their proportions. */
export function fordStones(ford: FordDef, river: River): FordStone[] {
  const hit = river.nearest(ford);
  const flow = hit.channel.line.at(hit.along).angle;
  let angle = flow + Math.PI / 2;
  while (angle > Math.PI / 2) angle -= Math.PI;
  while (angle < -Math.PI / 2) angle += Math.PI;
  const axis = { x: Math.cos(angle), y: Math.sin(angle) };
  // Dry bank contact even during spring melt. The end stones remain small stones on the bank at low water.
  const margin = Math.max(...Object.values(WATER_OFFSET)) + 8;
  const bank = (direction: number): Vec => {
    let at: Vec = ford;
    for (let d = 4; d <= 900; d += 4) {
      at = { x: ford.x + axis.x * d * direction, y: ford.y + axis.y * d * direction };
      if (river.edgeDistance(at) >= margin) break;
    }
    return at;
  };
  const a = bank(-1), b = bank(1);
  const span = Math.hypot(b.x - a.x, b.y - a.y);
  // In this camera a stone is about 26 × 13: closer centres when the row points down the screen.
  const pitch = Math.abs(axis.x) * 26 + Math.abs(axis.y) * 13 + 6;
  const count = Math.max(2, Math.ceil(span / pitch) + 1);
  const rng = mulberry32(hashString(ford.id));
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const scatter = i === 0 || i === count - 1 ? 0 : (rng() - 0.5) * 2.4;
    const width = 24 + rng() * 3;
    return {
      asset: FORD_STONE_IDS[Math.floor(rng() * FORD_STONE_IDS.length)]!,
      x: a.x + (b.x - a.x) * t - axis.y * scatter,
      y: a.y + (b.y - a.y) * t + axis.x * scatter,
      width,
      flip: rng() < 0.5,
    };
  });
}

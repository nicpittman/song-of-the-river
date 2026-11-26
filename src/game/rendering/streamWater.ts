/**
 * The stream below Seseragi as the season leaves it (see `adventure/stream.ts`).
 * No sprites: both looks are painted along the stream's own channel.
 *
 *   ice    in winter the little stream freezes over and is walked anywhere:
 *          pale ice at the water's winter width, a soft frosted edge, a cold
 *          sheen down the middle and a few hairline cracks.
 *   spate  on the days of peak melt and the autumn rains it runs brown-green
 *          and bank-full, with streaks of foam, and nobody crosses.
 *
 * Both follow the calendar rather than the travelling seasonal front, so the
 * stream looks shut on exactly the days it is shut and frozen on exactly the
 * days it can be walked. Each fades in or out over a couple of seconds.
 */

import { Container, Graphics } from 'pixi.js';
import { hashString, mulberry32 } from '../core/rng';
import type { Vec } from '../core/math';
import { STREAM_CHANNEL } from '../adventure/stream';
import { type River, WATER_OFFSET } from '../world/river';
import type { Season } from '../world/types';

const SPRING: Season = 0;
const WINTER: Season = 3;
/** Both stop short of the river, whose own water is drawn by the ground. */
const END_X = 960;
/** Over the last stretch before that they thin to nothing. */
const TAPER = 90;

export class StreamWater {
  private readonly ice = new Container();
  private readonly spate = new Container();
  private frozen: boolean;

  constructor(parent: Container, river: River, season: Season, private readonly flooded: () => boolean) {
    const stream = river.channels.find((c) => c.id === STREAM_CHANNEL);
    const points = stream?.line.points ?? [];
    const width = (offset: number) => (i: number): number => {
      const taper = Math.max(0, Math.min(1, (END_X - points[i]!.x) / TAPER));
      return Math.max(0, stream!.widths[i]! + offset * 2) * taper;
    };
    const frozen = width(WATER_OFFSET[WINTER]);
    const full = width(WATER_OFFSET[SPRING]);
    if (points.length > 1) {
      // Each band is its own layer, so overlapping round caps never darken.
      this.ice.addChild(
        band(points, (i) => frozen(i) + 12, 0xf2f6f8, 0.18),
        band(points, (i) => frozen(i) + 6, 0xe6eff4, 0.34),
        band(points, frozen, 0xcfe0ea, 0.94),
        band(points, (i) => frozen(i) * 0.38, 0xf4f8fb, 0.6),
        cracks(points, frozen),
      );
      // Soft, wet margins first, then the water, darkest where it is deepest.
      this.spate.addChild(
        band(points, (i) => full(i) + 18, 0xa7b89f, 0.14),
        band(points, (i) => full(i) + 9, 0x8faa9a, 0.26),
        band(points, full, 0x6a9792, 0.62),
        band(points, (i) => full(i) * 0.7, 0x5b8b88, 0.42),
        band(points, (i) => full(i) * 0.25, 0x86b2ad, 0.3),
        foam(points, full),
      );
    }
    this.frozen = season === WINTER;
    this.ice.alpha = this.frozen ? 1 : 0;
    this.spate.alpha = this.flooded() ? 1 : 0;
    parent.addChild(this.spate, this.ice);
    this.update(0);
  }

  setSeason(season: Season): void {
    this.frozen = season === WINTER;
  }

  update(dt: number): void {
    const ease = Math.min(1, dt * 1.2);
    this.ice.alpha += ((this.frozen ? 1 : 0) - this.ice.alpha) * ease;
    this.spate.alpha += ((this.flooded() ? 1 : 0) - this.spate.alpha) * ease;
    this.ice.visible = this.ice.alpha > 0.01;
    this.spate.visible = this.spate.alpha > 0.01;
  }
}

/**
 * A ribbon along the stream, `width(i)` across at each point, filled as one
 * shape: Graphics alpha applies per shape, so overlapping strokes would show
 * as darker beads where they meet.
 */
function band(points: readonly Vec[], width: (i: number) => number, color: number, alpha: number): Graphics {
  const left: number[] = [], right: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const w = width(i);
    if (w < 0.5 && left.length) break;
    const p = across(points, i, w, 0.5), q = across(points, i, w, -0.5);
    left.push(p.x, p.y);
    right.unshift(q.x, q.y);
  }
  const g = new Graphics();
  if (left.length >= 4) g.poly([...left, ...right]).fill({ color, alpha });
  return g;
}

/** Across the stream at point i, `t` from -0.5 (one bank) to 0.5 (the other). */
function across(points: readonly Vec[], i: number, w: number, t: number): Vec & { flow: number } {
  const a = points[i]!, from = points[Math.max(0, i - 1)]!, to = points[Math.min(points.length - 1, i + 1)]!;
  const flow = Math.atan2(to.y - from.y, to.x - from.x);
  return { x: a.x - Math.sin(flow) * w * t, y: a.y + Math.cos(flow) * w * t, flow };
}

/** A few fine cracks running partway across the ice, each a short broken line. */
function cracks(points: readonly Vec[], water: (i: number) => number): Graphics {
  const g = new Graphics();
  const rng = mulberry32(hashString('stream-ice'));
  for (let i = 3; i < points.length - 2; i += 3 + Math.floor(rng() * 4)) {
    const w = water(i);
    if (w < 12) continue;
    let at: Vec = across(points, i, w, (rng() - 0.5) * 0.6);
    const flow = across(points, i, w, 0).flow;
    // Mostly across the stream, never quite square to it.
    const heading = flow + Math.PI / 2 * (rng() < 0.5 ? 1 : -1) + (rng() - 0.5) * 0.9;
    const reach = w * (0.3 + rng() * 0.3);
    g.moveTo(at.x, at.y);
    for (let k = 0; k < 3; k++) {
      const turn = heading + (rng() - 0.5) * 0.8;
      at = { x: at.x + (Math.cos(turn) * reach) / 3, y: at.y + (Math.sin(turn) * reach) / 3 };
      g.lineTo(at.x, at.y);
    }
    // Now and then a little fork off the end.
    if (rng() < 0.5) g.lineTo(at.x + Math.cos(heading + 0.9) * reach * 0.25, at.y + Math.sin(heading + 0.9) * reach * 0.25);
  }
  g.stroke({ width: 0.9, color: 0x7591a6, alpha: 0.7, cap: 'round', join: 'round' });
  return g;
}

/** Flecks of foam carried along the full stream: short curls, here and there. */
function foam(points: readonly Vec[], water: (i: number) => number): Graphics {
  const g = new Graphics();
  const rng = mulberry32(hashString('stream-spate'));
  for (let i = 2; i < points.length - 2; i += 2 + Math.floor(rng() * 3)) {
    const w = water(i);
    if (w < 18) continue;
    const t = (rng() - 0.5) * 0.6;
    const a = across(points, i, w, t);
    const length = 5 + rng() * 7, bend = (rng() - 0.5) * 6;
    const end = { x: a.x + Math.cos(a.flow) * length, y: a.y + Math.sin(a.flow) * length };
    g.moveTo(a.x, a.y).quadraticCurveTo((a.x + end.x) / 2 - Math.sin(a.flow) * bend, (a.y + end.y) / 2 + Math.cos(a.flow) * bend, end.x, end.y);
  }
  g.stroke({ width: 1.1, color: 0xf1f4ec, alpha: 0.5, cap: 'round' });
  return g;
}

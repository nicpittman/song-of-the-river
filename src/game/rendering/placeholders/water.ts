/**
 * The sea at the river mouth: tiling sea and sand surfaces, breaking-wave
 * frames on transparent ground, and a few coastal pieces.
 * Tiling surfaces repeat seamlessly in both directions.
 */

import { type Painted, type Painter, ball, blob, canvasOf, darken, ellipse, line, painted, poly, rgbOf, ripples, shadow } from './common';
import { hash2, mulberry32 } from '../../core/rng';

/** Value noise that repeats every `period` lattice cells. */
function periodic(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const w = (v: number): number => ((v % period) + period) % period;
  const a = hash2(w(xi), w(yi), seed);
  const b = hash2(w(xi + 1), w(yi), seed);
  const c = hash2(w(xi), w(yi + 1), seed);
  const d = hash2(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function tile(size: number, density: number, shade: (u: number, v: number) => [number, number, number]): HTMLCanvasElement {
  const [canvas, ctx] = canvasOf(size, size, 1);
  const px = size * density;
  canvas.width = px;
  canvas.height = px;
  const image = ctx.createImageData(px, px);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const [r, g, b] = shade(x / px, y / px);
      const i = (y * px + x) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function sea(): Painted {
  const deep = rgbOf('#2e6a80');
  const light = rgbOf('#3f8496');
  const crest = rgbOf('#cfe4e6');
  const canvas = tile(256, 2, (u, v) => {
    const broad = periodic(u * 4, v * 4, 4, 3);
    const fine = periodic(u * 24, v * 24, 24, 4);
    let k = broad * 0.7 + fine * 0.3;
    // Long swells running across the tile, gently bent, four to a tile.
    const bend = (periodic(u * 3, v * 3, 3, 7) - 0.5) * 0.12;
    const phase = (v + bend) * 4 + Math.sin(u * Math.PI * 2) * 0.05;
    const swell = Math.sin(phase * Math.PI * 2);
    k += swell * 0.12;
    let c = [deep[0] + (light[0] - deep[0]) * k, deep[1] + (light[1] - deep[1]) * k, deep[2] + (light[2] - deep[2]) * k];
    // Pale broken lines on the swell crests.
    const lineness = Math.max(0, swell - 0.93) * 14 * Math.max(0, periodic(u * 10, v * 10, 10, 9) - 0.45) * 2.2;
    const t = Math.min(0.55, lineness * 0.6);
    c = c.map((x, i) => x + (crest[i]! - x) * t);
    return [c[0]!, c[1]!, c[2]!];
  });
  return painted(canvas, 256, 256, [0.5, 0.5], true);
}

function sand(): Painted {
  const base = rgbOf('#dccca2');
  const canvas = tile(256, 2, (u, v) => {
    const broad = periodic(u * 6, v * 6, 6, 21);
    const grain = hash2(Math.floor(u * 512), Math.floor(v * 512), 22);
    // Faint wind ripples.
    const ripple = Math.sin((v * 22 + (periodic(u * 4, v * 4, 4, 23) - 0.5) * 1.6) * Math.PI * 2);
    const k = 0.95 + broad * 0.05 + (grain - 0.5) * 0.07 + ripple * 0.018;
    return [base[0] * k, base[1] * k, base[2] * k];
  });
  return painted(canvas, 256, 256, [0.5, 0.5], true);
}

/** A breaking line of surf: 0 rising, 1 breaking, 2 spreading thin up the sand. */
function wave(phase: number): Painted {
  const W = 180;
  const H = 40;
  const [canvas, ctx] = canvasOf(W, H, 2);
  const rng = mulberry32(31 + phase);
  const along = (x: number): number => 20 + Math.sin((x / W) * Math.PI * 1.4 + 0.4) * 3;
  const end = (x: number): number => Math.min(1, x / 30, (W - x) / 30);
  for (let x = 2; x < W - 2; x += 1.5) {
    const y = along(x);
    const e = Math.max(0, end(x));
    if (phase === 0) {
      // The rising face: a band of clearer green-blue with a thin white lip.
      ellipse(ctx, x, y + 3.4, 1.8, 5, `rgba(120,182,186,${0.5 * e})`);
      ellipse(ctx, x, y - 0.6, 1.4, 1.4, `rgba(245,250,250,${0.85 * e})`);
      if (rng() > 0.7) ellipse(ctx, x, y - 1.8, 1.2, 0.9, `rgba(245,250,250,${0.6 * e})`);
    } else if (phase === 1) {
      ellipse(ctx, x, y + 2.4, 1.8, 4, `rgba(120,180,184,${0.4 * e})`);
      const r = 2 + rng() * 2.6;
      ball(ctx, x, y - rng() * 2, r, r * 0.8, '#f4f8f8', 0.05);
      if (rng() > 0.85) ellipse(ctx, x, y - 4 - rng() * 3, 0.9, 0.9, `rgba(250,252,252,${0.9 * e})`);
      ctx.globalAlpha = 1;
    } else {
      // Spent wash: a wide lacy fringe with holes.
      for (let k = 0; k < 3; k++) {
        const yy = y + 2 + k * 3.4 + rng() * 2;
        if (rng() > 0.35) ellipse(ctx, x, yy, 2 + rng() * 2, 0.9, `rgba(244,248,248,${(0.75 - k * 0.2) * e})`);
      }
    }
  }
  if (phase === 1) {
    // Fade the breaking crest's ends.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.16, 'rgba(0,0,0,1)');
    g.addColorStop(0.84, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  return painted(canvas, W, H, [0.5, 0.5]);
}

function seaStack(): Painted {
  const [canvas, ctx] = canvasOf(70, 92, 3);
  const rng = mulberry32(41);
  ripples(ctx, 35, 82, 26, 6, 0.75);
  blob(ctx, [[12, 82], [10, 60], [14, 36], [22, 20], [34, 16], [46, 20], [54, 34], [58, 58], [58, 82], [35, 86]], '#7a7468', { light: 0.32, dark: 0.4 }, (b) => {
    for (let i = 0; i < 8; i++) {
      const x = b.x0 + 6 + rng() * 40;
      const y = 26 + rng() * 48;
      line(ctx, [[x, y], [x + rng() * 2, y + 6 + rng() * 6]], 0.8, 'rgba(50,46,40,0.3)');
    }
    for (let y = 30; y < 82; y += 9) line(ctx, [[8, y], [62, y + 3]], 1, 'rgba(60,56,48,0.3)');
  });
  for (const [x, y, r] of [[26, 19, 9], [38, 15, 11], [47, 20, 8]] as const) ball(ctx, x, y, r, r * 0.6, '#3b5240', 0.2);
  line(ctx, [[37, 14], [36, 6]], 1.4, '#5a4636');
  for (const [x, y, r] of [[36, 7, 6], [31, 10, 5], [41, 10, 5]] as const) ball(ctx, x, y, r, r * 0.55, '#2f4a3c', 0.25);
  for (let x = 12; x < 60; x += 3) ellipse(ctx, x, 83 + Math.sin(x) * 1.2, 2, 1.2, 'rgba(245,250,250,0.85)');
  return painted(canvas, 70, 92, [0.5, 83 / 92]);
}

/** A gull from above, heading right. */
function gull(frame: number): Painted {
  const [canvas, ctx] = canvasOf(28, 30, 4);
  const grey = '#b9c0c6';
  for (const side of [-1, 1]) {
    const y = (v: number): number => 15 + side * v;
    if (frame) blob(ctx, [[16, y(1)], [17, y(6)], [13, y(12)], [11, y(11)], [12, y(5)], [11.6, y(1)]], grey, { light: 0.25 }, () => ellipse(ctx, 12, y(11.4), 2.2, 1.6, '#2c2c2e'));
    else blob(ctx, [[16, y(1)], [17.6, y(7)], [16.6, y(13.6)], [14.6, y(13.4)], [13, y(7)], [11.6, y(1)]], grey, { light: 0.25 }, () => ellipse(ctx, 15.6, y(13), 2, 1.8, '#2c2c2e'));
  }
  blob(ctx, [[6, 15], [10, 13.4], [18, 13.6], [21.6, 15], [18, 16.4], [10, 16.6]], '#f4f4f0', { light: 0.2 });
  blob(ctx, [[21.4, 14.6], [24, 15], [21.4, 15.4]], '#e0b44a');
  return painted(canvas, 28, 30, [0.5, 0.5]);
}

/** A rock mid-current with white water piled on its upstream side (current flows right to left in the art: mirror as needed). */
function rockFoam(): Painted {
  const [canvas, ctx] = canvasOf(56, 32, 3);
  for (let i = 0; i < 18; i++) ellipse(ctx, 34 + i * 1.1, 18 + Math.sin(i) * 5, 2.6, 1.4, 'rgba(244,248,248,0.7)');
  for (let x = 4; x < 30; x += 2.4) ellipse(ctx, x, 19 + Math.sin(x * 0.7) * 3, 2.2 - x * 0.05, 0.8, 'rgba(240,248,248,0.55)');
  shadow(ctx, 30, 22, 14, 3.4, 0.3);
  blob(ctx, [[18, 20], [20, 12], [27, 8.4], [36, 9.6], [41, 15], [40, 21.4], [30, 23.6], [21, 23]], '#7b8179', { light: 0.32 }, () => ellipse(ctx, 27, 11, 7, 3, 'rgba(120,140,70,0.55)'));
  ripples(ctx, 30, 22, 13, 2.6, 0.7);
  return painted(canvas, 56, 32, [0.5, 0.65]);
}

/**
 * A small weathered timber beacon at the end of the landing: a post with a
 * crosspiece, a little roofed lamp box and a coil of rope. Not a lighthouse;
 * something the village put up to see the boats home.
 */
function harbourLight(): Painted {
  const [canvas, ctx] = canvasOf(30, 56, 4);
  shadow(ctx, 17, 53, 11, 2.4);
  const wood = '#7e6a52';
  // Two stones at the foot, then the post, weathered grey-brown.
  ellipse(ctx, 12, 52, 5, 2.4, '#8e8c82');
  ellipse(ctx, 19, 52.6, 4, 2, '#7f7d74');
  poly(ctx, [[13.4, 52], [16.6, 52], [16.2, 18], [13.8, 18]], wood, { light: 0.35, dark: 0.35 });
  line(ctx, [[14.2, 50], [14.4, 22]], 0.35, 'rgba(240,230,210,0.35)');
  line(ctx, [[9, 30], [21, 29]], 1.3, darken(wood, 0.1));
  // Rope coiled round the post.
  for (let i = 0; i < 3; i++) line(ctx, [[13.2, 36 + i * 1.4], [16.8, 35.4 + i * 1.4]], 0.7, '#b8a07a');
  // The lamp box under a small shingled roof, glass warm.
  poly(ctx, [[10.6, 18], [19.4, 18], [19, 10.4], [11, 10.4]], darken(wood, 0.2), { light: 0.3 });
  ellipse(ctx, 15, 14.2, 2.6, 2.8, 'rgba(244,214,150,0.9)');
  line(ctx, [[15, 11], [15, 17.4]], 0.4, darken(wood, 0.3));
  poly(ctx, [[8.6, 10.8], [15, 5.6], [21.4, 10.8]], '#5c4a3a', { light: 0.35 });
  return painted(canvas, 30, 56, [16 / 30, 53 / 56]);
}

export const WATER: Record<string, Painter> = {
  sea,
  sand,
  'wave-0': () => wave(0),
  'wave-1': () => wave(1),
  'wave-2': () => wave(2),
  'sea-stack': seaStack,
  'gull-0': () => gull(0),
  'gull-1': () => gull(1),
  'rock-foam': rockFoam,
  'harbour-light': harbourLight,
};

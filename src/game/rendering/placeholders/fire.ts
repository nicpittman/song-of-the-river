/**
 * Fire and winter stand-ins. The campfire's flames differ per frame
 * (`campfire-0`..2) so the game can cycle them; the game still adds its own
 * glow, sparks and smoke on top.
 */

import { type Ctx, type Painted, type Painter, type Pt, ball, blob, bone, canvasOf, ellipse, line, painted, shadow } from './common';

function tongue(ctx: Ctx, x: number, base: number, h: number, w: number, lean: number): void {
  const g = ctx.createLinearGradient(0, base, 0, base - h);
  g.addColorStop(0, 'rgba(200,66,24,0.95)');
  g.addColorStop(0.45, 'rgba(244,140,40,0.95)');
  g.addColorStop(1, 'rgba(255,226,140,0.9)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w, base);
  ctx.bezierCurveTo(x - w * 1.1, base - h * 0.45, x + lean * 0.4 - w * 0.4, base - h * 0.7, x + lean, base - h);
  ctx.bezierCurveTo(x + lean * 0.4 + w * 0.5, base - h * 0.6, x + w * 1.1, base - h * 0.4, x + w, base);
  ctx.closePath();
  ctx.fill();
}

function campfire(frame: number): Painted {
  const W = 40;
  const H = 40;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const cy = 31;
  shadow(ctx, 21, cy + 1.6, 18, 5.4, 0.32);
  ellipse(ctx, 20, cy, 12, 4.6, '#2e241c');
  ellipse(ctx, 20, cy, 8, 3, 'rgba(230,110,40,0.55)');
  // Back half of the stone ring, behind the fire.
  const ring = (front: boolean): void => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      const x = 20 + Math.cos(a) * 14;
      const y = cy + Math.sin(a) * 5.6;
      ball(ctx, x, y, 3.3, 2.5, i % 3 === 0 ? '#8d8f88' : i % 3 === 1 ? '#7a7d77' : '#9a9a92', 0.35);
    }
  };
  ring(false);
  // Crossed logs.
  for (const [a, b] of [[[11, cy + 2], [27, cy - 3.4]], [[29, cy + 2], [13, cy - 3]], [[20, cy + 3.4], [20.6, cy - 4.6]]] as [Pt, Pt][]) {
    bone(ctx, a, b, 2.8, 2.4, '#5a3f2a');
    line(ctx, [[a[0], a[1] - 0.8], [b[0], b[1] - 0.8]], 0.6, 'rgba(255,220,180,0.25)');
    ellipse(ctx, b[0], b[1], 1.2, 1.1, '#e0782e');
  }
  // Flames: three tongues whose heights and leans change per frame.
  const shapes = [
    [[15.4, 12, 3.2, -1.4], [20, 20, 4.4, 1.2], [24.6, 13, 3.2, 1.6]],
    [[15, 14, 3.4, 1], [20.4, 17, 4.6, -1.6], [25, 15, 3, 0.4]],
    [[15.6, 10, 3, -2], [19.8, 22, 4.2, -0.4], [24.4, 11, 3.4, 2.2]],
  ][frame % 3]!;
  for (const [x, h, w, lean] of shapes) tongue(ctx, x!, cy, h!, w!, lean!);
  const core = ctx.createRadialGradient(20, cy - 2, 0, 20, cy - 2, 4.6);
  core.addColorStop(0, 'rgba(255,244,200,0.9)');
  core.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(20, cy - 2.4, 4.4, 3.6 + (frame % 3) * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ring(true);
  for (const [x, y] of [[[17, 6], [24, 9], [21, 4]], [[23, 7], [15, 10], [26, 3]], [[19, 3], [26, 11], [14, 6]]][frame % 3]!) ellipse(ctx, x!, y!, 0.55, 0.55, 'rgba(255,214,140,0.9)');
  return painted(canvas, W, H, [21 / W, (cy + 1.6) / H]);
}

function snowman(): Painted {
  const [canvas, ctx] = canvasOf(24, 32, 4);
  shadow(ctx, 13, 29.6, 10, 2.4, 0.3);
  ball(ctx, 12, 22.6, 8, 7, '#f2f4f6', 0.18);
  ball(ctx, 12, 11.4, 5.6, 5.2, '#f4f6f8', 0.18);
  // Charcoal eyes, a tangerine nose and a bucket hat.
  ellipse(ctx, 10.6, 10.6, 0.6, 0.6, '#2b2a26');
  ellipse(ctx, 14, 10.6, 0.6, 0.6, '#2b2a26');
  ellipse(ctx, 12.6, 12.8, 1.1, 0.9, '#e07a2e');
  blob(ctx, [[8, 7.6], [8.6, 3.6], [15.4, 3.6], [16, 7.6]], '#5b6f86', { light: 0.35 });
  line(ctx, [[5, 19], [1.6, 15.4]], 0.7, '#6e5038');
  line(ctx, [[19, 19], [22.6, 16]], 0.7, '#6e5038');
  return painted(canvas, 24, 32, [13 / 24, 29.6 / 32]);
}

function snowLantern(): Painted {
  // A yukimi-doro: the wide-capped snow-viewing lantern, cap heaped with snow, lit.
  const [canvas, ctx] = canvasOf(36, 40, 4);
  shadow(ctx, 19, 37.4, 14, 2.6, 0.3);
  for (const [a, b] of [[[8, 37], [12, 26]], [[28, 37], [24, 26]], [[18, 37.6], [18, 27]]] as [Pt, Pt][]) bone(ctx, a, b, 2.4, 2, '#7d817b');
  blob(ctx, [[8, 26.6], [28, 26.6], [27, 22.4], [9, 22.4]], '#8a8d86', { light: 0.3 });
  blob(ctx, [[11, 22.4], [25, 22.4], [24.6, 15], [11.4, 15]], '#878a83', { light: 0.3 }, () => {
    ctx.fillStyle = 'rgba(255,200,120,0.95)';
    ctx.fillRect(14.6, 16.6, 6.8, 4.6);
  });
  blob(ctx, [[1, 15.6], [9, 10.6], [18, 8.6], [27, 10.6], [35, 15.6], [18, 16.6]], '#7d817b', { light: 0.3 });
  blob(ctx, [[2.4, 14], [8, 8.4], [14, 5.4], [18, 4.2], [22, 5.4], [28, 8.4], [33.6, 14], [18, 13]], '#f2f4f6', { light: 0.15, dark: 0.25 });
  ball(ctx, 18, 3.8, 2, 1.8, '#f4f6f8', 0.15);
  return painted(canvas, 36, 40, [19 / 36, 37.4 / 40]);
}

export const FIRE: Record<string, Painter> = {
  'campfire-0': () => campfire(0),
  'campfire-1': () => campfire(1),
  'campfire-2': () => campfire(2),
  snowman,
  'snow-lantern': snowLantern,
};

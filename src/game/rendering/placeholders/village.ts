/**
 * Village, mill and fishing stand-ins.
 *
 * THE MILL is two layers so the wheel can turn: `mill-body` (the mill house,
 * its stone wheel pit and the flume, with no wheel) and `mill-wheel` (the
 * wheel face-on, 120 px across, anchored at its hub so it rotates in place).
 * Put the wheel's anchor at the body's anchor plus `MILL_WHEEL_OFFSET` (world
 * px; equivalently at `MILL_WHEEL_CENTRE` as a fraction of the body's box) and
 * draw it just above the body. The wheel is lit evenly all round so turning
 * it never turns its light.
 */

import { type Ctx, type Painted, type Painter, type Pt, ball, blob, bone, canvasOf, darken, ellipse, lighten, line, painted, poly, rgba, ripples, shadow } from './common';
import { mulberry32 } from '../../core/rng';

const TIMBER = '#7a5a3e';
const PLASTER = '#e9e0cc';
const THATCH = '#b99a5c';

// ---------------------------------------------------------------------------
// The mill

const BODY_W = 230;
const BODY_H = 176;
const BODY_GROUND = 168;
const BODY_ANCHOR_X = 104;
const WHEEL: Pt = [168, 110];
const WHEEL_SIZE = 120;

/** Where the wheel's hub sits on `mill-body`, as a fraction of the body's display box. */
export const MILL_WHEEL_CENTRE: [number, number] = [WHEEL[0] / BODY_W, WHEEL[1] / BODY_H];
/** The wheel's hub relative to the body's anchor point, in world px (x right, y down). */
export const MILL_WHEEL_OFFSET: [number, number] = [WHEEL[0] - BODY_ANCHOR_X, WHEEL[1] - BODY_GROUND];

function stones(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, seed: number): void {
  const rng = mulberry32(seed);
  poly(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], '#7c7f78', { light: 0.2 });
  for (let y = y0 + 1; y < y1 - 1; y += 5.5) {
    for (let x = x0 + ((y / 5.5) % 2) * 4; x < x1 - 2; x += 8 + rng() * 3) {
      const w = Math.min(7 + rng() * 3, x1 - x - 1);
      ball(ctx, x + w / 2, y + 2.4, w / 2, 2.4, rng() > 0.5 ? '#8f918a' : '#9a9a92', 0.3);
    }
  }
  for (let i = 0; i < 6; i++) ellipse(ctx, x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0), 3 + rng() * 3, 1.4, 'rgba(110,130,70,0.55)');
}

function millBody(): Painted {
  const [canvas, ctx] = canvasOf(BODY_W, BODY_H, 2);
  const rng = mulberry32(3);
  shadow(ctx, 112, BODY_GROUND - 1, 110, 10, 0.3);
  // The wheel pit: a stone wall behind the wheel, and the race water it turns in.
  stones(ctx, 134, 96, 226, BODY_GROUND - 2, 9);
  poly(ctx, [[120, 150], [228, 150], [228, BODY_GROUND], [120, BODY_GROUND]], '#4f8794', { light: 0.25 });
  for (let i = 0; i < 5; i++) line(ctx, [[126 + i * 20, 156 + (i % 2) * 4], [138 + i * 20, 156 + (i % 2) * 4]], 1, 'rgba(240,250,250,0.6)');
  // The axle bearing on the wall.
  poly(ctx, [[160, 102], [176, 102], [176, 118], [160, 118]], darken(TIMBER, 0.2), { light: 0.3 });
  // The mill house: stone plinth, timber-framed plaster walls, a deep thatched roof.
  stones(ctx, 10, 146, 150, BODY_GROUND - 1, 4);
  poly(ctx, [[14, 96], [146, 96], [146, 148], [14, 148]], PLASTER, { light: 0.2, dark: 0.3 });
  for (const x of [14, 46, 80, 114, 143]) bone(ctx, [x + 1.5, 96], [x + 1.5, 148], 4, 4, TIMBER);
  line(ctx, [[14, 122], [146, 122]], 3, TIMBER);
  poly(ctx, [[86, 112], [108, 112], [108, 148], [86, 148]], darken(TIMBER, 0.15), { light: 0.25 });
  for (let x = 89; x < 106; x += 4) line(ctx, [[x, 114], [x, 146]], 0.8, rgba('#2e2218', 0.5));
  poly(ctx, [[24, 104], [40, 104], [40, 116], [24, 116]], '#3a2c20', { light: 0.1 });
  for (let x = 26; x < 40; x += 3) line(ctx, [[x, 104], [x, 116]], 1, '#a07c56');
  // Roof: thatch seen from above, its front slope falling to deep eaves.
  blob(ctx, [[2, 104], [10, 70], [24, 40], [80, 32], [136, 40], [150, 70], [160, 104], [80, 110]], THATCH, { light: 0.28, dark: 0.22 }, () => {
    for (let i = 0; i < 260; i++) {
      const x = 4 + rng() * 154;
      const y = 36 + rng() * 72;
      line(ctx, [[x, y], [x + (x - 80) * 0.02, y + 4 + rng() * 3]], 0.7, rgba(rng() > 0.5 ? '#8a6e3c' : '#d8bf84', 0.55));
    }
    for (let y = 52; y < 108; y += 14) line(ctx, [[0, y], [80, y + 4], [160, y]], 1.6, rgba('#7a5e30', 0.35), true);
    const g = ctx.createLinearGradient(0, 96, 0, 112);
    g.addColorStop(0, 'rgba(60,44,24,0)');
    g.addColorStop(1, 'rgba(60,44,24,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 96, 162, 16);
  });
  // Ridge with its timber saddle bars.
  line(ctx, [[24, 38], [136, 38]], 6, darken(THATCH, 0.25));
  for (let x = 32; x < 132; x += 18) {
    line(ctx, [[x - 3, 33], [x + 2, 43]], 2.2, TIMBER);
    line(ctx, [[x + 3, 33], [x - 2, 43]], 2.2, darken(TIMBER, 0.15));
  }
  // The flume bringing water over the top of the wheel.
  poly(ctx, [[166, 40], [228, 30], [228, 38], [166, 48]], TIMBER, { light: 0.35 });
  poly(ctx, [[166, 41], [228, 31], [228, 33.4], [166, 43.4]], '#6aa3ad', { light: 0.2 });
  for (const x of [196, 220]) bone(ctx, [x, 40], [x, 96], 3, 3, darken(TIMBER, 0.2));
  return painted(canvas, BODY_W, BODY_H, [BODY_ANCHOR_X / BODY_W, BODY_GROUND / BODY_H]);
}

function millWheel(): Painted {
  const S = WHEEL_SIZE;
  const [canvas, ctx] = canvasOf(S, S, 2);
  const c = S / 2;
  const at = (r: number, a: number): Pt => [c + Math.cos(a) * r, c + Math.sin(a) * r];
  const ring = (r: number, w: number, colour: string): void => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  // Paddles beyond the rim, each a board set slightly off radial.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const a1 = a + 0.05;
    const p = [at(44, a - 0.07), at(58.6, a1 - 0.06), at(58.6, a1 + 0.06), at(44, a + 0.07)];
    ctx.fillStyle = darken(TIMBER, 0.12);
    ctx.beginPath();
    p.forEach((q, j) => (j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    ctx.fill();
    line(ctx, [at(45, a), at(58, a1)], 1.1, lighten(TIMBER, 0.2));
  }
  // Buckets between the two rims.
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    line(ctx, [at(37, a), at(46, a + 0.04)], 1.4, darken(TIMBER, 0.3));
  }
  ring(46.5, 4.4, TIMBER);
  ring(46.5, 1.2, lighten(TIMBER, 0.25));
  ring(36.5, 3.6, TIMBER);
  ring(37.4, 0.9, lighten(TIMBER, 0.2));
  // Eight spokes.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    bone(ctx, at(7, a), at(36, a), 3.6, 3, TIMBER);
    line(ctx, [at(8, a - 0.04), at(35, a - 0.01)], 0.8, lighten(TIMBER, 0.22));
  }
  const g = ctx.createRadialGradient(c, c, 0, c, c, 10);
  g.addColorStop(0, '#3a2a1c');
  g.addColorStop(0.35, '#4e3a28');
  g.addColorStop(0.7, lighten(TIMBER, 0.15));
  g.addColorStop(1, TIMBER);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, 9.5, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const p = at(6.4, (i / 4) * Math.PI * 2);
    ellipse(ctx, p[0], p[1], 0.9, 0.9, '#3a3430');
  }
  return painted(canvas, S, S, [0.5, 0.5]);
}

// ---------------------------------------------------------------------------
// Boats and fishing

function boat(): Painted {
  const W = 72;
  const H = 30;
  const [canvas, ctx] = canvasOf(W, H, 3);
  ripples(ctx, 34, 19, 32, 6, 0.4);
  ellipse(ctx, 35, 20, 32, 6, 'rgba(20,50,60,0.18)');
  // Hull side (toward the camera), then the gunwale outline seen from above.
  blob(ctx, [[4, 11], [30, 8.6], [56, 10], [69, 14.6], [56, 20.6], [30, 22.6], [5, 21]], darken(TIMBER, 0.2), { light: 0.2 });
  blob(ctx, [[4, 9.4], [30, 6.6], [56, 8], [69, 13], [56, 17.6], [30, 19], [5, 18]], lighten(TIMBER, 0.12), { light: 0.3 }, () => {
    for (const y of [10.6, 13, 15.4]) line(ctx, [[6, y], [62, y + (y - 13) * 0.1]], 0.5, rgba('#4a3626', 0.5));
  });
  blob(ctx, [[8, 10.6], [30, 8.4], [55, 9.6], [64, 13], [55, 16.2], [30, 17.4], [8.4, 16.6]], darken(TIMBER, 0.05), { light: 0.2, dark: 0.25 }, () => {
    for (const x of [22, 42]) line(ctx, [[x, 8], [x, 18]], 2.2, lighten(TIMBER, 0.2));
    for (const y of [11.2, 13.4, 15.4]) line(ctx, [[8, y], [60, y]], 0.4, rgba('#3a2a1c', 0.45));
  });
  line(ctx, [[12, 15.6], [50, 11]], 0.9, '#a58456');
  line(ctx, [[2, 13.4], [5, 13.6]], 2.4, darken(TIMBER, 0.25));
  return painted(canvas, W, H, [0.5, 0.5]);
}

function fishTrap(): Painted {
  const W = 62;
  const H = 34;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const rng = mulberry32(21);
  // Two lines of stakes converge downstream (to the right) on a woven basket.
  const apex: Pt = [42, 19];
  const arms: [Pt, Pt][] = [[[5, 8], apex], [[5, 30], apex]];
  // Wattle fence between the stakes, then the stakes themselves, back arm first.
  for (const [a, b] of arms) {
    line(ctx, [a, b], 2.6, rgba('#8a7048', 0.85));
    line(ctx, [[a[0], a[1] - 1.2], [b[0], b[1] - 1.2]], 0.8, rgba('#c4a66a', 0.8));
    for (let t = 0; t <= 1.001; t += 1 / 7) {
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t + 1.4;
      ripples(ctx, x, y + 0.6, 2.4, 0.8, 0.55);
      bone(ctx, [x, y - 4.6 - rng()], [x, y], 1.2, 1.1, '#6e5038');
      line(ctx, [[x - 0.3, y - 4.6], [x - 0.3, y - 0.6]], 0.35, 'rgba(255,240,210,0.4)');
    }
  }
  // The basket: a long woven cone lying in the current.
  ripples(ctx, 50, 21.6, 10, 2.4, 0.6);
  blob(ctx, [[40, 15.6], [46, 15], [53, 16.6], [58.6, 19], [53, 21.6], [46, 23], [40, 22.6]], '#c4a464', { light: 0.32 }, () => {
    for (let x = 40; x < 60; x += 2.2) line(ctx, [[x, 14], [x + 1, 24]], 0.45, rgba('#7a6034', 0.65));
    for (let y = 16; y < 23; y += 1.8) line(ctx, [[38, y], [60, y + (y - 19) * -0.3]], 0.35, rgba('#7a6034', 0.5));
    ctx.fillStyle = 'rgba(40,70,80,0.3)';
    ctx.fillRect(38, 20.6, 24, 4);
  });
  // A little white water where the stream is gathered.
  for (const [x, y] of [[8, 9.6], [8, 31], [30, 15], [30, 25]] as const) line(ctx, [[x - 3, y], [x + 1, y - 0.3]], 0.8, 'rgba(240,250,250,0.6)');
  return painted(canvas, W, H, [0.5, 0.55]);
}

function fishDryingRack(): Painted {
  const [canvas, ctx] = canvasOf(48, 34, 4);
  shadow(ctx, 25, 31.6, 21, 2.6);
  for (const x of [5, 43]) {
    bone(ctx, [x - 3, 31.4], [x, 7], 1.1, 1, TIMBER);
    bone(ctx, [x + 3, 31.4], [x, 7], 1.1, 1, darken(TIMBER, 0.2));
  }
  line(ctx, [[3, 8], [45, 8]], 1, '#8a6a46');
  line(ctx, [[3, 16.4], [45, 16.4]], 0.9, '#8a6a46');
  for (const row of [8, 16.4]) {
    for (let x = 8; x < 41; x += 3.4) {
      line(ctx, [[x, row], [x, row + 1.2]], 0.3, '#5a4a36');
      blob(ctx, [[x, row + 1], [x + 1.1, row + 3], [x + 0.9, row + 6.4], [x, row + 7.4], [x - 0.9, row + 6.4], [x - 1.1, row + 3]], row > 10 ? '#a9a49a' : '#bdb8ac', { light: 0.4 });
      blob(ctx, [[x, row + 7], [x + 1, row + 8.4], [x - 1, row + 8.4]], '#8e897e');
    }
  }
  return painted(canvas, 48, 34, [25 / 48, 31.6 / 34]);
}

function netRack(): Painted {
  const [canvas, ctx] = canvasOf(56, 36, 4);
  shadow(ctx, 29, 33.4, 25, 2.6);
  for (const x of [5, 28, 51]) bone(ctx, [x, 5], [x, 33.4], 1.2, 1.1, TIMBER);
  line(ctx, [[3, 6], [53, 6]], 0.9, '#8a6a46');
  // The net, hung in swags and dripping long.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(5, 6);
  ctx.quadraticCurveTo(16.5, 10, 28, 6);
  ctx.quadraticCurveTo(39.5, 10, 51, 6);
  ctx.lineTo(50, 27);
  ctx.quadraticCurveTo(39.5, 31, 28, 26);
  ctx.quadraticCurveTo(16.5, 31, 6, 27);
  ctx.closePath();
  ctx.fillStyle = 'rgba(92,74,52,0.32)';
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(70,56,40,0.75)';
  ctx.lineWidth = 0.35;
  for (let i = -40; i < 80; i += 1.8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 30, 36);
    ctx.moveTo(i + 30, 0);
    ctx.lineTo(i, 36);
    ctx.stroke();
  }
  ctx.restore();
  for (let x = 8; x < 50; x += 4.2) ball(ctx, x, 27 + Math.sin(x * 0.3) * 1.6, 0.9, 0.9, '#c9b48a', 0.4);
  return painted(canvas, 56, 36, [29 / 56, 33.4 / 36]);
}

function well(): Painted {
  const [canvas, ctx] = canvasOf(34, 42, 4);
  shadow(ctx, 18, 38.6, 14, 3);
  // Stone drum: its far rim, its dark mouth, its near wall.
  ellipse(ctx, 17, 27, 11, 4.4, '#8f918a');
  ellipse(ctx, 17, 27, 8.6, 3, '#273a40');
  blob(ctx, [[6, 27], [28, 27], [28, 36], [24, 38.4], [17, 39], [10, 38.4], [6, 36]], '#8a8c85', { light: 0.3 }, () => {
    for (const y of [30.4, 34]) line(ctx, [[5, y], [17, y + 1.6], [29, y]], 0.5, 'rgba(60,64,60,0.5)', true);
    for (const x of [11, 17, 23]) line(ctx, [[x, 27], [x, 39]], 0.5, 'rgba(60,64,60,0.35)');
  });
  ellipse(ctx, 17, 26.6, 11, 1.4, 'rgba(255,255,255,0.18)');
  // Posts, little roof and the pulley rope.
  bone(ctx, [6.6, 28], [6.6, 9], 1.6, 1.4, TIMBER);
  bone(ctx, [27.4, 28], [27.4, 9], 1.6, 1.4, darken(TIMBER, 0.15));
  line(ctx, [[17, 11], [17, 22]], 0.4, '#c9b48a');
  poly(ctx, [[14.6, 21], [19.4, 21], [19, 25.4], [15, 25.4]], '#8a6a46', { light: 0.3 });
  poly(ctx, [[1, 11], [17, 4], [33, 11], [33, 13], [1, 13]], '#5f4a38', { light: 0.35 });
  ball(ctx, 17, 10.4, 1.4, 1.4, '#6e5038', 0.3);
  return painted(canvas, 34, 42, [18 / 34, 38.6 / 42]);
}

function marketStall(): Painted {
  const [canvas, ctx] = canvasOf(58, 46, 3);
  shadow(ctx, 30, 43, 27, 3);
  for (const x of [5, 53]) bone(ctx, [x, 12], [x, 43], 1.6, 1.4, TIMBER);
  poly(ctx, [[3, 28], [55, 28], [55, 40], [3, 40]], '#8a6a46', { light: 0.3 });
  line(ctx, [[3, 28.6], [55, 28.6]], 1.4, lighten('#8a6a46', 0.25));
  // Goods on the counter: baskets of greens, persimmons and daikon.
  for (const [x, c] of [[11, '#6f9a3e'], [22, '#e07a2e'], [33, '#efe8d8'], [44, '#9a3f3a']] as const) {
    ellipse(ctx, x, 27.6, 5, 2, '#b08a52');
    for (let i = 0; i < 5; i++) ball(ctx, x - 3 + i * 1.5, 25.6 - (i % 2), 1.6, 1.4, c, 0.35);
  }
  // Awning and indigo noren curtain.
  poly(ctx, [[0, 14], [29, 6], [58, 14], [58, 17], [0, 17]], '#6f5a44', { light: 0.35 });
  for (let x = 8; x < 52; x += 9) poly(ctx, [[x, 17], [x + 8, 17], [x + 8, 23.4], [x, 23.4]], '#3f5873', { light: 0.25 });
  return painted(canvas, 58, 46, [30 / 58, 43 / 46]);
}

function torii(): Painted {
  const [canvas, ctx] = canvasOf(112, 112, 2);
  const red = '#c4452e';
  shadow(ctx, 58, 108, 50, 5);
  for (const x of [26, 86]) {
    bone(ctx, [x, 24], [x + (x < 56 ? -2 : 2), 107], 7, 8, x < 56 ? red : darken(red, 0.12));
    poly(ctx, [[x - 6 + (x < 56 ? -2 : 2), 100], [x + 6 + (x < 56 ? -2 : 2), 100], [x + 6 + (x < 56 ? -2 : 2), 108], [x - 6 + (x < 56 ? -2 : 2), 108]], '#2c2a28', { light: 0.25 });
  }
  poly(ctx, [[14, 34], [98, 34], [98, 40], [14, 40]], red, { light: 0.3 });
  poly(ctx, [[52, 22], [60, 22], [60, 34], [52, 34]], red, { light: 0.3 });
  blob(ctx, [[2, 14], [30, 18], [56, 18.6], [82, 18], [110, 14], [108, 20], [56, 25], [4, 20]], '#2c2a28', { light: 0.25 });
  poly(ctx, [[8, 20], [104, 20], [102, 27], [10, 27]], red, { light: 0.3 });
  return painted(canvas, 112, 112, [58 / 112, 107 / 112]);
}

// ---------------------------------------------------------------------------
// Zone markers: a small landmark for each kind of interactive place.

function hotSpring(): Painted {
  const [canvas, ctx] = canvasOf(64, 40, 3);
  const rng = mulberry32(61);
  ellipse(ctx, 32, 24, 26, 11, '#6f6a5e');
  const g = ctx.createRadialGradient(28, 21, 2, 32, 24, 22);
  g.addColorStop(0, '#9fd0cc');
  g.addColorStop(1, '#5d9fa6');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(32, 24, 21, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ball(ctx, 32 + Math.cos(a) * 24, 24 + Math.sin(a) * 10, 4 + rng() * 2, 3 + rng(), rng() > 0.5 ? '#8d8f88' : '#7a7d77', 0.35);
  }
  // Steam rising off the water.
  for (const [x, y, r] of [[26, 14, 7], [36, 10, 8], [30, 5, 6], [40, 3, 5]] as const) {
    const s2 = ctx.createRadialGradient(x, y, 0, x, y, r);
    s2.addColorStop(0, 'rgba(250,250,248,0.55)');
    s2.addColorStop(1, 'rgba(250,250,248,0)');
    ctx.fillStyle = s2;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return painted(canvas, 64, 40, [0.5, 0.85]);
}

function charcoalKiln(): Painted {
  const [canvas, ctx] = canvasOf(56, 40, 3);
  shadow(ctx, 30, 35, 24, 4);
  blob(ctx, [[6, 35], [10, 24], [20, 16], [30, 14], [40, 16], [48, 24], [52, 35], [29, 37]], '#8a6a48', { light: 0.3 }, () => {
    for (let y = 20; y < 36; y += 4) line(ctx, [[4, y], [29, y + 2], [54, y]], 0.6, 'rgba(70,50,30,0.35)', true);
  });
  poly(ctx, [[24, 28], [33, 28], [33, 36], [24, 36]], '#2a1f18', { light: 0.1 });
  ellipse(ctx, 28.5, 33, 3, 1.6, 'rgba(230,110,40,0.7)');
  poly(ctx, [[27, 10], [32, 10], [32, 16], [27, 16]], '#6e5a48', { light: 0.3 });
  for (const [x, y, r] of [[30, 7, 4], [33, 2, 4]] as const) ellipse(ctx, x, y, r, r * 0.8, 'rgba(200,200,196,0.45)');
  return painted(canvas, 56, 40, [30 / 56, 35 / 40]);
}

function quarry(): Painted {
  const [canvas, ctx] = canvasOf(60, 40, 3);
  shadow(ctx, 32, 35, 26, 4);
  for (const [x, y, w, h] of [[8, 22, 16, 12], [24, 18, 18, 16], [40, 24, 14, 10], [16, 30, 12, 6], [33, 30, 12, 6]] as const) {
    poly(ctx, [[x, y + h * 0.3], [x + w * 0.2, y], [x + w, y], [x + w, y + h * 0.7], [x + w * 0.8, y + h], [x, y + h]], '#a4a299', { light: 0.35, dark: 0.4 });
    line(ctx, [[x + 1, y + h * 0.35], [x + w - 1, y + h * 0.35]], 0.5, 'rgba(70,70,64,0.4)');
  }
  line(ctx, [[46, 12], [52, 24]], 0.9, '#7a5a3e');
  poly(ctx, [[44, 10], [49, 9], [49, 13], [44, 14]], '#5a5e5c', { light: 0.3 });
  return painted(canvas, 60, 40, [32 / 60, 35 / 40]);
}

function teaBushes(): Painted {
  const [canvas, ctx] = canvasOf(96, 56, 2);
  for (let r = 0; r < 4; r++) {
    const y = 16 + r * 11;
    shadow(ctx, 50, y + 4, 42, 3, 0.3);
    blob(ctx, [[8, y + 3], [10, y - 4], [48, y - 6], [86, y - 4], [88, y + 3], [48, y + 5]], '#4f7a3a', { light: 0.35, dark: 0.3 }, () => {
      for (let x = 10; x < 88; x += 4) ellipse(ctx, x, y - 4, 2.6, 1.4, 'rgba(160,200,100,0.35)');
    });
  }
  return painted(canvas, 96, 56, [0.5, 0.9]);
}

function mushroomLog(): Painted {
  const [canvas, ctx] = canvasOf(52, 30, 3);
  shadow(ctx, 28, 25, 22, 3.4);
  for (const [a, b] of [[[6, 24], [46, 16]], [[8, 18], [44, 22]]] as [Pt, Pt][]) bone(ctx, a, b, 5, 5, '#6a5440');
  ellipse(ctx, 46, 16, 2.4, 2.4, '#b8956a');
  for (const [x, y] of [[14, 20], [20, 18.4], [28, 17.4], [34, 19.6], [38, 15.6], [24, 21.6]] as const) {
    line(ctx, [[x, y], [x, y - 2]], 0.9, '#efe6d2');
    blob(ctx, [[x - 2.6, y - 1.8], [x, y - 4], [x + 2.6, y - 1.8]], '#8a5a3a', { light: 0.35 });
  }
  return painted(canvas, 52, 30, [28 / 52, 25 / 30]);
}

function hokora(): Painted {
  // A tiny wayside shrine on a stone base.
  const [canvas, ctx] = canvasOf(30, 40, 4);
  shadow(ctx, 16, 37, 12, 2.4);
  poly(ctx, [[5, 30], [25, 30], [26, 37], [4, 37]], '#878a83', { light: 0.3 });
  poly(ctx, [[8, 17], [22, 17], [22, 30], [8, 30]], '#9a7650', { light: 0.3 });
  poly(ctx, [[11, 20], [19, 20], [19, 29], [11, 29]], '#3a2c20', { light: 0.1 });
  line(ctx, [[12, 21], [18, 21]], 1.2, '#efe8d8');
  poly(ctx, [[3, 18], [15, 9], [27, 18], [25, 19.4], [5, 19.4]], '#5b4a3c', { light: 0.35 });
  line(ctx, [[15, 9], [15, 6]], 0.8, '#c4452e');
  return painted(canvas, 30, 40, [16 / 30, 37 / 40]);
}

export const VILLAGE: Record<string, Painter> = {
  'mill-body': millBody,
  'mill-wheel': millWheel,
  boat,
  'fish-trap': fishTrap,
  'fish-drying-rack': fishDryingRack,
  'net-rack': netRack,
  well,
  'market-stall': marketStall,
  torii,
  'hot-spring': hotSpring,
  'charcoal-kiln': charcoalKiln,
  quarry,
  'tea-bushes': teaBushes,
  'mushroom-log': mushroomLog,
  hokora,
};

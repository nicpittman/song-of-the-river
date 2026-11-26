/**
 * Small painted pieces for the expedition: the knots tied on a returning
 * friend's pack, footprints, the stages of a structure going up (a
 * pegged-out site, a frame, a half-thatched frame), the worn earth round a
 * building site, a timber lookout tower, young plantings, and a few camp
 * things. Ids follow `docs/sprites-needed.md`, so illustrated art replaces them.
 *
 * All lit from the upper left without outlines, like the other placeholders.
 */

import { type Ctx, type Painted, type Painter, ball, blob, canvasOf, darken, ellipse, lighten, line, painted, poly, rgba, shadow } from './common';

const TIMBER = '#9a7a52';
const STRING = '#efe6cf';

// ── Pack knots ─────────────────────────────────────────────────────────────

/** A bundle tied with a knot on top. The three kinds differ in cloth and in what is tucked in, so they read from a distance. */
function knot(kind: 'plain' | 'unusual' | 'rare'): Painted {
  const W = 16;
  const H = 15;
  const [canvas, ctx] = canvasOf(W, H, 5);
  const cloth = kind === 'plain' ? '#cdbd96' : kind === 'unusual' ? '#283f52' : '#a83f34';
  const cord = kind === 'plain' ? '#7a5e3c' : kind === 'unusual' ? '#e6dcc0' : '#e3b955';
  ellipse(ctx, 8, 12.6, 5.6, 1.4, 'rgba(30,30,20,0.25)');
  blob(ctx, [[2.6, 7.4], [5, 5.2], [11, 5], [13.6, 7.6], [13, 11.4], [8, 12.8], [3, 11.6]], cloth, { light: 0.4, dark: 0.35 }, () => {
    line(ctx, [[2.8, 8.8], [13.4, 8.6]], 0.8, cord);
    line(ctx, [[8.2, 5], [8, 12.6]], 0.8, cord);
    if (kind !== 'plain') for (let i = 0; i < 4; i++) ball(ctx, 4 + i * 2.6, 10.6 - (i % 2), 0.45, 0.45, rgba(lighten(cloth, 0.6), 0.75), 0.1);
  });
  // The knot's two ears.
  blob(ctx, [[8, 5.6], [5.2, 2.4], [4.2, 4.2], [6.4, 6]], cloth, { light: 0.4 });
  blob(ctx, [[8, 5.6], [11, 2], [12.4, 3.8], [9.6, 6]], cloth, { light: 0.4 });
  ball(ctx, 8, 5.4, 1.3, 1.1, darken(cloth, 0.15), 0.3);
  if (kind === 'unusual') {
    line(ctx, [[10.6, 6], [12.6, 1.2]], 0.45, '#5b6e3a');
    ball(ctx, 12.6, 1.4, 1, 0.7, '#7fa04c', 0.3);
  }
  if (kind === 'rare') {
    // A pale feather tucked under the cord: the rare bundle is told by its shape, never by a sparkle.
    line(ctx, [[5.6, 7.6], [3.8, 3.8], [3, 1.3]], 1.5, '#e9e4d6', true);
    line(ctx, [[5.6, 7.6], [3.8, 3.8], [3, 1.3]], 0.35, '#8b8a80', true);
    ball(ctx, 3.1, 1.4, 0.6, 0.8, '#3d4a56', 0.2);
  }
  return painted(canvas, W, H, [0.5, 0.85]);
}

/** One footprint, toe to the right. */
function footprint(): Painted {
  const [canvas, ctx] = canvasOf(8, 5, 6);
  ellipse(ctx, 4.6, 2.5, 2.4, 1.25, 'rgba(58,44,30,0.55)');
  ellipse(ctx, 1.6, 2.5, 1.2, 0.95, 'rgba(58,44,30,0.5)');
  return painted(canvas, 8, 5, [0.5, 0.5]);
}

// ── Building sites ─────────────────────────────────────────────────────────

/** Trodden earth with a few pebbles and wood shavings, faded at the edges, for under a site. */
function wornEarth(): Painted {
  const W = 170;
  const H = 76;
  const [canvas, ctx] = canvasOf(W, H, 2);
  const g = ctx.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W / 2);
  g.addColorStop(0, 'rgba(150,120,82,0.62)');
  g.addColorStop(0.55, 'rgba(146,118,80,0.42)');
  g.addColorStop(1, 'rgba(140,114,80,0)');
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(1, H / W);
  ctx.translate(-W / 2, -H / 2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  let seed = 7;
  const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 0.42;
    const x = W / 2 + Math.cos(a) * r * W;
    const y = H / 2 + Math.sin(a) * r * H;
    if (i % 3 === 0) ball(ctx, x, y, 1.2 + rnd(), 0.8 + rnd() * 0.5, rnd() > 0.5 ? '#a49a88' : '#8c8270', 0.3);
    else line(ctx, [[x, y], [x + 2 + rnd() * 2, y + (rnd() - 0.5) * 1.5]], 0.6, rgba(rnd() > 0.5 ? '#d9c08a' : '#6e5a40', 0.55));
  }
  return painted(canvas, W, H, [0.5, 0.5]);
}

/** A rectangle of ground seen at a slant, as four corner points. */
const PLOT: [number, number][] = [[18, 78], [92, 78], [82, 56], [28, 56]];

function peg(ctx: Ctx, x: number, y: number, h = 9): void {
  ellipse(ctx, x + 1.6, y + 0.4, 2.6, 0.9, 'rgba(30,30,20,0.35)');
  poly(ctx, [[x - 1.3, y - h], [x + 1.3, y - h], [x + 1, y], [x - 1, y]], '#8e6e44', { light: 0.45 });
}

/** Pegs and string marking out where something will stand. */
function sitePegs(): Painted {
  const W = 110;
  const H = 90;
  const [canvas, ctx] = canvasOf(W, H, 3);
  for (let i = 0; i < 4; i++) {
    const a = PLOT[i]!;
    const b = PLOT[(i + 1) % 4]!;
    line(ctx, [[a[0], a[1] - 6], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 5.2], [b[0], b[1] - 6]], 0.9, rgba(STRING, 0.95), true);
  }
  for (const [x, y] of PLOT) peg(ctx, x, y);
  // A strip of cloth on the nearest peg.
  blob(ctx, [[92, 70], [99, 69.4], [98, 72.4], [92, 72]], '#b8443a', { light: 0.3 });
  return painted(canvas, W, H, [0.5, 0.82]);
}

/** A timber frame going up in three stages: posts on sills, then beams and braces, then rafters and a first patch of thatch. */
function frame(stage: number): Painted {
  const W = 110;
  const H = 110;
  const [canvas, ctx] = canvasOf(W, H, 3);
  shadow(ctx, 60, 98, 46, 9, 0.28);
  const ground = PLOT.map(([x, y]) => [x, y + 20] as [number, number]);
  const height = [24, 38, 38][stage]!;
  const tops = ground.map(([x, y]) => [x, y - height] as [number, number]);
  const wood = '#866440';
  const timber = (a: [number, number], b: [number, number], w: number, shade: number): void => {
    line(ctx, [a, b], w + 1, rgba('#2e2418', 0.55));
    line(ctx, [a, b], w, darken(wood, shade));
    line(ctx, [[a[0] - w * 0.25, a[1] - w * 0.2], [b[0] - w * 0.25, b[1] - w * 0.2]], w * 0.3, rgba(lighten(wood, 0.45), 0.6));
  };
  // Sills on the ground first.
  for (let i = 0; i < 4; i++) timber(ground[i]!, ground[(i + 1) % 4]!, 3, i === 0 ? 0 : 0.2);
  const post = (i: number, near: boolean): void => timber(ground[i]!, tops[i]!, 3.6, near ? 0 : 0.28);
  post(3, false);
  post(2, false);
  if (stage >= 1) {
    timber(tops[3]!, tops[2]!, 3.2, 0.25);
    timber(tops[0]!, tops[3]!, 3.2, 0.15);
    timber(tops[1]!, tops[2]!, 3.2, 0.15);
    // Braces in the corners.
    timber([ground[3]![0] + 2, ground[3]![1] - 8], [tops[3]![0] + 10, tops[3]![1] + 1], 1.8, 0.3);
  }
  if (stage >= 2) {
    const ridgeBack: [number, number] = [55, tops[3]![1] - 22];
    const ridgeFront: [number, number] = [55, tops[0]![1] - 24];
    timber(tops[3]!, ridgeBack, 2.6, 0.25);
    timber(ridgeBack, tops[2]!, 2.6, 0.25);
    // Thatch begun on the left slope, tied on in bundles.
    blob(ctx, [tops[0]!, ridgeFront, ridgeBack, [tops[3]![0] - 3, tops[3]![1] + 2], [tops[0]![0] - 5, tops[0]![1] + 4]], '#b8954f', { light: 0.4, dark: 0.4 }, () => {
      for (let i = 0; i < 12; i++) line(ctx, [[14 + i * 4, 8], [8 + i * 4, 72]], 0.6, rgba('#6e5428', 0.5));
      for (let i = 0; i < 3; i++) line(ctx, [[10, 40 + i * 9], [60, 30 + i * 9]], 0.9, rgba('#5e4626', 0.55));
    });
    timber(ridgeBack, ridgeFront, 2.8, 0.1);
    for (let i = 0; i < 3; i++) timber(mixPt(tops[1]!, tops[2]!, i / 2), mixPt(ridgeFront, ridgeBack, i / 2), 2, 0.05);
  }
  post(0, true);
  post(1, true);
  if (stage >= 1) {
    timber(tops[0]!, tops[1]!, 3.4, 0);
    timber([ground[1]![0] - 2, ground[1]![1] - 9], [tops[1]![0] - 12, tops[1]![1] + 1], 1.8, 0.1);
  }
  // A ladder against the frame, and a stack of planks waiting.
  if (stage >= 1) {
    const g = ground[1]!;
    const t = tops[1]!;
    timber([g[0] + 6, g[1]], [g[0] - 1, t[1] - 3], 1.2, 0.1);
    timber([g[0] + 11, g[1] - 1], [g[0] + 4, t[1] - 4], 1.2, 0.1);
    for (let i = 1; i < 6; i++) {
      const k = i / 6;
      line(ctx, [[g[0] + 6 - 7 * k, g[1] - (g[1] - t[1] + 3) * k], [g[0] + 11 - 7 * k, g[1] - 1 - (g[1] - t[1] + 3) * k]], 0.9, wood);
    }
  }
  for (let i = 0; i < 4; i++) poly(ctx, [[8, 103 - i * 2.4], [44, 101 - i * 2.4], [44, 103.4 - i * 2.4], [8, 105.4 - i * 2.4]], i % 2 ? '#a07c50' : '#b48c5c', { light: 0.35 });
  return painted(canvas, W, H, [0.5, 0.9]);
}

const mixPt = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Stilts and joists for a deck at the water's edge (platform, dock, bridge). */
function deckFrame(stage: number): Painted {
  const W = 110;
  const H = 70;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const xs = [16, 38, 60, 82];
  for (const x of xs) {
    const top = 34 - stage * 4;
    poly(ctx, [[x - 1.4, top], [x + 1.4, top], [x + 1.6, 58], [x - 1.6, 58]], darken(TIMBER, 0.15), { light: 0.35 });
    poly(ctx, [[x + 9.4, top - 8], [x + 11.6, top - 8], [x + 11.8, 50], [x + 9.2, 50]], darken(TIMBER, 0.32), { light: 0.3 });
  }
  if (stage >= 1) {
    line(ctx, [[14, 30], [84, 30]], 2.2, TIMBER);
    line(ctx, [[24, 22], [94, 22]], 2, darken(TIMBER, 0.2));
  }
  if (stage >= 2) for (let i = 0; i < 7; i++) poly(ctx, [[14 + i * 6, 29], [19 + i * 6, 29], [28 + i * 6, 21], [23 + i * 6, 21]], lighten(TIMBER, 0.12), { light: 0.35 });
  return painted(canvas, W, H, [0.5, 0.83]);
}

/** Tilled rows, then stakes, then the first green. */
function gardenBed(stage: number): Painted {
  const W = 100;
  const H = 54;
  const [canvas, ctx] = canvasOf(W, H, 3);
  blob(ctx, [[10, 34], [40, 20], [80, 20], [94, 32], [70, 46], [24, 46]], '#7d6244', { light: 0.25, dark: 0.3 }, () => {
    for (let i = 0; i < 6; i++) line(ctx, [[14 + i * 4, 44 - i * 1], [56 + i * 6, 20 + i * 0.6]], 1, rgba('#5a4430', 0.5));
  });
  if (stage >= 1) for (let i = 0; i < 5; i++) peg(ctx, 26 + i * 13, 40 - i * 3.4, 9);
  if (stage >= 2) for (let i = 0; i < 14; i++) ball(ctx, 22 + (i % 7) * 9, 40 - Math.floor(i / 7) * 9 - (i % 7) * 2, 1.6, 1.1, i % 3 ? '#7f9e4a' : '#a5bd62', 0.35);
  return painted(canvas, W, H, [0.5, 0.75]);
}

/** A hull on its keel, ribs first, then planks. */
function boatRibs(stage: number): Painted {
  const W = 100;
  const H = 50;
  const [canvas, ctx] = canvasOf(W, H, 3);
  shadow(ctx, 52, 40, 42, 6, 0.3);
  line(ctx, [[10, 38], [90, 36]], 2.4, darken(TIMBER, 0.2));
  for (let i = 0; i < 8; i++) {
    const x = 18 + i * 9.5;
    const h = 12 - Math.abs(i - 3.5) * 1.4;
    line(ctx, [[x - 4, 37 - h], [x, 38], [x + 4, 37 - h]], 1.1, darken(TIMBER, 0.05), true);
  }
  if (stage >= 1) blob(ctx, [[12, 32], [52, 38.6], [90, 31], [86, 37], [52, 41], [14, 37]], TIMBER, { light: 0.35 });
  if (stage >= 2) blob(ctx, [[10, 27], [52, 33], [92, 26], [90, 31], [52, 38.6], [12, 32]], lighten(TIMBER, 0.12), { light: 0.35 });
  // Trestles under the hull.
  for (const x of [26, 74]) line(ctx, [[x - 5, 46], [x, 39], [x + 5, 46]], 1.1, '#6e5a40');
  return painted(canvas, W, H, [0.5, 0.88]);
}

/** A small timber watchtower with a shingled roof and a ladder. */
function lookoutTower(): Painted {
  const W = 90;
  const H = 150;
  const [canvas, ctx] = canvasOf(W, H, 3);
  shadow(ctx, 50, 140, 34, 8, 0.3);
  const legs: [number, number, number, number][] = [[24, 140, 32, 52], [66, 140, 58, 52], [34, 128, 38, 46], [58, 128, 54, 46]];
  legs.forEach(([x0, y0, x1, y1], i) => poly(ctx, [[x1 - 1.8, y1], [x1 + 1.8, y1], [x0 + 2, y0], [x0 - 2, y0]], i < 2 ? TIMBER : darken(TIMBER, 0.3), { light: 0.4 }));
  line(ctx, [[27, 110], [63, 96]], 1.2, darken(TIMBER, 0.15));
  line(ctx, [[27, 96], [63, 110]], 1.2, darken(TIMBER, 0.15));
  line(ctx, [[30, 80], [60, 70]], 1.1, darken(TIMBER, 0.1));
  // Platform and rail.
  poly(ctx, [[22, 52], [68, 52], [74, 46], [28, 44]], lighten(TIMBER, 0.08), { light: 0.35 });
  poly(ctx, [[22, 52], [68, 52], [68, 56], [22, 56]], darken(TIMBER, 0.2), { light: 0.2 });
  for (const x of [24, 36, 48, 60, 67]) line(ctx, [[x, 52], [x + 1, 38]], 1, TIMBER);
  line(ctx, [[22, 38], [70, 38]], 1.4, lighten(TIMBER, 0.1));
  // Posts and a shingled roof.
  for (const x of [26, 66]) line(ctx, [[x, 44], [x, 22]], 1.6, darken(TIMBER, 0.1));
  blob(ctx, [[14, 26], [46, 6], [80, 24], [72, 28], [46, 14], [22, 30]], '#6e5440', { light: 0.35, dark: 0.35 }, () => {
    for (let i = 0; i < 6; i++) line(ctx, [[16 + i * 4, 28 - i * 3], [78 - i * 4, 26 - i * 3]], 0.5, rgba('#3e2e22', 0.45));
  });
  // Ladder.
  line(ctx, [[74, 140], [64, 54]], 1, TIMBER);
  line(ctx, [[80, 139], [70, 54]], 1, TIMBER);
  for (let i = 1; i < 9; i++) {
    const t = i / 9;
    line(ctx, [[74 - 10 * t, 140 - 86 * t], [80 - 10 * t, 139 - 85 * t]], 0.8, lighten(TIMBER, 0.1));
  }
  // A small banner.
  line(ctx, [[46, 6], [46, -4 + 6]], 0.8, '#5a4430');
  blob(ctx, [[46, 2], [56, 3.4], [55, 6.4], [46, 6]], '#b8443a', { light: 0.3 });
  return painted(canvas, W, H, [50 / W, 140 / H]);
}

/** A staked young tree: a slim stem, a few leaves in the plant's colour, and a cord tie. */
function sapling(leaf: string, blossom: string | null): Painted {
  const W = 30;
  const H = 46;
  const [canvas, ctx] = canvasOf(W, H, 4);
  shadow(ctx, 16, 42, 9, 2.6, 0.3);
  ellipse(ctx, 15, 42, 6, 1.8, '#7d6244');
  line(ctx, [[19, 42], [18.6, 14]], 1.4, '#8a6a42');
  line(ctx, [[15, 42], [14.6, 30], [15.6, 18]], 1, '#6e5438', true);
  line(ctx, [[18.8, 26], [15, 26.4]], 0.8, STRING);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    ball(ctx, 15.4 + Math.cos(a) * 5.4, 15 + Math.sin(a) * 4.2 - (i % 3), 2.4, 1.6, i % 2 ? leaf : lighten(leaf, 0.15), 0.35);
  }
  if (blossom) for (let i = 0; i < 6; i++) ball(ctx, 12 + (i % 3) * 3.2, 12 + Math.floor(i / 3) * 4.4, 1.3, 1.2, blossom, 0.4);
  return painted(canvas, W, H, [15 / W, 42 / H]);
}

/** A few young reed shoots planted in wet ground. */
function reedPlanting(): Painted {
  const W = 34;
  const H = 34;
  const [canvas, ctx] = canvasOf(W, H, 4);
  ellipse(ctx, 17, 30, 12, 3, 'rgba(70,80,60,0.35)');
  for (let i = 0; i < 9; i++) {
    const x = 8 + i * 2.2;
    line(ctx, [[x, 30], [x + (i - 4) * 0.8, 12 + (i % 3) * 3]], 0.9, i % 2 ? '#7f9a52' : '#9bb064');
  }
  return painted(canvas, W, H, [0.5, 30 / H]);
}

/** A bed of water lilies: round pads, a few pale flowers, lying flat on the water. */
function lilyBed(): Painted {
  const W = 70;
  const H = 34;
  const [canvas, ctx] = canvasOf(W, H, 3);
  let seed = 3;
  const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 11; i++) {
    const x = 10 + rnd() * 50;
    const y = 8 + rnd() * 18;
    const r = 3.4 + rnd() * 3;
    ellipse(ctx, x + 0.8, y + 0.8, r, r * 0.55, 'rgba(20,50,50,0.25)');
    blob(ctx, [[x - r, y], [x, y - r * 0.55], [x + r, y], [x + r * 0.2, y + r * 0.1], [x, y + r * 0.55]], i % 3 ? '#5f7e44' : '#6f8e4e', { light: 0.35 });
  }
  for (let i = 0; i < 3; i++) ball(ctx, 18 + i * 16, 14 + (i % 2) * 6, 1.8, 1.3, i === 1 ? '#f1c8c6' : '#f4eedc', 0.4);
  return painted(canvas, W, H, [0.5, 0.5]);
}

/** Stacked split logs beside the fire. */
function woodpile(): Painted {
  const W = 40;
  const H = 26;
  const [canvas, ctx] = canvasOf(W, H, 4);
  shadow(ctx, 22, 22, 18, 4, 0.3);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4 - row; i++) {
      const x = 9 + i * 7.4 + row * 3.7;
      const y = 19 - row * 5.4;
      ball(ctx, x, y, 3.6, 2.9, '#8a6a46', 0.3);
      ellipse(ctx, x + 0.6, y, 2.2, 1.7, '#c9a676');
      ellipse(ctx, x + 0.6, y, 0.8, 0.6, '#9b7a50');
    }
  }
  return painted(canvas, W, H, [0.5, 22 / H]);
}

/** Banked coals glowing low after the flames have gone down. */
function embers(): Painted {
  const W = 30;
  const H = 16;
  const [canvas, ctx] = canvasOf(W, H, 4);
  const g = ctx.createRadialGradient(15, 9, 0, 15, 9, 12);
  g.addColorStop(0, 'rgba(255,170,80,0.9)');
  g.addColorStop(0.5, 'rgba(200,80,30,0.55)');
  g.addColorStop(1, 'rgba(120,40,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 7; i++) ball(ctx, 8 + i * 2.4, 9 + (i % 2), 1.5, 1, i % 2 ? '#ffb45a' : '#e0703a', 0.5);
  return painted(canvas, W, H, [0.5, 0.6]);
}

/** Warm light from a window or doorway at night: a soft, slightly tall glow. */
function windowGlow(): Painted {
  const W = 48;
  const H = 48;
  const [canvas, ctx] = canvasOf(W, H, 2);
  const g = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
  g.addColorStop(0, 'rgba(255,214,150,0.95)');
  g.addColorStop(0.3, 'rgba(255,186,110,0.5)');
  g.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return painted(canvas, W, H, [0.5, 0.5]);
}

const stages = (prefix: string, paint: (i: number) => Painted): Record<string, Painter> =>
  Object.fromEntries([0, 1, 2].map((i) => [`${prefix}-${i}`, () => paint(i)]));

/** Each structure kind's documented `<kind>-site` and `<kind>-frame` ids, painted from its family's stages. */
const SITE_FAMILIES: Record<string, (i: number) => Painted> = {
  garden: gardenBed,
  bridge: deckFrame,
  footbridge: deckFrame,
  'ford-bridge': deckFrame,
  platform: deckFrame,
  dock: deckFrame,
  shelter: frame,
  cottage: frame,
  lookout: frame,
  boat: boatRibs,
  stones: deckFrame,
  stair: gardenBed,
};

export const EXPEDITION: Record<string, Painter> = {
  'pack-plain': () => knot('plain'),
  'pack-unusual': () => knot('unusual'),
  'pack-rare': () => knot('rare'),
  footprint,
  'worn-earth': wornEarth,
  'site-pegs': sitePegs,
  ...stages('frame', frame),
  ...stages('deck-frame', deckFrame),
  ...stages('garden-bed', gardenBed),
  ...stages('boat-ribs', boatRibs),
  ...Object.fromEntries(Object.entries(SITE_FAMILIES).flatMap(([kind, paint]) => [[`${kind}-site`, sitePegs], [`${kind}-frame`, () => paint(1)]])),
  lookout: lookoutTower,
  'willow-sapling': () => sapling('#9cb05a', null),
  'blossom-sapling': () => sapling('#8ea456', '#f1c4c4'),
  'reed-planting': reedPlanting,
  'lily-bed': lilyBed,
  woodpile,
  embers,
  'window-glow': windowGlow,
};

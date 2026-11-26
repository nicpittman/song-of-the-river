/**
 * The shore, the strand-line and the fishing life of the river mouth: shells
 * and wrack on the sand, driftwood, dune grass and salt-marsh flowers, a rock
 * pool, a weir, a beached boat and a fisher's hut on stilts. Everything lies
 * low and is lit from the upper left; pieces that rest on sand carry a soft
 * patch of damp sand beneath them so they settle into whatever ground they
 * are laid on. All anchor at the bottom centre, where they meet the ground.
 */

import { type Ctx, type Painted, type Painter, type Pt, ball, blob, bone, canvasOf, curve, darken, ellipse, featherInto, lighten, line, looseOutline, painted, poly, rgba, ripples, shadow, stipple } from './common';
import { type Rng, mulberry32 } from '../../core/rng';

const SAND = '#dccca2';
const DAMP_SAND = '#bba981';
const TIMBER = '#7a5c40';
const THATCH = '#b99a5c';

type Season = 'summer' | 'autumn' | 'winter';

// ---------------------------------------------------------------------------
// Brushes

/** A soft-edged patch of colour, strongest at its centre: damp sand, a pool of light, a stain. */
function softPatch(ctx: Ctx, x: number, y: number, rx: number, ry: number, colour: string, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, rgba(colour, alpha));
  g.addColorStop(0.55, rgba(colour, alpha * 0.6));
  g.addColorStop(1, rgba(colour, 0));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A tapered, curved leaf or blade from `base` to `tip`, bowed through `bend`, `w` wide at the base. */
function blade(ctx: Ctx, base: Pt, bend: Pt, tip: Pt, w: number, colour: string): void {
  const dx = tip[0] - base[0];
  const dy = tip[1] - base[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2);
  const ny = (dx / len) * (w / 2);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(base[0] + nx, base[1] + ny);
  ctx.quadraticCurveTo(bend[0] + nx * 0.6, bend[1] + ny * 0.6, tip[0], tip[1]);
  ctx.quadraticCurveTo(bend[0] - nx * 0.6, bend[1] - ny * 0.6, base[0] - nx, base[1] - ny);
  ctx.closePath();
  ctx.fill();
}

/** A cockle shell lying open side down: a ribbed fan, hinge toward `rot`. */
function cockle(ctx: Ctx, x: number, y: number, s: number, rot: number, colour: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s * 0.7);
  shadow(ctx, 0.5, 0.8, 2.6, 1.2, 0.3);
  blob(ctx, [[0, 1.8], [-1.9, 0.6], [-2.2, -0.8], [-1.2, -2], [0, -2.3], [1.2, -2], [2.2, -0.8], [1.9, 0.6]], colour, { light: 0.4, dark: 0.3 }, () => {
    for (let i = -3; i <= 3; i++) line(ctx, [[0, 1.8], [i * 0.72, -2.4]], 0.18, rgba(darken(colour, 0.35), 0.6));
  });
  ctx.restore();
}

/** A rounded pebble with its shadow. */
function pebble(ctx: Ctx, x: number, y: number, rx: number, colour: string): void {
  shadow(ctx, x + rx * 0.3, y + rx * 0.4, rx * 1.2, rx * 0.45, 0.35);
  ball(ctx, x, y, rx, rx * 0.68, colour, 0.35);
}

/** Pale broken lines of light on still water. */
function glints(ctx: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, count: number, alpha = 0.55): void {
  for (let i = 0; i < count; i++) {
    const x = x0 + rng() * (x1 - x0);
    const y = y0 + rng() * (y1 - y0);
    line(ctx, [[x, y], [x + 3 + rng() * 6, y - 0.2]], 0.5, rgba('#f4fbf8', alpha * (0.5 + rng() * 0.5)));
  }
}

/** A diagonal mesh of thin cord filling the current path, which the caller has already set as the clip. */
function mesh(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, gap: number, colour: string, width = 0.3): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  const span = y1 - y0;
  for (let x = x0 - span; x < x1 + span; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + span, y1);
    ctx.moveTo(x + span, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Strand-line

function shells(): Painted {
  const W = 40;
  const H = 20;
  const [canvas, ctx] = canvasOf(W, H, 5);
  const rng = mulberry32(61);
  softPatch(ctx, 20, 12.5, 18, 5.5, DAMP_SAND, 0.45);
  stipple(ctx, rng, { x0: 5, y0: 9, x1: 35, y1: 17 }, 40, ['#efe4c6', '#a8966e'], 0.35, 0.6);
  pebble(ctx, 9, 12.6, 2.2, '#9d978b');
  pebble(ctx, 29.5, 14.2, 1.7, '#b6aea0');
  pebble(ctx, 24, 9.6, 1.2, '#7f7a72');
  pebble(ctx, 14.6, 15.4, 1.1, '#c3bba9');
  // A mussel, dark blue-black with a sheen along its back.
  shadow(ctx, 21.6, 15.4, 3.2, 1, 0.35);
  blob(ctx, [[17.6, 14.4], [19.6, 13.2], [23.2, 13], [25, 14], [22.6, 15.4], [19, 15.4]], '#2f3440', { light: 0.35 });
  line(ctx, [[19, 13.8], [23, 13.5]], 0.3, 'rgba(190,200,220,0.6)');
  cockle(ctx, 14.2, 10.4, 1.35, -0.3, '#efe2cc');
  cockle(ctx, 32.6, 10.6, 1.1, 0.5, '#e8cdb6');
  cockle(ctx, 26.6, 16, 0.85, 1.4, '#f2ece0');
  cockle(ctx, 19.6, 8.6, 0.7, 2.6, '#e9d6c2');
  cockle(ctx, 35.4, 15.2, 0.6, -1, '#f0e6d6');
  // A whelk: a pale spiral cone.
  shadow(ctx, 6.4, 16.4, 3.2, 1, 0.3);
  blob(ctx, [[2.6, 15.6], [4.4, 14.2], [7.2, 14.4], [9.4, 15.6], [7, 16.8], [4, 16.8]], '#e6d6b8', { light: 0.4, dark: 0.32 }, () => {
    for (const x of [4.4, 5.8, 7.2]) line(ctx, [[x, 14.2], [x - 0.6, 16.8]], 0.25, 'rgba(120,96,70,0.6)');
  });
  for (let i = 0; i < 10; i++) ellipse(ctx, 6 + rng() * 28, 9 + rng() * 8, 0.45, 0.3, rgba('#f6efe0', 0.9));
  return painted(canvas, W, H, [0.5, 16 / H]);
}

function wrack(): Painted {
  const W = 120;
  const H = 30;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const rng = mulberry32(67);
  const along = (x: number): number => 17 + Math.sin((x / W) * Math.PI * 1.7 + 0.3) * 2.6;
  const fade = (x: number): number => Math.min(1, x / 18, (W - x) / 18);
  // The damp line the tide left, and the shadow the wrack casts on it.
  for (let x = 4; x < W - 4; x += 6) softPatch(ctx, x, along(x) + 1.2, 10, 3.6, DAMP_SAND, 0.32 * fade(x));
  // Heaps of bladderwrack that swell and thin along the line, darkest underneath and catching light on top.
  const heap = (x: number): number => fade(x) * (0.55 + 0.45 * Math.sin(x * 0.09 + 0.8) * Math.sin(x * 0.037 + 2));
  for (let x = 6; x < W - 6; x += 1.6 + rng() * 2.4) {
    const k = heap(x) * (0.6 + rng() * 0.4);
    if (k < 0.12) continue;
    const y = along(x) + (rng() - 0.5) * 4 * k;
    const r = 1.2 + k * 3.4;
    shadow(ctx, x + 0.8, y + 1, r * 1.2, r * 0.4, 0.3);
    const lump = looseOutline(rng, x, y, r * (1 + rng() * 0.6), r * 0.5, 2, 0.3, 7);
    blob(ctx, lump, ['#4a4626', '#5d5530', '#3e3a22', '#675c32'][Math.floor(rng() * 4)]!, { light: 0.35, dark: 0.3 });
  }
  // Fronds trailing out of the clumps, with their little air bladders.
  for (let i = 0; i < 70; i++) {
    const x = 8 + rng() * (W - 16);
    if (rng() > fade(x)) continue;
    const y = along(x) + (rng() - 0.5) * 5;
    const dx = (rng() - 0.5) * 10;
    const c = ['#3f3b22', '#5a5230', '#6e6436'][Math.floor(rng() * 3)]!;
    line(ctx, [[x, y], [x + dx * 0.5, y + (rng() - 0.5) * 2.4], [x + dx, y + (rng() - 0.5) * 3]], 0.6 + rng() * 0.6, c, true);
    if (rng() > 0.5) ellipse(ctx, x + dx * 0.6, y, 0.6, 0.45, '#6f6638');
  }
  for (let x = 8; x < W - 8; x += 3) {
    if (rng() > fade(x)) continue;
    line(ctx, [[x, along(x) - 1.4], [x + 2.4, along(x) - 1.7]], 0.45, rgba('#a7a06a', 0.6));
  }
  // Broken reed stems and pale shell litter on top.
  for (let i = 0; i < 16; i++) {
    const x = 10 + rng() * (W - 20);
    const y = along(x) + (rng() - 0.5) * 4;
    const a = (rng() - 0.5) * 0.9;
    const l = 4 + rng() * 7;
    line(ctx, [[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l * 0.5]], 0.6, rng() > 0.4 ? '#c9b47a' : '#a48f5c');
  }
  for (let i = 0; i < 7; i++) {
    const x = 14 + rng() * (W - 28);
    cockle(ctx, x, along(x) + 2 + rng() * 2, 0.6 + rng() * 0.3, rng() * 3, rng() > 0.5 ? '#efe4d0' : '#e3c8b0');
  }
  return painted(canvas, W, H, [0.5, 22 / H]);
}

function driftwood(): Painted {
  const W = 100;
  const H = 40;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const rng = mulberry32(71);
  const wood = '#b6ae9e';
  softPatch(ctx, 52, 31, 46, 7, DAMP_SAND, 0.3);
  shadow(ctx, 50, 31, 46, 4.6, 0.42);
  // One piece of wood: the trunk lying a little across the view, flaring at
  // its butt into blunt, sea-worn root stubs, its far end snapped off.
  const outline: Pt[] = [
    [6, 6.6], [9.6, 7.6], [12.6, 12.4], [17, 15.6], [32, 15], [52, 15.6], [72, 17], [87, 18.4], [90.4, 17.6], [95, 20.4], [95.4, 22.6], [95.6, 24.6],
    [93, 27.4], [88, 28.4], [70, 28.8], [50, 29.8], [30, 31], [19, 31], [13.4, 33.4], [9.6, 36.4], [7, 35.4], [8.4, 31.4], [6.4, 29.6],
    [2.4, 28.6], [1.8, 25.8], [6.4, 24.2], [5.6, 21.2], [1.8, 18], [3, 15.4], [7.6, 16.8], [9, 14.4], [5, 9.4],
  ];
  // Where each root runs out from the trunk, for the grain to follow.
  const roots: Array<[Pt, Pt, Pt]> = [[[22, 18], [12, 13], [7, 7.6]], [[22, 22], [10, 19], [3, 16.6]], [[22, 26], [9, 26], [2.6, 27.2]], [[22, 29], [13, 31], [8.4, 35.4]]];
  blob(ctx, outline, wood, { light: 0.3, dark: 0.22 }, () => {
    stipple(ctx, rng, { x0: 0, y0: 6, x1: 96, y1: 37 }, 260, ['#e2dccc', '#857e70', '#a2967e'], 0.6, 0.35);
    // Long weathered grain along the trunk, pale where the sun catches it and dark in the grooves.
    for (let i = 0; i < 46; i++) {
      const v = rng();
      const x0 = 18 + rng() * 40;
      const x1 = x0 + 24 + rng() * 44;
      const y = (x: number): number => 15.6 + v * 14 + (x - 16) * 0.03 * (1 - v);
      const dark = rng() > 0.45;
      line(ctx, [[x0, y(x0)], [(x0 + x1) / 2, y((x0 + x1) / 2) + (rng() - 0.5) * 0.8], [x1, y(x1)]], dark ? 0.35 : 0.5, rgba(dark ? '#5f584c' : '#efe9dc', dark ? 0.45 : 0.4), true);
    }
    // The grain sweeping out of the trunk into each root.
    for (const [a, mid, b] of roots) {
      for (let k = -1; k <= 1; k++) {
        const off = k * 1.1;
        line(ctx, [[a[0] + 8, a[1] + off * 0.4], [a[0], a[1] + off], [mid[0], mid[1] + off], [b[0], b[1] + off * 0.5]], 0.4, rgba(k ? '#5f584c' : '#efe9dc', 0.45), true);
      }
    }
    // Shade in the crooks between the roots, and a long check split along the trunk.
    for (const [x, y] of [[7, 17], [6.4, 24.8], [9, 30.4], [12, 14.6]] as const) softPatch(ctx, x + 1.5, y, 3.2, 1.6, '#4a443a', 0.5);
    line(ctx, [[34, 22.4], [48, 22], [60, 23.2]], 0.55, rgba('#4f493f', 0.7), true);
    // Sun along the top of the trunk, shade along its underside.
    line(ctx, [[18, 16.4], [52, 16.4], [88, 19.2]], 1.4, rgba('#f4efe2', 0.45), true);
    line(ctx, [[22, 30.4], [50, 29.2], [90, 27.8]], 1.8, rgba('#5a5448', 0.35), true);
  });
  // Paler inner wood showing where the far end broke.
  blob(ctx, [[91.4, 19.4], [94.4, 20.8], [94.8, 23], [94.4, 24.8], [92, 26.4], [90.6, 23]], '#cbc2ae', { light: 0.3, dark: 0.3 });
  // A branch stub on top of the trunk.
  blade(ctx, [56, 17.6], [59, 13], [62.6, 10.4], 3.6, wood);
  ellipse(ctx, 62.6, 10.6, 1.2, 0.8, '#968e7e');
  // Sand drifted against the near side.
  softPatch(ctx, 52, 31.4, 20, 2.2, SAND, 0.7);
  return painted(canvas, W, H, [0.5, 32 / H]);
}

function netFloat(): Painted {
  const W = 24;
  const H = 22;
  const [canvas, ctx] = canvasOf(W, H, 6);
  softPatch(ctx, 12, 16, 11, 4.4, DAMP_SAND, 0.4);
  // The scrap of net under the float.
  const scrap = looseOutline(mulberry32(73), 12, 15.6, 10, 3.8, 2.4, 0.14, 14);
  ctx.save();
  ctx.beginPath();
  curve(ctx, scrap);
  ctx.clip();
  mesh(ctx, 0, 10, W, 21, 1.5, 'rgba(98,76,52,0.85)', 0.28);
  ctx.restore();
  line(ctx, [[3, 15], [0.6, 17.4], [1.4, 19.6]], 0.35, 'rgba(98,76,52,0.85)', true);
  // The float: its shadow, the light it gathers onto the sand, the glass ball and its cords.
  shadow(ctx, 13.6, 16.4, 7, 2.2, 0.45);
  softPatch(ctx, 15.4, 16.6, 3, 1, '#e8f0b0', 0.8);
  const g = ctx.createRadialGradient(10, 7, 0.5, 12, 10, 7);
  g.addColorStop(0, '#cfe8dc');
  g.addColorStop(0.35, '#6fa898');
  g.addColorStop(0.8, '#3f7468');
  g.addColorStop(1, '#2f5a52');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(12, 10, 6.4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Light shining through the far side of the glass.
  ellipse(ctx, 13.6, 13.2, 3, 1.6, 'rgba(200,240,210,0.45)');
  ellipse(ctx, 9.6, 6.8, 1.6, 1, 'rgba(255,255,250,0.9)', -0.5);
  for (const [a, b] of [[[6, 9], [18, 11]], [[7.4, 13.6], [16, 5]], [[8, 5.6], [16.6, 14.4]]] as Array<[Pt, Pt]>) {
    line(ctx, [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 1.2], b], 0.4, 'rgba(110,86,58,0.85)', true);
  }
  return painted(canvas, W, H, [0.5, 17 / H]);
}

function rockPool(): Painted {
  const W = 110;
  const H = 60;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const rng = mulberry32(79);
  softPatch(ctx, 55, 40, 52, 16, '#5a5648', 0.3);
  // The pool: clear water over a sandy, pebbled floor, darker in its depths.
  const pool = looseOutline(mulberry32(80), 54, 34, 30, 11, 2.2, 0.08, 16);
  ctx.save();
  ctx.beginPath();
  curve(ctx, pool);
  ctx.clip();
  const g = ctx.createLinearGradient(24, 22, 70, 48);
  g.addColorStop(0, '#9fc2b4');
  g.addColorStop(0.5, '#6d9e98');
  g.addColorStop(1, '#3f6e72');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) ellipse(ctx, 28 + rng() * 52, 26 + rng() * 16, 1 + rng() * 1.6, 0.7 + rng() * 0.6, rgba(rng() > 0.5 ? '#c9c2a4' : '#59736c', 0.5));
  // Weed swaying in the pool.
  for (let i = 0; i < 9; i++) {
    const x = 32 + rng() * 44;
    const y = 30 + rng() * 12;
    line(ctx, [[x, y], [x + 2 + rng() * 2, y - 2], [x + 5 + rng() * 3, y - 1.4]], 0.9, rgba(rng() > 0.5 ? '#5f7d3a' : '#7c9a48', 0.85), true);
  }
  // The rock rim's dark reflection along the far edge, and the sky on the surface.
  const rim = ctx.createLinearGradient(0, 22, 0, 30);
  rim.addColorStop(0, 'rgba(30,40,40,0.55)');
  rim.addColorStop(1, 'rgba(30,40,40,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 20, W, 10);
  glints(ctx, rng, 30, 30, 72, 42, 8, 0.7);
  ctx.restore();
  // The rocks: wet, dark and sheened, barnacled, with weed hanging at their feet. Back rocks first.
  const rocks: Array<[number, number, number, number]> = [
    [38, 21, 8, 5.4], [55, 18, 13, 8.6], [74, 22, 8, 5.6], [86, 26, 5, 3.6], [24, 28, 10, 7.6], [88, 34, 9, 6.6], [14, 40, 7, 5],
    [96, 42, 6, 4.4], [30, 46, 12, 6], [48, 48.4, 6, 3.6], [64, 47, 8, 4.6], [79, 45.6, 9, 5.4], [40, 49.6, 3, 2], [58, 50, 2.6, 1.8],
  ];
  rocks.sort((a, b) => a[1] - b[1]);
  for (const [x, y, rx, ry] of rocks) {
    const tone = ['#5d5a55', '#4f4c49', '#67635b', '#76716a'][Math.floor(rng() * 4)]!;
    shadow(ctx, x + rx * 0.3, y + ry * 0.6, rx * 1.1, ry * 0.4, 0.45);
    const outline = looseOutline(mulberry32(Math.round(x * 7 + y)), x, y, rx, ry, 2.6, 0.2, 7);
    blob(ctx, outline, tone, { light: 0.3, dark: 0.45 }, (b) => {
      // Weed and green slime toward the waterline, barnacles above it.
      ellipse(ctx, x, b.y1 - 0.6, rx * 0.95, ry * 0.32, rgba('#45472a', 0.85));
      ellipse(ctx, x - rx * 0.3, y - ry * 0.45, rx * 0.4, ry * 0.25, rgba('#7f9a50', 0.4));
      stipple(ctx, rng, { x0: x - rx, y0: y - ry, x1: x + rx, y1: y + ry }, Math.round(rx * 6), ['#8a857a', '#3c3a37', '#6f6a60'], 0.6, 0.5);
      stipple(ctx, rng, { x0: x - rx, y0: y - ry * 0.6, x1: x + rx, y1: y + ry * 0.2 }, Math.round(rx * 1.6), ['#d8d4c4', '#b8b2a2'], 0.32, 0.8);
      // A crack or two across the face.
      line(ctx, [[x - rx * 0.4, y - ry * 0.5], [x - rx * 0.1, y + ry * 0.1], [x + rx * 0.1, y + ry * 0.6]], 0.4, rgba('#2c2a28', 0.5));
    });
    // The wet sheen on the upper-left shoulder.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.45);
    ctx.strokeStyle = 'rgba(240,246,246,0.7)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();
  }
  return painted(canvas, W, H, [0.5, 52 / H]);
}

// ---------------------------------------------------------------------------
// Dune and salt-marsh plants

const MARRAM: Record<Season, readonly string[]> = {
  summer: ['#5d6e4a', '#74845a', '#8f9c6c', '#aab485'],
  autumn: ['#8f7c4c', '#ac9862', '#c6b27a', '#dccb96'],
  winter: ['#7e766a', '#968d7c', '#b0a792', '#c8c1ae'],
};

function duneGrass(season: Season): Painted {
  const W = 80;
  const H = 56;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const rng = mulberry32(83);
  const colours = MARRAM[season];
  // Only a soft damp shade where the clump meets the sand: no hummock of its own, so it lies into the beach.
  softPatch(ctx, 40, 49, 30, 4.4, DAMP_SAND, 0.28);
  // The tussock: blades springing from the crown, back and shaded ones first, arching outward.
  const blades = Array.from({ length: 64 }, () => {
    const t = rng() * 2 - 1;
    return { t, depth: rng() };
  }).sort((a, b) => a.depth - b.depth);
  for (const { t, depth } of blades) {
    const bx = 40 + t * 13 + (rng() - 0.5) * 3;
    const by = 41 + Math.abs(t) * 2 + depth * 3;
    const h = (34 - Math.abs(t) * 14) * (0.6 + rng() * 0.5);
    const lean = t * 14 + (rng() - 0.5) * 6 + 3;
    const tip: Pt = [bx + lean, by - h + Math.abs(lean) * 0.3];
    const bend: Pt = [bx + lean * 0.25, by - h * 0.7];
    const shade = Math.max(0, Math.min(3, Math.round(depth * 2 + (1 - t) * 0.8 + (rng() - 0.5))));
    blade(ctx, [bx, by], bend, tip, 1.2 + rng() * 0.5, colours[shade]!);
  }
  // A few flowering spikes standing above the leaves.
  for (const [x, h, lean] of [[38, 44, -2], [46, 40, 3]] as const) {
    const top: Pt = [x + lean, 41 - h * 0.78];
    line(ctx, [[x, 41], [x + lean * 0.4, 41 - h * 0.5], top], 0.35, colours[2]!, true);
    blade(ctx, [top[0] - lean * 0.05, top[1] + 5], [top[0], top[1] + 2.4], [top[0] + lean * 0.06, top[1] - 1], 1.1, season === 'summer' ? '#c9bf98' : '#dccb9c');
  }
  if (season === 'winter') {
    // Snow caught in the crown.
    softPatch(ctx, 40, 41, 9, 2.2, '#f6f6f2', 0.9);
    for (let i = 0; i < 18; i++) ellipse(ctx, 28 + rng() * 24, 18 + rng() * 20, 0.8, 0.5, 'rgba(250,250,248,0.85)');
  }
  return painted(canvas, W, H, [0.5, 51 / H]);
}

const LAVENDER: Record<Season, { leaf: readonly string[]; stem: string; flower: readonly string[] }> = {
  summer: { leaf: ['#5f7262', '#76897a', '#91a294'], stem: '#7d8068', flower: ['#7f6898', '#9d86b6', '#b7a1cc', '#d2c2e2'] },
  autumn: { leaf: ['#6c6644', '#857c52', '#9c9062'], stem: '#7d6a50', flower: ['#8a5a3e', '#a87454', '#bf8e66', '#d4ab84'] },
  winter: { leaf: ['#6e675c', '#857d70', '#9c9486'], stem: '#7a7064', flower: ['#857a6c', '#9a8f80', '#b1a796', '#eef2f4'] },
};

function seaLavender(season: Season): Painted {
  const W = 60;
  const H = 34;
  const [canvas, ctx] = canvasOf(W, H, 4);
  const rng = mulberry32(89);
  const p = LAVENDER[season];
  softPatch(ctx, 30, 29, 27, 4.4, '#6e6a50', 0.25);
  const clumps: Pt[] = [[17, 28], [31, 29.4], [44, 28.2]];
  // Low rosettes of leathery leaves.
  for (const [cx, cy] of clumps) {
    shadow(ctx, cx + 2, cy + 1, 8, 2, 0.35);
    for (let i = 0; i < 10; i++) {
      const a = Math.PI + (i / 9) * Math.PI + (rng() - 0.5) * 0.3;
      const r = 3 + rng() * 3;
      const tip: Pt = [cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 0.5 + 1];
      blade(ctx, [cx, cy], [(cx + tip[0]) / 2, (cy + tip[1]) / 2 - 0.5], tip, 2.2, p.leaf[Math.floor(rng() * 3)]!);
    }
  }
  // Wiry branching stems carrying sprays of tiny flowers.
  const sprays: Pt[] = [];
  const branch = (from: Pt, angle: number, len: number, depth: number): void => {
    const to: Pt = [from[0] + Math.cos(angle) * len, from[1] + Math.sin(angle) * len];
    line(ctx, [from, to], 0.45 - depth * 0.1, p.stem);
    if (depth === 2) {
      sprays.push(to);
      return;
    }
    for (const turn of [-0.45, 0.4]) branch(to, angle + turn + (rng() - 0.5) * 0.3, len * (0.55 + rng() * 0.2), depth + 1);
  };
  for (const [cx, cy] of clumps) {
    for (let i = 0; i < 3; i++) branch([cx + (rng() - 0.5) * 4, cy - 1], -Math.PI / 2 + (i - 1) * 0.5 + (rng() - 0.5) * 0.3, 6 + rng() * 4, 0);
  }
  for (const [x, y] of sprays) {
    for (let i = 0; i < 9; i++) {
      const dx = (rng() - 0.5) * 4.4;
      const dy = (rng() - 0.6) * 2.2;
      // Lit florets toward the upper left, shaded ones toward the lower right.
      const lit = Math.max(0, Math.min(3, Math.round(1.6 - (dx + dy) * 0.4 + (rng() - 0.5))));
      ellipse(ctx, x + dx, y + dy, 0.75, 0.6, p.flower[season === 'winter' ? Math.min(2, lit) : lit]!);
    }
    if (season === 'winter') ellipse(ctx, x - 0.6, y - 0.8, 0.9, 0.5, rgba(p.flower[3]!, 0.9));
  }
  return painted(canvas, W, H, [0.5, 30 / H]);
}

function sandpiper(): Painted {
  const W = 22;
  const H = 16;
  const [canvas, ctx] = canvasOf(W, H, 6);
  const rng = mulberry32(97);
  const ground = 15;
  shadow(ctx, 11.6, ground, 6, 1.1, 0.4);
  line(ctx, [[10.2, 10.6], [9.4, 13], [9, ground]], 0.45, '#5c5a46');
  line(ctx, [[11.6, 10.6], [12.4, 13], [12.8, ground]], 0.5, '#6e6c56');
  // The body: brown above with pale-edged feathers, clean white beneath.
  blob(ctx, [[2.6, 8.4], [5.6, 6.6], [10, 5.4], [14.4, 5.6], [16.4, 7.6], [15.4, 10.6], [11.6, 11.8], [7, 11.2], [4.4, 9.8]], '#f1eee6', { light: 0.2, dark: 0.3 }, () => {
    blob(ctx, [[2, 8.2], [5.6, 6], [10, 4.8], [14.6, 5.2], [16, 7], [13, 8.6], [8.6, 9.2], [4.6, 9]], '#86705a', { light: 0.3, dark: 0.2 }, () => {
      for (let i = 0; i < 16; i++) {
        const x = 4.6 + rng() * 10;
        const y = 5.6 + rng() * 3;
        ellipse(ctx, x, y, 0.9, 0.5, rgba('#4f3f30', 0.6));
        ellipse(ctx, x + 0.2, y + 0.4, 0.8, 0.22, rgba('#d9c4a0', 0.7));
      }
    });
    // The dark wing tips folded over the tail.
    blob(ctx, [[2.4, 8.3], [6, 7.4], [9, 8.2], [5.4, 9.2]], '#3e3228');
  });
  // The head, with a pale brow, a dark eye and a fine straight bill.
  ball(ctx, 15.4, 5.4, 2.4, 2.2, '#8a7660', 0.3);
  ellipse(ctx, 15.8, 6.8, 1.6, 0.8, '#f1eee6');
  line(ctx, [[14.2, 4.6], [17.2, 4.6]], 0.45, rgba('#efe6d4', 0.9));
  ellipse(ctx, 16.4, 5.3, 0.42, 0.42, '#151210');
  line(ctx, [[17.4, 5.8], [21.4, 6.6]], 0.55, '#2e2a24');
  return painted(canvas, W, H, [11 / W, ground / H]);
}

// ---------------------------------------------------------------------------
// Fishing

function stiltHut(): Painted {
  const W = 150;
  const H = 150;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const rng = mulberry32(101);
  const water = 140;
  const deck = 94;
  // The shallows it stands in: a soft pool of water that fades into whatever is around it.
  const pool = looseOutline(mulberry32(102), 75, 131, 72, 17, 2.2, 0.05, 18);
  ctx.save();
  ctx.beginPath();
  curve(ctx, pool);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 112, 0, 150);
  g.addColorStop(0, '#78a8ac');
  g.addColorStop(1, '#4f8a96');
  ctx.fillStyle = g;
  ctx.fillRect(0, 100, W, 50);
  // The hut's shadow and broken reflection on the water.
  const r = ctx.createLinearGradient(0, 112, 0, 148);
  r.addColorStop(0, 'rgba(40,52,48,0.5)');
  r.addColorStop(1, 'rgba(40,52,48,0)');
  ctx.fillStyle = r;
  ctx.fillRect(16, 112, 118, 36);
  glints(ctx, rng, 8, 120, 142, 148, 22, 0.6);
  ctx.restore();
  featherInto(ctx, looseOutline(mulberry32(102), 75, 131, 66, 14, 2.2, 0.05, 18), 6);

  // Stilts: the back row first, standing in the water, each with its reflection and ripple.
  const back = [36, 62, 88, 114];
  const front = [24, 54, 96, 126];
  const post = (x: number, foot: number, shade: number): void => {
    line(ctx, [[x, foot], [x + 0.4, foot + 5]], 2.4, 'rgba(50,40,30,0.35)');
    bone(ctx, [x, deck - 2], [x + 0.3, foot], 3, 2.6, darken(TIMBER, shade));
    line(ctx, [[x - 0.8, deck], [x - 0.6, foot - 1]], 0.6, rgba('#d8c0a0', 0.4 * (1 - shade)));
    ellipse(ctx, x + 0.2, foot - 2, 1.8, 2, 'rgba(60,80,60,0.35)');
    ripples(ctx, x + 0.2, foot, 4, 1.2, 0.7);
  };
  for (const x of back) post(x, water - 12, 0.3);
  // Cross bracing between the stilts.
  line(ctx, [[24, deck + 2], [54, water - 6]], 1.4, darken(TIMBER, 0.25));
  line(ctx, [[96, water - 6], [126, deck + 2]], 1.4, darken(TIMBER, 0.25));
  for (const x of front) post(x, water - (x === 54 || x === 96 ? 2 : 4), 0.05);

  // The deck: the shadowed underside, its front edge, and the planked top seen from above.
  poly(ctx, [[14, deck - 2], [136, deck - 2], [136, deck + 3], [14, deck + 3]], darken(TIMBER, 0.2), { light: 0.2 });
  poly(ctx, [[20, 78], [130, 78], [138, deck - 2], [12, deck - 2]], lighten(TIMBER, 0.12), { light: 0.3, dark: 0.25 });
  for (let x = 16; x < 136; x += 5) line(ctx, [[x + (x - 75) * -0.07, 78.6], [x, deck - 2.4]], 0.4, rgba('#4a3828', 0.5));

  // The hut: weathered boards, a doorway hung with a reed blind, a small window.
  poly(ctx, [[34, 58], [116, 58], [116, 87], [34, 87]], '#8c6e50', { light: 0.25, dark: 0.32 });
  for (let x = 36; x < 116; x += 3.4) line(ctx, [[x, 58], [x + (rng() - 0.5) * 0.4, 87]], 0.5, rgba('#4a3828', 0.45));
  poly(ctx, [[60, 64], [76, 64], [76, 87], [60, 87]], '#3a2c20', { light: 0.1 });
  poly(ctx, [[60, 64], [76, 64], [76, 78], [60, 78]], '#c7ad78', { light: 0.3, dark: 0.3 });
  for (let y = 65; y < 78; y += 1.4) line(ctx, [[60.4, y], [75.6, y]], 0.3, 'rgba(110,86,50,0.6)');
  poly(ctx, [[90, 67], [106, 67], [106, 76], [90, 76]], '#3a2c20', { light: 0.1 });
  for (let x = 92; x < 106; x += 2.6) line(ctx, [[x, 67], [x, 76]], 0.7, '#a4825a');
  const eaveShade = ctx.createLinearGradient(0, 58, 0, 74);
  eaveShade.addColorStop(0, 'rgba(40,30,20,0.55)');
  eaveShade.addColorStop(1, 'rgba(40,30,20,0)');
  ctx.fillStyle = eaveShade;
  ctx.fillRect(34, 58, 82, 16);
  // A thatched roof, deep and soft, sitting low over the walls.
  blob(ctx, [[18, 68], [26, 46], [40, 26], [75, 20], [110, 26], [124, 46], [132, 68], [75, 72]], THATCH, { light: 0.3, dark: 0.26 }, () => {
    for (let i = 0; i < 220; i++) {
      const x = 20 + rng() * 112;
      const y = 22 + rng() * 48;
      line(ctx, [[x, y], [x + (x - 75) * 0.025, y + 3 + rng() * 3]], 0.6, rgba(rng() > 0.5 ? '#8a6e3c' : '#dcc488', 0.5));
    }
    for (let y = 38; y < 72; y += 10) line(ctx, [[10, y], [75, y + 3], [140, y]], 1.2, rgba('#7a5e30', 0.3), true);
    const eave = ctx.createLinearGradient(0, 60, 0, 72);
    eave.addColorStop(0, 'rgba(60,44,24,0)');
    eave.addColorStop(1, 'rgba(60,44,24,0.45)');
    ctx.fillStyle = eave;
    ctx.fillRect(0, 60, W, 12);
  });
  line(ctx, [[40, 25], [110, 25]], 4.4, darken(THATCH, 0.22));
  line(ctx, [[42, 23.6], [108, 23.6]], 1, rgba(lighten(THATCH, 0.3), 0.6));
  for (let x = 48; x < 108; x += 14) {
    line(ctx, [[x - 1.4, 22.4], [x + 1.2, 27.6]], 1.1, rgba(TIMBER, 0.85));
    line(ctx, [[x + 1.4, 22.4], [x - 1.2, 27.6]], 1.1, rgba(darken(TIMBER, 0.15), 0.85));
  }

  // The rail along the front of the deck, with a net hung over it to dry.
  for (const x of [14, 44, 106, 136]) bone(ctx, [x, deck - 1], [x, deck - 13], 1.6, 1.4, TIMBER);
  line(ctx, [[13, deck - 12.4], [137, deck - 12.4]], 1.4, lighten(TIMBER, 0.08));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(84, deck - 12.6);
  ctx.quadraticCurveTo(108, deck - 9, 132, deck - 12.6);
  ctx.lineTo(130, deck + 10);
  ctx.quadraticCurveTo(116, deck + 15, 104, deck + 8);
  ctx.quadraticCurveTo(94, deck + 13, 86, deck + 6);
  ctx.closePath();
  ctx.fillStyle = 'rgba(96,78,56,0.3)';
  ctx.fill();
  ctx.clip();
  mesh(ctx, 80, deck - 14, 134, deck + 16, 2, 'rgba(78,62,44,0.75)', 0.35);
  ctx.restore();
  for (let x = 88; x < 130; x += 6) ball(ctx, x, deck + 9 + Math.sin(x * 0.4) * 2, 1.1, 1.1, '#d0b47a', 0.4);

  // A ladder from the deck down into the water.
  for (const x of [40, 47]) bone(ctx, [x, deck - 2], [x - 3, water + 1], 1.3, 1.2, lighten(TIMBER, 0.05));
  for (let y = deck + 4; y < water; y += 6) line(ctx, [[40 - ((y - deck) / (water - deck)) * 3, y], [47 - ((y - deck) / (water - deck)) * 3, y]], 1, TIMBER);
  ripples(ctx, 41, water + 1, 6, 1.4, 0.7);
  return painted(canvas, W, H, [0.5, water / H]);
}

function weir(): Painted {
  const W = 130;
  const H = 50;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const rng = mulberry32(107);
  // Water held back above the crest: a smooth, darker sheet with long glints.
  const held = ctx.createLinearGradient(0, 2, 0, 20);
  held.addColorStop(0, 'rgba(70,120,130,0)');
  held.addColorStop(1, 'rgba(70,120,130,0.55)');
  ctx.fillStyle = held;
  ctx.fillRect(0, 2, W, 18);
  for (let i = 0; i < 10; i++) {
    const x = rng() * W;
    line(ctx, [[x, 12 + rng() * 6], [x + 10 + rng() * 14, 12 + rng() * 6]], 0.5, 'rgba(236,246,246,0.5)');
  }
  // The stone footing, wet and rounded, set in a rough row.
  for (let x = 2; x < W; x += 6 + rng() * 4) {
    const y = 30 + rng() * 6;
    const rx = 4 + rng() * 2.6;
    shadow(ctx, x + 1, y + 3.4, rx * 1.1, 1.6, 0.4);
    ball(ctx, x, y, rx, rx * 0.6, ['#6e6c66', '#7d7a72', '#5d5b56'][Math.floor(rng() * 3)]!, 0.32);
    ellipse(ctx, x - rx * 0.3, y - rx * 0.35, rx * 0.4, 0.4, 'rgba(240,246,246,0.5)');
  }
  // The timber sill along the crest, pinned by stakes.
  poly(ctx, [[0, 19], [W, 19], [W, 25], [0, 25]], darken(TIMBER, 0.18), { light: 0.3 });
  line(ctx, [[0, 19.6], [W, 19.6]], 0.8, rgba('#c8a87c', 0.6));
  for (let x = 8; x < W; x += 16) {
    bone(ctx, [x, 15], [x, 27], 2.4, 2.2, darken(TIMBER, 0.28));
    ellipse(ctx, x, 15, 1.2, 0.6, '#9a7a56');
  }
  // Water spilling over the sill: a thin glassy curtain, whiter where it breaks on the stones.
  const heavy = (x: number): number => 0.55 + 0.45 * Math.sin(x * 0.09 + 1.3) * Math.sin(x * 0.031);
  for (let x = 0; x < W; x += 3) {
    const k = heavy(x);
    const curtain = ctx.createLinearGradient(0, 24, 0, 24 + 12 * k);
    curtain.addColorStop(0, `rgba(170,210,210,${0.55 * k})`);
    curtain.addColorStop(0.5, `rgba(236,244,242,${0.55 * k})`);
    curtain.addColorStop(1, 'rgba(236,244,242,0)');
    ctx.fillStyle = curtain;
    ctx.fillRect(x, 24, 3.2, 12 * k);
  }
  for (let i = 0; i < 90; i++) {
    const x = rng() * W;
    const k = heavy(x);
    line(ctx, [[x, 24.4], [x + 0.3, 26 + rng() * 9 * k]], 0.35 + rng() * 0.4, rgba('#f6faf8', (0.25 + rng() * 0.4) * k));
  }
  // Foam churning at the foot in soft heaps, and the ripples it sends downstream.
  for (let i = 0; i < 46; i++) {
    const x = rng() * W;
    softPatch(ctx, x, 38 + rng() * 5, 3 + rng() * 5 * heavy(x), 1.4 + rng() * 1.2, '#f4f8f6', 0.45 + rng() * 0.4);
  }
  for (let i = 0; i < 40; i++) ellipse(ctx, rng() * W, 37 + rng() * 7, 0.5 + rng() * 0.6, 0.35, 'rgba(250,252,250,0.8)');
  for (let i = 0; i < 14; i++) {
    const x = rng() * W;
    const y = 44 + rng() * 4.6;
    line(ctx, [[x, y], [x + 3, y - 0.4], [x + 7 + rng() * 4, y]], 0.4, 'rgba(236,246,246,0.35)', true);
  }
  // Soften both ends so sections laid side by side run together.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (const [x0, x1] of [[0, 8], [W, W - 8]] as const) {
    const fade = ctx.createLinearGradient(x0, 0, x1, 0);
    fade.addColorStop(0, 'rgba(0,0,0,0.85)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(Math.min(x0, x1), 0, 8, H);
  }
  ctx.restore();
  return painted(canvas, W, H, [0.5, 44 / H]);
}

function boatBeached(): Painted {
  const W = 110;
  const H = 40;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const rng = mulberry32(109);
  // The groove it left being hauled up the beach, and its shadow.
  softPatch(ctx, 54, 30, 50, 7, DAMP_SAND, 0.35);
  for (const dy of [0, 4]) line(ctx, [[2, 33 + dy], [20, 30 + dy * 0.8]], 1.6, 'rgba(150,128,90,0.4)');
  shadow(ctx, 58, 31, 48, 5.6, 0.45);
  // Drawn up and listing a little toward us, the bow lifted to the right.
  ctx.save();
  ctx.translate(55, 22);
  ctx.rotate(-0.07);
  ctx.translate(-55, -22);
  // The near side of the hull, its planks and the dark tide line along it.
  blob(ctx, [[10, 14], [40, 12.4], [74, 12.6], [100, 8], [104, 9.6], [92, 22], [70, 29], [40, 30], [12, 28]], darken(TIMBER, 0.12), { light: 0.25, dark: 0.35 }, () => {
    for (const y of [19, 23.4, 27]) line(ctx, [[8, y], [50, y + 0.6], [96, y - 8 + (y - 19) * 0.6]], 0.5, rgba('#3a2a1c', 0.55), true);
    line(ctx, [[10, 27.6], [50, 29], [90, 24]], 2.2, rgba('#3e3a2c', 0.45), true);
  });
  // The gunwale and the open hull seen from above, its floor in shade.
  blob(ctx, [[10, 13], [40, 9], [74, 9.4], [100, 7.4], [94, 15.4], [72, 21], [40, 21.6], [11, 20.4]], lighten(TIMBER, 0.14), { light: 0.32, dark: 0.2 });
  blob(ctx, [[14, 13.6], [40, 10.8], [72, 11.2], [92, 9.6], [88, 14.6], [70, 18.6], [40, 19.2], [14.6, 18.6]], darken(TIMBER, 0.22), { light: 0.15, dark: 0.3 }, () => {
    for (let y = 12.4; y < 19.4; y += 1.8) line(ctx, [[12, y], [92, y - 2.4]], 0.4, rgba('#2e2218', 0.5));
  });
  // Two thwarts, a coil of rope and an oar laid across.
  for (const x of [36, 64]) poly(ctx, [[x, 10.6], [x + 4, 10.4], [x + 4, 19.6], [x, 19.8]], lighten(TIMBER, 0.22), { light: 0.35 });
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = rgba(i % 2 ? '#c8ae78' : '#a88e5c', 0.95);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(52, 15.6, 4 - i * 0.7, 2 - i * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  bone(ctx, [20, 22], [86, 6.4], 1.3, 1.1, '#a8865a');
  blob(ctx, [[84, 7.6], [92, 4], [96, 4.4], [89, 8.6]], '#a8865a', { light: 0.35 });
  // The square stern board.
  poly(ctx, [[8, 13.4], [12, 12.6], [13, 28], [9, 27.6]], darken(TIMBER, 0.3), { light: 0.2 });
  ctx.restore();
  // Sand banked against the near side where it came to rest.
  softPatch(ctx, 40, 31.6, 22, 2.6, SAND, 0.75);
  stipple(ctx, rng, { x0: 20, y0: 29, x1: 70, y1: 34 }, 30, ['#efe4c6', '#a8966e'], 0.4, 0.5);
  return painted(canvas, W, H, [0.5, 33 / H]);
}

export const SHORE: Record<string, Painter> = {
  shells,
  wrack,
  driftwood,
  'net-float': netFloat,
  'rock-pool': rockPool,
  'dune-grass': () => duneGrass('summer'),
  'dune-grass-autumn': () => duneGrass('autumn'),
  'dune-grass-winter': () => duneGrass('winter'),
  'sea-lavender': () => seaLavender('summer'),
  'sea-lavender-autumn': () => seaLavender('autumn'),
  'sea-lavender-winter': () => seaLavender('winter'),
  sandpiper,
  'stilt-hut': stiltHut,
  weir,
  'boat-beached': boatBeached,
};

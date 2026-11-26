/**
 * Fields and farm things, seen from the game camera (35 degrees above, looking
 * north). Fields are laid flat on the grass: soft-edged plots whose margins
 * feather into the meadow, with rows that bow a little along the land. Flat
 * fields anchor at their centre; things that stand anchor where they meet the ground.
 */

import { type Ctx, type Painted, type Painter, type Pt, ball, blob, bone, canvasOf, curve, darken, ellipse, featherInto, lighten, line, looseOutline, painted, poly, rgba, shadow, stipple, tuft } from './common';
import { type Rng, mulberry32 } from '../../core/rng';

const W = 150;
const H = 90;
const WHOLE = { x0: 0, y0: 0, x1: W, y1: H };

/** Meadow grass at a field's margin, shade to light, in each season the fields are painted for. */
const GRASS = ['#647a3c', '#768b44', '#8c9e50', '#a4b062'];
const GRASS_AUTUMN = ['#7c7a3e', '#928c4c', '#ab9f5c', '#c2b26e'];
const GRASS_WINTER = ['#8a8670', '#a09b84', '#bab5a0', '#d2cfc0'];

/** A field's edge: a softly irregular rounded plot. The same seed gives the same wobble at any inset, so banks run true. */
function fieldOutline(seed: number, inset = 0): Pt[] {
  return looseOutline(mulberry32(seed), W / 2, H / 2 + 1, W / 2 - 7 - inset, H / 2 - 8 - inset * 0.6, 5, 0.035, 32);
}

function fillOutline(ctx: Ctx, pts: readonly Pt[], fill: string | CanvasGradient, dy = 0): void {
  ctx.save();
  ctx.translate(0, dy);
  ctx.fillStyle = fill;
  ctx.beginPath();
  curve(ctx, pts);
  ctx.fill();
  ctx.restore();
}

function clipTo(ctx: Ctx, pts: readonly Pt[], dy = 0): void {
  ctx.translate(0, dy);
  ctx.beginPath();
  curve(ctx, pts);
  ctx.translate(0, -dy);
  ctx.clip();
}

/**
 * The centre line of row `r` of `rows` at `x`. Rows bow gently, as if
 * ploughed along a slight contour, tilt a touch, and open out toward the
 * near edge as the ground comes toward the camera.
 */
function rowY(r: number, rows: number, x: number, top: number, bottom: number, bow: number): number {
  const t = rows > 1 ? r / (rows - 1) : 0;
  const y = top + (bottom - top) * (t * 0.82 + t * t * 0.18);
  const u = (x - W / 2) / (W / 2);
  return y - bow * (1 - u * u) + u * 1.6;
}

function rowLine(r: number, rows: number, top: number, bottom: number, bow: number, dy = 0): Pt[] {
  const pts: Pt[] = [];
  for (let x = -6; x <= W + 6; x += 12) pts.push([x, rowY(r, rows, x, top, bottom, bow) + dy]);
  return pts;
}

/** Tilled earth: a base colour broken up with lighter and darker crumbs. */
function earth(ctx: Ctx, rng: Rng, base: string): void {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  stipple(ctx, rng, WHOLE, 700, [lighten(base, 0.3), darken(base, 0.22), '#7d6d4c', '#9c8a62'], 1.2, 0.4);
}

/** Furrows between the rows: a shaded trough under each row and a lit ridge along its top. */
function furrows(ctx: Ctx, rows: number, top: number, bottom: number, bow: number, base: string): void {
  for (let r = 0; r < rows; r++) {
    line(ctx, rowLine(r, rows, top, bottom, bow, 1.6), 2.6, rgba(darken(base, 0.35), 0.5), true);
    line(ctx, rowLine(r, rows, top, bottom, bow, -1.2), 1.6, rgba(lighten(base, 0.3), 0.35), true);
  }
}

/** Warm light from the upper left, cool shade toward the lower right, over the whole piece. */
function lightOver(ctx: Ctx, light = 0.14, dark = 0.16): void {
  const g = ctx.createLinearGradient(W * 0.1, 0, W * 0.75, H);
  g.addColorStop(0, `rgba(255,244,214,${light})`);
  g.addColorStop(0.5, 'rgba(255,244,214,0)');
  g.addColorStop(1, `rgba(26,34,50,${dark})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Grass tufts straddling the edge of a plot, so the field's margin melts into the meadow. */
function fringe(ctx: Ctx, rng: Rng, outline: readonly Pt[], colours: readonly string[], count: number): void {
  const n = outline.length;
  for (let i = 0; i < count; i++) {
    const k = (i / count) * n;
    const a = outline[Math.floor(k) % n]!;
    const b = outline[(Math.floor(k) + 1) % n]!;
    const t = k - Math.floor(k);
    const x = a[0] + (b[0] - a[0]) * t + (rng() - 0.5) * 3;
    const y = a[1] + (b[1] - a[1]) * t + (rng() - 0.5) * 2.4;
    tuft(ctx, rng, x, y + 1, { blades: 4 + Math.floor(rng() * 4), height: 2.4 + rng() * 2.6, spread: 1.4 + rng(), colours, width: 0.45 });
  }
}

/** Calls `plant` at intervals along each row, with jitter and the odd gap, back row first. */
function alongRows(rng: Rng, rows: number, top: number, bottom: number, bow: number, every: number, plant: (x: number, y: number, r: number) => void): void {
  for (let r = 0; r < rows; r++) {
    for (let x = 4 + (r % 2) * every * 0.5; x < W - 4; x += every * (0.8 + rng() * 0.4)) {
      if (rng() < 0.05) continue;
      plant(x, rowY(r, rows, x, top, bottom, bow) + (rng() - 0.5) * 0.8, r);
    }
  }
}

// ---------------------------------------------------------------------------
// Rice paddies: water held in by a low earth bund.

type Paddy = 'spring' | 'summer' | 'autumn' | 'winter';

function ricePaddy(season: Paddy): Painted {
  const [canvas, ctx] = canvasOf(W, H, 3);
  const rng = mulberry32(17);
  const outer = fieldOutline(17);
  const inner = fieldOutline(17, 7);
  const winter = season === 'winter';
  const grass = winter ? GRASS_WINTER : season === 'autumn' ? GRASS_AUTUMN : GRASS;

  // The bund: its outer face toward the camera, then its grassy top.
  fillOutline(ctx, outer, winter ? '#9c9584' : '#6f5a3e', 2.2);
  fillOutline(ctx, outer, winter ? '#d9d8cf' : season === 'autumn' ? '#9a8c55' : '#859448');
  ctx.save();
  clipTo(ctx, outer);
  stipple(ctx, rng, WHOLE, 500, winter ? ['#f2f2ec', '#bdb8a6', '#e6e7e2'] : [grass[0]!, grass[3]!, '#8a7550'], 1.2, 0.45);
  ctx.restore();
  // Inside the bund: the inner face of the far bank shows above the water.
  fillOutline(ctx, inner, winter ? '#a7a294' : '#77623f');
  ctx.save();
  clipTo(ctx, inner);
  clipTo(ctx, inner, 1.6);
  paddyWater(ctx, rng, season);
  ctx.restore();

  // Grass along the top of the bund, then the feathered edge into the meadow.
  fringe(ctx, rng, fieldOutline(17, 3.6), grass, 46);
  lightOver(ctx, 0.12, 0.12);
  featherInto(ctx, fieldOutline(17, -2.4), 2.2);
  fringe(ctx, rng, fieldOutline(17, -0.6), grass, 40);
  if (winter) {
    // Soft drifts of snow lying along the bund, heaviest on its sunlit far side.
    const bund = fieldOutline(17, 3.2);
    bund.forEach((p, i) => {
      if (rng() < 0.4) return;
      const glow = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 4);
      glow.addColorStop(0, `rgba(250,250,246,${i < bund.length / 2 ? 0.8 : 0.55})`);
      glow.addColorStop(1, 'rgba(250,250,246,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(p[0] - 4, p[1] - 4, 8, 8);
    });
  }
  return painted(canvas, W, H, [0.5, 0.5]);
}

function paddyWater(ctx: Ctx, rng: Rng, season: Paddy): void {
  const rows = 12;
  const top = 16;
  const bottom = 78;
  const bow = 2.6;
  if (season === 'winter') {
    // Ice under a skim of snow, with dull cut stubble standing in rows.
    const g = ctx.createLinearGradient(0, 10, W * 0.6, H);
    g.addColorStop(0, '#e2e8ea');
    g.addColorStop(1, '#b4c2c8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) ellipse(ctx, 10 + rng() * (W - 20), 14 + rng() * 64, 8 + rng() * 14, 2 + rng() * 2.4, rgba('#f8f8f4', 0.35 + rng() * 0.35), (rng() - 0.5) * 0.2);
    for (let i = 0; i < 6; i++) {
      const x = 20 + rng() * 110;
      const y = 22 + rng() * 50;
      line(ctx, [[x, y], [x + 4 + rng() * 6, y + (rng() - 0.5) * 3], [x + 10 + rng() * 6, y + (rng() - 0.5) * 4]], 0.35, 'rgba(120,140,150,0.45)');
    }
    alongRows(rng, rows, top, bottom, bow, 4.2, (x, y) => {
      ellipse(ctx, x + 0.4, y + 0.3, 1.2, 0.35, 'rgba(110,120,128,0.25)');
      for (let i = 0; i < 4; i++) line(ctx, [[x + i * 0.4 - 0.6, y], [x + i * 0.5 - 0.8 + (rng() - 0.5) * 0.5, y - 0.9 - rng() * 0.8]], 0.3, rgba(i % 2 ? '#a89670' : '#7f6d4c', 0.8));
    });
    lightOver(ctx, 0.1, 0.14);
    return;
  }
  // Still water holding the sky: pale where it catches the light, deepening to the near side.
  const drained = season === 'autumn';
  const g = ctx.createLinearGradient(W * 0.15, 8, W * 0.6, H);
  g.addColorStop(0, drained ? '#8d8a68' : '#cfe0dc');
  g.addColorStop(0.45, drained ? '#73704f' : '#97bfc0');
  g.addColorStop(1, drained ? '#5e5a40' : '#6c9ea3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Clouds reflected in it, and the far bank's dark reflection along the top.
  for (let i = 0; i < 5; i++) ellipse(ctx, 20 + rng() * 110, 24 + rng() * 44, 12 + rng() * 14, 3 + rng() * 2, rgba('#f4f6ee', drained ? 0.08 : 0.28), (rng() - 0.5) * 0.15);
  const bank = ctx.createLinearGradient(0, 8, 0, 22);
  bank.addColorStop(0, 'rgba(56,62,36,0.5)');
  bank.addColorStop(1, 'rgba(56,62,36,0)');
  ctx.fillStyle = bank;
  ctx.fillRect(0, 0, W, 22);
  for (let i = 0; i < 12; i++) {
    const x = 12 + rng() * 120;
    const y = 18 + rng() * 60;
    line(ctx, [[x, y], [x + 6 + rng() * 10, y - 0.2]], 0.5, rgba('#f6fbf8', drained ? 0.2 : 0.5));
  }

  if (season === 'spring') {
    // Seedlings newly planted out in lines, each doubled by its reflection.
    alongRows(rng, rows, top, bottom, bow, 5.2, (x, y) => {
      ellipse(ctx, x + 0.3, y + 0.5, 1.6, 0.45, 'rgba(236,246,244,0.4)');
      line(ctx, [[x, y + 0.4], [x + 0.3, y + 2.2]], 0.6, 'rgba(60,90,60,0.25)');
      tuft(ctx, rng, x, y, { blades: 4, height: 3, spread: 0.9, colours: ['#6b9142', '#82a84c', '#9cbe5c', '#b8d070'], width: 0.4 });
    });
  } else if (season === 'summer') {
    // Rice grown thick: the water shows only in glints between the rows.
    for (let r = 0; r < rows; r++) line(ctx, rowLine(r, rows, top, bottom, bow, -1.4), 3.2, rgba('#557f36', 0.75), true);
    alongRows(rng, rows, top, bottom, bow, 2.4, (x, y) => {
      tuft(ctx, rng, x, y, { blades: 6, height: 4.6, spread: 1.5, colours: ['#4f7a34', '#62903c', '#79a646', '#97bc58'], width: 0.45 });
    });
  } else {
    // Ripe rice, gold, its heavy heads nodding toward the light.
    for (let r = 0; r < rows; r++) line(ctx, rowLine(r, rows, top, bottom, bow, -1.4), 3.2, rgba('#a88a3c', 0.8), true);
    alongRows(rng, rows, top, bottom, bow, 2.4, (x, y) => {
      tuft(ctx, rng, x, y, {
        blades: 7, height: 4.4, spread: 1.7, colours: ['#97782e', '#b8953c', '#d0ae4e', '#e4c768'], width: 0.45, lean: -0.3,
        tip: (at, i) => {
          if (i % 2) line(ctx, [at, [at[0] - 0.9, at[1] + 0.5], [at[0] - 1.4, at[1] + 1.4]], 0.9, rgba('#e8cf74', 0.95), true);
        },
      });
    });
  }
  lightOver(ctx, 0.1, 0.12);
}

// ---------------------------------------------------------------------------
// Dry fields

function cropRows(autumn: boolean): Painted {
  const [canvas, ctx] = canvasOf(W, H, 3);
  const rng = mulberry32(5);
  const rows = 8;
  const top = 15;
  const bottom = 76;
  const bow = 3;
  const soil = autumn ? '#8c7150' : '#80664a';
  earth(ctx, rng, soil);
  furrows(ctx, rows, top, bottom, bow, soil);
  const leaves = autumn ? ['#9a7c36', '#b99644', '#d2b057', '#e6ca72'] : ['#4f7832', '#638c3a', '#7ca345', '#9dbd5a'];
  alongRows(rng, rows, top, bottom, bow, 2.8, (x, y) => {
    const big = rng() > 0.85;
    tuft(ctx, rng, x, y, {
      blades: big ? 8 : 6,
      height: (big ? 6.2 : 5) * (0.85 + rng() * 0.3),
      spread: 1.6,
      colours: leaves,
      width: 0.5,
      lean: autumn ? -0.4 : 0,
      tip: (at, i) => {
        // Ears of grain: green and tight in summer, gold and drooping in autumn.
        if (i % 3) return;
        if (autumn) ellipse(ctx, at[0] - 0.5, at[1] + 0.4, 0.6, 1.3, '#ecd27e', 0.5);
        else ellipse(ctx, at[0], at[1] + 0.3, 0.45, 1.1, '#b6c873', 0.1);
      },
    });
  });
  lightOver(ctx);
  featherInto(ctx, fieldOutline(5, 1), 3);
  fringe(ctx, rng, fieldOutline(5, 1.5), autumn ? GRASS_AUTUMN : GRASS, 64);
  return painted(canvas, W, H, [0.5, 0.94]);
}

/** One cabbage from above: loose outer leaves round a tight, paler heart. */
function cabbage(ctx: Ctx, rng: Rng, x: number, y: number): void {
  shadow(ctx, x + 1, y + 1.1, 3.4, 1.3, 0.35);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng();
    ball(ctx, x + Math.cos(a) * 1.5, y + Math.sin(a) * 0.9, 1.7, 1.1, i % 2 ? '#5f8a5a' : '#6e9862', 0.25);
  }
  ball(ctx, x - 0.2, y - 0.4, 1.5, 1.2, '#a9c88a', 0.45);
}

/** Leeks or onions: a few upright blue-green leaves. */
function leek(ctx: Ctx, rng: Rng, x: number, y: number): void {
  tuft(ctx, rng, x, y, { blades: 4, height: 4.8, spread: 0.8, colours: ['#4f7a66', '#618f78', '#7aa58c', '#9cc0a4'], width: 0.6 });
}

/** Carrots or daikon: a feathery spray. */
function carrot(ctx: Ctx, rng: Rng, x: number, y: number): void {
  tuft(ctx, rng, x, y, {
    blades: 6, height: 3.6, spread: 1.8, colours: ['#4e7d30', '#64963a', '#80b048', '#a2c860'], width: 0.35,
    tip: (at) => ellipse(ctx, at[0], at[1], 0.8, 0.5, rgba('#8cb850', 0.8)),
  });
}

function vegetableRows(): Painted {
  const [canvas, ctx] = canvasOf(W, H, 3);
  const rng = mulberry32(11);
  const rows = 7;
  const top = 16;
  const bottom = 76;
  const bow = 2.2;
  const soil = '#7a5f42';
  earth(ctx, rng, soil);
  furrows(ctx, rows, top, bottom, bow, soil);
  const crops = [cabbage, leek, carrot];
  alongRows(rng, rows, top, bottom, bow, 5.4, (x, y, r) => crops[r % 3]!(ctx, rng, x, y));
  lightOver(ctx);
  featherInto(ctx, fieldOutline(11, 1), 3);
  fringe(ctx, rng, fieldOutline(11, 1.5), GRASS, 64);
  return painted(canvas, W, H, [0.5, 0.5]);
}

function haystack(): Painted {
  const [canvas, ctx] = canvasOf(32, 38, 3);
  const straw = '#cdb06a';
  shadow(ctx, 17.4, 35, 12, 3);
  blob(ctx, [[5.4, 34], [4.4, 26], [6.6, 16], [11, 11], [16, 10], [21, 11], [25.4, 16], [27.6, 26], [26.6, 34], [16, 35.6]], straw, { light: 0.3, dark: 0.36 }, () => {
    for (let i = 0; i < 40; i++) {
      const x = 5 + ((i * 7.7) % 22);
      const y = 13 + ((i * 5.3) % 21);
      line(ctx, [[x, y], [x + 0.6, y + 3]], 0.45, rgba(i % 2 ? '#8e7440' : '#ecd99a', 0.6));
    }
    line(ctx, [[4, 22], [16, 24], [28, 22]], 1, rgba('#7a6034', 0.7), true);
  });
  // The straw cap.
  blob(ctx, [[8, 13.6], [12, 7], [16, 2.4], [20, 7], [24.6, 13.6], [16, 12.4]], lighten(straw, 0.1), { light: 0.35 }, () => {
    for (let x = 9; x < 24; x += 1.6) line(ctx, [[16, 2.4], [x, 13.6]], 0.35, rgba('#8e7440', 0.5));
  });
  line(ctx, [[16, 2.6], [16, 0.6]], 0.8, '#7a6034');
  return painted(canvas, 32, 38, [17 / 32, 35 / 38]);
}

function riceDryingRack(): Painted {
  const [canvas, ctx] = canvasOf(64, 36, 3);
  shadow(ctx, 33, 33, 30, 3);
  for (const x of [6, 32, 58]) bone(ctx, [x, 6], [x, 33], 1.4, 1.2, '#7a5c3e');
  line(ctx, [[4, 9], [60, 9]], 1.1, '#8a6a46');
  line(ctx, [[4, 18], [60, 18]], 1.1, '#8a6a46');
  // Sheaves hung head-down over the poles: a golden curtain.
  for (const [y0, y1] of [[9, 17], [18, 27]] as const) {
    for (let x = 7; x < 58; x += 2.4) {
      const c = (x | 0) % 3 ? '#cfae58' : '#e0c06a';
      blob(ctx, [[x - 1.2, y0 - 0.6], [x + 1.2, y0 - 0.6], [x + 1.4, y1], [x, y1 + 1], [x - 1.4, y1]], c, { light: 0.3, dark: 0.3 });
    }
  }
  return painted(canvas, 64, 36, [33 / 64, 33 / 36]);
}

function scarecrow(): Painted {
  const [canvas, ctx] = canvasOf(26, 42, 4);
  shadow(ctx, 14, 39.6, 6, 1.6);
  bone(ctx, [13, 16], [13.4, 39.6], 1.3, 1.2, '#7a5c3e');
  line(ctx, [[2.6, 17.6], [23.6, 16.6]], 1.1, '#7a5c3e');
  // A faded indigo coat hung on the cross, its sleeves ragged.
  blob(ctx, [[3, 16.4], [8, 15.4], [13, 15.4], [18.4, 15.2], [23.2, 15.6], [23.4, 19.6], [20.6, 19.4], [18, 20.6], [18.4, 29.4], [15.6, 30.2], [13.2, 28.8], [10.6, 30.4], [8, 29.4], [8.4, 20.6], [5.8, 19.8], [2.8, 20]], '#5b6f86', { light: 0.32 }, () => {
    line(ctx, [[8.6, 23], [18, 23]], 1.6, '#b9944e');
    line(ctx, [[13, 15.6], [12.6, 22]], 0.5, 'rgba(30,40,60,0.5)');
  });
  for (const x of [3.2, 22.8]) line(ctx, [[x, 19.6], [x - 0.6, 21.6]], 0.7, '#d4b874');
  ball(ctx, 13.2, 11.6, 3.2, 3.4, '#e8e0cc', 0.25);
  ellipse(ctx, 13.2, 8.4, 7.4, 1.9, '#b39654');
  blob(ctx, [[5.8, 8.2], [10, 5], [13.2, 3.6], [16.4, 5], [20.6, 8.2], [13.2, 9]], '#d4b874', { light: 0.35 });
  return painted(canvas, 26, 42, [14 / 26, 39.6 / 42]);
}

function beehive(): Painted {
  const [canvas, ctx] = canvasOf(18, 26, 4);
  shadow(ctx, 9.6, 23.6, 6.4, 1.8);
  for (let i = 0; i < 4; i++) {
    const y = 22 - i * 4.4;
    poly(ctx, [[3.4, y - 4.2], [14.6, y - 4.2], [14.6, y], [3.4, y]], i % 2 ? '#9a7a52' : '#8a6a46', { light: 0.3 });
    line(ctx, [[3.4, y - 0.2], [14.6, y - 0.2]], 0.4, 'rgba(50,36,24,0.5)');
  }
  ellipse(ctx, 9, 21, 1.2, 0.5, '#2a1f16');
  poly(ctx, [[1.4, 5.6], [9, 2.6], [16.6, 5.6], [16.6, 6.8], [1.4, 6.8]], '#6f5a44', { light: 0.35 });
  ellipse(ctx, 9, 2.4, 1.6, 0.9, '#8a8a84');
  return painted(canvas, 18, 26, [9.6 / 18, 23.6 / 26]);
}

export const FARM: Record<string, Painter> = {
  'rice-paddy': () => ricePaddy('summer'),
  'rice-paddy-spring': () => ricePaddy('spring'),
  'rice-paddy-autumn': () => ricePaddy('autumn'),
  'rice-paddy-winter': () => ricePaddy('winter'),
  'crop-rows': () => cropRows(false),
  'crop-rows-autumn': () => cropRows(true),
  'vegetable-rows': vegetableRows,
  haystack,
  'rice-drying-rack': riceDryingRack,
  scarecrow,
  beehive,
};

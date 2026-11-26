/**
 * Finds that grow: ferns and moss, mushrooms, wild flowers, fruit and nuts,
 * the willow cutting, and the sea plants of the estuary.
 *
 * Several of these are built from a few small generators (a strap-shaped
 * frond, a petal, a ribbon) so that a leaf is drawn as a leaf along its own
 * curve rather than as a hand-placed polygon.
 */

import { apple, bloom, place, radial } from './finds-pen';
import { oval, ring, type Drawing } from './pen';

export type Pt = [number, number];

const r2 = (v: number): string => (Math.round(v * 100) / 100).toString();
const pt = ([x, y]: Pt): string => `${r2(x)} ${r2(y)}`;

/** A smooth pen line through the points (Catmull-Rom as cubic Béziers), optionally closed. */
export function smooth(pts: Pt[], closed = false): string {
  const n = pts.length;
  const at = (i: number): Pt => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(pts[0])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? `${d}Z` : d;
}

/** Point at an angle (degrees, 0 = up, clockwise) and radius from a centre. */
export function polar(cx: number, cy: number, r: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

/**
 * A petal, tepal or bract pointing out from cx, cy at `deg`: it starts r0 from
 * the centre, reaches `len`, and is about `w` wide at its fullest. `blunt`
 * rounds the tip (0 is pointed).
 */
export function petal(cx: number, cy: number, r0: number, len: number, w: number, deg: number, blunt = 0): string {
  const a = (deg * Math.PI) / 180;
  const at = (u: number, v: number): string => pt([cx + u * Math.sin(a) + v * Math.cos(a), cy - u * Math.cos(a) + v * Math.sin(a)]);
  const tip = 0.5 + blunt;
  return (
    `M${at(r0, 0)}C${at(r0 + len * 0.3, w)} ${at(len * 0.86, w * tip)} ${at(len, 0)}` +
    `C${at(len * 0.86, -w * tip)} ${at(r0 + len * 0.3, -w)} ${at(r0, 0)}Z`
  );
}

/** A point on a quadratic curve, with its unit normal. */
function onQuad(p0: Pt, p1: Pt, p2: Pt, t: number): { p: Pt; n: Pt; tan: Pt } {
  const u = 1 - t;
  const p: Pt = [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
  const dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
  const l = Math.hypot(dx, dy) || 1;
  return { p, n: [-dy / l, dx / l], tan: [dx / l, dy / l] };
}

/**
 * A strap-shaped leaf along a curve from p0 (its foot) to p2 (its tip): even
 * width most of the way, narrowing to a point, with a slightly eared base.
 * Returns the outline and the midrib.
 */
function strap(p0: Pt, p1: Pt, p2: Pt, w: number): { edge: string; rib: string } {
  const left: Pt[] = [];
  const right: Pt[] = [];
  const rib: Pt[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const { p, n } = onQuad(p0, p1, p2, t);
    const h = w * Math.min(1, 0.55 + t * 4) * (t > 0.68 ? Math.pow((1 - t) / 0.32, 0.75) : 1);
    left.push([p[0] + n[0] * h, p[1] + n[1] * h]);
    if (i < steps) right.push([p[0] - n[0] * h, p[1] - n[1] * h]);
    if (t <= 0.9) rib.push(p);
  }
  return { edge: smooth([...left, ...right.reverse()], true), rib: smooth(rib) };
}

/** Oblique paired strokes down a frond: the rows of spore cases under a hart's-tongue leaf. */
function sori(p0: Pt, p1: Pt, p2: Pt, w: number): string {
  let d = '';
  for (let t = 0.24; t <= 0.72; t += 0.08) {
    const { p, n, tan } = onQuad(p0, p1, p2, t);
    for (const s of [1, -1]) {
      const a: Pt = [p[0] + n[0] * 0.6 * s, p[1] + n[1] * 0.6 * s];
      const b: Pt = [p[0] + n[0] * w * 0.72 * s + tan[0] * 1.3, p[1] + n[1] * w * 0.72 * s + tan[1] * 1.3];
      d += `M${pt(a)}L${pt(b)}`;
    }
  }
  return d;
}

/** A narrow willow leaf from x, y, pointing along dx, dy (relative), drawn as one closed shape. */
function willowLeaf(x: number, y: number, dx: number, dy: number): string {
  // The two edges bow out on either side of the leaf's axis.
  const nx = -dy * 0.22;
  const ny = dx * 0.22;
  return (
    `M${r2(x)} ${r2(y)}c${r2(dx * 0.3 + nx)} ${r2(dy * 0.3 + ny)} ${r2(dx * 0.75 + nx)} ${r2(dy * 0.75 + ny)} ${r2(dx)} ${r2(dy)}` +
    `c${r2(-dx * 0.25 - nx)} ${r2(-dy * 0.25 - ny)} ${r2(-dx * 0.7 - nx)} ${r2(-dy * 0.7 - ny)} ${r2(-dx)} ${r2(-dy)}Z`
  );
}

// ---------------------------------------------------------------------------
// The upper river: gorge, wood and high meadow
// ---------------------------------------------------------------------------

/** Hart's-tongue fern: undivided glossy straps arching out of a wet rock wall. */
const HART: Array<[Pt, Pt, Pt, number]> = [
  [[11, 22.4], [22, 7], [39.6, 8.6], 2.7],
  [[11.6, 24.2], [28, 17.4], [42.4, 25.4], 2.9],
  [[11.2, 26.4], [24, 29.6], [33, 41.6], 2.6],
  [[10.6, 22.2], [14.4, 13.6], [17.8, 5.4], 2],
];
const hartFronds = HART.map(([a, b, c, w]) => strap(a, b, c, w));
const hartFern: Drawing = {
  wash: [
    ['river', 'M4.2 4.6c2.6-.4 4.4.4 5 2.6 1 3.8 1.4 7.6.4 11.4-.6 2.4.6 4.6 1.8 7 1.4 3 .8 6.2-.2 9.4-.8 2.8.2 5.4.6 8l-7.4.2Z'],
    ['leaf', hartFronds.map((f) => f.edge).join('')],
  ],
  line: [
    // The gorge wall, broken into blocks.
    'M7.6 4.2c1.4 3.4 2.6 6.4 2.4 9.6-.2 2.6-1.6 4.2-1.2 6.6.4 2.8 2.6 4.2 2.8 7.2.2 3.2-1.4 5.4-1.4 8.4 0 2.8 1.2 5 1.4 7.8',
    ...hartFronds.map((f) => f.edge),
  ],
  detail: [
    ...hartFronds.map((f) => f.rib),
    sori(...HART[1]),
    'M4.2 12.6c1.8.2 3.2.8 4.6 1.8M4.4 27l5.6.4M4 36.4c1.6.4 3.2.4 4.8 0',
    'M30 36.6l.6.6M38.4 31.4l.4.8M35 14l.6-.6',
  ],
};

/** Star moss: a cushion of tiny green stars on a stone, a few spore stalks standing up. */
const STAR = (x: number, y: number, s = 1): string =>
  `M${r2(x - 1.2 * s)} ${r2(y)}h${r2(2.4 * s)}M${r2(x - 0.6 * s)} ${r2(y - 1.05 * s)}l${r2(1.2 * s)} ${r2(2.1 * s)}M${r2(x + 0.6 * s)} ${r2(y - 1.05 * s)}l${r2(-1.2 * s)} ${r2(2.1 * s)}`;
const starMoss: Drawing = {
  wash: [
    ['leaf', 'M10.4 31.2c-.4-4.2 5.6-7.6 13-7.8 7.2-.2 14 2.6 15.2 7.4-6.2 2-21 2.2-28.2.4Z'],
    ['river', 'M6.4 38.4c-1-4.4 1.4-8.6 6-10.8 5-2.4 12.4-3.2 18.6-1.6 5.6 1.4 10 4.6 10.8 9.2.6 3.4-1.4 5.6-5.6 6.4-8.2 1.4-17.6 1.4-24.6-.6-2.6-.8-4.6-1.6-5.2-2.6Z'],
  ],
  line: [
    // The stone under the cushion.
    'M6.4 38.4c-1-4.4 1.4-8.6 6-10.8M41.8 35.2c.6 3.4-1.4 5.6-5.6 6.4-8.2 1.4-17.6 1.4-24.6-.6-2.6-.8-4.6-1.6-5.2-2.6',
    // The domed cushion of moss.
    'M10.4 31c.2-2 1.6-3.2 3.2-2.8.4-2 2.2-3 4-2.4.8-1.8 3-2.4 4.6-1.4 1.2-1.6 3.6-1.6 4.8-.2 1.6-1 3.8-.4 4.4 1.4 1.8-.2 3.2 1 3.2 2.6 1.6.6 2.6 2 2.4 3.6',
    // Spore stalks, each with its capsule.
    'M22.2 24.6c.1-2.4.6-4.6 1.4-6.4M28.8 25c.8-2.2 1.6-3.8 2.8-5M17.4 25.8c-.4-2-1-3.6-2-4.8',
    'M23.6 18.2c.4-1 1.4-1.4 2.2-1M31.6 20c.6-.8 1.6-1 2.2-.6M15.4 21c-.4-.8-1.2-1.2-2-1',
  ],
  detail: [
    STAR(14.6, 28.6), STAR(19.8, 27), STAR(25.4, 26.4, 1.15), STAR(30.8, 27.6), STAR(35.2, 30.2), STAR(17.8, 31.2), STAR(27.8, 30.6, 1.1), STAR(12.2, 31.6, 0.9), STAR(22.6, 30.4, 0.9),
    'M12 37.4c4 1 9 1.2 14 .6M30.4 34.4c2 .4 4 1.4 5 2.6',
  ],
  dots: [[25.9, 16.9, 0.7], [33.9, 19.2, 0.65], [13.2, 19.9, 0.6]],
};

/** A shiitake cap on a short stem, its foot on the log at x, base y; r is half its width. */
function shiitakeCap(x: number, y: number, r: number): string {
  const top = y - r * 1.05;
  return (
    `M${r2(x - r)} ${r2(y - r * 0.2)}C${r2(x - r * 1.02)} ${r2(top)} ${r2(x + r * 1.02)} ${r2(top)} ${r2(x + r)} ${r2(y - r * 0.2)}` +
    `C${r2(x + r * 0.5)} ${r2(y + r * 0.08)} ${r2(x - r * 0.5)} ${r2(y + r * 0.08)} ${r2(x - r)} ${r2(y - r * 0.2)}Z` +
    `M${r2(x - r * 0.24)} ${r2(y - r * 0.04)}l-.1 ${r2(r * 0.42)}M${r2(x + r * 0.24)} ${r2(y - r * 0.04)}l.2 ${r2(r * 0.42)}`
  );
}
/** The white cracks and flecks across a shiitake cap. */
function capFlecks(x: number, y: number, r: number): string {
  const top = y - r * 0.8;
  return `M${r2(x - r * 0.5)} ${r2(top + r * 0.2)}l.6-.3M${r2(x + r * 0.1)} ${r2(top - r * 0.05)}l.7.1M${r2(x + r * 0.5)} ${r2(top + r * 0.3)}l.4-.5M${r2(x - r * 0.1)} ${r2(top + r * 0.45)}l.6.1`;
}
const CAPS: Array<[number, number, number]> = [
  [14.4, 27.8, 4],
  [22.4, 27.2, 4.9],
  [30.4, 27.4, 4.2],
  [37.2, 28, 3.2],
];
/** Shiitake on a fallen oak: a row of brown caps along the top of a log. */
const shiitake: Drawing = {
  wash: [
    ['leaf', 'M8.8 28.2c10-1.4 22-1 33.2.6l-.6 9.6c-10.8 1-22 .8-32.8-.6-2.4-1.6-2.6-7.4.2-9.6Z'],
    ['straw', CAPS.map(([x, y, r]) => shiitakeCap(x, y, r)).join('')],
  ],
  line: [
    // The log: two long edges, a sawn end and a broken end.
    'M8.4 27.8c10-1.4 22-1.2 34 .6',
    'M8 37.8c10.6 1 22 1.4 33.4.4',
    oval(8.2, 32.8, 2.8, 5),
    'M42.4 28.4c.8 1.4-.6 2.4.4 3.6s-.6 2.6.2 3.8-.8 1.4-1.6 2.4',
    ...CAPS.map(([x, y, r]) => shiitakeCap(x, y, r)),
  ],
  detail: [
    oval(8.2, 32.8, 1.4, 2.6), oval(8.2, 32.8, 0.5, 1),
    'M13 31.4c5-.6 10-.6 15 0M19 34.4c6 .2 12 0 18-.8M30.6 31.2c3 .2 6 .6 8.4 1.2M12.4 35.6c2 .4 4 .6 6 .4',
    ...CAPS.map(([x, y, r]) => capFlecks(x, y, r)),
    // Gills under the biggest cap.
    'M19.6 26.4l.4.4M21.6 26.6v.6M23.6 26.6l-.2.6M25.2 26.4l-.4.4',
  ],
};

/** Day lilies: an open orange trumpet seen face on, one from the side, a bud, and strap leaves. */
const LILY: Pt = [22.6, 15.2];
const lilyFace = [0, 60, 120, 180, 240, 300].map((a, i) => petal(LILY[0], LILY[1], 1.2, i % 2 ? 7.6 : 8.4, i % 2 ? 3 : 2.3, a + 10, 0.08));
const lilySide = [24, 52, 80].map((a, i) => petal(35.4, 29.4, 0, i === 1 ? 8.8 : 8, 2.4, a));
const lilyLeaves = [
  strap([24, 44], [14, 34], [6.4, 33.4], 1.3),
  strap([25.2, 44], [34, 33], [42.4, 37], 1.3),
  strap([24.4, 44], [21, 36], [13.6, 27.2], 1.1),
];
const dayLilies: Drawing = {
  wash: [
    ['straw', `${ring(LILY[0], LILY[1], 7.6)}${ring(38.6, 25.6, 4.6)}`],
    ['blossom', `${ring(LILY[0] + 0.6, LILY[1] + 0.4, 5.6)}${ring(38.4, 26, 3.4)}${oval(13.2, 19.4, 1.4, 3)}`],
  ],
  line: [
    ...lilyFace,
    ...lilySide,
    // The scape, branching to each flower and the bud.
    'M24.6 44c-.4-6-.4-12 .4-17.8.4-2.6.2-5-.6-7.2',
    'M25 29.4c3.4-.4 6.6.2 9.6 1.2',
    'M24.8 33.6c-3.6-2.8-7-6.4-10-10.4',
    'M13 22.6c-1.4-2.2-1.6-4.8-.6-6.6 1.4 1.2 2.2 3.2 2.2 5.6Z',
    ...lilyLeaves.map((l) => l.edge),
  ],
  detail: [
    // Stamens curving out of the throat, and the midvein of each tepal.
    'M22.8 15.6c1.4-1.6 2.6-3.6 3.2-5.6M22.4 15.8c.8-2 1.2-4 1-6M23 16.2c2-1 3.6-2.6 4.8-4.4',
    radial(LILY[0], LILY[1], 2.2, 5.6, 6, 10),
    'M35.6 29.2l4.6-5.6M35.4 29.6l1.6-6.8',
    ...lilyLeaves.map((l) => l.rib),
  ],
  dots: [[26, 9.8, 0.55], [23.4, 9.8, 0.5], [27.8, 11.8, 0.5]],
};

/** Usuyukiso: a star of felted grey-white bracts round a knot of tiny flower heads. */
const EDEL: Pt = [22, 16.8];
const EDEL_BRACTS: Array<[number, number]> = [[6, 8.6], [44, 7.6], [86, 9], [124, 7.4], [164, 8.8], [204, 7.8], [244, 9.2], [284, 7.6], [322, 8.2]];
const EDEL_SMALL: Pt = [35, 28];
const edelBracts = EDEL_BRACTS.map(([a, len]) => petal(EDEL[0], EDEL[1], 2.2, len, 2.3, a, 0.35));
const edelSmall = [0, 52, 104, 156, 208, 260, 312].map((a) => petal(EDEL_SMALL[0], EDEL_SMALL[1], 1.4, 4.6, 1.5, a + 20, 0.35));
const usuyukiso: Drawing = {
  wash: [
    ['river', `${ring(EDEL[0], EDEL[1], 8)}${ring(EDEL_SMALL[0], EDEL_SMALL[1], 4.2)}`],
    ['straw', `${ring(EDEL[0], EDEL[1], 2.8)}${ring(EDEL_SMALL[0], EDEL_SMALL[1], 1.6)}`],
  ],
  line: [
    ...edelBracts,
    ...edelSmall,
    // The knot of flower heads in the middle.
    ring(EDEL[0] - 1, EDEL[1] - 0.6, 1), ring(EDEL[0] + 1.1, EDEL[1] - 0.4, 1), ring(EDEL[0], EDEL[1] + 1.1, 1),
    // Woolly stems and narrow leaves.
    'M22.4 26.2c.4 5.8.2 11.6-.6 17.4',
    'M22.2 37c3.6-2.4 7.6-4.6 11.6-6.8',
    willowLeaf(22.4, 32.6, -7, -3.4),
    willowLeaf(22, 40, 6.6, -3),
    willowLeaf(21.8, 42.4, -6.8, -1.4),
  ],
  detail: [
    // Felt: short soft strokes along each bract.
    ...EDEL_BRACTS.map(([a, len]) => {
      const [x0, y0] = polar(EDEL[0], EDEL[1], 3.6, a);
      const [x1, y1] = polar(EDEL[0], EDEL[1], len - 1.6, a);
      return `M${r2(x0)} ${r2(y0)}L${r2(x1)} ${r2(y1)}`;
    }),
    ring(EDEL_SMALL[0], EDEL_SMALL[1], 0.9),
    'M8.4 12l-.6-.4M37.6 14.2l.6-.2M15 30l-.6.4M30.6 21.4l.4-.6M28.4 36l.6.2',
  ],
  dots: [[EDEL[0] - 1, EDEL[1] - 0.6, 0.35], [EDEL[0] + 1.1, EDEL[1] - 0.4, 0.35], [EDEL[0], EDEL[1] + 1.1, 0.35]],
};

/** A broad, shallowly lobed and toothed vine leaf centred on cx, cy, its tip pointing at `deg`. */
function vineLeaf(cx: number, cy: number, r: number, deg: number): { edge: string; base: Pt; veins: string } {
  const pts: Pt[] = [];
  for (let a = -156, k = 0; a <= 156; a += 6, k++) {
    const lobe = 0.8 + 0.2 * Math.cos((a * Math.PI) / 180 * 2.9);
    const tooth = k % 2 ? 0.06 : 0;
    pts.push(polar(cx, cy, r * (lobe + tooth), deg + a));
  }
  const base = polar(cx, cy, r * 0.22, deg + 180);
  const edge = `M${pt(base)}${pts.map((p) => `L${pt(p)}`).join('')}Z`;
  const veins = [0, 62, -62, 124, -124].map((a) => {
    const end = polar(cx, cy, r * 0.72, deg + a);
    return `M${pt(base)}Q${pt(polar(cx, cy, r * 0.2, deg + a * 0.6))} ${pt(end)}`;
  });
  return { edge, base, veins: veins.join('') };
}
const VINE_LEAF = vineLeaf(32.4, 25.6, 9.6, 160);
/** The grapes of the bunch, row by row, tapering to a point. */
const GRAPES: Pt[] = [
  [11.4, 18.6], [15, 18.2], [18.6, 18.8], [22, 19.6],
  [13, 21.8], [16.6, 21.6], [20.2, 22.4],
  [14.4, 25], [18, 25.2], [21, 26],
  [16, 28.4], [19.4, 28.8],
  [17.6, 32],
];
const wildGrapes: Drawing = {
  wash: [
    ['river', 'M9.8 18c3.6-2 9.6-2.4 13.6.2 1.4 3.4-.4 7.2-2 10.4-1.2 2.4-2.6 4.8-4 5.4-1.8-2-4.6-6.6-6.6-10.6-1-2-1.4-3.6-1-5.4Z'],
    ['leaf', VINE_LEAF.edge],
  ],
  line: [
    // The old vine, a tendril coiling off it.
    'M4.6 11.4c5.6-1.6 12-2.2 18.4-1.6 6 .6 11.6.4 17.8-1.6',
    'M8 11c-.6 2.6.2 4.8 2 5.6 1.4.6 2.6-.4 2.2-1.6-.4-1.2-1.8-1.2-2.2-.2',
    // The stalk of the bunch, and the leaf's stalk.
    'M17.4 10.2c-.6 2.4-.8 4.8-.4 7.4M16.8 13.4c-2 .8-3.6 2.2-4.6 4',
    `M30.6 9.6Q${r2(VINE_LEAF.base[0] - 2)} ${r2(VINE_LEAF.base[1] - 4)} ${pt(VINE_LEAF.base)}`,
    ...GRAPES.map(([x, y]) => ring(x, y, 1.8)),
    VINE_LEAF.edge,
  ],
  detail: [
    VINE_LEAF.veins,
    ...GRAPES.slice(0, 10).map(([x, y]) => `M${r2(x - 1)} ${r2(y - 0.4)}c.2-.5.5-.8 1-.9`),
    'M37.6 8.2c1.4-.8 2.6-2.2 3-3.8',
  ],
};

// ---------------------------------------------------------------------------
// The middle river: orchards, bank and wood
// ---------------------------------------------------------------------------

/** Orchard blossom: a cherry twig with three open flowers and a bud. */
const orchardBlossom: Drawing = {
  wash: [['blossom', `${ring(27.4, 16.6, 6.4)}${ring(36, 27, 5.6)}${ring(13.6, 30.6, 5.6)}`]],
  line: [
    'M4.8 38.6c6-2.4 12-6 17.6-11.2 4.4-4 9-7.2 15-9.4',
    'M22.6 27c.4-2.4 1.6-4.6 3.2-6.2',
    'M30.6 20.6c2 1 3.6 2.6 4.4 4.4',
    bloom(27.4, 16.4, 5.4, 8),
    bloom(36, 27, 4.6, -10),
    bloom(13.6, 30.6, 4.6, 20),
    'M37.8 18.2c.8-1.8 2.2-3 4-3.2-.2 1.8-1.6 3.2-4 3.2Z',
  ],
  detail: [radial(27.4, 16.4, 0.8, 2.6, 6, 15), radial(36, 27, 0.7, 2.2, 5, 0), radial(13.6, 30.6, 0.7, 2.2, 5, 30)],
  dots: [[27.4, 16.4, 0.7], [36, 27, 0.6], [13.6, 30.6, 0.6]],
};

/** The late apples: two left on the high twig, and a leaf. */
const lateApples: Drawing = {
  wash: [
    ['blossom', `${apple(15.6, 23)}${apple(33.4, 25.6, 0.9)}`],
    ['leaf', 'M22.6 13.2c2.8-3.4 6.8-4.6 10.6-3.6-2.4 3.2-6.2 4.6-10.6 3.6Z'],
  ],
  line: [
    'M5.4 13.4c10-2 22-2.6 37-1.2',
    apple(15.6, 23),
    apple(33.4, 25.6, 0.9),
    'M15.6 22.8c0-3 .6-6 1.6-8.8',
    'M33.4 25.4c-.2-3.8.2-7.8 1-11.8',
    'M22.6 13.2c2.8-3.4 6.8-4.6 10.6-3.6-2.4 3.2-6.2 4.6-10.6 3.6Z',
  ],
  detail: ['M10.6 28.6c.2-1.6 1-2.8 2.2-3.4', 'M29.4 30.4c.2-1.4.8-2.4 1.8-3', 'M22.6 13.2l8.8-2.8', 'M14.6 37.8c.4.6 1.2.8 1.8.4M32.8 38.8c.4.4 1 .6 1.4.2'],
};

/** Willow cutting: a slender shoot, its foot bound in damp moss and twine. */
const willowCutting: Drawing = {
  wash: [
    ['leaf', 'M15.6 27.4c3.6-7.4 10.4-15.6 20-21 2.2 2-1 7.2-5.4 12-4.6 5-10 9-13 10.6-1.6.4-2-.4-1.6-1.6Z'],
    ['straw', 'M9 36.6c1.6-2.6 6-3.4 9.4-1.8 2.4 1.2 3 4 1.6 6.2-1.6 2.4-6 3-9 1.6-2.6-1.2-3.2-3.8-2-6Z'],
  ],
  line: [
    'M14.2 37.6C18 29.4 24 19.2 33.6 7.8',
    willowLeaf(20.4, 27, -7.6, -6.2),
    willowLeaf(23.6, 22.4, 8.6, 3.2),
    willowLeaf(27.2, 17.6, -3.6, -9),
    willowLeaf(30.4, 13.4, 9.2, -0.6),
    willowLeaf(33.6, 7.8, 4.6, -2.6),
    'M9 36.6c1.6-2.6 6-3.4 9.4-1.8 2.4 1.2 3 4 1.6 6.2-1.6 2.4-6 3-9 1.6-2.6-1.2-3.2-3.8-2-6Z',
    'M19.8 38.4l3.2 1.2M19.6 39.4l2.4 2.6',
  ],
  detail: ['M10.6 35.6c2 2.4 2.2 5.4 1 8M15.6 34.4c1.8 2.6 2 5.6.8 8.6', 'M10 39.4l1 .4M13.6 41.2l.8.6M17.2 37l.6.8'],
};

/** One valve of an opened chestnut burr, pointing out from cx, cy at `deg`. */
function burrValve(cx: number, cy: number, deg: number): { edge: string; spines: string } {
  const at = (u: number, v: number): Pt => {
    const a = (deg * Math.PI) / 180;
    return [cx + u * Math.sin(a) + v * Math.cos(a), cy - u * Math.cos(a) + v * Math.sin(a)];
  };
  const outline: Pt[] = [at(5.6, -3.4), at(8.6, -5.8), at(12.4, -4.4), at(14.6, 0), at(12.4, 4.4), at(8.6, 5.8), at(5.6, 3.4)];
  const edge = `${smooth(outline)}Q${pt(at(7, 0))} ${pt(outline[0])}`;
  // Spines bristle off the outer edge, each pointing away from the burr's heart.
  let spines = '';
  for (const [u, v] of [[7, -5.2], [9.8, -5.6], [12.2, -4.2], [13.8, -2.2], [14.6, 0], [13.8, 2.2], [12.2, 4.2], [9.8, 5.6], [7, 5.2]] as Pt[]) {
    const len = Math.hypot(u, v);
    spines += `M${pt(at(u, v))}L${pt(at(u + (u / len) * 2, v + (v / len) * 2))}`;
  }
  return { edge, spines };
}
/** A chestnut, its point at the top and its pale scar across the flat base. */
const NUT = 'c1.6 1 3 2.6 3.2 4.6.1 1.2-.4 2-1.2 2.2-1.4.3-2.8.3-4.2 0-.8-.2-1.3-1-1.2-2.2.2-2 1.8-3.6 3.4-4.6Z';
const NUT_SCAR = 'c1.2.4 2.8.4 4 0';
const VALVES = [45, 135, 225, 315].map((a) => burrValve(22, 21.4, a));
const NUTS: Array<[number, number, number]> = [[18.8, 16.6, 1], [25, 16.8, 1], [21.8, 21.6, 1.05], [35.6, 33.4, 1.4]];
const chestnuts: Drawing = {
  wash: [
    ['leaf', VALVES.map((v) => v.edge).join('')],
    ['straw', NUTS.map(([x, y, s]) => place(x, y, NUT, s)).join('')],
  ],
  line: [
    ...VALVES.map((v) => v.edge),
    ...VALVES.map((v) => v.spines),
    ...NUTS.map(([x, y, s]) => place(x, y, NUT, s)),
  ],
  detail: [
    ...NUTS.map(([x, y, s]) => place(x - 2 * s, y + 5.3 * s, NUT_SCAR, s)),
    ...NUTS.map(([x, y, s]) => place(x, y, 'c-.2-.6-.1-1.1.3-1.4', s)),
    'M30 41c4-.8 9-.8 13.6 0M6.6 41c3-.6 6-.6 9 0',
  ],
};

// ---------------------------------------------------------------------------
// The lower river and the sea
// ---------------------------------------------------------------------------

/** A pair of pine needles lying at x, y, splayed. */
const needles = (x: number, y: number, deg: number, len = 6): string => {
  const a = polar(x, y, len, deg);
  const b = polar(x, y, len * 0.92, deg + 14);
  return `M${r2(x)} ${r2(y)}L${pt(a)}M${r2(x)} ${r2(y)}L${pt(b)}`;
};
/** Pine mushrooms: a stout capped matsutake half under the needles, and a button beside it. */
const matsutake: Drawing = {
  wash: [
    ['straw', 'M13.4 22.6c0-6 4.4-9.6 9.6-9.6s9.8 3.6 9.8 9.6c-1.8 1-3.8 1.6-5.8 1.8l.6 10.6H18.4l.6-10.6c-2.2-.2-4-.8-5.6-1.8Z'],
    ['leaf', 'M4.4 38.4c5-3.8 11-5.4 18.6-5.2 8 .2 15 2 20.4 5.4-1 2.4-4 3.6-8 4-9 .8-18 .8-26.4-.4-3.4-.6-5-1.8-4.6-3.8Z'],
  ],
  line: [
    // The cap: domed, its rim still rolled under.
    'M13.4 22.6c0-6 4.4-9.6 9.6-9.6s9.8 3.6 9.8 9.6c-2.8 1.6-6.4 2.2-9.8 2.2s-6.8-.6-9.6-2.2Z',
    // The stout stem, going down into the litter.
    'M18.6 24.4c-.4 3-.6 6.2-.4 9.4M27.6 24.6c.4 3 .6 6.2.4 9.2',
    // The mound of needles.
    'M4.4 38.4c5-3.8 11-5.4 18.6-5.2 8 .2 15 2 20.4 5.4',
    // A button just pushing through.
    'M32 34.2c0-2.4 1.4-4 3.4-4s3.4 1.6 3.4 4',
    needles(14.4, 34.6, 70), needles(23.4, 36.2, -64, 7), needles(26.4, 33.6, 84, 6.4), needles(31.6, 36, 60, 5.4), needles(8.6, 38, 64, 5),
  ],
  detail: [
    // Fibrous brown scales on the cap and stem.
    'M17.2 17.6l1.4-.6M21.4 15.4l1.6-.2M26 16.4l1.4.6M19 20.4l1.2-.4M24.2 19.4l1.4.2M28.6 20.6l1-.2',
    'M20 27.4l.8.6M25.6 28.4l.6-.6M20.4 31.2l.6.4M25.8 31.6l.4-.4',
    needles(17.4, 38.6, 96, 5), needles(34.6, 39, -70, 5), needles(6.4, 40.4, 84, 4.4), needles(38.8, 37.4, -96, 4),
    'M10 41.6c8 .8 18 .8 28 0',
  ],
};

/** Salt flower: a sea aster on the tide line, small rayed flowers over fleshy leaves. */
const saltFlower: Drawing = {
  wash: [
    ['blossom', `${ring(25.2, 15.4, 4.6)}${ring(18.6, 22, 4)}${ring(31.6, 20.6, 4)}`],
    ['river', 'M5.6 42.2c12.4-1.2 24.6-1.2 37 0l-.4 3.4c-12 .8-24 .8-36.2 0Z'],
  ],
  line: [
    'M24 42.2c-.6-7-.2-14 1-20.6',
    'M24.2 33.6c-2.6-2.4-4.4-5.8-5-9.6',
    'M24.8 30.2c2.6-1.6 4.8-4 5.8-7.4',
    ring(25.2, 15.4, 1.5),
    ring(18.6, 22, 1.3),
    ring(31.6, 20.6, 1.3),
    'M23.8 38.6c-2.6-1-4.4-2.8-5.2-5.4 2.6.6 4.4 2.4 5.2 5.4Z',
    'M24.4 36.4c2.4-1.4 4.8-1.6 7-.8-2 1.6-4.4 1.8-7 .8Z',
    'M6 42.4c6-1.2 12-1.2 18 0s12 1.2 18 0',
  ],
  detail: [radial(25.2, 15.4, 2.2, 4.6, 11, 8), radial(18.6, 22, 1.9, 3.9, 10, 0), radial(31.6, 20.6, 1.9, 3.9, 10, 12), 'M8 45c3-.6 6-.6 9 0M30 45c3-.6 6-.6 9 0'],
  dots: [[25.2, 15.4, 0.6], [18.6, 22, 0.5], [31.6, 20.6, 0.5]],
};

/** A point on a cubic curve, with its unit normal. */
function onCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): { p: Pt; n: Pt } {
  const u = 1 - t;
  const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  const p: Pt = [b[0] * p0[0] + b[1] * p1[0] + b[2] * p2[0] + b[3] * p3[0], b[0] * p0[1] + b[1] * p1[1] + b[2] * p2[1] + b[3] * p3[1]];
  const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
  const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
  const l = Math.hypot(dx, dy) || 1;
  return { p, n: [-dy / l, dx / l] };
}
/** A kelp ribbon along a cubic curve: a narrow stipe widening to a band with rippled edges and a torn end. */
function ribbon(p0: Pt, p1: Pt, p2: Pt, p3: Pt, w: number, phase = 0): { edge: string; mid: string } {
  const left: Pt[] = [];
  const right: Pt[] = [];
  const mid: Pt[] = [];
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const { p, n } = onCubic(p0, p1, p2, p3, t);
    const h = w * Math.min(1, 0.25 + t * 4);
    const ripple = t > 0.15 ? 0.45 * Math.sin(t * 34 + phase) : 0;
    left.push([p[0] + n[0] * (h + ripple), p[1] + n[1] * (h + ripple)]);
    right.push([p[0] - n[0] * (h - ripple), p[1] - n[1] * (h - ripple)]);
    if (t > 0.12 && t < 0.94) mid.push(p);
  }
  // The torn end: a ragged edge straight across.
  const end = onCubic(p0, p1, p2, p3, 1);
  const tear: Pt[] = [0.5, 0, -0.5].map((k, i) => [end.p[0] + end.n[0] * w * k + (i === 1 ? 0.8 : 0), end.p[1] + end.n[1] * w * k]);
  const edge = `${smooth(left)}${tear.map((q) => `L${pt(q)}`).join('')}L${pt(right[steps])}${smooth(right.reverse()).replace(/^M[^C]*/, '')}`;
  return { edge, mid: smooth(mid) };
}
const KELP = [
  ribbon([12.8, 33.2], [18, 22], [30, 30], [42, 13.6], 2.4, 0),
  ribbon([13.4, 33.6], [22, 30], [30, 42], [42.6, 31.4], 2.2, 1.6),
];
/** Kelp: long brown ribbons torn up by the weather, still holding the stone they grew on. */
const kelp: Drawing = {
  wash: [
    ['straw', KELP.map((k) => k.edge).join('')],
    ['river', 'M4 41.4c6.6-1 13-1.2 19.4-.6 6.6.6 13.4.6 20.4-.4l.2 3.4c-13.4 1.2-26.8 1.2-40.2 0Z'],
  ],
  line: [
    ...KELP.map((k) => k.edge),
    // The stone, gripped by the root-like holdfast.
    oval(9.2, 37.8, 4.8, 3),
    'M12.6 34c-1.2.4-2.6.4-3.6 1.4M12.6 34.2c-.4 1.4-1.4 2.6-2.8 3.4M12.8 34.4c.8 1.4 1.4 2.8 1.2 4.4M12.4 33.8c-2.2-.6-4.2-.2-5.8 1',
    // The tide line on the sand.
    'M4 41.4c6.6-1 13-1.2 19.4-.6 6.6.6 13.4.6 20.4-.4',
  ],
  detail: [
    ...KELP.map((k) => k.mid),
    'M8.2 35.4l-1 .8M10.8 36.6l-.2 1.2M13.4 38.6l.8-.2',
    'M8 44c4-.4 8-.4 12 0M28 43.8c4-.4 8-.4 12 0',
  ],
};

export const PLANTS: Record<string, Drawing> = {
  'wild-mint': {
    wash: [['leaf', 'M24 42L22 12Q9 9 8 18Q12 26 23 24Q35 28 40 18Q34 9 23 17M24 32Q11 23 10 32Q14 41 24 37Q36 39 39 30Q31 25 24 32Z']],
    line: ['M24 44L22 9', 'M22 20Q8 23 8 15Q17 8 22 20Q28 9 38 14Q39 23 22 20', 'M23 33Q10 37 9 29Q18 23 23 33Q31 22 40 29Q38 39 23 33'],
    detail: ['M22 20l-9-5m9 5 10-5M23 33l-9-3m9 3 11-4'],
  },
  'cress-bed': {
    wash: [['leaf', 'M12 35C4 32 6 25 14 27C5 19 12 14 20 20C16 9 24 7 27 17C34 8 40 14 34 23C44 19 45 28 35 30C44 33 39 40 31 36Z']],
    line: ['M22 42L25 17', 'M24 27C8 10 5 24 18 27', 'M24 32C4 21 6 36 20 34', 'M25 23C32 6 41 16 30 23', 'M25 30C45 15 46 31 31 32', 'M22 42l-4 3m4-3 2 4m-2-4 6 2'],
    detail: ['M5 41c5-2 10-2 15 0m10 0c5-2 10-2 14 0'],
  },
  'hart-fern': hartFern,
  'star-moss': starMoss,
  shiitake,
  'day-lilies': dayLilies,
  usuyukiso,
  'wild-grapes': wildGrapes,
  'orchard-blossom': orchardBlossom,
  'late-apples': lateApples,
  'willow-cutting': willowCutting,
  chestnuts,
  matsutake,
  'salt-flower': saltFlower,
  kelp,
};

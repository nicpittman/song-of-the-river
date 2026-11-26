/**
 * Finds that are animals: the wildlife of the three reaches and the fish of
 * the river. Each is drawn as the creature itself, in the pose and the place
 * its journal entry catches it in, so the three deer, the four fish and the
 * three winged things never look alike.
 */

import { bloom, mirror, place } from './finds-pen';
import { oval, ring, type Drawing } from './pen';

const num = (v: number): string => (Math.round(v * 100) / 100).toString();

type Pt = [number, number];

/**
 * Rotates an absolute path (upper-case M, L, C, Q and Z only, every number
 * part of an x y pair) by `deg` about cx, cy, then shifts it by dx, dy. Lets a
 * fish be drawn level and then tipped into a leap or a rise.
 */
function turn(d: string, deg: number, cx: number, cy: number, dx = 0, dy = 0): string {
  const a = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const nums = d.match(/-?\d*\.?\d+/g) ?? [];
  const cmds = d.match(/[MLCQZ]/g);
  if (!cmds || (d.match(/[a-zA-Z]/g) ?? []).length !== cmds.length) throw new Error(`turn() needs absolute M/L/C/Q/Z: ${d}`);
  let i = 0;
  return d.replace(/-?\d*\.?\d+\s*,?\s*-?\d*\.?\d+/g, () => {
    const x = Number(nums[i++]) - cx;
    const y = Number(nums[i++]) - cy;
    return ` ${num(cx + dx + x * c - y * s)} ${num(cy + dy + x * s + y * c)}`;
  });
}

/** A single point rotated as `turn` would rotate it (for eyes and spots). */
function turnPt(x: number, y: number, deg: number, cx: number, cy: number, dx = 0, dy = 0): Pt {
  const a = (deg * Math.PI) / 180;
  const [px, py] = [x - cx, y - cy];
  return [cx + dx + px * Math.cos(a) - py * Math.sin(a), cy + dy + px * Math.sin(a) + py * Math.cos(a)];
}

/** Samples a smooth Catmull-Rom curve through the points, `n` steps per span. */
function spline(pts: Pt[], n = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

interface Tube {
  /** Closed outline: a rounded head at the first point, tapering to the last. */
  outline: string;
  /** The centre line from `from` to `to` (0 = head, 1 = tail). */
  spine: (from: number, to: number) => string;
  /** The point at fraction t along the body, offset sideways by `side` (positive = left of travel). */
  at: (t: number, side?: number) => Pt;
}

/**
 * A long soft body (eel, newt) drawn round a smooth centre line. `widths` are
 * the half-widths at each control point; the head end gets a round cap.
 */
function tube(pts: Pt[], widths: number[]): Tube {
  const n = 10;
  const c = spline(pts, n);
  const w = c.map((_, k) => {
    const i = Math.min(pts.length - 2, Math.floor(k / n));
    const u = k / n - i;
    return widths[i]! * (1 - u) + widths[i + 1]! * u;
  });
  const norm = c.map((_p, k) => {
    const a = c[Math.max(0, k - 1)]!;
    const b = c[Math.min(c.length - 1, k + 1)]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[1] - a[1]) / len, -(b[0] - a[0]) / len] as Pt;
  });
  const side = (k: number, s: number): Pt => [c[k]![0] + norm[k]![0] * w[k]! * s, c[k]![1] + norm[k]![1] * w[k]! * s];
  const left = c.map((_, k) => side(k, 1));
  const right = c.map((_, k) => side(k, -1)).reverse();
  // Round cap at the head: from the right edge, round the front, to the left edge.
  const [nx, ny] = norm[0]!;
  const fx = ny;
  const fy = -nx;
  const cap: Pt[] = [];
  for (let k = 1; k < 8; k++) {
    const th = Math.PI - (k * Math.PI) / 8;
    cap.push([c[0]![0] + w[0]! * (nx * Math.cos(th) + fx * Math.sin(th)), c[0]![1] + w[0]! * (ny * Math.cos(th) + fy * Math.sin(th))]);
  }
  const poly = (ps: Pt[]): string => ps.map(([x, y]) => `${num(x)} ${num(y)}`).join('L');
  const outline = `M${poly([...left, ...right, ...cap])}Z`;
  const idx = (t: number): number => Math.round(t * (c.length - 1));
  return {
    outline,
    spine: (from, to) => `M${poly(c.slice(idx(from), idx(to) + 1))}`,
    at: (t, s = 0) => {
      const k = idx(t);
      return [c[k]![0] + norm[k]![0] * s, c[k]![1] + norm[k]![1] * s];
    },
  };
}

/* ------------------------------------------------------------------ */
/* Wildlife                                                            */
/* ------------------------------------------------------------------ */

/** The open palm the newt sits on: thumb at the left, four fingers up. */
const PALM =
  'M15.4 46c.2-3-.6-5.6-2.6-8-1.8-2.4-4.2-4.6-6.2-7.4-.9-1.3.2-2.6 1.6-1.9 2.4 1.2 4.2 3 5.8 4.6' +
  'c-.6-3.4-.8-7-.6-10.6.1-4.4.1-8.4.4-11.6.2-1.6 2.8-1.6 3 0 .3 3.2.3 7 .2 10.8' +
  'c.2-4.8.2-9.6.6-13.6.2-1.6 2.8-1.6 3 0 .4 4.2.4 9 .4 13.6' +
  'c.2-4.2.2-8.4.6-12 .2-1.6 2.8-1.6 3 0 .4 3.6.4 7.8.2 12' +
  'c.4-3.2.6-6.2 1-8.8.3-1.4 2.6-1.2 2.6.2 0 3.2-.2 6.4-.8 9.8' +
  'c.6 4.6.4 9-.6 12.8-.8 3-1.4 5.6-1.6 8.2';

/** The newt, belly up on the palm: a soft curve from snout to the tip of the tail. */
const NEWT = tube(
  [[25.4, 18.6], [24.2, 23.4], [22.2, 28.6], [21.6, 33.8], [24.2, 38.2], [29, 39.4], [32.4, 37.2]],
  [1.9, 1.5, 2.4, 2.1, 1.4, 0.8, 0.15],
);

/** Red-bellied newt: turned over on an open palm to show the fire-red, black-blotched belly. */
const newt: Drawing = {
  wash: [
    ['straw', 'M15.4 45.6c-1-4.6-4-7.6-7.6-12.4 3 1 5 2.4 6.4 2.8l-.2-12 2.6-12.4 3.4 2.6 3.6-3.4 3.2 3.6 3.4 1.2.8 11.2c.4 7.2-.6 12.6-2 18.8Z'],
    ['blossom', NEWT.outline],
  ],
  line: [
    PALM,
    NEWT.outline,
    // Fore and hind legs splayed out from the turned body, little toes spread.
    'M23.8 23.6c-1.6-.4-3-.2-4 .8M19.8 24.4l-1-.8M19.8 24.4l-.6 1.2',
    'M25.6 24.2c1.6.2 2.8 1 3.4 2.2M29 26.4l1.2-.4M29 26.4l.2 1.2',
    'M21 31.4c-1.6.4-2.6 1.4-3 2.8M18 34.2l-1.2-.2M18 34.2l.4 1.2',
    'M24.2 32.2c1.6.4 2.8 1.4 3.4 2.6M27.6 34.8l1.2-.2M27.6 34.8l-.2 1.2',
  ],
  detail: [
    // Palm creases and the crease of the wrist.
    'M14.6 34.6c3.6-1.2 7.6-1.6 11.4-1.4M17.4 40.8c3.6-.4 7.2-.2 10.8.6',
    // Jaw line on the underside of the head.
    'M24 19.4c.8.8 1.8.9 2.8.2',
  ],
  dots: [
    // Black blotches on the red belly.
    [23.6, 26.6, 0.6], [22.4, 28.8, 0.7], [23.4, 30.6, 0.45], [21.8, 32.4, 0.55], [22.8, 34.8, 0.6], [24.6, 36.8, 0.45], [26.8, 38.4, 0.4],
  ],
};

/** A sika hind crossing the shallows at Takaishi, stepping stone to stone, one foreleg raised. */
const deerCrossing: Drawing = {
  wash: [
    ['straw', 'M14.2 11.8c-1-1.6-2.4-2.8-4-2.4-1.6.4-3 1.8-4 3.2-.4 1.2 1.6 1.2 3.6 1.2 2.2 2 3.4 6 5 9.4l1.4 2.8c4 1.4 9.6 1.6 14.6.6l1.8-.8c1.6-2 2-4.2 1.4-6.4-1-1.6-3-2.4-5.6-2.6-4.4-.4-9.2 0-12.8 1.6-.4-2.4-.8-4.8-1.4-6.6Z'],
    ['river', 'M3.6 36.8c6-1.4 13-1.6 20-1.2 7 .4 13.4 0 20.4-.8l.2 5.4c-7 1.6-14.6 2.2-21.4 1.8-6.6-.4-13-.6-19.4.4Z'],
  ],
  line: [
    // Head, ears up, muzzle down and forward.
    'M14.2 11.8c-.4-1.4-1.2-2.4-2.6-2.6-1.6-.2-3 .8-4.4 2.4-.8 1-1.2 1.6-1 2.2.2.6 1.4.6 2.6.4 1-.2 2-.2 2.8.4',
    'M13 9.4c.4-1.8 1.6-3 3.4-3.4-.2 1.8-1.2 3-2.6 3.8M12 9.2c-.4-1.6 0-3 1-4.2',
    // Neck, back and rump.
    'M14.2 11.8c.8 2.4 1.4 5 2.2 7.6 3.6-1.6 8.4-2 12.8-1.6 2.6.2 4.6 1 5.6 2.6.8 2.4.4 4.8-1 6.4',
    'M11.6 14.4c.6 1.2 1 2.6 1.4 4 .8 2.6 1.8 4.6 3.4 6',
    'M30.6 26.6c-3.6.8-7.6.8-11.2-.2',
    // Legs: the near foreleg planted on a stone, the other lifted mid-step; hind legs on the far stone.
    'M20.6 26.4l-.2 5 .4 5.4',
    'M17 25.2c-1.2 1.6-2 3.2-2.4 4.8l1.6 2.4',
    'M31.2 26.8l-.6 4.8.8 4.8M34 26.4l.6 5.2-.4 4.6',
    // Stepping stones breaking the surface, and the water line between them.
    oval(19.8, 37.4, 3.6, 1.4),
    oval(32.8, 37.2, 3.4, 1.3),
    oval(8.4, 39.4, 3, 1.1),
    'M3.8 36.6c1.4-.4 2.6-.4 3.8 0M24.2 37.2c1.6-.4 3.2-.4 4.8 0M37.2 36.8c2-.5 4-.5 6.4 0',
  ],
  detail: [
    // White rump, a stripe of summer spots along the flank, the tail flicked.
    'M35 20.6c.6-.2 1.2 0 1.6.6',
    'M20.4 21.4c3.2-.8 6.6-1 9.8-.4',
    'M7 42.4c3-.6 6-.6 9 0M24 41.2c2.6-.5 5.2-.5 7.8 0M36.6 41.6c2-.4 4-.4 6 0',
    // Rings where the hooves touch.
    'M15.6 39c2.6.8 5.6.8 8.4 0M29.2 38.8c2.4.7 5 .7 7.4 0',
  ],
  dots: [[10.6, 10.8, 0.6], [6.8, 12.6, 0.4], [22.6, 22.8, 0.3], [25.4, 22.4, 0.3], [28.2, 22.6, 0.3], [24, 24.4, 0.3], [27, 24.4, 0.3]],
};

/** Short black horn of the serow, rising from the brow; mirrored for the other side. */
const SEROW_HORN = 'c-.4-1.6-.4-3.2.2-4.6.4 1.4.8 3 1.2 4.4Z';

/** A serow on the crag: shaggy and stocky, short black horns, staring out at us. Rare. */
const serow: Drawing = {
  wash: [
    ['river', 'M10 10.4c1.6-1 4.4-1 6 0 2.4-.4 4.8 0 7 1.2 4 .4 8.4.6 12 1.8 2.4.8 3.6 3 3.6 5.6.2 2.6-.6 4.6-2 6l-1.6 2.6c-4 .8-8.4.8-12.2-.2l-2.2-1.8c-1.6-1.4-3.4-3.2-4.8-5.6-.8.6-1.6.4-2.2-.6-1.2-2.6-1.6-5.6-1.2-8.4Z'],
    ['straw', 'M4.4 44.6c.8-4.4 1.8-8.8 3.6-12.8 6-1 12-.8 18-.4 6.2.4 12.2.2 18-.8.6 4.4.4 9.2-.6 14Z'],
  ],
  line: [
    // The face, looking straight out: broad brow narrowing to the muzzle.
    'M10 10.4c1.6-1 4.4-1 6 0 .4 2.8 0 5.8-1.2 8.4-.4.8-1.2 1.2-1.8 1.2s-1.4-.4-1.8-1.2c-1.2-2.6-1.6-5.6-1.2-8.4Z',
    // Ears held out to the sides.
    'M10.2 11.2c-1.6-.6-3-.4-4.2.4 1 .9 2.6 1.2 4 .8M15.8 11.2c1.6-.6 3-.4 4.2.4-1 .9-2.6 1.2-4 .8',
    // Short black horns.
    place(11.2, 10.2, SEROW_HORN),
    place(14.8, 10.2, mirror(SEROW_HORN)),
    // Thick maned neck, the long back, the haunch.
    'M16 12c2.4-.4 4.8 0 7 1.2 4 .4 8.4.6 12 1.8 2.4.8 3.6 3 3.6 5.6.2 2.6-.6 4.6-2 6',
    // Shaggy throat ruff and the fringed belly.
    'M14.2 19.6c.6 1.6 1.4 2.8 2.4 3.6l-.2 1 1.2-.2.2 1.2 1.2-.4c.8.8 1.6 1.4 2.6 1.8',
    'M35.4 27.4l-1 .8-.8-.6-1 .8-.8-.6-1.2.6-.8-.6-1 .6-.8-.6-1.2.6-.8-.6-1 .6',
    // Short stout legs planted on the ledge.
    'M21.6 27l-.2 4.2M24 27.6l.2 3.8M33.6 27.6l.2 3.8M36.4 26.8l.6 4.2',
    // The crag: its ledge and the fall of the rock below.
    'M7.4 31.6c6-.8 12-.6 18-.2 6.2.4 12.2.2 18-.8',
    'M7.4 31.6c-1.4 4-2.4 8.4-3 13M43.4 30.6c.6 4.6.4 9.4-.6 14',
  ],
  detail: [
    // Long guard hairs on the neck and flank.
    'M19.4 14.4l.6 2.2M22.4 14.6l.4 2.4M26 15l.2 2.2M29.4 15.6l.2 2M33 16.6l-.2 2',
    'M20.6 20.6c2.4 1.6 5.4 2.4 8.6 2.2',
    // Pale chin and the dark gland below each eye.
    'M12.4 19.2c.4.4 1 .4 1.4 0M10.8 13.8l.8.8M15.2 13.8l-.8.8',
    // Cracks and seams in the crag.
    'M12 35.4c1.6 1.2 2.4 3 2.6 5.2M25.2 33.6l-1 4.6 1.4 2.4M35 34c-.4 2.4.2 4.6 1.6 6.6M18.6 42.6c3-.4 6-.2 8.8.4',
  ],
  dots: [[11.4, 13.2, 0.6], [14.6, 13.2, 0.6], [13, 18.6, 0.75], [11.4, 7.4, 0.4], [14.6, 7.4, 0.4]],
};

/** The deer's clearing: a hind lying in a round, grazed-short clearing, trees closing round it. */
const deerClearing: Drawing = {
  wash: [
    ['leaf', 'M4.8 34c.4-4.6 8.8-8.4 19.2-8.4s18.8 3.8 19.2 8.4c.2 4.8-8.4 8.6-19.2 8.6S4.6 38.8 4.8 34Z'],
    ['straw', 'M15.6 20.4c-.4-1.2-1.2-1.8-2.4-1.8-1.4 0-2.8 1-4 2.6-.6.8-.6 1.4 0 1.6 1 .4 2.4.2 3.8 0l3.6 6.6c4 1.6 10.8 1.6 16.6.4 2.2-.4 4-1 5-2.4-.4-2.6-2.4-4.6-5.4-5.2-4.4-1-9.8-.4-13.4 1.6-1-2.2-1.6-4.6-1.8-7Z'],
  ],
  line: [
    // The hind lying down, legs folded under, head up and ears turned.
    'M15.6 20.4c-.4-1.2-1.2-1.8-2.4-1.8-1.4 0-2.8 1-4 2.6-.6.8-.6 1.4 0 1.6 1 .4 2.4.2 3.8 0',
    'M14.6 18.8c.6-1.6 2-2.6 3.6-2.8-.4 1.6-1.4 2.8-3 3.4M13.8 18.6c0-1.6.6-2.8 1.6-3.8',
    'M15.6 20.4c.2 2.4.8 4.8 1.8 7 3.6-2 9-2.6 13.4-1.6 3 .6 5 2.6 5.4 5.2.4 1.6-.2 2.8-1.6 3.4',
    'M13 22.8c.6 2.6 1.8 4.6 3.4 6.2-.4 1.8-.2 3.4.6 4.8',
    'M34.6 34.2c-5.6.8-12 .8-17.6.2',
    'M33.6 33.8c-1.6-1.8-4-2.4-6.2-1.8',
    'M17.2 33.6c-1.6.4-3 .4-4.4 0',
    // The clearing's round edge, broken where the hind lies across it.
    'M5.4 34c1.6 4.6 9.4 8 18.6 8s17-3.4 18.6-8',
    'M5.4 34c.6-3 4-5.6 9.6-7M36.6 26.2c3.6 1.2 5.8 3.4 6 5.8',
    // Trunks of the wood standing round the rim.
    'M7.2 28.6c.2-6 0-12-.6-18M10.4 27.4c0-5.4.2-10.6.8-15.6',
    'M37.6 26.4c-.2-5.6 0-11 .6-16.4M41 28c.2-6 .6-12 1.4-17.6',
    'M26.6 25.6c.2-4.6.2-9.2-.2-13.6',
  ],
  detail: [
    // Leaf canopy over the trunks.
    'M4.4 11c1.4-2.6 4.2-3.4 6.4-2 1.2-2.4 4.4-2.8 6-.8M35.4 10.6c1.2-2.6 4-3.4 6.4-2.2 1-1.4 2.4-1.8 3.4-1.4M23 12.8c1.2-2 3.4-2.6 5.4-1.4',
    // Short grazed grass, and the flattened oval where the deer lie.
    'M9 37.2l.4-1.2M12 39.4l.4-1.2M30 39.6l.4-1.2M37 37.6l.4-1.2M39.6 35.2l.4-1.2M22.6 40.2l.4-1.2',
    'M21.2 30.4c2.6 1 5.6 1.2 8.4.6',
    'M35.4 26.8c.6-.4 1.2-.4 1.6.2',
  ],
  dots: [[12.6, 19.8, 0.6], [9.2, 22.2, 0.4]],
};

/** The russet neighbour: a fox sitting up, tail brought round over its feet. */
const fox: Drawing = {
  wash: [
    ['straw', 'M15.4 12.2l-1-5.2 4 3 2-.2 2.2-4.6 1 5.6c1.6 2 2.4 4.4 2.4 7 4.6 2.4 8.4 7 9.8 12.6 1 4.2.2 8-2.6 10-6 .6-12 .6-17 0-1.2-4-1.6-9-.2-14-2.2-.8-4.8-1-7.4-1.6Z'],
    ['blossom', 'M33.2 40.4c-4.6 1.8-12.6 2.2-20.4 1.2-3-.4-4.6-1.6-4.2-3.2.4-1.6 2.6-2 5-1.4 3.8 1 8.2 1.2 12.4.4Z'],
  ],
  line: [
    'M15.4 12.4l-1.2-5.6 4.4 3.2M20.2 10l2.6-4.8.9 5.6',
    'M18.6 10c.6-.2 1.2-.2 1.6 0',
    'M15.4 12.4c-1.6 1.2-3.6 2.4-6 3.4-.6.3-.5 1 .1 1.2 2.6.6 5.2.8 7.6 1.8',
    'M23.7 10.8c1.6 2 2.4 4.4 2.4 7',
    'M17.1 18.8c-1.4 4-1.6 9-.4 14',
    'M26.1 17.8c4.6 2.4 8.4 7 9.8 12.6 1 4.2.2 8-2.6 10',
    'M19.4 30.4l-.4 9.6M22.6 31l.2 9',
    'M33.3 40.4c-4.6 1.8-12.6 2.2-20.4 1.2-3-.4-4.6-1.6-4.2-3.2.4-1.6 2.6-2 5-1.4 3.8 1 8.2 1.2 12.4.4',
  ],
  detail: ['M9.8 38.4c-1 .6-1.2 1.8-.2 2.6', 'M17.4 20.4c1.6 1.4 3.6 2 5.6 1.8', 'M16 7.8l1.2 2M21.6 6.6l.2 2.2', 'M28.4 26c1.4 2 2.2 4.4 2.4 7'],
  dots: [[16.6, 13.6, 0.6], [9.6, 15.9, 0.65]],
};

/** One antler of the winter stag, beam and two tines, rising from x, y; mirrored for the other. */
const ANTLER = 'c-.6-2.4-.4-5 .6-7.4.4-1 .6-2 .4-3.2m-.8 5.4c1.2-.6 2-1.6 2.4-2.8m-2.2 5.4c1.4-.2 2.4-.8 3.2-1.8';

/** Deer in the winter wood: a stag between bare snow-lined trunks, its tracks behind it. */
const winterDeer: Drawing = {
  wash: [
    ['river', 'M3.6 41.6c6-1.6 12.4-1.8 18.6-1 7 .9 14 .8 22-.6l.2 4c-7.2 1.2-14.6 1.4-21.8.8-6.4-.4-12.6-.4-19 .4ZM6.8 41.4c.2-10 .4-24-.2-37l3.2-.4c.4 11 .6 24 .2 37.4ZM38.6 41.2c-.2-9.6 0-20.4.8-30l2.4.2c.2 10 0 20-.4 30Z'],
    ['straw', 'M32.4 21c.6-.8 1.4-1.2 2.2-1 1.4.4 2.6 1.4 3.6 2.4.4.4.2 1-.4 1.2-1.2.2-2.4.2-3.4.6-1 1.6-2.2 3-2.8 4.6-.2.8-.2 1.6.2 2.4l-1.2 1.2c-3.4.8-7.4.8-10.8 0l-2.8-1c-.8-1.8-.6-4 .6-5.4 3.4-1.4 7.8-1.6 11.8-.8 1.2-1.6 2.2-3.4 3-5.2Z'],
  ],
  line: [
    // The stag, head up, antlers swept back.
    'M32.4 21c.6-.8 1.4-1.2 2.2-1 1.4.4 2.6 1.4 3.6 2.4.4.4.2 1-.4 1.2-1.2.2-2.4.2-3.4.6',
    'M29.4 26.2c1.2-1.6 2.2-3.4 3-5.2',
    'M17.6 27c3.4-1.4 7.8-1.6 11.8-.8',
    'M34.4 24.2c-1 1.6-2.2 3-2.8 4.6-.2.8-.2 1.6.2 2.4',
    'M30.6 32.4c-3.4.8-7.4.8-10.8 0',
    'M17.6 27c-1.2 1.4-1.4 3.6-.6 5.4',
    'M31.2 31.6l.4 4.4-.2 4.4M29.2 32.4l-.2 4 .4 3.8M18 32.4l-.6 3.6.6 4.2M20.4 32.8l.4 3.6-.4 3.6',
    'M32.6 21.4c-.8-.6-1.8-.8-2.8-.6.8.8 1.8 1 2.8.8',
    place(33.4, 20.2, ANTLER),
    place(34.8, 20.2, mirror(ANTLER)),
    // Bare trunks with a few raised branches.
    'M7 41.4c.2-10 .4-24-.2-37M9.6 41.6c-.4-10-.2-22 .4-32',
    'M9.8 22c2.2-2.4 3.6-5 4.2-8M7 28.6c-1.4-1.6-2.4-3.4-2.8-5.6M9.8 15c1.6-1.4 2.6-3.4 3-5.6',
    'M39 41.2c-.2-9.6 0-20.4.8-30M41.4 41.4c.2-10 0-20-.4-30',
    'M39.4 20.6c-1.8-2-3-4.4-3.4-7M41.2 26c1.4-1.6 2.4-3.4 2.8-5.6',
    // The snow's surface.
    'M3.6 41.6c6-1.6 12.4-1.8 18.6-1 7 .9 14 .8 22-.6',
  ],
  detail: [
    // Snow lying along the upper side of each branch.
    'M10.4 21c1.6-1.8 2.6-3.8 3.2-6M4.6 23.4c.6 1.6 1.4 3 2.4 4.2M36.4 13.8c.6 2.2 1.6 4.2 3 5.8M10.2 13.8c1.2-1.2 2-2.6 2.4-4.2',
    // Slots trodden in the snow behind the stag.
    'M12.4 44l.5.9.5-.9M14.8 42.8l.5.9.5-.9M7.6 44.2l.5.9.5-.9M24.8 43.6l.5.9.5-.9',
    'M17 34.6c3 .8 6.6 1 9.8.4',
  ],
  dots: [[35.4, 21.8, 0.55], [15.4, 6.6, 0.45], [21.6, 11.6, 0.45], [27.4, 5.6, 0.45], [44, 6.2, 0.4], [24.4, 18.4, 0.4], [4.4, 34.8, 0.4], [45, 33.6, 0.4]],
};

/**
 * A swallowtail seen from above with its wings open, centred on its thorax.
 * Returns [outline, markings]: the long forewings, the tailed hindwings, the
 * body, then the dark bands and the eye-spot crescents on the hindwings.
 */
function swallowtail(x: number, y: number, s = 1): [string, string] {
  const fore = 'c2.8-2.4 5.6-4.2 8.6-5.2.6 2.2.4 4.4-.6 6.4-2.4.4-5 .4-7.8-.2';
  const hind = 'c2-.2 4 .2 5.4 1.4.6 1.4 0 3-1.2 4l.4 2.8-1.4-2.4c-1.2.4-2.4-.2-3.6-1.4-.6-.8-.8-2.2-.6-4.2';
  const body = 'c.5 0 .7 1 .7 3 0 2.6-.3 4.8-.7 5.8-.4-1-.7-3.2-.7-5.8 0-2 .2-3 .7-3Z';
  const feeler = 'c-.6-1.6-1.4-2.8-2.4-3.4';
  const outline =
    place(x + 0.6 * s, y - 0.6 * s, fore, s) +
    place(x - 0.6 * s, y - 0.6 * s, mirror(fore), s) +
    place(x + 0.8 * s, y + 0.8 * s, hind, s) +
    place(x - 0.8 * s, y + 0.8 * s, mirror(hind), s) +
    place(x, y - 2.6 * s, body, s) +
    place(x - 0.3 * s, y - 2.6 * s, feeler, s) +
    place(x + 0.3 * s, y - 2.6 * s, mirror(feeler), s);
  const band = 'c2.4-1.6 4.8-2.8 7.2-3.6';
  const edge = 'c.4 1.6.2 3.2-.4 4.6';
  const crescent = 'c.6.4 1.4.4 2 0';
  const markings =
    place(x + 1.2 * s, y - 0.2 * s, band, s) +
    place(x - 1.2 * s, y - 0.2 * s, mirror(band), s) +
    place(x + 7.8 * s, y - 4.2 * s, edge, s) +
    place(x - 7.8 * s, y - 4.2 * s, mirror(edge), s) +
    place(x + 3.2 * s, y + 5.6 * s, crescent, s) +
    place(x - 3.2 * s, y + 5.6 * s, mirror(crescent), s);
  return [outline, markings];
}

const [SWALLOW_A, SWALLOW_A_MARKS] = swallowtail(16, 13.6, 1.25);
const [SWALLOW_B, SWALLOW_B_MARKS] = swallowtail(34.4, 25, 0.9);

/** Swallowtails at the garden: two yellow swallowtails, tails on the hindwings, over the flowers. */
const swallowtails: Drawing = {
  wash: [
    ['straw', 'M6 6.6c3 .4 6.4 2.2 9.4 5.2 3-3 6.4-4.8 9.4-5.2.8 2.8.6 5.6-.8 7.6.8 1.8.6 3.6-.6 5-1.6.8-3.4.6-5-.2-1.6-.6-2.4-.6-3 0-1.6.8-3.4 1-5 .2-1.2-1.4-1.4-3.2-.6-5-1.4-2-1.6-4.8-.8-7.6ZM27.4 19.6c2.2.4 4.6 1.6 6.6 3.8 2.2-2.2 4.4-3.4 6.6-3.8.6 2 .4 4-.6 5.4.6 1.4.4 2.6-.4 3.6-2.2.6-4 .4-5.6-.6-1.6 1-3.4 1.2-5.6.6-.8-1-1-2.2-.4-3.6-1-1.4-1.2-3.4-.6-5.4Z'],
    ['blossom', 'M30.6 37.4c0-2 1.8-3.6 3.8-3.6s3.8 1.6 3.8 3.6-1.8 3.4-3.8 3.4-3.8-1.4-3.8-3.4ZM15.4 39.6c0-1.8 1.4-3 3.2-3s3.2 1.2 3.2 3-1.4 3-3.2 3-3.2-1.2-3.2-3Z'],
  ],
  line: [
    SWALLOW_A,
    SWALLOW_B,
    // The garden flowers they came to, on their stems.
    bloom(34.4, 37.2, 3.4, 10),
    bloom(18.6, 39.6, 2.8, -12),
    'M34.2 40.6c.2 1.8 0 3.6-.6 5.4M18.8 42.4c0 1.2-.2 2.4-.6 3.6',
    'M33.8 43.4c1.8-1.4 3.6-1.8 5.4-1.4-1.4 1.4-3.2 1.8-5.4 1.4ZM18.4 44.6c-1.6-1.2-3.2-1.4-4.8-.8 1.4 1.2 3 1.4 4.8.8Z',
  ],
  detail: [SWALLOW_A_MARKS, SWALLOW_B_MARKS],
  dots: [[34.4, 37.2, 0.7], [18.6, 39.6, 0.6], [12, 21.8, 0.4], [20, 21.8, 0.4], [31.5, 30.5, 0.35], [37.3, 30.5, 0.35]],
};

/** The moon moth (luna type), wings spread, centred on its body: x, y and scale. */
function moonMothShapes(x: number, y: number, s: number): { outline: string; detail: string; spots: Array<[number, number, number]> } {
  const fore = 'c4.6-3 10-5.4 16-6.4.8 3.4 0 7-2.6 10.2-4.2.4-9 .2-13.4-1';
  const hind = 'c3.8.2 7.6 1.2 10.4 3 .4 2.2-.6 4.2-2.6 5.6.6 3.6 1.6 7.6 3 11.4.2.8-.6 1.2-1.2.6-2.4-3.2-4-7-5.6-10.6-1.6-1-3.4-2.6-4.4-3.6Z';
  const body = 'c1 0 1.4 1.6 1.4 4.6 0 4-.4 7-1.4 8-1-1-1.4-4-1.4-8 0-3 .4-4.6 1.4-4.6Z';
  const feeler = 'c-1-2.2-2.6-4-4.6-5.4';
  const outline =
    place(x + 1 * s, y - 2 * s, fore, s) +
    place(x - 1 * s, y - 2 * s, mirror(fore), s) +
    place(x + 1 * s, y + 1.2 * s, hind, s) +
    place(x - 1 * s, y + 1.2 * s, mirror(hind), s) +
    place(x, y - 4.6 * s, body, s) +
    place(x - 0.5 * s, y - 5 * s, feeler, s) +
    place(x + 0.5 * s, y - 5 * s, mirror(feeler), s);
  // The dark rib along each forewing's leading edge, the eye-spots, and the comb of the antennae.
  const rib = 'c4.4-2.8 9.4-5 14.6-6';
  const ticks: string[] = [];
  for (const k of [0.25, 0.45, 0.65, 0.85]) {
    for (const side of [-1, 1]) {
      const ax = x + side * (0.5 + 4.6 * k) * s;
      const ay = y + (-5 - 5.4 * k + 1.2 * k * k) * s;
      ticks.push(`M${num(ax)} ${num(ay)}l${num(side * 1 * s)} ${num(0.5 * s)}M${num(ax)} ${num(ay)}l${num(-side * 0.5 * s)} ${num(-1 * s)}`);
    }
  }
  const detail =
    place(x + 1.4 * s, y - 2.6 * s, rib, s) +
    place(x - 1.4 * s, y - 2.6 * s, mirror(rib), s) +
    oval(x + 9.6 * s, y - 2.6 * s, 1.5 * s, 1.9 * s) +
    oval(x - 9.6 * s, y - 2.6 * s, 1.5 * s, 1.9 * s) +
    oval(x + 7 * s, y + 5.2 * s, 1.2 * s, 1.5 * s) +
    oval(x - 7 * s, y + 5.2 * s, 1.2 * s, 1.5 * s) +
    `M${num(x - 0.8 * s)} ${num(y)}h${num(1.6 * s)}M${num(x - 0.8 * s)} ${num(y + 2.4 * s)}h${num(1.6 * s)}` +
    ticks.join('');
  const spots: Array<[number, number, number]> = [
    [x + 9.6 * s, y - 2.6 * s, 0.5 * s],
    [x - 9.6 * s, y - 2.6 * s, 0.5 * s],
    [x + 7 * s, y + 5.2 * s, 0.4 * s],
    [x - 7 * s, y + 5.2 * s, 0.4 * s],
  ];
  return { outline, detail, spots };
}

const MOON = moonMothShapes(24, 15.6, 1.1);

/** The moon moth: pale green, wide as a hand, the long hindwing tails trailing. Rare. */
const moonMoth: Drawing = {
  wash: [
    ['leaf', 'M25.2 13.4c5-3.2 11-6 17.6-7 .8 3.8 0 7.6-2.8 11.2l-1.4.6c.4 2.4-.6 4.6-2.8 6.2.6 4 1.8 8.4 3.4 12.6-.8.6-1.4.6-2.2-.2-2.6-3.6-4.6-7.6-6.4-11.6-1.8-1.2-3.6-2.8-4.8-4l-.2 6c-.4.6-1.2.6-1.6 0l-.2-6c-1.2 1.2-3 2.8-4.8 4-1.8 4-3.8 8-6.4 11.6-.8.8-1.4.8-2.2.2 1.6-4.2 2.8-8.6 3.4-12.6-2.2-1.6-3.2-3.8-2.8-6.2l-1.4-.6c-2.8-3.6-3.6-7.4-2.8-11.2 6.6 1 12.6 3.8 17.6 7Z'],
    ['straw', 'M22.4 11.2c.2-1.4.8-2.2 1.6-2.2s1.4.8 1.6 2.2c.2 3.6-.2 7.4-1.6 9.4-1.4-2-1.8-5.8-1.6-9.4Z'],
  ],
  line: [MOON.outline, ring(24, 9.6, 1.1)],
  detail: [MOON.detail],
  dots: MOON.spots,
};

/** Hummingbird hawk-moth hovering at a day lily, wings a blur, tongue into the flower. */
const hawkMoth: Drawing = {
  wash: [
    ['straw', 'M11 25c1.4-3.4 4.4-6 8.4-6.8-.2 2.6-1.8 4.8-4.4 6.2 2.6-.6 5.2-.6 8 .2-1.2 1-2.6 1.6-4 1.8 2 .8 3.8 2.2 5 4-2.6.6-5.2.2-7.2-1.2l-1.8-.6c-2.2.8-4.8 1.6-7.6 2-1-.4-.6-1.6.6-2.6 1-.8 2-1.8 3-3Z'],
    ['blossom', 'M30.6 23c2.4-1.6 5-2.2 7.4-1.8-.8 1.4-2.2 2.2-4 2.4ZM29 22.2c1.4-4 4-7.4 7.6-9.4.6 2.4 0 4.8-1.6 7-1.6 1.2-3.6 2-6 2.4Z'],
  ],
  line: [
    // The lily: its throat, three flared petals and the stem.
    'M4.8 30.6c2.6-1.6 4.8-3.6 6.6-6M5.6 32c2.6-.4 5.2-1.2 7.6-2.6',
    'M11 25c1.4-3.4 4.4-6 8.4-6.8-.2 2.6-1.8 4.8-4.4 6.2-1.2.6-2.6.8-4 .6Z',
    'M13 29.4c3 .2 6 1.6 7.8 4-2.6.6-5.2.2-7.2-1.2-.8-.6-1-1.6-.6-2.8Z',
    'M12.6 27c2.6-1 5.4-1.2 8.2-.4-2 1.6-4.8 2.2-7.6 1.8Z',
    'M5.2 31.4c-.6 4.6-.4 9.4.4 14.4M5.4 40c-2-1.4-3-3.4-3-6M5.6 42c1.8-2 3.8-3 6-3',
    // The moth: stout body, tail fan, and the forewing raised in its blur.
    'M24.4 24.2c.4-1.6 1.8-2.6 3.6-2.6 3 0 6.4.6 8.8 1.6l2.4-1.2-.4 1.8.8 1.4-2.6-.2c-2.6 1.2-6 1.6-9 1.2-1.8-.2-3.2-1-3.6-2Z',
    'M29 22.2c1.4-4 4-7.4 7.6-9.4.6 2.4 0 4.8-1.6 7',
    'M30.6 23c2.4-1.6 5-2.2 7.4-1.8-.8 1.4-2.2 2.2-4 2.4',
    // The long tongue reaching into the flower.
    'M24.4 24.8c-3.6.4-6.8 1.2-10 2.4',
  ],
  detail: [
    // Ghost strokes of the beating wings.
    'M27.4 20.4c.8-3.4 2.4-6.2 4.6-8.4M33.6 9.6c1.8.2 3.4.8 4.6 2M38.8 14.8c.4 1.4.4 2.8 0 4.2',
    // Stamens out of the lily's throat, and the moth's banded tail and small antennae.
    'M12.4 27.8c2.4.4 4.6 1.2 6.4 2.6M12.6 26.2c2-.6 4-.8 6-.4',
    'M34.2 22.8l-.4 2.6M36.2 23.2l-.2 2',
    'M25.6 22.2c-.6-1.4-1.6-2.2-2.8-2.6',
    'M28.4 25.6l-.6 1.6M30.6 25.8l-.4 1.6',
  ],
  dots: [[26, 23.4, 0.75], [18.8, 30.4, 0.45], [18.6, 26.4, 0.45]],
};

/** Otter at the willows: rolled on its back in the shallows, forepaws on its chest, looking straight at us. Rare. */
const otter: Drawing = {
  wash: [
    ['straw', 'M7 20.6c0-3 2-5 4.6-5s4.4 2 4.4 4.8c4-1.6 9-1.8 13.4-1.2 2.6.4 4.6 1.4 5.8 3 2.6-.2 5.2-.8 7.8-1.8-1.6 2-4.4 3.4-7.6 4l-.8 2.6c-6 .8-14 .8-21.6 0-4 .4-6-2-6-6.4Z'],
    ['river', 'M3.6 28.6c5.2-1.2 10.4-.8 14.4-.2 4.6.6 9 .6 13-.2 4.2-.8 8.6-.8 13.4 0l-.4 9c-6.8 1.4-13.6 1.6-20.4 1-6.8-.4-13.2-.6-19.4 0Z'],
  ],
  line: [
    // The head, lifted and turned to us: round, small ears.
    'M7 20.6c0-3 2-5 4.6-5s4.4 2 4.4 4.8-1.8 4.8-4.4 4.8S7 23.4 7 20.6Z',
    'M8.2 16.8c-.8-.4-1-1.4-.4-2M15 16.6c.8-.4 1-1.4.4-2',
    // The pale belly turned up, curving away to the hind feet and the thick tail.
    'M15.6 22.6c4-1.8 9.4-2.4 14.2-1.6 2.6.4 4.6 1.4 5.8 3',
    'M34 23.6c.4-2 1.6-3.4 3.2-4 .4 1.4-.2 2.8-1.2 3.8M31.4 22.6c.2-1.8 1-3.2 2.4-4 .4 1.4 0 2.8-.8 3.8',
    'M35.6 24.4c2.8-.2 5.4-.8 8-1.8-1.6 2-4.4 3.4-7.6 4',
    // Forepaws folded on the chest.
    'M17.6 22.2c.2-1.4 1-2.4 2.2-2.6.6.8.6 1.6.2 2.4M21.2 21.4c.4-1.2 1.4-2 2.6-2 .4.8.2 1.6-.4 2.2',
    // The water's surface across the rolled body.
    'M3.6 28.8c5.2-1.2 10.4-.8 14.4-.2 4.6.6 9 .6 13-.2 4.2-.8 8.6-.8 13.4 0',
  ],
  detail: [
    // The back below the surface, and the rings spreading from the roll.
    'M15.4 25.6c6 1.6 13.4 1.6 20-.4',
    'M6.6 32.4c3-.6 6-.6 9 0M20.4 33.4c4-.6 8-.6 12 0M35.2 32.2c2.4-.4 4.8-.4 7.2 0',
    'M10.4 36.2c4-.6 8-.6 12 0M27.8 36.4c3-.5 6-.5 9 0',
    // Whiskers and the pale throat.
    'M9.4 22.4l-3 .4M9.4 23.2l-2.6 1.2M13.8 22.4l3 .4M13.8 23.2l2.6 1.2',
    'M24.4 19.4c1.4-.2 2.6 0 3.6.6',
  ],
  dots: [[10, 19.2, 0.65], [13.2, 19.2, 0.65], [11.6, 21.6, 0.75], [43.4, 18.6, 0.35], [41.6, 17, 0.35], [5.4, 26.4, 0.35]],
};

/** One bracken frond: a stem from x0, y0 to x1, y1 with pinnae ticked along both sides. */
function bracken(x0: number, y0: number, x1: number, y1: number, n: number, len: number): { stem: string; pinnae: string } {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy);
  const [ux, uy] = [dx / l, dy / l];
  const [px, py] = [-uy, ux];
  // A gentle bow in the stem.
  const stem = `M${num(x0)} ${num(y0)}Q${num(x0 + dx / 2 + px * 1.6)} ${num(y0 + dy / 2 + py * 1.6)} ${num(x1)} ${num(y1)}`;
  let pinnae = '';
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const bow = 4 * t * (1 - t) * 0.8;
    const bx = x0 + dx * t + px * bow;
    const by = y0 + dy * t + py * bow;
    const L = len * (1 - t * 0.75);
    for (const sd of [-1, 1]) {
      const ex = bx + (px * sd * 0.9 + ux * 0.45) * L;
      const ey = by + (py * sd * 0.9 + uy * 0.45) * L;
      pinnae += `M${num(bx)} ${num(by)}L${num(ex)} ${num(ey)}`;
    }
  }
  return { stem, pinnae };
}

const FROND_L = bracken(8, 46, 9, 22, 7, 4.2);
const FROND_R = bracken(41, 46, 39.4, 24, 7, 4.2);
const FROND_C = bracken(20, 46, 32, 34.6, 5, 3.6);

/** The tanuki: a round masked face peering out of the bracken. */
const tanuki: Drawing = {
  wash: [
    ['straw', 'M12.4 22.4c-1.4-1.8-1.8-3.8-1.4-6 1-3.6 4.6-6.6 9-7.6 2.4-.4 4.8-.4 7.2 0 4.4 1 8 4 9 7.6.4 2.2 0 4.2-1.4 6l1.8 1.6c-1.6 3.4-5.2 6.2-11.6 6.2s-10-2.8-11.6-6.2Z'],
    ['leaf', 'M3.6 46c.8-8 2.4-16 5.6-24 3.4 8 4.6 16 4.4 24ZM34.6 46c.4-8 2-15.6 4.8-22.4 3.2 7 4.8 14.6 5 22.4ZM15.4 46c4-5.8 10-10 17.6-12.4.8 4.8-2.4 9-7.2 12.4Z'],
  ],
  line: [
    // The round, ruffed face.
    'M12.4 22.4c-1.4-1.8-1.8-3.8-1.4-6 1-3.6 4.6-6.6 9-7.6 2.4-.4 4.8-.4 7.2 0 4.4 1 8 4 9 7.6.4 2.2 0 4.2-1.4 6',
    'M12.4 22.4l-1.6 1.2 1.8.4-.8 1.6 2.2-.2c1.6 2.6 5.2 4.6 10 4.6s8.4-2 10-4.6l2.2.2-.8-1.6 1.8-.4-1.6-1.2',
    // Small round ears.
    'M15 12.2c-1.2-1.6-1.4-3.6-.6-5 1.6.2 3 1.2 4 2.6M33 12.2c1.2-1.6 1.4-3.6.6-5-1.6.2-3 1.2-4 2.6',
    // The dark mask round each eye, sloping down the cheeks.
    'M15.6 17.2c1.6-1.6 4.2-1.8 5.8-.4.8.8.6 2.2-.4 3.6-1.2 1.6-3 2.8-5 3.2-1.2.2-2-.6-1.8-2 .2-1.6.6-3.2 1.4-4.4Z',
    'M32.4 17.2c-1.6-1.6-4.2-1.8-5.8-.4-.8.8-.6 2.2.4 3.6 1.2 1.6 3 2.8 5 3.2 1.2.2 2-.6 1.8-2-.2-1.6-.6-3.2-1.4-4.4Z',
    // Muzzle and mouth.
    'M24 24.6v1c-.6.8-1.4 1-2 .6M24 25.6c.6.8 1.4 1 2 .6',
    // Bracken fronds standing in front.
    FROND_L.stem,
    FROND_R.stem,
    FROND_C.stem,
  ],
  detail: [
    FROND_L.pinnae,
    FROND_R.pinnae,
    FROND_C.pinnae,
    // Hatching to darken the mask, and the pale stripe down the brow.
    'M16 19.4l2.2-1.8M15.6 21.4l3.6-3M17.4 21.6l2.6-2.2M32 19.4l-2.2-1.8M32.4 21.4l-3.6-3M30.6 21.6l-2.6-2.2',
    'M24 11.2v8M22 21.4c.6-1 1.2-1.4 2-1.4s1.4.4 2 1.4',
    'M15.6 8.8l1.2 1.6M32.4 8.8l-1.2 1.6',
  ],
  dots: [[19, 18.6, 0.75], [29, 18.6, 0.75], [24, 23.4, 1]],
};

/** Mudskipper out on the open mud: eyes raised on top of its head, propped on its fins, sail up. */
const mudskipper: Drawing = {
  wash: [
    ['straw', 'M3.6 34.6c6-.8 12-.6 18 0s13 .6 22.4-.6l.4 8.2c-7.2 1.4-14.8 1.6-22 1.2-6.6-.4-12.8-.4-18.8.4Z'],
    ['river', 'M7.4 31.4c-.4-2.4.8-4.6 3-5.4 2.6-.8 5.4-.6 8 0 5 1 10.6 1.6 16 2l6.4-1.6.4 1.4-.2 1.6.4 1.4-6.6-.8c-5.4 1.2-11 2-16.4 2.6-3 .2-5.8.4-7.6.4-.8 0-1.4-.4-1.4-1.6ZM30.6 38.2c1.8-.6 4.2-.8 6.6-.2-1.6 1-4.4 1-6.6.2Z'],
  ],
  line: [
    // Body, blunt head down on the mud, tail behind.
    'M7.4 31.4c-.4-2.4.8-4.6 3-5.4 2.6-.8 5.4-.6 8 0 5 1 10.6 1.6 16 2l6.4-1.6c.5-.1.8.2.6.6l-.6 1.8.6 1.6c.2.5-.1.8-.6.6l-6.6-1.2c-5.4 1.2-11 2-16.4 2.6-3 .2-5.8.4-7.6.4-.8 0-1.4-.4-1.4-1.4Z',
    // The two eyes, raised up on top of the head.
    ring(10.8, 25.2, 1.5),
    ring(13.8, 24.8, 1.4),
    // A pectoral fin propping the front like an elbow.
    'M16.8 30.6c-.8 1.4-2 2.6-3.6 3.6 1.8.4 3.6.2 5-.6',
    // The first dorsal raised as a sail, the second long and low.
    'M19.4 26.4c.4-2.8 1.8-5 4-6.4 1.2 1.8 1.4 4.2.8 7.2',
    'M26.4 27.8c3.4-1 6.8-.8 9.6.6',
    // The mud.
    'M3.6 34.6c6-.8 12-.6 18 0s13 .6 22.4-.6',
  ],
  detail: [
    // Mouth, gill and the spines of the sail.
    'M7.6 30.2c1 .3 2 .3 3-.1',
    'M15.4 26.8c-.8 1.6-.8 3.4 0 5',
    'M21 26.2l1.6-4.6M22.6 26.6l1.2-5',
    'M19.6 29.6c4 .4 8 .4 12-.2',
    // A burrow, a puddle, and the skid marks of its last hop.
    'M30.6 38.2c1.8-.6 4.2-.8 6.6-.2',
    oval(8.4, 39, 2.2, 0.7),
    'M20 37.8l1.4-.6M23 38.6l1.4-.6M17.2 39.8l1.2-.6',
  ],
  dots: [[11, 24.9, 0.6], [14, 24.5, 0.55], [26, 31.2, 0.3], [30, 30.6, 0.3], [22, 31.4, 0.3]],
};

/** A five-armed star centred on cx, cy, arm lengths given per arm (tips at radius `ro[i]`). */
function star(cx: number, cy: number, ri: number, ro: number[], turnDeg: number): string {
  const p = (r: number, deg: number): string => {
    const a = ((deg + turnDeg) * Math.PI) / 180;
    return `${num(cx + r * Math.sin(a))} ${num(cy - r * Math.cos(a))}`;
  };
  let d = `M${p(ri, -36)}`;
  for (let i = 0; i < 5; i++) {
    const a = i * 72;
    const r = ro[i]!;
    d += `C${p(ri * 1.25, a - 28)} ${p(r * 0.62, a - 10)} ${p(r * 0.9, a - 6)}`;
    d += `C${p(r * 1.06, a - 4)} ${p(r * 1.06, a + 4)} ${p(r * 0.9, a + 6)}`;
    d += `C${p(r * 0.62, a + 10)} ${p(ri * 1.25, a + 28)} ${p(ri, a + 36)}`;
  }
  return `${d}Z`;
}

/** Points along one arm of the starfish, for its rows of tubercles. */
function armDots(cx: number, cy: number, armR: number, deg: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (const f of [0.38, 0.55, 0.72]) {
    const a = (deg * Math.PI) / 180;
    out.push([Number(num(cx + armR * f * Math.sin(a))), Number(num(cy - armR * f * Math.cos(a))), 0.38]);
  }
  return out;
}

const STAR_ARMS = [16.4, 15.6, 16.8, 15, 16];
const STAR_TURN = 8;
const STARFISH = star(24, 23.4, 5.6, STAR_ARMS, STAR_TURN);

/** Starfish: orange and five-armed in a low-tide pool, one arm lifted as it walks. */
const starfish: Drawing = {
  wash: [
    ['straw', STARFISH],
    ['blossom', star(24.4, 23.6, 4, STAR_ARMS.map((r) => r * 0.72), STAR_TURN)],
  ],
  line: [STARFISH],
  detail: [
    // The pale groove down each arm and the small sieve-plate near the centre.
    ...STAR_ARMS.map((r, i) => {
      const a = ((i * 72 + STAR_TURN) * Math.PI) / 180;
      return `M${num(24 + 3 * Math.sin(a))} ${num(23.4 - 3 * Math.cos(a))}L${num(24 + r * 0.8 * Math.sin(a))} ${num(23.4 - r * 0.8 * Math.cos(a))}`;
    }),
    ring(26.4, 25, 0.8),
    // The rim of the pool and a pebble.
    'M4.6 41.4c5.4 2.4 13 3.4 21.4 3 6.4-.4 12-1.4 17.2-3.4',
    oval(41, 37.6, 2.2, 1.4),
  ],
  dots: STAR_ARMS.flatMap((r, i) => armDots(24, 23.4, r, i * 72 + STAR_TURN + 14).concat(armDots(24, 23.4, r, i * 72 + STAR_TURN - 14))),
};

/** One raised claw of the crab, written from its wrist going up; mirrored for the right. */
const CLAW =
  'c-2-.8-3-3-2.6-5.4.2-1.6.6-2.6 1.2-3.6l-.6-2.4c.2-.6.8-.6 1.2-.2l1.4 2.2c.8-.6 1.6-.8 2.4-.6l.4-2.6c.2-.6.8-.6 1-.1l.2 3.2c.8 1.6.8 3.8-.4 5.8-.8 1.4-2 2.4-3.6 3.8Z';

/** Shore crab: square on to us, claws raised high, very brave for its size. */
const shoreCrab: Drawing = {
  wash: [
    ['leaf', 'M15 24c1.4-2.6 5-4 9-4s7.6 1.4 9 4l1.4 1.6-1 .6c.2 3-1.2 5.8-3.8 7.6-1.8 1.2-3.6 1.6-5.6 1.6s-3.8-.4-5.6-1.6c-2.6-1.8-4-4.6-3.8-7.6l-1-.6Z'],
    ['river', 'M4 40.6c5-1.6 11-2 17.4-1.4 6.6.6 12.6.4 18.6-.8l4 1.6-.6 4.6c-12.8 1.2-26 1.2-39 .2Z'],
  ],
  line: [
    // Carapace, broad at the front with its toothed shoulders.
    'M15 24c1.4-2.6 5-4 9-4s7.6 1.4 9 4l1.4 1.6-1 .6c.2 3-1.2 5.8-3.8 7.6-1.8 1.2-3.6 1.6-5.6 1.6s-3.8-.4-5.6-1.6c-2.6-1.8-4-4.6-3.8-7.6l-1-.6Z',
    // Eyes on short stalks.
    'M21.4 20.6v-2M26.6 20.6v-2',
    // The arms bent up to the raised claws.
    'M15.6 25.8c-2.4.2-4.2-.6-5-2.4l.2-3.2',
    'M32.4 25.8c2.4.2 4.2-.6 5-2.4l-.2-3.2',
    place(10.8, 20.2, CLAW),
    place(37.2, 20.2, mirror(CLAW)),
    // Walking legs, three a side, jointed and splayed.
    'M15.4 28.4c-2.6.2-4.6 1.2-5.8 3l-1.2 3.4M16.4 31c-2 .8-3.4 2.2-4 4.2l-.2 3.2M18.6 33.2c-1.4 1-2.2 2.6-2.4 4.4l.2 2.4',
    'M32.6 28.4c2.6.2 4.6 1.2 5.8 3l1.2 3.4M31.6 31c2 .8 3.4 2.2 4 4.2l.2 3.2M29.4 33.2c1.4 1 2.2 2.6 2.4 4.4l-.2 2.4',
  ],
  detail: [
    // Teeth along the front shoulders and the regions of the shell.
    'M15.6 23l.8.4M16.6 21.8l.8.6M31.4 23l-.8.4M30.4 21.8l-.8.6',
    'M20.4 26.6c2.4 1.6 4.8 1.6 7.2 0M24 28v4.6',
    // Weed trailing over the stones it came from.
    'M4.4 40.8c2-1.6 3.4-3.8 4-6.4M7.2 41.4c1.4-2.4 3.6-4 6.2-4.4M38.4 40.6c1.4-2 1.8-4.4 1.6-6.8M41.4 41c.4-1.8 1.4-3.4 3-4.2',
    'M14.6 43.6c5-.6 10-.6 15 0',
  ],
  dots: [[21.4, 18.2, 0.65], [26.6, 18.2, 0.65]],
};

/** A seal on the bar: lying like a log on the sand, its head raised to look at us. Rare. */
const seal: Drawing = {
  wash: [
    ['river', 'M19.6 16.6c-.2-2.8-1.8-4.8-4.4-5-2.4-.2-4.4 1.4-5 3.6-.6 1.6-1.2 2.6-1.8 3.2-.6.6-.2 1.4.8 1.6 1.4.4 3.2.4 5.4-.4.8 2.6 1.4 5 2 7 .4 1.8 1 3.2 2 4.8 6.8.4 13.8.2 19.8-.6 1.4-.2 2.4-.4 3.2-1l-4.4-1.4c-3.6-1-8-1.6-11.6-3.6-3.6-2-5.8-5.4-7.6-8.6Z'],
    ['straw', 'M3.6 34.6c4.4-2.4 11-3.8 20.4-3.8s16 1.4 20.4 3.8c-5 1.8-12 2.6-20.4 2.6s-15.4-.8-20.4-2.6Z'],
  ],
  line: [
    // Head raised and turned to us: round crown, dog-like muzzle.
    'M19.6 16.6c-.2-2.8-1.8-4.8-4.4-5-2.4-.2-4.4 1.4-5 3.6-.6 1.6-1.2 2.6-1.8 3.2-.6.6-.2 1.4.8 1.6 1.4.4 3.2.4 5.4-.4',
    // Long back to the hind flippers; throat and chest down to the sand.
    'M19.6 16.6c1.8 3.2 4 6.6 7.6 8.6 3.6 2 8 2.6 11.6 3.6',
    'M38.8 28.8c1.6.4 3 .2 4-.6l1.6-1.8-.2 2.6 1 1.4h-2.8c-1.2.4-2.6.6-4 .4',
    'M14.6 19.6c.8 2.6 1.4 5 2 7 .4 1.8 1 3.2 2 4.8',
    'M38.4 30.8c-6 .8-13 1-19.8.6',
    // A fore flipper laid along the side.
    'M22.6 27.8c-.4 1.4-1.2 2.4-2.6 3',
    // The sand bar and the water lying round it.
    'M3.6 34.6c4.4-2.4 11-3.8 20.4-3.8s16 1.4 20.4 3.8',
    'M5 39c3.4-.6 6.8-.6 10 0M19.4 39.8c4-.6 8-.6 12 0M35 39c2.8-.5 5.6-.5 8.6 0',
  ],
  detail: [
    // Whiskers, and the dappled coat.
    'M9.4 18.6l-3.2-.4M9.6 19.4l-3 1',
    'M24.6 22.4l.4.4M28.4 25l.4.3M31.8 26.4l.4.3M21.6 23.8l.4.4M26.4 27.6l.4.2',
    'M8 43c3-.5 6-.5 9 0M27.4 43.2c3.4-.5 6.8-.5 10 0',
    'M4.8 27.4c2.6-.4 5.2-.4 7.6 0M33.6 22.6c2.6-.4 5.2-.4 8 0',
  ],
  dots: [[12.6, 14.6, 0.75], [16.4, 14.4, 0.75], [8.8, 17.6, 0.6]],
};

/* ------------------------------------------------------------------ */
/* Fish                                                                */
/* ------------------------------------------------------------------ */

/** The char, drawn level facing right before it is tipped up to rise. */
const CHAR_BODY =
  'M41.4 26C39 23 35 21.4 30 21.2 24 21 18 22.2 13.6 24.2L8.6 21.4C8 21.1 7.5 21.4 7.6 22L8.8 26 7.6 30C7.5 30.6 8 30.9 8.6 30.6L13.6 27.8C18 30.2 24 31.4 30 31.2 35 31 39.2 29.2 41.4 26Z';
const CHAR_FINS = [
  'M28 21.2C27 19.4 25.6 18.2 23.6 17.8L22.4 21.6',
  'M16.8 23.2C16.4 22 15.4 21.6 14.6 22.2',
  'M33 29.8C32 31.6 30.4 32.8 28.6 33L30.2 30.8',
  'M24.4 31.2C23.8 32.8 22.6 33.8 21 34L22.2 31.2',
  'M19.4 30.6C18.6 32 17.4 32.8 16 33L16.6 29.8',
];
/** Pale gold spots scattered along the flank. */
const CHAR_SPOTS: Pt[] = [[33, 23.4], [29.4, 23], [25.6, 23.2], [21.8, 23.8], [18, 24.8], [31.2, 26.4], [27.4, 26], [23.6, 26.4], [19.8, 26.8], [16, 26.4], [29.2, 29], [25.4, 29], [21.4, 28.8]];
/** The tilt and lift that take the level char into its rise. */
const CHAR_TILT: [number, number, number, number, number] = [-20, 24, 26, -1, 3];
const tilt = (d: string): string => turn(d, ...CHAR_TILT);

/** Mountain char: dark, spotted with pale gold, rising from the cold stones to a ring at dusk. */
const char: Drawing = {
  wash: [
    ['river', tilt(CHAR_BODY)],
    ['straw', tilt('M14 27.8C18 30.2 24 31.4 30 31.2 35 31 39.2 29.2 41.4 26 37 28.4 33 28.8 28 28.8 22 28.6 18 28.4 14 27.8Z')],
  ],
  line: [
    tilt(CHAR_BODY),
    ...CHAR_FINS.map(tilt),
    // Mouth and gill cover.
    tilt('M41.4 26L37.8 26.8'),
    tilt('M34.6 22.2C33.4 24.6 33.4 28 34.8 30.4'),
    // The cold stream's surface with the ring of its rise, and stones on the bed.
    'M4 9.6c5-.8 10-.8 15 0 4 .6 7 .6 11.4 0',
    oval(38.8, 9.6, 5.2, 1.2),
    'M4.6 44.4c.4-2 2.2-3.4 4.6-3.4 2.4 0 4.2 1.4 4.6 3.4M16.6 44.4c.6-1.6 2-2.6 3.8-2.6s3.2 1 3.8 2.6M38 44.4c.4-1.4 1.6-2.2 3-2.2s2.6.8 3 2.2',
  ],
  detail: [
    ...CHAR_SPOTS.map(([x, y]) => {
      const [rx, ry] = turnPt(x, y, ...CHAR_TILT);
      return ring(rx, ry, 0.62);
    }),
    // White leading edges of the lower fins.
    tilt('M32.4 30.4C31.6 31.8 30.4 32.6 29 32.8M23.8 31.6C23.2 32.8 22.4 33.4 21.4 33.6M18.8 31C18.2 32 17.4 32.6 16.4 32.8'),
    // Lateral line, the wider ring, and the cold current over the stones.
    tilt('M34.4 25.2C28 25 20 25.4 14 26.4'),
    oval(38.8, 9.6, 8, 2),
    'M26 39.6c4-.6 8-.6 12 0M6 37.2c3-.5 6-.5 9 0',
  ],
  dots: [turnPt(37.6, 24.6, ...CHAR_TILT).concat(0.75) as [number, number, number]],
};

/** Cherry salmon (yamame) resting in the deep of Fuchi: parr marks, and the pink band of the cherry. */
const cherrySalmon: Drawing = {
  wash: [
    ['river', 'M5.4 24.6C8.6 19.8 14.4 17.2 21 17c6.4-.2 11.6 1.8 15.4 5.2l5.6-3.8 1 .6-1.4 5.4 1.6 5.4-1 .6-5.8-3.8c-3.8 3.4-9 5.2-15.4 5-6.6-.2-12.4-2.8-15.6-7Z'],
    ['blossom', 'M7.6 25c7.4-2 19.4-2.4 29.2-.8l-.4 3.4c-10.2 1.6-21.4 1.2-28.6-1.2Z'],
  ],
  line: [
    'M5.4 24.6C8.6 19.8 14.4 17.2 21 17c6.4-.2 11.6 1.8 15.4 5.2l5.6-3.8c.6-.4 1.2-.1 1 .6l-1.4 5.4 1.6 5.4c.2.7-.4 1-1 .6l-5.8-3.8c-3.8 3.4-9 5.2-15.4 5-6.6-.2-12.4-2.8-15.6-7Z',
    'M19.4 17.2c.8-2.4 2.8-3.8 5.2-4l-.4 4.2',
    'M31.6 19.6c.6-1 1.4-1.4 2.2-1.2l-.2 1.8',
    'M14.6 27.6c.4 1.8 1.6 3 3.2 3.2l-.4-2.6',
    'M27.4 30.6c.6 1.4 1.6 2.2 2.8 2.2l-.2-2.6',
    'M11.8 20.4c1.5 2.3 1.5 5.6 0 8.2',
    // The dark of the pool: a slow eddy and the shelf of rock above it.
    'M4.4 8.4c3.6-1.6 7.6-2 11.6-1.2 3 .6 5.6.4 8.4-.6',
    'M30 41.6c3.4-1.8 7.4-2.2 11.4-1.2',
  ],
  detail: [
    oval(16.4, 23.8, 1.3, 2.2),
    oval(21.2, 23.8, 1.4, 2.3),
    oval(26, 23.8, 1.3, 2.2),
    oval(30.6, 23.8, 1.1, 1.9),
    'M5.6 24.8l2.2.3',
    'M8.4 26.2c8.4-1.6 18.8-1.8 28 0',
    // Slow current in the deep water.
    'M6 37.4c4-1 8-1 12 0M20.4 41.6c3-.6 6-.6 9 0M33 11.6c3-.6 6-.6 9.4 0',
  ],
  dots: [[8.8, 23.1, 0.8], [18.2, 20.4, 0.35], [23.6, 19.9, 0.35], [28.4, 20.5, 0.35], [33, 21.6, 0.35]],
};

/** The eel's body, snaking up the race from the tail at the right to its head at the left. */
const EEL = tube(
  [[6.4, 33.6], [11.6, 37.2], [17.6, 35.4], [23.4, 39.8], [30, 39.2], [36, 35], [42.4, 36.6]],
  [1.5, 1.7, 1.7, 1.6, 1.3, 0.8, 0.12],
);
const [EEL_EYE_X, EEL_EYE_Y] = EEL.at(0.02, 0.7);
const [EEL_FIN_X, EEL_FIN_Y] = EEL.at(0.08, 1.4);

/** An eel by the wheel: long and dark, coming up the mill race below the turning wheel. */
const eel: Drawing = {
  wash: [
    ['river', 'M3.6 28.6c6.6-1.2 13.4-1.4 20.2-.8 6.8.6 13.4.4 20.4-.8l.2 15.6c-6.8 1.4-13.6 1.8-20.4 1.4-6.8-.4-13.6-.4-20.2.4Z'],
    ['leaf', EEL.outline],
  ],
  line: [
    EEL.outline,
    // The wheel above the race: rim, hub and spokes, paddles dipping into the water.
    ring(31.6, 13.6, 9.4),
    ring(31.6, 13.6, 1.6),
    'M31.6 12V4.2M31.6 15.2v7.8M30 13.6h-7.8M33.2 13.6H41M30.5 12.5l-5.5-5.5M32.7 14.7l5.5 5.5M32.7 12.5l5.5-5.5M30.5 14.7l-5.5 5.5',
    // The race's stone wall and the water running past.
    'M3.6 28.6c6.6-1.2 13.4-1.4 20.2-.8',
    'M3.6 25.4h17.6',
    'M44.4 28c-2.4-.2-4.4 0-6 .6',
  ],
  detail: [
    // Paddle boards at the rim.
    'M31.6 4.2l-1.4-1.4M31.6 23l1.4 1.4M22.2 13.6l-1.4 1.4M41 13.6l1.4-1.4M25 7l-1.8-.6M38.2 20.2l1.8.6M38.2 7l.6-1.8M25 20.2l-.6 1.8',
    // Courses of stone in the wall, and the current along the race.
    'M8.4 25.4v3M14.2 25.4v2.6',
    'M6.6 43c4-.6 8-.6 12 0M26.4 44c4-.6 8-.6 12 0M37.4 31c2-.4 4-.4 6 0',
    // The eel's long fin along its back and its gill fin.
    EEL.spine(0.3, 0.92),
    `M${num(EEL_FIN_X)} ${num(EEL_FIN_Y)}c.8-1 1.8-1.2 2.6-.6`,
  ],
  dots: [[Number(num(EEL_EYE_X)), Number(num(EEL_EYE_Y)), 0.55]],
};

/** The grey mullet, drawn level facing right before it is thrown into its leap. */
const MULLET_BODY =
  'M40.4 24.4C39.6 22 37 20.6 33 20.2 27 19.6 20 20.2 14.6 22.2L8.4 17.8C7.8 17.4 7.2 17.8 7.4 18.4L11 24.4 7.4 30.4C7.2 31 7.8 31.4 8.4 31L14.6 26.6C20 28.6 27 29.2 33 28.6 37 28.2 39.6 26.8 40.4 24.4Z';
const MULLET_FINS = [
  'M29.4 20C28.8 18 27.6 16.8 26 16.4L24.8 20.2',
  'M19.8 21C19.4 19.2 18.4 18.4 17 18.2L16.2 21.8',
  'M34.2 23.6C32.4 22.8 30.6 22.8 29 23.8 30.4 24.6 32.2 24.6 34.2 23.6Z',
  'M25.4 28.8C24.8 30.4 23.6 31.4 22 31.6L22.6 28.6',
  'M19.2 28C18.6 29.4 17.6 30.2 16.2 30.4L16.8 27.4',
];
const MULLET_TILT: [number, number, number, number, number] = [-34, 24, 24, -1, -2];
const leap = (d: string): string => turn(d, ...MULLET_TILT);

/** Grey mullet: leaping clear of the creek for no reason anyone knows, the water still ringing below. */
const mullet: Drawing = {
  wash: [
    ['river', leap(MULLET_BODY)],
    ['river', 'M3.6 39c6.6-1.4 13.4-1.6 20.4-1 6.8.6 13.4.4 20.4-1l-.2 4.8c-6.8 1.4-13.6 1.8-20.4 1.4-6.8-.4-13.6-.4-20.2.4Z'],
  ],
  line: [
    leap(MULLET_BODY),
    ...MULLET_FINS.map(leap),
    leap('M40.4 24.6L38.8 25.2'),
    leap('M35 21C34 23 34 26 35.2 27.8'),
    // The creek's surface, broken where it left, with the drops falling back.
    'M3.6 39c6.6-1.4 13.4-1.6 20.4-1 6.8.6 13.4.4 20.4-1',
    'M12.4 37.2c.2-1.6.8-2.8 1.8-3.6M16.6 37c0-1.2.4-2.2 1.2-3',
  ],
  detail: [
    // The grey stripes along its flank and the clear lid over its eye.
    leap('M15 23.8C22 22.4 30 22 36 22.8M15.4 25.6C22 25 29 24.8 35.6 25.4'),
    ring(...(turnPt(37.2, 23.4, ...MULLET_TILT) as Pt), 1.3),
    // Rings spreading where it broke the surface.
    oval(14.6, 39.4, 6.6, 1.4),
    oval(14.6, 40.2, 10.4, 2.4),
  ],
  dots: [
    turnPt(37.2, 23.4, ...MULLET_TILT).concat(0.65) as [number, number, number],
    [10.6, 33.2, 0.4], [19.4, 32.6, 0.4], [14.2, 31.2, 0.35], [8.6, 35.6, 0.35],
  ],
};

const sheepPose: Drawing = {
  wash: [['straw', 'M12 17c-5 0-7 6-4 9-2 5 2 9 7 8 5 3 12 2 15-2 5-1 7-7 3-11-1-5-8-7-12-4-3-2-6-2-9 0Z']],
  line: ['M12 17c-5 0-7 6-4 9-2 5 2 9 7 8 5 3 12 2 15-2 5-1 7-7 3-11-1-5-8-7-12-4-3-2-6-2-9 0Z', 'M29 19c0-4 4-6 7-3l2 8c0 3-4 5-6 2Z', 'M32 16l-4-3M36 16l5-2', 'M12 33v8h3M17 35v5h2M23 34v7h3M29 32l-2 5 3 1', 'M6 42c12-1 26-1 36 0'],
  detail: ['M12 22c0-2 4-3 5-1M21 20c2-2 5-1 5 1M14 29c1-2 4-2 5 0', 'M34 25h2'],
  dots: [[34, 20, .7]],
};

export const CREATURES: Record<string, Drawing> = {
  'sheep-pose': sheepPose,
  newt,
  'deer-crossing': deerCrossing,
  serow,
  'deer-clearing': deerClearing,
  fox,
  'winter-deer': winterDeer,
  swallowtails,
  'moon-moth': moonMoth,
  'hawk-moth': hawkMoth,
  otter,
  tanuki,
  mudskipper,
  starfish,
  'shore-crab': shoreCrab,
  seal,
  char,
  'cherry-salmon': cherrySalmon,
  eel,
  mullet,
};

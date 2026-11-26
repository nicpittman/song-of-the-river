/**
 * Wildlife and livestock stand-ins. Every animal is drawn side-on (or from
 * above, for things in flight or swimming) facing RIGHT, so the game mirrors
 * it to face its direction of travel. Walking and running animals share one
 * leg rig: two-bone legs placed by a gait, far legs darker and drawn first.
 */

import { type Ctx, type Painted, type Painter, type Pt, ball, blob, bone, canvasOf, curve, darken, ellipse, ik, lighten, line, painted, ripples, rgba, shadow } from './common';
import { mulberry32 } from '../../core/rng';

// ---------------------------------------------------------------------------
// The leg rig

interface Step {
  /** Foot position fore (+1) or aft (-1) of the hip. */
  s: number;
  /** 0 on the ground, 1 at full lift. */
  lift: number;
}
interface Pose {
  rf: Step;
  lf: Step;
  rh: Step;
  lh: Step;
}
interface Rig {
  fore: Pt;
  hind: Pt;
  /** Offset of the far (left) legs from the near ones. */
  far: Pt;
  foreLen: [number, number];
  hindLen: [number, number];
  /** Widths at hip, joint and foot. */
  foreW: [number, number, number];
  hindW: [number, number, number];
  ground: number;
  stride: number;
  liftH: number;
  upper: string;
  lower: string;
  hoof: string;
  hoofR: number;
}

const frac = (x: number): number => x - Math.floor(x);
const smoothstep = (x: number): number => x * x * (3 - 2 * x);

function step(t: number, duty: number): Step {
  const u = frac(t);
  if (u < duty) return { s: 1 - (2 * u) / duty, lift: 0 };
  const v = (u - duty) / (1 - duty);
  return { s: -1 + 2 * smoothstep(v), lift: Math.sin(Math.PI * v) };
}

/** A four-beat walk: left hind, left fore, right hind, right fore. */
function walk(t: number): Pose {
  return { lh: step(t, 0.62), lf: step(t + 0.75, 0.62), rh: step(t + 0.5, 0.62), rf: step(t + 0.25, 0.62) };
}

/** A two-beat trot: diagonal pairs together. */
function trot(t: number): Pose {
  return { lf: step(t, 0.5), rh: step(t, 0.5), rf: step(t + 0.5, 0.5), lh: step(t + 0.5, 0.5) };
}

const STAND: Pose = { rf: { s: 0.15, lift: 0 }, lf: { s: -0.15, lift: 0 }, rh: { s: -0.1, lift: 0 }, lh: { s: 0.2, lift: 0 } };

function legs(ctx: Ctx, rig: Rig, pose: Pose, near: boolean): void {
  const order: [Step, boolean][] = near ? [[pose.rh, false], [pose.rf, true]] : [[pose.lh, false], [pose.lf, true]];
  const shade = near ? 0 : 0.32;
  for (const [st, fore] of order) {
    const hip: Pt = fore ? [...rig.fore] : [...rig.hind];
    if (!near) {
      hip[0] += rig.far[0];
      hip[1] += rig.far[1];
    }
    const groundY = rig.ground + (near ? 0 : rig.far[1] * 0.6);
    const foot: Pt = [hip[0] + st.s * rig.stride, groundY - st.lift * rig.liftH];
    const [l1, l2] = fore ? rig.foreLen : rig.hindLen;
    const [w0, w1, w2] = fore ? rig.foreW : rig.hindW;
    const joint = ik(hip, foot, l1, l2, fore);
    bone(ctx, hip, joint, w0, w1, darken(rig.upper, shade));
    bone(ctx, joint, foot, w1, w2, darken(rig.lower, shade));
    if (rig.hoofR > 0) ellipse(ctx, foot[0] + 0.25, foot[1] - rig.hoofR * 0.3, rig.hoofR * 1.1, rig.hoofR * 0.75, darken(rig.hoof, shade * 0.5));
  }
}

// ---------------------------------------------------------------------------
// Deer: sika hind, stag and fawn, walking.

interface DeerKind {
  k: number;
  coat: string;
  spots: number;
  antlers: boolean;
  head: number;
  legs: number;
  neck: number;
}

const DEER: Record<'deer' | 'stag' | 'fawn', DeerKind> = {
  deer: { k: 1, coat: '#a9653a', spots: 1, antlers: false, head: 1, legs: 1, neck: 0 },
  stag: { k: 1.12, coat: '#8c5634', spots: 0.45, antlers: true, head: 1, legs: 1, neck: 1.6 },
  fawn: { k: 0.66, coat: '#b9733f', spots: 1.4, antlers: false, head: 1.22, legs: 1.12, neck: -0.4 },
};

function deerPainter(kind: DeerKind, frame: number): Painted {
  const top = kind.antlers ? 12 : 1;
  const legExtra = (kind.legs - 1) * 20;
  const W = 60;
  const H = 50 + top + legExtra;
  const [canvas, ctx] = canvasOf(W * kind.k, H * kind.k, 3);
  ctx.scale(kind.k, kind.k);
  ctx.translate(0, top);
  const ground = 47 + legExtra;
  const L = kind.legs;
  const rig: Rig = {
    fore: [38, 27],
    hind: [15.5, 26],
    far: [-1.8, -0.8],
    foreLen: [10.5 * L, 11 * L],
    hindLen: [11.6 * L, 12.4 * L],
    foreW: [4.2, 2.1, 1.5],
    hindW: [5.2, 2.3, 1.5],
    ground,
    stride: 5.2,
    liftH: 4.2,
    upper: darken(kind.coat, 0.08),
    lower: darken(kind.coat, 0.16),
    hoof: '#2e2620',
    hoofR: 1.1,
  };
  const pose = walk(frame / 4);
  const bob = frame % 2 ? 0.6 : 0;
  shadow(ctx, 29, ground + 0.6, 20, 3.4);
  legs(ctx, rig, pose, false);
  // Tail: short, white beneath a dark stripe.
  blob(ctx, [[10, 20.5], [7.6, 22.6], [7.4, 26], [9.2, 25.4], [10.8, 22.6]], '#f2ece0', { dark: 0.2 });
  line(ctx, [[9.6, 21], [8.3, 23.4]], 0.9, '#3a2a20');
  const n = kind.neck;
  const body: Pt[] = [
    [10, 21.5], [18, 18.4], [30, 19 + bob * 0.3], [39, 16.4 - n * 0.3], [43.4 - n * 0.5, 10.5], [45.6 - n * 0.4, 6.5 + bob],
    [50.2, 11.4 + bob], [47.8 + n * 0.3, 19.5], [45.4, 26.4], [41, 30.8], [32, 31.8], [22, 31.4], [15, 31.2], [9.4, 28.4], [8.2, 24.4],
  ];
  legs(ctx, rig, pose, true);
  blob(ctx, body, kind.coat, { light: 0.3, dark: 0.36 }, () => {
    // Pale belly and throat.
    const g = ctx.createLinearGradient(0, 25, 0, 32);
    g.addColorStop(0, rgba('#ecd4ad', 0));
    g.addColorStop(1, rgba('#ecd4ad', 0.85));
    ctx.fillStyle = g;
    ctx.fillRect(12, 25, 34, 8);
    ellipse(ctx, 47.6, 15, 2.4, 4.6, rgba('#ecd4ad', 0.4), 0.3);
    // Dark dorsal line and white rump patch with its dark rim.
    line(ctx, [[12, 20.6], [22, 18.3], [32, 18.6], [39, 16.2]], 1.4, rgba(darken(kind.coat, 0.35), 0.6), true);
    ellipse(ctx, 9.6, 24.2, 2.6, 3.8, rgba('#2f2219', 0.85));
    ellipse(ctx, 9, 24.4, 2, 3.1, '#f2ebdd');
    // Pale spots in loose rows along the back and flank.
    if (kind.spots > 0) {
      let seed = 7;
      const r = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (const [y, x0, x1, step] of [[21.2, 16, 38, 2.9], [24, 15.5, 37, 3.1], [26.8, 18, 33, 3.6]] as const) {
        for (let x = x0; x < x1; x += step / Math.min(1.4, kind.spots)) {
          if (r() > kind.spots) continue;
          ellipse(ctx, x + r() * 1.2, y + r() * 1.1 + (x > 33 ? -(x - 33) * 0.35 : 0), 0.85, 0.62, rgba('#f6e8cc', 0.9));
        }
      }
    }
    if (kind.neck > 0) line(ctx, [[41.5, 12], [44, 9], [47.5, 14]], 3.2, rgba(darken(kind.coat, 0.3), 0.45), true);
  });
  // Head, held up and forward.
  ctx.save();
  ctx.translate(47.5, 8 + bob);
  ctx.scale(kind.head, kind.head);
  ctx.translate(-47.5, -8);
  const earBase: Pt = [47.6, 5.4];
  blob(ctx, [earBase, [44.6, 0.4], [43.4, 0.2], [44.4, 3.6], [46.2, 6.4]], darken(kind.coat, 0.28));
  if (kind.antlers) antlers(ctx, 1.6, true);
  blob(ctx, [[44.6, 7.6], [47, 4.6], [51, 4.2], [55, 7.4], [57.8, 10.4], [56.9, 12.6], [52.6, 12.6], [47.6, 11.4]], lighten(kind.coat, 0.04), { light: 0.34 });
  ellipse(ctx, 57.1, 11.2, 1.25, 1.1, '#2a201a');
  ellipse(ctx, 53.6, 11.8, 2.2, 0.8, rgba('#f0e2c8', 0.6));
  ellipse(ctx, 51.4, 7.4, 0.8, 0.72, '#1f1814');
  ellipse(ctx, 51.15, 7.1, 0.25, 0.25, 'rgba(255,255,255,0.8)');
  blob(ctx, [[46.6, 5.6], [42.8, 1.8], [41.6, 2], [43.2, 4.8], [45.4, 7]], kind.coat, { light: 0.3 });
  ellipse(ctx, 43.6, 3.4, 1.3, 0.6, rgba('#f1dfc4', 0.7), 0.7);
  if (kind.antlers) antlers(ctx, 0, false);
  ctx.restore();
  const ax = 27 / W;
  const r1 = (v: number): number => Math.round(v * 10) / 10;
  return painted(canvas, r1(W * kind.k), r1(H * kind.k), [ax, (ground + top) / H]);
}

function antlers(ctx: Ctx, dx: number, far: boolean): void {
  const c = far ? '#8f7a5e' : '#dccaa6';
  const w = far ? 1 : 1.2;
  ctx.save();
  ctx.translate(dx, far ? -0.4 : 0);
  line(ctx, [[47.8, 4.6], [45.6, -1.6], [42.4, -6.8], [38.6, -10.6]], w, c, true);
  line(ctx, [[47.2, 2.6], [50.4, 1.2]], w * 0.75, c);
  line(ctx, [[45.2, -2.6], [47.6, -6.6]], w * 0.75, c);
  line(ctx, [[41.6, -7.6], [42.4, -11.6]], w * 0.65, c);
  if (!far) line(ctx, [[47.6, 4], [45.4, -1.8], [42.4, -6.4]], 0.45, 'rgba(255,250,235,0.55)', true);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Small and middling mammals.

function hare(bound: boolean): Painted {
  const [canvas, ctx] = canvasOf(22, 18, 4);
  const coat = '#9b7a54';
  shadow(ctx, 11.5, 16.4, 7.5, 1.6);
  if (!bound) {
    bone(ctx, [13.6, 11], [14.2, 16], 1.3, 1, darken(coat, 0.2));
    blob(ctx, [[5, 12.5], [6.2, 8.4], [10, 7], [13.4, 7.6], [15, 10.6], [14.4, 14.4], [11, 16.2], [6.6, 16.2]], coat, { light: 0.32 });
    ellipse(ctx, 9.4, 15.6, 4.2, 0.9, darken(coat, 0.15));
    ellipse(ctx, 5.4, 12.2, 1.4, 1.3, '#f2ece0');
    bone(ctx, [14.6, 11], [15.2, 16], 1.3, 1, coat);
    blob(ctx, [[13.4, 6.2], [12.6, 0.6], [13.6, 0.4], [15.2, 5.6]], darken(coat, 0.25));
    blob(ctx, [[12.6, 7.4], [14, 5], [16.6, 5], [18.6, 7.4], [18, 9.2], [14.6, 9.8]], coat, { light: 0.34 });
    blob(ctx, [[14.4, 6], [14.6, 0.2], [15.8, 0.4], [16, 5.8]], lighten(coat, 0.05));
    ellipse(ctx, 15.4, 3.4, 0.35, 2, rgba('#2a1f18', 0.5));
  } else {
    bone(ctx, [6, 11], [1.6, 13.6], 2, 1, darken(coat, 0.15));
    bone(ctx, [15.4, 11.8], [19.4, 15.2], 1.1, 0.9, darken(coat, 0.3));
    blob(ctx, [[3.4, 10.2], [6, 7.2], [11.6, 6.6], [16, 7.4], [17.4, 10], [14, 12.4], [8, 12.6], [4.4, 12.4]], coat, { light: 0.32 });
    ellipse(ctx, 3.6, 9.8, 1.3, 1.2, '#f2ece0');
    bone(ctx, [7, 11.4], [2.4, 14.6], 2.2, 1.1, coat);
    bone(ctx, [14.8, 11.6], [18.6, 13.8], 1.2, 0.9, coat);
    blob(ctx, [[15.4, 6.2], [11.4, 3.4], [11, 4.2], [14.6, 7.4]], darken(coat, 0.22));
    blob(ctx, [[14.6, 7.6], [16.6, 5.4], [19.4, 5.8], [21, 8.2], [19.6, 9.6], [16.4, 9.6]], coat, { light: 0.34 });
    blob(ctx, [[16.2, 6], [12, 2.6], [11.6, 3.4], [15.4, 7]], lighten(coat, 0.06));
  }
  ellipse(ctx, bound ? 18.6 : 16.6, bound ? 7.1 : 6.5, 0.5, 0.5, '#1d1612');
  return painted(canvas, 22, 18, [0.5, 16.4 / 18]);
}

function fox(frame: number): Painted {
  const W = 48;
  const H = 27;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const coat = '#c4652d';
  const ground = 24.6;
  const up = frame ? -1.2 : 0;
  const rig: Rig = {
    fore: [34, 14.6 + up], hind: [15.4, 14 + up], far: [-1.4, -0.6],
    foreLen: [5, 5.6], hindLen: [5.6, 6], foreW: [2.6, 1.3, 1], hindW: [3.6, 1.5, 1],
    ground, stride: 6, liftH: 3, upper: coat, lower: '#2f2520', hoof: '#2a201b', hoofR: 0.7,
  };
  const pose: Pose = frame
    ? { rf: { s: -0.8, lift: 0.7 }, lf: { s: -0.4, lift: 0.4 }, rh: { s: 0.9, lift: 0.6 }, lh: { s: 0.5, lift: 0.25 } }
    : { rf: { s: 1.1, lift: 0.45 }, lf: { s: 0.75, lift: 0.1 }, rh: { s: -1.1, lift: 0.35 }, lh: { s: -0.8, lift: 0.05 } };
  shadow(ctx, 25, ground + 0.4, 15, 2.4);
  legs(ctx, rig, pose, false);
  ctx.save();
  ctx.translate(0, up);
  // The brush: long, full, lifted a little when running, with a white tip.
  const tailLift = frame ? -1.6 : 0.4;
  blob(ctx, [[13, 10.6], [8, 9.8 + tailLift], [2.6, 11 + tailLift], [1, 13.2 + tailLift], [3.6, 14.4 + tailLift], [8.4, 14.2 + tailLift * 0.5], [13.4, 13.8]], coat, { light: 0.3 }, () => {
    ellipse(ctx, 1.8, 12.6 + tailLift, 2.6, 2.4, '#f3ece0');
  });
  ctx.restore();
  legs(ctx, rig, pose, true);
  ctx.save();
  ctx.translate(0, up);
  blob(ctx, [[11.6, 12.2], [16, 9.6], [25, 10.2], [31.6, 9.4], [35.4, 7.8], [38.6, 10], [37.2, 14], [32, 16.4], [23, 16], [15.4, 16.2], [11.2, 14.8]], coat, { light: 0.32 }, () => {
    ellipse(ctx, 36, 13.4, 3, 3.2, '#f1e7d6');
    ellipse(ctx, 24, 16.4, 8, 1.6, rgba('#efe2cc', 0.55));
  });
  blob(ctx, [[36, 6.4], [35.4, 2], [38.6, 5.4]], '#3b2a22');
  blob(ctx, [[33.6, 7.8], [36.4, 5.2], [39.6, 5.8], [44.6, 8.6], [45, 9.8], [40.8, 11], [35.6, 11.2]], coat, { light: 0.36 }, () => {
    ellipse(ctx, 41.6, 10.6, 4, 1.4, '#f3ebde');
  });
  blob(ctx, [[37.6, 6.2], [37.6, 1.8], [40.4, 5.4]], darken(coat, 0.05));
  ellipse(ctx, 38.6, 4.6, 0.6, 1.1, '#2c201a');
  ellipse(ctx, 44.8, 9.1, 0.75, 0.65, '#1c1512');
  ellipse(ctx, 40.6, 7.6, 0.6, 0.45, '#1c1512');
  ctx.restore();
  return painted(canvas, W, H, [24 / W, ground / H]);
}

function wolf(frame: number): Painted {
  const W = 58;
  const H = 36;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const coat = '#8d8a80';
  const ground = 33.4;
  const rig: Rig = {
    fore: [42, 19], hind: [17.4, 18.6], far: [-1.6, -0.8],
    foreLen: [7, 7.8], hindLen: [7.8, 8.4], foreW: [3.4, 1.7, 1.3], hindW: [4.6, 1.9, 1.3],
    ground, stride: 5.4, liftH: 3.2, upper: darken(coat, 0.05), lower: lighten(coat, 0.12), hoof: '#3a3530', hoofR: 0.8,
  };
  const pose = trot(frame ? 0.62 : 0.12);
  shadow(ctx, 30, ground + 0.5, 19, 3);
  legs(ctx, rig, pose, false);
  blob(ctx, [[14.6, 13.8], [10.6, 16], [6.6, 21.6], [5.6, 25], [7.8, 25], [11.8, 20.6], [15.6, 18]], darken(coat, 0.1));
  ellipse(ctx, 6.4, 24.4, 1.2, 1.4, '#3a3632');
  legs(ctx, rig, pose, true);
  blob(ctx, [[13.4, 16], [18, 12.4], [30, 12.6], [38.6, 11], [44.2, 10.4], [47.6, 13.6], [46.4, 19.2], [41.6, 22.4], [31, 21.8], [20, 21.6], [14, 20.4]], coat, { light: 0.3 }, () => {
    line(ctx, [[17, 13], [28, 12.8], [40, 11.4]], 3.4, rgba('#4e4a44', 0.55), true);
    const g = ctx.createLinearGradient(0, 18, 0, 22.5);
    g.addColorStop(0, rgba('#e8e1d2', 0));
    g.addColorStop(1, rgba('#e8e1d2', 0.85));
    ctx.fillStyle = g;
    ctx.fillRect(14, 18, 34, 5);
    ellipse(ctx, 45.6, 17, 2.4, 3.4, rgba('#ebe4d6', 0.75));
  });
  const hy = frame ? 0.5 : 0;
  blob(ctx, [[45.2, 9.2 + hy], [44.8, 4.6 + hy], [47.6, 8.2 + hy]], '#4b4741');
  blob(ctx, [[43.2, 11 + hy], [45.8, 8 + hy], [49.6, 8.2 + hy], [55.6, 11.4 + hy], [55.8, 13 + hy], [51, 14.6 + hy], [45.4, 14.8 + hy]], coat, { light: 0.34 }, () => {
    ellipse(ctx, 51.4, 14.4 + hy, 4.4, 1.6, '#ece6da');
  });
  blob(ctx, [[46.8, 8.4 + hy], [47, 3.8 + hy], [49.6, 8 + hy]], darken(coat, 0.08));
  ellipse(ctx, 55.4, 11.9 + hy, 0.85, 0.7, '#1f1c19');
  ellipse(ctx, 50.4, 9.9 + hy, 0.65, 0.45, '#2a2018');
  return painted(canvas, W, H, [29 / W, ground / H]);
}

function bear(frame: number): Painted {
  const W = 74;
  const H = 46;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const coat = '#2c2a28';
  const ground = 43;
  const water = 39.6;
  const rig: Rig = {
    fore: [49, 28], hind: [20, 27.6], far: [-2, -1],
    foreLen: [7.6, 8], hindLen: [8, 8.4], foreW: [6.6, 4.6, 3.6], hindW: [7.6, 4.6, 3.6],
    ground, stride: 3, liftH: 2, upper: coat, lower: coat, hoof: '#1d1b1a', hoofR: 0,
  };
  legs(ctx, rig, STAND, false);
  legs(ctx, rig, STAND, true);
  blob(ctx, [[13, 24], [16, 16.4], [26, 13.2], [38, 13.6], [46, 12], [53, 15.4], [56, 22.6], [52, 30.6], [40, 32], [27, 31.6], [17, 31], [12.6, 28.2]], coat, { light: 0.24, dark: 0.3 }, () => {
    line(ctx, [[17, 17.4], [26, 14], [40, 14], [48, 13]], 2.6, 'rgba(160,150,140,0.28)', true);
  });
  // Head: lowered over the water, or raised with a fish across the jaws.
  ctx.save();
  if (frame) {
    ctx.translate(55, 17);
    ctx.rotate(-0.22);
    ctx.translate(-55, -17);
  } else {
    ctx.translate(55, 17);
    ctx.rotate(0.42);
    ctx.translate(-55, -17);
  }
  ball(ctx, 52.4, 13.2, 2.2, 2.2, coat, 0.2);
  blob(ctx, [[50.6, 16.2], [53, 12.6], [58, 12.4], [63.6, 15.6], [66.4, 18.4], [64.6, 21], [58, 21.4], [52.4, 20.4]], coat, { light: 0.26 }, () => {
    ellipse(ctx, 63.4, 18.6, 3.8, 2.6, '#8a6c50');
  });
  ellipse(ctx, 66.2, 17.8, 1.1, 1, '#141210');
  ellipse(ctx, 59, 15.6, 0.7, 0.6, '#0f0d0c');
  ellipse(ctx, 58.8, 15.4, 0.22, 0.22, 'rgba(255,255,255,0.7)');
  ball(ctx, 55.4, 12, 2, 2, coat, 0.2);
  if (frame) {
    // A salmon held crosswise in the jaws, bending.
    blob(ctx, [[57, 22.4], [61, 20.4], [66, 20.2], [70.6, 21.4], [72.6, 19.4], [72.4, 23.6], [70, 22.6], [65.6, 23.6], [60, 24]], '#b9b4a8', { light: 0.4 }, () => {
      ellipse(ctx, 64, 23.2, 6, 1.2, rgba('#c25b48', 0.75));
    });
  }
  ctx.restore();
  // The pale chest crescent.
  line(ctx, [[49.4, 21.6], [52.2, 24.2], [55, 21.2]], 1.6, '#e9dfc8', true);
  // Standing in the shallows: legs fade under the surface, rings round them.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createLinearGradient(0, water - 1, 0, ground + 1);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.75)');
  g.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.fillStyle = g;
  ctx.fillRect(0, water - 1, W, H);
  ctx.restore();
  for (const x of [18, 23, 46, 51]) ripples(ctx, x, water + 0.6, 4, 1.2, 0.6);
  return painted(canvas, W, H, [35 / W, water / H]);
}

function boar(frame: number): Painted {
  const W = 52;
  const H = 30;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const coat = '#5c4b3c';
  const ground = 27.6;
  const rig: Rig = {
    fore: [37, 19], hind: [15.6, 18.6], far: [-1.4, -0.7],
    foreLen: [4.6, 4.6], hindLen: [4.8, 5], foreW: [3.6, 1.8, 1.4], hindW: [4.4, 1.8, 1.4],
    ground, stride: 4.4, liftH: 2.4, upper: coat, lower: darken(coat, 0.25), hoof: '#221c18', hoofR: 0.8,
  };
  const pose = trot(frame ? 0.62 : 0.12);
  shadow(ctx, 26, ground + 0.5, 17, 2.8);
  legs(ctx, rig, pose, false);
  line(ctx, [[12.6, 13.6], [10.6, 16.4], [10.8, 18.8]], 0.8, darken(coat, 0.2), true);
  legs(ctx, rig, pose, true);
  const bob = frame ? 0.5 : 0;
  blob(ctx, [[12.2, 15], [16, 11.4], [27, 9.4], [36, 7.6 + bob], [42, 10.4 + bob], [43.8, 16 + bob], [40, 21.4], [30, 21.8], [19, 21.6], [12.6, 19.4]], coat, { light: 0.28 }, () => {
    for (let x = 16; x < 41; x += 1.1) line(ctx, [[x, 11.6 - (x - 16) * 0.12 + bob * 0.5], [x - 1, 9.4 - (x - 16) * 0.12 + bob * 0.5]], 0.6, rgba('#2c231c', 0.55));
    ellipse(ctx, 30, 21.6, 12, 2, rgba('#3a2f26', 0.4));
  });
  blob(ctx, [[39.6, 9.6 + bob], [43.6, 9 + bob], [48.4, 13.6 + bob], [50.8, 16.6 + bob], [50.4, 18.4 + bob], [46.4, 18 + bob], [41.4, 17 + bob]], darken(coat, 0.04), { light: 0.3 });
  ellipse(ctx, 50.6, 17.4 + bob, 0.9, 1.1, '#3e3029');
  line(ctx, [[47.8, 16.4 + bob], [49, 14.8 + bob]], 0.7, '#ece4d2');
  blob(ctx, [[40.8, 9.6 + bob], [40.6, 6.4 + bob], [42.8, 8.6 + bob]], darken(coat, 0.2));
  ellipse(ctx, 44.6, 11.6 + bob, 0.5, 0.42, '#16110e');
  return painted(canvas, W, H, [27 / W, ground / H]);
}

function tanuki(frame: number): Painted {
  const W = 36;
  const H = 23;
  const [canvas, ctx] = canvasOf(W, H, 4);
  const coat = '#8c7a60';
  const ground = 21;
  const rig: Rig = {
    fore: [24, 14.6], hind: [11, 14.4], far: [-1.2, -0.5],
    foreLen: [3, 3.6], hindLen: [3.2, 3.8], foreW: [2.4, 1.5, 1.2], hindW: [2.8, 1.5, 1.2],
    ground, stride: 3.2, liftH: 1.8, upper: '#3b332b', lower: '#2c2621', hoof: '#221d19', hoofR: 0.5,
  };
  const pose = trot(frame ? 0.62 : 0.12);
  shadow(ctx, 18, ground + 0.3, 12, 2.2);
  legs(ctx, rig, pose, false);
  blob(ctx, [[8, 10.4], [4.6, 10.6], [2, 13.2], [2.6, 15.6], [5.6, 15.2], [9, 13.6]], coat, { light: 0.3 }, () => {
    line(ctx, [[3.6, 11.4], [3.4, 15.4]], 1, rgba('#3a3028', 0.7));
    ellipse(ctx, 2, 14.4, 1.4, 1.6, '#3a3028');
  });
  legs(ctx, rig, pose, true);
  blob(ctx, [[7.6, 12.4], [10, 9], [17, 8], [24, 8.6], [28, 11.2], [27, 15.4], [21, 17], [12, 17], [8, 15.2]], coat, { light: 0.32 }, () => {
    line(ctx, [[11, 9.2], [17, 8.4], [23, 9]], 2.2, rgba('#4d4134', 0.5), true);
    ellipse(ctx, 23.6, 15, 4, 2.4, rgba('#2f2822', 0.8));
  });
  const hy = frame ? 0.4 : 0;
  blob(ctx, [[25.6, 9 + hy], [26, 5.8 + hy], [28.4, 8 + hy]], '#3a3028');
  blob(ctx, [[24.6, 10.6 + hy], [27, 7.4 + hy], [30.6, 7.6 + hy], [34.4, 10.4 + hy], [34, 12.2 + hy], [30, 13.4 + hy], [26, 13.2 + hy]], lighten(coat, 0.18), { light: 0.3 }, () => {
    ellipse(ctx, 29.6, 10.6 + hy, 2.6, 1.5, '#2e2721');
  });
  ellipse(ctx, 34.2, 10.9 + hy, 0.6, 0.55, '#1a1512');
  ellipse(ctx, 29.9, 10.2 + hy, 0.35, 0.35, 'rgba(255,255,255,0.6)');
  return painted(canvas, W, H, [18 / W, ground / H]);
}

/**
 * A sheep, side-on from a little above: a deep woolly body, warm cream on
 * the sunlit back and grey-brown in the shade beneath, its fleece broken by
 * small curls, with a dark face and slim dark legs. `headUp` lifts the head
 * from grazing.
 */
function sheep(headUp: boolean): Painted {
  const W = 34;
  const H = 26;
  const [canvas, ctx] = canvasOf(W, H, 4);
  const rng = mulberry32(headUp ? 23 : 29);
  const ground = 24.4;
  const rig: Rig = {
    fore: [22.4, 17.6], hind: [9.6, 17.4], far: [1.3, -0.9],
    foreLen: [3.3, 3.7], hindLen: [3.5, 3.7], foreW: [1.25, 0.85, 0.75], hindW: [1.4, 0.85, 0.75],
    ground, stride: 1.6, liftH: 1, upper: '#4d4239', lower: '#3a3029', hoof: '#221c18', hoofR: 0.42,
  };
  const pose: Pose = headUp ? STAND : { rf: { s: 0.5, lift: 0 }, lf: { s: 0.1, lift: 0 }, rh: { s: -0.2, lift: 0 }, lh: { s: 0.25, lift: 0 } };
  shadow(ctx, 16.6, ground + 0.2, 13, 2.6, 0.42);
  legs(ctx, rig, pose, false);
  legs(ctx, rig, pose, true);

  // Grazing, the head hangs below the fleece and is drawn behind it.
  if (!headUp) sheepHead(ctx, [27, 18.6], 1.05);

  const body: Pt[] = [[3.6, 13], [5.2, 8.8], [9.8, 6.4], [16, 5.8], [21.8, 6.4], [25.8, 8.6], [27.4, 12.4], [26.6, 16.6], [22.8, 19.4], [15.6, 20.2], [8.6, 19.8], [4.6, 17.4]];
  blob(ctx, body, '#e3d9c1', { light: 0.3, dark: 0.2 }, () => {
    // The body turns away from the light: cream on the back, warm grey under the belly.
    const g = ctx.createLinearGradient(0, 6, 0, 20.5);
    g.addColorStop(0, 'rgba(250,244,226,0.6)');
    g.addColorStop(0.45, 'rgba(226,216,192,0)');
    g.addColorStop(1, 'rgba(120,104,84,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 5, W, 16);
    // Curls: a small shaded crescent under a lit crown, scattered all over.
    for (let i = 0; i < 120; i++) {
      const x = 4 + rng() * 23;
      const y = 6.4 + rng() * 13.4;
      const r = 0.9 + rng() * 0.5;
      const under = (y - 6) / 14;
      ctx.strokeStyle = rgba('#7d6a52', 0.18 + under * 0.25);
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0.15 * Math.PI, 0.95 * Math.PI);
      ctx.stroke();
      if (under < 0.7) ellipse(ctx, x - 0.25, y - 0.35, r * 0.65, r * 0.4, rgba('#fbf5e4', 0.5 * (1 - under)));
    }
  });
  // Loose curls breaking the outline along the back and rump, so it reads as wool rather than a cut-out.
  for (let x = 5.5; x < 26; x += 1.9) {
    const y = 6.6 + Math.pow(Math.abs(x - 15.5) / 10, 2) * 2.6 + rng() * 0.4;
    ellipse(ctx, x + rng() * 0.5, y, 1.1, 0.75, x < 16 ? '#f6efdc' : '#ebe2cc');
  }
  ellipse(ctx, 4, 11.8, 1.1, 1.5, '#d9cdb2');

  if (headUp) sheepHead(ctx, [27.6, 9.4], 0.3);
  return painted(canvas, W, H, [16.5 / W, ground / H]);
}

/** The dark, long face, ears set out sideways and a cap of wool on the poll. `down` tilts it toward the grass, in radians. */
function sheepHead(ctx: Ctx, at: Pt, down: number): void {
  const face = '#40362f';
  ctx.save();
  ctx.translate(at[0], at[1]);
  ctx.rotate(down);
  // The far ear, the face from poll to muzzle, then the near ear with its paler inside.
  blob(ctx, [[0.2, -1.8], [-0.6, -4], [0.4, -4.2], [1.4, -2]], darken(face, 0.2));
  blob(ctx, [[-2, -1.6], [0.6, -2.6], [3.4, -1.8], [5.6, 0], [6, 1.6], [4.4, 2.6], [1, 2.4], [-1.8, 1.2]], face, { light: 0.34, dark: 0.3 });
  ellipse(ctx, 5.4, 1.3, 0.45, 0.38, '#1d1714');
  ellipse(ctx, 2.2, -0.6, 0.48, 0.42, '#16110e');
  ellipse(ctx, 2.05, -0.75, 0.15, 0.15, 'rgba(255,255,255,0.7)');
  blob(ctx, [[0, 0.2], [-2.8, 1.4], [-3.2, 2.4], [-0.6, 1.6]], face, { light: 0.3 });
  ellipse(ctx, -1.6, 1.6, 1, 0.3, rgba('#8a6a5a', 0.7), -0.3);
  ellipse(ctx, -0.8, -1.6, 1.4, 1, '#e9e0ca');
  ellipse(ctx, -1.1, -1.9, 0.8, 0.5, '#f8f2e2');
  ctx.restore();
}

function ox(): Painted {
  const W = 62;
  const H = 44;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const coat = '#3d3129';
  const ground = 41.4;
  const rig: Rig = {
    fore: [45, 28], hind: [16.4, 27.6], far: [-2, -1],
    foreLen: [6.4, 7.4], hindLen: [7, 7.8], foreW: [5, 2.6, 2.2], hindW: [6.4, 2.8, 2.2],
    ground, stride: 4, liftH: 2, upper: coat, lower: darken(coat, 0.1), hoof: '#1b1714', hoofR: 1.2,
  };
  const pose: Pose = { rf: { s: 0.5, lift: 0 }, lf: { s: -0.3, lift: 0 }, rh: { s: -0.35, lift: 0 }, lh: { s: 0.35, lift: 0 } };
  shadow(ctx, 32, ground + 0.6, 22, 3.6);
  legs(ctx, rig, pose, false);
  line(ctx, [[11.2, 17], [9.6, 22], [9.4, 29]], 1, darken(coat, 0.2), true);
  ellipse(ctx, 9.4, 29.6, 1.1, 1.8, '#1f1a16');
  legs(ctx, rig, pose, true);
  blob(ctx, [[10.4, 20], [13, 14.6], [22, 13.2], [33, 13.6], [41.6, 11.4], [48, 13.6], [51, 20], [49.4, 28], [46, 33], [40, 32.6], [30, 32], [19, 32.4], [12.6, 30.4], [10, 25]], coat, { light: 0.3 }, () => {
    line(ctx, [[14, 15], [26, 13.8], [40, 12.4]], 3, 'rgba(150,120,90,0.25)', true);
    ellipse(ctx, 47.6, 30, 3, 4.4, rgba(darken(coat, 0.2), 0.6));
  });
  blob(ctx, [[46.4, 16.6], [49.6, 12.8], [54.4, 13.2], [58.8, 18.4], [60.2, 23], [57.8, 25.2], [53, 23.8], [48.4, 21.4]], coat, { light: 0.32 }, () => {
    ellipse(ctx, 58, 22.4, 2.8, 2.2, '#6d5a4c');
  });
  line(ctx, [[50.2, 14.2], [49.6, 12], [50.8, 10.8]], 1.3, '#bfb196', true);
  line(ctx, [[51.6, 14.2], [51.8, 12.2], [53.2, 11.2]], 1.4, '#ddd2b8', true);
  blob(ctx, [[49.4, 15.4], [46.4, 14.6], [46, 16.2], [48.6, 17]], darken(coat, 0.1));
  ellipse(ctx, 54, 16.6, 0.7, 0.6, '#120f0c');
  ellipse(ctx, 53.8, 16.4, 0.22, 0.22, 'rgba(255,255,255,0.6)');
  return painted(canvas, W, H, [31 / W, ground / H]);
}

function chicken(): Painted {
  const [canvas, ctx] = canvasOf(15, 15, 5);
  const feather = '#b8703a';
  shadow(ctx, 7.6, 13.6, 4.6, 1.2);
  line(ctx, [[6.4, 10.6], [6.2, 13.6]], 0.55, '#d4a046');
  line(ctx, [[8.2, 10.6], [8.6, 13.6]], 0.55, '#e0ae52');
  blob(ctx, [[2.4, 6.4], [1.4, 2.6], [3, 2], [5, 5.2], [8, 5.2], [10.6, 4.6], [11.6, 7.4], [10.2, 10.6], [6.8, 11.6], [3.8, 10]], feather, { light: 0.32 }, () => {
    ellipse(ctx, 6.4, 7.8, 3, 1.8, darken(feather, 0.2), -0.2);
    ellipse(ctx, 2, 3, 1.6, 1.4, '#3c2b20');
  });
  ball(ctx, 10.8, 4.4, 1.9, 1.9, lighten(feather, 0.1));
  blob(ctx, [[9.8, 2.8], [10.4, 1.2], [11.2, 1.8], [11.8, 1.2], [12.2, 2.6], [11.2, 3]], '#c8392b');
  ellipse(ctx, 11.6, 6.4, 0.5, 0.8, '#c8392b');
  blob(ctx, [[12.4, 4], [14, 4.6], [12.4, 5.2]], '#e2b04e');
  ellipse(ctx, 11.4, 4, 0.35, 0.35, '#1a1410');
  return painted(canvas, 15, 15, [0.5, 13.6 / 15]);
}

function monkey(): Painted {
  const [canvas, ctx] = canvasOf(24, 26, 4);
  const fur = '#8e806c';
  shadow(ctx, 12, 24, 8, 1.8);
  bone(ctx, [6, 21], [3.6, 23.8], 1.4, 1, darken(fur, 0.2));
  blob(ctx, [[5.4, 17.6], [6, 11.4], [9.6, 8.2], [14, 8.4], [16.4, 12], [16.6, 18], [14.6, 23], [9, 24.2], [5.6, 22]], fur, { light: 0.32 });
  bone(ctx, [14, 12.4], [16.2, 19.6], 2.2, 1.6, darken(fur, 0.08));
  ellipse(ctx, 16.6, 20.4, 1.3, 1, '#c99a86');
  blob(ctx, [[8, 19], [13.6, 18.6], [16.6, 22.4], [15, 24.2], [9, 24]], darken(fur, 0.06), { light: 0.2 });
  ball(ctx, 14.2, 6.4, 4.4, 4.2, fur, 0.28);
  blob(ctx, [[14.6, 4.6], [17.6, 4.4], [19.4, 6.4], [18.8, 9], [16, 9.4], [14.6, 7.6]], '#d47b6c', { light: 0.3 });
  ellipse(ctx, 17.4, 5.8, 0.55, 0.45, '#2a1d17');
  ellipse(ctx, 12.4, 6.4, 1.1, 1.3, '#b9826f');
  return painted(canvas, 24, 26, [0.5, 24 / 26]);
}

function squirrel(): Painted {
  const [canvas, ctx] = canvasOf(15, 15, 5);
  const fur = '#97603a';
  shadow(ctx, 7.6, 13.8, 4.6, 1.1);
  blob(ctx, [[5.4, 12], [2, 10.4], [1, 6], [2.4, 2], [5, 1], [6.6, 2.6], [5, 4.8], [4.6, 8.4], [6.4, 11]], fur, { light: 0.3 }, () => {
    ellipse(ctx, 3, 3.6, 2.6, 2, rgba(lighten(fur, 0.3), 0.55));
  });
  blob(ctx, [[5.6, 12.8], [5.8, 8.6], [8, 6.4], [10.4, 7.6], [10.8, 11], [9.6, 13.4]], fur, { light: 0.32 }, () => {
    ellipse(ctx, 10, 10.4, 1.6, 2.4, '#e9dcc4');
  });
  ball(ctx, 9.8, 5.6, 2.5, 2.2, fur, 0.28);
  blob(ctx, [[8.6, 4.4], [8.8, 1.8], [9.8, 3.8]], darken(fur, 0.15));
  ellipse(ctx, 12.2, 6, 0.5, 0.45, '#efe4cc');
  ellipse(ctx, 10.8, 5, 0.42, 0.42, '#160f0b');
  return painted(canvas, 15, 15, [0.5, 13.8 / 15]);
}

function frog(): Painted {
  const [canvas, ctx] = canvasOf(11, 8, 6);
  const skin = '#6f8f3e';
  shadow(ctx, 5.6, 7, 4.4, 1);
  blob(ctx, [[1.4, 6.4], [2, 4.2], [4.4, 3], [7.6, 3], [9.6, 4.4], [9.8, 6], [7.4, 7], [3.6, 7]], skin, { light: 0.36 }, () => {
    line(ctx, [[2.6, 4.2], [8.4, 3.8]], 0.6, rgba('#c9d58a', 0.6));
  });
  bone(ctx, [3, 5.8], [1.4, 7], 1.2, 0.8, darken(skin, 0.15));
  ball(ctx, 7.6, 3, 1, 1, skin, 0.3);
  ellipse(ctx, 7.9, 2.8, 0.4, 0.4, '#1e1a10');
  return painted(canvas, 11, 8, [0.5, 7 / 8]);
}

// ---------------------------------------------------------------------------
// Birds and insects.

/** A soaring black kite from above, heading right: broad fingered wings, forked tail. */
function hawk(frame: number): Painted {
  const W = 36;
  const H = 48;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const brown = '#6e5038';
  const t = frame ? 2.6 : 0;
  const sw = frame ? 2.2 : 0;
  for (const side of [-1, 1]) {
    const y = (v: number): number => 24 + side * v;
    const pts: Pt[] = [[22, y(2.4)], [23.8, y(8)], [23.2, y(14)], [21.6 - sw, y(19.4 - t)], [20.6 - sw, y(22.6 - t)], [19.2 - sw, y(21.4 - t)], [18.4 - sw, y(23.2 - t)], [17 - sw, y(21.8 - t)], [15.8 - sw, y(22.6 - t)], [14.6 - sw * 0.6, y(20.4 - t)], [13, y(16)], [11.6, y(9)], [12, y(2.4)]];
    blob(ctx, pts, side < 0 ? lighten(brown, 0.06) : darken(brown, 0.04), { light: 0.3 }, () => {
      const g = ctx.createLinearGradient(0, y(13 - t), 0, y(22 - t));
      g.addColorStop(0, rgba('#2b211a', 0));
      g.addColorStop(1, rgba('#2b211a', 0.6));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      line(ctx, [[22.6, y(4)], [22.4, y(14)]], 2.2, rgba('#c2a27a', 0.45));
    });
  }
  blob(ctx, [[12, 24], [7, 21], [3, 20.6], [4.6, 24], [3, 27.4], [7, 27], [12, 24.6]], darken(brown, 0.08), { light: 0.25 });
  blob(ctx, [[9, 24], [13, 21.6], [21, 21.8], [25.6, 23], [28, 24], [25.6, 25], [21, 26.2], [13, 26.4]], brown, { light: 0.35 });
  ball(ctx, 27.4, 24, 2.5, 2, '#8e7052', 0.3);
  blob(ctx, [[29.4, 23.3], [31.6, 24], [29.4, 24.7]], '#3a3026');
  return painted(canvas, W, H, [0.5, 0.5]);
}

function heronStrike(): Painted {
  const W = 36;
  const H = 42;
  const [canvas, ctx] = canvasOf(W, H, 4);
  const grey = '#9aa1a4';
  shadow(ctx, 15, 40.4, 8, 1.6);
  // Legs braced, knees forward.
  const hip: Pt = [13, 24];
  for (const [foot, shade] of [[[10.6, 40.2], 0.25], [[17.6, 40.4], 0]] as [Pt, number][]) {
    const knee = ik(hip, foot, 8.4, 9, foot[0] > hip[0]);
    bone(ctx, hip, knee, 1.3, 0.8, darken('#8a7b62', shade));
    bone(ctx, knee, foot, 0.8, 0.7, darken('#8a7b62', shade));
    line(ctx, [[foot[0] - 1.6, foot[1]], [foot[0] + 1.8, foot[1]]], 0.5, darken('#8a7b62', shade));
  }
  // Body tipped forward, tail feathers up.
  blob(ctx, [[2, 13.4], [8, 13.2], [16, 15.4], [21, 19], [21.4, 22.4], [16, 25.4], [8.6, 22.4], [4.6, 17.2]], grey, { light: 0.32 }, () => {
    line(ctx, [[5, 15.4], [12, 16.6], [19, 20]], 2.4, rgba('#6e7579', 0.6), true);
    ellipse(ctx, 15, 23.6, 5, 1.8, rgba('#e5e4dc', 0.6));
  });
  // Neck shot down and forward to the water, dagger bill at the end.
  line(ctx, [[19, 19.4], [23, 24], [25.6, 29.6], [27, 32.6]], 2.6, '#e4e2da', true);
  line(ctx, [[19.8, 20.6], [23.4, 25.6], [25.6, 30.4]], 0.6, 'rgba(60,64,70,0.55)', true);
  ball(ctx, 27.6, 33.6, 1.8, 1.6, '#ece9e1', 0.3);
  line(ctx, [[26.2, 32.4], [23.8, 31.6], [21.6, 32.6]], 0.7, '#2d2f33', true);
  blob(ctx, [[28.6, 34], [33.6, 38.6], [28.4, 35.2]], '#d8a646');
  ellipse(ctx, 28.2, 33.2, 0.4, 0.4, '#151515');
  ripples(ctx, 33.6, 39.2, 3, 1, 0.7);
  return painted(canvas, W, H, [15 / W, 40.4 / H]);
}

function craneStand(): Painted {
  const W = 30;
  const H = 46;
  const [canvas, ctx] = canvasOf(W, H, 4);
  shadow(ctx, 14.5, 44.4, 7.4, 1.5);
  bone(ctx, [12.6, 28], [11.4, 44], 1, 0.75, '#3a3634');
  bone(ctx, [15, 28], [16.4, 44.2], 1.1, 0.8, '#45403d');
  line(ctx, [[14.6, 44.2], [18.4, 44.2]], 0.55, '#3a3634');
  blob(ctx, [[5.4, 20.8], [9, 16.6], [15, 16], [19.6, 18.6], [20.6, 23], [17.6, 28.4], [11.2, 29.4], [7, 26.4]], '#f4f2ec', { light: 0.2, dark: 0.3 });
  // The black bustle of tertials draping over the tail.
  blob(ctx, [[8, 21.6], [4, 23.4], [2.4, 27.6], [4.6, 29], [8.4, 27.4], [11, 24.4]], '#28282a', { light: 0.25 });
  // Black neck rising to the white nape and red crown.
  line(ctx, [[17.8, 19], [19.4, 13.6], [19.6, 8.4], [20.8, 5.4]], 2.6, '#2c2c2e', true);
  line(ctx, [[18.6, 17.4], [19.8, 12.6]], 0.6, 'rgba(255,255,255,0.2)');
  ellipse(ctx, 19.4, 9, 0.9, 2.8, '#f2f0ea', 0.15);
  ball(ctx, 21.4, 4.6, 1.9, 1.6, '#2c2c2e', 0.2);
  ellipse(ctx, 21.6, 3.3, 1.2, 0.7, '#c8322c');
  blob(ctx, [[22.6, 4], [27.6, 5.4], [22.8, 5.6]], '#9e9466');
  ellipse(ctx, 22, 4.4, 0.35, 0.35, '#e8e4d8');
  return painted(canvas, W, H, [14.5 / W, 44.4 / H]);
}

function swan(): Painted {
  const W = 42;
  const H = 30;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const water = 23.6;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ellipse(ctx, 19, water + 1, 15, 2.6, 'rgba(30,60,70,0.35)');
  ctx.restore();
  blob(ctx, [[3, 18.6], [5.4, 15.6], [13, 13.4], [22, 13.6], [28, 15.4], [30.6, 19.6], [28.4, 23.4], [18, 24.6], [8, 23.6], [3.6, 21.6]], '#f6f4ee', { light: 0.18, dark: 0.32 }, () => {
    line(ctx, [[8, 17.4], [16, 15.6], [24, 16.6]], 1, 'rgba(180,190,200,0.6)', true);
  });
  blob(ctx, [[2.6, 18.6], [0.6, 16.2], [2, 15.6], [5, 16.6]], '#eceae2');
  line(ctx, [[26.6, 17], [29.6, 11], [29.4, 5.4], [31, 3.2]], 3, '#f4f2ec', true);
  line(ctx, [[28.4, 15], [30.4, 10.6]], 0.8, 'rgba(160,170,180,0.4)');
  ball(ctx, 32.4, 3.6, 2.2, 1.8, '#f4f2ec', 0.15);
  blob(ctx, [[33.6, 3], [38.6, 4.6], [37.8, 5.8], [33.8, 5]], '#e2c04e');
  blob(ctx, [[36, 4], [38.6, 4.6], [37.8, 5.8], [36, 5.4]], '#2c2a28');
  ellipse(ctx, 33.4, 3.2, 0.4, 0.4, '#1a1a1a');
  ripples(ctx, 17, water, 15, 2.2, 0.6);
  return painted(canvas, W, H, [17 / W, water / H]);
}

/** A swallow from above, heading right: wings spread, then swept back. */
function swallow(frame: number): Painted {
  const W = 20;
  const H = 24;
  const [canvas, ctx] = canvasOf(W, H, 4);
  const blue = '#28324a';
  for (const side of [-1, 1]) {
    const y = (v: number): number => 12 + side * v;
    if (frame) blob(ctx, [[12, y(1)], [9, y(5)], [4, y(9)], [3.6, y(8)], [7.6, y(3.6)], [10, y(0.6)]], blue, { light: 0.25 });
    else blob(ctx, [[12.4, y(1)], [12.6, y(5)], [11, y(10.6)], [10, y(10.8)], [9.6, y(5)], [9.6, y(0.8)]], blue, { light: 0.25 });
  }
  blob(ctx, [[8, 12], [4.4, 11.4], [0.6, 9.6], [3.6, 12], [0.6, 14.4], [4.4, 12.6]], darken(blue, 0.1));
  blob(ctx, [[6, 12], [9, 10.8], [13.6, 11], [15.4, 12], [13.6, 13], [9, 13.2]], blue, { light: 0.35 });
  ellipse(ctx, 14, 12, 1, 0.8, '#b8553c');
  return painted(canvas, W, H, [0.5, 0.5]);
}

/** A red dragonfly from above, heading right. */
function dragonfly(): Painted {
  const [canvas, ctx] = canvasOf(14, 14, 6);
  for (const [x, len, tilt] of [[8.2, 6, 0.12], [6.4, 5.6, -0.08]] as const) {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x, 7);
      ctx.rotate(side * (Math.PI / 2 + tilt));
      ellipse(ctx, len / 2, 0, len / 2, 0.95, 'rgba(236,240,240,0.55)');
      ellipse(ctx, len - 0.6, 0, 0.5, 0.35, 'rgba(90,60,50,0.5)');
      ctx.restore();
    }
  }
  line(ctx, [[1, 7], [7.6, 7]], 0.9, '#c4462c');
  ball(ctx, 8.4, 7, 1.3, 1.1, '#a8452e', 0.3);
  ball(ctx, 10.2, 7, 1, 1.1, '#7a3524', 0.3);
  return painted(canvas, 14, 14, [0.5, 0.5]);
}

/** A crane in flight from above, heading right: the migration's own bird. */
function craneFly(frame: number): Painted {
  const span = frame ? 22 : 27;
  const W = 48;
  const H = 62;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const c = H / 2;
  for (const side of [-1, 1]) {
    const y = (v: number): number => c + side * v;
    blob(ctx, [[26.6, y(1.6)], [28.4, y(span * 0.42)], [27.4, y(span * 0.82)], [25.2, y(span)], [21.4, y(span + 0.4)], [18.6, y(span * 0.72)], [16.8, y(span * 0.36)], [16.6, y(1.6)]], '#f4f2ec', { light: 0.15, dark: 0.3 }, () => {
      ctx.fillStyle = '#2a2a2c';
      ctx.beginPath();
      curve(ctx, [[15, y(span * 0.22)], [19.4, y(span * 0.26)], [20.6, y(span * 0.62)], [19.6, y(span * 0.8)], [15, y(span * 0.8)]]);
      ctx.fill();
    });
  }
  line(ctx, [[17, c], [4, c]], 1, '#3a3634');
  blob(ctx, [[13.4, c], [19.6, c - 2.6], [27, c - 1.8], [29.4, c], [27, c + 1.8], [19.6, c + 2.6]], '#f4f2ec', { light: 0.2 });
  line(ctx, [[27.6, c], [38, c]], 2, '#2c2c2e');
  ball(ctx, 39.4, c, 1.8, 1.4, '#2c2c2e', 0.2);
  ellipse(ctx, 39.8, c, 0.8, 0.6, '#c8322c');
  line(ctx, [[41, c], [45, c]], 0.9, '#9e9466');
  return painted(canvas, W, H, [0.5, 0.5]);
}

/** An otter swimming, seen from above, heading right, with its V of wake. */
function otter(frame: number): Painted {
  const W = 38;
  const H = 18;
  const [canvas, ctx] = canvasOf(W, H, 4);
  const fur = '#5e4634';
  const spread = frame ? 1.4 : 0;
  ctx.strokeStyle = 'rgba(240,248,248,0.4)';
  ctx.lineWidth = 0.7;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(27, 9 + side * 2.8);
    ctx.quadraticCurveTo(18, 9 + side * (4.4 + spread), 8, 9 + side * (6 + spread));
    ctx.stroke();
  }
  ctx.globalAlpha = 0.92;
  blob(ctx, [[6, 9 + (frame ? 0.8 : -0.8)], [12, 8], [16, 6.6], [24, 6.6], [28.6, 7.4], [28.6, 10.6], [24, 11.4], [16, 11.4], [12, 10]], fur, { light: 0.34 }, () => {
    line(ctx, [[14, 8.2], [26, 7.6]], 1.4, 'rgba(255,240,220,0.22)');
  });
  ctx.globalAlpha = 1;
  ball(ctx, 31, 9, 3.4, 2.6, lighten(fur, 0.06), 0.32);
  ellipse(ctx, 33.6, 7.6, 0.45, 0.4, '#16110d');
  ellipse(ctx, 33.6, 10.4, 0.45, 0.4, '#16110d');
  ellipse(ctx, 34.4, 9, 0.9, 1.2, '#d8c8b0');
  ripples(ctx, 30, 9, 5, 4, 0.5);
  return painted(canvas, W, H, [0.5, 0.5]);
}

/** A seal with its head up out of the water, whiskers and all, watching. */
function seal(): Painted {
  const W = 30, H = 22;
  const [canvas, ctx] = canvasOf(W, H, 4);
  const coat = '#7a7c78';
  ripples(ctx, 15, 17, 11, 3, 0.55);
  ctx.globalAlpha = 0.9;
  // The broad back just breaking the surface.
  blob(ctx, [[4, 17], [9, 14.6], [17, 14], [24, 15.4], [26, 17.4], [17, 18.4], [9, 18.2]], darken(coat, 0.08), { light: 0.3 });
  ctx.globalAlpha = 1;
  // The neck and round head held up.
  blob(ctx, [[17, 15.4], [17.4, 10], [19.6, 6.4], [23.4, 5.6], [25.6, 8], [24.6, 11.4], [22, 15]], coat, { light: 0.38 }, () => {
    for (const [x, y] of [[19.5, 9.5], [21, 12], [18.6, 13], [22.4, 8.4]] as const) ellipse(ctx, x, y, 0.5, 0.4, rgba('#4a4c48', 0.55));
  });
  ellipse(ctx, 25.6, 8.6, 1.4, 1.1, lighten(coat, 0.12));
  ellipse(ctx, 23.2, 7, 0.6, 0.6, '#141412');
  ellipse(ctx, 26.6, 8.4, 0.45, 0.35, '#1c1c1a');
  for (const dy of [-0.6, 0.4, 1.3]) line(ctx, [[25.8, 9 + dy * 0.3], [28.8, 8.6 + dy]], 0.2, rgba('#f2efe6', 0.8));
  return painted(canvas, W, H, [0.5, 17 / H]);
}

/** A carp (or salmon) leaping clear of the water with a ring of splash. */
function carpJump(): Painted {
  const W = 32;
  const H = 32;
  const [canvas, ctx] = canvasOf(W, H, 4);
  const water = 27;
  ellipse(ctx, 13, water, 9, 2.2, 'rgba(255,255,255,0.22)');
  ripples(ctx, 13, water, 8, 2, 0.75);
  ctx.save();
  ctx.translate(16, 15);
  ctx.rotate(-0.55);
  blob(ctx, [[-11, 0], [-14.6, -3.6], [-13.4, 0], [-14.6, 3.6], [-11, 0.4], [-6, 3.2], [2, 3.6], [8, 2], [10.4, 0], [8, -2.4], [2, -4], [-6, -3]], '#e47a3c', { light: 0.42, dark: 0.3 }, () => {
    ellipse(ctx, 1, 2.6, 8, 1.6, '#f6eee0');
    ellipse(ctx, -2, -1.4, 3, 1.6, '#f6eee0');
    ellipse(ctx, 4, -1.2, 2, 1.3, '#c8452e');
  });
  ellipse(ctx, 7.6, -0.8, 0.5, 0.5, '#1a1410');
  blob(ctx, [[-1, -3.4], [-4, -6.6], [2, -4]], rgba('#e47a3c', 0.85));
  ctx.restore();
  for (const [x, y, r] of [[5, 22, 0.9], [8, 19, 0.6], [21, 23, 0.8], [3, 25, 0.6], [24, 25.6, 0.7], [11, 22.6, 0.6]] as const) ellipse(ctx, x, y, r, r, 'rgba(240,250,252,0.85)');
  line(ctx, [[6, 26], [5, 23.4]], 1, 'rgba(240,250,252,0.7)');
  line(ctx, [[20, 26.4], [21.4, 23.6]], 1, 'rgba(240,250,252,0.7)');
  return painted(canvas, W, H, [13 / W, water / H]);
}

/** A salmon in the run, seen from above through the water, heading right. */
function salmon(): Painted {
  const [canvas, ctx] = canvasOf(36, 13, 4);
  blob(ctx, [[33.6, 6.4], [28, 3.4], [18, 3], [9, 4.8], [4, 5.8], [1, 3], [2.6, 6.5], [1, 10], [4, 7.4], [9, 8.4], [18, 10], [28, 9.6]], '#8f8a7c', { light: 0.36 }, () => {
    ellipse(ctx, 18, 6.8, 10, 1.6, rgba('#c0584a', 0.7));
    line(ctx, [[10, 5.4], [28, 4.8]], 1.6, rgba('#4e5248', 0.6));
    for (let x = 12; x < 27; x += 3) ellipse(ctx, x, 4.6 + (x % 2), 0.4, 0.4, 'rgba(40,40,36,0.6)');
  });
  ellipse(ctx, 30.4, 5.2, 0.45, 0.45, '#161412');
  return painted(canvas, 36, 13, [0.5, 0.5]);
}

function kingfisher(): Painted {
  const [canvas, ctx] = canvasOf(16, 16, 5);
  shadow(ctx, 8, 14.6, 4, 1);
  line(ctx, [[6.6, 12], [6.6, 14.4]], 0.5, '#c4553a');
  line(ctx, [[8, 12], [8.2, 14.4]], 0.5, '#c4553a');
  blob(ctx, [[1.6, 9.4], [4, 7.6], [8, 6.4], [10.4, 7.8], [10, 11], [7, 12.6], [3.6, 11.4]], '#2c8a9e', { light: 0.4 }, () => {
    ellipse(ctx, 8, 11.4, 3.6, 2.2, '#d9733a');
  });
  ball(ctx, 10, 5.6, 2.4, 2.2, '#2a7c92', 0.35);
  ellipse(ctx, 10.6, 6.6, 1.3, 0.7, '#e08a4a');
  ellipse(ctx, 10.8, 7.2, 0.8, 0.5, '#f2ece0');
  blob(ctx, [[11.6, 5], [15.6, 6], [11.8, 6.4]], '#1e1c1a');
  ellipse(ctx, 10.6, 5.2, 0.4, 0.4, '#0e0c0a');
  return painted(canvas, 16, 16, [0.5, 14.6 / 16]);
}

/** A small perched bird in its own colours, for perchers without an illustration of their own. */
interface BirdLook { back: string; belly: string; head?: string; bib?: string; cap?: string; ring?: string; bars?: string; tail?: number; size?: number; upright?: boolean }

function perchedBird(look: BirdLook): () => Painted {
  return () => {
    const k = look.size ?? 1;
    const W = Math.round(16 * k), H = Math.round(16 * k);
    const [canvas, ctx] = canvasOf(W, H, 5);
    ctx.save();
    ctx.scale(k, k);
    shadow(ctx, 8, 14.6, 4, 1);
    line(ctx, [[6.6, 12], [6.6, 14.4]], 0.45, '#6b5440');
    line(ctx, [[8, 12], [8.2, 14.4]], 0.45, '#6b5440');
    const tail = look.tail ?? 0;
    const body: Pt[] = look.upright
      ? [[4, 12.6 + tail], [4.6, 8], [7.4, 5.6], [10, 6.6], [10.2, 10.4], [8.4, 13], [6, 13.4]]
      : [[1.4 - tail, 9.8 + tail * 0.3], [4, 7.6], [8, 6.4], [10.4, 7.8], [10, 11], [7, 12.6], [3.6, 11.4]];
    blob(ctx, body, look.back, { light: 0.35 }, () => {
      ellipse(ctx, 8.2, 11.2, 3.2, 2.2, look.belly);
      if (look.bars) for (let x = 3.4; x < 8; x += 1.3) line(ctx, [[x, 8.2], [x + 0.6, 10.2]], 0.45, look.bars);
    });
    const head = look.head ?? look.back;
    const hx = look.upright ? 8.6 : 10, hy = look.upright ? 4.8 : 5.6;
    ball(ctx, hx, hy, 2.3, 2.1, head, 0.3);
    if (look.cap) ellipse(ctx, hx - 0.2, hy - 1.3, 1.5, 0.8, look.cap);
    if (look.bib) ellipse(ctx, hx + 0.4, hy + 1.6, 1.4, 1.1, look.bib);
    if (look.ring) ellipse(ctx, hx + 0.6, hy - 0.3, 0.75, 0.75, look.ring);
    blob(ctx, [[hx + 1.8, hy - 0.4], [hx + 3.6, hy + 0.2], [hx + 1.8, hy + 0.6]], '#2a2420');
    ellipse(ctx, hx + 0.6, hy - 0.3, 0.38, 0.38, '#0e0c0a');
    ctx.restore();
    return painted(canvas, W, H, [0.5, 14.6 / 16]);
  };
}

const BIRDS: Record<string, Painter> = {
  dipper: perchedBird({ back: '#4a3a30', belly: '#5a4636', bib: '#f1ece2', head: '#5b4232' }),
  woodpecker: perchedBird({ back: '#4c4239', belly: '#cbbfa8', bars: '#f2ebdd', cap: '#2e2620', upright: true }),
  songbird: perchedBird({ back: '#857456', belly: '#cfc19e' }),
  'bush-warbler': perchedBird({ back: '#7a7146', belly: '#c9c09a', tail: 0.6 }),
  skylark: perchedBird({ back: '#8a7350', belly: '#d9c9a4', bars: '#5e4c34', cap: '#7a6444' }),
  wagtail: perchedBird({ back: '#6d6d68', belly: '#f0eee6', head: '#2a2826', bib: '#2a2826', tail: 1.6 }),
  'white-eye': perchedBird({ back: '#8a9a3e', belly: '#d8d6a0', ring: '#f6f4ec' }),
  'reed-bunting': perchedBird({ back: '#8a6a48', belly: '#d9ccb0', head: '#262220', bib: '#262220', bars: '#4e3a28' }),
  cormorant: perchedBird({ back: '#26282a', belly: '#33302c', bib: '#d8d2c4', size: 1.6, upright: true, tail: 0.8 }),
  pheasant: perchedBird({ back: '#5d6e3c', belly: '#3e5a48', head: '#2e4a56', cap: '#b33a2a', size: 1.5, tail: 2.6 }),
};

function owl(): Painted {
  const [canvas, ctx] = canvasOf(16, 22, 5);
  const plume = '#8f7a62';
  shadow(ctx, 8, 20.6, 4.6, 1.1);
  blob(ctx, [[3.4, 13], [4, 7.6], [8, 5.6], [12, 7.4], [12.6, 13], [11, 18.6], [8, 20.4], [5, 18.6]], plume, { light: 0.32 }, () => {
    ellipse(ctx, 9, 14.6, 3, 4.6, '#d9ccb4');
    for (let y = 11; y < 19; y += 1.6) line(ctx, [[7.6, y], [10.4, y + 0.3]], 0.4, rgba('#6c5a46', 0.6));
  });
  ball(ctx, 8.6, 6, 4, 3.6, plume, 0.3);
  ellipse(ctx, 10, 6.4, 2.6, 2.4, '#e2d6c0');
  ellipse(ctx, 10.4, 6, 0.8, 0.8, '#2a1f14');
  blob(ctx, [[11.4, 6.6], [12.6, 7.4], [11.4, 8]], '#3a3028');
  line(ctx, [[7, 20.4], [7.4, 21.2]], 0.6, '#c9a044');
  line(ctx, [[9.4, 20.4], [9.8, 21.2]], 0.6, '#c9a044');
  return painted(canvas, 16, 22, [0.5, 20.6 / 22]);
}

function marten(frame: number): Painted {
  const W = 34;
  const H = 18;
  const [canvas, ctx] = canvasOf(W, H, 4);
  const coat = '#b98a3c';
  const ground = 16.2;
  const up = frame ? -1.4 : 0;
  const rig: Rig = {
    fore: [23, 11 + up], hind: [10, 10.6 + up], far: [-1, -0.4],
    foreLen: [2.8, 3], hindLen: [3, 3.2], foreW: [1.8, 1.1, 0.9], hindW: [2.2, 1.1, 0.9],
    ground, stride: 2.6, liftH: 2, upper: coat, lower: '#4a3420', hoof: '#2a1d14', hoofR: 0.45,
  };
  const pose: Pose = frame
    ? { rf: { s: -0.6, lift: 0.5 }, lf: { s: -0.3, lift: 0.3 }, rh: { s: 0.8, lift: 0.4 }, lh: { s: 0.5, lift: 0.2 } }
    : { rf: { s: 1, lift: 0.2 }, lf: { s: 0.7, lift: 0 }, rh: { s: -1, lift: 0.2 }, lh: { s: -0.7, lift: 0 } };
  shadow(ctx, 17, ground + 0.3, 11, 1.8);
  legs(ctx, rig, pose, false);
  legs(ctx, rig, pose, true);
  ctx.save();
  ctx.translate(0, up);
  blob(ctx, [[10, 9.4], [6, 8.6], [1.6, 10.2], [2, 11.6], [6, 11], [10, 11.6]], darken(coat, 0.25));
  blob(ctx, [[8.6, 10.6], [12, 7.8], [20, 8], [25, 7], [27, 9.2], [25.4, 12], [18, 12.4], [11, 12.4]], coat, { light: 0.32 }, () => {
    ellipse(ctx, 25.6, 10.6, 2, 1.6, '#f0dea0');
  });
  blob(ctx, [[24.4, 7.6], [26.4, 5.6], [29.6, 6], [32.4, 8.2], [30.4, 9.6], [26.4, 9.8]], lighten(coat, 0.06), { light: 0.3 });
  ellipse(ctx, 26.4, 5.6, 0.9, 0.8, darken(coat, 0.2));
  ellipse(ctx, 29.4, 7.2, 0.4, 0.4, '#140e0a');
  ellipse(ctx, 32.2, 8.2, 0.45, 0.4, '#140e0a');
  ctx.restore();
  return painted(canvas, W, H, [17 / W, ground / H]);
}

/** A Japanese serow (kamoshika), the mountain goat-antelope of the high crags. */
function serow(): Painted {
  const W = 40;
  const H = 34;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const coat = '#5d5650';
  const ground = 31.6;
  const rig: Rig = {
    fore: [29, 19], hind: [12.6, 18.6], far: [-1.4, -0.6],
    foreLen: [5.8, 6.4], hindLen: [6.2, 7], foreW: [3, 1.6, 1.3], hindW: [3.8, 1.6, 1.3],
    ground, stride: 2, liftH: 1, upper: coat, lower: darken(coat, 0.15), hoof: '#201c1a', hoofR: 0.8,
  };
  shadow(ctx, 21, ground + 0.4, 13, 2.4);
  legs(ctx, rig, STAND, false);
  legs(ctx, rig, STAND, true);
  blob(ctx, [[9, 15], [12, 11], [20, 10.4], [28, 9], [33, 10.6], [33.6, 16.4], [30, 21.6], [20, 22], [11.6, 21.4], [8.6, 18.4]], coat, { light: 0.3 }, () => {
    ellipse(ctx, 32, 17, 2.6, 4, 'rgba(230,224,210,0.6)');
  });
  blob(ctx, [[30.6, 9], [33, 5.6], [36.6, 6.2], [39, 9.8], [38, 11.6], [34.6, 11.4], [31.6, 11.6]], lighten(coat, 0.05), { light: 0.3 });
  line(ctx, [[32.6, 5.8], [31.4, 2.6]], 0.9, '#1f1c1a');
  ellipse(ctx, 35.6, 7.6, 0.45, 0.45, '#100e0c');
  return painted(canvas, W, H, [21 / W, ground / H]);
}

/** A leopard: the "big cat" option (mountain lions do not live in Japan; see docs/sprites-needed.md). */
function leopard(frame: number): Painted {
  const W = 58;
  const H = 32;
  const [canvas, ctx] = canvasOf(W, H, 3);
  const coat = '#c9a05c';
  const ground = 29.4;
  const rig: Rig = {
    fore: [41, 18], hind: [17, 17.4], far: [-1.6, -0.8],
    foreLen: [5.6, 6.4], hindLen: [6.4, 6.8], foreW: [3.6, 2, 1.8], hindW: [4.6, 2, 1.8],
    ground, stride: 5, liftH: 2.4, upper: coat, lower: coat, hoof: darken(coat, 0.1), hoofR: 1,
  };
  const pose = walk(frame ? 0.5 : 0);
  shadow(ctx, 29, ground + 0.4, 19, 2.8);
  legs(ctx, rig, pose, false);
  line(ctx, [[13.6, 14], [7, 18], [4.6, 24], [2.4, 21.6]], 1.8, darken(coat, 0.05), true);
  legs(ctx, rig, pose, true);
  blob(ctx, [[12.6, 15], [17, 11.6], [28, 12.4], [37, 11], [43.6, 11.6], [46, 15], [44, 20], [36, 20.6], [24, 20.4], [15, 20.4], [12.4, 18]], coat, { light: 0.3 }, () => {
    for (let i = 0; i < 26; i++) ellipse(ctx, 14 + ((i * 11.3) % 30), 12.6 + ((i * 3.7) % 7), 0.8, 0.6, 'rgba(60,40,24,0.6)');
    ellipse(ctx, 30, 20.4, 13, 1.6, 'rgba(240,230,210,0.6)');
  });
  blob(ctx, [[42.4, 11.6], [44.6, 8.6], [49, 8.4], [52.4, 11], [51.4, 14], [46.6, 14.6], [43.6, 14]], coat, { light: 0.32 });
  ellipse(ctx, 45.4, 8.8, 1.1, 1, darken(coat, 0.3));
  ellipse(ctx, 49.2, 10.6, 0.5, 0.45, '#1a140e');
  ellipse(ctx, 52, 11.6, 0.6, 0.5, '#3a2a20');
  return painted(canvas, W, H, [29 / W, ground / H]);
}

const frames = (prefix: string, count: number, paint: (i: number) => Painted): Record<string, Painter> =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`${prefix}-${i}`, () => paint(i)]));

export const ANIMALS: Record<string, Painter> = {
  ...frames('deer-walk', 4, (i) => deerPainter(DEER.deer, i)),
  ...frames('stag-walk', 4, (i) => deerPainter(DEER.stag, i)),
  ...frames('fawn-walk', 4, (i) => deerPainter(DEER.fawn, i)),
  'hare-0': () => hare(false),
  'hare-1': () => hare(true),
  ...frames('fox-run', 2, fox),
  ...frames('hawk', 2, hawk),
  ...frames('bear', 2, bear),
  ...frames('wolf', 2, wolf),
  'heron-strike': heronStrike,
  'sheep-0': () => sheep(false),
  'sheep-1': () => sheep(true),
  ox,
  chicken,
  ...frames('boar', 2, boar),
  monkey,
  ...frames('tanuki', 2, tanuki),
  squirrel,
  frog,
  dragonfly,
  ...frames('swallow', 2, swallow),
  'crane-stand': craneStand,
  ...frames('crane-fly', 2, craneFly),
  swan,
  ...frames('otter', 2, otter),
  seal,
  'carp-jump': carpJump,
  salmon,
  kingfisher,
  ...BIRDS,
  owl,
  ...frames('marten', 2, marten),
  serow,
  ...frames('leopard', 2, leopard),
};

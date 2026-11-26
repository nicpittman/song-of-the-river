/**
 * The colour of the hour. Each key gives, at a clock hour, a colour the whole
 * valley is multiplied by, a colour lifted into it (so night is deep blue and
 * never black, and dawn is rose), how dark it counts as for lamps, and how
 * strong and long the sun's shadows are. Between keys the values blend
 * smoothly, so the grade is continuous at any speed. Pure, for testing.
 */

export interface Grade {
  /** Multiply colour, 0..1 per channel. */
  mul: [number, number, number];
  /** Screen-blended lift colour and its strength. */
  lift: [number, number, number];
  liftAlpha: number;
  /** 0 day .. 1 deep night: lamps, windows, fireflies. */
  night: number;
  /** Sun shadow strength and reach. */
  sun: number;
  sunLength: number;
  /** Morning mist, 0..1. */
  mist: number;
}

type Key = [hour: number, mul: [number, number, number], lift: [number, number, number], liftAlpha: number, night: number, sun: number, sunLength: number, mist: number];

const NIGHT: Key = [0, [0.36, 0.42, 0.64], [0.07, 0.1, 0.2], 0.5, 1, 0, 1, 0];

const KEYS: Key[] = [
  NIGHT,
  [4.6, [0.36, 0.42, 0.64], [0.07, 0.1, 0.2], 0.5, 1, 0, 1, 0.2],
  // A quick pale rose dawn, low mist lying in the valley.
  [5.7, [0.62, 0.55, 0.68], [0.46, 0.22, 0.3], 0.36, 0.6, 0, 1, 0.85],
  [6.5, [0.97, 0.84, 0.88], [0.5, 0.28, 0.32], 0.24, 0.1, 0.45, 2.3, 1],
  [7.4, [0.98, 0.99, 1], [0.25, 0.28, 0.3], 0.035, 0, 0.85, 1.6, 0.55],
  // Clear, neutral day.
  [9, [1, 1, 1], [0, 0, 0], 0, 0, 1, 1.1, 0],
  [15, [1, 1, 1], [0, 0, 0], 0, 0, 1, 1.2, 0],
  // Warm golden late afternoon with lengthening shadows.
  [16.8, [1, 0.91, 0.74], [0.3, 0.18, 0.05], 0.1, 0, 1, 2, 0],
  [18, [0.93, 0.74, 0.64], [0.28, 0.12, 0.1], 0.1, 0.12, 0.7, 2.8, 0],
  // Blue dusk.
  [19, [0.58, 0.58, 0.78], [0.08, 0.08, 0.16], 0.28, 0.55, 0.15, 3, 0],
  [20, [0.44, 0.48, 0.72], [0.07, 0.09, 0.18], 0.42, 0.85, 0, 1, 0],
  [21.5, NIGHT[1], NIGHT[2], NIGHT[3], 1, 0, 1, 0],
  [24, NIGHT[1], NIGHT[2], NIGHT[3], 1, 0, 1, 0],
];

const ease = (t: number): number => t * t * (3 - 2 * t);
const mixInto = (out: [number, number, number], a: readonly number[], b: readonly number[], t: number): void => {
  out[0] = a[0]! + (b[0]! - a[0]!) * t;
  out[1] = a[1]! + (b[1]! - a[1]!) * t;
  out[2] = a[2]! + (b[2]! - a[2]!) * t;
};

export function newGrade(): Grade {
  return { mul: [1, 1, 1], lift: [0, 0, 0], liftAlpha: 0, night: 0, sun: 1, sunLength: 1, mist: 0 };
}

/** Fills `out` with the grade at clock `hour` (wrapped into 0..24). */
export function gradeAt(hour: number, out: Grade): Grade {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1]![0] <= h) i++;
  const a = KEYS[i]!;
  const b = KEYS[i + 1]!;
  const t = ease(Math.max(0, Math.min(1, (h - a[0]) / (b[0] - a[0] || 1))));
  mixInto(out.mul, a[1], b[1], t);
  mixInto(out.lift, a[2], b[2], t);
  out.liftAlpha = a[3] + (b[3] - a[3]) * t;
  out.night = a[4] + (b[4] - a[4]) * t;
  out.sun = a[5] + (b[5] - a[5]) * t;
  out.sunLength = a[6] + (b[6] - a[6]) * t;
  out.mist = a[7] + (b[7] - a[7]) * t;
  return out;
}

/** A 0..1 colour triple as a Pixi tint. */
export function tintOf(c: readonly number[]): number {
  const to = (v: number): number => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (to(c[0]!) << 16) | (to(c[1]!) << 8) | to(c[2]!);
}

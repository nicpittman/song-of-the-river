/**
 * Curve tools behind every river and connection: turning a rough finger trace
 * into a small set of control points, and control points into a graceful
 * polyline that travellers can walk along.
 */

import { type Vec, dist, pointSegment, segmentIntersection } from '../core/math';

/** Ramer–Douglas–Peucker simplification. Keeps the overall gesture, drops finger jitter. */
export function simplify(points: readonly Vec[], epsilon: number): Vec[] {
  if (points.length <= 2) return points.map((p) => ({ ...p }));
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let worstD = epsilon;
    for (let i = a + 1; i < b; i++) {
      const d = pointSegment(points[i]!, points[a]!, points[b]!).d;
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]).map((p) => ({ ...p }));
}

/** Drops points closer than `minStep` to the previous kept point. */
export function thin(points: readonly Vec[], minStep: number): Vec[] {
  const out: Vec[] = [];
  for (const p of points) {
    if (!out.length || dist(out[out.length - 1]!, p) >= minStep) out.push({ ...p });
  }
  const last = points[points.length - 1];
  if (last && out.length && dist(out[out.length - 1]!, last) > 0.01) out.push({ ...last });
  return out;
}

/**
 * Centripetal Catmull–Rom spline through `control`, sampled roughly every
 * `step` world pixels. Centripetal parameterisation avoids the loops and
 * overshoot that uniform Catmull–Rom produces on uneven finger traces.
 */
export function smoothCurve(control: readonly Vec[], step = 10): Vec[] {
  if (control.length < 2) return control.map((p) => ({ ...p }));
  if (control.length === 2) return subdivide(control[0]!, control[1]!, step);
  const pts = [control[0]!, ...control, control[control.length - 1]!];
  const out: Vec[] = [{ ...control[0]! }];
  for (let i = 0; i < pts.length - 3; i++) {
    const p0 = pts[i]!;
    const p1 = pts[i + 1]!;
    const p2 = pts[i + 2]!;
    const p3 = pts[i + 3]!;
    const t0 = 0;
    const t1 = t0 + Math.max(1e-4, Math.sqrt(dist(p0, p1)));
    const t2 = t1 + Math.max(1e-4, Math.sqrt(dist(p1, p2)));
    const t3 = t2 + Math.max(1e-4, Math.sqrt(dist(p2, p3)));
    const n = Math.max(2, Math.ceil(dist(p1, p2) / step));
    for (let k = 1; k <= n; k++) {
      const t = t1 + ((t2 - t1) * k) / n;
      const a1 = mix(p0, p1, (t1 - t) / (t1 - t0), (t - t0) / (t1 - t0));
      const a2 = mix(p1, p2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1));
      const a3 = mix(p2, p3, (t3 - t) / (t3 - t2), (t - t2) / (t3 - t2));
      const b1 = mix(a1, a2, (t2 - t) / (t2 - t0), (t - t0) / (t2 - t0));
      const b2 = mix(a2, a3, (t3 - t) / (t3 - t1), (t - t1) / (t3 - t1));
      out.push(mix(b1, b2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1)));
    }
  }
  return out;
}

const mix = (a: Vec, b: Vec, wa: number, wb: number): Vec => ({ x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb });

function subdivide(a: Vec, b: Vec, step: number): Vec[] {
  const n = Math.max(1, Math.ceil(dist(a, b) / step));
  const out: Vec[] = [];
  for (let i = 0; i <= n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
  return out;
}

/** A polyline with cumulative lengths, so positions can be looked up by distance travelled. */
export class Polyline {
  readonly points: Vec[];
  readonly cumulative: number[];
  readonly length: number;

  constructor(points: readonly Vec[]) {
    this.points = points.map((p) => ({ ...p }));
    this.cumulative = [0];
    for (let i = 1; i < this.points.length; i++) {
      this.cumulative.push(this.cumulative[i - 1]! + dist(this.points[i - 1]!, this.points[i]!));
    }
    this.length = this.cumulative[this.cumulative.length - 1] ?? 0;
  }

  /** Position and heading (radians) at distance `d` from the start. */
  at(d: number): Vec & { angle: number } {
    const pts = this.points;
    if (pts.length === 1) return { ...pts[0]!, angle: 0 };
    const clamped = Math.min(Math.max(d, 0), this.length);
    let lo = 0;
    let hi = this.cumulative.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cumulative[mid]! <= clamped) lo = mid;
      else hi = mid;
    }
    const a = pts[lo]!;
    const b = pts[hi]!;
    const span = this.cumulative[hi]! - this.cumulative[lo]!;
    const t = span > 0 ? (clamped - this.cumulative[lo]!) / span : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  /** Closest point on the polyline to `p`. */
  nearest(p: Vec): { d: number; along: number; point: Vec; segment: number } {
    let best = { d: Infinity, along: 0, point: { ...this.points[0]! }, segment: 0 };
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i]!;
      const b = this.points[i + 1]!;
      const hit = pointSegment(p, a, b);
      if (hit.d < best.d) {
        best = {
          d: hit.d,
          along: this.cumulative[i]! + (this.cumulative[i + 1]! - this.cumulative[i]!) * hit.t,
          point: { x: a.x + (b.x - a.x) * hit.t, y: a.y + (b.y - a.y) * hit.t },
          segment: i,
        };
      }
    }
    return best;
  }
}

/** Every point where two polylines cross. */
export function polylineIntersections(a: Polyline, b: Polyline): Vec[] {
  const out: Vec[] = [];
  const box = (line: Polyline): [number, number, number, number] => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of line.points) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    return [x0, y0, x1, y1];
  };
  const [ax0, ay0, ax1, ay1] = box(a);
  const [bx0, by0, bx1, by1] = box(b);
  if (ax1 < bx0 || bx1 < ax0 || ay1 < by0 || by1 < ay0) return out;
  for (let i = 0; i < a.points.length - 1; i++) {
    const p = a.points[i]!;
    const q = a.points[i + 1]!;
    // Skip segments of `a` that lie wholly outside `b`'s bounds.
    if (Math.max(p.x, q.x) < bx0 || Math.min(p.x, q.x) > bx1 || Math.max(p.y, q.y) < by0 || Math.min(p.y, q.y) > by1) continue;
    for (let j = 0; j < b.points.length - 1; j++) {
      const hit = segmentIntersection(p, q, b.points[j]!, b.points[j + 1]!);
      if (hit) out.push({ x: hit.x, y: hit.y });
    }
  }
  return out;
}

/** Small 2D maths helpers shared by simulation and rendering. */

export interface Vec {
  x: number;
  y: number;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential approach: `current` moves toward `target`. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

/** Distance from point `p` to segment `a`–`b`, plus the 0..1 position of the closest point. */
export function pointSegment(p: Vec, a: Vec, b: Vec): { d: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  return { d: Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)), t };
}

/** Intersection of segments `a1`–`a2` and `b1`–`b2`, or null. `t` is the position along the first segment. */
export function segmentIntersection(a1: Vec, a2: Vec, b1: Vec, b2: Vec): (Vec & { t: number; u: number }) | null {
  const rx = a2.x - a1.x;
  const ry = a2.y - a1.y;
  const sx = b2.x - b1.x;
  const sy = b2.y - b1.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((b1.x - a1.x) * sy - (b1.y - a1.y) * sx) / denom;
  const u = ((b1.x - a1.x) * ry - (b1.y - a1.y) * rx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a1.x + rx * t, y: a1.y + ry * t, t, u };
}

/** Follow a heading across the -pi/pi boundary without taking a full turn. */
export function dampAngle(current:number,target:number,rate:number,dt:number):number {
  const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  return current+delta*(1-Math.exp(-rate*dt));
}

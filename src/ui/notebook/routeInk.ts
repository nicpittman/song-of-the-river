import type { Vec } from '../../game/core/math';

/** Round only the corners: no spline overshoot across a bank or past a stop. */
export function routeInk(points: readonly Vec[], radius = 7): { d: string; samples: Vec[] } {
  if (!points.length) return { d: '', samples: [] };
  const p = points.filter((point, i) => !i || Math.hypot(point.x - points[i - 1]!.x, point.y - points[i - 1]!.y) > .01);
  const xy = (at: Vec) => `${at.x.toFixed(2)} ${at.y.toFixed(2)}`;
  let d = `M${xy(p[0]!)}`;
  const samples = [p[0]!];
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1]!, b = p[i]!, c = p[i + 1]!;
    const before = Math.hypot(b.x - a.x, b.y - a.y), after = Math.hypot(c.x - b.x, c.y - b.y);
    const cut = Math.min(Math.max(0, radius), before / 3, after / 3);
    const enter = { x: b.x + (a.x - b.x) * cut / before, y: b.y + (a.y - b.y) * cut / before };
    const leave = { x: b.x + (c.x - b.x) * cut / after, y: b.y + (c.y - b.y) * cut / after };
    d += ` L${xy(enter)} Q${xy(b)} ${xy(leave)}`;
    samples.push(enter);
    for (let step = 1; step <= 8; step++) {
      const t = step / 8, u = 1 - t;
      samples.push({ x: u * u * enter.x + 2 * u * t * b.x + t * t * leave.x, y: u * u * enter.y + 2 * u * t * b.y + t * t * leave.y });
    }
  }
  if (p.length > 1) { d += ` L${xy(p.at(-1)!)}`; samples.push(p.at(-1)!); }
  return { d, samples };
}

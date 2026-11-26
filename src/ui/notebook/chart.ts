/**
 * Draws the river map from `view.chart` as SVG markup, in board units, for one
 * horizontal slice of the valley (one region, or the stretch the leaf shows).
 *
 * The look is a naturalist's field map: the river in a pale blue wash between
 * two inked banks, woods as soft leaf-green patches with a few tiny trees,
 * hills as contour ticks, and the sea as a plain wash below a drawn shore. Shapes are in
 * board units and strokes do not scale, so lines stay hairline at any size.
 */

import type { Chart } from '../../game/adventure/model';

interface Point {
  x: number;
  y: number;
}

export interface Slice {
  top: number;
  bottom: number;
}

/** A stable pseudo-random number in [0, 1) for a pair of numbers, so drawings never flicker. */
function noise(a: number, b: number): number {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

const f = (n: number): string => n.toFixed(1);

/** A smooth curve through the points (Catmull-Rom turned into cubic Béziers). */
export function smoothPath(points: Point[], closed = false): string {
  if (points.length < 2) return '';
  const pts = closed ? [points[points.length - 1], ...points, points[0], points[1]] : [points[0], ...points, points[points.length - 1]];
  let d = `M${f(pts[1].x)} ${f(pts[1].y)}`;
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return closed ? `${d} Z` : d;
}

/** The two banks of one channel, offset either side of its centre line. */
function banks(channel: Chart['channels'][number]): { left: Point[]; right: Point[] } {
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < channel.length; i++) {
    // The direction over a few points either side, so a tight bend's inner bank does not fold over itself.
    const a = channel[Math.max(0, i - 3)];
    const b = channel[Math.min(channel.length - 1, i + 3)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const p = channel[i];
    // The width eased over the same few points, so a pool's edge swells rather than steps.
    const near = channel.slice(Math.max(0, i - 2), i + 3);
    const half = near.reduce((n, q) => n + q.half, 0) / near.length;
    left.push({ x: p.x + nx * half, y: p.y + ny * half });
    right.push({ x: p.x - nx * half, y: p.y - ny * half });
  }
  return { left, right };
}

function near(y: number, r: number, slice: Slice): boolean {
  return y + r > slice.top - 40 && y - r < slice.bottom + 40;
}

/** A soft, slightly irregular patch of woodland with a few tiny trees drawn in it. */
function wood(w: Chart['woods'][number]): string {
  const ring: Point[] = [];
  const steps = 9;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = w.r * (0.82 + noise(w.x + i, w.y) * 0.3);
    ring.push({ x: w.x + Math.cos(a) * r, y: w.y + Math.sin(a) * r * 0.86 });
  }
  let trees = '';
  const count = Math.max(2, Math.round(w.r / 34));
  for (let i = 0; i < count; i++) {
    const a = noise(w.x, i * 3.1) * Math.PI * 2;
    const d = Math.sqrt(noise(i * 7.7, w.y)) * w.r * 0.62;
    const x = w.x + Math.cos(a) * d;
    const y = w.y + Math.sin(a) * d * 0.86;
    // A little conifer: a trunk and two strokes of crown.
    trees += `M${f(x)} ${f(y + 9)} L${f(x)} ${f(y - 2)} M${f(x - 7)} ${f(y + 4)} L${f(x)} ${f(y - 11)} L${f(x + 7)} ${f(y + 4)} `;
  }
  return `<path class="ch-wood" d="${smoothPath(ring, true)}"/><path class="ch-tree" d="${trees}"/>`;
}

/**
 * A hill in the old surveyor's way: one soft ridge line, with short hachures
 * falling from it down the slope, longer near the crest and shorter at the foot.
 */
function hill(hl: Chart['hills'][number]): string {
  const ridge: Point[] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = hl.x - hl.r + t * hl.r * 2;
    const lift = Math.sin(t * Math.PI) * hl.r * 0.42 * (0.9 + noise(hl.x, i) * 0.2);
    ridge.push({ x, y: hl.y - lift });
  }
  let ticks = '';
  // A few strokes whatever the size, so a big hill reads as a hill and not a comb.
  const count = Math.min(11, Math.max(6, Math.round(hl.r / 26)));
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const x = hl.x - hl.r + t * hl.r * 2;
    const top = hl.y - Math.sin(t * Math.PI) * hl.r * 0.42;
    const len = Math.min(40, 6 + Math.sin(t * Math.PI) * hl.r * 0.08);
    const lean = (t - 0.5) * 6;
    ticks += `M${f(x)} ${f(top + 4)} L${f(x + lean)} ${f(top + 4 + len)} `;
  }
  return `<path class="ch-hill" d="${smoothPath(ridge)}"/><path class="ch-hachure" d="${ticks}"/>`;
}

/** A few short ripple strokes along the middle of a channel. */
function ripples(channel: Chart['channels'][number], slice: Slice): string {
  let d = '';
  for (let i = 2; i < channel.length - 2; i += 3) {
    const p = channel[i];
    if (!near(p.y, 0, slice) || p.half < 14) continue;
    const q = channel[i + 1];
    const off = (noise(p.x, p.y) - 0.5) * p.half * 0.8;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const x = p.x - uy * off;
    const y = p.y + ux * off;
    d += `M${f(x)} ${f(y)} q${f(ux * 9 - uy * 2)} ${f(uy * 9 + ux * 2)} ${f(ux * 18)} ${f(uy * 18)} `;
  }
  return d ? `<path class="ch-ripple" d="${d}"/>` : '';
}

function sea(chart: Chart, slice: Slice): string {
  if (chart.sea === null || chart.sea > slice.bottom) return '';
  const top = Math.max(chart.sea, slice.top - 10);
  // Two or three faint soundings along the shore, as a surveyor would draw them; no decorative waves.
  let soundings = '';
  for (let k = 1; k <= 3; k++) {
    const y = chart.sea + k * 34;
    soundings += `M${chart.width * 0.08} ${y} L${chart.width * 0.92} ${y + (k % 2 ? 6 : -6)} `;
  }
  // The shore is a gentle wavering line rather than a ruler edge.
  const shore: Point[] = [];
  for (let x = -20; x <= chart.width + 20; x += chart.width / 8) {
    shore.push({ x, y: chart.sea + (noise(x, chart.sea) - 0.5) * 30 });
  }
  return (
    `<rect class="ch-sea" x="0" y="${f(top + 10)}" width="${chart.width}" height="${f(slice.bottom - top)}"/>` +
    `<path class="ch-sea" d="${smoothPath(shore)} L${chart.width + 20} ${slice.bottom} L-20 ${slice.bottom} Z"/>` +
    `<path class="ch-shore" d="${smoothPath(shore)}"/>` +
    `<path class="ch-sounding" d="${soundings}"/>`
  );
}

/**
 * The whole drawing for one slice, as the inner markup of an `<svg>`.
 *
 * The water is drawn as one body: every channel's outline is inked first, then
 * all the washes go over the ink, so where a creek or a back channel meets the
 * river the banks run together instead of crossing the water. The sea goes over
 * the river's mouth the same way.
 */
export function chartMarkup(chart: Chart, slice: Slice): string {
  const parts: string[] = [];
  for (const w of chart.woods) if (near(w.y, w.r, slice)) parts.push(wood(w));
  for (const hl of chart.hills) if (near(hl.y, hl.r, slice)) parts.push(hill(hl));
  const outlines: string[] = [];
  for (const channel of chart.channels) {
    if (!channel.some((p) => near(p.y, p.half + 60, slice))) continue;
    const { left, right } = banks(channel);
    outlines.push(`${smoothPath(left)} L${f(right[right.length - 1].x)} ${f(right[right.length - 1].y)} ${smoothPath([...right].reverse()).replace(/^M/, 'L')} Z`);
  }
  for (const d of outlines) parts.push(`<path class="ch-bank" d="${d}"/>`);
  for (const d of outlines) parts.push(`<path class="ch-water" d="${d}"/>`);
  for (const channel of chart.channels) if (channel.some((p) => near(p.y, p.half + 60, slice))) parts.push(ripples(channel, slice));
  parts.push(sea(chart, slice));
  for (const bridge of chart.bridges ?? []) if (near(bridge.y, 50, slice)) {
    parts.push(`<path class="ch-existing-bridge" d="M${bridge.x - (bridge.half ?? 130)} ${bridge.y - 9}h${2 * (bridge.half ?? 130)}m-${2 * (bridge.half ?? 130)} 18h${2 * (bridge.half ?? 130)}" fill="none" stroke="#6d725f" stroke-width="2" vector-effect="non-scaling-stroke"/>`);
  }
  return parts.join('');
}

/**
 * Shared brushes for the procedural placeholders: soft lit shapes, tapered
 * limbs, contact shadows and colour mixing. Everything is lit from the upper
 * left and drawn without outlines, so stand-ins sit beside the illustrated art.
 */

import type { Painted } from '../fallbackArt';

export type { Painted };
export type Pt = [number, number];
export type Ctx = CanvasRenderingContext2D;
export type Painter = () => Painted;

export function canvasOf(w: number, h: number, density = 3): [HTMLCanvasElement, Ctx] {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * density);
  canvas.height = Math.ceil(h * density);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(density, density);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return [canvas, ctx];
}

/** A soft cool-olive contact shadow, the same tone as `fallbackArt`'s, offset toward the lower right by the caller. */
export function shadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, strength = 0.35): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(40,50,30,${strength})`);
  g.addColorStop(0.6, `rgba(40,50,30,${strength * 0.55})`);
  g.addColorStop(1, 'rgba(40,50,30,0)');
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

export function rgbOf(colour: string): [number, number, number] {
  if (colour.startsWith('rgb')) {
    const [r, g, b] = colour.replace(/[^\d.,]/g, '').split(',').map(Number);
    return [r!, g!, b!];
  }
  const h = colour.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: string, b: string, t: number, alpha = 1): string {
  const x = rgbOf(a);
  const y = rgbOf(b);
  const c = x.map((v, i) => Math.round(v + (y[i]! - v) * t));
  return alpha >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

export const lighten = (c: string, t: number): string => mix(c, '#fff6e2', t);
export const darken = (c: string, t: number): string => mix(c, '#1d2433', t);
export const rgba = (c: string, a: number): string => mix(c, c, 0, a);

/** Adds a smooth closed (or open) Catmull-Rom curve through `pts` to the current path. */
export function curve(ctx: Ctx, pts: readonly Pt[], closed = true, tension = 1): void {
  const n = pts.length;
  const at = (i: number): Pt => (closed ? pts[(i + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const k = tension / 6;
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function boxOf(pts: readonly Pt[]): Box {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

export interface LightOpts {
  /** Warm light on the upper-left edge, 0..1. */
  light?: number;
  /** Cool shade toward the lower right, 0..1. */
  dark?: number;
}

/** Fills the current path with `base`, then washes it with upper-left light and lower-right shade. Leaves the path clipped until `restore`. */
function wash(ctx: Ctx, base: string, b: Box, opts: LightOpts): void {
  ctx.fillStyle = base;
  ctx.fill();
  ctx.clip();
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  const g = ctx.createLinearGradient(b.x0 + w * 0.1, b.y0, b.x0 + w * 0.55, b.y1 + h * 0.15);
  g.addColorStop(0, `rgba(255,244,216,${opts.light ?? 0.26})`);
  g.addColorStop(0.42, 'rgba(255,244,216,0)');
  g.addColorStop(0.62, 'rgba(26,32,50,0)');
  g.addColorStop(1, `rgba(26,32,50,${opts.dark ?? 0.34})`);
  ctx.fillStyle = g;
  ctx.fillRect(b.x0 - 2, b.y0 - 2, w + 4, h + 4);
}

/** A soft, lit, outline-free shape through `pts`. `inside` paints extra detail clipped to the shape. */
export function blob(ctx: Ctx, pts: readonly Pt[], base: string, opts: LightOpts = {}, inside?: (b: Box) => void): void {
  const b = boxOf(pts);
  ctx.save();
  ctx.beginPath();
  curve(ctx, pts);
  if (inside) {
    ctx.fillStyle = base;
    ctx.fill();
    ctx.clip();
    inside(b);
    ctx.beginPath();
    ctx.rect(b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4);
    wash(ctx, 'rgba(0,0,0,0)', b, opts);
  } else wash(ctx, base, b, opts);
  ctx.restore();
}

/** A polygon (straight edges) filled and lit the same way. */
export function poly(ctx: Ctx, pts: readonly Pt[], base: string, opts: LightOpts = {}): void {
  const b = boxOf(pts);
  ctx.save();
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  wash(ctx, base, b, opts);
  ctx.restore();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, colour: string, rot = 0): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
  ctx.fill();
}

/** A lit ball: base colour with a highlight toward the upper left. */
export function ball(ctx: Ctx, x: number, y: number, rx: number, ry: number, base: string, light = 0.3): void {
  const g = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.4, 0, x, y, Math.max(rx, ry) * 1.05);
  g.addColorStop(0, lighten(base, light));
  g.addColorStop(0.55, base);
  g.addColorStop(1, darken(base, 0.28));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** A tapered segment from `a` (width `wa`) to `b` (width `wb`) with round ends. */
export function bone(ctx: Ctx, a: Pt, b: Pt, wa: number, wb: number, colour: string): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(a[0] + (nx * wa) / 2, a[1] + (ny * wa) / 2);
  ctx.lineTo(b[0] + (nx * wb) / 2, b[1] + (ny * wb) / 2);
  ctx.lineTo(b[0] - (nx * wb) / 2, b[1] - (ny * wb) / 2);
  ctx.lineTo(a[0] - (nx * wa) / 2, a[1] - (ny * wa) / 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(a[0], a[1], wa / 2, 0, Math.PI * 2);
  ctx.arc(b[0], b[1], wb / 2, 0, Math.PI * 2);
  ctx.fill();
}

/** Two-bone inverse kinematics: the joint between `root` and `end`, bending forward (+x) or back. */
export function ik(root: Pt, end: Pt, l1: number, l2: number, bendForward: boolean): Pt {
  const dx = end[0] - root[0];
  const dy = end[1] - root[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const theta = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const angle = bendForward ? theta - a : theta + a;
  return [root[0] + Math.cos(angle) * l1, root[1] + Math.sin(angle) * l1];
}

/** A soft stroke (round caps), for stems, staffs, tails and similar. */
export function line(ctx: Ctx, pts: readonly Pt[], width: number, colour: string, smooth = false): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (smooth && pts.length > 2) curve(ctx, pts, false);
  else pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.stroke();
}

/** Fades the bottom of the canvas (from `from` to `to`, in world px) to transparent so pieces can overlap. */
export function fadeBottom(ctx: Ctx, w: number, from: number, to: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createLinearGradient(0, from, 0, to);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, from, w, to - from);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, to, w, 1e4);
  ctx.restore();
}

/** Ripples where something meets still water: a few pale broken ellipses. */
export function ripples(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.55): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const k = 1 + i * 0.45;
    ctx.strokeStyle = `rgba(236,246,246,${alpha * (1 - i * 0.45)})`;
    ctx.lineWidth = 0.9 - i * 0.25;
    ctx.beginPath();
    ctx.ellipse(x, y, rx * k, ry * k, 0, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y, rx * k, ry * k, 0, Math.PI * 1.15, Math.PI * 1.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y, rx * k, ry * k, 0, Math.PI * 1.6, Math.PI * 1.88);
    ctx.stroke();
  }
  ctx.restore();
}

export function painted(canvas: HTMLCanvasElement, width: number, height: number, anchor: [number, number], tiling = false): Painted {
  return tiling ? { canvas, width, height, anchor, tiling } : { canvas, width, height, anchor };
}

// ---------------------------------------------------------------------------
// Ground brushes: for things laid flat on the land (fields, strand-lines,
// shore litter), which must melt into the ground rather than sit on it as cut-outs.

/** A softly irregular closed outline round (`cx`, `cy`): a rounded rectangle when `square` is high, an ellipse when it is 2. */
export function looseOutline(rng: () => number, cx: number, cy: number, rx: number, ry: number, square = 4, wobble = 0.03, count = 28): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // A superellipse: |x|^n + |y|^n = 1.
    const k = Math.pow(Math.pow(Math.abs(c), square) + Math.pow(Math.abs(s), square), -1 / square);
    const j = 1 + (rng() - 0.5) * 2 * wobble;
    pts.push([cx + c * k * rx * j, cy + s * k * ry * j]);
  }
  return pts;
}

/**
 * Keeps only what lies inside `outline`, its edge blurred over about `soft`
 * world px, so a painted patch fades into whatever ground it is laid on.
 * The blur is a canvas shadow, which every browser supports (unlike `ctx.filter`).
 */
export function featherInto(ctx: Ctx, outline: readonly Pt[], soft: number): void {
  const density = ctx.getTransform().a;
  const { width, height } = ctx.canvas;
  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const m = mask.getContext('2d')!;
  // Draw the shape well off the canvas and let only its blurred shadow fall on it.
  const away = width + soft * density * 4 + 10;
  m.shadowColor = '#000';
  m.shadowBlur = soft * density;
  m.shadowOffsetX = away;
  m.setTransform(density, 0, 0, density, -away, 0);
  m.fillStyle = '#000';
  m.beginPath();
  curve(m, outline);
  m.fill();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0);
  ctx.restore();
}

/** Small soft dabs of `colours` scattered over a box: painterly grain for earth, sand, wool or stone. */
export function stipple(ctx: Ctx, rng: () => number, b: Box, count: number, colours: readonly string[], size = 1, alpha = 0.5): void {
  for (let i = 0; i < count; i++) {
    const x = b.x0 + rng() * (b.x1 - b.x0);
    const y = b.y0 + rng() * (b.y1 - b.y0);
    const r = size * (0.5 + rng());
    ellipse(ctx, x, y, r, r * 0.6, rgba(colours[Math.floor(rng() * colours.length)]!, alpha * (0.5 + rng() * 0.5)), (rng() - 0.5) * 0.6);
  }
}

export interface TuftOpts {
  /** Number of blades. */
  blades: number;
  /** Blade height, world px. */
  height: number;
  /** How far the blades fan out sideways at their tips. */
  spread: number;
  /** Shade to light: shaded blades lie toward the lower right, lit ones toward the upper left. */
  colours: readonly string[];
  width?: number;
  /** Overall lean of the tuft, + to the right. */
  lean?: number;
  /** Draws a seed head or flower at a blade tip. */
  tip?: (at: Pt, i: number) => void;
}

/**
 * A tuft of blades springing from one point, lit from the upper left: the
 * blades leaning left catch the light, those leaning right are in shade, and
 * a small shadow lies at the foot toward the lower right.
 */
export function tuft(ctx: Ctx, rng: () => number, x: number, y: number, o: TuftOpts): void {
  shadow(ctx, x + o.spread * 0.25 + 0.4, y + 0.3, Math.max(1.2, o.spread * 0.7), Math.max(0.5, o.spread * 0.22), 0.3);
  // Shaded (right-leaning) blades first, so the lit ones sit over them.
  const blades = Array.from({ length: o.blades }, () => (rng() - 0.5) * 2).sort((a, b) => b - a);
  const n = o.colours.length;
  blades.forEach((t, i) => {
    const h = o.height * (0.6 + rng() * 0.45) * (1 - Math.abs(t) * 0.25);
    const dx = t * o.spread + (o.lean ?? 0);
    const tipPt: Pt = [x + dx, y - h];
    const shade = Math.max(0, Math.min(n - 1, Math.round(((1 - t) / 2) * (n - 1) + (rng() - 0.5))));
    line(ctx, [[x + t * 0.3, y], [x + dx * 0.35, y - h * 0.6], tipPt], o.width ?? 0.5, o.colours[shade]!, true);
    o.tip?.(tipPt, i);
  });
}

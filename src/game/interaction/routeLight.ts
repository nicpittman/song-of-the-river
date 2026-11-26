/**
 * Light drawn along routes: the luminous ribbon that follows a gesture, the
 * gentle glow of a selected route and its stones, and the single pulse that
 * runs along a route when it is first made.
 *
 * A ribbon is built from a few stacked strokes in one `Graphics`: a soft dark
 * under-glow (so it reads on snow and bright meadow), a wide faint glow, a
 * fine bright core, and short beads of light that travel toward the
 * destination. Lengths are given in screen pixels and converted with `px`, so
 * the ribbon keeps its weight at every zoom. Small marks (the ring cursor, the
 * spot a route cannot pass, the stones) are pooled sprites.
 */

import { type Container, Graphics } from 'pixi.js';
import { type Vec, clamp, smoothstep } from '../core/math';
import { OVERLAY, mixColour, overlayTextures } from './overlayArt';
import { SpritePool } from './spritePool';

/** A polyline with cumulative lengths, sampled without copying its points. */
export class Path {
  readonly cumulative: Float64Array;
  readonly length: number;

  constructor(readonly points: readonly Vec[]) {
    this.cumulative = new Float64Array(points.length);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      this.cumulative[i] = this.cumulative[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y);
    }
    this.length = points.length ? this.cumulative[points.length - 1]! : 0;
  }

  /** Index of the segment containing distance `d`. */
  private segment(d: number): number {
    let lo = 0;
    let hi = this.points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cumulative[mid]! <= d) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  at(d: number): Vec {
    const pts = this.points;
    if (pts.length < 2) return { ...pts[0]! };
    const c = clamp(d, 0, this.length);
    const i = this.segment(c);
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const span = this.cumulative[i + 1]! - this.cumulative[i]!;
    const t = span > 0 ? (c - this.cumulative[i]!) / span : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /** Distance along the path of the point closest to `p`. */
  along(p: Vec): number {
    let best = Infinity;
    let along = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i]!;
      const b = this.points[i + 1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1) : 0;
      const d = Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
      if (d < best) {
        best = d;
        along = this.cumulative[i]! + Math.sqrt(len2) * t;
      }
    }
    return along;
  }

  /** Adds the stretch between distances `a` and `b` to the graphics' current path. */
  trace(g: Graphics, a: number, b: number): void {
    const start = this.at(a);
    g.moveTo(start.x, start.y);
    for (let i = this.segment(a) + 1; i < this.points.length && this.cumulative[i]! < b; i++) {
      g.lineTo(this.points[i]!.x, this.points[i]!.y);
    }
    const end = this.at(b);
    g.lineTo(end.x, end.y);
  }
}

export interface RibbonStyle {
  /** Overall strength, 0..1. */
  strength: number;
  /** Speed of the travelling beads in screen pixels per second; 0 holds them still. */
  flow: number;
  /** Narrow the start, so the line seems to be drawn out of the place. */
  taperStart: boolean;
  /** Narrow and soften the end, easing it into a destination. */
  taperEnd: boolean;
  /** The spot the route cannot pass, if any: the stretch from there on is drawn in rust. */
  faultAt: Vec | null;
  /** Draw the travelling beads. */
  beads: boolean;
}

/** The stretch of a route, as distances along it, that cannot be. */
interface Fault {
  from: number;
  to: number;
}

/** One stretch of a ribbon drawn with a single width and colour. */
interface Piece {
  a: number;
  b: number;
  width: number;
  rust: number;
}

/** Width and share of the light of each pass of a soft stroke, outermost first. */
const SOFT_PROFILE: ReadonlyArray<[number, number]> = [
  [1, 0.16],
  [0.74, 0.2],
  [0.5, 0.26],
  [0.28, 0.34],
];

/** Screen-pixel measures of the ribbon. */
const TAPER_IN = 90;
const TAPER_OUT = 46;
const FAULT_BLEND = 36;
/** How far past the problem the rust reaches before the line returns to cream. */
const FAULT_REACH = 150;
const BEAD = 9;
const BEAD_GAP = 13;

export class RouteLight {
  private readonly gfx = new Graphics();
  private readonly marks: SpritePool;
  private px = 1;
  private time = 0;

  constructor(lineLayer: Container, markLayer: Container) {
    lineLayer.addChild(this.gfx);
    this.marks = new SpritePool(markLayer);
  }

  /** Starts a frame. `px` is world units per screen pixel. */
  begin(px: number, time: number): void {
    this.px = px;
    this.time = time;
    this.gfx.clear();
    this.marks.begin();
  }

  end(): void {
    this.marks.end();
  }

  /** The stretch of a path drawn in rust: from just before the problem to a little past it. */
  private faultSpan(path: Path, at: Vec | null): Fault | null {
    if (!at) return null;
    const d = path.along(at);
    return { from: d - 12 * this.px, to: d + FAULT_REACH * this.px };
  }

  /** Splits a path into pieces wherever the width or colour changes. */
  private pieces(path: Path, style: RibbonStyle, fault: Fault | null): Piece[] {
    const L = path.length;
    const cuts = new Set<number>([0, L]);
    const taperIn = Math.min(TAPER_IN * this.px, L * 0.45);
    const taperOut = Math.min(TAPER_OUT * this.px, L * 0.3);
    if (style.taperStart) for (let k = 1; k <= 6; k++) cuts.add((taperIn * k) / 6);
    if (style.taperEnd) for (let k = 0; k < 4; k++) cuts.add(L - (taperOut * k) / 4);
    if (fault) {
      const blend = FAULT_BLEND * this.px;
      for (let k = 0; k <= 4; k++) {
        cuts.add(clamp(fault.from - (blend * k) / 4, 0, L));
        cuts.add(clamp(fault.to + (blend * k) / 4, 0, L));
      }
    }
    const sorted = [...cuts].filter((d) => d >= 0 && d <= L).sort((x, y) => x - y);
    const out: Piece[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!;
      const b = sorted[i + 1]!;
      if (b - a < 1e-3) continue;
      const m = (a + b) / 2;
      out.push({ a, b, width: this.widthAt(m, L, taperIn, taperOut, style), rust: this.rustAt(m, fault) });
    }
    return out;
  }

  private widthAt(d: number, L: number, taperIn: number, taperOut: number, style: RibbonStyle): number {
    let w = 1;
    if (style.taperStart) w *= 0.12 + 0.88 * smoothstep(0, taperIn, d);
    if (style.taperEnd) w *= 1 - 0.45 * smoothstep(L - taperOut, L, d);
    return w;
  }

  private rustAt(d: number, fault: Fault | null): number {
    if (!fault) return 0;
    const blend = FAULT_BLEND * this.px;
    return smoothstep(fault.from - blend, fault.from, d) * (1 - smoothstep(fault.to, fault.to + blend, d));
  }

  /**
   * A soft-edged stroke: nested passes of falling width, so the light fades
   * out from the centre instead of ending at a hard edge.
   */
  private soft(path: Path, pieces: Piece[], width: number, colour: number, rustColour: number, alpha: number): void {
    for (const [scale, share] of SOFT_PROFILE) this.pass(path, pieces, width * scale, colour, rustColour, alpha * share);
  }

  /** Strokes every piece at `width` screen pixels, tinted between `colour` and `rustColour`. */
  private pass(path: Path, pieces: Piece[], width: number, colour: number, rustColour: number, alpha: number): void {
    if (alpha <= 0.002) return;
    const g = this.gfx;
    for (const piece of pieces) {
      path.trace(g, piece.a, piece.b);
      g.stroke({
        width: Math.max(this.px * 0.6, width * piece.width * this.px),
        color: mixColour(colour, rustColour, piece.rust),
        alpha,
        cap: 'butt',
        join: 'round',
      });
    }
  }

  /** The luminous line: under-glow, glow, core and travelling beads. */
  ribbon(points: readonly Vec[], style: RibbonStyle): Path | null {
    if (points.length < 2) return null;
    const path = new Path(points);
    if (path.length < 1) return null;
    const fault = this.faultSpan(path, style.faultAt);
    const pieces = this.pieces(path, style, fault);
    const s = style.strength;
    // Dark beneath, light above: legible on snow, water and forest alike.
    this.soft(path, pieces, 32, OVERLAY.ink, OVERLAY.ink, 0.32 * s);
    this.soft(path, pieces, 24, OVERLAY.lamp, OVERLAY.rust, 0.55 * s);
    this.pass(path, pieces, 6, OVERLAY.cream, OVERLAY.rust, 0.3 * s);
    this.pass(path, pieces, 2.2, OVERLAY.cream, OVERLAY.rustLight, 0.85 * s);
    if (style.beads) this.travellingBeads(path, style, fault);
    return path;
  }

  /**
   * Short dashes of light that drift toward the destination. Most share one
   * stroke; only those in a taper or a colour blend are stroked on their own.
   */
  private travellingBeads(path: Path, style: RibbonStyle, fault: Fault | null): void {
    const g = this.gfx;
    const L = path.length;
    const dash = BEAD * this.px;
    const period = (BEAD + BEAD_GAP) * this.px;
    const offset = (((this.time * style.flow * this.px) % period) + period) % period;
    const taperIn = Math.min(TAPER_IN * this.px, L * 0.45);
    const taperOut = Math.min(TAPER_OUT * this.px, L * 0.3);
    const width = 4.2 * this.px;
    const alpha = 0.95 * style.strength;
    // Beads of the same plain colour share one stroke; `batch` is that colour, or null when empty.
    let batch: number | null = null;
    const flush = (): void => {
      if (batch !== null) g.stroke({ width, color: batch, alpha, cap: 'round' });
      batch = null;
    };
    for (let a = offset - period; a < L; a += period) {
      const start = Math.max(0, a);
      const end = Math.min(L, a + dash);
      if (end - start < this.px) continue;
      const m = (start + end) / 2;
      const w = this.widthAt(m, L, taperIn, taperOut, style);
      // Beads gather out of nothing near the start, and fade as they reach the free end.
      const fade = smoothstep(0, taperIn * 0.8, m) * (style.taperEnd ? 1 : 1 - smoothstep(L - 18 * this.px, L, m));
      if (fade < 0.02) continue;
      const rust = this.rustAt(m, fault);
      if (w > 0.98 && fade > 0.98 && (rust < 0.02 || rust > 0.98)) {
        const colour = rust > 0.5 ? OVERLAY.rustLight : OVERLAY.pearl;
        if (batch !== colour) flush();
        batch = colour;
        path.trace(g, start, end);
        continue;
      }
      // An individually styled bead: close the batch, then stroke it alone.
      flush();
      path.trace(g, start, end);
      g.stroke({ width: width * w, color: mixColour(OVERLAY.pearl, OVERLAY.rustLight, rust), alpha: alpha * fade, cap: 'round' });
    }
    flush();
  }

  /** The glowing ring at the tip of a line that has not yet found a destination. */
  cursor(p: Vec, breath: number, alpha: number): void {
    if (alpha < 0.01) return;
    const tex = overlayTextures();
    const px = this.px;
    this.marks.take(tex.dusk, { x: p.x, y: p.y, width: px * 46, alpha: 0.45 * alpha });
    this.marks.take(tex.glow, { x: p.x, y: p.y, width: px * (44 + breath * 8), tint: OVERLAY.lampBright, alpha: 0.4 * alpha, blend: 'add' });
    this.marks.take(tex.ring, { x: p.x, y: p.y, width: px * (30 + breath * 3), tint: OVERLAY.cream, alpha: 0.95 * alpha });
    this.marks.take(tex.glow, { x: p.x, y: p.y, width: px * 9, tint: OVERLAY.pearl, alpha });
  }

  /** A soft light where a found destination receives the line. */
  landing(p: Vec, alpha: number): void {
    if (alpha < 0.01) return;
    const tex = overlayTextures();
    this.marks.take(tex.glow, { x: p.x, y: p.y, width: this.px * 40, tint: OVERLAY.lampBright, alpha: 0.55 * alpha, blend: 'add' });
    this.marks.take(tex.glow, { x: p.x, y: p.y, width: this.px * 10, tint: OVERLAY.pearl, alpha: 0.9 * alpha });
  }

  /** A calm mark on the spot a route cannot pass: an ember of rust in a thin ring. */
  fault(p: Vec, breath: number): void {
    const tex = overlayTextures();
    const px = this.px;
    this.marks.take(tex.dusk, { x: p.x, y: p.y, width: px * 52, alpha: 0.6 });
    this.marks.take(tex.glow, { x: p.x, y: p.y, width: px * (50 + breath * 8), tint: OVERLAY.rust, alpha: 0.85 });
    this.marks.take(tex.ring, { x: p.x, y: p.y, width: px * 27, tint: OVERLAY.rustLight, alpha: 0.95 });
    this.marks.take(tex.glow, { x: p.x, y: p.y, width: px * 8, tint: 0xffe2cc, alpha: 0.95 });
  }

  /**
   * A selected route: a gentle breathing glow, a fine core, and (unless motion
   * is reduced) a slow sheen of light sliding along it, as if the paint were
   * still wet and could be moved.
   */
  selected(points: readonly Vec[], faultAt: Vec | null, breath: number, sheen: boolean): Path | null {
    if (points.length < 2) return null;
    const path = new Path(points);
    if (path.length < 1) return null;
    const style: RibbonStyle = { strength: 1, flow: 0, taperStart: false, taperEnd: false, faultAt, beads: false };
    const pieces = this.pieces(path, style, this.faultSpan(path, faultAt));
    this.soft(path, pieces, 32, OVERLAY.ink, OVERLAY.ink, 0.32);
    this.soft(path, pieces, 26, OVERLAY.lamp, OVERLAY.rust, 0.42 + 0.14 * breath);
    this.pass(path, pieces, 7, OVERLAY.cream, OVERLAY.rust, 0.22 + 0.06 * breath);
    this.pass(path, pieces, 2.2, OVERLAY.cream, OVERLAY.rustLight, 0.7);
    if (sheen) {
      const span = 160 * this.px;
      const travel = path.length + span;
      const head = ((this.time * 70 * this.px) % (travel + span * 2)) - span;
      this.streak(path, head, span, 6, 0.45, 0.35);
    }
    return path;
  }

  /** The polished stones at a selected route's bends. `active` is the one being dragged. */
  stones(points: readonly Vec[], active: number, size: number, faulty: boolean): void {
    const tex = overlayTextures();
    const px = this.px;
    points.forEach((p, i) => {
      const held = i === active;
      if (held) {
        this.marks.take(tex.glow, { x: p.x, y: p.y, width: px * size * 3.4, tint: faulty ? OVERLAY.rust : OVERLAY.lampBright, alpha: 0.6, blend: faulty ? 'normal' : 'add' });
      }
      const w = px * size * (held ? 1.3 : 1) * (96 / 58);
      this.marks.take(held ? tex.pearl : tex.jade, { x: p.x, y: p.y, width: w, anchorY: 44 / 96 });
    });
  }

  /**
   * A bright streak whose head is at distance `head`, trailing `span` behind
   * it in `steps` pieces that fade toward the tail.
   */
  private streak(path: Path, head: number, span: number, width: number, glowAlpha: number, coreAlpha: number): void {
    const g = this.gfx;
    const steps = 7;
    for (let k = 0; k < steps; k++) {
      const a = clamp(head - span + (span * k) / steps, 0, path.length);
      const b = clamp(head - span + (span * (k + 1)) / steps, 0, path.length);
      if (b - a < 0.5) continue;
      const t = (k + 1) / steps;
      const fade = t * t;
      path.trace(g, a, b);
      g.stroke({ width: width * 2.4 * this.px, color: OVERLAY.lampBright, alpha: glowAlpha * fade * 0.5, cap: 'butt', join: 'round' });
      path.trace(g, a, b);
      g.stroke({ width: width * 0.6 * this.px, color: OVERLAY.pearl, alpha: coreAlpha * fade * 2, cap: 'butt', join: 'round' });
    }
  }

  /**
   * The reward for a new route: one pulse of light running along it from start
   * to end. `t` runs 0..1. With reduced motion the whole line glows and fades
   * instead of anything travelling.
   */
  pulse(points: readonly Vec[], t: number, reducedMotion: boolean): void {
    if (points.length < 2) return;
    const path = new Path(points);
    if (reducedMotion) {
      const fade = Math.sin(clamp(t, 0, 1) * Math.PI);
      const pieces: Piece[] = [{ a: 0, b: path.length, width: 1, rust: 0 }];
      this.pass(path, pieces, 14, OVERLAY.lampBright, OVERLAY.lampBright, 0.22 * fade);
      this.pass(path, pieces, 3, OVERLAY.pearl, OVERLAY.pearl, 0.6 * fade);
      return;
    }
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const span = Math.min(220 * this.px, path.length * 0.5);
    const head = eased * (path.length + span * 0.2);
    const out = 1 - smoothstep(0.85, 1, t);
    this.streak(path, Math.min(head, path.length), Math.min(span, head), 9, 0.7 * out, 0.6 * out);
    const p = path.at(head);
    const tex = overlayTextures();
    this.marks.take(tex.glow, { x: p.x, y: p.y, width: this.px * 64, tint: OVERLAY.lampBright, alpha: 0.7 * out, blend: 'add' });
    this.marks.take(tex.glow, { x: p.x, y: p.y, width: this.px * 14, tint: OVERLAY.pearl, alpha: out });
  }

  destroy(): void {
    this.gfx.destroy();
  }
}

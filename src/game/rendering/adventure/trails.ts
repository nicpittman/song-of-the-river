/**
 * Trails, kept quiet. A planned outing is a fine dotted ink line from camp to
 * the place. Once a friend is on the way, the ground they have covered shows
 * as a few footprints fading behind them, and the way still to go stays as a
 * fainter dotted line.
 */

import { Graphics, type Container, Sprite, type Texture } from 'pixi.js';
import type { SceneFigure, SceneTrail } from '../../adventure/model';
import type { Vec } from '../../core/math';
import type { FrameInfo } from './frame';
import { SnowTracks } from './snowTracks';
import { approach } from './motion';

const INK = 0x24362e;
/** Spacing of the dots and of the footprints, in screen px and world px. */
const DOT_GAP = 10;
const PRINT_GAP = 11;
const PRINTS = 10;

/** Cumulative lengths along a list of points. */
function lengths(points: readonly Vec[]): Float64Array {
  const out = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) out[i] = out[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  return out;
}

/** Position and heading at distance `d`, written into `out` (no allocation). */
function sample(points: readonly Vec[], cum: Float64Array, d: number, out: { x: number; y: number; angle: number }): void {
  const n = points.length;
  if (n === 1) {
    out.x = points[0]!.x;
    out.y = points[0]!.y;
    out.angle = 0;
    return;
  }
  const total = cum[n - 1]!;
  const c = Math.max(0, Math.min(total, d));
  let i = 1;
  while (i < n - 1 && cum[i]! < c) i++;
  const a = points[i - 1]!;
  const b = points[i]!;
  const span = cum[i]! - cum[i - 1]!;
  const t = span > 0 ? (c - cum[i - 1]!) / span : 0;
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.angle = Math.atan2(b.y - a.y, b.x - a.x);
}

interface TrailView {
  points: readonly Vec[] | null;
  cum: Float64Array;
  dots: Graphics;
  /** Drawn distance along, eased. */
  along: number;
  drawnFrom: number;
  drawnZoom: number;
  drawnStrong: boolean;
  alpha: number;
  seen: number;
}

export class Trails {
  private readonly views = new Map<string, TrailView>();
  private readonly prints: Sprite[] = [];
  private readonly snow = new SnowTracks();
  private readonly at = { x: 0, y: 0, angle: 0 };
  private generation = 0;
  private readonly printScale: number;
  /** Show every trail strongly (the interface's "routes" toggle). */
  emphasise = false;
  /** Height of a bridge deck at a point: the dotted line climbs the drawn arch with the walker. */
  deck: (x: number, y: number) => number = () => 0;

  constructor(
    private readonly ink: Container,
    ground: Container,
    footprint: Texture,
  ) {
    this.printScale = 8 / footprint.width;
    for (let i = 0; i < 192; i++) {
      const s = new Sprite(footprint);
      s.anchor.set(0.5);
      s.visible = false;
      ground.addChild(s);
      this.prints.push(s);
    }
  }

  update(trails: readonly SceneTrail[], figures: readonly SceneFigure[], f: FrameInfo, animals: ReadonlyArray<{ id: string; at: Vec }> = []): void {
    this.generation++;
    let print = 0;
    const winter = f.season === 3;
    for (const trail of trails) {
      if (trail.points.length < 2) continue;
      let view = this.views.get(trail.person);
      if (!view) {
        view = { points: null, cum: new Float64Array(0), dots: new Graphics(), along: 0, drawnFrom: -1, drawnZoom: 0, drawnStrong: false, alpha: 0, seen: 0 };
        this.ink.addChild(view.dots);
        this.views.set(trail.person, view);
      }
      view.seen = this.generation;
      if (view.points !== trail.points) {
        view.points = trail.points;
        view.cum = lengths(trail.points);
        view.drawnFrom = -1;
        if (trail.planned) view.along = 0;
      }
      const total = view.cum[view.cum.length - 1]!;
      view.along = approach(view.along, trail.planned ? 0 : trail.progress * total, 3, f.dt);
      view.alpha = approach(view.alpha, 1, 4, f.dt);
      let selected = false;
      for (const fig of figures) if (fig.id === trail.person && fig.selected) selected = true;
      const strong = trail.planned || selected || this.emphasise;
      this.redraw(view, trail.planned ? 0 : view.along, f.zoom, strong);
      view.dots.alpha = view.alpha * (strong ? 1 : 0.55);
      if (!trail.planned && !winter) print = this.footprints(view, print, winter, f);
    }
    if (winter) {
      const walkers = figures.filter(figure => figure.visible).map(figure => ({ id: figure.id, at: figure.at, moving: figure.pose === 'walk' }));
      walkers.push(...animals.map(animal => ({ ...animal, moving: true })));
      for (const track of this.snow.update(walkers, f.dt)) {
        if (print >= this.prints.length) break;
        if (track.x < f.left || track.x > f.right || track.y < f.top || track.y > f.bottom) continue;
        const sprite = this.prints[print++]!;
        sprite.visible = true; sprite.position.set(track.x, track.y); sprite.rotation = track.angle;
        sprite.tint = 0x6f7f9c; sprite.alpha = track.alpha; sprite.scale.set(this.printScale * .8);
      }
    } else this.snow.clear();
    for (let i = print; i < this.prints.length; i++) this.prints[i]!.visible = false;
    for (const [id, view] of this.views) {
      if (view.seen === this.generation) continue;
      view.alpha = approach(view.alpha, 0, 3, f.dt);
      view.dots.alpha = view.alpha;
      if (view.alpha < 0.01) {
        view.dots.destroy();
        this.views.delete(id);
      }
    }
  }

  /** The dotted line from `from` onward, rebuilt only when it would visibly change. */
  private redraw(view: TrailView, from: number, zoom: number, strong: boolean): void {
    const gap = DOT_GAP / zoom;
    const step = Math.floor(from / gap);
    const zoomBucket = Math.round(Math.log2(zoom) * 8);
    if (step === view.drawnFrom && zoomBucket === view.drawnZoom && strong === view.drawnStrong) return;
    view.drawnFrom = step;
    view.drawnZoom = zoomBucket;
    view.drawnStrong = strong;
    const g = view.dots;
    g.clear();
    const points = view.points!;
    const total = view.cum[view.cum.length - 1]!;
    const r = (strong ? 0.75 : 0.55) / zoom;
    // Dots stay put as the walker passes: they sit on a fixed spacing from the start.
    for (let d = (step + 1) * gap; d < total - gap * 0.5; d += gap) {
      sample(points, view.cum, d, this.at);
      g.circle(this.at.x, this.at.y - this.deck(this.at.x, this.at.y), r).fill({ color: INK, alpha: 0.4 });
    }
    // A small ink tick where the trail ends.
    sample(points, view.cum, total, this.at);
    g.circle(this.at.x, this.at.y, 1.8 / zoom).stroke({ color: INK, width: 1 / zoom, alpha: 0.4 });
  }

  /** Footprints behind the walker, fading with distance. Returns the next free print. */
  private footprints(view: TrailView, next: number, winter: boolean, f: FrameInfo): number {
    const points = view.points!;
    const last = Math.floor(view.along / PRINT_GAP);
    for (let i = 0; i < PRINTS && next < this.prints.length; i++) {
      const index = last - i;
      if (index < 1) break;
      const d = index * PRINT_GAP;
      sample(points, view.cum, d, this.at);
      if (this.at.x < f.left || this.at.x > f.right || this.at.y < f.top || this.at.y > f.bottom) continue;
      // Prints are pressed into the ground, not the planks.
      if (this.deck(this.at.x, this.at.y) > 2) continue;
      const side = index % 2 === 0 ? 1 : -1;
      const s = this.prints[next++]!;
      s.visible = true;
      s.position.set(this.at.x - Math.sin(this.at.angle) * side * 2.2, this.at.y + Math.cos(this.at.angle) * side * 2.2);
      s.rotation = this.at.angle;
      s.tint = winter ? 0x6f7f9c : 0xffffff;
      s.alpha = view.alpha * (1 - i / PRINTS) * (winter ? 0.6 : 0.32);
      s.scale.set(this.printScale * 0.8);
    }
    return next;
  }
}

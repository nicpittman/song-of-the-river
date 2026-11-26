/**
 * Small things glinting on the ground by a friend's path. No art: a soft
 * twinkle drawn with a few strokes of light, a four-pointed star that swells
 * and fades every second or two over a faint warm fleck, as sun catches
 * something in the grass. It eases in, twinkles, and fades as its time runs
 * out; looked at, it gives one last bright twinkle and a few specks, and is
 * gone.
 */

import { Graphics } from 'pixi.js';
import type { SceneGlint } from '../../adventure/model';
import type { FrameInfo, Stage } from './frame';
import { approach, hash01, seedOf } from './motion';
import { type Particles, burst, newBurst } from './particles';

/** Seconds to ease in, and to fade at the end of its time. */
const ENTER = 0.6;
const EXIT = 1.6;
/** Seconds the last twinkle takes once it has been looked at. */
const TAKEN = 0.8;
/** Seconds between twinkles. */
const EVERY = 1.5;
/** Warm sunlight, and the pale fleck under it. */
const LIGHT = 0xfff4d6;
const FLECK = 0xfffbef;
/** A thumb's width round it answers a tap, in screen pixels (44 px across). */
const HIT = 22;
const scratch = newBurst();

class GlintView {
  readonly light = new Graphics();
  readonly fleck = new Graphics();
  x = 0;
  y = 0;
  age = 0;
  life = 9;
  /** Seconds into the last twinkle once looked at, or -1. */
  taken = -1;
  /** Seconds into fading after the scene let it go, or -1. */
  leaving = -1;
  seen = 0;
  done = false;
  private alpha = 0;
  private readonly phase: number;

  constructor(readonly id: string, stage: Stage) {
    this.phase = hash01(seedOf(id)) * EVERY;
    this.light.blendMode = 'add';
    stage.glow.addChild(this.light);
    stage.ground.addChild(this.fleck);
  }

  sync(g: SceneGlint): void {
    this.x = g.at.x;
    this.y = g.at.y;
    this.life = g.life;
    if (Math.abs(g.age - this.age) > 0.6) this.age = g.age;
    if (g.found && this.taken < 0) this.taken = 0;
  }

  update(f: FrameInfo, sparks: Particles): void {
    this.age += f.dt;
    if (this.leaving >= 0) this.leaving += f.dt;
    if (this.taken >= 0) {
      if (this.taken === 0 && !f.reduced) {
        const b = burst(scratch, this.x, this.y - 3, this.y);
        b.vy = -22; b.spread = 26; b.gravity = -6; b.life = 0.9; b.size = 2.4; b.grow = 0.4; b.tint = LIGHT; b.alpha = 0.85; b.drag = 1.6;
        sparks.emit(b, 7);
      }
      this.taken += f.dt;
    }
    const enter = Math.min(1, this.age / ENTER);
    const exit = this.leaving >= 0 ? Math.min(1, this.leaving / 0.5) : Math.max(0, (this.age - (this.life - EXIT)) / EXIT);
    const taken = this.taken >= 0 ? Math.min(1, this.taken / TAKEN) : 0;
    if (exit >= 1 || taken >= 1) this.done = true;
    this.alpha = approach(this.alpha, enter * (1 - exit) * (1 - taken), 12, f.dt);

    const g = this.light, fl = this.fleck;
    g.clear();
    fl.clear();
    const visible = this.alpha > 0.01 && this.x > f.left && this.x < f.right && this.y > f.top && this.y < f.bottom;
    g.visible = fl.visible = visible;
    if (!visible) return;
    const px = 1 / f.zoom;
    // The twinkle: a quick swell and a slower fade, every second or two; a steady faint shine between.
    const cycle = ((this.age + this.phase) % EVERY) / EVERY;
    const swell = f.reduced ? 0.55 : cycle < 0.18 ? cycle / 0.18 : Math.max(0, 1 - (cycle - 0.18) / 0.42);
    const pulse = this.taken >= 0 ? 1 + taken * 0.8 : 0.5 + 0.5 * swell * swell;
    const a = this.alpha;
    const cx = this.x, cy = this.y - 3 * px;
    // The fleck itself: something small and pale in the grass.
    fl.ellipse(this.x, this.y, 3.2 * px, 1.6 * px).fill({ color: FLECK, alpha: 0.75 * a });
    // A soft halo, then the star's long and short rays, turning a little as it twinkles.
    g.circle(cx, cy, 10 * px * pulse).fill({ color: LIGHT, alpha: 0.18 * a });
    g.circle(cx, cy, 5 * px * pulse).fill({ color: LIGHT, alpha: 0.22 * a });
    g.circle(cx, cy, 2.8 * px).fill({ color: 0xffffff, alpha: 0.95 * a });
    const long = 15 * px * pulse, short = 7 * px * pulse, turn = f.reduced ? 0 : (this.age + this.phase) * 0.35;
    star(g, cx, cy, long, 1.7 * px, turn, 0.9 * a);
    star(g, cx, cy, short, 1.1 * px, turn + Math.PI / 4, 0.55 * a);
  }

  hits(x: number, y: number, zoom: number): number {
    if (this.taken >= 0 || this.leaving >= 0 || this.alpha < 0.15) return Infinity;
    const d = Math.hypot(x - this.x, y - (this.y - 3 / zoom));
    return d < HIT / zoom ? d : Infinity;
  }

  destroy(): void {
    this.light.destroy();
    this.fleck.destroy();
  }
}

/** A four-pointed star of light: two thin diamonds crossed. */
function star(g: Graphics, x: number, y: number, r: number, w: number, turn: number, alpha: number): void {
  for (const a of [turn, turn + Math.PI / 2]) {
    const cx = Math.cos(a), cy = Math.sin(a);
    g.poly([x + cx * r, y + cy * r, x - cy * w, y + cx * w, x - cx * r, y - cy * r, x + cy * w, y - cx * w]).fill({ color: LIGHT, alpha });
  }
}

export class Glints {
  private readonly views = new Map<string, GlintView>();
  private generation = 0;
  private readonly retired = new Set<string>();

  constructor(private readonly stage: Stage, private readonly sparks: Particles) {}

  update(glints: readonly SceneGlint[], f: FrameInfo): void {
    this.generation++;
    const present = new Set(glints.map((g) => g.id));
    for (const id of this.retired) if (!present.has(id)) this.retired.delete(id);
    for (const g of glints) {
      if (this.retired.has(g.id)) continue;
      let view = this.views.get(g.id);
      if (!view) {
        view = new GlintView(g.id, this.stage);
        view.age = g.age;
        this.views.set(g.id, view);
      }
      view.seen = this.generation;
      view.sync(g);
    }
    for (const [id, view] of this.views) {
      if (view.seen !== this.generation && view.taken < 0 && view.leaving < 0) view.leaving = 0;
      view.update(f, this.sparks);
      if (view.done) {
        this.retired.add(id);
        view.destroy();
        this.views.delete(id);
      }
    }
  }

  /** Marks a glint as looked at, before the scene catches up. */
  take(id: string): void {
    const view = this.views.get(id);
    if (view && view.taken < 0) view.taken = 0;
  }

  pick(x: number, y: number, zoom: number): string | null {
    let best: string | null = null;
    let bestD = Infinity;
    for (const view of this.views.values()) {
      const d = view.hits(x, y, zoom);
      if (d < bestD) { bestD = d; best = view.id; }
    }
    return best;
  }
}

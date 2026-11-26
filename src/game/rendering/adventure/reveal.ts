/**
 * The travel day's unveiling. As the group walks down to a new reach, the
 * mist over it rolls back ahead of them (world-anchored, through the `Veil`),
 * loose wisps peel off its edge and thin away, and the reach's landmarks come
 * into light one by one: a soft brightening of the ground, a cartographer's
 * ink ring drawn round the spot, and the name written in with the pen.
 *
 * Everything here is derived from the travel day's clock (`t`, game seconds
 * since the group set off), so a save reopened mid-journey shows the reveal
 * exactly as far as it has got, and a skipped day simply finishes it. The
 * timeline is pure (`revealEdge`, `revealBeats`) so the session can time its
 * caption, sound and camera from the same numbers.
 */

import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import type { Vec } from '../../core/math';
import type { FrameInfo } from './frame';

export interface RevealLandmark {
  id: string;
  name: string;
  at: Vec;
  /** The reach's settlement: lettered in spaced capitals, and the moment the reach "crests into view". */
  settlement: boolean;
}

export interface RevealPlan {
  /** Changes when a different reach is being revealed. */
  id: string;
  /** World y of the mist's edge before the day (the old reach's) and once the reach is open. */
  from: number;
  to: number;
  landmarks: RevealLandmark[];
  /** The group's actual saved walk ends here; the settlement's welcome waits for them. */
  arrival?: number;
}

/** When the mist starts to move and when it has drawn back from the whole reach (travel-day seconds). */
export const REVEAL_TIMES = { start: 2.5, end: 29 } as const;
/** A landmark reads clear once the mist's edge lies this far below it (the veil's feather is long). */
const CLEAR_BELOW = 190;
/** Landmarks never crowd each other: at least this long between two coming into light. */
const BEAT_SPACING = 1.7;
/** How long a written name stays before it fades, and how long the fade takes (seconds). */
const HOLD = 6.2;
const FADE = 1.6;
/** How long the pen takes to write a name, draw the ring, and the light to pass (seconds). */
const WRITE = 1.15;
const RING = 0.85;
const SWEEP = 2.2;

const INK = 0x24362e;
const IVORY = 0xf6f1e4;
const FONT = "'Cormorant Garamond', 'Iowan Old Style', Palatino, Georgia, serif";
const FONT_PX = 32;
const NAME_PX = { settlement: 24, place: 16 } as const;

const smooth = (k: number): number => k * k * (3 - 2 * k);
const clamp01 = (k: number): number => (k < 0 ? 0 : k > 1 ? 1 : k);

/** The mist's edge at travel-day second `t`: it eases off the old reach, rolls steadily, then settles. */
export function revealEdge(plan: RevealPlan, t: number): number {
  const k = clamp01((t - REVEAL_TIMES.start) / (REVEAL_TIMES.end - REVEAL_TIMES.start));
  // Mostly steady, softened only at the two ends, so the reach unrolls at a walking pace.
  const eased = 0.65 * k + 0.35 * smooth(k);
  return plan.from + (plan.to - plan.from) * eased;
}

/** When each landmark comes into light (same order as `plan.landmarks`), spaced so none crowds the next. */
export function revealBeats(plan: RevealPlan): number[] {
  const raw = plan.landmarks.map((mark) => {
    const target = mark.at.y + CLEAR_BELOW;
    if (mark.settlement && plan.arrival !== undefined) return Math.max(plan.arrival, REVEAL_TIMES.start);
    if (target <= plan.from) return REVEAL_TIMES.start;
    for (let t = REVEAL_TIMES.start; t <= REVEAL_TIMES.end; t += 0.05) if (revealEdge(plan, t) >= target) return t;
    return REVEAL_TIMES.end;
  });
  const order = raw.map((t, i) => ({ t, i })).sort((a, b) => a.t - b.t);
  const out = new Array<number>(raw.length);
  let last = -Infinity;
  for (const { t, i } of order) {
    last = Math.max(t, last + BEAT_SPACING);
    out[i] = last;
  }
  return out;
}

/** The moment the settlement comes into view, or null if the plan has none. */
export function crestTime(plan: RevealPlan): number | null {
  const beats = revealBeats(plan);
  const i = plan.landmarks.findIndex((m) => m.settlement);
  return i < 0 ? null : beats[i]!;
}

interface MarkView {
  mark: RevealLandmark;
  at: number;
  name: Text;
  mask: Graphics;
  ring: Graphics;
  light: Sprite;
  /** Seed for the hand-drawn wobble of the ring. */
  seed: number;
  /** Shown already when the plan began (a reopened save): never drawn. */
  silent: boolean;
  /** Its sound has been played. */
  fired: boolean;
}

interface Wisp {
  sprite: Sprite;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
}

export class ReachReveal {
  /** Ink and light over the scenery and the mist. */
  readonly container = new Container();
  private readonly wisps: Wisp[] = [];
  private marks: MarkView[] = [];
  private plan: RevealPlan | null = null;
  private lastEdge = 0;
  private spawnDebt = 0;
  /** Seconds since the plan ended, for fading what is left. */
  private ending = -1;
  /** Called when a landmark begins to come into light (for its sound). */
  onBeat: (mark: RevealLandmark) => void = () => {};

  constructor(
    /** Where peeling wisps are drawn: with the mist, under the ink. */
    private readonly mistLayer: Container,
    private readonly mistTexture: Texture,
    private readonly lightTexture: Texture,
  ) {}

  get active(): boolean {
    return this.plan !== null;
  }

  begin(plan: RevealPlan, t: number): void {
    this.clear();
    this.plan = plan;
    this.ending = -1;
    this.lastEdge = revealEdge(plan, t);
    const beats = revealBeats(plan);
    this.marks = plan.landmarks.map((mark, i) => this.makeMark(mark, beats[i]!, i, t));
  }

  /** The travel day is over (or was never on): what remains fades away. */
  end(): void {
    if (!this.plan) return;
    this.plan = null;
    this.ending = 0;
  }

  /**
   * Draws the reveal at travel-day second `t` and returns where the mist's
   * edge should be (null when no reveal is running).
   */
  update(t: number | null, f: FrameInfo): number | null {
    const dt = f.dt;
    this.updateWisps(dt, f);
    if (this.ending >= 0) {
      this.ending += dt;
      const k = 1 - clamp01(this.ending / FADE);
      this.container.alpha = k;
      if (k <= 0) { this.clear(); this.ending = -1; this.container.alpha = 1; }
      return null;
    }
    const plan = this.plan;
    if (!plan || t === null) return null;
    this.container.alpha = 1;
    const edge = revealEdge(plan, t);
    // Wisps tear off the edge as it moves: more of them the faster it rolls back.
    if (!f.reduced && edge > this.lastEdge && edge - this.lastEdge < 400) {
      this.spawnDebt += (edge - this.lastEdge) / 55;
      while (this.spawnDebt >= 1) { this.spawnDebt -= 1; this.spawnWisp(edge); }
    }
    this.lastEdge = edge;
    for (const view of this.marks) this.drawMark(view, t, f);
    return edge;
  }

  // ── Landmarks ───────────────────────────────────────────────────────────

  private makeMark(mark: RevealLandmark, at: number, index: number, t: number): MarkView {
    const name = new Text({
      text: mark.settlement ? mark.name.toUpperCase() : mark.name,
      style: {
        fontFamily: FONT, fontSize: FONT_PX, fontWeight: '500', fontStyle: mark.settlement ? 'normal' : 'italic',
        fill: INK, letterSpacing: mark.settlement ? 9 : 1, stroke: { color: IVORY, width: 7, join: 'round' },
      },
    });
    name.anchor.set(0, 0.5);
    const mask = new Graphics();
    name.mask = mask;
    const ring = new Graphics();
    const light = new Sprite(this.lightTexture);
    light.anchor.set(0.5);
    light.tint = 0xfff4dc;
    light.alpha = 0;
    // The light lies under the ink; the ring and name over it.
    this.container.addChild(light, ring, name, mask);
    const silent = at < t - 1.2;
    const view: MarkView = { mark, at, name, mask, ring, light, seed: index * 1.913 + 0.4, silent, fired: silent };
    name.visible = ring.visible = light.visible = mask.visible = false;
    return view;
  }

  private drawMark(view: MarkView, t: number, f: FrameInfo): void {
    const age = t - view.at;
    const life = age >= 0 && age < HOLD + FADE && !view.silent;
    view.name.visible = view.ring.visible = view.mask.visible = life;
    view.light.visible = life && !f.reduced && age < SWEEP;
    if (!life) return;
    // The moment it begins, once: its sound.
    if (!view.fired) {
      view.fired = true;
      this.onBeat(view.mark);
    }
    const px = 1 / f.zoom;
    const { x, y } = view.mark.at;
    const fade = 1 - clamp01((age - HOLD) / FADE);
    const reduced = f.reduced;

    // A soft brightening passes over the spot as the mist leaves it: no glow, just the ground taking the light.
    if (view.light.visible) {
      const k = clamp01(age / SWEEP);
      const size = (view.mark.settlement ? 620 : 440) * (0.7 + 0.5 * smooth(k));
      view.light.position.set(x, y);
      view.light.width = size * 1.5;
      view.light.height = size;
      view.light.alpha = 0.2 * Math.sin(Math.PI * k);
    }

    // The ring: drawn round the spot in one stroke of the pen, slightly wobbly, overshooting a little.
    const ringK = reduced ? 1 : smooth(clamp01(age / RING));
    const r = view.mark.settlement ? 30 : 21;
    const g = view.ring;
    g.clear();
    const start = -2.2 + view.seed;
    const sweep = Math.PI * 2 * 1.08 * ringK;
    const steps = Math.max(2, Math.ceil(40 * ringK));
    for (let i = 0; i <= steps; i++) {
      const a = start + (sweep * i) / steps;
      const wob = 1 + 0.07 * Math.sin(a * 3 + view.seed * 5) + 0.05 * (i / steps);
      const px0 = Math.cos(a) * r * wob;
      const py0 = Math.sin(a) * r * wob * 0.82;
      if (i === 0) g.moveTo(px0, py0); else g.lineTo(px0, py0);
    }
    g.stroke({ color: INK, width: 1.5, alpha: 0.85, cap: 'round', join: 'round' });
    g.position.set(x, y);
    g.scale.set(px);
    g.alpha = (reduced ? clamp01(age / 0.3) : 1) * fade * 0.9;

    // The name, written in left to right just after the ring, with a short swash under a settlement.
    const name = view.name;
    name.scale.set(((view.mark.settlement ? NAME_PX.settlement : NAME_PX.place) / FONT_PX) * px);
    const gap = (r + 8) * px;
    const w = name.width;
    // Settlements are lettered above their ring, places to the right of it.
    const nx = view.mark.settlement ? x - w / 2 : x + gap;
    const ny = view.mark.settlement ? y - (r + 20) * px : y;
    name.position.set(nx, ny);
    const writeK = reduced ? 1 : clamp01((age - RING * 0.55) / WRITE);
    const h = name.height;
    const m = view.mask;
    m.clear();
    if (writeK > 0) m.rect(nx - 4 * px, ny - h, (w + 8 * px) * (1 - (1 - writeK) ** 1.6), h * 2).fill(0xffffff);
    name.alpha = (reduced ? clamp01((age - 0.15) / 0.35) : 1) * fade;
    if (view.mark.settlement && !reduced && writeK > 0.9) {
      const k = clamp01((age - RING * 0.55 - WRITE) / 0.5);
      const half = (w / px) * 0.32 * smooth(k);
      g.moveTo(-half, -r - 8).quadraticCurveTo(0, -r - 4, half, -r - 8).stroke({ color: INK, width: 1.1, alpha: 0.7, cap: 'round' });
    }
  }

  // ── Peeling wisps ───────────────────────────────────────────────────────

  private spawnWisp(edge: number): void {
    let wisp = this.wisps.find((w) => w.age >= w.life);
    if (!wisp) {
      if (this.wisps.length >= 22) return;
      const sprite = new Sprite(this.mistTexture);
      sprite.anchor.set(0.5);
      this.mistLayer.addChild(sprite);
      wisp = { sprite, vx: 0, vy: 0, age: 0, life: 0, size: 0 };
      this.wisps.push(wisp);
    }
    const x = 120 + Math.random() * 2000;
    // They lean away from the river toward the valley's sides, and lift a little as they thin.
    const side = x < 1100 ? -1 : 1;
    wisp.vx = side * (14 + Math.random() * 30);
    wisp.vy = -6 - Math.random() * 10;
    wisp.age = 0;
    wisp.life = 6 + Math.random() * 4;
    wisp.size = 380 + Math.random() * 360;
    wisp.sprite.position.set(x, edge - 40 + (Math.random() - 0.5) * 160);
    wisp.sprite.visible = true;
  }

  private updateWisps(dt: number, f: FrameInfo): void {
    for (const w of this.wisps) {
      if (w.age >= w.life) { w.sprite.visible = false; continue; }
      w.age += dt;
      const k = clamp01(w.age / w.life);
      w.sprite.x += w.vx * dt;
      w.sprite.y += w.vy * dt;
      const grow = 1 + 0.6 * k;
      w.sprite.width = w.size * 1.8 * grow;
      w.sprite.height = w.size * 0.62 * (1 - 0.35 * k);
      // In quickly, then thinning away to nothing.
      w.sprite.alpha = 0.5 * Math.min(1, w.age / 0.6) * (1 - smooth(k));
      w.sprite.visible = !f.reduced;
    }
  }

  private clear(): void {
    for (const view of this.marks) {
      view.name.destroy();
      view.mask.destroy();
      view.ring.destroy();
      view.light.destroy();
    }
    this.marks = [];
  }
}

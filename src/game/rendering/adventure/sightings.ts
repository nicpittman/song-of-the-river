/**
 * Creatures showing themselves in the valley for a few seconds. Each arrives
 * with life in it and leaves gracefully: a fish rises and falls back in
 * rings, a heron glides down and lands, a duck paddles in with a wake, a fox
 * trots up, pauses and looks about, a kingfisher flies to a perch, a
 * butterfly wanders. A fine pencil arc runs down clockwise to show the time
 * left to sketch it; sketching closes the loop with a
 * few quick hatch strokes before the creature fades.
 */

import { Graphics, Sprite } from 'pixi.js';
import type { Art } from '../art';
import type { SceneSighting } from '../../adventure/model';
import type { ArtLibrary } from '../art';
import type { FrameInfo, Stage } from './frame';
import { approach, hash01, seedOf } from './motion';
import { type Particles, burst, newBurst } from './particles';
import { type Family, creatureOf } from './creatures';
import type { River } from '../../world/river';
import { inWater } from '../../adventure/waterHabitat';
import { sightingClock } from './sightingClock';

const ENTER = 1.4;
const EXIT = 1.3;
const SKETCH = 0.95;
/** Warm graphite, never black, for the pencil ring. */
const GRAPHITE = 0x5a4e42;
/** Creatures are drawn a little larger than life on the map, so they can be found and tapped. */
const SHOWN = 1.25;
/** Seen from far off, a creature is never drawn smaller than this on screen, in pixels, up to twice its size. */
const MIN_ON_SCREEN = 26;
/** The pale paper edge under it. */
const PAPER = 0xf6efe0;
/** The timer begins at noon; sketching finishes with a little overlapping pencil loop. */
const ARC_FROM = -Math.PI / 2;
const ARC_CLOSED = ARC_FROM + Math.PI * 2.12;
const easeOut = (x: number): number => 1 - (1 - x) * (1 - x) * (1 - x);
const scratch = newBurst();

class SightingView {
  readonly sprite = new Sprite();
  readonly shadow: Sprite;
  readonly marks = new Graphics();
  readonly family: Family;
  private readonly still: Art;
  private readonly gait: Art[];
  private readonly flying: Art[];
  private readonly strike: Art | null;
  /** Sprite scale that draws the current art at its world size. */
  private base = 1;
  private shownArt: Art | null = null;
  private readonly seed: number;
  /** -1 or 1: the side it arrives from. */
  private readonly side: number;
  age = 0;
  /** The rules' clock, rather than the cosmetic animation's eased age. */
  private clockAge = 0;
  life = 8;
  fresh = false;
  x = 0;
  y = 0;
  /** Drawn centre, for picking. */
  cx = 0;
  cy = 0;
  size: number;
  /** Seconds into the sketched flourish, or -1. */
  sketched = -1;
  /** Seconds into a natural exit after the scene dropped it, or -1. */
  leaving = -1;
  done = false;
  seen = 0;
  private rise = -1;
  private specked = false;
  /** Height of the branch it lands on, when it comes to a planted tree. */
  perchLift = 0;
  private facing = 1;
  /** The creature's own wash over its art (white for most). */
  private tint = 0xffffff;
  /** Its drawn size before any zoom boost, and the boost that keeps it findable from far off. */
  private natural = 0;
  private boost = 1;
  /** The depth of the nearest scenery covering the creature, rechecked a few times a second. */
  private coverZ = -Infinity;
  /** True once it is drawn over whatever stood in front of it. */
  get onTop(): boolean { return this.coverZ !== -Infinity; }
  private coverCheck = 0;
  private readonly water: Stage['water'];

  constructor(
    readonly id: string,
    species: string,
    art: ArtLibrary,
    stage: Stage,
    private readonly river?: River | null,
  ) {
    const c = creatureOf(species, art);
    this.family = c.family;
    this.still = c.still;
    this.gait = c.gait;
    this.flying = c.flying;
    this.strike = c.strike;
    this.tint = c.tint;
    this.natural = Math.max(c.still.width, c.still.height) * SHOWN;
    this.size = this.natural;
    this.seed = seedOf(id);
    this.side = hash01(this.seed) < 0.5 ? -1 : 1;
    this.facing = -this.side;
    this.show(this.still);
    this.sprite.alpha = 0;
    this.water = stage.water;
    const onWater = this.family === 'fish' || this.family === 'swimmer';
    (onWater ? stage.water : stage.sorted).addChild(this.sprite);
    this.shadow = new Sprite(art.get('shadow').texture);
    this.shadow.anchor.set(0.5);
    this.shadow.alpha = 0;
    stage.ground.addChild(this.shadow);
    stage.ink.addChild(this.marks);
  }

  private show(art: Art): void {
    if (this.shownArt === art) return;
    this.shownArt = art;
    this.sprite.texture = art.texture;
    this.sprite.anchor.set(art.anchor[0], art.anchor[1]);
    this.base = (art.width / art.texture.width) * SHOWN * this.boost;
  }

  sync(s: SceneSighting): void {
    this.x = s.at.x;
    this.y = s.at.y;
    this.life = Math.max(ENTER + EXIT + 0.5, s.life);
    this.fresh = s.fresh;
    if (this.sketched < 0) this.clockAge = s.age;
    if (s.sketched && this.sketched < 0) this.sketched = 0;
    // Follow the rules' clock, but glide rather than jump.
    if (!this.id.startsWith('resident-') && Math.abs(s.age - this.age) > 0.6) this.age = s.age;
  }

  update(f: FrameInfo, dust: Particles, sparks: Particles): void {
    const dt = f.dt;
    const boost = Math.max(1, Math.min(2, MIN_ON_SCREEN / (this.natural * f.zoom)));
    if (Math.abs(boost - this.boost) > 0.01) {
      this.boost = boost;
      this.size = this.natural * boost;
      const art = this.shownArt;
      this.shownArt = null;
      if (art) this.show(art);
    }
    this.age += dt;
    if (this.sketched >= 0) this.sketched += dt;
    if (this.leaving >= 0) this.leaving += dt;
    // A creature that leaves on its own plays its exit; a sketched one is drawn away.
    const exitT = this.leaving >= 0 ? Math.min(1, this.leaving / EXIT) : Math.max(0, (this.clockAge - (this.life - EXIT)) / EXIT);
    const enterT = Math.min(1, this.age / ENTER);
    if (this.leaving >= 0 && this.leaving > EXIT) this.done = true;
    if (this.sketched > SKETCH) this.done = true;
    // A fresh creature arrives with a few pale specks that fade within a second, once.
    if (this.fresh && !this.specked && this.age > ENTER * 0.7 && !f.reduced) {
      this.specked = true;
      const b = burst(scratch, this.cx, this.cy, this.y);
      b.vy = -10;
      b.spread = 30;
      b.gravity = -2;
      b.life = 0.9;
      b.size = 2.2;
      b.grow = 0.5;
      b.tint = 0xfff0c8;
      b.alpha = 0.6;
      b.drag = 1.5;
      sparks.emit(b, 5);
    }

    const s = this.sprite;
    s.tint = this.tint;
    let alpha = Math.min(1, enterT * 3) * (1 - exitT);
    let px = this.x;
    let py = this.y;
    let texture: Art = this.still;
    let lift = 0;
    let flip = this.facing;
    let rotation = 0;
    let bob = 1;
    const t = this.age;
    const reduced = f.reduced;
    switch (this.family) {
      case 'runner': {
        // Trots in, pauses and looks about, trots on.
        const inK = 1 - (1 - enterT) ** 2;
        const out = exitT * exitT;
        px = this.x + this.side * 70 * (1 - inK) - this.side * 80 * out;
        py = this.y - 8 * (1 - inK);
        const moving = enterT < 1 || exitT > 0;
        if (moving && this.gait.length) texture = this.gait[Math.floor(t * 8) % this.gait.length]!;
        if (!moving) {
          // Looking one way, then the other, now and then; a little breath.
          const look = Math.floor((t + hash01(this.seed) * 3) / 2.6) % 2;
          flip = look === 0 ? -this.side : this.side;
          bob = reduced ? 1 : 1 + 0.015 * Math.sin(t * 2.2);
          rotation = reduced ? 0 : 0.035 * Math.sin(t * 0.9 + this.seed);
        } else flip = -this.side;
        break;
      }
      case 'wader': {
        // Glides down to land, stands, strikes now and then, flies off.
        const inK = 1 - (1 - enterT) ** 2;
        if (enterT < 1 || exitT > 0) {
          const k = enterT < 1 ? 1 - inK : exitT;
          px = this.x + this.side * 90 * k * (enterT < 1 ? 1 : -1);
          lift = 110 * k * k;
          if (this.flying.length) texture = this.flying[Math.floor(t * 6) % this.flying.length]!;
          flip = enterT < 1 ? -this.side : this.side;
        } else {
          flip = -this.side;
          const beat = (t + hash01(this.seed) * 2) % 3.4;
          if (this.strike && beat > 2.7 && beat < 3.2) texture = this.strike;
          bob = reduced ? 1 : 1 + 0.01 * Math.sin(t * 1.7);
        }
        break;
      }
      case 'swimmer': {
        const inK = 1 - (1 - enterT) ** 2;
        const drift = reduced ? 0 : Math.sin(t * 0.5 + this.seed) * 9;
        px = this.x + this.side * 60 * (1 - inK) - this.side * 70 * exitT * exitT + drift;
        py = this.y + (reduced ? 0 : Math.sin(t * 0.37) * 3);
        flip = Math.cos(t * 0.5 + this.seed) * -this.side > 0 || enterT < 1 ? -this.side : this.side;
        bob = reduced ? 1 : 1 + 0.03 * Math.sin(t * 3.1);
        break;
      }
      case 'fish': {
        // Under the water, rising every few seconds in an arc and falling back in rings.
        const cycle = 2.2;
        const phase = (t - 0.6) % cycle;
        const k = phase / 0.8;
        alpha = 0;
        if (t > 0.6 && k < 1 && exitT === 0 && this.sketched < 0) {
          alpha = 1;
          lift = Math.sin(k * Math.PI) * 24;
          px = this.x + (k - 0.5) * 22 * this.side * -1;
          rotation = (0.5 - k) * 1.6 * -this.side;
          flip = -this.side;
          if (this.rise !== Math.floor((t - 0.6) / cycle)) {
            this.rise = Math.floor((t - 0.6) / cycle);
            if (!reduced) {
              const b = burst(scratch, this.x, this.y, this.y);
              b.vy = -40;
              b.spread = 36;
              b.gravity = 140;
              b.life = 0.6;
              b.size = 1.9;
              b.tint = 0xe8f4f4;
              dust.emit(b, 6);
            }
          }
        }
        if (this.sketched >= 0) alpha = Math.max(0, 1 - this.sketched / SKETCH);
        break;
      }
      case 'flutter': {
        const a = t * 1.3 + this.seed;
        const r = reduced ? 4 : 16;
        px = this.x + Math.sin(a) * r + this.side * 50 * (1 - enterT) - this.side * 60 * exitT;
        lift = 14 + Math.sin(a * 1.7) * (reduced ? 2 : 7) + 40 * exitT;
        flip = Math.cos(a) > 0 ? 1 : -1;
        bob = 1;
        const flap = reduced ? 0.8 : 0.3 + 0.7 * Math.abs(Math.sin(t * 11));
        s.scale.set(flip * this.base * flap, this.base);
        break;
      }
      default: {
        // Fly to a perch, sit with a flick of the tail, fly off.
        const inK = 1 - (1 - enterT) ** 3;
        if (enterT < 1 || exitT > 0) {
          const k = enterT < 1 ? 1 - inK : exitT;
          px = this.x + this.side * 80 * k * (enterT < 1 ? 1 : -1);
          lift = 70 * k;
          if (this.flying.length) texture = this.flying[Math.floor(t * 10) % this.flying.length]!;
          flip = enterT < 1 ? -this.side : this.side;
        } else {
          flip = Math.floor(t / 1.9 + this.seed) % 3 === 0 ? this.side : -this.side;
          rotation = reduced ? 0 : Math.max(0, Math.sin(t * 3.3)) * 0.06;
        }
        lift += this.perchLift;
        break;
      }
    }
    if (this.river && (this.family === 'swimmer' || this.family === 'fish')) {
      const water = inWater(this.river, { x: px, y: py });
      px = water.x; py = water.y;
    }
    this.show(texture);
    s.position.set(px, py - lift);
    // Never hidden behind a rock or bush drawn in front: a creature whose body
    // something nearer covers sits on top of it, as if perched there.
    if ((this.coverCheck -= dt) <= 0) {
      this.coverCheck = 0.25;
      // Birds and insects can sit on anything; a deer or fox only on low, near
      // things (a rock, a bush), never floating over a tree's crown.
      const flies = this.family === 'percher' || this.family === 'flutter';
      const reach = flies ? 260 : 70;
      this.coverZ = s.parent === this.water ? -Infinity : coverOver(s, px, py - lift - Math.abs(s.height) * 0.5, this.y, reach, flies ? Infinity : this.size * 2.5);
    }
    s.zIndex = Math.max(this.y, this.coverZ + 0.01);
    s.rotation = rotation;
    if (this.family !== 'flutter') s.scale.set(flip * this.base, this.base * bob);
    // A sketched creature goes grey as the pencil takes it, then fades.
    if (this.sketched >= 0) {
      const k = Math.min(1, this.sketched / SKETCH);
      s.tint = mixTint(this.tint, 0x8b8a80, k);
      alpha *= 1 - Math.max(0, (k - 0.45) / 0.55);
    }
    s.alpha = approach(s.alpha, alpha, 14, dt);
    s.visible = s.alpha > 0.01 && px > f.left && px < f.right && py > f.top && py < f.bottom;
    this.cx = this.family === 'fish' ? this.x : px;
    this.cy = this.family === 'fish' ? this.y : py - lift - this.size * 0.3;

    const grounded = this.family === 'runner' || this.family === 'wader';
    this.shadow.visible = s.visible && grounded;
    if (this.shadow.visible) {
      this.shadow.position.set(px + 2, py + 1);
      this.shadow.width = this.size * 0.7 * (1 - Math.min(1, lift / 80) * 0.5);
      this.shadow.height = this.size * 0.16;
      this.shadow.alpha = s.alpha * 0.3 * f.sun * (1 - Math.min(1, lift / 110));
    }
    this.drawMarks(f);
  }

  /** The water rings of a fish, the pencil arc round a creature, and the strokes that finish it. */
  private drawMarks(f: FrameInfo): void {
    const g = this.marks;
    g.clear();
    const t = this.age;
    if (this.family === 'fish' || this.family === 'swimmer') {
      // Rings on the water where it moves.
      for (let i = 0; i < 2; i++) {
        const p = f.reduced ? 0.35 + i * 0.3 : ((t * 0.38 + i * 0.5) % 1);
        g.ellipse(this.x, this.y + 1, 6 + p * 24, 2.4 + p * 9).stroke({ color: 0xf2f8f6, width: 1.4 / f.zoom, alpha: (1 - p) * 0.8 * (this.leaving < 0 ? 1 : 0.4) });
      }
    }
    // Permanent collection rewards are wildlife, not timed sketch targets.
    if (this.id.startsWith('resident-')) return;
    const timer = sightingClock(this.clockAge, this.life);
    // The moving end travels clockwise as the remaining pencil arc runs down.
    // It follows the simulation clock, so pausing and changing speed stay honest.
    if (this.sketched >= 0) {
      const k = this.sketched / SKETCH;
      const close = f.reduced ? 1 : easeOut(Math.min(1, k / 0.32));
      const alpha = 1 - Math.max(0, (k - 0.55) / 0.45);
      this.pencil(g, f, timer.from + (ARC_FROM - timer.from) * close, timer.to + (ARC_CLOSED - timer.to) * close, alpha);
      // A few quick hatch strokes, one after another, as the drawing is finished.
      for (let i = 0; i < 3; i++) {
        const h = f.reduced ? 1 : Math.max(0, Math.min(1, (k - 0.12 - i * 0.07) / 0.12));
        if (h > 0) this.hatch(g, f, i, h, alpha);
      }
    } else {
      const appear = f.reduced ? 1 : easeOut(Math.max(0, Math.min(1, (t - 0.25) / 0.7)));
      const alpha = Math.min(this.sprite.alpha, this.leaving >= 0 ? 1 - Math.min(1, this.leaving / EXIT) : 1);
      if (appear > 0 && alpha > 0 && timer.remaining > 0) {
        const { rx, ry } = this.ring(f);
        g.ellipse(this.cx, this.cy, rx, ry).stroke({ color: GRAPHITE, width: .8 / f.zoom, alpha: .15 * alpha * appear });
        this.pencil(g, f, timer.from, timer.from + (timer.to - timer.from) * appear, alpha * (this.fresh ? 1 : .85));
        const tip = this.ringPoint(timer.from, rx, ry);
        g.circle(tip.x, tip.y, 1.8 / f.zoom).fill({ color: GRAPHITE, alpha: .8 * alpha * appear });
      }
    }
  }

  /** The ring's radii in world units: never smaller on screen than a fingertip. */
  private ring(f: FrameInfo): { rx: number; ry: number } {
    const rx = Math.max(this.size * 0.62, 25 / f.zoom);
    return { rx, ry: rx * 0.8 };
  }

  /** A point on the hand-drawn ring at angle `a` (radians): a slightly uneven loop, the same every frame. */
  private ringPoint(a: number, rx: number, ry: number): { x: number; y: number } {
    const p = hash01(this.seed + 7) * 6.28;
    const wob = 1 + 0.04 * Math.sin(a * 2 + p) + 0.012 * Math.sin(a * 3 + p * 1.7);
    // The second time round runs a touch outside the first, as a quick pencil loop does.
    const out = 1 + Math.max(0, a - ARC_FROM - Math.PI * 2) * 0.06;
    return { x: this.cx + Math.cos(a) * rx * wob * out, y: this.cy + Math.sin(a) * ry * wob * out };
  }

  /**
   * One pencil line from angle `a0` to `a1`, tapering in and out: a pale
   * paper edge under a fine warm graphite line, so it reads on snow and water.
   */
  private pencil(g: Graphics, f: FrameInfo, a0: number, a1: number, alpha: number): void {
    const { rx, ry } = this.ring(f);
    const px = 1 / f.zoom;
    const steps = Math.max(2, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 44));
    for (let pass = 0; pass < 2; pass++) {
      let last = this.ringPoint(a0, rx, ry);
      for (let i = 1; i <= steps; i++) {
        const u = i / steps;
        const p = this.ringPoint(a0 + (a1 - a0) * u, rx, ry);
        const taper = Math.min(1, u / 0.18, (1 - u) / 0.22 + 0.25);
        g.moveTo(last.x, last.y).lineTo(p.x, p.y);
        if (pass === 0) g.stroke({ color: PAPER, width: 3.4 * px, alpha: 0.45 * alpha * taper, cap: 'round' });
        else g.stroke({ color: GRAPHITE, width: (1.1 + 0.6 * taper) * px, alpha: 0.9 * alpha * taper, cap: 'round' });
        last = p;
      }
    }
  }

  /** Hatch stroke `i` of three, `h` of the way drawn: short slants down one side of the ring. */
  private hatch(g: Graphics, f: FrameInfo, i: number, h: number, alpha: number): void {
    const { rx, ry } = this.ring(f);
    const px = 1 / f.zoom;
    const a = 0.25 + i * 0.32;
    const start = this.ringPoint(a, rx * 1.1, ry * 1.1);
    const len = Math.max(rx * 0.32, 6 * px);
    const end = { x: start.x + len * 0.55 * h, y: start.y + len * 0.8 * h };
    g.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ color: PAPER, width: 3.4 * px, alpha: 0.45 * alpha, cap: 'round' });
    g.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ color: GRAPHITE, width: 1.3 * px, alpha: 0.85 * alpha, cap: 'round' });
  }

  hits(x: number, y: number, zoom: number): number {
    if (this.id.startsWith('resident-') || this.sketched >= 0 || this.leaving >= 0 || this.age < 0.3 || this.sprite.alpha < 0.15) return Infinity;
    const r = Math.max(30 / zoom, this.size * 0.7);
    const d = Math.hypot(x - this.cx, y - this.cy);
    return d < r ? d : Infinity;
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.marks.destroy();
  }
}

function mixTint(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

export class Sightings {
  private readonly views = new Map<string, SightingView>();
  private generation = 0;
  private readonly retired = new Set<string>();
  /** Height of a perch at a point (a planted tree), so arriving birds land on it. */
  perch: (x: number, y: number) => number = () => 0;
  /** Where each creature now on show stands, so scenery in front of it can fade. */
  spots(): Array<{ x: number; y: number }> { return [...this.views.values()].filter((v) => v.sketched < 0 && v.leaving < 0).map((v) => ({ x: v.x, y: v.y })); }

  tracks(): Array<{ id: string; at: { x: number; y: number } }> {
    return [...this.views.values()].filter(view => view.family === 'runner' && view.sprite.alpha > .15).map(view => ({ id: view.id, at: { x: view.cx, y: view.y } }));
  }

  /** Creatures something still hides: the scenery in front of these fades. One drawn on top of its cover needs no fade. */
  hidden(): Array<{ x: number; y: number }> { return [...this.views.values()].filter((v) => v.sketched < 0 && v.leaving < 0 && !v.onTop).map((v) => ({ x: v.x, y: v.y })); }

  constructor(
    private readonly art: ArtLibrary,
    private readonly stage: Stage,
    private readonly dust: Particles,
    private readonly sparks: Particles,
    private readonly river?: River | null,
  ) {}

  update(sightings: readonly SceneSighting[], f: FrameInfo): void {
    this.generation++;
    const present = new Set(sightings.map(s => s.id));
    for (const id of this.retired) if (!present.has(id)) this.retired.delete(id);
    for (const s of sightings) {
      if (this.retired.has(s.id)) continue;
      let view = this.views.get(s.id);
      if (!view) {
        view = new SightingView(s.id, s.species, this.art, this.stage, this.river);
        view.age = s.age;
        view.perchLift = this.perch(s.at.x, s.at.y);
        this.views.set(s.id, view);
      }
      view.seen = this.generation;
      view.sync(s);
    }
    for (const [id, view] of this.views) {
      // A sketched creature comes marked; one that simply goes (its time is up, or the day is over) wanders off.
      if (view.seen !== this.generation && view.sketched < 0 && view.leaving < 0) view.leaving = Math.max(0, view.age - (view.life - EXIT));
      view.update(f, this.dust, this.sparks);
      if (view.done) {
        this.retired.add(id);
        view.destroy();
        this.views.delete(id);
      }
    }
  }

  /** Marks a sighting as sketched at once, before the scene catches up. */
  sketch(id: string): void {
    const view = this.views.get(id);
    if (view && view.sketched < 0) view.sketched = 0;
  }

  pick(x: number, y: number, zoom: number): string | null {
    let best: string | null = null;
    let bestD = Infinity;
    for (const view of this.views.values()) {
      const d = view.hits(x, y, zoom);
      if (d < bestD) {
        bestD = d;
        best = view.id;
      }
    }
    return best;
  }

}

/**
 * The depth of the highest sprite drawn in front of (`x`, `y`) at depth `z`,
 * no taller than `tallest`, or -Infinity when nothing covers it. Only near scenery counts, and only the
 * middle of each sprite, where it is solid rather than its transparent edges.
 */
export function coverOver(self: Sprite, x: number, y: number, z: number, reach = 260, tallest = Infinity): number {
  let top = -Infinity;
  for (const c of self.parent?.children ?? []) {
    if (c === self || !(c instanceof Sprite) || !c.visible || c.zIndex <= z || c.zIndex > z + reach) continue;
    const w = Math.abs(c.width), h = Math.abs(c.height);
    if (h > tallest) continue;
    const left = c.x - c.anchor.x * w, upper = c.y - c.anchor.y * h;
    if (x > left + w * 0.15 && x < left + w * 0.85 && y > upper + h * 0.15 && y < upper + h * 0.95) top = Math.max(top, c.zIndex);
  }
  return top;
}

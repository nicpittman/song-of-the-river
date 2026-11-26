/**
 * The evening fire at camp. By day it is the board's own painted fire (or a
 * small painted campfire where the board has none). As dusk rises, warm light
 * pools round it on the ground, the flames brighten and lean, a thread of
 * smoke climbs, and now and then a spark lifts. Figures near it take their
 * rim light and long shadows from `FrameInfo.firelight` (see `figure.ts`).
 */

import { type Container, Sprite, type Texture } from 'pixi.js';
import type { Vec } from '../../core/math';
import type { BoardDef } from '../../world/types';
import type { ArtLibrary } from '../art';
import type { FrameInfo, Stage } from './frame';
import { type Particles, burst, newBurst } from './particles';

const scratch = newBurst();

export class Camp {
  private readonly pool: Sprite;
  private readonly core: Sprite;
  private readonly flames: Sprite[] = [];
  private readonly own: Sprite;
  private readonly woodpile: Sprite;
  private readonly embers: Sprite;
  private readonly frames: Texture[];
  private ownBase: number;
  /** The illustrated flame layer over the hearth, and a lit copy of it that shines through the evening wash. */
  private flame: Sprite | null = null;
  private flameLit: Sprite | null = null;
  private readonly flames4: Texture[] = [];
  private x = NaN;
  private y = NaN;
  /** True when the board already paints a fire at this spot. */
  private painted = false;
  /** The library has the illustrated fire: it is always drawn, and carries its own flames. */
  private readonly illustrated: boolean;
  private smokeIn = 0;
  private sparkIn = 0;

  constructor(
    art: ArtLibrary,
    stage: Stage,
    private readonly board: BoardDef,
    private readonly smoke: Particles,
    private readonly sparks: Particles,
  ) {
    this.pool = this.light(art.get('warmth').texture, stage.glow);
    // The bright heart of the fire sorts with the scenery, so people sitting in front of it draw over it.
    this.core = this.light(art.get('lamp').texture, stage.sorted);
    this.illustrated = art.has('campfire-base') || art.has('campfire-0');
    const tongue = art.get('flame');
    for (let i = 0; i < 3; i++) {
      const s = new Sprite(tongue.texture);
      s.anchor.set(tongue.anchor[0], tongue.anchor[1]);
      s.blendMode = 'add';
      s.visible = false;
      stage.glow.addChild(s);
      this.flames.push(s);
    }
    const available = art.frames('campfire');
    const cycle = available.length ? available : [0, 1, 2].map((i) => `campfire-${i}`);
    this.frames = cycle.map((id) => art.get(id).texture);
    const a = art.get('campfire-0');
    this.own = new Sprite(this.frames[0]);
    this.own.anchor.set(a.anchor[0], a.anchor[1]);
    this.ownBase = a.width / this.frames[0]!.width;
    this.own.scale.set(this.ownBase);
    this.own.visible = false;
    stage.sorted.addChild(this.own);
    // Illustrated hearth and separate flame layers: the hearth stays still, the flames flicker and grow at dusk.
    if (art.has('campfire-base')) {
      const base = art.get('campfire-base');
      this.own.texture = base.texture;
      this.own.anchor.set(base.anchor[0], base.anchor[1]);
      this.ownBase = base.width / base.texture.width;
      this.own.scale.set(this.ownBase);
      this.frames.length = 0;
      for (let i = 0; i < 4; i++) this.flames4.push(art.get(`campfire-flame-${i}`).texture);
      const flame = art.get('campfire-flame-0');
      this.flame = new Sprite(this.flames4[0]);
      this.flameLit = new Sprite(this.flames4[0]);
      for (const s of [this.flame, this.flameLit]) {
        s.anchor.set(flame.anchor[0], flame.anchor[1]);
        s.scale.set(this.ownBase);
        s.visible = false;
      }
      this.flameLit.blendMode = 'add';
      stage.sorted.addChild(this.flame);
      stage.glow.addChild(this.flameLit);
    }
    // A woodpile by the fire, and the embers that glow on after the flames go down.
    const pile = art.get('woodpile');
    this.woodpile = new Sprite(pile.texture);
    this.woodpile.anchor.set(pile.anchor[0], pile.anchor[1]);
    this.woodpile.width = pile.width;
    this.woodpile.height = pile.height;
    stage.sorted.addChild(this.woodpile);
    const coal = art.get('embers');
    this.embers = new Sprite(coal.texture);
    this.embers.anchor.set(coal.anchor[0], coal.anchor[1]);
    this.embers.width = coal.width;
    this.embers.height = coal.height;
    this.embers.blendMode = 'add';
    this.embers.visible = false;
    stage.glow.addChild(this.embers);
  }

  /**
   * One smoke mote now and then, at `strength` 0..1: from a thin, slow thread
   * (a mote every 1.4 s) to a fuller plume rising higher (one every half
   * second, larger and longer lived). At most about fifteen alive per fire.
   */
  private puff(strength: number, f: FrameInfo): void {
    if (strength <= 0.01) return;
    this.smokeIn -= f.dt;
    if (this.smokeIn > 0) return;
    const s = Math.min(1, strength);
    this.smokeIn = 1.4 - 0.9 * s;
    const b = burst(scratch, this.x + 1, this.y - 20, this.y - 1);
    b.vy = -(12 + 8 * s);
    // A slow lean on the air, never quite the same.
    b.vx = 3 + 2 * Math.sin(f.time * 0.23);
    b.spread = 5;
    b.gravity = -2;
    b.life = 3.5 + 2.5 * s;
    b.size = 6 + 5 * s;
    b.grow = 2.6 + 1.6 * s;
    b.tint = f.season === 3 ? 0xb8c0cc : 0xe6e2da;
    b.alpha = 0.08 + 0.24 * s;
    b.drag = 0.2;
    this.smoke.emit(b, 1);
  }

  private light(texture: Texture, parent: Container): Sprite {
    const s = new Sprite(texture);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    s.visible = false;
    parent.addChild(s);
    return s;
  }

  private moveTo(at: Vec): void {
    this.x = at.x;
    this.y = at.y;
    const near = (p: { x: number; y: number }): boolean => Math.abs(p.x - at.x) < 40 && Math.abs(p.y - at.y) < 40;
    this.painted = this.board.sprites.some((s) => s.asset === 'bonfire' && near(s)) || this.board.hearths.some(near);
    this.own.position.set(at.x, at.y);
    this.own.zIndex = at.y;
    this.flame?.position.set(at.x, at.y);
    this.flameLit?.position.set(at.x, at.y);
    if (this.flame) this.flame.zIndex = at.y + 0.2;
    this.core.zIndex = at.y - 0.5;
    this.woodpile.position.set(at.x - 36, at.y + 4);
    this.woodpile.zIndex = at.y + 4;
    this.embers.position.set(at.x, at.y - 2);
  }

  /** The illustrated flames: a frame every eighth of a second, rising and brightening as the evening comes on. */
  private updateFlame(seen: boolean, f: FrameInfo): void {
    const flame = this.flame;
    const lit = this.flameLit;
    if (!flame || !lit) return;
    flame.visible = seen && !this.painted;
    if (!flame.visible) {
      lit.visible = false;
      return;
    }
    const t = f.time;
    const texture = this.flames4[f.reduced ? 0 : Math.floor(t * 8 + Math.sin(t * 1.3) * 0.5) % 4]!;
    flame.texture = lit.texture = texture;
    const light = f.firelight;
    // A small cooking fire by day; built up and leaping at dusk.
    const grow = 0.8 + 0.28 * light + (f.reduced ? 0 : 0.04 * Math.sin(t * 9.7) + 0.03 * Math.sin(t * 15.1));
    flame.scale.set(this.ownBase * (0.92 + 0.1 * light), this.ownBase * grow);
    flame.alpha = 0.82 + 0.18 * light;
    lit.visible = light > 0.02;
    lit.scale.copyFrom(flame.scale);
    lit.alpha = light * 0.55 * (f.reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 11.3));
  }

  /**
   * `cooking` (0..1) is the day's cooking smoke from this fire: a thin thread
   * in the morning, a fuller rising plume toward dusk (see `AdventureLayer.cooking`).
   */
  update(fire: Vec, f: FrameInfo, cooking = 0): void {
    if (fire.x !== this.x || fire.y !== this.y) this.moveTo(fire);
    const seen = this.x > f.left - 300 && this.x < f.right + 300 && this.y > f.top - 300 && this.y < f.bottom + 300;
    // Where the board already has a hearth or bonfire, the valley's own fire is the camp fire.
    this.own.visible = seen && !this.painted;
    this.woodpile.visible = seen;
    this.embers.visible = seen && f.night > 0.6;
    if (this.embers.visible) this.embers.alpha = (f.night - 0.6) * 1.6 * (f.reduced ? 1 : 0.85 + 0.15 * Math.sin(f.time * 1.3));
    if (this.own.visible && this.frames.length) this.own.texture = this.frames[f.reduced ? 0 : Math.floor(f.time * 8) % this.frames.length]!;
    this.updateFlame(seen, f);
    const light = f.firelight;
    const lit = seen && light > 0.02;
    this.pool.visible = this.core.visible = lit;
    for (const flame of this.flames) flame.visible = lit && !this.illustrated;
    // Smoke by day as well as by evening: the stronger of the cooking and the evening fire's thread.
    if (seen && !f.reduced) this.puff(Math.max(cooking, lit ? 0.55 + 0.45 * light : 0), f);
    if (!lit) return;
    const t = f.time;
    const flicker = f.reduced ? 1 : 0.86 + 0.08 * Math.sin(t * 11) + 0.06 * Math.sin(t * 17.3);
    this.pool.position.set(this.x, this.y + 4);
    this.pool.width = 360 + light * 80;
    this.pool.height = this.pool.width * 0.48;
    this.pool.alpha = light * 0.55 * flicker;
    this.core.position.set(this.x, this.y - 12);
    this.core.width = this.core.height = 72;
    // Under the evening wash, so it is laid on more strongly than the light above it.
    this.core.alpha = Math.min(1, light * 0.8 * flicker);
    this.flames.forEach((s, i) => {
      const sway = f.reduced ? 0 : Math.sin(t * (6 + i) + i * 2) * 0.12;
      s.position.set(this.x + (i - 1) * 4.5, this.y - 1 - Math.abs(i - 1));
      s.rotation = sway;
      s.width = (i === 1 ? 10 : 7) * (0.8 + 0.2 * flicker);
      s.height = (i === 1 ? 22 : 15) * flicker * (0.7 + light * 0.3);
      s.alpha = light * 0.65;
    });
    if (f.reduced) return;
    // Now and then a spark.
    this.sparkIn -= f.dt;
    if (this.sparkIn <= 0) {
      this.sparkIn = 0.6 + Math.random() * 1.6;
      const b = burst(scratch, this.x, this.y - 10, this.y);
      b.vy = -34;
      b.spread = 18;
      b.gravity = -4;
      b.life = 1.3;
      b.size = 2.4;
      b.grow = 0.4;
      b.tint = 0xffc070;
      b.alpha = light;
      b.drag = 0.5;
      this.sparks.emit(b, 1);
    }
  }
}

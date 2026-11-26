/**
 * A small touch of life where the player looks closely: rings spreading on
 * the water by a pool or the river, or, on land, a small bird lifting out of
 * the grass and a few motes of the season (petals, seeds, leaves, flakes)
 * stirred into the air. Looking at somewhere should feel like looking.
 */

import { type Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { ArtLibrary } from '../art';
import type { FrameInfo } from './frame';
import { type Particles, burst, newBurst } from './particles';

const LIFE = 2.6;
const scratch = newBurst();

export class SpotLife {
  private readonly rings = new Graphics();
  private readonly bird: Sprite;
  private readonly wings: [Texture, Texture];
  private age = LIFE;
  private x = 0;
  private y = 0;
  private wet = false;
  private side = 1;
  /** Seconds until the water stirs again while the place stays selected. */
  private again = 0;
  private holding = false;
  /** Sprite scale that draws the bird at its size in world px. */
  private readonly base: number;

  constructor(
    art: ArtLibrary,
    water: Container,
    sorted: Container,
    private readonly motes: Particles,
  ) {
    water.addChild(this.rings);
    this.wings = [art.get('bird-up').texture, art.get('bird-down').texture];
    this.bird = new Sprite(this.wings[0]);
    this.base = art.get('bird-up').width / this.wings[0].width;
    this.bird.anchor.set(0.5);
    this.bird.visible = false;
    sorted.addChild(this.bird);
  }

  /** Starts the touch of life at a place. `wet` when it is at the water's edge or in it. */
  start(x: number, y: number, wet: boolean, f: FrameInfo): void {
    this.x = x;
    this.y = y;
    this.wet = wet;
    this.age = 0;
    this.side = Math.random() < 0.5 ? -1 : 1;
    this.again = 3 + Math.random() * 2;
    this.holding = true;
    if (!wet && !f.reduced) {
      const b = burst(scratch, x + 4, y - 2, y);
      b.vy = -16;
      b.spread = 30;
      b.gravity = 8;
      b.life = 1.8;
      b.size = 2.4;
      b.drag = 0.8;
      b.tint = [0xf3c6c4, 0xe8e4c8, 0xd98a3a, 0xffffff][f.season] ?? 0xffffff;
      this.motes.emit(b, 6);
    }
  }

  /** The place is no longer selected: let the current touch finish without repeating. */
  release(): void {
    this.holding = false;
  }

  update(f: FrameInfo): void {
    this.age += f.dt;
    if (this.holding && this.wet) {
      this.again -= f.dt;
      if (this.again <= 0) {
        this.age = 0;
        this.again = 3.5 + Math.random() * 2.5;
      }
    }
    const g = this.rings;
    g.clear();
    this.bird.visible = false;
    if (this.age >= LIFE) return;
    const k = this.age / LIFE;
    if (this.wet) {
      for (let i = 0; i < 3; i++) {
        const p = (k * 1.4 - i * 0.18);
        if (p <= 0 || p >= 1) continue;
        const r = f.reduced ? 8 + i * 6 : 4 + p * 30;
        g.ellipse(this.x, this.y, r, r * 0.42).stroke({ color: 0xeaf4f2, width: 1, alpha: (1 - p) * 0.7 });
      }
      return;
    }
    // A small bird lifts out of the grass and away.
    const t = Math.min(1, k * 1.3);
    this.bird.visible = true;
    this.bird.texture = this.wings[Math.floor(this.age * 12) % 2]!;
    this.bird.position.set(this.x + this.side * (8 + t * 70), this.y - 6 - t * 60 - Math.sin(t * Math.PI) * 10);
    this.bird.zIndex = this.y;
    this.bird.scale.set(this.side * this.base * (1 + t * 0.3), this.base * (1 + t * 0.3));
    this.bird.alpha = 1 - Math.max(0, (t - 0.7) / 0.3);
  }
}

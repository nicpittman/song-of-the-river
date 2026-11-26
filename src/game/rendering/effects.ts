/**
 * Small moments of reward, drawn in the world: a few motes of light rising
 * where a traveller arrives, and a wider bloom when a wish is granted. They
 * are the game's "well done", so the interface does not have to say it.
 */

import { type Container, Sprite } from 'pixi.js';
import type { ArtLibrary } from './art';

interface Mote {
  sprite: Sprite;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  spin: number;
}

interface Ring {
  sprite: Sprite;
  age: number;
  life: number;
  radius: number;
}

const WARM = 0xffe2a8;
const BLUSH = 0xf7c6c9;

export class Effects {
  private motes: Mote[] = [];
  private rings: Ring[] = [];
  reducedMotion = false;

  constructor(
    private readonly layer: Container,
    private readonly art: ArtLibrary,
  ) {}

  /** A traveller has arrived: a small, quick sparkle. */
  arrive(x: number, y: number): void {
    this.ring(x, y, 46, 0.7, 0.4);
    if (this.reducedMotion) return;
    for (let i = 0; i < 6; i++) this.mote(x, y, 26, 60, 0.9, WARM, 'ember', 7);
  }

  /** A wish has been granted: light spreads across the place and petals lift from it. */
  celebrate(x: number, y: number, radius: number): void {
    this.ring(x, y, radius * 2.2, 2.2, 0.55);
    this.ring(x, y, radius * 1.3, 1.4, 0.5);
    if (this.reducedMotion) return;
    for (let i = 0; i < 26; i++) this.mote(x, y, radius, 90, 2.2, WARM, 'ember', 9);
    for (let i = 0; i < 22; i++) this.mote(x, y, radius, 70, 3, BLUSH, 'petal', 11);
  }

  private ring(x: number, y: number, radius: number, life: number, alpha: number): void {
    const sprite = new Sprite(this.art.get('warmth').texture);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.blendMode = 'add';
    sprite.alpha = alpha;
    this.layer.addChild(sprite);
    this.rings.push({ sprite, age: 0, life, radius });
  }

  private mote(x: number, y: number, spread: number, rise: number, life: number, tint: number, texture: string, size: number): void {
    const sprite = new Sprite(this.art.get(texture).texture);
    sprite.anchor.set(0.5);
    sprite.tint = tint;
    if (texture === 'ember') sprite.blendMode = 'add';
    const angle = Math.random() * Math.PI * 2;
    const reach = Math.sqrt(Math.random()) * spread;
    // Spread wider than deep: the ground is seen at a slant.
    sprite.position.set(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach * 0.6);
    this.layer.addChild(sprite);
    this.motes.push({
      sprite,
      vx: (Math.random() - 0.5) * 30,
      vy: -rise * (0.5 + Math.random() * 0.7),
      age: -Math.random() * 0.25,
      life: life * (0.7 + Math.random() * 0.5),
      size: size * (0.6 + Math.random() * 0.7),
      spin: (Math.random() - 0.5) * 3,
    });
  }

  update(dt: number): void {
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const mote = this.motes[i]!;
      mote.age += dt;
      const t = mote.age / mote.life;
      if (t >= 1) {
        mote.sprite.destroy();
        this.motes.splice(i, 1);
        continue;
      }
      mote.sprite.visible = t >= 0;
      if (t < 0) continue;
      mote.sprite.x += mote.vx * dt;
      mote.sprite.y += mote.vy * dt * (1 - t * 0.6);
      mote.sprite.rotation += mote.spin * dt;
      mote.sprite.width = mote.sprite.height = mote.size;
      mote.sprite.alpha = Math.min(1, t * 8) * (1 - t) ** 1.5;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i]!;
      ring.age += dt;
      const t = ring.age / ring.life;
      if (t >= 1) {
        ring.sprite.destroy();
        this.rings.splice(i, 1);
        continue;
      }
      const grow = 1 - (1 - t) ** 3;
      ring.sprite.width = ring.radius * 2 * (0.3 + 0.7 * grow);
      ring.sprite.height = ring.sprite.width * 0.6;
      ring.sprite.alpha = 0.6 * (1 - t) ** 1.6;
    }
  }
}

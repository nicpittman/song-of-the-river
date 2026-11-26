/**
 * A fixed pool of small sprites for the little events that make a scene
 * tactile: sawdust from a hammer blow, drops from a strike, sparks from a
 * poked fire, smoke, a leaf lifted into a basket. Nothing is created after
 * construction; a burst that finds the pool full simply emits less.
 */

import { type Container, Sprite, type Texture } from 'pixi.js';

export interface Burst {
  x: number;
  y: number;
  /** Starting velocity, world px per second, with a random spread added. */
  vx: number;
  vy: number;
  spread: number;
  /** Downward acceleration (negative rises, as smoke). */
  gravity: number;
  life: number;
  size: number;
  /** Size multiplier reached at the end of life. */
  grow: number;
  tint: number;
  alpha: number;
  /** Depth for sorting, when the pool lives in the sorted layer. */
  depth: number;
  /** Air drag per second, 0..1. */
  drag: number;
}

interface Mote {
  sprite: Sprite;
  vx: number;
  vy: number;
  gravity: number;
  age: number;
  life: number;
  size: number;
  grow: number;
  alpha: number;
  drag: number;
}

export class Particles {
  private readonly motes: Mote[] = [];
  private next = 0;
  private live = 0;

  constructor(parent: Container, texture: Texture, capacity: number, additive = false) {
    for (let i = 0; i < capacity; i++) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      if (additive) sprite.blendMode = 'add';
      parent.addChild(sprite);
      this.motes.push({ sprite, vx: 0, vy: 0, gravity: 0, age: 0, life: 0, size: 1, grow: 1, alpha: 1, drag: 0 });
    }
  }

  /** Emits `count` motes shaped by `b`. */
  emit(b: Burst, count: number): void {
    for (let i = 0; i < count; i++) {
      const m = this.motes[this.next]!;
      this.next = (this.next + 1) % this.motes.length;
      if (!m.sprite.visible) this.live++;
      m.sprite.visible = true;
      m.sprite.position.set(b.x + (Math.random() - 0.5) * 2, b.y + (Math.random() - 0.5) * 2);
      m.sprite.tint = b.tint;
      m.sprite.zIndex = b.depth;
      m.vx = b.vx + (Math.random() - 0.5) * b.spread;
      m.vy = b.vy + (Math.random() - 0.5) * b.spread;
      m.gravity = b.gravity;
      m.age = 0;
      m.life = b.life * (0.7 + Math.random() * 0.6);
      m.size = b.size * (0.7 + Math.random() * 0.6);
      m.grow = b.grow;
      m.alpha = b.alpha;
      m.drag = b.drag;
      m.sprite.width = m.sprite.height = m.size;
    }
  }

  update(dt: number): void {
    if (this.live === 0 || dt === 0) return;
    for (const m of this.motes) {
      if (!m.sprite.visible) continue;
      m.age += dt;
      if (m.age >= m.life) {
        m.sprite.visible = false;
        this.live--;
        continue;
      }
      const k = m.age / m.life;
      const slow = Math.max(0, 1 - m.drag * dt);
      m.vx *= slow;
      m.vy = m.vy * slow + m.gravity * dt;
      m.sprite.x += m.vx * dt;
      m.sprite.y += m.vy * dt;
      const s = m.size * (1 + (m.grow - 1) * k);
      m.sprite.width = m.sprite.height = s;
      // Quick in, slow out.
      m.sprite.alpha = m.alpha * Math.min(1, k * 8) * (1 - k * k);
    }
  }
}

/** A burst with sensible defaults, filled in place to avoid garbage. */
export function burst(into: Burst, x: number, y: number, depth: number): Burst {
  into.x = x;
  into.y = y;
  into.vx = 0;
  into.vy = 0;
  into.spread = 20;
  into.gravity = 0;
  into.life = 1;
  into.size = 2;
  into.grow = 1;
  into.tint = 0xffffff;
  into.alpha = 1;
  into.depth = depth;
  into.drag = 0;
  return into;
}

export function newBurst(): Burst {
  return burst({} as Burst, 0, 0, 0);
}

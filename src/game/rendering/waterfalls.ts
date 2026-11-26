/**
 * Moving water for the valley's waterfalls. The waterfall itself is a still
 * illustration; over it run streaks of white water that fall from the lip to
 * the pool, with spray rising where they land, so the fall reads as falling.
 */

import { type Container, Sprite } from 'pixi.js';
import { mulberry32, type Rng } from '../core/rng';
import type { BoardDef } from '../world/types';
import type { ArtLibrary } from './art';

/** Where the water is within the waterfall illustration, as fractions of its width and height. */
const LIP = { x: 0.555, y: 0.3 };
const FOOT = { x: 0.65, y: 0.70 };
const HALF_WIDTH = 0.095;

interface Fall {
  /** The lip and foot of the fall in world coordinates, and its half-width. */
  lip: { x: number; y: number };
  foot: { x: number; y: number };
  half: number;
  side: number;
  z: number;
}

interface Streak {
  sprite: Sprite;
  /** A darker band rather than a white streak. */
  shade: boolean;
  fall: Fall;
  /** Position across the fall, -1..1. */
  lane: number;
  t: number;
  speed: number;
}

interface Spray {
  sprite: Sprite;
  fall: Fall;
  t: number;
  life: number;
  drift: number;
}

export class Waterfalls {
  private readonly falls: Fall[] = [];
  private readonly streaks: Streak[] = [];
  private readonly spray: Spray[] = [];
  private debt = 0;
  private readonly random:Rng;
  reducedMotion = false;

  constructor(
    private readonly art: ArtLibrary,
    board: BoardDef,
    /** Depth-sorted with the scenery, so trees in front of a fall still cover it. */
    private readonly layer: Container,
  ) {
    this.random=mulberry32(board.seed^0x5731);
    const art_ = art.get('waterfall');
    for (const sprite of board.sprites) {
      if (sprite.asset !== 'waterfall') continue;
      const scale = sprite.scale ?? 1;
      const w = art_.width * scale;
      const h = art_.height * scale;
      const side = sprite.flip ? -1 : 1;
      // Convert a point of the illustration to the world, allowing for the sprite's anchor and mirroring.
      const at = (p: { x: number; y: number }): { x: number; y: number } => ({ x: sprite.x + side * (p.x - art_.anchor[0]) * w, y: sprite.y + (p.y - art_.anchor[1]) * h });
      const fall: Fall = { lip: at(LIP), foot: at(FOOT), half: HALF_WIDTH * w, side, z: sprite.y + 1 };
      this.falls.push(fall);
      const count = Math.max(3,Math.round(9 * scale));
      for (let i = 0; i < count; i++) {
        const streak = new Sprite(art.get('flake').texture);
        streak.anchor.set(0.5);
        // White water takes a little of the pool's blue-grey, so the streaks read as part of the fall, not pasted light.
        // Every other streak is a soft blue-grey shadow band: on falls painted white (or snowed over)
        // light streaks vanish, and it is the darker bands sliding down that show the water moving.
        streak.tint = i % 2 ? 0x7f98a8 : 0xdde8ec;
        streak.zIndex = fall.z;
        layer.addChild(streak);
        this.streaks.push({ sprite: streak, shade: i % 2 === 1, fall, lane: (i / (count - 1)) * 2 - 1, t: i / count, speed: 0.7 + (i % 3) * 0.18 });
      }
    }
  }

  update(dt: number, frozen: boolean, zoom = 1): void {
    const still = this.reducedMotion || frozen;
    // Seen from far off, a streak a few world units wide is under a pixel: keep it at
    // least a few screen pixels wide and a little brighter, so the fall still reads as falling.
    const far = Math.max(0, Math.min(1, (0.9 - zoom) / 0.6));
    const minWidth = 3.2 / Math.max(0.05, zoom);
    const brightness = 0.34 + 0.3 * far;
    for (const streak of this.streaks) {
      if (!still) streak.t = (streak.t + dt * streak.speed) % 1;
      const { fall, t } = streak;
      // Water gathers speed as it falls.
      const drop = t * t * 0.6 + t * 0.4;
      const x = fall.lip.x + (fall.foot.x - fall.lip.x) * drop + streak.lane * fall.half * fall.side * (0.7 + 0.3 * drop);
      const y = fall.lip.y + (fall.foot.y - fall.lip.y) * drop;
      streak.sprite.position.set(x, y);
      // Thin and faint: close up, a wide bright flake shows its own oval outline.
      streak.sprite.width = Math.max(fall.half * 0.26, minWidth);
      streak.sprite.height = fall.half * (1.4 + 2.4 * drop) * (1 + 0.5 * far);
      streak.sprite.alpha = (streak.shade ? 0.3 + 0.15 * far : brightness) * Math.min(1, t * 6) * Math.min(1, (1 - t) * 5);
    }
    if (still) return;

    // Spray rises from the foot of each fall and thins as it drifts.
    this.debt += dt * 5 * this.falls.length;
    while (this.debt >= 1 && this.spray.length < 14 * this.falls.length) {
      this.debt -= 1;
      const fall = this.falls[Math.floor(this.random() * this.falls.length)]!;
      const sprite = new Sprite(this.art.get('smoke').texture);
      sprite.anchor.set(0.5);
      sprite.tint = 0xe4ecef;
      sprite.zIndex = fall.z;
      sprite.position.set(fall.foot.x + (this.random() - 0.5) * fall.half * 2.4, fall.foot.y + this.random() * 4);
      this.layer.addChild(sprite);
      this.spray.push({ sprite, fall, t: 0, life: 0.9 + this.random() * 0.7, drift: (this.random() - 0.3) * 10 });
    }
    this.debt = Math.min(this.debt, 2);
    for (let i = this.spray.length - 1; i >= 0; i--) {
      const puff = this.spray[i]!;
      puff.t += dt / puff.life;
      if (puff.t >= 1) {
        puff.sprite.destroy();
        this.spray.splice(i, 1);
        continue;
      }
      puff.sprite.x += puff.drift * dt;
      puff.sprite.y -= 9 * dt;
      puff.sprite.width = puff.sprite.height = puff.fall.half * (0.9 + 2.2 * puff.t);
      puff.sprite.alpha = (0.36 + 0.2 * far) * Math.min(1, puff.t * 5) * (1 - puff.t);
    }
  }
}

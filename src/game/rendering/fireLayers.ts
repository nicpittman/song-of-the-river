/**
 * An illustrated fire: the still hearth (`campfire-base`) and its four flame
 * layers (`campfire-flame-0..3`), cycled with a little change of height, sway
 * and brightness so the fire is always moving, a lit copy of the flames that
 * shines through the evening wash, and now and then a spark lifting off.
 * Used for every hearth and bonfire in the valley and for the camp fire.
 */

import { type Container, Sprite, type Texture } from 'pixi.js';
import type { ArtLibrary } from './art';

export class FireLayers {
  private readonly base: Sprite;
  private readonly flame: Sprite;
  private readonly lit: Sprite;
  private readonly spark: Sprite;
  private readonly frames: Texture[] = [];
  private readonly k: number;
  private readonly phase: number;
  private sparkAge = 9;
  private sparkIn: number;

  /** True when the library has the layered fire. */
  static available(art: ArtLibrary): boolean {
    return art.has('campfire-base') && art.has('campfire-flame-0');
  }

  constructor(
    art: ArtLibrary,
    sorted: Container,
    /** Additive layer above the evening wash, or the sorted layer when there is none. */
    glow: Container,
    private readonly x: number,
    private readonly y: number,
    scale = 1,
  ) {
    const base = art.get('campfire-base');
    this.k = (base.width / base.texture.width) * scale;
    this.base = this.sprite(base.texture, base.anchor, sorted);
    this.base.zIndex = y;
    for (let i = 0; i < 4; i++) this.frames.push(art.get(`campfire-flame-${i}`).texture);
    this.flame = this.sprite(this.frames[0]!, base.anchor, sorted);
    this.flame.zIndex = y + 0.2;
    this.lit = this.sprite(this.frames[0]!, base.anchor, glow);
    this.lit.blendMode = 'add';
    this.lit.zIndex = y + 0.3;
    const ember = art.get('ember');
    this.spark = this.sprite(ember.texture, [0.5, 0.5], glow);
    this.spark.blendMode = 'add';
    this.spark.zIndex = y + 0.4;
    this.spark.visible = false;
    this.phase = (x * 0.013 + y * 0.007) % 6.28;
    this.sparkIn = 1 + (this.phase % 3);
  }

  private sprite(texture: Texture, anchor: readonly number[], parent: Container): Sprite {
    const s = new Sprite(texture);
    s.anchor.set(anchor[0]!, anchor[1]!);
    s.position.set(this.x, this.y);
    s.scale.set(this.k);
    parent.addChild(s);
    return s;
  }

  /** Shows or hides the whole fire (off screen, say). */
  set visible(on: boolean) {
    this.base.visible = this.flame.visible = on;
    if (!on) this.lit.visible = this.spark.visible = false;
  }

  /**
   * `light` is how strongly the fire is burning against the dark, 0 (a small
   * fire by day) .. 1 (built up at night). The flames move in every case.
   */
  update(time: number, dt: number, light: number, reduced: boolean): void {
    if (!this.base.visible) return;
    const t = time + this.phase;
    // A frame every eighth of a second, with the odd one held a little longer.
    const frame = reduced ? 0 : Math.floor(t * 8 + Math.sin(t * 1.3) * 0.6) & 3;
    this.flame.texture = this.lit.texture = this.frames[frame]!;
    const grow = 0.82 + 0.26 * light + (reduced ? 0 : 0.05 * Math.sin(t * 9.7) + 0.04 * Math.sin(t * 15.1));
    const sway = reduced ? 0 : 0.035 * Math.sin(t * 3.1) + 0.02 * Math.sin(t * 7.9);
    this.flame.scale.set(this.k * (0.94 + 0.08 * light), this.k * grow);
    this.flame.skew.x = sway;
    this.flame.alpha = 0.84 + 0.16 * light + (reduced ? 0 : 0.06 * Math.sin(t * 13.3));
    this.lit.visible = light > 0.03;
    this.lit.scale.copyFrom(this.flame.scale);
    this.lit.skew.x = sway;
    this.lit.alpha = light * 0.5 * (reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 11.3));
    if (reduced) return;
    // Now and then a spark lifts off and fades.
    this.sparkIn -= dt;
    if (this.sparkIn <= 0) {
      this.sparkIn = 1.6 + ((t * 7.31) % 1) * 2.4;
      this.sparkAge = 0;
    }
    this.sparkAge += dt;
    const life = 1.3;
    this.spark.visible = this.sparkAge < life;
    if (this.spark.visible) {
      const p = this.sparkAge / life;
      this.spark.position.set(this.x + Math.sin(t * 2 + p * 4) * 4, this.y - 14 - p * 34);
      this.spark.width = this.spark.height = 3 * (1 - p * 0.6);
      this.spark.alpha = (0.4 + 0.6 * light) * (1 - p) * Math.min(1, p * 6);
    }
  }
}

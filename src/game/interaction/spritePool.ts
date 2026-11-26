/**
 * A handful of reusable sprites for marks that come and go every frame
 * (cursor glow, beads, a fault mark). Each frame: `begin()`, `take()` as many
 * as needed, then `end()` hides whatever was not used. Nothing is created or
 * destroyed once the pool has grown to its working size.
 */

import { type BLEND_MODES, type Container, Sprite, type Texture } from 'pixi.js';

export interface MarkStyle {
  x: number;
  y: number;
  /** Displayed width in world units. */
  width: number;
  /** Displayed height in world units; defaults to `width`. */
  height?: number;
  tint?: number;
  alpha?: number;
  blend?: BLEND_MODES;
  /** Vertical anchor; defaults to the centre. */
  anchorY?: number;
}

export class SpritePool {
  private readonly sprites: Sprite[] = [];
  private used = 0;

  constructor(private readonly parent: Container) {}

  begin(): void {
    this.used = 0;
  }

  /** Places the next free sprite. Returns it for any further adjustment. */
  take(texture: Texture, style: MarkStyle): Sprite {
    let sprite = this.sprites[this.used];
    if (!sprite) {
      sprite = new Sprite();
      this.sprites.push(sprite);
      this.parent.addChild(sprite);
    }
    this.used++;
    sprite.texture = texture;
    sprite.anchor.set(0.5, style.anchorY ?? 0.5);
    sprite.position.set(style.x, style.y);
    sprite.width = style.width;
    sprite.height = style.height ?? style.width;
    sprite.tint = style.tint ?? 0xffffff;
    sprite.alpha = style.alpha ?? 1;
    sprite.blendMode = style.blend ?? 'normal';
    sprite.visible = true;
    return sprite;
  }

  end(): void {
    for (let i = this.used; i < this.sprites.length; i++) this.sprites[i]!.visible = false;
  }
}

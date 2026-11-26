/**
 * The mist that lies over the reaches of the valley the Journey has not yet
 * come to. It hides them without a wall: a bank of white with a soft, uneven
 * upper edge, which draws back downstream when the reach above is complete.
 */

import { Container, Sprite, Texture } from 'pixi.js';
import type { ArtLibrary } from './art';
import type { Extent } from './fields';

/** How deep the soft upper edge of the mist is, in world pixels: long, so it gathers rather than starts. */
const FEATHER = 760;

export class Veil {
  readonly container = new Container();
  private readonly bank: Sprite;
  /** The gradient, drawn for this valley alone (see `destroy`). */
  private readonly gradient: Texture;
  private readonly puffs: Array<{ sprite: Sprite; offset: number; phase: number; lift: number }> = [];
  private edge: number;
  private target: number;
  private time = 0;

  constructor(
    private readonly extent: Extent,
    art: ArtLibrary,
    /** World y of the upper edge of the mist. */
    edge: number,
  ) {
    this.edge = this.target = edge;
    // One tall gradient: clear at the top, solid mist from the feather down.
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = Math.max(256, Math.ceil((extent.height + FEATHER + 400) * 256 / FEATHER));
    const ctx = canvas.getContext('2d')!;
    const fade = ctx.createLinearGradient(0, 0, 0, 256);
    // Thin for the first half, then thickening: no band, no line where it begins.
    fade.addColorStop(0, 'rgba(236,240,238,0)');
    fade.addColorStop(0.3, 'rgba(237,241,239,0.12)');
    fade.addColorStop(0.55, 'rgba(238,242,240,0.34)');
    fade.addColorStop(0.8, 'rgba(239,242,240,0.66)');
    fade.addColorStop(1, 'rgba(240,243,241,0.9)');
    ctx.fillStyle = fade;
    // One continuous texture: overlapping translucent quads left a brighter horizontal seam.
    ctx.fillRect(0, 0, 4, canvas.height);
    this.gradient = Texture.from(canvas);
    this.bank = new Sprite(this.gradient);
    this.bank.x = extent.x;
    this.bank.width = extent.width;
    this.container.addChild(this.bank);
    // Loose cloud along the edge, so it reads as weather and not as a cut-off.
    const mist = art.get('mist').texture;
    for (let i = 0; i < 18; i++) {
      const sprite = new Sprite(mist);
      sprite.anchor.set(0.5);
      const size = 520 + ((i * 97) % 380);
      sprite.width = size * 1.8;
      sprite.height = size * 0.7;
      sprite.alpha = 0.45;
      this.container.addChild(sprite);
      this.puffs.push({ sprite, offset: extent.x + ((i + 0.5) / 18) * extent.width, phase: i * 1.7, lift: ((i * 53) % 150) - 40 });
    }
    this.layout();
  }

  /** Frees the gradient texture (a few megabytes); the container goes with the world it is in. */
  destroy(): void {
    this.gradient.destroy(true);
  }

  /** Where the upper edge of the mist is drawn now (world y). */
  get current(): number {
    return this.edge;
  }

  /** Moves the edge of the mist, drawing it back slowly if `animate`. */
  setEdge(y: number, animate: boolean): void {
    this.target = y;
    if (!animate) this.edge = y;
  }

  update(dt: number): void {
    this.time += dt;
    this.edge += (this.target - this.edge) * Math.min(1, dt * 0.55);
    this.layout();
  }

  private layout(): void {
    const top = this.edge - FEATHER * 0.5;
    const bottom = this.extent.y + this.extent.height + 200;
    this.container.visible = top < bottom;
    if (!this.container.visible) return;
    // The gradient occupies FEATHER px; below it the texture's last row stretches as solid mist.
    this.bank.y = top;
    this.bank.height = FEATHER * this.bank.texture.height / 256;
    for (const puff of this.puffs) {
      // Loose cloud a little inside the feather, drifting slowly, so the edge reads as weather.
      puff.sprite.position.set(puff.offset + Math.sin(this.time * 0.04 + puff.phase) * 120, this.edge + 120 + puff.lift + Math.sin(this.time * 0.07 + puff.phase * 2) * 18);
    }
  }
}

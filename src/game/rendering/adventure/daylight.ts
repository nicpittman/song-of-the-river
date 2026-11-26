/**
 * Day and night over the whole valley, from the scene's clock hour alone.
 *
 * A multiply wash over the visible world tints it to the hour (see
 * `grade.ts`), and a screen-blended lift keeps the night a readable deep blue
 * and the dawn rose. Both are single quads the size of the screen: no
 * filters, cheap on a phone. Above them, in additive light, the lit things
 * glow through the dark: warm pools on the ground before every home, lantern
 * light, the hearths, and lit windows of anything the friends have built. At
 * night the river catches a little moonlight, fireflies drift over summer
 * meadows, and at dawn a low mist lies in the valley and burns off.
 *
 * Under reduced motion the grade still changes, but nothing flickers or drifts.
 */

import { type Container, Sprite, Texture } from 'pixi.js';
import type { Vec } from '../../core/math';
import type { River } from '../../world/river';
import type { BoardDef } from '../../world/types';
import type { ArtLibrary } from '../art';
import type { FrameInfo } from './frame';
import { type Grade, gradeAt, newGrade, tintOf } from './grade';
import { hash01 } from './motion';

/** Board art that is somebody's home, and so has a lit doorway at night. */
const HOMES = new Set(['cottage', 'farmhouse', 'timber-cottage', 'shed', 'mill-body', 'watermill']);
const FIREFLIES = 26;
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Lamp {
  /** Warm pool on the ground. */
  pool: Sprite;
  /** Small bright glow (doorway, lantern, fire). */
  glow: Sprite | null;
  /** Registered coverage of individual house-window openings. */
  panes?: Sprite;
  x: number;
  y: number;
  strength: number;
  phase: number;
  /** Someone's home: lit in the evening, dark after bedtime. */
  home?: boolean;
}

interface Glint {
  sprite: Sprite;
  phase: number;
}

interface Drifter {
  sprite: Sprite;
  /** Position relative to the view, wrapped, so a few sprites cover the whole screen. */
  u: number;
  v: number;
  phase: number;
}

export class Daylight {
  readonly grade: Grade = newGrade();
  /** Tint for screen-space layers outside the world (falling petals, snow). */
  tint = 0xffffff;
  private readonly wash = new Sprite(Texture.WHITE);
  private readonly lift = new Sprite(Texture.WHITE);
  private readonly lamps: Lamp[] = [];
  private readonly glints: Glint[] = [];
  private readonly flies: Drifter[] = [];
  private readonly built = new Map<number, Lamp>();
  private readonly warmth: Texture;
  private readonly lampTexture: Texture;

  constructor(
    private readonly art: ArtLibrary,
    tone: Container,
    private readonly glow: Container,
    board: BoardDef,
    river: River | null,
  ) {
    this.wash.blendMode = 'multiply';
    this.lift.blendMode = 'screen';
    this.wash.visible = this.lift.visible = false;
    tone.addChild(this.wash, this.lift);
    this.warmth = art.get('warmth').texture;
    this.lampTexture = art.get('window-glow').texture;

    for (const sprite of board.sprites) {
      // Match the scenery layer's separate mill body and its display scale.
      const body = sprite.asset === 'watermill' && art.has('mill-body') ? 'mill-body' : sprite.asset;
      const a = art.get(body);
      const scale = (sprite.scale ?? 1) * (body === sprite.asset ? 1 : art.get(sprite.asset).width / a.width);
      const facing = sprite.flip ? -1 : 1;
      if (HOMES.has(sprite.asset)) {
        const covered = art.has(`${body}-windows`);
        const lamp = this.addLamp(sprite.x + facing * a.width * scale * 0.08, sprite.y + 14 * scale, a.width * scale * 1.05, 0.9, covered ? null : sprite.y - a.height * scale * 0.18, 34 * scale + 14);
        lamp.home = true;
        if (covered) this.addWindows(lamp, body, sprite.x, sprite.y, scale, facing);
      } else if (sprite.asset.startsWith('lantern')) {
        this.addLamp(sprite.x, sprite.y + 4, 120, 0.8, sprite.y - a.height * scale * 0.62, 44);
      } else if (sprite.asset === 'bonfire') {
        this.addLamp(sprite.x, sprite.y + 6, 260, 0.7, sprite.y - 10, 70);
      }
    }
    for (const hearth of board.hearths) this.addLamp(hearth.x, hearth.y + 6, 280, 0.75, hearth.y - 12, 80);

    if (river) this.placeGlints(river);
    for (let i = 0; i < FIREFLIES; i++) this.flies.push(this.drifter(art.get('ember').texture, glow, i * 7.3, 'add'));
  }

  private addWindows(lamp: Lamp, asset: string, x: number, y: number, scale: number, facing = 1): void {
    if (!this.art.has(`${asset}-windows`)) return;
    const house = this.art.get(asset);
    const mask = this.art.get(`${asset}-windows`);
    const panes = new Sprite(mask.texture);
    panes.anchor.set(mask.anchor[0], mask.anchor[1]);
    panes.width = house.width * scale;
    panes.height = house.height * scale;
    panes.scale.x *= facing;
    panes.position.set(x, y);
    panes.tint = 0xffc57f;
    panes.blendMode = 'screen';
    panes.visible = false;
    this.glow.addChild(panes);
    lamp.panes = panes;
  }

  private addLamp(x: number, y: number, width: number, strength: number, glowY: number | null, glowSize: number): Lamp {
    const pool = new Sprite(this.warmth);
    pool.anchor.set(0.5);
    pool.blendMode = 'add';
    pool.width = width;
    pool.height = width * 0.46;
    pool.position.set(x, y);
    pool.visible = false;
    this.glow.addChild(pool);
    let glow: Sprite | null = null;
    if (glowY !== null) {
      glow = new Sprite(this.lampTexture);
      glow.anchor.set(0.5);
      glow.blendMode = 'add';
      glow.width = glow.height = glowSize;
      glow.position.set(x, glowY);
      glow.visible = false;
      this.glow.addChild(glow);
    }
    const lamp = { pool, glow, x, y, strength, phase: hash01(Math.round(x * 13 + y)) * 6.28 };
    this.lamps.push(lamp);
    return lamp;
  }

  /** Pale sparkles along the river, for moonlight on the water. */
  private placeGlints(river: River): void {
    const texture = this.art.get('lamp').texture;
    for (const channel of river.channels) {
      const line = channel.line;
      for (let d = 30, i = 0; d < line.length; d += 64, i++) {
        const p = line.at(d);
        const w = channel.widths[Math.min(channel.widths.length - 1, Math.round((d / line.length) * (channel.widths.length - 1)))]!;
        const off = (hash01(i * 17 + 3) - 0.5) * w * 0.6;
        const s = new Sprite(texture);
        s.anchor.set(0.5);
        s.blendMode = 'add';
        s.tint = 0xb8cce8;
        s.width = 26 + hash01(i) * 20;
        s.height = 4;
        s.position.set(p.x - Math.sin(p.angle) * off, p.y + Math.cos(p.angle) * off);
        s.rotation = p.angle * 0.3;
        s.visible = false;
        this.glow.addChild(s);
        this.glints.push({ sprite: s, phase: hash01(i * 5 + 1) * 6.28 });
      }
    }
  }

  private drifter(texture: Texture, parent: Container, seed: number, blend: 'add' | 'normal'): Drifter {
    const s = new Sprite(texture);
    s.anchor.set(0.5);
    s.blendMode = blend;
    s.visible = false;
    parent.addChild(s);
    return { sprite: s, u: hash01(Math.round(seed * 100)), v: hash01(Math.round(seed * 100) + 7), phase: hash01(Math.round(seed * 31)) * 6.28 };
  }

  /** Lit windows for structures the friends have finished (cottages, shelters). */
  setBuilt(id: number, at: Vec | null, size: number, asset?: string, scale = 1): void {
    const lamp = this.built.get(id);
    if (!at) {
      if (lamp) {
        lamp.pool.destroy();
        lamp.glow?.destroy();
        lamp.panes?.destroy();
        this.lamps.splice(this.lamps.indexOf(lamp), 1);
        this.built.delete(id);
      }
      return;
    }
    if (lamp) return;
    const covered = !!asset && this.art.has(`${asset}-windows`);
    const created = this.addLamp(at.x, at.y + 12, size, 0.85, covered ? null : at.y - size * 0.12, 30);
    created.home = true;
    if (covered && asset) this.addWindows(created, asset, at.x, at.y, scale);
    this.built.set(id, created);
  }

  update(hour: number, f: FrameInfo): void {
    const g = gradeAt(hour, this.grade);
    // Snow throws back the moonlight: winter nights are a little brighter and bluer.
    if (f.season === 3) {
      const k = g.night * 0.07;
      g.mul[0] = Math.min(1, g.mul[0] * (1 + k * 0.6));
      g.mul[1] = Math.min(1, g.mul[1] * (1 + k));
      g.mul[2] = Math.min(1, g.mul[2] * (1 + k * 1.4));
    }
    this.tint = tintOf(g.mul);
    const w = f.right - f.left;
    const h = f.bottom - f.top;
    const plain = g.mul[0] > 0.995 && g.mul[1] > 0.995 && g.mul[2] > 0.995;
    this.wash.visible = !plain;
    this.lift.visible = g.liftAlpha > 0.01;
    this.cover(this.wash, f, w, h);
    this.cover(this.lift, f, w, h);
    this.wash.tint = this.tint;
    this.lift.tint = tintOf(g.lift);
    this.lift.alpha = g.liftAlpha;

    this.lights(g, f, hour);
    this.moonlight(g, f);
    this.fireflies(g, f);
  }

  /** Stretches a full-screen quad over the visible world. */
  private cover(s: Sprite, f: FrameInfo, w: number, h: number): void {
    s.position.set(f.left - 40, f.top - 40);
    s.width = w + 80;
    s.height = h + 80;
  }

  /**
   * How lit a home is at this hour: each lights up at its own moment in the
   * evening and goes dark at its own bedtime, so a village lights a few windows
   * at a time and goes to sleep the same way. Fires and lanterns burn all night.
   */
  private homeLit(lamp: Lamp, hour: number): number {
    const h = hour < 7 ? hour + 24 : hour;
    const up = 17.6 + lamp.phase * 0.2;
    const bed = 22.6 + lamp.phase * 0.3;
    return smooth(up, up + 0.5, h) * (1 - smooth(bed, bed + 0.4, h));
  }

  private lights(g: Grade, f: FrameInfo, hour: number): void {
    const on = Math.max(g.night, f.dusk * 0.5);
    const winter = f.season === 3 ? 1.3 : 1;
    for (const lamp of this.lamps) {
      const seen = lamp.x > f.left - 200 && lamp.x < f.right + 200 && lamp.y > f.top - 200 && lamp.y < f.bottom + 200;
      const level = on * lamp.strength * (lamp.home ? this.homeLit(lamp, hour) : 1);
      lamp.pool.visible = seen && level > 0.02;
      if (lamp.glow) lamp.glow.visible = lamp.pool.visible;
      if (lamp.panes) lamp.panes.visible = lamp.pool.visible;
      if (!lamp.pool.visible) continue;
      const flicker = f.reduced ? 1 : 0.9 + 0.1 * Math.sin(f.time * 3.1 + lamp.phase) * Math.sin(f.time * 1.7 + lamp.phase * 2);
      lamp.pool.alpha = Math.min(1, level * 0.62 * winter) * flicker;
      if (lamp.glow) lamp.glow.alpha = level * 0.85 * flicker;
      // Window interiors breathe very gently; they do not flicker like fire.
      if (lamp.panes) lamp.panes.alpha = Math.min(0.95, level) * (f.reduced ? 1 : 0.98 + 0.02 * Math.sin(f.time * 1.5 + lamp.phase));
    }
  }

  private moonlight(g: Grade, f: FrameInfo): void {
    const level = Math.max(0, g.night - 0.3) / 0.7;
    for (const glint of this.glints) {
      const s = glint.sprite;
      s.visible = level > 0.02 && s.x > f.left && s.x < f.right && s.y > f.top && s.y < f.bottom;
      if (!s.visible) continue;
      const shimmer = f.reduced ? 0.6 : 0.35 + 0.65 * Math.max(0, Math.sin(f.time * 0.8 + glint.phase));
      s.alpha = level * 0.28 * shimmer;
    }
  }

  /** Fireflies over the summer meadows at night, wandering and slowly blinking. */
  private fireflies(g: Grade, f: FrameInfo): void {
    const level = f.season === 1 ? Math.max(0, g.night - 0.4) / 0.6 : 0;
    const w = f.right - f.left;
    const h = f.bottom - f.top;
    for (const fly of this.flies) {
      const s = fly.sprite;
      s.visible = level > 0.02;
      if (!s.visible) continue;
      const t = f.time * 0.05;
      const drift = f.reduced ? 0 : 1;
      const u = (fly.u + Math.sin(t + fly.phase) * 0.03 * drift) % 1;
      const v = (fly.v + Math.cos(t * 1.3 + fly.phase) * 0.03 * drift) % 1;
      // Anchored to the world in big cells so they do not slide with the camera.
      const cellW = Math.max(400, w);
      const cellH = Math.max(300, h);
      const x = Math.floor(f.left / cellW) * cellW + u * cellW;
      const y = Math.floor(f.top / cellH) * cellH + v * cellH;
      s.position.set(x < f.left ? x + cellW : x, y < f.top ? y + cellH : y);
      s.width = s.height = 9;
      s.tint = 0xe8f0a0;
      const blink = f.reduced ? 0.5 : Math.max(0, Math.sin(f.time * 0.9 + fly.phase * 3)) ** 3;
      s.alpha = level * blink * 0.9;
    }
  }

  // River mist belongs to the world ambience; viewport-relative banks slid across the scenery on zoom.
}

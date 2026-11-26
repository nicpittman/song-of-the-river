/**
 * At the foot of the opened reach, a quiet ink note on the map: the next
 * settlement's name in spaced capitals and a small arrow following the river
 * down toward it ("MIO" from Seseragi, "KAWAGIRI" from Mio). Drawn at a
 * constant size on screen, like the place names, and pale at night.
 */

import { type Container, Graphics, Text } from 'pixi.js';
import type { River } from '../../world/river';
import type { FrameInfo } from './frame';
import { approach } from './motion';

const INK = 0x24362e;
const IVORY = 0xf6f1e4;
const FONT = "'Cormorant Garamond', 'Iowan Old Style', Palatino, Georgia, serif";
/** Names are drawn large and scaled down so they stay crisp. */
const FONT_PX = 32;
const NAME_PX = 15;

export class Downstream {
  private readonly name: Text;
  private readonly arrow = new Graphics();
  private x = 0;
  private y = 0;
  private angle = Math.PI / 2;
  private shown = false;
  private alpha = 0;
  private nightStyle = false;

  constructor(
    ink: Container,
    private readonly river: River | null,
  ) {
    this.name = new Text({
      text: '',
      style: { fontFamily: FONT, fontSize: FONT_PX, fontWeight: '500', fill: INK, letterSpacing: 8, stroke: { color: IVORY, width: 7, join: 'round' } },
    });
    this.name.anchor.set(0.5, 1);
    this.name.alpha = 0;
    this.arrow.alpha = 0;
    this.draw(INK);
    ink.addChild(this.arrow, this.name);
  }

  /** A short curved stroke down the river with an open arrowhead, at screen scale (the view scales it by 1/zoom). */
  private draw(colour: number): void {
    const g = this.arrow;
    g.clear();
    g.moveTo(0, 0).quadraticCurveTo(5, 16, 0, 32).stroke({ color: colour, width: 1.3, alpha: 0.9 });
    g.moveTo(-5, 25).lineTo(0, 33).lineTo(5.5, 25.5).stroke({ color: colour, width: 1.3, alpha: 0.9 });
  }

  /**
   * Where the opened valley ends (`bottom`, world y) and the name of what lies
   * beyond, or null when the whole river is open.
   */
  set(bottom: number, next: string | null): void {
    this.shown = next !== null;
    if (!next) return;
    this.name.text = next.toUpperCase();
    // On the river a little above the reach's end, pointing along the flow.
    const y = bottom - 70;
    const hit = this.river?.nearest({ x: 1100, y });
    const line = hit?.channel.line;
    if (hit && line) {
      const a = line.at(hit.along);
      const b = line.at(hit.along + 60);
      this.x = a.x;
      this.y = a.y;
      this.angle = Math.atan2(b.y - a.y, b.x - a.x);
    } else {
      this.x = 1100;
      this.y = y;
      this.angle = Math.PI / 2;
    }
  }

  update(f: FrameInfo): void {
    this.alpha = approach(this.alpha, this.shown && f.zoom > 0.2 ? 0.85 : 0, 3, f.dt || 0.016);
    const visible = this.alpha > 0.01 && this.x > f.left && this.x < f.right && this.y > f.top - 100 && this.y < f.bottom + 100;
    this.name.visible = this.arrow.visible = visible;
    if (!visible) return;
    const px = 1 / f.zoom;
    const night = f.night > 0.55;
    if (night !== this.nightStyle) {
      this.nightStyle = night;
      this.name.style.fill = night ? 0xf1e9d2 : INK;
      this.name.style.stroke = { color: night ? 0x1c2638 : IVORY, width: 7, join: 'round' };
      this.draw(night ? 0xf1e9d2 : INK);
    }
    this.name.position.set(this.x, this.y - 8 * px);
    this.name.scale.set((NAME_PX / FONT_PX) * px);
    this.name.alpha = this.alpha;
    const g = this.arrow;
    g.position.set(this.x, this.y);
    g.rotation = this.angle - Math.PI / 2;
    g.scale.set(px);
    g.alpha = this.alpha;
  }
}

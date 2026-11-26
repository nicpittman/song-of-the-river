/**
 * The boat on the last voyage: the hull riding a gentle swell, the friends
 * aboard sitting low in it, a sail that hangs slack and fills as the boat
 * gets under way, and a wake spreading behind.
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import type { ArtLibrary } from '../art';
import type { FrameInfo, Stage } from './frame';
import { Follower, approach } from './motion';
import { explorerFor } from './rigTable';
import { Wardrobe } from './wardrobe';

const HULL_SCALE = 2.3;

export class Boat {
  readonly root = new Container();
  private readonly hull: Sprite;
  private readonly crew = new Container();
  private readonly sail = new Graphics();
  private readonly wake = new Graphics();
  private readonly follow = new Follower();
  private crewKey = '';
  private fill = 0;
  private drawnFill = -1;
  private angle = 0;
  private alpha = 0;
  private time = 0;
  x = 0;
  y = 0;
  /** Faded out as the painted sea's own boat takes over (see SeaFinale), so only one boat reads. */
  private handedOver = 0;

  constructor(
    private readonly art: ArtLibrary,
    stage: Stage,
  ) {
    const a = art.get('boat');
    this.hull = new Sprite(a.texture);
    this.hull.anchor.set(0.5, 0.62);
    this.hull.width = a.width * HULL_SCALE;
    this.hull.height = a.height * HULL_SCALE;
    this.root.addChild(this.hull, this.crew, this.sail);
    this.root.visible = false;
    stage.sorted.addChild(this.root);
    stage.water.addChild(this.wake);
  }

  update(boat: { at: { x: number; y: number }; angle: number; aboard: string[] } | null, f: FrameInfo): void {
    this.time += f.dt;
    if (boat) {
      this.follow.target(boat.at.x, boat.at.y);
      this.angle = boat.angle;
      const key = boat.aboard.join(',');
      if (key !== this.crewKey) this.seat(boat.aboard, key);
    }
    this.follow.step(f.dt);
    this.alpha = approach(this.alpha, boat ? 1 : 0, 2, f.dt);
    this.root.visible = this.alpha > 0.01;
    this.wake.visible = this.root.visible;
    if (!this.root.visible) return;
    this.x = this.follow.x;
    this.y = this.follow.y;
    const facing = Math.cos(this.angle) < 0 ? -1 : 1;
    const swell = f.reduced ? 0 : Math.sin(this.time * 1.3) * 0.03;
    this.root.position.set(this.x, this.y + (f.reduced ? 0 : Math.sin(this.time * 1.7) * 1.2));
    this.root.rotation = swell;
    this.root.scale.x = facing;
    this.root.zIndex = this.y + 10;
    this.root.alpha = this.alpha * (1 - this.handedOver);
    // The sail fills once the boat is moving.
    this.fill = approach(this.fill, this.follow.speed > 3 ? 1 : 0.15, 0.8, f.dt);
    if (Math.abs(this.fill - this.drawnFill) > 0.02) this.drawSail();
    this.drawWake(facing, f);
  }

  /** How far the painted sea's boat has taken over (0..1); applied at once, so the swap never lags a frame. */
  handOver(k: number): void {
    this.handedOver = k;
    this.root.alpha = this.alpha * (1 - k);
  }

  /** The hull's drawn size, in world units. */
  get hullSize(): { width: number; height: number } {
    return { width: this.hull.width, height: this.hull.height };
  }

  /** Friends aboard sit in a row, low in the hull. */
  private seat(aboard: string[], key: string): void {
    this.crewKey = key;
    for (const child of this.crew.removeChildren()) child.destroy();
    aboard.forEach((id, i) => {
      const who = explorerFor(id);
      const outfit = new Wardrobe(who, this.art, false).outfit('sit');
      const a = this.art.get(outfit.ids[i % outfit.ids.length]!);
      const s = new Sprite(a.texture);
      s.anchor.set(a.anchor[0], a.anchor[1]);
      s.width = a.width * outfit.scale;
      s.height = a.height * outfit.scale;
      s.position.set(-44 + i * 20, 6);
      this.crew.addChild(s);
    });
  }

  private drawSail(): void {
    this.drawnFill = this.fill;
    const g = this.sail;
    const belly = 6 + this.fill * 22;
    g.clear();
    g.moveTo(8, 2).lineTo(8, -86).stroke({ color: 0x6e5440, width: 2.2 });
    g.moveTo(9, -82).quadraticCurveTo(9 + belly, -54, 9 + belly * 0.7, -18).lineTo(9, -16).closePath().fill({ color: 0xece3cc });
    g.moveTo(9, -82).quadraticCurveTo(9 + belly, -54, 9 + belly * 0.7, -18).stroke({ color: 0xbdb196, width: 0.9 });
    g.moveTo(12, -70).quadraticCurveTo(10 + belly * 0.7, -48, 11 + belly * 0.5, -26).stroke({ color: 0xd2c7ab, width: 0.6 });
  }

  private drawWake(facing: number, f: FrameInfo): void {
    const g = this.wake;
    g.clear();
    const speed = Math.min(1, this.follow.speed / 30);
    if (speed < 0.05) return;
    const back = -facing;
    const sternX = this.x + back * 58;
    const sternY = this.y + 4;
    for (let i = 0; i < 4; i++) {
      const k = f.reduced ? i / 4 : ((this.time * 0.6 + i / 4) % 1);
      const len = 30 + k * 110;
      const spread = 6 + k * 26;
      const a = (1 - k) * 0.55 * speed;
      g.moveTo(sternX + back * len * 0.2, sternY - spread * 0.3).quadraticCurveTo(sternX + back * len * 0.6, sternY - spread, sternX + back * len, sternY - spread * 1.2).stroke({ color: 0xeef5f2, width: 1.4, alpha: a });
      g.moveTo(sternX + back * len * 0.2, sternY + spread * 0.3).quadraticCurveTo(sternX + back * len * 0.6, sternY + spread, sternX + back * len, sternY + spread * 1.2).stroke({ color: 0xeef5f2, width: 1.4, alpha: a });
    }
  }
}

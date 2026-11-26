/**
 * Structures the friends build. A site starts as pegs and string on a patch
 * of trodden earth, with timber and stones piled beside it; a frame rises
 * through three painted stages; when it is done the finished art grows in as
 * part of the scenery (so it takes the seasons and casts its shade like the
 * valley's own buildings) and the worn earth stays round its foot. A finished
 * garden has butterflies over it in the warm months.
 */

import { type Container, Sprite } from 'pixi.js';
import type { Vec } from '../../core/math';
import type { SceneBuilding } from '../../adventure/model';
import { bridgeCrossing, bridgeLine } from '../../adventure/bridges';
import type { River } from '../../world/river';
import type { ArtLibrary } from '../art';
import { bridgePlacement } from '../bridgePlacement';
import { fordStones } from '../fordStones';
import type { SceneryItem } from '../../world/scenery';
import type { SceneryLayer } from '../sceneryLayer';
import type { FrameInfo, Stage } from './frame';
import { BridgeDecks } from './bridgeDecks';
import { approach } from './motion';
import { type Particles, burst, newBurst } from './particles';
import { finishedArt, isPlanting, lookOf, stageArt, stageOf } from './structures';

const scratch = newBurst();

class BuildingView {
  readonly skirt: Sprite;
  readonly frame = new Sprite();
  readonly logs: Sprite;
  readonly stones: Sprite;
  readonly wings: Sprite[] = [];
  stage = -2;
  pop = 0;
  baseX = 1;
  baseY = 1;
  seen = 0;
  done = false;
  b: SceneBuilding;

  constructor(b: SceneBuilding, art: ArtLibrary, stage: Stage) {
    this.b = b;
    const look = lookOf(b.kind);
    this.skirt = new Sprite(art.get('worn-earth').texture);
    this.skirt.anchor.set(0.5);
    this.skirt.width = look.skirt;
    this.skirt.height = look.skirt * 0.45;
    this.skirt.position.set(b.at.x, b.at.y - 4);
    this.skirt.alpha = 0;
    this.skirt.visible = look.skirt > 0;
    stage.ground.addChild(this.skirt);
    this.frame.alpha = 0;
    stage.sorted.addChild(this.frame);
    this.logs = this.prop(art, 'log', b.at.x - 46, b.at.y + 10, 0.42, stage.sorted);
    this.stones = this.prop(art, 'small-rocks', b.at.x + 44, b.at.y + 8, 0.42, stage.sorted);
  }

  private prop(art: ArtLibrary, id: string, x: number, y: number, scale: number, parent: Container): Sprite {
    const a = art.get(id);
    const s = new Sprite(a.texture);
    s.anchor.set(a.anchor[0], a.anchor[1]);
    s.width = a.width * scale;
    s.height = a.height * scale;
    s.position.set(x, y);
    s.zIndex = y;
    s.alpha = 0;
    parent.addChild(s);
    return s;
  }

  destroy(): void {
    this.skirt.destroy();
    this.frame.destroy();
    this.logs.destroy();
    this.stones.destroy();
    for (const w of this.wings) w.destroy();
  }
}

export class Buildings {
  private readonly views = new Map<number, BuildingView>();
  private generation = 0;
  /** Finished bridges' walkways, for lifting walkers onto the drawn deck. */
  readonly decks = new BridgeDecks();

  constructor(
    private readonly art: ArtLibrary,
    private readonly stage: Stage,
    private readonly scenery: SceneryLayer,
    private readonly river: River | null,
    private readonly dust: Particles,
  ) {}

  update(buildings: readonly SceneBuilding[], f: FrameInfo): void {
    this.generation++;
    for (const b of buildings) {
      if (isPlanting(b.kind)) continue;
      let view = this.views.get(b.id);
      if (!view) {
        view = new BuildingView(b, this.art, this.stage);
        this.views.set(b.id, view);
      }
      view.b = b;
      view.seen = this.generation;
      const stage = stageOf(b.progress);
      if (stage !== view.stage) this.advance(view, stage, f);
      this.draw(view, f);
    }
    for (const [id, view] of this.views) {
      if (view.seen === this.generation) continue;
      // Gone from the scene (the save was rewound, say): take it down quietly.
      this.scenery.removeGroup(`adventure:${id}`);
      this.scenery.reserveBridgeDeck(`adventure:${id}`, null);
      this.decks.delete(`adventure:${id}`);
      view.destroy();
      this.views.delete(id);
    }
  }

  private advance(view: BuildingView, stage: number, f: FrameInfo): void {
    const first = view.stage === -2;
    view.stage = stage;
    const b = view.b;
    const look = lookOf(b.kind);
    if (stage === 3) {
      // Finished: the real art grows in as scenery; the frame comes down.
      this.scenery.setGroup(`adventure:${b.id}`, b.kind === 'stones' && this.river ? this.laidStones(b, this.river) : [this.finished(b)], !first);
      view.done = true;
    } else {
      const has = (id: string): boolean => this.art.has(id);
      const a = this.art.get(this.art.known(`${b.kind}-site`) || stage >= 0 ? stageArt(b.kind, stage, has) : 'site-pegs');
      view.frame.texture = a.texture;
      view.frame.anchor.set(a.anchor[0], a.anchor[1]);
      const finishedWidth = this.art.get(finishedArt(b.kind, has)).width * look.scale;
      const k = Math.max(0.85, Math.min(1.5, (finishedWidth * 1.2) / a.width));
      view.frame.width = a.width * k;
      view.frame.height = a.height * k;
      view.baseX = view.frame.scale.x;
      view.baseY = view.frame.scale.y;
      view.frame.position.set(b.at.x, b.at.y);
      view.frame.zIndex = b.at.y;
    }
    if (!first) {
      view.pop = 1;
      if (!f.reduced) {
        const p = burst(scratch, b.at.x, b.at.y, b.at.y + 2);
        p.vy = -10;
        p.spread = 50;
        p.gravity = -4;
        p.life = 1.4;
        p.size = 9;
        p.grow = 2.2;
        p.tint = 0xd8c6a0;
        p.alpha = 0.35;
        p.drag = 1.4;
        this.dust.emit(p, stage === 3 ? 7 : 4);
      }
    }
  }

  /** Stepping stones are a row of separate river stones from bank to bank, like the valley's own fords. */
  private laidStones(b: SceneBuilding, river: River): SceneryItem[] {
    return fordStones({ id: `laid-${b.id}`, name: '', x: b.at.x, y: b.at.y, radius: 44, floods: [] }, river).map((stone, i) => ({
      asset: stone.asset, x: stone.x, y: stone.y, scale: stone.width / this.art.get(stone.asset).width,
      flip: stone.flip, roll: (i * 0.37) % 1, fixed: true, zBias: -30,
    }));
  }

  /** The finished structure as a scenery item; a bridge is laid from bank to bank. */
  private finished(b: SceneBuilding): { asset: string; x: number; y: number; scale: number; flip: boolean; roll: number; fixed: boolean; rotation?: number; anchor?: [number, number]; zBias?: number } {
    const look = lookOf(b.kind);
    const base = { asset: b.id < 0 && this.art.has('stone-bridge') ? 'stone-bridge' : finishedArt(b.kind, (id) => this.art.has(id)), x: b.at.x, y: b.at.y, scale: look.scale, flip: false, roll: (b.id * 0.37) % 1, fixed: true };
    if ((b.kind !== 'bridge' && b.kind !== 'ford-bridge') || !this.river) return base;
    // The same crossing and banks as the walking ground (adventure/bridges), so the drawn deck is the one walked.
    const line = bridgeLine(b.at);
    const hit = bridgeCrossing(this.river, b.at);
    if (!hit) return base;
    const art = this.art.get(base.asset);
    const p = bridgePlacement({ line }, { ...hit, angle: 0, style: 'bridge', ford: null }, this.river, art.width, art.height, b.id < 0 ? [{x:.05,y:.73},{x:.95,y:.65}] : undefined);
    this.scenery.reserveBridgeDeck(`adventure:${b.id}`, { left: p.banks[0].x - 10, right: p.banks[1].x + 10, top: b.at.y - 24, bottom: b.at.y + 24 });
    this.decks.set(`adventure:${b.id}`, base.asset, art, p, b.at.y);
    return { ...base, x: p.x, y: p.y, scale: p.scale, rotation: p.rotation, anchor: p.anchor, zBias: -40 };
  }

  private draw(view: BuildingView, f: FrameInfo): void {
    const b = view.b;
    const building = !view.done;
    view.pop = Math.max(0, view.pop - f.dt * 2.5);
    view.skirt.alpha = approach(view.skirt.alpha, building ? 0.95 : 0.7, 3, f.dt);
    view.frame.alpha = approach(view.frame.alpha, building ? 1 : 0, building ? 5 : 2.2, f.dt);
    view.frame.visible = view.frame.alpha > 0.01;
    // A small settle each time the work moves on a stage.
    const bounce = Math.sin(view.pop * Math.PI) * 0.05;
    view.frame.scale.set(view.baseX * (1 - bounce * 0.5), view.baseY * (1 + bounce));
    const materials = building ? 1 - Math.max(0, b.progress - 0.6) * 1.6 : 0;
    view.logs.alpha = approach(view.logs.alpha, materials, 2, f.dt);
    view.stones.alpha = approach(view.stones.alpha, building ? 1 : 0, 2, f.dt);
    view.logs.visible = view.logs.alpha > 0.01;
    view.stones.visible = view.stones.alpha > 0.01;
    this.butterflies(view, f);
  }

  /** Butterflies over a finished garden in spring and summer. */
  private butterflies(view: BuildingView, f: FrameInfo): void {
    const warm = view.done && view.b.kind === 'garden' && f.season < 2;
    if (warm && view.wings.length === 0) {
      const a = this.art.get('butterfly');
      for (let i = 0; i < 3; i++) {
        const s = new Sprite(a.texture);
        s.anchor.set(0.5);
        s.width = 9;
        s.height = (9 * a.height) / a.width;
        this.stage.sorted.addChild(s);
        view.wings.push(s);
      }
    }
    view.wings.forEach((s, i) => {
      s.visible = warm && view.b.at.x > f.left && view.b.at.x < f.right && view.b.at.y > f.top && view.b.at.y < f.bottom;
      if (!s.visible) return;
      const t = f.time;
      const x = view.b.at.x + Math.sin(t * 0.7 + i * 2.1) * 40;
      const y = view.b.at.y - 18 + Math.cos(t * 0.53 + i * 2.1) * 16;
      s.position.set(x, y);
      s.zIndex = view.b.at.y + 30;
      const flap = f.reduced ? 0.8 : 0.25 + 0.75 * Math.abs(Math.sin(t * 7 + i));
      s.scale.x = Math.abs(s.scale.y) * flap * (Math.cos(t * 0.7 + i * 2.1) > 0 ? 1 : -1);
    });
  }

  /** Where a landmark (a structure that was always there, like Shiobashi's bridge) was tapped, if one was. */
  pickLandmark(x: number, y: number, zoom: number): Vec | null {
    for (const view of this.views.values()) {
      if (view.b.id >= 0) continue;
      const look = lookOf(view.b.kind);
      const reach = Math.max(26 / zoom, (this.art.get(finishedArt(view.b.kind, (id) => this.art.has(id))).width * look.scale) * 0.55);
      if (Math.hypot(x - view.b.at.x, (y - (view.b.at.y - reach * 0.4)) * 1.3) < reach) return view.b.at;
    }
    return null;
  }

  pick(x: number, y: number, zoom: number): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    for (const view of this.views.values()) {
      // Landmarks that were always there (Shiobashi's stone bridge) are not ours to build on:
      // a tap goes through to the place they belong to.
      if (view.b.id < 0) continue;
      const look = lookOf(view.b.kind);
      const reach = Math.max(26 / zoom, (this.art.get(finishedArt(view.b.kind, (id) => this.art.has(id))).width * look.scale) * 0.45);
      const d = Math.hypot(x - view.b.at.x, (y - (view.b.at.y - reach * 0.4)) * 1.3);
      if (d < reach && d < bestD) {
        bestD = d;
        best = view.b.id;
      }
    }
    return best;
  }
}

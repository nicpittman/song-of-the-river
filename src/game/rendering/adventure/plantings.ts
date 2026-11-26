/**
 * Things the friends plant (a willow by the river, a blossom tree, a garden
 * bed, reeds) growing over several days from a staked sapling or a bare bed
 * to full size. They take the season's colours from the art library like the
 * valley's own trees, sway in the same wind, and give a visiting bird
 * somewhere to land.
 *
 * The rules list plantings among the scene's buildings, with a growth
 * `stage`; `AdventureLayer` turns those into `ScenePlanting`s here.
 */

import { Graphics, Sprite } from 'pixi.js';
import type { Vec } from '../../core/math';
import type { ArtLibrary } from '../art';
import type { FrameInfo, Stage } from './frame';
import { approach, seedOf } from './motion';

export interface ScenePlanting {
  id: string | number;
  /** `willow`, `fruit-tree`, `lily-bed`, `blossom`, `reeds`, or any art id. */
  kind: string;
  at: Vec;
  /** 0 just planted .. 1 fully grown. */
  growth: number;
}

interface Kind {
  asset: string;
  /** Scale when fully grown. */
  scale: number;
  /** A sapling is staked; beds and reeds are not. */
  staked: boolean;
  /** Leans in the wind, as the scenery's trees do. */
  sway: number;
  /** Art for the first days (`willow-sapling`, ...), before the grown tree takes over. */
  young?: string;
}

/** Growth at which a sapling gives way to the young tree. */
const YOUNG = 0.3;

const KINDS: Record<string, Kind> = {
  willow: { asset: 'willow', scale: 0.55, staked: true, sway: 0.022, young: 'willow-sapling' },
  blossom: { asset: 'cherry-spring', scale: 0.5, staked: true, sway: 0.02, young: 'blossom-sapling' },
  cherry: { asset: 'cherry-spring', scale: 0.5, staked: true, sway: 0.02, young: 'blossom-sapling' },
  maple: { asset: 'maple', scale: 0.45, staked: true, sway: 0.02 },
  orchard: { asset: 'orchard-tree', scale: 0.55, staked: true, sway: 0.018 },
  'fruit-tree': { asset: 'orchard-tree', scale: 0.55, staked: true, sway: 0.018, young: 'blossom-sapling' },
  'lily-bed': { asset: 'lily-bed', scale: 1, staked: false, sway: 0 },
  garden: { asset: 'flower-meadow', scale: 0.8, staked: false, sway: 0 },
  flowers: { asset: 'wildflowers', scale: 0.9, staked: false, sway: 0 },
  reeds: { asset: 'wetland-reeds', scale: 0.7, staked: false, sway: 0.01, young: 'reed-planting' },
};

const kindOf = (kind: string, art: ArtLibrary): Kind => KINDS[kind] ?? { asset: art.known(kind) ? kind : 'deciduous-small', scale: 0.5, staked: true, sway: 0.018 };
const smooth = (t: number): number => t * t * (3 - 2 * t);

class PlantingView {
  readonly sprite = new Sprite();
  readonly shadow: Sprite;
  readonly stake = new Graphics();
  readonly kind: Kind;
  readonly roll: number;
  season = -1;
  young = false;
  growth = 0;
  seen = 0;
  at: Vec;

  constructor(p: ScenePlanting, art: ArtLibrary, stage: Stage) {
    this.kind = kindOf(p.kind, art);
    this.at = p.at;
    this.growth = p.growth;
    this.roll = (seedOf(String(p.id)) % 1000) / 1000;
    const a = art.get(this.kind.asset);
    this.sprite.anchor.set(a.anchor[0], a.anchor[1]);
    this.shadow = new Sprite(art.get('shadow').texture);
    this.shadow.anchor.set(0.5);
    stage.ground.addChild(this.shadow);
    stage.sorted.addChild(this.sprite, this.stake);
  }
}

export class Plantings {
  private readonly views = new Map<string | number, PlantingView>();
  private generation = 0;

  constructor(
    private readonly art: ArtLibrary,
    private readonly stage: Stage,
  ) {}

  update(plantings: readonly ScenePlanting[], f: FrameInfo): void {
    this.generation++;
    for (const p of plantings) {
      let view = this.views.get(p.id);
      if (!view) {
        view = new PlantingView(p, this.art, this.stage);
        this.views.set(p.id, view);
      }
      view.seen = this.generation;
      view.at = p.at;
      view.growth = approach(view.growth, p.growth, 1.5, f.dt);
      this.draw(view, f);
    }
    for (const [id, view] of this.views) {
      if (view.seen === this.generation) continue;
      view.sprite.destroy();
      view.shadow.destroy();
      view.stake.destroy();
      this.views.delete(id);
    }
  }

  private draw(view: PlantingView, f: FrameInfo): void {
    const { kind, at } = view;
    const visible = at.x > f.left && at.x < f.right && at.y > f.top && at.y < f.bottom + 200;
    view.sprite.visible = visible;
    // Lilies lie on the water and cast no shade.
    view.shadow.visible = visible && kind.asset !== 'lily-bed';
    view.stake.visible = visible && kind.staked && view.growth >= YOUNG && view.growth < 0.6;
    if (!visible) return;
    // A sapling first, then the young tree in the season's colours.
    const young = !!kind.young && view.growth < YOUNG;
    if (view.season !== f.season || young !== view.young) {
      view.season = f.season;
      view.young = young;
      const shown = young ? this.art.get(kind.young!) : this.art.get(kind.asset);
      view.sprite.texture = young ? shown.texture : this.art.seasonal(kind.asset, f.season, view.roll < 0.5 ? 0 : 1);
      view.sprite.anchor.set(shown.anchor[0], shown.anchor[1]);
    }
    const a = young ? this.art.get(kind.young!) : this.art.get(kind.asset);
    const k = young ? 0.8 + view.growth : kind.scale * (0.14 + 0.86 * smooth(Math.min(1, view.growth)));
    view.sprite.position.set(at.x, at.y);
    view.sprite.width = a.width * k;
    view.sprite.height = a.height * k;
    view.sprite.zIndex = at.y;
    if (kind.sway > 0 && !f.reduced) {
      const gust = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(f.time * 0.3 - at.x * 0.0019 - at.y * 0.0011));
      view.sprite.skew.x = kind.sway * gust * (0.65 * Math.sin(f.time * 1.15 + view.roll * 6.28) + 0.35 * Math.sin(f.time * 2.6 + view.roll * 10.7));
    } else view.sprite.skew.x = 0;
    const span = a.width * k;
    view.shadow.position.set(at.x + span * 0.2, at.y + span * 0.05);
    view.shadow.width = span * 1.05;
    view.shadow.height = span * 0.46;
    view.shadow.alpha = 0.3 * f.sun;
    if (view.stake.visible) {
      // A stake beside the sapling, tied with a twist of cord.
      const h = Math.max(16, a.height * k * 0.55);
      const g = view.stake;
      g.clear();
      g.moveTo(at.x + 4, at.y + 1).lineTo(at.x + 3.4, at.y - h).stroke({ color: 0x8a6a42, width: 1.6 });
      g.moveTo(at.x + 3.6, at.y - h * 0.62).lineTo(at.x - 0.6, at.y - h * 0.6).stroke({ color: 0xe6dcc0, width: 0.9 });
      g.zIndex = at.y + 0.5;
      g.alpha = 1 - Math.max(0, (view.growth - 0.4) / 0.2);
    }
  }

  /** The planting under a world point, generously. */
  pick(x: number, y: number, zoom: number): string | number | null {
    for (const [id, view] of this.views) {
      const reach = Math.max(24 / zoom, 20);
      if (Math.abs(x - view.at.x) < reach && y > view.at.y - reach * 2 && y < view.at.y + reach * 0.6) return id;
    }
    return null;
  }

  /** How high a bird perches at a point, if it is in a planted tree; 0 otherwise. */
  perch(x: number, y: number): number {
    for (const view of this.views.values()) {
      if (!view.kind.staked) continue;
      if (Math.abs(x - view.at.x) < 34 && Math.abs(y - view.at.y) < 24) {
        const a = this.art.get(view.kind.asset);
        return a.height * view.kind.scale * (0.14 + 0.86 * smooth(Math.min(1, view.growth))) * 0.62;
      }
    }
    return 0;
  }
}

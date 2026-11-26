/**
 * What the player has planted. A planting is stored as a point; here it
 * becomes a small wood (a tall tree at its heart, smaller ones around it and
 * shrubs at the edge, over shaded ground) or, on wet ground, a bed of reeds.
 * The arrangement depends only on the planting's id and position, so a saved
 * valley regrows the same.
 */

import { type Container, Sprite } from 'pixi.js';
import { hashString, mulberry32 } from '../core/rng';
import type { SceneryItem } from '../world/scenery';
import type { PlaceDef } from '../world/types';
import type { ArtLibrary } from './art';
import type { SceneryLayer } from './sceneryLayer';

const HEART = ['sparse-woodland', 'forest-grove'];
const AROUND = ['deciduous-small', 'deciduous-small', 'maple', 'pine'];
const EDGE = ['shrubs', 'undergrowth', 'moss-grasses'];
const REEDS = ['wetland-reeds', 'wetland-reeds', 'reedbed'];

export class PlantingLayer {
  private readonly floors = new Map<string, Sprite>();

  constructor(
    private readonly scenery: SceneryLayer,
    private readonly ground: Container,
    private readonly art: ArtLibrary,
  ) {}

  /** Shows exactly the given groves, growing in any that are new. */
  setPlanted(groves: readonly PlaceDef[], animate: boolean): void {
    const live = new Set(groves.map((g) => g.id));
    for (const [id, floor] of this.floors) {
      if (live.has(id)) continue;
      floor.destroy();
      this.floors.delete(id);
      this.scenery.removeGroup(`plant:${id}`);
    }
    for (const grove of groves) {
      if (this.floors.has(grove.id)) continue;
      // Shaded woodland floor under the trees, so the grove sits in the land rather than on it.
      const floor = new Sprite(this.art.get('shadow').texture);
      floor.anchor.set(0.5);
      floor.tint = grove.kind === 'reeds' ? 0x4c5a34 : 0x3d5a2c;
      floor.width = grove.radius * 2.5;
      floor.height = grove.radius * 1.5;
      floor.position.set(grove.x, grove.y);
      floor.alpha = 0.55;
      this.ground.addChild(floor);
      this.floors.set(grove.id, floor);
      this.scenery.setGroup(`plant:${grove.id}`, grove.kind === 'reeds' ? this.reeds(grove) : this.trees(grove), animate);
    }
  }

  private reeds(bed: PlaceDef): SceneryItem[] {
    const rng = mulberry32(hashString(`${bed.id}|${bed.x}|${bed.y}`));
    const items: SceneryItem[] = [];
    for (let i = 0; i < 9; i++) {
      const angle = rng() * Math.PI * 2;
      const r = bed.radius * 0.8 * Math.sqrt(rng());
      items.push({
        asset: REEDS[Math.floor(rng() * REEDS.length)]!,
        x: bed.x + Math.cos(angle) * r,
        y: bed.y + Math.sin(angle) * r * 0.6,
        scale: 0.5 + rng() * 0.4,
        flip: rng() < 0.5,
        roll: rng(),
      });
    }
    // Back to front, so the bed fills in toward the viewer.
    return items.sort((a, b) => a.y - b.y);
  }

  private trees(grove: PlaceDef): SceneryItem[] {
    const rng = mulberry32(hashString(`${grove.id}|${grove.x}|${grove.y}`));
    const pick = (list: string[]): string => list[Math.floor(rng() * list.length)]!;
    const items: SceneryItem[] = [{ asset: pick(HEART), x: grove.x, y: grove.y + 6, scale: 0.6, flip: rng() < 0.5, roll: rng() }];
    const ring = (count: number, reach: number, assets: string[], scale: [number, number]): void => {
      const turn = rng() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        const angle = turn + (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.5;
        const r = grove.radius * reach * (0.85 + rng() * 0.3);
        items.push({
          asset: pick(assets),
          x: grove.x + Math.cos(angle) * r,
          // Wider than deep: the valley is seen at a slant.
          y: grove.y + Math.sin(angle) * r * 0.6,
          scale: scale[0] + (scale[1] - scale[0]) * rng(),
          flip: rng() < 0.5,
          roll: rng(),
        });
      }
    };
    ring(5, 0.5, AROUND, [0.5, 0.72]);
    ring(6, 0.86, EDGE, [0.6, 0.95]);
    // Planting order runs outward from the heart, so the grove appears to spread as it grows.
    return items;
  }
}

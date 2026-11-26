import { bridgePlacement } from './bridgePlacement';
import { frontAlong } from './seasonFront';
/**
 * Turns the player's connections into landscape. The worn ground of a path or
 * corridor is painted by the ground shader; this layer adds what stands on it:
 * saplings and undergrowth along a woodland corridor, a few stones and flowers
 * beside a footpath, a bridge where a path spans the water. Stepping stones at
 * the valley's fords are drawn here too, sinking when their ford floods.
 *
 * Decoration is derived only from a connection's id and geometry, so the same
 * line always grows the same planting.
 */

import { Container, Sprite } from 'pixi.js';
import { hashString, mulberry32 } from '../core/rng';
import type { Connection } from '../world/connections';
import type { River } from '../world/river';
import type { SceneryItem } from '../world/scenery';
import type { BoardDef, FordDef, Season } from '../world/types';
import { type ArtLibrary } from './art';
import type { SceneryLayer } from './sceneryLayer';
import { fordStones } from './fordStones';

const CORRIDOR_PLANTS: Array<[string, number, number, number]> = [
  // asset, weight, min scale, max scale
  ['deciduous-small', 4, 0.5, 0.78],
  ['shrubs', 3, 0.7, 1],
  ['undergrowth', 2, 0.65, 0.9],
  ['corridor-decoration', 1, 0.7, 0.9],
  ['maple', 0.8, 0.4, 0.52],
  ['pine', 0.8, 0.4, 0.52],
];
const PATH_EDGING: Array<[string, number, number, number]> = [
  ['small-rocks', 2, 0.4, 0.6],
  ['wildflowers', 2, 0.45, 0.65],
  ['moss-grasses', 1, 0.4, 0.55],
];

export class ConnectionLayer {
  private readonly signatures = new Map<string, string>();
  private readonly fords: Array<{ ford: FordDef; root: Container; along: number; flooded: boolean }> = [];
  private season: Season;

  constructor(
    private readonly scenery: SceneryLayer,
    private readonly waterLayer: Container,
    private readonly art: ArtLibrary,
    private readonly board: BoardDef,
    private readonly river: River,
    private readonly alongOf: (y: number) => number,
    season: Season,
  ) {
    this.season = season;
    this.syncFords(false);
  }

  /** Adds stones for fords that have appeared (the player laid them) and removes those taken up. */
  private syncFords(animate: boolean): void {
    const live = new Set(this.board.fords.map((f) => f.id));
    for (let i = this.fords.length - 1; i >= 0; i--) {
      if (live.has(this.fords[i]!.ford.id)) continue;
      this.fords[i]!.root.destroy({ children: true });
      this.fords.splice(i, 1);
    }
    for (const ford of this.board.fords) {
      if (this.fords.some((entry) => entry.ford.id === ford.id)) continue;
      const root = new Container();
      for (const stone of fordStones(ford, this.river)) {
        const art = this.art.get(stone.asset);
        const sprite = new Sprite(art.texture);
        sprite.anchor.set(art.anchor[0], art.anchor[1]);
        sprite.width = stone.width;
        sprite.height = stone.width * art.height / art.width;
        if (stone.flip) sprite.scale.x *= -1;
        sprite.position.set(stone.x, stone.y);
        root.addChild(sprite);
      }
      const flooded = ford.floods.includes(this.season);
      // New stones rise out of the water; those already in the valley are simply there.
      root.alpha = animate || flooded ? 0 : 1;
      this.waterLayer.addChild(root);
      this.fords.push({ ford, root, along: this.alongOf(ford.y), flooded });
    }
  }

  setSeason(season: Season): void {
    this.season = season;
  }

  /** Rebuilds decoration for connections that are new or reshaped; removes it for those that are gone. */
  setConnections(connections: readonly Connection[], animate = true): void {
    this.syncFords(animate);
    const live = new Set(connections.map((c) => c.id));
    for (const id of [...this.signatures.keys()]) {
      if (live.has(id)) continue;
      this.scenery.removeGroup(id);
      this.signatures.delete(id);
    }
    for (const connection of connections) {
      const signature = connection.control.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';');
      const known = this.signatures.get(connection.id);
      if (known === signature) continue;
      // A reshaped line regrows in place without replaying the planting animation.
      this.scenery.setGroup(connection.id, this.decorate(connection), animate && known === undefined);
      this.signatures.set(connection.id, signature);
    }
  }

  private decorate(connection: Connection): SceneryItem[] {
    const rng = mulberry32(hashString(`${connection.id}|${this.board.seed}`));
    const items: SceneryItem[] = [];
    const corridor = connection.type === 'corridor';
    const palette = corridor ? CORRIDOR_PLANTS : PATH_EDGING;
    const total = palette.reduce((sum, p) => sum + p[1], 0);
    const from = this.board.places.find((p) => p.id === connection.from)!;
    const to = this.board.places.find((p) => p.id === connection.to)!;
    const spacing = corridor ? 30 : 110;
    let side = 1;

    for (let d = 30; d < connection.line.length - 30; d += spacing * (0.7 + rng() * 0.6)) {
      const p = connection.line.at(d);
      side = -side;
      const offset = corridor ? 24 + rng() * 36 : 20 + rng() * 9;
      const x = p.x - Math.sin(p.angle) * offset * side;
      const y = p.y + Math.cos(p.angle) * offset * side;
      let pickWeight = rng() * total;
      let choice = palette[0]!;
      for (const option of palette) {
        pickWeight -= option[1];
        if (pickWeight <= 0) {
          choice = option;
          break;
        }
      }
      const scale = choice[2] + (choice[3] - choice[2]) * rng();
      const flip = rng() < 0.5;
      const roll = rng();
      // Woods and settlements at either end are already furnished; water and crossings stay clear.
      if (Math.hypot(x - from.x, y - from.y) < from.radius * 0.72 || Math.hypot(x - to.x, y - to.y) < to.radius * 0.72) continue;
      if (this.river.edgeDistance({ x, y }) < 16) continue;
      if (connection.crossings.some((c) => Math.hypot(c.x - x, c.y - y) < c.width / 2 + 46)) continue;
      items.push({ asset: choice[0], x, y, scale, flip, roll });
    }

    const bridge = this.art.get('wooden-footbridge');
    for (const crossing of connection.crossings) {
      if (crossing.style !== 'bridge') continue;
      const placement = bridgePlacement(connection, crossing, this.river, bridge.width, bridge.height);
      items.push({
        asset: 'wooden-footbridge',
        x: placement.x, y: placement.y,
        scale: placement.scale, rotation: placement.rotation, anchor: placement.anchor,
        flip: false, roll: 0.5,
        zBias: Math.max(...placement.banks.map(p=>p.y))-placement.y-24,
      });
    }
    return items;
  }

  /** Fords under today's high water, by id (see `ValleyView.setWaterLevel`). */
  drowned: ReadonlySet<string> = new Set();

  /** Stones sink or surface as the seasonal front reaches their ford, or as the day's water rises over them. */
  update(dt: number, wave: number): void {
    for (const entry of this.fords) {
      if (wave - frontAlong(entry.along, this.season) > 0.05) entry.flooded = entry.ford.floods.includes(this.season);
      const target = entry.flooded || this.drowned.has(entry.ford.id) ? 0 : 1;
      entry.root.alpha += (target - entry.root.alpha) * Math.min(1, dt * 1.2);
    }
  }
}

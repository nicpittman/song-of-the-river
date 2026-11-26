import { describe, expect, it } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { fordStones } from './fordStones';
import { ConnectionLayer } from './connectionLayer';
import { River } from '../world/river';
import { adventureValley } from '../world/boards/adventure';
import type { ArtLibrary } from './art';
import type { SceneryLayer } from './sceneryLayer';

describe('painted stepping stones', () => {
  it('reaches both banks of every authored ford with small separate, stable stones', () => {
    const river = new River(adventureValley);
    for (const ford of adventureValley.fords) {
      const stones = fordStones(ford, river);
      expect(stones).toEqual(fordStones(ford, river));
      expect(stones.length).toBeGreaterThan(2);
      expect(stones.length).toBeLessThan(40);
      expect(river.edgeDistance(stones[0]!)).toBeGreaterThanOrEqual(32);
      expect(river.edgeDistance(stones.at(-1)!)).toBeGreaterThanOrEqual(32);
      for (let i = 1; i < stones.length; i++) {
        const a = stones[i - 1]!, b = stones[i]!;
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(36);
        expect(b.width).toBeGreaterThanOrEqual(24);
        expect(b.width).toBeLessThanOrEqual(27);
      }
    }
  });

  it('preserves the stone pictures’ aspect and upright camera, then hides them under high water', () => {
    const board = { ...adventureValley, fords: [adventureValley.fords[0]!] };
    const river = new River(board), water = new Container();
    const art = { get: () => ({ texture: Texture.EMPTY, width: 28, height: 16, anchor: [.5, .7] }) } as unknown as ArtLibrary;
    const layer = new ConnectionLayer({} as SceneryLayer, water, art, board, river, () => .2, 1);
    const row = water.children[0] as Container;
    expect(row.children.length).toBeGreaterThan(2);
    for (const stone of row.children) {
      expect(stone.rotation).toBe(0);
      expect(Math.abs(stone.width / stone.height)).toBeCloseTo(28 / 16);
    }
    layer.drowned = new Set([board.fords[0]!.id]);
    for (let i = 0; i < 100; i++) layer.update(.1, 1);
    expect(row.alpha).toBeLessThan(.001);
    layer.drowned = new Set();
    for (let i = 0; i < 100; i++) layer.update(.1, 1);
    expect(row.alpha).toBeGreaterThan(.999);
    board.fords = [];
    layer.setConnections([]);
    expect(water.children).toHaveLength(0);
  });
});

import { expect, it } from 'vitest';
import { Container, Sprite, Texture } from 'pixi.js';
import { Waterfalls } from './waterfalls';
import type { ArtLibrary } from './art';
import { seseragi } from '../world/boards/seseragi';
const art = { get: () => ({ texture: Texture.WHITE, width: 100, height: 100, anchor: [.5, 1] }) } as unknown as ArtLibrary;
it('covers the illustrated right-hand water and places spray at its foot; pause freezes particles', () => {
    const layer = new Container(), board = { ...seseragi, sprites: [{ asset: 'waterfall', x: 100, y: 100, scale: 1 }] };
    const falls = new Waterfalls(art, board, layer);
    falls.update(.25, false);
    const streaks = layer.children.slice(0, 9) as Sprite[];
    expect(streaks.some(s => s.x > 115)).toBe(true);
    expect(streaks.every(s => Number.isFinite(s.x) && Number.isFinite(s.y))).toBe(true);
    const spray = layer.children.slice(9) as Sprite[];
    expect(spray.length).toBeGreaterThan(0);
    expect(spray.every(s => s.x > 102 && s.x < 128)).toBe(true);
    const before = layer.children.map(s => [s.x, s.y]);
    falls.update(.5, true);
    expect(layer.children.map(s => [s.x, s.y])).toEqual(before);
    layer.destroy({ children: true });
});
it('retains correct mirroring and finite lanes for a very small waterfall', () => {
    const left = new Container(), right = new Container(), a = new Waterfalls(art, { ...seseragi, sprites: [{ asset: 'waterfall', x: 100, y: 100, scale: .1 }] }, left), b = new Waterfalls(art, { ...seseragi, sprites: [{ asset: 'waterfall', x: 100, y: 100, scale: .1, flip: true }] }, right);
    a.update(.1, true);
    b.update(.1, true);
    expect(left.children).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
        expect(Number.isFinite(left.children[i].x)).toBe(true);
        expect(left.children[i].x + right.children[i].x).toBeCloseTo(200);
        expect(left.children[i].y).toBe(right.children[i].y);
    }
    left.destroy({ children: true });
    right.destroy({ children: true });
});

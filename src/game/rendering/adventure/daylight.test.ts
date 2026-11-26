import { describe, expect, it, vi } from 'vitest';

vi.mock('pixi.js', () => {
  class Texture { static WHITE = {}; }
  class Sprite {
    x = 0; y = 0; width = 0; height = 0; alpha = 1; tint = 0xffffff;
    visible = true; destroyed = false; blendMode = 'normal';
    anchor = { x: 0, y: 0, set: (x: number, y = x) => { this.anchor.x = x; this.anchor.y = y; } };
    scale = { x: 1, y: 1 };
    position = { set: (x: number, y: number) => { this.x = x; this.y = y; } };
    constructor(readonly texture: unknown) {}
    destroy() { this.destroyed = true; }
  }
  class Container { children: Sprite[] = []; addChild(...sprites: Sprite[]) { this.children.push(...sprites); } }
  return { Texture, Sprite, Container };
});

import { Container, type Sprite } from 'pixi.js';
import type { ArtLibrary } from '../art';
import type { BoardDef } from '../../world/types';
import { Daylight } from './daylight';
import { newFrame } from './frame';

function setup(asset = 'cottage', flip = false) {
  const dimensions: Record<string, [number, number]> = { cottage: [192,185], 'mill-body': [230,165], watermill: [288,244] };
  const art = {
    has: (id: string) => id.endsWith('-windows') || id === 'mill-body',
    get: (id: string) => ({ id, texture: { id }, width: (dimensions[id] ?? [32,32])[0], height: (dimensions[id] ?? [32,32])[1], anchor: [.495,.999] }),
  } as unknown as ArtLibrary;
  const glow = new Container();
  const board = { sprites: [{ asset, x: 100, y: 200, scale: .5, flip }], hearths: [] } as unknown as BoardDef;
  const light = new Daylight(art,new Container(),glow,board,null);
  const panes = () => (glow.children as Sprite[]).filter(s => (s.texture as unknown as { id: string }).id?.endsWith('-windows'));
  return { light, panes };
}

describe('house window light', () => {
  it('fits the house canvas and follows mirrored scenery', () => {
    const { panes } = setup('cottage',true);
    const pane = panes()[0]!;
    expect(pane.x).toBe(100);
    expect(pane.y).toBe(200);
    expect(pane.width).toBe(96);
    expect(pane.height).toBe(92.5);
    expect(pane.scale.x).toBeLessThan(0);
  });

  it('uses the separate mill body at the scenery renderer scale', () => {
    const pane = setup('watermill').panes()[0]!;
    expect((pane.texture as unknown as { id: string }).id).toBe('mill-body-windows');
    expect(pane.width).toBeCloseTo(144);
    expect(pane.height).toBeCloseTo(165 * .5 * 288 / 230);
  });

  it('switches off in daylight, holds steady with reduced motion, and removes built-home lights', () => {
    const { light, panes } = setup();
    const f = newFrame();
    Object.assign(f,{ left: 0, top: 0, right: 1000, bottom: 1000, dusk: 0, season: 0, reduced: true });
    light.update(12,f);
    expect(panes()[0]!.visible).toBe(false);
    light.update(22,f);
    expect(panes()[0]!.visible).toBe(true);
    const alpha = panes()[0]!.alpha;
    f.time = 100;
    light.update(22,f);
    expect(panes()[0]!.alpha).toBe(alpha);
    light.setBuilt(9,{ x: 300, y: 400 },100,'cottage',.62);
    const built = panes()[1]!;
    light.setBuilt(9,null,0);
    expect(built.destroyed).toBe(true);
  });
});

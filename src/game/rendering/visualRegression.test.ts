import { describe, expect, it } from 'vitest';
import { Container, Sprite, Texture } from 'pixi.js';
import { AgentLayer } from './agentLayer';
import { SceneryLayer } from './sceneryLayer';
import type { ArtLibrary } from './art';
import type { Agent } from '../simulation/simulation';

const art = {
  has: () => false,
  get: (id: string) => ({
    id, texture: Texture.EMPTY, width: id === 'bird-up' || id === 'bird-down' ? 30 : 120,
    height: id === 'bird-up' || id === 'bird-down' ? 20 : 180,
    anchor: [0.25, 1], foliage: id === 'tree' ? 'deciduous' : id === 'reeds' ? 'herb' : 'none',
  }),
  seasonal: () => Texture.EMPTY,
} as unknown as ArtLibrary;

it('keeps white birds upright through a turn and freezes their pose when paused', () => {
  const sky = new Container();
  const layer = new AgentLayer({ sky, land: new Container(), water: new Container() }, art);
  const agent = { id: 1, traveller: 'bird', x: 100, y: 100, phase: 'going', angle: 0 } as Agent;
  layer.update(.1, [agent], false, 1);
  const flock = sky.children[0] as Container;
  const offsets = flock.children.map(b => ({ x: b.x, y: b.y }));
  agent.angle = Math.PI * .9;
  for (let i = 0; i < 20; i++) layer.update(.05, [agent], false, 1);
  expect(flock.rotation).toBe(0);
  expect(flock.children.some((b, i) => Math.hypot(b.x - offsets[i].x, b.y - offsets[i].y) > 10)).toBe(true);
  expect(flock.children.every(b => Math.abs(b.rotation) <= .14)).toBe(true);
  const pose = () => [flock.y, ...flock.children.flatMap(b => [b.x, b.y, b.rotation])];
  const before = pose();
  layer.update(1, [agent], true, 1);
  expect(pose()).toEqual(before);
});

describe('mill foreground sightline', () => {
  it('fades only crowns in front of a person and restores them when the person leaves', () => {
    const parent = new Container();
    const layer = new SceneryLayer(parent, new Container(), art, [
      { asset: 'tree', x: 100, y: 180, scale: 1, flip: true, roll: 0 },
      { asset: 'reeds', x: 50, y: 175, scale: 1, flip: false, roll: 0 },
      { asset: 'tree', x: 50, y: 90, scale: 1, flip: false, roll: 0 },
    ], () => .5, 1);
    layer.setPeople([{ x: 60, y: 145 }]);
    for (let frame = 0; frame < 20; frame++) layer.update(.1, 2);
    expect(parent.children[0]!.alpha).toBeCloseTo(.2);
    expect(parent.children[1]!.alpha).toBe(1);
    expect(parent.children[2]!.alpha).toBe(1);
    layer.setPeople([]);
    for (let frame = 0; frame < 20; frame++) layer.update(.1, 2);
    expect(parent.children.every((tree) => tree.alpha === 1)).toBe(true);
  });
  it('keeps foreground trees and reeds opaque around landmarks', () => {
    const parent = new Container();
    const layer = new SceneryLayer(parent, new Container(), art, [
      {asset:'tree',x:100,y:180,scale:1,flip:true,roll:0},
      {asset:'reeds',x:50,y:175,scale:1,flip:false,roll:0},
      {asset:'tree',x:50,y:90,scale:1,flip:false,roll:0},
    ], () => .5, 1);
    layer.reserveFocalView('mill', {left:5,right:65,top:60,bottom:140,depth:150});
    for(let i=0;i<20;i++)layer.update(.1,2);
    expect((parent.children[0] as Sprite).alpha).toBe(1);
    expect((parent.children[1] as Sprite).alpha).toBe(1);
    expect((parent.children[2] as Sprite).alpha).toBe(1);
    layer.reserveFocalView('mill',null);
    for(let i=0;i<20;i++)layer.update(.1,2);
    expect(parent.children.every(s=>s.alpha===1)).toBe(true);
  });
});

it('clears loose rocks from a bridge deck without fading its landscape or walkers', () => {
  const parent = new Container();
  const layer = new SceneryLayer(parent, new Container(), art, [
    { asset: 'river-stones', x: 100, y: 180, scale: 1, flip: false, roll: 0 },
    { asset: 'river-stones', x: 500, y: 180, scale: 1, flip: false, roll: 0 },
    { asset: 'cliff', x: 100, y: 180, scale: 1, flip: false, roll: 0 },
  ], () => .5, 1);
  layer.reserveBridgeDeck('village', { left: 70, right: 130, top: 120, bottom: 170 });
  for (let i = 0; i < 20; i++) layer.update(.1, 2);
  expect(parent.children[0]!.alpha).toBe(0);
  expect(parent.children[1]!.alpha).toBe(1);
  expect(parent.children[2]!.alpha).toBe(1);
  layer.reserveBridgeDeck('village', null);
  for (let i = 0; i < 20; i++) layer.update(.1, 2);
  expect(parent.children.every((s) => s.alpha === 1)).toBe(true);
});

import { expect, it } from 'vitest';
import { Container, Sprite, Texture } from 'pixi.js';
import manifest from '../../../public/art/manifest.json';
import { seseragi } from '../world/boards/seseragi';
import { layoutScenery } from '../world/scenery';
import { Simulation, newGameState } from '../simulation/simulation';
import { SceneryLayer } from './sceneryLayer';
import { PlaceLifeLayer } from './placeLifeLayer';
import { foliageKind } from './seasonalArt';
import type { ArtLibrary } from './art';
import type { ManifestEntry } from './manifest';

it('the shipped village wheel turns with summer water and has a clear foreground sightline', () => {
  const entries = manifest.assets as unknown as Record<string, ManifestEntry>;
  const art = {
    has: (id: string) => !!entries[id],
    get: (id: string) => {
      const e = entries[id];
      return { id, texture: Texture.EMPTY, width: e?.logical[0] ?? 20, height: e?.logical[1] ?? 20,
        anchor: e?.anchor ?? [.5, 1], attachments: e?.attachments, foliage: foliageKind(id, e?.category ?? '') };
    },
    seasonal: () => Texture.EMPTY,
  } as unknown as ArtLibrary;
  const sim = new Simulation(seseragi, newGameState(seseragi, 'free'));
  sim.state.tick = 750;
  const sorted = new Container(), items = layoutScenery(sim.board, sim.river);
  const scenery = new SceneryLayer(sorted, new Container(), art, items, () => .5, 1);
  const sprites = [...sorted.children] as Sprite[];
  const life = new PlaceLifeLayer(sim, art, sorted, scenery);
  const rotor = sorted.children.filter(c => !(c instanceof Sprite) && c.children.length === 1)[0]?.children[0];
  if(!rotor)throw new Error('The shipped mill must have a separate wheel rotor');
  life.update(.5, false, false);
  expect(rotor.rotation).toBeGreaterThan(0);
  const angle = rotor.rotation;
  life.update(.5, true, false);
  expect(rotor.rotation).toBe(angle);
  for(let i=0;i<20;i++)scenery.update(.1,2);
  const wheelRoot=rotor.parent;
  if(!wheelRoot)throw new Error('The wheel rotor must remain attached to the mill');
  const wheel = wheelRoot.getBounds();
  const mill = sim.board.sprites.find(s=>s.asset==='watermill')!;
  for(let i=0;i<items.length;i++) {
    const item=items[i],sprite=sprites[i],kind=art.get(item.asset).foliage;
    if(item.y<=mill.y || !['deciduous','evergreen','blossom','maple','herb'].includes(kind) || sprite.height<80)continue;
    const tree=sprite.getBounds();
    const covers=tree.x<wheel.x+wheel.width&&tree.x+tree.width>wheel.x&&tree.y<wheel.y+wheel.height&&tree.y+tree.height>wheel.y;
    if(covers)expect(sprite.alpha,`${item.asset} at ${item.x},${item.y} hides the wheel`).toBe(0);
  }
});

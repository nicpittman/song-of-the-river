import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DOMAdapter, Texture } from 'pixi.js';
import { SeasonalLandscape } from './seasonalLandscape';
import { seasonBlendAt } from './seasonFront';
import { extentOf } from './fields';
import { seseragi } from '../world/boards/seseragi';

const extent = extentOf(seseragi);
const adapter = DOMAdapter.get();
beforeAll(() => {
  // Construct real Pixi shader resources in Node; no browser or GPU rasterisation.
  DOMAdapter.set({ ...adapter, createCanvas: () => ({ getContext: () => null }) as unknown as ReturnType<typeof adapter.createCanvas> });
});
afterAll(() => DOMAdapter.set(adapter));

describe('mountains share the travelling season front', () => {
  it.each([0, 1] as const)('thaws low slopes before summits in season %s, within the same artwork', season => {
    expect(seasonBlendAt(180, extent, season, .88)).toBe(1);
    expect(seasonBlendAt(-650, extent, season, .88)).toBe(0);
    expect(seasonBlendAt(-650, extent, season, 1.2)).toBe(1);
    const foothillStart = 1 - (180 - extent.y) / extent.height;
    const halfway = seasonBlendAt(180, extent, season, foothillStart + .05);
    expect(halfway).toBeCloseTo(.5);
  });

  it.each([2, 3] as const)('brings autumn/winter down from the summits in season %s', season => {
    expect(seasonBlendAt(-650, extent, season, .2)).toBe(1);
    expect(seasonBlendAt(180, extent, season, .2)).toBe(0);
  });

  it('keeps both seasons bound during the front, with the terrain coordinate span', () => {
    const layer = new SeasonalLandscape(Texture.EMPTY, {x:10,y:-650,width:400,height:830}, extent, 0xd4dfdf);
    layer.setTextures(Texture.EMPTY, Texture.WHITE);
    layer.update(.88, 0);
    const shader = layer.mesh.shader!;
    expect(shader.resources.uOutgoing).toBe(Texture.EMPTY.source);
    expect(shader.resources.uIncoming).toBe(Texture.WHITE.source);
    expect(shader.resources.mountain.uniforms.uWave).toBe(.88);
    expect(shader.resources.mountain.uniforms.uReverse).toBe(1);
    expect([...shader.resources.mountain.uniforms.uSpan]).toEqual([extent.y, extent.height]);
    expect([...layer.mesh.geometry.positions]).toEqual([10,-650,410,-650,410,180,10,180]);
    layer.update(.2, 3);
    expect(shader.resources.mountain.uniforms.uReverse).toBe(0);
    // Finishing can release the old season after both bindings point at the new one.
    layer.setTextures(Texture.WHITE, Texture.WHITE);
    layer.update(2, 3);
    expect(shader.resources.uOutgoing).toBe(shader.resources.uIncoming);
    layer.mesh.destroy(); layer.destroy();
    expect(Texture.WHITE.source.destroyed).toBe(false);
  });
});

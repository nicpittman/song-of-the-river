import { describe, expect, it } from 'vitest';
import manifest from '../../../public/art/manifest.json';
import { adventureValley } from '../world/boards/adventure';
import { River } from '../world/river';
import { layoutScenery } from '../world/scenery';
import { STRUCTURE_LOOKS, finishedArt, stageArt } from './adventure/structures';

const art = manifest.assets as Record<string, { file: string; logical: number[]; anchor: number[]; approved: boolean }>;
const has = (id: string): boolean => !!art[id];

describe('finished adventure illustrations', () => {
  it('has real art for every visible authored or scattered object in all three regions', () => {
    // These two old decorations are intentionally excluded by ValleyView, not displayed as stand-ins.
    const hidden = new Set(['net-float', 'wrack']);
    const missing = new Set(layoutScenery(adventureValley, new River(adventureValley))
      .filter(item => !hidden.has(item.asset) && !has(item.asset)).map(item => item.asset));
    expect([...missing]).toEqual([]);
  });

  it('has illustrated finished works, visible story construction stages and small travel bundles', () => {
    for (const kind of Object.keys(STRUCTURE_LOOKS)) expect(has(finishedArt(kind, has)), kind).toBe(true);
    for (const kind of ['cottage', 'bridge', 'dock', 'boat']) for (const stage of [-1, 0, 1, 2]) {
      expect(has(stageArt(kind, stage, has)), `${kind} stage ${stage}`).toBe(true);
    }
    for (const id of ['pack-plain', 'pack-unusual', 'pack-rare', 'woodpile', 'basket', 'fish-basket']) expect(has(id), id).toBe(true);
  });

  it('ships complete wildlife cycles with identical frame canvases and registration', () => {
    const cycles: Array<[string, number]> = [['deer-walk', 4], ['stag-walk', 4], ['fawn-walk', 4], ['hare', 2], ['fox-run', 2], ['hawk', 2], ['bear', 2], ['sheep', 2], ['boar', 2], ['tanuki', 2], ['swallow', 2], ['crane-fly', 2], ['otter', 2], ['gull', 2]];
    for (const [prefix, count] of cycles) for (let n = 0; n < count; n++) {
      const id = `${prefix}-${n}`, frame = art[id];
      expect(frame, id).toBeDefined();
      expect(frame?.approved, id).toBe(true);
      expect(frame?.logical, id).toEqual(art[`${prefix}-0`]?.logical);
      expect(frame?.anchor, id).toEqual(art[`${prefix}-0`]?.anchor);
      expect(frame?.file, id).toBe('wildlife-illustrated.avif');
    }
    for (const id of ['chicken', 'heron-strike', 'monkey', 'frog', 'dragonfly', 'crane-stand', 'swan', 'carp-jump', 'kingfisher', 'owl', 'serow', 'sandpiper', 'butterfly', 'bird-up', 'bird-down']) expect(has(id), id).toBe(true);
  });
});

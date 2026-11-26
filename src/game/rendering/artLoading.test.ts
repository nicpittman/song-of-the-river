import { afterEach, expect, it, vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { ArtLibrary } from './art';
import type { ManifestEntry } from './manifest';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('bounds simultaneous image loads and continues after a missing image', async () => {
  const assets = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`piece-${i}`, {
    file: `${i}.webp`, size: [1, 1], logical: [1, 1], anchor: [.5, 1], category: 'props',
    kind: 'sprite', season: 'all', group: `piece-${i}`, approved: true, phase: 'first',
  } satisfies ManifestEntry]));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ version: 2, assets }) })));
  let active = 0, peak = 0, requested = 0;
  const load = async <T>(): Promise<T> => {
    const missing = ++requested === 3;
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--;
    if (missing) throw new Error('Missing image');
    return Texture.EMPTY as T;
  };
  vi.spyOn(Assets, 'load').mockImplementation(load);
  const art = new ArtLibrary(); const progress = vi.fn();
  await art.load('./art/', progress);
  expect(peak).toBe(6);
  expect(Assets.load).toHaveBeenCalledTimes(12);
  expect(art.missing).toEqual(['piece-2']);
  expect(art.has('piece-11')).toBe(true);
  expect(progress).toHaveBeenLastCalledWith(1);
});

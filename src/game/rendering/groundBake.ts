/**
 * The ground's baked field maps (terrain, water and relief) and the scenery layout for a valley,
 * computed once and kept, so opening the same valley again costs nothing, and
 * prepared in a worker while the title is showing, so pressing Journey does
 * not stall on them.
 *
 * Entries are keyed by everything that shapes them: the board, which of its
 * old beds carry water, its fords and its places. Whoever takes an entry gets its own copy
 * of the water map, which the ground rewrites when the river changes.
 */

import type { River } from '../world/river';
import { River as RiverModel } from '../world/river';
import type { BoardDef } from '../world/types';
import { type SceneryItem, layoutScenery } from '../world/scenery';
import { type DataMap, type Extent, bakeNoise, bakeRelief, bakeTerrain, bakeWater, extentOf } from './fields';

export interface GroundBake {
  terrainA: DataMap;
  terrainB: DataMap;
  water: DataMap;
  relief: DataMap;
  /** Where every tree, rock and reed bed stands. */
  scenery: SceneryItem[];
}

const cache = new Map<string, GroundBake>();
let noise: DataMap | null = null;

/** What decides the maps for a board in a given state. */
function keyOf(board: BoardDef, openChannels: readonly string[], extent: Extent): string {
  const fords = board.fords.map((f) => `${f.x},${f.y},${f.radius}`).join(';');
  // Places shape the clearings in the scenery (a planted grove adds one).
  const places = board.places.map((p) => `${p.id}:${p.x},${p.y}`).join(';');
  return `${board.id}|${extent.x},${extent.y},${extent.width},${extent.height}|${[...openChannels].sort().join(',')}|${fords}|${places}`;
}

/** The maps, worked out now. Pure: also run inside the worker. */
export function bakeGround(board: BoardDef, river: River, extent: Extent): GroundBake {
  const terrain = bakeTerrain(board, extent);
  const water = bakeWater(river, board, extent);
  return { terrainA: terrain.a, terrainB: terrain.b, water, relief: bakeRelief(board, water, extent), scenery: layoutScenery(board, river) };
}

/** The maps for this board and river: from the cache when they have been made before, otherwise made now and kept. */
export function groundMaps(board: BoardDef, river: River, extent: Extent): GroundBake {
  const key = keyOf(board, river.channels.map((c) => c.id), extent);
  let bake = cache.get(key);
  if (!bake) {
    bake = bakeGround(board, river, extent);
    cache.set(key, bake);
  }
  // The ground rewrites its water map when the river changes, and the scenery layer adjusts items: each gets copies of its own.
  return { ...bake, water: { ...bake.water, data: bake.water.data.slice() }, scenery: bake.scenery.map((item) => ({ ...item })) };
}

/** The shared noise tile (the same for every valley). */
export function groundNoise(): DataMap {
  noise ??= bakeNoise();
  return noise;
}

const pending = new Map<string, Promise<void>>();

/** Prepare once off-thread. Callers can await it to avoid doing the same
 * expensive bake again on the main thread while the worker is still busy. */
export function prebakeGround(board: BoardDef, opened: readonly string[] = []): Promise<void> {
  if (typeof Worker === 'undefined') return Promise.resolve();
  const extent = extentOf(board);
  const river = new RiverModel(board);
  river.setOpened(opened);
  const key = keyOf(board, river.channels.map((c) => c.id), extent);
  if (cache.has(key)) return Promise.resolve();
  const existing = pending.get(key);
  if (existing) return existing;
  let worker: Worker;
  try {
    worker = new Worker(new URL('./groundBake.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return Promise.resolve();
  }
  const ready = new Promise<void>(resolve => {
    const finish = (): void => { pending.delete(key); worker.terminate(); resolve(); };
    worker.onmessage = (event: MessageEvent<GroundBake>): void => {
      if (!cache.has(key)) cache.set(key, event.data);
      finish();
    };
    worker.onerror = finish;
    worker.onmessageerror = finish;
    try { worker.postMessage({ board, opened: [...opened] }); }
    catch { finish(); }
  });
  pending.set(key, ready);
  return ready;
}

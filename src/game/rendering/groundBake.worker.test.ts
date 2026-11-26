import { afterEach, expect, it, vi } from 'vitest';
import { groundMaps, prebakeGround, type GroundBake } from './groundBake';
import { adventureValley } from '../world/boards/adventure';
import { Simulation, newGameState } from '../simulation/simulation';
import { extentOf } from './fields';

afterEach(() => vi.unstubAllGlobals());

it('shares an in-flight bake and waits until the worker finishes', async () => {
  const workers: Array<{ onmessage?: () => void; terminate: ReturnType<typeof vi.fn> }> = [];
  class FakeWorker {
    terminate = vi.fn(); postMessage = vi.fn(); onerror?: () => void;
    constructor() { workers.push(this); }
  }
  vi.stubGlobal('Worker', FakeWorker);
  const board = { ...adventureValley, id: 'worker-ready-test' };
  let ready = false;
  const first = prebakeGround(board);
  first.then(() => { ready = true; });
  expect(prebakeGround(board)).toBe(first);
  await Promise.resolve(); expect(ready).toBe(false);
  expect(workers).toHaveLength(1);
  // Failure still resolves so unsupported workers can use the synchronous fallback.
  (workers[0] as FakeWorker).onerror!();
  await first; expect(ready).toBe(true);
  expect(workers[0]!.terminate).toHaveBeenCalledOnce();
});

it('reuses the worker result for the actual simulation board, with independent mutable water and scenery', async () => {
  let worker: FakeWorker;
  class FakeWorker {
    onmessage!: (event: { data: GroundBake }) => void;
    terminate = vi.fn(); postMessage = vi.fn();
    constructor() { worker = this; }
  }
  vi.stubGlobal('Worker', FakeWorker);
  const board = { ...adventureValley, id: 'worker-cache-handoff-test' };
  const ready = prebakeGround(board);
  const map = { data: new Uint8Array([111, 2, 3, 4]), width: 1, height: 1 };
  const bake: GroundBake = { terrainA: map, terrainB: map, water: map, relief: map, scenery: [] };
  worker!.onmessage({ data: bake });
  await ready;
  const sim = new Simulation(board, newGameState(board, 'free'));
  const maps = groundMaps(sim.board, sim.river, extentOf(sim.board));
  expect(maps.terrainA).toBe(bake.terrainA);
  expect(maps.water.data).toEqual(map.data);
  expect(maps.water.data).not.toBe(map.data);
  expect(maps.scenery).not.toBe(bake.scenery);
});

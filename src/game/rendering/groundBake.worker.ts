/**
 * Bakes a valley's ground maps off the main thread (see `groundBake.ts`). It
 * receives the board as plain data and the old beds that carry water, and
 * sends back the maps, transferring their buffers rather than copying them.
 */

import { River } from '../world/river';
import type { BoardDef } from '../world/types';
import { extentOf } from './fields';
import { bakeGround } from './groundBake';

self.onmessage = (event: MessageEvent<{ board: BoardDef; opened: string[] }>): void => {
  const { board, opened } = event.data;
  const river = new River(board);
  river.setOpened(opened);
  const bake = bakeGround(board, river, extentOf(board));
  const buffers = [bake.terrainA, bake.terrainB, bake.water, bake.relief].map((m) => m.data.buffer as ArrayBuffer);
  (self as unknown as Worker).postMessage(bake, buffers);
};

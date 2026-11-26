import type { BoardDef } from '../types';
import { adventureValley } from './adventure';
import { seseragi } from './seseragi';

/** Valleys in campaign order. */
export const BOARDS: readonly BoardDef[] = [seseragi];

/** Valleys that can be opened by id but are not part of the campaign: test fixtures and work in progress. */
const EXTRA: BoardDef[] = [adventureValley];

/** Makes a valley available to `boardById` without listing it in the menus. Used by the development harness. */
export function registerBoard(board: BoardDef): void {
  if (!EXTRA.some((b) => b.id === board.id)) EXTRA.push(board);
}

export function boardById(id: string): BoardDef {
  const board = BOARDS.find((b) => b.id === id) ?? EXTRA.find((b) => b.id === id);
  if (!board) throw new Error(`Unknown valley "${id}"`);
  return board;
}

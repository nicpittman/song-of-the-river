/** Ground rules derived from a board: altitude, snow and impassable zones. */

import type { Vec } from '../core/math';
import type { BoardDef, PlaceDef, ZoneDef } from './types';

/**
 * Height of the land in loose 0..1 units. The valley falls steadily from the
 * mountains (top of the board) to the river mouth; hills add local rises.
 * The same function drives winter snow in the renderer and route closures in
 * the simulation, so what the player sees is what the travellers get.
 */
export function altitude(board: BoardDef, x: number, y: number): number {
  let h = 1 - y / (board.altitudeSpan ?? board.height);
  for (const hill of board.hills) {
    const d2 = ((x - hill.x) ** 2 + (y - hill.y) ** 2) / (hill.r * hill.r);
    if (d2 < 4) h += hill.h * Math.exp(-d2 * 1.6);
  }
  return h;
}

export const isSnowbound = (board: BoardDef, p: Vec): boolean => altitude(board, p.x, p.y) > board.snowAltitude;

export function zoneAt(board: BoardDef, p: Vec): ZoneDef | null {
  for (const zone of board.zones) {
    for (const b of zone.blobs) {
      if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < b.r * b.r) return zone;
    }
  }
  return null;
}

export function placeAt(board: BoardDef, p: Vec, slack = 0): PlaceDef | null {
  let best: PlaceDef | null = null;
  let bestD = Infinity;
  for (const place of board.places) {
    const d = Math.hypot(p.x - place.x, p.y - place.y);
    if (d < place.radius + slack && d - place.radius < bestD) {
      best = place;
      bestD = d - place.radius;
    }
  }
  return best;
}

export const placeById = (board: BoardDef, id: string): PlaceDef => {
  const place = board.places.find((p) => p.id === id);
  if (!place) throw new Error(`Unknown place "${id}" on board "${board.id}"`);
  return place;
};

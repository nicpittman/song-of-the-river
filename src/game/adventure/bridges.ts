/**
 * A bridge spans the river from bank to bank along its own level line. The
 * drawn deck and the walking ground both come from `bridgeDeck`, so people
 * step onto the deck where it is drawn, walk along it, and step off at the
 * far end: never across the water beside it.
 */
import { dist, type Vec } from '../core/math';
import { Polyline } from '../world/geometry';
import { WATER_OFFSET, type River, type RiverCrossing } from '../world/river';
import type { OpenGround } from './navigation';

/** Half the length of the line a bridge is laid along. */
const REACH = 420;
/** A deck end stands this far from the water in any season. */
export const DECK_BANK = Math.max(...Object.values(WATER_OFFSET)) + 12;
/** The walking band reaches this far past each deck end onto the bank. */
const APPROACH = 64;
/** Half the width of the walking band along the deck. */
const BAND = 22;

export function bridgeLine(at: Vec): Polyline {
  return new Polyline([{ x: at.x - REACH, y: at.y }, { x: at.x + REACH, y: at.y }]);
}

/** The channel crossing nearest the bridge's spot. */
export function bridgeCrossing(river: River, at: Vec): RiverCrossing | undefined {
  return river.crossings(bridgeLine(at)).sort((a, b) => dist(a, at) - dist(b, at))[0];
}

export interface BridgeDeck {
  crossing: RiverCrossing;
  /** The deck's two ends on dry ground, west first, on the bridge's level line. */
  banks: readonly [Vec, Vec];
}

/** Where a bridge at `at` meets each bank: the first point from the crossing that is clear of the water. */
export function bridgeDeck(river: River, at: Vec): BridgeDeck | undefined {
  const crossing = bridgeCrossing(river, at);
  if (!crossing) return undefined;
  const bank = (direction: number): Vec => {
    let x = crossing.x;
    for (let d = 4; d <= 900; d += 4) {
      x = Math.max(at.x - REACH, Math.min(at.x + REACH, crossing.x + d * direction));
      if (river.edgeDistance({ x, y: at.y }) >= DECK_BANK) break;
    }
    return { x, y: at.y };
  };
  return { crossing, banks: [bank(-1), bank(1)] };
}

/** Walking ground along the deck, a little onto each bank, and no wider than the deck; its sides are closed between the deck ends. */
export function bridgeGround(river: River, at: Vec): OpenGround[] {
  const deck = bridgeDeck(river, at);
  if (!deck) return [];
  const [west, east] = deck.banks;
  const sides = { y: at.y, west: west.x, east: east.x };
  const start = west.x - APPROACH, end = east.x + APPROACH;
  const count = Math.max(1, Math.ceil((end - start) / 24));
  const ground: OpenGround[] = [];
  for (let i = 0; i <= count; i++) ground.push({ at: { x: start + ((end - start) * i) / count, y: at.y }, r: BAND, deck: sides });
  return ground;
}

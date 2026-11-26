/**
 * Seasonal availability. A connection is a fixed piece of landscape; whether
 * it can be travelled depends on the time of year. The rules are deliberately
 * few and visible in the world:
 *
 *   - Stepping stones are under water while their ford floods (spring melt).
 *   - Ground above the snowline is closed in winter.
 *   - Water meadows beside the river go under when it rises, unless an opened
 *     channel carries the high water away.
 *   - Bridges are always open.
 *
 * Fish and birds have closures of their own (see `water.ts` and `flight.ts`),
 * described with the same type so the game can explain any of them alike.
 */

import type { Vec } from '../core/math';
import type { Connection } from '../world/connections';
import { type Season, WINTER } from '../world/types';

/** Why a way is shut. The first two close the player's routes; the rest stop fish and birds. */
export type ClosureCause = 'flood' | 'snow' | 'meadow' | 'weir' | 'stones' | 'dry' | 'gap';

export interface Closure {
  cause: ClosureCause;
  /** For a route: the stretch (start, end distance along it) that cannot be passed. */
  span: [number, number];
  at: Vec;
}

export function closureOf(connection: Connection, season: Season): Closure | null {
  if (season === WINTER && connection.snow) {
    const [a, b] = connection.snow;
    return { cause: 'snow', span: [a, b], at: connection.line.at((a + b) / 2) };
  }
  for (const crossing of connection.crossings) {
    if (crossing.style === 'stones' && crossing.ford?.floods.includes(season)) {
      const reach = crossing.width / 2 + 16;
      return { cause: 'flood', span: [crossing.along - reach, crossing.along + reach], at: crossing };
    }
  }
  for (const { plain, span } of connection.wet) {
    if (plain.floods.includes(season)) return { cause: 'meadow', span, at: connection.line.at((span[0] + span[1]) / 2) };
  }
  return null;
}

export const isOpen = (connection: Connection, season: Season): boolean => closureOf(connection, season) === null;

const SENTENCES: Record<ClosureCause, string> = {
  flood: 'Spring melt has covered the stepping stones.',
  snow: 'Snow has closed the high ground.',
  meadow: 'The river has risen over the water meadow.',
  weir: 'Fish cannot pass the weir.',
  stones: 'Fish will not pass stepping stones that are in use.',
  dry: 'The channel runs too shallow for fish this season.',
  gap: 'The flock has nowhere to rest within reach.',
};

/** Player-facing sentence for a closure. */
export const describeClosure = (closure: Closure): string => SENTENCES[closure.cause];

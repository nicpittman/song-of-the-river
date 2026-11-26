/**
 * A traveller's way is a list of legs. A leg is a stretch of some line: one of
 * the player's connections for deer and villagers, a river channel for fish, a
 * flight between resting places for birds. Agents move along legs without
 * caring which kind they are.
 */

import type { Connection } from '../world/connections';
import type { Polyline } from '../world/geometry';
import type { RouteStep } from '../world/network';

export interface Leg {
  line: Polyline;
  /** Distances along `line` where the leg starts and ends. `from > to` runs against the line. */
  from: number;
  to: number;
  /** The connection this leg follows, for land travellers. Seasons can close it under them. */
  connection?: Connection;
  /** Seconds to rest on reaching the end of this leg before starting the next. */
  rest?: number;
}

export const legLength = (leg: Leg): number => Math.abs(leg.to - leg.from);

export const landLegs = (route: readonly RouteStep[]): Leg[] =>
  route.map(({ connection, reversed }) => ({
    line: connection.line,
    from: reversed ? connection.line.length : 0,
    to: reversed ? 0 : connection.line.length,
    connection,
  }));

/**
 * Route finding over the player's connections. Places are graph nodes and
 * connections are edges; each traveller uses one connection type, and the
 * season decides which edges are open.
 */

import { closureOf } from '../simulation/conditions';
import type { Connection } from './connections';
import { type LandTraveller, type Season, TRAVELLER_USES } from './types';

export interface RouteStep {
  connection: Connection;
  /** True when travelling from the connection's `to` end toward its `from` end. */
  reversed: boolean;
}

/**
 * Shortest route between two places for a traveller, or null.
 * With `ignoreClosures` the season is disregarded, which finds the route a
 * traveller would like to take even though it is currently blocked.
 */
export function findRoute(
  connections: readonly Connection[],
  traveller: LandTraveller,
  season: Season,
  from: string,
  to: string,
  ignoreClosures = false,
): RouteStep[] | null {
  const type = TRAVELLER_USES[traveller];
  const edges = connections.filter((c) => c.type === type && (ignoreClosures || closureOf(c, season) === null));

  // Dijkstra. Valleys have a handful of places, so a linear scan is plenty.
  const best = new Map<string, number>([[from, 0]]);
  const via = new Map<string, { step: RouteStep; prev: string }>();
  const done = new Set<string>();
  for (;;) {
    let node: string | null = null;
    let nodeCost = Infinity;
    for (const [id, cost] of best) {
      if (!done.has(id) && cost < nodeCost) {
        node = id;
        nodeCost = cost;
      }
    }
    if (node === null) return null;
    if (node === to) break;
    done.add(node);
    for (const connection of edges) {
      const reversed = connection.to === node;
      if (connection.from !== node && !reversed) continue;
      const next = reversed ? connection.from : connection.to;
      const cost = nodeCost + connection.line.length;
      // Ties break on connection id so routes are stable across runs.
      const known = best.get(next);
      if (known === undefined || cost < known - 1e-6) {
        best.set(next, cost);
        via.set(next, { step: { connection, reversed }, prev: node });
      }
    }
  }

  const route: RouteStep[] = [];
  for (let node = to; node !== from; ) {
    const link = via.get(node)!;
    route.unshift(link.step);
    node = link.prev;
  }
  return route;
}

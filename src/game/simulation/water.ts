/**
 * Fish. They need no route drawn for them: they swim the river as it is, from
 * one water place to another. What stops them is what stands in the water:
 *
 *   - a weir (they must find a channel round it),
 *   - stepping stones that deer or people are using (stones the spring melt
 *     has covered are no obstacle),
 *   - a channel running too shallow for the season.
 *
 * So the player helps fish indirectly: by leaving a ford free, by bridging
 * instead of using stones, or by opening an old side channel.
 */

import type { Vec } from '../core/math';
import type { Connection } from '../world/connections';
import type { Channel, River } from '../world/river';
import type { BoardDef, Season } from '../world/types';
import type { Closure } from './conditions';
import type { Leg } from './legs';

interface Block {
  channel: Channel;
  along: number;
  closure: Closure;
}

interface Node {
  channel: Channel;
  along: number;
  /** Indices of nodes joined to this one at a confluence, at no cost. */
  joins: number[];
}

/** Everything that stops fish this season. */
function blocks(board: BoardDef, river: River, connections: readonly Connection[], season: Season): Block[] {
  const out: Block[] = [];
  const on = (p: Vec, cause: Closure['cause']): void => {
    const hit = river.nearest(p);
    out.push({ channel: hit.channel, along: hit.along, closure: { cause, span: [0, 0], at: hit.point } });
  };
  for (const weir of board.weirs ?? []) on(weir, 'weir');
  for (const ford of board.fords) {
    const used = connections.some((c) => c.crossings.some((x) => x.ford?.id === ford.id));
    if (used && !ford.floods.includes(season)) on(ford, 'stones');
  }
  for (const channel of river.channels) {
    if (!channel.def.dry?.includes(season)) continue;
    // A dry channel is shut along its whole length; mark it at both ends so no stretch is passable.
    for (const along of [8, channel.line.length - 8]) out.push({ channel, along, closure: { cause: 'dry', span: [0, 0], at: channel.line.at(along) } });
  }
  return out;
}

/** The river as a graph: the two ends of the journey, and every confluence. */
function graph(river: River, from: Vec, to: Vec): Node[] {
  const nodes: Node[] = [];
  const add = (channel: Channel, along: number): number => nodes.push({ channel, along, joins: [] }) - 1;
  const start = river.nearest(from);
  const goal = river.nearest(to);
  add(start.channel, start.along);
  add(goal.channel, goal.along);
  for (const channel of river.channels) {
    for (const end of [0, channel.line.length]) {
      const p = channel.line.at(end);
      for (const other of river.channels) {
        if (other === channel) continue;
        const hit = other.line.nearest(p);
        if (hit.d > other.widths[hit.segment]! / 2 + 40) continue;
        const a = add(channel, end);
        const b = add(other, hit.along);
        nodes[a]!.joins.push(b);
        nodes[b]!.joins.push(a);
      }
    }
  }
  return nodes;
}

export interface WaterRoute {
  legs: Leg[];
  /** What stops the fish, if the way is not clear; the legs then lead only as far as it. */
  closure: Closure | null;
}

/**
 * The way a fish would swim from `from` to `to`. If something blocks every
 * way, returns the shortest way as far as its first obstacle, so the fish can
 * be seen gathering there. Null if the two are not joined by water at all.
 */
export function waterRoute(board: BoardDef, river: River, connections: readonly Connection[], season: Season, from: Vec, to: Vec): WaterRoute | null {
  const nodes = graph(river, from, to);
  const shut = blocks(board, river, connections, season);
  const blockBetween = (a: Node, b: Node): Block | null => {
    const lo = Math.min(a.along, b.along);
    const hi = Math.max(a.along, b.along);
    let first: Block | null = null;
    for (const block of shut) {
      if (block.channel !== a.channel || block.along <= lo || block.along >= hi) continue;
      // The first one met, travelling from a toward b.
      if (!first || Math.abs(block.along - a.along) < Math.abs(first.along - a.along)) first = block;
    }
    return first;
  };

  const search = (respect: boolean): number[] | null => {
    const cost = nodes.map(() => Infinity);
    const via = nodes.map(() => -1);
    const done = nodes.map(() => false);
    cost[0] = 0;
    for (;;) {
      let at = -1;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && cost[i]! < (at < 0 ? Infinity : cost[at]!)) at = i;
      if (at < 0) return null;
      if (at === 1) break;
      done[at] = true;
      const node = nodes[at]!;
      const relax = (next: number, step: number): void => {
        if (cost[at]! + step < cost[next]! - 1e-6) {
          cost[next] = cost[at]! + step;
          via[next] = at;
        }
      };
      for (const join of node.joins) relax(join, 0);
      for (let i = 0; i < nodes.length; i++) {
        const other = nodes[i]!;
        if (i === at || other.channel !== node.channel) continue;
        if (respect && blockBetween(node, other)) continue;
        relax(i, Math.abs(other.along - node.along));
      }
    }
    const path = [1];
    while (path[0] !== 0) path.unshift(via[path[0]!]!);
    return path;
  };

  const toLegs = (path: number[]): Leg[] => {
    const legs: Leg[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = nodes[path[i]!]!;
      const b = nodes[path[i + 1]!]!;
      if (a.channel !== b.channel || a.along === b.along) continue;
      const last = legs[legs.length - 1];
      // Consecutive stretches of one channel in one direction are a single leg.
      if (last && last.line === a.channel.line && last.to === a.along && Math.sign(last.to - last.from) === Math.sign(b.along - a.along)) last.to = b.along;
      else legs.push({ line: a.channel.line, from: a.along, to: b.along });
    }
    return legs;
  };

  const clear = search(true);
  if (clear) return { legs: toLegs(clear), closure: null };
  const wished = search(false);
  if (!wished) return null;
  // Follow the way the fish would like to go, as far as the first thing in it.
  const legs: Leg[] = [];
  for (const leg of toLegs(wished)) {
    const channel = river.channels.find((c) => c.line === leg.line)!;
    const block = blockBetween({ channel, along: leg.from, joins: [] }, { channel, along: leg.to, joins: [] });
    if (!block) {
      legs.push(leg);
      continue;
    }
    const short = block.along - Math.sign(leg.to - leg.from) * 26;
    if (Math.sign(short - leg.from) === Math.sign(leg.to - leg.from)) legs.push({ ...leg, to: short });
    return { legs, closure: block.closure };
  }
  return { legs, closure: null };
}

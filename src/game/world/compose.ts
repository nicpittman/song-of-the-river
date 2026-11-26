/**
 * Joining reaches into one valley. Each reach of the river is authored as a
 * board of its own, in its own coordinates, so reaches can be composed and
 * tested separately. This lays them end to end, mountains at the top and the
 * sea at the bottom, and returns one continuous board whose `reaches` say
 * where each begins and ends.
 *
 * Reaches must agree where they meet: the main channel of one should leave
 * its bottom edge where the main channel of the next enters its top edge, at
 * the same width.
 */

import type { Vec } from '../core/math';
import type { Blob, BoardDef, ChannelDef, ReachDef } from './types';

/** How far a reach's river may run past its own top or bottom edge before being trimmed at a join. */
const OVERLAP = 90;

export function composeValley(id: string, name: string, subtitle: string, parts: readonly BoardDef[]): BoardDef {
  const first = parts[0]!;
  const reaches: ReachDef[] = [];
  let top = 0;
  const board: BoardDef = {
    ...first,
    id,
    name,
    subtitle,
    width: Math.max(...parts.map((p) => p.width)),
    height: parts.reduce((sum, p) => sum + p.height, 0),
    // Only the upper reach is high ground: the snowline means what it meant there.
    altitudeSpan: first.altitudeSpan ?? first.height,
    hills: [], relief: [], channels: [], islands: [], shallows: [], fords: [], zones: [], places: [], patches: [], woods: [], outcrops: [],
    lanes: [], sprites: [], scatter: [], banks: [], hearths: [], journeys: [], objectives: [], solution: [], weirs: [], floodplains: [],
    sea: undefined,
  };

  parts.forEach((part, index) => {
    const dy = top;
    const last = index === parts.length - 1;
    const at = <T extends Vec>(p: T): T => ({ ...p, y: p.y + dy });
    const blobs = (list: readonly Blob[]): Blob[] => list.map(at);
    // Ids that might repeat from reach to reach are made unique; places keep theirs, so reaches can refer to each other's.
    const tag = (local: string): string => (index === 0 ? local : `${local}@${part.id}`);

    board.hills.push(...part.hills.map(at));
    board.relief.push(...part.relief.map(at));
    board.islands.push(...blobs(part.islands));
    board.shallows.push(...blobs(part.shallows));
    board.outcrops.push(...part.outcrops.map(at));
    board.hearths.push(...part.hearths.map(at));
    board.sprites.push(...part.sprites.map(at));
    board.fords.push(...part.fords.map(at));
    board.places.push(...part.places.map(at));
    board.weirs!.push(...(part.weirs ?? []).map(at));
    board.zones.push(...part.zones.map((zone) => ({ ...zone, id: tag(zone.id), blobs: blobs(zone.blobs) })));
    board.patches.push(...part.patches.map((patch) => ({ ...patch, blobs: blobs(patch.blobs) })));
    board.woods.push(...part.woods.map((woods) => ({ ...woods, blobs: blobs(woods.blobs) })));
    board.scatter.push(...part.scatter.map((rule) => ({ ...rule, blobs: blobs(rule.blobs) })));
    board.lanes.push(...part.lanes.map((lane) => ({ ...lane, points: lane.points.map(at) })));
    board.banks.push(...part.banks.map((rule) => ({ ...rule, channel: tag(rule.channel) })));
    board.floodplains!.push(
      ...(part.floodplains ?? []).map((plain) => ({ ...plain, blobs: blobs(plain.blobs), relievedBy: plain.relievedBy?.map(tag) })),
    );
    board.channels.push(
      ...part.channels.map((channel): ChannelDef => {
        // Where two reaches meet, each river is cut off a little past the join, so they overlap without doubling up.
        const kept = channel.points.filter(([, y]) => (index === 0 || y >= -OVERLAP) && (last || y <= part.height + OVERLAP));
        return { ...channel, id: tag(channel.id), points: kept.map(([x, y, w]) => [x, y + dy, w]) };
      }),
    );
    board.journeys.push(...part.journeys.map((journey) => ({ ...journey, reach: index })));
    board.objectives.push(
      ...part.objectives.map((objective) => ({ ...objective, reach: index, flourish: objective.flourish?.map(at) })),
    );
    board.solution.push(...part.solution.map((route) => ({ ...route, control: route.control.map(at) })));
    if (part.sea) board.sea = { y: part.sea.y + dy };

    top += part.height;
    reaches.push({ id: part.id, name: part.name, subtitle: part.subtitle, bottom: top, par: part.par, opening: part.opening });
  });

  const seen = new Set<string>();
  for (const place of board.places) {
    if (seen.has(place.id)) throw new Error(`Two places share the id "${place.id}" in valley "${id}"`);
    seen.add(place.id);
  }
  board.reaches = reaches;
  board.par = reaches.reduce((sum, reach) => sum + reach.par, 0);
  return board;
}

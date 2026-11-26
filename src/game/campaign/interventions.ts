/**
 * The seasonal allowance of brushstrokes: a few each season, shown to the
 * player as ink marks rather than a resource counter. Only Journey mode is
 * limited; Free Play has no allowance.
 *
 * Costs are deliberately lopsided. Stepping stones are cheap but the seasons
 * can close them; a footbridge is open all year but takes a second stroke.
 */

import type { Connection } from '../world/connections';

export const MARKS_PER_SEASON = 3;
export const MARKS_CAP = 5;
export const COST_PLANT = 1;
export const COST_STONES = 1;
/** Opening an old river bed is the one piece of river-shaping, and the dearest stroke. */
export const COST_CHANNEL = 2;

export const marksAfterSeason = (marks: number): number => Math.min(MARKS_CAP, marks + MARKS_PER_SEASON);

const bridges = (c: Connection): number => c.crossings.filter((x) => x.style === 'bridge').length;

/** One stroke for the line, and one more for each footbridge it needs. */
export const connectionCost = (c: Connection): number => 1 + bridges(c);

/**
 * Reshaping a line is free unless it changes how the route works: where it
 * crosses water, whether it climbs above the snowline, or which water meadows
 * it crosses. Cosmetic nudges and
 * accidental drags never cost anything.
 */
export function rerouteCost(before: Connection, after: Connection): number {
  const signature = (c: Connection): string =>
    `${c.crossings.map((x) => `${x.style}:${x.ford?.id ?? 'bridge'}`).join(',')}|${c.snow ? 'snow' : 'clear'}|${c.wet.map((w) => w.plain.id).join(',')}`;
  if (signature(before) === signature(after)) return 0;
  return 1 + Math.max(0, bridges(after) - bridges(before));
}

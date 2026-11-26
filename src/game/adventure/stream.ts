/**
 * The stream below Seseragi: Numata's little stream, where the old road south
 * meets it below Furumichi. There are no stones. It can be waded most of the
 * year and walked on the ice in winter, but for two days of peak melt at the
 * start of spring, and two of the autumn rains, nobody crosses. Stepping stones
 * set across it keep the road open through those days.
 *
 * The flood days are fixed so a player can plan round them (`streamFlooded`
 * in `river.ts`): the first two days of spring and of autumn.
 */

import { dist, type Vec } from '../core/math';
import { dayInSeason, seasonOf } from './calendar';
import { streamFlooded } from './river';
import type { AdventureState } from './state';
import type { WaterLevel } from './model';
import { readyBuildings } from './world';

export { streamFlooded, streamLine } from './river';

/** Where the old road meets the stream. */
export const STREAM_CROSSING: Vec = { x: 742, y: 2532 };
/** The stream's channel on the valley board. */
export const STREAM_CHANNEL = 'numata-stream';
/** How close stepping stones must be to the road's crossing to carry it. */
const STONES_REACH = 120;

const SPRING = 0, WINTER = 3;

/** In winter the stream freezes over and can be walked anywhere. */
export const streamFrozen = (day: number): boolean => seasonOf(day) === WINTER;

/** Stepping stones are set across the road's crossing. */
export function stonesLaid(state: AdventureState, day = state.day): boolean {
  return readyBuildings(state, day).some((b) => b.kind === 'stones' && dist(b, STREAM_CROSSING) < STONES_REACH);
}

/** The road can cross today: the stream is down, or stones carry it. */
export function streamCrossable(state: AdventureState, day = state.day): boolean {
  return !streamFlooded(day) || stonesLaid(state, day);
}

/** The crossing beyond Furumichi's waymark, distinct from the cart ruts above it. */
export function streamCrossingLine(state: AdventureState, day = state.day): string {
  if (streamFrozen(day)) return 'Beyond the waymark, the stream is frozen. The ice carries the road across.';
  if (stonesLaid(state, day)) return streamFlooded(day)
    ? 'Beyond the waymark, the stream is flooded, but our stepping stones keep the crossing open.'
    : 'Beyond the waymark, our stepping stones carry the road across the stream.';
  if (streamFlooded(day)) return `Beyond the waymark, the stream is flooded. The crossing is closed ${dayInSeason(day) === 0 ? 'for a day or two' : 'until tomorrow'}, unless we set stepping stones across.`;
  return streamFlooded(day + 1)
    ? 'Beyond the waymark, the stream is shallow enough to wade today. It will rise tomorrow.'
    : 'Beyond the waymark, the stream is shallow enough to wade. The crossing is open.';
}

/** What today's traveller brings back to the fire, using the actual crossing rules. */
export function furumichiReport(state: AdventureState, level: WaterLevel): string {
  const flooded = streamFlooded(state.day);
  const water = streamFrozen(state.day) ? 'The stream is frozen; the road carries on over the ice.'
    : stonesLaid(state) ? flooded ? 'The stream is flooded, but our stepping stones keep the road open.' : 'The water is down; our stepping stones carry the road over the stream.'
    : flooded ? 'The stream is flooded; we cannot cross today.'
    : level === 'high' ? 'The river is high, but the stream crossing is still shallow enough to wade.'
    : level === 'middle' ? 'The river is at middle water; we can wade the stream today.'
    : 'The river is low; the stream crossing is shallow enough to wade.';
  const wait = flooded && !stonesLaid(state) ? ` ${dayInSeason(state.day) === 0 ? 'It should drop in a day or two' : 'It should drop tomorrow'}, or we could set stones across.` : '';
  return `${water}${wait} The old road runs south, over the stream and into the mist.`;
}

/** Someone has seen where the road meets the stream, or knows the way on past it. */
export function streamKnown(state: AdventureState): boolean {
  return state.free || state.known.includes('furumichi') || !!state.discoveries['waymark'] || !!state.discoveries['long-view'];
}

/** Why the road south is shut today, in the group's words. Stones are offered once someone has seen the stream. */
export function streamShutLine(state: AdventureState, day = state.day): string {
  const melt = seasonOf(day) === SPRING;
  const water = melt ? 'The stream below Seseragi is running high with the melt.' : 'The stream below Seseragi is running high with the rains.';
  const wait = dayInSeason(day) === 0 ? 'It should drop in a day or two' : 'It should be down by tomorrow';
  return streamKnown(state) ? `${water} ${wait}, or we could set stepping stones across.` : `${water} ${wait}.`;
}

/** Lightweight water-driven animation; shares the river's actual seasonal banks and dry channels. */
import type { Vec } from '../core/math';
import { WATER_OFFSET, type River } from './river';
import type { Season } from './types';

export function millWheelSpeed(river: River, paddle: Vec, season: Season): number {
  if (!river.channels.length) return 0;
  const hit=river.nearest(paddle);
  if (hit.channel.def.dry?.includes(season)) return 0;
  const immersion=hit.half+WATER_OFFSET[season]-hit.d;
  const contact=Math.max(0,Math.min(1,immersion/22));
  // Spring melt is livelier; the unfrozen main river still moves slowly in winter.
  return contact*([.8,.42,.62,.18] as const)[season];
}

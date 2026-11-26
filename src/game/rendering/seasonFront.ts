import type { Season } from '../world/types';
import type { DayPhase } from '../adventure/model';
import { DAY_SECONDS, DAYS_PER_SEASON, dayInSeason } from '../adventure/calendar';

/** The front follows saved daylight, so planning never consumes the thaw behind the notebook. */
export function expeditionSeasonWave(day: number, elapsed: number, phase: DayPhase): number {
  const daylight = phase === 'morning' ? 0 : phase === 'day' ? Math.min(1, Math.max(0, elapsed / DAY_SECONDS)) : 1;
  return -.12 + 1.52 * (dayInSeason(day) + daylight) / DAYS_PER_SEASON;
}

/** Warmth travels uphill from the low river; autumn/winter descend from the peaks. */
export const frontAlong = (along: number, season: Season): number => season < 2 ? 1 - along : along;
export const SEASON_FRONT_SOFTNESS = 0.1;

/** Same world-space front as the terrain, also used by procedural backdrop fallbacks. */
export function seasonBlendAt(y: number, span: { y: number; height: number }, season: Season, wave: number): number {
  const progress = (wave - frontAlong((y - span.y) / span.height, season)) / SEASON_FRONT_SOFTNESS;
  const t = Math.max(0, Math.min(1, progress));
  return t * t * (3 - 2 * t);
}

/**
 * How high the river stands, day by day. Authored and simple, not hydrology:
 *
 *  - each season has a usual level that matches the painted river (spring
 *    high with snowmelt, summer low, autumn middling, winter low);
 *  - big seasonal changes pass through middle water: spring melt eases
 *    toward summer, and the first day of a later spring rises gently;
 *  - a day of rain lifts the level one step, that day and the next.
 *
 * Because weather is seeded, the whole river is known in advance; the
 * notebook only ever shows "tomorrow" without tomorrow's own rain.
 */

import { DAYS_PER_SEASON, dayInSeason, seasonOf, weatherOf } from './calendar';
import type { WaterLevel, WaterTrend } from './model';

const LEVELS: readonly WaterLevel[] = ['low', 'middle', 'high'];
/** Spring, summer, autumn, winter. */
const SEASON_LEVEL = [2, 0, 1, 0];

const step = (level: WaterLevel): number => LEVELS.indexOf(level);
const levelAt = (index: number): WaterLevel => LEVELS[Math.max(0, Math.min(2, index))]!;

/** Falling melt eases before summer; rising melt eases into spring. */
function usualLevel(day: number): number {
  const season = seasonOf(day);
  const usual = SEASON_LEVEL[season]!;
  if (day <= 1) return SEASON_LEVEL[0]!; // The journey opens with established spring melt.
  const next = SEASON_LEVEL[(season + 1) % 4]!;
  if (dayInSeason(day) === DAYS_PER_SEASON - 1 && usual - next === 2) return usual - 1;
  if (dayInSeason(day) !== 0) return usual;
  const before = SEASON_LEVEL[(season + 3) % 4]!;
  return usual - before === 2 ? 1 : usual;
}

const wet = (seed: number, day: number): boolean => weatherOf(seed, day) === 'rain';

export function levelOf(seed: number, day: number): WaterLevel {
  const lift = wet(seed, day) || wet(seed, day - 1) ? 1 : 0;
  return levelAt(usualLevel(day) + lift);
}

/** Tomorrow as anyone can tell today: the season, and today's rain still in the river. */
export function tomorrowGuess(seed: number, day: number): WaterLevel {
  return levelAt(usualLevel(day + 1) + (wet(seed, day) ? 1 : 0));
}

export function trendOf(seed: number, day: number): WaterTrend {
  const change = step(tomorrowGuess(seed, day)) - step(levelOf(seed, day));
  return change > 0 ? 'rising' : change < 0 ? 'falling' : 'steady';
}

/** True on a morning when the level differs from yesterday's. */
export function shiftedOn(seed: number, day: number): boolean {
  return day > 1 && levelOf(seed, day) !== levelOf(seed, day - 1);
}

/** One plain sentence about the river this morning. */
export function riverLine(seed: number, day: number, region: number, withStream = true): string {
  // Above Mio the stream below the village is the news when it is about to flood, or has
  // (unless the story's own line is already saying so this morning).
  const stream = region === 0 && withStream ? streamLine(day) : null;
  if (stream) return stream;
  const level = levelOf(seed, day);
  const trend = trendOf(seed, day);
  const before = day > 1 ? levelOf(seed, day - 1) : level;
  const rose = step(level) > step(before);
  const fell = step(level) < step(before);
  const rain = wet(seed, day) || wet(seed, day - 1);
  const sea = region === 2;

  if (level === 'high') {
    if (rose && rain) return 'Rain on the hills overnight. The river is up again.';
    if (rose) return sea ? 'High water. The sea is in the reeds.' : region === 0 ? 'The river has risen. The stones at Old Ford are under again.' : 'The river has risen over the low banks.';
    if (trend === 'falling') return 'Still high, but the water is starting to drop.';
    return sea ? 'High water, right up into the reeds.' : 'The river runs high and loud with melt.';
  }
  if (level === 'middle') {
    if (fell) return sea ? 'The water has dropped back from the reeds.' : region === 0 ? 'The water has fallen. The stones at Old Ford are showing again.' : 'The water has fallen back between the banks.';
    if (rose && rain) return 'Rain upstream. The river has come up a little.';
    if (rose) return 'The river has risen a little overnight.';
    if (trend === 'rising') return 'The river is middling, and rising.';
    if (trend === 'falling') return 'The river is middling, and falling.';
    return 'The river runs at an ordinary height.';
  }
  if (fell) return sea ? 'Low water. The sands run far out.' : 'The river is low. New ground lies along the banks.';
  if (trend === 'rising') return 'Low water, but it will rise.';
  return sea ? 'Low water, and the beach is wide.' : 'Low, clear water. The gravel shows.';
}

/**
 * The stream below Seseragi (see `stream.ts`) floods on fixed days, so it can
 * be planned round: the first two days of spring, at peak melt, and the first
 * two of autumn, with the rains. The opening spring's melt has gone by before
 * anyone reaches it (the journey starts far up at Yamagoya).
 */
export function streamFlooded(day: number): boolean {
  if (day <= DAYS_PER_SEASON) return false;
  const season = seasonOf(day);
  return (season === 0 || season === 2) && dayInSeason(day) < 2;
}

/** The morning's word on the stream, the day before it floods and while it is up; null otherwise. */
export function streamLine(day: number): string | null {
  if (streamFlooded(day)) {
    const melt = seasonOf(day) === 0;
    return dayInSeason(day) === 0
      ? `The stream below Seseragi is up with the ${melt ? 'melt' : 'rains'}. It should drop in a day or two.`
      : 'The stream below Seseragi is still up. It should be down by tomorrow.';
  }
  if (streamFlooded(day + 1)) return seasonOf(day + 1) === 0
    ? 'The snow is going on the peaks. The stream below Seseragi will be up tomorrow, for a couple of days.'
    : 'The autumn rains are coming. The stream below Seseragi will be up tomorrow, for a couple of days.';
  return null;
}

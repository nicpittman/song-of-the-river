/**
 * The notebook's small vocabulary: how activities, water, weather and odds are
 * written on the page. Kept in one place so the same thing is always said the
 * same way.
 */

import type { Activity, Chance, JournalCategory, PackHint, WaterLevel, WaterTrend, Weather } from '../../game/adventure/model';

export const ACTIVITY_WORDS: Record<Activity, string> = {
  explore: 'Explore',
  fish: 'Fish',
  forage: 'Forage',
  investigate: 'Investigate',
  visit: 'Visit',
  track: 'Track',
};

/** The gift as a friend's notebook would put it: "a gift for fishing". */
export const GIFT_WORDS: Record<Activity, string> = {
  explore: 'exploring',
  fish: 'fishing',
  forage: 'foraging',
  investigate: 'looking closely',
  visit: 'visiting',
  track: 'tracking',
};

export const LEVEL_WORDS: Record<WaterLevel, string> = {
  low: 'Low water',
  middle: 'Middle water',
  high: 'High water',
};

/** Tomorrow's level, written small: "tomorrow middle". */
export const LEVEL_SHORT: Record<WaterLevel, string> = {
  low: 'low',
  middle: 'middle',
  high: 'high',
};

export const TREND_WORDS: Record<WaterTrend, string> = {
  falling: 'falling',
  steady: 'steady',
  rising: 'rising',
};

export const WEATHER_WORDS: Record<Weather, string> = {
  clear: 'Clear',
  mist: 'Mist',
  rain: 'Rain',
  snow: 'Snow',
};

export const CHANCE_WORDS: Record<Chance, string> = {
  unlikely: 'Unlikely',
  even: 'Even',
  likely: 'Likely',
  certain: 'Certain',
};

export const PACK_WORDS: Record<PackHint, string> = {
  plain: 'a plain bundle',
  unusual: 'an unusual bundle',
  rare: 'a rare bundle',
  story: 'news to tell',
};

export const CATEGORY_WORDS: Record<JournalCategory, string> = {
  wildlife: 'Wildlife',
  fish: 'Fish',
  birds: 'Birds',
  plants: 'Plants',
  curiosities: 'Curiosities',
  keepsakes: 'Keepsakes',
  encounters: 'Stories',
};

export const CATEGORY_ORDER: JournalCategory[] = ['wildlife', 'birds', 'fish', 'plants', 'curiosities', 'keepsakes', 'encounters'];

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "two", or the digits past ten. */
export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** "Mina", "Mina and Ren", "Sora, Ren and Mina". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "1 supply", "4 provisions". */
export function supplyWords(n: number): string {
  return n === 1 ? '1 provision' : `${n} provisions`;
}

export function resourceWords(view: { provisions: number; materials: number }): string {
  return `${supplyWords(view.provisions)} · ${view.materials} materials`;
}

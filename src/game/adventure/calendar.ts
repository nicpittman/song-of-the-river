/**
 * Days, seasons and the weather. The expedition keeps its own calendar: a day
 * is one turn (morning, then about half a minute of ordinary daylight, then the evening fire
 * and a short night), and three days make a season.
 *
 * Day 1 is the first day of spring. The same one-based calendar drives the
 * notebook, year line, seasonal front and painted simulation clock.
 *
 * The simulation's clock (which paints the season) is derived from this
 * calendar, so the picture and the rules always agree.
 */

import { hashString, mulberry32 } from '../core/rng';
import type { Weather } from './model';

/** Simulation daylight budget shared by walking, surveys and construction. */
export const DAY_SECONDS = 40;
/** Wall-clock duration of ordinary daylight at 1×; narrative pauses can extend it. */
export const DAY_PLAY_SECONDS = 30;
/** The illustrated walking day runs from seven until six. */
export const DAYLIGHT_HOURS = 11;
/** Leave the valley visible while the light fades and everyone settles at their fire. */
export const CAMP_GATHER_SECONDS = 1.2;
export const DAYS_PER_SEASON = 3;
/** Seconds between bundles set down by the evening fire. */
export const UNPACK_SECONDS = 1.1;
/** How long darkness takes to pass. */
export const NIGHT_SECONDS = 1.4;
/** Seconds the boat takes from the dock to the open sea. */
export const VOYAGE_SECONDS = 36;

/** 0 spring, 1 summer, 2 autumn, 3 winter. */
export function seasonOf(day: number): number {
  return Math.floor(Math.max(0, day - 1) / DAYS_PER_SEASON) % 4;
}

/** 0 on the first day of a season. */
export function dayInSeason(day: number): number {
  return Math.max(0, day - 1) % DAYS_PER_SEASON;
}

export function yearOf(day: number): number {
  return Math.floor(Math.max(0, day - 1) / (DAYS_PER_SEASON * 4)) + 1;
}

/** The last day of the season `day` is in. */
export function lastDayOfSeason(day: number): number {
  return day - dayInSeason(day) + DAYS_PER_SEASON - 1;
}

/**
 * The simulation tick for a moment of the calendar. Daylight never quite
 * reaches the next day, so the season only turns overnight.
 */
export function clockTick(day: number, elapsed: number, tick: number): number {
  const seconds = Math.max(0, day - 1) * DAY_SECONDS + Math.min(Math.max(0, elapsed), DAY_SECONDS - tick);
  return Math.round(seconds / tick);
}

/** The first three days are written, so the opening always plays the same way; after that the sky is seeded. */
const OPENING_WEATHER: readonly Weather[] = ['clear', 'mist', 'clear'];

export function weatherOf(seed: number, day: number): Weather {
  const opening = OPENING_WEATHER[day - 1];
  if (opening) return opening;
  const roll = mulberry32(hashString(`weather:${seed}:${day}`))();
  const winter = seasonOf(day) === 3;
  if (roll < 0.2) return winter ? 'snow' : 'rain';
  if (roll < 0.34) return 'mist';
  return 'clear';
}

export function seasonName(season: number): string {
  return ['Spring', 'Summer', 'Autumn', 'Winter'][season] ?? 'Spring';
}

/**
 * The ambience rules: given where we are, when, and in what weather, how loud is
 * each bed and how often does each kind of call come?
 *
 * Pure functions only, so the shape of a day can be tested without a browser.
 * The director (`audio.ts`) turns these numbers into gain ramps.
 *
 * The day is a clock hour 0..24: morning near 7, daylight 7 to 18, the evening
 * fire near 20, then a quick night from 20 round to 7.
 */
import type { Weather } from '../adventure/model';
import type { BedId, SpotId } from './sfxManifest';

export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';

const SEASON_NAMES: readonly SeasonName[] = ['spring', 'summer', 'autumn', 'winter'];

/** What the session tells the director about the world. Missing fields keep their last value. */
export interface SoundScene {
  /** A name, or the simulation's season index 0..3 (spring first). */
  season: SeasonName | number;
  weather?: Weather;
  /** Clock hour 0..24. */
  hour?: number;
  /** Region index: 0 Seseragi (mountain springs), 1 Mio (middle river, wetland), 2 Kawagiri (estuary). */
  region?: number;
}

/** How close the camera is to things that sound, each 0 (far) .. 1 (right there). */
export interface SoundListener {
  riverNearness?: number;
  waterfallNearness?: number;
  seaNearness?: number;
  /** Optional; without it, frogs follow the region (Mio is the wetland). */
  wetlandNearness?: number;
}

/** A fully specified scene, as the rules use it. */
export interface Conditions {
  season: SeasonName;
  weather: Weather;
  hour: number;
  region: number;
  river: number;
  waterfall: number;
  sea: number;
  wetland: number | null;
  /**
   * Seconds since this morning's light came up, or Infinity when no dawn has
   * been seen. The dawn chorus swells as the morning opens and then settles,
   * even while the clock waits at 7 for the player to plan.
   */
  dawnAge: number;
}

export const DEFAULT_CONDITIONS: Conditions = {
  season: 'spring',
  weather: 'clear',
  hour: 10,
  region: 0,
  river: 0.5,
  waterfall: 0,
  sea: 0,
  wetland: null,
  dawnAge: Infinity,
};

export function seasonName(season: SeasonName | number): SeasonName {
  if (typeof season === 'string') return season;
  const index = ((Math.round(season) % 4) + 4) % 4;
  return SEASON_NAMES[index];
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** 0 at `a`, 1 at `b`, smooth in between (works for falling ramps when a > b). */
function ramp(h: number, a: number, b: number): number {
  const t = clamp01((h - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Rises over [a, b], holds, falls over [c, d]. */
function plateau(h: number, a: number, b: number, c: number, d: number): number {
  return Math.min(ramp(h, a, b), ramp(h, d, c));
}

/** Wrap any hour into 0..24. */
export function wrapHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

// ── Shape of the day ────────────────────────────────────────────────────────

/** Full daylight. */
export function daylight(hour: number): number {
  return plateau(wrapHour(hour), 5.5, 7.5, 17, 19.5);
}

/** The evening at camp: light going, insects and frogs starting. */
export function dusk(hour: number): number {
  return plateau(wrapHour(hour), 16.5, 18.5, 21, 23);
}

/** Deep night. Wraps across midnight. */
export function night(hour: number): number {
  const h = wrapHour(hour);
  return h >= 12 ? ramp(h, 20.5, 22) : ramp(h, 5.5, 4);
}

/** The window in which a dawn chorus can sound. */
export function dawnLight(hour: number): number {
  return plateau(wrapHour(hour), 4.5, 6, 7.5, 9);
}

/** The camp fire: lit for the evening, embers through the night. */
export function fireLight(hour: number): number {
  const h = wrapHour(hour);
  if (h >= 12) return Math.max(plateau(h, 17.5, 19, 22, 24), 0.35 * ramp(h, 21, 22));
  return 0.35 * ramp(h, 3, 1);
}

/** Cicadas sing through the warm afternoon into early evening. */
function cicadaHours(hour: number): number {
  return plateau(wrapHour(hour), 10.5, 13.5, 18.5, 20);
}

/** The dawn chorus is loudest as the light comes, then settles over about half a minute. */
export function dawnSwell(dawnAge: number): number {
  if (!Number.isFinite(dawnAge) || dawnAge < 0) return 0.25;
  return 0.25 + 0.75 * clamp01(1 - dawnAge / 30);
}

// ── Beds ────────────────────────────────────────────────────────────────────

type SeasonTable = Readonly<Record<SeasonName, number>>;
type WeatherTable = Readonly<Record<Weather, number>>;

const RIVER_SEASON: SeasonTable = { spring: 1.15, summer: 0.9, autumn: 1, winter: 0.8 };
const WIND_SEASON: SeasonTable = { spring: 0.4, summer: 0.3, autumn: 0.6, winter: 0.65 };
const WIND_WEATHER: WeatherTable = { clear: 1, mist: 0.55, rain: 1.25, snow: 0.8 };
const BIRD_SEASON: SeasonTable = { spring: 1, summer: 0.85, autumn: 0.5, winter: 0 };
const BIRD_WEATHER: WeatherTable = { clear: 1, mist: 0.6, rain: 0.2, snow: 0 };
const DAWN_SEASON: SeasonTable = { spring: 1, summer: 0.85, autumn: 0.55, winter: 0.15 };
const CRICKET_SEASON: SeasonTable = { spring: 0.15, summer: 0.75, autumn: 1, winter: 0 };
const FROG_SEASON: SeasonTable = { spring: 1, summer: 0.8, autumn: 0.25, winter: 0 };
const INSECT_WEATHER: WeatherTable = { clear: 1, mist: 0.7, rain: 0.3, snow: 0 };

/** Frog country when the session does not say how near the wetland is. */
const REGION_WETLAND = [0.3, 0.85, 0.45] as const;

export type BedLevels = Record<BedId, number> & { waterfall: number };

/**
 * Linear gain for every bed (0 = silent). Values sit around 0..1.3 and are
 * scaled again by the ambience bus, so only their proportions matter here.
 */
export function bedLevels(c: Conditions): BedLevels {
  const day = daylight(c.hour);
  const evening = dusk(c.hour);
  const dark = night(c.hour);
  const raining = c.weather === 'rain';
  const estuary = c.region >= 2 ? 1 : 0;

  const river = (0.3 + 0.75 * clamp01(c.river)) * RIVER_SEASON[c.season] * (raining ? 1.1 : 1) * (estuary ? 0.8 : 1);
  const wind = WIND_SEASON[c.season] * WIND_WEATHER[c.weather] * (1 - 0.3 * dark) * (1 + 0.25 * estuary);
  const seaSide = 1 - 0.5 * clamp01(c.sea);
  const birds = day * BIRD_SEASON[c.season] * BIRD_WEATHER[c.weather] * seaSide * 0.8;
  const dawn = dawnLight(c.hour) * dawnSwell(c.dawnAge) * DAWN_SEASON[c.season] * BIRD_WEATHER[c.weather === 'snow' ? 'mist' : c.weather];
  const cicadas = c.season === 'summer' ? cicadaHours(c.hour) * INSECT_WEATHER[c.weather] * 0.7 : 0;
  const crickets = Math.max(evening, dark * 0.8) * CRICKET_SEASON[c.season] * INSECT_WEATHER[c.weather] * 0.8;
  const wetland = c.wetland ?? REGION_WETLAND[Math.min(2, Math.max(0, Math.round(c.region)))];
  const frogs = Math.max(evening, dark * 0.6) * FROG_SEASON[c.season] * clamp01(wetland) * (raining ? 1.2 : 1);
  const rain = raining ? 0.9 : 0;
  const sea = c.sea > 0.01 ? 0.25 + 0.85 * clamp01(c.sea) : 0;
  const fire = fireLight(c.hour) * (raining ? 0.6 : 1) * 0.8;
  const waterfall = 1.1 * clamp01(c.waterfall);

  return { river, wind, birds, dawn, cicadas, crickets, frogs, rain, sea, fire, waterfall };
}

/** Lowpass cutoff (Hz) per bed: distance and winter both muffle. */
export function bedCutoffs(c: Conditions): { river: number; wind: number; waterfall: number } {
  const winter = c.season === 'winter';
  return {
    river: (1500 + 7000 * clamp01(c.river)) * (winter ? 0.6 : 1),
    // Winter wind is a hush, not a whistle.
    wind: winter ? 900 : c.season === 'autumn' ? 2600 : 3600,
    waterfall: 1800 + 3000 * clamp01(c.waterfall),
  };
}

// ── Calls ───────────────────────────────────────────────────────────────────

/** Expected calls per minute for each spot sound right now. */
export function spotRates(c: Conditions): Record<SpotId, number> {
  const day = daylight(c.hour);
  const clear = c.weather === 'rain' ? 0.25 : c.weather === 'snow' ? 0.5 : 1;
  const spring = c.season === 'spring';
  const windy = c.season === 'autumn' || c.season === 'winter' || c.weather === 'rain';
  return {
    // The uguisu sings in spring, most of all as the morning opens.
    uguisu: spring ? (0.8 * day + 5 * dawnLight(c.hour) * clamp01(1 - c.dawnAge / 25)) * clear : 0,
    owl: night(c.hour) * (c.season === 'winter' ? 1 : 2.5),
    crow: day * (c.season === 'winter' ? 1.6 : 0.3) * clear,
    gull: day * clamp01(c.sea) * 2.5 * clear,
    creak: windy ? 0.4 * (1 - 0.5 * night(c.hour)) : 0,
  };
}

/**
 * Pick at most one call for a tick of `seconds`, given the rates and a random
 * number in [0, 1). Rates are per minute; the chance of any call in the tick is
 * their sum times the tick length.
 */
export function pickSpot(rates: Record<SpotId, number>, seconds: number, random: number): SpotId | null {
  let threshold = 0;
  for (const [spot, perMinute] of Object.entries(rates) as Array<[SpotId, number]>) {
    threshold += Math.max(0, perMinute) * (seconds / 60);
    if (random < threshold) return spot;
  }
  return null;
}

/** True when the light is just coming up: the clock moved out of the night into morning. */
export function isDawnOnset(previousHour: number | null, hour: number): boolean {
  const h = wrapHour(hour);
  const morning = h >= 4.5 && h < 9;
  if (!morning) return false;
  if (previousHour === null) return true;
  const p = wrapHour(previousHour);
  return !(p >= 4.5 && p < 9);
}

/** True when the clock has just entered deep night. */
export function isNightOnset(previousHour: number | null, hour: number): boolean {
  if (previousHour === null) return false;
  return night(previousHour) < 0.5 && night(hour) >= 0.5;
}

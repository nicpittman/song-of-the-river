import type { Weather } from '../../adventure/model';

/** A uniform wash keeps weather legible without camera-relative bands or expensive filters. */
export const WEATHER_INK: Record<Weather, { colour: number; alpha: number }> = {
  clear: { colour: 0xffffff, alpha: 0 },
  rain: { colour: 0x64727c, alpha: .16 },
  mist: { colour: 0xdce1da, alpha: .11 },
  snow: { colour: 0xd6dfe8, alpha: .08 },
};

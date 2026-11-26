/**
 * The river's sign for the day: one line in the morning that reads today's
 * water or weather and says where something may show. It is true: the
 * creature it points at is among today's sightings, and shows itself if
 * someone walks near enough (see `scheduleSightings`).
 */

import { dist } from '../core/math';
import { hashString, mulberry32 } from '../core/rng';
import type { FindDef } from './catalogue';
import { FINDS, PLACES } from './content';
import type { Weather, WaterLevel } from './model';
import { inLivedReach, livedIn } from './regions';
import { readyBuildings, type World } from './world';
import { inSeason } from './sightings';

export interface RiverSign {
  /** The creature it points at. */
  find: string;
  /** The known place nearest where it shows. */
  place: string;
  line: string;
}

const WEATHER_SIGN: Record<Weather, string> = {
  clear: 'A clear, still morning.',
  mist: 'Mist on the water.',
  rain: 'Rain on the roof.',
  snow: 'Fresh snow in the night.',
};
const LEVEL_SIGN: Record<WaterLevel, string> = {
  low: 'The water is down, and the stones are showing.',
  middle: 'The river runs easy today.',
  high: 'The river is high and loud.',
};
/** A sign only points somewhere this close to where the creature shows. */
const NEAR_PLACE = 420;

function spotsOf(find: FindDef, w: World): Array<{ x: number; y: number }> {
  const s = w.state;
  const inReach = (p: { y: number }): boolean => inLivedReach(s, p);
  const spots = (find.sighting?.near ?? []).filter(inReach);
  if (find.when?.structure) for (const b of readyBuildings(s)) if (b.kind === find.when.structure && inReach(b)) spots.push({ x: b.x, y: b.y - 20 });
  return spots;
}

export function riverSign(w: World): RiverSign | null {
  const s = w.state;
  if (s.moving || s.voyage !== 'preparing') return null;
  const regions = new Set(livedIn(s));
  const options = FINDS.filter((f) => inSeason(f, w) && regions.has(f.region) && (!f.after || s.discoveries[f.after]) && !s.tracked.includes(f.id))
    .flatMap((find) => {
      const spots = spotsOf(find, w);
      let best: { id: string; d: number } | null = null;
      for (const place of PLACES) {
        if (!regions.has(place.region) || place.kind === 'settlement' || !s.known.includes(place.id)) continue;
        for (const spot of spots) {
          const d = dist(spot, place.at);
          if (d < NEAR_PLACE && (!best || d < best.d)) best = { id: place.id, d };
        }
      }
      if (!best) return [];
      // A rare moment whose two conditions hold today first; then creatures of
      // today's water or weather; then ones not yet in the journal.
      const shifted = !!(find.when?.weather || find.when?.levels);
      const weight = (find.sighting!.moment ? 8 : shifted ? 3 : 1) * (s.discoveries[find.id] ? 1 : 2);
      return [{ find, place: best.id, weight }];
    });
  if (!options.length) return null;
  const rng = mulberry32(hashString(`sign:${w.seed}:${w.today.day}`));
  let roll = rng() * options.reduce((n, o) => n + o.weight, 0);
  const pick = options.find((o) => (roll -= o.weight) < 0) ?? options[0]!;
  const place = PLACES.find((p) => p.id === pick.place)!;
  const moment = pick.find.sighting!.moment;
  const reading = (moment ? moment.levels && !moment.weather : pick.find.when?.levels) ? LEVEL_SIGN[w.today.level] : WEATHER_SIGN[w.today.weather];
  const line = pick.find.sighting!.line;
  const where = s.discoveries[pick.find.id]
    ? `Near ${place.name}, perhaps: ${line.charAt(0).toLowerCase()}${line.slice(1)}.`
    : `Something new may show near ${place.name}.`;
  return { find: pick.find.id, place: place.id, line: `${reading} ${where}` };
}

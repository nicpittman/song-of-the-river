import { expect, it } from 'vitest';
import { FINDS, PLACES } from './content';
import type { Weather, WaterLevel } from './model';
import { inSeason, scheduleSightings } from './sightings';
import { riverSign } from './signs';
import { newExpedition } from './testing';
import type { World } from './world';

const WEATHERS: Weather[] = ['clear', 'mist', 'rain', 'snow'];
const LEVELS: WaterLevel[] = ['low', 'middle', 'high'];
const moments = FINDS.filter((f) => f.sighting?.moment);

function worldIn(region: number, season: number, weather: Weather, level: WaterLevel, day: number): World {
  const { a } = newExpedition();
  a.state.region = region;
  a.state.known = PLACES.filter((p) => p.region === region).map((p) => p.id);
  for (const f of FINDS) if (f.after) a.state.discoveries[f.after] = { day: 1, by: 'ren' };
  return { ...a.world(), today: { day, season, level, trend: 'steady', weather } };
}

it('gives each reach one rare moment that needs two conditions together', () => {
  expect(moments.map((f) => f.region).sort()).toEqual([0, 1, 2]);
  for (const f of moments) {
    expect(f.rare).toBe(true);
    // The find's own condition and the moment's are different kinds, so both have to line up.
    expect(f.when).toBeTruthy();
    const own = Object.keys(f.when!), extra = Object.keys(f.sighting!.moment!);
    expect(extra.some((k) => !own.includes(k))).toBe(true);
  }
});

it('shows a rare moment only when both its conditions hold, and then it does come', () => {
  for (const f of moments) {
    let shown = 0, both = 0;
    for (let season = 0; season < 4; season++) for (const weather of WEATHERS) for (const level of LEVELS) {
      if (weather === 'snow' && season !== 3) continue;
      for (const day of [4, 5, 6, 7, 8, 9]) {
        const w = worldIn(f.region, season, weather, level, day);
        const holds = inSeason(f, w);
        if (holds) both++;
        const scheduled = scheduleSightings(w).some((s) => s.find === f.id);
        if (scheduled) { shown++; expect(holds, `${f.id} in ${season}/${weather}/${level}`).toBe(true); }
        // The morning sign may point at it only on such a day too.
        if (riverSign(w)?.find === f.id) expect(holds).toBe(true);
      }
    }
    expect(both).toBeGreaterThan(0);
    // On its day it is likelier than not to be among the creatures.
    expect(shown / both).toBeGreaterThan(0.5);
  }
});

it('names both conditions in the hint', () => {
  const words: Record<string, RegExp[]> = {
    'spotted-fawn': [/mist/, /summer/],
    'stubble-cranes': [/cold/, /mist|snow/],
    seal: [/low water/, /mist/],
  };
  for (const f of moments) for (const re of words[f.id]!) expect(f.hint).toMatch(re);
});

it('shows at most two known creatures a day, beyond yesterday’s track and the river sign', () => {
  for (let day = 20; day < 60; day++) {
    const w = worldIn(1, day % 4, 'clear', 'middle', day);
    for (const f of FINDS) if (f.region === 1 && f.sighting) w.state.discoveries[f.id] = { day: 1, by: 'sketch' };
    const sign = riverSign(w)?.find;
    const known = scheduleSightings(w).filter((x) => x.find !== sign);
    expect(known.length).toBeLessThanOrEqual(2);
  }
});

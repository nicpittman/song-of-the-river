import { describe, expect, it } from 'vitest';
import { FORKS, FORK_FOR_HABITAT, forksThatFit } from './lines';
import { PLACES } from './content';
import { forkFor } from './trail';
import { newExpedition } from './testing';
import type { Activity, Weather } from './model';

const WEATHER: Weather[] = ['clear', 'mist', 'rain', 'snow'];

describe('forks', () => {
  it('has a varied pool for every kind, each with three plain choices', () => {
    const texts = new Set<string>();
    for (const [kind, pool] of Object.entries(FORKS)) {
      expect(pool.length, kind).toBeGreaterThanOrEqual(6);
      // Something always fits, whatever the place, weather or season.
      expect(pool.some((f) => !f.habitats && !f.weather && !f.seasons), kind).toBe(true);
      for (const f of pool) {
        expect(texts.has(f.text), f.text).toBe(false);
        texts.add(f.text);
        expect(f.choices).toHaveLength(3);
        expect(new Set(f.choices).size, f.text).toBe(3);
        for (const c of f.choices) expect(c.length, c).toBeLessThanOrEqual(26);
      }
    }
    expect(texts.size).toBeGreaterThanOrEqual(60);
  });

  it('fits every habitat in the valley, in any weather and season', () => {
    for (const place of PLACES) {
      const kind = FORK_FOR_HABITAT[place.habitat] ?? 'open';
      for (const weather of WEATHER) for (let season = 0; season < 4; season++) {
        expect(forksThatFit(kind, place.habitat, weather, season).length, `${place.id} ${weather} ${season}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('does not repeat a situation until the pool has had a turn', () => {
    const { a } = newExpedition(5);
    const w = { seed: 5, state: a.state, today: { day: 3, season: 0, level: 'middle' as const, trend: 'steady' as const, weather: 'clear' as Weather } };
    const plan = { person: 'mina', activity: 'forage' as Activity };
    const pool = forksThatFit('gather', 'meadow', 'clear', 0);
    const seen: string[] = [];
    for (let day = 3; day < 3 + pool.length; day++) seen.push(forkFor({ ...w, today: { ...w.today, day } }, plan, 'meadow').text);
    expect(pool.length).toBeGreaterThanOrEqual(5);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

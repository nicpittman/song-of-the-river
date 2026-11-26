import { describe, expect, it } from 'vitest';
import { pickAlternate } from './cuePlayer';
import {
  DEFAULT_CONDITIONS, bedCutoffs, bedLevels, dawnSwell, daylight, fireLight, isDawnOnset, isNightOnset, night,
  pickSpot, seasonName, spotRates, type Conditions,
} from './soundscape';

const at = (overrides: Partial<Conditions>): Conditions => ({ ...DEFAULT_CONDITIONS, ...overrides });

describe('the shape of a day', () => {
  it('is light by day and dark at night, across midnight', () => {
    expect(daylight(12)).toBe(1);
    expect(daylight(2)).toBe(0);
    expect(night(23.5)).toBe(1);
    expect(night(1)).toBe(1);
    expect(night(12)).toBe(0);
    expect(night(25)).toBe(1); // wraps
  });

  it('lights the fire for the evening and lets it sink to embers', () => {
    expect(fireLight(12)).toBe(0);
    expect(fireLight(20)).toBe(1);
    expect(fireLight(23.5)).toBeGreaterThan(0.2);
    expect(fireLight(23.5)).toBeLessThan(0.6);
    expect(fireLight(6)).toBe(0);
  });

  it('swells the dawn chorus as the morning opens, then lets it settle', () => {
    expect(dawnSwell(0)).toBe(1);
    expect(dawnSwell(60)).toBeCloseTo(0.25);
    expect(dawnSwell(Infinity)).toBeCloseTo(0.25);
    const fresh = bedLevels(at({ hour: 6.5, dawnAge: 0 })).dawn;
    const later = bedLevels(at({ hour: 7, dawnAge: 40 })).dawn;
    expect(fresh).toBeGreaterThan(later * 2);
  });

  it('notices dawn and nightfall only when the clock crosses into them', () => {
    expect(isDawnOnset(23, 7)).toBe(true);
    expect(isDawnOnset(7, 7.2)).toBe(false);
    expect(isDawnOnset(null, 7)).toBe(true);
    expect(isDawnOnset(null, 14)).toBe(false);
    expect(isNightOnset(20, 22.5)).toBe(true);
    expect(isNightOnset(22.5, 23)).toBe(false);
    expect(isNightOnset(null, 23)).toBe(false);
  });
});

describe('beds', () => {
  it('bring songbirds by day in spring and summer, none at night or in winter', () => {
    expect(bedLevels(at({ season: 'spring', hour: 11 })).birds).toBeGreaterThan(0.5);
    expect(bedLevels(at({ season: 'summer', hour: 11 })).birds).toBeGreaterThan(0.5);
    expect(bedLevels(at({ season: 'spring', hour: 23 })).birds).toBe(0);
    expect(bedLevels(at({ season: 'winter', hour: 11 })).birds).toBe(0);
  });

  it('bring crickets on summer and autumn evenings and cicadas on summer afternoons', () => {
    expect(bedLevels(at({ season: 'autumn', hour: 20 })).crickets).toBeGreaterThan(0.5);
    expect(bedLevels(at({ season: 'summer', hour: 20 })).crickets).toBeGreaterThan(0.4);
    expect(bedLevels(at({ season: 'autumn', hour: 11 })).crickets).toBe(0);
    expect(bedLevels(at({ season: 'summer', hour: 15 })).cicadas).toBeGreaterThan(0.5);
    expect(bedLevels(at({ season: 'autumn', hour: 15 })).cicadas).toBe(0);
  });

  it('bring frogs at dusk, loudest by the wetland', () => {
    const mio = bedLevels(at({ season: 'spring', hour: 20, region: 1 })).frogs;
    const mountains = bedLevels(at({ season: 'spring', hour: 20, region: 0 })).frogs;
    expect(mio).toBeGreaterThan(mountains);
    expect(bedLevels(at({ season: 'spring', hour: 12, region: 1 })).frogs).toBe(0);
    expect(bedLevels(at({ season: 'spring', hour: 20, wetland: 1 })).frogs).toBeGreaterThan(mio);
  });

  it('play rain only in rain, and the sea only near it', () => {
    expect(bedLevels(at({ weather: 'rain' })).rain).toBeGreaterThan(0);
    expect(bedLevels(at({ weather: 'clear' })).rain).toBe(0);
    expect(bedLevels(at({ sea: 0 })).sea).toBe(0);
    expect(bedLevels(at({ sea: 1 })).sea).toBeGreaterThan(bedLevels(at({ sea: 0.3 })).sea);
  });

  it('make the river louder and brighter near the water, and muffle it in winter', () => {
    expect(bedLevels(at({ river: 1 })).river).toBeGreaterThan(bedLevels(at({ river: 0 })).river * 2);
    expect(bedCutoffs(at({ river: 1 })).river).toBeGreaterThan(bedCutoffs(at({ river: 0 })).river);
    expect(bedCutoffs(at({ season: 'winter' })).wind).toBeLessThan(bedCutoffs(at({ season: 'summer' })).wind);
    expect(bedLevels(at({ waterfall: 0 })).waterfall).toBe(0);
    expect(bedLevels(at({ waterfall: 1 })).waterfall).toBeGreaterThan(0.5);
  });

  it('keep the fire to the evening camp', () => {
    expect(bedLevels(at({ hour: 20 })).fire).toBeGreaterThan(0.5);
    expect(bedLevels(at({ hour: 13 })).fire).toBe(0);
  });

  it('never ask for a negative or runaway level', () => {
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      for (const weather of ['clear', 'mist', 'rain', 'snow'] as const) {
        for (let hour = 0; hour < 24; hour += 0.5) {
          const levels = bedLevels(at({ season, weather, hour, river: 1, sea: 1, waterfall: 1, dawnAge: 0 }));
          for (const [bed, level] of Object.entries(levels)) {
            expect(level, `${bed} ${season} ${weather} ${hour}`).toBeGreaterThanOrEqual(0);
            expect(level, `${bed} ${season} ${weather} ${hour}`).toBeLessThan(1.5);
          }
        }
      }
    }
  });
});

describe('calls', () => {
  it('give the uguisu to spring only, most of all at dawn', () => {
    expect(spotRates(at({ season: 'summer', hour: 7, dawnAge: 0 })).uguisu).toBe(0);
    const dawn = spotRates(at({ season: 'spring', hour: 6.5, dawnAge: 0 })).uguisu;
    const noon = spotRates(at({ season: 'spring', hour: 12 })).uguisu;
    expect(dawn).toBeGreaterThan(noon * 3);
  });

  it('give owls to the night, crows to winter days, gulls to the coast', () => {
    expect(spotRates(at({ hour: 23 })).owl).toBeGreaterThan(0);
    expect(spotRates(at({ hour: 12 })).owl).toBe(0);
    expect(spotRates(at({ season: 'winter', hour: 12 })).crow).toBeGreaterThan(spotRates(at({ season: 'summer', hour: 12 })).crow);
    expect(spotRates(at({ sea: 0, hour: 12 })).gull).toBe(0);
    expect(spotRates(at({ sea: 1, hour: 12 })).gull).toBeGreaterThan(0);
  });

  it('pick a call in proportion to its rate, or none', () => {
    const rates = { uguisu: 6, owl: 0, crow: 0, gull: 0, creak: 0 };
    expect(pickSpot(rates, 1, 0.05)).toBe('uguisu'); // 6 per minute = 0.1 per second
    expect(pickSpot(rates, 1, 0.2)).toBeNull();
    expect(pickSpot({ uguisu: 0, owl: 0, crow: 0, gull: 0, creak: 0 }, 1, 0)).toBeNull();
  });
});

describe('helpers', () => {
  it('accept seasons as names or the simulation index', () => {
    expect(seasonName(0)).toBe('spring');
    expect(seasonName(3)).toBe('winter');
    expect(seasonName(5)).toBe('summer');
    expect(seasonName('autumn')).toBe('autumn');
  });

  it('never pick the same alternate twice running', () => {
    for (let last = 0; last < 4; last++) {
      for (const r of [0, 0.3, 0.6, 0.999]) {
        const pick = pickAlternate(4, last, r);
        expect(pick).not.toBe(last);
        expect(pick).toBeGreaterThanOrEqual(0);
        expect(pick).toBeLessThan(4);
      }
    }
    expect(pickAlternate(1, 0, 0.5)).toBe(0);
    expect(pickAlternate(3, -1, 0.999)).toBeLessThan(3);
  });
});

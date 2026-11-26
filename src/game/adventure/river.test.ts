import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, clockTick, dayInSeason, seasonOf, yearOf } from './calendar';
import { levelOf, riverLine, shiftedOn, tomorrowGuess, trendOf } from './river';
import { newExpedition, playToMorning } from './testing';
import { TICK } from '../simulation/simulation';

describe('days, seasons and the river', () => {
  it('starts on the first day of spring, with three full days per season and twelve per year', () => {
    expect([1, 2, 3, 4, 6, 7, 9, 10, 12, 13].map(seasonOf)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3, 0]);
    expect([1, 2, 3, 4, 12, 13].map(dayInSeason)).toEqual([0, 1, 2, 0, 2, 0]);
    expect([1, 12, 13].map(yearOf)).toEqual([1, 1, 2]);
    const { a } = newExpedition();
    expect(a.view()).toMatchObject({ day: 1, year: 1, season: 0, yearProgress: 0 });
  });

  it('runs high on the melt for two days, then falls on day three and is low by day four', () => {
    const seed = 2086;
    expect(levelOf(seed, 1)).toBe('high');
    expect(levelOf(seed, 2)).toBe('high');
    expect(trendOf(seed, 2)).toBe('falling');
    expect(tomorrowGuess(seed, 2)).toBe('middle');
    expect(levelOf(seed, 3)).toBe('middle');
    expect(shiftedOn(seed, 3)).toBe(true);
    expect(riverLine(seed, 3, 0)).toBe('The water has fallen. The stones at Old Ford are showing again.');
    expect(levelOf(seed, 4)).toBe('low');
  });

  it('follows the seasons, with rain lifting the water a step for that day and the next', () => {
    for (let seed = 1; seed < 40; seed++) {
      for (let day = 4; day < 40; day++) {
        const level = levelOf(seed, day);
        expect(['low', 'middle', 'high']).toContain(level);
      }
    }
    // Some seed has rain in summer: the level is lifted that day and the day after.
    let checked = false;
    for (let seed = 1; seed < 200 && !checked; seed++) {
      for (let day = 4; day <= 5 && !checked; day++) {
        if (riverLine(seed, day, 0).startsWith('Rain')) {
          expect(levelOf(seed, day)).not.toBe('low');
          checked = true;
        }
      }
    }
    expect(checked).toBe(true);
  });

  it('keeps the painted season in step with the day count, turning only overnight', () => {
    expect(clockTick(2, DAY_SECONDS, TICK)).toBeLessThan(clockTick(3, 0, TICK));
    const { sim, a } = newExpedition();
    expect(sim.season).toBe(0);
    playToMorning(sim);
    expect(a.state.day).toBe(2);
    expect(sim.season).toBe(0);
    playToMorning(sim);
    expect(a.state.day).toBe(3);
    expect(sim.season).toBe(0);
    playToMorning(sim);
    expect(a.state.day).toBe(4); expect(sim.season).toBe(1);
    for (let i = 0; i < 9; i++) playToMorning(sim);
    expect(a.state.day).toBe(13);
    expect(sim.season).toBe(0);
    expect(sim.year).toBe(2);
  });
});

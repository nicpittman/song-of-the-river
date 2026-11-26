import { describe, expect, it } from 'vitest';
import { PlaytestBot } from './bot';
import { DayLog, optionsLog } from './dayLog';
import { newExpedition } from './testing';

describe('a whole journey by ordinary play', () => {
  it('reaches the sea in about three weeks (16 to 26 days) including overnight scouting and chapter travel', () => {
    const { a } = newExpedition();
    const log = new DayLog(a);
    const choices: string[] = [];
    let logging = true;
    const bot = new PlaytestBot(a, 2086, () => {}, {
      morning: () => {
        if (a.state.day <= 10) choices.push(...optionsLog(a));
      },
      planned: () => logging && log.morning(),
      stepped: () => logging && log.step(),
    });
    const arrivals: number[] = [];
    for (let i = 0; i < 45 && a.state.voyage !== 'ended'; i++) {
      const region = a.state.region;
      bot.playDay();
      logging = a.state.day <= 3;
      if (a.state.region !== region) arrivals.push(a.state.day);
    }
    console.log(log.lines.join('\n'));
    console.log(['', 'CHOICES, DAYS 1 TO 10', ...choices].join('\n'));
    console.log(`\nThe bot reached the sea on day ${a.state.day} (Mio on day ${arrivals[0]}, Kawagiri on day ${arrivals[1]}), with ${Object.keys(a.state.discoveries).length} journal entries.`);
    expect(a.state.voyage).toBe('ended');
    expect(arrivals).toHaveLength(2);
    expect(a.state.day).toBeGreaterThanOrEqual(16);
    expect(a.state.day).toBeLessThanOrEqual(26);
  });

  it('gets there on other seeds too, without waiting on rare luck', () => {
    const days: number[] = [];
    const forks: number[] = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      const { a } = newExpedition(seed);
      // The fork each friend met, by day: the same small situation never comes up two days running.
      const met = new Map<number, string>();
      const lastFor = new Map<string, { day: number; text: string }>();
      const bot = new PlaytestBot(a, seed, () => {}, {
        stepped: () => {
          const forked = a.state.phase === 'day' ? a.state.outings.find((o) => o.fork) : undefined;
          if (!forked || met.has(a.state.day)) return;
          met.set(a.state.day, forked.fork!.text);
          const last = lastFor.get(forked.person);
          if (last && last.day >= a.state.day - 1) expect(forked.fork!.text, `seed ${seed}, day ${a.state.day}`).not.toBe(last.text);
          lastFor.set(forked.person, { day: a.state.day, text: forked.fork!.text });
        },
      });
      for (let i = 0; i < 50 && a.state.voyage !== 'ended'; i++) bot.playDay();
      expect(a.state.voyage, `seed ${seed}`).toBe('ended');
      days.push(a.state.day);
      forks.push(met.size);
      // A journey has a good handful of forks, and they are not all the same one.
      expect(new Set(met.values()).size, `seed ${seed}`).toBeGreaterThanOrEqual(Math.min(met.size, 4));
    }
    console.log(`Days to the sea on seeds 1 to 5: ${days.join(', ')}; forks met: ${forks.join(', ')}`);
    expect(Math.max(...days)).toBeLessThanOrEqual(26);
    expect(Math.min(...days)).toBeGreaterThanOrEqual(14);
    expect(forks.reduce((n, f) => n + f, 0) / forks.length).toBeGreaterThanOrEqual(5);
  });
});

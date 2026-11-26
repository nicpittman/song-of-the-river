import { expect, it } from 'vitest';
import { newExpedition } from './testing';
import { PlaytestBot } from './bot';
import { grantedWishes } from './wishes';

it.each([1, 2, 2086])('reaches the sea from a solo mountain start on seed %i', (seed) => {
  const { a } = newExpedition(seed, true);
  const bot = new PlaytestBot(a, seed);
  for (let day = 0; day < 50 && a.state.voyage !== 'ended'; day++) bot.playDay();
  console.log(`Mountain seed ${seed}: sea on day ${a.state.day}; ${a.state.people.map((person) => person.id).join(', ')}; wishes granted: ${grantedWishes(a.state).map((w) => w.person).join(', ') || 'none'}`);
  expect(a.state.voyage).toBe('ended');
  expect(a.state.region).toBe(2);
  expect(a.state.people.map((p) => p.id)).toEqual(expect.arrayContaining(['sora', 'ren', 'mina', 'aki', 'yui']));
  expect(a.state.history.some((report) => report.items?.some((item) => item.title === 'Met Ren'))).toBe(true);
  expect(a.state.history.some((report) => report.items?.some((item) => item.title === 'Met Mina'))).toBe(true);
  expect(a.state.visits.seseragi).toBeGreaterThan(0);
  // The main journey is tuned to about three weeks; optional wishes the bot grants along the way must not slow it.
  expect(a.state.day).toBeLessThanOrEqual(24);
  expect(a.state.day).toBeGreaterThanOrEqual(16);
});

import { describe, expect, it } from 'vitest';
import { PlaytestBot } from './bot';
import { WAY_ROUTES, courseOf, type Course } from './course';
import { newExpedition } from './testing';

/** Each run settles where Ren and Mina are, and its way down from Mio (see course.ts). */
const COURSES: Course[] = [
  { ren: 'kagami', mina: 'kamimori', way: 'herons' },
  { ren: 'taki', mina: 'seseragi', way: 'high-path' },
  { ren: 'fuchi', mina: 'kamimori', way: 'high-path' },
  { ren: 'kagami', mina: 'seseragi', way: 'reeds' },
  { ren: 'taki', mina: 'kamimori', way: 'herons' },
];

describe('a different course each run', () => {
  it('spreads runs across every opening and every way down', () => {
    const courses = Array.from({ length: 200 }, (_, seed) => courseOf(seed));
    for (const key of ['ren', 'mina', 'way'] as const) expect(new Set(courses.map((c) => c[key])).size).toBeGreaterThan(1);
    expect(new Set(courses.map((c) => c.way))).toEqual(new Set(['reeds', 'herons', 'high-path']));
  });

  it.each(COURSES.map((course, i) => [course.ren, course.mina, course.way, i + 11] as const))('reaches the sea with Ren at %s, Mina at %s and the %s way (seed %i)', (ren, mina, way, seed) => {
    const { a } = newExpedition(seed, true, { ren, mina, way });
    const bot = new PlaytestBot(a, seed);
    for (let day = 0; day < 50 && a.state.voyage !== 'ended'; day++) bot.playDay();
    console.log(`Ren at ${ren}, Mina at ${mina}, ${way}: sea on day ${a.state.day}`);
    expect(a.state.voyage).toBe('ended');
    // The route actually surveyed wins; the seeded preference never invalidates an alternative.
    expect(a.state.discoveries[WAY_ROUTES[a.state.course.way].find]).toBeTruthy();
    expect(a.state.day).toBeLessThanOrEqual(30);
  });
});

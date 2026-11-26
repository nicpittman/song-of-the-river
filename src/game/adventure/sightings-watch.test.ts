import { describe, expect, it } from 'vitest';
import { dist } from '../core/math';
import { stanceOf } from './scene';
import { scheduleSightings, watchedPerson } from './sightings';
import { newExpedition, plan } from './testing';
import type { Sighting } from './state';
import type { ExpeditionAdventure } from './expedition';

/** Sightings that show within a phone's view of `person` at the moment they appear. */
function byFriend(a: ExpeditionAdventure, person: string | string[], sightings: Sighting[]): number {
  const people = typeof person === 'string' ? [person] : person;
  const elapsed = a.state.elapsed;
  let n = 0;
  for (const s of sightings) {
    a.state.elapsed = s.appear + 1;
    if (people.some((p) => dist(stanceOf(a, p).at, s.at) < 260)) n++;
  }
  a.state.elapsed = elapsed;
  return n;
}

describe('creatures on a narrow screen', () => {
  it('show by the friend the view keeps to, the same way every time, and leave a wide screen as it was', () => {
    // For each friend in turn: creatures near them with the view on them, with no hint, and with the view on the other.
    const near = { watched: 0, wide: 0, other: 0 };
    // And creatures near anyone out, which a phone that holds the whole day's routes sees too.
    const anyone = { phone: 0, wide: 0 };
    for (const seed of [1, 2, 7, 2086, 4242]) for (const day of [1, 3, 5, 8]) {
      const { a } = newExpedition(seed);
      a.state.day = day;
      a.assign(plan('sora', 'kamimori', 'track'));
      a.assign(plan('ren', 'suisha', 'explore'));
      expect(a.begin().ok).toBe(true);
      const w = a.world();
      // No hint is the wide screen: today's creatures are exactly as the day began with them.
      expect(scheduleSightings(w, null)).toEqual(a.state.sightings);
      for (const [person, other] of [['sora', 'ren'], ['ren', 'sora']] as const) {
        const watched = scheduleSightings(w, { person });
        expect(scheduleSightings(w, { person })).toEqual(watched);
        // As many creatures as on a wide screen, give or take one that found no clear moment.
        expect(watched.length).toBeGreaterThanOrEqual(a.state.sightings.length - 1);
        near.watched += byFriend(a, person, watched);
        near.wide += byFriend(a, person, a.state.sightings);
        near.other += byFriend(a, person, scheduleSightings(w, { person: other }));
        anyone.phone += byFriend(a, ['sora', 'ren'], watched);
        anyone.wide += byFriend(a, ['sora', 'ren'], a.state.sightings);
      }
    }
    expect(near.watched).toBeGreaterThan(near.wide * 1.2);
    expect(near.watched).toBeGreaterThan(near.other * 1.3);
    expect(anyone.phone).toBeGreaterThan(anyone.wide * 1.1);
  });

  it('keeps to the hinted friend when they are out, and otherwise to the first friend out', () => {
    const { a } = newExpedition();
    a.assign(plan('sora', 'kamimori', 'track'));
    a.assign(plan('ren', 'suisha', 'explore'));
    a.begin();
    expect(watchedPerson(a.state, null)).toBeNull();
    expect(watchedPerson(a.state, { person: 'ren' })).toBe('ren');
    expect(watchedPerson(a.state, { person: null })).toBe(a.state.outings[0]!.person);
    expect(watchedPerson(a.state, { person: 'nobody' })).toBe(a.state.outings[0]!.person);
  });
});

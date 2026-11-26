import { expect, it } from 'vitest';
import { dist } from '../core/math';
import { DAY_SECONDS } from './calendar';
import { GOT_AWAY, SKETCHED } from './evening';
import { FIRST_SIGHTING_LIFE, RARE_SIGHTING_LIFE, SIGHTING_LIFE } from './sightings';
import { newExpedition, plan, runUntil } from './testing';
import { stanceOf } from './scene';
import { findDef, placeDef } from './content';

it('leaves nearby meetings clear for their whole conversation instead of competing for a tap', () => {
  const { a } = newExpedition();
  expect(a.assign(plan('sora', 'suisha', 'visit')).ok).toBe(true);
  a.begin();
  const talk = a.state.outings.find(o => o.person === 'sora')!.legs.filter(leg => leg.kind === 'beat' && leg.at);
  expect(talk.length).toBeGreaterThan(0);
  expect(a.state.sightings.length).toBeGreaterThan(0);
  for (const sighting of a.state.sightings) for (const leg of talk) {
    if (dist(sighting.at, leg.at!) >= 550) continue;
    expect(sighting.appear + sighting.life <= leg.start || sighting.appear >= leg.end).toBe(true);
  }
});

it('shows each creature where a friend is passing, so it is in view when it comes', () => {
  let near = 0, all = 0;
  for (const seed of [1, 2, 3, 2086]) {
    const { a } = newExpedition(seed);
    // Each friend sets out somewhere different that can be planned today.
    const taken = new Set<string>();
    for (const person of a.state.people) {
      for (const place of a.state.known) {
        if (taken.has(place) || placeDef(place).kind === 'settlement') continue;
        if (a.assign(plan(person.id, place, 'explore')).ok) { taken.add(place); break; }
      }
    }
    expect(a.state.plans.length).toBeGreaterThan(0);
    expect(a.begin().ok).toBe(true);
    const sightings = [...a.state.sightings];
    expect(sightings.length).toBeGreaterThanOrEqual(3);
    for (const sighting of sightings) {
      all++;
      expect(sighting.appear + sighting.life).toBeLessThanOrEqual(DAY_SECONDS);
      a.state.elapsed = sighting.appear + 1;
      const closest = Math.min(...a.state.people.map((p) => dist(stanceOf(a, p.id).at, sighting.at)));
      if (closest < 700) near++;
    }
    // Two creatures never arrive on top of each other.
    const times = sightings.map((x) => x.appear).sort((x, y) => x - y);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(4.4);
  }
  expect(near / all).toBeGreaterThan(0.6);
});

it('lets the first creature linger until something has been sketched, and keeps a rare one brief', () => {
  const { a } = newExpedition();
  a.rest('sora'); a.begin();
  const lingering = a.state.sightings.filter((x) => x.life > SIGHTING_LIFE);
  expect(lingering).toHaveLength(1);
  expect(lingering[0]!.life).toBeLessThanOrEqual(FIRST_SIGHTING_LIFE);
  for (const s of a.state.sightings) if (s !== lingering[0]) expect([SIGHTING_LIFE, RARE_SIGHTING_LIFE]).toContain(s.life);
  for (const s of a.state.sightings) if (s !== lingering[0] && findDef(s.find).rare) expect(s.life).toBe(RARE_SIGHTING_LIFE);
  const later = newExpedition().a;
  later.state.discoveries.heron = { day: 1, by: 'sketch' };
  later.rest('sora'); later.begin();
  expect(later.state.sightings.every((x) => x.life <= SIGHTING_LIFE)).toBe(true);
});

it('tells the player what they sketched, remembers one that got away, and brings it back first', () => {
  const { sim, a } = newExpedition();
  a.rest('sora'); a.begin();
  const [caught, ...rest] = a.state.sightings;
  runUntil(sim, () => a.state.elapsed >= caught!.appear + 0.5);
  expect(a.sketch(caught!.id).ok).toBe(true);
  const missed = rest.find((s) => !a.state.discoveries[s.find]);
  runUntil(sim, () => a.view().eveningReady);
  const items = a.state.evening!.items;
  expect(items.some((i) => i.title === `${SKETCHED}${findDef(caught!.find).name}`)).toBe(true);
  if (missed) {
    const away = items.find((i) => i.title === GOT_AWAY)!;
    expect(away).toBeDefined();
    expect(a.state.tracked.length).toBe(1);
    expect(away.text).toContain(findDef(a.state.tracked[0]!).sighting!.line);
  }
});

import { describe, expect, it } from 'vitest';
import { Simulation, newGameState } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { ALMANAC_FINDS, almanacAims, freeAims, possibleThisSeason, writeAlmanac, yearIndex } from './aims';
import { DAYS_PER_SEASON, seasonOf } from './calendar';
import { findPossible } from './conditions';
import { FINDS, LEADS, PLACES, findDef, placeDef } from './content';
import { BEYOND, FREE_PLAY_START, frontierOf, rumourOf } from './discovery';
import { FREE_PLAY_FINDS, SECRET_PLACES, isSecretPlace } from './places/freeplay';
import { newAdventure } from './state';
import { newExpedition, plan, playToMorning } from './testing';
import { reachPlaces, secretsDue, wanderings } from './wanderings';
import { meetingWords } from './narrative';
import { holds, todayOf } from './world';
import { reviewGame } from './review';
import { WalkingMap } from './navigation';
import { openGround } from './conditions';
import { campOf } from './regions';

function freePlay(seed = 2086) {
  const state = newGameState(adventureValley, 'free', seed);
  state.adventure = newAdventure(true);
  const sim = new Simulation(adventureValley, state);
  return { sim, a: sim.expedition! };
}

describe('Free Play', () => {
  it('sets out with Haru and Yui at Mio, in fog: a few places known, and rumours up and down the river', () => {
    const { a } = freePlay();
    const s = a.state;
    expect(s.people.map((p) => p.id)).toEqual(['haru', 'yui']);
    expect(s.people.every((p) => p.base === 1 && p.lodging === undefined)).toBe(true);
    expect(s.known.length).toBeLessThan(10);
    for (const region of [0, 1, 2]) expect(s.rumoured.some((id) => placeDef(id).region === region), `rumours in reach ${region}`).toBe(true);
    expect(s.known.filter(isSecretPlace)).toEqual([]);
    // Every reach is open, and camp can move to any village in a day.
    for (const village of ['seseragi', 'kawagiri']) expect(a.view().forecast(plan('yui', village, 'visit')).problem, village).toBeNull();
    expect(s.notes[0]!.text).toMatch(/Haru/);
  });

  it('can find every ordinary place by going: rumours lead on from the first map to the whole river', () => {
    const reached = new Set<string>([...FREE_PLAY_START.known, ...FREE_PLAY_START.heard]);
    const reveals = (id: string): string[] => [
      ...(BEYOND[id] ?? []),
      ...placeDef(id).learn.flatMap((l) => l.hearsOf ?? []),
      ...FINDS.filter((f) => f.at?.includes(id)).flatMap((f) => f.reveals ?? []),
      ...LEADS.filter((l) => l.from.includes(id)).map((l) => l.to),
      // Moving camp to Kawagiri shows its shore.
      ...(id === 'kawagiri' ? ['funaya', 'takayuka', 'far-shore', 'kawaguchi', 'todai', 'fish-traps', 'east-marsh'] : []),
    ];
    for (let grew = true; grew;) {
      grew = false;
      for (const id of [...reached]) for (const next of reveals(id)) if (!reached.has(next)) { reached.add(next); grew = true; }
    }
    expect(PLACES.filter((p) => !isSecretPlace(p.id) && !reached.has(p.id)).map((p) => p.id)).toEqual([]);
  });

  it('meets Sora at his hut, who keeps to his own journey, and Ren where he fishes, who joins with his own home', () => {
    const { sim, a } = freePlay();
    const s = a.state;
    s.people.find((p) => p.id === 'haru')!.base = 0;
    s.people.find((p) => p.id === 'yui')!.base = 0;
    s.known.push('yamagoya', 'fuchi');
    s.provisions = 30;
    expect(a.assign(plan('haru', 'yamagoya', 'explore'))).toEqual({ ok: true });
    expect(a.assign(plan('yui', 'fuchi', 'explore'))).toEqual({ ok: true });
    a.begin();
    expect(s.outings.flatMap((o) => o.bundles)).toEqual(expect.arrayContaining([{ kind: 'find', find: 'sora-meeting' }, { kind: 'find', find: 'ren-meeting' }]));
    playToMorning(sim);
    expect(s.people.map((p) => p.id)).toContain('ren');
    expect(s.people.some((p) => p.id === 'sora')).toBe(false);
    const sora = a.view().journal.find((e) => e.id === 'sora-meeting')!;
    expect(sora.found).toBe(true);
    expect(sora.conversation?.[0]?.speaker).toBe('Haru');
    expect(a.view().journal.find((e) => e.id === 'ren-meeting')!.text).toMatch(/coast/);
  });

  it('never offers Sora’s meeting or the secret places in a Journey', () => {
    const { a } = newExpedition(7, true);
    const today = todayOf(7, 1);
    expect(findPossible(findDef('sora-meeting'), placeDef('yamagoya'), 'visit', today, a.state)).toBe(false);
    expect(a.view().journal.some((e) => FREE_PLAY_FINDS.has(e.id))).toBe(false);
    a.state.known.push(...reachPlaces(0));
    expect(secretsDue(a.state)).toEqual([]);
    expect(frontierOf(0, a.state.known, [])).toEqual({ upstream: 0, across: 0, downstream: 0 });
  });

  it('shows a reach’s secret place by the fire once every other place in it is found', () => {
    const { sim, a } = freePlay();
    const s = a.state;
    for (const id of reachPlaces(1)) if (!s.known.includes(id)) s.known.push(id);
    s.rumoured = s.rumoured.filter((id) => !s.known.includes(id));
    expect(secretsDue(s)).toEqual(['iori']);
    playToMorning(sim);
    expect(s.known).toContain('iori');
    expect(s.history[0]!.items!.some((i) => i.title === 'A bell in the western wood')).toBe(true);
    expect(s.known).not.toContain(SECRET_PLACES[0]);
    expect(wanderings(s).find((w) => w.id === 'reach-mio')).toMatchObject({ done: true, note: expect.stringContaining('Iori') });
  });

  it('can walk to every secret place from its village, and work there and back in a day', () => {
    const { a, sim } = freePlay();
    const s = a.state;
    const nav = new WalkingMap(sim.board, sim.river);
    nav.setOpenGround(openGround(sim.board, todayOf(2086, 1), s));
    for (const [region, id] of Object.entries(SECRET_PLACES)) {
      expect(nav.route(campOf(Number(region)).fire, placeDef(id).at, 6800), id).not.toBeNull();
      s.known.push(id);
      s.people.find((p) => p.id === 'yui')!.base = Number(region);
      expect(a.view().forecast(plan('yui', id, 'explore')).problem, id).toBeNull();
    }
  });

  it('counts the wanderings: places found per reach, friends met, pages, moments, works and the sea', () => {
    const { a } = freePlay();
    const s = a.state;
    const count = (id: string) => wanderings(s).find((w) => w.id === id)!;
    expect(count('friends')).toMatchObject({ found: 2, total: 6, progress: 'two of six', done: false });
    expect(count('reach-mio')).toMatchObject({ found: 4, total: reachPlaces(1).length });
    expect(count('moments')).toMatchObject({ found: 0, total: 3, progress: 'none of three' });
    expect(count('sea').progress).toBe('not yet');
    s.discoveries['stubble-cranes'] = { day: 1, by: 'sketch' };
    s.people.push({ id: 'aki', base: 1, practice: {}, memories: [] });
    s.buildings.push({ id: 9, kind: 'platform', x: 600, y: 3300, region: 1, work: 99, placed: 1 });
    s.sailed = true;
    expect(count('moments').found).toBe(1);
    expect(count('friends').progress).toBe('three of six');
    expect(count('built')).toMatchObject({ found: 1, progress: 'one of three' });
    expect(count('sea')).toMatchObject({ done: true, progress: 'sailed' });
    expect(count('reach-seseragi').progress).toMatch(/^\d+ of 27$/);
  });

  it('writes a year’s almanac, a couple of things a season, each of the seasons still to come, and a new one each year', () => {
    for (const seed of [7, 11, 2086]) {
      const { sim, a } = freePlay(seed);
      const s = a.state;
      s.provisions = 99;
      let last: string[] = [];
      for (let year = 0; year < 2; year++) {
        expect(s.almanac.year).toBe(yearIndex(s.day));
        expect(s.almanac.finds.length, `seed ${seed}, year ${year}`).toBeGreaterThanOrEqual(5);
        expect(s.almanac.finds.length).toBeLessThanOrEqual(9);
        expect(s.almanac.finds).not.toEqual(last);
        expect(s.almanac.seasons.length).toBe(s.almanac.finds.length);
        for (const [i, id] of s.almanac.finds.entries()) {
          expect(ALMANAC_FINDS).toContain(id);
          expect(s.almanac.seasons[i]! >= 0 || id.endsWith('-meeting')).toBe(true);
        }
        // What is in season now comes first.
        const aims = almanacAims(s);
        expect(aims.every((aim) => /^[A-Z].*\.$/.test(aim.line))).toBe(true);
        const firstLater = aims.findIndex((aim) => aim.season !== undefined && aim.season !== seasonOf(s.day));
        if (firstLater >= 0) expect(aims.slice(firstLater).some((aim) => aim.season === undefined && !aim.done)).toBe(false);
        // Each season's things are possible in their season: check this one's now.
        for (const [i, id] of s.almanac.finds.entries()) if (s.almanac.seasons[i] === seasonOf(s.day)) expect(possibleThisSeason(findDef(id), a.world()), id).toBe(true);
        last = [...s.almanac.finds];
        for (let d = 0; d < DAYS_PER_SEASON * 4; d++) playToMorning(sim);
      }
    }
  });

  it('keeps almanac discoveries in the permanent journal when next year brings different suggestions', () => {
    const { a } = freePlay();
    const s = a.state;
    const id = s.almanac.finds.find((f) => !f.endsWith('-meeting'))!;
    s.discoveries[id] = { day: 1, by: 'yui' };
    const aim = almanacAims(s).find((x) => x.done)!;
    expect(aim.done).toBe(true);
    expect(aim.place).toBeUndefined();
    writeAlmanac(a.world());
    expect(s.almanac.finds).toContain(id);
    // The morning line stays a suggestion, never an order.
    expect(a.view().goal).not.toMatch(/must|need to|go to/i);
    s.day += DAYS_PER_SEASON * 4;
    writeAlmanac(a.world());
    expect(s.almanac.finds).not.toContain(id);
    expect(a.view().journal.find(entry => entry.id === id)?.found).toBe(true);
    const resumed = new Simulation(adventureValley, structuredClone(a.sim.state));
    expect(resumed.expedition!.view().journal.find(entry => entry.id === id)?.found).toBe(true);
  });

  it('keeps a missed season’s observation open rather than calling the almanac complete', () => {
    const { a } = freePlay();
    a.state.day = 10;
    a.state.almanac = { year: 0, finds: ['orchard-blossom'], seasons: [0] };
    expect(freeAims(a.state)[0]).toMatchObject({ done: false, line: expect.stringContaining('In spring:') });
    a.state.discoveries['orchard-blossom'] = { day: 10, by: 'haru' };
    expect(freeAims(a.state)[0]!.line).toContain('Everything in this year’s almanac is seen');
  });

  it('is quieter than a Journey: fewer spoken lines on the same days, and short meetings', () => {
    const spoken = (free: boolean): number => {
      let lines = 0;
      for (const seed of [7, 11, 99, 2086]) {
        const { sim, a } = newExpedition(seed);
        a.state.free = free;
        a.state.provisions = 99;
        for (let day = 0; day < 9; day++) {
          a.assign(plan('ren', 'fuchi', 'fish'));
          a.assign(plan('mina', 'kamimori', 'forage'));
          a.assign(plan('sora', 'kamimori', 'explore'));
          a.begin();
          lines += a.state.outings.flatMap((o) => o.legs).filter((l) => l.text?.startsWith('“')).length;
          playToMorning(sim);
        }
      }
      return lines;
    };
    const journey = spoken(false);
    expect(journey).toBeGreaterThan(6);
    expect(spoken(true)).toBeLessThan(journey * 0.6);
    for (const person of ['sora', 'ren', 'mina', 'aki', 'miller', 'boatyard-moulds']) expect(meetingWords(person, 'haru', true)!.length, person).toBeLessThanOrEqual(2);
  });
});

describe('Free Play, after a playthrough', () => {
  it('can send one friend to Kawagiri while another stays near Mio, and the day begins', () => {
    const { a } = freePlay();
    const s = a.state;
    s.people.push({ id: 'aki', base: 1, practice: {}, memories: [] });
    expect(a.assign(plan('yui', 'ringozaka', 'visit'))).toEqual({ ok: true });
    expect(a.assign(plan('aki', 'shirasagi', 'explore'))).toEqual({ ok: true });
    expect(s.plans.map((p) => p.person).sort()).toEqual(['aki', 'yui']);
    expect(a.cancelPlan('aki')).toEqual({ ok: true });
    expect(s.plans.map((p) => p.person)).toEqual(['yui']);
    expect(a.assign(plan('aki', 'shirasagi', 'explore'))).toEqual({ ok: true });
    expect(a.begin()).toEqual({ ok: true });
    // The plan line on the map runs to the place itself, not to Kawagiri's fire.
    expect(a.view().route('aki', 'shirasagi').at(-1)).toEqual(placeDef('shirasagi').at);
  });

  it('shows one secret place an evening, even when every reach is known at once', () => {
    const { a } = freePlay();
    const s = a.state;
    for (const region of [0, 1, 2]) for (const id of reachPlaces(region)) if (!s.known.includes(id)) s.known.push(id);
    expect(secretsDue(s)).toEqual(['yunotani']);
    s.known.push('yunotani');
    expect(secretsDue(s)).toEqual(['iori']);
  });

  it('keeps Journey-only words out: Aki’s promise at the inn, and Sora at the first sight of the sea', () => {
    const { a } = freePlay();
    const promise = placeDef('toroya').learn.find((l) => /won’t leave Mio/.test(l.text))!;
    expect(holds(promise.when, todayOf(2086, 1), a.state)).toBe(false);
    expect(holds(promise.when, todayOf(2086, 1), { ...a.state, free: false })).toBe(true);
    expect(a.view().journal.find((e) => e.id === 'first-sea')!.text).toBeNull();
    a.state.discoveries['first-sea'] = { day: 1, by: 'haru' };
    expect(a.view().journal.find((e) => e.id === 'first-sea')!.text).not.toMatch(/Sora/);
  });

  it('keeps alternative routes in both the Wander and Journey journals', () => {
    const { a } = freePlay();
    const ids = a.view().journal.map((e) => e.id);
    expect(ids).toContain('sora-meeting');
    expect(ids).toContain('heron-way');
    expect(ids).toContain('high-path');
    for (const id of ['reed-way', 'heron-way', 'high-path']) {
      const find = findDef(id), place = placeDef(find.at![0]!);
      expect(findPossible(find, place, 'explore', { ...todayOf(2086, 1), level: 'low', weather: 'clear' }, a.state), id).toBe(true);
    }
    const journey = newExpedition(7).a;
    expect(journey.view().journal.map(e => e.id)).toContain('high-path');
    expect(journey.view().journal.map(e => e.id)).toContain('heron-way');
  });

  it('lets Yui’s mended sail be found, since she sets out with us', () => {
    const { a } = freePlay();
    const today = todayOf(2086, 1);
    expect(findPossible(findDef('mended-sail'), placeDef('takayuka'), 'visit', today, a.state)).toBe(true);
    a.state.people = a.state.people.filter((p) => p.id !== 'yui');
    expect(findPossible(findDef('mended-sail'), placeDef('takayuka'), 'visit', today, a.state)).toBe(false);
  });

  it('names Aki’s roof by its village once camp has moved away from Mio', () => {
    const { a } = freePlay();
    const s = a.state;
    s.almanac = { year: 0, finds: ['aki-meeting'], seasons: [-1] };
    expect(almanacAims(s)[0]!.line).toMatch(/just along from camp/);
    for (const p of s.people) p.base = 2;
    expect(almanacAims(s)[0]!.line).toBe('Someone is hammering on the inn roof at Toroya, in Mio.');
  });

  it('says something of every place that can be heard of before it is found', () => {
    const heard = new Set([...FREE_PLAY_START.heard, ...Object.values(BEYOND).flat()]);
    expect([...heard].filter((id) => rumourOf(id) === 'A way on, not yet found.')).toEqual([]);
  });

  it('keeps Sora out of the group in the full-map review, met but on his own journey', () => {
    const s = reviewGame('full-map').adventure!;
    expect(s.free).toBe(true);
    expect(s.people.some((p) => p.id === 'sora')).toBe(false);
    expect(s.discoveries['sora-meeting']).toBeDefined();
    expect(wanderings(s).find((w) => w.id === 'friends')).toMatchObject({ done: true });
  });
});

it('tells the journal, once, that Wander is open when a Journey that opens it first reaches Mio', async () => {
  const { newExpedition } = await import('./testing');
  const { dusk, WANDER_OPEN } = await import('./evening');
  const { a } = newExpedition(7);
  a.state.opensWander = true;
  a.state.region = 1;
  const first = dusk(a.world(), { arrived: true });
  expect(first.items.some((i) => i.title === WANDER_OPEN && /Wander is on the menu now/.test(i.text) && !/Haru|Yui/.test(i.text))).toBe(true);
  expect(a.state.opensWander).toBe(false);
  const again = dusk(a.world(), { arrived: true });
  expect(again.items.some((i) => i.title === WANDER_OPEN)).toBe(false);
});

it('lets Wander call at Yamagoya, Sora’s hut, but not a Journey', async () => {
  const { assess } = await import('./odds');
  const { newExpedition } = await import('./testing');
  const { a } = freePlay();
  a.state.known.push('yamagoya');
  const call = { person: 'haru', place: 'yamagoya', activity: 'visit' as const, item: null, companion: null };
  expect(assess(a.world(), call).problem ?? null).not.toMatch(/Nobody can visit/);
  expect(a.view().places.find((p) => p.id === 'yamagoya')!.activities).toContain('visit');
  const journey = newExpedition(7).a;
  journey.state.known.push('yamagoya');
  expect(journey.view().places.find((p) => p.id === 'yamagoya')!.activities).not.toContain('visit');
});

it('points the almanac at one missing page once a reach is nearly filled, in Wander only', () => {
  const state = newGameState(adventureValley, 'free', 2086); state.adventure = newAdventure(true);
  const s = state.adventure;
  const reach = FINDS.filter((f) => f.region === 1);
  const hinted = reach.filter((f) => f.hint && !f.id.endsWith('-meeting'));
  expect(almanacAims(s).some((a) => a.line.startsWith('Still to find near Mio'))).toBe(false);
  const keep = new Set(hinted.slice(0, 3).map((f) => f.id));
  for (const f of reach) if (!keep.has(f.id)) s.discoveries[f.id] = { day: 1, by: 'haru' };
  const last = almanacAims(s).filter((a) => a.line.startsWith('Still to find near Mio'));
  expect(last).toHaveLength(1);
  expect(hinted.some((f) => keep.has(f.id) && last[0]!.line.endsWith(f.hint!))).toBe(true);
  const journey = newExpedition(2086).a.state;
  for (const f of reach) journey.discoveries[f.id] = { day: 1, by: 'sora' };
  expect(almanacAims(journey).some((a) => a.line.startsWith('Still to find'))).toBe(false);
});

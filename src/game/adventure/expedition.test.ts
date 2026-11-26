import { structureDef } from './structures';
import { describe, expect, it } from 'vitest';
import { Simulation, newGameState } from '../simulation/simulation';
import { SETS } from './collections';
import { voyageStops } from './finale';
import { newAdventure } from './state';
import { isSecretPlace } from './places/freeplay';
import { adventureValley } from '../world/boards/adventure';
import { DAY_SECONDS } from './calendar';
import { findPossible, placeToday } from './conditions';
import { FINDS, LEADS, PLACES, findDef, placeDef } from './content';
import { HOME_BY } from './odds';
import { gateOpen, readyToMove } from './progression';
import { campOf } from './regions';
import { newExpedition as freshExpedition, plan, playToMorning, runUntil } from './testing';
import { WalkingMap } from './navigation';
import { openGround } from './conditions';
import { todayOf } from './world';
import type { ExpeditionAdventure } from './expedition';
import type { StructureKind } from './model';

// These focused rules tests use an already charted opening reach. Fresh-map
// progression and the first five mornings are covered in gameplay.test.ts.
function newExpedition(seed?: number): ReturnType<typeof freshExpedition> {
  const game = freshExpedition(seed);
  game.a.state.known = PLACES.filter((p) => p.region === 0).map((p) => p.id);
  game.a.state.rumoured = [];
  return game;
}

const reasonsOf = (texts: Array<{ sign: string; text: string }>): string[] => texts.map((r) => `${r.sign} ${r.text}`);

/** The first spot near home where a building or planting may go. */
function openSite(a: ExpeditionAdventure, kind: StructureKind): { x: number; y: number } {
  const fire = campOf(a.state.region).fire;
  for (let r = 100; r < 900; r += 40) {
    for (let k = 0; k < 16; k++) {
      const at = { x: Math.round(fire.x + Math.cos(k / 2.55) * r), y: Math.round(fire.y + Math.sin(k / 2.55) * r) };
      if (!a.siteProblem(kind, at)) return at;
    }
  }
  throw new Error(`No site for ${kind}`);
}

describe('the daily loop', () => {
  it('starts with one outing and keeps everyone else at home automatically', () => {
    const { sim, a } = newExpedition();
    expect(a.state.phase).toBe('morning');
    expect(a.view().nextStep).toBe('Choose a place to visit, or take a day at camp.');
    expect(a.begin().ok).toBe(false);
    expect(a.assign(plan('ren', 'fuchi', 'fish'))).toEqual({ ok: true });
    expect(a.view().nextStep).toBe('Sora and Mina stay home unless assigned an outing.');
    const tick = sim.state.tick;
    for (let i = 0; i < 50; i++) sim.step();
    expect(sim.state.tick).toBe(tick);
    expect(a.begin()).toEqual({ ok: true });
    expect(a.state.phase).toBe('day');
    expect(a.state.outings.map((outing) => outing.person)).toEqual(['ren']);
    expect(a.state.resting).toEqual(['sora', 'mina']);
    expect(a.view().friends.filter((person) => person.status === 'resting').map((person) => person.id)).toEqual(['sora', 'mina']);
    const copy = new Simulation(adventureValley, JSON.parse(JSON.stringify(sim.state)));
    expect(copy.expedition!.state).toEqual(a.state);
    expect(a.assign(plan('mina', 'kamimori', 'forage')).ok).toBe(false);
  });

  it('lets a single camp choice start a work day without sending anyone out', () => {
    const { sim, a } = newExpedition();
    a.state.materials = 4;
    expect(a.place('lookout', { x: 320, y: 2040 }).ok).toBe(true);
    a.rest('mina');
    expect(a.begin().ok).toBe(true);
    expect(new Set(a.state.resting)).toEqual(new Set(['sora', 'ren', 'mina']));
    expect(a.state.outings).toEqual([]);
    runUntil(sim, () => a.state.phase === 'evening');
    expect(a.view().structures.find((structure) => structure.id === 'lookout')!.status).toBe('built');
  });

  it('does not change camp assignments or spend provisions if an outing becomes invalid before beginning', () => {
    const { a } = newExpedition();
    expect(a.assign(plan('sora', 'takaishi', 'explore')).ok).toBe(false);
    a.state.day = 3;
    expect(a.assign(plan('sora', 'takaishi', 'explore')).ok).toBe(true);
    a.state.day = 1;
    const before = structuredClone(a.state);
    expect(a.begin().ok).toBe(false);
    expect(a.state).toEqual(before);
  });

  it('holds the evening journal, then turns directly to the next morning with overnight changes', () => {
    const { sim, a } = newExpedition();
    a.assign(plan('ren', 'fuchi', 'fish'));
    a.assign(plan('mina', 'kamimori', 'forage'));
    a.assign(plan('sora', 'sagi', 'explore'));
    a.begin();
    runUntil(sim, () => a.state.phase !== 'day');
    expect(a.state.phase).toBe('evening');
    expect(a.scene().hour).toBeGreaterThanOrEqual(18);
    runUntil(sim, () => a.view().eveningReady);
    for (let i=0;i<1200;i++) sim.step();
    expect(a.state.phase).toBe('evening');
    expect(a.nextMorning()).toEqual({ok:true});
    expect(a.state.phase).toBe('morning');
    expect(a.state.day).toBe(2);
    const morning = a.view().morning!;
    expect(morning.weather).toBe('Mist on the water.');
    expect(morning.leads.length).toBeGreaterThan(0);
  });

  it('brings everyone home before dusk, and the friends move even while the morning waits', () => {
    const { sim, a } = newExpedition();
    const before = a.scene().figures.map((f) => ({ ...f.at }));
    for (let i = 0; i < 40; i++) sim.step();
    const after = a.scene().figures.map((f) => f.at);
    expect(after.some((p, i) => p.x !== before[i]!.x || p.y !== before[i]!.y)).toBe(true);
    a.assign(plan('sora', 'furumichi', 'explore'));
    a.assign(plan('ren', 'fuchi', 'fish'));
    a.assign(plan('mina', 'kamimori', 'forage'));
    a.begin();
    for (const outing of a.state.outings) {
      const beats = outing.legs.filter((l) => l.kind === 'beat' && !l.fork).length;
      expect(beats).toBeGreaterThanOrEqual(1);
      expect(beats).toBeLessThanOrEqual(3);
      expect(outing.legs[outing.legs.length - 1]!.end).toBeLessThanOrEqual(DAY_SECONDS);
    }
  });
});

describe('places and the river', () => {
  it('closes Hanano, Hazama and Ukishima Shrine at high water on days 1 and 2 and opens them on day 3', () => {
    const { a } = newExpedition();
    for (const id of ['hanano', 'ukishima']) {
      for (const day of [1, 2]) expect(placeToday(placeDef(id), todayOf(2086, day), a.state).state, `${id} day ${day}`).toBe('closed');
      expect(placeToday(placeDef(id), todayOf(2086, 3), a.state).state, `${id} day 3`).not.toBe('closed');
    }
    expect(placeToday(placeDef('hazama'), todayOf(2086, 1), a.state).line).toBe('Spray fills the lower path. Look for older steps when the water falls.');
    expect(placeToday(placeDef('hazama'), todayOf(2086, 3), a.state).state).toBe('open');
    expect(placeToday(placeDef('koishihama'), todayOf(2086, 3), a.state).state).toBe('closed');
    expect(placeToday(placeDef('koishihama'), todayOf(2086, 4), a.state).state).toBe('open');
    // Day 1: Hanano is on the map, visibly shut.
    expect(a.view().places.find((p) => p.id === 'hanano')?.state).toBe('closed');
    // A legacy settlement move to one's current camp is still rejected; visits are explicit.
    const home = a.view().places.find((p) => p.id === 'seseragi')!;
    expect(home.home).toBe(true);
    expect(home.activities).toEqual(['visit']);
    expect(home.visits).toBeGreaterThan(0);
    expect(a.view().forecast(plan('sora', 'seseragi', 'visit')).problem).toBe('That is home.');
  });

  it('can walk to every place at the levels it is open, and never through the water', () => {
    const { sim, a } = newExpedition();
    const nav = new WalkingMap(sim.board, sim.river);
    for (const day of [1, 3, 4]) {
      const today = todayOf(2086, day);
      nav.setOpenGround(openGround(sim.board, today, a.state));
      for (const place of PLACES.filter((p) => !p.crossing || p.crossing !== 'mio-bridge')) {
        if (placeToday(place, today, a.state).state === 'closed') continue;
        const route = nav.route(campOf(place.region).fire, place.at, 6800);
        expect(route, `${place.id} on day ${day}`).not.toBeNull();
      }
    }
  });

  it('gives every place a proper name, a note, something to find or learn, and no em dashes anywhere', () => {
    for (const place of PLACES) {
      expect(place.learn.length, place.id).toBeGreaterThanOrEqual(2);
      // Home is not somewhere to send anyone, so it has nothing to find.
      if (place.kind === 'settlement') continue;
      expect(FINDS.some((f) => f.at?.includes(place.id)), place.id).toBe(true);
    }
    expect(PLACES.filter((p) => p.region === 0).length).toBeGreaterThanOrEqual(12);
    expect(PLACES.filter((p) => p.region === 1).length).toBeGreaterThanOrEqual(8);
    expect(PLACES.filter((p) => p.region === 2).length).toBeGreaterThanOrEqual(8);
    const text = JSON.stringify([PLACES, FINDS, LEADS]);
    expect(text).not.toMatch(/—/);
    expect(text.toLowerCase()).not.toMatch(/unlock|shift/);
  });
});

describe('the forecast', () => {
  it('names its reasons, strongest first, and never changes anything', () => {
    const { a } = newExpedition();
    const before = JSON.stringify(a.state);
    const ren = a.view().forecast(plan('ren', 'fuchi', 'fish'));
    expect(ren.problem).toBeNull();
    expect(ren.chance).toBe('likely');
    expect(ren.pips).toBe(3);
    expect(reasonsOf(ren.reasons)).toEqual(['+ Usually three provisions', '+ Ren knows this water', '+ Salmon running on the melt']);
    const sora = a.view().forecast(plan('sora', 'fuchi', 'fish'));
    expect(sora.chance).toBe('even');
    const closed = a.view().forecast(plan('sora', 'hanano', 'explore'));
    expect(closed.problem).toContain('Old Ford is flooded');
    expect(JSON.stringify(a.state)).toBe(before);
  });

  it('counts the cape in the rain, a companion, the right item and practice', () => {
    const { a } = newExpedition();
    a.state.provisions = 20; a.state.materials = 20;
    a.craft('fishing-kit');
    const kit = a.view().forecast(plan('ren', 'fuchi', 'fish', 'fishing-kit', 'mina'));
    expect(reasonsOf(kit.reasons)).toContain('+ The fishing kit');
    expect(reasonsOf(kit.reasons)).toContain('+ Mina along for the walk');
    a.state.people.find((p) => p.id === 'sora')!.practice.explore = 3;
    expect(reasonsOf(a.view().forecast(plan('sora', 'kamimori', 'explore')).reasons)).toContain('+ Practised at exploring');
    // A rainy day in a later season.
    let day = 4;
    while (a.world(day).today.weather !== 'rain') day++;
    a.state.day = day;
    const wet = a.view().forecast(plan('mina', 'kamimori', 'forage'));
    expect(reasonsOf(wet.reasons)).toContain('- No cape in the rain');
  });

  it('is certain for a story find in ordinary conditions, and for a lead that holds', () => {
    const { a } = newExpedition();
    a.state.day = 4;
    a.state.known.push('furumichi');
    a.state.discoveries.miller = { day: 3, by: 'ren' };
    a.state.known.push('yamagoya'); a.state.visits.yamagoya = 1;
    const story = a.view().forecast(plan('sora', 'furumichi', 'investigate'));
    expect(story.chance).toBe('certain');
    expect(reasonsOf(story.reasons)[0]).toBe('+ The waymark is there to read');
    a.state.known.push('koishihama');
    a.state.leads.push({ id: 'to-koishihama', place: 'koishihama', find: 'river-agate', line: 'x', given: 2, expires: 5 });
    const lead = a.view().forecast(plan('mina', 'koishihama', 'forage'));
    expect(lead.chance).toBe('certain');
    expect(reasonsOf(lead.reasons)[0]).toBe('+ Following a lead');
  });
});

describe('a day out', () => {
  it('shows beats as tags and keeps the pack shut until its beat, and the find until evening', () => {
    const { sim, a } = newExpedition();
    a.assign(plan('ren', 'fuchi', 'fish'));
    a.rest('sora');
    a.rest('mina');
    a.begin();
    const outing = a.state.outings[0]!;
    const reveal = outing.legs.find((l) => l.reveal)!;
    let sawTag = false;
    runUntil(sim, () => {
      if (a.state.elapsed < reveal.start - 0.2) expect(a.view().friends.find((f) => f.id === 'ren')!.pack).toBeNull();
      sawTag ||= a.view().tags.some((t) => t.kind === 'beat' && t.person === 'ren');
      return a.state.elapsed >= reveal.start + 0.5;
    });
    expect(sawTag).toBe(true);
    expect(a.view().friends.find((f) => f.id === 'ren')!.pack).not.toBeNull();
    const finds = outing.bundles.filter((b) => b.kind === 'find');
    for (const b of finds) if (b.kind === 'find') expect(a.state.discoveries[b.find]).toBeUndefined();
  });

  it('gives a fork on day two that resolves by the friend’s nature when left alone', () => {
    let checked = 0;
    for (let seed = 1; seed < 30 && checked < 2; seed++) {
      const { sim, a } = newExpedition(seed);
      playToMorning(sim);
      a.assign(plan('sora', 'kamimori', 'forage'));
      a.assign(plan('ren', 'sagi', 'fish'));
      a.assign(plan('mina', 'suisha', 'visit'));
      a.begin();
      const forked = a.state.outings.find((o) => o.fork);
      if (!forked) continue;
      expect(a.state.outings.filter((o) => o.fork)).toHaveLength(1);
      runUntil(sim, () => a.state.phase !== 'day');
      expect(forked.fork!.answer).toBe(forked.person === 'sora' ? 0 : 1);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('comes out the same whether the day is watched or skipped', () => {
    const outcome = (skip: boolean): string => {
      const { sim, a } = newExpedition(7);
      playToMorning(sim);
      a.assign(plan('sora', 'kamimori', 'explore'));
      a.assign(plan('ren', 'fuchi', 'fish'));
      a.assign(plan('mina', 'suisha', 'visit'));
      a.begin();
      if (skip) a.skip();
      playToMorning(sim);
      return JSON.stringify({ d: a.state.discoveries, s: a.state.provisions, l: a.state.leads });
    };
    expect(outcome(true)).toBe(outcome(false));
  });

  it('shows three to five creatures, and a sketch puts one in the journal', () => {
    const { sim, a } = newExpedition();
    for (const id of ['sora', 'ren', 'mina']) a.rest(id);
    a.begin();
    expect(a.state.sightings.length).toBeGreaterThanOrEqual(3);
    expect(a.state.sightings.length).toBeLessThanOrEqual(5);
    const first = a.state.sightings[0]!;
    expect(a.sketch(first.id).ok).toBe(false);
    runUntil(sim, () => a.state.elapsed >= first.appear + 1);
    expect(a.scene().sightings.some((x) => x.id === first.id && x.fresh)).toBe(true);
    expect(a.sketch(first.id)).toEqual({ ok: true });
    expect(a.state.discoveries[first.find]?.by).toBe('sketch');
    // The drawing is told it was sketched, for a moment, rather than guessing from its going early.
    expect(a.scene().sightings.find((x) => x.id === first.id)?.sketched).toBe(true);
    runUntil(sim, () => a.state.elapsed >= first.sketchedAt! + 1.5);
    expect(a.scene().sightings.some((x) => x.id === first.id)).toBe(false);
  });
});

describe('the evening fire', () => {
  it('sets bundles down rarest last, each counting as it lands, and ends on a line about tomorrow', () => {
    const { sim, a } = newExpedition();
    a.assign(plan('ren', 'fuchi', 'fish'));
    a.assign(plan('mina', 'kamimori', 'forage'));
    a.assign(plan('sora', 'suisha', 'visit'));
    a.begin();
    runUntil(sim, () => a.state.phase === 'evening');
    const evening = a.state.evening!;
    const ranks = evening.items.map((i) => ({ plain: 0, unusual: 1, rare: 2, story: 3 })[i.hint]);
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
    const provisions = a.state.provisions;
    expect(a.unpackNext()).toEqual({ ok: true });
    expect(a.state.provisions).toBe(provisions + evening.effects[0]!.provisions);
    expect(a.view().evening!.tomorrow).toBe('');
    a.finishEvening();
    expect(a.state.phase).toBe('night');
    expect(evening.tomorrow.length).toBeGreaterThan(10);
    a.finishEvening();
    expect(a.state.phase).toBe('morning');
  });

  it('plants a lead on day one or two to a place the high water has shut, which opens on day three', () => {
    const { sim, a } = newExpedition();
    a.assign(plan('ren', 'fuchi', 'fish'));
    a.assign(plan('mina', 'kamimori', 'forage'));
    a.rest('sora');
    a.begin();
    playToMorning(sim);
    const leads = a.state.leads.map((l) => l.place);
    const shut = leads.filter((id) => ['hanano', 'hazama', 'ukishima'].includes(id));
    expect(shut.length).toBeGreaterThan(0);
    expect(a.view().places.find((p) => p.id === shut[0])!.lead).not.toBeNull();
  });

  it('lets a lead lapse when its days are over, and makes its find certain while it holds', () => {
    const { sim, a } = newExpedition();
    a.assign(plan('ren', 'fuchi', 'fish'));
    a.rest('sora');
    a.rest('mina');
    a.begin();
    playToMorning(sim);
    const lead = a.state.leads.find((l) => l.place === 'koishihama')!;
    expect(lead).toBeTruthy();
    expect(lead.expires).toBe(5);
    playToMorning(sim);
    playToMorning(sim);
    expect(a.state.day).toBe(4);
    a.assign(plan('mina', 'koishihama', 'forage'));
    a.rest('sora');
    a.rest('ren');
    a.begin();
    playToMorning(sim);
    expect(a.state.discoveries['river-agate']?.by).toBe('mina');
    const left = newExpedition().a;
    left.state.leads.push({ ...lead });
    left.state.day = 6;
    playToMorning(left.sim);
    expect(left.state.leads.some((l) => l.id === 'to-koishihama')).toBe(false);
  });
});

describe('kit, building and planting', () => {
  it('lends each item to one friend a day', () => {
    const { a } = newExpedition();
    expect(a.craft('rain-cape').ok).toBe(true);
    expect(a.assign(plan('ren', 'fuchi', 'fish', 'rain-cape'))).toEqual({ ok: true });
    const second = a.assign(plan('mina', 'kamimori', 'forage', 'rain-cape'));
    expect(!second.ok && second.reason).toBe('Ren is taking the rain cape.');
    expect(a.assign(plan('mina', 'kamimori', 'forage', 'field-kit')).ok).toBe(false);
  });

  it('builds with friends who stay home, and each building says what it changes', () => {
    const { sim, a } = newExpedition();
    a.state.provisions = 10; a.state.materials = 10;
    expect(a.place('garden', openSite(a, 'garden')).ok).toBe(true);
    expect(a.state.materials).toBe(10 - structureDef('garden').cost);
    expect(a.state.provisions).toBe(10);
    // A small work stands as soon as it is placed.
    expect(a.view().structures.find((s) => s.id === 'garden')!.status).toBe('built');
    a.rest('mina');
    a.assign(plan('sora', 'kamimori', 'forage'));
    a.assign(plan('ren', 'fuchi', 'fish'));
    a.begin();
    playToMorning(sim);
    expect(a.view().structures.find((s) => s.id === 'garden')!.status).toBe('built');
    expect(reasonsOf(a.view().forecast(plan('mina', 'kamimori', 'forage')).reasons)).toContain('+ One more provision, thanks to the garden');
    a.state.provisions = 10; a.state.materials = 10;
    const bank = PLACES.find((p) => p.id === 'fuchi')!.at;
    expect(a.siteProblem('platform', bank)).toBeNull();
    expect(a.place('platform', bank).ok).toBe(true);
    a.rest('sora');
    a.rest('ren');
    a.rest('mina');
    a.begin();
    playToMorning(sim);
    expect(reasonsOf(a.view().forecast(plan('ren', 'fuchi', 'fish')).reasons)).toContain('+ The fishing platform nearby');
  });

  it('plants a find and lets it grow until something comes to it', () => {
    const { sim, a } = newExpedition();
    a.state.discoveries['day-lilies'] = { day: 1, by: 'mina' };
    expect(a.place('lily-bed', openSite(a, 'lily-bed')).ok).toBe(true);
    expect(a.scene().buildings[0]!.stage).toBe(0);
    for (let i = 0; i < 6; i++) playToMorning(sim);
    expect(a.scene().buildings[0]!.stage).toBe(2);
  });
});

describe('the way downstream', () => {
  it('opens the way to Mio through either surveyed route without a compulsory building', () => {
    for (const find of ['waymark', 'long-view'] as const) {
      const { a } = newExpedition();
      a.state.discoveries[find] = { day: 1, by: 'sora' };
      expect(gateOpen(a.state)).toBe(true);
      expect(a.state.buildings).toEqual([]);
      a.state.provisions = 2;
      expect(readyToMove(a.state)).toBe(false);
      a.state.provisions = 20; a.state.materials = 20;
      expect(readyToMove(a.state)).toBe(true);
    }
  });

  it('opens Mio by this run’s way (the reeds, the herons or the high path) and Aki’s promise, and moves everyone down', () => {
    for (const [way, find, structure] of [['reeds', 'reed-way', 'cottage'], ['herons', 'heron-way', 'bridge'], ['high-path', 'high-path', 'bridge']] as const) {
      const { sim, a } = newExpedition();
      a.state.course = { ...a.state.course, way };
      a.state.region = 1;
      a.state.discoveries[find] = { day: 1, by: 'sora' };
      a.state.buildings.push({ id: 90, kind: structure, x: 1090, y: 3580, region: 1, work: 3, placed: 1 });
      a.state.provisions = 30;
      expect(a.travel()).toEqual({ ok: true });
      playToMorning(sim);
      expect(a.state.region, `${find} and ${structure}`).toBe(2);
      expect(sim.state.chapter).toBe(2);
      expect(a.view().morning!.news[0]).toBe('We have come down the river to Kawagiri.');
      // The high path comes down the east bank to the village itself; the others sleep at the reed cutters' hut.
      const east = way === 'high-path';
      expect(a.state.known.includes('kawagiri'), way).toBe(east);
      expect(a.state.people.every((p) => (p.lodging === 'ashikari') === !east), way).toBe(true);
    }
  });

  it('keeps the reeds available as an alternative to this run’s preferred route', () => {
    const { a } = newExpedition();
    a.state.region = 1;
    a.state.course = { ...a.state.course, way: 'herons' };
    const place = PLACES.find((p) => p.id === 'omagari')!;
    const today = { ...todayOf(2086, 4), level: 'low' as const };
    expect(findPossible(findDef('reed-way'), place, 'explore', today, a.state)).toBe(true);
    a.state.course = { ...a.state.course, way: 'reeds' };
    expect(findPossible(findDef('reed-way'), place, 'explore', today, a.state)).toBe(true);
  });
});

describe('saving', () => {
  const roundTrip = (sim: Simulation): Simulation => new Simulation(adventureValley, JSON.parse(JSON.stringify(sim.state)));

  it('round-trips in the middle of a day and of an evening, and plays on identically', () => {
    const { sim, a } = newExpedition();
    a.assign(plan('ren', 'fuchi', 'fish'));
    a.assign(plan('mina', 'kamimori', 'forage'));
    a.assign(plan('sora', 'sagi', 'explore'));
    a.begin();
    runUntil(sim, () => a.state.elapsed >= 23);
    const copy = roundTrip(sim);
    expect(copy.expedition!.state).toEqual(a.state);
    runUntil(sim, () => a.state.phase === 'evening' && a.state.evening!.shown === 1);
    runUntil(copy, () => copy.expedition!.state.phase === 'evening' && copy.expedition!.state.evening!.shown === 1);
    expect(copy.expedition!.state).toEqual(a.state);
    const evening = roundTrip(sim);
    for (const s of [sim, evening]) playToMorning(s);
    expect(evening.expedition!.state).toEqual(a.state);
    expect(evening.state.tick).toBe(sim.state.tick);
  });

  it('resumes a night at the next morning, and starts afresh from an old adventure save', () => {
    const { sim, a } = newExpedition();
    a.rest('sora');
    a.rest('ren');
    a.rest('mina');
    a.begin();
    runUntil(sim, () => a.view().eveningReady);
    a.finishEvening();
    const copy = roundTrip(sim);
    expect(copy.expedition!.state.phase).toBe('morning');
    expect(copy.expedition!.state.day).toBe(2);
    const old = JSON.parse(JSON.stringify(sim.state));
    old.adventure = { version: 1, day: 9, people: [], region: 2 };
    const fresh = new Simulation(adventureValley, old).expedition!;
    expect(fresh.state.day).toBe(1);
    expect(fresh.state.region).toBe(0);
    expect(fresh.state.known).toContain('kamimori');
  });

  it('survives corrupt values without failing', () => {
    const { sim, a } = newExpedition();
    a.begin();
    const broken = JSON.parse(JSON.stringify(sim.state));
    broken.adventure.phase = 'day';
    broken.adventure.outings = [{ person: 'ren', place: 'nowhere' }];
    broken.adventure.provisions = 'many';
    broken.adventure.region = 99;
    const restored = new Simulation(adventureValley, broken).expedition!;
    expect(restored.state.phase).toBe('morning');
    expect(restored.state.provisions).toBe(4);
    expect(restored.state.region).toBe(2);
    expect(HOME_BY).toBeLessThan(DAY_SECONDS);
  });
});

describe('round two', () => {
  it('keeps the painted clock on today through the evening and night', () => {
    const { sim, a } = newExpedition();
    for (const id of ['sora', 'ren', 'mina']) a.rest(id);
    const morning = a.view().yearProgress;
    a.begin();
    runUntil(sim, () => a.view().eveningReady);
    a.finishEvening();
    const night = a.view().yearProgress;
    expect(Math.floor(night * 12)).toBe(Math.floor(morning * 12));
    expect(sim.season).toBe(0);
  });

  it('calls a lead a lead by the fire', () => {
    const { sim, a } = newExpedition();
    a.assign(plan('ren', 'fuchi', 'fish'));
    a.rest('sora');
    a.rest('mina');
    a.begin();
    runUntil(sim, () => a.state.phase === 'evening');
    const lead = a.state.evening!.items.find((i) => i.kind === 'lead')!;
    expect(lead.title).toBe('A lead: Koishihama');
  });

  it('says who would do better, and gives the staff and a companion one clear thing each', () => {
    const { a } = newExpedition();
    a.state.provisions = 10; a.state.materials = 10;
    a.craft('walking-staff');
    const sora = a.view().forecast(plan('sora', 'fuchi', 'fish'));
    expect(reasonsOf(sora.reasons)).toContain('- Ren would do better here');
    const staff = a.view().forecast(plan('ren', 'fuchi', 'fish', 'walking-staff'));
    expect(staff.beats).toBe(3);
    expect(reasonsOf(staff.reasons)).toContain('+ The staff: on to the tail of the pool');
    const pair = a.view().forecast(plan('mina', 'kamimori', 'forage', null, 'sora'));
    expect(reasonsOf(pair.reasons)).toContain('+ Sora along for the walk');
  });

  it('meets Haru at her coastal camp and leaves her living there', () => {
    const { sim, a } = newExpedition();
    a.state.region = 2;
    for (const person of a.state.people) person.base = 2;
    a.state.known.push('kawagiri'); a.state.rumoured.push('matsubara');
    expect(a.scene().figures.some((f) => f.id === 'meeting-haru')).toBe(false);
    expect(a.view().forecast(plan('sora', 'matsubara', 'explore')).chance).toBe('certain');
    a.assign(plan('sora', 'matsubara', 'explore')); a.begin();
    const arrival = a.state.outings[0]!.legs.find((leg) => leg.kind === 'beat')!.start;
    runUntil(sim, () => a.state.elapsed >= arrival + .2);
    expect(a.scene().figures.find((f) => f.id === 'meeting-haru')?.look).toBe('haru');
    runUntil(sim, () => a.view().eveningReady); a.collectReturns();
    expect(a.state.discoveries['haru-meeting']).toBeTruthy();
    expect(a.state.people.map((p) => p.id)).not.toContain('haru');
    expect(a.scene().figures.some((f) => f.id === 'meeting-haru')).toBe(true);
    const haru = a.state.evening!.items.filter((i) => i.sketch === 'haru-meeting' || i.title.startsWith('Haru'));
    expect(haru).toHaveLength(1);
    expect(haru[0]!.title.startsWith('Met Haru')).toBe(true);
    expect(haru[0]).toMatchObject({ hint: 'story' });
    expect(haru[0]!.outcome).toBeUndefined();
    expect(a.state.evening!.items.at(-1)!.hint).toBe('story');
  });

  it('reliably schedules a creature after its tracks are found', () => {
    const { a } = newExpedition();
    a.state.tracked = ['serow']; a.rest('sora'); a.begin();
    expect(a.state.sightings.map((x) => x.find)).toContain('serow');
  });

  it('fills the valley with villagers who are not friends, and who go indoors at night', () => {
    const { sim, a } = newExpedition();
    const scene = a.scene();
    const villagers = scene.figures.filter((f) => f.role === 'villager');
    // Five Seseragi residents and the miller, in a range of everyday coats.
    expect(villagers.length).toBe(6);
    expect(villagers.every((v) => /^villager-([a-j]|woman|elder|farmer)$/.test(v.look))).toBe(true);
    expect(villagers.map((v) => v.look)).toEqual(expect.arrayContaining(['villager-woman', 'villager-elder']));
    expect(new Set(villagers.map((v) => v.look)).size).toBeGreaterThanOrEqual(4);
    expect(scene.figures.filter((f) => f.role === 'friend').map((f) => f.look)).toEqual(['sora', 'ren', 'mina']);
    expect(a.view().friends).toHaveLength(3);
    for (const id of ['sora', 'ren', 'mina']) a.rest(id);
    a.begin();
    runUntil(sim, () => a.view().eveningReady);
    a.finishEvening();
    expect(a.scene().figures.filter((f) => f.role === 'villager').every((v) => !v.visible)).toBe(true);
  });

  it('groups the journal into small sets, and a finished set brings something to the valley', () => {
    const { a } = newExpedition();
    const view = a.view();
    expect(view.journal.find((e) => e.id === 'dipper')!.set).toBe('Birds of the river');
    const set = view.sets.find((s) => s.id === 'river-birds')!;
    expect(set).toMatchObject({ found: 0, total: 4, complete: false });
    for (const id of ['dipper', 'kingfisher', 'heron', 'plover']) a.state.discoveries[id] = { day: 1, by: 'ren' };
    expect(a.view().sets.find((s) => s.id === 'river-birds')!.complete).toBe(true);
    expect(a.scene().sightings.some((x) => x.id === 'resident-river-birds' && x.species === 'kingfisher')).toBe(true);
    for (const s of SETS) for (const id of s.finds) expect(FINDS.some((f) => f.id === id), id).toBe(true);
  });

  it('opens the whole river in Free Play with no gates, starting small: Haru and Yui at Mio, and a few places known', () => {
    const state = newGameState(adventureValley, 'free', 2086);
    state.adventure = newAdventure(true);
    const sim = new Simulation(adventureValley, state);
    const a = sim.expedition!;
    expect(a.state.people.map((p) => p.id)).toEqual(['haru', 'yui']);
    expect(a.state.known.length).toBeLessThan(10);
    expect(a.state.known).toEqual(expect.arrayContaining(['mio', 'toroya', 'seseragi', 'kawagiri']));
    // The almanac starts with the nearest friend still to meet.
    expect(a.view().goal).toContain('Toroya');
    expect(a.view().aims.length).toBeGreaterThanOrEqual(5);
    expect(a.view().forecast(plan('yui', 'shirahama', 'explore')).problem).toBeTruthy();
    expect(a.rest('yui').ok).toBe(true);
    // Wander can fill every page, including all three ways down from Mio.
    expect(a.view().journal.length).toBe(FINDS.length);
    a.state.provisions = 50;
    for (let i = 0; i < 3; i++) playToMorning(sim);
    expect(a.state.region).toBe(1);
    expect(a.state.moving).toBe(false);
  });

  it('brings Aki along in Free Play once someone visits him, keeping his home in Mio', () => {
    const state = newGameState(adventureValley, 'free', 2086);
    state.adventure = newAdventure(true);
    const sim = new Simulation(adventureValley, state);
    const a = sim.expedition!;
    expect(a.view().goal).toContain('Toroya');
    // Major works wait for a carpenter, in Free Play too.
    expect(a.view().structures.find((s) => s.id === 'cottage')?.problem ?? '').toContain('carpenter');
    a.state.discoveries['aki-meeting'] = { day: 1, by: 'haru' };
    playToMorning(sim);
    expect(a.state.people.find((p) => p.id === 'aki')?.base).toBe(1);
    expect(a.view().goal).not.toContain('Toroya');
  });
});

describe('a Wander sail', () => {
  const wanderBoat = (): { sim: Simulation; a: ExpeditionAdventure } => {
    const state = newGameState(adventureValley, 'free', 2086);
    const s = state.adventure = newAdventure(true);
    s.discoveries['aki-meeting'] = { day: 1, by: 'haru' };
    s.buildings.push({ id: 1, kind: 'dock', x: 1800, y: 5800, region: 2, work: 3, placed: 1 }, { id: 2, kind: 'boat', x: 1820, y: 5940, region: 2, work: 4, placed: 1 });
    const sim = new Simulation(adventureValley, state);
    return { sim, a: sim.expedition! };
  };

  it('is a day out: home by the next morning with no ending, the sail remembered, and the boat ready again', () => {
    const { sim, a } = wanderBoat();
    expect(a.canSail).toBe(true);
    expect(a.sail(['haru', 'yui'])).toEqual({ ok: true });
    let ended = false;
    runUntil(sim, () => { ended ||= a.state.voyage === 'ended' || a.view().ending !== null; return a.state.voyage === 'preparing'; });
    expect(ended).toBe(false);
    expect(a.state.sailed).toBe(true);
    expect(a.state.notes.some((n) => n.text.includes('Out past the bar'))).toBe(true);
    expect(a.view().aims.length).toBeGreaterThan(0);
    runUntil(sim, () => a.state.phase === 'morning');
    expect(a.state.day).toBe(2);
    expect(a.state.free).toBe(true);
    expect(a.view().ending).toBeNull();
    expect(a.state.buildings.some((b) => b.kind === 'boat')).toBe(true);
    expect(a.scene().figures.filter((f) => f.role === 'friend').every((f) => f.visible)).toBe(true);
    // The morning plans work, and the boat can go out again.
    expect(a.canSail).toBe(true);
    expect(a.sail(['yui'])).toEqual({ ok: true });
    a.skip();
    runUntil(sim, () => a.state.voyage === 'preparing');
    expect(a.state.phase).toBe('night');
    runUntil(sim, () => a.state.phase === 'morning');
    expect(a.state.day).toBe(3);
    expect(a.rest('haru').ok).toBe(true);
    playToMorning(sim);
    expect(a.state.day).toBe(4);
  });
});

describe('the last voyage', () => {
  const readyBoat = (): ReturnType<typeof newExpedition> => {
    const game = newExpedition();
    const s = game.a.state;
    s.region = 2;
    game.sim.state.chapter = 2;
    s.provisions = 30;
    for (const id of ['mended-sail', 'tide-marks', 'dipper', 'kingfisher', 'heron', 'plover']) s.discoveries[id] = { day: 3, by: 'ren' };
    s.buildings.push({ id: 1, kind: 'dock', x: 760, y: 5150, region: 2, work: 2, placed: 1 }, { id: 2, kind: 'boat', x: 820, y: 5350, region: 2, work: 3, placed: 1 });
    return game;
  };

  it('gathers at first light, glides the whole river with a few quiet words, and ends at sea', () => {
    const { sim, a } = readyBoat();
    expect(a.canSail).toBe(true);
    expect(a.sail(['sora', 'ren'])).toEqual({ ok: true });
    expect(a.scene().hour).toBeLessThan(6.5);
    runUntil(sim, () => a.state.voyage === 'sailing');
    const lines = new Set<string>();
    const reaches = new Set<string>();
    runUntil(sim, () => {
      const caption = a.view().voyageCaption;
      if (caption?.line) lines.add(caption.line);
      if (caption?.reach) reaches.add(caption.reach);
      return a.state.voyage === 'ended';
    });
    expect([...reaches]).toEqual(['Seseragi', 'Mio', 'Kawagiri', 'The sea']);
    expect(lines.size).toBeGreaterThan(1);
    // The rope falling loose, a line per reach, Ren's salt and Sora at the bar.
    expect(lines.size).toBeLessThanOrEqual(6);
    expect(a.view().ending).toMatchObject({ sailed: ['Sora', 'Ren'] });
    expect(a.state.sailed).toBe(true);
    expect(a.scene().figures.filter((f) => f.role === 'friend' && !f.visible).map((f) => f.id)).toEqual(['sora', 'ren']);
  });

  it('stays with the boat from its restored mooring to the open sea', () => {
    const { a } = readyBoat();
    a.sail(['sora']);
    const stops = voyageStops(a.state, true);
    expect(stops[0]!.at.y).toBeGreaterThan(5000);
    expect(stops.every((stop) => stop.at.y > 5000)).toBe(true);
    expect(stops[stops.length - 1]!.at.y).toBeGreaterThan(6000);
    for (let i = 1; i < stops.length; i++) expect(stops[i]!.t).toBeGreaterThanOrEqual(stops[i - 1]!.t);
    expect(stops.some(stop => stop.cut)).toBe(false);
  });

  it('can be skipped to the sea, and returns to the valley as Free Play with the sailors home after a night', () => {
    const { sim, a } = readyBoat();
    a.sail(['sora', 'ren']);
    a.skip();
    runUntil(sim, () => a.state.voyage === 'ended');
    expect(a.returnToValley()).toEqual({ ok: true });
    expect(a.state.free).toBe(true);
    expect(sim.state.mode).toBe('free');
    expect(a.state.phase).toBe('night');
    runUntil(sim, () => a.state.phase === 'morning');
    expect(a.scene().figures.filter((f) => f.role === 'friend').every((f) => f.visible)).toBe(true);
    expect(a.state.known).toEqual(expect.arrayContaining(PLACES.filter((p) => !isSecretPlace(p.id)).map((p) => p.id)));
    expect(a.state.buildings.some((b) => b.kind === 'boat')).toBe(true);
  });
});

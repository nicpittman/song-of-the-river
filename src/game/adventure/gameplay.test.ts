import { structureDef } from './structures';
import { describe, expect, it } from 'vitest';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { placeToday, openGround } from './conditions';
import { buildingProblem } from './construction';
import { FINDS, PLACES, placeDef } from './content';
import { BEYOND, HEARD_AT_START, KNOWN_AT_START } from './discovery';
import { ECONOMY, expectedResources, expeditionCost } from './economy';
import { assess } from './odds';
import { routeSeconds } from './odds';
import { personDef } from './people';
import { opportunities } from './opportunities';
import { goalLine, readyToMove } from './progression';
import { restoreAdventure } from './restore';
import { newAdventure } from './state';
import { newExpedition, plan, playToMorning, runUntil } from './testing';
import { todayOf } from './world';
import { PEOPLE } from './people';
import { suggestedOutings } from '../../ui/notebook/recommendations';

const copy = (sim: Simulation): Simulation => new Simulation(adventureValley, JSON.parse(JSON.stringify(sim.state)));

describe('the opening gameplay hook', () => {
  it('plays five days with one outing per day, automatic camp help and useful sixth-day choices', () => {
    const { sim, a } = newExpedition();
    const days = [
      plan('sora', 'kamimori', 'explore'), plan('mina', 'kamimori', 'forage'),
      plan('sora', 'yamagoya', 'explore'), { ...plan('sora', 'seseragi', 'visit'), lodging: 'yamagoya' },
      plan('sora', 'hazama', 'investigate'),
    ];
    const snapshots: unknown[] = [];
    for (const outing of days) {
      if (a.state.day === 3) expect(a.place('lookout', { x: 320, y: 2040 }).ok).toBe(true);
      expect(a.assign(outing)).toEqual({ ok: true });
      expect(a.state.plans).toHaveLength(1);
      expect(a.begin()).toEqual({ ok: true });
      expect(a.state.outings).toHaveLength(1);
      runUntil(sim, () => a.view().eveningReady);
      a.collectReturns();
      snapshots.push({ day: a.state.day, provisions: a.state.provisions, materials: a.state.materials, known: a.state.known.length });
      const saved = copy(sim);
      expect(saved.expedition!.state.history).toEqual(a.state.history);
      a.finishEvening(); a.finishEvening();
    }
    console.log('One-outing opening:', JSON.stringify(snapshots));
    expect(a.state.day).toBe(6);
    expect(a.state.known.length).toBeGreaterThanOrEqual(9);
    expect(a.view().structures.find((structure) => structure.id === 'lookout')?.status).toBe('built');
    expect(a.state.discoveries['carved-steps']).toBeTruthy();
    expect(a.view().forecast(plan('sora', 'yamagoya', 'explore')).discoveryHint).toBeTruthy();
    expect(a.state.history).toHaveLength(5);
    expect(suggestedOutings(a.view()).length).toBeGreaterThanOrEqual(2);
    // Two practical ideas leave the third invitation free for an unscored side path.
    expect(['wander', 'sign']).toContain(suggestedOutings(a.view()).at(-1)?.purpose);
  });
  it('starts small, then reliably discovers the ford and suggests a ridge and pool', () => {
    for (const seed of [1, 2, 3, 4, 5, 2086]) {
      const { sim, a } = newExpedition(seed);
      expect(a.state.known).toHaveLength(4);
      expect(a.view().places.some((p) => p.id === 'takaishi')).toBe(false);
      expect(opportunities(a.world())).toHaveLength(3);
      expect(a.assign(plan('sora', 'kamimori', 'explore')).ok).toBe(true);
      expect(a.assign(plan('ren', 'suisha', 'fish')).ok).toBe(true);
      expect(a.assign(plan('mina', 'kamimori', 'forage')).ok).toBe(true);
      playToMorning(sim);
      expect(a.state.known).toContain('takaishi');
      expect(a.state.rumoured).toEqual(expect.arrayContaining(['yamagoya', 'fuchi']));
      expect(a.state.visits.kamimori).toBe(2);
      expect(a.state.materials).toBeGreaterThanOrEqual(4);
      expect(a.state.provisions).toBeGreaterThanOrEqual(ECONOMY.startingProvisions);
      const ridge = a.view().places.find((p) => p.id === 'yamagoya')!;
      expect(ridge.rumour).toBeTruthy();
      expect(ridge.activities).toEqual(['explore']);
      expect(ridge.finds).toEqual([]);
      expect(a.view().forecast(plan('mina', 'yamagoya', 'forage')).problem).toContain('explore');
    }
  });

  it('plays five natural days, expands the map, builds a lookout and leaves competing sixth-day choices', () => {
    const { sim, a } = newExpedition();
    const assign = (person: string, place: string, activity: Parameters<typeof plan>[2]): void => {
      expect(a.assign(plan(person, place, activity)), `day ${a.state.day}: ${person} → ${place}`).toEqual({ ok: true });
    };
    assign('sora', 'kamimori', 'explore'); assign('ren', 'suisha', 'fish'); assign('mina', 'kamimori', 'forage');
    playToMorning(sim);
    expect(a.state.day).toBe(2);
    expect(a.view().places.find((p) => p.id === 'takaishi')!.state).toBe('closed');
    expect(a.place('lookout', { x: 320, y: 2040 })).toEqual({ ok: true });
    // A small work stands at once: nobody gives up a day for it.
    expect(a.view().structures.find((s) => s.id === 'lookout')!.status).toBe('built');
    assign('sora', 'yamagoya', 'explore'); assign('ren', 'suisha', 'fish'); a.rest('mina');
    playToMorning(sim);
    expect(a.state.discoveries['long-view']).toBeUndefined();
    expect(a.view().places.find((p) => p.id === 'takaishi')!.state).toBe('open');
    expect(a.camp('sora', 'yamagoya')).toEqual({ ok: true }); assign('ren', 'hazama', 'investigate'); a.rest('mina');
    playToMorning(sim);
    expect(a.state.people.find((p) => p.id === 'sora')!.lodging).toBe('yamagoya');
    expect(a.state.buildings[0]!.work).toBe(0);
    assign('sora', 'yamagoya', 'explore'); assign('ren', 'suisha', 'visit'); assign('mina', 'kamimori', 'forage');
    playToMorning(sim);
    assign('sora', 'furumichi', 'explore'); assign('ren', 'suisha', 'fish'); assign('mina', 'kamimori', 'forage');
    playToMorning(sim);
    expect(a.state.day).toBe(6);
    expect(a.state.region).toBe(0); // Progress does not force the player to leave.
    expect(a.state.known.length).toBeGreaterThanOrEqual(9);
    // The physical road now follows the cart ruts: the distant ridge leaves less survey time.
    expect(a.state.discoveries.waymark).toBeUndefined();
    expect(a.state.discoveries['long-view']).toBeTruthy();
    expect(a.buildingProblem('ford-bridge')).toContain('carpenter');
    expect(opportunities(a.world()).length).toBeGreaterThanOrEqual(2);
    expect(a.view().departure).toMatchObject({ surveyed: true, prepared: true, packed: a.state.provisions >= ECONOMY.journeys[0]! });
    // With the route surveyed, the road down is ready as soon as the packs are: no extra chore stands between.
    expect(a.view().canTravel).toBe(a.state.provisions >= ECONOMY.journeys[0]! && a.state.materials >= ECONOMY.journeyMaterials[0]!);
    expect(copy(sim).expedition!.state).toEqual(a.state);
  });

  it('has a connected exploration graph and no rare prerequisite on either main route', () => {
    for (let region = 0; region < 3; region++) {
      const reached = new Set([...(KNOWN_AT_START[region] ?? []), ...(HEARD_AT_START[region] ?? [])]);
      for (let pass = 0; pass < PLACES.length; pass++) {
        for (const id of [...reached]) {
          if (placeDef(id).activities.includes('explore')) for (const next of BEYOND[id] ?? []) reached.add(next);
          for (const find of FINDS.filter((find) => !find.rare && find.at?.includes(id) && find.activities?.some((activity) => placeDef(id).activities.includes(activity)))) for (const next of find.reveals ?? []) reached.add(next);
        }
      }
      for (const id of region === 0 ? ['takaishi', 'hanano', 'yamagoya', 'furumichi', 'fuchi'] : region === 1 ? ['omagari', 'yanagi'] : ['funaya', 'kawaguchi', 'iso']) expect(reached.has(id), id).toBe(true);
    }
    for (const id of ['waymark', 'long-view', 'reed-way', 'heron-way', 'boatyard-moulds', 'loft-sail', 'tide-marks']) expect(FINDS.find((f) => f.id === id)!.rare).not.toBe(true);
  });
});

describe('food, building materials and daily trade-offs', () => {
  it('caps shared camp food independently of group size, while a garden adds dependable production', () => {
    for (const size of [3, 6]) {
      const { sim, a } = newExpedition();
      a.state.people = PEOPLE.slice(0, size).map((person) => ({ id: person.id, base: 0, practice: {}, memories: [] }));
      const before = a.state.provisions;
      a.rest('sora'); a.begin(); runUntil(sim, () => a.view().eveningReady); a.collectReturns();
      expect(a.state.provisions).toBe(before + ECONOMY.campProvisions - ECONOMY.dailyUpkeep);
      expect(a.state.evening!.effects.reduce((sum, effect) => sum + effect.provisions, 0)).toBe(ECONOMY.campProvisions);
      a.finishEvening(); a.finishEvening();
      a.state.buildings.push({ id: a.state.nextId++, kind: 'garden', x: 320, y: 2040, region: 0, work: 0, placed: 1 });
      a.rest('sora'); a.begin(); runUntil(sim, () => a.view().eveningReady); a.collectReturns();
      expect(a.state.provisions).toBe(before + 1);
    }
  });

  it('gives useful primary returns, with location, season, weather and specialist differences', () => {
    const { a } = newExpedition();
    const wood = placeDef('kamimori');
    expect(expectedResources(a.world(), wood, plan('mina', wood.id, 'forage'))).toEqual({ provisions: 0, materials: 3 });
    expect(expectedResources(a.world(), wood, plan('sora', wood.id, 'forage')).materials).toBe(2);
    const wet = { ...a.world(), today: { ...a.world().today, weather: 'rain' as const } };
    expect(expectedResources(wet, wood, plan('mina', wood.id, 'forage')).materials).toBe(2);
    const winter = { ...a.world(), today: { ...a.world().today, season: 3 } };
    expect(expectedResources(winter, placeDef('hatake'), plan('mina', 'hatake', 'forage')).provisions).toBe(2);
    for (let seed = 1; seed <= 30; seed++) {
      const { a: game } = newExpedition(seed);
      game.assign(plan('ren', 'suisha', 'fish')); game.assign(plan('mina', 'kamimori', 'forage')); game.rest('sora');
      expect(game.begin().ok).toBe(true);
      runUntil(game.sim, () => game.state.phase === 'evening');
      expect(game.state.outings.find((o) => o.person === 'ren')!.bundles.some((b) => b.kind === 'supplies' && b.amount >= 1)).toBe(true);
      expect(game.state.outings.find((o) => o.person === 'mina')!.bundles.some((b) => b.kind === 'materials' && b.amount >= 1)).toBe(true);
    }
  });

  it('recovers from empty packs, never spends materials on food, and pays upkeep only once', () => {
    const { sim, a } = newExpedition();
    a.state.provisions = 0; a.state.materials = 0;
    a.assign(plan('ren', 'suisha', 'fish')); a.assign(plan('mina', 'kamimori', 'forage')); a.rest('sora');
    expect(a.begin().ok).toBe(true);
    runUntil(sim, () => a.state.phase === 'evening');
    const food = a.state.evening!.effects.reduce((n, e) => n + e.provisions, 0);
    a.finishEvening();
    expect(a.state.provisions).toBe(food - ECONOMY.dailyUpkeep);
    expect(a.state.materials).toBeGreaterThan(0);
    const provisionBalance = a.state.provisions;
    a.finishEvening();
    expect(a.state.provisions).toBe(provisionBalance);
    expect(a.craft('rain-cape').ok).toBe(true);
    expect(a.state.provisions).toBe(provisionBalance);
  });

  it('reserves the total picnic budget and makes a shelter remove that recurring cost', () => {
    const { a } = newExpedition();
    a.state.known.push('taki', 'kagami'); a.state.provisions = 1;
    expect(expeditionCost(a.world(), placeDef('taki'))).toBe(1);
    expect(a.assign(plan('sora', 'taki', 'explore')).ok).toBe(true);
    expect(a.assign(plan('ren', 'kagami', 'fish')).ok).toBe(false);
    a.rest('ren'); a.rest('mina');
    expect(a.begin().ok).toBe(true);
    expect(a.state.provisions).toBe(0);
    const other = newExpedition().a;
    other.state.buildings.push({ id: 1, kind: 'shelter', x: 320, y: 2040, work: 0, region: 0, placed: 1 });
    expect(expeditionCost(other.world(), placeDef('taki'))).toBe(1);
    other.state.people[0]!.lodging = 1;
    expect(expeditionCost(other.world(), placeDef('taki'))).toBe(0);
  });
});

describe('the river changes real routes', () => {
  it('opens the ford on falling water, closes it on high water, and keeps the ridge alternative open', () => {
    const { a } = newExpedition();
    const ford = placeDef('takaishi');
    expect(placeToday(ford, todayOf(a.seed, 1), a.state).state).toBe('closed');
    expect(placeToday(ford, todayOf(a.seed, 3), a.state).state).toBe('open');
    const high = Array.from({ length: 30 }, (_, i) => i + 4).find((day) => todayOf(a.seed, day).level === 'high')!;
    expect(high).toBeGreaterThan(3);
    expect(placeToday(ford, todayOf(a.seed, high), a.state).state).toBe('closed');
    expect(placeToday(placeDef('yamagoya'), todayOf(a.seed, high), a.state).state).not.toBe('closed');
  });

  it('puts the Old Ford footbridge up at once, survives a save, and uses the bridge at high water', () => {
    const { sim, a } = newExpedition();
    a.state.known.push('takaishi'); a.state.materials = 5;
    a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
    expect(a.place('ford-bridge', { x: 1058, y: 438 })).toEqual({ ok: true });
    expect(a.state.materials).toBe(5 - structureDef('ford-bridge').cost);
    expect(a.state.buildings[0]).toMatchObject({ x: 1052, y: 432 });
    expect(a.scene().buildings[0]!.progress).toBe(1);
    a.rest('sora'); a.rest('mina'); a.assign(plan('ren', 'suisha', 'fish')); a.begin();
    runUntil(sim, () => a.state.elapsed >= 18);
    const saved = copy(sim);
    expect(saved.expedition!.state).toEqual(a.state);
    playToMorning(sim); playToMorning(saved);
    expect(saved.expedition!.state).toEqual(a.state);
    expect(a.world().today.level).toBe('high');
    expect(placeToday(placeDef('takaishi'), a.world().today, a.state).state).not.toBe('closed');
    // The deck carries walkers over; the drowned stones beneath it do not.
    const ground = openGround(sim.board, a.world().today, a.state);
    expect(ground.some((g) => g.deck && g.at.y === 432)).toBe(true);
    expect(ground.some((g) => !g.deck && g.at.x === 1052 && g.at.y === 432)).toBe(false);
    expect(a.assign(plan('sora', 'takaishi', 'explore')).ok).toBe(true);
    a.rest('ren'); a.rest('mina'); a.begin();
    const points = a.state.outings[0]!.legs.flatMap((l) => l.points ?? []);
    // Over the deck itself: a stretch along its level line passing the stones' spot.
    expect(points.some((p, i) => i > 0 && Math.min(p.x, points[i - 1]!.x) <= 1052 && Math.max(p.x, points[i - 1]!.x) >= 1052 && Math.abs(p.y - 432) < 24 && Math.abs(points[i - 1]!.y - 432) < 24)).toBe(true);
    expect(points.some((p) => p.x > 1150 && p.y < 600)).toBe(true);
  });
});

describe('continuity and the authored journey', () => {
  it('keeps the first departure light and explains later construction preparations', () => {
    const { a } = newExpedition();
    a.state.provisions = 0;
    a.state.discoveries['long-view'] = { day: 1, by: 'sora' };
    expect(goalLine(a.state)).toMatch(/more food/);
    expect(goalLine(a.state)).not.toContain('lookout');
    expect(goalLine(a.state)).not.toContain('shelter');
    delete a.state.discoveries['long-view'];
    a.state.discoveries.waymark = { day: 1, by: 'sora' };
    expect(goalLine(a.state)).toMatch(/more food/);
    expect(goalLine(a.state)).not.toContain('shelter');
    expect(goalLine(a.state)).not.toContain('lookout');
    a.state.region = 1; a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
    a.state.discoveries['reed-way'] = { day: 1, by: 'sora' };
    expect(goalLine(a.state)).toContain('cottage');
    expect(goalLine(a.state)).toContain('or a footbridge at the narrows');
  });

  it('uses infrastructure in the expedition’s region when the group has split bases', () => {
    const { a } = newExpedition();
    a.state.region = 1;
    const outing = plan('sora', 'kamimori', 'explore');
    a.state.buildings.push({ id: a.state.nextId++, kind: 'lookout', x: 320, y: 2040, region: 0, work: 0, placed: 1 });
    const supported = assess(a.world(), outing);
    expect(supported.reasons.some((reason) => reason.text === 'Seen first from the lookout')).toBe(true);
    a.state.buildings[0]!.region = 1;
    const unsupported = assess(a.world(), outing);
    expect(unsupported.score).toBe(supported.score - 1);
    expect(unsupported.reasons.some((reason) => reason.text === 'Seen first from the lookout')).toBe(false);
  });

  it('keeps a dated account of returns, balances and observations through save/load', () => {
    const { sim, a } = newExpedition();
    a.assign(plan('sora', 'kamimori', 'explore')); a.assign(plan('ren', 'suisha', 'fish')); a.assign(plan('mina', 'kamimori', 'forage'));
    playToMorning(sim);
    expect(a.state.history[0]!.day).toBe(1);
    expect(a.state.history[0]!.lines).toHaveLength(3);
    expect(a.state.history[0]!.lines.some((line) => line.includes('clearing') || line.includes('moss'))).toBe(true);
    expect(a.state.history[0]!.materials).toBe(a.state.materials - ECONOMY.startingMaterials);
    expect(a.state.history[0]!.items!.some((item) => item.kind === 'find')).toBe(true);
    expect(a.state.history[0]!.items!.some((item) => item.person === 'ren' && item.provisions > 0)).toBe(true);
    expect(a.state.history[0]!.tomorrow).not.toContain('Camp −');
    expect(a.state.history[0]!.tomorrow!.length).toBeGreaterThan(10);
    const saved = copy(sim);
    expect(saved.expedition!.state.history).toEqual(a.state.history);
    const view = a.view();
    view.history[0]!.items![0]!.title = 'Changed outside the simulation';
    expect(a.state.history[0]!.items![0]!.title).not.toBe('Changed outside the simulation');
    playToMorning(sim);
    expect(a.state.history.map((day) => day.day)).toEqual([2, 1]);
    expect(a.view().history[0]!.day).toBe(2);
  });

  it('keeps older daily accounts readable when they have no illustrated report', () => {
    const state = newAdventure();
    state.history.push({ day: 1, lines: ['Ren: fish for supper.'], provisions: 1, materials: 0, standout: null });
    expect(restoreAdventure(structuredClone(state)).history).toEqual(state.history);
  });

  it('gives people distinct travel times and refuses outings they cannot finish by dusk', () => {
    const { a } = newExpedition();
    a.state.known.push('taki');
    const road = [{ x: 0, y: 0 }, { x: 1500, y: 0 }];
    expect(routeSeconds(road, personDef('ren').pace)).toBeGreaterThan(routeSeconds(road, personDef('sora').pace));
    expect(a.view().forecast(plan('sora', 'taki', 'explore')).problem).toBeNull();
    expect(a.view().forecast(plan('ren', 'taki', 'explore')).problem).toBeNull();
    expect(a.view().forecast({ ...plan('ren', 'taki', 'explore'), second: { place: 'kamimori', activity: 'explore' } }).problem).toContain('Not daylight enough');
    const before = a.view().friends.map((p) => p.at);
    a.step(10);
    expect(a.view().friends.map((p) => p.at)).toEqual(before); // Quiet, stable planning positions.
  });

  it('moves one friend to another reached town, keeps the others at their base, and saves both', () => {
    const { sim, a } = newExpedition();
    a.state.region = 1;
    a.state.known.push('mio', 'toroya', 'ringozaka');
    expect(a.assign(plan('sora', 'mio', 'visit'))).toEqual({ ok: true });
    expect(a.assign(plan('ren', 'suisha', 'fish'))).toEqual({ ok: true });
    expect(a.assign(plan('mina', 'kamimori', 'forage'))).toEqual({ ok: true });
    a.begin();
    const relocation = a.state.outings.find((o) => o.person === 'sora')!;
    expect(relocation.legs).toHaveLength(1);
    expect(relocation.legs.filter(leg => leg.kind === 'walk').at(-1)!.points!.at(-1)!.y).toBeGreaterThan(2500);
    playToMorning(sim);
    expect(a.state.people.find((p) => p.id === 'sora')!.base).toBe(1);
    expect(a.state.people.find((p) => p.id === 'ren')!.base).toBe(0);
    expect(a.view().friends.find((f) => f.id === 'sora')!.baseName).toBe('Mio');
    expect(a.view().forecast(plan('sora', 'toroya', 'visit')).problem).toBeNull();
    expect(a.view().forecast(plan('ren', 'toroya', 'visit')).problem).toContain('Move Ren’s camp');
    expect(a.view().forecast(plan('sora', 'ringozaka', 'explore', null, 'ren')).problem).toContain('different places');
    const friend = a.view().friends.find((f) => f.id === 'sora')!;
    const route = a.view().route('sora', 'toroya');
    expect(Math.hypot(route[0]!.x - friend.at.x, route[0]!.y - friend.at.y)).toBeLessThan(40);
    expect(copy(sim).expedition!.state).toEqual(a.state);
  });


  it('packs a significant journey once, with no forced departure when its route is found', () => {
    const { sim, a } = newExpedition();
    a.state.discoveries.waymark = { day: 1, by: 'sora' };
    a.state.buildings.push({ id: 1, kind: 'shelter', x: 320, y: 2040, region: 0, work: 0, placed: 1 });
    a.state.provisions = 12;
    expect(readyToMove(a.state)).toBe(true);
    playToMorning(sim);
    expect(a.state.region).toBe(0);
    const balance = a.state.provisions;
    expect(a.travel()).toEqual({ ok: true });
    expect(a.state.provisions).toBe(balance - ECONOMY.journeys[0]!);
    expect(a.travel().ok).toBe(false);
    playToMorning(sim);
    expect(a.state.region).toBe(1);
    expect(a.state.known).toContain('toroya');
    expect(buildingProblem(a.state, 'boat')).toBeTruthy();
    expect(assess(a.world(), plan('sora', 'kamimori', 'explore')).problem).toContain('Move Sora’s camp to Seseragi');
  });
});

import { structureDef } from './structures';
import { expect, it } from 'vitest';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { COAST_BRIDGE } from '../world/boards/kawagiriSites';
import { newExpedition, plan, playToMorning } from './testing';
import { homeName, setOutFrom, todayOf } from './world';
import { openGround, crossingOpen } from './conditions';
import { placeDef } from './content';
import { boatAt } from './finale';
import { campOf, valleyRiver } from './regions';
import { recommendPeople } from '../../ui/notebook/recommendations';
import { goalLine } from './progression';
import { dist } from '../core/math';

it('gives the eastern coastal sites separate real positions, scenery and short reachable walks', () => {
  const { a } = lowerReach();
  a.state.known.push('kawagiri');
  for (const person of a.state.people) { person.base = 2; delete person.lodging; }
  a.state.people.push({ id: 'yui', base: 2, practice: {}, memories: [] });
  const ids = ['kawagiri', 'matsubara', 'fish-traps', 'takayuka', 'funaya', 'todai', 'kawaguchi', 'far-shore'];
  a.state.known.push(...ids.filter(id => !a.state.known.includes(id)));
  a.state.rumoured = a.state.rumoured.filter(id => !ids.includes(id));
  const view = a.view();
  const sites = ids.map(placeDef);
  for (const [i, site] of sites.entries()) {
    expect(a.nav.walkable(site.at), site.id).toBe(true);
    expect(view.places.find(place => place.id === site.id)!.at, site.id).toEqual(site.at);
    for (const other of sites.slice(i + 1)) expect(dist(site.at, other.at), `${site.id} / ${other.id}`).toBeGreaterThan(225);
    const route = a.nav.route(campOf(2).fire, site.at, adventureValley.height);
    expect(route, site.id).not.toBeNull();
    expect(a.nav.clearAlong(route!), site.id).toBe(true);
    // Even the slowest companion can make each local trip without extra camps or equipment.
    expect(view.forecast({ ...plan('yui', site.id, site.activities[0]!), visitOnly: true }).problem, site.id).toBeNull();
  }
  for (const [id, asset] of [['kawagiri','cottage'], ['matsubara','haru-camp'], ['takayuka','stilt-hut'], ['funaya','shed'], ['todai','harbour-light']]) {
    expect(adventureValley.sprites.some(sprite => sprite.asset === asset && dist(sprite, placeDef(id!).at) < 120), id).toBe(true);
  }
  expect(placeDef('far-shore').at.x - placeDef('kawaguchi').at.x).toBeGreaterThan(650);
  expect(placeDef('far-shore').at.x).toBeLessThan(adventureValley.width - 120);
});

function lowerReach() {
  const { a, sim } = newExpedition();
  const s = a.state;
  s.region = 1; s.provisions = 60; s.materials = 40;
  for (const p of s.people) { p.base = 1; delete p.lodging; }
  s.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
  s.discoveries['reed-way'] = { day: 1, by: 'sora' };
  s.buildings.push({ id: s.nextId++, kind: 'cottage', x: 400, y: 3200, work: 2, placed: 1, region: 1 });
  expect(a.travel()).toEqual({ ok: true });
  playToMorning(sim);
  return { a, sim };
}

it('arrives west, scouts across the existing bridge, then moves the group to the eastern sea village', () => {
  const { a, sim } = lowerReach();
  const s = a.state;
  expect(s.region).toBe(2);
  expect(homeName(s, 'sora')).toBe('Ashikari');
  expect(setOutFrom(s, { region: 2 }, 'sora').x).toBeLessThan(1000);
  expect(s.visits.kawagiri).toBeUndefined();
  expect(s.known).not.toContain('kawagiri');
  expect(goalLine(s)).toContain('Shiobashi Bridge');
  expect(a.assign(plan('sora', 'shiobashi', 'explore'))).toEqual({ ok: true });
  expect(a.begin()).toEqual({ ok: true });
  const scouting = s.outings.find((o) => o.person === 'sora')!;
  expect(scouting.legs.some((l) => l.kind === 'walk' && l.points!.some((p) => p.x > COAST_BRIDGE.x && Math.abs(p.y - COAST_BRIDGE.y) < 40))).toBe(true);
  const saved = new Simulation(adventureValley, structuredClone(sim.state));
  playToMorning(sim); playToMorning(saved);
  expect(saved.expedition!.state).toEqual(s);
  expect(s.discoveries['coastal-path']).toBeTruthy();
  expect(s.known).toEqual(expect.arrayContaining(['kawagiri', 'matsubara']));
  const view = a.view(), village = view.places.find((p) => p.id === 'kawagiri')!;
  expect(recommendPeople(view, village).map((p) => p.id)).toContain('sora');
  expect(a.assign(plan('sora', 'kawagiri', 'visit'))).toEqual({ ok: true });
  a.cancelPlan('sora');
  expect(a.moveEveryone('kawagiri')).toEqual({ ok: true });
  expect(a.begin()).toEqual({ ok: true });
  for (const outing of s.outings) expect(outing.legs.filter(leg => leg.kind === 'walk').at(-1)!.points!.at(-1)!.x).toBeGreaterThan(1800);
  playToMorning(sim);
  expect(s.people.every((p) => p.base === 2 && p.lodging === undefined)).toBe(true);
  expect(s.visits.kawagiri).toBe(1);
  expect(homeName(s, 'sora')).toBe('Kawagiri');
  expect(campOf(2).fire.x).toBeGreaterThan(1800);
  expect(placeDef('funaya').at.x).toBeGreaterThan(1600);
  for (const id of ['funaya', 'takayuka', 'kawaguchi', 'far-shore', 'fish-traps']) {
    const p = placeDef(id);
    expect(a.view().forecast({ ...plan('sora', id, p.activities[0]!), visitOnly: true }).problem, id).toBeNull();
  }
});

it('keeps the small crossing and the dry eastern approach open at every water level', () => {
  const { a } = lowerReach();
  for (const level of ['low', 'middle', 'high'] as const) {
    const today = { ...todayOf(a.seed, 1), level };
    a.nav.setOpenGround(openGround(adventureValley, today, a.state));
    expect(crossingOpen('estuary-bridge', today, a.state)).toBe(true);
    const path = a.nav.route(setOutFrom(a.state, { region: 2 }, 'sora'), campOf(2).fire, 6800);
    expect(path, level).not.toBeNull();
    expect(a.nav.clearAlong(path!), level).toBe(true);
    expect(path!.some((p) => Math.abs(p.y - COAST_BRIDGE.y) < 45 && p.x > 1000 && p.x < 1320)).toBe(true);
  }
});

it('can build and work a dock and boat on the new eastern shore and sails entirely on water', () => {
  const { a, sim } = lowerReach();
  a.assign(plan('sora', 'shiobashi', 'explore')); playToMorning(sim);
  a.moveEveryone('kawagiri'); playToMorning(sim);
  a.state.discoveries['boat-ledger'] = { day: 1, by: 'sora' };
  expect(a.place('dock', { x: 1800, y: 5800 })).toEqual({ ok: true });
  a.rest('sora'); playToMorning(sim);
  expect(a.state.buildings.find((b) => b.kind === 'dock')?.work).toBe(structureDef('dock').work);
  expect(a.place('boat', { x: 1820, y: 5940 })).toEqual({ ok: true });
  a.rest('sora'); playToMorning(sim); a.rest('sora'); playToMorning(sim);
  for (const id of ['mended-sail', 'tide-marks']) a.state.discoveries[id] = { day: a.state.day, by: 'sora' };
  expect(a.sail(a.state.people.map((p) => p.id))).toEqual({ ok: true });
  for (let t = 0; t <= 30; t += .1) {
    const at = boatAt(a.state, t)!.at;
    expect(at.y >= adventureValley.sea!.y || valleyRiver().edgeDistance(at) < 0, `boat at ${t}`).toBe(true);
  }
  expect(boatAt(a.state, 30)!.at.x).toBeGreaterThan(1600);
});


it('meets a visible boatbuilder at the eastern boatyard, with a reply and a remembered conversation', () => {
  const { a, sim } = newExpedition(); const s = a.state;
  s.region = 2; s.provisions = 20; s.known.push('kawagiri', 'funaya');
  // Aki always walks this far with us: the boatbuilder knew his grandfather.
  s.people.push({ id: 'aki', base: 2, practice: {}, memories: [] });
  for (const person of s.people) person.base = 2;
  expect(a.assign(plan('sora', 'funaya', 'visit'))).toEqual({ ok: true });
  expect(a.begin()).toEqual({ ok: true });
  const first = s.outings[0]!.legs.find((l) => l.kind === 'beat')!;
  s.elapsed = first.start + 4.1;
  expect(a.scene().figures.find((f) => f.id === 'boatyard-moulds')).toMatchObject({ pose: 'talk', visible: true });
  expect(a.view().tags.some((t) => t.text.startsWith('Boatbuilder:'))).toBe(true);
  playToMorning(sim);
  expect(a.view().journal.find((f) => f.id === 'boatyard-moulds')?.conversation?.map((l) => l.speaker)).toEqual(['Sora', 'Boatbuilder', 'Sora', 'Boatbuilder']);
});

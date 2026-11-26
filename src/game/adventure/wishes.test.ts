import { describe, expect, it } from 'vitest';
import { newExpedition, playToMorning } from './testing';
import { restoreAdventure } from './restore';
import { WISHES, aboardLine, wishOf, wishBuilding } from './wishes';
import { aboardWords } from './finale';
import { endingWords } from './endingWords';
import { gateOpen, readyToMove } from './progression';
import { personDef } from './people';
import { structureDef } from './structures';
import type { ExpeditionAdventure } from './expedition';
import type { StructureKind } from './model';

/** Puts a finished small work by the given reach's fire, as if placed this morning. */
function standing(a: ExpeditionAdventure, kind: StructureKind, region: number): void {
  const at = [{ x: 820, y: 1500 }, { x: 600, y: 3300 }, { x: 1800, y: 5800 }][region]!;
  a.state.buildings.push({ id: a.state.nextId++, kind, x: at.x, y: at.y, region, work: 0, placed: a.state.day });
}

function group(a: ExpeditionAdventure, region: number, ids: string[]): void {
  a.state.region = region;
  a.state.provisions = 30;
  a.state.people = ids.map((id) => ({ id, base: region, practice: {}, memories: [] }));
}

const evenings = (a: ExpeditionAdventure) => a.state.history.flatMap((day) => day.items ?? []);

describe('companion wishes', () => {
  it('each friend says their wish once, one a night, and the People page remembers it', () => {
    const { a, sim } = newExpedition();
    playToMorning(sim);
    playToMorning(sim);
    playToMorning(sim);
    const said = evenings(a).filter((item) => item.title.endsWith(', by the fire'));
    expect(said.map((item) => item.person).sort()).toEqual(['mina', 'ren']);
    expect(new Set(a.state.history.filter((day) => day.items?.some((i) => i.title.endsWith(', by the fire'))).map((d) => d.day)).size).toBe(2);
    expect(a.view().friends.find((f) => f.id === 'ren')!.wish).toEqual({ text: wishOf('ren')!.wants, granted: false });
    expect(a.view().friends.find((f) => f.id === 'sora')!.wish).toBeUndefined();
    expect(a.view().structures.find((s) => s.id === 'platform')!.wish).toMatchObject({ person: 'ren', granted: false });
  });

  for (const wish of WISHES) {
    it(`grants ${wish.person}’s ${wish.structure} once, as their own find, and survives a reload`, () => {
      const { a, sim } = newExpedition();
      const region = ['haru', 'yui'].includes(wish.person) ? 2 : 0;
      group(a, region, ['sora', 'ren', 'mina', wish.person].filter((id, i, all) => all.indexOf(id) === i));
      standing(a, wish.structure, region);
      playToMorning(sim);
      expect(a.state.discoveries[wish.find]).toEqual({ day: 1, by: wish.person });
      const granted = evenings(a).filter((item) => item.sketch === wish.find);
      expect(granted).toHaveLength(1);
      expect(granted[0]).toMatchObject({ person: wish.person, kind: 'find', hint: 'rare' });
      expect(a.state.people.find((p) => p.id === wish.person)!.memories[0]).toContain(':');
      expect(a.view().friends.find((f) => f.id === wish.person)!.wish).toEqual({ text: wish.has, granted: true });
      // Never twice, and the reload keeps both the grant and the said day.
      const restored = restoreAdventure(structuredClone(a.state));
      expect(restored.discoveries[wish.find]).toEqual(a.state.discoveries[wish.find]);
      expect(restored.people.find((p) => p.id === wish.person)!.wish).toBe(1);
      playToMorning(sim);
      expect(evenings(a).filter((item) => item.sketch === wish.find)).toHaveLength(1);
      expect(aboardLine(a.state, wish.person, personDef(wish.person).aboard)).toBe(wish.aboard);
    });
  }

  it('waits for the friend: a work built far from where they live is not theirs', () => {
    const { a, sim } = newExpedition();
    standing(a, 'platform', 1);
    playToMorning(sim);
    expect(a.state.discoveries['dusk-iwana']).toBeUndefined();
  });

  it('waits for a coastal shelter and does not invent a friend at Yui’s fire', () => {
    const { a, sim } = newExpedition();
    group(a, 2, ['sora', 'yui']);
    a.state.people[0]!.lodging = 'ashikari';
    a.state.buildings.push({ id: a.state.nextId++, kind: 'shelter', x: 150, y: 4700, region: 2, work: 0, placed: 1 });
    expect(wishBuilding(a.state, wishOf('yui')!)).toBeUndefined();
    playToMorning(sim);
    expect(a.state.discoveries['tide-night']).toBeUndefined();
    standing(a, 'shelter', 2);
    playToMorning(sim);
    const night = evenings(a).find(item => item.sketch === 'tide-night');
    expect(night?.text).toContain('Yui sat under');
    expect(night?.text).not.toContain('Sora');
  });

  it('Haru’s lookout shows the way ahead, and Yui’s night is shared with a friend', () => {
    const { a, sim } = newExpedition();
    group(a, 2, ['sora', 'ren', 'haru', 'yui']);
    a.state.known = a.state.known.filter((id) => id !== 'todai');
    a.state.rumoured = [];
    standing(a, 'lookout', 2);
    standing(a, 'shelter', 2);
    playToMorning(sim);
    expect(a.state.rumoured).toContain('todai');
    expect(evenings(a).find((item) => item.sketch === 'tide-night')!.text).toContain('Yui and Haru');
  });

  it('changes the boarding word and the ending, and gates nothing', () => {
    const { a } = newExpedition();
    group(a, 2, ['sora', 'ren', 'mina']);
    const before = { open: gateOpen(a.state), ready: readyToMove(a.state) };
    a.state.discoveries['dusk-iwana'] = { day: 1, by: 'ren' };
    a.state.discoveries['herb-bed'] = { day: 1, by: 'mina' };
    expect({ open: gateOpen(a.state), ready: readyToMove(a.state) }).toEqual(before);
    a.state.companions = ['sora', 'ren', 'mina'];
    a.state.farewell = a.state.companions.map((person, i) => ({ person, points: [], seconds: 2 + i }));
    expect(aboardWords(a.state).find((w) => w.person === 'ren')!.line).toContain(wishOf('ren')!.aboard);
    expect(endingWords(a.state)).toContain('Ren’s platform and Mina’s herbs');
  });
});

describe('wishes stay off the main path', () => {
  it('every wished-for work is small: cheap, no workdays, and never a story work', () => {
    for (const wish of WISHES) {
      const def = structureDef(wish.structure);
      expect(def.major, wish.structure).toBeFalsy();
      expect(def.work).toBe(0);
      expect(def.cost).toBeLessThanOrEqual(3);
    }
  });
});

describe('small works', () => {
  it('stand the moment they are placed, cost little, and never wait on a story work', () => {
    const { a } = newExpedition();
    a.state.materials = 20;
    a.state.region = 1; a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
    for (const p of a.state.people) p.base = 1;
    expect(a.place('cottage', { x: 560, y: 3200 })).toEqual({ ok: true });
    const before = a.state.materials;
    expect(a.place('garden', { x: 380, y: 3120 })).toEqual({ ok: true });
    expect(before - a.state.materials).toBeLessThanOrEqual(3);
    const garden = a.state.buildings.find((b) => b.kind === 'garden')!;
    expect(a.view().structures.find((s) => s.id === 'garden')).toMatchObject({ status: 'built' });
    expect(garden.work).toBe(0);
    expect(a.view().structures.find((s) => s.id === 'cottage')).toMatchObject({ status: 'building', major: true });
  });

  it('an old save with a half-built small work loads finished', () => {
    const { a } = newExpedition();
    const raw = structuredClone(a.state) as unknown as { buildings: unknown[] };
    raw.buildings = [{ id: 9, kind: 'shelter', x: 320, y: 2040, region: 0, work: 1, placed: 1 }];
    const restored = restoreAdventure(raw);
    expect(restored.buildings[0]).toMatchObject({ kind: 'shelter', work: 0 });
    const { a: b } = newExpedition();
    Object.assign(b.state, restored);
    expect(b.view().structures.find((s) => s.id === 'shelter')!.status).toBe('built');
  });
});

it('lets a met resident Haru enjoy a coastal lookout without joining or blocking the voyage', () => {
  const { a, sim } = newExpedition();
  group(a, 2, ['sora', 'ren']);
  a.state.known.push('kawagiri', 'matsubara');
  a.state.discoveries['haru-meeting'] = {day:1,by:'sora'};
  standing(a, 'lookout', 2);
  a.rest('sora'); a.rest('ren'); playToMorning(sim);
  expect(a.state.discoveries['sea-eagle']).toBeDefined();
  expect(a.state.people.some(p => p.id === 'haru')).toBe(false);
  expect(a.state.history[0]!.items?.filter(i => i.sketch === 'sea-eagle')).toHaveLength(1);
  const saved = restoreAdventure(structuredClone(a.state));
  expect(saved.discoveries['sea-eagle']).toEqual(a.state.discoveries['sea-eagle']);
});

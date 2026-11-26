import { expect, it } from 'vitest';
import { newExpedition, plan } from '../../game/adventure/testing';
import { mapStopHints } from './stopHints';

it('offers only legal known second stops for the traveller with a confirmed outing', () => {
  const { a } = newExpedition();
  const first = plan('sora', 'kamimori', 'explore');
  expect(a.assign(first).ok).toBe(true);
  const view = a.view(), hints = mapStopHints(view);
  expect(hints.size).toBeGreaterThan(0);
  for (const choices of hints.values()) for (const hint of choices) {
    expect(hint.person).toBe('sora');
    expect(hint.stop.place).not.toBe(first.place);
    expect(view.places.find(p => p.id === hint.stop.place)?.rumour).toBeNull();
    expect(view.forecast({ ...first, second: hint.stop }).problem).toBeNull();
  }
  expect(mapStopHints(view, 'ren').size).toBe(0);
  const hint = [...hints.values()][0]![0]!;
  expect(a.assign({ ...first, second: hint.stop }).ok).toBe(true);
  expect(mapStopHints(a.view()).size).toBe(0);
});

it('offers camp-move stops without changing the destination and hides a full stop slot', () => {
  const { a } = newExpedition();
  a.state.day = 5; a.state.provisions = 20; a.state.materials = 10;
  a.state.discoveries.waymark = { day: 1, by: 'sora' };
  expect(a.moveEveryone('mio').ok).toBe(true);
  const view = a.view(), choices = [...mapStopHints(view, 'sora').values()].flat();
  expect(choices.length).toBeGreaterThan(0);
  for (const hint of choices) {
    expect(hint.moving).toBe(true);
    expect(view.detour(hint.person, hint.stop).problem).toBeNull();
  }
  expect(a.detour('sora', choices[0]!.stop).ok).toBe(true);
  expect(a.state.plans.find(p => p.person === 'sora')!.place).toBe('mio');
  expect(mapStopHints(a.view(), 'sora').size).toBe(0);
  expect(mapStopHints(a.view(), 'ren').size).toBeGreaterThan(0);
});

it('offers an explicit second stop on a place page even when every companion is already assigned', async () => {
  const { plannedStopsAt } = await import('./stopHints');
  const { a } = newExpedition(); a.state.day = 4; a.state.known.push('fuchi');
  for (const [person, place] of [['sora', 'suisha'], ['ren', 'fuchi'], ['mina', 'kamimori']]) {
    expect(a.assign(plan(person, place, 'explore'))).toEqual({ ok: true });
  }
  const before = structuredClone(a.state.plans), view = a.view();
  expect(view.friends.every(friend => friend.status !== 'home')).toBe(true);
  expect(plannedStopsAt(view, 'hatake').some(stop => stop.person === 'sora')).toBe(true);
  expect(a.state.plans).toEqual(before);
});

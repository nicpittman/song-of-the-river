import { expect, it } from 'vitest';
import { newExpedition, plan, playToMorning } from './testing';

it('takes back a second stop without losing the original trip, then takes back the trip', () => {
  const { a } = newExpedition();
  a.state.day = 4;
  for (const id of ['suisha', 'hatake']) if (!a.state.known.includes(id)) a.state.known.push(id);
  const original = plan('sora', 'suisha', 'visit');
  expect(a.command({ type: 'assign', plan: original }).ok).toBe(true);
  expect(a.command({ type: 'assign', plan: { ...original, second: { place: 'hatake', activity: 'forage' } } }).ok).toBe(true);
  expect(a.view().canUndoPlan).toBe(true);
  expect(a.command({ type: 'undo-plan' }).ok).toBe(true);
  expect(a.state.plans).toEqual([original]);
  expect(a.command({ type: 'undo-plan' }).ok).toBe(true);
  expect(a.state.plans).toEqual([]);
  expect(a.view().canUndoPlan).toBe(false);
});

it('restores all individual outings and camp choices when a group move is undone', () => {
  const { a } = newExpedition();
  a.state.discoveries.waymark = { day: 1, by: 'sora' };
  a.state.provisions = 20; a.state.materials = 10;
  a.command({ type: 'assign', plan: plan('sora', 'kamimori', 'explore') });
  a.command({ type: 'rest', person: 'ren' });
  const before = structuredClone({ plans: a.state.plans, resting: a.state.resting });
  expect(a.command({ type: 'move-everyone', place: 'mio' }).ok).toBe(true);
  expect(a.state.plans).toHaveLength(3);
  expect(a.command({ type: 'undo-plan' }).ok).toBe(true);
  expect({ plans: a.state.plans, resting: a.state.resting }).toEqual(before);
});

it('undoes a detour separately from its group journey', () => {
  const { a } = newExpedition();
  a.state.discoveries.waymark = { day: 1, by: 'sora' };
  a.state.provisions = 20; a.state.materials = 10; a.state.day = 5;
  expect(a.command({ type: 'move-everyone', place: 'mio' }).ok).toBe(true);
  const before = structuredClone(a.state.plans);
  expect(a.command({ type: 'detour', person: 'sora', stop: { place: 'hatake', activity: 'forage' } }).ok).toBe(true);
  expect(a.command({ type: 'undo-plan' }).ok).toBe(true);
  expect(a.state.plans).toEqual(before);
});

it('ignores refused, unchanged and inspection commands in planning history', () => {
  const { a } = newExpedition();
  const original = plan('sora', 'kamimori', 'explore');
  a.command({ type: 'assign', plan: original });
  a.command({ type: 'assign', plan: original });
  expect(a.command({ type: 'camp', person: 'sora', shelter: 999 }).ok).toBe(false);
  a.command({ type: 'inspect', place: 'fuchi' });
  a.command({ type: 'undo-plan' });
  expect(a.state.plans).toEqual([]);
  expect(a.canUndoPlan).toBe(false);
});

it('cannot undo a day already underway or carry yesterday’s undo into a new morning', () => {
  const { a, sim } = newExpedition();
  a.command({ type: 'rest', person: 'sora' });
  expect(a.command({ type: 'begin' }).ok).toBe(true);
  expect(a.canUndoPlan).toBe(false);
  expect(a.command({ type: 'undo-plan' }).ok).toBe(false);
  playToMorning(sim);
  expect(a.canUndoPlan).toBe(false);
  a.command({ type: 'rest', person: 'ren' });
  a.command({ type: 'undo-plan' });
  expect(a.canUndoPlan).toBe(false);
  expect(a.state.resting).toEqual([]);
});

it('redoes an undone group plan atomically, and clears redo after a different plan or a new morning', () => {
  const { a, sim } = newExpedition();
  a.command({ type: 'rest', person: 'sora' });
  a.command({ type: 'rest', person: 'ren' });
  const planned = structuredClone(a.state.resting);
  a.command({ type: 'undo-plan' }); expect(a.view().canRedoPlan).toBe(true);
  expect(a.command({ type: 'redo-plan' }).ok).toBe(true); expect(a.state.resting).toEqual(planned);
  a.command({ type: 'undo-plan' }); a.command({ type: 'rest', person: 'mina' });
  expect(a.canRedoPlan).toBe(false);
  a.command({ type: 'undo-plan' }); playToMorning(sim); expect(a.canRedoPlan).toBe(false);
});

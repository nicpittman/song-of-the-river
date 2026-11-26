import { expect, it } from 'vitest';
import { newExpedition } from '../../../game/adventure/testing';
import { almanacSeasons, orderedCollections } from './collectionsPage';

it('keeps catalogue and specimen order regardless of source order or discovery progress', () => {
  const { a } = newExpedition();
  const view = a.view();
  const original = orderedCollections(view);
  expect(original.length).toBeGreaterThan(0);
  expect(original[0].set.id).toBe('river-birds');
  expect(original[0].entries.map(entry => entry.id)).toEqual(['dipper', 'kingfisher', 'heron', 'plover']);
  const changed = {
    ...view, day: view.day + 7,
    sets: [...view.sets].reverse().map(set => ({ ...set, complete: true, found: set.total })),
    journal: [...view.journal].reverse().map(entry => ({ ...entry, found: true })),
  };
  const ordered = (entries: ReturnType<typeof orderedCollections>) => entries.map(({ set, entries }) => [set.id, entries.map(entry => entry.id)]);
  expect(ordered(orderedCollections(changed))).toEqual(ordered(original));
  expect(changed.sets[0].id).toBe(view.sets.at(-1)!.id);
  expect(changed.journal[0].id).toBe(view.journal.at(-1)!.id);
});

it('groups the almanac by season in calendar order, any season last, and keeps every note', () => {
  const { a } = newExpedition();
  const view = a.view();
  const aims = [
    { line: 'winter', done: false, season: 3 }, { line: 'friend', done: false },
    { line: 'spring', done: true, season: 0 }, { line: 'autumn', done: false, season: 2 },
  ];
  const groups = almanacSeasons({ ...view, aims });
  expect(groups.map(group => group.name)).toEqual(['Spring', 'Autumn', 'Winter', 'Any season']);
  expect(groups.flatMap(group => group.aims).length).toBe(aims.length);
  expect(almanacSeasons({ ...view, aims: [] })).toEqual([]);
});

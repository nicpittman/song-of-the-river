import { expect, it } from 'vitest';
import type { Art, ArtLibrary } from '../art';
import { creatureOf } from './creatures';

/** An art library that knows a few painted creatures, as the real one does. */
const KNOWN = new Set(['kingfisher', 'butterfly', 'seal', 'otter-0', 'otter-1', 'swallow-0', 'swallow-1', 'hawk-0', 'hawk-1', 'salmon', 'songbird', 'bird-up', 'bird-down']);
const art = {
  known: (id: string) => KNOWN.has(id),
  get: (id: string) => ({ id } as unknown as Art),
  frames: (prefix: string) => [...KNOWN].filter((id) => id.startsWith(`${prefix}-`)),
} as unknown as ArtLibrary;

it('draws each creature as itself, not as whatever its name happens to contain', () => {
  const kingfisher = creatureOf('willow-kingfisher', art);
  expect([kingfisher.family, kingfisher.still.id]).toEqual(['percher', 'kingfisher']);
  expect(creatureOf('kingfisher', art).family).toBe('percher');
  for (const insect of ['hawk-moth', 'moon-moth', 'swallowtails']) {
    const c = creatureOf(insect, art);
    expect([insect, c.family, c.still.id]).toEqual([insect, 'flutter', 'butterfly']);
  }
  const seal = creatureOf('seal', art);
  expect([seal.family, seal.still.id]).toEqual(['swimmer', 'seal']);
  expect(creatureOf('cherry-salmon', art).family).toBe('fish');
  expect(creatureOf('swallows', art).still.id).toBe('swallow-0');
});

it('washes the shared butterfly in each moth’s and the swallowtail’s own colour', () => {
  expect(creatureOf('moon-moth', art).tint).not.toBe(0xffffff);
  expect(creatureOf('hawk-moth', art).tint).not.toBe(creatureOf('moon-moth', art).tint);
  expect(creatureOf('swallowtails', art).tint).not.toBe(0xffffff);
  expect(creatureOf('dipper', art).tint).toBe(0xffffff);
});
